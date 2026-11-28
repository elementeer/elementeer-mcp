import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import {
  assertPublishOrHomepageAllowed,
  defaultEditabilityGateStore,
  EditabilityGateError,
  evaluateAndRecordEditability,
  type EditabilityGateStore,
  type FallbackMetadataEntry,
} from '../editability-gate.js';
import {
  DELIVERY_ENVIRONMENTS,
  DELIVERY_MODES,
  NativeDeliveryError,
} from '../native-delivery-mode.js';

const OperatorOverrideSchema = z.object({
  operator: z.string().min(1),
  reason: z.string().min(1),
  pageId: z.union([z.number().int(), z.string().min(1)]),
  contentHash: z.string().min(1),
  scope: z.string().min(1),
  createdAt: z.string().min(1),
});

const FallbackMetadataEntrySchema = z.object({
  owner: z.string().optional(),
  reason: z.string().optional(),
  scope: z
    .enum([
      'widget-css',
      'page-scoped-css',
      'theme-compat-css',
      'widget-js-hook',
      'bounded-embed',
      'full-page-html',
    ])
    .optional(),
});

export function formatGateErrorResult(err: unknown): {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
} {
  if (err instanceof EditabilityGateError) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              ok: false,
              code: err.code,
              message: err.message,
              pageId: err.details?.pageId,
              contentHash: err.details?.contentHash,
              expectedHash: err.details?.expectedHash,
              reasons: err.details?.reasons,
            },
            null,
            2,
          ),
        },
      ],
      isError: true,
    };
  }
  if (err instanceof NativeDeliveryError) {
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
        text: JSON.stringify({ ok: false, code: 'INTERNAL_GATE_ERROR', message }, null, 2),
      },
    ],
    isError: true,
  };
}

export function registerEditabilityTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
  store: EditabilityGateStore = defaultEditabilityGateStore,
): void {
  // ------------------------------------------------------------------ //
  // evaluate_page_editability
  // ------------------------------------------------------------------ //
  server.tool(
    'evaluate_page_editability',
    'Evaluate a page against Elementeer 2.5 native-elementor editability, deterministic SHA-256 contentHash, and fallback-debt-v1 limits. Records the hash-bound elementeer-editability/v1 report for publish and homepage gates.',
    {
      site_id: z.string().optional().describe('Site ID from config'),
      page_id: z.number().int().positive().describe('Target page ID'),
      mode: z
        .enum(DELIVERY_MODES)
        .optional()
        .default('native-elementor')
        .describe("Delivery mode (defaults to 'native-elementor')"),
      environment: z
        .enum(DELIVERY_ENVIRONMENTS)
        .optional()
        .default('production')
        .describe("Delivery environment (defaults to 'production')"),
      elementor_data: z
        .array(z.record(z.unknown()))
        .optional()
        .describe('Optional Elementor elements array; if omitted, loads live page data via getPageData'),
      page_settings: z
        .record(z.unknown())
        .optional()
        .describe('Optional page settings object included in deterministic contentHash'),
      fallback_metadata: z
        .record(FallbackMetadataEntrySchema)
        .optional()
        .describe('Map of elementId -> { owner, reason, scope } for bounded fallbacks'),
      default_fallback_owner: z.string().optional().describe('Default fallback owner if element metadata is omitted'),
      default_fallback_reason: z.string().optional().describe('Default fallback reason if element metadata is omitted'),
      operator_override: OperatorOverrideSchema.optional().describe('Audited OperatorOverride bound to pageId and contentHash'),
    },
    async ({
      site_id,
      page_id,
      mode,
      environment,
      elementor_data,
      page_settings,
      fallback_metadata,
      default_fallback_owner,
      default_fallback_reason,
      operator_override,
    }) => {
      try {
        const client = getClient(site_id);
        let elements = elementor_data;
        let resolvedSettings = page_settings;

        if (!elements) {
          const pageData = (await client.getPageData({ id: page_id })) as {
            elementor_data?: unknown[];
            page_settings?: Record<string, unknown>;
          };
          elements = Array.isArray(pageData.elementor_data)
            ? (pageData.elementor_data as Record<string, unknown>[])
            : [];
          if (!resolvedSettings && pageData.page_settings) {
            resolvedSettings = pageData.page_settings;
          }
        }

        const report = evaluateAndRecordEditability(
          {
            pageId: page_id,
            elements,
            pageSettings: resolvedSettings,
            mode,
            environment,
            fallbackMetadata: fallback_metadata as Record<string, FallbackMetadataEntry> | undefined,
            defaultFallbackOwner: default_fallback_owner,
            defaultFallbackReason: default_fallback_reason,
            override: operator_override,
          },
          store,
        );

        return {
          content: [{ type: 'text', text: JSON.stringify(report, null, 2) }],
        };
      } catch (err) {
        return formatGateErrorResult(err);
      }
    },
  );

  // ------------------------------------------------------------------ //
  // publish_page
  // ------------------------------------------------------------------ //
  server.tool(
    'publish_page',
    "Publish an Elementor page. Fails closed unless a fresh 'allow' EditabilityReport exists in the hash-bound gate store for the exact pageId and current contentHash.",
    {
      site_id: z.string().optional().describe('Site ID from config'),
      page_id: z.number().int().positive().describe('Page ID to publish'),
      expected_content_hash: z
        .string()
        .optional()
        .describe('Optional expected SHA-256 contentHash from evaluate_page_editability'),
    },
    async ({ site_id, page_id, expected_content_hash }) => {
      try {
        const client = getClient(site_id);
        const { report, contentHash } = await assertPublishOrHomepageAllowed({
          client,
          pageId: page_id,
          store,
          expectedContentHash: expected_content_hash,
        });

        const result = await client.publishPage(page_id, { status: 'publish' });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  pageId: page_id,
                  status: result.status ?? 'publish',
                  contentHash,
                  publishGateDecision: report.publishGateDecision,
                  evaluatedAt: report.evaluatedAt,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return formatGateErrorResult(err);
      }
    },
  );

  // ------------------------------------------------------------------ //
  // set_homepage
  // ------------------------------------------------------------------ //
  server.tool(
    'set_homepage',
    "Assign WordPress homepage (page_on_front). Fails closed when page_id > 0 unless a fresh 'allow' EditabilityReport exists for the exact pageId and current contentHash.",
    {
      site_id: z.string().optional().describe('Site ID from config'),
      page_id: z
        .number()
        .int()
        .nonnegative()
        .describe('Page ID to assign as homepage (0 to reset to latest posts)'),
      expected_content_hash: z
        .string()
        .optional()
        .describe('Optional expected SHA-256 contentHash from evaluate_page_editability'),
    },
    async ({ site_id, page_id, expected_content_hash }) => {
      try {
        const client = getClient(site_id);
        let gateInfo: { contentHash?: string; publishGateDecision?: string; evaluatedAt?: string } = {};

        if (page_id > 0) {
          const { report, contentHash } = await assertPublishOrHomepageAllowed({
            client,
            pageId: page_id,
            store,
            expectedContentHash: expected_content_hash,
          });
          gateInfo = {
            contentHash,
            publishGateDecision: report.publishGateDecision,
            evaluatedAt: report.evaluatedAt,
          };
        }

        await client.updateSiteSettings({ homepage: page_id });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  ok: true,
                  homepagePageId: page_id,
                  ...gateInfo,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (err) {
        return formatGateErrorResult(err);
      }
    },
  );
}
