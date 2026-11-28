import { createHash } from 'node:crypto';
import {
  buildNativeDeliverySpec,
  DEFAULT_DELIVERY_ENVIRONMENT,
  DEFAULT_DELIVERY_MODE,
  getDeliveryModePolicy,
  resolveDeliveryEnvironment,
  resolveDeliveryMode,
  type BoundedFallbackRecord,
  type DeliveryEnvironment,
  type DeliveryMode,
  type FallbackBudgetPolicy,
  type FallbackScope,
  type NativeDeliverySpec,
  type NativeWidgetSummary,
  type OperatorOverride,
  type ResponsiveLayoutControls,
  type ShellOwnership,
  type ThemeBuilderStatus,
  type TypedWidgetControl,
} from './native-delivery-mode.js';

export type PublishGateDecision = 'allow' | 'block';
export type EditabilityReasonSeverity = 'info' | 'warning' | 'error';

export interface EditabilityReason {
  code: string;
  severity: EditabilityReasonSeverity;
  message: string;
  elementId?: string;
}

export interface EditabilityReport {
  schemaVersion: 'elementeer-editability/v1';
  pageId: number | string;
  contentHash: string;
  mode: DeliveryMode;
  nativeWidgetShare: number;
  totalWidgets: number;
  htmlOrShortcodeWidgets: number;
  individuallyEditableCount: number;
  responsiveSettingsValid: boolean;
  globalTokensBound: boolean;
  boundedFallbacks: BoundedFallbackRecord[];
  publishGateDecision: PublishGateDecision;
  typedReasons: EditabilityReason[];
  override?: OperatorOverride;
  evaluatedAt: string;
}

export type EditabilityGateErrorCode =
  | 'FULL_PAGE_HTML_MONOLITH_FORBIDDEN'
  | 'MONOLITH_PUBLISH_FORBIDDEN'
  | 'EDITABILITY_GATE_VIOLATION'
  | 'EDITABILITY_GATE_MISSING'
  | 'EDITABILITY_GATE_STALE_HASH'
  | 'EDITABILITY_GATE_BLOCKED'
  | 'EDITABILITY_GATE_EXPIRED'
  | 'FALLBACK_BUDGET_EXCEEDED'
  | 'FALLBACK_OWNER_REQUIRED'
  | 'INVALID_OPERATOR_OVERRIDE'
  | 'OVERRIDE_HASH_OR_PAGE_MISMATCH'
  | 'INVALID_DELIVERY_MODE'
  | 'PROTOTYPE_EMBED_PRODUCTION_FORBIDDEN'
  | 'THEME_BUILDER_CONFLICT';

export class EditabilityGateError extends Error {
  constructor(
    public readonly code: EditabilityGateErrorCode,
    message: string,
    public readonly details?: {
      pageId?: number | string;
      contentHash?: string;
      expectedHash?: string;
      report?: EditabilityReport;
      reasons?: EditabilityReason[];
    },
  ) {
    super(`[${code}] ${message}`);
    this.name = 'EditabilityGateError';
  }
}

export const DEFAULT_FALLBACK_BUDGET_POLICY: FallbackBudgetPolicy = {
  maxCustomCssBytesPerPage: 8192,
  maxBoundedHtmlBytesPerWidget: 4096,
  maxFallbacksPerPage: 5,
  allowFullPageHtmlWithoutOverride: false,
};

export const DEFAULT_GATE_TTL_MS = 30 * 60 * 1000;

export interface FallbackMetadataEntry {
  owner?: string;
  reason?: string;
  scope?: FallbackScope;
}

export interface EvaluatePageEditabilityInput {
  pageId: number | string;
  elements: unknown[];
  pageSettings?: Record<string, unknown>;
  kitId?: number | string;
  mode?: DeliveryMode | unknown;
  environment?: DeliveryEnvironment | unknown;
  fallbackMetadata?: Record<string, FallbackMetadataEntry>;
  defaultFallbackOwner?: string;
  defaultFallbackReason?: string;
  policy?: Partial<FallbackBudgetPolicy>;
  override?: unknown;
  responsiveControls?: ResponsiveLayoutControls;
  typedWidgetControls?: TypedWidgetControl[];
  themeBuilder?: ThemeBuilderStatus;
  shellOwnership?: ShellOwnership;
  responsiveSettingsValid?: boolean;
  globalTokensBound?: boolean;
  evaluatedAt?: string;
}

export interface EditabilityEvaluationBundle {
  report: EditabilityReport;
  spec: NativeDeliverySpec;
  widgetSummary: NativeWidgetSummary;
  environment: DeliveryEnvironment;
}

interface ElementorNode {
  id?: unknown;
  elType?: unknown;
  widgetType?: unknown;
  settings?: Record<string, unknown>;
  elements?: unknown[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Recursively canonicalize values with sorted object keys for deterministic hashing.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Compute deterministic SHA-256 contentHash over page elements and optional page settings.
 */
export function computeContentHash(
  elements: unknown[],
  settings?: Record<string, unknown>,
): string {
  const payload = {
    elements: Array.isArray(elements) ? elements : [],
    settings: isPlainObject(settings) ? settings : {},
  };
  return createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex');
}

const UNBOUNDED_OVERRIDE_SCOPES = new Set(['unbounded', '*', 'all', 'global', 'site-wide']);

export type OverrideValidationResult =
  | { valid: true; override: OperatorOverride }
  | {
      valid: false;
      code: 'INVALID_OPERATOR_OVERRIDE' | 'OVERRIDE_HASH_OR_PAGE_MISMATCH';
      message: string;
    };

export function validateOperatorOverride(
  rawOverride: unknown,
  expectedPageId: number | string,
  expectedHash: string,
): OverrideValidationResult {
  if (!isPlainObject(rawOverride)) {
    return {
      valid: false,
      code: 'INVALID_OPERATOR_OVERRIDE',
      message: 'OperatorOverride must be a non-null object.',
    };
  }

  const requiredFields = ['operator', 'reason', 'pageId', 'contentHash', 'scope', 'createdAt'] as const;
  for (const field of requiredFields) {
    const val = rawOverride[field];
    if (val === undefined || val === null || val === '') {
      return {
        valid: false,
        code: 'INVALID_OPERATOR_OVERRIDE',
        message: `OperatorOverride missing required field '${field}'.`,
      };
    }
  }

  if (!isNonEmptyString(rawOverride.operator)) {
    return {
      valid: false,
      code: 'INVALID_OPERATOR_OVERRIDE',
      message: 'OperatorOverride.operator must be a non-empty string.',
    };
  }
  if (!isNonEmptyString(rawOverride.reason)) {
    return {
      valid: false,
      code: 'INVALID_OPERATOR_OVERRIDE',
      message: 'OperatorOverride.reason must be a non-empty string.',
    };
  }
  if (!isNonEmptyString(rawOverride.scope)) {
    return {
      valid: false,
      code: 'INVALID_OPERATOR_OVERRIDE',
      message: 'OperatorOverride.scope must be a non-empty bounded scope string.',
    };
  }
  if (UNBOUNDED_OVERRIDE_SCOPES.has(rawOverride.scope.trim().toLowerCase())) {
    return {
      valid: false,
      code: 'INVALID_OPERATOR_OVERRIDE',
      message: `OperatorOverride.scope '${rawOverride.scope}' is unbounded; an explicit bounded scope is required.`,
    };
  }
  if (!isNonEmptyString(rawOverride.createdAt) || Number.isNaN(Date.parse(rawOverride.createdAt))) {
    return {
      valid: false,
      code: 'INVALID_OPERATOR_OVERRIDE',
      message: 'OperatorOverride.createdAt must be a valid ISO-8601 date-time string.',
    };
  }
  if (String(rawOverride.pageId) !== String(expectedPageId)) {
    return {
      valid: false,
      code: 'OVERRIDE_HASH_OR_PAGE_MISMATCH',
      message: `OperatorOverride.pageId (${String(rawOverride.pageId)}) does not match pageId (${String(expectedPageId)}).`,
    };
  }
  if (rawOverride.contentHash !== expectedHash) {
    return {
      valid: false,
      code: 'OVERRIDE_HASH_OR_PAGE_MISMATCH',
      message: `OperatorOverride.contentHash (${String(rawOverride.contentHash)}) does not match current contentHash (${expectedHash}).`,
    };
  }

  return {
    valid: true,
    override: {
      operator: rawOverride.operator.trim(),
      reason: rawOverride.reason.trim(),
      pageId: rawOverride.pageId as number | string,
      contentHash: rawOverride.contentHash,
      scope: rawOverride.scope.trim(),
      createdAt: rawOverride.createdAt,
    },
  };
}

function hasFullPageDocumentMarkers(rawHtml: string): boolean {
  const lower = rawHtml.toLowerCase();
  return (
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('<body') ||
    (lower.includes('<style') && lower.includes('<main'))
  );
}

const RESPONSIVE_SUFFIX_RE = /^(.+)_(tablet|mobile)$/;

function checkResponsiveNodeSettings(settings: Record<string, unknown>): boolean {
  for (const [key, val] of Object.entries(settings)) {
    const match = RESPONSIVE_SUFFIX_RE.exec(key);
    if (match) {
      const baseKey = match[1]!;
      // If a tablet/mobile override sets a structured size object without a unit or desktop base when base is explicitly invalid
      if (isPlainObject(val) && 'size' in val && val.size === '') {
        return false;
      }
      if (baseKey in settings && settings[baseKey] === undefined) {
        return false;
      }
      if (!(baseKey in settings) && isPlainObject(val) && Object.keys(val).length === 0) {
        return false;
      }
    }
    if (isPlainObject(val) && ('tablet' in val || 'mobile' in val) && !('desktop' in val)) {
      return false;
    }
  }
  return true;
}

function checkResponsiveLayoutControls(rc?: ResponsiveLayoutControls): boolean {
  if (!rc) return true;
  const checkResp = (val: unknown): boolean => {
    if (!isPlainObject(val)) return false;
    return 'desktop' in val && val.desktop !== undefined;
  };
  if (rc.typography) {
    for (const k of ['fontSize', 'lineHeight', 'letterSpacing', 'fontWeight'] as const) {
      if (rc.typography[k] !== undefined && !checkResp(rc.typography[k])) return false;
    }
  }
  if (rc.spacing) {
    for (const k of ['gap', 'padding', 'margin'] as const) {
      if (rc.spacing[k] !== undefined && !checkResp(rc.spacing[k])) return false;
    }
  }
  if (rc.sizing) {
    for (const k of ['width', 'maxWidth', 'minHeight'] as const) {
      if (rc.sizing[k] !== undefined && !checkResp(rc.sizing[k])) return false;
    }
  }
  if (rc.alignment !== undefined && !checkResp(rc.alignment)) return false;
  if (rc.whiteSpace !== undefined && !checkResp(rc.whiteSpace)) return false;
  return true;
}

const COLOR_OR_TYPO_INLINE_KEYS = [
  'title_color',
  'text_color',
  'button_text_color',
  'background_color',
  'color',
  'typography_font_family',
];

function checkWidgetGlobalTokenBinding(settings: Record<string, unknown>): boolean {
  const globals = isPlainObject(settings.__globals__) ? settings.__globals__ : {};
  for (const key of COLOR_OR_TYPO_INLINE_KEYS) {
    const val = settings[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      if (!isNonEmptyString(globals[key])) {
        return false;
      }
    }
  }
  return true;
}

function resolveFallbackMeta(
  elementId: string,
  settings: Record<string, unknown>,
  input: EvaluatePageEditabilityInput,
): FallbackMetadataEntry {
  const fromMap = input.fallbackMetadata?.[elementId];
  const fromSettings = isPlainObject(settings._elementeer_fallback)
    ? (settings._elementeer_fallback as FallbackMetadataEntry)
    : undefined;
  return {
    owner: fromMap?.owner ?? fromSettings?.owner ?? input.defaultFallbackOwner,
    reason: fromMap?.reason ?? fromSettings?.reason ?? input.defaultFallbackReason,
    scope: fromMap?.scope ?? fromSettings?.scope,
  };
}

/**
 * Evaluate Elementor page data against native-delivery & fallback-debt contracts
 * and produce both an elementeer-editability/v1 EditabilityReport and
 * elementeer-native-delivery/v1 NativeDeliverySpec.
 */
export function evaluateNativeDeliveryAndEditability(
  input: EvaluatePageEditabilityInput,
): EditabilityEvaluationBundle {
  const mode = resolveDeliveryMode(input.mode);
  const environment = resolveDeliveryEnvironment(input.environment);
  const policy: FallbackBudgetPolicy = {
    ...DEFAULT_FALLBACK_BUDGET_POLICY,
    ...(input.policy ?? {}),
    allowFullPageHtmlWithoutOverride: false,
  };

  const elements = Array.isArray(input.elements) ? input.elements : [];
  const contentHash = computeContentHash(elements, input.pageSettings);
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();

  let nativeWidgets = 0;
  let htmlWidgets = 0;
  let shortcodeWidgets = 0;
  let individuallyEditableCount = 0;
  let maxHtmlBytesOnPage = 0;
  let totalCustomCssBytes = 0;
  let detectedResponsiveValid = checkResponsiveLayoutControls(input.responsiveControls);
  let detectedGlobalTokensBound = true;
  let hasFullPageMarkers = false;

  interface RawFallbackCandidate {
    fallbackId: string;
    kind: 'custom_css' | 'html_widget' | 'shortcode_widget';
    scope: FallbackScope;
    explicitScope: boolean;
    owner: string;
    reason: string;
    bytes: number;
    maxBytes: number;
    elementId?: string;
    withinBudget: boolean;
  }

  const candidates: RawFallbackCandidate[] = [];
  let seq = 0;

  const visit = (rawNode: unknown): void => {
    if (!isPlainObject(rawNode)) return;
    const node = rawNode as ElementorNode;
    const settings = isPlainObject(node.settings) ? node.settings : {};
    const nodeId = isNonEmptyString(node.id) ? node.id.trim() : undefined;

    if (!checkResponsiveNodeSettings(settings)) {
      detectedResponsiveValid = false;
    }

    if (isNonEmptyString(settings.custom_css)) {
      seq += 1;
      const cssBytes = Math.max(1, Buffer.byteLength(settings.custom_css, 'utf8'));
      totalCustomCssBytes += cssBytes;
      const eid = nodeId ?? `custom-css-${seq}`;
      const meta = resolveFallbackMeta(eid, settings, input);
      candidates.push({
        fallbackId: `fb-css-${seq}`,
        kind: 'custom_css',
        scope: meta.scope ?? (isNonEmptyString(node.widgetType) ? 'widget-css' : 'page-scoped-css'),
        explicitScope: meta.scope !== undefined,
        owner: meta.owner ?? '',
        reason: meta.reason ?? 'Element custom CSS fallback',
        bytes: cssBytes,
        maxBytes: policy.maxCustomCssBytesPerPage,
        elementId: nodeId,
        withinBudget: totalCustomCssBytes <= policy.maxCustomCssBytesPerPage,
      });
    }

    const widgetType = isNonEmptyString(node.widgetType) ? node.widgetType.trim() : null;
    const isWidget = node.elType === 'widget' || widgetType !== null;

    if (isWidget) {
      if (widgetType === 'html') {
        htmlWidgets += 1;
        seq += 1;
        const rawHtml =
          typeof settings.html === 'string'
            ? settings.html
            : typeof settings.custom_html === 'string'
              ? settings.custom_html
              : typeof settings.content === 'string'
                ? settings.content
                : '';
        const bytes = Math.max(1, Buffer.byteLength(rawHtml, 'utf8'));
        if (bytes > maxHtmlBytesOnPage) maxHtmlBytesOnPage = bytes;
        if (hasFullPageDocumentMarkers(rawHtml)) hasFullPageMarkers = true;

        const eid = nodeId ?? `html-${seq}`;
        const meta = resolveFallbackMeta(eid, settings, input);
        const scope: FallbackScope =
          meta.scope ?? (hasFullPageDocumentMarkers(rawHtml) ? 'full-page-html' : 'bounded-embed');
        candidates.push({
          fallbackId: `fb-html-${seq}`,
          kind: 'html_widget',
          scope,
          explicitScope: meta.scope !== undefined,
          owner: meta.owner ?? '',
          reason: meta.reason ?? 'HTML widget embed',
          bytes,
          maxBytes: policy.maxBoundedHtmlBytesPerWidget,
          elementId: nodeId,
          withinBudget: bytes <= policy.maxBoundedHtmlBytesPerWidget && scope !== 'full-page-html',
        });
      } else if (widgetType === 'shortcode') {
        shortcodeWidgets += 1;
        seq += 1;
        const rawShortcode = typeof settings.shortcode === 'string' ? settings.shortcode : '';
        const bytes = Math.max(1, Buffer.byteLength(rawShortcode, 'utf8'));
        if (bytes > maxHtmlBytesOnPage) maxHtmlBytesOnPage = bytes;

        const eid = nodeId ?? `shortcode-${seq}`;
        const meta = resolveFallbackMeta(eid, settings, input);
        const scope: FallbackScope = meta.scope ?? 'bounded-embed';
        candidates.push({
          fallbackId: `fb-sc-${seq}`,
          kind: 'shortcode_widget',
          scope,
          explicitScope: meta.scope !== undefined,
          owner: meta.owner ?? '',
          reason: meta.reason ?? 'Shortcode widget embed',
          bytes,
          maxBytes: policy.maxBoundedHtmlBytesPerWidget,
          elementId: nodeId,
          withinBudget: bytes <= policy.maxBoundedHtmlBytesPerWidget && scope !== 'full-page-html',
        });
      } else {
        nativeWidgets += 1;
        if (nodeId) {
          individuallyEditableCount += 1;
        }
        if (!checkWidgetGlobalTokenBinding(settings)) {
          detectedGlobalTokensBound = false;
        }
      }
    }

    if (Array.isArray(node.elements)) {
      for (const child of node.elements) {
        visit(child);
      }
    }
  };

  for (const el of elements) {
    visit(el);
  }

  if (isPlainObject(input.pageSettings) && isNonEmptyString(input.pageSettings.custom_css)) {
    seq += 1;
    const cssBytes = Math.max(1, Buffer.byteLength(input.pageSettings.custom_css, 'utf8'));
    totalCustomCssBytes += cssBytes;
    const meta = resolveFallbackMeta('page-settings', input.pageSettings, input);
    candidates.push({
      fallbackId: `fb-page-css-${seq}`,
      kind: 'custom_css',
      scope: meta.scope ?? 'page-scoped-css',
      explicitScope: meta.scope !== undefined,
      owner: meta.owner ?? '',
      reason: meta.reason ?? 'Page-scoped custom CSS fallback',
      bytes: cssBytes,
      maxBytes: policy.maxCustomCssBytesPerPage,
      withinBudget: totalCustomCssBytes <= policy.maxCustomCssBytesPerPage,
    });
  }

  if (Array.isArray(input.typedWidgetControls)) {
    for (const ctrl of input.typedWidgetControls) {
      const isColorOrTypo = /color|typography|font/i.test(ctrl.controlName);
      if (isColorOrTypo && !isNonEmptyString(ctrl.boundGlobalToken)) {
        detectedGlobalTokensBound = false;
      }
      if (ctrl.responsive && ctrl.responsiveValues && !('desktop' in ctrl.responsiveValues)) {
        detectedResponsiveValid = false;
      }
    }
  }

  const totalWidgets = nativeWidgets + htmlWidgets + shortcodeWidgets;
  const htmlOrShortcodeWidgets = htmlWidgets + shortcodeWidgets;
  const nativeWidgetShare =
    totalWidgets > 0 ? Number((nativeWidgets / totalWidgets).toFixed(4)) : 0;

  const isFullPageMonolith =
    (totalWidgets > 0 && nativeWidgets === 0 && htmlOrShortcodeWidgets > 0) ||
    candidates.some((c) => c.scope === 'full-page-html') ||
    (hasFullPageMarkers && nativeWidgetShare < 0.8);

  if (isFullPageMonolith) {
    for (const c of candidates) {
      if ((c.kind === 'html_widget' || c.kind === 'shortcode_widget') && !c.explicitScope) {
        c.scope = 'full-page-html';
        c.withinBudget = false;
      }
    }
  }

  const responsiveSettingsValid =
    input.responsiveSettingsValid !== undefined
      ? input.responsiveSettingsValid
      : detectedResponsiveValid;
  const globalTokensBound =
    input.globalTokensBound !== undefined
      ? input.globalTokensBound
      : detectedGlobalTokensBound;

  const typedReasons: EditabilityReason[] = [];
  let validOverride: OperatorOverride | undefined;

  if (input.override !== undefined) {
    const ovResult = validateOperatorOverride(input.override, input.pageId, contentHash);
    if (ovResult.valid) {
      validOverride = ovResult.override;
    } else {
      typedReasons.push({
        code: ovResult.code,
        severity: 'error',
        message: ovResult.message,
      });
    }
  }

  const boundedFallbacks: BoundedFallbackRecord[] = candidates.map((c) => {
    const record: BoundedFallbackRecord = {
      schemaVersion: 'elementeer-fallback-debt/v1',
      fallbackId: c.fallbackId,
      kind: c.kind,
      scope: c.scope,
      owner: c.owner,
      reason: c.reason,
      bytes: c.bytes,
      maxBytes: c.maxBytes,
      pageId: input.pageId,
      contentHash,
      withinBudget: c.withinBudget,
    };
    if (c.elementId) record.elementId = c.elementId;
    if (validOverride && (c.scope === 'full-page-html' || !c.withinBudget)) {
      record.operatorOverride = validOverride;
    }
    return record;
  });

  const policyForMode = getDeliveryModePolicy(mode);
  let blocked = false;

  if (typedReasons.some((r) => r.severity === 'error')) {
    blocked = true;
  }

  if (mode === 'prototype-embed' && environment === 'production') {
    blocked = true;
    typedReasons.push({
      code: 'PROTOTYPE_EMBED_PRODUCTION_FORBIDDEN',
      severity: 'error',
      message:
        "Delivery mode 'prototype-embed' cannot be published in 'production' environment.",
    });
  }

  if (isFullPageMonolith && mode !== 'prototype-embed' && !validOverride) {
    blocked = true;
    typedReasons.push({
      code: 'FULL_PAGE_HTML_MONOLITH_FORBIDDEN',
      severity: 'error',
      message: `Full-page HTML/shortcode monolith is forbidden in '${mode}' (${environment}) mode without bounded scope and audited OperatorOverride.`,
    });
  } else if (totalWidgets === 0 && mode !== 'prototype-embed') {
    blocked = true;
    typedReasons.push({
      code: 'EDITABILITY_GATE_VIOLATION',
      severity: 'error',
      message: 'Page has 0 widgets and cannot satisfy native editability gate.',
    });
  } else if (
    mode !== 'prototype-embed' &&
    nativeWidgetShare < policyForMode.minNativeWidgetShare &&
    !validOverride
  ) {
    blocked = true;
    typedReasons.push({
      code: 'MONOLITH_PUBLISH_FORBIDDEN',
      severity: 'error',
      message: `nativeWidgetShare (${nativeWidgetShare}) is below required threshold (${policyForMode.minNativeWidgetShare}) for '${mode}' without audited OperatorOverride.`,
    });
  }

  for (const fb of boundedFallbacks) {
    if (!isNonEmptyString(fb.owner)) {
      blocked = true;
      typedReasons.push({
        code: 'FALLBACK_OWNER_REQUIRED',
        severity: 'error',
        message: `Fallback '${fb.fallbackId}' (${fb.kind}) is missing a required non-empty owner.`,
        elementId: fb.elementId,
      });
    }
    if (!fb.withinBudget && !validOverride) {
      blocked = true;
      typedReasons.push({
        code: 'FALLBACK_BUDGET_EXCEEDED',
        severity: 'error',
        message: `Fallback '${fb.fallbackId}' (${fb.bytes} bytes) exceeds maxBytes (${fb.maxBytes}) or violates scope '${fb.scope}' without audited OperatorOverride.`,
        elementId: fb.elementId,
      });
    }
  }

  if (boundedFallbacks.length > policy.maxFallbacksPerPage && !validOverride) {
    blocked = true;
    typedReasons.push({
      code: 'FALLBACK_BUDGET_EXCEEDED',
      severity: 'error',
      message: `Fallback count (${boundedFallbacks.length}) exceeds maxFallbacksPerPage (${policy.maxFallbacksPerPage}).`,
    });
  }

  if (mode === 'native-elementor' && (!responsiveSettingsValid || !globalTokensBound) && !validOverride) {
    blocked = true;
    typedReasons.push({
      code: 'EDITABILITY_GATE_VIOLATION',
      severity: 'error',
      message: `Native editability gate failed: responsiveSettingsValid=${responsiveSettingsValid}, globalTokensBound=${globalTokensBound}.`,
    });
  }

  if (input.themeBuilder && (input.themeBuilder.hasConflict || input.themeBuilder.conflicts.length > 0)) {
    blocked = true;
    typedReasons.push({
      code: 'THEME_BUILDER_CONFLICT',
      severity: 'error',
      message: 'Unresolved Theme Builder condition conflict detected.',
    });
  }

  if (!blocked) {
    typedReasons.push({
      code: validOverride ? 'AUDITED_OVERRIDE_APPLIED' : 'NATIVE_EDITABILITY_VERIFIED',
      severity: 'info',
      message: validOverride
        ? `Publish gate allowed via audited OperatorOverride by '${validOverride.operator}' (scope: '${validOverride.scope}').`
        : `Page satisfies '${mode}' editability gate (nativeWidgetShare=${nativeWidgetShare}, editable=${individuallyEditableCount}/${totalWidgets}).`,
    });
  }

  const report: EditabilityReport = {
    schemaVersion: 'elementeer-editability/v1',
    pageId: input.pageId,
    contentHash,
    mode,
    nativeWidgetShare,
    totalWidgets,
    htmlOrShortcodeWidgets,
    individuallyEditableCount,
    responsiveSettingsValid,
    globalTokensBound,
    boundedFallbacks,
    publishGateDecision: blocked ? 'block' : 'allow',
    typedReasons,
    evaluatedAt,
  };

  if (validOverride) {
    report.override = validOverride;
  }

  const widgetSummary: NativeWidgetSummary = {
    totalWidgets,
    nativeWidgets,
    htmlWidgets,
    shortcodeWidgets,
    nativeWidgetShare,
    isFullPageMonolith,
    maxHtmlBytesOnPage,
  };

  const spec = buildNativeDeliverySpec({
    pageId: input.pageId,
    contentHash,
    kitId: input.kitId,
    mode,
    environment,
    widgetSummary,
    responsiveControls: input.responsiveControls,
    typedWidgetControls: input.typedWidgetControls,
    themeBuilder: input.themeBuilder,
    shellOwnership: input.shellOwnership,
    fallbacks: boundedFallbacks,
    operatorOverride: validOverride,
  });

  return {
    report,
    spec,
    widgetSummary,
    environment,
  };
}

export function evaluatePageEditability(
  input: EvaluatePageEditabilityInput,
): EditabilityReport {
  return evaluateNativeDeliveryAndEditability(input).report;
}

/**
 * In-memory hash-bound EditabilityGate store.
 * Every 'allow' decision is bound strictly to exact (pageId, contentHash) and TTL.
 */
export class EditabilityGateStore {
  private readonly reports = new Map<string, EditabilityReport>();

  constructor(private readonly maxAgeMs: number = DEFAULT_GATE_TTL_MS) {}

  record(report: EditabilityReport): EditabilityReport {
    this.reports.set(String(report.pageId), report);
    return report;
  }

  get(pageId: number | string): EditabilityReport | undefined {
    return this.reports.get(String(pageId));
  }

  clear(pageId?: number | string): void {
    if (pageId === undefined) {
      this.reports.clear();
      return;
    }
    this.reports.delete(String(pageId));
  }

  assertAllowed(params: {
    pageId: number | string;
    contentHash: string;
    nowMs?: number;
  }): EditabilityReport {
    const key = String(params.pageId);
    const report = this.reports.get(key);
    if (!report) {
      throw new EditabilityGateError(
        'EDITABILITY_GATE_MISSING',
        `No editability gate report recorded for page ${key}. Run evaluate_page_editability before publishing or assigning homepage.`,
        { pageId: params.pageId, contentHash: params.contentHash },
      );
    }

    if (report.contentHash !== params.contentHash) {
      throw new EditabilityGateError(
        'EDITABILITY_GATE_STALE_HASH',
        `Editability report for page ${key} is stale (evaluated hash ${report.contentHash}, current hash ${params.contentHash}). Re-evaluate editability before publish or homepage assignment.`,
        {
          pageId: params.pageId,
          contentHash: params.contentHash,
          expectedHash: report.contentHash,
          report,
        },
      );
    }

    const evaluatedMs = Date.parse(report.evaluatedAt);
    const nowMs = params.nowMs ?? Date.now();
    if (Number.isNaN(evaluatedMs) || nowMs - evaluatedMs > this.maxAgeMs) {
      throw new EditabilityGateError(
        'EDITABILITY_GATE_EXPIRED',
        `Editability report for page ${key} has expired (evaluatedAt=${report.evaluatedAt}). Re-evaluate editability before publish or homepage assignment.`,
        { pageId: params.pageId, contentHash: params.contentHash, report },
      );
    }

    if (report.publishGateDecision !== 'allow') {
      const primaryReason = report.typedReasons.find((r) => r.severity === 'error');
      const code = (primaryReason?.code as EditabilityGateErrorCode | undefined) ?? 'EDITABILITY_GATE_BLOCKED';
      throw new EditabilityGateError(
        code,
        primaryReason?.message ?? `Publish gate decision for page ${key} is 'block'.`,
        {
          pageId: params.pageId,
          contentHash: params.contentHash,
          report,
          reasons: report.typedReasons,
        },
      );
    }

    return report;
  }
}

export const defaultEditabilityGateStore = new EditabilityGateStore();

export function evaluateAndRecordEditability(
  input: EvaluatePageEditabilityInput,
  store: EditabilityGateStore = defaultEditabilityGateStore,
): EditabilityReport {
  const report = evaluatePageEditability(input);
  return store.record(report);
}

/**
 * Guard page-write operations against unapproved full-page HTML/shortcode monoliths
 * and invalid fallback debt in native-elementor production mode.
 */
export function assertNativeWriteAllowed(
  input: EvaluatePageEditabilityInput,
): EditabilityEvaluationBundle {
  const mode = resolveDeliveryMode(input.mode ?? DEFAULT_DELIVERY_MODE);
  const environment = resolveDeliveryEnvironment(input.environment ?? DEFAULT_DELIVERY_ENVIRONMENT);
  const bundle = evaluateNativeDeliveryAndEditability({
    ...input,
    mode,
    environment,
  });

  if (mode === 'native-elementor' && environment === 'production') {
    const blockingCodes = new Set([
      'FULL_PAGE_HTML_MONOLITH_FORBIDDEN',
      'MONOLITH_PUBLISH_FORBIDDEN',
      'FALLBACK_BUDGET_EXCEEDED',
      'FALLBACK_OWNER_REQUIRED',
      'INVALID_OPERATOR_OVERRIDE',
      'OVERRIDE_HASH_OR_PAGE_MISMATCH',
    ]);
    const blockingReason = bundle.report.typedReasons.find(
      (r) => r.severity === 'error' && blockingCodes.has(r.code),
    );
    if (blockingReason) {
      throw new EditabilityGateError(
        blockingReason.code as EditabilityGateErrorCode,
        blockingReason.message,
        {
          pageId: input.pageId,
          contentHash: bundle.report.contentHash,
          report: bundle.report,
          reasons: bundle.report.typedReasons,
        },
      );
    }
  }

  return bundle;
}

export interface PageDataReader {
  getPageData(params: { id: number }): Promise<{
    post_id?: number;
    elementor_data?: unknown[];
    page_settings?: Record<string, unknown>;
  }>;
}

export async function assertPublishOrHomepageAllowed(params: {
  client: PageDataReader;
  pageId: number;
  store?: EditabilityGateStore;
  expectedContentHash?: string;
  nowMs?: number;
}): Promise<{ report: EditabilityReport; contentHash: string }> {
  const store = params.store ?? defaultEditabilityGateStore;
  const pageData = await params.client.getPageData({ id: params.pageId });
  const elements = Array.isArray(pageData?.elementor_data) ? pageData.elementor_data : [];
  const settings = isPlainObject(pageData?.page_settings) ? pageData.page_settings : undefined;
  const contentHash = computeContentHash(elements, settings);

  if (params.expectedContentHash && params.expectedContentHash !== contentHash) {
    throw new EditabilityGateError(
      'EDITABILITY_GATE_STALE_HASH',
      `Caller expected contentHash '${params.expectedContentHash}' for page ${params.pageId}, but current live page contentHash is '${contentHash}'.`,
      {
        pageId: params.pageId,
        contentHash,
        expectedHash: params.expectedContentHash,
      },
    );
  }

  const report = store.assertAllowed({
    pageId: params.pageId,
    contentHash,
    nowMs: params.nowMs,
  });

  return { report, contentHash };
}
