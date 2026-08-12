/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerRenderTools } from '../../tools/render.js';
import type { ElementeerClient } from '../../client.js';
import { BridgeError } from '../../render-client.js';
import {
  screenshotResourceUri,
  screenshotResourceKey,
  parseScreenshotResourceUri,
  buildContentHash,
  storeScreenshot,
  getScreenshot,
} from '../../screenshot-cache.js';

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
      elementor_data: [],
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
    const uri = screenshotResourceUri(42, 'p42-r2026-08-12-10-00-00');
    expect(uri).toBe('elementeer://pages/42/screenshot/p42-r2026-08-12-10-00-00');

    const parsed = parseScreenshotResourceUri('pages/42/screenshot/p42-r2026-08-12-10-00-00');
    expect(parsed).not.toBeNull();
    expect(parsed!.pageId).toBe(42);
    expect(parsed!.contentHash).toBe('p42-r2026-08-12-10-00-00');
  });

  it('parses cache keys consistently', () => {
    const key = screenshotResourceKey(10, 'abc-123');
    expect(key).toBe('pages/10/screenshot/abc-123');
  });

  it('returns null for malformed URIs', () => {
    expect(parseScreenshotResourceUri('pages/42/data/structure')).toBeNull();
    expect(parseScreenshotResourceUri('elementeer://pages/42/other/abc')).toBeNull();
    expect(parseScreenshotResourceUri('pages/not-a-number/screenshot/hash')).toBeNull();
  });

  it('builds content_hash from page id and modified date', () => {
    expect(buildContentHash(42, '2026-08-12 10:00:00')).toBe('p42-r2026-08-12-10-00-00');
    expect(buildContentHash(1, '2024-01-01T00:00:00Z')).toBe('p1-r2024-01-01t00-00-00z');
  });
});

describe('Screenshot cache', () => {
  const mockResult = {
    url: 'https://example.com',
    screenshots: {
      desktop: 'http://localhost:3201/static/scrapes/stub/desktop.png',
      tablet: 'http://localhost:3201/static/scrapes/stub/tablet.png',
      mobile: 'http://localhost:3201/static/scrapes/stub/mobile.png',
    },
    meta: { title: 'Test', description: '' },
    captured_at: '2026-08-12T10:00:00.000Z',
  };

  it('stores and retrieves screenshots by resource key', () => {
    storeScreenshot('pages/42/screenshot/hash-abc', mockResult, 42, 'hash-abc');
    const entry = getScreenshot('pages/42/screenshot/hash-abc');
    expect(entry).toBeDefined();
    expect(entry!.result.url).toBe('https://example.com');
    expect(entry!.result.screenshots.desktop).toContain('desktop.png');
    expect(entry!.contentHash).toBe('hash-abc');
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
  let bridgeRequestMock: MockInstance;

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

    process.env['ELEMENTEER_BRIDGE_URL'] = 'http://localhost:3201';
    process.env['ELEMENTEER_BRIDGE_API_KEY'] = 'test-key';

    registerRenderTools(server, getClient);
  });

  afterEach(() => {
    delete process.env['ELEMENTEER_BRIDGE_URL'];
    delete process.env['ELEMENTEER_BRIDGE_API_KEY'];
    vi.restoreAllMocks();
  });

  async function callTool(name: string, args: Record<string, unknown> = {}): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
    const handler = toolHandlers.get(name);
    if (!handler) throw new Error(`Tool "${name}" not registered`);
    return handler(args) as Promise<any>;
  }

  it('errors when ELEMENTEER_BRIDGE_URL is not set', async () => {
    delete process.env['ELEMENTEER_BRIDGE_URL'];

    const result = await callTool('request_screenshot', { page_id: 42 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('ELEMENTEER_BRIDGE_URL');
  });

  it('errors when page is not found in listElementorPages', async () => {
    vi.mocked(client.listElementorPages).mockResolvedValueOnce({
      posts: [],
      total: 0,
      total_pages: 1,
    });

    const result = await callTool('request_screenshot', { page_id: 99 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });

  it('errors when page has no URL', async () => {
    vi.mocked(client.listElementorPages).mockResolvedValueOnce({
      posts: [{ id: 42, title: 'No URL', slug: 'no-url', post_type: 'page', status: 'publish', url: '', modified: '2026-01-01' }],
      total: 1,
      total_pages: 1,
    });

    const result = await callTool('request_screenshot', { page_id: 42 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('no public URL');
  });

  it('returns bridge error details when bridge fails', async () => {
    const mockBridgeClient = {
      baseUrl: 'http://localhost:3201',
      apiKey: 'test-key',
      requestScreenshot: vi.fn().mockRejectedValue(
        new BridgeError('Bridge timeout', 504, 'Gateway Timeout'),
      ),
    };

    vi.doMock('../../render-client.js', () => ({
      getBridgeClient: () => mockBridgeClient,
      getBridgeUrl: () => 'http://localhost:3201',
      BridgeError,
    }));

    const result = await callTool('request_screenshot', { page_id: 42 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Bridge error');
  });
});
