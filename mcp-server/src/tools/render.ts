import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import { getBridgeClient, getBridgeUrl, BridgeError } from '../render-client.js';
import {
  storeScreenshot,
  screenshotResourceUri,
  screenshotResourceKey,
} from '../screenshot-cache.js';

export function registerRenderTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {
  server.tool(
    'request_screenshot',
    'Request a screenshot of an Elementeer page from the rendering bridge. ' +
    'The screenshot is stored as an MCP resource and returned as a resource URI. ' +
    'The URI includes the page content_hash — a screenshot without revision binding is decoration, not evidence. ' +
    'Requires ELEMENTEER_BRIDGE_URL to be set.',
    {
      site_id: z.string().optional().describe('Site ID from config'),
      page_id: z.number().int().describe('Page ID to screenshot'),
      container_id: z.string().optional().describe(
        'Optional container/element ID to screenshot only that portion of the page',
      ),
    },
    async ({ site_id, page_id, container_id }) => {
      const bridgeUrl = getBridgeUrl();
      if (!bridgeUrl) {
        return {
          content: [{
            type: 'text',
            text: 'Error: ELEMENTEER_BRIDGE_URL is not set. Screenshot tools are unavailable.\n\nSet this environment variable to the bridge base URL (e.g. http://localhost:3000).',
          }],
          isError: true,
        };
      }

      const client = getClient(site_id);

      let contentHash: string;
      let postTitle: string;

      try {
        const pageResult = await client.getPageData({ id: page_id });
        contentHash = (pageResult as Record<string, unknown>).content_hash as string ?? '';
        postTitle = (pageResult as Record<string, unknown>).post_title as string ?? `Page ${page_id}`;

        if (!contentHash) {
          return {
            content: [{
              type: 'text',
              text: `Error: Page ${page_id} has no content_hash. The plugin must be >= 2.3.0 to provide content hashes for revision binding.`,
            }],
            isError: true,
          };
        }
      } catch (err) {
        return {
          content: [{
            type: 'text',
            text: `Error: Failed to read page ${page_id}: ${err instanceof Error ? err.message : String(err)}`,
          }],
          isError: true,
        };
      }

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
        const result = await bridge.requestScreenshot({
          page_id,
          container_id,
        });

        if (result.content_hash && result.content_hash !== contentHash) {
          return {
            content: [{
              type: 'text',
              text: `Warning: Content hash mismatch.\n` +
                `  Page hash (plugin): ${contentHash}\n` +
                `  Screenshot hash (bridge): ${result.content_hash}\n` +
                `The page may have been modified between reading the hash and taking the screenshot.\n` +
                `The screenshot was still captured, but treat it as potentially stale.\n\n` +
                `Resource URI: ${screenshotResourceUri(page_id, contentHash)}`,
            }],
            isError: true,
          };
        }

        result.content_hash = contentHash;

        const resourceKey = screenshotResourceKey(page_id, contentHash);
        storeScreenshot(resourceKey, result);
        const uri = screenshotResourceUri(page_id, contentHash);

        const lines = [
          `Screenshot captured for page ${page_id} ("${postTitle}").`,
          `  Content hash: ${contentHash}`,
          `  Captured at: ${result.captured_at}`,
          container_id ? `  Container: ${container_id}` : '',
          '',
          `Resource URI: ${uri}`,
          '',
          'Use read_mcp_resource with this URI to fetch the screenshot. ' +
          'The URI includes the content_hash — the screenshot is bound to this exact page revision.',
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
