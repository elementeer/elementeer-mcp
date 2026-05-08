import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getClient, getActiveSite } from './config.js';
import { registerAllTools } from './tools/index.js';

const server = new McpServer({
  name: 'elementeer-mcp',
  version: '0.1.0',
});

let activationMode: string | undefined;

try {
  const activeSite = getActiveSite();
  activationMode = activeSite.activationMode;
} catch {
  // Config not yet set up — register all tools so the user can use
  // site-management tools to configure their first site.
  process.stderr.write('No config found — registering all tools for initial setup.\n');
}

const isFreeOnly = activationMode === 'standalone-free';

registerAllTools(server, getClient, {
  includeAdvanced: !isFreeOnly,
  includeStudioFuture: !isFreeOnly,
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP stdio protocol
  process.stderr.write('Elementeer MCP server started.\n');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal error: ${message}\n`);
  process.exit(1);
});
