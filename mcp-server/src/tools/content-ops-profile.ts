import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import { registerLibraryTools } from './library.js';
import { registerContentTools } from './content.js';
import { registerOrganizationTools } from './organization.js';
import { registerSiteTools } from './site.js';
import { registerPageTools } from './pages.js';
import { registerDiffPagesTool } from './diff-pages.js';
import { registerMenuTools } from './menus.js';
import { registerMediaTools } from './media.js';
import { registerGlobalStylesTools } from './global-styles.js';
import { registerAssessmentTools } from './assessment.js';
import { registerRecommendationTools } from './recommendations.js';
import { registerFingerprintTools } from './fingerprint.js';
import { registerDestinationTools } from './destination.js';
import { registerValidationTools } from './validation.js';
import { registerSeoTools } from './seo.js';

type Registrar = (server: McpServer, getClient: (siteId?: string) => ElementeerClient) => void;

const READ_ONLY_TOOL_NAMES = new Set([
  'list_templates',
  'get_template',
  'get_template_data',
  'extract_sections',
  'list_by_type',
  'get_site_info',
  'get_site_context',
  'list_elementor_pages',
  'get_page_data',
  'describe_widget_type',
  'diff_pages',
  'list_menus',
  'list_menu_items',
  'list_menu_locations',
  'list_media',
  'get_media',
  'get_global_styles',
  'assess_site',
  'get_recommendations',
  'get_site_fingerprint',
  'get_destination_capabilities',
  'validate_elementor_write',
  'get_seo_meta',
  'list_taxonomies',
  'list_post_types',
]);

const CONTENT_OPS_REGISTRARS: Registrar[] = [
  registerLibraryTools,
  registerContentTools,
  registerOrganizationTools,
  registerSiteTools,
  registerPageTools,
  registerDiffPagesTool,
  registerMenuTools,
  registerMediaTools,
  registerGlobalStylesTools,
  registerAssessmentTools,
  registerRecommendationTools,
  registerFingerprintTools,
  registerDestinationTools,
  registerValidationTools,
  registerSeoTools,
];

export function registerContentOpsProfile(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {
  const namesRegistered: string[] = [];

  const origTool = server.tool.bind(server) as (...args: unknown[]) => unknown;
  server.tool = ((...args: unknown[]) => {
    const name = typeof args[0] === 'string' ? args[0] : '';
    if (!name || !READ_ONLY_TOOL_NAMES.has(name)) {
      return {};
    }
    namesRegistered.push(name);
    return (origTool as (...a: unknown[]) => unknown)(...args);
  }) as McpServer['tool'];

  for (const registrar of CONTENT_OPS_REGISTRARS) {
    registrar(server, getClient);
  }

  // Restore original tool function
  server.tool = origTool as McpServer['tool'];
}
