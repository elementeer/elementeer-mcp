import { ProviderRegistry, resolveCapability, getCapabilitySummary } from './providers/index.js';
import type { ResolvedCapability, ProviderHealth, ProviderRegistration } from './providers/index.js';

let sharedRegistry: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!sharedRegistry) {
    sharedRegistry = new ProviderRegistry();
  }
  return sharedRegistry;
}

export function setProviderRegistry(registry: ProviderRegistry): void {
  sharedRegistry = registry;
}

export function resolveOperation(
  capabilityContractId: string,
): ResolvedCapability | null {
  return resolveCapability(getProviderRegistry(), capabilityContractId);
}

export function getCapabilityRequirement(operation: string): {
  capability: string;
  level: string;
} {
  const requirementMap: Record<string, { capability: string; level: string }> = {
    'page-composition': { capability: 'cms.content-structure.write', level: 'L1' },
    'global-styles': { capability: 'cms.design-system.write', level: 'L2' },
    'template-management': { capability: 'cms.library-operations.write', level: 'L1' },
    'seo-analysis': { capability: 'cms.site.audit', level: 'L2' },
    'performance-check': { capability: 'cms.site.audit', level: 'L1' },
    'accessibility-scan': { capability: 'cms.site.audit', level: 'L2' },
    'snapshot-create': { capability: 'cms.content-structure.write', level: 'L2' },
    'addon-analysis': { capability: 'cms.plugin-stack-context.read', level: 'L2' },
  };
  return requirementMap[operation] ?? { capability: 'cms.site.audit', level: 'L1' };
}

export function checkOperationAllowed(
  operation: string,
  capabilities: Set<string>,
  _level: string,
): { allowed: boolean; required: string } {
  const requirement = getCapabilityRequirement(operation);
  const allowed = capabilities.has(requirement.capability) || capabilities.has('*');
  return { allowed, required: requirement.capability };
}

export function getCapabilitiesSummary(): string {
  return getCapabilitySummary(getProviderRegistry());
}

export function buildCoreProviderRegistration(): ProviderRegistration {
  return {
    providerId: 'elementeer.mcp',
    label: 'Elementeer Core Provider',
    required: true,
    capabilities: [
      { contractId: 'cms.site.audit', operationId: 'get_site_info' },
      { contractId: 'cms.site.foundation.read', operationId: 'get_site_settings' },
      { contractId: 'cms.site.foundation.write', operationId: 'update_site_settings' },
      { contractId: 'cms.design-system.read', operationId: 'get_global_styles' },
      { contractId: 'cms.design-system.write', operationId: 'set_global_colors' },
      { contractId: 'cms.content-structure.read', operationId: 'list_templates' },
      { contractId: 'cms.content-structure.write', operationId: 'create_template' },
      { contractId: 'cms.library-operations.read', operationId: 'list_templates' },
      { contractId: 'cms.library-operations.write', operationId: 'create_template' },
      { contractId: 'cms.plugin-stack-context.read', operationId: 'list_active_addons' },
      { contractId: 'cms.governance.read', operationId: 'list_changes' },
      { contractId: 'cms.governance.write', operationId: 'create_change' },
      { contractId: 'cms.governance.review', operationId: 'list_changes' },
      { contractId: 'cms.governance.apply', operationId: 'update_change_status' },
      { contractId: 'cms.media-operations.read', operationId: 'list_media' },
      { contractId: 'cms.theme-structure.read', operationId: 'list_templates' },
      { contractId: 'cms.stack-bootstrap.read', operationId: 'get_site_info' },
      { contractId: 'cms.stack-bootstrap.prepare', operationId: 'get_site_info' },
      { contractId: 'cms.workflow-orchestration.read', operationId: 'get_site_info' },
    ],
    lifecycle: {
      healthCheck: () => ({
        healthy: true,
        message: 'Core provider is always healthy.',
      }),
    },
  };
}
