import { z } from 'zod';
import type { EffectParseResult } from '@kubuild/core';

/** Wraps a zod object schema as an `EffectPlugin.parse` (defaults filled, issues flattened). */
export function zodParser<T extends Record<string, unknown>>(
  schema: z.ZodType<T>,
): (config: unknown) => EffectParseResult<T> {
  return (config) => {
    const result = schema.safeParse(config ?? {});
    if (result.success) return { success: true, config: result.data };
    const error = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
    return { success: false, error };
  };
}

/** JSON Schema of the config's *input* shape (every defaulted field optional), for the AI. */
export function toConfigJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { io: 'input' }) as Record<string, unknown>;
  return json;
}
