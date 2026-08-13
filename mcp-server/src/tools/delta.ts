import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';

// ---------------------------------------------------------------------------
// DELTA-001  patch_widget
// ---------------------------------------------------------------------------
//
// Thin tool over PATCH /pages/{id}/widgets/{widget_id}.
//
// Key rules:
//   - content_hash is REQUIRED and must come from a recent read (get_page_data
//     or get_template_data) — the agent MUST NOT invent this value.
//   - settings is a partial merge (RFC 7396 style).
//   - dry_run passthrough: the plugin returns what WOULD change without writing.
//
// Response shape (live):
//  { post_id, widget_id, path, updated, new_hash }
// Response shape (dry_run):
//  { post_id, widget_id, path, dry_run: true, diff: {old, new} }
// ---------------------------------------------------------------------------

export function registerDeltaTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {

  // -----------------------------------------------------------------------
  // patch_widget
  // -----------------------------------------------------------------------
  server.tool(
    'patch_widget',
    'Partially update a single Elementor widget inside a page or template. Requires the content_hash from a recent get_page_data / get_template_data call — you must READ before you PATCH to get the correct hash. Pass dry_run=true to preview the change without writing.',
    {
      site_id:      z.string().optional().describe('Site ID from config'),
      post_id:      z.number().int().describe('Page or template ID to patch'),
      widget_id:    z.string().describe('Element ID of the widget (e.g. "a85a3a7"). Use find_element or get_page_data to discover widget IDs.'),
      settings:     z.record(z.unknown()).describe('Key-value settings to merge into the widget. Only the fields you want to change.'),
      content_hash: z.string().describe('Content hash from a recent get_page_data / get_template_data call. REQUIRED — do not invent this value. Mismatched hash = 409.'),
      dry_run:      z.boolean().optional().default(false).describe('If true, preview the change without writing.'),
      is_template:  z.boolean().optional().default(false).describe('Set true if post_id refers to a template (elementor_library post type). Default false (page/post).'),
    },
    async ({ site_id, post_id, widget_id, settings, content_hash, dry_run, is_template }) => {
      const client = getClient(site_id);

      if (!content_hash || content_hash.length < 10) {
        return {
          content: [{ type: 'text', text: 'Error: content_hash is required. Call get_page_data first to obtain the current hash.' }],
          isError: true,
        };
      }

      const result = await client.patchWidget(post_id, widget_id, {
        settings,
        content_hash,
        dry_run,
      });

      if (dry_run) {
        return {
          content: [{
            type: 'text',
            text: `Dry-run of patch_widget on ${is_template ? 'template' : 'page'} ${post_id}, widget "${widget_id}":\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Widget "${widget_id}" patched on ${is_template ? 'template' : 'page'} ${post_id}.\nPath: ${(result as any).path}\nNew hash: ${(result as any).new_hash}\n\nNext read will return this new hash — save it if you need another patch.`,
        }],
      };
    },
  );

  // -----------------------------------------------------------------------
  // apply_content_map  (DELTA-002)
  // -----------------------------------------------------------------------
  server.tool(
    'apply_content_map',
    'Apply multiple widget content edits to a single page in one atomic batch. Each operation specifies a widget_id and the settings to merge. The entire batch shares one content_hash. Missing widget_ids are reported in not_found without aborting the rest of the batch (partial mode). Use this instead of making N separate patch_widget calls.',
    {
      site_id:      z.string().optional().describe('Site ID from config'),
      post_id:      z.number().int().describe('Page or template ID'),
      operations:   z.array(
        z.object({
          widget_id: z.string().describe('Element ID of the widget to patch'),
          settings:  z.record(z.unknown()).describe('Settings to merge into this widget'),
        }),
      ).min(1).max(100).describe('Array of widget operations to apply atomically'),
      content_hash: z.string().describe('Content hash from a recent get_page_data. REQUIRED.'),
      dry_run:      z.boolean().optional().default(false).describe('If true, preview ALL changes without writing.'),
      is_template:  z.boolean().optional().default(false).describe('Set true if post_id refers to a template.'),
    },
    async ({ site_id, post_id, operations, content_hash, dry_run, is_template }) => {
      const client = getClient(site_id);

      if (!content_hash || content_hash.length < 10) {
        return {
          content: [{ type: 'text', text: 'Error: content_hash is required. Call get_page_data first to obtain the current hash.' }],
          isError: true,
        };
      }

      const result = await client.patchWidgetsBatch(post_id, {
        operations,
        content_hash,
        dry_run,
        partial: true,
      });

      const summaryLines = [
        `Batch widget patch on ${is_template ? 'template' : 'page'} ${post_id}:`,
        `  Total operations: ${operations.length}`,
        `  Updated: ${result.updated}`,
        `  Not found: ${result.not_found.length}`,
        `  Mode: ${dry_run ? 'dry-run' : 'live'}`,
      ];

      if (result.partial) {
        summaryLines.push(`  ⚠️ partial=true — some widgets not found, see not_found list.`);
      }

      summaryLines.push('', `New hash: ${result.new_hash}`, '');

      if (result.not_found.length > 0) {
        for (const w of result.not_found) {
          summaryLines.push(`  ❌ ${w} — not found`);
        }
      } else {
        summaryLines.push(`  ✅ All ${result.updated} widget(s) updated.`);
      }

      if (dry_run) {
        summaryLines.push('', 'This was a dry-run. No changes were written.');
      }

      return {
        content: [{ type: 'text', text: summaryLines.join('\n') }],
        isError: result.partial || false,
      };
    },
  );

  // -----------------------------------------------------------------------
  // session_begin  (DELTA-004)
  // -----------------------------------------------------------------------
  server.tool(
    'session_begin',
    'Begin a new change session. All writes made while this session is active are grouped together so they can be rolled back as a unit with session_restore. Use session_end to close the session normally. Sessions are stored server-side and capped at a bounded count (oldest ended/rolled-back sessions are evicted first).',
    {
      site_id: z.string().optional().describe('Site ID from config'),
    },
    async ({ site_id }) => {
      const client = getClient(site_id);
      const result = await client.beginChangeSession();
      client.setSession(result.session_id);
      return {
        content: [{
          type: 'text',
          text: `Session "${result.session_id}" started.\n\nAll subsequent writes in this connection are grouped under this session.\nCall session_end to close normally, or session_restore to roll back.\n\nSession ID: ${result.session_id}`,
        }],
      };
    },
  );

  // -----------------------------------------------------------------------
  // session_end  (DELTA-004)
  // -----------------------------------------------------------------------
  server.tool(
    'session_end',
    'End a change session normally. The session stays recorded but is no longer active — new writes after this go into the next auto-group (unless you begin another session). Use session_restore to rollback instead of end.',
    {
      site_id:    z.string().optional().describe('Site ID from config'),
      session_id: z.string().describe('Session ID from session_begin'),
    },
    async ({ site_id, session_id }) => {
      const client = getClient(site_id);
      const result = await client.endChangeSession(session_id);
      client.setSession(null);
      return {
        content: [{
          type: 'text',
          text: `Session "${session_id}" ended.\nWrites made during this session are preserved.\nTo undo them, use session_restore with the same session_id.`,
        }],
      };
    },
  );

  // -----------------------------------------------------------------------
  // session_restore  (DELTA-004)
  // -----------------------------------------------------------------------
  server.tool(
    'session_restore',
    'Cascade-rollback an entire change session. Restores every page, template, option, and structural object touched during the session back to its pre-session state. This is the nuclear option for undoing a multi-step edit that went wrong. Requires an active (not yet ended) session.',
    {
      site_id:    z.string().optional().describe('Site ID from config'),
      session_id: z.string().describe('Session ID from session_begin'),
    },
    async ({ site_id, session_id }) => {
      const client = getClient(site_id);
      const result = await client.restoreChangeSession(session_id);
      client.setSession(null);
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Session "${session_id}" restore failed.\n${JSON.stringify(result)}` }],
          isError: true,
        };
      }
      const lines = [
        `Session "${session_id}" rolled back.`,
        `Restored ${result.restored} of ${result.total} object(s) to pre-session state.`,
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // -----------------------------------------------------------------------
  // site_protect  (DELTA-005)
  // -----------------------------------------------------------------------
  server.tool(
    'site_protect',
    'Protect specific pages or templates from being modified by any agent tool. Sets an enforced rule in site memory — the plugin will refuse writes (HTTP 423) to protected content. The protection is NOT a warning; it is an actual refusal. Use site_unprotect to remove protection, or site_protected to list current rules.',
    {
      site_id:   z.string().optional().describe('Site ID from config'),
      rule_key:  z.string().describe('Unique key for this rule (e.g. "checkout", "pricing-data"). Lowercase letters/digits/hyphens.'),
      rule_note: z.string().describe('Human-readable note explaining why these pages are protected.'),
      post_ids:  z.array(z.number().int()).optional().describe('Page/template IDs to protect from writes.'),
      slugs:     z.array(z.string()).optional().describe('Page slugs to protect from writes.'),
      owner:     z.enum(['agent', 'user']).optional().default('agent').describe('Who set this rule. Default "agent".'),
      expires_at: z.string().optional().describe('Optional ISO-8601 timestamp after which this rule stops blocking writes. Omit for no expiry.'),
    },
    async ({ site_id, rule_key, rule_note, post_ids, slugs, owner, expires_at }) => {
      const client = getClient(site_id);
      const result = await client.setSiteMemoryEntry(rule_key, {
        type: 'rule',
        content: rule_note,
        owner,
        expires_at: expires_at ?? null,
        rule: { protect: { post_ids, slugs } },
      });

      const lines = [
        `Protection rule "${rule_key}" set.`,
        `  Content: ${rule_note}`,
      ];
      if (post_ids?.length) lines.push(`  Protected post IDs: ${post_ids.join(', ')}`);
      if (slugs?.length) lines.push(`  Protected slugs: ${slugs.join(', ')}`);
      lines.push(`  Owner: ${result.owner}`);
      if (result.expires_at) lines.push(`  Expires: ${result.expires_at}`);
      lines.push('', 'The plugin will now refuse writes (423 Locked) to these pages. Use site_unprotect to remove this rule.');

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // -----------------------------------------------------------------------
  // site_unprotect  (DELTA-005)
  // -----------------------------------------------------------------------
  server.tool(
    'site_unprotect',
    'Remove a protection rule set by site_protect. The specified pages/templates become editable again. Use site_protected to see which keys are currently active.',
    {
      site_id:  z.string().optional().describe('Site ID from config'),
      rule_key: z.string().describe('The key of the rule to remove (from site_protect or site_protected).'),
    },
    async ({ site_id, rule_key }) => {
      const client = getClient(site_id);
      const result = await client.deleteSiteMemoryEntry(rule_key);
      return {
        content: [{
          type: 'text',
          text: `Protection rule "${result.key}" removed.\nThe previously protected content is now editable again.`,
        }],
      };
    },
  );

  // -----------------------------------------------------------------------
  // site_protected  (DELTA-005)
  // -----------------------------------------------------------------------
  server.tool(
    'site_protected',
    'List all protection rules currently set via site_protect. Shows which pages/templates are locked and why. Also includes any site memory entries of type "rule" (they have the same enforcement behaviour).',
    {
      site_id: z.string().optional().describe('Site ID from config'),
    },
    async ({ site_id }) => {
      const client = getClient(site_id);
      const entries = await client.listSiteMemory();
      const rules = entries.filter(e => e.type === 'rule');

      if (rules.length === 0) {
        return { content: [{ type: 'text', text: 'No protection rules set. All pages are editable.' }] };
      }

      const lines = [`${rules.length} protection rule(s) active:`, ''];
      for (const r of rules) {
        lines.push(`  🔒 ${r.key}`);
        lines.push(`     "${r.content}"`);
        if (r.rule?.protect) {
          const p = r.rule.protect as any;
          if (p.post_ids?.length) lines.push(`     Protected IDs: ${p.post_ids.join(', ')}`);
          if (p.slugs?.length) lines.push(`     Protected slugs: ${p.slugs.join(', ')}`);
        }
        lines.push(`     Owner: ${r.owner}`);
        if (r.expires_at) lines.push(`     Expires: ${r.expires_at}`);
        lines.push(`     Set: ${r.set_at}`);
        lines.push('');
      }
      lines.push('Use site_unprotect <key> to remove a rule.');

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // -----------------------------------------------------------------------
  // insert_widget  (DELTA-003)
  // -----------------------------------------------------------------------
  server.tool(
    'insert_widget',
    'Insert a new Elementor widget into a container at a specific position on a page. Requires the page content_hash from a recent get_page_data. The widget must be a complete Elementor widget object with id, elType, widgetType, and settings. Use dry_run=true to preview before writing. NOTE: not idempotent — a repeated call inserts a second copy (no idempotency key, no retry).',
    {
      site_id:        z.string().optional().describe('Site ID from config'),
      post_id:        z.number().int().describe('Target page ID'),
      widget:         z.record(z.unknown()).describe('Complete widget object: { id, elType, widgetType, settings, ... }'),
      container_path: z.string().optional().default('root').describe('Dot-separated path to the target container (e.g. "0.1" for sections[0].columns[1]). "root" means the top level.'),
      position:       z.number().int().optional().default(-1).describe('Insertion index within the container. -1 appends at the end.'),
      content_hash:   z.string().describe('Content hash from get_page_data. REQUIRED.'),
      dry_run:        z.boolean().optional().default(false).describe('If true, preview the change without writing.'),
    },
    async ({ site_id, post_id, widget, container_path, position, content_hash, dry_run }) => {
      const client = getClient(site_id);
      const result = await client.insertWidget(post_id, { widget, container_path, position, content_hash, dry_run });
      if (dry_run) {
        return { content: [{ type: 'text', text: `Dry-run insert on page ${post_id}:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`` }] };
      }
      return { content: [{ type: 'text', text: `Widget inserted on page ${post_id} at container "${container_path}" position ${result.position}.\nNew hash: ${result.new_hash}` }] };
    },
  );

  // -----------------------------------------------------------------------
  // remove_widget  (DELTA-003)
  // -----------------------------------------------------------------------
  server.tool(
    'remove_widget',
    'Remove a widget by its element ID from a page. Requires the page content_hash. Use dry_run=true to preview what would be removed.',
    {
      site_id:      z.string().optional().describe('Site ID from config'),
      post_id:      z.number().int().describe('Target page ID'),
      widget_id:    z.string().describe('Element ID of the widget to remove (e.g. "a85a3a7")'),
      content_hash: z.string().describe('Content hash from get_page_data. REQUIRED.'),
      dry_run:      z.boolean().optional().default(false).describe('If true, preview the change without writing.'),
    },
    async ({ site_id, post_id, widget_id, content_hash, dry_run }) => {
      const client = getClient(site_id);
      const result = await client.removeWidget(post_id, widget_id, { content_hash, dry_run });
      if (dry_run) {
        return { content: [{ type: 'text', text: `Dry-run remove on page ${post_id}:\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`` }] };
      }
      return { content: [{ type: 'text', text: `Widget "${widget_id}" removed from page ${post_id}.\nPath: ${result.path}\nNew hash: ${result.new_hash}` }] };
    },
  );

  // -----------------------------------------------------------------------
  // move_widget  (DELTA-003)
  // -----------------------------------------------------------------------
  server.tool(
    'move_widget',
    'Move a widget from its current container to a different container and position within the same page. Requires the page content_hash.',
    {
      site_id:              z.string().optional().describe('Site ID from config'),
      post_id:              z.number().int().describe('Target page ID'),
      widget_id:            z.string().describe('Element ID of the widget to move'),
      target_container_path: z.string().optional().default('root').describe('Dot-separated path to the destination container. "root" = page top level.'),
      position:             z.number().int().optional().default(-1).describe('Target index within the destination container. -1 = append.'),
      content_hash:         z.string().describe('Content hash from get_page_data. REQUIRED.'),
      dry_run:              z.boolean().optional().default(false).describe('If true, preview the change without writing.'),
    },
    async ({ site_id, post_id, widget_id, target_container_path, position, content_hash, dry_run }) => {
      const client = getClient(site_id);
      const result = await client.moveWidget(post_id, widget_id, { target_container_path, position, content_hash, dry_run });
      return { content: [{ type: 'text', text: `Widget "${widget_id}" moved on page ${post_id}: ${result.source_path} → ${result.new_path}\nNew hash: ${result.new_hash}` }] };
    },
  );

  // -----------------------------------------------------------------------
  // clone_widget  (DELTA-003)
  // -----------------------------------------------------------------------
  server.tool(
    'clone_widget',
    'Clone a widget from a source page into a target page at a specific position. The source widget is deep-cloned with a new element ID. Global style references (__globals__, typography bindings) are carried over verbatim — the response includes a global_references list (enumeration only, NOT validated against the target page). Requires the TARGET page content_hash. NOTE: not idempotent — a repeated call inserts a second copy (no idempotency key, no retry).',
    {
      site_id:        z.string().optional().describe('Site ID from config'),
      post_id:        z.number().int().describe('TARGET page ID — where the clone will be inserted'),
      source_page_id: z.number().int().describe('SOURCE page ID — where the original widget lives'),
      widget_id:      z.string().describe('Element ID of the widget to clone on the source page'),
      container_path: z.string().optional().default('root').describe('Dot-separated path to the target container. "root" = top level.'),
      position:       z.number().int().optional().default(-1).describe('Insertion index within the target container. -1 = append.'),
      content_hash:   z.string().describe('Content hash of the TARGET page from get_page_data. REQUIRED.'),
      dry_run:        z.boolean().optional().default(false).describe('If true, preview the clone without writing.'),
    },
    async ({ site_id, post_id, source_page_id, widget_id, container_path, position, content_hash, dry_run }) => {
      const client = getClient(site_id);
      const result = await client.cloneWidget(post_id, { source_page_id, widget_id, container_path, position, content_hash, dry_run });
      const lines = [
        `Widget "${result.source_widget_id}" cloned from page ${result.source_page_id} → page ${result.post_id}`,
        `New widget ID: ${result.new_widget_id}`,
        `Position: ${result.container_path}[${result.position}]`,
      ];
      if (result.global_references.length > 0) {
        lines.push('', `Global references: ${result.global_references.join(', ')}`, 'Check whether these exist on the target page.');
      }
      lines.push('', `New hash: ${result.new_hash}`);
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
