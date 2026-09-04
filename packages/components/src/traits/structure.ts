import { ComponentTraitDefinition, withOverrides } from './types';

/** `cite` — the source URL for a blockquote. */
export function citeTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'cite',
      label: 'Citation URL (cite)',
      type: 'string',
      attribute: 'cite',
      group: 'semantic',
      description: 'The URL of the source document the quote is taken from.',
    },
    overrides,
  );
}

/** `colSpan` — the number of columns a table cell spans. */
export function colSpanTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'colSpan',
      label: 'Column Span (colSpan)',
      type: 'number',
      defaultValue: 1,
      attribute: 'colspan',
      group: 'semantic',
      description: 'The number of columns the cell spans.',
    },
    overrides,
  );
}

/** `rowSpan` — the number of rows a table cell spans. */
export function rowSpanTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'rowSpan',
      label: 'Row Span (rowSpan)',
      type: 'number',
      defaultValue: 1,
      attribute: 'rowspan',
      group: 'semantic',
      description: 'The number of rows the cell spans.',
    },
    overrides,
  );
}

/** `tag` — the semantic HTML tag a component renders as (e.g. `ul`/`ol`, `td`/`th`). */
export function tagTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'tag',
      label: 'HTML Tag',
      type: 'select',
      attribute: 'tag',
      group: 'semantic',
      description: 'The semantic HTML tag the component renders as.',
    },
    overrides,
  );
}

