import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type {
  ElementifyClient,
  SiteAssessment,
  SiteContext,
  SiteContextRole,
  SiteContextPurpose,
} from '../client.js';

// ------------------------------------------------------------------ //
// Types
// ------------------------------------------------------------------ //

export type RecommendationCategory =
  | 'brand'
  | 'structure'
  | 'library'
  | 'performance'
  | 'content'
  | 'seo'
  | 'woocommerce';

export interface Recommendation {
  id: string;
  priority: 1 | 2 | 3 | 4 | 5;           // 1 = highest
  category: RecommendationCategory;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  automated: boolean;                      // can AI do this without human input?
  tools: string[];                         // MCP tools to invoke
  blocked_by: string[];                    // recommendation IDs that must run first
}

// ------------------------------------------------------------------ //
// Rule engine
// ------------------------------------------------------------------ //

export function buildRecommendations(
  assessment: SiteAssessment,
  context: SiteContext,
): Recommendation[] {
  const recs: Recommendation[] = [];
  const purpose = context.site_purpose;
  const role    = context.user_role;

  // Helper — only include if condition is true
  const add = (rec: Recommendation, condition: boolean) => {
    if (condition) recs.push(rec);
  };

  const hasThemeBuilder = (type: string) =>
    (assessment.theme_builder[type] ?? []).some((t) => t.status === 'publish');

  const hasAnyPosts = (assessment.pages.by_post_type['post'] ?? 0) > 0;

  // ---------------------------------------------------------------- //
  // BRAND
  // ---------------------------------------------------------------- //

  add(
    {
      id: 'set_logo',
      priority: 1,
      category: 'brand',
      title: 'Set site logo',
      description: 'No logo is set. Upload or assign a logo via WordPress customizer or Elementor Site Settings → Site Identity. This affects the header template and all pages.',
      impact: 'high',
      effort: 'low',
      automated: false,
      tools: [],
      blocked_by: [],
    },
    !assessment.brand.logo_set,
  );

  add(
    {
      id: 'define_global_colors',
      priority: 1,
      category: 'brand',
      title: 'Define global color palette',
      description: 'No global colors are defined in the Elementor Kit. A palette ensures design consistency across all pages and templates. If you have brand guidelines, provide them so the AI can suggest a palette.',
      impact: 'high',
      effort: 'medium',
      automated: false,
      tools: [],
      blocked_by: [],
    },
    assessment.brand.global_colors_count === 0,
  );

  add(
    {
      id: 'define_global_typography',
      priority: 2,
      category: 'brand',
      title: 'Define global typography',
      description: 'No global typography is set in the Elementor Kit. Define heading and body fonts to ensure visual consistency without per-element font overrides.',
      impact: 'high',
      effort: 'medium',
      automated: false,
      tools: [],
      blocked_by: ['define_global_colors'],
    },
    assessment.brand.global_typography_count === 0,
  );

  // ---------------------------------------------------------------- //
  // STRUCTURE — Theme Builder
  // ---------------------------------------------------------------- //

  add(
    {
      id: 'create_header_template',
      priority: 1,
      category: 'structure',
      title: 'Create a Theme Builder header',
      description: 'No published header template exists. Without it, the site falls back to the active theme\'s default header. Create a header template in Elementor → Theme Builder → Header.',
      impact: 'high',
      effort: 'medium',
      automated: false,
      tools: [],
      blocked_by: ['set_logo', 'define_global_colors'],
    },
    !hasThemeBuilder('header'),
  );

  add(
    {
      id: 'create_footer_template',
      priority: 1,
      category: 'structure',
      title: 'Create a Theme Builder footer',
      description: 'No published footer template exists. Create a footer template in Elementor → Theme Builder → Footer.',
      impact: 'high',
      effort: 'medium',
      automated: false,
      tools: [],
      blocked_by: ['set_logo', 'define_global_colors'],
    },
    !hasThemeBuilder('footer'),
  );

  add(
    {
      id: 'create_single_post_template',
      priority: 3,
      category: 'structure',
      title: 'Create a single post template',
      description: `The site has ${assessment.pages.by_post_type['post']} post(s) but no single post Theme Builder template. Blog content is being rendered by the default theme layout.`,
      impact: 'medium',
      effort: 'medium',
      automated: false,
      tools: [],
      blocked_by: ['create_header_template', 'create_footer_template'],
    },
    hasAnyPosts && !hasThemeBuilder('single') && !hasThemeBuilder('single-post'),
  );

  add(
    {
      id: 'create_archive_template',
      priority: 4,
      category: 'structure',
      title: 'Create an archive template',
      description: 'No archive template is defined. Category, tag, and date archive pages fall back to the theme default.',
      impact: 'medium',
      effort: 'medium',
      automated: false,
      tools: [],
      blocked_by: ['create_header_template', 'create_footer_template'],
    },
    hasAnyPosts && !hasThemeBuilder('archive'),
  );

  add(
    {
      id: 'create_404_template',
      priority: 4,
      category: 'structure',
      title: 'Create a 404 template',
      description: 'No 404 error page template is set. A branded 404 page improves user experience and keeps visitors on the site.',
      impact: 'low',
      effort: 'low',
      automated: false,
      tools: [],
      blocked_by: ['create_header_template', 'create_footer_template'],
    },
    !hasThemeBuilder('error-404'),
  );

  // ---------------------------------------------------------------- //
  // LIBRARY — Template organization
  // ---------------------------------------------------------------- //

  const uncategorized = assessment.template_library.uncategorized;
  add(
    {
      id: 'categorize_templates',
      priority: 2,
      category: 'library',
      title: `Categorize ${uncategorized} uncategorized templates`,
      description: `${uncategorized} templates have no category. Run audit_library to get a proposed categorization, then apply it with set_category or bulk_rename. Well-organized libraries enable reliable composition workflows.`,
      impact: 'medium',
      effort: 'low',
      automated: true,
      tools: ['audit_library', 'set_category', 'set_tags'],
      blocked_by: [],
    },
    uncategorized > 5,
  );

  add(
    {
      id: 'tag_templates_by_type',
      priority: 3,
      category: 'library',
      title: 'Tag templates by purpose (SECTION_, COMP_, PAGE_)',
      description: 'Templates without naming conventions are hard for AI agents to reason about. Use bulk_rename to apply SECTION_, COMP_, or PAGE_ prefixes. This makes compose_page_from_templates much more reliable.',
      impact: 'medium',
      effort: 'medium',
      automated: true,
      tools: ['list_templates', 'audit_library', 'bulk_rename', 'set_tags'],
      blocked_by: ['categorize_templates'],
    },
    assessment.template_library.total > 10,
  );

  // ---------------------------------------------------------------- //
  // PERFORMANCE
  // ---------------------------------------------------------------- //

  add(
    {
      id: 'switch_css_to_external',
      priority: 3,
      category: 'performance',
      title: 'Switch CSS to external files',
      description: 'Elementor CSS is currently embedded inline ("internal"). External CSS files are cached by browsers and CDNs, improving load time on repeat visits. Change in Elementor → Settings → Advanced → CSS Print Method.',
      impact: 'medium',
      effort: 'low',
      automated: false,
      tools: [],
      blocked_by: [],
    },
    assessment.performance.css_print_method === 'internal',
  );

  add(
    {
      id: 'disable_fa4_shim',
      priority: 5,
      category: 'performance',
      title: 'Disable Font Awesome 4 compatibility shim',
      description: 'The FA4 shim loads an extra compatibility layer. If no widgets rely on FA4 icon names (fa-*), disable it in Elementor → Settings → Advanced.',
      impact: 'low',
      effort: 'low',
      automated: false,
      tools: [],
      blocked_by: [],
    },
    assessment.performance.load_fa4_shim,
  );

  // ---------------------------------------------------------------- //
  // CONTENT — Page coverage
  // ---------------------------------------------------------------- //

  add(
    {
      id: 'build_first_elementor_page',
      priority: 1,
      category: 'content',
      title: 'No Elementor pages found — build the first page',
      description: 'No pages are built with Elementor yet. Start by selecting a target page and using compose_page_from_templates or save_full_page_as_template to create the initial layout.',
      impact: 'high',
      effort: 'medium',
      automated: true,
      tools: ['list_elementor_pages', 'compose_page_from_templates', 'update_page_data'],
      blocked_by: ['define_global_colors', 'define_global_typography'],
    },
    assessment.pages.elementor_total === 0,
  );

  // ---------------------------------------------------------------- //
  // SEO
  // ---------------------------------------------------------------- //

  add(
    {
      id: 'install_seo_plugin',
      priority: 2,
      category: 'seo',
      title: 'No SEO plugin detected',
      description: 'No recognized SEO plugin (Rank Math, Yoast, AIOSEO) is active. An SEO plugin is essential for meta titles, descriptions, sitemaps, and structured data.',
      impact: 'high',
      effort: 'low',
      automated: false,
      tools: [],
      blocked_by: [],
    },
    !assessment.plugins.classified['seo'],
  );

  // ---------------------------------------------------------------- //
  // WOOCOMMERCE — only if active
  // ---------------------------------------------------------------- //

  const hasShopTemplate = (assessment.theme_builder['product'] ?? []).some((t) => t.status === 'publish')
    || (assessment.theme_builder['archive'] ?? []).some((t) => t.status === 'publish');

  add(
    {
      id: 'create_woocommerce_templates',
      priority: 2,
      category: 'woocommerce',
      title: 'Create WooCommerce Theme Builder templates',
      description: 'WooCommerce is active but no product or shop archive template is set in Theme Builder. Product pages will render with the default WooCommerce layout.',
      impact: 'high',
      effort: 'high',
      automated: false,
      tools: [],
      blocked_by: ['create_header_template', 'create_footer_template'],
    },
    assessment.plugins.woocommerce && !hasShopTemplate,
  );

  // ---------------------------------------------------------------- //
  // Context-specific filtering
  // ---------------------------------------------------------------- //

  // AI-agent mode: surface only automatable recommendations
  if (role === 'ai-agent') {
    return recs
      .filter((r) => r.automated)
      .sort((a, b) => a.priority - b.priority);
  }

  // Site-owner: hide deeply technical items
  if (role === 'site-owner') {
    return recs
      .filter((r) => r.category !== 'library' || r.priority <= 2)
      .sort((a, b) => a.priority - b.priority);
  }

  return recs.sort((a, b) => a.priority - b.priority);
}

// ------------------------------------------------------------------ //
// Tool registration
// ------------------------------------------------------------------ //

export function registerRecommendationTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementifyClient,
): void {

  // ---------------------------------------------------------------- //
  // set_site_context
  // ---------------------------------------------------------------- //
  server.tool(
    'set_site_context',
    'Store context about who is using the site and what it is for. This context is used by get_recommendations to tailor its output. Call this once during onboarding or whenever the context changes.',
    {
      site_id:          z.string().optional(),
      user_role:        z.enum(['freelancer', 'agency', 'site-owner', 'ai-agent']).optional()
                         .describe('Who is operating this site'),
      site_purpose:     z.enum(['ecommerce', 'corporate', 'portfolio', 'blog', 'community', 'other']).optional()
                         .describe('Primary purpose of the site'),
      brand_notes:      z.string().optional()
                         .describe('Brand guidelines, color descriptions, tone of voice, etc.'),
      target_audience:  z.string().optional()
                         .describe('Who the site is for (e.g. "B2B enterprise", "creative professionals")'),
      primary_language: z.string().optional()
                         .describe('Primary content language, e.g. "en", "de"'),
    },
    async ({ site_id, ...ctx }) => {
      const client = getClient(site_id);
      const saved = await client.setSiteContext(ctx);
      const lines = [
        '✅ Site context saved.',
        '',
        `  User role:       ${saved.user_role ?? '—'}`,
        `  Site purpose:    ${saved.site_purpose ?? '—'}`,
        `  Target audience: ${saved.target_audience ?? '—'}`,
        `  Language:        ${saved.primary_language ?? '—'}`,
        `  Brand notes:     ${saved.brand_notes ? saved.brand_notes.slice(0, 80) + (saved.brand_notes.length > 80 ? '…' : '') : '—'}`,
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ---------------------------------------------------------------- //
  // get_site_context
  // ---------------------------------------------------------------- //
  server.tool(
    'get_site_context',
    'Retrieve the stored site context (user role, site purpose, brand notes). Returns null fields if context has not been set yet.',
    { site_id: z.string().optional() },
    async ({ site_id }) => {
      const client = getClient(site_id);
      const ctx = await client.getSiteContext();
      if (!ctx.set_at) {
        return {
          content: [{ type: 'text', text: 'No site context set yet. Use set_site_context to configure.' }],
        };
      }
      const lines = [
        `Site context (set ${ctx.set_at}):`,
        `  User role:       ${ctx.user_role ?? '—'}`,
        `  Site purpose:    ${ctx.site_purpose ?? '—'}`,
        `  Target audience: ${ctx.target_audience ?? '—'}`,
        `  Language:        ${ctx.primary_language ?? '—'}`,
        `  Brand notes:     ${ctx.brand_notes ?? '—'}`,
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );

  // ---------------------------------------------------------------- //
  // get_recommendations
  // ---------------------------------------------------------------- //
  server.tool(
    'get_recommendations',
    'Run the assessment and recommendation engine. Returns a prioritized, context-aware list of next steps for the site — filtered by user role, site purpose, and current state. Each recommendation includes the MCP tools needed to execute it and any dependencies. Use this as the entry point for any wizard workflow.',
    {
      site_id:     z.string().optional(),
      category:    z.enum(['brand', 'structure', 'library', 'performance', 'content', 'seo', 'woocommerce']).optional()
                    .describe('Filter to a single category (omit for all)'),
      max_results: z.number().int().min(1).max(20).optional().default(10)
                    .describe('Maximum number of recommendations to return'),
      automated_only: z.boolean().optional().default(false)
                       .describe('Return only recommendations the AI can execute without human input'),
    },
    async ({ site_id, category, max_results, automated_only }) => {
      const client = getClient(site_id);

      const [assessment, context] = await Promise.all([
        client.assessSite(),
        client.getSiteContext(),
      ]);

      let recs = buildRecommendations(assessment, context);

      if (category) {
        recs = recs.filter((r) => r.category === category);
      }
      if (automated_only) {
        recs = recs.filter((r) => r.automated);
      }
      recs = recs.slice(0, max_results ?? 10);

      if (recs.length === 0) {
        return {
          content: [{ type: 'text', text: 'No recommendations match the current filters. The site may already be well-configured in this area.' }],
        };
      }

      const lines: string[] = [
        `Recommendations for ${assessment.wordpress.site_name}`,
        `Context: role=${context.user_role ?? 'unknown'} · purpose=${context.site_purpose ?? 'unknown'}`,
        `${recs.length} recommendation(s):`,
        '',
      ];

      for (const rec of recs) {
        const autoFlag = rec.automated ? ' [auto]' : ' [needs input]';
        lines.push(`## ${rec.priority}. [${rec.id}] ${rec.title}${autoFlag}`);
        lines.push(`   Category: ${rec.category} · Impact: ${rec.impact} · Effort: ${rec.effort}`);
        lines.push(`   ${rec.description}`);
        if (rec.tools.length > 0) {
          lines.push(`   Tools: ${rec.tools.join(', ')}`);
        }
        if (rec.blocked_by.length > 0) {
          lines.push(`   Depends on: ${rec.blocked_by.join(', ')}`);
        }
        lines.push('');
      }

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
