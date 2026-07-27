export interface ProviderCapability {
  /** The abstract capability contract ID (e.g. "site-audit:read") */
  contractId: string;
  /** The concrete operation to invoke within this provider */
  operationId: string;
  /** Optional metadata about the capability mapping */
  metadata?: Record<string, unknown>;
}

export interface ProviderRegistration {
  /** Unique identifier for this provider (e.g. "core-site", "elementor-pro-site") */
  providerId: string;
  /** Human-readable label */
  label: string;
  /** The capabilities this provider fulfills */
  capabilities: ProviderCapability[];
  /** Whether this provider is required for the server to function */
  required: boolean;
  /** Lifecycle hooks */
  lifecycle?: ProviderLifecycle;
}

export interface ProviderLifecycle {
  /** Called when the provider is loaded and ready */
  onLoad?: () => Promise<void> | void;
  /** Called when the provider is unloaded */
  onUnload?: () => Promise<void> | void;
  /** Health check — returns true if the provider is healthy */
  healthCheck?: () => Promise<ProviderHealth> | ProviderHealth;
}

export interface ProviderHealth {
  /** Whether the provider is currently healthy */
  healthy: boolean;
  /** Optional diagnostic message */
  message?: string;
  /** Optional detailed diagnostics */
  details?: Record<string, unknown>;
}

export interface ResolvedCapability {
  /** The capability contract that was resolved */
  contractId: string;
  /** The provider that fulfills this capability */
  providerId: string;
  /** The concrete operation to invoke */
  operationId: string;
  /** Whether the resolution was successful */
  resolved: boolean;
  /** Degradation level if not fully resolved */
  degradation?: CapabilityDegradation;
}

export type CapabilityDegradation =
  | 'none'
  | 'degraded'
  | 'unavailable';

export interface CapabilityResolutionResult {
  /** Resolved capabilities */
  resolved: ResolvedCapability[];
  /** Capabilities that could not be resolved */
  unresolved: string[];
  /** Summary of the resolution */
  summary: string;
}

export interface ProviderStatus {
  providerId: string;
  label: string;
  loaded: boolean;
  healthy: boolean;
  required: boolean;
  capabilities: string[];
  errors: string[];
}
