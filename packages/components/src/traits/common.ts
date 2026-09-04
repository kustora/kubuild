import { ComponentTraitDefinition, withOverrides } from './types';

/** `id` — a custom, document-unique identifier for the element. */
export function idTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'id',
      label: 'Element ID',
      type: 'string',
      attribute: 'id',
      group: 'identity',
      description: 'A custom, document-unique identifier used for anchors, CSS, and scripting.',
    },
    overrides,
  );
}

/** `title` — advisory title shown on hover / used as a fallback label. */
export function titleTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'title',
      label: 'Title',
      type: 'string',
      attribute: 'title',
      group: 'semantic',
      description: 'Advisory title for the element (tooltip / document title).',
    },
    overrides,
  );
}

/** `aria-label` — accessible name for elements without visible text. */
export function ariaLabelTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'ariaLabel',
      label: 'Accessible Label (aria-label)',
      type: 'string',
      attribute: 'aria-label',
      group: 'accessibility',
      description: 'Accessible name for assistive technology when no visible label exists.',
    },
    overrides,
  );
}

