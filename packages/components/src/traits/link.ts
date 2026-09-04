import { ComponentTraitDefinition, withOverrides } from './types';

/** `href` — the destination URL for links, buttons, and form actions. */
export function hrefTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'href',
      label: 'Link URL',
      type: 'string',
      defaultValue: '#',
      attribute: 'href',
      group: 'link',
      description: 'The destination URL the element navigates to when activated.',
    },
    overrides,
  );
}

/** `target` — where the linked resource opens (`_self`, `_blank`, ...). */
export function targetTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'target',
      label: 'Open In',
      type: 'select',
      defaultValue: '_self',
      attribute: 'target',
      group: 'link',
      options: [
        { label: 'Same tab (_self)', value: '_self' },
        { label: 'New tab (_blank)', value: '_blank' },
        { label: 'Parent frame (_parent)', value: '_parent' },
        { label: 'Top frame (_top)', value: '_top' },
      ],
      description: 'Where the linked resource should open.',
    },
    overrides,
  );
}

/** `rel` — relationship between the current document and the linked resource. */
export function relTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'rel',
      label: 'Relationship (rel)',
      type: 'string',
      defaultValue: '',
      attribute: 'rel',
      group: 'link',
      description: 'Space-separated relationship tokens (e.g. "noopener noreferrer").',
    },
    overrides,
  );
}

