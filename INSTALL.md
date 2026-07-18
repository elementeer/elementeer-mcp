# Elementeer Install

## Quick Install

### 1. Install the WordPress plugin

Download and install from [elementeer/elementeer](https://git.langevc.com/elementeer/elementeer):
1. Download the latest release ZIP
2. Upload via WordPress admin → **Plugins → Add New → Upload Plugin**
3. Activate **Elementeer MCP Plugin**
4. Go to **Settings → Elementeer MCP** → generate your first API key

### 2. Install the MCP server

```bash
npm install -g @elementeer/mcp
elementeer-mcp init   # creates ~/.elementeer/config.json
```

Edit `~/.elementeer/config.json` with your site URL and API key.

### 3. Add to your MCP client

```json
{
  "mcpServers": {
    "elementeer": { "command": "elementeer-mcp" }
  }
}
```

## Local Development

```bash
npm install
npm run build

# Run tests
npm run test --workspace=mcp-server
npm run test --workspace=shared

# Watch mode
npm run test:watch --workspace=mcp-server
```

## Build Modes

### Standard build
```bash
npm run build
```

### Free mirror gate
```bash
npm run release:free-mirror:gate
```

Runs: build → Free contract tests → mirror verification → staging preparation → release verification.

## Canonical References

- [Public quickstart](docs/quickstart/free.md)
- [Free product surface](docs/blueprints/free-product-surface.md)
- [Free mirror export rules](docs/architecture/free-mirror-export.md)
- [Forgejo to GitHub mirror runbook](docs/release/forgejo-github-free-mirror-runbook.md)
