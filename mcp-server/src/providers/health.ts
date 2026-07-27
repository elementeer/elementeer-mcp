import type { ProviderHealth, ProviderStatus } from './types.js';
import { ProviderRegistry } from './registry.js';

export function checkProviderHealth(
  registry: ProviderRegistry,
): Map<string, ProviderHealth> {
  const statuses = registry.getStatus();
  const healthMap = new Map<string, ProviderHealth>();

  for (const status of statuses) {
    healthMap.set(status.providerId, {
      healthy: status.healthy,
      message: status.errors.length > 0
        ? `Provider has ${status.errors.length} error(s): ${status.errors.join('; ')}`
        : status.loaded
          ? 'Provider is healthy and loaded.'
          : 'Provider is not loaded.',
      details: {
        loaded: status.loaded,
        required: status.required,
        capabilities: status.capabilities,
      },
    });
  }

  return healthMap;
}

export function getOverallHealth(
  registry: ProviderRegistry,
): { healthy: boolean; message: string } {
  const statuses = registry.getStatus();
  const requiredProviders = statuses.filter((s) => s.required);

  if (requiredProviders.length === 0) {
    return { healthy: true, message: 'No required providers configured.' };
  }

  const unhealthyRequired = requiredProviders.filter(
    (s) => !s.loaded || !s.healthy,
  );

  if (unhealthyRequired.length === 0) {
    return {
      healthy: true,
      message: `All ${requiredProviders.length} required providers are healthy.`,
    };
  }

  return {
    healthy: false,
    message: `${unhealthyRequired.length}/${requiredProviders.length} required providers are unhealthy: ${unhealthyRequired.map((s) => s.providerId).join(', ')}`,
  };
}
