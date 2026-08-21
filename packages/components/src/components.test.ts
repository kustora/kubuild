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
