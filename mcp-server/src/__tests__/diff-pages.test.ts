import { describe, it, expect } from 'vitest';
import { projectElementorData } from '../projection.js';
import { PAGE_2340_ICON_BOX_SECTION_D2427FE } from './fixtures/page-2340-icon-box-section-d2427fe.js';
import { PAGE_2618_SECTION4_1C775162 } from './fixtures/page-2618-section4-1c775162.js';
import { PAGE_2340_SECTION4_1C775162 } from './fixtures/page-2340-section4-1c775162.js';
import { PAGE_2618_TOPLEVEL } from './fixtures/page-2618-toplevel.js';
import { PAGE_2340_TOPLEVEL } from './fixtures/page-2340-toplevel.js';

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

  it('erkennt fehlende Widgets anhand IDs (synthetisches Fixture)', () => {
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

  it('erkennt an realen Fixtures: Sektion 4 gleiche Struktur auf 2618 und 2340 (structure mode)', () => {
    // Sektion "Was sich typischerweise sofort verbessert" (1c775162) ist auf
    // beiden Seiten strukturell gleich: 5 Icon-Boxen, gleiche IDs, gleicher
    // Container-Tree. Die Gap-Report-Annahme '3 statt 5' ist widerlegt.

    const ref = projectAndExtract(PAGE_2618_SECTION4_1C775162, 'structure');
    const variant = projectAndExtract(PAGE_2340_SECTION4_1C775162, 'structure');

    // structure-Projektion enthaelt KEINE Texte → identisch trotz
    // unterschiedlicher Beschriftungen auf beiden Seiten.
    expect(JSON.stringify(ref)).toBe(JSON.stringify(variant));

    const refSection = ref[0] as Record<string, unknown>;
    expect(refSection.children_count).toBe(1); // addfe73 FAQ container

    const refChildren = refSection.children as Array<Record<string, unknown>>;
    const faq = refChildren[0];
    expect(faq.children_count).toBe(3); // heading + text + inner

    const faqChildren = faq.children as Array<Record<string, unknown>>;
    const inner = faqChildren[2];
    expect(inner.children_count).toBe(1); // d2427fe

    const innerChildren = inner.children as Array<Record<string, unknown>>;
    const howItWorks = innerChildren[0];
    expect(howItWorks.children_count).toBe(5);

    const iconBoxes = howItWorks.children as Array<Record<string, unknown>>;
    expect(iconBoxes.map(c => c.id)).toEqual(['1cefa87', 'c2068b0', '4c63abf', '8ae0619', '3a4b09c']);
  });

  it('erkennt an realen Fixtures: unterschiedliche Texte zwischen 2618 und 2340 (content mode)', () => {
    // 2618 ist Beauty, 2340 ist Handwerk. Gleiche Widget-IDs, andere Texte:
    //   4c63abf 2618 "Mehr gebuchte Termine"  → 2340 "Weniger Leerlauf im Kalender"
    //   3a4b09c 2618 "Bessere Auslastung"     → 2340 "Mehr passende Termine"

    const refContent = projectAndExtract(PAGE_2618_SECTION4_1C775162, 'content');
    const variantContent = projectAndExtract(PAGE_2340_SECTION4_1C775162, 'content');

    const ref4 = slotById(refContent, '4c63abf')!;
    const refText4 = ref4.text_fields as Record<string, string>;
    const var4 = slotById(variantContent, '4c63abf')!;
    const varText4 = var4.text_fields as Record<string, string>;
    expect(refText4.title_text).toBe('Mehr gebuchte Termine');
    expect(varText4.title_text).toBe('Weniger Leerlauf im Kalender');

    const ref3 = slotById(refContent, '3a4b09c')!;
    const refText3 = ref3.text_fields as Record<string, string>;
    const var3 = slotById(variantContent, '3a4b09c')!;
    const varText3 = var3.text_fields as Record<string, string>;
    expect(refText3.title_text).toBe('Bessere Auslastung');
    expect(varText3.title_text).toBe('Mehr passende Termine');
  });

  it('erkennt an realen Fixtures: fehlender Top-Level-Container auf 2340', () => {
    // 2340 fehlt der Top-Level-Container 2177a59 ("So funktioniert's").
    // 2618 hat 11 Top-Level-Container, 2340 nur 10. Alle Indizes ab 3
    // sind auf 2340 um eins verschoben (4→3, 5→4, 6→5, 8→7, 9→8, 10→9).
    // Das ist der echte Strukturunterschied zwischen den Seiten.

    const ref = projectAndExtract(PAGE_2618_TOPLEVEL, 'structure');
    const variant = projectAndExtract(PAGE_2340_TOPLEVEL, 'structure');

    const refIds = (ref as Array<Record<string, unknown>>).map(c => c.id as string);
    const variantIds = (variant as Array<Record<string, unknown>>).map(c => c.id as string);

    // 2618: 11 Top-Level, 2340: 10.
    expect(refIds.length).toBe(11);
    expect(variantIds.length).toBe(10);

    // Der fehlende Container wird belegt, nicht behauptet.
    const variantIdSet = new Set(variantIds);
    const missing = refIds.filter(id => !variantIdSet.has(id));
    expect(missing).toEqual(['2177a59']);

    // Alle übrigen Top-Level-Container sind auf beiden Seiten vorhanden
    // (nur die Position ist verschoben).
    const refRest = refIds.filter(id => id !== '2177a59');
    expect(refRest.sort()).toEqual(variantIds.slice().sort());
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
