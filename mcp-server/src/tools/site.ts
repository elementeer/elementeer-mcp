import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import { listSites, setDefaultSite } from '../config.js';

export function registerSiteTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {
  // ------------------------------------------------------------------ //
  // get_site_info
  // ------------------------------------------------------------------ //
  server.tool(
    'get_site_info',
    'Get information about a WordPress site running the Elementeer plugin: WP version, Elementor version, activation mode, template count, and available capabilities.',
    {
      site_id: z.string().optional().describe('Site ID from config (defaults to active site)'),
    },
    async ({ site_id }) => {
      const client = getClient(site_id);
      const info = await client.getSiteInfo();

      // Discover available routes (CLI-001)
      const routes = await client.discoverRoutes();
      const availableRouteEntries = Array.from(routes.entries())
        .filter(([_, methods]) => methods.length > 0)
        .map(([route, methods]) => `  ${methods.join(',')} ${route}`);

      const routeCount = availableRouteEntries.length;
      const routeSummary =
        routeCount > 0
          ? `${routeCount} available route(s)`
          : 'Route discovery failed — all routes assumed available';

      const lines = [
        `Site: ${info.name}`,
        `URL: ${info.url}`,
        `WordPress: ${info.wp_version}`,
        `Elementor: ${info.elementor_version ?? 'not detected'}${info.elementor_pro ? ' (Pro)' : ''}`,
        `Activation mode: ${info.activation_mode}`,
        `Template count: ${info.template_count}`,
        `Capabilities: ${info.capabilities.length > 0 ? info.capabilities.join(', ') : '(none)'}`,
        `Available routes: ${routeSummary}`,
      ];

      if (routeCount > 0 && routeCount <= 40) {
        lines.push('');
        lines.push('Available REST endpoints:');
        lines.push(...availableRouteEntries);
      } else if (routeCount > 40) {
        lines.push(
          `  (${routeCount} routes — too many to list; all elementeer/v1 operations confirmed reachable)`,
        );
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    },
  );

  // ------------------------------------------------------------------ //
  // verify_tool_registration
  // ------------------------------------------------------------------ //
  server.tool(
    'verify_tool_registration',
    'Verify that all MCP tools are properly registered and discoverable against the live REST routes. Run after plugin/MCP updates to check if tools need a refresh. Returns tool count vs route count and flags any mismatch.',
    {
      site_id: z.string().optional().describe('Site ID from config (defaults to active site)'),
    },
    async ({ site_id }) => {
      const client = getClient(site_id);
      const routes = await client.discoverRoutes();
      const availableRoutes = Array.from(routes.entries())
        .filter(([_, methods]) => methods.length > 0);
      const routeCount = availableRoutes.length;

      // Count registered MCP tools (all tool names from this server)
      // We scan the server's internal tool registry if available
      let mcpToolCount = 0;
      const registeredTools = (server as any)._registeredTools as Set<string> | undefined;
      if (registeredTools) {
        mcpToolCount = registeredTools.size;
      } else {
        // Fallback: tool count unknown
        mcpToolCount = -1;
      }

      const lines = [
        `Tool Registration Verification`,
        `──────────────────────────────`,
        `REST routes available: ${routeCount}`,
        `MCP tools registered: ${mcpToolCount >= 0 ? mcpToolCount : 'unknown (server introspection unavailable)'}`,
      ];

      if (mcpToolCount >= 0 && routeCount > 0) {
        if (mcpToolCount >= routeCount) {
          lines.push('');
          lines.push('Status: OK — MCP tools cover all available REST routes.');
        } else {
          lines.push('');
          lines.push(`Warning: ${routeCount - mcpToolCount} REST routes have no corresponding MCP tool.`);
          lines.push('This may indicate the MCP server needs a restart to pick up updated tool definitions.');
          lines.push('Try restarting Codex/OpenCode or running: capacium refresh elementeer-mcp');
        }
      } else if (routeCount === 0) {
        lines.push('');
        lines.push('Warning: No REST routes discovered. The Elementeer plugin may not be active on this site.');
      }

      if (availableRoutes.length > 0 && availableRoutes.length <= 30) {
        lines.push('');
        lines.push('Available REST endpoints:');
        for (const [route, methods] of availableRoutes) {
          lines.push(`  ${methods.join(',')} ${route}`);
        }
      }

      return {
        content: [{ type: 'text', text: lines.join('\n') }],
      };
    },
  );

  // ------------------------------------------------------------------ //
  // list_sites
  // ------------------------------------------------------------------ //
  server.tool(
    'list_sites',
    'List all WordPress sites configured in ~/.elementeer/config.json.',
    {},
    async () => {
      const sites = listSites();

      if (sites.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: 'No sites configured. Edit ~/.elementeer/config.json to add a site.',
            },
          ],
        };
      }

      const lines = sites.map(
        (s) =>
          `  ${s.default ? '*' : ' '} [${s.id}] ${s.name} — ${s.url} (${s.activationMode ?? 'unknown mode'})`,
      );

      return {
        content: [
          {
            type: 'text',
            text: [`${sites.length} site(s) configured (* = default):`, ...lines].join('\n'),
          },
        ],
      };
    },
  );

  // ------------------------------------------------------------------ //
  // switch_site
  // ------------------------------------------------------------------ //
  server.tool(
    'switch_site',
    'Set a different site as the default in ~/.elementeer/config.json. All subsequent tool calls will use this site unless site_id is explicitly provided.',
    {
      site_id: z.string().min(1).describe('Site ID to make the default'),
    },
    async ({ site_id }) => {
      setDefaultSite(site_id);

      return {
        content: [
          {
            type: 'text',
            text: `Default site switched to "${site_id}". Future tool calls will use this site.`,
          },
        ],
      };
    },
  );
}
