import type {
  AlignmentValue,
  BoxSpacing,
  BreakpointKey,
  CssMeasure,
  ResponsiveLayoutControls,
  ResponsiveSizingControls,
  ResponsiveSpacingControls,
  ResponsiveTypographyControls,
  ResponsiveValue,
  WhiteSpaceValue,
} from './native-delivery-mode.js';

export type ElementTargetKind = 'container' | 'widget';

export type ResponsiveControlErrorCode =
  | 'INVALID_RESPONSIVE_CONTROL'
  | 'MISSING_DESKTOP_BREAKPOINT'
  | 'INVALID_CSS_MEASURE'
  | 'INVALID_BOX_SPACING';

export class ResponsiveControlError extends Error {
  constructor(
    public readonly code: ResponsiveControlErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'ResponsiveControlError';
  }
}

export interface ElementorSettingsConversionOptions {
  target?: ElementTargetKind;
  globals?: Record<string, string>;
  preserveSettings?: Record<string, unknown>;
}

export interface ElementorSettingsBundle {
  settings: Record<string, unknown>;
  globals: Record<string, string>;
}

export interface ExtractedResponsiveControls {
  responsiveControls: ResponsiveLayoutControls;
  globals: Record<string, string>;
  tokenDependencies: {
    colors: string[];
    typography: string[];
  };
}

const VALID_BREAKPOINTS: readonly BreakpointKey[] = ['desktop', 'tablet', 'mobile'];
const VALID_CSS_UNITS = new Set(['px', 'em', 'rem', '%', 'vw', 'vh', 'clamp', 'auto']);
const VALID_BOX_UNITS = new Set(['px', 'em', 'rem', '%']);
const VALID_ALIGNMENTS = new Set<AlignmentValue>([
  'left',
  'center',
  'right',
  'justify',
  'flex-start',
  'flex-end',
  'space-between',
]);
const VALID_WHITE_SPACES = new Set<WhiteSpaceValue>([
  'normal',
  'nowrap',
  'pre',
  'pre-wrap',
  'pre-line',
]);

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function clonePlain<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((item) => clonePlain(item)) as unknown as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v !== undefined) {
      out[k] = clonePlain(v);
    }
  }
  return out as T;
}

function assertCssMeasure(value: unknown, path: string): CssMeasure {
  if (!isPlainObject(value)) {
    throw new ResponsiveControlError('INVALID_CSS_MEASURE', `${path}: expected CssMeasure object { unit, size }.`);
  }
  const unit = value.unit;
  const size = value.size;
  if (typeof unit !== 'string' || !VALID_CSS_UNITS.has(unit)) {
    throw new ResponsiveControlError(
      'INVALID_CSS_MEASURE',
      `${path}.unit: invalid unit ${JSON.stringify(unit)}.`,
      { path, unit },
    );
  }
  if (typeof size !== 'number' && typeof size !== 'string') {
    throw new ResponsiveControlError(
      'INVALID_CSS_MEASURE',
      `${path}.size: expected number or string, got ${typeof size}.`,
      { path, size },
    );
  }
  if (typeof size === 'number' && !Number.isFinite(size)) {
    throw new ResponsiveControlError('INVALID_CSS_MEASURE', `${path}.size: number must be finite.`);
  }
  return { unit: unit as CssMeasure['unit'], size };
}

function assertBoxSpacing(value: unknown, path: string): BoxSpacing {
  if (!isPlainObject(value)) {
    throw new ResponsiveControlError('INVALID_BOX_SPACING', `${path}: expected BoxSpacing object.`);
  }
  const unit = value.unit;
  if (typeof unit !== 'string' || !VALID_BOX_UNITS.has(unit)) {
    throw new ResponsiveControlError(
      'INVALID_BOX_SPACING',
      `${path}.unit: invalid spacing unit ${JSON.stringify(unit)}.`,
      { path, unit },
    );
  }
  const result: BoxSpacing = {
    unit: unit as BoxSpacing['unit'],
    top: value.top as string | number,
    right: value.right as string | number,
    bottom: value.bottom as string | number,
    left: value.left as string | number,
  };
  for (const side of ['top', 'right', 'bottom', 'left'] as const) {
    const sideVal = value[side];
    if (typeof sideVal !== 'number' && typeof sideVal !== 'string') {
      throw new ResponsiveControlError(
        'INVALID_BOX_SPACING',
        `${path}.${side}: expected number or string, got ${typeof sideVal}.`,
      );
    }
  }
  if (value.isLinked !== undefined) {
    if (typeof value.isLinked !== 'boolean') {
      throw new ResponsiveControlError('INVALID_BOX_SPACING', `${path}.isLinked: expected boolean.`);
    }
    result.isLinked = value.isLinked;
  }
  return result;
}

function assertResponsiveValue<T>(
  raw: unknown,
  path: string,
  itemValidator: (val: unknown, bpPath: string) => T,
): ResponsiveValue<T> {
  if (!isPlainObject(raw)) {
    throw new ResponsiveControlError(
      'INVALID_RESPONSIVE_CONTROL',
      `${path}: expected responsive object { desktop, tablet?, mobile? }.`,
    );
  }
  if (!('desktop' in raw) || raw.desktop === undefined) {
    throw new ResponsiveControlError(
      'MISSING_DESKTOP_BREAKPOINT',
      `${path}: missing required 'desktop' breakpoint value.`,
      { path },
    );
  }
  const out: ResponsiveValue<T> = {
    desktop: itemValidator(raw.desktop, `${path}.desktop`),
  };
  if (raw.tablet !== undefined) {
    out.tablet = itemValidator(raw.tablet, `${path}.tablet`);
  }
  if (raw.mobile !== undefined) {
    out.mobile = itemValidator(raw.mobile, `${path}.mobile`);
  }
  return out;
}

function assertFontWeight(value: unknown, path: string): string | number {
  if (typeof value === 'string' && value.trim().length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new ResponsiveControlError(
    'INVALID_RESPONSIVE_CONTROL',
    `${path}: fontWeight must be a non-empty string or finite number.`,
  );
}

function assertAlignment(value: unknown, path: string): AlignmentValue {
  if (typeof value === 'string' && VALID_ALIGNMENTS.has(value as AlignmentValue)) {
    return value as AlignmentValue;
  }
  throw new ResponsiveControlError(
    'INVALID_RESPONSIVE_CONTROL',
    `${path}: invalid alignment ${JSON.stringify(value)}.`,
  );
}

function assertWhiteSpace(value: unknown, path: string): WhiteSpaceValue {
  if (typeof value === 'string' && VALID_WHITE_SPACES.has(value as WhiteSpaceValue)) {
    return value as WhiteSpaceValue;
  }
  throw new ResponsiveControlError(
    'INVALID_RESPONSIVE_CONTROL',
    `${path}: invalid whiteSpace ${JSON.stringify(value)}.`,
  );
}

export function validateResponsiveLayoutControls(
  controls: ResponsiveLayoutControls,
): ResponsiveLayoutControls {
  if (!isPlainObject(controls)) {
    throw new ResponsiveControlError(
      'INVALID_RESPONSIVE_CONTROL',
      'responsiveControls must be a plain object.',
    );
  }

  const normalized: ResponsiveLayoutControls = {};

  if (controls.typography !== undefined) {
    if (!isPlainObject(controls.typography)) {
      throw new ResponsiveControlError('INVALID_RESPONSIVE_CONTROL', 'typography must be an object.');
    }
    const typo: ResponsiveTypographyControls = {};
    if (controls.typography.fontFamily !== undefined) {
      if (typeof controls.typography.fontFamily !== 'string' || controls.typography.fontFamily.trim().length === 0) {
        throw new ResponsiveControlError('INVALID_RESPONSIVE_CONTROL', 'typography.fontFamily must be a non-empty string.');
      }
      typo.fontFamily = controls.typography.fontFamily;
    }
    if (controls.typography.fontSize !== undefined) {
      typo.fontSize = assertResponsiveValue(controls.typography.fontSize, 'typography.fontSize', assertCssMeasure);
    }
    if (controls.typography.lineHeight !== undefined) {
      typo.lineHeight = assertResponsiveValue(controls.typography.lineHeight, 'typography.lineHeight', assertCssMeasure);
    }
    if (controls.typography.letterSpacing !== undefined) {
      typo.letterSpacing = assertResponsiveValue(controls.typography.letterSpacing, 'typography.letterSpacing', assertCssMeasure);
    }
    if (controls.typography.fontWeight !== undefined) {
      typo.fontWeight = assertResponsiveValue(controls.typography.fontWeight, 'typography.fontWeight', assertFontWeight);
    }
    if (Object.keys(typo).length > 0) {
      normalized.typography = typo;
    }
  }

  if (controls.spacing !== undefined) {
    if (!isPlainObject(controls.spacing)) {
      throw new ResponsiveControlError('INVALID_RESPONSIVE_CONTROL', 'spacing must be an object.');
    }
    const spacing: ResponsiveSpacingControls = {};
    if (controls.spacing.gap !== undefined) {
      spacing.gap = assertResponsiveValue(controls.spacing.gap, 'spacing.gap', assertCssMeasure);
    }
    if (controls.spacing.padding !== undefined) {
      spacing.padding = assertResponsiveValue(controls.spacing.padding, 'spacing.padding', assertBoxSpacing);
    }
    if (controls.spacing.margin !== undefined) {
      spacing.margin = assertResponsiveValue(controls.spacing.margin, 'spacing.margin', assertBoxSpacing);
    }
    if (Object.keys(spacing).length > 0) {
      normalized.spacing = spacing;
    }
  }

  if (controls.sizing !== undefined) {
    if (!isPlainObject(controls.sizing)) {
      throw new ResponsiveControlError('INVALID_RESPONSIVE_CONTROL', 'sizing must be an object.');
    }
    const sizing: ResponsiveSizingControls = {};
    if (controls.sizing.width !== undefined) {
      sizing.width = assertResponsiveValue(controls.sizing.width, 'sizing.width', assertCssMeasure);
    }
    if (controls.sizing.maxWidth !== undefined) {
      sizing.maxWidth = assertResponsiveValue(controls.sizing.maxWidth, 'sizing.maxWidth', assertCssMeasure);
    }
    if (controls.sizing.minHeight !== undefined) {
      sizing.minHeight = assertResponsiveValue(controls.sizing.minHeight, 'sizing.minHeight', assertCssMeasure);
    }
    if (Object.keys(sizing).length > 0) {
      normalized.sizing = sizing;
    }
  }

  if (controls.alignment !== undefined) {
    normalized.alignment = assertResponsiveValue(controls.alignment, 'alignment', assertAlignment);
  }

  if (controls.whiteSpace !== undefined) {
    normalized.whiteSpace = assertResponsiveValue(controls.whiteSpace, 'whiteSpace', assertWhiteSpace);
  }

  return normalized;
}

function breakpointKeyToSettingsKey(baseKey: string, bp: BreakpointKey): string {
  return bp === 'desktop' ? baseKey : `${baseKey}_${bp}`;
}

function writeResponsiveSetting<T>(
  settings: Record<string, unknown>,
  baseKey: string,
  value: ResponsiveValue<T> | undefined,
): void {
  if (!value) return;
  for (const bp of VALID_BREAKPOINTS) {
    const bpVal = value[bp];
    if (bpVal !== undefined) {
      settings[breakpointKeyToSettingsKey(baseKey, bp)] = clonePlain(bpVal);
    }
  }
}

function readResponsiveSetting<T>(
  settings: Record<string, unknown>,
  candidateKeys: string[],
  itemParser: (raw: unknown, bpPath: string) => T,
  logicalPath: string,
): ResponsiveValue<T> | undefined {
  for (const baseKey of candidateKeys) {
    const desktopVal = settings[baseKey];
    const tabletVal = settings[`${baseKey}_tablet`];
    const mobileVal = settings[`${baseKey}_mobile`];

    const hasAny = desktopVal !== undefined || tabletVal !== undefined || mobileVal !== undefined;
    if (!hasAny) continue;

    if (desktopVal === undefined) {
      throw new ResponsiveControlError(
        'MISSING_DESKTOP_BREAKPOINT',
        `${logicalPath}: Elementor setting '${baseKey}_tablet' or '${baseKey}_mobile' is present without desktop key '${baseKey}'.`,
        { baseKey, logicalPath },
      );
    }

    const out: ResponsiveValue<T> = {
      desktop: itemParser(desktopVal, `${logicalPath}.desktop`),
    };
    if (tabletVal !== undefined) {
      out.tablet = itemParser(tabletVal, `${logicalPath}.tablet`);
    }
    if (mobileVal !== undefined) {
      out.mobile = itemParser(mobileVal, `${logicalPath}.mobile`);
    }
    return out;
  }
  return undefined;
}

function parseCssMeasureFromElementor(raw: unknown, path: string): CssMeasure {
  if (!isPlainObject(raw)) {
    throw new ResponsiveControlError('INVALID_CSS_MEASURE', `${path}: expected Elementor measure object.`);
  }
  const unit = raw.unit;
  const size = raw.size;
  if (typeof unit !== 'string' || !VALID_CSS_UNITS.has(unit)) {
    throw new ResponsiveControlError('INVALID_CSS_MEASURE', `${path}.unit: invalid unit ${JSON.stringify(unit)}.`);
  }
  if (typeof size !== 'number' && typeof size !== 'string') {
    throw new ResponsiveControlError('INVALID_CSS_MEASURE', `${path}.size: expected number or string.`);
  }
  return { unit: unit as CssMeasure['unit'], size };
}

function parseBoxSpacingFromElementor(raw: unknown, path: string): BoxSpacing {
  return assertBoxSpacing(raw, path);
}

/**
 * Convert canonical ResponsiveLayoutControls + global tokens into Elementor
 * container or widget settings & `__globals__` map.
 */
export function responsiveControlsToElementorSettings(
  controls: ResponsiveLayoutControls,
  options: ElementorSettingsConversionOptions = {},
): ElementorSettingsBundle {
  const validated = validateResponsiveLayoutControls(controls);
  const target: ElementTargetKind = options.target ?? 'container';
  const settings: Record<string, unknown> = options.preserveSettings
    ? clonePlain(options.preserveSettings)
    : {};

  if (validated.typography) {
    if (validated.typography.fontFamily !== undefined) {
      settings.typography_font_family = validated.typography.fontFamily;
    }
    writeResponsiveSetting(settings, 'typography_font_size', validated.typography.fontSize);
    writeResponsiveSetting(settings, 'typography_line_height', validated.typography.lineHeight);
    writeResponsiveSetting(settings, 'typography_letter_spacing', validated.typography.letterSpacing);
    writeResponsiveSetting(settings, 'typography_font_weight', validated.typography.fontWeight);
  }

  if (validated.spacing) {
    const gapKey = target === 'container' ? 'flex_gap' : 'gap';
    const paddingKey = target === 'container' ? 'padding' : '_padding';
    const marginKey = target === 'container' ? 'margin' : '_margin';

    writeResponsiveSetting(settings, gapKey, validated.spacing.gap);
    writeResponsiveSetting(settings, paddingKey, validated.spacing.padding);
    writeResponsiveSetting(settings, marginKey, validated.spacing.margin);
  }

  if (validated.sizing) {
    const widthKey = target === 'container' ? 'width' : '_element_custom_width';
    if (target === 'widget' && validated.sizing.width !== undefined && settings._element_width === undefined) {
      settings._element_width = 'initial';
    }
    writeResponsiveSetting(settings, widthKey, validated.sizing.width);
    writeResponsiveSetting(settings, 'max_width', validated.sizing.maxWidth);
    writeResponsiveSetting(settings, 'min_height', validated.sizing.minHeight);
  }

  if (validated.alignment) {
    writeResponsiveSetting(settings, 'align', validated.alignment);
  }

  if (validated.whiteSpace) {
    writeResponsiveSetting(settings, 'white_space', validated.whiteSpace);
  }

  const existingGlobals = isPlainObject(settings.__globals__) ? (settings.__globals__ as Record<string, unknown>) : {};
  const mergedGlobals: Record<string, string> = {};
  for (const [k, v] of Object.entries(existingGlobals)) {
    if (typeof v === 'string' && v.trim().length > 0) {
      mergedGlobals[k] = v;
    }
  }
  if (options.globals) {
    for (const [k, v] of Object.entries(options.globals)) {
      if (typeof v === 'string' && v.trim().length > 0) {
        mergedGlobals[k] = v;
      }
    }
  }
  if (Object.keys(mergedGlobals).length > 0) {
    settings.__globals__ = { ...mergedGlobals };
  }

  return {
    settings,
    globals: mergedGlobals,
  };
}

/**
 * Extract canonical ResponsiveLayoutControls and global token bindings from
 * Elementor container or widget settings.
 */
export function elementorSettingsToResponsiveControls(
  settings: Record<string, unknown>,
  options: { target?: ElementTargetKind } = {},
): ExtractedResponsiveControls {
  if (!isPlainObject(settings)) {
    throw new ResponsiveControlError(
      'INVALID_RESPONSIVE_CONTROL',
      'Elementor settings must be a plain object.',
    );
  }

  const target = options.target;
  const responsiveControls: ResponsiveLayoutControls = {};

  const typography: ResponsiveTypographyControls = {};
  if (typeof settings.typography_font_family === 'string' && settings.typography_font_family.trim().length > 0) {
    typography.fontFamily = settings.typography_font_family;
  }
  const fontSize = readResponsiveSetting(
    settings,
    ['typography_font_size'],
    parseCssMeasureFromElementor,
    'typography.fontSize',
  );
  if (fontSize) typography.fontSize = fontSize;

  const lineHeight = readResponsiveSetting(
    settings,
    ['typography_line_height'],
    parseCssMeasureFromElementor,
    'typography.lineHeight',
  );
  if (lineHeight) typography.lineHeight = lineHeight;

  const letterSpacing = readResponsiveSetting(
    settings,
    ['typography_letter_spacing'],
    parseCssMeasureFromElementor,
    'typography.letterSpacing',
  );
  if (letterSpacing) typography.letterSpacing = letterSpacing;

  const fontWeight = readResponsiveSetting(
    settings,
    ['typography_font_weight'],
    assertFontWeight,
    'typography.fontWeight',
  );
  if (fontWeight) typography.fontWeight = fontWeight;

  if (Object.keys(typography).length > 0) {
    responsiveControls.typography = typography;
  }

  const spacing: ResponsiveSpacingControls = {};
  const gapKeys = target === 'widget' ? ['gap', 'flex_gap'] : ['flex_gap', 'gap'];
  const paddingKeys = target === 'widget' ? ['_padding', 'padding'] : ['padding', '_padding'];
  const marginKeys = target === 'widget' ? ['_margin', 'margin'] : ['margin', '_margin'];

  const gap = readResponsiveSetting(settings, gapKeys, parseCssMeasureFromElementor, 'spacing.gap');
  if (gap) spacing.gap = gap;

  const padding = readResponsiveSetting(settings, paddingKeys, parseBoxSpacingFromElementor, 'spacing.padding');
  if (padding) spacing.padding = padding;

  const margin = readResponsiveSetting(settings, marginKeys, parseBoxSpacingFromElementor, 'spacing.margin');
  if (margin) spacing.margin = margin;

  if (Object.keys(spacing).length > 0) {
    responsiveControls.spacing = spacing;
  }

  const sizing: ResponsiveSizingControls = {};
  const widthKeys = target === 'widget' ? ['_element_custom_width', 'width'] : ['width', '_element_custom_width'];

  const width = readResponsiveSetting(settings, widthKeys, parseCssMeasureFromElementor, 'sizing.width');
  if (width) sizing.width = width;

  const maxWidth = readResponsiveSetting(settings, ['max_width'], parseCssMeasureFromElementor, 'sizing.maxWidth');
  if (maxWidth) sizing.maxWidth = maxWidth;

  const minHeight = readResponsiveSetting(settings, ['min_height'], parseCssMeasureFromElementor, 'sizing.minHeight');
  if (minHeight) sizing.minHeight = minHeight;

  if (Object.keys(sizing).length > 0) {
    responsiveControls.sizing = sizing;
  }

  const alignment = readResponsiveSetting(
    settings,
    ['align', 'text_align'],
    assertAlignment,
    'alignment',
  );
  if (alignment) responsiveControls.alignment = alignment;

  const whiteSpace = readResponsiveSetting(
    settings,
    ['white_space', '_white_space'],
    assertWhiteSpace,
    'whiteSpace',
  );
  if (whiteSpace) responsiveControls.whiteSpace = whiteSpace;

  const globals: Record<string, string> = {};
  if (isPlainObject(settings.__globals__)) {
    for (const [k, v] of Object.entries(settings.__globals__)) {
      if (typeof v === 'string' && v.trim().length > 0) {
        globals[k] = v;
      }
    }
  }

  const tokenDependencies = parseGlobalTokenDependencies(globals);

  return {
    responsiveControls,
    globals,
    tokenDependencies,
  };
}

/**
 * Parse Elementor `__globals__` URI strings into color & typography token IDs.
 */
export function parseGlobalTokenDependencies(globals: Record<string, string>): {
  colors: string[];
  typography: string[];
} {
  const colors = new Set<string>();
  const typography = new Set<string>();

  for (const [key, ref] of Object.entries(globals)) {
    if (typeof ref !== 'string' || ref.trim().length === 0) continue;
    const match = /^globals\/(colors|typography)\?id=(.+)$/.exec(ref.trim());
    if (match) {
      const kind = match[1];
      const tokenId = match[2]!.trim();
      if (tokenId.length > 0) {
        if (kind === 'colors') colors.add(tokenId);
        if (kind === 'typography') typography.add(tokenId);
      }
    } else if (/color/i.test(key)) {
      colors.add(ref.trim());
    } else if (/typography|font/i.test(key)) {
      typography.add(ref.trim());
    }
  }

  return {
    colors: [...colors],
    typography: [...typography],
  };
}

/**
 * Perform a full lossless roundtrip: ResponsiveLayoutControls -> Elementor settings -> ResponsiveLayoutControls.
 */
export function roundtripResponsiveControls(
  controls: ResponsiveLayoutControls,
  options: ElementorSettingsConversionOptions = {},
): {
  elementorSettings: ElementorSettingsBundle;
  extracted: ExtractedResponsiveControls;
} {
  const elementorSettings = responsiveControlsToElementorSettings(controls, options);
  const extracted = elementorSettingsToResponsiveControls(elementorSettings.settings, {
    target: options.target,
  });
  return { elementorSettings, extracted };
}
