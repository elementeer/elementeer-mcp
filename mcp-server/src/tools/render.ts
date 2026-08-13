import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import {
  getBridgeClient,
  getBridgeUrl,
  BridgeError,
  type ElementorElement,
  type ElementorTemplate,
} from '../render-client.js';
import {
  storeScreenshot,
  screenshotResourceUri,
  screenshotResourceKey,
} from '../screenshot-cache.js';

const VALID_TEMPLATES = ['full_page', 'viewpoint'] as const;

// --- ELM-RENDER-002: elementor_data → ElementorTemplate ---------------------
//
// The plugin's GET /pages/{id}/data returns raw elementor_data as a generic
// array plus metadata (post_id, post_title, post_type, element_count). It has
// NO content_hash today — that must be created on the bridge side from the
// template.
//
// The bridge POST /api/pages/{pageId}/screenshots expects a full
// ElementorTemplate object { title, type, version:"0.4", page_settings, content },
// NOT a template-name string. This was breach 1 (Expected object, received
// string → 400). The MCP owns the conversion here.

function normalizeElement(raw: unknown, isInner: boolean): ElementorElement {
  const el = (raw ?? {}) as Record<string, unknown>;
  const children = Array.isArray(el.elements)
    ? el.elements.map((c) => normalizeElement(c, true))
    : [];

  return {
    id: typeof el.id === 'string' ? el.id : String(el.id ?? ''),
    elType: (el.elType as ElementorElement['elType']) ?? 'widget',
    isInner,
    settings: (el.settings as Record<string, unknown>) ?? {},
    elements: children,
    // widgetType only present on widget elements; omit for containers/sections/columns
    ...(el.elType === 'widget' && typeof el.widgetType === 'string'
      ? { widgetType: el.widgetType }
      : {}),
  };
}

export function buildTemplateFromPageData(
  data: unknown,
  meta?: { post_id?: number; post_title?: string },
): ElementorTemplate {
  const d = (data ?? {}) as Record<string, unknown>;
  const rawContent = d.elementor_data as unknown[] | undefined;

  const content: ElementorElement[] = Array.isArray(rawContent)
    ? rawContent.map((el) => normalizeElement(el, false))
    : [];

  return {
    title: (typeof d.post_title === 'string' && d.post_title)
      ? d.post_title
      : (meta?.post_title ?? `Page ${meta?.post_id ?? ''}`),
    type: 'page',
    version: '0.4',
    page_settings: {},
    content,
  };
}

export function registerRenderTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {
  server.tool(
    'request_screenshot',
    'Request a screenshot of an Elementeer page from the rendering bridge. ' +
    'Loads the page\'s elementor_data from the plugin, wraps it into an ' +
    'ElementorTemplate, and sends it to POST /api/pages/:pageId/screenshots. ' +
    'The template arg selects scope: full_page renders the whole page, viewpoint ' +
    'renders only the containers named in `containers`. ' +
    'The bridge returns { pageId, renderHash, screenshots: { desktop, tablet, mobile }, capturedAt }. ' +
    'Screenshots are stored under /static/page-screenshots/:pageId/:renderHash/. ' +
    'The result is cached as an MCP resource (elementeer://pages/:pageId/screenshot/:renderHash).\n\n' +
    'Requires ELEMENTEER_BRIDGE_URL and ELEMENTEER_BRIDGE_API_KEY.',
    {
      site_id: z.string().optional().describe('Site ID from config (defaults to active site)'),
      page_id: z.number().int().describe('Page ID to screenshot'),
      template: z.enum(VALID_TEMPLATES).default('full_page')
        .describe('Screenshot scope — full_page (entire page) or viewpoint (only `containers`)'),
      containers: z.array(z.string()).max(20).optional()
        .describe('Container _title or id values to render (with template=viewpoint)'),
      render_hash: z.string().optional()
        .describe('Known render_hash for revision binding (optional; pass to verify the screenshot matches)'),
    },
    async ({ site_id, page_id, template, containers, render_hash: knownRenderHash }) => {
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
      let templateObject: ElementorTemplate;

      try {
        const r = await client.getPageData({ id: page_id });
        const record = r as Record<string, unknown>;
        postTitle = (record.post_title as string) ?? postTitle;
        templateObject = buildTemplateFromPageData(r, {
          post_id: record.post_id as number | undefined,
          post_title: postTitle,
        });
      } catch (err) {
        return {
          content: [{
            type: 'text',
            text:
              `Error: could not load page data for page ${page_id} from the plugin. ` +
              `Screenshots require the page's elementor_data — there is no template-string fallback.\n` +
              `Plugin error: ${err instanceof Error ? err.message : String(err)}`,
          }],
          isError: true,
        };
      }

      if (template === 'viewpoint' && (!containers || containers.length === 0)) {
        return {
          content: [{
            type: 'text',
            text: 'Error: template=viewpoint requires a non-empty `containers` list (container _title or id).',
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
          pageId: page_id,
          template: templateObject,
          renderHash: knownRenderHash,
          containers: template === 'viewpoint' ? containers : undefined,
        });

        if (knownRenderHash && knownRenderHash !== result.renderHash) {
          return {
            content: [{
              type: 'text',
              text:
                `Render hash mismatch between the caller's expectation and the bridge.\n` +
                `  Given render_hash: ${knownRenderHash}\n` +
                `  Bridge render_hash: ${result.renderHash}\n\n` +
                `The rendered output differs from the expected revision.\n` +
                `Capture a fresh screenshot for the current page revision.`,
            }],
            isError: true,
          };
        }

        const resourceKey = screenshotResourceKey(page_id, result.renderHash);
        storeScreenshot(resourceKey, result);
        const uri = screenshotResourceUri(page_id, result.renderHash);

        const lines = [
          `Screenshot captured for page ${page_id} ("${postTitle}").`,
          `  Scope: ${template}`,
          `  Render hash: ${result.renderHash}`,
          `  Captured at: ${result.capturedAt}`,
          `  Viewports: desktop, tablet, mobile`,
          '',
          `Resource URI: ${uri}`,
          '',
          'Use read_mcp_resource with this URI to fetch the screenshot (desktop viewport). ' +
          'The URI includes the render_hash — the screenshot is bound to this exact render. ' +
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
