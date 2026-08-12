import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import { getBridgeClient, getBridgeUrl, BridgeError } from '../render-client.js';
import {
  storeScreenshot,
  screenshotResourceUri,
  screenshotResourceKey,
} from '../screenshot-cache.js';

const VALID_TEMPLATES = ['full_page', 'viewpoint'] as const;

export function registerRenderTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {
  server.tool(
    'request_screenshot',
    'Request a screenshot of an Elementeer page from the rendering bridge. ' +
    'Sends a request to POST /api/pages/:pageId/screenshots with a template name (full_page or viewpoint). ' +
    'Optionally passes the known content_hash from the plugin for revision binding. ' +
    'The bridge returns { pageId, contentHash, screenshots: { desktop, tablet, mobile }, capturedAt }. ' +
    'Screenshots are stored under /static/page-screenshots/:pageId/:contentHash/. ' +
    'The result is cached as an MCP resource (elementeer://pages/:pageId/screenshot/:contentHash).\n\n' +
    'Requires ELEMENTEER_BRIDGE_URL and ELEMENTEER_BRIDGE_API_KEY.',
    {
      site_id: z.string().optional().describe('Site ID from config (defaults to active site)'),
      page_id: z.number().int().describe('Page ID to screenshot'),
      template: z.enum(VALID_TEMPLATES).default('full_page')
        .describe('Screenshot template — full_page or viewpoint'),
      content_hash: z.string().optional()
        .describe('Known content_hash from the plugin (get_page_data). Pass to verify the screenshot matches'),
    },
    async ({ site_id, page_id, template, content_hash: knownHash }) => {
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

      let postTitle = `Page ${page_id}`;

      try {
        const r = await client.getPageData({ id: page_id });
        postTitle = (r as Record<string, unknown>).post_title as string ?? postTitle;
      } catch {
        // page metadata is non-fatal — we still attempt the screenshot
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
          pageId: page_id,
          template,
          contentHash: knownHash,
        });

        if (knownHash && knownHash !== result.contentHash) {
          return {
            content: [{
              type: 'text',
              text:
                `Content hash mismatch between plugin and bridge.\n` +
                `  Plugin hash: ${knownHash}\n` +
                `  Bridge hash: ${result.contentHash}\n\n` +
                `The page was modified between reading the hash and taking the screenshot.\n` +
                `Capture a new screenshot for the current page revision.`,
            }],
            isError: true,
          };
        }

        const resourceKey = screenshotResourceKey(page_id, result.contentHash);
        storeScreenshot(resourceKey, result);
        const uri = screenshotResourceUri(page_id, result.contentHash);

        const lines = [
          `Screenshot captured for page ${page_id} ("${postTitle}").`,
          `  Template: ${template}`,
          `  Content hash: ${result.contentHash}`,
          `  Captured at: ${result.capturedAt}`,
          `  Viewports: desktop, tablet, mobile`,
          '',
          `Resource URI: ${uri}`,
          '',
          'Use read_mcp_resource with this URI to fetch the screenshot (desktop viewport). ' +
          'The URI includes the content_hash — the screenshot is bound to this exact page revision. ' +
          'If the page is edited between capture and read, the hash will differ and the resource will not resolve.',
        ];

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
