#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * elementeer-mcp CLI
 *
 * Usage:
 *   elementeer-mcp          — starts the MCP server (stdio transport)
 *   elementeer-mcp init     — creates ~/.elementeer/config.json with an example
 *   elementeer-mcp sites    — lists configured sites
 *   elementeer-mcp version  — prints version
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const VERSION = '1.0.0';

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'version':
  case '--version':
  case '-v':
    console.log(`elementeer-mcp v${VERSION}`);
    process.exit(0);
    break;

  case 'init': {
    const configDir = path.join(os.homedir(), '.elementeer');
    const configPath = path.join(configDir, 'config.json');

    if (fs.existsSync(configPath)) {
      console.log(`Config already exists at ${configPath}`);
      console.log('Edit it to add or update your sites.');
      process.exit(0);
    }

    const example = {
      sites: [
        {
          id: 'my-site',
          name: 'My WordPress Site',
          url: 'https://example.com',
          apiKey: 'ek_replace_with_your_api_key',
          activationMode: 'standalone-free',
          default: true,
        },
      ],
    };

    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, JSON.stringify(example, null, 2), 'utf-8');

    console.log(`Created config at ${configPath}`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Install the Elementeer Plugin on your WordPress site');
    console.log('  2. Generate an API key in Settings → Elementeer');
    console.log(`  3. Edit ${configPath} with your site URL and API key`);
    console.log('  4. Add to your MCP client config:');
    console.log('     { "mcpServers": { "elementeer": { "command": "elementeer-mcp" } } }');
    process.exit(0);
    break;
  }

  case 'sites': {
    const { listSites } = await import('./config.js');
    try {
      const sites = listSites();
      if (sites.length === 0) {
        console.log('No sites configured. Run `elementeer-mcp init` to create a config.');
      } else {
        console.log(`${sites.length} site(s):`);
        for (const s of sites) {
          console.log(`  ${s.default ? '*' : ' '} [${s.id}] ${s.name} — ${s.url}`);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Error: ${msg}`);
      process.exit(1);
    }
    process.exit(0);
    break;
  }

  case undefined:
  case 'start': {
    await import('./index.js');
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Usage: elementeer-mcp [init|sites|version]');
    process.exit(1);
}
