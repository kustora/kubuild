import { describe, it, expect } from 'vitest';
import {
  createDefaultComponentRegistry,
  buttonDefinition,
  buttonSubmitDefinition,
  formDefinition,
  inputDefinition,
  textareaDefinition,
  selectDefinition,
  checkboxDefinition,
  switchDefinition,
  radioGroupDefinition,
  radioDefinition,
  radioItemDefinition,
  fileUploadDefinition,
  TRAIT_GROUP_ORDER,
} from '../src/index';
import { validateDocument, createBlankDocument, insertNode } from '@kubuild/core';
import { ResponsiveStylesSchema } from '@kubuild/schema';

describe('STORA-022: button component', () => {
  describe('button', () => {
    it('is valid with just a label', () => {
      expect(buttonDefinition.validateProps?.({ label: 'Click' })).toBe(true);
    });

    it('is valid with a well-formed action', () => {
      expect(
        buttonDefinition.validateProps?.({ label: 'Go', action: { type: 'navigate', payload: { url: '/x' } } }),
      ).toBe(true);
    });

    it('is valid with variable bindings for label/href/disabled (STORA-051: bindable props)', () => {
      expect(
        buttonDefinition.validateProps?.({
          label: { type: 'variable', key: 'cta.label' },
          href: { type: 'variable', key: 'cta.href' },
          disabled: { type: 'variable', key: 'cta.disabled' },
        }),
      ).toBe(true);
    });

    it('rejects an empty label', () => {
      expect(buttonDefinition.validateProps?.({ label: '' })).toEqual(['Button requires a non-empty "label".']);
    });

    it('rejects a malformed action', () => {
      const result = buttonDefinition.validateProps?.({ label: 'Go', action: { payload: {} } });
      expect((result as string[])[0]).toContain('action');
    });

    it('rejects a non-boolean disabled value', () => {
      const result = buttonDefinition.validateProps?.({ label: 'Go', disabled: 'yes' });
      expect((result as string[])[0]).toContain('disabled');
    });

    it('declares the actionRegistry capability', () => {
      expect(buttonDefinition.capabilities).toContain('actionRegistry');
    });
  });
});

describe('STORA-195: Form Controls (form, input, textarea, select, checkbox, radio)', () => {
  it('registers form, input, textarea, select, checkbox, and radio in default registry under form category', () => {
    const registry = createDefaultComponentRegistry();
    const formTypes = ['form', 'input', 'textarea', 'select', 'checkbox', 'radio'];

    for (const type of formTypes) {
      expect(registry.has(type)).toBe(true);
      const def = registry.get(type);
      expect(def).toBeDefined();
      expect(def?.category).toBe('form');
    }

    expect(registry.get('form')?.acceptsChildren).toBe(true);
    expect(registry.get('input')?.acceptsChildren).toBe(false);
    expect(registry.get('textarea')?.acceptsChildren).toBe(false);
    expect(registry.get('select')?.acceptsChildren).toBe(false);
    expect(registry.get('checkbox')?.acceptsChildren).toBe(false);
    expect(registry.get('radio')?.acceptsChildren).toBe(false);
  });

  it('validates form definition and props', () => {
    expect(formDefinition.type).toBe('form');
    expect(formDefinition.category).toBe('form');
    expect(formDefinition.validateProps?.({
      name: 'lead_capture',
      action: 'https://example.com/api/submit',
      method: 'POST',
      target: '_self',
      autoComplete: 'on',
    })).toBe(true);

    const invalidMethod = formDefinition.validateProps?.({ method: 'DELETE' });
    expect(Array.isArray(invalidMethod)).toBe(true);
    expect((invalidMethod as string[])[0]).toContain('Form "method" must be either "GET" or "POST"');

    const invalidTarget = formDefinition.validateProps?.({ target: 'invalid' });
    expect(Array.isArray(invalidTarget)).toBe(true);
    expect((invalidTarget as string[])[0]).toContain('Form "target" must be one of');
  });

  it('validates input definition and props', () => {
    expect(inputDefinition.type).toBe('input');
    expect(inputDefinition.category).toBe('form');
    expect(inputDefinition.validateProps?.({
      name: 'email',
      type: 'email',
      placeholder: 'user@example.com',
      required: true,
      disabled: false,
    })).toBe(true);

    const invalidType = inputDefinition.validateProps?.({ type: 'button' });
    expect(Array.isArray(invalidType)).toBe(true);
    expect((invalidType as string[])[0]).toContain('Input "type" must be one of');

    const invalidRequired = inputDefinition.validateProps?.({ required: 'yes' as unknown as boolean });
    expect(Array.isArray(invalidRequired)).toBe(true);
    expect((invalidRequired as string[])[0]).toContain('Input "required" must be a boolean');
  });

  it('validates textarea definition and props', () => {
    expect(textareaDefinition.type).toBe('textarea');
    expect(textareaDefinition.category).toBe('form');
    expect(textareaDefinition.validateProps?.({
      name: 'feedback',
      placeholder: 'Your feedback...',
      rows: 5,
      required: false,
    })).toBe(true);

    const invalidRows = textareaDefinition.validateProps?.({ rows: 0 });
    expect(Array.isArray(invalidRows)).toBe(true);
    expect((invalidRows as string[])[0]).toContain('Textarea "rows" must be a positive integer');
  });

  it('validates select definition and props', () => {
    expect(selectDefinition.type).toBe('select');
    expect(selectDefinition.category).toBe('form');
    expect(selectDefinition.validateProps?.({
      name: 'country',
      options: [
        { label: 'Indonesia', value: 'ID' },
        { label: 'United States', value: 'US' },
      ],
      required: true,
    })).toBe(true);

    const invalidOptions = selectDefinition.validateProps?.({ options: 12345 as unknown as string });
    expect(Array.isArray(invalidOptions)).toBe(true);
    expect((invalidOptions as string[])[0]).toContain('Select "options" must be an array');
  });

  it('validates checkbox and radio definitions and props', () => {
    expect(checkboxDefinition.type).toBe('checkbox');
    expect(checkboxDefinition.category).toBe('form');
    expect(checkboxDefinition.validateProps?.({
      name: 'terms',
      label: 'Accept Terms',
      value: 'agreed',
      defaultChecked: true,
      required: true,
    })).toBe(true);

    expect(radioDefinition.type).toBe('radio');
    expect(radioDefinition.category).toBe('form');
    expect(radioDefinition.validateProps?.({
      name: 'gender',
      label: 'Male',
      value: 'male',
      defaultChecked: false,
    })).toBe(true);

    const invalidLabel = checkboxDefinition.validateProps?.({ label: 123 as unknown as string });
    expect(Array.isArray(invalidLabel)).toBe(true);
    expect((invalidLabel as string[])[0]).toContain('Checkbox "label" must be a string');
  });

  it('allows form controls to be nested inside form, container, section, and columns', () => {
    const registry = createDefaultComponentRegistry();
    const parents = ['form', 'container', 'section', 'columns'];
    const children = ['input', 'textarea', 'select', 'checkbox', 'radio', 'button'];

    for (const parent of parents) {
      for (const child of children) {
        const canInsert = registry.canInsertChild(parent, child);
        expect(canInsert.valid, `Expected ${child} to be insertable inside ${parent}`).toBe(true);
      }
    }
  });
});

describe('STORA-335: Unit Tests Komponen Form di Component Registry', () => {
  const FORM_COMPONENT_TYPES = [
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
    'button-submit',
  ] as const;

  const FORM_DEFINITIONS = [
    formDefinition,
    inputDefinition,
    textareaDefinition,
    selectDefinition,
    checkboxDefinition,
    switchDefinition,
    radioGroupDefinition,
    radioDefinition,
    radioItemDefinition,
    fileUploadDefinition,
    buttonSubmitDefinition,
  ];

  describe('1. Registration & Category in ComponentRegistry', () => {
    it('registers all 11 form components in default registry', () => {
      const registry = createDefaultComponentRegistry();

      for (const type of FORM_COMPONENT_TYPES) {
        expect(registry.has(type), `Component "${type}" should be registered in registry`).toBe(true);
        const def = registry.get(type);
        expect(def, `Component definition for "${type}" should be defined`).toBeDefined();
        expect(def?.type).toBe(type);
      }
    });

    it('all 11 form components are classified under category "form"', () => {
      const registry = createDefaultComponentRegistry();
      const formComponents = registry.listByCategory('form');
      const registeredFormTypes = formComponents.map((def) => def.type);

      expect(registeredFormTypes.length).toBe(11);
      for (const type of FORM_COMPONENT_TYPES) {
        expect(registeredFormTypes).toContain(type);
      }

      for (const def of FORM_DEFINITIONS) {
        expect(def.category).toBe('form');
      }
    });

    it('retrieves each form component definition by type with correct label', () => {
      const registry = createDefaultComponentRegistry();

      const expectedLabels: Record<string, string> = {
        form: 'Form',
        input: 'Input',
        textarea: 'Textarea',
        select: 'Select',
        checkbox: 'Checkbox',
        switch: 'Switch',
        'radio-group': 'Radio Group',
        radio: 'Radio',
        'radio-item': 'Radio Item',
        'file-upload': 'File Upload',
        'button-submit': 'Submit Button',
      };

      for (const [type, label] of Object.entries(expectedLabels)) {
        const def = registry.get(type);
        expect(def?.label).toBe(label);
      }
    });
  });

  describe('2. Representative Icons', () => {
    it('every form component defines a representative, non-empty icon string', () => {
      for (const def of FORM_DEFINITIONS) {
        expect(def.icon, `${def.type} must have an icon defined`).toBeDefined();
        expect(typeof def.icon).toBe('string');
        expect(def.icon?.trim().length, `${def.type} icon must not be empty`).toBeGreaterThan(0);
      }
    });

    it('verifies expected semantic icons for all form components', () => {
      const expectedIcons: Record<string, string> = {
        form: 'form',
        input: 'input',
        textarea: 'textarea',
        select: 'select',
        checkbox: 'checkbox',
        switch: 'switch',
        'radio-group': 'radio-group',
        radio: 'radio',
        'radio-item': 'radio',
        'file-upload': 'upload',
        'button-submit': 'send',
      };

      for (const [type, expectedIcon] of Object.entries(expectedIcons)) {
        const def = FORM_DEFINITIONS.find((d) => d.type === type);
        expect(def?.icon, `${type} should use icon "${expectedIcon}"`).toBe(expectedIcon);
      }
    });
  });

  describe('3. Default Styles & Visual Quality', () => {
    it('100% of form components have defaultStyles conforming to ResponsiveStylesSchema', () => {
      for (const def of FORM_DEFINITIONS) {
        expect(def.defaultStyles, `${def.type} must define defaultStyles`).toBeDefined();
        const parsed = ResponsiveStylesSchema.safeParse(def.defaultStyles);
        expect(
          parsed.success,
          `${def.type} defaultStyles must conform to ResponsiveStylesSchema: ${JSON.stringify(parsed.error?.issues)}`,
        ).toBe(true);
      }
    });

    it('every form component defines a non-empty base style object', () => {
      for (const def of FORM_DEFINITIONS) {
        const base = def.defaultStyles?.base;
        expect(base, `${def.type} defaultStyles.base must be defined`).toBeDefined();
        expect(Object.keys(base || {}).length, `${def.type} defaultStyles.base must not be empty`).toBeGreaterThan(0);
      }
    });

    it('form container uses responsive flex column layout default styles', () => {
      const base = formDefinition.defaultStyles?.base;
      expect(base?.display).toBe('flex');
      expect(base?.flexDirection).toBe('column');
      expect(base?.gap).toBe('16px');
      expect(base?.width).toBe('100%');
    });

    it('text-entry controls (input, textarea, select) have cohesive boxed styles', () => {
      const textControls = [inputDefinition, textareaDefinition, selectDefinition];

      for (const control of textControls) {
        const base = control.defaultStyles?.base;
        expect(base?.width).toBe('100%');
        expect(base?.borderRadius).toBe('6px');
        expect(base?.borderWidth).toBe('1px');
        expect(base?.borderStyle).toBe('solid');
        expect(base?.borderColor).toBe('#cbd5e1');
        expect(base?.backgroundColor).toBe('#ffffff');
        expect(base?.color).toBe('#1e293b');
        expect(base?.boxSizing).toBe('border-box');
      }
    });

    it('toggle & choice controls (checkbox, switch, radio) have inline-flex and pointer cursor', () => {
      const toggleControls = [checkboxDefinition, switchDefinition, radioDefinition];

      for (const control of toggleControls) {
        const base = control.defaultStyles?.base;
        expect(base?.display).toBe('inline-flex');
        expect(base?.alignItems).toBe('center');
        expect(base?.gap).toBe('8px');
        expect(base?.cursor).toBe('pointer');
        expect(base?.userSelect).toBe('none');
      }
    });

    it('submit button has prominent action styling', () => {
      const base = buttonSubmitDefinition.defaultStyles?.base;
      expect(base?.backgroundColor).toBe('#2563eb');
      expect(base?.color).toBe('#ffffff');
      expect(base?.borderRadius).toBe('6px');
      expect(base?.fontWeight).toBe('500');
      expect(base?.cursor).toBe('pointer');
      expect(base?.display).toBe('inline-flex');
      expect(base?.alignItems).toBe('center');
      expect(base?.justifyContent).toBe('center');
    });
  });

  describe('4. Trait Metadata & Property Definitions', () => {
    it('100% of form components define rich traits', () => {
      for (const def of FORM_DEFINITIONS) {
        expect(Array.isArray(def.traits), `${def.type} traits must be an array`).toBe(true);
        expect(def.traits?.length, `${def.type} traits must not be empty`).toBeGreaterThan(0);
      }
    });

    it('no form component has duplicate trait names', () => {
      for (const def of FORM_DEFINITIONS) {
        const names = (def.traits ?? []).map((t) => t.name);
        const uniqueNames = new Set(names);
        expect(
          uniqueNames.size,
          `${def.type} has duplicate trait names: ${names.join(', ')}`,
        ).toBe(names.length);
      }
    });

    it('all traits define valid groups recognized by TRAIT_GROUP_ORDER', () => {
      for (const def of FORM_DEFINITIONS) {
        for (const trait of def.traits ?? []) {
          if (trait.group) {
            expect(
              TRAIT_GROUP_ORDER,
              `${def.type}.${trait.name} has invalid group "${trait.group}"`,
            ).toContain(trait.group);
          }
        }
      }
    });

    it('every form component includes identity (id) and accessibility (ariaLabel) traits', () => {
      for (const def of FORM_DEFINITIONS) {
        const traitNames = (def.traits ?? []).map((t) => t.name);
        expect(traitNames, `${def.type} must include "id" trait`).toContain('id');
        expect(traitNames, `${def.type} must include "ariaLabel" trait`).toContain('ariaLabel');
      }
    });

    it('every form field component includes fieldName/name trait and disabled trait', () => {
      const fieldComponents = [
        inputDefinition,
        textareaDefinition,
        selectDefinition,
        checkboxDefinition,
        switchDefinition,
        radioGroupDefinition,
        radioDefinition,
        radioItemDefinition,
        fileUploadDefinition,
      ];

      for (const def of fieldComponents) {
        const traitNames = (def.traits ?? []).map((t) => t.name);
        expect(traitNames, `${def.type} must include "name" trait`).toContain('name');
        expect(traitNames, `${def.type} must include "disabled" trait`).toContain('disabled');
      }
    });
  });

  describe('5. Hierarchy, Parent-Child Policy & Node Validation', () => {
    it('form container accepts all form controls, layout, and content elements', () => {
      const registry = createDefaultComponentRegistry();
      const formDef = registry.get('form');
      expect(formDef?.acceptsChildren).toBe(true);

      const expectedChildren = [
        'input',
        'textarea',
        'select',
        'checkbox',
        'switch',
        'radio-group',
        'radio',
        'radio-item',
        'file-upload',
        'button-submit',
        'button',
        'heading',
        'text',
        'container',
        'columns',
        'section',
      ];

      for (const childType of expectedChildren) {
        const canInsert = registry.canInsertChild('form', childType);
        expect(canInsert.valid, `Form should allow child "${childType}"`).toBe(true);
      }
    });

    it('radio-group allows radio and radio-item children, as well as registered custom components', () => {
      const registry = createDefaultComponentRegistry();
      expect(registry.canInsertChild('radio-group', 'radio').valid).toBe(true);
      expect(registry.canInsertChild('radio-group', 'radio-item').valid).toBe(true);

      registry.register({ type: 'custom.radio', label: 'Custom Radio', category: 'custom' });
      expect(registry.canInsertChild('radio-group', 'custom.radio').valid).toBe(true);

      // radio-group does not allow arbitrary input or heading directly
      expect(registry.canInsertChild('radio-group', 'input').valid).toBe(false);
      expect(registry.canInsertChild('radio-group', 'textarea').valid).toBe(false);
    });

    it('all leaf form controls reject children (acceptsChildren: false)', () => {
      const registry = createDefaultComponentRegistry();
      const leafTypes = [
        'input',
        'textarea',
        'select',
        'checkbox',
        'switch',
        'radio',
        'radio-item',
        'file-upload',
        'button-submit',
      ];

      for (const type of leafTypes) {
        const def = registry.get(type);
        expect(def?.acceptsChildren, `${type} must not accept children`).toBe(false);

        const canInsert = registry.canInsertChild(type, 'text');
        expect(canInsert.valid, `${type} should reject child insertion`).toBe(false);
        expect(canInsert.errors[0]).toContain('does not accept children');
      }
    });

    it('disallows placing form components directly under page node', () => {
      const registry = createDefaultComponentRegistry();

      for (const type of FORM_COMPONENT_TYPES) {
        const canInsert = registry.canInsertChild('page', type);
        expect(canInsert.valid, `Page must not directly allow form component "${type}"`).toBe(false);
      }
    });

    it('allows inserting form components into section, container, columns, and form', () => {
      const registry = createDefaultComponentRegistry();
      const parentTypes = ['section', 'container', 'columns', 'form'];

      for (const parent of parentTypes) {
        for (const type of FORM_COMPONENT_TYPES) {
          const canInsert = registry.canInsertChild(parent, type);
          expect(canInsert.valid, `"${parent}" should allow form component "${type}"`).toBe(true);
        }
      }
    });
  });

  describe('6. Prop Validation (validateProps) & Variable Binding Support', () => {
    it('100% of form component defaultProps pass validateProps', () => {
      for (const def of FORM_DEFINITIONS) {
        if (def.validateProps && def.defaultProps) {
          const result = def.validateProps(def.defaultProps);
          expect(
            result,
            `${def.type} defaultProps must be valid: ${Array.isArray(result) ? result.join(', ') : result}`,
          ).toBe(true);
        }
      }
    });

    it('validates custom props for each form component', () => {
      expect(formDefinition.validateProps?.({
        name: 'signup_form',
        action: 'https://api.example.com/signup',
        method: 'POST',
        target: '_blank',
        autoComplete: 'off',
        preventDefault: false,
        scrollToFirstError: false,
        resetOnSubmit: true,
      })).toBe(true);

      expect(inputDefinition.validateProps?.({
        name: 'username',
        type: 'text',
        placeholder: 'Enter username',
        defaultValue: 'john_doe',
        required: true,
        disabled: false,
        readOnly: true,
        pattern: '^[a-z0-9_]+$',
        minLength: 3,
        maxLength: 20,
        prefixIcon: 'user',
        suffixIcon: 'check',
        helperText: 'Username must be alphanumeric',
      })).toBe(true);

      expect(textareaDefinition.validateProps?.({
        name: 'bio',
        placeholder: 'Tell us about yourself',
        defaultValue: 'Software engineer',
        rows: 6,
        required: true,
        disabled: false,
        readOnly: false,
        resize: 'both',
        autoGrow: true,
        maxCharCount: 250,
        helperText: 'Max 250 characters',
      })).toBe(true);

      expect(selectDefinition.validateProps?.({
        name: 'department',
        placeholder: 'Select department',
        options: [
          { label: 'Engineering', value: 'eng' },
          { label: 'Design', value: 'des' },
        ],
        defaultValue: 'eng',
        required: true,
        disabled: false,
        helperText: 'Select your team',
      })).toBe(true);

      expect(checkboxDefinition.validateProps?.({
        name: 'newsletter',
        label: 'Subscribe to newsletter',
        value: 'subscribed',
        defaultChecked: true,
        indeterminate: false,
        required: false,
        disabled: false,
        helperText: 'Weekly digest',
      })).toBe(true);

      expect(switchDefinition.validateProps?.({
        name: 'dark_mode',
        label: 'Enable Dark Mode',
        value: 'dark',
        defaultChecked: true,
        switchSize: 'lg',
        required: false,
        disabled: false,
        helperText: 'Toggle dark appearance',
      })).toBe(true);

      expect(radioGroupDefinition.validateProps?.({
        name: 'frequency',
        defaultSelected: 'daily',
        orientation: 'horizontal',
        required: true,
        disabled: false,
        helperText: 'How often would you like emails?',
      })).toBe(true);

      expect(radioDefinition.validateProps?.({
        name: 'frequency',
        label: 'Daily Digest',
        value: 'daily',
        defaultChecked: true,
        required: true,
        disabled: false,
        helperText: 'Sent every morning',
      })).toBe(true);

      expect(radioItemDefinition.validateProps?.({
        name: 'frequency',
        label: 'Weekly Digest',
        value: 'weekly',
        defaultChecked: false,
        required: false,
        disabled: false,
        helperText: 'Sent every Sunday',
      })).toBe(true);

      expect(fileUploadDefinition.validateProps?.({
        name: 'resume',
        label: 'Upload CV',
        accept: '.pdf,.docx',
        maxFileSize: 5,
        multiple: false,
        showPreview: true,
        required: true,
        disabled: false,
        helperText: 'PDF format preferred',
      })).toBe(true);

      expect(buttonSubmitDefinition.validateProps?.({
        label: 'Create Account',
        loadingText: 'Creating Account...',
        showSpinner: true,
        autoDisableOnSubmit: true,
        buttonType: 'submit',
        disabled: false,
      })).toBe(true);
    });

    it('rejects invalid props across all form components', () => {
      // form
      const invalidForm = formDefinition.validateProps?.({ method: 'HEAD', target: '_invalid' });
      expect(Array.isArray(invalidForm)).toBe(true);
      expect((invalidForm as string[]).length).toBe(2);

      // input
      const invalidInput = inputDefinition.validateProps?.({ type: 'invalid_type', minLength: -5, maxLength: -1 });
      expect(Array.isArray(invalidInput)).toBe(true);
      expect((invalidInput as string[]).length).toBe(3);

      // textarea
      const invalidTextarea = textareaDefinition.validateProps?.({ rows: -2, resize: 'unsupported', maxCharCount: -10 });
      expect(Array.isArray(invalidTextarea)).toBe(true);
      expect((invalidTextarea as string[]).length).toBe(3);

      // select
      const invalidSelect = selectDefinition.validateProps?.({ options: 12345, required: 'yes' as unknown as boolean });
      expect(Array.isArray(invalidSelect)).toBe(true);
      expect((invalidSelect as string[]).length).toBe(2);

      // checkbox
      const invalidCheckbox = checkboxDefinition.validateProps?.({ label: 123, indeterminate: 'no' as unknown as boolean });
      expect(Array.isArray(invalidCheckbox)).toBe(true);
      expect((invalidCheckbox as string[]).length).toBe(2);

      // switch
      const invalidSwitch = switchDefinition.validateProps?.({ switchSize: 'xxl', defaultChecked: 'on' as unknown as boolean });
      expect(Array.isArray(invalidSwitch)).toBe(true);
      expect((invalidSwitch as string[]).length).toBe(2);

      // radio-group
      const invalidRadioGroup = radioGroupDefinition.validateProps?.({ orientation: 'diagonal', defaultSelected: 99 });
      expect(Array.isArray(invalidRadioGroup)).toBe(true);
      expect((invalidRadioGroup as string[]).length).toBe(2);

      // radio
      const invalidRadio = radioDefinition.validateProps?.({ label: {}, defaultChecked: 'yes' as unknown as boolean });
      expect(Array.isArray(invalidRadio)).toBe(true);
      expect((invalidRadio as string[]).length).toBe(2);

      // file-upload
      const invalidFile = fileUploadDefinition.validateProps?.({ maxFileSize: -1, multiple: 'yes' as unknown as boolean });
      expect(Array.isArray(invalidFile)).toBe(true);
      expect((invalidFile as string[]).length).toBe(2);

      // button-submit
      const invalidBtn = buttonSubmitDefinition.validateProps?.({ label: '', showSpinner: 123 as unknown as boolean });
      expect(Array.isArray(invalidBtn)).toBe(true);
      expect((invalidBtn as string[]).length).toBe(2);
    });

    it('supports variable bindings in bindable props for all form components without failing validation', () => {
      const varBinding = (key: string) => ({ type: 'variable' as const, key });

      expect(formDefinition.validateProps?.({
        name: varBinding('form.name'),
        action: varBinding('form.actionUrl'),
        method: varBinding('form.method'),
      })).toBe(true);

      expect(inputDefinition.validateProps?.({
        name: varBinding('fields.email.name'),
        type: varBinding('fields.email.type'),
        placeholder: varBinding('fields.email.placeholder'),
        required: varBinding('fields.email.required'),
      })).toBe(true);

      expect(textareaDefinition.validateProps?.({
        name: varBinding('fields.msg.name'),
        placeholder: varBinding('fields.msg.placeholder'),
        rows: varBinding('fields.msg.rows'),
      })).toBe(true);

      expect(selectDefinition.validateProps?.({
        name: varBinding('fields.country.name'),
        options: varBinding('fields.country.options'),
      })).toBe(true);

      expect(checkboxDefinition.validateProps?.({
        name: varBinding('fields.agree.name'),
        label: varBinding('fields.agree.label'),
        defaultChecked: varBinding('fields.agree.checked'),
      })).toBe(true);

      expect(switchDefinition.validateProps?.({
        name: varBinding('fields.optIn.name'),
        label: varBinding('fields.optIn.label'),
        switchSize: varBinding('fields.optIn.size'),
      })).toBe(true);

      expect(radioGroupDefinition.validateProps?.({
        name: varBinding('fields.plan.name'),
        defaultSelected: varBinding('fields.plan.selected'),
        orientation: varBinding('fields.plan.orientation'),
      })).toBe(true);

      expect(radioDefinition.validateProps?.({
        name: varBinding('fields.tier.name'),
        label: varBinding('fields.tier.label'),
        value: varBinding('fields.tier.value'),
      })).toBe(true);

      expect(fileUploadDefinition.validateProps?.({
        name: varBinding('fields.avatar.name'),
        label: varBinding('fields.avatar.label'),
        accept: varBinding('fields.avatar.accept'),
      })).toBe(true);

      expect(buttonSubmitDefinition.validateProps?.({
        label: varBinding('buttons.submit.label'),
        loadingText: varBinding('buttons.submit.loadingText'),
      })).toBe(true);
    });
  });

  describe('7. End-to-End Document Validation with 100% Form Components', () => {
    it('builds and validates a full form document containing all 11 form components with 0 errors', () => {
      const registry = createDefaultComponentRegistry();
      let doc = createBlankDocument('Full Form Document Test');

      // 1. Insert section
      doc = insertNode(doc, {
        parentId: 'root-page',
        node: { id: 'sec-1', type: 'section', props: {}, children: [] },
      }).document;

      // 2. Insert form
      doc = insertNode(doc, {
        parentId: 'sec-1',
        node: {
          id: 'form-1',
          type: 'form',
          props: {
            name: 'complete_form',
            action: 'https://api.example.com/submit',
            method: 'POST',
            preventDefault: true,
            scrollToFirstError: true,
            resetOnSubmit: false,
          },
          children: [],
        },
      }).document;

      // 3. Insert input
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'input-1',
          type: 'input',
          props: { name: 'full_name', type: 'text', placeholder: 'John Doe', required: true },
          children: [],
        },
      }).document;

      // 4. Insert textarea
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'textarea-1',
          type: 'textarea',
          props: { name: 'comments', placeholder: 'Your comments', rows: 4 },
          children: [],
        },
      }).document;

      // 5. Insert select
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'select-1',
          type: 'select',
          props: {
            name: 'country',
            options: [
              { label: 'Indonesia', value: 'ID' },
              { label: 'Singapore', value: 'SG' },
            ],
            defaultValue: 'ID',
          },
          children: [],
        },
      }).document;

      // 6. Insert checkbox
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'checkbox-1',
          type: 'checkbox',
          props: { name: 'agree', label: 'Agree to terms', value: 'yes', defaultChecked: false },
          children: [],
        },
      }).document;

      // 7. Insert switch
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'switch-1',
          type: 'switch',
          props: { name: 'notifications', label: 'Push Notifications', value: 'yes', switchSize: 'md' },
          children: [],
        },
      }).document;

      // 8. Insert radio-group
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'radio-group-1',
          type: 'radio-group',
          props: { name: 'subscription', defaultSelected: 'monthly', orientation: 'vertical' },
          children: [],
        },
      }).document;

      // 9. Insert radio inside radio-group
      doc = insertNode(doc, {
        parentId: 'radio-group-1',
        node: {
          id: 'radio-1',
          type: 'radio',
          props: { name: 'subscription', label: 'Monthly', value: 'monthly', defaultChecked: true },
          children: [],
        },
      }).document;

      // 10. Insert radio-item inside radio-group
      doc = insertNode(doc, {
        parentId: 'radio-group-1',
        node: {
          id: 'radio-item-1',
          type: 'radio-item',
          props: { name: 'subscription', label: 'Yearly', value: 'yearly', defaultChecked: false },
          children: [],
        },
      }).document;

      // 11. Insert file-upload
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'upload-1',
          type: 'file-upload',
          props: { name: 'attachment', label: 'Attachment', accept: '.pdf', maxFileSize: 10 },
          children: [],
        },
      }).document;

      // 12. Insert button-submit
      doc = insertNode(doc, {
        parentId: 'form-1',
        node: {
          id: 'btn-submit-1',
          type: 'button-submit',
          props: { label: 'Submit Application', buttonType: 'submit', loadingText: 'Submitting...' },
          children: [],
        },
      }).document;

      const result = validateDocument(doc, { componentRegistry: registry });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('100% of form components pass registry.validateNode for valid node shapes', () => {
      const registry = createDefaultComponentRegistry();

      for (const def of FORM_DEFINITIONS) {
        const node = {
          id: `node-${def.type}`,
          type: def.type,
          props: { ...(def.defaultProps ?? {}) },
          children: [],
        };
        const validation = registry.validateNode(node, 'form');
        expect(
          validation.valid,
          `validateNode for valid ${def.type} node should pass: ${validation.errors.join(', ')}`,
        ).toBe(true);
      }
    });

    it('100% of leaf form components fail registry.validateNode when invalidly given children', () => {
      const registry = createDefaultComponentRegistry();
      const leafDefs = FORM_DEFINITIONS.filter((d) => !d.acceptsChildren);

      for (const def of leafDefs) {
        const invalidNode = {
          id: `invalid-${def.type}`,
          type: def.type,
          props: { ...(def.defaultProps ?? {}) },
          children: [{ id: 'child-1', type: 'text', props: { content: 'test' } }],
        };
        const validation = registry.validateNode(invalidNode, 'form');
        expect(validation.valid, `${def.type} must fail validation when children are present`).toBe(false);
        expect(validation.errors[0]).toContain('does not accept children');
      }
    });

    it('100% of form components fail registry.validateNode when placed directly under forbidden page parent', () => {
      const registry = createDefaultComponentRegistry();

      for (const def of FORM_DEFINITIONS) {
        const node = {
          id: `node-${def.type}`,
          type: def.type,
          props: { ...(def.defaultProps ?? {}) },
          children: [],
        };
        const validation = registry.validateNode(node, 'page');
        expect(
          validation.valid,
          `${def.type} must fail validation when placed directly under "page" parent`,
        ).toBe(false);
      }
    });
  });
});

