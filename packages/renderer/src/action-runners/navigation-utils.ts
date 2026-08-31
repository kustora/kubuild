import type { ActionStep, NavigateStepPayload, CopyClipboardStepPayload, ResetFormStepPayload } from '@kubuild/schema';
import { isSafeActionUrl } from '@kubuild/schema';
import { type PipelineExecutionContext, type PipelineStepHandler } from '@kubuild/core';
import { toastManager, type ToastManager } from './toast-manager';

/**
 * Result returned by navigate runner.
 */
export interface NavigateResult {
  url: string;
  target?: string;
  replace?: boolean;
  scroll?: boolean;
  behavior?: 'smooth' | 'auto';
  navigated: boolean;
  isAnchor: boolean;
}

/**
 * Result returned by copy_clipboard runner.
 */
export interface CopyClipboardResult {
  text: string;
  copied: boolean;
}

/**
 * Result returned by reset_form runner.
 */
export interface ResetFormResult {
  formId?: string;
  reset: boolean;
}

/**
 * Helper to copy text to clipboard with legacy fallback.
 */
export async function copyToClipboard(
  text: string,
  options?: { copyFn?: (text: string) => Promise<void> | void },
): Promise<boolean> {
  if (options?.copyFn) {
    await options.copyFn(text);
    return true;
  }

  // 1. Modern navigator.clipboard API
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  // 2. Legacy document.execCommand fallback
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '-9999px';
      textarea.style.left = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) return true;
    } catch {
      // Fallback below
    }
  }

  return false;
}

/**
 * Action Runner for `navigate`.
 * Supports external redirects, target windows (_blank), SPA navigate hooks, and smooth anchor scrolling (#id).
 */
export const navigateRunner: PipelineStepHandler = (
  step: ActionStep,
  context: PipelineExecutionContext,
): NavigateResult => {
  const payload = (step.payload || {}) as NavigateStepPayload & {
    behavior?: 'smooth' | 'auto';
  };

  const rawUrl = String(payload.url || '').trim();
  if (!rawUrl) {
    throw new Error('Navigation URL cannot be empty');
  }

  if (!isSafeActionUrl(rawUrl)) {
    throw new Error(`Disallowed or unsafe protocol in navigation URL: "${rawUrl}"`);
  }

  const target = payload.target || '_self';
  const replace = payload.replace ?? false;
  const behavior = payload.behavior || 'smooth';
  const scroll = payload.scroll ?? true;

  // 1. Anchor navigation (#section-id)
  if (rawUrl.startsWith('#')) {
    if (typeof document !== 'undefined') {
      try {
        const targetEl =
          document.querySelector(rawUrl) || document.getElementById(rawUrl.slice(1));
        if (targetEl && typeof targetEl.scrollIntoView === 'function') {
          targetEl.scrollIntoView({
            behavior: scroll === false ? 'auto' : behavior,
            block: 'start',
          });
        }
      } catch {
        // Ignore invalid CSS selector errors
      }

      if (typeof window !== 'undefined' && window.location) {
        try {
          window.location.hash = rawUrl;
        } catch {
          // Ignore
        }
      }
    }

    return {
      url: rawUrl,
      target: '_self',
      replace,
      scroll,
      behavior,
      navigated: true,
      isAnchor: true,
    };
  }

  // 2. Open new tab / target window
  if (target === '_blank') {
    if (typeof window !== 'undefined' && typeof window.open === 'function') {
      window.open(rawUrl, '_blank', 'noopener,noreferrer');
    }
    return {
      url: rawUrl,
      target,
      replace,
      scroll,
      behavior,
      navigated: true,
      isAnchor: false,
    };
  }

  // 3. SPA router callbacks (context.onNavigate / context.navigateFn)
  const customNav =
    (typeof context.onNavigate === 'function' && context.onNavigate) ||
    (typeof context.navigateFn === 'function' && context.navigateFn);

  if (customNav) {
    customNav(rawUrl, { target, replace, scroll, behavior });
    return {
      url: rawUrl,
      target,
      replace,
      scroll,
      behavior,
      navigated: true,
      isAnchor: false,
    };
  }

  // 4. Default window.location navigation
  if (typeof window !== 'undefined' && window.location) {
    if (replace) {
      window.location.replace(rawUrl);
    } else {
      window.location.assign(rawUrl);
    }
  }

  return {
    url: rawUrl,
    target,
    replace,
    scroll,
    behavior,
    navigated: true,
    isAnchor: false,
  };
};

/**
 * Action Runner for `copy_clipboard`.
 * Copies string or variable payload to user clipboard with fallback and optional toast notification.
 */
export const copyClipboardRunner: PipelineStepHandler = async (
  step: ActionStep,
  context: PipelineExecutionContext,
): Promise<CopyClipboardResult> => {
  const payload = (step.payload || {}) as CopyClipboardStepPayload & { value?: unknown };

  const raw =
    payload.text !== undefined
      ? payload.text
      : payload.value !== undefined
        ? payload.value
        : '';

  const textToCopy =
    typeof raw === 'object' && raw !== null ? JSON.stringify(raw) : String(raw ?? '');

  const copyFn =
    typeof context.copyFn === 'function'
      ? (context.copyFn as (text: string) => Promise<void> | void)
      : typeof context.clipboardFn === 'function'
        ? (context.clipboardFn as (text: string) => Promise<void> | void)
        : undefined;

  await copyToClipboard(textToCopy, { copyFn });

  // Optional toast notification
  if (payload.notify !== false && (payload.notify === true || payload.toastMessage)) {
    const targetToastManager: ToastManager =
      (context.toastManager as ToastManager) || toastManager;
    targetToastManager.showToast({
      message: payload.toastMessage || 'Copied to clipboard!',
      type: 'success',
      duration: 3000,
    });
  }

  return {
    text: textToCopy,
    copied: true,
  };
};

/**
 * Action Runner for `reset_form`.
 * Resets form context values and DOM form elements to default state.
 */
export const resetFormRunner: PipelineStepHandler = (
  step: ActionStep,
  context: PipelineExecutionContext,
): ResetFormResult => {
  const payload = (step.payload || {}) as ResetFormStepPayload;
  const formId = payload.formId || (typeof context.formId === 'string' ? context.formId : undefined);

  // 1. Invoke FormContext resetForm callback if present
  if (typeof context.resetForm === 'function') {
    context.resetForm();
  }

  // 2. Clear context.form values if present
  if (context.form && typeof context.form === 'object') {
    for (const key of Object.keys(context.form)) {
      context.form[key] = '';
    }
  }

  // 3. Reset DOM form element if in browser
  if (typeof document !== 'undefined') {
    try {
      const formEl = formId
        ? (document.getElementById(formId) as HTMLFormElement)
        : (document.querySelector('form') as HTMLFormElement);
      if (formEl && typeof formEl.reset === 'function') {
        formEl.reset();
      }
    } catch {
      // Ignore
    }
  }

  return {
    formId,
    reset: true,
  };
};
