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
    'Apply multiple widget content edits to a single page in one atomic batch. Each operation specifies a widget_id and the settings to merge. The entire batch shares one content_hash. If any individual widget fails (not found, bad settings), the result lists the error per widget but does NOT abort the batch — and the response carries a partial:true flag. Use this instead of making N separate patch_widget calls.',
    {
      site_id:      z.string().optional().describe('Site ID from config'),
      post_id:      z.number().int().describe('Page or template ID'),
      operations:   z.array(
        z.object({
          widget_id: z.string().describe('Element ID of the widget to patch'),
          settings:  z.record(z.unknown()).describe('Settings to merge into this widget'),
          dry_run:   z.boolean().optional().default(false).describe('If true, preview this widget change without writing'),
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
      });

      const summaryLines = [
        `Batch widget patch on ${is_template ? 'template' : 'page'} ${post_id}:`,
        `  Total operations: ${operations.length}`,
        `  Updated: ${result.results.filter(r => r.updated).length}`,
        `  Failed: ${result.results.filter(r => r.error).length}`,
        `  Mode: ${dry_run ? 'dry-run' : 'live'}`,
      ];

      if (result.partial) {
        summaryLines.push(`  ⚠️ partial=true — some operations failed, check results below.`);
      }

      summaryLines.push('', `New hash: ${result.new_hash}`);
      summaryLines.push('');

      for (const r of result.results) {
        if (r.updated) {
          summaryLines.push(`  ✅ ${r.widget_id} — updated`);
        } else if (r.error) {
          summaryLines.push(`  ❌ ${r.widget_id} — ${r.error}`);
        } else {
          summaryLines.push(`  - ${r.widget_id} — no change`);
        }
      }

      // If the batch was entirely dry-run, add a note
      if (dry_run && result.dry_run) {
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
    'Begin a new change session. All writes made while this session is active are grouped together so they can be rolled back as a unit with session_restore. Use session_end to close the session normally. Sessions auto-expire after 30 minutes of inactivity.',
    {
      site_id: z.string().optional().describe('Site ID from config'),
    },
    async ({ site_id }) => {
      const client = getClient(site_id);
      const result = await client.beginChangeSession();
      return {
        content: [{
          type: 'text',
          text: `Session "${result.session_id}" started.\n\nAll subsequent writes are grouped under this session.\nCall session_end to close normally, or session_restore to roll back.\n\nSession ID: ${result.session_id}`,
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
      return {
        content: [{
          type: 'text',
          text: `Session "${session_id}" ended.\nWrites made during this session are preserved.\nTo undo them, use session_restore with the same session_id before the session auto-expires.`,
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
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Session "${session_id}" restore failed.\n${JSON.stringify(result)}` }],
          isError: true,
        };
      }
      const lines = [
        `Session "${session_id}" fully rolled back.`,
        `Restored ${result.restored_count} object(s) to pre-session state.`,
      ];
      if (result.changes?.length) {
        lines.push('', 'Changes that were reversed:');
        for (const c of result.changes) {
          lines.push(`  - ${(c as any).resource_type ?? '?'} #${(c as any).resource_id ?? '?'}`);
        }
      }
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
    },
    async ({ site_id, rule_key, rule_note, post_ids, slugs }) => {
      const client = getClient(site_id);
      const result = await client.setSiteMemoryEntry(rule_key, {
        type: 'rule',
        content: rule_note,
        rule: { protect: { post_ids, slugs } },
      });

      const lines = [
        `Protection rule "${rule_key}" set.`,
        `  Content: ${rule_note}`,
      ];
      if (post_ids?.length) lines.push(`  Protected post IDs: ${post_ids.join(', ')}`);
      if (slugs?.length) lines.push(`  Protected slugs: ${slugs.join(', ')}`);
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
        lines.push(`     Set: ${r.set_at}`);
        lines.push('');
      }
      lines.push('Use site_unprotect <key> to remove a rule.');

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
