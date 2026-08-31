import type { ActionStepCondition, ConditionOperator } from '@kubuild/schema';
import { resolvePropertyPath } from './interpolator';

/**
 * Extended condition operators supported by the evaluator.
 */
export type ExtendedConditionOperator =
  | ConditionOperator
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty'
  | 'in'
  | 'not_in';

/**
 * Options for fine-tuning condition evaluation.
 */
export interface ConditionEvaluationOptions {
  caseInsensitive?: boolean;
  trimStrings?: boolean;
}

/**
 * Represents a group of conditions evaluated together using AND / OR combinators.
 */
export interface ConditionGroup {
  combinator: 'and' | 'or';
  conditions: (ActionStepCondition | ConditionGroup)[];
}

/**
 * Type guard to check if a condition item is a ConditionGroup.
 */
export function isConditionGroup(
  item: ActionStepCondition | ConditionGroup,
): item is ConditionGroup {
  return typeof item === 'object' && item !== null && 'combinator' in item && 'conditions' in item;
}

/**
 * Checks whether a given value is considered empty.
 * Returns true for undefined, null, empty string, empty array, or empty object.
 */
export function isValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  if (typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).length === 0;
  }
  return false;
}

/**
 * Evaluates an operator against an actual value and an optional expected value.
 */
export function evaluateOperator(
  operator: ExtendedConditionOperator | string,
  actual: unknown,
  expected?: unknown,
  options?: ConditionEvaluationOptions,
): boolean {
  let act = actual;
  let exp = expected;

  if (options?.trimStrings) {
    if (typeof act === 'string') act = act.trim();
    if (typeof exp === 'string') exp = exp.trim();
  }

  if (options?.caseInsensitive) {
    if (typeof act === 'string') act = act.toLowerCase();
    if (typeof exp === 'string') exp = exp.toLowerCase();
  }

  switch (operator) {
    case 'equals': {
      if (act === exp) return true;
      // Handle numeric type coercion if one is string and the other is number
      if (typeof act === 'number' && typeof exp === 'string' && exp.trim() !== '') {
        const numExp = Number(exp);
        return !Number.isNaN(numExp) && act === numExp;
      }
      if (typeof act === 'string' && typeof exp === 'number' && act.trim() !== '') {
        const numAct = Number(act);
        return !Number.isNaN(numAct) && numAct === exp;
      }
      // Handle boolean string coercion ("true" / "false")
      if (typeof act === 'boolean' && typeof exp === 'string') {
        return act === (exp.toLowerCase() === 'true');
      }
      if (typeof act === 'string' && typeof exp === 'boolean') {
        return (act.toLowerCase() === 'true') === exp;
      }
      return false;
    }

    case 'not_equals':
      return !evaluateOperator('equals', actual, expected, options);

    case 'is_truthy':
      if (Array.isArray(act)) {
        return act.length > 0;
      }
      if (act && typeof act === 'object') {
        return Object.keys(act as Record<string, unknown>).length > 0;
      }
      return Boolean(act);

    case 'is_falsy':
      return !evaluateOperator('is_truthy', actual, undefined, options);

    case 'is_empty':
      return isValueEmpty(actual);

    case 'is_not_empty':
      return !isValueEmpty(actual);

    case 'contains': {
      if (typeof act === 'string') {
        const needle = options?.caseInsensitive && typeof exp === 'string' ? exp : String(exp ?? '');
        return act.includes(needle);
      }
      if (Array.isArray(act)) {
        if (options?.caseInsensitive && typeof exp === 'string') {
          return act.some((item) => typeof item === 'string' && item.toLowerCase() === exp);
        }
        return act.includes(exp);
      }
      if (act && typeof act === 'object') {
        return exp !== undefined && String(exp) in (act as Record<string, unknown>);
      }
      return false;
    }

    case 'not_contains':
      return !evaluateOperator('contains', actual, expected, options);

    case 'starts_with': {
      if (typeof act !== 'string') return false;
      const prefix = options?.caseInsensitive && typeof exp === 'string' ? exp : String(exp ?? '');
      return act.startsWith(prefix);
    }

    case 'ends_with': {
      if (typeof act !== 'string') return false;
      const suffix = options?.caseInsensitive && typeof exp === 'string' ? exp : String(exp ?? '');
      return act.endsWith(suffix);
    }

    case 'gt': {
      const actNum = Number(act);
      const expNum = Number(exp);
      return !Number.isNaN(actNum) && !Number.isNaN(expNum) && actNum > expNum;
    }

    case 'gte': {
      const actNum = Number(act);
      const expNum = Number(exp);
      return !Number.isNaN(actNum) && !Number.isNaN(expNum) && actNum >= expNum;
    }

    case 'lt': {
      const actNum = Number(act);
      const expNum = Number(exp);
      return !Number.isNaN(actNum) && !Number.isNaN(expNum) && actNum < expNum;
    }

    case 'lte': {
      const actNum = Number(act);
      const expNum = Number(exp);
      return !Number.isNaN(actNum) && !Number.isNaN(expNum) && actNum <= expNum;
    }

    case 'in': {
      if (Array.isArray(exp)) {
        if (options?.caseInsensitive && typeof act === 'string') {
          return exp.some((item) => typeof item === 'string' && item.toLowerCase() === act);
        }
        return exp.includes(act);
      }
      if (typeof exp === 'string') {
        return exp.includes(String(act ?? ''));
      }
      return false;
    }

    case 'not_in':
      return !evaluateOperator('in', actual, expected, options);

    case 'regex': {
      try {
        const patternStr = String(exp ?? '');
        const flags = options?.caseInsensitive ? 'i' : '';
        const regex = new RegExp(patternStr, flags);
        return regex.test(String(act ?? ''));
      } catch {
        return false;
      }
    }

    default:
      return true;
  }
}

/**
 * Resolves a field value from context and evaluates a single ActionStepCondition.
 */
export function evaluateCondition(
  condition: ActionStepCondition | undefined,
  context: Record<string, unknown>,
  options?: ConditionEvaluationOptions,
): boolean {
  if (!condition) return true;

  const rawField = condition.field;
  if (!rawField || typeof rawField !== 'string') return true;

  // Clean template wrapper syntax `{{ path }}` if provided
  const fieldPath = rawField.replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
  const actualValue = resolvePropertyPath(context, fieldPath, undefined);

  return evaluateOperator(condition.operator, actualValue, condition.value, options);
}

/**
 * Evaluates a ConditionGroup (AND / OR group with nested conditions).
 */
export function evaluateConditionGroup(
  group: ConditionGroup,
  context: Record<string, unknown>,
  options?: ConditionEvaluationOptions,
): boolean {
  if (!group || !Array.isArray(group.conditions) || group.conditions.length === 0) {
    return true;
  }

  const combinator = group.combinator === 'or' ? 'or' : 'and';

  if (combinator === 'and') {
    return group.conditions.every((item) => {
      if (isConditionGroup(item)) {
        return evaluateConditionGroup(item, context, options);
      }
      return evaluateCondition(item, context, options);
    });
  }

  return group.conditions.some((item) => {
    if (isConditionGroup(item)) {
      return evaluateConditionGroup(item, context, options);
    }
    return evaluateCondition(item, context, options);
  });
}

/**
 * Evaluates a list of conditions and/or condition groups using a given combinator ('and' | 'or').
 */
export function evaluateConditions(
  conditions: (ActionStepCondition | ConditionGroup)[],
  context: Record<string, unknown>,
  combinator: 'and' | 'or' = 'and',
  options?: ConditionEvaluationOptions,
): boolean {
  return evaluateConditionGroup({ combinator, conditions }, context, options);
}

