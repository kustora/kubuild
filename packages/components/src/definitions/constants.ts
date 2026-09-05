/**
 * Layout nesting policy (STORA-021): page > section > container/columns > content.
 * `page` is never a valid child anywhere (excluded from every allowedChildren list
 * below, and explicitly barred via disallowedParents) so a "page" node can never
 * appear nested inside another node, and content nodes can never become the root
 * (enforced separately by the schema's RootPageNodeSchema refinement).
 */
export const LAYOUT_PARENTS = ['page', 'section', 'container', 'columns', 'flex', 'grid'];

export const CONTENT_CHILD_TYPES = [
  'heading',
  'text',
  'paragraph',
  'link',
  'blockquote',
  'badge',
  'code-block',
  'image',
  'video',
  'icon',
  'html-embed',
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
  'list',
  'table',
  'collection',
  'custom',
];

