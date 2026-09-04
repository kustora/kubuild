import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait } from '../../traits';

export const htmlEmbedDefinition: ComponentDefinition = {
  type: 'html-embed',
  label: 'HTML Embed',
  category: 'custom',
  icon: 'code',
  acceptsChildren: false,
  defaultProps: {
    html: '<div style="padding: 16px; background: #f1f5f9; border-radius: 8px; text-align: center; font-family: sans-serif; color: #475569;">Custom HTML Embed Content</div>',
  },
  propFields: [
    {
      name: 'html',
      label: 'HTML / Embed Code',
      type: 'textarea',
      defaultValue: '<div style="padding: 16px; background: #f1f5f9; border-radius: 8px; text-align: center; font-family: sans-serif; color: #475569;">Custom HTML Embed Content</div>',
    },
  ],
  traits: [
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.html !== undefined && typeof props.html !== 'string' && !isVariableBinding(props.html)) {
      errors.push('HTML Embed "html" must be a string.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      width: '100%',
      margin: '0 0 16px 0',
    },
  },
};
