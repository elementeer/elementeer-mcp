export class CapabilityRegistry {
  static getInstance() {
    return new CapabilityRegistry();
  }

  getAll() {
    return ['*'];
  }

  resolve(tier: string): string[] {
    return ['*'];
  }
}

export function getCapabilityRequirement(operation: string): { capability: string; level: string } {
  const requirementMap: Record<string, { capability: string; level: string }> = {
    'page-composition': { capability: 'content-structure:write', level: 'L1' },
    'global-styles': { capability: 'global-styles:write', level: 'L2' },
    'template-management': { capability: 'library-operations:write', level: 'L1' },
    'seo-analysis': { capability: 'seo:read', level: 'L2' },
    'performance-check': { capability: 'performance:read', level: 'L1' },
    'accessibility-scan': { capability: 'accessibility:read', level: 'L2' },
    'snapshot-create': { capability: 'snapshots:write', level: 'L2' },
    'addon-analysis': { capability: 'addon:read', level: 'L2' },
  };
  return requirementMap[operation] || { capability: 'site-audit:read', level: 'L1' };
}

export function checkOperationAllowed(
  operation: string, 
  capabilities: Set<string>, 
  level: string
): { allowed: boolean; required: string } {
  const requirement = getCapabilityRequirement(operation);
  const allowed = capabilities.has(requirement.capability) || capabilities.has('*');
  return { allowed, required: requirement.capability };
}
