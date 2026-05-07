# Elementeer WordPress Plugin

AI-native REST API for Elementor template management. Connect Claude, Cursor, and other MCP clients directly to your Elementor library.

## Quick Install

1. Download the latest release ZIP from the [releases page](../../releases).
2. Upload via WordPress admin: **Plugins → Add New → Upload Plugin**.
3. Activate **Elementeer MCP Plugin**.
4. Go to **Settings → Elementeer MCP** to generate your first API key.
5. Install the MCP server: `npm install -g @elementeer/mcp`

## Requirements

- WordPress 6.0+
- PHP 8.0+
- Elementor (Free or Pro)

## Features

- Full CRUD for `elementor_library` templates — no 401 errors
- Capability-scoped API keys with fine-grained permissions
- Governance controls (L0-L3) for safe AI agent operation
- REST API at `/wp-json/elementeer/v1/`
- Admin UI for key generation and revocation
- Multi-site support (one MCP server, multiple WordPress sites)

## Free vs Advanced

This plugin powers the **Free** tier of the Elementeer platform. The **Advanced** tier adds Theme Builder workflows, AI image generation, WooCommerce management, governance queues, and more.

Free includes: site assessment, library management, brand setup, content CRUD, wizard workflows, and addon ecosystem detection.

See [TIERS.md](../../TIERS.md) for the full comparison.

## MCP Server

The companion Node.js MCP server is available at [elementeer/elementeer-mcp](../../../elementeer-mcp).

## License

GPL-2.0-or-later