import { ComponentTraitDefinition, withOverrides } from './types';

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

