import { describe, it, expect } from 'vitest';
import {
  compileComponentCatalog,
  buildSystemPrompt,
  buildJsonSchemaForMode,
} from '../src/core/prompt-compiler';
import type { ComponentRegistryLike } from '../src/types';

describe('prompt-compiler', () => {
  it('compiles an empty registry gracefully', () => {
    const catalog = compileComponentCatalog(undefined);
    expect(catalog).toEqual([]);
  });

  it('compiles component specifications from registry', () => {
    const mockRegistry: ComponentRegistryLike = {
      list: () => [
        {
          type: 'section',
          label: 'Section',
          category: 'layout',
          acceptsChildren: true,
          allowedChildren: ['container', 'columns'],
          defaultProps: {},
        },
        {
          type: 'button',
          label: 'Button',
          category: 'interactive',
          acceptsChildren: false,
          propFields: [
            { name: 'label', type: 'string', defaultValue: 'Click Me' },
            {
              name: 'variant',
              type: 'select',
              options: [
                { label: 'Primary', value: 'primary' },
                { label: 'Secondary', value: 'secondary' },
              ],
            },
          ],
        },
      ],
    };

    const catalog = compileComponentCatalog(mockRegistry);
    expect(catalog).toHaveLength(2);
    expect(catalog[0].type).toBe('section');
    expect(catalog[0].acceptsChildren).toBe(true);
    expect(catalog[0].allowedChildren).toEqual(['container', 'columns']);

    expect(catalog[1].type).toBe('button');
    expect(catalog[1].acceptsChildren).toBe(false);
    expect(catalog[1].props).toBeDefined();
    expect(catalog[1].props?.[0].name).toBe('label');
    expect(catalog[1].props?.[1].options).toEqual(['primary', 'secondary']);
  });

  it('builds system prompt with catalog and custom style preference', () => {
    const catalog = compileComponentCatalog({
      list: () => [
        {
          type: 'heading',
          label: 'Heading',
          category: 'typography',
          acceptsChildren: false,
          propFields: [{ name: 'text', type: 'string' }],
        },
      ],
    });

    const prompt = buildSystemPrompt({
      catalog,
      mode: 'full-page',
      prefix: 'Kustora Production Rules',
      stylePreference: 'minimal dark theme',
    });

    expect(prompt).toContain('Kustora Production Rules');
    expect(prompt).toContain('minimal dark theme');
    expect(prompt).toContain('**heading** (typography)');
    expect(prompt).toContain('stora.page');
  });

  it('builds json schema for full-page, section, and refactor modes', () => {
    const pageSchema = buildJsonSchemaForMode('full-page');
    expect(pageSchema.required).toContain('schema');
    expect(pageSchema.required).toContain('document');

    const sectionSchema = buildJsonSchemaForMode('section');
    expect(sectionSchema.required).toContain('id');
    expect(sectionSchema.required).toContain('type');
  });
});
