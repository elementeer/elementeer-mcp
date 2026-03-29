import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementifyClient } from '../client.js';

export function registerPageTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementifyClient,
): void {

  // list_elementor_pages
  server.tool(
    'list_elementor_pages',
    'List all pages/posts built with Elementor (have _elementor_edit_mode = builder). Use this to find pages you want to extract sections or components from.',
    {
      site_id:   z.string().optional().describe('Site ID from config'),
      post_type: z.enum(['page', 'post']).optional().default('page').describe('Post type to list'),
      per_page:  z.number().int().min(1).max(100).optional().default(50),
      page:      z.number().int().min(1).optional().default(1),
    },
    async ({ site_id, post_type, per_page, page }) => {
      const client = getClient(site_id);
      const result = await client.listElementorPages({ post_type, per_page, page });
      const rows = result.posts.map(p =>
        `  [${p.id}] ${p.title} — ${p.url}`
      );
      return {
        content: [{ type: 'text', text: `Elementor Pages (${result.total} total):\n${rows.join('\n')}` }],
      };
    },
  );

  // get_page_data
  server.tool(
    'get_page_data',
    'Get the full Elementor JSON structure of any page/post. Returns all top-level containers/sections with their index. Use extract="all" to see a summary, or extract="section" with index=N to get a specific section ready to save as a template.',
    {
      site_id: z.string().optional().describe('Site ID from config'),
      id:      z.number().int().describe('Page/post ID'),
      extract: z.enum(['all', 'section']).optional().describe('"all" = summary of all sections, "section" = one specific section'),
      index:   z.number().int().min(0).optional().describe('0-based index of the section to extract (use with extract="section")'),
    },
    async ({ site_id, id, extract, index }) => {
      const client = getClient(site_id);
      const result = await client.getPageData({ id, extract, index });

      if (extract === 'all' && result.elements) {
        const rows = result.elements.map((el: { index: number; elType: string; children: number; id: string }) =>
          `  [${el.index}] ${el.elType} (id: ${el.id}) — ${el.children} children`
        );
        return {
          content: [{
            type: 'text',
            text: `Page: "${result.post_title}" (${result.element_count} top-level elements)\n\n${rows.join('\n')}\n\nUse extract="section" with index=N to get a specific section.`,
          }],
        };
      }

      if (extract === 'section' && result.element) {
        return {
          content: [{
            type: 'text',
            text: `Section [${result.index}] from "${result.post_title}":\n\n${JSON.stringify(result.element, null, 2)}`,
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Page: "${result.post_title}" (${result.element_count} top-level elements)\n\n${JSON.stringify(result.elementor_data, null, 2)}`,
        }],
      };
    },
  );

  // save_page_section_as_template
  server.tool(
    'save_page_section_as_template',
    'Extract a section/container from a page and save it as a reusable Elementor library template. This is the core tool for building the component library from existing pages.',
    {
      site_id:       z.string().optional().describe('Site ID from config'),
      page_id:       z.number().int().describe('Source page ID to extract from'),
      section_index: z.number().int().min(0).describe('0-based index of the section to extract'),
      template_title: z.string().describe('Title for the new template (e.g. "SECTION_Hero", "COMP_Card_ValueProp")'),
      template_type: z.enum(['section', 'container', 'page', 'widget']).optional().default('container').describe('Elementor template type'),
      status:        z.enum(['publish', 'draft']).optional().default('publish'),
    },
    async ({ site_id, page_id, section_index, template_title, template_type, status }) => {
      const client = getClient(site_id);

      // Step 1: extract the section
      const pageData = await client.getPageData({ id: page_id, extract: 'section', index: section_index });
      const element = pageData.element;
      if (!element) throw new Error(`No element at index ${section_index}`);

      // Step 2: create new template
      const created = await client.createTemplate({
        title: template_title,
        type: template_type ?? 'container',
        status: status ?? 'publish',
      });

      // Step 3: write the extracted element as the template data
      await client.updateTemplateData(created.id, [element]);

      return {
        content: [{
          type: 'text',
          text: `✅ Template created!\n\nTitle: ${template_title}\nID: ${created.id}\nType: ${template_type}\nSource: page ${page_id}, section ${section_index}\nShortcode: [elementor-template id="${created.id}"]`,
        }],
      };
    },
  );

  // save_full_page_as_template
  server.tool(
    'save_full_page_as_template',
    'Save an entire page as a reusable Elementor page template.',
    {
      site_id:        z.string().optional().describe('Site ID from config'),
      page_id:        z.number().int().describe('Source page ID'),
      template_title: z.string().describe('Title for the new page template'),
      status:         z.enum(['publish', 'draft']).optional().default('publish'),
    },
    async ({ site_id, page_id, template_title, status }) => {
      const client = getClient(site_id);

      const pageData = await client.getPageData({ id: page_id });
      const created = await client.createTemplate({
        title: template_title,
        type: 'page',
        status: status ?? 'publish',
      });
      await client.updateTemplateData(created.id, pageData.elementor_data);

      return {
        content: [{
          type: 'text',
          text: `✅ Page template created!\n\nTitle: ${template_title}\nID: ${created.id}\nSource: page ${page_id} ("${pageData.post_title}")\nShortcode: [elementor-template id="${created.id}"]`,
        }],
      };
    },
  );
}
