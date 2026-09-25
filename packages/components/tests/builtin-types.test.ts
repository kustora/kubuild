import { describe, it, expect } from 'vitest';
import { BUILTIN_COMPONENT_TYPES, starterPageFixture } from '@kubuild/schema';
import { CORE_BUILTIN_COMPONENTS, extractTemplateRequirements } from '@kubuild/core';
import { createDefaultComponentRegistry, type CoreComponentType } from '../src/index';

/**
 * STORA-553: the built-in type list core uses for template requirements must be the
 * exact set of types the default component registry registers.
 */
describe('STORA-553: built-in component type list stays in sync with the default registry', () => {
  const registryTypes = createDefaultComponentRegistry()
    .list()
    .map((def) => def.type)
    .sort();

  it('BUILTIN_COMPONENT_TYPES (schema) equals the default registry types', () => {
    expect([...BUILTIN_COMPONENT_TYPES].sort()).toEqual(registryTypes);
  });

  it('CORE_BUILTIN_COMPONENTS (core) equals the default registry types', () => {
    expect([...CORE_BUILTIN_COMPONENTS].sort()).toEqual(registryTypes);
    expect(CORE_BUILTIN_COMPONENTS.has('column')).toBe(false);
  });

  it('CoreComponentType accepts every built-in type', () => {
    const typed: CoreComponentType[] = [...BUILTIN_COMPONENT_TYPES];
    expect(typed.length).toBe(registryTypes.length);
  });

  it('extractTemplateRequirements treats every registry type as built-in', () => {
    const doc = {
      ...starterPageFixture,
      document: {
        ...starterPageFixture.document,
        children: registryTypes
          .filter((type) => type !== 'page')
          .map((type, i) => ({ id: `n_${i}`, type, props: {}, styles: {}, children: [] }))
          .concat([{ id: 'custom_1', type: 'pricing-table', props: {}, styles: {}, children: [] }]),
      },
    };
    expect(extractTemplateRequirements(doc).requiredComponents).toEqual(['pricing-table']);
  });
});
