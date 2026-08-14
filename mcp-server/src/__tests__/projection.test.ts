import { describe, it, expect } from 'vitest';
import { projectElementorData, type ElementorElement, type ProjectionLevel } from '../projection.js';

function makeHeroSection(): ElementorElement[] {
  return [{
    id: 'b9149c',
    elType: 'section',
    elements: [{
      id: 'col1',
      elType: 'column',
      elements: [
        {
          id: 'hero_heading',
          elType: 'widget',
          widgetType: 'heading',
          settings: {
            title: 'Willkommen bei HandwerkPro',
            link: { url: '#services', is_external: false },
            title_color: '#1a1a1a',
            typography_typography: { custom: true },
            _padding: { top: '20px', bottom: '20px' },
            _background_color: '#ffffff',
            typography_font_size: { size: 48, unit: 'px' },
            _title: 'Hero Heading',
          },
        },
        {
          id: 'hero_button',
          elType: 'widget',
          widgetType: 'button',
          settings: {
            text: 'Kostenlosen Check buchen',
            link: { url: '/booking' },
            button_text_color: '#ffffff',
            _padding: { left: '30px', right: '30px' },
            _margin: { top: '10px' },
          },
        },
        {
          id: 'hero_image',
          elType: 'widget',
          widgetType: 'image',
          settings: {
            image: { id: 42, url: 'https://preview.fusionaize.com/wp-content/uploads/hero.jpg' },
            caption: 'Handwerk vor Ort',
            link: { url: '/about' },
          },
        },
      ],
    }],
    settings: {
      _background_color: '#f5f5f5',
      _padding: { top: '80px', bottom: '80px' },
    },
  }];
}

const meta = { pageId: 2618, post_title: 'Test Page', revision: '2026-08-11' };

describe('projectElementorData', () => {
  it('structure projection returns IDs, types, and hierarchy without settings', () => {
    const data = makeHeroSection();
    const result = projectElementorData(data, 'structure', meta);

    expect(result.pageId).toBe(2618);
    expect(result.projection).toBe('structure');
    expect(result.data).toHaveLength(1);

    const section = result.data[0] as Record<string, unknown>;
    expect(section.id).toBe('b9149c');
    expect(section.elType).toBe('section');
    expect(section.children).toBeDefined();
    expect(section.settings).toBeUndefined();

    const children = section.children as Record<string, unknown>[];
    expect(children).toHaveLength(1);
    const col = children[0];
    expect(col.elType).toBe('column');
    expect(col.children).toBeDefined();

    const widgets = col.children as Record<string, unknown>[];
    expect(widgets).toHaveLength(3);
    expect(widgets[0].widgetType).toBe('heading');
    expect(widgets[0].title).toBe('Hero Heading');
    expect(widgets[0].settings).toBeUndefined();
  });

  it('content projection returns only editable text, links, and media', () => {
    const data = makeHeroSection();
    const result = projectElementorData(data, 'content', meta);

    expect(result.pageId).toBe(2618);
    expect(result.projection).toBe('content');
    expect(result.data).toHaveLength(3);

    const slots = result.data as Record<string, unknown>[];
    const headingSlot = slots.find((s: Record<string, unknown>) => s.widget_type === 'heading') as Record<string, unknown> | undefined;
    expect(headingSlot).toBeDefined();
    expect((headingSlot!['text_fields'] as Record<string, string>).title).toBe('Willkommen bei HandwerkPro');
    expect(Object.keys(headingSlot!['link_fields'] as Record<string, unknown>)).toContain('link');

    const buttonSlot = slots.find((s: Record<string, unknown>) => s.widget_type === 'button') as Record<string, unknown> | undefined;
    expect(buttonSlot).toBeDefined();
    expect((buttonSlot!['text_fields'] as Record<string, string>).text).toBe('Kostenlosen Check buchen');

    const imageSlot = slots.find((s: Record<string, unknown>) => s.widget_type === 'image') as Record<string, unknown> | undefined;
    expect(imageSlot).toBeDefined();
    expect(Object.keys(imageSlot!['media_fields'] as Record<string, unknown>)).toContain('image');
    expect((imageSlot!['text_fields'] as Record<string, string>).caption).toBe('Handwerk vor Ort');
  });

  it('content projection excludes styling boilerplate', () => {
    const data = makeHeroSection();
    const result = projectElementorData(data, 'content', meta);
    const json = JSON.stringify(result);
    expect(json).not.toContain('typography_font_size');
    expect(json).not.toContain('_padding');
    expect(json).not.toContain('_margin');
    expect(json).not.toContain('title_color');
    expect(json).not.toContain('_background_color');
  });

  it('interaction projection returns buttons and links', () => {
    const data = makeHeroSection();
    const result = projectElementorData(data, 'interaction', meta);

    expect(result.projection).toBe('interaction');
    const entries = result.data as Record<string, unknown>[];

    const headingEntry = entries.find((e: Record<string, unknown>) => e.widget_type === 'heading') as Record<string, unknown> | undefined;
    expect(headingEntry).toBeDefined();
    expect((headingEntry!['links'] as Array<Record<string, string>>)).toHaveLength(1);

    const buttonEntry = entries.find((e: Record<string, unknown>) => e.widget_type === 'button') as Record<string, unknown> | undefined;
    expect(buttonEntry).toBeDefined();
    expect((buttonEntry!['buttons'] as Array<Record<string, string>>)).toHaveLength(1);
    expect((buttonEntry!['buttons'] as Array<Record<string, string>>)[0].text).toBe('Kostenlosen Check buchen');
  });

  it('style_tokens projection returns colors, typography, spacing', () => {
    const data = makeHeroSection();
    const result = projectElementorData(data, 'style_tokens', meta);

    expect(result.projection).toBe('style_tokens');
    const entries = result.data as Record<string, unknown>[];

    const headingEntry = entries.find((e: Record<string, unknown>) => e.widget_type === 'heading') as Record<string, unknown> | undefined;
    expect(headingEntry).toBeDefined();
    expect(Object.keys(headingEntry!['colors'] as Record<string, unknown>)).toContain('title_color');
    expect(Object.keys(headingEntry!['typography'] as Record<string, unknown>)).toContain('typography_typography');
  });

  it('full projection returns raw data unchanged', () => {
    const data = makeHeroSection();
    const result = projectElementorData(data, 'full', meta);

    expect(result.projection).toBe('full');
    expect(result.data).toEqual(data);
  });

  it('content projection payload is significantly smaller than full projection', () => {
    const data = makeHeroSection();
    const fullResult = projectElementorData(data, 'full', meta);
    const contentResult = projectElementorData(data, 'content', meta);

    const fullSize = JSON.stringify(fullResult).length;
    const contentSize = JSON.stringify(contentResult).length;

    expect(contentSize).toBeLessThan(fullSize);
    expect(contentSize).toBeGreaterThan(0);

    const fullJson = JSON.stringify(fullResult);
    expect(fullJson).toContain('title_color');
    expect(fullJson).toContain('typography_font_size');
    expect(fullJson).toContain('_padding');

    const contentJson = JSON.stringify(contentResult);
    expect(contentJson).not.toContain('title_color');
    expect(contentJson).not.toContain('typography_font_size');
    expect(contentJson).not.toContain('_padding');
    expect(contentJson).toContain('Willkommen bei HandwerkPro');
    expect(contentJson).toContain('Kostenlosen Check buchen');
  });

  it('content projection on empty page returns empty data array', () => {
    const result = projectElementorData([], 'content', meta);
    expect(result.data).toHaveLength(0);
    expect(result.pageId).toBe(2618);
  });

  it('all projections include pageId and revision', () => {
    const levels: ProjectionLevel[] = ['structure', 'content', 'interaction', 'style_tokens', 'full'];
    for (const level of levels) {
      const result = projectElementorData(makeHeroSection(), level, meta);
      expect(result.pageId).toBe(2618);
      expect(result.revision).toBe('2026-08-11');
      expect(result.projection).toBe(level);
    }
  });
});
