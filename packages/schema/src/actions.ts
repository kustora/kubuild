import { z } from 'zod';

/**
 * Action Trigger Types
 * Events in the DOM or component lifecycle that can trigger an action pipeline.
 */
export const ActionTriggerTypeSchema = z.enum([
  'click',
  'submit',
  'change',
  'blur',
  'focus',
  'load',
]);

export type ActionTriggerType = z.infer<typeof ActionTriggerTypeSchema>;
export type ActionTrigger = ActionTriggerType;
export const ActionTriggerSchema = ActionTriggerTypeSchema;

/**
 * Action Step Types
 * Discrete operations executed sequentially or conditionally within an action pipeline.
 */
export const ActionStepTypeSchema = z.enum([
  'api_request',
  'navigate',
  'set_state',
  'reset_form',
  'show_toast',
  'open_modal',
  'close_modal',
  'copy_clipboard',
  'custom_event',
]);

export type ActionStepType = z.infer<typeof ActionStepTypeSchema>;

/**
 * Condition Operators for branch & conditional step execution.
 */
export const ConditionOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'contains',
  'not_contains',
  'is_truthy',
  'is_falsy',
  'gt',
  'gte',
  'lt',
  'lte',
  'regex',
]);

export type ConditionOperator = z.infer<typeof ConditionOperatorSchema>;

/**
 * Action Step Condition Schema
 * Evaluated before running a step. If condition fails, step is skipped.
 */
export const ActionStepConditionSchema = z.object({
  field: z.string().min(1, 'Condition field cannot be empty'),
  operator: ConditionOperatorSchema,
  value: z.unknown().optional(),
});

export type ActionStepCondition = z.infer<typeof ActionStepConditionSchema>;

/**
 * Security: Pattern matching dangerous URL protocols and script injection vectors.
 */
const DANGEROUS_URL_PATTERN = /(javascript:|vbscript:|data:text\/html)/i;
const DANGEROUS_SCRIPT_PATTERN = /<\s*script/i;

export function isSafeActionUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (DANGEROUS_URL_PATTERN.test(trimmed)) return false;
  if (DANGEROUS_SCRIPT_PATTERN.test(trimmed)) return false;
  return true;
}

const SafeUrlStringSchema = z
  .string()
  .min(1, 'URL cannot be empty')
  .refine(isSafeActionUrl, {
    message: 'URL contains disallowed or unsafe protocol/script pattern',
  });

/**
 * Safe identifier for custom events (alphanumeric, dashes, colons, underscores).
 */
const SafeEventNameSchema = z
  .string()
  .min(1, 'Event name cannot be empty')
  .regex(/^[a-zA-Z0-9_\-:]+$/, {
    message: 'Event name must contain only alphanumeric characters, dashes, colons, or underscores',
  });

/**
 * 1. API Request Step Payload Schema
 */
export const ApiRequestStepPayloadSchema = z.object({
  url: SafeUrlStringSchema,
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']).default('GET'),
  headers: z.record(z.string(), z.string()).optional(),
  queryParams: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  body: z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]).optional(),
  bodyFormat: z.enum(['json', 'form-data', 'formData', 'urlencoded', 'url-encoded', 'raw', 'text']).optional(),
  bodyType: z.enum(['json', 'form-data', 'formData', 'urlencoded', 'url-encoded', 'raw', 'text']).optional(),
  timeout: z.number().positive('Timeout must be greater than 0 ms').optional(),
  responseMapping: z.record(z.string(), z.string()).optional(),
});

export type ApiRequestStepPayload = z.infer<typeof ApiRequestStepPayloadSchema>;

/**
 * 2. Navigate Step Payload Schema
 */
export const NavigateStepPayloadSchema = z.object({
  url: SafeUrlStringSchema,
  target: z.enum(['_self', '_blank', '_parent', '_top']).optional().default('_self'),
  replace: z.boolean().optional(),
  scroll: z.boolean().optional(),
});

export type NavigateStepPayload = z.infer<typeof NavigateStepPayloadSchema>;

/**
 * 3. Set State Step Payload Schema
 */
export const SetStateStepPayloadSchema = z.object({
  key: z.string().min(1, 'State key cannot be empty'),
  value: z.unknown(),
  scope: z.enum(['runtime', 'document', 'session', 'local']).optional().default('runtime'),
});

export type SetStateStepPayload = z.infer<typeof SetStateStepPayloadSchema>;

/**
 * 4. Reset Form Step Payload Schema
 */
export const ResetFormStepPayloadSchema = z.object({
  formId: z.string().optional(),
});

export type ResetFormStepPayload = z.infer<typeof ResetFormStepPayloadSchema>;

/**
 * 5. Show Toast Step Payload Schema
 */
export const ShowToastStepPayloadSchema = z.object({
  message: z.string().min(1, 'Toast message cannot be empty'),
  type: z.enum(['success', 'error', 'warning', 'info']).optional().default('info'),
  variant: z.enum(['success', 'error', 'warning', 'info']).optional(),
  title: z.string().optional(),
  duration: z.number().nonnegative('Duration must be >= 0 ms').optional(),
  position: z
    .enum(['top-right', 'top-left', 'bottom-right', 'bottom-left', 'top-center', 'bottom-center'])
    .optional(),
});

export type ShowToastStepPayload = z.infer<typeof ShowToastStepPayloadSchema>;

/**
 * 6. Open Modal Step Payload Schema
 */
export const OpenModalStepPayloadSchema = z
  .object({
    modalId: z.string().optional(),
    modalNodeId: z.string().optional(),
  })
  .refine((data) => Boolean(data.modalId || data.modalNodeId), {
    message: 'Modal ID or Modal Node ID cannot be empty',
  });

export type OpenModalStepPayload = z.infer<typeof OpenModalStepPayloadSchema>;

/**
 * 7. Close Modal Step Payload Schema
 */
export const CloseModalStepPayloadSchema = z.object({
  modalId: z.string().optional(),
  modalNodeId: z.string().optional(),
});

export type CloseModalStepPayload = z.infer<typeof CloseModalStepPayloadSchema>;

/**
 * 8. Copy Clipboard Step Payload Schema
 */
export const CopyClipboardStepPayloadSchema = z.object({
  text: z.string(),
  notify: z.boolean().optional(),
  toastMessage: z.string().optional(),
});

export type CopyClipboardStepPayload = z.infer<typeof CopyClipboardStepPayloadSchema>;

/**
 * 9. Custom Event Step Payload Schema
 */
export const CustomEventStepPayloadSchema = z.object({
  eventName: SafeEventNameSchema,
  detail: z.record(z.string(), z.unknown()).optional(),
  bubbles: z.boolean().optional().default(true),
  cancelable: z.boolean().optional().default(true),
});

export type CustomEventStepPayload = z.infer<typeof CustomEventStepPayloadSchema>;

/**
 * Dictionary of Step Payload Schemas by Step Type
 */
export const StepPayloadSchemas = {
  api_request: ApiRequestStepPayloadSchema,
  navigate: NavigateStepPayloadSchema,
  set_state: SetStateStepPayloadSchema,
  reset_form: ResetFormStepPayloadSchema,
  show_toast: ShowToastStepPayloadSchema,
  open_modal: OpenModalStepPayloadSchema,
  close_modal: CloseModalStepPayloadSchema,
  copy_clipboard: CopyClipboardStepPayloadSchema,
  custom_event: CustomEventStepPayloadSchema,
} as const;

/**
 * Action Step Interface
 * Recursive definition allowing branching (onSuccess, onError).
 */
export interface ActionStep {
  id: string;
  type: ActionStepType;
  label?: string;
  payload?: Record<string, unknown>;
  condition?: ActionStepCondition;
  timeout?: number;
  continueOnError?: boolean;
  onSuccess?: ActionStep[];
  onError?: ActionStep[];
}

/**
 * Action Step Schema
 * Validates individual steps in an action pipeline, supporting recursive branching.
 */
export const ActionStepSchema: z.ZodType<ActionStep> = z.lazy(() =>
  z.object({
    id: z.string().min(1, 'Step ID cannot be empty'),
    type: ActionStepTypeSchema,
    label: z.string().optional(),
    payload: z.record(z.string(), z.unknown()).optional().default({}),
    condition: ActionStepConditionSchema.optional(),
    timeout: z.number().positive().optional(),
    continueOnError: z.boolean().optional(),
    onSuccess: z.array(ActionStepSchema).optional(),
    onError: z.array(ActionStepSchema).optional(),
  })
);

/**
 * Action Pipeline Schema
 * Defines an event trigger and an ordered sequence of action steps to execute.
 */
export const ActionPipelineSchema = z.object({
  id: z.string().min(1, 'Pipeline ID cannot be empty'),
  trigger: ActionTriggerTypeSchema,
  label: z.string().optional(),
  debounceMs: z.number().nonnegative('Debounce ms must be >= 0').optional(),
  preventDuplicate: z.boolean().optional(),
  enabled: z.boolean().optional().default(true),
  steps: z.array(ActionStepSchema).min(1, 'Action pipeline must contain at least one step'),
});

export type ActionPipeline = z.infer<typeof ActionPipelineSchema>;

/**
 * Type Guards
 */
export function isActionTriggerType(value: unknown): value is ActionTriggerType {
  return ActionTriggerTypeSchema.safeParse(value).success;
}

export function isActionStepType(value: unknown): value is ActionStepType {
  return ActionStepTypeSchema.safeParse(value).success;
}

export function isConditionOperator(value: unknown): value is ConditionOperator {
  return ConditionOperatorSchema.safeParse(value).success;
}

export function isActionStepCondition(value: unknown): value is ActionStepCondition {
  return ActionStepConditionSchema.safeParse(value).success;
}

export function isActionStep(value: unknown): value is ActionStep {
  return ActionStepSchema.safeParse(value).success;
}

export function isActionPipeline(value: unknown): value is ActionPipeline {
  return ActionPipelineSchema.safeParse(value).success;
}

/**
 * Validates a step's payload specifically according to its step type.
 */
export function validateActionStepPayload(
  type: ActionStepType,
  payload: unknown
): { success: boolean; data?: unknown; error?: z.ZodError } {
  const schema = StepPayloadSchemas[type];
  if (!schema) {
    return {
      success: false,
      error: new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          message: `Unknown step type: ${type}`,
          path: ['type'],
        },
      ]),
    };
  }
  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Sanitization Utilities
 */

/**
 * Sanitizes a URL string by checking if it contains dangerous protocols or scripts.
 * Returns the trimmed URL if safe, or a fallback string (default empty string `""`).
 */
export function sanitizeActionUrl(url: unknown, fallback: string = ''): string {
  if (typeof url !== 'string') return fallback;
  const trimmed = url.trim();
  if (!isSafeActionUrl(trimmed)) {
    return fallback;
  }
  return trimmed;
}

/**
 * Sanitizes a general string value against script tags and dangerous HTML/protocols.
 */
export function sanitizeActionString(value: unknown, fallback: string = ''): string {
  if (typeof value !== 'string') return fallback;
  if (DANGEROUS_SCRIPT_PATTERN.test(value)) {
    return value.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '').replace(/<\s*script[^>]*>/gi, '');
  }
  return value;
}

/**
 * Recursively sanitizes any arbitrary value (string, object, array, primitive) in an action payload.
 */
export function sanitizeActionValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (DANGEROUS_URL_PATTERN.test(trimmed)) {
      return '';
    }
    return sanitizeActionString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeActionValue(item));
  }
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/^(url|href|src|endpoint|targetUrl)$/i.test(k) && typeof v === 'string') {
        result[k] = sanitizeActionUrl(v);
      } else {
        result[k] = sanitizeActionValue(v);
      }
    }
    return result;
  }
  return value;
}

/**
 * Sanitizes an action step payload object, cleaning dangerous URLs and injection strings recursively.
 */
export function sanitizeActionPayload(payload: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return sanitizeActionValue(payload) as Record<string, unknown>;
}

/**
 * Recursively sanitizes an ActionStep, including its payload, condition, onSuccess, and onError branches.
 */
export function sanitizeActionStep(step: ActionStep): ActionStep {
  const sanitized: ActionStep = {
    ...step,
    label: step.label ? sanitizeActionString(step.label) : step.label,
    payload: sanitizeActionPayload(step.payload),
  };

  if (step.condition && step.condition.value !== undefined) {
    sanitized.condition = {
      ...step.condition,
      value: sanitizeActionValue(step.condition.value),
    };
  }

  if (step.onSuccess && Array.isArray(step.onSuccess)) {
    sanitized.onSuccess = step.onSuccess.map((s) => sanitizeActionStep(s));
  }

  if (step.onError && Array.isArray(step.onError)) {
    sanitized.onError = step.onError.map((s) => sanitizeActionStep(s));
  }

  return sanitized;
}

/**
 * Recursively sanitizes an ActionPipeline and all its nested steps.
 */
export function sanitizeActionPipeline(pipeline: ActionPipeline): ActionPipeline {
  return {
    ...pipeline,
    label: pipeline.label ? sanitizeActionString(pipeline.label) : pipeline.label,
    steps: Array.isArray(pipeline.steps) ? pipeline.steps.map((s) => sanitizeActionStep(s)) : [],
  };
}

