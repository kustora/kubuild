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

/** `loading` — native lazy/eager loading hint for images (STORA-213). */
export function loadingTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'loading',
      label: 'Loading Mode',
      type: 'select',
      defaultValue: 'lazy',
      attribute: 'loading',
      group: 'media',
      options: [
        { label: 'Lazy (load when near viewport)', value: 'lazy' },
        { label: 'Eager (load immediately)', value: 'eager' },
      ],
      description: 'Native loading hint: lazy defers offscreen images, eager loads immediately.',
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

// ---------------------------------------------------------------------------
// STORA-330 — Form Behavior Traits
// ---------------------------------------------------------------------------

/** `preventDefault` — whether the form intercepts the native submit and handles it in JS. */
export function preventDefaultTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'preventDefault',
      label: 'Prevent Default',
      type: 'boolean',
      defaultValue: true,
      group: 'form',
      description: 'Intercept the native browser submit and handle it via the KUBUILD action pipeline instead.',
    },
    overrides,
  );
}

/** `scrollToFirstError` — whether the form auto-scrolls to the first invalid field on submit. */
export function scrollToFirstErrorTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'scrollToFirstError',
      label: 'Scroll to First Error',
      type: 'boolean',
      defaultValue: true,
      group: 'form',
      description: 'Automatically scroll to and focus the first invalid field when submission fails validation.',
    },
    overrides,
  );
}

/** `resetOnSubmit` — whether the form resets all fields to their initial values after a successful submit. */
export function resetOnSubmitTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'resetOnSubmit',
      label: 'Reset on Submit',
      type: 'boolean',
      defaultValue: false,
      group: 'form',
      description: 'Reset all fields to their initial values after a successful form submission.',
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// STORA-331 — Rich Input Traits
// ---------------------------------------------------------------------------

/** `pattern` — a regex the field value must match for the input to be valid. */
export function patternTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'pattern',
      label: 'Pattern (regex)',
      type: 'string',
      attribute: 'pattern',
      group: 'form',
      description: 'A regular expression the input value must match to pass validation.',
    },
    overrides,
  );
}

/** `minLength` — the minimum number of characters required. */
export function minLengthTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'minLength',
      label: 'Min Length',
      type: 'number',
      attribute: 'minlength',
      group: 'form',
      description: 'The minimum number of characters the user must enter.',
    },
    overrides,
  );
}

/** `maxLength` — the maximum number of characters allowed. */
export function maxLengthTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'maxLength',
      label: 'Max Length',
      type: 'number',
      attribute: 'maxlength',
      group: 'form',
      description: 'The maximum number of characters the user is allowed to enter.',
    },
    overrides,
  );
}

/** `prefixIcon` — an icon name displayed before the input content (e.g. Lucide icon name). */
export function prefixIconTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'prefixIcon',
      label: 'Prefix Icon',
      type: 'string',
      group: 'form',
      description: 'Lucide icon name displayed before the input value (e.g. "mail", "search").',
    },
    overrides,
  );
}

/** `suffixIcon` — an icon name displayed after the input content (e.g. Lucide icon name). */
export function suffixIconTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'suffixIcon',
      label: 'Suffix Icon',
      type: 'string',
      group: 'form',
      description: 'Lucide icon name displayed after the input value (e.g. "eye", "check").',
    },
    overrides,
  );
}

/** `helperText` — a short hint displayed below the input describing its expected value. */
export function helperTextTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'helperText',
      label: 'Helper Text',
      type: 'string',
      group: 'form',
      description: 'A short message displayed below the input to guide the user (e.g. "Must be at least 8 characters").',
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// STORA-332 — Textarea & Select Traits
// ---------------------------------------------------------------------------

/** `resize` — the CSS resize behavior of a textarea. */
export function resizeTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'resize',
      label: 'Resize',
      type: 'select',
      defaultValue: 'vertical',
      group: 'form',
      options: [
        { label: 'Vertical only', value: 'vertical' },
        { label: 'Horizontal only', value: 'horizontal' },
        { label: 'Both', value: 'both' },
        { label: 'None', value: 'none' },
      ],
      description: 'Controls whether and how the user can resize the textarea.',
    },
    overrides,
  );
}

/** `autoGrow` — whether the textarea automatically grows in height as the user types. */
export function autoGrowTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'autoGrow',
      label: 'Auto Grow',
      type: 'boolean',
      defaultValue: false,
      group: 'form',
      description: 'Automatically expand the textarea height to fit the content without scrolling.',
    },
    overrides,
  );
}

/** `maxCharCount` — the maximum character count with a visible counter shown below the textarea. */
export function maxCharCountTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'maxCharCount',
      label: 'Max Character Count',
      type: 'number',
      group: 'form',
      description: 'Maximum character limit displayed as a counter below the textarea (e.g. "120 / 500").',
    },
    overrides,
  );
}

/** `optionsList` — the list of options for a select dropdown, each with a label and value. */
export function optionsListTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'options',
      label: 'Options',
      type: 'string',
      group: 'form',
      description: 'The list of dropdown options, each with a label and value. Editable via the inspector trait panel.',
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// STORA-333 — Checkbox, Switch & Radio-Group Traits
// ---------------------------------------------------------------------------

/** `labelText` — the visible label text displayed next to a boolean control. */
export function labelTextTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'label',
      label: 'Label Text',
      type: 'string',
      group: 'form',
      description: 'The visible text label displayed alongside the control.',
    },
    overrides,
  );
}

/** `indeterminate` — whether the checkbox renders in the indeterminate (mixed) visual state. */
export function indeterminateTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'indeterminate',
      label: 'Indeterminate',
      type: 'boolean',
      defaultValue: false,
      group: 'form',
      description: 'Renders the checkbox in a mixed/indeterminate visual state (neither checked nor unchecked).',
    },
    overrides,
  );
}

/** `switchSize` — the visual size of a switch control. */
export function switchSizeTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'switchSize',
      label: 'Size',
      type: 'select',
      defaultValue: 'md',
      group: 'form',
      options: [
        { label: 'Small', value: 'sm' },
        { label: 'Medium', value: 'md' },
        { label: 'Large', value: 'lg' },
      ],
      description: 'The visual size of the switch toggle.',
    },
    overrides,
  );
}

/** `orientation` — the layout direction for a group of controls (horizontal or vertical). */
export function orientationTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'orientation',
      label: 'Orientation',
      type: 'select',
      defaultValue: 'vertical',
      group: 'form',
      options: [
        { label: 'Vertical', value: 'vertical' },
        { label: 'Horizontal', value: 'horizontal' },
      ],
      description: 'The layout direction of the child controls (vertical stack or horizontal row).',
    },
    overrides,
  );
}

/** `defaultSelected` — the initially selected value in a radio group. */
export function defaultSelectedTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'defaultSelected',
      label: 'Default Selected',
      type: 'string',
      group: 'form',
      description: 'The value of the radio item that is selected by default.',
    },
    overrides,
  );
}

// ---------------------------------------------------------------------------
// STORA-334 — File Upload & Submit Button Traits
// ---------------------------------------------------------------------------

/** `accept` — the allowed file MIME types or extensions (e.g. "image/*,.pdf"). */
export function acceptTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'accept',
      label: 'Accepted File Types',
      type: 'string',
      attribute: 'accept',
      defaultValue: '*/*',
      group: 'form',
      description: 'Comma-separated list of MIME types or file extensions accepted (e.g. "image/*,.pdf,.docx").',
    },
    overrides,
  );
}

/** `maxFileSize` — the maximum permitted file size in megabytes (MB). */
export function maxFileSizeTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'maxFileSize',
      label: 'Max File Size (MB)',
      type: 'number',
      defaultValue: 10,
      group: 'form',
      description: 'The maximum allowable file size in megabytes (MB).',
    },
    overrides,
  );
}

/** `multiple` — whether the user may select multiple files simultaneously. */
export function multipleTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'multiple',
      label: 'Allow Multiple Files',
      type: 'boolean',
      attribute: 'multiple',
      defaultValue: false,
      group: 'form',
      description: 'Allow multiple files to be selected and uploaded at once.',
    },
    overrides,
  );
}

/** `showPreview` — whether to render a thumbnail or list preview for selected files. */
export function showPreviewTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'showPreview',
      label: 'Show Preview',
      type: 'boolean',
      defaultValue: true,
      group: 'form',
      description: 'Display an interactive preview (image thumbnail or file list with badges) for selected files.',
    },
    overrides,
  );
}

/** `loadingText` — alternative label displayed while form is submitting. */
export function loadingTextTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'loadingText',
      label: 'Loading Text',
      type: 'string',
      defaultValue: 'Submitting...',
      group: 'behavior',
      description: 'Text displayed on the button while the form submission is in progress.',
    },
    overrides,
  );
}

/** `showSpinner` — whether an animated loading spinner is displayed during submission. */
export function showSpinnerTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'showSpinner',
      label: 'Show Loading Spinner',
      type: 'boolean',
      defaultValue: true,
      group: 'behavior',
      description: 'Automatically show an animated loading spinner icon while form is submitting.',
    },
    overrides,
  );
}

/** `autoDisableOnSubmit` — whether the submit button is automatically disabled during submission. */
export function autoDisableOnSubmitTrait(overrides?: Partial<ComponentTraitDefinition>): ComponentTraitDefinition {
  return withOverrides(
    {
      name: 'autoDisableOnSubmit',
      label: 'Auto Disable on Submit',
      type: 'boolean',
      defaultValue: true,
      group: 'behavior',
      description: 'Automatically disable the button to prevent duplicate submissions while the form is submitting.',
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
