import type { ResolvedCapability, CapabilityResolutionResult } from './types.js';
import { ProviderRegistry } from './registry.js';

function buildFallbackResult(
  contractId: string,
  degradingProviders: ResolvedCapability[],
): ResolvedCapability | null {
  // Pick the first degrading provider as fallback
  for (const candidate of degradingProviders) {
    if (candidate.degradation === 'degraded' || candidate.degradation === 'none') {
      return {
        ...candidate,
        degradation: 'degraded',
      };
    }
  }
  return null;
}

export function resolveCapability(
  registry: ProviderRegistry,
  contractId: string,
): ResolvedCapability | null {
  return registry.resolveCapability(contractId);
}

export function resolveCapabilityOrThrow(
  registry: ProviderRegistry,
  contractId: string,
): ResolvedCapability {
  const result = registry.resolveCapability(contractId);
  if (!result || result.degradation === 'unavailable') {
    throw new Error(
      `Capability contract "${contractId}" could not be resolved — no available provider.`,
    );
  }
  return result;
}

export function resolveMultipleCapabilities(
  registry: ProviderRegistry,
  contractIds: string[],
): CapabilityResolutionResult {
  return registry.resolveMultipleCapabilities(contractIds);
}

export function getCapabilitySummary(registry: ProviderRegistry): string {
  const statuses = registry.getStatus();
  const loaded = statuses.filter((s) => s.loaded && s.healthy);
  const degraded = statuses.filter((s) => s.loaded && !s.healthy);
  const unavailable = statuses.filter((s) => !s.loaded);

  const lines: string[] = [];

  if (loaded.length > 0) {
    lines.push(
      `Loaded: ${loaded.map((s) => s.providerId).join(', ')}`,
    );
  }
  if (degraded.length > 0) {
    lines.push(
      `Degraded: ${degraded.map((s) => `${s.providerId} (${s.errors.join('; ')})`).join(', ')}`,
    );
  }
  if (unavailable.length > 0) {
    lines.push(
      `Unavailable: ${unavailable.map((s) => s.providerId).join(', ')}`,
    );
  }

  return lines.join('\n') || 'No providers registered.';
}
