import { z } from 'zod';

/**
 * Validation Rule Types
 * Supported validation primitives for form inputs in KUBUILD.
 */
export const ValidationRuleTypeSchema = z.enum([
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
]);

export type ValidationRuleType = z.infer<typeof ValidationRuleTypeSchema>;

/**
 * Validation Trigger Timing
 * Controls when field validation is evaluated.
 */
export const ValidateOnEventSchema = z.enum(['blur', 'change', 'submit']);
export type ValidateOnEvent = z.infer<typeof ValidateOnEventSchema>;

/**
 * Validation Rule Schema
 * Defines an individual validation condition and its custom error message.
 */
export const ValidationRuleSchema = z.object({
  type: ValidationRuleTypeSchema,
  value: z.unknown().optional(),
  message: z.string().min(1, 'Validation error message cannot be empty'),
});

export type ValidationRule = z.infer<typeof ValidationRuleSchema>;

/**
 * Form Field Binding Schema
 * Connects an input component to the form state runtime with validation rules and initial values.
 */
export const FormFieldBindingSchema = z.object({
  name: z.string().min(1, 'Field name cannot be empty'),
  label: z.string().optional(),
  defaultValue: z.unknown().optional(),
  rules: z.array(ValidationRuleSchema).optional().default([]),
  validateOn: ValidateOnEventSchema.optional().default('blur'),
  transform: z.enum(['trim', 'lowercase', 'uppercase', 'number']).optional(),
  disabled: z.boolean().optional(),
  required: z.boolean().optional(),
});

export type FormFieldBinding = z.infer<typeof FormFieldBindingSchema>;

/**
 * Form Container Configuration Schema
 * Configuration for form boundaries, submission behavior, and error focus.
 */
export const FormConfigSchema = z.object({
  formId: z.string().min(1, 'Form ID cannot be empty'),
  resetOnSubmit: z.boolean().optional().default(false),
  scrollToFirstError: z.boolean().optional().default(true),
  validateOn: ValidateOnEventSchema.optional().default('blur'),
  initialValues: z.record(z.string(), z.unknown()).optional(),
  rules: z.array(ValidationRuleSchema).optional(),
});

export type FormConfig = z.infer<typeof FormConfigSchema>;

/**
 * Type Guards
 */
export function isValidationRuleType(value: unknown): value is ValidationRuleType {
  return ValidationRuleTypeSchema.safeParse(value).success;
}

export function isValidationRule(value: unknown): value is ValidationRule {
  return ValidationRuleSchema.safeParse(value).success;
}

export function isValidateOnEvent(value: unknown): value is ValidateOnEvent {
  return ValidateOnEventSchema.safeParse(value).success;
}

export function isFormFieldBinding(value: unknown): value is FormFieldBinding {
  return FormFieldBindingSchema.safeParse(value).success;
}

export function isFormConfig(value: unknown): value is FormConfig {
  return FormConfigSchema.safeParse(value).success;
}
