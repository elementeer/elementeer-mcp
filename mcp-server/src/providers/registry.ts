import type {
  ProviderRegistration,
  ProviderCapability,
  ProviderStatus,
  ResolvedCapability,
  CapabilityResolutionResult,
} from './types.js';

export class ProviderRegistry {
  private providers: Map<string, ProviderRegistration> = new Map();
  private capabilities: Map<string, ResolvedCapability[]> = new Map();
  private loadedProviders: Set<string> = new Set();
  private errors: Map<string, string[]> = new Map();

  register(registration: ProviderRegistration): void {
    if (this.providers.has(registration.providerId)) {
      throw new Error(
        `Provider "${registration.providerId}" is already registered.`,
      );
    }

    this.providers.set(registration.providerId, registration);

    for (const cap of registration.capabilities) {
      const existing = this.capabilities.get(cap.contractId) ?? [];
      existing.push({
        contractId: cap.contractId,
        providerId: registration.providerId,
        operationId: cap.operationId,
        resolved: true,
        degradation: 'none',
      });
      this.capabilities.set(cap.contractId, existing);
    }
  }

  markLoaded(providerId: string): void {
    this.loadedProviders.add(providerId);
  }

  markError(providerId: string, error: string): void {
    const existing = this.errors.get(providerId) ?? [];
    existing.push(error);
    this.errors.set(providerId, existing);
  }

  resolveCapability(contractId: string): ResolvedCapability | null {
    const candidates = this.capabilities.get(contractId);
    if (!candidates || candidates.length === 0) {
      return null;
    }

    // Prefer loaded, healthy providers first
    for (const candidate of candidates) {
      if (this.loadedProviders.has(candidate.providerId) && !this.errors.has(candidate.providerId)) {
        return { ...candidate, resolved: true, degradation: 'none' };
      }
    }

    // Fall back to loaded but degraded providers
    for (const candidate of candidates) {
      if (this.loadedProviders.has(candidate.providerId)) {
        return { ...candidate, resolved: true, degradation: 'degraded' };
      }
    }

    // Provider registered but not loaded — unavailable
    return {
      contractId,
      providerId: candidates[0]!.providerId,
      operationId: candidates[0]!.operationId,
      resolved: false,
      degradation: 'unavailable',
    };
  }

  resolveMultipleCapabilities(contractIds: string[]): CapabilityResolutionResult {
    const resolved: ResolvedCapability[] = [];
    const unresolved: string[] = [];

    for (const contractId of contractIds) {
      const result = this.resolveCapability(contractId);
      if (result && result.resolved) {
        resolved.push(result);
      } else {
        unresolved.push(contractId);
        if (result) {
          resolved.push(result);
        }
      }
    }

    const resolvedCount = resolved.filter((r) => r.resolved).length;
    const totalCount = contractIds.length;
    const summary =
      resolvedCount === totalCount
        ? `All ${totalCount} capabilities resolved.`
        : `${resolvedCount}/${totalCount} capabilities resolved (${unresolved.length} unavailable).`;

    return { resolved, unresolved, summary };
  }

  getStatus(): ProviderStatus[] {
    return Array.from(this.providers.values()).map((p) => ({
      providerId: p.providerId,
      label: p.label,
      loaded: this.loadedProviders.has(p.providerId),
      healthy: this.loadedProviders.has(p.providerId) && !this.errors.has(p.providerId),
      required: p.required,
      capabilities: p.capabilities.map((c) => c.contractId),
      errors: this.errors.get(p.providerId) ?? [],
    }));
  }

  getRegisteredContractIds(): string[] {
    return Array.from(this.capabilities.keys());
  }

  hasCapability(contractId: string): boolean {
    return this.capabilities.has(contractId);
  }

  getProviders(): ReadonlyMap<string, ProviderRegistration> {
    return this.providers;
  }

  clear(): void {
    this.providers.clear();
    this.capabilities.clear();
    this.loadedProviders.clear();
    this.errors.clear();
  }
}
