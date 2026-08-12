import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';
import { projectElementorData, type ProjectionLevel } from '../projection.js';

interface PageData {
  post_id: number;
  post_title: string;
  elementor_data?: Record<string, unknown>[];
}

interface WidgetInfo {
  id: string;
  widget_type: string;
  section_index: number;
  text_fields: Record<string, string>;
  link_fields: Record<string, { url: string }>;
}

interface SectionDiffEntry {
  section_index: number;
  container_id: string;
  diff_type: 'identical' | 'widget_count' | 'text_diff' | 'structure_diff' | 'missing' | 'extra';
  ref_count: number;
  variant_count: number;
  text_diffs: Array<{
    widget_id: string;
    widget_type: string;
    field: string;
    ref_value: string;
    variant_value: string;
  }>;
  missing_widgets: Array<{ id: string; widget_type: string; text_preview?: string }>;
  extra_widgets:   Array<{ id: string; widget_type: string; text_preview?: string }>;
}

function collectWidgetInfo(
  projected: unknown[],
  sectionIndex: number,
): WidgetInfo[] {
  const infos: WidgetInfo[] = [];
  if (!Array.isArray(projected)) return infos;

  for (const entry of projected) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;

    if (
      e.section_index !== undefined &&
      typeof e.section_index === 'number'
    ) {
      sectionIndex = e.section_index;
    }

    if (Array.isArray(e.elements)) {
      infos.push(...collectWidgetInfo(e.elements as unknown[], sectionIndex));
    }

    if (e.widget_id && e.widget_type) {
      infos.push({
        id: String(e.widget_id),
        widget_type: String(e.widget_type),
        section_index: sectionIndex,
        text_fields: (e.text_fields as Record<string, string>) ?? {},
        link_fields: (e.link_fields as Record<string, { url: string }>) ?? {},
      });
    }
  }

  return infos;
}

function diffSections(
  refProjected: unknown[],
  variantProjected: unknown[],
  mode: 'structure' | 'text' | 'both',
  refTitle: string,
  variantTitle: string,
): {
  diffs: SectionDiffEntry[];
  summary: {
    total_sections: number;
    identical: number;
    widget_count_diff: number;
    text_diff: number;
    structure_diff: number;
    missing_widgets_total: number;
    extra_widgets_total: number;
  };
} {
  const refWidgets  = collectWidgetInfo(refProjected, -1);
  const varWidgets  = collectWidgetInfo(variantProjected, -1);

  const refBySection = new Map<number, WidgetInfo[]>();
  const varBySection = new Map<number, WidgetInfo[]>();

  for (const w of refWidgets) {
    const arr = refBySection.get(w.section_index) ?? [];
    arr.push(w);
    refBySection.set(w.section_index, arr);
  }
  for (const w of varWidgets) {
    const arr = varBySection.get(w.section_index) ?? [];
    arr.push(w);
    varBySection.set(w.section_index, arr);
  }

  const allIndices = new Set([
    ...refBySection.keys(),
    ...varBySection.keys(),
  ]);
  const sortedIndices = [...allIndices].sort((a, b) => a - b);

  const diffs: SectionDiffEntry[] = [];
  const summary = {
    total_sections: sortedIndices.length,
    identical: 0,
    widget_count_diff: 0,
    text_diff: 0,
    structure_diff: 0,
    missing_widgets_total: 0,
    extra_widgets_total: 0,
  };

  for (const idx of sortedIndices) {
    const ref = refBySection.get(idx) ?? [];
    const variant = varBySection.get(idx) ?? [];

    if (ref.length === 0 && variant.length > 0) {
      diffs.push({
        section_index: idx,
        container_id: 'unknown',
        diff_type: 'extra',
        ref_count: 0,
        variant_count: variant.length,
        text_diffs: [],
        missing_widgets: [],
        extra_widgets: variant.map(w => ({
          id: w.id,
          widget_type: w.widget_type,
          text_preview: Object.values(w.text_fields)[0],
        })),
      });
      summary.structure_diff++;
      summary.extra_widgets_total += variant.length;
      continue;
    }

    if (variant.length === 0 && ref.length > 0) {
      diffs.push({
        section_index: idx,
        container_id: 'unknown',
        diff_type: 'missing',
        ref_count: ref.length,
        variant_count: 0,
        text_diffs: [],
        missing_widgets: ref.map(w => ({
          id: w.id,
          widget_type: w.widget_type,
          text_preview: Object.values(w.text_fields)[0],
        })),
        extra_widgets: [],
      });
      summary.structure_diff++;
      summary.missing_widgets_total += ref.length;
      continue;
    }

    const refIds = new Set(ref.map(w => w.id));
    const variantIds = new Set(variant.map(w => w.id));

    const refOnly = ref.filter(w => !variantIds.has(w.id));
    const variantOnly = variant.filter(w => !refIds.has(w.id));

    const common = ref.filter(w => variantIds.has(w.id));

    const textDiffs: SectionDiffEntry['text_diffs'] = [];

    if (mode === 'text' || mode === 'both') {
      const variantById = new Map(variant.map(w => [w.id, w]));
      for (const rw of common) {
        const vw = variantById.get(rw.id);
        if (!vw) continue;
        const allKeys = new Set([
          ...Object.keys(rw.text_fields),
          ...Object.keys(vw.text_fields),
        ]);
        for (const key of allKeys) {
          const rv = rw.text_fields[key] ?? '';
          const vv = vw.text_fields[key] ?? '';
          if (rv !== vv) {
            textDiffs.push({
              widget_id: rw.id,
              widget_type: rw.widget_type,
              field: key,
              ref_value: rv,
              variant_value: vv,
            });
          }
        }
      }
    }

    const hasCountDiff = ref.length !== variant.length;
    const hasWidgetDiff = refOnly.length > 0 || variantOnly.length > 0;
    const hasTextDiffs = textDiffs.length > 0;

    let diffType: SectionDiffEntry['diff_type'] = 'identical';

    if (hasCountDiff || hasWidgetDiff) {
      diffType = hasWidgetDiff ? 'structure_diff' : 'widget_count';
    } else if (hasTextDiffs) {
      diffType = 'text_diff';
    }

    diffs.push({
      section_index: idx,
      container_id: ref[0]?.id ?? variant[0]?.id ?? 'unknown',
      diff_type: diffType,
      ref_count: ref.length,
      variant_count: variant.length,
      text_diffs: textDiffs,
      missing_widgets: refOnly.map(w => ({
        id: w.id,
        widget_type: w.widget_type,
        text_preview: Object.values(w.text_fields)[0],
      })),
      extra_widgets: variantOnly.map(w => ({
        id: w.id,
        widget_type: w.widget_type,
        text_preview: Object.values(w.text_fields)[0],
      })),
    });

    if (diffType === 'identical') summary.identical++;
    else if (diffType === 'widget_count') summary.widget_count_diff++;
    else if (diffType === 'text_diff') summary.text_diff++;
    else if (diffType === 'structure_diff') {
      summary.structure_diff++;
      summary.missing_widgets_total += refOnly.length;
      summary.extra_widgets_total += variantOnly.length;
    }
  }

  return { diffs, summary };
}

export function registerDiffPagesTool(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {
  server.tool(
    'diff_pages',
    'Compare two Elementor pages by widget hierarchy and text content. ' +
    'Modes: "structure" (widget counts and IDs, cheapest), "text" (text field differences only), ' +
    '"both" (complete diff). Uses content projection internally to keep payloads minimal. ' +
    'This replaces manual side-by-side comparison across 24 tool calls — one call, structured output.',
    {
      reference_page_id: z.number().int().describe('ID of the reference/template page'),
      variant_page_id:   z.number().int().describe('ID of the variant page to compare against the reference'),
      mode: z.enum(['structure', 'text', 'both']).optional().default('structure')
        .describe('Diff mode. "structure" (default) = widget IDs and counts only. "text" = text field differences. "both" = complete comparison.'),
      site_id: z.string().optional().describe('Site ID from config'),
    },
    async ({ reference_page_id, variant_page_id, mode, site_id }) => {
      const client = getClient(site_id);

      const projection: ProjectionLevel = mode === 'structure' ? 'structure' : 'content';

      const [refResult, variantResult] = await Promise.all([
        client.getPageData({ id: reference_page_id }),
        client.getPageData({ id: variant_page_id }),
      ]);

      const refData = refResult.elementor_data ?? [];
      const variantData = variantResult.elementor_data ?? [];

      const refProjected = projectElementorData(refData, projection, {
        pageId: refResult.post_id ?? reference_page_id,
        post_title: refResult.post_title,
        revision: refResult.post_modified ?? '',
      }).data;

      const variantProjected = projectElementorData(variantData, projection, {
        pageId: variantResult.post_id ?? variant_page_id,
        post_title: variantResult.post_title,
        revision: variantResult.post_modified ?? '',
      }).data;

      const refWidgetCount = refProjected.reduce(
        (sum, s) => sum + (typeof (s as Record<string, unknown>).widget_count === 'number' ? (s as Record<string, unknown>).widget_count as number : 0), 0
      ) || 'unknown';
      const variantWidgetCount = variantProjected.reduce(
        (sum, s) => sum + (typeof (s as Record<string, unknown>).widget_count === 'number' ? (s as Record<string, unknown>).widget_count as number : 0), 0
      ) || 'unknown';

      const { diffs, summary } = diffSections(
        refProjected,
        variantProjected,
        mode,
        refResult.post_title ?? `Page ${reference_page_id}`,
        variantResult.post_title ?? `Page ${variant_page_id}`,
      );

      const result = {
        reference: {
          page_id: reference_page_id,
          title: refResult.post_title,
          widget_count: refWidgetCount,
        },
        variant: {
          page_id: variant_page_id,
          title: variantResult.post_title,
          widget_count: variantWidgetCount,
        },
        mode,
        projection_used: projection,
        summary,
        diffs,
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      };
    },
  );
}
