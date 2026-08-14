import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { resolvePayloadViaResource, registerPageResourceTemplates } from '../page-resource-cache.js';
import type { ElementeerClient } from '../client.js';

/**
 * ELM-PROJ: reading back a projection resource.
 *
 * The SDK parses our custom scheme with `new URL(...)`, so
 * `elementeer://pages/2340/data/structure` becomes hostname="pages" and
 * pathname="/2340/data/structure". A handler that re-parses the pathname
 * therefore sees "2340/data/structure" — the "pages/" prefix is gone, the
 * key never matches what the writer stored, and EVERY read failed with
 * "Unsupported resource URI: 2340/data/structure".
 *
 * The screenshot handler in the same file already carried a comment about
 * exactly this (ELM-RENDER-001 breach 4) and used the SDK-provided template
 * variables instead. The fix existed; it was never carried across to the
 * projection handler. These tests pin both halves: the writer's key and the
 * reader's key must be built the same way.
 */

type ResourceHandler = (
  uri: URL,
  variables: Record<string, string | string[]>,
) => Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }>;

describe('page projection resources (ELM-PROJ)', () => {
  let server: McpServer;
  let handlers: Map<string, ResourceHandler>;
  let client: ElementeerClient;

  // Comfortably above the offload threshold so the payload really is stored
  // as a resource rather than returned inline.
  const BIG = 'x'.repeat(200_000);

  beforeEach(() => {
    server = new McpServer({ name: 'test', version: '0.0.0' });
    handlers = new Map();

    vi.spyOn(server, 'registerResource').mockImplementation(
      (...args: Parameters<typeof server.registerResource>) => {
        const name = args[0] as string;
        handlers.set(name, args[args.length - 1] as ResourceHandler);
        return server as never;
      },
    );

    client = { getPageData: vi.fn() } as unknown as ElementeerClient;
    registerPageResourceTemplates(server, () => client);
  });

  it('stores under a key the reader can find again', async () => {
    const stored = resolvePayloadViaResource(
      { pageId: 2340, data: [] },
      JSON.stringify({ pageId: 2340, filler: BIG }),
      'structure',
      { pageId: 2340, post_title: 'Handwerk' },
    );

    expect(stored.asResource).toBe(true);
    if (!stored.asResource) return;
    expect(stored.uri).toBe('elementeer://pages/2340/data/structure');

    const handler = handlers.get('page-structure-projection');
    expect(handler).toBeDefined();

    // The variables are what the SDK passes after matching the template.
    // uri.pathname deliberately lacks the "pages/" prefix — that is the
    // whole point of the bug, so the fixture reproduces it faithfully.
    const uri = new URL(stored.uri);
    expect(uri.pathname.replace(/^\//, '')).toBe('2340/data/structure');

    const res = await handler!(uri, { pageId: '2340' });
    expect(res.contents[0]!.text).toContain('2340');
    // Served from cache — no API call needed.
    expect(client.getPageData).not.toHaveBeenCalled();
  });

  it('rejects a malformed pageId instead of guessing', async () => {
    const handler = handlers.get('page-content-projection');
    await expect(
      handler!(new URL('elementeer://pages/abc/data/content'), { pageId: 'abc' }),
    ).rejects.toThrow(/malformed pageId/);
  });

  it('does not offload a payload below the threshold', () => {
    const small = resolvePayloadViaResource(
      { pageId: 1, data: [] },
      JSON.stringify({ pageId: 1 }),
      'content',
      { pageId: 1, post_title: 'Small' },
    );
    expect(small.asResource).toBe(false);
  });
});
