import type { ProviderRegistration, ProviderLifecycle, ProviderHealth as ProviderHealthStatus } from './types.js';
import { ProviderRegistry } from './registry.js';

export interface ProviderLoaderOptions {
  /** Maximum time to wait for a provider to initialize (ms) */
  timeout?: number;
  /** Whether to continue loading when a required provider fails */
  failOnRequiredFailure?: boolean;
}

const DEFAULT_TIMEOUT = 15_000;

export class ProviderLoader {
  private registry: ProviderRegistry;

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  /**
   * Load a provider: run its health check, then mark it as loaded or errored.
   * Returns true if the provider loaded successfully.
   */
  async loadProvider(
    registration: ProviderRegistration,
    options: ProviderLoaderOptions = {},
  ): Promise<boolean> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT;

    try {
      this.registry.register(registration);

      if (registration.lifecycle?.healthCheck) {
        const health = await this.withTimeout(
          registration.lifecycle.healthCheck(),
          timeout,
          `Provider "${registration.providerId}" health check timed out`,
        );

        if (!health.healthy) {
          const msg = health.message ?? 'Provider health check failed';
          this.registry.markError(registration.providerId, msg);
          process.stderr.write(
            `[ProviderLoader] Provider "${registration.providerId}" unhealthy: ${msg}\n`,
          );
          return false;
        }
      }

      if (registration.lifecycle?.onLoad) {
        await this.withTimeout(
          registration.lifecycle.onLoad(),
          timeout,
          `Provider "${registration.providerId}" onLoad timed out`,
        );
      }

      this.registry.markLoaded(registration.providerId);
      process.stderr.write(
        `[ProviderLoader] Provider "${registration.providerId}" loaded with ${registration.capabilities.length} capabilities.\n`,
      );
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.registry.markError(registration.providerId, message);
      process.stderr.write(
        `[ProviderLoader] Provider "${registration.providerId}" failed: ${message}\n`,
      );

      if (registration.required && (options.failOnRequiredFailure ?? false)) {
        throw new Error(
          `Required provider "${registration.providerId}" failed to load: ${message}`,
        );
      }

      return false;
    }
  }

  /**
   * Load multiple providers. Required providers run first.
   * Optional provider failures are logged but do not block startup.
   */
  async loadProviders(
    registrations: ProviderRegistration[],
    options: ProviderLoaderOptions = {},
  ): Promise<{ loaded: string[]; failed: string[] }> {
    const required = registrations.filter((p) => p.required);
    const optional = registrations.filter((p) => !p.required);

    const loaded: string[] = [];
    const failed: string[] = [];

    // Load required providers first
    for (const reg of required) {
      const success = await this.loadProvider(reg, options);
      if (success) {
        loaded.push(reg.providerId);
      } else {
        failed.push(reg.providerId);
        if (options.failOnRequiredFailure ?? false) {
          throw new Error(
            `Required provider "${reg.providerId}" failed to load and failOnRequiredFailure is enabled.`,
          );
        }
      }
    }

    // Load optional providers — failures are logged but don't block
    for (const reg of optional) {
      const success = await this.loadProvider(reg, options);
      if (success) {
        loaded.push(reg.providerId);
      } else {
        failed.push(reg.providerId);
        process.stderr.write(
          `[ProviderLoader] Optional provider "${reg.providerId}" failed — continuing without it.\n`,
        );
      }
    }

    process.stderr.write(
      `[ProviderLoader] Provider loading complete: ${loaded.length} loaded, ${failed.length} failed.\n`,
    );

    return { loaded, failed };
  }

  /**
   * Unload a provider: run its onUnload hook and remove from loaded set.
   */
  async unloadProvider(providerId: string): Promise<void> {
    const registration = this.registry.getProviders().get(providerId);
    if (!registration) return;

    if (registration.lifecycle?.onUnload) {
      try {
        await registration.lifecycle.onUnload();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        process.stderr.write(
          `[ProviderLoader] Provider "${providerId}" onUnload failed: ${message}\n`,
        );
      }
    }
  }

  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    timeoutMessage: string,
  ): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(timeoutMessage)), ms),
    );
    return Promise.race([promise, timeout]);
  }
}
