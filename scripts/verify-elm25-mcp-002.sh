#!/usr/bin/env bash
set -eo pipefail

export PATH="/opt/homebrew/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
VALIDATOR="/Users/andrelange/Documents/repositories/forgejo/elementeer/.worktrees/elementeer-specs/elm25-contract-review/scripts/validate-fixtures.mjs"

RED_FIXTURE=0
for arg in "$@"; do
  case "$arg" in
    --red-fixture)
      RED_FIXTURE=1
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

cd "$REPO_ROOT"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if [ "$RED_FIXTURE" -eq 1 ]; then
  echo "[ELM25-MCP-002] Running --red-fixture (duplicate elementIds + incompatible nav-menu / tp_* controls)..."
  npm --prefix mcp-server run build >/dev/null

  RED_MANIFEST_JSON="$TMP_DIR/red-duplicate-element-id.json"
  cat >"$RED_MANIFEST_JSON" <<'JSON'
{
  "schemaVersion": "elementeer-composition-manifest/v1",
  "pageId": 902,
  "pageContentHash": "red-duplicate-hash",
  "kitId": 6,
  "components": [
    {
      "componentKey": "red/header",
      "templateId": 9001,
      "templateTitle": "SECTION_RED_Header_v1",
      "componentVersion": "1.0.0",
      "structureHash": "sha256:red-header",
      "slotOrder": 0,
      "elementIds": ["sec_a", "dup_el_1"],
      "tokenDependencies": { "colors": ["primary"], "typography": ["h1"] },
      "upsertAction": "created"
    },
    {
      "componentKey": "red/hero",
      "templateId": 9002,
      "templateTitle": "SECTION_RED_Hero_v1",
      "componentVersion": "1.0.0",
      "structureHash": "sha256:red-hero",
      "slotOrder": 1,
      "elementIds": ["sec_b", "dup_el_1"],
      "tokenDependencies": { "colors": ["surface"], "typography": ["text"] },
      "upsertAction": "created"
    }
  ],
  "slots": [
    { "slotKey": "slot-0-header", "order": 0, "componentKey": "red/header", "templateId": 9001, "rootElementId": "sec_a" },
    { "slotKey": "slot-1-hero", "order": 1, "componentKey": "red/hero", "templateId": 9002, "rootElementId": "sec_b" }
  ],
  "elementIds": ["sec_a", "dup_el_1", "sec_b", "dup_el_1"],
  "tokenDependencies": { "colors": ["primary", "surface"], "typography": ["h1", "text"] },
  "idempotency": {
    "strategy": "upsert-by-component-key",
    "dedupeKey": "red-dup-902",
    "duplicateTemplatesPrevented": true,
    "duplicateElementIdsPrevented": true,
    "allowDuplicateTemplateTitles": false
  }
}
JSON

  set +e
  VAL_OUT="$(node "$VALIDATOR" --file "$RED_MANIFEST_JSON" 2>&1)"
  VAL_STATUS=$?
  set -e
  echo "Contract validator output: $VAL_OUT"
  if [ "$VAL_STATUS" -eq 0 ]; then
    echo "FAIL: Contract validator unexpectedly accepted duplicate elementIds manifest" >&2
    exit 0
  fi

  set +e
  node --input-type=module <<'EOF'
import { composeLibraryPage, LibraryComponentRegistry } from './mcp-server/dist/library-composer.js';
import { assertWidgetControlsValid } from './mcp-server/dist/widget-control-validator.js';

const mockClient = {
  async listTemplates() { return { templates: [], total: 0, total_pages: 1 }; },
  async getTemplateData(id) { return { id, elementor_data: [] }; },
  async createTemplate(p) { return { id: 9100, title: p.title, type: p.type, status: p.status ?? 'publish' }; },
  async updateTemplate() { return {}; },
  async updateTemplateData(id) { return { id, updated: true }; },
};

let dupRejected = false;
try {
  await composeLibraryPage(
    mockClient,
    {
      pageId: 902,
      writeToPage: false,
      components: [
        {
          componentKey: 'red/a',
          componentVersion: '1.0.0',
          templateTitle: 'RED_A',
          elements: [{ id: 'dup_el_1', elType: 'container', settings: {}, elements: [{ id: 'w1', elType: 'widget', widgetType: 'heading', settings: { title: 'A' }, elements: [] }] }],
        },
        {
          componentKey: 'red/b',
          componentVersion: '1.0.0',
          templateTitle: 'RED_B',
          elements: [{ id: 'dup_el_1', elType: 'container', settings: {}, elements: [{ id: 'w2', elType: 'widget', widgetType: 'heading', settings: { title: 'B' }, elements: [] }] }],
        },
      ],
    },
    new LibraryComponentRegistry(),
  );
} catch (err) {
  if (err.code === 'DUPLICATE_ELEMENT_ID') {
    dupRejected = true;
    console.error(`RED_CONTROL_TRIGGERED: ${err.code} — ${err.message}`);
  }
}

let navRejected = false;
try {
  assertWidgetControlsValid(
    [{ id: 'w_nav_red', elType: 'widget', widgetType: 'nav-menu', settings: { layout: 'horizontal', indicator: 'chevron' }, elements: [] }],
    { elementorProVersion: '3.24.0' },
  );
} catch (err) {
  if (err.code === 'INCOMPATIBLE_WIDGET_CONTROL') {
    navRejected = true;
    console.error(`RED_CONTROL_TRIGGERED: ${err.code} — ${err.message}`);
  }
}

let tpRejected = false;
try {
  assertWidgetControlsValid(
    [{ id: 'w_tp_red', elType: 'widget', widgetType: 'tp_navigation_menu', settings: { menu_direction: 'horizontal', mega_menu_support: 'yes' }, elements: [] }],
    { thePlusVersion: '4.9.0' },
  );
} catch (err) {
  if (err.code === 'INCOMPATIBLE_WIDGET_CONTROL') {
    tpRejected = true;
    console.error(`RED_CONTROL_TRIGGERED: ${err.code} — ${err.message}`);
  }
}

if (dupRejected && navRejected && tpRejected) {
  process.exit(1);
}
console.error(`ERROR: Red fixture check failed to reject all controls (dup=${dupRejected}, nav=${navRejected}, tp=${tpRejected})`);
process.exit(0);
EOF
  GATE_STATUS=$?
  set -e

  if [ "$GATE_STATUS" -eq 0 ]; then
    echo "FAIL: --red-fixture expected non-zero exit" >&2
    exit 0
  fi
  exit "$GATE_STATUS"
fi

echo "[ELM25-MCP-002] 1/4 Running typecheck..."
npm --prefix mcp-server run typecheck

echo "[ELM25-MCP-002] 2/4 Running Vitest suite..."
npm --prefix mcp-server test

echo "[ELM25-MCP-002] 3/4 Building mcp-server and emitting positive CompositionManifest JSON..."
npm --prefix mcp-server run build

TMP_JSON="$TMP_DIR/composition-manifest.json"
node --input-type=module - "$TMP_JSON" <<'EOF'
import { writeFileSync } from 'node:fs';
import {
  applyGranularPatch,
  composeLibraryPage,
  LibraryComponentRegistry,
} from './mcp-server/dist/library-composer.js';
import { roundtripResponsiveControls } from './mcp-server/dist/responsive-controls.js';

const manifestPath = process.argv[2];

let nextTplId = 500;
const templates = new Map();
const pages = new Map();

const client = {
  async listTemplates() {
    return { templates: [...templates.values()], total: templates.size, total_pages: 1 };
  },
  async getTemplateData(id) {
    return { id, elementor_data: templates.get(id)?.data ?? [] };
  },
  async createTemplate(p) {
    const id = nextTplId++;
    templates.set(id, { id, title: p.title, type: p.type, status: p.status ?? 'publish', tags: p.tags ?? [], data: [] });
    return { id, title: p.title, type: p.type, status: p.status ?? 'publish' };
  },
  async updateTemplate(id, updates) {
    const tpl = templates.get(id);
    if (tpl && updates.tags) tpl.tags = updates.tags;
    return tpl ?? {};
  },
  async updateTemplateData(id, data) {
    const tpl = templates.get(id);
    if (tpl) tpl.data = data;
    return { id, updated: true };
  },
  async updatePageData(id, data) {
    pages.set(id, data);
    return { id, updated: true };
  },
  async patchWidget(id) {
    return { post_id: id, widget_id: 'w', path: 'elements', updated: true, new_hash: 'patched' };
  },
};

const { elementorSettings } = roundtripResponsiveControls(
  {
    typography: {
      fontSize: { desktop: { unit: 'px', size: 44 }, tablet: { unit: 'px', size: 34 }, mobile: { unit: 'px', size: 26 } },
    },
    spacing: {
      gap: { desktop: { unit: 'px', size: 24 }, mobile: { unit: 'px', size: 16 } },
    },
  },
  {
    target: 'container',
    globals: { background_color: 'globals/colors?id=surface' },
  },
);

const registry = new LibraryComponentRegistry();
const components = [
  {
    componentKey: 'verify/header',
    componentVersion: '1.0.0',
    templateTitle: 'SECTION_VERIFY_Header_v1',
    elements: [
      {
        id: 'sec_v_header',
        elType: 'container',
        settings: elementorSettings.settings,
        elements: [
          {
            id: 'w_v_nav',
            elType: 'widget',
            widgetType: 'nav-menu',
            settings: {
              layout: 'horizontal',
              align_items: 'right',
              submenu_icon: { value: 'fas fa-chevron-down', library: 'fa-solid' },
              __globals__: { color_menu_item: 'globals/colors?id=primary' },
            },
            elements: [],
          },
        ],
      },
    ],
  },
  {
    componentKey: 'verify/hero',
    componentVersion: '1.0.0',
    templateTitle: 'SECTION_VERIFY_Hero_v1',
    elements: [
      {
        id: 'sec_v_hero',
        elType: 'container',
        settings: {},
        elements: [
          {
            id: 'w_v_heading',
            elType: 'widget',
            widgetType: 'tp_heading_title',
            settings: {
              heading_style: 'style_1',
              title: 'Verified Native Composition',
              alignment: 'center',
              __globals__: {
                title_color: 'globals/colors?id=text',
                title_typography_typography: 'globals/typography?id=h1',
              },
            },
            elements: [],
          },
          {
            id: 'w_v_btn',
            elType: 'widget',
            widgetType: 'tp_button',
            settings: {
              button_style: 'style-1',
              button_text: 'Learn More',
              button_link: { url: 'https://example.com' },
            },
            elements: [],
          },
        ],
      },
    ],
  },
];

const first = await composeLibraryPage(
  client,
  { pageId: 701, kitId: 6, dedupeKey: 'verify-701-v1', components },
  registry,
);

// Repeated composition reuses existing templateIds
const second = await composeLibraryPage(
  client,
  { pageId: 701, kitId: 6, dedupeKey: 'verify-701-v1', components },
  registry,
);

if (second.manifest.components.some((c) => c.upsertAction !== 'reused')) {
  console.error('Expected repeated composition to reuse all components');
  process.exit(1);
}

// Prove 3 sequential granular patches preserve elementIds and update pageContentHash
const p1 = await applyGranularPatch({
  pageId: 701,
  elements: second.composedElements,
  manifest: second.manifest,
  patch: { targetElementId: 'w_v_heading', settingsPatch: { title: 'Step 1' }, expectedPageContentHash: second.pageContentHash },
  client,
});
const p2 = await applyGranularPatch({
  pageId: 701,
  elements: p1.elements,
  manifest: p1.manifest,
  patch: { targetElementId: 'w_v_btn', settingsPatch: { button_text: 'Step 2' }, expectedPageContentHash: p1.pageContentHash },
  client,
});
const p3 = await applyGranularPatch({
  pageId: 701,
  elements: p2.elements,
  manifest: p2.manifest,
  patch: { targetElementId: 'w_v_nav', settingsPatch: { align_items_mobile: 'center' }, expectedPageContentHash: p2.pageContentHash },
  client,
});

writeFileSync(manifestPath, JSON.stringify(p3.manifest, null, 2), 'utf8');
EOF

echo "[ELM25-MCP-002] 4/4 Validating emitted CompositionManifest against elementeer-specs..."
node "$VALIDATOR" --file "$TMP_JSON"

echo "[ELM25-MCP-002] VERIFY PASS"
