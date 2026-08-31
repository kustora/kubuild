import type { FormFieldBinding, ValidationRule } from '@kubuild/schema';

/**
 * Checks whether a field value is considered empty.
 * Empty values include undefined, null, empty string, empty array, or boolean false.
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'boolean') {
    return value === false;
  }
  return false;
}

/**
 * Standard safe email validation regex.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Standard safe HTTP/HTTPS URL validation regex.
 */
const URL_REGEX = /^(https?:\/\/)([\w.-]+)(:[0-9]+)?(\/.*)?$/i;

/**
 * Applies a value transformation to a field value prior to validation.
 */
export function applyFieldTransform(
  value: unknown,
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'number' | string,
): unknown {
  if (value === undefined || value === null || !transform) {
    return value;
  }

  if (typeof value === 'string') {
    switch (transform) {
      case 'trim':
        return value.trim();
      case 'lowercase':
        return value.toLowerCase();
      case 'uppercase':
        return value.toUpperCase();
      case 'number': {
        const trimmed = value.trim();
        if (trimmed === '') return value;
        const num = Number(trimmed);
        return Number.isNaN(num) ? value : num;
      }
      default:
        return value;
    }
  }

  if (typeof value === 'number' && transform === 'number') {
    return value;
  }

  return value;
}

/**
 * Evaluates a single validation rule against a field value.
 * Returns the rule's error message if invalid, or null if valid.
 */
export function evaluateRule(
  rule: ValidationRule,
  value: unknown,
  allFormValues?: Record<string, unknown>,
): string | null {
  const isValueEmpty = isEmptyValue(value);

  // For non-required rules, empty values are treated as valid (optional fields)
  if (rule.type !== 'required' && isValueEmpty) {
    return null;
  }

  switch (rule.type) {
    case 'required': {
      if (isValueEmpty) {
        return rule.message;
      }
      return null;
    }

    case 'email': {
      if (typeof value !== 'string' || !EMAIL_REGEX.test(value.trim())) {
        return rule.message;
      }
      return null;
    }

    case 'url': {
      if (typeof value !== 'string' || !URL_REGEX.test(value.trim())) {
        return rule.message;
      }
      return null;
    }

    case 'min_length': {
      const min = Number(rule.value);
      if (Number.isFinite(min)) {
        if (typeof value === 'string' && value.length < min) {
          return rule.message;
        }
        if (Array.isArray(value) && value.length < min) {
          return rule.message;
        }
      }
      return null;
    }

    case 'max_length': {
      const max = Number(rule.value);
      if (Number.isFinite(max)) {
        if (typeof value === 'string' && value.length > max) {
          return rule.message;
        }
        if (Array.isArray(value) && value.length > max) {
          return rule.message;
        }
      }
      return null;
    }

    case 'numeric_min': {
      const min = Number(rule.value);
      const num = Number(value);
      if (Number.isNaN(num) || !Number.isFinite(num) || num < min) {
        return rule.message;
      }
      return null;
    }

    case 'numeric_max': {
      const max = Number(rule.value);
      const num = Number(value);
      if (Number.isNaN(num) || !Number.isFinite(num) || num > max) {
        return rule.message;
      }
      return null;
    }

    case 'pattern':
    case 'custom_regex': {
      try {
        const patternStr = String(rule.value || '');
        const regex = new RegExp(patternStr);
        if (!regex.test(String(value ?? ''))) {
          return rule.message;
        }
      } catch {
        return rule.message;
      }
      return null;
    }

    case 'match_field': {
      const targetFieldName = String(rule.value || '');
      const targetValue = allFormValues?.[targetFieldName];
      if (value !== targetValue) {
        return rule.message;
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Validates a single field value against an array of ValidationRules.
 * Returns the first failing error message, or null if all rules pass.
 */
export function validateFieldValue(
  value: unknown,
  rules?: ValidationRule[] | null,
  allFormValues?: Record<string, unknown>,
): string | null {
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    return null;
  }

  for (const rule of rules) {
    const error = evaluateRule(rule, value, allFormValues);
    if (error) {
      return error;
    }
  }

  return null;
}

/**
 * Asynchronously validates a single field value against an array of ValidationRules.
 */
export async function validateFieldValueAsync(
  value: unknown,
  rules?: ValidationRule[] | null,
  allFormValues?: Record<string, unknown>,
): Promise<string | null> {
  return validateFieldValue(value, rules, allFormValues);
}

/**
 * Validates an entire form values object against field configs.
 * Returns a map of field names to error messages (Record<string, string>).
 * If all fields are valid, returns an empty object {}.
 */
export function validateForm(
  values: Record<string, unknown>,
  fieldConfigs:
    | FormFieldBinding[]
    | Record<string, FormFieldBinding | ValidationRule[]>,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!fieldConfigs) {
    return errors;
  }

  if (Array.isArray(fieldConfigs)) {
    for (const field of fieldConfigs) {
      if (!field?.name) continue;

      let value = values?.[field.name];
      if (field.transform) {
        value = applyFieldTransform(value, field.transform);
      }

      const rules: ValidationRule[] = [...(field.rules || [])];

      // Handle shorthand `required: true` if not already present in rules
      if (field.required && !rules.some((r) => r.type === 'required')) {
        rules.unshift({
          type: 'required',
          message: `${field.label || field.name} is required`,
        });
      }

      const error = validateFieldValue(value, rules, values);
      if (error) {
        errors[field.name] = error;
      }
    }
  } else if (typeof fieldConfigs === 'object') {
    for (const [fieldName, config] of Object.entries(fieldConfigs)) {
      let value = values?.[fieldName];
      let rules: ValidationRule[] = [];

      if (Array.isArray(config)) {
        rules = config;
      } else if (config && typeof config === 'object') {
        if (config.transform) {
          value = applyFieldTransform(value, config.transform);
        }
        rules = [...(config.rules || [])];
        if (config.required && !rules.some((r) => r.type === 'required')) {
          rules.unshift({
            type: 'required',
            message: `${config.label || fieldName} is required`,
          });
        }
      }

      const error = validateFieldValue(value, rules, values);
      if (error) {
        errors[fieldName] = error;
      }
    }
  }

  return errors;
}

/**
 * Asynchronously validates an entire form values object against field configs.
 */
export async function validateFormAsync(
  values: Record<string, unknown>,
  fieldConfigs:
    | FormFieldBinding[]
    | Record<string, FormFieldBinding | ValidationRule[]>,
): Promise<Record<string, string>> {
  return validateForm(values, fieldConfigs);
}

/**
 * Convenience helper to determine if a form error map is completely valid (no errors).
 */
export function isFormValid(errors: Record<string, string>): boolean {
  return Object.keys(errors).length === 0;
}

