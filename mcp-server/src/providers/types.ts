import type {
  CapabilityContractId,
  ProviderId,
  OperationId,
  AuthorizationScopeId,
} from '@elementeer/specs';

export { CapabilityContractId, ProviderId, OperationId, AuthorizationScopeId };

export interface ProviderCapability {
  contractId: CapabilityContractId;
  operationId: OperationId;
  metadata?: Record<string, unknown>;
}

export interface ProviderRegistration {
  providerId: ProviderId;
  label: string;
  capabilities: ProviderCapability[];
  required: boolean;
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
  contractId: CapabilityContractId;
  providerId: ProviderId;
  operationId: OperationId;
  resolved: boolean;
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
  providerId: ProviderId;
  label: string;
  loaded: boolean;
  healthy: boolean;
  required: boolean;
  capabilities: CapabilityContractId[];
  errors: string[];
}
