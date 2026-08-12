import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import { getBridgeClient, getBridgeUrl, BridgeError } from '../render-client.js';
import {
  storeScreenshot,
  screenshotResourceUri,
  screenshotResourceKey,
  buildContentHash,
} from '../screenshot-cache.js';

export function registerRenderTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {
  server.tool(
    'request_screenshot',
    'Request a screenshot of an Elementeer page from the rendering bridge. ' +
    'Sends the public page URL to the bridge, which takes desktop/tablet/mobile screenshots via Playwright. ' +
    'The result is stored as an MCP resource (elementeer://pages/{pageId}/screenshot/{contentHash}). ' +
    'The content_hash is a compound of page_id + last-modified timestamp — the URI changes when the page is edited.\n\n' +
    'Requires ELEMENTEER_BRIDGE_URL. The bridge must be reachable and able to resolve + render the page URL.',
    {
      site_id: z.string().optional().describe('Site ID from config (defaults to active site)'),
      page_id: z.number().int().describe('Page ID to screenshot — must exist and have a public URL'),
    },
    async ({ site_id, page_id }) => {
      const bridgeUrl = getBridgeUrl();
      if (!bridgeUrl) {
        return {
          content: [{
            type: 'text',
            text: 'Error: ELEMENTEER_BRIDGE_URL is not set. Screenshot tools are unavailable.\n\n' +
              'Set this environment variable to the bridge base URL (e.g. http://localhost:3201).',
          }],
          isError: true,
        };
      }

      const client = getClient(site_id);

      let pageUrl: string;
      let postTitle: string;
      let modified: string;

      try {
        const list = await client.listElementorPages({});
        const page = list.posts.find(p => p.id === page_id);

        if (!page) {
          return {
            content: [{
              type: 'text',
              text: `Error: Page ${page_id} not found in the Elementor page list. Verify the page_id and site.`,
            }],
            isError: true,
          };
        }

        pageUrl = page.url;
        postTitle = page.title;
        modified = page.modified;

        if (!pageUrl) {
          return {
            content: [{
              type: 'text',
              text: `Error: Page ${page_id} ("${postTitle}") has no public URL.`,
            }],
            isError: true,
          };
        }
      } catch (err) {
        return {
          content: [{
            type: 'text',
            text: `Error: Failed to read page list: ${err instanceof Error ? err.message : String(err)}`,
          }],
          isError: true,
        };
      }

      const contentHash = buildContentHash(page_id, modified);

      let bridge;
      try {
        bridge = getBridgeClient();
      } catch (err) {
        return {
          content: [{
            type: 'text',
            text: `Error: Bridge client unavailable: ${err instanceof Error ? err.message : String(err)}`,
          }],
          isError: true,
        };
      }

      try {
        const result = await bridge.requestScreenshot(pageUrl);

        const resourceKey = screenshotResourceKey(page_id, contentHash);
        storeScreenshot(resourceKey, result, page_id, contentHash);
        const uri = screenshotResourceUri(page_id, contentHash);

        const lines = [
          `Screenshot captured for page ${page_id} ("${postTitle}").`,
          `  URL scraped: ${pageUrl}`,
          `  Content hash (revision binding): ${contentHash}`,
          `  Page last modified: ${modified}`,
          `  Viewports: desktop, tablet, mobile`,
          '',
          `Resource URI: ${uri}`,
          '',
          'Use read_mcp_resource with this URI to fetch the screenshot. ' +
          'The URI includes the content_hash — the screenshot is bound to this exact page revision. ' +
          'If the page is edited between capture and read, the hash will differ and the resource will not resolve.',
        ].filter(Boolean);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      } catch (err) {
        if (err instanceof BridgeError) {
          return {
            content: [{
              type: 'text',
              text: `Bridge error (${err.status}): ${err.message}`,
            }],
            isError: true,
          };
        }
        return {
          content: [{
            type: 'text',
            text: `Error: Screenshot request failed: ${err instanceof Error ? err.message : String(err)}`,
          }],
          isError: true,
        };
      }
    },
  );
}
