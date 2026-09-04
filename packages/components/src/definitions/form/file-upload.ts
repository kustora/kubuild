import { isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition } from '../../registry';
import {
  acceptTrait,
  ariaLabelTrait,
  disabledTrait,
  fieldNameTrait,
  helperTextTrait,
  idTrait,
  labelTextTrait,
  maxFileSizeTrait,
  multipleTrait,
  requiredTrait,
  showPreviewTrait,
} from '../../traits';

export const fileUploadDefinition: ComponentDefinition = {
  type: 'file-upload',
  label: 'File Upload',
  category: 'form',
  icon: 'upload',
  acceptsChildren: false,
  disallowedParents: ['page'],
  defaultProps: {
    name: 'file_upload',
    label: 'Upload File',
    accept: '*/*',
    maxFileSize: 10,
    multiple: false,
    showPreview: true,
    required: false,
    disabled: false,
    helperText: '',
  },
  propFields: [
    { name: 'name', label: 'Field Name', type: 'string', defaultValue: 'file_upload' },
    { name: 'label', label: 'Label Text', type: 'string', defaultValue: 'Upload File' },
    { name: 'accept', label: 'Accepted File Types', type: 'string', defaultValue: '*/*' },
    { name: 'maxFileSize', label: 'Max File Size (MB)', type: 'number', defaultValue: 10 },
    { name: 'multiple', label: 'Allow Multiple Files', type: 'boolean', defaultValue: false },
    { name: 'showPreview', label: 'Show Preview', type: 'boolean', defaultValue: true },
    { name: 'required', label: 'Required', type: 'boolean', defaultValue: false },
    { name: 'disabled', label: 'Disabled', type: 'boolean', defaultValue: false },
    { name: 'helperText', label: 'Helper Text', type: 'string' },
  ],
  traits: [
    fieldNameTrait({ defaultValue: 'file_upload' }),
    labelTextTrait({ defaultValue: 'Upload File' }),
    acceptTrait(),
    maxFileSizeTrait(),
    multipleTrait(),
    showPreviewTrait(),
    helperTextTrait(),
    requiredTrait(),
    disabledTrait(),
    idTrait(),
    ariaLabelTrait(),
  ],
  validateProps: (props) => {
    const errors: string[] = [];
    if (props.label !== undefined && typeof props.label !== 'string' && !isVariableBinding(props.label)) {
      errors.push('FileUpload "label" must be a string when provided.');
    }
    if (props.name !== undefined && typeof props.name !== 'string' && !isVariableBinding(props.name)) {
      errors.push('FileUpload "name" must be a string when provided.');
    }
    if (props.accept !== undefined && typeof props.accept !== 'string' && !isVariableBinding(props.accept)) {
      errors.push('FileUpload "accept" must be a string when provided.');
    }
    if (props.maxFileSize !== undefined && !isVariableBinding(props.maxFileSize)) {
      if (typeof props.maxFileSize !== 'number' || props.maxFileSize <= 0) {
        errors.push('FileUpload "maxFileSize" must be a positive number when provided.');
      }
    }
    if (props.multiple !== undefined && typeof props.multiple !== 'boolean' && !isVariableBinding(props.multiple)) {
      errors.push('FileUpload "multiple" must be a boolean when provided.');
    }
    if (props.showPreview !== undefined && typeof props.showPreview !== 'boolean' && !isVariableBinding(props.showPreview)) {
      errors.push('FileUpload "showPreview" must be a boolean when provided.');
    }
    if (props.required !== undefined && typeof props.required !== 'boolean' && !isVariableBinding(props.required)) {
      errors.push('FileUpload "required" must be a boolean when provided.');
    }
    if (props.disabled !== undefined && typeof props.disabled !== 'boolean' && !isVariableBinding(props.disabled)) {
      errors.push('FileUpload "disabled" must be a boolean when provided.');
    }
    if (props.helperText !== undefined && typeof props.helperText !== 'string' && !isVariableBinding(props.helperText)) {
      errors.push('FileUpload "helperText" must be a string when provided.');
    }
    return errors.length > 0 ? errors : true;
  },
  defaultStyles: {
    base: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      fontSize: '14px',
      color: '#1e293b',
    },
  },
};
