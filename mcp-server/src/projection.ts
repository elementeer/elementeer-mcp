import { describeWidgetType } from './widget-schemas.js';

export type ProjectionLevel =
  | 'structure'
  | 'content'
  | 'interaction'
  | 'style_tokens'
  | 'full';

export interface ElementorElement {
  id: string;
  elType: string;
  widgetType?: string;
  elements?: ElementorElement[];
  settings?: Record<string, unknown>;
  title?: string;
  [key: string]: unknown;
}

export interface ContentSlot {
  widget_id: string;
  widget_type: string;
  admin_label?: string;
  text_fields: Record<string, string>;
  link_fields: Record<string, { url: string; target?: string }>;
  media_fields: Record<string, { id?: number; url?: string }>;
}

export interface StructureEntry {
  index: number;
  id: string;
  elType: string;
  widgetType?: string;
  title?: string;
  children_count: number;
  children?: StructureEntry[];
}

export interface StyleTokenSummary {
  widget_id: string;
  widget_type: string;
  colors: Record<string, string>;
  typography: Record<string, Record<string, unknown>>;
  spacing: Record<string, Record<string, unknown>>;
}

export interface InteractionEntry {
  widget_id: string;
  widget_type: string;
  buttons: Array<{ text: string; url: string }>;
  forms: Array<{ fields: string[] }>;
  links: Array<{ label: string; url: string }>;
}

export interface ProjectedPage {
  pageId: number;
  revision: string;
  projection: ProjectionLevel;
  post_title: string;
  element_count: number;
  /**
   * Optimistic-locking token from the plugin. Every DELTA write tool
   * (patch_widget, patch_widgets_batch, insert_widget, remove_widget,
   * move_widget, clone_widget) REQUIRES it and points the caller at
   * get_page_data as its source — so a projection that omits it makes the
   * whole write path unreachable through the documented route.
   *
   * Optional because the plugin only returns it on the default
   * /pages/{id}/data branch; the extract="all" and extract="section"
   * branches do not carry one.
   */
  content_hash?: string;
  data: StructureEntry[] | ContentSlot[] | InteractionEntry[] | StyleTokenSummary[] | ElementorElement[];
}

function normalizeWidgetType(el: ElementorElement): string | null {
  return el.widgetType?.toLowerCase().trim() ?? null;
}

function extractTextFields(settings: Record<string, unknown>, widgetType: string): Record<string, string> {
  const texts: Record<string, string> = {};
  const schema = describeWidgetType(widgetType);
  if (schema.status !== 'supported' || !schema.schema) return texts;
  for (const field of schema.schema.text_fields) {
    const value = settings[field];
    if (typeof value === 'string' && value.length > 0) {
      texts[field] = value;
    }
  }
  return texts;
}

function extractLinkFields(settings: Record<string, unknown>, widgetType: string): Record<string, { url: string; target?: string }> {
  const links: Record<string, { url: string; target?: string }> = {};
  const schema = describeWidgetType(widgetType);
  if (schema.status !== 'supported' || !schema.schema) return links;
  for (const field of schema.schema.link_fields) {
    const value = settings[field];
    if (typeof value === 'string' && value.length > 0) {
      links[field] = { url: value };
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if (typeof obj.url === 'string' && obj.url.length > 0) {
        links[field] = { url: obj.url, target: obj.is_external ? '_blank' : undefined };
      }
    }
  }
  return links;
}

function extractMediaFields(settings: Record<string, unknown>, widgetType: string): Record<string, { id?: number; url?: string }> {
  const media: Record<string, { id?: number; url?: string }> = {};
  const schema = describeWidgetType(widgetType);
  if (schema.status !== 'supported' || !schema.schema) return media;
  for (const field of schema.schema.media_fields) {
    const value = settings[field];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const result: { id?: number; url?: string } = {};
      if (typeof obj.id === 'number') result.id = obj.id;
      if (typeof obj.url === 'string') result.url = obj.url;
      if (result.id !== undefined || result.url !== undefined) {
        media[field] = result;
      }
    } else if (typeof value === 'string' && value.startsWith('http')) {
      media[field] = { url: value };
    } else if (typeof value === 'number' && value > 0) {
      media[field] = { id: value };
    }
  }
  return media;
}

const COLOR_KEYS = new Set([
  '_color', 'color', 'background_color', 'text_color',
  'border_color', 'icon_color', 'overlay_color', 'heading_color',
  'title_color', 'subtitle_color', 'description_color',
  'button_color', 'button_text_color', 'link_color',
  'hover_color', 'active_color', 'focus_color',
  '_background_color', '_border_color',
]);

const TYPO_KEYS = new Set([
  'typography_typography', 'typography_font_family', 'typography_font_size',
  'typography_font_weight', 'typography_line_height', 'typography_letter_spacing',
  'typography_text_transform', 'typography_font_style', 'typography_text_decoration',
  'typography_word_spacing',
]);

const SPACING_KEYS = new Set([
  '_padding', '_margin', 'padding', 'margin', 'gap', 'column_gap', 'row_gap',
  '_element_width', 'width', 'height', 'min_height', 'max_width',
  'space_between_widgets', 'content_width',
  '_border_radius', 'border_radius', 'box_shadow_box_shadow',
  'border_width', '_border_width',
  'image_size', 'icon_size',
]);

function extractColors(settings: Record<string, unknown>): Record<string, string> {
  const colors: Record<string, string> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (COLOR_KEYS.has(key) && typeof value === 'string' && value.length > 0) {
      colors[key] = value;
    }
  }
  return colors;
}

function extractTypography(settings: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const typo: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (TYPO_KEYS.has(key) && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      typo[key] = value as Record<string, unknown>;
    }
  }
  return typo;
}

function extractSpacing(settings: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const spacing: Record<string, Record<string, unknown>> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (SPACING_KEYS.has(key) && typeof value === 'object' && value !== null && !Array.isArray(value)) {
      spacing[key] = value as Record<string, unknown>;
    }
  }
  return spacing;
}

function projectElementToStructure(el: ElementorElement, index: number): StructureEntry {
  const children = el.elements?.map((child, i) => projectElementToStructure(child, i)) ?? [];
  return {
    index,
    id: el.id,
    elType: el.elType,
    widgetType: el.widgetType,
    title: (el.settings?._title as string) || (el.settings?.title as string) || el.title,
    children_count: children.length,
    children: children.length > 0 ? children : undefined,
  };
}

function projectElementToContent(el: ElementorElement): ContentSlot | null {
  if (!el.settings) return null;
  const widgetType = normalizeWidgetType(el);
  if (!widgetType) return null;
  const textFields = extractTextFields(el.settings, widgetType);
  const linkFields = extractLinkFields(el.settings, widgetType);
  const mediaFields = extractMediaFields(el.settings, widgetType);
  if (Object.keys(textFields).length === 0 && Object.keys(linkFields).length === 0 && Object.keys(mediaFields).length === 0) {
    return null;
  }
  return {
    widget_id: el.id,
    widget_type: widgetType,
    admin_label: el.settings._title as string | undefined,
    text_fields: textFields,
    link_fields: linkFields,
    media_fields: mediaFields,
  };
}

function projectElementToInteraction(el: ElementorElement): InteractionEntry | null {
  if (!el.settings) return null;
  const widgetType = normalizeWidgetType(el);
  if (!widgetType) return null;
  const links: Array<{ label: string; url: string }> = [];
  const linkFields = extractLinkFields(el.settings, widgetType);
  for (const [key, value] of Object.entries(linkFields)) {
    links.push({ label: key, url: value.url });
  }
  const buttons: Array<{ text: string; url: string }> = [];
  if (typeof el.settings.button_text === 'string' && el.settings.button_text.length > 0) {
    const url = (el.settings.button_url as string) || (el.settings.link as string) || (
      typeof el.settings.link === 'object' ? (el.settings.link as Record<string, unknown>).url as string || '' : ''
    );
    buttons.push({ text: el.settings.button_text, url });
  }
  if (typeof el.settings.text === 'string' && el.settings.text.length > 0 && widgetType === 'button') {
    const url = typeof el.settings.link === 'object' && el.settings.link !== null
      ? ((el.settings.link as Record<string, unknown>).url as string) || ''
      : (el.settings.link as string) || '';
    if (url.length > 0) {
      buttons.push({ text: el.settings.text, url });
    }
  }
  if (typeof el.settings.button_text === 'string' && el.settings.button_text.length > 0) {
    const existingTexts = new Set(buttons.map(b => b.text));
    if (!existingTexts.has(el.settings.button_text)) {
      const url = (el.settings.button_url as string) || '';
      buttons.push({ text: el.settings.button_text, url });
    }
  }
  if (buttons.length === 0 && links.length === 0) return null;
  return {
    widget_id: el.id,
    widget_type: widgetType,
    buttons,
    forms: [],
    links,
  };
}

function projectElementToStyleTokens(el: ElementorElement): StyleTokenSummary | null {
  if (!el.settings) return null;
  const widgetType = normalizeWidgetType(el);
  const colors = extractColors(el.settings);
  const typography = extractTypography(el.settings);
  const spacing = extractSpacing(el.settings);
  if (Object.keys(colors).length === 0 && Object.keys(typography).length === 0 && Object.keys(spacing).length === 0) {
    return null;
  }
  return {
    widget_id: el.id,
    widget_type: widgetType ?? el.elType,
    colors,
    typography,
    spacing,
  };
}

function walkElements<T>(
  elements: ElementorElement[],
  projector: (el: ElementorElement) => T | null,
): T[] {
  const results: T[] = [];
  for (const el of elements) {
    const projected = projector(el);
    if (projected !== null) results.push(projected);
    if (el.elements) {
      results.push(...walkElements(el.elements, projector));
    }
  }
  return results;
}

export function projectElementorData(
  data: ElementorElement[],
  level: ProjectionLevel,
  meta: { pageId: number; post_title: string; revision: string; content_hash?: string },
): ProjectedPage {
  const base = {
    pageId: meta.pageId,
    revision: meta.revision,
    projection: level,
    post_title: meta.post_title,
    element_count: data.length,
    // Only emitted when the caller actually had one. An absent key is
    // honest; an empty string would look like a usable token and produce
    // a 409 on the first write.
    ...(meta.content_hash ? { content_hash: meta.content_hash } : {}),
    data: [] as unknown[],
  };

  switch (level) {
    case 'structure':
      base.data = data.map((el, i) => projectElementToStructure(el, i));
      break;
    case 'content':
      base.data = walkElements(data, projectElementToContent);
      break;
    case 'interaction':
      base.data = walkElements(data, projectElementToInteraction);
      break;
    case 'style_tokens':
      base.data = walkElements(data, projectElementToStyleTokens);
      break;
    case 'full':
    default:
      base.data = data;
      break;
  }

  return base as ProjectedPage;
}
