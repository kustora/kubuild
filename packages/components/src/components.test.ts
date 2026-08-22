import { describe, it, expect } from 'vitest';
import { createDefaultComponentRegistry, ComponentRegistry } from './index';

describe('ComponentRegistry', () => {
  it('registers and retrieves core components', () => {
    const registry = createDefaultComponentRegistry();
    expect(registry.has('page')).toBe(true);
    expect(registry.has('heading')).toBe(true);
    expect(registry.has('button')).toBe(true);

    const buttonDef = registry.get('button');
    expect(buttonDef?.label).toBe('Button');
    expect(buttonDef?.acceptsChildren).toBe(false);
  });

  it('validates node structure against component policy', () => {
    const registry = createDefaultComponentRegistry();

    // Valid button
    const validBtn = { id: 'btn-1', type: 'button', props: { label: 'Click' }, children: [] };
    const validResult = registry.validateNode(validBtn);
    expect(validResult.valid).toBe(true);

    // Invalid button with children (acceptsChildren: false)
    const invalidBtn = {
      id: 'btn-2',
      type: 'button',
      children: [{ id: 'child-1', type: 'text' }],
    };
    const invalidResult = registry.validateNode(invalidBtn);
    expect(invalidResult.valid).toBe(false);
    expect(invalidResult.errors[0]).toContain('does not accept children');
  });

  it('supports custom component registration', () => {
    const registry = new ComponentRegistry();
    registry.register({
      type: 'custom.card',
      label: 'Card',
      category: 'custom',
      acceptsChildren: true,
    });

    expect(registry.has('custom.card')).toBe(true);
    expect(registry.listByCategory('custom').length).toBe(1);
  });
});

describe('STORA-020: Component Registry Contract', () => {
  describe('Acceptance Criteria 1: typed register/get/list/unregister API', () => {
    it('list() and listByCategory() reflect registered definitions', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });
      registry.register({ type: 'b', label: 'B', category: 'layout' });

      expect(registry.list().map((d) => d.type).sort()).toEqual(['a', 'b']);
      expect(registry.listByCategory('custom').map((d) => d.type)).toEqual(['a']);
    });

    it('unregister() removes a type and returns false for an unknown type', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });

      expect(registry.unregister('a')).toBe(true);
      expect(registry.has('a')).toBe(false);
      expect(registry.unregister('does-not-exist')).toBe(false);
    });
  });

  describe('Acceptance Criteria 2: duplicate type rejected unless explicit replace mode', () => {
    it('throws when registering an existing type without allowOverride', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });

      expect(() => registry.register({ type: 'a', label: 'A2', category: 'custom' })).toThrow(
        /already registered/,
      );
      expect(registry.get('a')?.label).toBe('A');
    });

    it('replaces the stored definition when allowOverride is true', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });
      registry.register({ type: 'a', label: 'A2', category: 'layout' }, true);

      expect(registry.get('a')?.label).toBe('A2');
      expect(registry.get('a')?.category).toBe('layout');
    });
  });

  describe('Acceptance Criteria 3: registry validates props and child component limits', () => {
    it('rejects a child whose type is not in allowedChildren', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'parent', label: 'Parent', category: 'custom', acceptsChildren: true, allowedChildren: ['allowed-child'] });
      registry.register({ type: 'allowed-child', label: 'Allowed', category: 'custom' });
      registry.register({ type: 'other-child', label: 'Other', category: 'custom' });

      const node = {
        id: 'p1',
        type: 'parent',
        children: [{ id: 'c1', type: 'other-child' }],
      };
      const result = registry.validateNode(node);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('does not allow child type "other-child"');
    });

    it('allows a child type explicitly present in allowedChildren', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'parent', label: 'Parent', category: 'custom', acceptsChildren: true, allowedChildren: ['allowed-child'] });
      registry.register({ type: 'allowed-child', label: 'Allowed', category: 'custom' });

      const node = {
        id: 'p1',
        type: 'parent',
        children: [{ id: 'c1', type: 'allowed-child' }],
      };
      expect(registry.validateNode(node).valid).toBe(true);
    });

    it('rejects a node placed under a disallowed parent type when parentType is supplied', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'child', label: 'Child', category: 'custom', disallowedParents: ['forbidden-parent'] });

      const node = { id: 'c1', type: 'child' };
      const result = registry.validateNode(node, 'forbidden-parent');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('not allowed inside parent "forbidden-parent"');

      expect(registry.validateNode(node, 'other-parent').valid).toBe(true);
      expect(registry.validateNode(node).valid).toBe(true);
    });

    it('surfaces validateProps error messages via validateNode', () => {
      const registry = new ComponentRegistry();
      registry.register({
        type: 'strict',
        label: 'Strict',
        category: 'custom',
        validateProps: (props) => (typeof props.title === 'string' ? true : ['title must be a string']),
      });

      expect(registry.validateNode({ id: 's1', type: 'strict', props: { title: 'ok' } }).valid).toBe(true);
      const invalid = registry.validateNode({ id: 's2', type: 'strict', props: {} });
      expect(invalid.valid).toBe(false);
      expect(invalid.errors).toContain('title must be a string');
    });
  });

  describe('Acceptance Criteria 4: renderer contract slot stays framework-agnostic', () => {
    it('round-trips an arbitrary renderer value through register/get without interpretation', () => {
      const registry = new ComponentRegistry<() => string>();
      const renderer = () => 'rendered';
      registry.register({ type: 'a', label: 'A', category: 'custom', renderer });

      expect(registry.get('a')?.renderer).toBe(renderer);
      expect(registry.get('a')?.renderer?.()).toBe('rendered');
    });

    it('defaults renderer to unknown and leaves it undefined when omitted', () => {
      const registry = new ComponentRegistry();
      registry.register({ type: 'a', label: 'A', category: 'custom' });
      expect(registry.get('a')?.renderer).toBeUndefined();
    });
  });
});
