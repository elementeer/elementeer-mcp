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
    'page-composition': { capability: 'content-structure:write', level: 'L1' },
    'global-styles': { capability: 'design-system:write', level: 'L2' },
    'template-management': { capability: 'library-operations:write', level: 'L1' },
    'seo-analysis': { capability: 'site-audit:read', level: 'L2' },
    'performance-check': { capability: 'site-audit:read', level: 'L1' },
    'accessibility-scan': { capability: 'site-audit:read', level: 'L2' },
    'snapshot-create': { capability: 'content-structure:write', level: 'L2' },
    'addon-analysis': { capability: 'plugin-stack-context:read', level: 'L2' },
  };
  return requirementMap[operation] ?? { capability: 'site-audit:read', level: 'L1' };
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
    providerId: 'core-elementeer',
    label: 'Elementeer Core Provider',
    required: true,
    capabilities: [
      { contractId: 'site-audit:read', operationId: 'get_site_info' },
      { contractId: 'site-foundation:read', operationId: 'get_site_settings' },
      { contractId: 'site-foundation:write', operationId: 'update_site_settings' },
      { contractId: 'design-system:read', operationId: 'get_global_styles' },
      { contractId: 'design-system:write', operationId: 'set_global_colors' },
      { contractId: 'content-structure:read', operationId: 'list_templates' },
      { contractId: 'content-structure:write', operationId: 'create_template' },
      { contractId: 'library-operations:read', operationId: 'list_templates' },
      { contractId: 'library-operations:write', operationId: 'create_template' },
      { contractId: 'plugin-stack-context:read', operationId: 'list_active_addons' },
      { contractId: 'governance:read', operationId: 'list_changes' },
      { contractId: 'governance:write', operationId: 'create_change' },
      { contractId: 'governance:review', operationId: 'list_changes' },
      { contractId: 'governance:apply', operationId: 'update_change_status' },
      { contractId: 'media-operations:read', operationId: 'list_media' },
      { contractId: 'theme-structure:read', operationId: 'list_templates' },
      { contractId: 'stack-bootstrap:read', operationId: 'get_site_info' },
      { contractId: 'stack-bootstrap:prepare', operationId: 'get_site_info' },
      { contractId: 'workflow-orchestration:read', operationId: 'get_site_info' },
    ],
    lifecycle: {
      healthCheck: () => ({
        healthy: true,
        message: 'Core provider is always healthy.',
      }),
    },
  };
}
