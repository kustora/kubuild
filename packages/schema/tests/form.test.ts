import { describe, it, expect } from 'vitest';
import {
  ValidationRuleTypeSchema,
  ValidateOnEventSchema,
  ValidationRuleSchema,
  FormFieldBindingSchema,
  FormConfigSchema,
  isValidationRuleType,
  isValidateOnEvent,
  isValidationRule,
  isFormFieldBinding,
  isFormConfig,
  type FormFieldBinding,
  type FormConfig,
} from '../src/form';

describe('ValidationRuleTypeSchema & Type Guards', () => {
  const supportedTypes = [
    'required',
    'email',
    'url',
    'min_length',
    'max_length',
    'numeric_min',
    'numeric_max',
    'pattern',
    'match_field',
    'custom_regex',
  ];

  it.each(supportedTypes)('accepts valid rule type: %s', (ruleType) => {
    expect(ValidationRuleTypeSchema.safeParse(ruleType).success).toBe(true);
    expect(isValidationRuleType(ruleType)).toBe(true);
  });

  it('rejects unknown rule types', () => {
    expect(ValidationRuleTypeSchema.safeParse('unknown_rule').success).toBe(false);
    expect(ValidationRuleTypeSchema.safeParse('').success).toBe(false);
    expect(isValidationRuleType(null)).toBe(false);
  });
});

describe('ValidateOnEventSchema', () => {
  it('accepts valid validateOn options', () => {
    expect(ValidateOnEventSchema.safeParse('blur').success).toBe(true);
    expect(isValidateOnEvent('blur')).toBe(true);
    expect(ValidateOnEventSchema.safeParse('change').success).toBe(true);
    expect(isValidateOnEvent('change')).toBe(true);
    expect(ValidateOnEventSchema.safeParse('submit').success).toBe(true);
    expect(isValidateOnEvent('submit')).toBe(true);
  });

  it('rejects invalid timing values', () => {
    expect(ValidateOnEventSchema.safeParse('input').success).toBe(false);
    expect(isValidateOnEvent('input')).toBe(false);
    expect(ValidateOnEventSchema.safeParse('focus').success).toBe(false);
    expect(isValidateOnEvent('focus')).toBe(false);
    expect(isValidateOnEvent(null)).toBe(false);
  });
});

describe('ValidationRuleSchema', () => {
  it('validates rule with value and message', () => {
    const minLenRule = {
      type: 'min_length',
      value: 8,
      message: 'Password must be at least 8 characters long',
    };
    expect(ValidationRuleSchema.safeParse(minLenRule).success).toBe(true);
    expect(isValidationRule(minLenRule)).toBe(true);
  });

  it('validates rule without value (e.g. required, email, url)', () => {
    const requiredRule = {
      type: 'required',
      message: 'This field is required',
    };
    expect(ValidationRuleSchema.safeParse(requiredRule).success).toBe(true);
    expect(isValidationRule(requiredRule)).toBe(true);
  });

  it('rejects rule with empty message', () => {
    expect(
      ValidationRuleSchema.safeParse({
        type: 'email',
        message: '',
      }).success
    ).toBe(false);
  });

  it('rejects rule with invalid type', () => {
    expect(
      ValidationRuleSchema.safeParse({
        type: 'custom_unregistered',
        message: 'Error message',
      }).success
    ).toBe(false);
  });
});

describe('FormFieldBindingSchema', () => {
  it('validates a complete form field binding', () => {
    const binding: FormFieldBinding = {
      name: 'email',
      label: 'Work Email Address',
      defaultValue: '',
      validateOn: 'change',
      transform: 'trim',
      rules: [
        { type: 'required', message: 'Email address is required' },
        { type: 'email', message: 'Please enter a valid email format' },
      ],
      required: true,
      disabled: false,
    };

    const result = FormFieldBindingSchema.safeParse(binding);
    expect(result.success).toBe(true);
    expect(isFormFieldBinding(binding)).toBe(true);
  });

  it('applies default validateOn and empty rules array when omitted', () => {
    const minimalBinding = {
      name: 'username',
    };

    const result = FormFieldBindingSchema.safeParse(minimalBinding);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.validateOn).toBe('blur');
      expect(result.data.rules).toEqual([]);
    }
  });

  it('rejects binding with empty name', () => {
    expect(
      FormFieldBindingSchema.safeParse({
        name: '',
      }).success
    ).toBe(false);

    expect(isFormFieldBinding({ name: '' })).toBe(false);
  });
});

describe('FormConfigSchema', () => {
  it('validates container form configuration', () => {
    const config: FormConfig = {
      formId: 'lead_capture_form',
      resetOnSubmit: true,
      scrollToFirstError: true,
      validateOn: 'submit',
      initialValues: {
        country: 'ID',
        newsletter: true,
      },
    };

    const result = FormConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
    expect(isFormConfig(config)).toBe(true);
  });

  it('applies defaults for resetOnSubmit, scrollToFirstError, validateOn', () => {
    const minimalConfig = {
      formId: 'contact_form',
    };

    const result = FormConfigSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.resetOnSubmit).toBe(false);
      expect(result.data.scrollToFirstError).toBe(true);
      expect(result.data.validateOn).toBe('blur');
    }
  });

  it('rejects form configuration without formId', () => {
    expect(FormConfigSchema.safeParse({}).success).toBe(false);
    expect(FormConfigSchema.safeParse({ formId: '' }).success).toBe(false);
    expect(isFormConfig({})).toBe(false);
  });
});
