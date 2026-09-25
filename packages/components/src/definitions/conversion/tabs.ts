import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait } from '../../traits';
import { CONTENT_CHILD_TYPES } from '../constants';

/**
 * Tabs (STORA-545). Children are `tab-panel` nodes; each panel's `label` becomes a
 * tab button. `activeIndex` is the tab shown on first render — clicking a tab on
 * the editor canvas writes it back so authors can edit any panel.
 */
export const tabsDefinition: ComponentDefinition = {
  type: 'tabs',
  label: 'Tabs',
  category: 'interactive',
  icon: 'tabs',
  description: 'Tabbed content for product variants, specifications, or plan comparison.',
  acceptsChildren: true,
  allowedChildren: ['tab-panel'],
  defaultProps: {
    activeIndex: 0,
  },
  defaultChildren: [
    {
      type: 'tab-panel',
      props: { label: 'Tab 1' },
      children: [{ type: 'paragraph', props: { text: 'Content for the first tab.' } }],
    },
    {
      type: 'tab-panel',
      props: { label: 'Tab 2' },
      children: [{ type: 'paragraph', props: { text: 'Content for the second tab.' } }],
    },
  ],
  propFields: [
    {
      name: 'activeIndex',
      label: 'Active Tab',
      type: 'number',
      defaultValue: 0,
      description: 'Zero-based index of the tab shown initially.',
    },
  ],
  traits: [idTrait(), ariaLabelTrait({ description: 'Accessible name for the tab list.' })],
  defaultStyles: {
    base: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
    },
  },
  validateProps: (props) => {
    const errors: string[] = [];
    const idx = props.activeIndex;
    if (
      idx !== undefined &&
      !isVariableBinding(idx) &&
      (typeof idx !== 'number' || !Number.isInteger(idx) || idx < 0)
    ) {
      errors.push('Tabs "activeIndex" must be a non-negative integer.');
    }
    return errors;
  },
};

export const tabPanelDefinition: ComponentDefinition = {
  type: 'tab-panel',
  label: 'Tab Panel',
  category: 'interactive',
  icon: 'layout',
  description: 'Content of a single tab; its label is shown in the tab list.',
  acceptsChildren: true,
  allowedChildren: ['container', 'columns', 'flex', 'grid', ...CONTENT_CHILD_TYPES],
  defaultProps: {
    label: 'Tab',
  },
  defaultChildren: [{ type: 'paragraph', props: { text: 'Tab content.' } }],
  propFields: [{ name: 'label', label: 'Tab Label', type: 'string', defaultValue: 'Tab' }],
  traits: [idTrait()],
  defaultStyles: {
    base: {
      paddingTop: '16px',
    },
  },
};
