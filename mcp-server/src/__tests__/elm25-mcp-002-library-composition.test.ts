import { beforeEach, describe, expect, it, vi } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import { canonicalJson, computeContentHash } from '../editability-gate.js';
import {
  applyGranularPatch,
  composeLibraryPage,
  computeStructureHash,
  LibraryComponentRegistry,
  LibraryComposerError,
  type ComponentBlueprint,
  type ElementorElementNode,
  type LibraryComposerClient,
} from '../library-composer.js';
import type { ResponsiveLayoutControls } from '../native-delivery-mode.js';
import {
  elementorSettingsToResponsiveControls,
  parseGlobalTokenDependencies,
  ResponsiveControlError,
  responsiveControlsToElementorSettings,
  roundtripResponsiveControls,
} from '../responsive-controls.js';
import { registerLibraryCompositionTools } from '../tools/library-composition.js';
import {
  assertWidgetControlsValid,
  validateTreeWidgetControls,
  WidgetControlValidationError,
} from '../widget-control-validator.js';

function createStatefulLibraryClient() {
  let nextTemplateId = 1000;
  const templates = new Map<
    number,
    { id: number; title: string; type: string; status: string; tags: string[]; data: unknown[] }
  >();
  const pages = new Map<number, { elementor_data: unknown[] }>();

  const client: LibraryComposerClient & {
    templates: typeof templates;
    pages: typeof pages;
    createTemplateCalls: number;
    updatePageDataCalls: number;
    patchWidgetCalls: number;
  } = {
    templates,
    pages,
    createTemplateCalls: 0,
    updatePageDataCalls: 0,
    patchWidgetCalls: 0,

    async listTemplates(params = {}) {
      let items = [...templates.values()];
      if (params.search) {
        const needle = params.search.toLowerCase();
        items = items.filter((t) => t.title.toLowerCase().includes(needle));
      }
      return {
        templates: items.map((t) => ({
          id: t.id,
          title: t.title,
          type: t.type,
          status: t.status,
          tags: [...t.tags],
        })),
        total: items.length,
        total_pages: 1,
      };
    },

    async getTemplateData(id: number) {
      const tpl = templates.get(id);
      if (!tpl) throw new Error(`Template ${id} not found`);
      return { id, elementor_data: JSON.parse(JSON.stringify(tpl.data)) };
    },

    async createTemplate(params) {
      client.createTemplateCalls += 1;
      const id = nextTemplateId++;
      const entry = {
        id,
        title: params.title,
        type: params.type,
        status: params.status ?? 'publish',
        tags: params.tags ? [...params.tags] : [],
        data: [],
      };
      templates.set(id, entry);
      return { id: entry.id, title: entry.title, type: entry.type, status: entry.status };
    },

    async updateTemplate(id: number, updates) {
      const tpl = templates.get(id);
      if (!tpl) throw new Error(`Template ${id} not found`);
      if (updates.title !== undefined) tpl.title = updates.title;
      if (updates.status !== undefined) tpl.status = updates.status;
      if (updates.tags !== undefined) tpl.tags = [...updates.tags];
      return { id: tpl.id, title: tpl.title, type: tpl.type, status: tpl.status, tags: tpl.tags };
    },

    async updateTemplateData(id: number, elementorData: unknown[]) {
      const tpl = templates.get(id);
      if (!tpl) throw new Error(`Template ${id} not found`);
      tpl.data = JSON.parse(JSON.stringify(elementorData));
      return { id, updated: true };
    },

    async getPageData({ id }: { id: number }) {
      const page = pages.get(id) ?? { elementor_data: [] };
      return {
        post_id: id,
        elementor_data: JSON.parse(JSON.stringify(page.elementor_data)),
      };
    },

    async updatePageData(id: number, elementorData: unknown[]) {
      client.updatePageDataCalls += 1;
      pages.set(id, { elementor_data: JSON.parse(JSON.stringify(elementorData)) });
      return { id, updated: true };
    },

    async patchWidget(id: number, widgetId: string, params) {
      client.patchWidgetCalls += 1;
      const page = pages.get(id);
      if (!page) throw new Error(`Page ${id} not found`);
      const apply = (nodes: Record<string, unknown>[]): boolean => {
        for (const node of nodes) {
          if (node.id === widgetId) {
            const current = (node.settings as Record<string, unknown>) ?? {};
            node.settings = { ...current, ...params.settings };
            return true;
          }
          if (Array.isArray(node.elements) && apply(node.elements as Record<string, unknown>[])) {
            return true;
          }
        }
        return false;
      };
      apply(page.elementor_data as Record<string, unknown>[]);
      return {
        post_id: id,
        widget_id: widgetId,
        path: `elements.${widgetId}.settings`,
        updated: true,
        new_hash: computeContentHash(page.elementor_data),
      };
    },
  };

  return client;
}

function makeComponentBlueprints(): ComponentBlueprint[] {
  return [
    {
      componentKey: 'acme/header',
      componentVersion: '1.0.0',
      templateTitle: 'SECTION_ACME_Header_v1',
      templateType: 'container',
      slotKey: 'slot-0-header',
      elements: [
        {
          id: 'sec_header',
          elType: 'container',
          settings: {
            flex_gap: { unit: 'px', size: 24 },
            __globals__: { background_color: 'globals/colors?id=surface' },
          },
          elements: [
            {
              id: 'w_nav_main',
              elType: 'widget',
              widgetType: 'nav-menu',
              settings: {
                menu: 'primary-nav',
                layout: 'horizontal',
                align_items: 'right',
                align_items_tablet: 'center',
                pointer: 'underline',
                submenu_icon: { value: 'fas fa-chevron-down', library: 'fa-solid' },
                __globals__: {
                  color_menu_item: 'globals/colors?id=text',
                  menu_typography_typography: 'globals/typography?id=secondary',
                },
              },
              elements: [],
            },
          ],
        },
      ],
    },
    {
      componentKey: 'acme/hero',
      componentVersion: '1.0.0',
      templateTitle: 'SECTION_ACME_Hero_v1',
      templateType: 'container',
      slotKey: 'slot-1-hero',
      elements: [
        {
          id: 'sec_hero',
          elType: 'container',
          settings: {
            padding: { unit: 'px', top: '80', right: '24', bottom: '80', left: '24', isLinked: false },
            padding_mobile: { unit: 'px', top: '48', right: '16', bottom: '48', left: '16', isLinked: false },
            __globals__: { background_color: 'globals/colors?id=soft-white' },
          },
          elements: [
            {
              id: 'w_hero_heading',
              elType: 'widget',
              widgetType: 'heading',
              settings: {
                title: 'Build Native Elementor Systems',
                typography_font_size: { unit: 'px', size: 48 },
                typography_font_size_tablet: { unit: 'px', size: 36 },
                typography_font_size_mobile: { unit: 'px', size: 28 },
                __globals__: {
                  title_color: 'globals/colors?id=primary',
                  typography_typography: 'globals/typography?id=h1',
                },
              },
              elements: [],
            },
            {
              id: 'w_hero_tp_btn',
              elType: 'widget',
              widgetType: 'tp_button',
              settings: {
                button_style: 'style-1',
                button_text: 'Start Building',
                button_link: { url: 'https://example.com/start' },
                button_align: 'left',
                button_align_mobile: 'center',
              },
              elements: [],
            },
          ],
        },
      ],
    },
    {
      componentKey: 'acme/features',
      componentVersion: '1.0.0',
      templateTitle: 'SECTION_ACME_Features_v1',
      templateType: 'container',
      slotKey: 'slot-2-features',
      elements: [
        {
          id: 'sec_features',
          elType: 'container',
          settings: {},
          elements: [
            {
              id: 'w_feat_card',
              elType: 'widget',
              widgetType: 'icon-box',
              settings: {
                title_text: 'Deterministic Composition',
                description_text: 'Reuse library components safely.',
                __globals__: { title_color: 'globals/colors?id=accent' },
              },
              elements: [],
            },
            {
              id: 'w_feat_tp_heading',
              elType: 'widget',
              widgetType: 'tp_heading_title',
              settings: {
                heading_style: 'style_1',
                title: 'Composable Blocks',
                alignment: 'center',
                alignment_tablet: 'left',
              },
              elements: [],
            },
          ],
        },
      ],
    },
    {
      componentKey: 'acme/footer-cta',
      componentVersion: '1.0.0',
      templateTitle: 'SECTION_ACME_FooterCTA_v1',
      templateType: 'container',
      slotKey: 'slot-3-footer-cta',
      elements: [
        {
          id: 'sec_footer_cta',
          elType: 'container',
          settings: {},
          elements: [
            {
              id: 'w_cta_btn',
              elType: 'widget',
              widgetType: 'button',
              settings: {
                text: 'Book Demo',
                __globals__: { button_text_color: 'globals/colors?id=soft-white' },
              },
              elements: [],
            },
          ],
        },
      ],
    },
  ];
}

describe('ELM25-MCP-002: Responsive Design Controls Roundtrip', () => {
  it('roundtrips all responsive layout & style controls losslessly across desktop, tablet, and mobile for containers and widgets with __globals__', () => {
    const controls: ResponsiveLayoutControls = {
      typography: {
        fontFamily: 'Inter',
        fontSize: {
          desktop: { unit: 'px', size: 48 },
          tablet: { unit: 'px', size: 36 },
          mobile: { unit: 'clamp', size: 'clamp(1.5rem, 4vw, 2rem)' },
        },
        lineHeight: {
          desktop: { unit: 'em', size: 1.2 },
          tablet: { unit: 'em', size: 1.25 },
          mobile: { unit: 'em', size: 1.3 },
        },
        letterSpacing: {
          desktop: { unit: 'px', size: -0.5 },
          tablet: { unit: 'px', size: -0.25 },
          mobile: { unit: 'px', size: 0 },
        },
        fontWeight: {
          desktop: '700',
          tablet: '600',
          mobile: 600,
        },
      },
      spacing: {
        gap: {
          desktop: { unit: 'px', size: 32 },
          tablet: { unit: 'px', size: 24 },
          mobile: { unit: 'px', size: 16 },
        },
        padding: {
          desktop: { unit: 'px', top: 64, right: 32, bottom: 64, left: 32, isLinked: false },
          tablet: { unit: 'px', top: 48, right: 24, bottom: 48, left: 24, isLinked: false },
          mobile: { unit: 'px', top: 32, right: 16, bottom: 32, left: 16, isLinked: false },
        },
        margin: {
          desktop: { unit: 'rem', top: 2, right: 0, bottom: 2, left: 0, isLinked: false },
          mobile: { unit: 'rem', top: 1, right: 0, bottom: 1, left: 0, isLinked: false },
        },
      },
      sizing: {
        width: {
          desktop: { unit: '%', size: 100 },
          tablet: { unit: '%', size: 100 },
          mobile: { unit: '%', size: 100 },
        },
        maxWidth: {
          desktop: { unit: 'px', size: 1280 },
          tablet: { unit: 'px', size: 960 },
          mobile: { unit: 'px', size: 390 },
        },
        minHeight: {
          desktop: { unit: 'vh', size: 70 },
          tablet: { unit: 'vh', size: 60 },
          mobile: { unit: 'auto', size: 'auto' },
        },
      },
      alignment: {
        desktop: 'flex-start',
        tablet: 'center',
        mobile: 'center',
      },
      whiteSpace: {
        desktop: 'nowrap',
        tablet: 'normal',
        mobile: 'pre-line',
      },
    };

    const globals = {
      title_color: 'globals/colors?id=primary',
      typography_typography: 'globals/typography?id=h1',
    };

    const containerRoundtrip = roundtripResponsiveControls(controls, {
      target: 'container',
      globals,
    });
    expect(containerRoundtrip.elementorSettings.settings.flex_gap_tablet).toEqual({ unit: 'px', size: 24 });
    expect(containerRoundtrip.elementorSettings.settings.padding_mobile).toEqual({
      unit: 'px',
      top: 32,
      right: 16,
      bottom: 32,
      left: 16,
      isLinked: false,
    });
    expect(containerRoundtrip.elementorSettings.settings.__globals__).toEqual(globals);
    expect(containerRoundtrip.extracted.responsiveControls).toEqual(controls);
    expect(containerRoundtrip.extracted.globals).toEqual(globals);
    expect(containerRoundtrip.extracted.tokenDependencies).toEqual({
      colors: ['primary'],
      typography: ['h1'],
    });

    const widgetRoundtrip = roundtripResponsiveControls(controls, {
      target: 'widget',
      globals,
    });
    expect(widgetRoundtrip.elementorSettings.settings._padding).toBeDefined();
    expect(widgetRoundtrip.elementorSettings.settings._margin_mobile).toBeDefined();
    expect(widgetRoundtrip.elementorSettings.settings._element_width).toBe('initial');
    expect(widgetRoundtrip.elementorSettings.settings._element_custom_width_tablet).toEqual({ unit: '%', size: 100 });
    expect(widgetRoundtrip.extracted.responsiveControls).toEqual(controls);
    expect(widgetRoundtrip.extracted.globals).toEqual(globals);
  });

  it('rejects responsive controls missing a desktop breakpoint or invalid measure units', () => {
    expect(() =>
      responsiveControlsToElementorSettings({
        typography: {
          fontSize: { tablet: { unit: 'px', size: 16 } } as unknown as ResponsiveLayoutControls['typography'] extends infer T
            ? T extends { fontSize?: infer F }
              ? F
              : never
            : never,
        },
      }),
    ).toThrow(ResponsiveControlError);

    expect(() =>
      elementorSettingsToResponsiveControls({
        padding_mobile: { unit: 'px', top: 10, right: 10, bottom: 10, left: 10 },
      }),
    ).toThrowError(ResponsiveControlError);

    expect(
      parseGlobalTokenDependencies({
        title_color: 'globals/colors?id=accent',
        background_color: 'globals/colors?id=surface',
        typography_typography: 'globals/typography?id=h2',
      }),
    ).toEqual({
      colors: ['accent', 'surface'],
      typography: ['h2'],
    });
  });
});

describe('ELM25-MCP-002: Installed Control Validator (nav-menu & tp_*)', () => {
  it('accepts valid nav-menu and The Plus tp_* widget fixtures matching installed versions', () => {
    const validWidgets: ElementorElementNode[] = [
      {
        id: 'w_nav_ok',
        elType: 'widget',
        widgetType: 'nav-menu',
        settings: {
          menu: 'main-menu',
          layout: 'horizontal',
          align_items: 'right',
          align_items_tablet: 'center',
          pointer: 'underline',
          submenu_icon: { value: 'fas fa-angle-down', library: 'fa-solid' },
          mobile_menu_breakpoint: 'tablet',
        },
        elements: [],
      },
      {
        id: 'w_tp_nav_ok',
        elType: 'widget',
        widgetType: 'tp_navigation_menu',
        settings: {
          menu_direction: 'horizontal',
          navbar_menu_type: 'normal',
          menu_align: 'center',
          menu_align_mobile: 'left',
          mega_menu_support: 'yes',
        },
        elements: [],
      },
      {
        id: 'w_tp_tabs_ok',
        elType: 'widget',
        widgetType: 'tp_tabs_tours',
        settings: {
          tabs_type: 'horizontal',
          tabs_align_horizontal: 'align-center',
          swiper_tab_enable: 'yes',
        },
        elements: [],
      },
    ];

    const res = assertWidgetControlsValid(validWidgets, {
      elementorProVersion: '3.24.0',
      thePlusVersion: '5.6.0',
    });
    expect(res.valid).toBe(true);
    expect(res.validatedWidgetCount).toBe(3);
  });

  it('rejects unknown controls on nav-menu and tp_* widgets with UNKNOWN_WIDGET_CONTROL', () => {
    expect(() =>
      assertWidgetControlsValid([
        {
          id: 'w_nav_unknown',
          elType: 'widget',
          widgetType: 'nav-menu',
          settings: {
            layout: 'horizontal',
            hallucinated_nav_prop: 'magic',
          },
        },
      ]),
    ).toThrowError(WidgetControlValidationError);

    const navRes = validateTreeWidgetControls([
      {
        id: 'w_nav_unknown',
        elType: 'widget',
        widgetType: 'nav-menu',
        settings: { layout: 'horizontal', hallucinated_nav_prop: 'magic' },
      },
    ]);
    expect(navRes.valid).toBe(false);
    expect(navRes.issues[0]?.code).toBe('UNKNOWN_WIDGET_CONTROL');

    const tpRes = validateTreeWidgetControls([
      {
        id: 'w_tp_unknown',
        elType: 'widget',
        widgetType: 'tp_nonexistent_widget',
        settings: { foo: 'bar' },
      },
    ]);
    expect(tpRes.valid).toBe(false);
    expect(tpRes.issues[0]?.code).toBe('UNKNOWN_WIDGET_CONTROL');
  });

  it('rejects version-incompatible and invalid enum/responsive controls with INCOMPATIBLE_WIDGET_CONTROL', () => {
    // Deprecated nav-menu `indicator` control on Elementor Pro 3.24.0 (removed after 3.15.99)
    expect(() =>
      assertWidgetControlsValid(
        [
          {
            id: 'w_nav_deprecated',
            elType: 'widget',
            widgetType: 'nav-menu',
            settings: {
              layout: 'horizontal',
              indicator: 'chevron',
            },
          },
        ],
        { elementorProVersion: '3.24.0' },
      ),
    ).toThrowError(/INCOMPATIBLE_WIDGET_CONTROL/);

    // `submenu_icon` requires Elementor Pro >= 3.16.0, fails on 3.14.0
    const oldPro = validateTreeWidgetControls(
      [
        {
          id: 'w_nav_too_old',
          elType: 'widget',
          widgetType: 'nav-menu',
          settings: { submenu_icon: { value: 'fas fa-angle-down' } },
        },
      ],
      { elementorProVersion: '3.14.0' },
    );
    expect(oldPro.valid).toBe(false);
    expect(oldPro.issues[0]?.code).toBe('INCOMPATIBLE_WIDGET_CONTROL');

    // `mega_menu_support` on tp_navigation_menu requires The Plus >= 5.2.0, fails on 5.0.0
    const oldTp = validateTreeWidgetControls(
      [
        {
          id: 'w_tp_too_old',
          elType: 'widget',
          widgetType: 'tp_navigation_menu',
          settings: {
            menu_direction: 'horizontal',
            mega_menu_support: 'yes',
          },
        },
      ],
      { thePlusVersion: '5.0.0' },
    );
    expect(oldTp.valid).toBe(false);
    expect(oldTp.issues[0]?.code).toBe('INCOMPATIBLE_WIDGET_CONTROL');

    // Non-responsive `layout` cannot take `_mobile` suffix
    const nonResp = validateTreeWidgetControls([
      {
        id: 'w_nav_non_resp',
        elType: 'widget',
        widgetType: 'nav-menu',
        settings: {
          layout: 'horizontal',
          layout_mobile: 'dropdown',
        },
      },
    ]);
    expect(nonResp.valid).toBe(false);
    expect(nonResp.issues[0]?.code).toBe('INCOMPATIBLE_WIDGET_CONTROL');
  });
});

describe('ELM25-MCP-002: Library-First Idempotent Composer & 3-Step Granular Patching', () => {
  let registry: LibraryComponentRegistry;

  beforeEach(() => {
    registry = new LibraryComponentRegistry();
  });

  it('upserts by componentKey+version+structureHash, reuses templateIds on repeat & secondary pages, and emits CompositionManifest v1', async () => {
    const client = createStatefulLibraryClient();
    const blueprints = makeComponentBlueprints();

    const first = await composeLibraryPage(
      client,
      {
        pageId: 101,
        kitId: 6,
        dedupeKey: 'acme-home-101-v1',
        components: blueprints,
      },
      registry,
    );

    expect(first.manifest.schemaVersion).toBe('elementeer-composition-manifest/v1');
    expect(first.manifest.components.map((c) => c.upsertAction)).toEqual([
      'created',
      'created',
      'created',
      'created',
    ]);
    expect(client.createTemplateCalls).toBe(4);
    expect(first.manifest.idempotency.duplicateTemplatesPrevented).toBe(true);
    expect(first.manifest.idempotency.duplicateElementIdsPrevented).toBe(true);
    expect(first.manifest.tokenDependencies.colors).toEqual(
      expect.arrayContaining(['surface', 'text', 'soft-white', 'primary', 'accent']),
    );
    expect(first.manifest.tokenDependencies.typography).toEqual(
      expect.arrayContaining(['secondary', 'h1']),
    );

    const firstTemplateIds = first.manifest.components.map((c) => c.templateId);

    // Second composition on same page: must reuse templateIds and NOT create new templates
    const second = await composeLibraryPage(
      client,
      {
        pageId: 101,
        kitId: 6,
        dedupeKey: 'acme-home-101-v1',
        components: makeComponentBlueprints(),
      },
      registry,
    );

    expect(second.manifest.components.map((c) => c.upsertAction)).toEqual([
      'reused',
      'reused',
      'reused',
      'reused',
    ]);
    expect(second.manifest.components.map((c) => c.templateId)).toEqual(firstTemplateIds);
    expect(second.manifest.pageContentHash).toBe(first.manifest.pageContentHash);
    expect(second.manifest.elementIds).toEqual(first.manifest.elementIds);
    expect(client.createTemplateCalls).toBe(4);

    // Even with a fresh registry instance, tag discovery on listTemplates reuses existing templateIds!
    const freshRegistry = new LibraryComponentRegistry();
    const secondaryPage = await composeLibraryPage(
      client,
      {
        pageId: 202,
        kitId: 6,
        components: makeComponentBlueprints(),
      },
      freshRegistry,
    );
    expect(secondaryPage.manifest.components.map((c) => c.upsertAction)).toEqual([
      'reused',
      'reused',
      'reused',
      'reused',
    ]);
    expect(secondaryPage.manifest.components.map((c) => c.templateId)).toEqual(firstTemplateIds);
    expect(client.createTemplateCalls).toBe(4);
  });

  it('requires componentVersion bump on incompatible structural change and allows update after bump', async () => {
    const client = createStatefulLibraryClient();
    await composeLibraryPage(
      client,
      { pageId: 101, components: makeComponentBlueprints() },
      registry,
    );

    // Mutate hero structure (add a new widget) without bumping componentVersion 1.0.0 -> fail closed!
    const mutated = makeComponentBlueprints();
    mutated[1]!.elements[0]!.elements!.push({
      id: 'w_hero_extra_badge',
      elType: 'widget',
      widgetType: 'text-editor',
      settings: { editor: '<p>New structural node</p>' },
      elements: [],
    });

    await expect(
      composeLibraryPage(client, { pageId: 101, components: mutated }, registry),
    ).rejects.toMatchObject({
      code: 'COMPONENT_VERSION_BUMP_REQUIRED',
    });

    // Bump componentVersion to 2.0.0 -> updates existing templateId in place without creating duplicate template
    mutated[1]!.componentVersion = '2.0.0';
    const updated = await composeLibraryPage(
      client,
      { pageId: 101, components: mutated },
      registry,
    );
    expect(updated.manifest.components[1]!.upsertAction).toBe('updated');
    expect(updated.manifest.components[1]!.componentVersion).toBe('2.0.0');
    expect(updated.manifest.components[1]!.structureHash).toBe(
      computeStructureHash(mutated[1]!.elements),
    );
    expect(client.createTemplateCalls).toBe(4);
  });

  it('prevents duplicate elementIds and duplicate templateTitles across components', async () => {
    const client = createStatefulLibraryClient();
    const dupIds = makeComponentBlueprints();
    // Inject duplicate ID `w_nav_main` into hero
    dupIds[1]!.elements[0]!.elements![0]!.id = 'w_nav_main';

    await expect(
      composeLibraryPage(client, { pageId: 101, components: dupIds }, registry),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_ELEMENT_ID',
    });

    const dupTitles = makeComponentBlueprints();
    dupTitles[2]!.templateTitle = dupTitles[1]!.templateTitle;
    await expect(
      composeLibraryPage(client, { pageId: 101, components: dupTitles }, registry),
    ).rejects.toMatchObject({
      code: 'DUPLICATE_TEMPLATE_TITLE',
    });
  });

  it('proves 3 sequential granular patch operations mutate only target elements and update pageContentHash without regenerating elementIds', async () => {
    const client = createStatefulLibraryClient();
    const initial = await composeLibraryPage(
      client,
      { pageId: 101, kitId: 6, components: makeComponentBlueprints() },
      registry,
    );

    const h0 = initial.pageContentHash;
    const originalElementIds = [...initial.manifest.elementIds];
    const originalSection0Json = canonicalJson(initial.composedElements[0]);
    const originalSection1Json = canonicalJson(initial.composedElements[1]);
    const originalSection2Json = canonicalJson(initial.composedElements[2]);
    const originalSection3Json = canonicalJson(initial.composedElements[3]);

    // Patch 1: target w_hero_heading (section index 1)
    const p1 = await applyGranularPatch({
      pageId: 101,
      elements: initial.composedElements,
      manifest: initial.manifest,
      patch: {
        targetElementId: 'w_hero_heading',
        settingsPatch: {
          title: 'Native Delivery 2.5',
          typography_font_size_mobile: { unit: 'px', size: 26 },
        },
        expectedPageContentHash: h0,
      },
      client,
    });
    expect(p1.fullPageRewrite).toBe(false);
    expect(p1.mutatedElementIds).toEqual(['w_hero_heading']);
    expect(p1.unchangedTopLevelSectionIndices).toEqual([0, 2, 3]);
    expect(p1.preservedElementIds).toEqual(originalElementIds);
    expect(p1.pageContentHash).not.toBe(h0);
    expect(canonicalJson(p1.elements[0])).toBe(originalSection0Json);
    expect(canonicalJson(p1.elements[2])).toBe(originalSection2Json);
    expect(canonicalJson(p1.elements[3])).toBe(originalSection3Json);

    // Patch 2: target w_feat_card (section index 2), chained on p1.pageContentHash
    const p2 = await applyGranularPatch({
      pageId: 101,
      elements: p1.elements,
      manifest: p1.manifest,
      patch: {
        targetElementId: 'w_feat_card',
        settingsPatch: {
          title_text: 'Zero Monolith Rewrites',
          __globals__: { title_color: 'globals/colors?id=primary' },
        },
        expectedPageContentHash: p1.pageContentHash,
      },
      client,
    });
    expect(p2.fullPageRewrite).toBe(false);
    expect(p2.mutatedElementIds).toEqual(['w_feat_card']);
    expect(p2.unchangedTopLevelSectionIndices).toEqual([0, 1, 3]);
    expect(p2.preservedElementIds).toEqual(originalElementIds);
    expect(p2.pageContentHash).not.toBe(p1.pageContentHash);
    expect(canonicalJson(p2.elements[0])).toBe(originalSection0Json);
    expect(canonicalJson(p2.elements[1])).toBe(canonicalJson(p1.elements[1]));
    expect(canonicalJson(p2.elements[1])).not.toBe(originalSection1Json);
    expect(canonicalJson(p2.elements[3])).toBe(originalSection3Json);

    // Patch 3: target w_cta_btn (section index 3), chained on p2.pageContentHash
    const p3 = await applyGranularPatch({
      pageId: 101,
      elements: p2.elements,
      manifest: p2.manifest,
      patch: {
        targetElementId: 'w_cta_btn',
        settingsPatch: {
          text: 'Schedule Live Demo',
        },
        expectedPageContentHash: p2.pageContentHash,
      },
      client,
    });
    expect(p3.fullPageRewrite).toBe(false);
    expect(p3.mutatedElementIds).toEqual(['w_cta_btn']);
    expect(p3.unchangedTopLevelSectionIndices).toEqual([0, 1, 2]);
    expect(p3.preservedElementIds).toEqual(originalElementIds);
    expect(p3.pageContentHash).not.toBe(p2.pageContentHash);
    expect(canonicalJson(p3.elements[0])).toBe(originalSection0Json);
    expect(canonicalJson(p3.elements[1])).toBe(canonicalJson(p2.elements[1]));
    expect(canonicalJson(p3.elements[2])).toBe(canonicalJson(p2.elements[2]));
    expect(client.patchWidgetCalls).toBe(3);
    expect(client.updatePageDataCalls).toBe(1);

    // Stale hash fails closed
    await expect(
      applyGranularPatch({
        pageId: 101,
        elements: p3.elements,
        manifest: p3.manifest,
        patch: {
          targetElementId: 'w_cta_btn',
          settingsPatch: { text: 'Stale' },
          expectedPageContentHash: h0,
        },
        client,
      }),
    ).rejects.toMatchObject({ code: 'STALE_PAGE_CONTENT_HASH' });
  });

  it('exposes compose_library_page, patch_composed_page, validate_widget_controls, and convert_responsive_controls via MCP tools', async () => {
    const client = createStatefulLibraryClient();
    const server = new McpServer({ name: 'test', version: '0.0.0' });
    const handlers = new Map<
      string,
      (args: Record<string, unknown>) => Promise<{ content: Array<{ text: string }>; isError?: boolean }>
    >();

    vi.spyOn(server, 'tool').mockImplementation((...args: Parameters<typeof server.tool>) => {
      handlers.set(args[0] as string, args[args.length - 1] as any);
      return server as any;
    });

    registerLibraryCompositionTools(
      server,
      () => client as unknown as ElementeerClient,
      registry,
    );

    const call = async (name: string, args: Record<string, unknown>) => {
      const h = handlers.get(name);
      if (!h) throw new Error(`Missing tool ${name}`);
      return h(args);
    };

    const composeRes = await call('compose_library_page', {
      page_id: 501,
      kit_id: 6,
      components: makeComponentBlueprints().map((c) => ({
        component_key: c.componentKey,
        component_version: c.componentVersion,
        template_title: c.templateTitle,
        template_type: c.templateType,
        slot_key: c.slotKey,
        elements: c.elements,
      })),
    });
    expect(composeRes.isError).toBeUndefined();
    const manifest = JSON.parse(composeRes.content[0]!.text);
    expect(manifest.schemaVersion).toBe('elementeer-composition-manifest/v1');

    const patchRes = await call('patch_composed_page', {
      page_id: 501,
      target_element_id: 'w_hero_heading',
      settings_patch: { title: 'Updated via MCP tool' },
      expected_page_content_hash: manifest.pageContentHash,
      manifest,
    });
    expect(patchRes.isError).toBeUndefined();
    const patchPayload = JSON.parse(patchRes.content[0]!.text);
    expect(patchPayload.ok).toBe(true);
    expect(patchPayload.fullPageRewrite).toBe(false);
    expect(patchPayload.preservedElementIds).toEqual(manifest.elementIds);

    const invalidWidgetRes = await call('validate_widget_controls', {
      elements: [
        {
          id: 'w_bad_tp',
          elType: 'widget',
          widgetType: 'tp_navigation_menu',
          settings: { mega_menu_support: 'yes' },
        },
      ],
      installed_plugins: { the_plus_version: '4.9.0' },
    });
    expect(invalidWidgetRes.isError).toBe(true);
    expect(JSON.parse(invalidWidgetRes.content[0]!.text).code).toBe('INCOMPATIBLE_WIDGET_CONTROL');

    const convertRes = await call('convert_responsive_controls', {
      direction: 'to_elementor',
      target: 'container',
      responsive_controls: {
        alignment: { desktop: 'left', tablet: 'center', mobile: 'center' },
        whiteSpace: { desktop: 'nowrap', mobile: 'normal' },
      },
      globals: { background_color: 'globals/colors?id=surface' },
    });
    expect(convertRes.isError).toBeUndefined();
    const convertPayload = JSON.parse(convertRes.content[0]!.text);
    expect(convertPayload.settings.align_tablet).toBe('center');
    expect(convertPayload.settings.white_space_mobile).toBe('normal');
    expect(convertPayload.globals.background_color).toBe('globals/colors?id=surface');
  });
});
