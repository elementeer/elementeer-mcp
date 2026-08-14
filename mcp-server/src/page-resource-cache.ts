import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from './client.js';
import { projectElementorData, type ProjectionLevel } from './projection.js';
import { getScreenshot, screenshotResourceKey } from './screenshot-cache.js';

const RESOURCE_SIZE_THRESHOLD = 20_000;

interface CachedEntry {
  payload: unknown;
  plaintext: string;
  projection: ProjectionLevel;
  page_id: number;
  post_title: string;
  cached_at: number;
}

const cache = new Map<string, CachedEntry>();

export function resolvePayloadViaResource(
  projected: unknown,
  plaintext: string,
  projection: ProjectionLevel,
  meta: { pageId?: number; post_title?: string },
): { asResource: true; uri: string } | { asResource: false } {
  if (plaintext.length < RESOURCE_SIZE_THRESHOLD) return { asResource: false };

  const pageId = meta.pageId ?? 0;
  const postTitle = meta.post_title ?? `page-${pageId}`;
  const resourceKey = `pages/${pageId}/data/${projection}`;

  cache.set(resourceKey, {
    payload: projected,
    plaintext,
    projection,
    page_id: pageId,
    post_title: postTitle,
    cached_at: Date.now(),
  });

  return {
    asResource: true,
    uri: `elementeer://pages/${pageId}/data/${projection}`,
  };
}

export function registerPageResourceTemplates(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {
  const RESOURCE_PROJECTIONS: ProjectionLevel[] = ['structure', 'content', 'interaction', 'style_tokens', 'full'];

  for (const projection of RESOURCE_PROJECTIONS) {
    const template = new ResourceTemplate(
      `elementeer://pages/{pageId}/data/${projection}`,
      { list: undefined },
    );
    server.registerResource(
      `page-${projection}-projection`,
      template,
      {
        title: `Page ${projection} Projection`,
        description: `Reads the ${projection} projection for a page on demand. Falls back to cache; computes from the WordPress API on cache miss.`,
        mimeType: 'application/json',
      },
      async (uri: URL, variables: Record<string, string | string[]>) => {
        // Same breach as ELM-RENDER-001 breach 4 below, and it was fixed
        // there but never carried over to this handler: the SDK parses our
        // custom scheme with `new URL(...)`, so `elementeer://pages/2340/...`
        // becomes hostname="pages" and pathname="/2340/...". Re-parsing the
        // pathname therefore yields "2340/data/structure" — without the
        // "pages/" prefix the regex below can never match, and EVERY read of
        // a projection resource failed with "Unsupported resource URI".
        //
        // The SDK has already matched the template. Use its variables.
        const pageIdRaw = Array.isArray(variables.pageId) ? variables.pageId[0] : variables.pageId;
        if (!pageIdRaw || !/^\d+$/.test(pageIdRaw)) {
          throw new Error(
            `Page projection resource missing or malformed pageId: ${JSON.stringify(variables)}`,
          );
        }

        const pageId = parseInt(pageIdRaw, 10);
        const resourceProjection = projection;
        const resourceKey = `pages/${pageId}/data/${resourceProjection}`;

        const cached = cache.get(resourceKey);
        if (cached) {
          return {
            contents: [{
              uri: uri.href,
              mimeType: 'application/json' as const,
              text: cached.plaintext,
            }],
          };
        }

        try {
          const client = getClient();
          const result = await client.getPageData({ id: pageId });
          const rawData = result.elementor_data ?? [];

          let plaintext: string;
          let payload: unknown;

          if (resourceProjection === 'full') {
            payload = rawData;
            plaintext = JSON.stringify(rawData, null, 2);
          } else {
            const projected = projectElementorData(rawData, resourceProjection, {
              pageId: result.post_id ?? pageId,
              post_title: result.post_title,
              revision: result.post_modified ?? '',
            });
            payload = projected;
            plaintext = JSON.stringify(projected, null, 2);
          }

          cache.set(resourceKey, {
            payload,
            plaintext,
            projection: resourceProjection,
            page_id: pageId,
            post_title: result.post_title ?? '',
            cached_at: Date.now(),
          });

          return {
            contents: [{
              uri: uri.href,
              mimeType: 'application/json' as const,
              text: plaintext,
            }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`Failed to read page ${pageId} ${resourceProjection} projection: ${message}`);
        }
      },
    );
  }

  // Screenshot resource (ELM-RENDER-002)
  const screenshotTemplate = new ResourceTemplate(
    'elementeer://pages/{pageId}/screenshot/{renderHash}',
    { list: undefined },
  );
  server.registerResource(
    'page-screenshot',
    screenshotTemplate,
    {
      title: 'Page Screenshot',
      description: 'A screenshot of a page captured via the rendering bridge. Bound to a specific render_hash — the URI changes when the page is modified. Returns the desktop-viewport PNG image.',
      mimeType: 'image/png',
    },
    async (uri: URL, variables: Record<string, string | string[]>) => {
      // ELM-RENDER-001 breach 4: do NOT re-parse `uri.pathname`. The SDK parses
      // our custom scheme with `new URL(...)`, which turns `elementeer://pages/290/...`
      // into hostname="pages" and pathname="/290/...", dropping the "pages/"
      // prefix. The template match (already done by the SDK) has the correct
      // values — use `variables` instead.
      const pageIdRaw = Array.isArray(variables.pageId) ? variables.pageId[0] : variables.pageId;
      const renderHashRaw = Array.isArray(variables.renderHash) ? variables.renderHash[0] : variables.renderHash;

      if (!pageIdRaw || !renderHashRaw) {
        throw new Error(`Screenshot resource missing template variables: ${JSON.stringify(variables)}`);
      }

      const pageId = parseInt(pageIdRaw, 10);
      const renderHash = renderHashRaw;
      const resourceKey = screenshotResourceKey(pageId, renderHash);

      const cached = getScreenshot(resourceKey);

      if (!cached) {
        throw new Error(
          `No screenshot cached for page ${pageId} with hash ${renderHash}. ` +
          `Use request_screenshot to capture one first. ` +
          `If the page has been edited since capture, the hash will have changed.`,
        );
      }

      const { result } = cached;

      const desktopUrl = result.screenshots.desktop;
      if (!desktopUrl) {
        throw new Error(
          `Screenshot for page ${pageId} has no desktop image URL.`,
        );
      }

      try {
        const fetch = (await import('node:http')).get;
        const httpsMod = await import('node:https');
        const httpMod = await import('node:http');
        const mod = desktopUrl.startsWith('https://') ? httpsMod : httpMod;

        const imageBuffer = await new Promise<Buffer>((resolve, reject) => {
          const req = mod.get(desktopUrl, (res) => {
            if (res.statusCode !== 200) {
              reject(new Error(`Bridge returned ${res.statusCode} for screenshot image`));
              return;
            }
            const chunks: Buffer[] = [];
            res.on('data', (chunk: Buffer) => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
          });
          req.on('error', reject);
          req.setTimeout(10_000, () => {
            req.destroy();
            reject(new Error('Timeout fetching screenshot image from bridge'));
          });
        });

        return {
          contents: [{
            uri: uri.href,
            mimeType: 'image/png' as const,
            blob: imageBuffer.toString('base64'),
          }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain' as const,
            text: `Screenshot for page ${pageId} (hash: ${renderHash}):\n` +
              `  Desktop: ${desktopUrl}\n` +
              `  Tablet:  ${result.screenshots.tablet}\n` +
              `  Mobile:  ${result.screenshots.mobile}\n\n` +
              `Fetch error: ${message}`,
          }],
        };
      }
    },
  );
}
