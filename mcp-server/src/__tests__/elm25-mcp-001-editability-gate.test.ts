import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient, GlobalStylesData, SiteAssessment } from '../client.js';
import {
  assertNativeWriteAllowed,
  assertPublishOrHomepageAllowed,
  computeContentHash,
  defaultEditabilityGateStore,
  EditabilityGateError,
  EditabilityGateStore,
  evaluateAndRecordEditability,
  evaluateNativeDeliveryAndEditability,
  evaluatePageEditability,
} from '../editability-gate.js';
import {
  assertModeEnvironmentCompatible,
  DEFAULT_DELIVERY_MODE,
  getDeliveryModePolicy,
  NativeDeliveryError,
  resolveDeliveryEnvironment,
  resolveDeliveryMode,
} from '../native-delivery-mode.js';
import { PRODUCT_TIER_PROFILES } from '../product-entitlements.js';
import { ADVANCED_PRODUCT_SURFACE, FREE_PRODUCT_SURFACE } from '../product-surfaces.js';
import { getToolTierAssignment, TOOL_TIER_ASSIGNMENTS } from '../product-tiers.js';
import { registerChangeQueueTools } from '../tools/change-queue.js';
import { registerContentTools } from '../tools/content.js';
import { registerEditabilityTools } from '../tools/editability.js';
import { registerPageTools } from '../tools/pages.js';
import { registerSettingsTools } from '../tools/settings.js';
import { registerWizardTools } from '../tools/wizard.js';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');

function makeNativeElements() {
  return [
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
            title: 'Native Elementor Hero',
            title_color: '#111827',
            __globals__: { title_color: 'globals/colors?id=primary' },
          },
          elements: [],
        },
        {
          id: 'w_text_1',
          elType: 'widget',
          widgetType: 'text-editor',
          settings: { editor: '<p>Editable native copy.</p>' },
          elements: [],
        },
        {
          id: 'w_btn_1',
          elType: 'widget',
          widgetType: 'button',
          settings: { text: 'Get Started' },
          elements: [],
        },
        {
          id: 'w_img_1',
          elType: 'widget',
          widgetType: 'image',
          settings: { image: { url: 'https://example.com/hero.png', id: 10 } },
          elements: [],
        },
        {
          id: 'w_icon_1',
          elType: 'widget',
          widgetType: 'icon-box',
          settings: { title_text: 'Fast', description_text: 'Native controls' },
          elements: [],
        },
      ],
    },
  ];
}

function makeMonolithHtmlElements() {
  return [
    {
      id: 'sec_mono',
      elType: 'container',
      settings: {},
      elements: [
        {
          id: 'w_html_mono',
          elType: 'widget',
          widgetType: 'html',
          settings: {
            html: '<!DOCTYPE html><html><body><main><style>.hero{color:red}</style><h1>Full Page HTML Monolith</h1></main></body></html>',
          },
          elements: [],
        },
      ],
    },
  ];
}

function makeClient(overrides: Partial<Record<keyof ElementeerClient, unknown>> = {}): ElementeerClient {
  return {
    getPageData: vi.fn().mockResolvedValue({
      post_id: 101,
      post_title: 'Home',
      post_type: 'page',
      element_count: 1,
      elementor_data: makeNativeElements(),
    }),
    updatePageData: vi.fn().mockResolvedValue({ id: 101, updated: true }),
    publishPage: vi.fn().mockResolvedValue({ id: 101, status: 'publish', updated: true }),
    createPage: vi.fn().mockResolvedValue({
      page: { id: 102, title: 'New', status: 'draft' },
      message: 'created',
    }),
    getSiteSettings: vi.fn().mockResolvedValue({
      blogname: 'Test',
      description: 'Desc',
      homepage: null,
      posts_page: null,
      permalink: '/%postname%/',
      timezone: 'UTC',
      date_format: 'F j, Y',
      time_format: 'g:i a',
      start_of_week: 1,
    }),
    updateSiteSettings: vi.fn().mockResolvedValue({
      updated: ['homepage'],
      settings: { homepage: { id: 101, title: 'Home', url: 'https://example.com/' } },
    }),
    createChange: vi.fn().mockResolvedValue({
      id: 'chg_gate_1',
      created_at: '2026-11-28T00:00:00Z',
      status: 'pending',
      operation: 'update_page_data',
      params: {},
      note: null,
      before_state: null,
      reviewed_at: null,
      review_note: null,
      applied_at: null,
    }),
    getChange: vi.fn(),
    updateChangeStatus: vi.fn().mockResolvedValue({ id: 'chg_gate_1', status: 'applied' }),
    preflightRoute: vi.fn().mockReturnValue({ route: '/pages/101/data', method: 'PUT', available: true }),
    assessSite: vi.fn().mockResolvedValue({
      assessed_at: '2026-11-28T00:00:00Z',
      wordpress: { version: '6.6', language: 'en_US', timezone: 'UTC', is_multisite: false, site_name: 'Site', site_tagline: '', admin_url: 'https://example.com/wp-admin/' },
      elementor: { version: '3.24', pro: true, pro_version: '3.24', active_kit_id: 1 },
      brand: { logo_set: false, logo_id: null, global_colors_count: 4, global_typography_count: 2 },
      theme_builder: {},
      template_library: { total: 1, by_type: { container: 1 }, uncategorized: 0, published: 1, draft: 0 },
      pages: { elementor_total: 1, by_post_type: { page: 1 } },
      performance: { css_print_method: 'external', optimized_dom: true, load_fa4_shim: false },
      plugins: { active_count: 1, classified: {}, woocommerce: false, multilingual: false },
      custom_post_types: [],
      user_roles: ['administrator'],
      issues: [],
      issues_count: { critical: 0, warning: 0, info: 0 },
    } as unknown as SiteAssessment),
    getGlobalStyles: vi.fn().mockResolvedValue({
      kit_id: 1,
      system_colors: [],
      custom_colors: [],
      system_typography: [],
      custom_typography: [],
    } as GlobalStylesData),
    ...overrides,
  } as unknown as ElementeerClient;
}

describe('ELM25-MCP-001: Native Delivery Mode', () => {
  it("enforces 'native-elementor' as default mode and differentiates prototype-embed and bounded-embed", () => {
    expect(DEFAULT_DELIVERY_MODE).toBe('native-elementor');
    expect(resolveDeliveryMode()).toBe('native-elementor');
    expect(resolveDeliveryMode(undefined)).toBe('native-elementor');
    expect(resolveDeliveryMode('')).toBe('native-elementor');
    expect(resolveDeliveryMode('prototype-embed')).toBe('prototype-embed');
    expect(resolveDeliveryMode('bounded-embed')).toBe('bounded-embed');
    expect(resolveDeliveryEnvironment()).toBe('production');

    const nativePolicy = getDeliveryModePolicy('native-elementor');
    const boundedPolicy = getDeliveryModePolicy('bounded-embed');
    const protoPolicy = getDeliveryModePolicy('prototype-embed');

    expect(nativePolicy.isDefault).toBe(true);
    expect(nativePolicy.minNativeWidgetShare).toBe(0.8);
    expect(nativePolicy.allowsProductionPublish).toBe(true);

    expect(boundedPolicy.isDefault).toBe(false);
    expect(boundedPolicy.minNativeWidgetShare).toBe(0.5);
    expect(boundedPolicy.allowsProductionPublish).toBe(true);

    expect(protoPolicy.isDefault).toBe(false);
    expect(protoPolicy.allowsProductionPublish).toBe(false);
    expect(() => assertModeEnvironmentCompatible('prototype-embed', 'production')).toThrow(NativeDeliveryError);
    expect(() => resolveDeliveryMode('raw-html-dump')).toThrow(/INVALID_DELIVERY_MODE/);
  });
});

describe('ELM25-MCP-001: Editability Evaluator & Fallback Debt', () => {
  it('computes deterministic SHA-256 contentHash invariant to object key order', () => {
    const a = [{ id: 'w1', elType: 'widget', widgetType: 'heading', settings: { title: 'Hi', size: 'xl' } }];
    const b = [{ settings: { size: 'xl', title: 'Hi' }, widgetType: 'heading', elType: 'widget', id: 'w1' }];
    const hashA = computeContentHash(a, { layout: 'default', bg: '#fff' });
    const hashB = computeContentHash(b, { bg: '#fff', layout: 'default' });
    const hashChanged = computeContentHash(
      [{ id: 'w1', elType: 'widget', widgetType: 'heading', settings: { title: 'Changed', size: 'xl' } }],
      { layout: 'default', bg: '#fff' },
    );

    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashChanged);
  });

  it('produces valid elementeer-editability/v1 allow report for native Elementor page', () => {
    const bundle = evaluateNativeDeliveryAndEditability({
      pageId: 101,
      elements: makeNativeElements(),
    });

    expect(bundle.report.schemaVersion).toBe('elementeer-editability/v1');
    expect(bundle.report.mode).toBe('native-elementor');
    expect(bundle.report.totalWidgets).toBe(5);
    expect(bundle.report.htmlOrShortcodeWidgets).toBe(0);
    expect(bundle.report.nativeWidgetShare).toBe(1);
    expect(bundle.report.individuallyEditableCount).toBe(5);
    expect(bundle.report.responsiveSettingsValid).toBe(true);
    expect(bundle.report.globalTokensBound).toBe(true);
    expect(bundle.report.publishGateDecision).toBe('allow');
    expect(bundle.spec.schemaVersion).toBe('elementeer-native-delivery/v1');
    expect(bundle.spec.widgetSummary.isFullPageMonolith).toBe(false);
  });

  it('allows bounded fallback within byte/scope/owner policy when nativeWidgetShare >= 0.8', () => {
    const elements = [
      ...makeNativeElements(),
      {
        id: 'sec_embed',
        elType: 'container',
        settings: {},
        elements: [
          {
            id: 'w_html_small',
            elType: 'widget',
            widgetType: 'html',
            settings: { html: '<div class="badge">Live status</div>' },
            elements: [],
          },
        ],
      },
    ];
    // 5 native widgets + 1 html widget = 5/6 = 0.8333 >= 0.8
    const report = evaluatePageEditability({
      pageId: 105,
      elements,
      fallbackMetadata: {
        w_html_small: {
          owner: 'frontend-team',
          reason: 'Third-party live status badge widget',
          scope: 'bounded-embed',
        },
      },
    });

    expect(report.totalWidgets).toBe(6);
    expect(report.htmlOrShortcodeWidgets).toBe(1);
    expect(report.nativeWidgetShare).toBeCloseTo(5 / 6, 3);
    expect(report.boundedFallbacks).toHaveLength(1);
    expect(report.boundedFallbacks[0]!.withinBudget).toBe(true);
    expect(report.boundedFallbacks[0]!.owner).toBe('frontend-team');
    expect(report.publishGateDecision).toBe('allow');
  });

  it('rejects unowned or over-budget fallbacks under fallback-debt-v1', () => {
    const elements = [
      ...makeNativeElements(),
      {
        id: 'sec_embed',
        elType: 'container',
        settings: {},
        elements: [
          {
            id: 'w_html_big',
            elType: 'widget',
            widgetType: 'html',
            settings: { html: '<div>' + 'x'.repeat(5000) + '</div>' },
            elements: [],
          },
        ],
      },
    ];

    const missingOwner = evaluatePageEditability({ pageId: 106, elements });
    expect(missingOwner.publishGateDecision).toBe('block');
    expect(missingOwner.typedReasons.some((r) => r.code === 'FALLBACK_OWNER_REQUIRED')).toBe(true);
    expect(missingOwner.typedReasons.some((r) => r.code === 'FALLBACK_BUDGET_EXCEEDED')).toBe(true);

    const overBudgetWithOwner = evaluatePageEditability({
      pageId: 106,
      elements,
      fallbackMetadata: {
        w_html_big: { owner: 'team', reason: 'Large embed', scope: 'bounded-embed' },
      },
    });
    expect(overBudgetWithOwner.publishGateDecision).toBe('block');
    expect(overBudgetWithOwner.typedReasons.some((r) => r.code === 'FALLBACK_BUDGET_EXCEEDED')).toBe(true);
  });

  it('rejects full-page HTML monoliths in native-elementor production mode with FULL_PAGE_HTML_MONOLITH_FORBIDDEN unless audited OperatorOverride matches', () => {
    const elements = makeMonolithHtmlElements();
    const contentHash = computeContentHash(elements);

    const blockedReport = evaluatePageEditability({
      pageId: 201,
      elements,
      mode: 'native-elementor',
      environment: 'production',
      defaultFallbackOwner: 'legacy-import',
      defaultFallbackReason: 'Imported page',
    });

    expect(blockedReport.publishGateDecision).toBe('block');
    expect(blockedReport.typedReasons.some((r) => r.code === 'FULL_PAGE_HTML_MONOLITH_FORBIDDEN')).toBe(true);

    expect(() =>
      assertNativeWriteAllowed({
        pageId: 201,
        elements,
        mode: 'native-elementor',
        environment: 'production',
      }),
    ).toThrow(EditabilityGateError);

    try {
      assertNativeWriteAllowed({
        pageId: 201,
        elements,
        mode: 'native-elementor',
        environment: 'production',
      });
    } catch (err) {
      expect((err as EditabilityGateError).code).toBe('FULL_PAGE_HTML_MONOLITH_FORBIDDEN');
    }

    // Mismatched hash in OperatorOverride must still be rejected
    const staleOverrideReport = evaluatePageEditability({
      pageId: 201,
      elements,
      defaultFallbackOwner: 'legacy-import',
      defaultFallbackReason: 'Legacy migration',
      override: {
        operator: 'andre@elementeer.dev',
        reason: 'Approved legacy migration window',
        pageId: 201,
        contentHash: '0'.repeat(64),
        scope: 'full-page-html',
        createdAt: '2026-11-28T16:00:00Z',
      },
    });
    expect(staleOverrideReport.publishGateDecision).toBe('block');
    expect(staleOverrideReport.typedReasons.some((r) => r.code === 'OVERRIDE_HASH_OR_PAGE_MISMATCH')).toBe(true);

    // Valid audited OperatorOverride bound to exact pageId and contentHash allows with audit trail
    const allowedReport = evaluatePageEditability({
      pageId: 201,
      elements,
      defaultFallbackOwner: 'legacy-import',
      defaultFallbackReason: 'Legacy migration',
      override: {
        operator: 'andre@elementeer.dev',
        reason: 'Approved legacy migration window',
        pageId: 201,
        contentHash,
        scope: 'full-page-html',
        createdAt: '2026-11-28T16:00:00Z',
      },
    });
    expect(allowedReport.publishGateDecision).toBe('allow');
    expect(allowedReport.override?.operator).toBe('andre@elementeer.dev');
  });

  it('blocks unbound inline colors and malformed responsive settings in native-elementor mode', () => {
    const unboundElements = [
      {
        id: 'sec1',
        elType: 'container',
        settings: {},
        elements: [
          {
            id: 'w1',
            elType: 'widget',
            widgetType: 'heading',
            settings: {
              title: 'Hardcoded color',
              title_color: '#ff00ff',
              padding_mobile: {},
            },
            elements: [],
          },
        ],
      },
    ];

    const report = evaluatePageEditability({ pageId: 202, elements: unboundElements });
    expect(report.globalTokensBound).toBe(false);
    expect(report.responsiveSettingsValid).toBe(false);
    expect(report.publishGateDecision).toBe('block');
    expect(report.typedReasons.some((r) => r.code === 'EDITABILITY_GATE_VIOLATION')).toBe(true);
  });
});

describe('ELM25-MCP-001: Hash-Bound Gate Store & Publish / Homepage Enforcement', () => {
  let store: EditabilityGateStore;
  let server: McpServer;
  let client: ElementeerClient;
  let handlers: Map<string, (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>>;

  beforeEach(() => {
    defaultEditabilityGateStore.clear();
    store = new EditabilityGateStore();
    server = new McpServer({ name: 'test', version: '0.0.0' });
    client = makeClient();
    const getClient = vi.fn().mockReturnValue(client);
    handlers = new Map();

    vi.spyOn(server, 'tool').mockImplementation((...args: Parameters<typeof server.tool>) => {
      handlers.set(args[0] as string, args[args.length - 1] as any);
      return server as any;
    });

    registerEditabilityTools(server, getClient, defaultEditabilityGateStore);
    registerPageTools(server, getClient);
    registerContentTools(server, getClient);
    registerSettingsTools(server, getClient);
    registerChangeQueueTools(server, getClient);
    registerWizardTools(server, getClient);
  });

  async function call(name: string, args: Record<string, unknown> = {}) {
    const h = handlers.get(name);
    if (!h) throw new Error(`Tool "${name}" not registered`);
    return h(args);
  }

  it('fails closed on publish_page and set_homepage when no EditabilityReport exists', async () => {
    const pubRes = await call('publish_page', { page_id: 101 });
    expect(pubRes.isError).toBe(true);
    expect(JSON.parse(pubRes.content[0]!.text).code).toBe('EDITABILITY_GATE_MISSING');
    expect(client.publishPage).not.toHaveBeenCalled();

    const homeRes = await call('set_homepage', { page_id: 101 });
    expect(homeRes.isError).toBe(true);
    expect(JSON.parse(homeRes.content[0]!.text).code).toBe('EDITABILITY_GATE_MISSING');
    expect(client.updateSiteSettings).not.toHaveBeenCalled();
  });

  it('allows publish_page and set_homepage after evaluate_page_editability, then rejects if contentHash mutates', async () => {
    const evalRes = await call('evaluate_page_editability', { page_id: 101 });
    expect(evalRes.isError).toBeUndefined();
    const report = JSON.parse(evalRes.content[0]!.text);
    expect(report.publishGateDecision).toBe('allow');

    const pubRes = await call('publish_page', { page_id: 101, expected_content_hash: report.contentHash });
    expect(pubRes.isError).toBeUndefined();
    expect(client.publishPage).toHaveBeenCalledWith(101, { status: 'publish' });

    const homeRes = await call('set_homepage', { page_id: 101, expected_content_hash: report.contentHash });
    expect(homeRes.isError).toBeUndefined();
    expect(client.updateSiteSettings).toHaveBeenCalledWith({ homepage: 101 });

    // Mutate live page elements so contentHash changes -> stale hash must fail closed!
    const mutated = makeNativeElements();
    (mutated[0]!.elements[0]!.settings as Record<string, unknown>).title = 'Mutated After Eval';
    vi.mocked(client.getPageData).mockResolvedValue({
      post_id: 101,
      post_title: 'Home',
      post_type: 'page',
      element_count: 1,
      elementor_data: mutated,
    });

    const stalePub = await call('publish_page', { page_id: 101 });
    expect(stalePub.isError).toBe(true);
    expect(JSON.parse(stalePub.content[0]!.text).code).toBe('EDITABILITY_GATE_STALE_HASH');

    const staleHome = await call('set_homepage', { page_id: 101 });
    expect(staleHome.isError).toBe(true);
    expect(JSON.parse(staleHome.content[0]!.text).code).toBe('EDITABILITY_GATE_STALE_HASH');
  });

  it('rejects expired editability reports with EDITABILITY_GATE_EXPIRED', async () => {
    const shortStore = new EditabilityGateStore(1000);
    const elements = makeNativeElements();
    const report = evaluateAndRecordEditability(
      { pageId: 101, elements, evaluatedAt: '2026-11-28T10:00:00.000Z' },
      shortStore,
    );

    await expect(
      assertPublishOrHomepageAllowed({
        client,
        pageId: 101,
        store: shortStore,
        nowMs: Date.parse('2026-11-28T10:05:00.000Z'),
      }),
    ).rejects.toMatchObject({ code: 'EDITABILITY_GATE_EXPIRED' });

    // Within TTL passes
    const ok = await assertPublishOrHomepageAllowed({
      client,
      pageId: 101,
      store: shortStore,
      nowMs: Date.parse(report.evaluatedAt) + 500,
    });
    expect(ok.contentHash).toBe(report.contentHash);
  });

  it('blocks monolith writes in update_page_data, create_page(status=publish), and apply_change(homepage)', async () => {
    const monoRes = await call('update_page_data', {
      id: 101,
      elementor_data: makeMonolithHtmlElements(),
    });
    expect(monoRes.isError).toBe(true);
    expect(JSON.parse(monoRes.content[0]!.text).code).toBe('FULL_PAGE_HTML_MONOLITH_FORBIDDEN');
    expect(client.createChange).not.toHaveBeenCalled();

    const createPubRes = await call('create_page', {
      title: 'Monolith Page',
      content: '<html><body><h1>Raw</h1></body></html>',
      status: 'publish',
    });
    expect(createPubRes.isError).toBe(true);
    expect(JSON.parse(createPubRes.content[0]!.text).code).toBe('FULL_PAGE_HTML_MONOLITH_FORBIDDEN');
    expect(client.createPage).not.toHaveBeenCalled();

    // apply_change for update_site_settings({ homepage: 101 }) must fail closed when gate missing
    vi.mocked(client.getChange).mockResolvedValueOnce({
      id: 'chg_home',
      created_at: '2026-11-28T00:00:00Z',
      status: 'approved',
      operation: 'update_site_settings',
      params: { homepage: 101 },
      note: null,
      before_state: null,
      reviewed_at: null,
      review_note: null,
      applied_at: null,
    });
    const applyRes = await call('apply_change', { change_id: 'chg_home' });
    expect(applyRes.content[0]!.text).toContain('EDITABILITY_GATE_MISSING');
    expect(client.updateSiteSettings).not.toHaveBeenCalled();

    // wizard_brand_setup(auto_execute=true, homepage_page_id=101) must also fail closed when gate missing
    const brandRes = await call('wizard_brand_setup', {
      auto_execute: true,
      homepage_page_id: 101,
    });
    expect(brandRes.content[0]!.text).toContain('EDITABILITY_GATE_MISSING');
    expect(client.updateSiteSettings).not.toHaveBeenCalled();
  });
});

describe('ELM25-MCP-001: Product-Surface Truth (Free vs Advanced vs Studio Future)', () => {
  it('assigns native-delivery and editability gate tools to Free public surface', () => {
    for (const toolName of ['evaluate_page_editability', 'publish_page', 'set_homepage'] as const) {
      const assignment = getToolTierAssignment(toolName);
      expect(assignment?.tier).toBe('free');
      expect(assignment?.visibility).toBe('public');
      expect(FREE_PRODUCT_SURFACE.primaryTools).toContain(toolName);
      expect(ADVANCED_PRODUCT_SURFACE.primaryTools).not.toContain(toolName);
    }
  });

  it('keeps Studio marked as future/unavailable and never marketed as live', () => {
    const studioProfile = PRODUCT_TIER_PROFILES.find((p) => p.tier === 'studio_future');
    expect(studioProfile?.visibility).toBe('future');
    expect(studioProfile?.notes?.join(' ')).toContain('Not part of the current public or paid packaging surface');

    const studioAssignments = TOOL_TIER_ASSIGNMENTS.filter((t) => t.tier === 'studio_future');
    for (const item of studioAssignments) {
      expect(FREE_PRODUCT_SURFACE.primaryTools).not.toContain(item.id);
      expect(ADVANCED_PRODUCT_SURFACE.primaryTools).not.toContain(item.id);
    }

    expect(FREE_PRODUCT_SURFACE.excludes).toContain('Theme Builder delivery workflows');
    expect(FREE_PRODUCT_SURFACE.excludes).toContain('Cloud library, orchestration, or cross-site delivery promises');
    expect(ADVANCED_PRODUCT_SURFACE.excludes).toContain('Studio cloud library');
    expect(ADVANCED_PRODUCT_SURFACE.excludes).toContain('Cross-site template storage');

    const tiersDoc = readFileSync(resolve(REPO_ROOT, 'TIERS.md'), 'utf8');
    const readmeDoc = readFileSync(resolve(REPO_ROOT, 'README.md'), 'utf8');
    const freeDoc = readFileSync(resolve(REPO_ROOT, 'docs/public/free-includes-excludes.md'), 'utf8');

    expect(tiersDoc).toContain('Studio is the planned cloud orchestration layer — not yet available');
    expect(readmeDoc).toContain('Studio Orchestration');
    expect(readmeDoc).toContain('(Future)');
    expect(freeDoc).toContain('Studio orchestration');
  });
});
