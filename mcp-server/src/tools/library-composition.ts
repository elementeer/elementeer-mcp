import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import {
  computeContentHash,
  EditabilityGateError,
} from '../editability-gate.js';
import {
  applyGranularPatch,
  composeLibraryPage,
  defaultLibraryComponentRegistry,
  LibraryComponentRegistry,
  LibraryComposerError,
  type ComponentBlueprint,
  type CompositionManifest,
  type ElementorElementNode,
} from '../library-composer.js';
import {
  DELIVERY_ENVIRONMENTS,
  DELIVERY_MODES,
  NativeDeliveryError,
  type ResponsiveLayoutControls,
} from '../native-delivery-mode.js';
import {
  elementorSettingsToResponsiveControls,
  ResponsiveControlError,
  responsiveControlsToElementorSettings,
} from '../responsive-controls.js';
import {
  assertWidgetControlsValid,
  WidgetControlValidationError,
  type InstalledPluginsInventory,
} from '../widget-control-validator.js';

const InstalledPluginsSchema = z.object({
  elementor_version: z.string().optional(),
  elementor_pro_version: z.string().optional(),
  the_plus_version: z.string().optional(),
});

const ComponentBlueprintSchema = z.object({
  component_key: z.string().min(1),
  component_version: z.string().min(1),
  template_title: z.string().min(1),
  template_type: z.enum(['container', 'section', 'widget', 'page']).optional().default('container'),
  status: z.enum(['publish', 'draft']).optional().default('publish'),
  slot_key: z.string().optional(),
  elements: z.array(z.record(z.unknown())).min(1),
  structure_hash: z.string().optional(),
  token_dependencies: z
    .object({
      colors: z.array(z.string()).optional(),
      typography: z.array(z.string()).optional(),
    })
    .optional(),
  update_if_content_changed: z.boolean().optional(),
});

export function formatLibraryCompositionError(err: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  if (
    err instanceof LibraryComposerError ||
    err instanceof WidgetControlValidationError ||
    err instanceof ResponsiveControlError ||
    err instanceof EditabilityGateError ||
    err instanceof NativeDeliveryError
  ) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              ok: false,
              code: err.code,
              message: err.message,
              details: err.details,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ ok: false, code: 'INTERNAL_COMPOSER_ERROR', message }, null, 2),
      },
    ],
    isError: true,
  };
}

function toInventory(raw?: z.infer<typeof InstalledPluginsSchema>): InstalledPluginsInventory | undefined {
  if (!raw) return undefined;
  return {
    elementorVersion: raw.elementor_version,
    elementorProVersion: raw.elementor_pro_version,
    thePlusVersion: raw.the_plus_version,
  };
}

export function registerLibraryCompositionTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
  registry: LibraryComponentRegistry = defaultLibraryComponentRegistry,
): void {
  // ------------------------------------------------------------------ //
  // compose_library_page
  // ------------------------------------------------------------------ //
  server.tool(
    'compose_library_page',
    'Library-first idempotent page composer. Upserts Elementor Library templates by stable componentKey + componentVersion + structureHash, prevents duplicate templates and duplicate elementIds, requires componentVersion bump on structural change, validates nav-menu and tp_* controls, and emits elementeer-composition-manifest/v1.',
    {
      site_id: z.string().optional().describe('Site ID from config'),
      page_id: z.union([z.number().int().positive(), z.string().min(1)]).describe('Target page ID'),
      kit_id: z.union([z.number().int().positive(), z.string().min(1)]).optional().default(1),
      dedupe_key: z.string().optional(),
      components: z.array(ComponentBlueprintSchema).min(1),
      write_to_page: z.boolean().optional().default(true),
      mode: z.enum(DELIVERY_MODES).optional().default('native-elementor'),
      environment: z.enum(DELIVERY_ENVIRONMENTS).optional().default('production'),
      installed_plugins: InstalledPluginsSchema.optional(),
      allow_duplicate_template_titles: z.boolean().optional().default(false),
    },
    async ({
      site_id,
      page_id,
      kit_id,
      dedupe_key,
      components,
      write_to_page,
      mode,
      environment,
      installed_plugins,
      allow_duplicate_template_titles,
    }) => {
      try {
        const client = getClient(site_id);
        const mappedComponents: ComponentBlueprint[] = components.map((c) => ({
          componentKey: c.component_key,
          componentVersion: c.component_version,
          templateTitle: c.template_title,
          templateType: c.template_type,
          status: c.status,
          slotKey: c.slot_key,
          elements: c.elements as unknown as ElementorElementNode[],
          structureHash: c.structure_hash,
          tokenDependencies: c.token_dependencies,
          updateIfContentChanged: c.update_if_content_changed,
        }));

        const result = await composeLibraryPage(
          client,
          {
            pageId: page_id,
            kitId: kit_id,
            dedupeKey: dedupe_key,
            components: mappedComponents,
            writeToPage: write_to_page,
            mode,
            environment,
            installedPlugins: toInventory(installed_plugins),
            allowDuplicateTemplateTitles: allow_duplicate_template_titles,
          },
          registry,
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(result.manifest, null, 2) }],
        };
      } catch (err) {
        return formatLibraryCompositionError(err);
      }
    },
  );

  // ------------------------------------------------------------------ //
  // patch_composed_page
  // ------------------------------------------------------------------ //
  server.tool(
    'patch_composed_page',
    'Apply a targeted granular delta patch to a single widget or container on a composed page without rewriting unrelated sections or regenerating existing elementIds. Enforces expected_page_content_hash optimistic locking and returns updated CompositionManifest.',
    {
      site_id: z.string().optional().describe('Site ID from config'),
      page_id: z.number().int().positive().describe('Target page ID'),
      target_element_id: z.string().min(1).describe('Element ID to patch'),
      settings_patch: z.record(z.unknown()).describe('Partial settings object to merge into target element'),
      expected_page_content_hash: z.string().min(1).describe('Current pageContentHash before patch'),
      dry_run: z.boolean().optional().default(false),
      installed_plugins: InstalledPluginsSchema.optional(),
      manifest: z.record(z.unknown()).optional().describe('Optional CompositionManifest to update'),
    },
    async ({
      site_id,
      page_id,
      target_element_id,
      settings_patch,
      expected_page_content_hash,
      dry_run,
      installed_plugins,
      manifest,
    }) => {
      try {
        const client = getClient(site_id);
        const pageData = (await client.getPageData({ id: page_id })) as {
          elementor_data?: unknown[];
        };
        const elements = (Array.isArray(pageData.elementor_data)
          ? pageData.elementor_data
          : []) as ElementorElementNode[];

        const fallbackManifest: CompositionManifest = (manifest as unknown as CompositionManifest) ?? {
          schemaVersion: 'elementeer-composition-manifest/v1',
          pageId: page_id,
          pageContentHash: computeContentHash(elements),
          kitId: 1,
          components: [
            {
              componentKey: `page/${page_id}`,
              templateId: 1,
              templateTitle: `PAGE_${page_id}`,
              componentVersion: '1.0.0',
              structureHash: 'sha256:page',
              slotOrder: 0,
              elementIds: elements.map((el) => el.id).filter(Boolean),
              tokenDependencies: { colors: [], typography: [] },
              upsertAction: 'reused',
            },
          ],
          slots: [
            {
              slotKey: 'slot-0-page',
              order: 0,
              componentKey: `page/${page_id}`,
              templateId: 1,
              rootElementId: elements[0]?.id ?? 'root',
            },
          ],
          elementIds: elements.map((el) => el.id).filter(Boolean),
          tokenDependencies: { colors: [], typography: [] },
          idempotency: {
            strategy: 'upsert-by-component-key',
            dedupeKey: `page-${page_id}`,
            duplicateTemplatesPrevented: true,
            duplicateElementIdsPrevented: true,
            allowDuplicateTemplateTitles: false,
          },
        };

        const patchResult = await applyGranularPatch({
          pageId: page_id,
          elements,
          manifest: fallbackManifest,
          patch: {
            targetElementId: target_element_id,
            settingsPatch: settings_patch,
            expectedPageContentHash: expected_page_content_hash,
            dryRun: dry_run,
          },
          client,
          installedPlugins: toInventory(installed_plugins),
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  pageId: patchResult.pageId,
                  targetElementId: patchResult.targetElementId,
                  previousPageContentHash: patchResult.previousPageContentHash,
                  pageContentHash: patchResult.pageContentHash,
                  fullPageRewrite: patchResult.fullPageRewrite,
                  mutatedElementIds: patchResult.mutatedElementIds,
                  preservedElementIds: patchResult.preservedElementIds,
                  unchangedTopLevelSectionIndices: patchResult.unchangedTopLevelSectionIndices,
                  manifest: patchResult.manifest,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return formatLibraryCompositionError(err);
      }
    },
  );

  // ------------------------------------------------------------------ //
  // validate_widget_controls
  // ------------------------------------------------------------------ //
  server.tool(
    'validate_widget_controls',
    'Validate Nav Menu (nav-menu) and The Plus (tp_*) widget fixtures against installed control schemas and plugin versions before write.',
    {
      elements: z.array(z.record(z.unknown())).min(1),
      installed_plugins: InstalledPluginsSchema.optional(),
    },
    async ({ elements, installed_plugins }) => {
      try {
        const result = assertWidgetControlsValid(elements, toInventory(installed_plugins));
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  ...result,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return formatLibraryCompositionError(err);
      }
    },
  );

  // ------------------------------------------------------------------ //
  // convert_responsive_controls
  // ------------------------------------------------------------------ //
  server.tool(
    'convert_responsive_controls',
    'Losslessly convert between canonical ResponsiveLayoutControls (desktop/tablet/mobile) and Elementor container/widget settings + __globals__ tokens.',
    {
      direction: z.enum(['to_elementor', 'from_elementor']),
      target: z.enum(['container', 'widget']).optional().default('container'),
      responsive_controls: z.record(z.unknown()).optional(),
      settings: z.record(z.unknown()).optional(),
      globals: z.record(z.string()).optional(),
    },
    async ({ direction, target, responsive_controls, settings, globals }) => {
      try {
        if (direction === 'to_elementor') {
          const out = responsiveControlsToElementorSettings(
            (responsive_controls ?? {}) as ResponsiveLayoutControls,
            { target, globals },
          );
          return {
            content: [{ type: 'text', text: JSON.stringify({ ok: true, ...out }, null, 2) }],
          };
        }
        const extracted = elementorSettingsToResponsiveControls(settings ?? {}, { target });
        return {
          content: [{ type: 'text', text: JSON.stringify({ ok: true, ...extracted }, null, 2) }],
        };
      } catch (err) {
        return formatLibraryCompositionError(err);
      }
    },
  );
}
