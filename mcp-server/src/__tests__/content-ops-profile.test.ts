import { describe, it, expect, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerContentOpsProfile } from '../tools/content-ops-profile.js';

function makeMockClient() {
  return {
    getPageData: vi.fn().mockResolvedValue({ post_id: 1, post_title: '', elementor_data: [] }),
    getTemplate: vi.fn().mockResolvedValue({ id: 1, title: '', type: 'page', status: 'publish', author: 1, date: '', modified: '', categories: [], tags: [] }),
    getTemplateData: vi.fn().mockResolvedValue({ id: 1, elementor_data: [] }),
    getSiteInfo: vi.fn().mockResolvedValue({ name: '', url: '', wp_version: '', elementor_version: null, elementor_pro: false, activation_mode: 'standalone-free', template_count: 0, capabilities: [] }),
    getSiteContext: vi.fn().mockResolvedValue({ user_role: null, site_purpose: null, brand_notes: null, target_audience: null, primary_language: null, set_at: null }),
    assessSite: vi.fn().mockResolvedValue({}),
    listTemplates: vi.fn().mockResolvedValue([]),
    listByType: vi.fn().mockResolvedValue([]),
    listElementorPages: vi.fn().mockResolvedValue([]),
    listMenus: vi.fn().mockResolvedValue([]),
    listMenuItems: vi.fn().mockResolvedValue([]),
    listMenuLocations: vi.fn().mockResolvedValue([]),
    listMedia: vi.fn().mockResolvedValue([]),
    getGlobalStyles: vi.fn().mockResolvedValue({ colors: [], typography: [] }),
    getSeoMeta: vi.fn().mockResolvedValue({}),
    listTaxonomies: vi.fn().mockResolvedValue([]),
    listPostTypes: vi.fn().mockResolvedValue([]),
    getMenu: vi.fn().mockResolvedValue({ items: [] }),
    getMedia: vi.fn().mockResolvedValue({}),
    getDestinationCapabilities: vi.fn().mockResolvedValue({}),
    getSiteFingerprint: vi.fn().mockResolvedValue({}),
    validateElementorWrite: vi.fn().mockResolvedValue({}),
  };
}

function extractToolNames(server: McpServer): string[] {
  const names: string[] = [];
  const orig = server.tool.bind(server) as (...args: unknown[]) => unknown;
  server.tool = ((...args: unknown[]) => {
    const name = typeof args[0] === 'string' ? args[0] : '';
    if (name) names.push(name);
    return (orig as (...a: unknown[]) => unknown)(...args);
  }) as McpServer['tool'];
  return names.sort();
}

describe('Content-Ops Profil', () => {
  it('registriert hoechstens 25 Tools', () => {
    const server = new McpServer({ name: 'test', version: '1.0.0' });
    const names = extractToolNames(server);
    registerContentOpsProfile(server, makeMockClient as any);
    console.log(`  content-ops (${names.length} Tools):\n    ${names.join('\n    ')}`);
    expect(names.length).toBeLessThanOrEqual(25);
    expect(names.length).toBeGreaterThan(0);
  });

  it('deterministisch: zwei Aufrufe — identische Toolmenge', () => {
    const serverA = new McpServer({ name: 'a', version: '1.0.0' });
    const namesA = extractToolNames(serverA);
    registerContentOpsProfile(serverA, makeMockClient as any);

    const serverB = new McpServer({ name: 'b', version: '1.0.0' });
    const namesB = extractToolNames(serverB);
    registerContentOpsProfile(serverB, makeMockClient as any);

    expect(namesA.sort()).toEqual(namesB.sort());
    console.log(`  A: ${namesA.length} Tools, B: ${namesB.length} Tools — identisch`);
  });

  it('deterministisch ueber Serverneustart hinweg', () => {
    const server1 = new McpServer({ name: 'pass1', version: '1.0.0' });
    const pass1 = extractToolNames(server1);
    registerContentOpsProfile(server1, makeMockClient as any);

    const server2 = new McpServer({ name: 'pass2', version: '1.0.0' });
    const pass2 = extractToolNames(server2);
    registerContentOpsProfile(server2, makeMockClient as any);

    expect(pass1.sort()).toEqual(pass2.sort());
    console.log(`  Pass 1: ${pass1.length}, Pass 2: ${pass2.length} — identisch`);
  });

  it('enthaelt alle essentiellen Lesepfad-Tools', () => {
    const server = new McpServer({ name: 'check', version: '1.0.0' });
    const names = extractToolNames(server);
    registerContentOpsProfile(server, makeMockClient as any);
    const toolSet = new Set(names);

    const required = [
      'get_page_data',
      'list_elementor_pages',
      'get_template',
      'get_template_data',
      'list_templates',
      'diff_pages',
      'describe_widget_type',
      'get_site_context',
      'get_site_info',
      'get_global_styles',
      'assess_site',
      'get_recommendations',
      'get_destination_capabilities',
      'get_site_fingerprint',
      'extract_sections',
      'list_by_type',
      'list_media',
      'get_media',
      'list_menus',
      'list_menu_items',
      'list_menu_locations',
      'validate_elementor_write',
    ];

    for (const n of required) {
      expect(toolSet.has(n), `Essentielles Tool fehlt: ${n}`).toBe(true);
    }

    // Kein Tool darf ein Write-Tool sein
    const writePrefixes = [
      'create_', 'update_', 'delete_', 'set_', 'save_', 'rename_',
      'duplicate_', 'bulk_', 'compose_', 'creator_mode',
    ];
    for (const toolName of names) {
      const isWrite = writePrefixes.some(p => toolName.startsWith(p));
      expect(isWrite, `Write-Tool nicht erlaubt: ${toolName}`).toBe(false);
    }

    console.log(`  Alle ${names.length} Tools erwartet, keine Write-Tools enthalten ✓`);
  });
});
