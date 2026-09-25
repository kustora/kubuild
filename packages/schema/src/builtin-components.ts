/**
 * Canonical list of built-in component type names shipped by `@kubuild/components`'
 * `createDefaultComponentRegistry()`.
 *
 * It lives in `@kubuild/schema` (the bottom of the dependency graph) so that
 * `@kubuild/core` can use it — e.g. to tell built-in from custom components in
 * `extractTemplateRequirements` — without depending on `@kubuild/components`, which
 * would invert the `schema → core → components` direction. `@kubuild/components`
 * derives its `CoreComponentType` union from this list and a test there asserts the
 * default registry registers exactly these types, so the two cannot drift apart.
 *
 * When adding a built-in component definition, add its type here as well.
 */
export const BUILTIN_COMPONENT_TYPES = [
  // layout
  'page',
  'section',
  'container',
  'columns',
  'flex',
  'grid',
  // typography
  'heading',
  'text',
  'paragraph',
  'link',
  'blockquote',
  'badge',
  'code-block',
  // media
  'image',
  'video',
  'icon',
  'html-embed',
  // form
  'button',
  'button-submit',
  'form',
  'input',
  'textarea',
  'select',
  'checkbox',
  'switch',
  'radio-group',
  'radio',
  'radio-item',
  'file-upload',
  // data
  'collection',
  'list',
  'list-item',
  'table',
  'table-row',
  'table-cell',
  // interactive
  'modal',
  'drawer',
  'collapsible',
  // conversion (Epic 60)
  'countdown',
  'accordion',
  'accordion-item',
  'tabs',
  'tab-panel',
  'carousel',
  'rating',
  'divider',
  'spacer',
] as const;

export type BuiltinComponentType = (typeof BUILTIN_COMPONENT_TYPES)[number];

export function isBuiltinComponentType(type: unknown): type is BuiltinComponentType {
  return typeof type === 'string' && (BUILTIN_COMPONENT_TYPES as readonly string[]).includes(type);
}
