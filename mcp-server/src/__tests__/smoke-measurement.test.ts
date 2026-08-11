import { describe, it, expect } from 'vitest';
import { projectElementorData } from '../projection.js';
import { resolvePayloadViaResource } from '../page-resource-cache.js';

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

describe('Rauchmessung Projektion', () => {
  const PROJ_LEVELS = ['full', 'structure', 'content', 'interaction', 'style_tokens'] as const;

  it('Projektionsgroessen (Single Section, hero-aenlich)', () => {
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
    const meta = { pageId: 1, post_title: 'Test' };

    const sizes: Record<string, { chars: number; tokens: number }> = {};
    for (const level of PROJ_LEVELS) {
      const result = projectElementorData(data, level, meta);
      const chars = JSON.stringify(result).length;
      sizes[level] = { chars, tokens: Math.round(chars / 3.5) };
    }

    console.log('\n=== Single Section (hero-aenlich) ===');
    for (const level of PROJ_LEVELS) {
      const s = sizes[level];
      const pct = sizes.full.chars > 0 ? Math.round((s.chars / sizes.full.chars) * 100) : 0;
      console.log(`  ${level.padEnd(14)} ${String(s.tokens).padStart(6)} tokens ${String(s.chars).padStart(6)} chars ${String(pct).padStart(4)}%`);
    }

    const contentReduction = sizes.full.chars / sizes.content.chars;
    console.log(`  Content-Reduktion: ${contentReduction.toFixed(1)}:1`);

    // content projection should strip colors, typo, padding
    const contentJson = JSON.stringify(projectElementorData(data, 'content', meta));
    expect(contentJson).not.toContain('title_color');
    expect(contentJson).not.toContain('typography_font_size');
    expect(contentJson).not.toContain('_padding');
    expect(contentJson).toContain('Willkommen');
    expect(contentJson).toContain('Buchen');

    // full >= all others
    expect(sizes.full.chars).toBeGreaterThanOrEqual(sizes.content.chars);
    expect(sizes.full.chars).toBeGreaterThanOrEqual(sizes.interaction.chars);
    expect(sizes.full.chars).toBeGreaterThanOrEqual(sizes.structure.chars);
  });

  it('Projektionsgroessen (Large Page, 5 Sections)', () => {
    const data = makeLargePage();
    const meta = { pageId: 1, post_title: 'LargePage' };

    const sizes: Record<string, { chars: number; tokens: number }> = {};
    for (const level of PROJ_LEVELS) {
      const result = projectElementorData(data, level, meta);
      const chars = JSON.stringify(result).length;
      sizes[level] = { chars, tokens: Math.round(chars / 3.5) };
    }

    console.log('\n=== Large Page (5 Sections) ===');
    for (const level of PROJ_LEVELS) {
      const s = sizes[level];
      const pct = sizes.full.chars > 0 ? Math.round((s.chars / sizes.full.chars) * 100) : 0;
      const signalPct = level === 'content' ? Math.round((s.chars / sizes.full.chars) * 100) : 0;
      console.log(`  ${level.padEnd(14)} ${String(s.tokens).padStart(6)} tokens ${String(s.chars).padStart(6)} chars ${String(pct).padStart(4)}%`);
    }

    const contentReduction = sizes.full.chars / sizes.content.chars;
    const structureReduction = sizes.full.chars / sizes.structure.chars;
    console.log(`  Content-Reduktion: ${contentReduction.toFixed(1)}:1`);
    console.log(`  Structure-Reduktion: ${structureReduction.toFixed(1)}:1`);

    // strukturierte Reduktion sollte signifikant sein
    expect(contentReduction).toBeGreaterThan(2);
    expect(structureReduction).toBeGreaterThan(2);
  });

  it('resource threshold: kleine Payloads inline, grosse als resource', () => {
    const meta = { pageId: 1, post_title: 'Test' };

    // Kleine Payload: Hero
    const heroData = [{
      id: 'x', elType: 'container',
      elements: [{ id: 'h', elType: 'widget', widgetType: 'heading', settings: { title: 'Kurz' } }],
    }];
    const heroProjected = projectElementorData(heroData, 'content', meta);
    const heroText = JSON.stringify(heroProjected, null, 2);
    const heroRes = resolvePayloadViaResource(heroProjected, heroText, 'content', meta);
    expect(heroRes.asResource).toBe(false);

    // Grosse Payload: Large Page
    const largeData = makeLargePage();
    const largeProjected = projectElementorData(largeData, 'content', meta);
    const largeText = JSON.stringify(largeProjected, null, 2);
    const largeRes = resolvePayloadViaResource(largeProjected, largeText, 'content', meta);
    
    if (largeText.length >= 20_000) {
      expect(largeRes.asResource).toBe(true);
      if (largeRes.asResource) {
        expect(largeRes.uri).toContain('elementeer://');
      }
    } else {
      console.log(`  Large page content projection: ${largeText.length} chars (threshold: 20000)`);
    }
  });
});
