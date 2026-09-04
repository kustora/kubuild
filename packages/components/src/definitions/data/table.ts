import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, colSpanTrait, idTrait, rowSpanTrait } from '../../traits';

export const tableDefinition: ComponentDefinition = {
  type: 'table',
  label: 'Table',
  category: 'layout',
  icon: 'table',
  acceptsChildren: true,
  allowedChildren: ['table-row'],
  defaultProps: {
    striped: false,
    bordered: true,
    compact: false,
  },
  defaultChildren: [
    {
      type: 'table-row',
      children: [
        { type: 'table-cell', props: { tag: 'th', text: 'Header 1' } },
        { type: 'table-cell', props: { tag: 'th', text: 'Header 2' } },
      ],
    },
    {
      type: 'table-row',
      children: [
        { type: 'table-cell', props: { tag: 'td', text: 'Data 1' } },
        { type: 'table-cell', props: { tag: 'td', text: 'Data 2' } },
      ],
    },
  ],
  propFields: [
    { name: 'striped', label: 'Striped Rows', type: 'boolean', defaultValue: false },
    { name: 'bordered', label: 'Bordered', type: 'boolean', defaultValue: true },
    { name: 'compact', label: 'Compact Spacing', type: 'boolean', defaultValue: false },
  ],
  traits: [
    idTrait(),
    ariaLabelTrait({ description: 'Required: provides a caption summary for the table when no visible caption exists.' }),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.striped !== undefined && typeof props.striped !== 'boolean' && !isVariableBinding(props.striped)) {
      errors.push('Table "striped" must be a boolean.');
    }
    if (props.bordered !== undefined && typeof props.bordered !== 'boolean' && !isVariableBinding(props.bordered)) {
      errors.push('Table "bordered" must be a boolean.');
    }
    if (props.compact !== undefined && typeof props.compact !== 'boolean' && !isVariableBinding(props.compact)) {
      errors.push('Table "compact" must be a boolean.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      margin: '0 0 16px 0',
      borderCollapse: 'collapse',
    },
  },
};

export const tableRowDefinition: ComponentDefinition = {
  type: 'table-row',
  label: 'Table Row',
  category: 'layout',
  icon: 'table-row',
  acceptsChildren: true,
  allowedChildren: ['table-cell'],
  disallowedParents: ['page'],
  defaultProps: {},
  defaultChildren: [
    { type: 'table-cell', props: { tag: 'td', text: 'Data' } },
  ],
  traits: [
    idTrait(),
    ariaLabelTrait(),
  ],
  defaultStyles: {
    base: {},
  },
};

export const tableCellDefinition: ComponentDefinition = {
  type: 'table-cell',
  label: 'Table Cell',
  category: 'layout',
  icon: 'table-cell',
  acceptsChildren: true,
  allowedChildren: [
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
    'list',
    'custom',
  ],
  disallowedParents: ['page'],
  defaultProps: {
    tag: 'td',
    text: 'Cell',
    colSpan: 1,
    rowSpan: 1,
  },
  propFields: [
    {
      name: 'tag',
      label: 'Cell Type',
      type: 'select',
      defaultValue: 'td',
      options: [
        { label: 'Data Cell (td)', value: 'td' },
        { label: 'Header Cell (th)', value: 'th' },
      ],
    },
    { name: 'text', label: 'Text', type: 'string', defaultValue: 'Cell' },
    { name: 'colSpan', label: 'Column Span (colSpan)', type: 'number', defaultValue: 1 },
    { name: 'rowSpan', label: 'Row Span (rowSpan)', type: 'number', defaultValue: 1 },
  ],
  traits: [
    colSpanTrait(),
    rowSpanTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.tag !== undefined && !isVariableBinding(props.tag)) {
      if (props.tag !== 'td' && props.tag !== 'th') {
        errors.push('Table Cell "tag" must be either "td" or "th".');
      }
    }
    if (props.colSpan !== undefined && !isVariableBinding(props.colSpan)) {
      if (typeof props.colSpan !== 'number' || props.colSpan < 1 || !Number.isInteger(props.colSpan)) {
        errors.push('Table Cell "colSpan" must be a positive integer (>= 1).');
      }
    }
    if (props.rowSpan !== undefined && !isVariableBinding(props.rowSpan)) {
      if (typeof props.rowSpan !== 'number' || props.rowSpan < 1 || !Number.isInteger(props.rowSpan)) {
        errors.push('Table Cell "rowSpan" must be a positive integer (>= 1).');
      }
    }
    if (props.text !== undefined && typeof props.text !== 'string' && !isVariableBinding(props.text)) {
      errors.push('Table Cell "text" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      padding: '8px 12px',
      borderWidth: '1px',
      borderColor: '#e2e8f0',
      borderStyle: 'solid',
      textAlign: 'left',
    },
  },
};

