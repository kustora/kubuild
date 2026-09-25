import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { idTrait } from '../../traits';

/**
 * Star rating (STORA-547). Supports half stars; the accessible label defaults to
 * "{value} out of {max}" and can be localized via `labelTemplate`.
 */
export const ratingDefinition: ComponentDefinition = {
  type: 'rating',
  label: 'Rating',
  category: 'media',
  icon: 'star',
  description: 'Read-only star rating with half-star support.',
  acceptsChildren: false,
  defaultProps: {
    value: 5,
    max: 5,
    size: 20,
    color: '#f59e0b',
    emptyColor: '#e2e8f0',
    labelTemplate: '{value} out of {max}',
  },
  propFields: [
    {
      name: 'value',
      label: 'Value',
      type: 'number',
      defaultValue: 5,
      description: 'Rounded to the nearest half star.',
    },
    { name: 'max', label: 'Max Stars', type: 'number', defaultValue: 5 },
    { name: 'size', label: 'Star Size (px)', type: 'number', defaultValue: 20 },
    { name: 'color', label: 'Color', type: 'color', defaultValue: '#f59e0b' },
    { name: 'emptyColor', label: 'Empty Color', type: 'color', defaultValue: '#e2e8f0' },
    {
      name: 'labelTemplate',
      label: 'Accessible Label',
      type: 'string',
      defaultValue: '{value} out of {max}',
      description:
        'Screen reader text; {value} and {max} are replaced (e.g. "{value} dari {max}").',
    },
  ],
  traits: [idTrait()],
  defaultStyles: {
    base: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
    },
  },
  validateProps: (props) => {
    const errors: string[] = [];
    for (const name of ['value', 'max', 'size']) {
      const v = props[name];
      if (
        v !== undefined &&
        !isVariableBinding(v) &&
        (typeof v !== 'number' || !Number.isFinite(v) || v < 0)
      ) {
        errors.push(`Rating "${name}" must be a non-negative number.`);
      }
    }
    return errors;
  },
};
