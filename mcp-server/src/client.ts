// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  ElementeerTemplate,
  ElementeerTemplateList,
  ElementeerError,
  ElementeerErrorCode,
  SiteInfo,
  GlobalColor,
  GlobalTypographyEntry,
  GlobalStylesData,
  SiteContext,
  SiteAssessment,
  SiteFingerprint,
  SiteFingerprintSignal,
  QueuedChange,
  AssessmentIssue,
  SiteContextRole,
  SiteContextPurpose,
  Recommendation,
  RecommendationCategory,
  ThemeBuilderTemplateSummary,
  DestinationProfile,
  DestinationProfileKind,
  Capability,
  CapabilityId,
  CapabilityMatrix,
  ControlIntent,
  BrandAdaptationPlan,
  DesignColorToken,
  DesignSpacingToken,
  DesignTokenReport,
  DesignTypographyToken,
  DesignValueHint,
  ImportReport,
  ImportSmokeTestPlan,
  LayoutRiskCode,
  LayoutRiskSeverity,
  LayoutRiskSignal,
  OutputCritique,
  PipelinePathPlan,
  ProjectChangeStyle,
  ProjectCopyDensity,
  ProjectEditingMode,
  ProjectLayoutPriority,
  ProjectProfile,
  ProjectQuestionPolicy,
  ProductSurfaceAssignment,
  RiskResolutionMode,
  TierBoundaryCase,
  RebuildStrategy,
  RecommendationEngineInput,
  RecommendationEngineReport,
  StrategyCritique,
  AddonProfileId,
  GuidanceMode,
  IntentWizardDepth,
  IntentWizardId,
  IntentWizardInput,
  IntentWizardIntent,
  IntentWizardOrigin,
  IntentWizardRoute,
  IntentWizardScenarioId,
  IntentWizardTierRecommendation,
  IntentWizardUserPosture,
  RecommendedAddonProfile,
  RecommendedSkillProfile,
  RecommendedStackProfile,
  SkillProfileId,
  StackProfileId,
  StackReadinessSignals,
} from '@elementeer/shared';

export type {
  AssessmentIssue,
  Capability,
  CapabilityId,
  CapabilityMatrix,
  ControlIntent,
  BrandAdaptationPlan,
  DesignColorToken,
  DesignSpacingToken,
  DesignTokenReport,
  DesignTypographyToken,
  DesignValueHint,
  DestinationProfile,
  DestinationProfileKind,
  GlobalColor,
  GlobalStylesData,
  GlobalTypographyEntry,
  ImportReport,
  ImportSmokeTestPlan,
  LayoutRiskCode,
  LayoutRiskSeverity,
  LayoutRiskSignal,
  OutputCritique,
  PipelinePathPlan,
  ProjectChangeStyle,
  ProjectCopyDensity,
  ProjectEditingMode,
  ProjectLayoutPriority,
  ProjectProfile,
  ProjectQuestionPolicy,
  ProductSurfaceAssignment,
  QueuedChange,
  RiskResolutionMode,
  RebuildStrategy,
  Recommendation,
  RecommendationEngineInput,
  RecommendationEngineReport,
  RecommendationCategory,
  SiteAssessment,
  SiteContext,
  SiteContextPurpose,
  SiteContextRole,
  SiteFingerprint,
  SiteFingerprintSignal,
  SiteInfo,
  StrategyCritique,
  ThemeBuilderTemplateSummary,
  TierBoundaryCase,
  AddonProfileId,
  GuidanceMode,
  IntentWizardDepth,
  IntentWizardId,
  IntentWizardInput,
  IntentWizardIntent,
  IntentWizardOrigin,
  IntentWizardRoute,
  IntentWizardScenarioId,
  IntentWizardTierRecommendation,
  IntentWizardUserPosture,
  RecommendedAddonProfile,
  RecommendedSkillProfile,
  RecommendedStackProfile,
  SkillProfileId,
  StackProfileId,
  StackReadinessSignals,
} from '@elementeer/shared';

export class ElementeerApiError extends Error {
  constructor(
    public readonly code: ElementeerErrorCode,
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ElementeerApiError';
  }
}

export interface CreateTemplateInput {
  title: string;
  type: ElementeerTemplate['type'];
  status?: ElementeerTemplate['status'];
  elementor_data?: string;
  categories?: string[];
  tags?: string[];
}

export interface UpdateTemplateInput {
  title?: string;
  status?: ElementeerTemplate['status'];
  categories?: string[];
  tags?: string[];
}

export interface LibraryImportSource {
  kind: 'local-elementor' | 'elementeer-premium';
  asset_id: string;
  asset_title?: string;
  reference?: string;
}

export interface ImportLibraryAssetInput {
  title: string;
  type: ElementeerTemplate['type'];
  status?: ElementeerTemplate['status'];
  elementor_data: unknown[];
  categories?: string[];
  tags?: string[];
  source: LibraryImportSource;
}

export interface ImportLibraryAssetResult {
  imported: true;
  import_mode: 'manual-import';
  source: LibraryImportSource;
  template: ElementeerTemplate;
}

export interface ImportExternalDataInput {
  format: 'csv' | 'json' | 'xml';
  data: string;
  post_type?: string;
  field_mapping?: Record<string, string>;
  duplicate_detection?: 'title' | 'slug' | 'sku' | 'none';
  dry_run?: boolean;
}

export interface ImportExternalDataResult {
  imported: boolean;
  imported_count: number;
  skipped_count: number;
  duplicate_count: number;
  errors: Array<{ row: number; error: string }>;
  summary: string;
}

export interface ExportDataParams {
  post_type?: string;
  format?: 'csv' | 'json';
  filters?: {
    status?: string;
    category?: string | number;
    author?: number;
    search?: string;
    date_range?: { start?: string; end?: string };
  };
  limit?: number;
  offset?: number;
}

export interface ExportDataResponse {
  exported: boolean;
  total: number;
  count: number;
  offset: number;
  limit: number;
  format: 'csv' | 'json';
  data: Array<{
    id: number;
    title: string;
    content: string;
    excerpt: string;
    slug: string;
    status: string;
    author: number;
    date: string;
    modified: string;
    post_type: string;
    parent: number;
    menu_order: number;
    comment_count: number;
    guid: string;
    featured_image?: string;
    meta: Record<string, unknown>;
    [key: `taxonomy_${string}`]: string[];
  }>;
}

export interface TranslationCoverageAnalysis {
  multilingual_plugin: string | null;
  configured_languages: string[];
  coverage_matrix: Array<{
    post_id: number;
    post_title: string;
    post_type: string;
    post_language: string;
    translations: Array<{
      language: string;
      status: 'translated' | 'missing' | 'outdated';
      post_id?: number;
      post_title?: string;
      last_modified?: string;
    }>;
  }>;
  summary: {
    total_posts: number;
    total_translated: number;
    total_missing: number;
    total_outdated: number;
    coverage_percent: number;
  };
}

export interface UntranslatedString {
  id: string;
  text: string;
  context?: string;
  source_language: string;
}

export interface UntranslatedStringsResponse {
  strings: UntranslatedString[];
  total: number;
}

export interface StringTranslationRequest {
  id: string;
  text: string;
  translated_text: string;
}

export interface TranslateStringsResponse {
  applied: number;
  preview: boolean;
  strings: StringTranslationRequest[];
}

export interface UntranslatedMediaItem {
  media_id: number;
  alt?: string;
  caption?: string;
  description?: string;
  title?: string;
  source_language: string;
}

export interface UntranslatedMediaResponse {
  media: UntranslatedMediaItem[];
  total: number;
}

export interface MediaTranslationRequest {
  media_id: number;
  alt?: string;
  caption?: string;
  description?: string;
  title?: string;
}

export interface AllyStatus {
  ally_available: boolean;
  plugin: string | null;
  version: string | null;
  tier: 'free' | 'pro' | 'one' | null;
  credits_remaining: number | null;
  capabilities: {
    scan: boolean;
    report: boolean;
    basic_fixes: boolean;
    ai_fixes: boolean;
    batch_scan: boolean;
    scheduled_scans: boolean;
    custom_rules: boolean;
  };
}

export interface AllyScanResults {
  scans: any[];
  last_scan: string | null;
  available_credits: number;
  ally_status: AllyStatus;
  message: string;
}

export interface AllyTriggerScanResponse {
  triggered: boolean;
  scan_id: string | null;
  message: string;
  credits_required: number;
  credits_remaining: number;
  ally_status: AllyStatus;
}

export interface AllyApplyFixResponse {
  fixed: boolean;
  message: string;
  scan_id: string;
  issue_id: string;
  fix_type: string;
  ally_status: AllyStatus;
}

export interface AccessibilityScanResult {
  scanned_at: string;
  page_id: number | null;
  scan_type: string;
  violations: Array<{
    severity: 'critical' | 'serious' | 'moderate' | 'minor';
    element_type: string;
    location: Record<string, any>;
    description: string;
    suggested_fix: string;
  }>;
  count: number;
}

export interface TranslateMediaResponse {
  applied: number;
  preview: boolean;
  items: MediaTranslationRequest[];
}

export interface LmsStatus {
  lms_available: boolean;
  plugin: string | null;
  version: string | null;
  course_count: number;
}

export interface LmsCourseList {
  courses: Array<{
    id: number;
    title: string;
    slug: string;
    status: string;
    url: string;
    description?: string;
    price?: string;
    students_count?: number;
  }>;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface LmsCourseStructure {
  course_id: number;
  title: string;
  sections: Array<{
    id: number;
    title: string;
    order: number;
    lessons: Array<{
      id: number;
      title: string;
      order: number;
      content_type?: string;
      duration?: string;
      completed?: boolean;
    }>;
    quizzes?: Array<{
      id: number;
      title: string;
      order: number;
      question_count?: number;
    }>;
  }>;
}

export interface CharityStatus {
  charity_available: boolean;
  plugin: string | null;
  version: string | null;
  form_count: number;
}

export interface CharityFormList {
  forms: Array<{
    id: number;
    title: string;
    slug: string;
    status: string;
    url: string;
    goal?: string;
    raised?: string;
    donor_count?: number;
  }>;
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface CharityDonationStats {
  total_raised: number;
  donor_count: number;
  average_donation: number;
  total_donations: number;
}

export interface VoxelStatus {
  voxel_available: boolean;
  version: string | null;
  post_type_count: number;
  taxonomy_count: number;
  product_type_count: number;
}

export interface VoxelPostTypeList {
  post_types: Array<{
    key: string;
    label: string;
    singular: string;
    is_public: boolean;
    is_editable: boolean;
  }>;
  total: number;
}

export interface VoxelPostTypeDetail {
  key: string;
  label: string;
  singular: string;
  is_public: boolean;
  is_editable: boolean;
  fields?: Array<{
    key: string;
    type: string;
    label: string;
  }>;
  error?: string;
}

export interface VoxelTaxonomyList {
  taxonomies: Array<{
    key: string;
    label: string;
    singular: string;
    post_type: string | null;
  }>;
  total: number;
}

export interface VoxelProductTypeList {
  product_types: Array<{
    key: string;
    label: string;
  }>;
  total: number;
}

export interface VoxelSettings {
  settings: Record<string, unknown>;
}

export interface VoxelHealth {
  healthy: boolean;
  issues: string[];
  rest_reachable: boolean;
  tables_healthy: boolean;
  memory_usage_mb: number | null;
}

export interface ListTemplatesParams {
  page?: number;
  per_page?: number;
  type?: ElementeerTemplate['type'];
  status?: string;
  search?: string;
  category?: string;
}

export class ElementeerClient {
  private http: AxiosInstance;
  private availableRoutes: Map<string, string[]> | null = null;
  /** Active change session id — sent as X-Elementeer-Session header on every write. */
  private currentSessionId: string | null = null;

  constructor(siteUrl: string, apiKey: string) {
    const baseURL = siteUrl.replace(/\/$/, '') + '/wp-json/elementeer/v1';

    this.http = axios.create({
      baseURL,
      headers: {
        'X-Elementeer-Key': apiKey,
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      timeout: 30_000,
    });

    // Interceptor: inject X-Elementeer-Session header on every request
    this.http.interceptors.request.use((config) => {
      if (this.currentSessionId) {
        config.headers['X-Elementeer-Session'] = this.currentSessionId;
      }
      return config;
    });

    // Response interceptor — normalize errors
    this.http.interceptors.response.use(
      (res) => res,
      (err: AxiosError<unknown>) => {
        throw this.handleError(err);
      },
    );
  }

  setSession(sessionId: string | null): void {
    this.currentSessionId = sessionId;
  }

  // ------------------------------------------------------------------ //
  // Route discovery (CLI-001)
  // ------------------------------------------------------------------ //

  async discoverRoutes(): Promise<Map<string, string[]>> {
    try {
      const baseURL = this.http.defaults.baseURL as string;
      const rootIndex = baseURL.replace(/\/elementeer\/v1\/?$/, '');
      const res = await axios.get(rootIndex, { timeout: 10_000 });

      const routes = new Map<string, string[]>();
      const data = res.data as { routes?: Record<string, { methods: string[] }>; namespaces?: string[] };

      if (data?.routes) {
        for (const [routePath, methods] of Object.entries(data.routes)) {
          if (Array.isArray(methods)) continue;
          routes.set(routePath, methods.methods ?? []);
        }
      } else if (data?.namespaces) {
        try {
          const nsRes = await axios.get(baseURL, { timeout: 10_000 });
          const nsData = nsRes.data as { routes?: Record<string, { methods: string[] }> };
          if (nsData?.routes) {
            for (const [routePath, methods] of Object.entries(nsData.routes)) {
              if (Array.isArray(methods)) continue;
              routes.set(routePath, methods.methods ?? []);
            }
          }
        } catch {
          // Ignore namespace resolution failures
        }
      }

      this.availableRoutes = routes;
      process.stderr.write(
        `[ElementeerClient] Route discovery complete: ${routes.size} routes found.\n`,
      );
      return routes;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[ElementeerClient] Route discovery failed: ${message}. Assuming all routes available.\n`,
      );
      this.availableRoutes = null;
      return this.availableRoutes;
    }
  }

  isRouteAvailable(route: string, method: string): boolean {
    if (!this.availableRoutes) return true;
    const methods = this.availableRoutes.get(route);
    if (!methods) {
      const altRoute = '/elementeer/v1' + route;
      const altMethods = this.availableRoutes.get(altRoute);
      if (altMethods) {
        return altMethods.includes(method.toUpperCase()) || altMethods.includes(method);
      }
      return false;
    }
    return methods.includes(method.toUpperCase()) || methods.includes(method);
  }

  preflightRoute(operation: string): { route: string; method: string; available: boolean } {
    const OPERATION_ROUTE_MAP: Record<string, { route: string; method: string }> = {
      create_template: { route: '/templates', method: 'POST' },
      save_page_section_as_template: { route: '/templates', method: 'POST' },
      save_full_page_as_template: { route: '/templates', method: 'POST' },
      compose_page_from_templates: { route: '/templates', method: 'POST' },
      update_template_data: { route: '/templates/{id}/data', method: 'PUT' },
      update_page_data: { route: '/pages/{id}/data', method: 'PUT' },
      set_global_colors: { route: '/site/global-styles/colors', method: 'PUT' },
      set_global_typography: { route: '/site/global-styles/typography', method: 'PUT' },
      set_site_logo: { route: '/site/logo', method: 'PUT' },
      set_site_context: { route: '/site/context', method: 'PUT' },
      flush_elementor_cache: { route: '/site/performance/flush-cache', method: 'POST' },
      optimize_elementor_assets: { route: '/site/performance/optimize-assets', method: 'POST' },
      update_seo_meta: { route: '/site/seo/meta', method: 'PUT' },
      update_site_settings: { route: '/site/settings', method: 'PUT' },
      import_external_data: { route: '/import/external', method: 'POST' },
      delete_template: { route: '/templates/{id}', method: 'DELETE' },
      delete_post: { route: '/posts/{id}', method: 'DELETE' },
      delete_menu: { route: '/menus/{id}', method: 'DELETE' },
      delete_menu_item: { route: '/menu-items/{id}', method: 'DELETE' },
      delete_term: { route: '/terms/{taxonomy}', method: 'DELETE' },
      delete_media: { route: '/media/{id}', method: 'DELETE' },
    };

    const mapped = OPERATION_ROUTE_MAP[operation];
    if (!mapped) {
      return { route: operation, method: 'GET', available: true };
    }

    const available = this.isRouteAvailable(mapped.route, mapped.method);
    return { route: mapped.route, method: mapped.method, available };
  }

  /** @internal — public for unit testing only */
  handleError(err: AxiosError<unknown>): ElementeerApiError {
    if (!err.response) {
      return new ElementeerApiError(
        'not_found',
        `Network error: ${err.message}`,
        0,
      );
    }

    const { status } = err.response;
    const data = err.response.data as ElementeerError | undefined;
    const code = data?.code as string | undefined;

    // Critical distinction: scope errors must NOT surface as "invalid key"
    if (code === 'elementeer_insufficient_scope' || code === 'auth_insufficient_scope') {
      return new ElementeerApiError(
        'auth_insufficient_scope',
        data?.message ?? 'API key lacks the required capability for this operation.',
        status,
      );
    }

    if (code === 'elementeer_governance_blocked' || code === 'governance_blocked') {
      return new ElementeerApiError(
        'governance_blocked',
        data?.message ?? 'This operation is blocked by governance settings.',
        status,
      );
    }

    if (code === 'elementeer_invalid_key' || code === 'auth_invalid_key') {
      return new ElementeerApiError(
        'auth_invalid_key',
        data?.message ?? 'Invalid or missing API key.',
        status,
      );
    }

    if (code === 'elementeer_key_inactive' || code === 'auth_key_inactive') {
      return new ElementeerApiError(
        'auth_key_inactive',
        data?.message ?? 'API key is inactive.',
        status,
      );
    }

    if (status === 401) {
      return new ElementeerApiError(
        'auth_invalid_key',
        data?.message ?? 'Unauthorized.',
        status,
      );
    }

    if (status === 403) {
      // 403 with a "scope" message is insufficient_scope, not invalid_key
      const msg = data?.message ?? '';
      if (msg.toLowerCase().includes('scope') || msg.toLowerCase().includes('capabilit')) {
        return new ElementeerApiError('auth_insufficient_scope', msg, status);
      }
      return new ElementeerApiError('governance_blocked', msg || 'Forbidden.', status);
    }

    if (status === 404) {
      const msg = data?.message ?? 'Not found.';
      // Detect Pro-only routes that would 404 when Pro plugin is not active
      const url = err.config?.url ?? '';
      const isProRoute =
        url.includes('/woocommerce/') ||
        url.includes('/booking/amelia/') ||
        url.includes('/snapshots') ||
        url.includes('/changes/') ||
        url.includes('/workflows') ||
        url.includes('/import/external') ||
        url.includes('/export/data') ||
        url.includes('/media/sideload') ||
        url.includes('/media/search-stock') ||
        url.includes('/translation/strings/translate') ||
        url.includes('/translation/media/translate') ||
        url.includes('/site/performance/optimize') ||
        url.includes('/site/performance/cache-recommendation') ||
        url.includes('/site/performance/diagnose') ||
        url.includes('/site/performance/core-web-vitals') ||
        url.includes('/site/performance/generate-critical-css') ||
        url.includes('/site/performance/analyze');

      if (isProRoute) {
        return new ElementeerApiError(
          'pro_required',
          'This feature requires the Elementeer Pro plugin to be active on your WordPress site.',
          status,
        );
      }
      return new ElementeerApiError('not_found', msg, status);
    }

    if (status === 429) {
      return new ElementeerApiError('rate_limited', data?.message ?? 'Rate limited.', status);
    }

    const knownCode = (data?.code as ElementeerErrorCode) ?? 'not_found';
    return new ElementeerApiError(
      knownCode,
      data?.message ?? `Request failed with status ${status}`,
      status,
    );
  }

  // ------------------------------------------------------------------ //
  // Template operations
  // ------------------------------------------------------------------ //

  async listTemplates(params: ListTemplatesParams = {}): Promise<ElementeerTemplateList> {
    const res = await this.http.get<ElementeerTemplateList>('/templates', { params });
    return res.data;
  }

  async getTemplate(id: number): Promise<any> {
    const res = await this.http.get<any>(`/templates/${id}`);
    return res.data;
  }

  async createTemplate(params: any): Promise<any> {
    if (!this.availableRoutes || this.isRouteAvailable('/templates', 'POST')) {
      return this.createTemplateDirect(params);
    }

    const canDuplicate = this.isRouteAvailable('/templates/{id}/duplicate', 'POST');
    const canUpdateData = this.isRouteAvailable('/templates/{id}/data', 'PUT');

    if (canDuplicate && canUpdateData) {
      process.stderr.write(
        '[ElementeerClient] /templates POST unavailable — using seed-duplication fallback.\n',
      );
      return this.createTemplateWithFallback(params);
    }

    return this.createTemplateDirect(params);
  }

  private async createTemplateDirect(params: any): Promise<any> {
    const res = await this.http.post<any>('/templates', params);
    return res.data;
  }

  private async createTemplateWithFallback(params: any): Promise<any> {
    let seedId: number | null = null;

    const candidateQueries = [
      { type: 'section', status: 'draft' },
      { type: 'section', status: 'publish' },
      { status: 'publish' },
    ];

    for (const query of candidateQueries) {
      try {
        const listResult = await this.listTemplates({ ...query, per_page: 1 });
        if (listResult.templates?.length > 0) {
          seedId = listResult.templates[0].id;
          break;
        }
      } catch {
        // Continue to next query
      }
    }

    if (!seedId) {
      throw new Error(
        'Cannot create template: /templates POST is unavailable and no seed template was found for the duplication fallback.',
      );
    }

    const duplicate = await this.duplicateTemplate(seedId, params.title);

    await this.updateTemplate(duplicate.id, {
      title: params.title,
      status: params.status ?? 'draft',
    });

    if (params.categories?.length || params.tags?.length) {
      try {
        await this.http.patch(`/templates/${duplicate.id}`, {
          categories: params.categories,
          tags: params.tags,
        });
      } catch {
        // Non-critical
      }
    }

    if (params.elementor_data) {
      let data: unknown[];
      if (typeof params.elementor_data === 'string') {
        try {
          data = JSON.parse(params.elementor_data);
        } catch {
          data = [];
        }
      } else if (Array.isArray(params.elementor_data)) {
        data = params.elementor_data;
      } else {
        data = [params.elementor_data];
      }
      await this.updateTemplateData(duplicate.id, data);
    }

    return {
      ...duplicate,
      type: params.type ?? duplicate.type,
    };
  }

  async updateTemplate(id: number, updates: any): Promise<any> {
    const res = await this.http.patch<any>(`/templates/${id}`, updates);
    return res.data;
  }

  async deleteTemplate(id: number): Promise<{ deleted: boolean; id: number }> {
    const res = await this.http.delete<{ deleted: boolean; id: number }>(`/templates/${id}`);
    return res.data;
  }

  async duplicateTemplate(id: number, title?: string): Promise<any> {
    const res = await this.http.post<any>(`/templates/${id}/duplicate`, { title });
    return res.data;
  }

  async importLibraryAsset(params: any): Promise<any> {
    const res = await this.http.post<any>('/library/import', params);
    return res.data;
  }

  async listActiveAddons(): Promise<Array<{active: boolean, version: string|null, tier: string|null, plugin_name: string, plugin_slug: string}>> {
    const res = await this.http.get('/addons');
    return res.data;
  }

  async listActiveAddonsDetailed(): Promise<Array<{
    active: boolean;
    version: string | null;
    tier: string | null;
    plugin_name: string;
    plugin_slug: string;
    widgets: Array<{ id: string; title: string; active: boolean }>;
    post_types: Array<{ slug: string; label: string }>;
    capabilities: string[];
    elementor_widget_types: string[];
  }>> {
    const res = await this.http.get('/addons/detailed');
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Template data (Elementor JSON)
  // ------------------------------------------------------------------ //

  async getTemplateData(id: number): Promise<{ id: number; elementor_data: unknown[]; content_hash?: string }> {
    const res = await this.http.get<{ id: number; elementor_data: unknown[]; content_hash?: string }>(
      `/templates/${id}/data`,
    );
    return res.data;
  }

  async updateTemplateData(
    id: number,
    elementorData: unknown[],
  ): Promise<{ id: number; updated: true }> {
    const res = await this.http.put<{ id: number; updated: true }>(`/templates/${id}/data`, {
      elementor_data: elementorData,
    });
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Widget patching (DELTA-001, DELTA-002)
  // ------------------------------------------------------------------ //

  async patchWidget(
    id: number,
    widgetId: string,
    params: {
      settings: Record<string, unknown>;
      content_hash: string;
      dry_run?: boolean;
    },
  ): Promise<{
    post_id: number;
    widget_id: string;
    path: string;
    updated: boolean;
    new_hash: string;
  }> {
    const res = await this.http.patch(`/pages/${id}/widgets/${widgetId}`, params);
    return res.data;
  }

  async patchWidgetsBatch(
    id: number,
    params: {
      operations: Array<{
        widget_id: string;
        settings: Record<string, unknown>;
      }>;
      content_hash: string;
      dry_run?: boolean;
      partial?: boolean;
    },
  ): Promise<{
    post_id: number;
    updated: number;
    updated_ids: string[];
    results: Array<{ widget_id: string; path: string; updated: boolean }>;
    not_found: string[];
    partial: boolean;
    new_hash: string;
  }> {
    const res = await this.http.post(`/pages/${id}/widgets/batch`, params);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Change Sessions (DELTA-004)
  // ------------------------------------------------------------------ //

  async beginChangeSession(): Promise<{ session_id: string; status: string }> {
    const res = await this.http.post('/changes/sessions/begin');
    return res.data;
  }

  async endChangeSession(sessionId: string): Promise<{ session_id: string; status: string }> {
    const res = await this.http.post(`/changes/sessions/${sessionId}/end`);
    return res.data;
  }

  async restoreChangeSession(sessionId: string): Promise<{
    success: boolean;
    restored: number;
    total: number;
  }> {
    const res = await this.http.post(`/changes/sessions/${sessionId}/restore`);
    return res.data;
  }

  async getChangeSession(sessionId: string): Promise<{
    session_id: string;
    snapshot_uuids: string[];
    status: string;
    created_at: string;
    ended_at?: string;
    rolled_back_at?: string;
  }> {
    const res = await this.http.get(`/changes/sessions/${sessionId}`);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Site Memory (DELTA-005)
  // ------------------------------------------------------------------ //

  async listSiteMemory(): Promise<Array<{
    key: string;
    type: string;
    content: string;
    version: number;
    owner: string;
    expires_at: string | null;
    set_at: string;
    rule?: Record<string, unknown>;
  }>> {
    const res = await this.http.get('/site/memory');
    return res.data;
  }

  async setSiteMemoryEntry(
    key: string,
    params: {
      type: 'fact' | 'preference' | 'lesson' | 'rule';
      content: string;
      owner?: 'agent' | 'user';
      version?: number;
      expires_at?: string | null;
      rule?: { protect?: { post_ids?: number[]; slugs?: string[] } };
    },
  ): Promise<{
    key: string;
    type: string;
    content: string;
    version: number;
    owner: string;
    expires_at: string | null;
    set_at: string;
    rule?: Record<string, unknown>;
  }> {
    const res = await this.http.put(`/site/memory/${key}`, params);
    return res.data;
  }

  async deleteSiteMemoryEntry(key: string): Promise<{ deleted: boolean; key: string }> {
    const res = await this.http.delete(`/site/memory/${key}`);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Site
  // ------------------------------------------------------------------ //

  async getSiteInfo(): Promise<SiteInfo> {
    const res = await this.http.get<SiteInfo>('/site');
    return res.data;
  }

  async assessSite(): Promise<SiteAssessment> {
    const res = await this.http.get<SiteAssessment>('/site/assessment');
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Logo
  // ------------------------------------------------------------------ //

  async getLogo(): Promise<{ logo_id: number | null; logo_url: string | null; set: boolean }> {
    const res = await this.http.get('/site/logo');
    return res.data;
  }

  async setLogo(mediaId: number): Promise<{ logo_id: number; logo_url: string | null; updated: true }> {
    const res = await this.http.put('/site/logo', { media_id: mediaId });
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Global Styles
  // ------------------------------------------------------------------ //

  async getGlobalStyles(): Promise<GlobalStylesData> {
    const res = await this.http.get<GlobalStylesData>('/site/global-styles');
    return res.data;
  }

  async setGlobalColors(
    colors: GlobalColor[],
    slot: 'system' | 'custom' = 'system',
  ): Promise<{ kit_id: number; slot: string; colors: GlobalColor[]; updated: true }> {
    const res = await this.http.put('/site/global-styles/colors', { colors, slot });
    return res.data;
  }

  async setGlobalTypography(
    typography: GlobalTypographyEntry[],
    slot: 'system' | 'custom' = 'system',
  ): Promise<{ kit_id: number; slot: string; typography: unknown[]; updated: true }> {
    const res = await this.http.put('/site/global-styles/typography', { typography, slot });
    return res.data;
  }

  async getSiteContext(): Promise<SiteContext> {
    const res = await this.http.get<SiteContext>('/site/context');
    return res.data;
  }

  async setSiteContext(ctx: Partial<Omit<SiteContext, 'set_at'>>): Promise<SiteContext> {
    const res = await this.http.put<SiteContext>('/site/context', ctx);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Site Settings
  // ------------------------------------------------------------------ //

  async getSiteSettings(): Promise<{
    blogname: string;
    description: string;
    homepage: { id: number; title: string; url: string } | null;
    posts_page: { id: number; title: string; url: string } | null;
    permalink: string;
    timezone: string;
    date_format: string;
    time_format: string;
    start_of_week: number;
  }> {
    const res = await this.http.get('/site/settings');
    return res.data;
  }

  async updateSiteSettings(updates: {
    blogname?: string;
    description?: string;
    homepage?: number;
    posts_page?: number;
    permalink?: string;
  }): Promise<{ updated: string[]; settings: any }> {
    const res = await this.http.put('/site/settings', updates);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // SEO Management
  // ------------------------------------------------------------------ //

  async getSeoMeta(params: { post_id: number }): Promise<{
    post_id: number;
    plugin: string;
    title: string;
    description: string;
    focus_keyword: string;
  }> {
    const res = await this.http.get('/site/seo/meta', { params });
    return res.data;
  }

  async updateSeoMeta(params: {
    post_id: number;
    title?: string;
    description?: string;
    focus_keyword?: string;
  }): Promise<{ post_id: number; plugin: string; updated: string[] }> {
    const res = await this.http.put('/site/seo/meta', params);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Performance & Cache
  // ------------------------------------------------------------------ //

  async flushElementorCache(): Promise<{ flushed: boolean; message: string }> {
    const res = await this.http.post('/site/performance/flush-cache');
    return res.data;
  }

  async getPerformanceReport(): Promise<{
    css_method: string;
    dom_size: { average_nodes: number; note: string };
    asset_optimization: Record<string, boolean | string>;
    cache_status: Record<string, string | null>;
    elementor_status: string | null;
    elementor_pro: boolean;
    php_info: {
      version: string;
      memory_limit: string;
      max_execution_time: string;
      upload_max_filesize: string;
      post_max_size: string;
      opcache_enabled: boolean;
      eol: boolean;
    };
    object_cache: {
      enabled: boolean;
      type: string;
      redis: boolean;
      memcached: boolean;
      apc: boolean;
    };
    autoloaded_options: {
      count: number;
      size_bytes: number;
      size_human: string;
      note: string;
    };
    database_stats: {
      total_size_bytes: number;
      total_size_human: string;
      data_size_bytes: number;
      index_size_bytes: number;
      table_count: number;
      has_query_cache: boolean;
      engine: string;
    };
    enqueued_assets: {
      scripts: number;
      styles: number;
      external_scripts: number;
      external_styles: number;
      total: number;
    };
    render_blocking_resources: {
      count: number;
      resources: Array<{ type: string; handle: string; src: string }>;
      note: string;
    };
  }> {
    const res = await this.http.get('/site/performance/report');
    return res.data;
  }

  async optimizeElementorAssets(): Promise<{
    optimized: boolean;
    message: string;
    suggestions: string[];
  }> {
    const res = await this.http.post('/site/performance/optimize-assets');
    return res.data;
  }

  async cleanDatabase(preview = true): Promise<{
    cleaned: boolean;
    preview: boolean;
    stats: {
      revisions: number;
      transients: number;
      spam_comments: number;
      total: number;
    };
    message: string;
  }> {
    const res = await this.http.post('/site/performance/clean-database', { preview });
    return res.data;
  }

  async getCacheRecommendation(): Promise<{
    hosting: string;
    server: string;
    recommended_plugin: string | null;
    should_install: boolean;
    reason: string;
    detected_server_software: string;
  }> {
    const res = await this.http.get('/site/performance/cache-recommendation');
    return res.data;
  }

  async diagnoseIssue(symptom: 'slow_page' | 'white_screen' | '500_error' | 'plugin_conflict'): Promise<{
    symptom: string;
    title: string;
    steps: Array<{
      step: number;
      action: string;
      command: string;
      expected: string;
      risk?: string;
    }>;
    note: string;
  }> {
    const res = await this.http.post('/site/performance/diagnose-issue', { symptom });
    return res.data;
  }

  async readErrorLog(lines = 50): Promise<{
    exists: boolean;
    message?: string;
    total_lines: number;
    recent_lines: number;
    entries: string[];
  }> {
    const res = await this.http.get('/site/performance/error-log', { params: { lines } });
    return res.data;
  }

  async testPluginConflict(pluginSlug: string, action: 'deactivate' | 'reactivate'): Promise<{
    action: string;
    plugin: string;
    simulated: boolean;
    message: string;
    note: string;
  }> {
    const res = await this.http.post('/site/performance/test-plugin-conflict', {
      plugin_slug: pluginSlug,
      action,
    });
    return res.data;
  }

  async getWizard(wizardId: string): Promise<{
    status: 'active' | 'inactive' | 'missing' | 'needs_configuration';
    gaps: Array<{
      id: string;
      severity: 'critical' | 'warning' | 'info';
      description: string;
      data?: Record<string, unknown>;
    }>;
    recommendations: Array<{
      id: string;
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      action: string;
      gap_id?: string;
    }>;
    suggested_tools: Array<{
      tool: string;
      purpose: string;
      governance_level?: 'L0' | 'L1' | 'L2' | 'L3';
    }>;
    suggested_plugins: Array<{
      slug: string;
      name: string;
      reason: string;
      required_capability?: string;
    }>;
  }> {
    const res = await this.http.get(`/site/wizards/${wizardId}`);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Translation Coverage Analysis
  // ------------------------------------------------------------------ //

  async getTranslationCoverage(): Promise<TranslationCoverageAnalysis> {
    const res = await this.http.get('/translation/coverage');
    return res.data;
  }

  async getUntranslatedStrings(targetLanguage: string): Promise<UntranslatedStringsResponse> {
    const res = await this.http.get('/translation/strings/untranslated', {
      params: { target_language: targetLanguage },
    });
    return res.data;
  }

  async translateStrings(
    targetLanguage: string,
    strings: StringTranslationRequest[],
    preview = true,
  ): Promise<TranslateStringsResponse> {
    const res = await this.http.post('/translation/strings/translate', {
      target_language: targetLanguage,
      strings,
      preview,
    });
    return res.data;
  }

  async getUntranslatedMedia(targetLanguage: string): Promise<UntranslatedMediaResponse> {
    const res = await this.http.get('/translation/media/untranslated', {
      params: { target_language: targetLanguage },
    });
    return res.data;
  }

  async translateMediaMetadata(
    targetLanguage: string,
    items: MediaTranslationRequest[],
    preview = true,
  ): Promise<TranslateMediaResponse> {
    const res = await this.http.post('/translation/media/translate', {
      target_language: targetLanguage,
      items,
      preview,
    });
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Ally Integration
  // ------------------------------------------------------------------ //

  async getAllyStatus(): Promise<AllyStatus> {
    const res = await this.http.get('/ally/status');
    return res.data;
  }

  async getAllyScanResults(): Promise<AllyScanResults> {
    const res = await this.http.get('/ally/scan/results');
    return res.data;
  }

  async triggerAllyScan(): Promise<AllyTriggerScanResponse> {
    const res = await this.http.post('/ally/scan/trigger');
    return res.data;
  }

  async applyAllyFix(params: { scan_id: string; issue_id: string; fix_type?: 'basic' | 'ai' }): Promise<AllyApplyFixResponse> {
    const res = await this.http.post('/ally/fix/apply', params);
    return res.data;
  }

  async scanAccessibility(params: { page_id?: number; scan_type?: 'quick' | 'full' }): Promise<AccessibilityScanResult> {
    const res = await this.http.get('/ally/scan/accessibility', { params });
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // LMS Integration
  // ------------------------------------------------------------------ //

  async getLmsStatus(): Promise<LmsStatus> {
    const res = await this.http.get('/lms/status');
    return res.data;
  }

  async listLmsCourses(params: { page?: number; per_page?: number } = {}): Promise<LmsCourseList> {
    const res = await this.http.get('/lms/courses', { params });
    return res.data;
  }

  async getLmsCourseStructure(courseId: number): Promise<LmsCourseStructure> {
    const res = await this.http.get(`/lms/courses/${courseId}/structure`);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Charity Integration
  // ------------------------------------------------------------------ //

  async getCharityStatus(): Promise<CharityStatus> {
    const res = await this.http.get('/charity/status');
    return res.data;
  }

  async listCharityForms(params: { page?: number; per_page?: number } = {}): Promise<CharityFormList> {
    const res = await this.http.get('/charity/forms', { params });
    return res.data;
  }

  async getCharityStats(): Promise<CharityDonationStats> {
    const res = await this.http.get('/charity/stats');
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Booking & Events Integration
  // ------------------------------------------------------------------ //

  async getBookingStatus(): Promise<any> {
    const res = await this.http.get('/booking/status');
    return res.data;
  }

  async listBookings(params: { page?: number; per_page?: number } = {}): Promise<any> {
    const res = await this.http.get('/booking/list', { params });
    return res.data;
  }

  async getBookingStats(): Promise<any> {
    const res = await this.http.get('/booking/stats');
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Voxel Integration
  // ------------------------------------------------------------------ //

  async getVoxelStatus(): Promise<VoxelStatus> {
    const res = await this.http.get('/voxel/status');
    return res.data;
  }

  async listVoxelPostTypes(): Promise<VoxelPostTypeList> {
    const res = await this.http.get('/voxel/post-types');
    return res.data;
  }

  async getVoxelPostType(postType: string): Promise<VoxelPostTypeDetail> {
    const res = await this.http.get(`/voxel/post-types/${encodeURIComponent(postType)}`);
    return res.data;
  }

  async listVoxelTaxonomies(): Promise<VoxelTaxonomyList> {
    const res = await this.http.get('/voxel/taxonomies');
    return res.data;
  }

  async listVoxelProductTypes(): Promise<VoxelProductTypeList> {
    const res = await this.http.get('/voxel/product-types');
    return res.data;
  }

  async getVoxelSettings(): Promise<VoxelSettings> {
    const res = await this.http.get('/voxel/settings');
    return res.data;
  }

  async getVoxelHealth(): Promise<VoxelHealth> {
    const res = await this.http.get('/voxel/health');
    return res.data;
  }

  async runVoxelMarketplaceWizard(): Promise<{
    wizard: string;
    version: string;
    voxel_active: boolean;
    steps: Array<Record<string, unknown>>;
    status: string;
    blocked_at?: string;
  }> {
    const res = await this.http.get('/voxel/wizard/marketplace');
    return res.data;
  }

  async listAmeliaServices(params: { page?: number; per_page?: number } = {}): Promise<any> {
    const res = await this.http.get('/booking/amelia/services', { params });
    return res.data;
  }

  async getAmeliaService(serviceId: number): Promise<any> {
    const res = await this.http.get(`/booking/amelia/services/${serviceId}`);
    return res.data;
  }

  async createAmeliaService(data: any): Promise<any> {
    const res = await this.http.post('/booking/amelia/services', data);
    return res.data;
  }

  async updateAmeliaService(serviceId: number, data: any): Promise<any> {
    const res = await this.http.patch(`/booking/amelia/services/${serviceId}`, data);
    return res.data;
  }

  async deleteAmeliaService(serviceId: number): Promise<any> {
    const res = await this.http.delete(`/booking/amelia/services/${serviceId}`);
    return res.data;
  }

  async listAmeliaAppointments(params: { page?: number; per_page?: number; status?: string } = {}): Promise<any> {
    const res = await this.http.get('/booking/amelia/appointments', { params });
    return res.data;
  }

  async getAmeliaAppointment(appointmentId: number): Promise<any> {
    const res = await this.http.get(`/booking/amelia/appointments/${appointmentId}`);
    return res.data;
  }

  async createAmeliaAppointment(data: any): Promise<any> {
    const res = await this.http.post('/booking/amelia/appointments', data);
    return res.data;
  }

  async updateAmeliaAppointment(appointmentId: number, data: any): Promise<any> {
    const res = await this.http.patch(`/booking/amelia/appointments/${appointmentId}`, data);
    return res.data;
  }

  async deleteAmeliaAppointment(appointmentId: number): Promise<any> {
    const res = await this.http.delete(`/booking/amelia/appointments/${appointmentId}`);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // WooCommerce Integration
  // ------------------------------------------------------------------ //

  async listWooCommerceProducts(params: { page?: number; per_page?: number; status?: string; category?: string; stock_status?: string; search?: string } = {}): Promise<any> {
    const res = await this.http.get('/woocommerce/products', { params });
    return res.data;
  }

  async getWooCommerceProduct(productId: number): Promise<any> {
    const res = await this.http.get(`/woocommerce/products/${productId}`);
    return res.data;
  }

  async createWooCommerceProduct(data: any): Promise<any> {
    const res = await this.http.post('/woocommerce/products', data);
    return res.data;
  }

  async updateWooCommerceProduct(productId: number, data: any): Promise<any> {
    const res = await this.http.put(`/woocommerce/products/${productId}`, data);
    return res.data;
  }

  async deleteWooCommerceProduct(productId: number, force?: boolean): Promise<any> {
    const res = await this.http.delete(`/woocommerce/products/${productId}`, force ? { params: { force } } : {});
    return res.data;
  }

  async listWooCommerceOrders(params: { page?: number; per_page?: number; status?: string; customer?: number; product?: number; date_after?: string; date_before?: string } = {}): Promise<any> {
    const res = await this.http.get('/woocommerce/orders', { params });
    return res.data;
  }

  async getWooCommerceOrder(orderId: number): Promise<any> {
    const res = await this.http.get(`/woocommerce/orders/${orderId}`);
    return res.data;
  }

  async updateWooCommerceOrderStatus(orderId: number, status: string, note?: string): Promise<any> {
    const res = await this.http.put(`/woocommerce/orders/${orderId}/status`, { status, note });
    return res.data;
  }

  async listWooCommerceProductCategories(params: { page?: number; per_page?: number; parent?: number } = {}): Promise<any> {
    const res = await this.http.get('/woocommerce/product-categories', { params });
    return res.data;
  }

  async manageWooCommerceProductCategory(data: { action: 'create' | 'update' | 'delete'; id?: number; name?: string; slug?: string; parent?: number; description?: string }): Promise<any> {
    const res = await this.http.post('/woocommerce/product-categories/manage', data);
    return res.data;
  }

  async getWooCommerceStoreSettings(): Promise<any> {
    const res = await this.http.get('/woocommerce/store-settings');
    return res.data;
  }

  async updateWooCommerceStoreSettings(data: any): Promise<any> {
    const res = await this.http.put('/woocommerce/store-settings', data);
    return res.data;
  }

  async setupWooCommercePages(params: { create_missing?: boolean; assign_template?: boolean } = {}): Promise<any> {
    const res = await this.http.post('/woocommerce/pages/setup', params);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Form Plugin Integration
  // ------------------------------------------------------------------ //

  async listForms(params: { plugin?: string; page?: number; per_page?: number } = {}): Promise<any> {
    return { code: 'not_implemented', message: 'Forms management coming soon', data: { status: 501 } };
  }

  async getForm(formId: number, plugin?: string): Promise<any> {
    return { code: 'not_implemented', message: 'Forms management coming soon', data: { status: 501 } };
  }

  async createForm(data: any): Promise<any> {
    return { code: 'not_implemented', message: 'Forms management coming soon', data: { status: 501 } };
  }

  async updateForm(formId: number, data: any): Promise<any> {
    return { code: 'not_implemented', message: 'Forms management coming soon', data: { status: 501 } };
  }

  async deleteForm(formId: number, plugin?: string): Promise<any> {
    return { code: 'not_implemented', message: 'Forms management coming soon', data: { status: 501 } };
  }

  async listFormEntries(formId: number, params: { page?: number; per_page?: number; plugin?: string } = {}): Promise<any> {
    return { code: 'not_implemented', message: 'Forms management coming soon', data: { status: 501 } };
  }

  async getFormEntry(entryId: number, plugin?: string): Promise<any> {
    return { code: 'not_implemented', message: 'Forms management coming soon', data: { status: 501 } };
  }

  async exportFormEntries(formId: number, format: string = 'csv', plugin?: string): Promise<any> {
    return { code: 'not_implemented', message: 'Forms management coming soon', data: { status: 501 } };
  }

  // ------------------------------------------------------------------ //
  // Performance Deep-Dive Integration
  // ------------------------------------------------------------------ //

  async generateCriticalCss(pageId?: number): Promise<any> {
    return { code: 'not_implemented', message: 'Critical CSS generation coming soon', data: { status: 501 } };
  }

  async auditAssetLoading(pageId?: number): Promise<any> {
    return { code: 'not_implemented', message: 'Asset loading audit coming soon', data: { status: 501 } };
  }

  async enableRedisCache(): Promise<any> {
    return { code: 'not_implemented', message: 'Redis cache management coming soon', data: { status: 501 } };
  }

  async purgeCdnCache(): Promise<any> {
    return { code: 'not_implemented', message: 'CDN cache purge coming soon', data: { status: 501 } };
  }

  async optimizeHtaccess(): Promise<any> {
    return { code: 'not_implemented', message: '.htaccess optimization coming soon', data: { status: 501 } };
  }

  // ------------------------------------------------------------------ //
  // Pages
  // ------------------------------------------------------------------ //

  async listElementorPages(params: { post_type?: string; per_page?: number; page?: number }) {
    const res = await this.http.get('/pages', { params });
    return res.data as {
      posts: Array<{
        id: number;
        title: string;
        slug: string;
        post_type: string;
        status: string;
        url: string;
        modified: string;
      }>;
      total: number;
      total_pages: number;
    };
  }

  async getPageData(params: { id: number; extract?: string; index?: number }) {
    const { id, ...query } = params;
    const res = await this.http.get(`/pages/${id}/data`, { params: query });
    return res.data;
  }

  async updatePageData(
    id: number,
    elementorData: unknown[],
  ): Promise<{ id: number; updated: true }> {
    const res = await this.http.put<{ id: number; updated: true }>(`/pages/${id}/data`, {
      elementor_data: elementorData,
    });
    return res.data;
  }

  async sideloadImage(params: {
    url: string;
    title?: string;
    alt_text?: string;
    caption?: string;
  }): Promise<{ id: number; url: string | null; mime_type: string | null; title: string }> {
    const res = await this.http.post('/media/sideload', params);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Change Review Queue
  // ------------------------------------------------------------------ //

  async listChanges(
    status?: string,
  ): Promise<{ changes: QueuedChange[]; total: number }> {
    const res = await this.http.get<{ changes: QueuedChange[]; total: number }>(
      '/changes/queue',
      status && status !== 'all' ? { params: { status } } : {},
    );
    return res.data;
  }

  async createChange(input: {
    operation: string;
    params: Record<string, unknown>;
    note?: string;
    before_state?: Record<string, unknown>;
  }): Promise<QueuedChange> {
    const res = await this.http.post<QueuedChange>('/changes/queue', input);
    return res.data;
  }

  async getChange(id: string): Promise<QueuedChange> {
    const res = await this.http.get<QueuedChange>(`/changes/${id}`);
    return res.data;
  }

  async updateChangeStatus(
    id: string,
    status: 'approved' | 'rejected' | 'applied',
    note?: string,
  ): Promise<QueuedChange> {
    const res = await this.http.put<QueuedChange>(`/changes/${id}/status`, { status, note });
    return res.data;
  }

  async deleteChange(id: string): Promise<{ deleted: true; id: string }> {
    const res = await this.http.delete<{ deleted: true; id: string }>(`/changes/${id}`);
    return res.data;
  }

  async createThemeBuilderTemplate(params: {
    title: string;
    type: string;
    elementor_data?: unknown[];
    conditions?: string;
    status?: string;
  }): Promise<{ id: number; title: string; type: string; status: string; conditions: string[] }> {
    const res = await this.http.post('/theme-builder/templates', params);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Menus
  // ------------------------------------------------------------------ //

  async listMenus(): Promise<{
    menus: Array<{
      id: number;
      name: string;
      slug: string;
      count: number;
      description: string;
    }>;
    total: number;
  }> {
    const res = await this.http.get('/menus');
    return res.data;
  }

  async createMenu(params: { name: string }): Promise<{
    menu: {
      id: number;
      name: string;
      slug: string;
      count: number;
      description: string;
    };
    message: string;
  }> {
    const res = await this.http.post('/menus', params);
    return res.data;
  }

  async deleteMenu(id: number): Promise<{ message: string }> {
    const res = await this.http.delete(`/menus/${id}`);
    return res.data;
  }

  async listMenuItems(params: { menu_id: number }): Promise<{
    items: Array<{
      id: number;
      label: string;
      url: string;
      parent: number;
      position: number;
      type: string;
      target: string;
      classes: string[];
      xfn: string;
    }>;
    total: number;
  }> {
    const res = await this.http.get(`/menus/${params.menu_id}/items`);
    return res.data;
  }

  async createMenuItem(params: {
    menu_id: number;
    label: string;
    url: string;
    parent?: number;
    position?: number;
  }): Promise<{
    item: {
      id: number;
      label: string;
      url: string;
      parent: number;
      position: number;
      type: string;
      target: string;
      classes: string[];
      xfn: string;
    };
    message: string;
  }> {
    const res = await this.http.post(`/menus/${params.menu_id}/items`, params);
    return res.data;
  }

  async updateMenuItem(params: {
    id: number;
    menu_id: number;
    label?: string;
    url?: string;
    parent?: number;
    position?: number;
  }): Promise<{
    item: {
      id: number;
      label: string;
      url: string;
      parent: number;
      position: number;
      type: string;
      target: string;
      classes: string[];
      xfn: string;
    };
    message: string;
  }> {
    const res = await this.http.put(`/menu-items/${params.id}`, params);
    return res.data;
  }

  async deleteMenuItem(id: number): Promise<{ message: string }> {
    const res = await this.http.delete(`/menu-items/${id}`);
    return res.data;
  }

  async listMenuLocations(): Promise<{
    locations: Array<{
      location: string;
      description: string;
      menu_id: number | null;
    }>;
    total: number;
  }> {
    const res = await this.http.get('/menu-locations');
    return res.data;
  }

  async assignMenuLocation(params: { menu_id: number; location: string }): Promise<{
    message: string;
    location: string;
    menu_id: number;
  }> {
    const res = await this.http.post('/menu-locations', params);
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Content Management
  // ------------------------------------------------------------------ //

  async createPage(params: {
    title: string;
    content?: string;
    status?: string;
    parent?: number;
    elementor_ready?: boolean;
  }): Promise<{
    page: {
      id: number;
      title: string;
      slug: string;
      content: string;
      excerpt: string;
      status: string;
      type: string;
      author: number;
      parent: number;
      date: string;
      modified: string;
      featured_image_id: number;
      permalink: string;
      elementor_edit_mode: boolean;
    };
    message: string;
  }> {
    const res = await this.http.post('/pages', params);
    return res.data;
  }

  async createPost(params: {
    title: string;
    content?: string;
    status?: string;
    categories?: number[];
    tags?: string[];
  }): Promise<{
    post: {
      id: number;
      title: string;
      slug: string;
      content: string;
      excerpt: string;
      status: string;
      type: string;
      author: number;
      parent: number;
      date: string;
      modified: string;
      featured_image_id: number;
      permalink: string;
      elementor_edit_mode: boolean;
    };
    message: string;
  }> {
    const res = await this.http.post('/posts', params);
    return res.data;
  }

  async updatePostMeta(params: {
    id: number;
    slug?: string;
    excerpt?: string;
    featured_image_id?: number;
  }): Promise<{
    post_id: number;
    updated: Record<string, unknown>;
    message: string;
  }> {
    const res = await this.http.put(`/posts/${params.id}/meta`, params);
    return res.data;
  }

  async deletePost(params: {
    id: number;
    force?: boolean;
  }): Promise<{
    post_id: number;
    deleted: boolean;
    message: string;
  }> {
    const res = await this.http.delete(`/posts/${params.id}`, { params: { force: params.force } });
    return res.data;
  }

  async listTaxonomies(): Promise<{
    taxonomies: Array<{
      name: string;
      label: string;
      labels: Record<string, string>;
      hierarchical: boolean;
      public: boolean;
      object_type: string[];
    }>;
    total: number;
  }> {
    const res = await this.http.get('/taxonomies');
    return res.data;
  }

  async createTerm(params: {
    taxonomy: string;
    name: string;
    slug?: string;
    parent?: number;
    description?: string;
  }): Promise<{
    term: {
      id: number;
      name: string;
      slug: string;
      description: string;
      parent: number;
      count: number;
      taxonomy: string;
    };
    message: string;
  }> {
    const res = await this.http.post(`/terms/${params.taxonomy}`, params);
    return res.data;
  }

  async updateTerm(params: {
    taxonomy: string;
    id: number;
    name?: string;
    slug?: string;
    parent?: number;
    description?: string;
  }): Promise<{
    term: {
      id: number;
      name: string;
      slug: string;
      description: string;
      parent: number;
      count: number;
      taxonomy: string;
    };
    message: string;
  }> {
    const res = await this.http.put(`/terms/${params.taxonomy}`, params);
    return res.data;
  }

  async deleteTerm(params: {
    taxonomy: string;
    id: number;
    force?: boolean;
  }): Promise<{
    term_id: number;
    deleted: boolean;
    message: string;
  }> {
    const res = await this.http.delete(`/terms/${params.taxonomy}`, { params });
    return res.data;
  }

  async listPostTypes(): Promise<{
    post_types: Array<{
      name: string;
      label: string;
      labels: Record<string, string>;
      public: boolean;
      hierarchical: boolean;
      has_archive: boolean;
      supports: Record<string, boolean>;
    }>;
    total: number;
  }> {
    const res = await this.http.get('/post-types');
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Media Library
  // ------------------------------------------------------------------ //

  async listMedia(params: {
    page?: number;
    per_page?: number;
    search?: string;
    mime_type?: string;
  }): Promise<{
    media: Array<{
      id: number;
      title: string;
      caption: string;
      description: string;
      alt_text: string;
      mime_type: string;
      date: string;
      modified: string;
      author: number;
      url: string;
      sizes: Record<string, { url: string; width: number; height: number }>;
      metadata: Record<string, unknown>;
    }>;
    total: number;
    total_pages: number;
    page: number;
    per_page: number;
  }> {
    const res = await this.http.get('/media', { params });
    return res.data;
  }

  async getMedia(id: number): Promise<{
    media: {
      id: number;
      title: string;
      caption: string;
      description: string;
      alt_text: string;
      mime_type: string;
      date: string;
      modified: string;
      author: number;
      url: string;
      sizes: Record<string, { url: string; width: number; height: number }>;
      metadata: Record<string, unknown>;
    };
  }> {
    const res = await this.http.get(`/media/${id}`);
    return res.data;
  }

  async updateMedia(
    id: number,
    updates: {
      alt_text?: string;
      title?: string;
      caption?: string;
      description?: string;
    },
  ): Promise<{
    media_id: number;
    updated: Record<string, string>;
    media: {
      id: number;
      title: string;
      caption: string;
      description: string;
      alt_text: string;
      mime_type: string;
      date: string;
      modified: string;
      author: number;
      url: string;
      sizes: Record<string, { url: string; width: number; height: number }>;
      metadata: Record<string, unknown>;
    };
    message: string;
  }> {
    const res = await this.http.put(`/media/${id}`, updates);
    return res.data;
  }

  async deleteMedia(id: number, force = false): Promise<{
    media_id: number;
    deleted: boolean;
    message: string;
  }> {
    const res = await this.http.delete(`/media/${id}`, { params: { force } });
    return res.data;
  }
  async importExternalData(params: any): Promise<any> {
    const res = await this.http.post<any>('/import/external', params);
    return res.data;
  }

  async massExport(params: {
    post_type: string;
    format: string;
    filters: Record<string, unknown>;
    limit: number;
    offset: number;
  }): Promise<any> {
    const res = await this.http.post<any>('/export/data', { post_type, format, limit, offset });
    return res.data;
  }

  // ------------------------------------------------------------------ //
  // Widget Structure Operations (DELTA-003)
  // ------------------------------------------------------------------ //

  async insertWidget(
    pageId: number,
    params: {
      widget: Record<string, unknown>;
      container_path?: string;
      position?: number;
      content_hash: string;
      dry_run?: boolean;
    },
  ): Promise<{
    post_id: number;
    position: number;
    container_path: string;
    new_hash: string;
  }> {
    const res = await this.http.post(`/pages/${pageId}/widgets`, params);
    return res.data;
  }

  async removeWidget(
    pageId: number,
    widgetId: string,
    params: {
      content_hash: string;
      dry_run?: boolean;
    },
  ): Promise<{
    post_id: number;
    widget_id: string;
    path: string;
    removed: boolean;
    new_hash: string;
  }> {
    const res = await this.http.delete(`/pages/${pageId}/widgets/${widgetId}`, { data: params });
    return res.data;
  }

  async moveWidget(
    pageId: number,
    widgetId: string,
    params: {
      target_container_path?: string;
      position?: number;
      content_hash: string;
      dry_run?: boolean;
    },
  ): Promise<{
    post_id: number;
    widget_id: string;
    source_path: string;
    new_path: string;
    new_hash: string;
  }> {
    const res = await this.http.put(`/pages/${pageId}/widgets/${widgetId}/move`, params);
    return res.data;
  }

  async cloneWidget(
    pageId: number,
    params: {
      source_page_id: number;
      widget_id: string;
      container_path?: string;
      position?: number;
      content_hash: string;
      dry_run?: boolean;
    },
  ): Promise<{
    post_id: number;
    source_page_id: number;
    source_widget_id: string;
    new_widget_id: string;
    position: number;
    container_path: string;
    global_references: string[];
    new_hash: string;
  }> {
    const res = await this.http.post(`/pages/${pageId}/widgets/clone`, params);
    return res.data;
  }
}
