import type {
  ActionPipeline,
  ActionStep,
  ActionStepCondition,
  ActionStepType,
} from '@kubuild/schema';
import { interpolateValue, resolvePropertyPath } from './interpolator';
import { evaluateCondition } from './conditional-resolver';

/**
 * Execution context shared across action steps in a pipeline.
 */
export interface PipelineExecutionContext {
  form?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  state?: Record<string, unknown>;
  response?: unknown;
  stepResults?: Record<string, StepExecutionResult>;
  error?: unknown;
  lastError?: unknown;
  nodeId?: string;
  document?: unknown;
  [key: string]: unknown;
}

/**
 * Status of an individual step execution.
 */
export type StepExecutionStatus = 'success' | 'error' | 'skipped' | 'cancelled';

/**
 * Result of executing an individual action step.
 */
export interface StepExecutionResult {
  stepId: string;
  stepType: ActionStepType | string;
  status: StepExecutionStatus;
  data?: unknown;
  error?: Error | unknown;
  durationMs: number;
  subResults?: StepExecutionResult[];
}

/**
 * Overall result of executing an action pipeline.
 */
export interface PipelineExecutionResult {
  pipelineId: string;
  success: boolean;
  status: 'completed' | 'failed' | 'cancelled';
  stepResults: StepExecutionResult[];
  context: PipelineExecutionContext;
  error?: Error | unknown;
  durationMs: number;
}

/**
 * Handler function signature for an individual step type.
 */
export type PipelineStepHandler<TContext = PipelineExecutionContext> = (
  step: ActionStep,
  context: TContext,
  signal: AbortSignal,
) => Promise<unknown> | unknown;

/**
 * Options for configuring the execution of an action pipeline.
 */
export interface ExecutePipelineOptions {
  context?: PipelineExecutionContext;
  signal?: AbortSignal;
  timeout?: number;
  throwOnError?: boolean;
  handlers?: Record<string, PipelineStepHandler>;
  onStepStart?: (step: ActionStep, context: PipelineExecutionContext) => void;
  onStepComplete?: (
    step: ActionStep,
    result: StepExecutionResult,
    context: PipelineExecutionContext,
  ) => void;
}

/**
 * Configuration options for creating an ActionPipelineExecutor instance.
 */
export interface ActionPipelineExecutorOptions {
  handlers?: Record<string, PipelineStepHandler>;
  defaultTimeout?: number;
  throwOnError?: boolean;
}

/**
 * Custom error thrown when a step or pipeline times out.
 */
export class ActionTimeoutError extends Error {
  readonly stepId?: string;
  readonly timeoutMs: number;

  constructor(message: string, timeoutMs: number, stepId?: string) {
    super(message);
    this.name = 'ActionTimeoutError';
    this.timeoutMs = timeoutMs;
    this.stepId = stepId;
  }
}

/**
 * Custom error thrown when an action execution is aborted/cancelled.
 */
export class ActionCancellationError extends Error {
  readonly stepId?: string;

  constructor(message: string = 'Action execution cancelled', stepId?: string) {
    super(message);
    this.name = 'ActionCancellationError';
    this.stepId = stepId;
  }
}

/**
 * Evaluates an ActionStepCondition against a pipeline execution context.
 */
export function evaluateActionCondition(
  condition: ActionStepCondition | undefined,
  context: PipelineExecutionContext,
): boolean {
  return evaluateCondition(condition, context);
}

/**
 * Normalizes an abort reason into an ActionTimeoutError or ActionCancellationError.
 */
function normalizeAbortError(reason: unknown, stepId?: string): Error {
  if (reason instanceof ActionTimeoutError) {
    return reason;
  }
  if (reason instanceof ActionCancellationError) {
    return reason;
  }
  const msg = reason instanceof Error ? reason.message : 'Action execution cancelled';
  return new ActionCancellationError(msg, stepId);
}

/**
 * Creates a combined abort controller that aborts when either parent signal triggers or timeout fires.
 */
function createTimeoutAbortSignal(
  parentSignal?: AbortSignal,
  timeoutMs?: number,
  timeoutMessage?: string,
  stepId?: string,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const onParentAbort = () => {
    controller.abort(normalizeAbortError(parentSignal?.reason, stepId));
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      onParentAbort();
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true });
    }
  }

  if (timeoutMs !== undefined && timeoutMs > 0) {
    timerId = setTimeout(() => {
      controller.abort(
        new ActionTimeoutError(
          timeoutMessage || `Action execution timed out after ${timeoutMs}ms`,
          timeoutMs,
          stepId,
        ),
      );
    }, timeoutMs);
  }

  const cleanup = () => {
    if (timerId !== undefined) {
      clearTimeout(timerId);
    }
    if (parentSignal) {
      parentSignal.removeEventListener('abort', onParentAbort);
    }
  };

  return { signal: controller.signal, cleanup };
}

/**
 * ActionPipelineExecutor manages step handlers, sequential execution of action pipelines,
 * timeouts, cancellation, conditional evaluation, and onSuccess / onError branching.
 */
export class ActionPipelineExecutor {
  private handlers = new Map<string, PipelineStepHandler>();
  private defaultTimeout?: number;
  private throwOnError: boolean;

  constructor(options?: ActionPipelineExecutorOptions) {
    this.defaultTimeout = options?.defaultTimeout;
    this.throwOnError = options?.throwOnError ?? false;

    // Register built-in default handlers
    this.registerBuiltInHandlers();

    // Register user-provided handlers
    if (options?.handlers) {
      for (const [type, handler] of Object.entries(options.handlers)) {
        this.registerHandler(type, handler);
      }
    }
  }

  /**
   * Registers default built-in handlers for core step types like `set_state` and `reset_form`.
   */
  private registerBuiltInHandlers(): void {
    // 1. set_state: Updates runtime state or variables
    this.registerHandler('set_state', (step, context) => {
      const key = String(step.payload?.key || '');
      const value = step.payload?.value;
      const scope = String(step.payload?.scope || 'runtime');

      if (!key) return;

      if (!context.state) context.state = {};
      if (!context.variables) context.variables = {};

      if (scope === 'runtime' || scope === 'document') {
        context.state[key] = value;
        context.variables[key] = value;
      } else {
        context.state[key] = value;
      }

      return { key, value, scope };
    });

    // 2. reset_form: Clears/resets form inputs
    this.registerHandler('reset_form', (_step, context) => {
      if (context.form && typeof context.form === 'object') {
        for (const k of Object.keys(context.form)) {
          context.form[k] = '';
        }
      }
      return { reset: true };
    });
  }

  /**
   * Registers a handler for a step type.
   */
  public registerHandler(type: ActionStepType | string, handler: PipelineStepHandler): this {
    this.handlers.set(type, handler);
    return this;
  }

  /**
   * Unregisters a handler for a step type.
   */
  public unregisterHandler(type: ActionStepType | string): this {
    this.handlers.delete(type);
    return this;
  }

  /**
   * Checks if a handler exists for a step type.
   */
  public hasHandler(type: ActionStepType | string): boolean {
    return this.handlers.has(type);
  }

  /**
   * Gets the registered handler for a step type.
   */
  public getHandler(type: ActionStepType | string): PipelineStepHandler | undefined {
    return this.handlers.get(type);
  }

  /**
   * Executes a full ActionPipeline sequentially with support for timeouts, cancellation,
   * condition evaluation, and branching.
   */
  public async execute(
    pipeline: ActionPipeline,
    options?: ExecutePipelineOptions,
  ): Promise<PipelineExecutionResult> {
    const startTime = Date.now();
    const context: PipelineExecutionContext = options?.context ?? {};

    if (!context.variables) context.variables = {};
    if (!context.state) context.state = {};
    if (!context.form) context.form = {};
    if (!context.stepResults) context.stepResults = {};

    const timeoutMs = options?.timeout ?? this.defaultTimeout;
    const { signal, cleanup } = createTimeoutAbortSignal(
      options?.signal,
      timeoutMs,
      `Pipeline "${pipeline.id}" timed out after ${timeoutMs}ms`,
    );

    let pipelineStatus: 'completed' | 'failed' | 'cancelled' = 'completed';
    let pipelineError: Error | unknown = undefined;
    const allStepResults: StepExecutionResult[] = [];

    try {
      if (pipeline.enabled === false) {
        return {
          pipelineId: pipeline.id,
          success: true,
          status: 'completed',
          stepResults: [],
          context,
          durationMs: Date.now() - startTime,
        };
      }

      const { success, results, error } = await this.executeSteps(
        pipeline.steps,
        context,
        signal,
        options,
      );

      allStepResults.push(...results);

      if (!success) {
        pipelineStatus = signal.aborted ? 'cancelled' : 'failed';
        pipelineError = error;
      }
    } catch (err: unknown) {
      pipelineStatus = signal.aborted ? 'cancelled' : 'failed';
      pipelineError = err;
    } finally {
      cleanup();
    }

    const isSuccess = pipelineStatus === 'completed';
    const result: PipelineExecutionResult = {
      pipelineId: pipeline.id,
      success: isSuccess,
      status: pipelineStatus,
      stepResults: allStepResults,
      context,
      error: pipelineError,
      durationMs: Date.now() - startTime,
    };

    const shouldThrow = options?.throwOnError ?? this.throwOnError;
    if (!isSuccess && shouldThrow) {
      throw pipelineError || new Error(`Action pipeline "${pipeline.id}" failed`);
    }

    return result;
  }

  /**
   * Executes an ordered list of ActionSteps sequentially.
   */
  private async executeSteps(
    steps: ActionStep[],
    context: PipelineExecutionContext,
    parentSignal: AbortSignal,
    options?: ExecutePipelineOptions,
  ): Promise<{ success: boolean; results: StepExecutionResult[]; error?: Error | unknown }> {
    const results: StepExecutionResult[] = [];

    for (const step of steps) {
      if (parentSignal.aborted) {
        const cancelError = normalizeAbortError(parentSignal.reason, step.id);

        const cancelledResult: StepExecutionResult = {
          stepId: step.id,
          stepType: step.type,
          status: 'cancelled',
          error: cancelError,
          durationMs: 0,
        };
        results.push(cancelledResult);
        context.stepResults![step.id] = cancelledResult;

        return { success: false, results, error: cancelError };
      }

      const stepResult = await this.executeSingleStep(step, context, parentSignal, options);
      results.push(stepResult);
      context.stepResults![step.id] = stepResult;

      if (stepResult.status === 'error' || stepResult.status === 'cancelled') {
        if (!step.continueOnError) {
          return { success: false, results, error: stepResult.error };
        }
      }
    }

    return { success: true, results };
  }

  /**
   * Executes a single ActionStep with condition checking, payload interpolation, timeout,
   * handler execution, response context passing, and branch execution.
   */
  public async executeSingleStep(
    step: ActionStep,
    context: PipelineExecutionContext,
    parentSignal: AbortSignal,
    options?: ExecutePipelineOptions,
  ): Promise<StepExecutionResult> {
    const stepStartTime = Date.now();

    // 1. Evaluate condition
    if (step.condition && !evaluateActionCondition(step.condition, context)) {
      const skippedResult: StepExecutionResult = {
        stepId: step.id,
        stepType: step.type,
        status: 'skipped',
        durationMs: Date.now() - stepStartTime,
      };
      options?.onStepComplete?.(step, skippedResult, context);
      return skippedResult;
    }

    options?.onStepStart?.(step, context);

    // 2. Setup per-step timeout & signal
    const stepTimeout = step.timeout;
    const { signal: stepSignal, cleanup: cleanupStepSignal } = createTimeoutAbortSignal(
      parentSignal,
      stepTimeout,
      `Step "${step.id}" timed out after ${stepTimeout}ms`,
      step.id,
    );

    // 3. Interpolate payload with current context
    const rawPayload = step.payload || {};
    const interpolatedPayload = (interpolateValue(rawPayload, context) || {}) as Record<
      string,
      unknown
    >;
    const resolvedStep: ActionStep = {
      ...step,
      payload: interpolatedPayload,
    };

    // 4. Find handler
    const customHandler = options?.handlers?.[step.type];
    const handler = customHandler || this.getHandler(step.type);

    let stepOutput: unknown;
    let stepError: Error | unknown;
    let stepStatus: StepExecutionStatus = 'success';
    const subResults: StepExecutionResult[] = [];

    try {
      if (!handler) {
        throw new Error(`No handler registered for action step type: "${step.type}"`);
      }

      if (stepSignal.aborted) {
        throw normalizeAbortError(stepSignal.reason, step.id);
      }

      stepOutput = await handler(resolvedStep, context, stepSignal);

      // On successful execution: update context response (if returned) & response mapping
      if (stepOutput !== undefined) {
        context.response = stepOutput;
      }
      delete context.lastError;

      if (interpolatedPayload.responseMapping && typeof interpolatedPayload.responseMapping === 'object') {
        const mapping = interpolatedPayload.responseMapping as Record<string, string>;
        for (const [targetVar, sourcePath] of Object.entries(mapping)) {
          const evalContext = {
            ...context,
            response: stepOutput !== undefined ? stepOutput : context.response,
          };
          const cleanPath = String(sourcePath).replace(/^\{\{\s*/, '').replace(/\s*\}\}$/, '').trim();
          const mappedVal = resolvePropertyPath(evalContext, cleanPath, undefined);
          if (mappedVal !== undefined) {
            if (!context.variables) context.variables = {};
            context.variables[targetVar] = mappedVal;
          }
        }
      }

      // Execute onSuccess branching if defined
      if (step.onSuccess && Array.isArray(step.onSuccess) && step.onSuccess.length > 0) {
        const successBranch = await this.executeSteps(
          step.onSuccess,
          context,
          stepSignal,
          options,
        );
        subResults.push(...successBranch.results);

        if (!successBranch.success) {
          stepStatus = 'error';
          stepError = successBranch.error;
        }
      }
    } catch (err: unknown) {
      stepError = err;
      stepStatus = stepSignal.aborted ? 'cancelled' : 'error';
      context.lastError = err;
      context.error = err;

      // Execute onError branching if defined
      if (step.onError && Array.isArray(step.onError) && step.onError.length > 0) {
        try {
          const errorBranch = await this.executeSteps(
            step.onError,
            context,
            parentSignal, // Use parent signal so error branch can run even if step timed out
            options,
          );
          subResults.push(...errorBranch.results);
        } catch (onErrorErr) {
          // Keep original error as primary
        }
      }
    } finally {
      cleanupStepSignal();
    }

    const result: StepExecutionResult = {
      stepId: step.id,
      stepType: step.type,
      status: stepStatus,
      data: stepOutput,
      error: stepError,
      durationMs: Date.now() - stepStartTime,
      ...(subResults.length > 0 ? { subResults } : {}),
    };

    options?.onStepComplete?.(step, result, context);

    return result;
  }
}

/**
 * Convenience helper to execute an action pipeline using default or custom executor settings.
 */
export async function executeActionPipeline(
  pipeline: ActionPipeline,
  options?: ExecutePipelineOptions,
): Promise<PipelineExecutionResult> {
  const executor = new ActionPipelineExecutor();
  return executor.execute(pipeline, options);
}

