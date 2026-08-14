/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRenderTools } from '../../tools/render.js';
import type { ElementeerClient } from '../../client.js';
import { BridgeError } from '../../render-client.js';
import {
  screenshotResourceUri,
  screenshotResourceKey,
  parseScreenshotResourceUri,
  storeScreenshot,
  getScreenshot,
} from '../../screenshot-cache.js';

// ELM-RENDER-003: the previous tests used `vi.doMock` AFTER `registerRenderTools`
// had already statically imported `render-client.js`. `doMock` is not hoisted,
// so it never took effect and the "bridge error" / "hash mismatch" assertions
// exercised the wrong code path (they got "ELEMENTEER_BRIDGE_URL is not set"),
// meaning a failure in the real requestScreenshot flow would NOT have made the
// test red. We use hoisted `vi.mock` instead so the mock module is what both
// render.ts and the test import.
const mockRequestScreenshot = vi.hoisted(() => vi.fn());
const mockGetBridgeClient = vi.hoisted(() => vi.fn());
const mockGetBridgeUrl = vi.hoisted(() => vi.fn());

vi.mock('../../render-client.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../render-client.js')>();
  return {
    ...original,
    BridgeError: original.BridgeError,
    getBridgeClient: mockGetBridgeClient,
    getBridgeUrl: mockGetBridgeUrl,
  };
});

function makeClient(overrides: Partial<Record<keyof ElementeerClient, unknown>> = {}): ElementeerClient {
  return {
    listElementorPages: vi.fn().mockResolvedValue({
      posts: [
        {
          id: 42,
          title: 'Test Page',
          slug: 'test-page',
          post_type: 'page',
          status: 'publish',
          url: 'https://example.com/test',
          modified: '2026-08-12 10:00:00',
        },
      ],
      total: 1,
      total_pages: 1,
    }),
    getPageData: vi.fn().mockResolvedValue({
      post_id: 42,
      post_title: 'Test Page',
      post_type: 'page',
      element_count: 3,
      elementor_data: [
        {
          id: 'a1b2c3d4',
          elType: 'container',
          settings: { _title: 'Hero' },
          elements: [
            {
              id: 'e5f6g7h8',
              elType: 'widget',
              widgetType: 'heading',
              settings: { title: 'Hello World', header_size: 'h1' },
              elements: [],
            },
          ],
        },
      ],
    }),
    createChange: vi.fn(),
    listChanges: vi.fn().mockResolvedValue({ changes: [], total: 0 }),
    getChange: vi.fn(),
    updateChangeStatus: vi.fn(),
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    duplicateTemplate: vi.fn(),
    getTemplateData: vi.fn(),
    updateTemplateData: vi.fn(),
    getSiteInfo: vi.fn(),
    updatePageData: vi.fn(),
    setGlobalColors: vi.fn(),
    setGlobalTypography: vi.fn(),
    setLogo: vi.fn(),
    setSiteContext: vi.fn(),
    ...overrides,
  } as unknown as ElementeerClient;
}

describe('Screenshot URI helpers', () => {
  it('builds and parses a full resource URI round-trip', () => {
    const uri = screenshotResourceUri(42, 'a'.repeat(64));
    expect(uri).toBe(`elementeer://pages/42/screenshot/${'a'.repeat(64)}`);

    const parsed = parseScreenshotResourceUri(`pages/42/screenshot/${'a'.repeat(64)}`);
    expect(parsed).not.toBeNull();
    expect(parsed!.pageId).toBe(42);
    expect(parsed!.renderHash).toBe('a'.repeat(64));
  });

  it('parses cache keys consistently', () => {
    const key = screenshotResourceKey(10, 'abc');
    expect(key).toBe('pages/10/screenshot/abc');
  });

  it('returns null for malformed URIs', () => {
    expect(parseScreenshotResourceUri('pages/42/data/structure')).toBeNull();
    expect(parseScreenshotResourceUri('pages/42/screenshot/short')).toBeNull();
    expect(parseScreenshotResourceUri('pages/not-a-number/screenshot/aaaabbbbccccddddeeeeffffgggghhhhiiiijjjjkkkkllllmmmnnnnoo')).toBeNull();
  });
});

describe('Screenshot cache', () => {
  const mockResult = {
    pageId: 42,
    renderHash: 'a'.repeat(64),
    screenshots: {
      desktop: 'http://localhost:3201/static/page-screenshots/42/aaaa.../desktop.png',
      tablet: 'http://localhost:3201/static/page-screenshots/42/aaaa.../tablet.png',
      mobile: 'http://localhost:3201/static/page-screenshots/42/aaaa.../mobile.png',
    },
    capturedAt: '2026-08-12T10:00:00.000Z',
  };

  it('stores and retrieves screenshots by resource key', () => {
    storeScreenshot('pages/42/screenshot/aaaa', mockResult);
    const entry = getScreenshot('pages/42/screenshot/aaaa');
    expect(entry).toBeDefined();
    expect(entry!.result.pageId).toBe(42);
    expect(entry!.result.renderHash).toBe('a'.repeat(64));
  });

  it('returns undefined for unknown keys', () => {
    expect(getScreenshot('nonexistent')).toBeUndefined();
  });
});

describe('request_screenshot tool', () => {
  let server: McpServer;
  let client: ElementeerClient;
  let getClient: (siteId?: string) => ElementeerClient;
  let toolHandlers: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeClient();
    getClient = vi.fn().mockReturnValue(client);

    toolHandlers = new Map();
    vi.spyOn(server, 'tool').mockImplementation((...args: Parameters<typeof server.tool>) => {
      const name = args[0] as string;
      const handler = args[args.length - 1] as (args: Record<string, unknown>) => Promise<unknown>;
      toolHandlers.set(name, handler);
      return server as any;
    });

    mockRequestScreenshot.mockReset();
    mockGetBridgeClient.mockReset();
    mockGetBridgeUrl.mockReset();
    mockGetBridgeUrl.mockReturnValue('http://localhost:3201');
    mockGetBridgeClient.mockReturnValue({
      baseUrl: 'http://localhost:3201',
      apiKey: 'test-key',
      requestScreenshot: mockRequestScreenshot,
    });

    registerRenderTools(server, getClient);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const handler = toolHandlers.get(name);
    if (!handler) throw new Error(`Tool "${name}" not registered`);
    return handler(args) as Promise<any>;
  }

  it('errors when ELEMENTEER_BRIDGE_URL is not set', async () => {
    mockGetBridgeUrl.mockReturnValue(undefined);

    const result = await callTool('request_screenshot', { page_id: 42 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ELEMENTEER_BRIDGE_URL');
  });

  it('sends the wrapped ElementorTemplate object (breach 1) and returns the resource URI', async () => {
    const hash = 'a'.repeat(64);
    mockRequestScreenshot.mockResolvedValue({
      pageId: 42,
      renderHash: hash,
      screenshots: {
        desktop: `http://localhost:3201/static/page-screenshots/42/${hash}/desktop.png`,
        tablet: `http://localhost:3201/static/page-screenshots/42/${hash}/tablet.png`,
        mobile: `http://localhost:3201/static/page-screenshots/42/${hash}/mobile.png`,
      },
      capturedAt: '2026-08-12T10:00:00.000Z',
    });

    const result = await callTool('request_screenshot', { page_id: 42, template: 'full_page' });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].text).toContain(`elementeer://pages/42/screenshot/${hash}`);

    // Breach 1: template must be an OBJECT (ElementorTemplate), never a string.
    const sentRequest = mockRequestScreenshot.mock.calls[0][0] as {
      pageId: number;
      template: unknown;
    };
    expect(sentRequest.pageId).toBe(42);
    expect(typeof sentRequest.template).toBe('object');
    expect(sentRequest.template).toEqual(
      expect.objectContaining({
        title: 'Test Page',
        type: 'page',
        version: '0.4',
      }),
    );
    const template = sentRequest.template as { content: unknown[] };
    expect(template.content).toHaveLength(1);
    expect((template.content[0] as { elType: string }).elType).toBe('container');
    // isInner is normalized so the bridge contract is honored even though the
    // plugin's raw elementor_data does not carry it.
    expect((template.content[0] as { isInner: boolean }).isInner).toBe(false);
  });

  it('returns bridge error details when bridge fails (breach-2 renderHash flow)', async () => {
    mockRequestScreenshot.mockRejectedValue(
      new BridgeError('Bridge timeout', 504, 'Gateway Timeout'),
    );

    const result = await callTool('request_screenshot', { page_id: 42, template: 'full_page' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Bridge error');
    expect(result.content[0].text).toContain('504');
  });

  it('reports render hash mismatch between caller and bridge', async () => {
    const knownHash = 'a'.repeat(64);
    const bridgeHash = 'b'.repeat(64);

    mockRequestScreenshot.mockResolvedValue({
      pageId: 42,
      renderHash: bridgeHash,
      screenshots: {
        desktop: `http://localhost:3201/static/page-screenshots/42/${bridgeHash}/desktop.png`,
        tablet: '',
        mobile: '',
      },
      capturedAt: '2026-08-12T10:00:00.000Z',
    });

    const result = await callTool('request_screenshot', {
      page_id: 42,
      template: 'full_page',
      render_hash: knownHash,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('mismatch');
    expect(result.content[0].text).toContain(knownHash);
    expect(result.content[0].text).toContain(bridgeHash);
  });

  it('rejects viewpoint without containers', async () => {
    mockRequestScreenshot.mockResolvedValue({
      pageId: 42,
      renderHash: 'a'.repeat(64),
      screenshots: { desktop: '', tablet: '', mobile: '' },
      capturedAt: '2026-08-12T10:00:00.000Z',
    });

    const result = await callTool('request_screenshot', { page_id: 42, template: 'viewpoint' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('template=viewpoint requires');
    expect(mockRequestScreenshot).not.toHaveBeenCalled();
  });
});
