import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import { ariaLabelTrait, idTrait, titleTrait } from '../../traits';

export const codeBlockDefinition: ComponentDefinition = {
  type: 'code-block',
  label: 'Code Block',
  category: 'typography',
  icon: 'code-block',
  acceptsChildren: false,
  defaultProps: {
    code: 'console.log("Hello, world!");',
    language: 'javascript',
  },
  propFields: [
    {
      name: 'code',
      label: 'Code',
      type: 'textarea',
      defaultValue: 'console.log("Hello, world!");',
    },
    {
      name: 'language',
      label: 'Language',
      type: 'string',
      defaultValue: 'javascript',
    },
  ],
  traits: [
    idTrait(),
    titleTrait(),
    ariaLabelTrait({ description: 'Accessible label describing what the code example shows.' }),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.code !== undefined && typeof props.code !== 'string' && !isVariableBinding(props.code)) {
      errors.push('Code Block "code" must be a string when provided.');
    }
    if (props.language !== undefined && typeof props.language !== 'string' && !isVariableBinding(props.language)) {
      errors.push('Code Block "language" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      backgroundColor: '#1e293b',
      color: '#f8fafc',
      padding: '16px',
      borderRadius: '8px',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      fontSize: '14px',
      lineHeight: '1.5',
      overflowX: 'auto',
      margin: '0 0 16px 0',
      whiteSpace: 'pre',
    },
  },
};
