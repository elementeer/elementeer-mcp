import { describe, it, expect } from 'vitest';
import { projectElementorData } from '../projection.js';
import { resolvePayloadViaResource } from '../page-resource-cache.js';
import { HERO_PAGE_2618_CONTAINER_B9149C } from './fixtures/hero-page-2618-b9149c.js';

const PROJ_LEVELS = ['full', 'structure', 'content', 'interaction', 'style_tokens'] as const;
const META = { pageId: 2618, post_title: 'fusionAIze Preview Hero (real)', revision: '' };

function measureAll(data: Record<string, unknown>[], label: string): Record<string, { chars: number; tokens: number }> {
  const sizes: Record<string, { chars: number; tokens: number }> = {};
  console.log(`\n=== ${label} ===`);
  for (const level of PROJ_LEVELS) {
    const result = projectElementorData(data, level, META);
    const chars = JSON.stringify(result).length;
    sizes[level] = { chars, tokens: Math.round(chars / 3.5) };
    const pct = sizes.full.chars > 0 ? Math.round((chars / sizes.full.chars) * 100) : 0;
    console.log(`  ${level.padEnd(14)} ${String(sizes[level].tokens).padStart(6)} tokens ${String(chars).padStart(7)} chars ${String(pct).padStart(4)}%`);
  }
  const reduction = sizes.full.chars / sizes.content.chars;
  console.log(`  Reduktion: ${reduction.toFixed(1)}:1 (${Math.round((1 - sizes.content.chars / sizes.full.chars) * 100)}% weniger)`);
  return sizes;
}

describe('Rauchmessung Projektion (reale Fixture)', () => {
  it('Fall 1 — Projektion allein: reale Hero-Sektion Page 2618 b9149c', () => {
    const sizes = measureAll(HERO_PAGE_2618_CONTAINER_B9149C, 'Fall 1 — Projektion allein (realer Hero, Page 2618 b9149c)');

    // content projection removes styling boilerplate
    const contentResult = projectElementorData(HERO_PAGE_2618_CONTAINER_B9149C, 'content', META);
    const contentJson = JSON.stringify(contentResult);
    expect(contentJson).not.toContain('typography_font_size');
    expect(contentJson).not.toContain('_padding');
    expect(contentJson).not.toContain('_margin');
    expect(contentJson).not.toContain('title_color');
    expect(contentJson).toContain('Termin buchen');
    expect(contentJson).toContain('Kurzfrage per WhatsApp');

    // full ≥ content (trivial, aber systemisch)
    expect(sizes.full.chars).toBeGreaterThanOrEqual(sizes.content.chars);
    expect(sizes.full.chars).toBeGreaterThanOrEqual(sizes.interaction.chars);
    expect(sizes.full.chars).toBeGreaterThanOrEqual(sizes.structure.chars);

    // content sollte deutlich kleiner sein als full (83:1 Rauschantwort-Grund)
    expect(sizes.full.chars / sizes.content.chars).toBeGreaterThan(5);
  });

  it('Fall 1 — resource threshold: unter 20KB → inline', () => {
    const contentProjected = projectElementorData(HERO_PAGE_2618_CONTAINER_B9149C, 'content', META);
    const contentText = JSON.stringify(contentProjected, null, 2);
    const res = resolvePayloadViaResource(contentProjected, contentText, 'content', META);
    expect(res.asResource).toBe(false);
    console.log(`  Content-Projektion chars: ${contentText.length} (Schwelle: 20000 → inline bleibt)`);
  });

  it('Fall 2 — diff_pages Strukturvergleich (gleiche Seite = identisch)', () => {
    const ref = projectElementorData(HERO_PAGE_2618_CONTAINER_B9149C, 'structure', META);
    const variant = projectElementorData(HERO_PAGE_2618_CONTAINER_B9149C, 'structure', META);

    const refData = (ref as unknown as { data: unknown[] }).data;
    const variantData = (variant as unknown as { data: unknown[] }).data;

    expect(refData.length).toBe(variantData.length);
    expect(JSON.stringify(refData)).toBe(JSON.stringify(variantData));

    const refSection = refData[0] as Record<string, unknown>;
    expect(refSection.children_count).toBe(4);

    const diffCallSize = JSON.stringify(refData).length + JSON.stringify(variantData).length;
    const diffTokens = Math.round(diffCallSize / 3.5);
    console.log(`  diff_pages structure (beide Seiten): ${diffCallSize} chars / ${diffTokens} tokens`);
  });

  it('Fall 2 — diff_pages findet fehlende Widgets in modifizierter Variante', () => {
    // Clone and remove the heading widget (2748485f) + last text-editor (53f07b2d)
    const variantPage = JSON.parse(JSON.stringify(HERO_PAGE_2618_CONTAINER_B9149C));
    const variantContainer = variantPage[0] as Record<string, unknown>;
    const variantElements = variantContainer.elements as Record<string, unknown>[];
    // Remove heading (index 0) and last text-editor (index 3)
    variantContainer.elements = [
      variantElements[1], // text-editor "Weniger Nachrichten-Chaos"
      variantElements[2], // inner container with buttons
    ];

    const ref = projectElementorData(HERO_PAGE_2618_CONTAINER_B9149C, 'structure', META);
    const variant = projectElementorData(variantPage, 'structure', META);

    const refData = (ref as unknown as { data: unknown[] }).data;
    const variantData = (variant as unknown as { data: unknown[] }).data;

    const refChildren = (refData[0] as Record<string, unknown>).children as Array<Record<string, unknown>>;
    const variantChildren = (variantData[0] as Record<string, unknown>).children as Array<Record<string, unknown>>;

    expect(refChildren.length).toBe(4);
    expect(variantChildren.length).toBe(2);

    const refIds = new Set(refChildren.map(c => c.id as string));
    const variantIds = new Set(variantChildren.map(c => c.id as string));
    const missing = [...refIds].filter(id => !variantIds.has(id));
    const extra = [...variantIds].filter(id => !refIds.has(id));

    console.log(`  Fehlende Widgets: [${missing.join(', ')}]`);
    console.log(`  Extra Widgets:    [${extra.join(', ')}]`);

    expect(missing).toContain('2748485f');
    expect(missing).toContain('53f07b2d');
    expect(extra.length).toBe(0);
  });
});

describe('Rauchmessung Synthetische Fixture (bestehende Tests, verlagert)', () => {
  function makeLargePage(): Record<string, unknown>[] {
    const sections: Record<string, unknown>[] = [];
    for (let s = 0; s < 5; s++) {
      sections.push({
        id: `section${s}`,
        elType: 'container',
        elements: [
          { id: `h${s}`, elType: 'widget', widgetType: 'heading',  settings: { title: `Heading ${s}`, title_color: '#333', typography_font_size: { size: 36, unit: 'px' }, typography_font_family: 'Inter', padding: { top: 20, bottom: 10, left: 0, right: 0 }, align: 'center' } },
          { id: `t${s}`, elType: 'widget', widgetType: 'text-editor', settings: { editor: `<p>Lorem ipsum dolor sit amet ${s}, consectetur adipiscing elit.</p>`, text_color: '#666', typography_font_size: { size: 16, unit: 'px' }, padding: { top: 0, bottom: 20 } } },
          { id: `b${s}`, elType: 'widget', widgetType: 'button', settings: { text: `Action ${s}`, link: { url: `https://example.com/action${s}` }, button_color: '#ff6600', button_hover_color: '#cc5500', border_radius: { top: 4, bottom: 4, left: 4, right: 4 }, typography_font_size: { size: 16, unit: 'px' }, padding: { top: 12, bottom: 12, left: 24, right: 24 } } },
          { id: `ic${s}`, elType: 'widget', widgetType: 'icon-list', settings: { icon_list: [{ text: `Feature ${s}a`, icon: 'fa fa-check' }, { text: `Feature ${s}b`, icon: 'fa fa-star' }], typography_font_size: { size: 14, unit: 'px' }, space_between: { size: 8, unit: 'px' } } },
        ],
      });
    }
    return sections;
  }

  const META_SYNTH = { pageId: 999, post_title: 'Synthetic' };

  it('synthetische Large Page (5 Sections) — bestaetigt baseline', () => {
    const sizes = measureAll(makeLargePage(), 'Synthetische Large Page (5 Sections)');
    // Diese baseline war 2.5:1 (5829→2307)
    expect(sizes.full.chars / sizes.content.chars).toBeGreaterThan(1.5);
    expect(sizes.full.chars).toBeGreaterThan(sizes.content.chars);
  });

  it('synthetische Single Section (hero-aehnlich) — bestaetigt baseline', () => {
    const data = [{
      id: 'abc123', elType: 'container',
      elements: [
        { id: 'h1', elType: 'widget', widgetType: 'heading', settings: { title: 'Willkommen', title_color: '#fff', typography_font_size: { size: 48, unit: 'px' }, typography_font_family: 'Inter', padding: { top: 20, bottom: 20 } } },
        { id: 't1', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Text</p>', text_color: '#ccc', typography_font_size: { size: 18, unit: 'px' }, padding: { top: 0, bottom: 30 } } },
        { id: 'b1', elType: 'widget', widgetType: 'button', settings: { text: 'Buchen', link: { url: '/kontakt' }, button_color: '#f60', button_hover_color: '#c50', border_radius: { top: 4, bottom: 4, left: 4, right: 4 }, typography_font_size: { size: 16, unit: 'px' }, padding: { top: 12, bottom: 12, left: 24, right: 24 } } },
        { id: 'im1', elType: 'widget', widgetType: 'image', settings: { image: { id: 42, url: '/img.jpg' }, title_text: 'Alt', padding: { top: 20, bottom: 20 } } },
        { id: 'il1', elType: 'widget', widgetType: 'icon-list', settings: { icon_list: [{ text: 'A', icon: 'fa fa-check' }], typography_font_size: { size: 14, unit: 'px' }, space_between: { size: 8, unit: 'px' } } },
      ],
    }];
    const sizes = measureAll(data, 'Synthetische Single Section (hero-aehnlich)');
    expect(sizes.full.chars / sizes.content.chars).toBeGreaterThan(1.5);
  });
});
