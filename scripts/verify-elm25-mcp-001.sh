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
  echo "[ELM25-MCP-001] Running --red-fixture (IMPL-K3 negative control)..."
  npm --prefix mcp-server run build >/dev/null
  RED_SPEC_JSON="$TMP_DIR/red-native-delivery.json"

  set +e
  node --input-type=module - "$RED_SPEC_JSON" <<'EOF'
import { writeFileSync } from 'node:fs';
import {
  assertNativeWriteAllowed,
  evaluateNativeDeliveryAndEditability,
} from './mcp-server/dist/editability-gate.js';

const redSpecPath = process.argv[2];
const monolithElements = [
  {
    id: 'sec_red_monolith',
    elType: 'container',
    settings: {},
    elements: [
      {
        id: 'w_red_html',
        elType: 'widget',
        widgetType: 'html',
        settings: {
          html: '<!DOCTYPE html><html><body><main><h1>Monolithic HTML Page</h1></main></body></html>',
        },
        elements: [],
      },
    ],
  },
];

const bundle = evaluateNativeDeliveryAndEditability({
  pageId: 999,
  elements: monolithElements,
  mode: 'native-elementor',
  environment: 'production',
  defaultFallbackOwner: 'red-control',
  defaultFallbackReason: 'Negative control full-page HTML monolith',
});
writeFileSync(redSpecPath, JSON.stringify(bundle.spec, null, 2), 'utf8');

try {
  assertNativeWriteAllowed({
    pageId: 999,
    elements: monolithElements,
    mode: 'native-elementor',
    environment: 'production',
  });
  console.error('ERROR: Monolith write was unexpectedly allowed!');
  process.exit(0);
} catch (err) {
  console.error(`RED_CONTROL_TRIGGERED: ${err.code} — ${err.message}`);
  process.exit(1);
}
EOF
  GATE_STATUS=$?
  set -e

  if [ "$GATE_STATUS" -eq 0 ]; then
    echo "FAIL: --red-fixture expected non-zero exit from assertNativeWriteAllowed" >&2
    exit 2
  fi

  # Also confirm the contract validator rejects the red fixture with FULL_PAGE_HTML_MONOLITH_FORBIDDEN
  set +e
  VAL_OUT="$(node "$VALIDATOR" --file "$RED_SPEC_JSON")"
  VAL_STATUS=$?
  set -e
  echo "Contract validator output: $VAL_OUT"
  if [ "$VAL_STATUS" -eq 0 ]; then
    echo "FAIL: Contract validator unexpectedly accepted red monolith fixture" >&2
    exit 2
  fi
  exit "$GATE_STATUS"
fi

echo "[ELM25-MCP-001] 1/4 Running typecheck..."
npm --prefix mcp-server run typecheck

echo "[ELM25-MCP-001] 2/4 Running Vitest suite..."
npm --prefix mcp-server test

echo "[ELM25-MCP-001] 3/4 Building mcp-server and emitting positive contract fixtures..."
npm --prefix mcp-server run build

REPORT_JSON="$TMP_DIR/editability-report.json"
SPEC_JSON="$TMP_DIR/native-delivery-spec.json"

node --input-type=module - "$REPORT_JSON" "$SPEC_JSON" <<'EOF'
import { writeFileSync } from 'node:fs';
import { evaluateNativeDeliveryAndEditability } from './mcp-server/dist/editability-gate.js';

const [reportPath, specPath] = process.argv.slice(2);

const elements = [
  {
    id: 'sec_hero',
    elType: 'container',
    settings: {},
    elements: [
      {
        id: 'w_heading_1',
        elType: 'widget',
        widgetType: 'heading',
        settings: {
          title: 'Elementeer Native Delivery',
          title_color: '#111827',
          __globals__: { title_color: 'globals/colors?id=primary' },
        },
        elements: [],
      },
      {
        id: 'w_text_1',
        elType: 'widget',
        widgetType: 'text-editor',
        settings: { editor: '<p>Individually editable native widgets.</p>' },
        elements: [],
      },
      {
        id: 'w_btn_1',
        elType: 'widget',
        widgetType: 'button',
        settings: { text: 'Explore' },
        elements: [],
      },
      {
        id: 'w_img_1',
        elType: 'widget',
        widgetType: 'image',
        settings: { image: { id: 12, url: 'https://example.com/img.png' } },
        elements: [],
      },
      {
        id: 'w_icon_1',
        elType: 'widget',
        widgetType: 'icon-box',
        settings: { title_text: 'Design Tokens', description_text: 'Bound to Kit' },
        elements: [],
      },
    ],
  },
];

const bundle = evaluateNativeDeliveryAndEditability({
  pageId: 101,
  elements,
  kitId: 1,
  mode: 'native-elementor',
  environment: 'production',
  responsiveControls: {
    typography: {
      fontSize: {
        desktop: { unit: 'px', size: 18 },
        tablet: { unit: 'px', size: 16 },
        mobile: { unit: 'px', size: 15 },
      },
    },
  },
  typedWidgetControls: [
    {
      widgetType: 'heading',
      controlName: 'title_color',
      controlType: 'color',
      value: '#111827',
      boundGlobalToken: 'globals/colors?id=primary',
    },
  ],
});

if (bundle.report.publishGateDecision !== 'allow') {
  console.error('Positive fixture unexpectedly blocked:', JSON.stringify(bundle.report));
  process.exit(1);
}

writeFileSync(reportPath, JSON.stringify(bundle.report, null, 2), 'utf8');
writeFileSync(specPath, JSON.stringify(bundle.spec, null, 2), 'utf8');
EOF

echo "[ELM25-MCP-001] 4/4 Validating emitted fixtures against elementeer-specs contracts..."
node "$VALIDATOR" --file "$REPORT_JSON"
node "$VALIDATOR" --file "$SPEC_JSON"

echo "[ELM25-MCP-001] VERIFY PASS"
