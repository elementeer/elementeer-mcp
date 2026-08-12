import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import { GOVERNANCE_LEVELS } from '../product-tiers.js';
import { projectElementorData, type ProjectionLevel } from '../projection.js';
import { resolvePayloadViaResource } from '../page-resource-cache.js';
import { describeWidgetType } from '../widget-schemas.js';

export function registerPageTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {

  // list_elementor_pages
  server.tool(
    'list_elementor_pages',
    'List all pages/posts built with Elementor (have _elementor_edit_mode = builder). Use this to find pages you want to extract sections or components from.',
    {
      site_id: z.string().optional().describe('Site ID from config'),
      note:   z.string().optional()
               .describe('Optional note for queued changes (auto-queued for L2 governance)'),
      consent: z.boolean().optional()
               .describe('Explicit consent required for L3 operations (not needed for L2 auto-queue)'),
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
    'Get the full Elementor JSON structure of any page/post. Returns all top-level containers/sections with their index. Use extract="all" to see a summary, or extract="section" with index=N to get a specific section ready to save as a template. Use projection to filter the payload: "structure" (IDs and hierarchy), "content" (editable text, links, media), "interaction" (buttons and forms), "style_tokens" (colors, typography, spacing), or "full" (complete JSON). Default projection is "content" for token efficiency.',
    {
      site_id: z.string().optional().describe('Site ID from config'),
      id:      z.number().int().describe('Page/post ID'),
      extract: z.enum(['all', 'section']).optional().describe('"all" = summary of all sections, "section" = one specific section'),
      index:   z.number().int().min(0).optional().describe('0-based index of the section to extract (use with extract="section")'),
      projection: z.enum(['structure', 'content', 'interaction', 'style_tokens', 'full']).optional().default('content')
        .describe('Content projection level. "content" (default) returns only editable text, links, and media with stable IDs. "structure" returns IDs, types, and hierarchy without settings. "full" returns the complete JSON.'),
    },
    async ({ site_id, id, extract, index, projection }) => {
      const client = getClient(site_id);

      if (extract === 'all') {
        const result = await client.getPageData({ id, extract, index });
        if (projection && projection !== 'full') {
          const projected = projectElementorData(
            result.elements.map((el: { data: Record<string, unknown> }) => el.data),
            projection,
            { pageId: result.post_id ?? id, post_title: result.post_title, revision: result.post_modified ?? '' },
          );
          const plaintext = JSON.stringify(projected, null, 2);
          const resource = resolvePayloadViaResource(projected, plaintext, projection, {
            pageId: result.post_id ?? id,
            post_title: result.post_title,
          });
          if (resource.asResource) {
            return {
              content: [{
                type: 'text',
                text: `Page "${result.post_title}" ${projection} projection stored as MCP resource: ${resource.uri}\nUse read_mcp_resource with server "elementeer-mcp" and this URI to fetch the full payload.`,
              }],
            };
          }
          return { content: [{ type: 'text', text: plaintext }] };
        }
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

      if (extract === 'section' && index !== undefined) {
        const result = await client.getPageData({ id, extract, index });
        if (projection && projection !== 'full' && result.element) {
          const projected = projectElementorData(
            [result.element],
            projection,
            { pageId: result.post_id ?? id, post_title: result.post_title, revision: result.post_modified ?? '' },
          );
          const plaintext = JSON.stringify(projected, null, 2);
          const resource = resolvePayloadViaResource(projected, plaintext, projection, {
            pageId: result.post_id ?? id,
            post_title: result.post_title,
          });
          if (resource.asResource) {
            return {
              content: [{
                type: 'text',
                text: `Section [${result.index}] from "${result.post_title}" ${projection} projection stored as MCP resource: ${resource.uri}\nUse read_mcp_resource with server "elementeer-mcp" and this URI to fetch the full payload.`,
              }],
            };
          }
          return { content: [{ type: 'text', text: plaintext }] };
        }
        return {
          content: [{
            type: 'text',
            text: `Section [${result.index}] from "${result.post_title}":\n\n${JSON.stringify(result.element, null, 2)}`,
          }],
        };
      }

      const result = await client.getPageData({ id });
      const rawData = result.elementor_data ?? [];

      if (projection && projection !== 'full') {
        const projected = projectElementorData(
          rawData,
          projection,
          { pageId: result.post_id ?? id, post_title: result.post_title, revision: result.post_modified ?? '' },
        );
        const plaintext = JSON.stringify(projected, null, 2);
        const resource = resolvePayloadViaResource(projected, plaintext, projection, {
          pageId: result.post_id ?? id,
          post_title: result.post_title,
        });
        if (resource.asResource) {
          return {
            content: [{
              type: 'text',
              text: `Page "${result.post_title}" ${projection} projection stored as MCP resource: ${resource.uri}\nUse read_mcp_resource with server "elementeer-mcp" and this URI to fetch the full payload.`,
            }],
          };
        }
        return {
          content: [{ type: 'text', text: plaintext }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Page: "${result.post_title}" (${result.element_count} top-level elements)\n\n${JSON.stringify(rawData, null, 2)}`,
        }],
      };
    },
  );

  // describe_widget_type
  server.tool(
    'describe_widget_type',
    'Get the editable field schema for a specific Elementor widget type. Returns text_fields, link_fields, media_fields, and control metadata. Covers core Elementor widgets plus Essential Addons and Ultimate Addons. Use this BEFORE reading full page JSON so you know which settings keys hold the actual content — no more guessing field names.',
    {
      widget_type: z.string().describe('Widget type name, e.g. "heading", "button", "text-editor", "icon-box", "eael-cta-box", "uael-faq". Use list_elementor_pages or get_page_data first to discover widget types on a page.'),
    },
    async ({ widget_type }) => {
      const result = describeWidgetType(widget_type);

      if (result.status === 'supported' && result.schema) {
        const s = result.schema;
        const lines = [
          `Widget: ${s.widget_type}`,
          `Source: ${s.source}`,
          '',
          '## Text Fields',
          s.text_fields.length > 0 ? s.text_fields.map(f => `  - ${f}: ${s.controls[f]?.label ?? ''} (${s.controls[f]?.type ?? 'unknown'})`).join('\n') : '  (none)',
          '',
          '## Link Fields',
          s.link_fields.length > 0 ? s.link_fields.map(f => `  - ${f}: ${s.controls[f]?.label ?? ''}`).join('\n') : '  (none)',
          '',
          '## Media Fields',
          s.media_fields.length > 0 ? s.media_fields.map(f => `  - ${f}: ${s.controls[f]?.label ?? ''}`).join('\n') : '  (none)',
          '',
          '## All Controls',
          ...Object.entries(s.controls).map(([key, ctrl]) =>
            `  - ${key}: ${ctrl.type}${ctrl.required ? ' (required)' : ''}${ctrl.enum ? ` [${ctrl.enum.join('|')}]` : ''}`
          ),
        ];
        if (s.notes) {
          lines.push('', `*Note: ${s.notes}*`);
        }
        lines.push('', `Tip: Use get_page_data(id, projection:"content") with this knowledge — you'll only get the ${s.text_fields.length} text field(s), ${s.link_fields.length} link field(s), and ${s.media_fields.length} media field(s) instead of ~20KB of styling boilerplate.`);
        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      const supported = result.supported_types ?? [];
      return {
        content: [{
          type: 'text',
          text: `Widget type "${widget_type}" is not yet instrumented.\n\n${supported.length} widget types are available: ${supported.join(', ')}\n\nThis is an expected response — use get_page_data(projection:"content") to discover the text fields on this widget type, then re-read with projection:"full" only if you need the complete JSON.`,
        }],
        isError: false,
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
      note:          z.string().optional()
                     .describe('Optional note for queued changes (auto-queued for L2 governance)'),
      consent:       z.boolean().optional()
                     .describe('Explicit consent required for L3 operations (not needed for L2 auto-queue)'),
    },
    async ({ site_id, page_id, section_index, template_title, template_type, status, note, consent }) => {
      const client = getClient(site_id);
      const toolName = 'save_page_section_as_template';
      const level = GOVERNANCE_LEVELS[toolName] || 'L0';
      
      // L3 requires explicit consent
      if (level === 'L3' && consent !== true) {
        return {
          content: [{
            type: 'text',
            text: `Operation "${toolName}" requires explicit consent (governance level L3). Please provide consent: true to proceed.`,
          }],
        };
      }
      
      // Step 1: extract the section
      const pageData = await client.getPageData({ id: page_id, extract: 'section', index: section_index });
      const element = pageData.element;
      if (!element) throw new Error(`No element at index ${section_index}`);

      // For L2/L3, queue the creation
      if (level === 'L2' || level === 'L3') {
        const change = await client.createChange({
          operation: toolName,
          params: { page_id, section_index, template_title, template_type, status },
          note: note || `Template "${template_title}" auto-queued by governance level ${level}`,
        });

        const lines = [
          `🟡 Template creation queued for review (governance level ${level})`,
          `   ID: ${change.id}`,
          `   Operation: ${toolName}`,
          `   Template title: ${template_title}`,
          `   Source: page ${page_id}, section ${section_index}`,
          note ? `   Note: ${note}` : '',
          '',
          'Next steps:',
          '  1. review_change(change_id, "approve") — approve it',
          '  2. apply_change(change_id)             — create the template',
          '  Or: review_change(change_id, "reject") to discard.',
        ].filter(Boolean);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }
      
      // L0/L1: Execute directly
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

  // update_page_data
  server.tool(
    'update_page_data',
    'Write Elementor JSON back to a live page or post, replacing its full layout. Use this to apply a composed or AI-built layout to a page. The elementor_data must be a valid Elementor JSON array (array of top-level containers/sections). Requires pages:write capability.',
    {
      site_id:        z.string().optional().describe('Site ID from config'),
      id:             z.number().int().describe('Page/post ID to update'),
      elementor_data: z.array(z.record(z.unknown())).describe('Full Elementor JSON — array of top-level containers/sections'),
      note:           z.string().optional()
                       .describe('Optional note for queued changes (auto-queued for L2 governance)'),
      consent:        z.boolean().optional()
                       .describe('Explicit consent required for L3 operations (not needed for L2 auto-queue)'),
    },
    async ({ site_id, id, elementor_data, note, consent }) => {
      const client = getClient(site_id);
      const toolName = 'update_page_data';
      const level = GOVERNANCE_LEVELS[toolName] || 'L0';
      
      // L3 requires explicit consent
      if (level === 'L3' && consent !== true) {
        return {
          content: [{
            type: 'text',
            text: `Operation "${toolName}" requires explicit consent (governance level L3). Please provide consent: true to proceed.`,
          }],
        };
      }
      
      // L2 always queues regardless of write_mode
      if (level === 'L2' || level === 'L3') {
        const change = await client.createChange({
          operation: toolName,
          params: { id, elementor_data },
          note: note || `Auto-queued by governance level ${level}`,
        });

        const lines = [
          `🟡 Change queued for review (governance level ${level})`,
          `   ID: ${change.id}`,
          `   Operation: ${toolName}`,
          note ? `   Note: ${note}` : '',
          '',
          'Next steps:',
          '  1. review_change(change_id, "approve") — approve it',
          '  2. apply_change(change_id)             — execute it on the site',
          '  Or: review_change(change_id, "reject") to discard.',
          '',
          'Use list_change_queue to see all pending changes.',
        ].filter(Boolean);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }
      
      // L0/L1: Execute directly
      await client.updatePageData(id, elementor_data);
      return {
        content: [{ type: 'text', text: `✅ Page ${id} updated. Elementor cache cleared.` }],
      };
    },
  );

  // compose_page_from_templates
  server.tool(
    'compose_page_from_templates',
    'Compose a new Elementor layout by merging sections from multiple templates — in order. For each source template you can optionally pick specific section indices; omitting sections takes all top-level elements. The composed layout can be saved as a new template, written directly to a page, or both.',
    {
      site_id: z.string().optional().describe('Site ID from config'),
      sources: z
        .array(
          z.object({
            template_id: z.number().int().describe('Source template ID'),
            sections:    z.array(z.number().int().min(0)).optional().describe('0-based indices of sections to include (omit = take all)'),
          }),
        )
        .min(1)
        .describe('Ordered list of templates to merge'),
      save_as_template: z
        .object({
          title:         z.string().describe('New template title'),
          template_type: z.enum(['section', 'container', 'page', 'widget']).optional().default('page'),
          status:        z.enum(['publish', 'draft']).optional().default('publish'),
        })
        .optional()
        .describe('If provided, save the composed layout as a new library template'),
      write_to_page: z
        .object({
          page_id: z.number().int().describe('Target page/post ID (must be an Elementor page, requires pages:write)'),
        })
        .optional()
        .describe('If provided, write the composed layout directly to this page'),
    },
    // @ts-expect-error - note and consent are added to schema via edit
    async ({ site_id, sources, save_as_template, write_to_page, note, consent }) => {
      if (!save_as_template && !write_to_page) {
        return {
          content: [{ type: 'text', text: 'Error: specify at least one of save_as_template or write_to_page.' }],
          isError: true,
        };
      }

      const client = getClient(site_id);
      const toolName = 'compose_page_from_templates';
      const level = GOVERNANCE_LEVELS[toolName] || 'L0';
      
      // L3 requires explicit consent
      if (level === 'L3' && consent !== true) {
        return {
          content: [{
            type: 'text',
            text: `Operation "${toolName}" requires explicit consent (governance level L3). Please provide consent: true to proceed.`,
          }],
        };
      }
      
      // For L2/L3, queue the operation
      if (level === 'L2' || level === 'L3') {
        const change = await client.createChange({
          operation: toolName,
          params: { sources, save_as_template, write_to_page },
          note: note || `Page composition auto-queued by governance level ${level}`,
        });

        const lines = [
          `🟡 Page composition queued for review (governance level ${level})`,
          `   ID: ${change.id}`,
          `   Operation: ${toolName}`,
          `   Sources: ${sources.length} template(s)`,
          save_as_template ? `   Save as template: "${save_as_template.title}"` : '',
          write_to_page ? `   Write to page: ${write_to_page.page_id}` : '',
          note ? `   Note: ${note}` : '',
          '',
          'Next steps:',
          '  1. review_change(change_id, "approve") — approve it',
          '  2. apply_change(change_id)             — execute the composition',
          '  Or: review_change(change_id, "reject") to discard.',
        ].filter(Boolean);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }

      // Step 1: collect sections from all source templates
      const composed: unknown[] = [];
      const sourceLog: string[] = [];

      for (const src of sources) {
        const tplData = await client.getTemplateData(src.template_id);
        const elements = tplData.elementor_data as unknown[];

        if (!Array.isArray(elements) || elements.length === 0) {
          sourceLog.push(`  Template ${src.template_id}: no Elementor data — skipped`);
          continue;
        }

        if (src.sections && src.sections.length > 0) {
          const picked = src.sections.map((i) => elements[i]).filter(Boolean);
          composed.push(...picked);
          sourceLog.push(`  Template ${src.template_id}: sections [${src.sections.join(', ')}] — ${picked.length} element(s)`);
        } else {
          composed.push(...elements);
          sourceLog.push(`  Template ${src.template_id}: all ${elements.length} element(s)`);
        }
      }

      if (composed.length === 0) {
        return {
          content: [{ type: 'text', text: 'Nothing to compose — all sources were empty or all indices were out of range.' }],
          isError: true,
        };
      }

      const results: string[] = [
        `Composed ${composed.length} top-level element(s) from ${sources.length} template(s):`,
        ...sourceLog,
        '',
      ];

      // Step 2: save as template
      if (save_as_template) {
        const created = await client.createTemplate({
          title:  save_as_template.title,
          type:   save_as_template.template_type ?? 'page',
          status: save_as_template.status ?? 'publish',
        });
        await client.updateTemplateData(created.id, composed);
        results.push(`✅ Saved as template: "${save_as_template.title}" (ID: ${created.id})`);
        results.push(`   Shortcode: [elementor-template id="${created.id}"]`);
      }

      // Step 3: write to page
      if (write_to_page) {
        await client.updatePageData(write_to_page.page_id, composed);
        results.push(`✅ Written to page ${write_to_page.page_id}. Elementor cache cleared.`);
      }

      return {
        content: [{ type: 'text', text: results.join('\n') }],
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
      note:           z.string().optional()
                     .describe('Optional note for queued changes (auto-queued for L2 governance)'),
      consent:        z.boolean().optional()
                     .describe('Explicit consent required for L3 operations (not needed for L2 auto-queue)'),
    },
    async ({ site_id, page_id, template_title, status, note, consent }) => {
      const client = getClient(site_id);
      const toolName = 'save_full_page_as_template';
      const level = GOVERNANCE_LEVELS[toolName] || 'L0';
      
      // L3 requires explicit consent
      if (level === 'L3' && consent !== true) {
        return {
          content: [{
            type: 'text',
            text: `Operation "${toolName}" requires explicit consent (governance level L3). Please provide consent: true to proceed.`,
          }],
        };
      }
      
      // For L2/L3, queue the creation
      if (level === 'L2' || level === 'L3') {
        const change = await client.createChange({
          operation: toolName,
          params: { page_id, template_title, status },
          note: note || `Page template "${template_title}" auto-queued by governance level ${level}`,
        });

        const lines = [
          `🟡 Page template creation queued for review (governance level ${level})`,
          `   ID: ${change.id}`,
          `   Operation: ${toolName}`,
          `   Template title: ${template_title}`,
          `   Source page: ${page_id}`,
          note ? `   Note: ${note}` : '',
          '',
          'Next steps:',
          '  1. review_change(change_id, "approve") — approve it',
          '  2. apply_change(change_id)             — create the template',
          '  Or: review_change(change_id, "reject") to discard.',
        ].filter(Boolean);

        return { content: [{ type: 'text', text: lines.join('\n') }] };
      }
      
      // L0/L1: Execute directly
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
