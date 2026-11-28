import { createHash } from 'node:crypto';
import {
  assertNativeWriteAllowed,
  canonicalJson,
  computeContentHash,
} from './editability-gate.js';
import type { DeliveryEnvironment, DeliveryMode } from './native-delivery-mode.js';
import {
  elementorSettingsToResponsiveControls,
  parseGlobalTokenDependencies,
} from './responsive-controls.js';
import {
  assertWidgetControlsValid,
  compareSemver,
  type InstalledPluginsInventory,
} from './widget-control-validator.js';

export type ComponentUpsertAction = 'created' | 'updated' | 'reused';

export interface CompositionTokenDependencies {
  colors: string[];
  typography: string[];
}

export interface CompositionComponentRecord {
  componentKey: string;
  templateId: number;
  templateTitle: string;
  componentVersion: string;
  structureHash: string;
  slotOrder: number;
  elementIds: string[];
  tokenDependencies: CompositionTokenDependencies;
  upsertAction: ComponentUpsertAction;
}

export interface CompositionSlot {
  slotKey: string;
  order: number;
  componentKey: string;
  templateId: number;
  rootElementId: string;
}

export interface CompositionIdempotencyPolicy {
  strategy: 'upsert-by-component-key';
  dedupeKey: string;
  duplicateTemplatesPrevented: boolean;
  duplicateElementIdsPrevented: boolean;
  allowDuplicateTemplateTitles: boolean;
}

export interface CompositionManifest {
  schemaVersion: 'elementeer-composition-manifest/v1';
  pageId: number | string;
  pageContentHash: string;
  kitId: number | string;
  components: CompositionComponentRecord[];
  slots: CompositionSlot[];
  elementIds: string[];
  tokenDependencies: CompositionTokenDependencies;
  idempotency: CompositionIdempotencyPolicy;
}

export type LibraryComposerErrorCode =
  | 'COMPONENT_VERSION_BUMP_REQUIRED'
  | 'DUPLICATE_ELEMENT_ID'
  | 'DUPLICATE_TEMPLATE_TITLE'
  | 'COMPOSITION_IDEMPOTENCY_VIOLATION'
  | 'STALE_PAGE_CONTENT_HASH'
  | 'TARGET_ELEMENT_NOT_FOUND';

export class LibraryComposerError extends Error {
  constructor(
    public readonly code: LibraryComposerErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'LibraryComposerError';
  }
}

export interface ElementorElementNode {
  id: string;
  elType: string;
  widgetType?: string;
  settings?: Record<string, unknown>;
  elements?: ElementorElementNode[];
  [key: string]: unknown;
}

export interface ComponentBlueprint {
  componentKey: string;
  componentVersion: string;
  templateTitle: string;
  templateType?: 'container' | 'section' | 'widget' | 'page';
  status?: 'publish' | 'draft';
  slotKey?: string;
  elements: ElementorElementNode[];
  structureHash?: string;
  tokenDependencies?: Partial<CompositionTokenDependencies>;
  updateIfContentChanged?: boolean;
}

export interface RegisteredLibraryComponent {
  componentKey: string;
  templateId: number;
  templateTitle: string;
  componentVersion: string;
  structureHash: string;
  contentHash: string;
  elementIds: string[];
  tokenDependencies: CompositionTokenDependencies;
}

export interface LibraryComposerClient {
  listTemplates(params?: {
    type?: string;
    status?: string;
    search?: string;
    page?: number;
    per_page?: number;
  }): Promise<{
    templates: Array<{
      id: number;
      title: string;
      type: string;
      status: string;
      tags?: string[];
    }>;
    total: number;
    total_pages: number;
  }>;
  getTemplateData(id: number): Promise<{ id: number; elementor_data: unknown[]; content_hash?: string }>;
  createTemplate(params: {
    title: string;
    type: string;
    status?: string;
    elementor_data?: string;
    categories?: string[];
    tags?: string[];
  }): Promise<{ id: number; title: string; type: string; status: string }>;
  updateTemplate(
    id: number,
    updates: { title?: string; status?: string; tags?: string[] },
  ): Promise<unknown>;
  updateTemplateData(id: number, elementorData: unknown[]): Promise<{ id: number; updated: true }>;
  getPageData?(params: { id: number }): Promise<{
    post_id?: number;
    elementor_data?: unknown[];
    page_settings?: Record<string, unknown>;
  }>;
  updatePageData?(id: number, elementorData: unknown[]): Promise<{ id: number; updated: true }>;
  patchWidget?(
    id: number,
    widgetId: string,
    params: { settings: Record<string, unknown>; content_hash: string; dry_run?: boolean },
  ): Promise<{ post_id: number; widget_id: string; path: string; updated: boolean; new_hash: string }>;
}

export interface ComposeLibraryPageInput {
  pageId: number | string;
  kitId?: number | string;
  dedupeKey?: string;
  components: ComponentBlueprint[];
  writeToPage?: boolean;
  mode?: DeliveryMode;
  environment?: DeliveryEnvironment;
  installedPlugins?: InstalledPluginsInventory;
  allowDuplicateTemplateTitles?: boolean;
  pageRootElementIds?: string[];
}

export interface ComposeLibraryPageResult {
  manifest: CompositionManifest;
  composedElements: ElementorElementNode[];
  pageContentHash: string;
}

export interface GranularPatchOperation {
  targetElementId: string;
  settingsPatch: Record<string, unknown>;
  expectedPageContentHash: string;
  dryRun?: boolean;
}

export interface GranularPatchResult {
  pageId: number | string;
  targetElementId: string;
  previousPageContentHash: string;
  pageContentHash: string;
  fullPageRewrite: false;
  mutatedElementIds: [string];
  preservedElementIds: string[];
  unchangedTopLevelSectionIndices: number[];
  elements: ElementorElementNode[];
  manifest: CompositionManifest;
}

const TAG_KEY_PREFIX = 'elementeer:key=';
const TAG_VER_PREFIX = 'elementeer:ver=';
const TAG_HASH_PREFIX = 'elementeer:hash=';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function encodeComponentTags(
  componentKey: string,
  componentVersion: string,
  structureHash: string,
): string[] {
  return [
    `${TAG_KEY_PREFIX}${componentKey}`,
    `${TAG_VER_PREFIX}${componentVersion}`,
    `${TAG_HASH_PREFIX}${structureHash}`,
  ];
}

function parseComponentTags(tags?: string[]): {
  componentKey?: string;
  componentVersion?: string;
  structureHash?: string;
} {
  if (!Array.isArray(tags)) return {};
  let componentKey: string | undefined;
  let componentVersion: string | undefined;
  let structureHash: string | undefined;
  for (const tag of tags) {
    if (typeof tag !== 'string') continue;
    if (tag.startsWith(TAG_KEY_PREFIX)) componentKey = tag.slice(TAG_KEY_PREFIX.length);
    else if (tag.startsWith(TAG_VER_PREFIX)) componentVersion = tag.slice(TAG_VER_PREFIX.length);
    else if (tag.startsWith(TAG_HASH_PREFIX)) structureHash = tag.slice(TAG_HASH_PREFIX.length);
  }
  return { componentKey, componentVersion, structureHash };
}

function projectStructureNode(node: unknown): unknown {
  if (!isPlainObject(node)) return null;
  const settings = isPlainObject(node.settings) ? node.settings : {};
  const structuralSettings: Record<string, unknown> = {};
  for (const k of ['structure', 'container_type', 'flex_direction', 'content_width', 'layout']) {
    if (settings[k] !== undefined) {
      structuralSettings[k] = settings[k];
    }
  }
  const children = Array.isArray(node.elements)
    ? node.elements.map((c) => projectStructureNode(c))
    : [];
  return {
    elType: typeof node.elType === 'string' ? node.elType : null,
    widgetType: typeof node.widgetType === 'string' ? node.widgetType : null,
    structuralSettings,
    elements: children,
  };
}

/**
 * Compute deterministic SHA-256 structureHash over element hierarchy & widget topology
 * (independent of editable copy/text values).
 */
export function computeStructureHash(elements: unknown[]): string {
  const skeleton = (Array.isArray(elements) ? elements : []).map((el) => projectStructureNode(el));
  const digest = createHash('sha256').update(canonicalJson(skeleton), 'utf8').digest('hex');
  return `sha256:${digest}`;
}

/**
 * Collect every element ID in depth-first pre-order, throwing DUPLICATE_ELEMENT_ID
 * if any ID is missing or duplicated within the provided tree.
 */
export function collectTreeElementIds(elements: unknown[], contextLabel: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();

  const visit = (raw: unknown): void => {
    if (!isPlainObject(raw)) {
      throw new LibraryComposerError(
        'COMPOSITION_IDEMPOTENCY_VIOLATION',
        `${contextLabel}: element node must be a plain object.`,
      );
    }
    const id = typeof raw.id === 'string' ? raw.id.trim() : '';
    if (!id) {
      throw new LibraryComposerError(
        'COMPOSITION_IDEMPOTENCY_VIOLATION',
        `${contextLabel}: every element node must have a non-empty string 'id'.`,
      );
    }
    if (seen.has(id)) {
      throw new LibraryComposerError(
        'DUPLICATE_ELEMENT_ID',
        `${contextLabel}: duplicate elementId '${id}' detected.`,
        { elementId: id, contextLabel },
      );
    }
    seen.add(id);
    ids.push(id);

    if (Array.isArray(raw.elements)) {
      for (const child of raw.elements) {
        visit(child);
      }
    }
  };

  for (const el of elements) {
    visit(el);
  }
  return ids;
}

/**
 * Extract unique global color and typography token IDs from all `__globals__` maps in a tree.
 */
export function extractTreeTokenDependencies(
  elements: unknown[],
  explicit?: Partial<CompositionTokenDependencies>,
): CompositionTokenDependencies {
  const colors = new Set<string>(explicit?.colors ?? []);
  const typography = new Set<string>(explicit?.typography ?? []);

  const visit = (raw: unknown): void => {
    if (!isPlainObject(raw)) return;
    if (isPlainObject(raw.settings) && isPlainObject(raw.settings.__globals__)) {
      const globalsMap: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw.settings.__globals__)) {
        if (typeof v === 'string' && v.trim().length > 0) {
          globalsMap[k] = v;
        }
      }
      const deps = parseGlobalTokenDependencies(globalsMap);
      for (const c of deps.colors) colors.add(c);
      for (const t of deps.typography) typography.add(t);
    }
    if (Array.isArray(raw.elements)) {
      for (const child of raw.elements) {
        visit(child);
      }
    }
  };

  for (const el of elements) {
    visit(el);
  }

  return {
    colors: [...colors],
    typography: [...typography],
  };
}

/**
 * Validate a CompositionManifest against all elementeer-composition-manifest/v1 invariants.
 */
export function assertCompositionManifestValid(manifest: CompositionManifest): void {
  if (manifest.schemaVersion !== 'elementeer-composition-manifest/v1') {
    throw new LibraryComposerError(
      'COMPOSITION_IDEMPOTENCY_VIOLATION',
      `Invalid manifest schemaVersion '${String(manifest.schemaVersion)}'.`,
    );
  }
  if (!Array.isArray(manifest.components) || manifest.components.length === 0) {
    throw new LibraryComposerError(
      'COMPOSITION_IDEMPOTENCY_VIOLATION',
      'CompositionManifest.components must contain at least one component.',
    );
  }

  const seenKeys = new Set<string>();
  const seenTitles = new Set<string>();
  const seenCompElementIds = new Set<string>();

  for (const comp of manifest.components) {
    if (seenKeys.has(comp.componentKey)) {
      throw new LibraryComposerError(
        'COMPOSITION_IDEMPOTENCY_VIOLATION',
        `Duplicate componentKey '${comp.componentKey}' in CompositionManifest.`,
        { componentKey: comp.componentKey },
      );
    }
    seenKeys.add(comp.componentKey);

    if (!manifest.idempotency.allowDuplicateTemplateTitles) {
      if (seenTitles.has(comp.templateTitle)) {
        throw new LibraryComposerError(
          'DUPLICATE_TEMPLATE_TITLE',
          `Duplicate templateTitle '${comp.templateTitle}' violates idempotency policy.`,
          { templateTitle: comp.templateTitle, componentKey: comp.componentKey },
        );
      }
      seenTitles.add(comp.templateTitle);
    }

    for (const eid of comp.elementIds) {
      if (seenCompElementIds.has(eid)) {
        throw new LibraryComposerError(
          'DUPLICATE_ELEMENT_ID',
          `Duplicate elementId '${eid}' across components.`,
          { elementId: eid, componentKey: comp.componentKey },
        );
      }
      seenCompElementIds.add(eid);
    }
  }

  const seenPageElementIds = new Set<string>();
  for (const eid of manifest.elementIds) {
    if (seenPageElementIds.has(eid)) {
      throw new LibraryComposerError(
        'DUPLICATE_ELEMENT_ID',
        `Duplicate elementId '${eid}' in page elementIds.`,
        { elementId: eid },
      );
    }
    seenPageElementIds.add(eid);
  }

  let lastOrder = -1;
  for (const slot of manifest.slots) {
    if (slot.order <= lastOrder) {
      throw new LibraryComposerError(
        'COMPOSITION_IDEMPOTENCY_VIOLATION',
        `Slot '${slot.slotKey}' order (${slot.order}) must be strictly increasing.`,
      );
    }
    lastOrder = slot.order;
    if (!seenKeys.has(slot.componentKey)) {
      throw new LibraryComposerError(
        'COMPOSITION_IDEMPOTENCY_VIOLATION',
        `Slot '${slot.slotKey}' references unknown componentKey '${slot.componentKey}'.`,
      );
    }
  }
}

/**
 * In-process registry tracking Elementor Library templates by stable `componentKey`
 * so repeated compositions reuse existing `templateId`s without creating duplicates.
 */
export class LibraryComponentRegistry {
  private readonly byKey = new Map<string, RegisteredLibraryComponent>();
  private readonly keyByTitle = new Map<string, string>();

  get(componentKey: string): RegisteredLibraryComponent | undefined {
    return this.byKey.get(componentKey);
  }

  getOwnerByTitle(templateTitle: string): string | undefined {
    return this.keyByTitle.get(templateTitle);
  }

  set(record: RegisteredLibraryComponent): void {
    const prev = this.byKey.get(record.componentKey);
    if (prev && prev.templateTitle !== record.templateTitle) {
      this.keyByTitle.delete(prev.templateTitle);
    }
    this.byKey.set(record.componentKey, deepClone(record));
    this.keyByTitle.set(record.templateTitle, record.componentKey);
  }

  clear(): void {
    this.byKey.clear();
    this.keyByTitle.clear();
  }

  entries(): RegisteredLibraryComponent[] {
    return [...this.byKey.values()].map((r) => deepClone(r));
  }
}

export const defaultLibraryComponentRegistry = new LibraryComponentRegistry();

function isVersionBumped(nextVersion: string, existingVersion: string): boolean {
  if (nextVersion === existingVersion) return false;
  const semverRe = /^\d+\.\d+\.\d+/;
  if (semverRe.test(nextVersion) && semverRe.test(existingVersion)) {
    return compareSemver(nextVersion, existingVersion) > 0;
  }
  return nextVersion !== existingVersion;
}

async function discoverExistingTemplate(
  client: LibraryComposerClient,
  component: ComponentBlueprint,
  registry: LibraryComponentRegistry,
  allowDuplicateTemplateTitles: boolean,
): Promise<RegisteredLibraryComponent | undefined> {
  const fromReg = registry.get(component.componentKey);
  if (fromReg) return fromReg;

  const titleOwner = registry.getOwnerByTitle(component.templateTitle);
  if (titleOwner && titleOwner !== component.componentKey && !allowDuplicateTemplateTitles) {
    throw new LibraryComposerError(
      'DUPLICATE_TEMPLATE_TITLE',
      `Template title '${component.templateTitle}' is already owned by componentKey '${titleOwner}'.`,
      { templateTitle: component.templateTitle, existingOwner: titleOwner, componentKey: component.componentKey },
    );
  }

  const listResult = await client.listTemplates({
    search: component.templateTitle,
    per_page: 100,
  });

  for (const tpl of listResult.templates ?? []) {
    const parsed = parseComponentTags(tpl.tags);
    if (parsed.componentKey === component.componentKey) {
      const tplData = await client.getTemplateData(tpl.id);
      const elements = Array.isArray(tplData.elementor_data) ? tplData.elementor_data : [];
      const structureHash = parsed.structureHash ?? computeStructureHash(elements);
      const contentHash = computeContentHash(elements);
      const elementIds = elements.length > 0 ? collectTreeElementIds(elements, `template:${tpl.id}`) : [];
      const record: RegisteredLibraryComponent = {
        componentKey: component.componentKey,
        templateId: tpl.id,
        templateTitle: tpl.title,
        componentVersion: parsed.componentVersion ?? component.componentVersion,
        structureHash,
        contentHash,
        elementIds,
        tokenDependencies: extractTreeTokenDependencies(elements),
      };
      registry.set(record);
      return record;
    }

    if (tpl.title === component.templateTitle && !allowDuplicateTemplateTitles) {
      throw new LibraryComposerError(
        'DUPLICATE_TEMPLATE_TITLE',
        `Library already contains template [${tpl.id}] titled '${tpl.title}' not bound to componentKey '${component.componentKey}'.`,
        { templateId: tpl.id, templateTitle: tpl.title, componentKey: component.componentKey },
      );
    }
  }

  return undefined;
}

/**
 * Library-first idempotent composer:
 * 1. Validates all `nav-menu` and `tp_*` widgets against installed control schemas/versions.
 * 2. Upserts reusable Elementor Library templates by `componentKey` + `componentVersion` + `structureHash`.
 * 3. Prevents duplicate templates, duplicate template titles, and duplicate `elementIds`.
 * 4. Requires `componentVersion` bump on incompatible structural change (`COMPONENT_VERSION_BUMP_REQUIRED`).
 * 5. Enforces native editability write gate and emits `elementeer-composition-manifest/v1`.
 */
export async function composeLibraryPage(
  client: LibraryComposerClient,
  input: ComposeLibraryPageInput,
  registry: LibraryComponentRegistry = defaultLibraryComponentRegistry,
): Promise<ComposeLibraryPageResult> {
  if (!Array.isArray(input.components) || input.components.length === 0) {
    throw new LibraryComposerError(
      'COMPOSITION_IDEMPOTENCY_VIOLATION',
      'composeLibraryPage requires at least one component blueprint.',
    );
  }

  const allowDuplicateTemplateTitles = input.allowDuplicateTemplateTitles ?? false;
  const seenKeys = new Set<string>();
  const seenPageElementIds = new Set<string>(input.pageRootElementIds ?? []);
  const componentRecords: CompositionComponentRecord[] = [];
  const slots: CompositionSlot[] = [];
  const composedElements: ElementorElementNode[] = [];
  const allPageElementIds: string[] = [...(input.pageRootElementIds ?? [])];
  const aggColors = new Set<string>();
  const aggTypography = new Set<string>();

  for (let slotOrder = 0; slotOrder < input.components.length; slotOrder += 1) {
    const comp = input.components[slotOrder]!;

    if (!comp.componentKey || !comp.componentVersion || !comp.templateTitle) {
      throw new LibraryComposerError(
        'COMPOSITION_IDEMPOTENCY_VIOLATION',
        `Component at slot ${slotOrder} must provide non-empty componentKey, componentVersion, and templateTitle.`,
      );
    }
    if (seenKeys.has(comp.componentKey)) {
      throw new LibraryComposerError(
        'COMPOSITION_IDEMPOTENCY_VIOLATION',
        `Duplicate componentKey '${comp.componentKey}' in composition input.`,
        { componentKey: comp.componentKey },
      );
    }
    seenKeys.add(comp.componentKey);

    if (!Array.isArray(comp.elements) || comp.elements.length === 0) {
      throw new LibraryComposerError(
        'COMPOSITION_IDEMPOTENCY_VIOLATION',
        `Component '${comp.componentKey}' must contain at least one top-level Elementor element.`,
      );
    }

    // Validate nav-menu and tp_* widgets before any write or upsert
    assertWidgetControlsValid(comp.elements, input.installedPlugins);

    // Collect & enforce unique elementIds within component and across page
    const compElementIds = collectTreeElementIds(comp.elements, comp.componentKey);
    for (const eid of compElementIds) {
      if (seenPageElementIds.has(eid)) {
        throw new LibraryComposerError(
          'DUPLICATE_ELEMENT_ID',
          `Duplicate elementId '${eid}' across page composition (detected in '${comp.componentKey}').`,
          { elementId: eid, componentKey: comp.componentKey },
        );
      }
      seenPageElementIds.add(eid);
      allPageElementIds.push(eid);
    }

    const clonedCompElements = deepClone(comp.elements);
    const structureHash = comp.structureHash ?? computeStructureHash(clonedCompElements);
    const contentHash = computeContentHash(clonedCompElements);
    const tokenDeps = extractTreeTokenDependencies(clonedCompElements, comp.tokenDependencies);
    for (const c of tokenDeps.colors) aggColors.add(c);
    for (const t of tokenDeps.typography) aggTypography.add(t);

    const existing = await discoverExistingTemplate(
      client,
      comp,
      registry,
      allowDuplicateTemplateTitles,
    );

    let templateId: number;
    let upsertAction: ComponentUpsertAction;

    if (!existing) {
      // Check title collision across other components in registry
      const owner = registry.getOwnerByTitle(comp.templateTitle);
      if (owner && owner !== comp.componentKey && !allowDuplicateTemplateTitles) {
        throw new LibraryComposerError(
          'DUPLICATE_TEMPLATE_TITLE',
          `Template title '${comp.templateTitle}' is already used by '${owner}'.`,
          { templateTitle: comp.templateTitle, componentKey: comp.componentKey },
        );
      }

      const created = await client.createTemplate({
        title: comp.templateTitle,
        type: comp.templateType ?? 'container',
        status: comp.status ?? 'publish',
        tags: encodeComponentTags(comp.componentKey, comp.componentVersion, structureHash),
      });
      await client.updateTemplateData(created.id, clonedCompElements);

      templateId = created.id;
      upsertAction = 'created';
      registry.set({
        componentKey: comp.componentKey,
        templateId,
        templateTitle: comp.templateTitle,
        componentVersion: comp.componentVersion,
        structureHash,
        contentHash,
        elementIds: compElementIds,
        tokenDependencies: tokenDeps,
      });
    } else if (existing.structureHash !== structureHash) {
      // Incompatible structural change requires an explicit version bump
      if (!isVersionBumped(comp.componentVersion, existing.componentVersion)) {
        throw new LibraryComposerError(
          'COMPONENT_VERSION_BUMP_REQUIRED',
          `Incompatible structural change for '${comp.componentKey}' at version '${comp.componentVersion}' (existing structureHash=${existing.structureHash}, new structureHash=${structureHash}). Bump componentVersion above '${existing.componentVersion}'.`,
          {
            componentKey: comp.componentKey,
            currentVersion: existing.componentVersion,
            requestedVersion: comp.componentVersion,
            existingStructureHash: existing.structureHash,
            newStructureHash: structureHash,
            templateId: existing.templateId,
          },
        );
      }

      await client.updateTemplate(existing.templateId, {
        title: comp.templateTitle,
        tags: encodeComponentTags(comp.componentKey, comp.componentVersion, structureHash),
      });
      await client.updateTemplateData(existing.templateId, clonedCompElements);

      templateId = existing.templateId;
      upsertAction = 'updated';
      registry.set({
        componentKey: comp.componentKey,
        templateId,
        templateTitle: comp.templateTitle,
        componentVersion: comp.componentVersion,
        structureHash,
        contentHash,
        elementIds: compElementIds,
        tokenDependencies: tokenDeps,
      });
    } else if (
      comp.componentVersion !== existing.componentVersion ||
      (comp.updateIfContentChanged && existing.contentHash !== contentHash)
    ) {
      await client.updateTemplate(existing.templateId, {
        title: comp.templateTitle,
        tags: encodeComponentTags(comp.componentKey, comp.componentVersion, structureHash),
      });
      await client.updateTemplateData(existing.templateId, clonedCompElements);

      templateId = existing.templateId;
      upsertAction = 'updated';
      registry.set({
        componentKey: comp.componentKey,
        templateId,
        templateTitle: comp.templateTitle,
        componentVersion: comp.componentVersion,
        structureHash,
        contentHash,
        elementIds: compElementIds,
        tokenDependencies: tokenDeps,
      });
    } else {
      templateId = existing.templateId;
      upsertAction = 'reused';
    }

    const rootElementId = clonedCompElements[0]!.id;
    const defaultSlotSuffix = comp.componentKey.split('/').pop() || `comp-${slotOrder}`;
    const slotKey = comp.slotKey ?? `slot-${slotOrder}-${defaultSlotSuffix}`;

    componentRecords.push({
      componentKey: comp.componentKey,
      templateId,
      templateTitle: comp.templateTitle,
      componentVersion: comp.componentVersion,
      structureHash,
      slotOrder,
      elementIds: compElementIds,
      tokenDependencies: tokenDeps,
      upsertAction,
    });

    slots.push({
      slotKey,
      order: slotOrder,
      componentKey: comp.componentKey,
      templateId,
      rootElementId,
    });

    composedElements.push(...clonedCompElements);
  }

  // Enforce native editability write gate before composing/writing page
  assertNativeWriteAllowed({
    pageId: input.pageId,
    elements: composedElements,
    kitId: input.kitId ?? 1,
    mode: input.mode ?? 'native-elementor',
    environment: input.environment ?? 'production',
  });

  if (input.writeToPage !== false && typeof client.updatePageData === 'function' && typeof input.pageId === 'number') {
    await client.updatePageData(input.pageId, composedElements);
  }

  const pageContentHash = computeContentHash(composedElements);
  const manifest: CompositionManifest = {
    schemaVersion: 'elementeer-composition-manifest/v1',
    pageId: input.pageId,
    pageContentHash,
    kitId: input.kitId ?? 1,
    components: componentRecords,
    slots,
    elementIds: allPageElementIds,
    tokenDependencies: {
      colors: [...aggColors],
      typography: [...aggTypography],
    },
    idempotency: {
      strategy: 'upsert-by-component-key',
      dedupeKey: input.dedupeKey ?? `page-${String(input.pageId)}-compose-v1`,
      duplicateTemplatesPrevented: true,
      duplicateElementIdsPrevented: true,
      allowDuplicateTemplateTitles,
    },
  };

  assertCompositionManifestValid(manifest);

  return {
    manifest,
    composedElements,
    pageContentHash,
  };
}

function mergeElementSettings(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next: Record<string, unknown> = deepClone(current);
  for (const [key, value] of Object.entries(patch)) {
    if (key === '__globals__' && isPlainObject(value) && isPlainObject(next.__globals__)) {
      next.__globals__ = {
        ...(next.__globals__ as Record<string, unknown>),
        ...deepClone(value),
      };
    } else {
      next[key] = deepClone(value);
    }
  }
  return next;
}

function patchTargetInTree(
  nodes: ElementorElementNode[],
  targetElementId: string,
  settingsPatch: Record<string, unknown>,
  installedPlugins?: InstalledPluginsInventory,
): { nextNodes: ElementorElementNode[]; found: boolean } {
  let found = false;

  const visit = (node: ElementorElementNode): ElementorElementNode => {
    if (node.id === targetElementId) {
      found = true;
      const mergedSettings = mergeElementSettings(node.settings ?? {}, settingsPatch);
      // Validate responsive consistency on the patched node
      elementorSettingsToResponsiveControls(mergedSettings, {
        target: node.elType === 'widget' ? 'widget' : 'container',
      });
      const updatedNode: ElementorElementNode = {
        ...node,
        settings: mergedSettings,
      };
      // Validate nav-menu / tp_* controls on patched widget
      assertWidgetControlsValid([updatedNode], installedPlugins);
      return updatedNode;
    }

    if (!Array.isArray(node.elements) || node.elements.length === 0) {
      return node;
    }

    let childChanged = false;
    const nextChildren = node.elements.map((child) => {
      const updatedChild = visit(child);
      if (updatedChild !== child) childChanged = true;
      return updatedChild;
    });

    if (!childChanged) return node;
    return {
      ...node,
      elements: nextChildren,
    };
  };

  const nextNodes = nodes.map((n) => visit(n));
  return { nextNodes, found };
}

/**
 * Apply a single targeted granular delta patch to `targetElementId` on a composed page
 * without rewriting unrelated sections or regenerating existing `elementIds`.
 */
export async function applyGranularPatch(params: {
  pageId: number | string;
  elements: ElementorElementNode[];
  manifest: CompositionManifest;
  patch: GranularPatchOperation;
  client?: LibraryComposerClient;
  installedPlugins?: InstalledPluginsInventory;
}): Promise<GranularPatchResult> {
  const { pageId, elements, manifest, patch, client, installedPlugins } = params;
  const previousPageContentHash = computeContentHash(elements);

  if (patch.expectedPageContentHash !== previousPageContentHash) {
    throw new LibraryComposerError(
      'STALE_PAGE_CONTENT_HASH',
      `Stale expectedPageContentHash '${patch.expectedPageContentHash}' for page ${String(pageId)} (current: '${previousPageContentHash}').`,
      {
        pageId,
        expectedPageContentHash: patch.expectedPageContentHash,
        currentPageContentHash: previousPageContentHash,
      },
    );
  }

  const originalElementIds = collectTreeElementIds(elements, `page:${String(pageId)}`);
  const { nextNodes, found } = patchTargetInTree(
    elements,
    patch.targetElementId,
    patch.settingsPatch,
    installedPlugins,
  );

  if (!found) {
    throw new LibraryComposerError(
      'TARGET_ELEMENT_NOT_FOUND',
      `Target element '${patch.targetElementId}' was not found on page ${String(pageId)}.`,
      { pageId, targetElementId: patch.targetElementId },
    );
  }

  const unchangedTopLevelSectionIndices: number[] = [];
  for (let i = 0; i < elements.length; i += 1) {
    if (nextNodes[i] === elements[i]) {
      unchangedTopLevelSectionIndices.push(i);
    }
  }

  const preservedElementIds = collectTreeElementIds(nextNodes, `page:${String(pageId)}:patched`);
  if (
    preservedElementIds.length !== originalElementIds.length ||
    preservedElementIds.some((id, idx) => id !== originalElementIds[idx])
  ) {
    throw new LibraryComposerError(
      'COMPOSITION_IDEMPOTENCY_VIOLATION',
      'Granular patch mutated or regenerated elementIds unexpectedly.',
    );
  }

  if (!patch.dryRun && client?.patchWidget && typeof pageId === 'number') {
    await client.patchWidget(pageId, patch.targetElementId, {
      settings: patch.settingsPatch,
      content_hash: previousPageContentHash,
      dry_run: false,
    });
  }

  const pageContentHash = computeContentHash(nextNodes);

  // Refresh manifest hash and token dependencies while preserving all templateIds, slots, and elementIds
  const nextTopDepsColors = new Set<string>();
  const nextTopDepsTypo = new Set<string>();

  const nextComponents: CompositionComponentRecord[] = manifest.components.map((comp) => {
    const compIdSet = new Set(comp.elementIds);
    const matchingTop = nextNodes.filter((n) => compIdSet.has(n.id));
    const refreshedDeps =
      matchingTop.length > 0
        ? extractTreeTokenDependencies(matchingTop)
        : comp.tokenDependencies;
    for (const c of refreshedDeps.colors) nextTopDepsColors.add(c);
    for (const t of refreshedDeps.typography) nextTopDepsTypo.add(t);
    return {
      ...comp,
      tokenDependencies: refreshedDeps,
    };
  });

  const nextManifest: CompositionManifest = {
    ...manifest,
    pageContentHash,
    components: nextComponents,
    tokenDependencies: {
      colors: [...nextTopDepsColors],
      typography: [...nextTopDepsTypo],
    },
  };

  assertCompositionManifestValid(nextManifest);

  return {
    pageId,
    targetElementId: patch.targetElementId,
    previousPageContentHash,
    pageContentHash,
    fullPageRewrite: false,
    mutatedElementIds: [patch.targetElementId],
    preservedElementIds,
    unchangedTopLevelSectionIndices,
    elements: nextNodes,
    manifest: nextManifest,
  };
}
