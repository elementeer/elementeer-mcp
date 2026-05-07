import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(repoRoot, 'mirror', 'generated', 'plugin-public');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function cleanOutputRoot() {
  fs.rmSync(outputRoot, { recursive: true, force: true });
}

function copyDir(src, dest, exclude = []) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function main() {
  cleanOutputRoot();
  ensureDir(outputRoot);

  const pluginSource = path.join(repoRoot, 'plugin');
  const pluginDest = path.join(outputRoot, 'plugin');
  const excludeDirs = ['tests', '__tests__', '.phpunit.cache', 'vendor', 'node_modules'];
  const excludeFiles = ['.phpunit.result.cache'];

  copyDir(pluginSource, pluginDest, [...excludeDirs, ...excludeFiles]);

  const composerJson = path.join(outputRoot, 'plugin', 'composer.json');
  if (fs.existsSync(composerJson)) {
    const composer = JSON.parse(fs.readFileSync(composerJson, 'utf8'));
    delete composer['require-dev'];
    delete composer['autoload-dev'];
    delete composer['scripts'];
    fs.writeFileSync(composerJson, JSON.stringify(composer, null, 2) + '\n', 'utf8');
  }

  const readme = [
    '# Elementeer WordPress Plugin',
    '',
    'AI-native REST API for Elementor template management. Connect Claude, Cursor, and other MCP clients directly to your Elementor library.',
    '',
    '## Quick Install',
    '',
    '1. Download the latest release ZIP from the [releases page](../../releases).',
    '2. Upload via WordPress admin: **Plugins → Add New → Upload Plugin**.',
    '3. Activate **Elementeer MCP Plugin**.',
    '4. Go to **Settings → Elementeer MCP** to generate your first API key.',
    '5. Install the MCP server: `npm install -g @elementeer/mcp`',
    '',
    '## Requirements',
    '',
    '- WordPress 6.0+',
    '- PHP 8.0+',
    '- Elementor (Free or Pro)',
    '',
    '## Features',
    '',
    '- Full CRUD for `elementor_library` templates — no 401 errors',
    '- Capability-scoped API keys with fine-grained permissions',
    '- Governance controls (L0-L3) for safe AI agent operation',
    '- REST API at `/wp-json/elementeer/v1/`',
    '- Admin UI for key generation and revocation',
    '- Multi-site support (one MCP server, multiple WordPress sites)',
    '',
    '## Free vs Advanced',
    '',
    'This plugin powers the **Free** tier of the Elementeer platform. The **Advanced** tier adds Theme Builder workflows, AI image generation, WooCommerce management, governance queues, and more.',
    '',
    'Free includes: site assessment, library management, brand setup, content CRUD, wizard workflows, and addon ecosystem detection.',
    '',
    'See [TIERS.md](../../TIERS.md) for the full comparison.',
    '',
    '## MCP Server',
    '',
    'The companion Node.js MCP server is available at [elementeer/elementeer-mcp](../../../elementeer-mcp).',
    '',
    '## License',
    '',
    'GPL-2.0-or-later',
  ].join('\n');

  fs.writeFileSync(path.join(outputRoot, 'plugin', 'README.md'), readme, 'utf8');

  const manifest = {
    name: 'elementeer-plugin-public-mirror',
    description: 'Generated public mirror of the Elementeer WordPress plugin.',
    sourceDirectory: 'plugin/',
    included: [
      'elementeer.php',
      'composer.json',
      'readme.txt',
      'includes/',
      'assets/',
      'languages/',
      'README.md',
    ],
    excludedBuildAssets: [
      'tests/',
      '__tests__/',
      '.phpunit.cache',
      'vendor/',
      'node_modules/',
      'composer.lock',
    ],
  };

  fs.writeFileSync(
    path.join(outputRoot, 'plugin-mirror-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8',
  );

  console.log(`Prepared plugin mirror staging artifact at ${path.relative(repoRoot, outputRoot)}`);
  console.log(`Plugin files staged for public mirror.`);
}

main();
