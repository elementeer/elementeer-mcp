# Phase 5 Foundation – WooCommerce, Forms, Performance

## Overview

Phase 5 extends Elementeer MCP with three key domains:

1. **WooCommerce** – manage products, orders, store settings.
2. **Form Management** – integrate with popular WordPress form plugins.
3. **Performance Deep‑Dive** – advanced optimization beyond basic cache flushing.

## 1. WooCommerce Integration

### MCP Tools to Build

- `list_products` – paginated product listing with filters (status, category, stock).
- `get_product` – retrieve full product data including variations, meta, images.
- `create_product` – create simple/variable product with taxonomy terms.
- `update_product` – modify price, stock, description, etc.
- `delete_product` – move to trash or permanently delete.
- `list_orders` – browse orders with status filter.
- `get_order` – order details, line items, customer data.
- `update_order_status` – change status (processing, completed, cancelled).
- `list_product_categories` – WooCommerce product categories (hierarchical).
- `manage_product_category` – create/update/delete categories.
- `get_store_settings` – read WooCommerce settings (currency, dimensions, tax).
- `update_store_settings` – modify store‑level configuration.
- `setup_woocommerce_pages` – ensure shop, cart, checkout, my‑account pages exist (Elementor ready).

### Implementation Notes

- Use WooCommerce REST API (WP‑HTTP) directly; avoid loading WooCommerce PHP classes if possible.
- Respect WooCommerce capabilities (e.g., `manage_woocommerce`, `edit_products`).
- Handle product variations as separate child posts.
- Support both simple and JSON‑based product creation (mimic WooCommerce UI).

### Dependencies

- WooCommerce plugin active.
- Elementeer plugin capability `woocommerce-operations:read` / `:write`.

## 2. Form Management

### Supported Plugins

- **Gravity Forms** (premium)
- **Contact Form 7** (free)
- **WPForms** (freemium)
- **Ninja Forms**

### MCP Tools

- `list_forms` – enumerate forms across active form plugins.
- `get_form` – form structure: fields, notifications, conditional logic.
- `create_form` – create a new form (basic field set).
- `update_form` – modify form fields or settings.
- `delete_form` – remove form.
- `list_form_entries` – retrieve submissions (paginated).
- `get_form_entry` – single submission data.
- `export_form_entries` – CSV export of submissions.

### Implementation Strategy

- Detect active form plugin via `is_plugin_active()`.
- Use plugin‑specific API (Gravity Forms has robust API, CF7 uses custom posts).
- Fallback: if no supported plugin active, return informative error.

### Capabilities

- `forms-operations:read` – view forms and entries.
- `forms-operations:write` – create/update/delete forms.

## 3. Performance Deep‑Dive

### Beyond `flush_elementor_cache`

- **Critical CSS Generation** – analyze page HTML, extract above‑the‑fold styles, inline them.
- **Lazy‑Loading Enforcement** – ensure images, iframes, widgets use `loading="lazy"`.
- **Asset Concatenation** – combine Elementor CSS/JS files (requires filesystem write).
- **Redis Object‑Cache Support** – enable Redis via `wp‑redis` plugin, verify connectivity.
- **CDN Purge** – integrate with Cloudflare, BunnyCDN, StackPath (via their APIs).
- **Browser Caching Headers** – write `.htaccess`/`nginx.conf` rules for static assets.

### MCP Tools

- `generate_critical_css` – for a given page or site‑wide.
- `audit_asset_loading` – report render‑blocking resources.
- `enable_redis_cache` – install & configure Redis object cache.
- `purge_cdn_cache` – flush CDN (requires API key).
- `optimize_htaccess` – insert performance rules.

### Risks

- File‑system modifications can break sites if done incorrectly.
- CDN purges may incur cost or rate limits.
- Critical CSS generation is computationally heavy; best run offline.

## Phase 5 Milestones

### Milestone 1: WooCommerce Core (2–3 weeks)
- Implement product CRUD, order listing, store settings.
- Test with live WooCommerce store.

### Milestone 2: Form Plugin Integration (2 weeks)
- Support Gravity Forms and Contact Form 7 first.
- Add entry listing and export.

### Milestone 3: Performance Automation (2–3 weeks)
- Critical CSS generator (using `penthouse` or `critical` npm).
- CDN purge integration (Cloudflare first).
- Redis setup wizard.

### Milestone 4: Testing & Documentation (1 week)
- End‑to‑end tests with WooCommerce + Forms.
- Update ROADMAP and create user guides.

## Technical Debt Consideration

Phase 5 increases plugin footprint. Ensure:

- Code is modular (separate classes for WooCommerce, Forms, Performance).
- Capabilities are granular (`woocommerce‑operations:read`, `forms‑operations:write`).
- Error handling robust (plugin missing, API key missing).
- All new tools are added to `assess_site` and `get_recommendations` logic.

## Next Immediate Steps

1. **Research WooCommerce REST API** – confirm endpoints available without frontend UI.
2. **Create WooCommerce prototype** – implement `list_products` and `get_product`.
3. **Test with live WooCommerce site** – use existing test site (`fusionaize‑preview`).
4. **Design form plugin abstraction** – decide on common data structure across plugins.

## References

- WooCommerce REST API docs: https://woocommerce.github.io/woocommerce-rest-api-docs/
- Gravity Forms API: https://docs.gravityforms.com/rest-api/
- Contact Form 7 post type: `wpcf7_contact_form`
- Cloudflare API: https://api.cloudflare.com/
- Critical CSS generation: https://github.com/addyosmani/critical