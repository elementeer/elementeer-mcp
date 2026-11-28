export type WidgetControlErrorCode =
  | 'UNKNOWN_WIDGET_CONTROL'
  | 'INCOMPATIBLE_WIDGET_CONTROL';

export class WidgetControlValidationError extends Error {
  constructor(
    public readonly code: WidgetControlErrorCode,
    message: string,
    public readonly details?: {
      widgetType?: string;
      elementId?: string;
      controlName?: string;
      installedVersion?: string;
      requiredVersion?: string;
      issues?: WidgetControlIssue[];
    },
  ) {
    super(`[${code}] ${message}`);
    this.name = 'WidgetControlValidationError';
  }
}

export interface InstalledControlDefinition {
  name: string;
  type:
    | 'text'
    | 'textarea'
    | 'wysiwyg'
    | 'number'
    | 'select'
    | 'switcher'
    | 'slider'
    | 'dimensions'
    | 'color'
    | 'typography'
    | 'icon'
    | 'icons'
    | 'media'
    | 'url'
    | 'repeater'
    | 'object';
  enum?: Array<string | number | boolean>;
  responsive?: boolean;
  minVersion?: string;
  maxVersion?: string;
  deprecatedIn?: string;
  replacedBy?: string;
  required?: boolean;
}

export interface InstalledWidgetSchema {
  widgetType: string;
  plugin: 'elementor-pro' | 'the-plus-addons' | 'elementor-core';
  minPluginVersion: string;
  maxPluginVersion?: string;
  controls: Record<string, InstalledControlDefinition>;
}

export interface InstalledPluginsInventory {
  elementorVersion?: string;
  elementorProVersion?: string;
  thePlusVersion?: string;
  schemas?: Record<string, InstalledWidgetSchema>;
}

export interface WidgetControlIssue {
  code: WidgetControlErrorCode;
  widgetType: string;
  elementId?: string;
  controlName: string;
  message: string;
  installedVersion?: string;
  requiredVersion?: string;
}

export interface WidgetControlValidationResult {
  valid: boolean;
  validatedWidgetCount: number;
  validatedControlsCount: number;
  issues: WidgetControlIssue[];
}

const DEFAULT_INSTALLED_INVENTORY: Required<
  Pick<InstalledPluginsInventory, 'elementorVersion' | 'elementorProVersion' | 'thePlusVersion'>
> = {
  elementorVersion: '3.24.0',
  elementorProVersion: '3.24.0',
  thePlusVersion: '5.6.0',
};

const COMMON_ELEMENTOR_CONTROLS: Record<string, InstalledControlDefinition> = {
  _title: { name: '_title', type: 'text', responsive: false },
  _element_id: { name: '_element_id', type: 'text', responsive: false },
  _css_classes: { name: '_css_classes', type: 'text', responsive: false },
  _padding: { name: '_padding', type: 'dimensions', responsive: true },
  _margin: { name: '_margin', type: 'dimensions', responsive: true },
  _z_index: { name: '_z_index', type: 'number', responsive: true },
  _element_width: {
    name: '_element_width',
    type: 'select',
    enum: ['', 'inherit', 'initial', 'auto'],
    responsive: true,
  },
  _element_custom_width: { name: '_element_custom_width', type: 'slider', responsive: true },
  _element_vertical_align: {
    name: '_element_vertical_align',
    type: 'select',
    enum: ['', 'flex-start', 'center', 'flex-end'],
    responsive: true,
  },
  max_width: { name: 'max_width', type: 'slider', responsive: true },
  min_height: { name: 'min_height', type: 'slider', responsive: true },
  hide_desktop: { name: 'hide_desktop', type: 'switcher', enum: ['', 'hidden-desktop'], responsive: false },
  hide_tablet: { name: 'hide_tablet', type: 'switcher', enum: ['', 'hidden-tablet'], responsive: false },
  hide_mobile: { name: 'hide_mobile', type: 'switcher', enum: ['', 'hidden-mobile'], responsive: false },
  custom_css: { name: 'custom_css', type: 'textarea', responsive: false },
  __globals__: { name: '__globals__', type: 'object', responsive: false },
  _elementeer_fallback: { name: '_elementeer_fallback', type: 'object', responsive: false },
};

const BUILTIN_WIDGET_CONTROL_SCHEMAS: Record<string, InstalledWidgetSchema> = {
  'nav-menu': {
    widgetType: 'nav-menu',
    plugin: 'elementor-pro',
    minPluginVersion: '3.0.0',
    controls: {
      menu: { name: 'menu', type: 'select', responsive: false },
      layout: {
        name: 'layout',
        type: 'select',
        enum: ['horizontal', 'vertical', 'dropdown'],
        responsive: false,
      },
      align_items: {
        name: 'align_items',
        type: 'select',
        enum: ['left', 'center', 'right', 'justify'],
        responsive: true,
      },
      pointer: {
        name: 'pointer',
        type: 'select',
        enum: ['none', 'underline', 'overline', 'double-line', 'framed', 'background', 'text'],
        responsive: false,
      },
      animation_line: {
        name: 'animation_line',
        type: 'select',
        enum: ['fade', 'grow', 'drop-in', 'drop-out', 'none', 'slide'],
        responsive: false,
      },
      animation_framed: {
        name: 'animation_framed',
        type: 'select',
        enum: ['fade', 'grow', 'shrink', 'corners', 'none'],
        responsive: false,
      },
      indicator: {
        name: 'indicator',
        type: 'select',
        enum: ['none', 'classic', 'chevron', 'angle', 'plus'],
        responsive: false,
        maxVersion: '3.15.99',
        deprecatedIn: '3.16.0',
        replacedBy: 'submenu_icon',
      },
      submenu_icon: {
        name: 'submenu_icon',
        type: 'icons',
        responsive: false,
        minVersion: '3.16.0',
      },
      dropdown: {
        name: 'dropdown',
        type: 'select',
        enum: ['none', 'mobile', 'tablet'],
        responsive: false,
      },
      full_width: {
        name: 'full_width',
        type: 'switcher',
        enum: ['', 'yes', 'stretch'],
        responsive: false,
      },
      text_align: {
        name: 'text_align',
        type: 'select',
        enum: ['aside', 'center'],
        responsive: false,
      },
      toggle: {
        name: 'toggle',
        type: 'select',
        enum: ['', 'burger'],
        responsive: false,
      },
      toggle_align: {
        name: 'toggle_align',
        type: 'select',
        enum: ['left', 'center', 'right'],
        responsive: true,
      },
      mobile_menu_breakpoint: {
        name: 'mobile_menu_breakpoint',
        type: 'select',
        enum: ['tablet', 'mobile', 'none'],
        responsive: false,
        minVersion: '3.10.0',
      },
      color_menu_item: { name: 'color_menu_item', type: 'color', responsive: false },
      color_menu_item_hover: { name: 'color_menu_item_hover', type: 'color', responsive: false },
      color_menu_item_active: { name: 'color_menu_item_active', type: 'color', responsive: false },
      color_dropdown_item: { name: 'color_dropdown_item', type: 'color', responsive: false },
      background_color_dropdown_item: { name: 'background_color_dropdown_item', type: 'color', responsive: false },
      pointer_color_menu_item_hover: { name: 'pointer_color_menu_item_hover', type: 'color', responsive: false },
      toggle_color: { name: 'toggle_color', type: 'color', responsive: false },
      toggle_background_color: { name: 'toggle_background_color', type: 'color', responsive: false },
      menu_typography_typography: { name: 'menu_typography_typography', type: 'typography', responsive: false },
      menu_typography_font_family: { name: 'menu_typography_font_family', type: 'text', responsive: false },
      menu_typography_font_size: { name: 'menu_typography_font_size', type: 'slider', responsive: true },
      menu_typography_font_weight: { name: 'menu_typography_font_weight', type: 'select', responsive: true },
      menu_typography_line_height: { name: 'menu_typography_line_height', type: 'slider', responsive: true },
      menu_typography_letter_spacing: { name: 'menu_typography_letter_spacing', type: 'slider', responsive: true },
      padding_horizontal_menu_item: { name: 'padding_horizontal_menu_item', type: 'slider', responsive: true },
      padding_vertical_menu_item: { name: 'padding_vertical_menu_item', type: 'slider', responsive: true },
      menu_space_between: { name: 'menu_space_between', type: 'slider', responsive: true },
      distance_from_menu: { name: 'distance_from_menu', type: 'slider', responsive: true },
      dropdown_border_radius: { name: 'dropdown_border_radius', type: 'dimensions', responsive: true },
      toggle_size: { name: 'toggle_size', type: 'slider', responsive: true },
    },
  },
  tp_navigation_menu: {
    widgetType: 'tp_navigation_menu',
    plugin: 'the-plus-addons',
    minPluginVersion: '5.0.0',
    controls: {
      menu_direction: {
        name: 'menu_direction',
        type: 'select',
        enum: ['horizontal', 'vertical'],
        responsive: false,
      },
      navbar_menu_type: {
        name: 'navbar_menu_type',
        type: 'select',
        enum: ['normal', 'custom'],
        responsive: false,
      },
      menu_selection: { name: 'menu_selection', type: 'select', responsive: false },
      menu_align: {
        name: 'menu_align',
        type: 'select',
        enum: ['flex-start', 'center', 'flex-end', 'left', 'right'],
        responsive: true,
      },
      mobile_menu_toggle: {
        name: 'mobile_menu_toggle',
        type: 'switcher',
        enum: ['yes', 'no', ''],
        responsive: false,
      },
      mobile_toggle_style: {
        name: 'mobile_toggle_style',
        type: 'select',
        enum: ['style-1', 'style-2', 'style-3', 'style-4'],
        responsive: false,
      },
      responsive_menu_breakpoint: { name: 'responsive_menu_breakpoint', type: 'slider', responsive: false },
      main_menu_color: { name: 'main_menu_color', type: 'color', responsive: false },
      main_menu_hover_color: { name: 'main_menu_hover_color', type: 'color', responsive: false },
      main_menu_typography: { name: 'main_menu_typography', type: 'typography', responsive: false },
      mega_menu_support: {
        name: 'mega_menu_support',
        type: 'switcher',
        enum: ['yes', 'no', ''],
        responsive: false,
        minVersion: '5.2.0',
      },
      hamburger_menu_type: {
        name: 'hamburger_menu_type',
        type: 'select',
        enum: ['slide', 'fullscreen', 'dropdown'],
        responsive: false,
        minVersion: '5.0.0',
      },
    },
  },
  tp_heading_title: {
    widgetType: 'tp_heading_title',
    plugin: 'the-plus-addons',
    minPluginVersion: '5.0.0',
    controls: {
      heading_style: {
        name: 'heading_style',
        type: 'select',
        enum: ['style_1', 'style_2', 'style_4', 'style_5', 'style_6', 'style_7', 'style_8', 'style_9', 'style_10', 'style_11'],
        responsive: false,
      },
      title: { name: 'title', type: 'text', responsive: false },
      sub_title: { name: 'sub_title', type: 'text', responsive: false },
      title_s: {
        name: 'title_s',
        type: 'select',
        enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'p', 'span'],
        responsive: false,
      },
      alignment: {
        name: 'alignment',
        type: 'select',
        enum: ['left', 'center', 'right'],
        responsive: true,
      },
      title_color: { name: 'title_color', type: 'color', responsive: false },
      sub_title_color: { name: 'sub_title_color', type: 'color', responsive: false },
      title_typography_typography: { name: 'title_typography_typography', type: 'typography', responsive: false },
      title_typography_font_size: { name: 'title_typography_font_size', type: 'slider', responsive: true },
      plus_tooltip: { name: 'plus_tooltip', type: 'switcher', enum: ['yes', 'no', ''], responsive: false },
    },
  },
  tp_button: {
    widgetType: 'tp_button',
    plugin: 'the-plus-addons',
    minPluginVersion: '5.0.0',
    controls: {
      button_style: {
        name: 'button_style',
        type: 'select',
        enum: ['style-1', 'style-2', 'style-3', 'style-4', 'style-5', 'style-8', 'style-10', 'style-11', 'style-22'],
        responsive: false,
      },
      button_text: { name: 'button_text', type: 'text', responsive: false },
      button_link: { name: 'button_link', type: 'url', responsive: false },
      button_align: {
        name: 'button_align',
        type: 'select',
        enum: ['left', 'center', 'right', 'justify'],
        responsive: true,
      },
      btn_hover_style: { name: 'btn_hover_style', type: 'select', responsive: false },
      button_text_color: { name: 'button_text_color', type: 'color', responsive: false },
      button_background: { name: 'button_background', type: 'color', responsive: false },
      button_border_radius: { name: 'button_border_radius', type: 'dimensions', responsive: true },
      button_padding: { name: 'button_padding', type: 'dimensions', responsive: true },
    },
  },
  tp_accordion: {
    widgetType: 'tp_accordion',
    plugin: 'the-plus-addons',
    minPluginVersion: '5.0.0',
    controls: {
      tabs: { name: 'tabs', type: 'repeater', responsive: false },
      accordion_style: {
        name: 'accordion_style',
        type: 'select',
        enum: ['style-1', 'style-2', 'style-3'],
        responsive: false,
      },
      title_html_tag: {
        name: 'title_html_tag',
        type: 'select',
        enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div'],
        responsive: false,
      },
      display_icon: { name: 'display_icon', type: 'switcher', enum: ['yes', 'no', ''], responsive: false },
      active_accordion: { name: 'active_accordion', type: 'number', responsive: false },
      on_hover_accordion: {
        name: 'on_hover_accordion',
        type: 'switcher',
        enum: ['yes', 'no', ''],
        responsive: false,
        minVersion: '5.1.0',
      },
      schema_markup: {
        name: 'schema_markup',
        type: 'switcher',
        enum: ['yes', 'no', ''],
        responsive: false,
        minVersion: '5.3.0',
      },
    },
  },
  tp_adv_text_block: {
    widgetType: 'tp_adv_text_block',
    plugin: 'the-plus-addons',
    minPluginVersion: '5.0.0',
    controls: {
      content_description: { name: 'content_description', type: 'wysiwyg', responsive: false },
      display_count: { name: 'display_count', type: 'switcher', enum: ['yes', 'no', ''], responsive: false },
      display_count_input: { name: 'display_count_input', type: 'number', responsive: false },
      content_color: { name: 'content_color', type: 'color', responsive: false },
      content_typography_font_size: { name: 'content_typography_font_size', type: 'slider', responsive: true },
    },
  },
  tp_pricing_table: {
    widgetType: 'tp_pricing_table',
    plugin: 'the-plus-addons',
    minPluginVersion: '5.0.0',
    controls: {
      pricing_table_style: {
        name: 'pricing_table_style',
        type: 'select',
        enum: ['style-1', 'style-2', 'style-3'],
        responsive: false,
      },
      pricing_title: { name: 'pricing_title', type: 'text', responsive: false },
      pricing_subtitle: { name: 'pricing_subtitle', type: 'text', responsive: false },
      price_prefix: { name: 'price_prefix', type: 'text', responsive: false },
      price_variation: { name: 'price_variation', type: 'text', responsive: false },
      pricing_content: { name: 'pricing_content', type: 'repeater', responsive: false },
      button_show: { name: 'button_show', type: 'switcher', enum: ['yes', 'no', ''], responsive: false },
      button_text: { name: 'button_text', type: 'text', responsive: false },
      button_link: { name: 'button_link', type: 'url', responsive: false },
      ribbon_style: { name: 'ribbon_style', type: 'select', responsive: false },
    },
  },
  tp_tabs_tours: {
    widgetType: 'tp_tabs_tours',
    plugin: 'the-plus-addons',
    minPluginVersion: '5.0.0',
    controls: {
      tabs: { name: 'tabs', type: 'repeater', responsive: false },
      tabs_type: {
        name: 'tabs_type',
        type: 'select',
        enum: ['horizontal', 'vertical'],
        responsive: false,
      },
      tabs_align_horizontal: {
        name: 'tabs_align_horizontal',
        type: 'select',
        enum: ['align-left', 'align-center', 'align-right', 'align-justify'],
        responsive: true,
      },
      tabs_align_vertical: {
        name: 'tabs_align_vertical',
        type: 'select',
        enum: ['align-top', 'align-center', 'align-bottom'],
        responsive: true,
      },
      default_active_tab: { name: 'default_active_tab', type: 'number', responsive: false },
      swiper_tab_enable: {
        name: 'swiper_tab_enable',
        type: 'switcher',
        enum: ['yes', 'no', ''],
        responsive: false,
        minVersion: '5.4.0',
      },
    },
  },
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function compareSemver(a: string, b: string): number {
  const parse = (v: string): [number, number, number] => {
    const clean = v.trim().replace(/^v/i, '').split(/[-+]/)[0] ?? '0.0.0';
    const parts = clean.split('.').map((p) => {
      const n = Number.parseInt(p, 10);
      return Number.isFinite(n) ? n : 0;
    });
    return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  };
  const [a1, a2, a3] = parse(a);
  const [b1, b2, b3] = parse(b);
  if (a1 !== b1) return a1 < b1 ? -1 : 1;
  if (a2 !== b2) return a2 < b2 ? -1 : 1;
  if (a3 !== b3) return a3 < b3 ? -1 : 1;
  return 0;
}

function getInstalledPluginVersion(
  plugin: InstalledWidgetSchema['plugin'],
  inventory: InstalledPluginsInventory,
): string | undefined {
  if (plugin === 'elementor-pro') {
    return inventory.elementorProVersion ?? DEFAULT_INSTALLED_INVENTORY.elementorProVersion;
  }
  if (plugin === 'the-plus-addons') {
    return inventory.thePlusVersion ?? DEFAULT_INSTALLED_INVENTORY.thePlusVersion;
  }
  return inventory.elementorVersion ?? DEFAULT_INSTALLED_INVENTORY.elementorVersion;
}

const RESPONSIVE_CONTROL_SUFFIX_RE = /^(.+)_(tablet|mobile)$/;

function stripResponsiveSuffix(controlName: string): { baseName: string; breakpoint: 'desktop' | 'tablet' | 'mobile' } {
  const match = RESPONSIVE_CONTROL_SUFFIX_RE.exec(controlName);
  if (!match) {
    return { baseName: controlName, breakpoint: 'desktop' };
  }
  return {
    baseName: match[1]!,
    breakpoint: match[2] as 'tablet' | 'mobile',
  };
}

function isControlValueCompatible(def: InstalledControlDefinition, value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (def.enum && def.enum.length > 0) {
    if (!def.enum.includes(value as string | number | boolean)) {
      return false;
    }
  }
  switch (def.type) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'repeater':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
    case 'slider':
      return isPlainObject(value) && ('size' in value || 'unit' in value);
    case 'dimensions':
      return isPlainObject(value);
    case 'url':
      return typeof value === 'string' || (isPlainObject(value) && typeof value.url === 'string');
    default:
      return true;
  }
}

export function isValidatedTargetWidgetType(widgetType: string): boolean {
  const normalized = widgetType.trim().toLowerCase();
  return normalized === 'nav-menu' || normalized.startsWith('tp_');
}

export function getInstalledWidgetSchema(
  widgetType: string,
  inventory: InstalledPluginsInventory = {},
): InstalledWidgetSchema | undefined {
  const normalized = widgetType.trim().toLowerCase();
  return inventory.schemas?.[normalized] ?? inventory.schemas?.[widgetType] ?? BUILTIN_WIDGET_CONTROL_SCHEMAS[normalized];
}

export function getSupportedValidatedWidgetTypes(
  inventory: InstalledPluginsInventory = {},
): string[] {
  return [
    ...new Set([
      ...Object.keys(BUILTIN_WIDGET_CONTROL_SCHEMAS),
      ...Object.keys(inventory.schemas ?? {}),
    ]),
  ].sort();
}

export function validateSingleWidgetControls(
  node: { id?: unknown; widgetType?: unknown; settings?: unknown },
  inventory: InstalledPluginsInventory = {},
): { issues: WidgetControlIssue[]; checkedControls: number } {
  const widgetType = typeof node.widgetType === 'string' ? node.widgetType.trim() : '';
  const elementId = typeof node.id === 'string' ? node.id : undefined;

  if (!widgetType || !isValidatedTargetWidgetType(widgetType)) {
    return { issues: [], checkedControls: 0 };
  }

  const issues: WidgetControlIssue[] = [];
  const schema = getInstalledWidgetSchema(widgetType, inventory);

  if (!schema) {
    issues.push({
      code: 'UNKNOWN_WIDGET_CONTROL',
      widgetType,
      elementId,
      controlName: '*',
      message: `Widget type '${widgetType}' is not registered in installed widget control schemas.`,
    });
    return { issues, checkedControls: 0 };
  }

  const installedVersion = getInstalledPluginVersion(schema.plugin, inventory);
  if (installedVersion && compareSemver(installedVersion, schema.minPluginVersion) < 0) {
    issues.push({
      code: 'INCOMPATIBLE_WIDGET_CONTROL',
      widgetType,
      elementId,
      controlName: '*',
      installedVersion,
      requiredVersion: `>=${schema.minPluginVersion}`,
      message: `Widget '${widgetType}' requires ${schema.plugin} >= ${schema.minPluginVersion}, but installed version is ${installedVersion}.`,
    });
    return { issues, checkedControls: 0 };
  }

  if (installedVersion && schema.maxPluginVersion && compareSemver(installedVersion, schema.maxPluginVersion) > 0) {
    issues.push({
      code: 'INCOMPATIBLE_WIDGET_CONTROL',
      widgetType,
      elementId,
      controlName: '*',
      installedVersion,
      requiredVersion: `<=${schema.maxPluginVersion}`,
      message: `Widget '${widgetType}' is incompatible with ${schema.plugin} ${installedVersion} (max ${schema.maxPluginVersion}).`,
    });
    return { issues, checkedControls: 0 };
  }

  const settings = isPlainObject(node.settings) ? node.settings : {};
  let checkedControls = 0;

  for (const [rawKey, rawValue] of Object.entries(settings)) {
    checkedControls += 1;
    const { baseName, breakpoint } = stripResponsiveSuffix(rawKey);
    const controlDef = schema.controls[baseName] ?? COMMON_ELEMENTOR_CONTROLS[baseName];

    if (!controlDef) {
      issues.push({
        code: 'UNKNOWN_WIDGET_CONTROL',
        widgetType,
        elementId,
        controlName: rawKey,
        message: `Unknown control '${rawKey}' on widget '${widgetType}' (plugin: ${schema.plugin}).`,
      });
      continue;
    }

    if (breakpoint !== 'desktop' && controlDef.responsive !== true) {
      issues.push({
        code: 'INCOMPATIBLE_WIDGET_CONTROL',
        widgetType,
        elementId,
        controlName: rawKey,
        message: `Control '${baseName}' on widget '${widgetType}' is not responsive and cannot use '${rawKey}'.`,
      });
      continue;
    }

    if (installedVersion && controlDef.minVersion && compareSemver(installedVersion, controlDef.minVersion) < 0) {
      issues.push({
        code: 'INCOMPATIBLE_WIDGET_CONTROL',
        widgetType,
        elementId,
        controlName: rawKey,
        installedVersion,
        requiredVersion: `>=${controlDef.minVersion}`,
        message: `Control '${rawKey}' on '${widgetType}' requires ${schema.plugin} >= ${controlDef.minVersion}, installed is ${installedVersion}.`,
      });
      continue;
    }

    if (installedVersion && controlDef.maxVersion && compareSemver(installedVersion, controlDef.maxVersion) > 0) {
      const replacementHint = controlDef.replacedBy ? ` Use '${controlDef.replacedBy}' instead.` : '';
      issues.push({
        code: 'INCOMPATIBLE_WIDGET_CONTROL',
        widgetType,
        elementId,
        controlName: rawKey,
        installedVersion,
        requiredVersion: `<=${controlDef.maxVersion}`,
        message: `Control '${rawKey}' on '${widgetType}' was deprecated/removed after ${schema.plugin} ${controlDef.maxVersion} (installed: ${installedVersion}).${replacementHint}`,
      });
      continue;
    }

    if (!isControlValueCompatible(controlDef, rawValue)) {
      issues.push({
        code: 'INCOMPATIBLE_WIDGET_CONTROL',
        widgetType,
        elementId,
        controlName: rawKey,
        installedVersion,
        message: `Value ${JSON.stringify(rawValue)} for control '${rawKey}' on '${widgetType}' is incompatible with schema type '${controlDef.type}'${controlDef.enum ? ` (allowed: ${controlDef.enum.join(', ')})` : ''}.`,
      });
    }
  }

  return { issues, checkedControls };
}

/**
 * Walk an Elementor element tree and validate all Nav Menu (`nav-menu`) and
 * The Plus (`tp_*`) widgets against installed control schemas and versions.
 */
export function validateTreeWidgetControls(
  elements: unknown[],
  inventory: InstalledPluginsInventory = {},
): WidgetControlValidationResult {
  const allIssues: WidgetControlIssue[] = [];
  let validatedWidgetCount = 0;
  let validatedControlsCount = 0;

  const visit = (rawNode: unknown): void => {
    if (!isPlainObject(rawNode)) return;
    if (typeof rawNode.widgetType === 'string' && isValidatedTargetWidgetType(rawNode.widgetType)) {
      validatedWidgetCount += 1;
      const res = validateSingleWidgetControls(rawNode, inventory);
      validatedControlsCount += res.checkedControls;
      allIssues.push(...res.issues);
    }
    if (Array.isArray(rawNode.elements)) {
      for (const child of rawNode.elements) {
        visit(child);
      }
    }
  };

  for (const el of Array.isArray(elements) ? elements : []) {
    visit(el);
  }

  return {
    valid: allIssues.length === 0,
    validatedWidgetCount,
    validatedControlsCount,
    issues: allIssues,
  };
}

/**
 * Assert that all `nav-menu` and `tp_*` widgets in an element tree pass
 * installed control schema and version validation before write.
 */
export function assertWidgetControlsValid(
  elements: unknown[],
  inventory: InstalledPluginsInventory = {},
): WidgetControlValidationResult {
  const result = validateTreeWidgetControls(elements, inventory);
  if (!result.valid) {
    const primary = result.issues[0]!;
    throw new WidgetControlValidationError(primary.code, primary.message, {
      widgetType: primary.widgetType,
      elementId: primary.elementId,
      controlName: primary.controlName,
      installedVersion: primary.installedVersion,
      requiredVersion: primary.requiredVersion,
      issues: result.issues,
    });
  }
  return result;
}
