import { describe, it, expect } from 'vitest';
import { projectElementorData } from '../projection.js';

function projectAndExtract(data: Record<string, unknown>[], level: 'structure' | 'content' | 'interaction' | 'full'): unknown[] {
  const projected = projectElementorData(data, level, { pageId: 1, post_title: 'Test', revision: '' });
  return (projected as unknown as { data: unknown[] }).data;
}

function makeFiveSectionPage(suffix: string): Record<string, unknown>[] {
  const sections: Record<string, unknown>[] = [];
  for (let s = 0; s < 5; s++) {
    sections.push({
      id: `section${suffix}${s}`,
      elType: 'container',
      elements: [
        { id: `h${suffix}${s}`, elType: 'widget', widgetType: 'heading', settings: { title: `Heading ${suffix}-${s}` } },
        { id: `t${suffix}${s}`, elType: 'widget', widgetType: 'text-editor', settings: { editor: `<p>Text ${suffix}-${s}</p>` } },
        { id: `b${suffix}${s}`, elType: 'widget', widgetType: 'button', settings: { text: `Button ${suffix}-${s}`, link: { url: `/action-${suffix}-${s}` } } },
      ],
    });
  }
  return sections;
}

function makeHeroSection(extraWidget?: boolean): Record<string, unknown>[] {
  const widgets = [
    { id: 'h1', elType: 'widget', widgetType: 'heading', settings: { title: 'Hero Heading' } },
    { id: 't1', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Hero Text</p>' } },
    { id: 'b1', elType: 'widget', widgetType: 'button', settings: { text: 'CTA', link: { url: '/cta' } } },
    { id: 'il1', elType: 'widget', widgetType: 'icon-list', settings: { icon_list: [{ text: 'Feature A', icon: 'fa fa-check' }] } },
  ];
  if (extraWidget) {
    widgets.push({ id: 'extra1', elType: 'widget', widgetType: 'icon-box', settings: { title_text: 'Extra', description_text: 'Extra description' } });
  }
  return [{ id: 'hero', elType: 'container', elements: widgets }];
}

function slotById(slots: unknown[], id: string): Record<string, unknown> | undefined {
  return slots.find(s => (s as Record<string, unknown>).widget_id === id) as Record<string, unknown> | undefined;
}

function slotCount(slots: unknown[]): number {
  return slots.filter(s => (s as Record<string, unknown>).widget_id).length;
}

describe('diff_pages Logik (unit)', () => {
  it('erkennt identische Seiten (structure mode)', () => {
    const page = makeFiveSectionPage('a');
    const ref = projectAndExtract(page, 'structure');
    const variant = projectAndExtract(page, 'structure');

    expect(ref.length).toBe(5);
    expect(variant.length).toBe(5);
    expect(JSON.stringify(ref)).toBe(JSON.stringify(variant));
  });

  it('erkennt Widget-Count-Differenz (missing Widget) ueber children_count', () => {
    const refPage = makeHeroSection(true);  // 5 widgets
    const variantPage = makeHeroSection(false); // 4 widgets

    const ref = projectAndExtract(refPage, 'structure');
    const variant = projectAndExtract(variantPage, 'structure');

    const refSection = ref[0] as Record<string, unknown>;
    const variantSection = variant[0] as Record<string, unknown>;

    expect(refSection.children_count).toBe(5);
    expect(variantSection.children_count).toBe(4);

    const refChildren = refSection.children as Array<Record<string, unknown>>;
    const variantChildren = variantSection.children as Array<Record<string, unknown>>;
    expect(refChildren.length).toBe(5);
    expect(variantChildren.length).toBe(4);
  });

  it('erkennt fehlende Widgets anhand IDs (Sektion 4 Problem)', () => {
    const refPage = [{
      id: '1c775162',
      elType: 'container',
      elements: [
        { id: '4c63abf', elType: 'widget', widgetType: 'icon-box', settings: { title_text: 'Vorteil 1', description_text: 'Beschreibung 1' } },
        { id: '8ae0619', elType: 'widget', widgetType: 'icon-box', settings: { title_text: 'Vorteil 2', description_text: 'Beschreibung 2' } },
        { id: 'abc1234', elType: 'widget', widgetType: 'icon-box', settings: { title_text: 'Vorteil 3', description_text: 'Beschreibung 3' } },
        { id: 'def5678', elType: 'widget', widgetType: 'icon-box', settings: { title_text: 'Vorteil 4', description_text: 'Beschreibung 4' } },
        { id: 'ghi9012', elType: 'widget', widgetType: 'icon-box', settings: { title_text: 'Vorteil 5', description_text: 'Beschreibung 5' } },
      ],
    }];
    const variantPage = [{
      id: '1c775162',
      elType: 'container',
      elements: [
        { id: '4c63abf', elType: 'widget', widgetType: 'icon-box', settings: { title_text: 'Vorteil 1', description_text: 'Beschreibung 1' } },
        { id: 'def5678', elType: 'widget', widgetType: 'icon-box', settings: { title_text: 'Vorteil 4', description_text: 'Beschreibung 4' } },
        { id: 'ghi9012', elType: 'widget', widgetType: 'icon-box', settings: { title_text: 'Vorteil 5', description_text: 'Beschreibung 5' } },
      ],
    }];

    const ref = projectAndExtract(refPage, 'structure');
    const variant = projectAndExtract(variantPage, 'structure');

    const refSection = ref[0] as Record<string, unknown>;
    const variantSection = variant[0] as Record<string, unknown>;

    expect(refSection.children_count).toBe(5);
    expect(variantSection.children_count).toBe(3);

    const refChildren = refSection.children as Array<Record<string, unknown>>;
    const variantChildren = variantSection.children as Array<Record<string, unknown>>;

    const refIds = new Set(refChildren.map(c => c.id as string));
    const variantIds = new Set(variantChildren.map(c => c.id as string));

    const missing = [...refIds].filter(id => !variantIds.has(id));
    expect(missing.sort()).toEqual(['8ae0619', 'abc1234']);
  });

  it('erkennt Text-Diffs bei identischer Struktur ueber content-Projektion (flache Slots)', () => {
    const refPage = [{
      id: 's1',
      elType: 'container',
      elements: [
        { id: 'h1', elType: 'widget', widgetType: 'heading', settings: { title: 'Alte Überschrift' } },
      ],
    }];
    const variantPage = [{
      id: 's1',
      elType: 'container',
      elements: [
        { id: 'h1', elType: 'widget', widgetType: 'heading', settings: { title: 'Neue Überschrift' } },
      ],
    }];

    const ref = projectAndExtract(refPage, 'content');
    const variant = projectAndExtract(variantPage, 'content');

    // Content projection produces flat ContentSlot arrays
    expect(slotCount(ref)).toBe(1);
    expect(slotCount(variant)).toBe(1);

    const refSlot = slotById(ref, 'h1')!;
    const variantSlot = slotById(variant, 'h1')!;

    const refText = refSlot.text_fields as Record<string, string>;
    const variantText = variantSlot.text_fields as Record<string, string>;

    expect(refText.title).toBe('Alte Überschrift');
    expect(variantText.title).toBe('Neue Überschrift');
    expect(refText).not.toEqual(variantText);
  });

  it('interaction projection isoliert Buttons und Links', () => {
    const page = [{
      id: 'hero',
      elType: 'container',
      elements: [
        { id: 'h1', elType: 'widget', widgetType: 'heading', settings: { title: 'Hero', link: { url: '#hero-link' } } },
        { id: 'b1', elType: 'widget', widgetType: 'button', settings: { text: 'CTA Primär', link: { url: '/primary' } } },
        { id: 'b2', elType: 'widget', widgetType: 'button', settings: { text: 'CTA Sekundär', link: { url: '/secondary' } } },
        { id: 't1', elType: 'widget', widgetType: 'text-editor', settings: { editor: '<p>Langer Text</p>' } },
      ],
    }];

    const interaction = projectElementorData(page, 'interaction', { pageId: 1, post_title: 'Test', revision: '' });
    const iData = (interaction as unknown as { data: unknown[] }).data;

    const iJson = JSON.stringify(iData);
    expect(iJson).toContain('CTA Primär');
    expect(iJson).toContain('/primary');
    expect(iJson).toContain('CTA Sekundär');
    expect(iJson).toContain('/secondary');
    // Heading with a link should appear (it has a link_field)
    expect(iJson).toContain('#hero-link');
    // Text-editor has no links → excluded
    expect(iJson).not.toContain('Langer Text');
  });

  it('structure-Projektion enthaelt IDs und Typen, keine settings', () => {
    const page = makeHeroSection(true);
    const structure = projectElementorData(page, 'structure', { pageId: 1, post_title: 'Test', revision: '' });
    const sData = (structure as unknown as { data: unknown[] }).data;
    const sJson = JSON.stringify(sData);

    // IDs and types present
    expect(sJson).toContain('h1');
    expect(sJson).toContain('b1');
    expect(sJson).toContain('extra1');
    expect(sJson).toContain('icon-box');

    // Settings excluded
    expect(sJson).not.toContain('title_color');
    expect(sJson).not.toContain('typography_font_size');
  });

  it('content-Projektion produziert deterministisches Widget-Diff', () => {
    const page = makeFiveSectionPage('x');
    const r1 = projectElementorData(page, 'content', { pageId: 1, post_title: 'A', revision: '' });
    const r2 = projectElementorData(page, 'content', { pageId: 1, post_title: 'A', revision: '' });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});
