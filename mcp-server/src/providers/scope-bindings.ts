import type { AuthorizationScopeBinding } from '@elementeer/specs';

export const MCP_SCOPE_BINDINGS: readonly AuthorizationScopeBinding[] = [
  {
    scopeId: 'cms.page.read',
    providerId: 'elementeer.mcp',
    contractId: 'cms.page.read',
    note: 'Read WordPress pages',
  },
  {
    scopeId: 'cms.page.write',
    providerId: 'elementeer.mcp',
    contractId: 'cms.page.write',
    note: 'Create and update WordPress pages',
  },
  {
    scopeId: 'cms.template.read',
    providerId: 'elementeer.mcp',
    contractId: 'cms.template.read',
    note: 'Read Elementor templates',
  },
  {
    scopeId: 'cms.template.write',
    providerId: 'elementeer.mcp',
    contractId: 'cms.template.write',
    note: 'Create and update Elementor templates',
  },
  {
    scopeId: 'cms.media.read',
    providerId: 'elementeer.mcp',
    contractId: 'cms.media.read',
    note: 'Read media library items',
  },
  {
    scopeId: 'cms.media.write',
    providerId: 'elementeer.mcp',
    contractId: 'cms.media.write',
    note: 'Upload and manage media',
  },
  {
    scopeId: 'cms.menu.read',
    providerId: 'elementeer.mcp',
    contractId: 'cms.menu.read',
    note: 'Read navigation menus',
  },
  {
    scopeId: 'cms.menu.write',
    providerId: 'elementeer.mcp',
    contractId: 'cms.menu.write',
    note: 'Create and update navigation menus',
  },
  {
    scopeId: 'cms.seo.read',
    providerId: 'elementeer.mcp',
    contractId: 'cms.seo.read',
    note: 'Read SEO meta data',
  },
  {
    scopeId: 'cms.seo.write',
    providerId: 'elementeer.mcp',
    contractId: 'cms.seo.write',
    note: 'Update SEO meta data',
  },
  {
    scopeId: 'cms.snapshot.read',
    providerId: 'elementeer.mcp',
    contractId: 'cms.snapshot.read',
    note: 'Read content snapshots',
  },
] as const;

export function getScopeBinding(
  scopeId: string,
): AuthorizationScopeBinding | undefined {
  return MCP_SCOPE_BINDINGS.find((b) => b.scopeId === scopeId);
}
