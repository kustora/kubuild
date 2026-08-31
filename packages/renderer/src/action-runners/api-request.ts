import type { ActionStep, ApiRequestStepPayload } from '@kubuild/schema';
import { isSafeActionUrl } from '@kubuild/schema';
import {
  ActionCancellationError,
  ActionTimeoutError,
  type PipelineExecutionContext,
  type PipelineStepHandler,
} from '@kubuild/core';

/**
 * Standard API Request Response representation.
 */
export interface ApiRequestResponse<T = unknown> {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: T;
  body: T; // Alias for data
  url: string;
}

/**
 * Details passed to ApiRequestError.
 */
export interface ApiRequestErrorDetails {
  status?: number;
  statusText?: string;
  url?: string;
  method?: string;
  data?: unknown;
  headers?: Record<string, string>;
  response?: ApiRequestResponse;
  isTimeout?: boolean;
  isCancelled?: boolean;
  isNetworkError?: boolean;
  stepId?: string;
  cause?: unknown;
}

/**
 * Custom Error thrown when an API request fails, times out, or returns a non-2xx status code.
 */
export class ApiRequestError extends Error {
  readonly status?: number;
  readonly statusText?: string;
  readonly url?: string;
  readonly method?: string;
  readonly data?: unknown;
  readonly headers?: Record<string, string>;
  readonly response?: ApiRequestResponse;
  readonly isTimeout: boolean;
  readonly isCancelled: boolean;
  readonly isNetworkError: boolean;
  readonly stepId?: string;
  readonly cause?: unknown;

  constructor(message: string, details?: ApiRequestErrorDetails) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = details?.status;
    this.statusText = details?.statusText;
    this.url = details?.url;
    this.method = details?.method;
    this.data = details?.data;
    this.headers = details?.headers;
    this.response = details?.response;
    this.isTimeout = details?.isTimeout ?? false;
    this.isCancelled = details?.isCancelled ?? false;
    this.isNetworkError = details?.isNetworkError ?? false;
    this.stepId = details?.stepId;
    this.cause = details?.cause;
  }
}

/**
 * Options for configuring API Request Action Runner.
 */
export interface ApiRequestRunnerOptions {
  fetchFn?: typeof fetch;
  defaultTimeout?: number;
  baseUrl?: string;
  headers?: Record<string, string>;
}

/**
 * Builds and validates the final API request URL with query parameters.
 */
export function buildApiUrl(
  rawUrl: string,
  queryParams?: Record<string, unknown>,
  baseUrl?: string,
): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    throw new ApiRequestError('API request URL is required', { url: rawUrl });
  }

  const trimmedUrl = rawUrl.trim();
  if (!isSafeActionUrl(trimmedUrl)) {
    throw new ApiRequestError(
      `Disallowed or unsafe protocol in API request URL: "${trimmedUrl}"`,
      { url: trimmedUrl },
    );
  }

  let finalUrl = trimmedUrl;
  if (
    baseUrl &&
    !trimmedUrl.startsWith('http://') &&
    !trimmedUrl.startsWith('https://') &&
    !trimmedUrl.startsWith('//')
  ) {
    const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const cleanPath = trimmedUrl.startsWith('/') ? trimmedUrl : `/${trimmedUrl}`;
    finalUrl = `${cleanBase}${cleanPath}`;
  }

  if (queryParams && typeof queryParams === 'object' && Object.keys(queryParams).length > 0) {
    const [basePart, existingQuery] = finalUrl.split('?');
    const searchParams = new URLSearchParams(existingQuery || '');

    for (const [key, val] of Object.entries(queryParams)) {
      if (val === undefined || val === null) continue;
      if (Array.isArray(val)) {
        val.forEach((item) => searchParams.append(key, String(item)));
      } else {
        searchParams.set(key, String(val));
      }
    }

    const queryString = searchParams.toString();
    finalUrl = queryString ? `${basePart}?${queryString}` : basePart;
  }

  return finalUrl;
}

/**
 * Prepares the request body and normalizes headers based on body payload and body format.
 */
export function prepareRequestBody(
  method: string,
  body: unknown,
  bodyFormat?: string,
  headers: Record<string, string> = {},
): {
  body: BodyInit | undefined;
  headers: Record<string, string>;
} {
  const normalizedMethod = method.toUpperCase();
  const reqHeaders: Record<string, string> = { ...headers };

  // For GET, HEAD, or OPTIONS without body, omit body
  if (normalizedMethod === 'GET' || normalizedMethod === 'HEAD') {
    return { body: undefined, headers: reqHeaders };
  }

  if (body === undefined || body === null) {
    return { body: undefined, headers: reqHeaders };
  }

  // Find Content-Type header ignoring case
  const contentTypeKey = Object.keys(reqHeaders).find(
    (k) => k.toLowerCase() === 'content-type',
  );
  const existingContentType = contentTypeKey ? reqHeaders[contentTypeKey] : undefined;

  const format = (bodyFormat || '').toLowerCase();

  // 1. FormData format
  if (
    format === 'form-data' ||
    format === 'formdata' ||
    format === 'multipart' ||
    (existingContentType && existingContentType.includes('multipart/form-data'))
  ) {
    // If body is already a FormData instance
    if (typeof FormData !== 'undefined' && body instanceof FormData) {
      if (contentTypeKey) {
        delete reqHeaders[contentTypeKey];
      }
      return { body, headers: reqHeaders };
    }

    if (typeof FormData !== 'undefined' && typeof body === 'object' && body !== null) {
      const formData = new FormData();
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (v === undefined || v === null) continue;
        if (typeof Blob !== 'undefined' && v instanceof Blob) {
          formData.append(k, v);
        } else if (Array.isArray(v)) {
          v.forEach((item) =>
            formData.append(k, typeof item === 'object' ? JSON.stringify(item) : String(item)),
          );
        } else if (typeof v === 'object') {
          formData.append(k, JSON.stringify(v));
        } else {
          formData.append(k, String(v));
        }
      }

      // Remove manual content-type header so fetch will auto-generate boundary
      if (contentTypeKey) {
        delete reqHeaders[contentTypeKey];
      }
      return { body: formData, headers: reqHeaders };
    }
  }

  // 2. URL-encoded format
  if (
    format === 'urlencoded' ||
    format === 'url-encoded' ||
    (existingContentType && existingContentType.includes('application/x-www-form-urlencoded'))
  ) {
    if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
      if (!contentTypeKey) {
        reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      }
      return { body, headers: reqHeaders };
    }

    if (typeof body === 'object' && body !== null) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
        if (v === undefined || v === null) continue;
        if (Array.isArray(v)) {
          v.forEach((item) => params.append(k, String(item)));
        } else {
          params.append(k, String(v));
        }
      }
      if (!contentTypeKey) {
        reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      }
      return { body: params, headers: reqHeaders };
    }

    if (typeof body === 'string') {
      if (!contentTypeKey) {
        reqHeaders['Content-Type'] = 'application/x-www-form-urlencoded;charset=UTF-8';
      }
      return { body, headers: reqHeaders };
    }
  }

  // 3. Raw / Text format
  if (format === 'raw' || format === 'text') {
    if (!contentTypeKey) {
      reqHeaders['Content-Type'] = 'text/plain;charset=UTF-8';
    }
    return {
      body: typeof body === 'string' ? body : String(body),
      headers: reqHeaders,
    };
  }

  // 4. Default: JSON format for objects / arrays / numbers / booleans
  if (typeof body === 'object' && body !== null) {
    if (!contentTypeKey) {
      reqHeaders['Content-Type'] = 'application/json';
    }
    return {
      body: JSON.stringify(body),
      headers: reqHeaders,
    };
  }

  if (typeof body === 'string') {
    if (!contentTypeKey) {
      try {
        JSON.parse(body);
        reqHeaders['Content-Type'] = 'application/json';
      } catch {
        reqHeaders['Content-Type'] = 'text/plain;charset=UTF-8';
      }
    }
    return { body, headers: reqHeaders };
  }

  return {
    body: String(body),
    headers: reqHeaders,
  };
}

/**
 * Safely parses response body as JSON or text.
 */
async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();

  if (!text || text.trim() === '') {
    return null;
  }

  if (contentType.includes('application/json') || contentType.includes('+json')) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  const trimmed = text.trim();
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return text;
    }
  }

  return text;
}

/**
 * Creates an API Request Step Handler configured with custom options or default settings.
 */
export function createApiRequestHandler(
  options?: ApiRequestRunnerOptions,
): PipelineStepHandler {
  const defaultTimeout = options?.defaultTimeout;
  const defaultBaseUrl = options?.baseUrl;
  const defaultHeaders = options?.headers;

  return async function apiRequestRunner(
    step: ActionStep,
    context: PipelineExecutionContext,
    signal?: AbortSignal,
  ): Promise<ApiRequestResponse> {
    const fetchFn =
      (context.fetchFn as typeof fetch) ||
      options?.fetchFn ||
      (typeof globalThis !== 'undefined' && typeof globalThis.fetch === 'function'
        ? globalThis.fetch
        : typeof fetch !== 'undefined'
          ? fetch
          : undefined);
    if (!fetchFn) {
      throw new ApiRequestError('No fetch implementation available for API request runner', {
        stepId: step.id,
      });
    }

    const payload = (step.payload || {}) as ApiRequestStepPayload & {
      bodyType?: string;
      bodyFormat?: string;
      baseUrl?: string;
    };

    const method = String(payload.method || 'GET').toUpperCase();
    const timeoutMs = payload.timeout ?? defaultTimeout;
    const baseUrl = payload.baseUrl ?? defaultBaseUrl;

    const url = buildApiUrl(
      String(payload.url || ''),
      payload.queryParams as Record<string, unknown>,
      baseUrl,
    );

    const mergedHeaders: Record<string, string> = {
      ...(defaultHeaders || {}),
      ...((payload.headers as Record<string, string>) || {}),
    };

    const { body, headers } = prepareRequestBody(
      method,
      payload.body,
      payload.bodyFormat || payload.bodyType,
      mergedHeaders,
    );

    const controller = new AbortController();
    let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

    const onParentAbort = () => {
      controller.abort(signal?.reason);
    };

    if (signal) {
      if (signal.aborted) {
        throw new ActionCancellationError(
          signal.reason instanceof Error ? signal.reason.message : 'API request cancelled',
          step.id,
        );
      }
      signal.addEventListener('abort', onParentAbort, { once: true });
    }

    if (timeoutMs !== undefined && timeoutMs > 0) {
      timeoutTimer = setTimeout(() => {
        controller.abort(
          new ActionTimeoutError(
            `API request timed out after ${timeoutMs}ms`,
            timeoutMs,
            step.id,
          ),
        );
      }, timeoutMs);
    }

    try {
      const response = await fetchFn(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      const responseHeaders: Record<string, string> = {};
      if (response.headers && typeof response.headers.forEach === 'function') {
        response.headers.forEach((val, key) => {
          responseHeaders[key.toLowerCase()] = val;
        });
      }

      const parsedData = await parseResponseBody(response);

      const apiResponse: ApiRequestResponse = {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data: parsedData,
        body: parsedData,
        url: response.url || url,
      };

      if (!response.ok) {
        const errorMsg =
          (typeof parsedData === 'object' && parsedData !== null && 'message' in parsedData
            ? String((parsedData as { message: unknown }).message)
            : undefined) ||
          (typeof parsedData === 'string' && parsedData.length < 200 ? parsedData : undefined) ||
          `HTTP ${response.status} ${response.statusText || 'Error'}`;

        throw new ApiRequestError(`API request failed: ${errorMsg}`, {
          status: response.status,
          statusText: response.statusText,
          url,
          method,
          data: parsedData,
          headers: responseHeaders,
          response: apiResponse,
          stepId: step.id,
        });
      }

      return apiResponse;
    } catch (err: unknown) {
      if (err instanceof ApiRequestError) {
        throw err;
      }
      if (controller.signal.aborted) {
        const reason = controller.signal.reason;
        if (
          reason instanceof ActionTimeoutError ||
          (reason instanceof Error && reason.name === 'ActionTimeoutError')
        ) {
          throw reason;
        }
        if (
          reason instanceof ActionCancellationError ||
          (reason instanceof Error && reason.name === 'ActionCancellationError')
        ) {
          throw reason;
        }
        if (err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
          if (timeoutTimer === undefined && signal?.aborted) {
            throw new ActionCancellationError('API request cancelled', step.id);
          }
          throw new ActionTimeoutError(
            `API request timed out after ${timeoutMs}ms`,
            timeoutMs ?? 0,
            step.id,
          );
        }
      }

      const errMsg = err instanceof Error ? err.message : String(err);
      throw new ApiRequestError(`Network error during API request: ${errMsg}`, {
        url,
        method,
        isNetworkError: true,
        stepId: step.id,
        cause: err,
      });
    } finally {
      if (timeoutTimer !== undefined) {
        clearTimeout(timeoutTimer);
      }
      if (signal) {
        signal.removeEventListener('abort', onParentAbort);
      }
    }
  };
}

/**
 * Default built-in API Request Runner instance.
 */
export const apiRequestRunner = createApiRequestHandler();
