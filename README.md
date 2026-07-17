[![CI](https://github.com/elementeer/elementeer-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/elementeer/elementeer-mcp/actions/workflows/ci.yml)
[![CodeQL](https://github.com/elementeer/elementeer-mcp/actions/workflows/codeql.yml/badge.svg)](https://github.com/elementeer/elementeer-mcp/actions/workflows/codeql.yml)
[![npm](https://img.shields.io/npm/v/@elementeer/mcp?color=6A35FF)](https://www.npmjs.com/package/@elementeer/mcp)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933.svg?logo=node.js)](./mcp-server/package.json)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4%2B-3178c6.svg?logo=typescript)](./mcp-server/package.json)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](./LICENSE)
[![MCP compatible](https://img.shields.io/badge/MCP-compatible-7c3aed.svg)](https://modelcontextprotocol.io)

# Elementeer MCP

**The Model Context Protocol server connecting AI agents to Elementeer-powered WordPress sites.**

A Node.js MCP server with **128+ tools in the Free tier**, **250+ tools total**, **65 fine-grained capabilities**, and **L0–L3 governance** for safe AI-agent operation. Handles template composition, site assessment, brand setup, creator workflows, theme building, navigation, media, SEO, performance, translation, accessibility, LMS, charity, booking, e-commerce, and addon ecosystem management — all through a single protocol surface.

> **Companion plugin:** [elementeer/elementeer](https://github.com/elementeer/elementeer) — exposes `/wp-json/elementeer/v1/` on your WordPress site.

---

## Quick Start

### 1. Install the WordPress plugin

Download from [elementeer/elementeer](https://github.com/elementeer/elementeer) → Upload → Activate → Settings → Elementeer MCP → Generate Key.

### 2. Install the MCP server

```bash
npm install -g @elementeer/mcp
elementeer-mcp init   # creates ~/.elementeer/config.json
```

### 3. Configure your sites

Edit `~/.elementeer/config.json`:

```json
{
  "sites": [
    {
      "id": "my-site",
      "name": "My WordPress Site",
      "url": "https://yoursite.com",
      "apiKey": "ek_your_key_here",
      "default": true
    }
  ]
}
```

### 4. Add to your MCP client

```json
{
  "mcpServers": {
    "elementeer": {
      "command": "elementeer-mcp"
    }
  }
}
```

### From Capacium

```bash
cap install elementeer-mcp
```

---

## Tools

### Template Library

| Tool | Capability |
|------|-----------|
| `list_templates` | `library-operations:read` |
| `get_template` | `library-operations:read` |
| `create_template` | `library-operations:write` |
| `update_template` | `library-operations:write` |
| `rename_template` | `library-operations:write` |
| `duplicate_template` | `library-operations:write` |
| `delete_template` | `library-operations:write` |
| `bulk_rename` | `library-operations:write` |
| `get_template_data` | `library-operations:read` |
| `update_template_data` | `library-operations:write` |
| `extract_sections` | `library-operations:read` |
| `list_by_type` | `library-operations:read` |
| `set_category` | `library-operations:write` |
| `set_tags` | `library-operations:write` |
| `audit_library` | `library-operations:read` |

### Site Intelligence

| Tool | Capability |
|------|-----------|
| `assess_site` | `site-audit:read` |
| `get_recommendations` | `site-audit:read` |
| `get_site_info` | `site-audit:read` |
| `get_performance_report` | `performance-operations:read` |
| `flush_elementor_cache` | `performance-operations:write` |

### Brand & Design

| Tool | Capability |
|------|-----------|
| `wizard_brand_setup` | `design-system:write` |
| `get_site_settings` | `site-settings:read` |
| `update_site_settings` | `site-settings:write` |

### Content

| Tool | Capability |
|------|-----------|
| `creator_mode` | `content-structure:write` |
| `wizard_theme_builder` | `theme-structure:write` |
| `create_page` / `create_post` | `content-operations:write` |
| `update_post_meta` | `content-operations:write` |
| `delete_post` | `content-operations:write` |
| `list_taxonomies` | `content-operations:read` |
| `create_term` / `update_term` / `delete_term` | `content-operations:write` |
| `list_post_types` | `content-operations:read` |

### Navigation

| Tool | Capability |
|------|-----------|
| `list_menus` / `create_menu` / `delete_menu` | `theme-structure:read\|write` |
| `list_menu_items` / `create_menu_item` | `theme-structure:read\|write` |
| `update_menu_item` / `delete_menu_item` | `theme-structure:write` |
| `list_menu_locations` / `assign_menu_location` | `theme-structure:read\|write` |

### Media

| Tool | Capability |
|------|-----------|
| `list_media` / `get_media` | `media-operations:read` |
| `update_media` / `delete_media` | `media-operations:write` |
| `audit_unused_media` | `media-operations:read` |
| `search_stock_images` | `media-operations:read` |
| `sideload_stock_image` | `media-operations:write` |
| `generate_ai_image` | `media-operations:write` |

### SEO

| Tool | Capability |
|------|-----------|
| `get_seo_meta` | `seo-operations:read` |
| `update_seo_meta` | `seo-operations:write` |

### Governance

| Tool | Capability |
|------|-----------|
| `queue_change` | `governance:write` |
| `list_change_queue` | `governance:read` |
| `review_change` | `governance:review` |
| `apply_change` | `governance:apply` |

### Integration Families

All adapters auto-detect their respective plugins. Tools for WooCommerce, Voxel, Amelia booking, LearnDash/Tutor LMS, GiveWP/Charitable, accessibility (Ally), translation (WPML/Polylang), and addon ecosystem analytics — each with domain-appropriate read/write operations, widget inventories, usage tracking, and overlap detection.

---

## Governance Levels

Elementeer enforces a four-tier governance model for safe AI operation:

| Level | Description | Behavior |
|-------|-------------|----------|
| **L0** | Read-only inspection | No consent needed — list, get, assess |
| **L1** | Safe writes | Auto-executed — create, update metadata |
| **L2** | Impactful writes | Auto-queued for human review — layout changes, brand setup |
| **L3** | High-risk operations | Block until explicit consent provided — deletions, plugin conflict tests |

L2 tools call `queue_change` automatically. L3 tools require `consent: true` in the request. This gives AI agents the freedom to propose meaningful changes while keeping site owners in control.

---

## Permission Architecture

**Layer 1 — API Key Capabilities.** Each key carries an explicit list of domain capabilities. A read-only key returns `elementeer_insufficient_scope` — not `elementeer_invalid_key` — on any write attempt, so the agent can guide the user precisely.

**Layer 2 — Governance Settings.** Site administrators configure `allowed_capabilities` in the WordPress admin. Even if a key has a capability, if governance blocks it, the server returns `elementeer_governance_blocked`. Site owners lock down entire domains without revoking keys.

The MCP server maps these error codes to typed `ElementeerErrorCode` values so AI clients receive actionable error information.

---

## Product Tiers

| | Free | Advanced |
|---|---|---|
| **Tools** | 128+ | 250+ |
| **Sites** | Unlimited | Unlimited |
| **Template CRUD** | ✓ | ✓ |
| **Site Assessment & Recommendations** | ✓ | ✓ |
| **Brand Setup Wizard** | ✓ | ✓ |
| **Creator Light** | ✓ | ✓ |
| **Navigation & Content CRUD** | ✓ | ✓ |
| **Media Library** | ✓ | ✓ |
| **SEO Meta** | ✓ | ✓ |
| **Performance Basics** | ✓ | ✓ |
| **Addon Detection (11 adapters)** | ✓ | ✓ |
| **Wizard Workflows (5 families)** | ✓ | ✓ |
| **WooCommerce** | — | ✓ |
| **Amelia Booking** | — | ✓ |
| **AI Batch Translation** | — | ✓ |
| **Snapshots & Versioning** | — | ✓ |
| **Design Token Extraction** | — | ✓ |
| **Change Review Queue** | — | ✓ |
| **Performance Deep-Dive** | — | ✓ |
| **Studio Orchestration** | — | 🔮 (Future) |

---

## Architecture

```
elementeer-mcp/
├── mcp-server/                 # TypeScript MCP server
│   ├── src/
│   │   ├── index.ts           # Server entry point & tool registration
│   │   ├── client.ts          # Axios HTTP client for WordPress API
│   │   ├── config.ts          # ~/.elementeer/config.json management
│   │   └── tools/             # 128+ tool implementations
│   ├── dist/                  # Compiled output (npm entry: dist/index.js)
│   └── package.json           # @elementeer/mcp v2.1.4
│
├── shared/                    # Shared TypeScript types & validation
│   ├── src/
│   └── package.json           # @elementeer/shared
│
├── mirror/                    # Free mirror staging & sync scripts
│
├── capability.yaml            # MCP capability manifest (65 capabilities)
├── TIERS.md                   # Tier comparison & pricing logic
├── CHANGELOG.md
├── ROADMAP.md
└── packages/                  # npm workspace root
```

**Tech stack:** TypeScript 5.4+ (strict mode), Zod validation, Axios HTTP client, Vitest test runner, npm workspaces.

---

## Agent Setup

Elementeer MCP works with any MCP-compatible client.

### Claude Desktop

```json
{
  "mcpServers": {
    "elementeer": { "command": "elementeer-mcp" }
  }
}
```

### Cursor

```json
{
  "mcpServers": {
    "elementeer": { "command": "elementeer-mcp" }
  }
}
```

### OpenCode

```sh
opencode mcp add elementeer -- elementeer-mcp
```

### Antigravity / Codex

As configured in their respective `mcpServers` settings — use `elementeer-mcp` as the command and add site configuration in `~/.elementeer/config.json`.

### Capacium

```bash
cap install elementeer-mcp
```

---

## Development

```bash
npm install
npm run build
npm run test --workspace=mcp-server
npm run test:coverage --workspace=mcp-server
npm run test:watch --workspace=mcp-server
npm run test --workspace=shared
```

### Contributing

1. Fork and clone
2. Create a branch: `git checkout -b feat/your-feature`
3. Make changes with tests
4. Run `npm test`
5. Open a pull request using the template

---

## Links

- **Documentation:** [docs.elementeer.xyz](https://docs.elementeer.xyz)
- **WordPress Plugin:** [github.com/elementeer/elementeer](https://github.com/elementeer/elementeer)
- **Conversion Bridge:** [github.com/elementeer/elementeer-bridge](https://github.com/elementeer/elementeer-bridge)
- **Pro Addon:** [github.com/elementeer/elementeer-pro](https://github.com/elementeer/elementeer-pro) (private)

---

## License

**MCP Server:** [Apache-2.0](./LICENSE)

**Bundled Plugin (Free):** GPL-2.0-or-later — see [elementeer/elementeer](https://github.com/elementeer/elementeer).

**Pro Addon:** Proprietary — see [elementeer/elementeer-pro](https://github.com/elementeer/elementeer-pro) (private).
