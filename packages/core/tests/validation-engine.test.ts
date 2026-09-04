import { describe, it, expect } from 'vitest';
import type { FormFieldBinding, ValidationRule } from '@kubuild/schema';
import {
  isEmptyValue,
  applyFieldTransform,
  validateFieldValue,
  validateFieldValueAsync,
  validateForm,
  validateFormAsync,
  isFormValid,
} from '../src/validation/validation-engine';

describe('STORA-311: Form Validation Engine (ValidationEngine)', () => {
  describe('isEmptyValue', () => {
    it('identifies empty values correctly', () => {
      expect(isEmptyValue(undefined)).toBe(true);
      expect(isEmptyValue(null)).toBe(true);
      expect(isEmptyValue('')).toBe(true);
      expect(isEmptyValue('   ')).toBe(true);
      expect(isEmptyValue([])).toBe(true);
      expect(isEmptyValue(false)).toBe(true);
    });

    it('identifies non-empty values correctly', () => {
      expect(isEmptyValue('hello')).toBe(false);
      expect(isEmptyValue(0)).toBe(false);
      expect(isEmptyValue(true)).toBe(false);
      expect(isEmptyValue(['item'])).toBe(false);
      expect(isEmptyValue({ key: 'val' })).toBe(false);
    });
  });

  describe('applyFieldTransform', () => {
    it('applies trim transformation', () => {
      expect(applyFieldTransform('  hello world  ', 'trim')).toBe('hello world');
    });

    it('applies lowercase transformation', () => {
      expect(applyFieldTransform('HeLLo WoRLd', 'lowercase')).toBe('hello world');
    });

    it('applies uppercase transformation', () => {
      expect(applyFieldTransform('hello world', 'uppercase')).toBe('HELLO WORLD');
    });

    it('applies number transformation', () => {
      expect(applyFieldTransform('123', 'number')).toBe(123);
      expect(applyFieldTransform('123.45', 'number')).toBe(123.45);
      expect(applyFieldTransform('-50', 'number')).toBe(-50);
      expect(applyFieldTransform('', 'number')).toBe('');
      expect(applyFieldTransform('not_a_number', 'number')).toBe('not_a_number');
      expect(applyFieldTransform(42, 'number')).toBe(42);
    });

    it('passes through non-string or unknown transform values', () => {
      expect(applyFieldTransform(null, 'trim')).toBe(null);
      expect(applyFieldTransform(123, 'uppercase')).toBe(123);
      expect(applyFieldTransform('value', undefined)).toBe('value');
    });
  });

  describe('validateFieldValue (Rule Evaluations)', () => {
    it('evaluates required rule', () => {
      const rule: ValidationRule = { type: 'required', message: 'Field is required' };
      expect(validateFieldValue('', [rule])).toBe('Field is required');
      expect(validateFieldValue('   ', [rule])).toBe('Field is required');
      expect(validateFieldValue(null, [rule])).toBe('Field is required');
      expect(validateFieldValue(undefined, [rule])).toBe('Field is required');
      expect(validateFieldValue([], [rule])).toBe('Field is required');
      expect(validateFieldValue(false, [rule])).toBe('Field is required');

      expect(validateFieldValue('John', [rule])).toBeNull();
      expect(validateFieldValue(0, [rule])).toBeNull();
      expect(validateFieldValue(true, [rule])).toBeNull();
      expect(validateFieldValue(['a'], [rule])).toBeNull();
    });

    it('evaluates email rule', () => {
      const rule: ValidationRule = { type: 'email', message: 'Invalid email address' };
      expect(validateFieldValue('user@example.com', [rule])).toBeNull();
      expect(validateFieldValue('test.user+tag@domain.co.id', [rule])).toBeNull();

      expect(validateFieldValue('invalid_email', [rule])).toBe('Invalid email address');
      expect(validateFieldValue('user@', [rule])).toBe('Invalid email address');
      expect(validateFieldValue('@domain.com', [rule])).toBe('Invalid email address');
      expect(validateFieldValue(12345, [rule])).toBe('Invalid email address');

      // Empty value on optional email passes
      expect(validateFieldValue('', [rule])).toBeNull();
      expect(validateFieldValue(null, [rule])).toBeNull();
    });

    it('evaluates url rule', () => {
      const rule: ValidationRule = { type: 'url', message: 'Invalid URL format' };
      expect(validateFieldValue('https://stora.page', [rule])).toBeNull();
      expect(validateFieldValue('http://localhost:3000/api', [rule])).toBeNull();

      expect(validateFieldValue('not-a-url', [rule])).toBe('Invalid URL format');
      expect(validateFieldValue('javascript:alert(1)', [rule])).toBe('Invalid URL format');
      expect(validateFieldValue('', [rule])).toBeNull();
    });

    it('evaluates min_length rule on strings and arrays', () => {
      const rule: ValidationRule = { type: 'min_length', value: 5, message: 'Minimum 5 characters required' };
      expect(validateFieldValue('12345', [rule])).toBeNull();
      expect(validateFieldValue('123456', [rule])).toBeNull();
      expect(validateFieldValue('1234', [rule])).toBe('Minimum 5 characters required');

      expect(validateFieldValue(['a', 'b', 'c', 'd', 'e'], [rule])).toBeNull();
      expect(validateFieldValue(['a', 'b'], [rule])).toBe('Minimum 5 characters required');
      expect(validateFieldValue('', [rule])).toBeNull();
    });

    it('evaluates max_length rule on strings and arrays', () => {
      const rule: ValidationRule = { type: 'max_length', value: 5, message: 'Maximum 5 characters allowed' };
      expect(validateFieldValue('12345', [rule])).toBeNull();
      expect(validateFieldValue('1234', [rule])).toBeNull();
      expect(validateFieldValue('123456', [rule])).toBe('Maximum 5 characters allowed');

      expect(validateFieldValue(['a', 'b'], [rule])).toBeNull();
      expect(validateFieldValue(['a', 'b', 'c', 'd', 'e', 'f'], [rule])).toBe('Maximum 5 characters allowed');
    });

    it('evaluates numeric_min and numeric_max rules', () => {
      const minRule: ValidationRule = { type: 'numeric_min', value: 18, message: 'Must be at least 18' };
      const maxRule: ValidationRule = { type: 'numeric_max', value: 65, message: 'Must be at most 65' };

      expect(validateFieldValue(18, [minRule])).toBeNull();
      expect(validateFieldValue('25', [minRule])).toBeNull();
      expect(validateFieldValue(17, [minRule])).toBe('Must be at least 18');
      expect(validateFieldValue('15', [minRule])).toBe('Must be at least 18');
      expect(validateFieldValue('not_a_num', [minRule])).toBe('Must be at least 18');

      expect(validateFieldValue(65, [maxRule])).toBeNull();
      expect(validateFieldValue('50', [maxRule])).toBeNull();
      expect(validateFieldValue(66, [maxRule])).toBe('Must be at most 65');
      expect(validateFieldValue('70', [maxRule])).toBe('Must be at most 65');
    });

    it('evaluates pattern and custom_regex rules', () => {
      const patternRule: ValidationRule = {
        type: 'pattern',
        value: '^[A-Z]{3}-[0-9]{3}$',
        message: 'Must match format ABC-123',
      };
      const customRegexRule: ValidationRule = {
        type: 'custom_regex',
        value: '^KU-[0-9]+$',
        message: 'Must start with KU-',
      };

      expect(validateFieldValue('ABC-123', [patternRule])).toBeNull();
      expect(validateFieldValue('abc-123', [patternRule])).toBe('Must match format ABC-123');
      expect(validateFieldValue('ABCD-12', [patternRule])).toBe('Must match format ABC-123');

      expect(validateFieldValue('KU-999', [customRegexRule])).toBeNull();
      expect(validateFieldValue('ST-999', [customRegexRule])).toBe('Must start with KU-');
    });

    it('evaluates match_field rule against other form values', () => {
      const matchRule: ValidationRule = {
        type: 'match_field',
        value: 'password',
        message: 'Passwords must match',
      };

      const formValues = {
        password: 'SuperSecretPassword123',
      };

      expect(validateFieldValue('SuperSecretPassword123', [matchRule], formValues)).toBeNull();
      expect(validateFieldValue('WrongPassword', [matchRule], formValues)).toBe('Passwords must match');
    });

    it('returns the first failing rule when multiple rules exist', () => {
      const rules: ValidationRule[] = [
        { type: 'required', message: 'Email is required' },
        { type: 'email', message: 'Invalid email' },
        { type: 'min_length', value: 10, message: 'Email must be at least 10 chars' },
      ];

      expect(validateFieldValue('', rules)).toBe('Email is required');
      expect(validateFieldValue('abc', rules)).toBe('Invalid email');
      expect(validateFieldValue('a@b.co', rules)).toBe('Email must be at least 10 chars');
      expect(validateFieldValue('john.doe@example.com', rules)).toBeNull();
    });

    it('handles empty or missing rules gracefully', () => {
      expect(validateFieldValue('any value', [])).toBeNull();
      expect(validateFieldValue('any value', null)).toBeNull();
      expect(validateFieldValue('any value', undefined)).toBeNull();
    });

    it('handles invalid regex safely without throwing exceptions', () => {
      const badRegexRule: ValidationRule = {
        type: 'custom_regex',
        value: '[invalid(regex',
        message: 'Regex evaluation error',
      };
      expect(validateFieldValue('test', [badRegexRule])).toBe('Regex evaluation error');
    });
  });

  describe('validateFieldValueAsync', () => {
    it('resolves asynchronously to error or null', async () => {
      const rules: ValidationRule[] = [{ type: 'required', message: 'Required field' }];
      await expect(validateFieldValueAsync('', rules)).resolves.toBe('Required field');
      await expect(validateFieldValueAsync('Valid', rules)).resolves.toBeNull();
    });
  });

  describe('validateForm & validateFormAsync', () => {
    const fieldsConfig: FormFieldBinding[] = [
      {
        name: 'username',
        label: 'Username',
        required: true,
        transform: 'trim',
        rules: [{ type: 'min_length', value: 3, message: 'Username must be at least 3 chars' }],
      },
      {
        name: 'email',
        label: 'Email',
        transform: 'lowercase',
        rules: [
          { type: 'required', message: 'Email is required' },
          { type: 'email', message: 'Please enter a valid email' },
        ],
      },
      {
        name: 'age',
        label: 'Age',
        transform: 'number',
        rules: [{ type: 'numeric_min', value: 18, message: 'You must be at least 18 years old' }],
      },
      {
        name: 'password',
        required: true,
        rules: [{ type: 'min_length', value: 6, message: 'Password min 6 chars' }],
      },
      {
        name: 'password_confirm',
        rules: [{ type: 'match_field', value: 'password', message: 'Passwords must match' }],
      },
    ];

    it('validates all fields in FormFieldBinding array and returns errors map', () => {
      const invalidValues = {
        username: '  ',
        email: 'INVALID_EMAIL',
        age: '15',
        password: 'pass',
        password_confirm: 'other_pass',
      };

      const errors = validateForm(invalidValues, fieldsConfig);
      expect(isFormValid(errors)).toBe(false);
      expect(errors.username).toBe('Username is required');
      expect(errors.email).toBe('Please enter a valid email');
      expect(errors.age).toBe('You must be at least 18 years old');
      expect(errors.password).toBe('Password min 6 chars');
      expect(errors.password_confirm).toBe('Passwords must match');
    });

    it('returns empty errors map when all values are valid', () => {
      const validValues = {
        username: '  john_doe  ',
        email: 'JOHN.DOE@EXAMPLE.COM',
        age: '25',
        password: 'password123',
        password_confirm: 'password123',
      };

      const errors = validateForm(validValues, fieldsConfig);
      expect(isFormValid(errors)).toBe(true);
      expect(errors).toEqual({});
    });

    it('supports record map of field configs and rule arrays', () => {
      const configMap: Record<string, FormFieldBinding | ValidationRule[]> = {
        title: {
          name: 'title',
          required: true,
          label: 'Article Title',
        },
        slug: [{ type: 'required', message: 'Slug is required' }],
      };

      const values = { title: '', slug: '' };
      const errors = validateForm(values, configMap);

      expect(errors.title).toBe('Article Title is required');
      expect(errors.slug).toBe('Slug is required');
    });

    it('asynchronously validates form values with validateFormAsync', async () => {
      const values = {
        username: 'valid_user',
        email: 'user@example.com',
        age: 20,
        password: 'password123',
        password_confirm: 'password123',
      };

      const errors = await validateFormAsync(values, fieldsConfig);
      expect(isFormValid(errors)).toBe(true);
      expect(errors).toEqual({});
    });

    it('handles empty or missing fieldConfigs gracefully', () => {
      expect(validateForm({}, null as any)).toEqual({});
      expect(validateForm({}, undefined as any)).toEqual({});
    });
  });
});

