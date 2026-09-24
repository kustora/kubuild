import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { idTrait } from '../../traits';

/** Horizontal divider line with optional centered label (STORA-548). */
export const dividerDefinition: ComponentDefinition = {
  type: 'divider',
  label: 'Divider',
  category: 'layout',
  icon: 'divider',
  description: 'Horizontal rule (solid/dashed/dotted) with an optional centered label.',
  acceptsChildren: false,
  defaultProps: {
    lineStyle: 'solid',
    thickness: 1,
    color: '#e2e8f0',
    label: '',
  },
  propFields: [
    {
      name: 'lineStyle',
      label: 'Line Style',
      type: 'select',
      defaultValue: 'solid',
      options: [
        { label: 'Solid', value: 'solid' },
        { label: 'Dashed', value: 'dashed' },
        { label: 'Dotted', value: 'dotted' },
      ],
    },
    { name: 'thickness', label: 'Thickness (px)', type: 'number', defaultValue: 1 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: '#e2e8f0' },
    {
      name: 'label',
      label: 'Center Label',
      type: 'string',
      defaultValue: '',
      description: 'Optional text in the middle of the line, e.g. "OR".',
    },
  ],
  traits: [idTrait()],
  defaultStyles: {
    base: {
      width: '100%',
      marginTop: '16px',
      marginBottom: '16px',
    },
  },
  validateProps: (props) => {
    const v = props.lineStyle;
    if (v !== undefined && !isVariableBinding(v) && !['solid', 'dashed', 'dotted'].includes(v as string)) {
      return ['Divider "lineStyle" must be one of: solid, dashed, dotted.'];
    }
    return [];
  },
};

/**
 * Empty vertical spacer (STORA-548). Height is an ordinary style so it can differ
 * per breakpoint (base/desktop/tablet/mobile) like any other responsive style.
 */
export const spacerDefinition: ComponentDefinition = {
  type: 'spacer',
  label: 'Spacer',
  category: 'layout',
  icon: 'dimension',
  description: 'Empty vertical space; height is responsive per breakpoint.',
  acceptsChildren: false,
  defaultProps: {},
  traits: [idTrait()],
  defaultStyles: {
    base: {
      width: '100%',
      height: '48px',
    },
    tablet: {
      height: '32px',
    },
    mobile: {
      height: '24px',
    },
  },
};
