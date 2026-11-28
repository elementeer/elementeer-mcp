export const DELIVERY_MODES = [
  'native-elementor',
  'prototype-embed',
  'bounded-embed',
] as const;

export type DeliveryMode = (typeof DELIVERY_MODES)[number];

export const DELIVERY_ENVIRONMENTS = [
  'production',
  'staging',
  'prototype',
] as const;

export type DeliveryEnvironment = (typeof DELIVERY_ENVIRONMENTS)[number];

export const DEFAULT_DELIVERY_MODE: DeliveryMode = 'native-elementor';
export const DEFAULT_DELIVERY_ENVIRONMENT: DeliveryEnvironment = 'production';

export type BreakpointKey = 'desktop' | 'tablet' | 'mobile';

export interface ResponsiveValue<T> {
  desktop: T;
  tablet?: T;
  mobile?: T;
}

export interface CssMeasure {
  unit: 'px' | 'em' | 'rem' | '%' | 'vw' | 'vh' | 'clamp' | 'auto';
  size: number | string;
}

export interface BoxSpacing {
  unit: 'px' | 'em' | 'rem' | '%';
  top: string | number;
  right: string | number;
  bottom: string | number;
  left: string | number;
  isLinked?: boolean;
}

export interface ResponsiveTypographyControls {
  fontFamily?: string;
  fontSize?: ResponsiveValue<CssMeasure>;
  lineHeight?: ResponsiveValue<CssMeasure>;
  letterSpacing?: ResponsiveValue<CssMeasure>;
  fontWeight?: ResponsiveValue<string | number>;
}

export interface ResponsiveSpacingControls {
  gap?: ResponsiveValue<CssMeasure>;
  padding?: ResponsiveValue<BoxSpacing>;
  margin?: ResponsiveValue<BoxSpacing>;
}

export interface ResponsiveSizingControls {
  width?: ResponsiveValue<CssMeasure>;
  maxWidth?: ResponsiveValue<CssMeasure>;
  minHeight?: ResponsiveValue<CssMeasure>;
}

export type AlignmentValue =
  | 'left'
  | 'center'
  | 'right'
  | 'justify'
  | 'flex-start'
  | 'flex-end'
  | 'space-between';

export type WhiteSpaceValue = 'normal' | 'nowrap' | 'pre' | 'pre-wrap' | 'pre-line';

export interface ResponsiveLayoutControls {
  typography?: ResponsiveTypographyControls;
  spacing?: ResponsiveSpacingControls;
  sizing?: ResponsiveSizingControls;
  alignment?: ResponsiveValue<AlignmentValue>;
  whiteSpace?: ResponsiveValue<WhiteSpaceValue>;
}

export interface TypedWidgetControl {
  widgetType: string;
  controlName: string;
  controlType: string;
  defaultValue?: unknown;
  options?: Array<string | number>;
  responsive?: boolean;
  value: unknown;
  responsiveValues?: ResponsiveValue<unknown>;
  boundGlobalToken?: string;
}

export type ThemeBuilderLocation = 'header' | 'footer' | 'single' | 'archive' | 'popup';

export interface ThemeBuilderCondition {
  type: 'include' | 'exclude';
  group: string;
  subName?: string;
  subId?: string | number;
}

export interface ThemeBuilderTemplateStatus {
  templateId: number;
  title: string;
  location: ThemeBuilderLocation;
  conditions: ThemeBuilderCondition[];
  status: 'active' | 'inactive';
}

export interface ThemeBuilderConflict {
  templateIds: number[];
  location: ThemeBuilderLocation | 'unknown';
  condition: string;
  severity: 'error' | 'warning';
  resolution?: string;
}

export interface RenderedLocationEntry {
  templateId: number | null;
  activeCount: number;
  rendered: boolean;
}

export interface RenderedLocationProof {
  header?: RenderedLocationEntry;
  footer?: RenderedLocationEntry;
  single?: RenderedLocationEntry;
}

export interface ThemeBuilderStatus {
  activeTemplates: ThemeBuilderTemplateStatus[];
  hasConflict: boolean;
  conflicts: ThemeBuilderConflict[];
  renderedLocationProof: RenderedLocationProof;
}

export type ShellOwner = 'theme' | 'template' | 'page' | 'body';

export interface ShellOwnership {
  pageLayout: 'default' | 'elementor_canvas' | 'elementor_header_footer' | 'theme';
  owner: ShellOwner;
  backgroundOwner: ShellOwner;
  backgroundColor?: string;
  cssResetRequired?: boolean;
}

export const FALLBACK_KINDS = ['custom_css', 'html_widget', 'shortcode_widget'] as const;
export type FallbackKind = (typeof FALLBACK_KINDS)[number];

export const FALLBACK_SCOPES = [
  'widget-css',
  'page-scoped-css',
  'theme-compat-css',
  'widget-js-hook',
  'bounded-embed',
  'full-page-html',
] as const;
export type FallbackScope = (typeof FALLBACK_SCOPES)[number];

export interface OperatorOverride {
  operator: string;
  reason: string;
  pageId: number | string;
  contentHash: string;
  scope: string;
  createdAt: string;
}

export interface FallbackBudgetPolicy {
  maxCustomCssBytesPerPage: number;
  maxBoundedHtmlBytesPerWidget: number;
  maxFallbacksPerPage: number;
  allowFullPageHtmlWithoutOverride: false;
}

export interface BoundedFallbackRecord {
  schemaVersion: 'elementeer-fallback-debt/v1';
  fallbackId: string;
  kind: FallbackKind;
  scope: FallbackScope;
  owner: string;
  reason: string;
  bytes: number;
  maxBytes: number;
  pageId: number | string;
  elementId?: string;
  contentHash: string;
  withinBudget: boolean;
  operatorOverride?: OperatorOverride;
}

export interface NativeWidgetSummary {
  totalWidgets: number;
  nativeWidgets: number;
  htmlWidgets: number;
  shortcodeWidgets: number;
  nativeWidgetShare: number;
  isFullPageMonolith: boolean;
  maxHtmlBytesOnPage: number;
}

export interface NativeDeliverySpec {
  schemaVersion: 'elementeer-native-delivery/v1';
  mode: DeliveryMode;
  environment: DeliveryEnvironment;
  pageId: number | string;
  contentHash: string;
  kitId: number | string;
  widgetSummary: NativeWidgetSummary;
  responsiveControls: ResponsiveLayoutControls;
  typedWidgetControls: TypedWidgetControl[];
  themeBuilder: ThemeBuilderStatus;
  shellOwnership: ShellOwnership;
  fallbacks: BoundedFallbackRecord[];
  operatorOverride?: OperatorOverride;
}

export type NativeDeliveryErrorCode =
  | 'INVALID_DELIVERY_MODE'
  | 'INVALID_DELIVERY_ENVIRONMENT'
  | 'PROTOTYPE_EMBED_PRODUCTION_FORBIDDEN';

export class NativeDeliveryError extends Error {
  constructor(
    public readonly code: NativeDeliveryErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'NativeDeliveryError';
  }
}

export interface DeliveryModePolicy {
  mode: DeliveryMode;
  isDefault: boolean;
  requiresNativeWidgets: boolean;
  minNativeWidgetShare: number;
  allowsProductionPublish: boolean;
  allowsFullPageMonolithWithoutOverride: boolean;
  description: string;
}

const DELIVERY_MODE_POLICIES: Record<DeliveryMode, DeliveryModePolicy> = {
  'native-elementor': {
    mode: 'native-elementor',
    isDefault: true,
    requiresNativeWidgets: true,
    minNativeWidgetShare: 0.8,
    allowsProductionPublish: true,
    allowsFullPageMonolithWithoutOverride: false,
    description:
      'Default production delivery mode: builds pages using individually editable native Elementor containers and widgets bound to Kit global tokens and responsive controls.',
  },
  'bounded-embed': {
    mode: 'bounded-embed',
    isDefault: false,
    requiresNativeWidgets: true,
    minNativeWidgetShare: 0.5,
    allowsProductionPublish: true,
    allowsFullPageMonolithWithoutOverride: false,
    description:
      'Explicit scoped embed mode: permits bounded HTML/shortcode islands with declared owner, reason, and strict byte budgets alongside native Elementor structure.',
  },
  'prototype-embed': {
    mode: 'prototype-embed',
    isDefault: false,
    requiresNativeWidgets: false,
    minNativeWidgetShare: 0,
    allowsProductionPublish: false,
    allowsFullPageMonolithWithoutOverride: true,
    description:
      'Explicit non-production prototyping mode: permits rapid HTML/embed prototypes in staging or prototype environments only; blocked from production publish.',
  },
};

export function isValidDeliveryMode(value: unknown): value is DeliveryMode {
  return typeof value === 'string' && (DELIVERY_MODES as readonly string[]).includes(value);
}

export function isValidDeliveryEnvironment(value: unknown): value is DeliveryEnvironment {
  return (
    typeof value === 'string' &&
    (DELIVERY_ENVIRONMENTS as readonly string[]).includes(value)
  );
}

/**
 * Resolve page-build delivery mode, enforcing 'native-elementor' as the default.
 */
export function resolveDeliveryMode(mode?: unknown): DeliveryMode {
  if (mode === undefined || mode === null || mode === '') {
    return DEFAULT_DELIVERY_MODE;
  }
  if (!isValidDeliveryMode(mode)) {
    throw new NativeDeliveryError(
      'INVALID_DELIVERY_MODE',
      `Invalid delivery mode ${JSON.stringify(mode)}. Expected one of: ${DELIVERY_MODES.join(', ')}.`,
      { mode, allowedModes: DELIVERY_MODES },
    );
  }
  return mode;
}

/**
 * Resolve delivery environment, enforcing 'production' as the default.
 */
export function resolveDeliveryEnvironment(environment?: unknown): DeliveryEnvironment {
  if (environment === undefined || environment === null || environment === '') {
    return DEFAULT_DELIVERY_ENVIRONMENT;
  }
  if (!isValidDeliveryEnvironment(environment)) {
    throw new NativeDeliveryError(
      'INVALID_DELIVERY_ENVIRONMENT',
      `Invalid delivery environment ${JSON.stringify(environment)}. Expected one of: ${DELIVERY_ENVIRONMENTS.join(', ')}.`,
      { environment, allowedEnvironments: DELIVERY_ENVIRONMENTS },
    );
  }
  return environment;
}

export function getDeliveryModePolicy(mode?: unknown): DeliveryModePolicy {
  const resolved = resolveDeliveryMode(mode);
  return DELIVERY_MODE_POLICIES[resolved];
}

export function isProductionNativeMode(
  mode?: unknown,
  environment?: unknown,
): boolean {
  return (
    resolveDeliveryMode(mode) === 'native-elementor' &&
    resolveDeliveryEnvironment(environment) === 'production'
  );
}

export function assertModeEnvironmentCompatible(
  mode: DeliveryMode,
  environment: DeliveryEnvironment,
): void {
  if (mode === 'prototype-embed' && environment === 'production') {
    throw new NativeDeliveryError(
      'PROTOTYPE_EMBED_PRODUCTION_FORBIDDEN',
      "Delivery mode 'prototype-embed' is forbidden in 'production' environment; use 'native-elementor' or 'bounded-embed'.",
      { mode, environment },
    );
  }
}

export interface BuildNativeDeliverySpecInput {
  pageId: number | string;
  contentHash: string;
  kitId?: number | string;
  mode?: DeliveryMode;
  environment?: DeliveryEnvironment;
  widgetSummary: NativeWidgetSummary;
  responsiveControls?: ResponsiveLayoutControls;
  typedWidgetControls?: TypedWidgetControl[];
  themeBuilder?: ThemeBuilderStatus;
  shellOwnership?: ShellOwnership;
  fallbacks?: BoundedFallbackRecord[];
  operatorOverride?: OperatorOverride;
}

export function buildNativeDeliverySpec(
  input: BuildNativeDeliverySpecInput,
): NativeDeliverySpec {
  const mode = resolveDeliveryMode(input.mode);
  const environment = resolveDeliveryEnvironment(input.environment);

  const spec: NativeDeliverySpec = {
    schemaVersion: 'elementeer-native-delivery/v1',
    mode,
    environment,
    pageId: input.pageId,
    contentHash: input.contentHash,
    kitId: input.kitId ?? 1,
    widgetSummary: input.widgetSummary,
    responsiveControls: input.responsiveControls ?? {},
    typedWidgetControls: input.typedWidgetControls ?? [],
    themeBuilder: input.themeBuilder ?? {
      activeTemplates: [],
      hasConflict: false,
      conflicts: [],
      renderedLocationProof: {},
    },
    shellOwnership: input.shellOwnership ?? {
      pageLayout: 'elementor_header_footer',
      owner: 'page',
      backgroundOwner: 'theme',
    },
    fallbacks: input.fallbacks ?? [],
  };

  if (input.operatorOverride) {
    spec.operatorOverride = input.operatorOverride;
  }

  return spec;
}
