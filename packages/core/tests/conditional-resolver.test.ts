import { describe, expect, it } from 'vitest';
import {
  evaluateCondition,
  evaluateConditionGroup,
  evaluateConditions,
  evaluateOperator,
  isConditionGroup,
  isValueEmpty,
} from '../src/conditional-resolver';

describe('STORA-313: Conditional Logic Resolver', () => {
  describe('isValueEmpty', () => {
    it('identifies empty and non-empty values accurately', () => {
      expect(isValueEmpty(undefined)).toBe(true);
      expect(isValueEmpty(null)).toBe(true);
      expect(isValueEmpty('')).toBe(true);
      expect(isValueEmpty('   ')).toBe(true);
      expect(isValueEmpty([])).toBe(true);
      expect(isValueEmpty({})).toBe(true);

      expect(isValueEmpty('hello')).toBe(false);
      expect(isValueEmpty(0)).toBe(false);
      expect(isValueEmpty(false)).toBe(false);
      expect(isValueEmpty([1])).toBe(false);
      expect(isValueEmpty({ a: 1 })).toBe(false);
    });
  });

  describe('evaluateOperator', () => {
    describe('equals & not_equals', () => {
      it('evaluates strict and coerced equality for numbers and numeric strings', () => {
        expect(evaluateOperator('equals', 'hello', 'hello')).toBe(true);
        expect(evaluateOperator('equals', 'hello', 'world')).toBe(false);
        expect(evaluateOperator('equals', 42, 42)).toBe(true);
        expect(evaluateOperator('equals', 42, '42')).toBe(true);
        expect(evaluateOperator('equals', '42', 42)).toBe(true);
        expect(evaluateOperator('equals', 42, '43')).toBe(false);

        expect(evaluateOperator('not_equals', 'hello', 'world')).toBe(true);
        expect(evaluateOperator('not_equals', 42, '42')).toBe(false);
      });

      it('evaluates boolean string coercion', () => {
        expect(evaluateOperator('equals', true, 'true')).toBe(true);
        expect(evaluateOperator('equals', false, 'false')).toBe(true);
        expect(evaluateOperator('equals', 'true', true)).toBe(true);
        expect(evaluateOperator('equals', 'false', false)).toBe(true);
        expect(evaluateOperator('equals', true, 'false')).toBe(false);
      });

      it('supports caseInsensitive and trimStrings options', () => {
        expect(
          evaluateOperator('equals', ' Hello ', 'hello', {
            trimStrings: true,
            caseInsensitive: true,
          }),
        ).toBe(true);
      });
    });

    describe('is_truthy & is_falsy', () => {
      it('evaluates truthiness across various data types', () => {
        expect(evaluateOperator('is_truthy', true)).toBe(true);
        expect(evaluateOperator('is_truthy', 'non-empty')).toBe(true);
        expect(evaluateOperator('is_truthy', 100)).toBe(true);
        expect(evaluateOperator('is_truthy', [1, 2])).toBe(true);
        expect(evaluateOperator('is_truthy', { key: 'val' })).toBe(true);

        expect(evaluateOperator('is_truthy', false)).toBe(false);
        expect(evaluateOperator('is_truthy', '')).toBe(false);
        expect(evaluateOperator('is_truthy', 0)).toBe(false);
        expect(evaluateOperator('is_truthy', null)).toBe(false);
        expect(evaluateOperator('is_truthy', undefined)).toBe(false);
        expect(evaluateOperator('is_truthy', [])).toBe(false);
        expect(evaluateOperator('is_truthy', {})).toBe(false);
      });

      it('evaluates falsiness as the inverse of truthiness', () => {
        expect(evaluateOperator('is_falsy', false)).toBe(true);
        expect(evaluateOperator('is_falsy', '')).toBe(true);
        expect(evaluateOperator('is_falsy', [])).toBe(true);
        expect(evaluateOperator('is_falsy', {})).toBe(true);
        expect(evaluateOperator('is_falsy', true)).toBe(false);
        expect(evaluateOperator('is_falsy', 'text')).toBe(false);
      });
    });

    describe('is_empty & is_not_empty', () => {
      it('evaluates empty state for strings, arrays, objects, null, undefined', () => {
        expect(evaluateOperator('is_empty', '')).toBe(true);
        expect(evaluateOperator('is_empty', '   ')).toBe(true);
        expect(evaluateOperator('is_empty', [])).toBe(true);
        expect(evaluateOperator('is_empty', {})).toBe(true);
        expect(evaluateOperator('is_empty', null)).toBe(true);
        expect(evaluateOperator('is_empty', undefined)).toBe(true);

        expect(evaluateOperator('is_empty', 'abc')).toBe(false);
        expect(evaluateOperator('is_empty', [1])).toBe(false);
        expect(evaluateOperator('is_empty', 0)).toBe(false);

        expect(evaluateOperator('is_not_empty', 'abc')).toBe(true);
        expect(evaluateOperator('is_not_empty', '')).toBe(false);
      });
    });

    describe('contains & not_contains', () => {
      it('evaluates string substring containment', () => {
        expect(evaluateOperator('contains', 'The quick brown fox', 'quick')).toBe(true);
        expect(evaluateOperator('contains', 'The quick brown fox', 'lazy')).toBe(false);
        expect(
          evaluateOperator('contains', 'Hello World', 'world', { caseInsensitive: true }),
        ).toBe(true);
      });

      it('evaluates array item containment', () => {
        expect(evaluateOperator('contains', ['apple', 'banana', 'orange'], 'banana')).toBe(true);
        expect(evaluateOperator('contains', ['apple', 'banana', 'orange'], 'grape')).toBe(false);
        expect(
          evaluateOperator('contains', ['Apple', 'Banana'], 'banana', { caseInsensitive: true }),
        ).toBe(true);
      });

      it('evaluates object key containment', () => {
        expect(evaluateOperator('contains', { id: 1, role: 'admin' }, 'role')).toBe(true);
        expect(evaluateOperator('contains', { id: 1, role: 'admin' }, 'email')).toBe(false);
      });

      it('evaluates not_contains correctly', () => {
        expect(evaluateOperator('not_contains', 'example.com', 'google')).toBe(true);
        expect(evaluateOperator('not_contains', 'example.com', 'example')).toBe(false);
      });
    });

    describe('starts_with & ends_with', () => {
      it('evaluates starts_with and ends_with accurately', () => {
        expect(evaluateOperator('starts_with', 'https://example.com', 'https://')).toBe(true);
        expect(evaluateOperator('starts_with', 'http://example.com', 'https://')).toBe(false);
        expect(
          evaluateOperator('starts_with', 'HTTPS://example.com', 'https://', {
            caseInsensitive: true,
          }),
        ).toBe(true);

        expect(evaluateOperator('ends_with', 'image.png', '.png')).toBe(true);
        expect(evaluateOperator('ends_with', 'image.jpg', '.png')).toBe(false);
        expect(
          evaluateOperator('ends_with', 'IMAGE.PNG', '.png', { caseInsensitive: true }),
        ).toBe(true);
      });
    });

    describe('numeric comparisons: gt, gte, lt, lte', () => {
      it('evaluates numbers and numeric strings', () => {
        expect(evaluateOperator('gt', 10, 5)).toBe(true);
        expect(evaluateOperator('gt', '10', 5)).toBe(true);
        expect(evaluateOperator('gt', 5, 10)).toBe(false);
        expect(evaluateOperator('gt', 10, 10)).toBe(false);

        expect(evaluateOperator('gte', 10, 10)).toBe(true);
        expect(evaluateOperator('gte', 15, 10)).toBe(true);
        expect(evaluateOperator('gte', 9, 10)).toBe(false);

        expect(evaluateOperator('lt', 5, 10)).toBe(true);
        expect(evaluateOperator('lt', '5.5', 10)).toBe(true);
        expect(evaluateOperator('lt', 10, 5)).toBe(false);

        expect(evaluateOperator('lte', 10, 10)).toBe(true);
        expect(evaluateOperator('lte', 5, 10)).toBe(true);
        expect(evaluateOperator('lte', 11, 10)).toBe(false);
      });

      it('returns false for non-numeric values that cannot be parsed', () => {
        expect(evaluateOperator('gt', 'abc', 5)).toBe(false);
        expect(evaluateOperator('lt', 5, 'xyz')).toBe(false);
      });
    });

    describe('in & not_in', () => {
      it('evaluates membership in arrays and strings', () => {
        expect(evaluateOperator('in', 'admin', ['admin', 'manager', 'editor'])).toBe(true);
        expect(evaluateOperator('in', 'guest', ['admin', 'manager', 'editor'])).toBe(false);
        expect(
          evaluateOperator('in', 'Admin', ['admin', 'manager'], { caseInsensitive: true }),
        ).toBe(true);

        expect(evaluateOperator('in', 'test', 'this is a test string')).toBe(true);
        expect(evaluateOperator('not_in', 'guest', ['admin', 'manager'])).toBe(true);
        expect(evaluateOperator('not_in', 'admin', ['admin', 'manager'])).toBe(false);
      });
    });

    describe('regex', () => {
      it('evaluates regex patterns safely and handles invalid patterns gracefully', () => {
        expect(evaluateOperator('regex', 'john.doe@example.com', '^[a-z.]+@example\\.com$')).toBe(
          true,
        );
        expect(evaluateOperator('regex', 'john.doe@gmail.com', '^[a-z.]+@example\\.com$')).toBe(
          false,
        );
        expect(
          evaluateOperator('regex', 'HELLO', 'hello', { caseInsensitive: true }),
        ).toBe(true);

        // Invalid regex should return false and not throw
        expect(evaluateOperator('regex', 'value', '[a-z(')).toBe(false);
      });
    });
  });

  describe('evaluateCondition', () => {
    it('evaluates condition against deep context and template syntax', () => {
      const context = {
        form: {
          user: {
            profile: {
              age: 28,
              status: 'active',
              skills: ['react', 'typescript'],
            },
          },
        },
        response: {
          status: 200,
          data: { success: true },
        },
        variables: {
          featureFlag: true,
        },
      };

      expect(
        evaluateCondition(
          { field: 'form.user.profile.age', operator: 'gte', value: 18 },
          context,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          { field: '{{form.user.profile.status}}', operator: 'equals', value: 'active' },
          context,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          { field: 'form.user.profile.skills', operator: 'contains', value: 'typescript' },
          context,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          { field: 'response.status', operator: 'equals', value: 200 },
          context,
        ),
      ).toBe(true);

      expect(
        evaluateCondition(
          { field: 'variables.featureFlag', operator: 'is_truthy' },
          context,
        ),
      ).toBe(true);
    });

    it('returns true when condition is undefined or field is empty', () => {
      expect(evaluateCondition(undefined, {})).toBe(true);
      expect(evaluateCondition({ field: '', operator: 'equals', value: 'test' }, {})).toBe(true);
    });
  });

  describe('evaluateConditionGroup & evaluateConditions', () => {
    it('evaluates AND combinator correctly', () => {
      const context = {
        form: { age: 25, hasConsent: true, country: 'ID' },
      };

      const group = {
        combinator: 'and' as const,
        conditions: [
          { field: 'form.age', operator: 'gte' as const, value: 18 },
          { field: 'form.hasConsent', operator: 'is_truthy' as const },
          { field: 'form.country', operator: 'equals' as const, value: 'ID' },
        ],
      };

      expect(evaluateConditionGroup(group, context)).toBe(true);

      // Failing one condition
      const failingContext = {
        form: { age: 16, hasConsent: true, country: 'ID' },
      };
      expect(evaluateConditionGroup(group, failingContext)).toBe(false);
    });

    it('evaluates OR combinator correctly', () => {
      const context = {
        form: { role: 'editor' },
      };

      const group = {
        combinator: 'or' as const,
        conditions: [
          { field: 'form.role', operator: 'equals' as const, value: 'admin' },
          { field: 'form.role', operator: 'equals' as const, value: 'editor' },
          { field: 'form.role', operator: 'equals' as const, value: 'superadmin' },
        ],
      };

      expect(evaluateConditionGroup(group, context)).toBe(true);

      const guestContext = { form: { role: 'guest' } };
      expect(evaluateConditionGroup(group, guestContext)).toBe(false);
    });

    it('evaluates nested condition groups ((A AND B) OR (C AND D))', () => {
      const complexGroup = {
        combinator: 'or' as const,
        conditions: [
          {
            combinator: 'and' as const,
            conditions: [
              { field: 'user.type', operator: 'equals' as const, value: 'business' },
              { field: 'user.verified', operator: 'is_truthy' as const },
            ],
          },
          {
            combinator: 'and' as const,
            conditions: [
              { field: 'user.type', operator: 'equals' as const, value: 'individual' },
              { field: 'user.age', operator: 'gte' as const, value: 21 },
            ],
          },
        ],
      };

      // Case 1: Matches first branch (business + verified)
      expect(
        evaluateConditionGroup(complexGroup, {
          user: { type: 'business', verified: true, age: 18 },
        }),
      ).toBe(true);

      // Case 2: Matches second branch (individual + age >= 21)
      expect(
        evaluateConditionGroup(complexGroup, {
          user: { type: 'individual', verified: false, age: 25 },
        }),
      ).toBe(true);

      // Case 3: Matches neither
      expect(
        evaluateConditionGroup(complexGroup, {
          user: { type: 'individual', verified: false, age: 19 },
        }),
      ).toBe(false);
    });

    it('supports evaluateConditions helper with default combinator and empty lists', () => {
      expect(evaluateConditions([], {})).toBe(true);

      const context = { value: 10 };
      expect(
        evaluateConditions(
          [{ field: 'value', operator: 'gt', value: 5 }],
          context,
        ),
      ).toBe(true);
    });

    it('identifies ConditionGroups with isConditionGroup type guard', () => {
      expect(isConditionGroup({ combinator: 'and', conditions: [] })).toBe(true);
      expect(isConditionGroup({ field: 'age', operator: 'equals', value: 10 })).toBe(false);
    });
  });
});

