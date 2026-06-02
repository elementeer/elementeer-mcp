import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import { GOVERNANCE_LEVELS } from '../product-tiers.js';

export function registerCreatePopupTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {

  server.tool(
    'create_popup',
    'Create a new Elementor popup template with display conditions. Sets the popup as a draft template and configures where it should appear (entire site, specific pages, or on exit intent).',
    {
      site_id: z.string().optional(),
      title: z.string().min(1).describe('Popup title (e.g. "Exit Intent Offer", "Newsletter Signup Popup")'),
      conditions: z.enum(['entire_site', 'specific_pages', 'exit_intent'])
        .describe('Where the popup should appear: entire_site, specific_pages, or exit_intent'),
      page_ids: z.array(z.number().int().positive()).optional()
        .describe('Page IDs for specific_pages condition (required if conditions is "specific_pages")'),
    },
    async ({ site_id, title, conditions, page_ids }) => {
      const client = getClient(site_id);
      const toolName = 'create_popup';
      const level = GOVERNANCE_LEVELS[toolName] || 'L0';

      if (conditions === 'specific_pages' && (!page_ids || page_ids.length === 0)) {
        return {
          content: [{
            type: 'text',
            text: 'Error: page_ids is required when conditions is "specific_pages".',
          }],
          isError: true,
        };
      }

      const popup = await client.createTemplate({
        title,
        type: 'popup',
        status: 'draft',
        elementor_data: '[]',
      });

      const lines = [
        `Popup template created`,
        `   ID: ${popup.id}`,
        `   Title: ${title}`,
        `   Status: draft`,
        `   Display conditions: ${conditions}`,
        conditions === 'specific_pages' ? `   Page IDs: ${(page_ids ?? []).join(', ')}` : '',
        '',
        'Next steps:',
        '  1. Open the Elementor editor to design the popup content',
        '  2. Publish when ready — the conditions are already configured',
      ].filter(Boolean);

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
