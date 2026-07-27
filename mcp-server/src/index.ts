import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { getClient, getActiveSite } from './config.js';
import { registerAllTools } from './tools/index.js';
import { ProviderLoader } from './providers/loader.js';
import {
  getProviderRegistry,
  setProviderRegistry,
  buildCoreProviderRegistration,
  getCapabilitiesSummary,
} from './capability-registry.js';

const server = new McpServer({
  name: 'elementeer-mcp',
  version: '0.1.0',
});

let activationMode: string | undefined;

try {
  const activeSite = getActiveSite();
  activationMode = activeSite.activationMode;
} catch {
  process.stderr.write('No config found — registering all tools for initial setup.\n');
}

const isFreeOnly = activationMode === 'standalone-free';

registerAllTools(server, getClient, {
  includeAdvanced: !isFreeOnly,
  includeStudioFuture: !isFreeOnly,
});

async function initializeProviders(): Promise<void> {
  const registry = getProviderRegistry();
  setProviderRegistry(registry);

  const loader = new ProviderLoader(registry);
  const coreProvider = buildCoreProviderRegistration();

  const { loaded, failed } = await loader.loadProviders([coreProvider]);

  if (failed.length > 0) {
    process.stderr.write(
      `[Elem] WARNING: Core provider initialization partially failed. Failed: ${failed.join(', ')}. Server may be degraded.\n`,
    );
  }

  process.stderr.write(
    `[Elem] Provider system initialized — ${loaded.length} providers loaded.\n`,
  );
  process.stderr.write(`[Elem] ${getCapabilitiesSummary()}\n`);
}

async function main(): Promise<void> {
  // Initialize providers first — core tools are already registered above,
  // so the server can start even if optional providers fail.
  await initializeProviders();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('Elementeer MCP server started.\n');

  try {
    const activeSite = getActiveSite();
    const client = getClient();
    await client.discoverRoutes();
    process.stderr.write(
      `[Elem] Route discovery complete for site "${activeSite.id}".\n`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(
      `[Elem] Route discovery deferred — no active config yet (${message}).\n`,
    );
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Fatal error: ${message}\n`);
  process.exit(1);
});
