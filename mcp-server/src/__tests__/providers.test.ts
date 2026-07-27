import { describe, expect, it, beforeEach } from 'vitest';
import { ProviderRegistry } from '../providers/registry.js';
import type { ProviderRegistration } from '../providers/types.js';
import { ProviderLoader } from '../providers/loader.js';
import {
  checkProviderHealth,
  getOverallHealth,
} from '../providers/health.js';
import {
  resolveCapability,
  resolveMultipleCapabilities,
  getCapabilitySummary,
} from '../providers/resolver.js';

function makeCoreProvider(): ProviderRegistration {
  return {
    providerId: 'core-test',
    label: 'Core Test Provider',
    required: true,
    capabilities: [
      { contractId: 'site-audit:read', operationId: 'audit' },
      { contractId: 'design-system:read', operationId: 'get_styles' },
    ],
    lifecycle: {
      healthCheck: () => ({ healthy: true }),
    },
  };
}

function makeOptionalProvider(): ProviderRegistration {
  return {
    providerId: 'optional-test',
    label: 'Optional Test Provider',
    required: false,
    capabilities: [
      { contractId: 'theme-structure:read', operationId: 'get_themes' },
      { contractId: 'content-structure:write', operationId: 'write_content' },
    ],
    lifecycle: {
      healthCheck: () => ({ healthy: true }),
    },
  };
}

function makeUnhealthyProvider(): ProviderRegistration {
  return {
    providerId: 'unhealthy-test',
    label: 'Unhealthy Test Provider',
    required: false,
    capabilities: [
      { contractId: 'extra-feature:read', operationId: 'extra' },
    ],
    lifecycle: {
      healthCheck: () => ({ healthy: false, message: 'Cannot connect' }),
    },
  };
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('registers a provider and indexes its capabilities', () => {
    registry.register(makeCoreProvider());
    expect(registry.hasCapability('site-audit:read')).toBe(true);
    expect(registry.hasCapability('design-system:read')).toBe(true);
    expect(registry.hasCapability('unknown:cap')).toBe(false);
  });

  it('throws when registering duplicate provider', () => {
    registry.register(makeCoreProvider());
    expect(() => registry.register(makeCoreProvider())).toThrow(
      /already registered/,
    );
  });

  it('resolves a capability when the provider is loaded', () => {
    registry.register(makeCoreProvider());
    registry.markLoaded('core-test');

    const result = registry.resolveCapability('site-audit:read');
    expect(result).not.toBeNull();
    expect(result!.contractId).toBe('site-audit:read');
    expect(result!.providerId).toBe('core-test');
    expect(result!.operationId).toBe('audit');
    expect(result!.resolved).toBe(true);
    expect(result!.degradation).toBe('none');
  });

  it('returns null for unknown capability contracts', () => {
    registry.register(makeCoreProvider());
    registry.markLoaded('core-test');

    const result = registry.resolveCapability('unknown:cap');
    expect(result).toBeNull();
  });

  it('marks provider as degraded when loaded but with errors', () => {
    registry.register(makeCoreProvider());
    registry.markLoaded('core-test');
    registry.markError('core-test', 'intermittent failure');

    const result = registry.resolveCapability('site-audit:read');
    expect(result!.degradation).toBe('degraded');
  });

  it('returns unavailable when provider is not loaded', () => {
    registry.register(makeCoreProvider());
    // Not loaded

    const result = registry.resolveCapability('site-audit:read');
    expect(result!.resolved).toBe(false);
    expect(result!.degradation).toBe('unavailable');
  });

  it('resolves multiple capabilities', () => {
    registry.register(makeCoreProvider());
    registry.markLoaded('core-test');

    const result = resolveMultipleCapabilities(registry, [
      'site-audit:read',
      'design-system:read',
      'unknown:cap',
    ]);

    expect(result.resolved.filter((r) => r.resolved)).toHaveLength(2);
    expect(result.unresolved).toContain('unknown:cap');
  });

  it('reports provider status correctly', () => {
    registry.register(makeCoreProvider());
    registry.register(makeOptionalProvider());
    registry.markLoaded('core-test');

    const statuses = registry.getStatus();
    expect(statuses).toHaveLength(2);

    const coreStatus = statuses.find((s) => s.providerId === 'core-test')!;
    expect(coreStatus.loaded).toBe(true);
    expect(coreStatus.healthy).toBe(true);

    const optStatus = statuses.find((s) => s.providerId === 'optional-test')!;
    expect(optStatus.loaded).toBe(false);
    expect(optStatus.healthy).toBe(false);
  });

  it('clears all data', () => {
    registry.register(makeCoreProvider());
    registry.markLoaded('core-test');
    registry.clear();

    expect(registry.getRegisteredContractIds()).toHaveLength(0);
    expect(registry.getStatus()).toHaveLength(0);
  });

  it('prefers healthy loaded providers when multiple providers exist for same contract', () => {
    const primary: ProviderRegistration = {
      providerId: 'primary',
      label: 'Primary',
      required: true,
      capabilities: [{ contractId: 'shared:cap', operationId: 'op_primary' }],
    };
    const secondary: ProviderRegistration = {
      providerId: 'secondary',
      label: 'Secondary',
      required: false,
      capabilities: [{ contractId: 'shared:cap', operationId: 'op_secondary' }],
    };

    registry.register(primary);
    registry.register(secondary);
    registry.markLoaded('primary');
    registry.markLoaded('secondary');

    const result = registry.resolveCapability('shared:cap');
    expect(result!.providerId).toBe('primary');
    expect(result!.degradation).toBe('none');
  });
});

describe('ProviderLoader', () => {
  let registry: ProviderRegistry;
  let loader: ProviderLoader;

  beforeEach(() => {
    registry = new ProviderRegistry();
    loader = new ProviderLoader(registry);
  });

  it('loads a healthy provider successfully', async () => {
    const result = await loader.loadProvider(makeCoreProvider());
    expect(result).toBe(true);

    const statuses = registry.getStatus();
    const coreStatus = statuses.find((s) => s.providerId === 'core-test')!;
    expect(coreStatus.loaded).toBe(true);
    expect(coreStatus.healthy).toBe(true);
  });

  it('fails to load an unhealthy provider', async () => {
    const result = await loader.loadProvider(makeUnhealthyProvider());
    expect(result).toBe(false);

    const statuses = registry.getStatus();
    const unhealthyStatus = statuses.find((s) => s.providerId === 'unhealthy-test')!;
    expect(unhealthyStatus.loaded).toBe(false);
    expect(unhealthyStatus.healthy).toBe(false);
    expect(unhealthyStatus.errors).toContain('Cannot connect');
  });

  it('loads multiple providers with mixed results', async () => {
    const { loaded, failed } = await loader.loadProviders([
      makeCoreProvider(),
      makeOptionalProvider(),
      makeUnhealthyProvider(),
    ]);

    expect(loaded).toContain('core-test');
    expect(loaded).toContain('optional-test');
    expect(failed).toContain('unhealthy-test');
  });

  it('does not block when optional providers fail', async () => {
    const { loaded, failed } = await loader.loadProviders([
      makeCoreProvider(),
      makeUnhealthyProvider(),
    ]);

    expect(loaded).toContain('core-test');
    expect(failed).toContain('unhealthy-test');
    // Core provider (required) was loaded, server should be operational
    expect(registry.getStatus().find((s) => s.providerId === 'core-test')!.healthy).toBe(true);
  });
});

describe('ProviderHealth', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  it('reports healthy when required providers are loaded', () => {
    registry.register(makeCoreProvider());
    registry.markLoaded('core-test');

    const result = getOverallHealth(registry);
    expect(result.healthy).toBe(true);
  });

  it('reports unhealthy when required provider is not loaded', () => {
    registry.register(makeCoreProvider());
    // Not loaded

    const result = getOverallHealth(registry);
    expect(result.healthy).toBe(false);
  });

  it('reports healthy when no required providers are configured', () => {
    const result = getOverallHealth(registry);
    expect(result.healthy).toBe(true);
  });

  it('generates health map for all providers', () => {
    registry.register(makeCoreProvider());
    registry.register(makeUnhealthyProvider());
    registry.markLoaded('core-test');
    registry.markError('unhealthy-test', 'Cannot connect');

    const healthMap = checkProviderHealth(registry);
    expect(healthMap.get('core-test')!.healthy).toBe(true);
    expect(healthMap.get('unhealthy-test')!.healthy).toBe(false);
  });
});

describe('CapabilityResolver', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    registry.register(makeCoreProvider());
    registry.markLoaded('core-test');
  });

  it('resolves a known capability', () => {
    const result = resolveCapability(registry, 'site-audit:read');
    expect(result).not.toBeNull();
    expect(result!.providerId).toBe('core-test');
  });

  it('returns null for unknown capability', () => {
    const result = resolveCapability(registry, 'nonexistent:cap');
    expect(result).toBeNull();
  });

  it('resolves multiple capabilities with summary', () => {
    const result = resolveMultipleCapabilities(registry, [
      'site-audit:read',
      'design-system:read',
      'missing:cap',
    ]);

    expect(result.unresolved).toContain('missing:cap');
    expect(result.summary).toContain('2/3');
  });

  it('generates capability summary string', () => {
    const summary = getCapabilitySummary(registry);
    expect(summary).toContain('core-test');
  });
});
