/**
 * Trait metadata (STORA-210).
 *
 * A **trait** is a *functional* prop — it carries behavior, semantics, or
 * identity rather than pure visual styling. Examples: `href`, `target`, `alt`,
 * `title`, `placeholder`, `aria-label`, and a custom `id`.
 *
 * Traits are deliberately separated from styling concerns:
 * - Styling lives in `defaultStyles` (a `ResponsiveStyles` object) and is
 *   applied via the style abstraction, never as raw HTML attributes.
 * - Traits describe the *semantic/behavioral* surface of a component and map
 *   to real HTML attributes at render time (see `attribute`).
 *
 * This module defines the trait metadata shape plus a set of reusable trait
 * factories so every component definition can declare its traits with clear
 * data types and default values — satisfying STORA-210's acceptance criteria.
 */

/** The primitive data types a trait value can take. */
export type TraitType = 'string' | 'number' | 'boolean' | 'select';

/** A constrained choice for `select`-typed traits. */
export interface TraitOption {
  label: string;
  value: unknown;
}

/**
 * Logical grouping used to organize traits in an inspector UI. Kept as a
 * closed union so hosts can render a stable, ordered set of trait sections.
 */
export type TraitGroup =
  | 'link'
  | 'media'
  | 'form'
  | 'accessibility'
  | 'identity'
  | 'behavior'
  | 'semantic';

/** Ordered display order for trait groups in an inspector. */
export const TRAIT_GROUP_ORDER: TraitGroup[] = [
  'identity',
  'link',
  'media',
  'form',
  'behavior',
  'semantic',
  'accessibility',
];

/** Human-readable labels for each trait group. */
export const TRAIT_GROUP_LABELS: Record<TraitGroup, string> = {
  identity: 'Identity',
  link: 'Link',
  media: 'Media',
  form: 'Form',
  behavior: 'Behavior',
  semantic: 'Semantic',
  accessibility: 'Accessibility',
};

/**
 * Metadata describing a single functional trait on a component.
 *
 * `name` is the prop key on the node's `props` object; `attribute` is the HTML
 * attribute it maps to at render time (when they differ, e.g. `name` → `id`).
 */
export interface ComponentTraitDefinition {
  /** Prop key on the node's `props` object (e.g. `'href'`, `'alt'`). */
  name: string;
  /** Human-readable label shown in the inspector. */
  label: string;
  /** Data type of the trait value. */
  type: TraitType;
  /** Default value applied when the trait is not set. */
  defaultValue?: unknown;
  /** Constrained choices for `select`-typed traits. */
  options?: TraitOption[];
  /** Short description of the trait's purpose. */
  description?: string;
  /** The HTML attribute this trait maps to at render time (e.g. `'href'`). */
  attribute?: string;
  /** Whether the trait must be present for the component to be valid. */
  required?: boolean;
  /** Logical grouping for inspector organization. */
  group?: TraitGroup;
}

/** Convenience alias for a list of trait definitions. */
export type ComponentTraits = ComponentTraitDefinition[];

/**
 * Merge helper: applies partial overrides on top of a base trait definition.
 * Used by the factories below so callers can tweak label/default/group without
 * repeating the full shape.
 */
function withOverrides(
  base: ComponentTraitDefinition,
  overrides?: Partial<ComponentTraitDefinition>,
): ComponentTraitDefinition {
  return overrides ? { ...base, ...overrides } : base;
}

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

/** `alt` — alternative text for media, required for accessibility. */
export function altTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'alt',
      label: 'Alt Text',
      type: 'string',
      attribute: 'alt',
      group: 'accessibility',
      required: true,
      description: 'Alternative text describing the media for screen readers and fallback.',
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

/** `placeholder` — hint text shown inside an empty form control. */
export function placeholderTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'placeholder',
      label: 'Placeholder',
      type: 'string',
      attribute: 'placeholder',
      group: 'form',
      description: 'Hint text shown inside the control when it is empty.',
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

/** `name` — the form field name submitted with the form data. */
export function fieldNameTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'name',
      label: 'Field Name',
      type: 'string',
      attribute: 'name',
      group: 'form',
      required: true,
      description: 'The name submitted with the form data for this field.',
    },
    overrides,
  );
}

/** `required` — whether the form field must be filled before submission. */
export function requiredTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'required',
      label: 'Required',
      type: 'boolean',
      defaultValue: false,
      attribute: 'required',
      group: 'form',
      description: 'Whether the field must be filled before the form can be submitted.',
    },
    overrides,
  );
}

/** `disabled` — whether the control is non-interactive. */
export function disabledTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'disabled',
      label: 'Disabled',
      type: 'boolean',
      defaultValue: false,
      attribute: 'disabled',
      group: 'behavior',
      description: 'Disables the control so it cannot be focused or activated.',
    },
    overrides,
  );
}

/** `readOnly` — whether the control value can be changed by the user. */
export function readOnlyTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'readOnly',
      label: 'Read Only',
      type: 'boolean',
      defaultValue: false,
      attribute: 'readonly',
      group: 'behavior',
      description: 'Prevents the user from modifying the control value.',
    },
    overrides,
  );
}

/** `src` — the source URL for media (image, video). */
export function srcTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'src',
      label: 'Source URL',
      type: 'string',
      attribute: 'src',
      group: 'media',
      required: true,
      description: 'The source URL of the media resource.',
    },
    overrides,
  );
}

/** `poster` — a preview image shown before a video plays. */
export function posterTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'poster',
      label: 'Poster Image URL',
      type: 'string',
      attribute: 'poster',
      group: 'media',
      description: 'A preview image shown before the video starts playing.',
    },
    overrides,
  );
}

/** `controls` — whether native media controls are shown. */
export function controlsTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'controls',
      label: 'Show Controls',
      type: 'boolean',
      defaultValue: true,
      attribute: 'controls',
      group: 'media',
      description: 'Whether to show the native play/pause/volume controls.',
    },
    overrides,
  );
}

/** `autoplay` — whether media starts playing automatically. */
export function autoplayTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'autoplay',
      label: 'Autoplay',
      type: 'boolean',
      defaultValue: false,
      attribute: 'autoplay',
      group: 'media',
      description: 'Whether the media starts playing automatically on load.',
    },
    overrides,
  );
}

/** `loop` — whether media restarts from the beginning when it ends. */
export function loopTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'loop',
      label: 'Loop',
      type: 'boolean',
      defaultValue: false,
      attribute: 'loop',
      group: 'media',
      description: 'Whether the media restarts automatically when it reaches the end.',
    },
    overrides,
  );
}

/** `muted` — whether media starts with sound muted. */
export function mutedTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'muted',
      label: 'Muted',
      type: 'boolean',
      defaultValue: false,
      attribute: 'muted',
      group: 'media',
      description: 'Whether the media starts with the audio muted.',
    },
    overrides,
  );
}

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

/** `action` — the URL a form submits to. */
export function actionTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'action',
      label: 'Action URL',
      type: 'string',
      attribute: 'action',
      group: 'form',
      description: 'The URL the form data is submitted to.',
    },
    overrides,
  );
}

/** `method` — the HTTP method a form uses to submit. */
export function methodTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'method',
      label: 'Method',
      type: 'select',
      defaultValue: 'POST',
      attribute: 'method',
      group: 'form',
      options: [
        { label: 'POST', value: 'POST' },
        { label: 'GET', value: 'GET' },
      ],
      description: 'The HTTP method used to submit the form.',
    },
    overrides,
  );
}

/** `autoComplete` — whether the browser may autofill the form. */
export function autoCompleteTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'autoComplete',
      label: 'Auto Complete',
      type: 'select',
      defaultValue: 'on',
      attribute: 'autocomplete',
      group: 'form',
      options: [
        { label: 'On', value: 'on' },
        { label: 'Off', value: 'off' },
      ],
      description: 'Whether the browser may autofill values for this form.',
    },
    overrides,
  );
}

/** `value` — the value submitted for a checkbox/radio when checked. */
export function valueTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'value',
      label: 'Value',
      type: 'string',
      attribute: 'value',
      group: 'form',
      description: 'The value submitted with the form data when the control is selected.',
    },
    overrides,
  );
}

/** `defaultChecked` — whether a checkbox/radio starts checked. */
export function defaultCheckedTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'defaultChecked',
      label: 'Default Checked',
      type: 'boolean',
      defaultValue: false,
      attribute: 'checked',
      group: 'form',
      description: 'Whether the control starts in the checked state.',
    },
    overrides,
  );
}

/** `defaultValue` — the initial value of a form control. */
export function defaultValueTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'defaultValue',
      label: 'Default Value',
      type: 'string',
      attribute: 'value',
      group: 'form',
      description: 'The initial value of the control before the user edits it.',
    },
    overrides,
  );
}

/** `rows` — the visible number of lines in a textarea. */
export function rowsTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'rows',
      label: 'Rows',
      type: 'number',
      defaultValue: 4,
      attribute: 'rows',
      group: 'form',
      description: 'The number of visible text lines in the textarea.',
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

/** `type` — the input type of a form control (text, email, number, ...). */
export function inputTypeTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'type',
      label: 'Input Type',
      type: 'select',
      defaultValue: 'text',
      attribute: 'type',
      group: 'form',
      description: 'The semantic input type of the control.',
    },
    overrides,
  );
}

/** `buttonType` — the button's form behavior (`button`, `submit`, `reset`). */
export function buttonTypeTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'buttonType',
      label: 'Button Type',
      type: 'select',
      defaultValue: 'button',
      attribute: 'type',
      group: 'form',
      options: [
        { label: 'Button', value: 'button' },
        { label: 'Submit Form (submit)', value: 'submit' },
        { label: 'Reset Form (reset)', value: 'reset' },
      ],
      description: 'The button’s behavior inside a form.',
    },
    overrides,
  );
}

/**
 * Sort a component's traits into a stable, inspector-friendly order:
 * identity first, then the remaining groups in `TRAIT_GROUP_ORDER`, with
 * ungrouped traits last. Preserves relative order within each group.
 */
export function sortTraits(traits: ComponentTraits): ComponentTraits {
  const groupRank = (group?: TraitGroup): number => {
    if (!group) return Number.MAX_SAFE_INTEGER;
    const idx = TRAIT_GROUP_ORDER.indexOf(group);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...traits].sort((a, b) => groupRank(a.group) - groupRank(b.group));
}

/**
 * Collect the union of all trait names declared across a set of component
 * definitions. Useful for building a global trait catalog / search index.
 */
export function collectTraitNames(traitsList: ComponentTraits[]): string[] {
  const names = new Set<string>();
  for (const traits of traitsList) {
    for (const trait of traits) {
      names.add(trait.name);
    }
  }
  return Array.from(names);
}
