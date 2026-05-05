import type { ActivationMode } from './auth.js';

export interface SiteConfig {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  activationMode?: ActivationMode;
  default?: boolean;
}

export interface ElementeerIntegrations {
  pexels_api_key?: string;
  unsplash_access_key?: string;
  openai_api_key?: string;
  ai_planning_enabled?: boolean;
}

export interface ElementeerConfig {
  sites: SiteConfig[];
  integrations?: ElementeerIntegrations;
}
