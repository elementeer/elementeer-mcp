import { describe, it, expect } from 'vitest';
import { describeWidgetType, getSupportedWidgetTypes, getWidgetSources } from '../widget-schemas.js';

describe('describeWidgetType', () => {
  it('returns supported for core heading widget', () => {
    const result = describeWidgetType('heading');
    expect(result.status).toBe('supported');
    expect(result.schema).toBeDefined();
    expect(result.schema!.widget_type).toBe('heading');
    expect(result.schema!.source).toBe('core');
    expect(result.schema!.text_fields).toContain('title');
    expect(result.schema!.link_fields).toContain('link');
  });

  it('returns supported for text-editor', () => {
    const result = describeWidgetType('text-editor');
    expect(result.status).toBe('supported');
    expect(result.schema!.text_fields).toContain('editor');
  });

  it('returns supported for button', () => {
    const result = describeWidgetType('button');
    expect(result.status).toBe('supported');
    expect(result.schema!.text_fields).toContain('text');
    expect(result.schema!.link_fields).toContain('link');
  });

  it('returns supported for image', () => {
    const result = describeWidgetType('image');
    expect(result.status).toBe('supported');
    expect(result.schema!.media_fields).toContain('image');
    expect(result.schema!.text_fields).toContain('caption');
  });

  it('returns supported for icon-box', () => {
    const result = describeWidgetType('icon-box');
    expect(result.status).toBe('supported');
    expect(result.schema!.text_fields).toContain('title_text');
    expect(result.schema!.text_fields).toContain('description_text');
  });

  it('covers essential addons widgets', () => {
    const eaResult = describeWidgetType('eael-cta-box');
    expect(eaResult.status).toBe('supported');
    expect(eaResult.schema!.source).toBe('essential-addons');
    expect(eaResult.schema!.text_fields.length).toBeGreaterThan(0);

    const advHeading = describeWidgetType('eael-advanced-heading');
    expect(advHeading.status).toBe('supported');
    expect(advHeading.schema!.source).toBe('essential-addons');
  });

  it('covers ultimate addons widgets', () => {
    const uaeResult = describeWidgetType('uael-faq');
    expect(uaeResult.status).toBe('supported');
    expect(uaeResult.schema!.source).toBe('ultimate-addons');
    expect(uaeResult.schema!.text_fields).toContain('question');

    const advHeading = describeWidgetType('uael-advanced-heading');
    expect(advHeading.status).toBe('supported');
    expect(advHeading.schema!.source).toBe('ultimate-addons');
  });

  it('returns unsupported for unknown widget type', () => {
    const result = describeWidgetType('completely-unknown-widget-xyz');
    expect(result.status).toBe('unsupported');
    expect(result.hint).toBeDefined();
    expect(result.hint).toContain('not yet instrumented');
    expect(result.supported_types).toBeDefined();
    expect(result.supported_types!.length).toBeGreaterThan(0);
  });

  it('unsupported result includes available widget types', () => {
    const result = describeWidgetType('foobar-widget');
    expect(result.status).toBe('unsupported');
    expect(result.supported_types).toContain('heading');
    expect(result.supported_types).toContain('button');
    expect(result.supported_types).toContain('text-editor');
  });

  it('case-insensitive matching', () => {
    const result = describeWidgetType('HEADING');
    expect(result.status).toBe('supported');
    expect(result.schema!.widget_type).toBe('heading');
  });

  it('all core widgets have required text fields when applicable', () => {
    for (const type of getSupportedWidgetTypes()) {
      const result = describeWidgetType(type);
      if (result.status === 'supported' && result.schema) {
        expect(result.schema.widget_type.length).toBeGreaterThan(0);
        expect(result.schema.source).toBeDefined();
        expect(result.schema.controls).toBeDefined();
      }
    }
  });

  it('getSupportedWidgetTypes returns all schemas', () => {
    const types = getSupportedWidgetTypes();
    expect(types).toContain('heading');
    expect(types).toContain('button');
    expect(types).toContain('eael-cta-box');
    expect(types).toContain('uael-faq');
  });

  it('getWidgetSources reports coverage', () => {
    const sources = getWidgetSources();
    expect(sources.core).toBeGreaterThan(0);
    expect(sources['essential-addons']).toBeGreaterThan(0);
    expect(sources['ultimate-addons']).toBeGreaterThan(0);
  });
});
