import { describe, it, expect } from 'vitest';
import {
  createDefaultComponentRegistry,
  headingDefinition,
  textDefinition,
  paragraphDefinition,
  linkDefinition,
  blockquoteDefinition,
  badgeDefinition,
  codeBlockDefinition,
  listDefinition,
  listItemDefinition,
} from '../src/index';

describe('Typography Components (heading, text)', () => {
  describe('heading', () => {
    it('is valid with a non-empty text and level in range', () => {
      expect(headingDefinition.validateProps?.({ text: 'Hi', level: 3 })).toBe(true);
    });

    it('is valid with a variable binding for text (STORA-051: bindable props)', () => {
      expect(headingDefinition.validateProps?.({ text: { type: 'variable', key: 'site.name' }, level: 2 })).toBe(
        true,
      );
    });

    it('rejects empty text', () => {
      const result = headingDefinition.validateProps?.({ text: '' });
      expect(Array.isArray(result)).toBe(true);
      expect((result as string[])[0]).toContain('non-empty "text"');
    });

    it('rejects an out-of-range level', () => {
      const result = headingDefinition.validateProps?.({ text: 'Hi', level: 9 });
      expect((result as string[])[0]).toContain('level');
    });
  });

  describe('text', () => {
    it('is valid with non-empty content', () => {
      expect(textDefinition.validateProps?.({ content: 'Hello' })).toBe(true);
    });

    it('is valid with a variable binding for content (STORA-051: bindable props)', () => {
      expect(textDefinition.validateProps?.({ content: { type: 'variable', key: 'tagline' } })).toBe(true);
    });

    it('rejects missing content', () => {
      expect(textDefinition.validateProps?.({})).toEqual(['Text requires a non-empty "content".']);
    });
  });

  it('registry.validateNode reports content-component prop errors end to end', () => {
    const registry = createDefaultComponentRegistry();
    const invalidHeading = { id: 'h1', type: 'heading', props: { text: '' } };
    const result = registry.validateNode(invalidHeading);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('non-empty "text"');
  });
});

describe('STORA-190: list and list-item definitions', () => {
  it('registers list and list-item in default component registry', () => {
    const registry = createDefaultComponentRegistry();
    expect(registry.has('list')).toBe(true);
    expect(registry.has('list-item')).toBe(true);

    const listDef = registry.get('list');
    expect(listDef?.category).toBe('typography');
    expect(listDef?.acceptsChildren).toBe(true);
    expect(listDef?.allowedChildren).toEqual(['list-item']);

    const listItemDef = registry.get('list-item');
    expect(listItemDef?.category).toBe('typography');
    expect(listItemDef?.acceptsChildren).toBe(true);
  });

  it('validates list props (tag and listStyleType)', () => {
    expect(listDefinition.validateProps?.({ tag: 'ul', listStyleType: 'disc' })).toBe(true);
    expect(listDefinition.validateProps?.({ tag: 'ol', listStyleType: 'decimal' })).toBe(true);
    expect(listDefinition.validateProps?.({ tag: 'ul', listStyleType: 'custom-icon' })).toBe(true);

    const invalidTag = listDefinition.validateProps?.({ tag: 'div' });
    expect(Array.isArray(invalidTag)).toBe(true);
    expect((invalidTag as string[])[0]).toContain('must be either "ul" or "ol"');

    const invalidStyle = listDefinition.validateProps?.({ listStyleType: 'invalid-style' });
    expect(Array.isArray(invalidStyle)).toBe(true);
    expect((invalidStyle as string[])[0]).toContain('must be one of:');
  });

  it('validates list-item props', () => {
    expect(listItemDefinition.validateProps?.({ text: 'Valid item' })).toBe(true);
    expect(listItemDefinition.validateProps?.({ text: { type: 'variable', key: 'item.name' } })).toBe(true);

    const invalidText = listItemDefinition.validateProps?.({ text: 123 });
    expect(Array.isArray(invalidText)).toBe(true);
    expect((invalidText as string[])[0]).toContain('must be a string');
  });

  it('enforces parent-child hierarchy between list and list-item', () => {
    const registry = createDefaultComponentRegistry();

    // Section allows list
    const sectionCanInsertList = registry.canInsertChild('section', 'list');
    expect(sectionCanInsertList.valid).toBe(true);

    // List allows list-item
    const listCanInsertItem = registry.canInsertChild('list', 'list-item');
    expect(listCanInsertItem.valid).toBe(true);

    // List does not allow button directly
    const listCanInsertBtn = registry.canInsertChild('list', 'button');
    expect(listCanInsertBtn.valid).toBe(false);

    // List-item allows button or heading or text
    expect(registry.canInsertChild('list-item', 'button').valid).toBe(true);
    expect(registry.canInsertChild('list-item', 'heading').valid).toBe(true);
    expect(registry.canInsertChild('list-item', 'text').valid).toBe(true);
    expect(registry.canInsertChild('list-item', 'list').valid).toBe(true);
  });
});

describe('STORA-192: Core Semantic Typography Components', () => {
  it('registers all typography components in default registry', () => {
    const registry = createDefaultComponentRegistry();
    const typographyTypes = ['paragraph', 'link', 'blockquote', 'badge', 'code-block'];

    for (const type of typographyTypes) {
      expect(registry.has(type)).toBe(true);
      const def = registry.get(type);
      expect(def).toBeDefined();
      expect(def?.category).toBe('typography');
    }
  });

  it('validates paragraph definition and props', () => {
    expect(paragraphDefinition.type).toBe('paragraph');
    expect(paragraphDefinition.acceptsChildren).toBe(false);
    expect(paragraphDefinition.defaultProps?.text).toBeDefined();
    expect(paragraphDefinition.validateProps?.({ text: 'Valid paragraph' })).toBe(true);
    expect(paragraphDefinition.validateProps?.({ content: 'Alternative prop' })).toBe(true);

    const invalid = paragraphDefinition.validateProps?.({ text: '   ' });
    expect(Array.isArray(invalid)).toBe(true);
    expect((invalid as string[])[0]).toContain('Paragraph requires a non-empty "text"');
  });

  it('validates link definition and props', () => {
    expect(linkDefinition.type).toBe('link');
    expect(linkDefinition.acceptsChildren).toBe(false);
    expect(linkDefinition.validateProps?.({ text: 'Link text', href: 'https://example.com', target: '_blank', rel: 'noopener' })).toBe(true);

    const invalidTarget = linkDefinition.validateProps?.({ text: 'Link', target: '_invalid' });
    expect(Array.isArray(invalidTarget)).toBe(true);
    expect((invalidTarget as string[])[0]).toContain('Link "target" must be one of');

    const emptyText = linkDefinition.validateProps?.({ text: '' });
    expect(Array.isArray(emptyText)).toBe(true);
    expect((emptyText as string[])[0]).toContain('Link requires a non-empty "text"');
  });

  it('validates blockquote definition and props', () => {
    expect(blockquoteDefinition.type).toBe('blockquote');
    expect(blockquoteDefinition.acceptsChildren).toBe(true);
    expect(blockquoteDefinition.allowedChildren).toContain('paragraph');
    expect(blockquoteDefinition.validateProps?.({ text: 'A quote', cite: 'https://source.org' })).toBe(true);

    const invalidText = blockquoteDefinition.validateProps?.({ text: 123 as unknown as string });
    expect(Array.isArray(invalidText)).toBe(true);
    expect((invalidText as string[])[0]).toContain('Blockquote "text" must be a string');
  });

  it('validates badge definition and props', () => {
    expect(badgeDefinition.type).toBe('badge');
    expect(badgeDefinition.acceptsChildren).toBe(false);
    expect(badgeDefinition.validateProps?.({ text: 'New', variant: 'success' })).toBe(true);

    const emptyBadge = badgeDefinition.validateProps?.({ text: '  ' });
    expect(Array.isArray(emptyBadge)).toBe(true);
    expect((emptyBadge as string[])[0]).toContain('Badge requires a non-empty "text"');
  });

  it('validates code-block definition and props', () => {
    expect(codeBlockDefinition.type).toBe('code-block');
    expect(codeBlockDefinition.acceptsChildren).toBe(false);
    expect(codeBlockDefinition.validateProps?.({ code: 'const x = 1;', language: 'typescript' })).toBe(true);

    const invalidCode = codeBlockDefinition.validateProps?.({ code: 123 as unknown as string });
    expect(Array.isArray(invalidCode)).toBe(true);
    expect((invalidCode as string[])[0]).toContain('Code Block "code" must be a string');
  });

  it('allows typography components inside container, section, columns, list-item, and table-cell', () => {
    const registry = createDefaultComponentRegistry();
    const parents = ['section', 'container', 'columns', 'list-item', 'table-cell'];
    const types = ['paragraph', 'link', 'blockquote', 'badge', 'code-block'];

    for (const parent of parents) {
      for (const child of types) {
        const canInsert = registry.canInsertChild(parent, child);
        expect(canInsert.valid, `Expected ${child} to be insertable inside ${parent}`).toBe(true);
      }
    }
  });
});

