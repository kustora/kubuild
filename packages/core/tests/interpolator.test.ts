import { describe, it, expect } from 'vitest';
import {
  resolvePropertyPath,
  hasTemplateExpressions,
  extractTemplateVariables,
  interpolateTemplateString,
  interpolateValue,
  type InterpolationContext,
} from '../src/interpolator';

describe('STORA-310: Template & Expression Variable Interpolator', () => {
  const sampleContext: InterpolationContext = {
    form: {
      email: 'john.doe@example.com',
      age: 28,
      isActive: true,
      user: {
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          address: {
            city: 'Jakarta',
            zip: 12345,
          },
        },
      },
      tags: ['developer', 'builder'],
    },
    variables: {
      apiToken: 'secret_token_xyz',
      baseUrl: 'https://api.example.com',
    },
    response: {
      status: 200,
      data: {
        id: 'resp_999',
        items: [
          { sku: 'PROD-1', price: 150000 },
          { sku: 'PROD-2', price: 350000 },
        ],
      },
    },
  };

  describe('resolvePropertyPath', () => {
    it('resolves top-level and shallow properties', () => {
      expect(resolvePropertyPath(sampleContext, 'form.email')).toBe('john.doe@example.com');
      expect(resolvePropertyPath(sampleContext, 'variables.apiToken')).toBe('secret_token_xyz');
      expect(resolvePropertyPath(sampleContext, 'response.status')).toBe(200);
    });

    it('resolves deeply nested object properties', () => {
      expect(resolvePropertyPath(sampleContext, 'form.user.profile.firstName')).toBe('John');
      expect(resolvePropertyPath(sampleContext, 'form.user.profile.address.city')).toBe('Jakarta');
      expect(resolvePropertyPath(sampleContext, 'form.user.profile.address.zip')).toBe(12345);
    });

    it('resolves array elements using dot and bracket notation', () => {
      expect(resolvePropertyPath(sampleContext, 'form.tags.0')).toBe('developer');
      expect(resolvePropertyPath(sampleContext, 'form.tags[1]')).toBe('builder');
      expect(resolvePropertyPath(sampleContext, 'response.data.items[0].sku')).toBe('PROD-1');
      expect(resolvePropertyPath(sampleContext, 'response.data.items.1.price')).toBe(350000);
    });

    it('returns fallback string for missing properties without throwing', () => {
      expect(resolvePropertyPath(sampleContext, 'form.nonExistent')).toBe('');
      expect(resolvePropertyPath(sampleContext, 'form.user.profile.missingField')).toBe('');
      expect(resolvePropertyPath(sampleContext, 'unknownRoot.child.grandchild')).toBe('');
      expect(resolvePropertyPath(sampleContext, 'response.data.items[10].sku')).toBe('');
      expect(resolvePropertyPath(sampleContext, 'form.tags[-1]')).toBe('');
    });

    it('supports custom fallback value', () => {
      expect(resolvePropertyPath(sampleContext, 'form.missing', 'DEFAULT')).toBe('DEFAULT');
      expect(resolvePropertyPath(sampleContext, 'form.missingNumber', 0)).toBe(0);
      expect(resolvePropertyPath(sampleContext, 'form.missingObject', null)).toBe(null);
    });

    it('blocks prototype pollution and forbidden properties', () => {
      expect(resolvePropertyPath(sampleContext, '__proto__')).toBe('');
      expect(resolvePropertyPath(sampleContext, 'form.__proto__.polluted')).toBe('');
      expect(resolvePropertyPath(sampleContext, 'constructor')).toBe('');
      expect(resolvePropertyPath(sampleContext, 'form.constructor.name')).toBe('');
      expect(resolvePropertyPath(sampleContext, 'prototype')).toBe('');
    });

    it('handles null, undefined, or primitive sources gracefully', () => {
      expect(resolvePropertyPath(null, 'any.path')).toBe('');
      expect(resolvePropertyPath(undefined, 'any.path')).toBe('');
      expect(resolvePropertyPath(12345, 'any.path')).toBe('');
      expect(resolvePropertyPath(sampleContext, '')).toBe('');
      expect(resolvePropertyPath(sampleContext, '   ')).toBe('');
    });

    it('ignores function values to prevent unintended code execution', () => {
      const contextWithFunction = {
        calc: () => 42,
        nested: {
          fn: () => 'evil',
        },
      };
      expect(resolvePropertyPath(contextWithFunction, 'calc')).toBe('');
      expect(resolvePropertyPath(contextWithFunction, 'nested.fn')).toBe('');
    });
  });

  describe('hasTemplateExpressions & extractTemplateVariables', () => {
    it('detects presence of template expressions', () => {
      expect(hasTemplateExpressions('Hello {{form.name}}')).toBe(true);
      expect(hasTemplateExpressions('{{ variables.token }}')).toBe(true);
      expect(hasTemplateExpressions('Static plain text')).toBe(false);
      expect(hasTemplateExpressions('')).toBe(false);
      expect(hasTemplateExpressions(null)).toBe(false);
      expect(hasTemplateExpressions(123)).toBe(false);
    });

    it('extracts all unique template variable keys', () => {
      const template = 'User: {{form.email}}, Site: {{ variables.baseUrl }}/users/{{form.email}}';
      const extracted = extractTemplateVariables(template);
      expect(extracted).toEqual(['form.email', 'variables.baseUrl']);
    });

    it('handles empty or non-string templates in extraction', () => {
      expect(extractTemplateVariables('')).toEqual([]);
      expect(extractTemplateVariables(null as any)).toEqual([]);
    });
  });

  describe('interpolateTemplateString', () => {
    it('interpolates single and multiple variables into a string', () => {
      const single = interpolateTemplateString('Welcome, {{form.user.profile.firstName}}!', sampleContext);
      expect(single).toBe('Welcome, John!');

      const multi = interpolateTemplateString(
        '{{variables.baseUrl}}/v1/users/{{form.user.profile.address.city}}?token={{variables.apiToken}}',
        sampleContext
      );
      expect(multi).toBe('https://api.example.com/v1/users/Jakarta?token=secret_token_xyz');
    });

    it('replaces missing keys with empty string or custom fallback', () => {
      const withMissing = interpolateTemplateString('Hello {{form.missing}}!', sampleContext);
      expect(withMissing).toBe('Hello !');

      const withCustomFallback = interpolateTemplateString(
        'Dear {{form.nonExistent}}, welcome!',
        sampleContext,
        'Valued Customer'
      );
      expect(withCustomFallback).toBe('Dear Valued Customer, welcome!');
    });

    it('stringifies object and array values when interpolated into a text template', () => {
      const result = interpolateTemplateString('Tags: {{form.tags}}', sampleContext);
      expect(result).toBe('Tags: ["developer","builder"]');
    });

    it('handles static strings and non-string inputs cleanly', () => {
      expect(interpolateTemplateString('No variables here', sampleContext)).toBe('No variables here');
      expect(interpolateTemplateString('', sampleContext)).toBe('');
      expect(interpolateTemplateString(null as any, sampleContext)).toBe('');
    });
  });

  describe('interpolateValue (Deep & Exact Type Preservation)', () => {
    it('preserves native types for exact single expression strings', () => {
      expect(interpolateValue('{{form.age}}', sampleContext)).toBe(28);
      expect(interpolateValue('{{form.isActive}}', sampleContext)).toBe(true);
      expect(interpolateValue('{{form.tags}}', sampleContext)).toEqual(['developer', 'builder']);
      expect(interpolateValue('{{response.data}}', sampleContext)).toEqual({
        id: 'resp_999',
        items: [
          { sku: 'PROD-1', price: 150000 },
          { sku: 'PROD-2', price: 350000 },
        ],
      });
    });

    it('interpolates embedded string templates inside strings', () => {
      expect(interpolateValue('Bearer {{variables.apiToken}}', sampleContext)).toBe('Bearer secret_token_xyz');
    });

    it('recursively interpolates array items', () => {
      const arrayToInterpolate = [
        '{{variables.baseUrl}}',
        '{{form.age}}',
        'Static Item',
        ['{{form.user.profile.firstName}}', '{{form.user.profile.lastName}}'],
      ];

      const result = interpolateValue(arrayToInterpolate, sampleContext);
      expect(result).toEqual([
        'https://api.example.com',
        28,
        'Static Item',
        ['John', 'Doe'],
      ]);
    });

    it('recursively interpolates object properties (e.g. API request payloads)', () => {
      const apiPayload = {
        url: '{{variables.baseUrl}}/leads',
        method: 'POST',
        headers: {
          Authorization: 'Bearer {{variables.apiToken}}',
          'Content-Type': 'application/json',
        },
        body: {
          userEmail: '{{form.email}}',
          fullName: '{{form.user.profile.firstName}} {{form.user.profile.lastName}}',
          age: '{{form.age}}',
          active: '{{form.isActive}}',
          city: '{{form.user.profile.address.city}}',
          cart: '{{response.data.items}}',
        },
      };

      const result = interpolateValue(apiPayload, sampleContext) as typeof apiPayload;
      expect(result.url).toBe('https://api.example.com/leads');
      expect(result.headers.Authorization).toBe('Bearer secret_token_xyz');
      expect(result.body.userEmail).toBe('john.doe@example.com');
      expect(result.body.fullName).toBe('John Doe');
      expect(result.body.age).toBe(28);
      expect(result.body.active).toBe(true);
      expect(result.body.city).toBe('Jakarta');
      expect(result.body.cart).toEqual([
        { sku: 'PROD-1', price: 150000 },
        { sku: 'PROD-2', price: 350000 },
      ]);
    });

    it('passes through primitives, null, and undefined unchanged', () => {
      expect(interpolateValue(null, sampleContext)).toBe(null);
      expect(interpolateValue(undefined, sampleContext)).toBe(undefined);
      expect(interpolateValue(42, sampleContext)).toBe(42);
      expect(interpolateValue(false, sampleContext)).toBe(false);
    });

    it('protects objects against forbidden prototype keys', () => {
      const objWithProto = {
        safeKey: '{{form.email}}',
        __proto__: { evil: true },
      };
      const result = interpolateValue(objWithProto, sampleContext) as any;
      expect(result.safeKey).toBe('john.doe@example.com');
      expect(Object.prototype.hasOwnProperty.call(result, '__proto__')).toBe(false);
    });
  });
});

