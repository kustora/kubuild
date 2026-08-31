import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import type {
  FormConfig,
  FormFieldBinding,
  ActionPipeline,
  PageDocument,
  ValidationRule,
  ValidateOnEvent,
} from '@kubuild/schema';
import {
  applyFieldTransform,
  validateFieldValue,
  validateForm as coreValidateForm,
  ActionPipelineExecutor,
  type Diagnostic,
} from '@kubuild/core';
import { registerDefaultActionRunners } from './action-runners';
import { useRenderContext } from './render-context';

/**
 * Form Runtime State representation.
 */
export interface FormRuntimeState {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  dirty: boolean;
}

/**
 * Partial / input structure for registering a field binding.
 */
export interface FormFieldBindingInput {
  name: string;
  label?: string;
  defaultValue?: unknown;
  rules?: ValidationRule[];
  validateOn?: ValidateOnEvent;
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'number';
  disabled?: boolean;
  required?: boolean;
}

/**
 * Form Runtime Context Value containing state and mutation callbacks.
 */
export interface FormRuntimeContextValue extends FormRuntimeState {
  formId: string;
  formConfig?: FormConfig;
  initialValues: Record<string, unknown>;

  // Callbacks
  setFieldValue: (name: string, value: unknown, shouldValidate?: boolean) => void;
  setFieldTouched: (name: string, isTouched?: boolean, shouldValidate?: boolean) => void;
  setFieldError: (name: string, error: string | null) => void;
  setErrors: (errors: Record<string, string>) => void;
  setValues: (values: Record<string, unknown>, replace?: boolean) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  resetForm: (nextInitialValues?: Record<string, unknown>) => void;
  validateField: (name: string, value?: unknown) => string | null;
  validateForm: (valuesToValidate?: Record<string, unknown>) => Record<string, string>;
  handleFormSubmit: (e?: React.FormEvent | Event) => Promise<boolean>;

  // Field Registration & Meta
  registerField: (binding: FormFieldBindingInput) => () => void;
  getFieldBinding: (name: string) => FormFieldBinding | undefined;
}

/**
 * FormRuntimeContext for consuming form state across the React tree.
 */
export const FormRuntimeContext = createContext<FormRuntimeContextValue | null>(null);

/**
 * Props for FormRuntimeProvider.
 */
export interface FormRuntimeProviderProps {
  formId?: string;
  formConfig?: FormConfig;
  initialValues?: Record<string, unknown>;
  onSubmit?: (
    values: Record<string, unknown>,
    helpers: {
      formId: string;
      setSubmitting: (isSubmitting: boolean) => void;
      resetForm: (nextInitialValues?: Record<string, unknown>) => void;
      setErrors: (errors: Record<string, string>) => void;
    },
  ) => Promise<void> | void;
  onSuccess?: (values: Record<string, unknown>) => void;
  onError?: (errors: Record<string, string>) => void;
  actions?: ActionPipeline[];
  nodeId?: string;
  document?: PageDocument;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  children: React.ReactNode;
}

/**
 * Helper to deep compare/check dirty state between active values and initial values.
 */
function checkIsDirty(
  values: Record<string, unknown>,
  initialValues: Record<string, unknown>,
): boolean {
  const allKeys = new Set([...Object.keys(values), ...Object.keys(initialValues)]);
  for (const key of allKeys) {
    if (values[key] !== initialValues[key]) {
      return true;
    }
  }
  return false;
}

/**
 * FormRuntimeProvider manages local reactive form state, field validation,
 * submission handling, and action pipeline execution.
 */
export const FormRuntimeProvider: React.FC<FormRuntimeProviderProps> = ({
  formId: propFormId,
  formConfig,
  initialValues: propInitialValues,
  onSubmit,
  onSuccess,
  onError,
  actions,
  nodeId,
  document,
  onDiagnostic,
  children,
}) => {
  const renderContext = useRenderContext();

  const formId = useMemo(() => {
    return propFormId || formConfig?.formId || nodeId || 'kubuild-form';
  }, [propFormId, formConfig?.formId, nodeId]);

  const baseInitialValues = useMemo<Record<string, unknown>>(() => {
    return {
      ...(formConfig?.initialValues || {}),
      ...(propInitialValues || {}),
    };
  }, [formConfig?.initialValues, propInitialValues]);

  const [initialValues, setInitialValues] = useState<Record<string, unknown>>(baseInitialValues);
  const [values, setValuesState] = useState<Record<string, unknown>>(baseInitialValues);
  const [errors, setErrorsState] = useState<Record<string, string>>({});
  const [touched, setTouchedState] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Field bindings registry for dynamic validation rules & transforms
  const fieldBindingsRef = useRef<Map<string, FormFieldBinding>>(new Map());

  // Keep latest state in ref to avoid stale closures in callbacks
  const stateRef = useRef({
    values,
    errors,
    touched,
    initialValues,
    isSubmitting,
    formConfig,
  });

  useEffect(() => {
    stateRef.current = {
      values,
      errors,
      touched,
      initialValues,
      isSubmitting,
      formConfig,
    };
  });

  const registerField = useCallback((binding: FormFieldBindingInput) => {
    if (!binding || !binding.name) return () => {};
    const normalized: FormFieldBinding = {
      name: binding.name,
      rules: binding.rules || [],
      validateOn: binding.validateOn || 'blur',
      label: binding.label,
      defaultValue: binding.defaultValue,
      transform: binding.transform,
      disabled: binding.disabled,
      required: binding.required,
    };
    fieldBindingsRef.current.set(binding.name, normalized);

    // Initialize default value if field is not yet present in values
    if (binding.defaultValue !== undefined) {
      if (stateRef.current.values[binding.name] === undefined) {
        stateRef.current.values[binding.name] = binding.defaultValue;
      }
      setValuesState((prev) => {
        if (prev[binding.name] === undefined) {
          return { ...prev, [binding.name]: binding.defaultValue };
        }
        return prev;
      });
    }

    return () => {
      fieldBindingsRef.current.delete(binding.name);
    };
  }, []);

  const getFieldBinding = useCallback((name: string): FormFieldBinding | undefined => {
    return fieldBindingsRef.current.get(name);
  }, []);

  const validateField = useCallback(
    (name: string, valueToValidate?: unknown): string | null => {
      const binding = fieldBindingsRef.current.get(name);
      const currentValues = stateRef.current.values;
      let rawVal = valueToValidate !== undefined ? valueToValidate : currentValues[name];

      if (binding?.transform) {
        rawVal = applyFieldTransform(rawVal, binding.transform);
      }

      const rules = [...(binding?.rules || [])];
      if (binding?.required && !rules.some((r) => r.type === 'required')) {
        rules.unshift({
          type: 'required',
          message: `${binding.label || name} is required`,
        });
      }

      return validateFieldValue(rawVal, rules, currentValues);
    },
    [],
  );

  const validateForm = useCallback(
    (valuesToValidate?: Record<string, unknown>): Record<string, string> => {
      const targetValues = valuesToValidate || stateRef.current.values;
      const bindingsArray = Array.from(fieldBindingsRef.current.values());

      return coreValidateForm(targetValues, bindingsArray);
    },
    [],
  );

  const setFieldError = useCallback((name: string, error: string | null) => {
    setErrorsState((prev) => {
      if (error) {
        return { ...prev, [name]: error };
      }
      if (prev[name] === undefined) {
        return prev;
      }
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const setErrors = useCallback((newErrors: Record<string, string>) => {
    setErrorsState({ ...newErrors });
  }, []);

  const setFieldValue = useCallback(
    (name: string, value: unknown, shouldValidate?: boolean) => {
      const binding = fieldBindingsRef.current.get(name);
      let transformedVal = value;
      if (binding?.transform) {
        transformedVal = applyFieldTransform(value, binding.transform);
      }

      setValuesState((prev) => ({
        ...prev,
        [name]: transformedVal,
      }));

      // Determine validation timing
      const validateTrigger =
        binding?.validateOn || formConfig?.validateOn || 'blur';
      const mustValidate =
        shouldValidate !== undefined ? shouldValidate : validateTrigger === 'change';

      if (mustValidate) {
        const error = validateField(name, transformedVal);
        setFieldError(name, error);
      }
    },
    [formConfig?.validateOn, validateField, setFieldError],
  );

  const setFieldTouched = useCallback(
    (name: string, isTouched: boolean = true, shouldValidate?: boolean) => {
      setTouchedState((prev) => ({
        ...prev,
        [name]: isTouched,
      }));

      const binding = fieldBindingsRef.current.get(name);
      const validateTrigger =
        binding?.validateOn || formConfig?.validateOn || 'blur';
      const mustValidate =
        shouldValidate !== undefined ? shouldValidate : validateTrigger === 'blur' && isTouched;

      if (mustValidate) {
        const error = validateField(name);
        setFieldError(name, error);
      }
    },
    [formConfig?.validateOn, validateField, setFieldError],
  );

  const setValues = useCallback(
    (newValues: Record<string, unknown>, replace: boolean = false) => {
      setValuesState((prev) => (replace ? { ...newValues } : { ...prev, ...newValues }));
    },
    [],
  );

  const setSubmitting = useCallback((submitting: boolean) => {
    setIsSubmitting(submitting);
  }, []);

  const resetForm = useCallback(
    (nextInitialValues?: Record<string, unknown>) => {
      const resetVals = nextInitialValues || initialValues;
      if (nextInitialValues) {
        setInitialValues(nextInitialValues);
      }
      setValuesState({ ...resetVals });
      setErrorsState({});
      setTouchedState({});
      setIsSubmitting(false);
    },
    [initialValues],
  );

  const handleFormSubmit = useCallback(
    async (e?: React.FormEvent | Event): Promise<boolean> => {
      if (e && typeof (e as React.FormEvent).preventDefault === 'function') {
        (e as React.FormEvent).preventDefault();
      }

      if (stateRef.current.isSubmitting) {
        return false;
      }

      const currentValues = stateRef.current.values;

      // 1. Mark all registered fields as touched
      const allTouched: Record<string, boolean> = {};
      for (const fieldName of fieldBindingsRef.current.keys()) {
        allTouched[fieldName] = true;
      }
      setTouchedState(allTouched);

      // 2. Validate form
      const formValidationErrors = validateForm(currentValues);
      setErrorsState(formValidationErrors);

      const isValid = Object.keys(formValidationErrors).length === 0;

      if (!isValid) {
        onError?.(formValidationErrors);

        // Auto-scroll to first invalid input field if configured
        const shouldScroll = formConfig?.scrollToFirstError !== false;
        if (shouldScroll && typeof window !== 'undefined' && typeof document !== 'undefined') {
          const firstErrorField = Object.keys(formValidationErrors)[0];
          if (firstErrorField) {
            try {
              const el =
                window.document.querySelector<HTMLElement>(
                  `[name="${firstErrorField}"], [data-field="${firstErrorField}"]`,
                );
              if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.focus?.();
              }
            } catch {
              // Ignore DOM query failures in non-standard test environments
            }
          }
        }

        return false;
      }

      setIsSubmitting(true);

      try {
        // 3. Execute submit action pipelines if attached
        if (actions && actions.length > 0) {
          const submitPipelines = actions.filter((p) => p.trigger === 'submit' && p.enabled !== false);
          if (submitPipelines.length > 0) {
            const executor = new ActionPipelineExecutor();
            registerDefaultActionRunners(executor);
            for (const pipeline of submitPipelines) {
              const execResult = await executor.execute(pipeline, {
                context: {
                  form: currentValues,
                  variables: renderContext?.variables ? { ...renderContext.variables } : {},
                  nodeId,
                  document,
                },
              });

              if (!execResult.success) {
                const errorMsg =
                  execResult.error instanceof Error
                    ? execResult.error.message
                    : String(execResult.error || 'Submit pipeline failed');
                const diagnostic: Diagnostic = {
                  code: 'ACTION_EXECUTION_ERROR',
                  actionType: pipeline.steps[0]?.type || 'submit',
                  nodeId,
                  message: `Form submit pipeline failed: ${errorMsg}`,
                  error: execResult.error,
                };
                onDiagnostic?.(diagnostic);
                renderContext?.onDiagnostic?.(diagnostic);
                onError?.({ _form: errorMsg });
                setIsSubmitting(false);
                return false;
              }
            }
          }
        }

        // 4. Custom onSubmit handler
        if (onSubmit) {
          await onSubmit(currentValues, {
            formId,
            setSubmitting,
            resetForm,
            setErrors: setErrorsState,
          });
        }

        onSuccess?.(currentValues);

        // 5. Reset form on submit if configured
        if (formConfig?.resetOnSubmit) {
          resetForm();
        }

        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        onError?.({ _form: errorMsg });
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      formConfig,
      actions,
      nodeId,
      document,
      onDiagnostic,
      renderContext,
      onSubmit,
      onSuccess,
      onError,
      formId,
      setSubmitting,
      resetForm,
      validateForm,
    ],
  );

  const isValid = useMemo(() => Object.keys(errors).length === 0, [errors]);
  const dirty = useMemo(() => checkIsDirty(values, initialValues), [values, initialValues]);

  const contextValue = useMemo<FormRuntimeContextValue>(
    () => ({
      formId,
      formConfig,
      initialValues,
      values,
      errors,
      touched,
      isSubmitting,
      isValid,
      dirty,
      setFieldValue,
      setFieldTouched,
      setFieldError,
      setErrors,
      setValues,
      setSubmitting,
      resetForm,
      validateField,
      validateForm,
      handleFormSubmit,
      registerField,
      getFieldBinding,
    }),
    [
      formId,
      formConfig,
      initialValues,
      values,
      errors,
      touched,
      isSubmitting,
      isValid,
      dirty,
      setFieldValue,
      setFieldTouched,
      setFieldError,
      setErrors,
      setValues,
      setSubmitting,
      resetForm,
      validateField,
      validateForm,
      handleFormSubmit,
      registerField,
      getFieldBinding,
    ],
  );

  return (
    <FormRuntimeContext.Provider value={contextValue}>
      {children}
    </FormRuntimeContext.Provider>
  );
};

/**
 * Hook to access the current FormRuntimeContext.
 * Returns null if invoked outside of a FormRuntimeProvider.
 */
export function useFormRuntime(): FormRuntimeContextValue | null {
  return useContext(FormRuntimeContext);
}

/**
 * Hook to access the current FormRuntimeContext (alias for useFormRuntime).
 */
export function useFormContext(): FormRuntimeContextValue | null {
  return useContext(FormRuntimeContext);
}

/**
 * Hook providing status properties of the nearest form context.
 */
export function useFormStatus(): {
  isSubmitting: boolean;
  isValid: boolean;
  dirty: boolean;
  errors: Record<string, string>;
} {
  const form = useFormRuntime();
  return {
    isSubmitting: form?.isSubmitting ?? false,
    isValid: form?.isValid ?? true,
    dirty: form?.dirty ?? false,
    errors: form?.errors ?? {},
  };
}

/**
 * Result returned by the `useFormField` hook.
 */
export interface UseFormFieldReturn<T = unknown> {
  value: T;
  error?: string;
  touched: boolean;
  isInvalid: boolean;
  setValue: (value: T, shouldValidate?: boolean) => void;
  setTouched: (touched?: boolean, shouldValidate?: boolean) => void;
  setError: (error: string | null) => void;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | T) => void;
  onBlur: (e?: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

/**
 * Hook to bind a field component to the nearest FormRuntimeContext.
 */
export function useFormField<T = unknown>(
  name: string,
  binding?: FormFieldBindingInput,
): UseFormFieldReturn<T> {
  const form = useFormRuntime();

  if (form && name) {
    form.registerField(
      binding || {
        name,
      },
    );
  }

  useEffect(() => {
    if (!form || !name) return;
    const unregister = form.registerField(
      binding || {
        name,
      },
    );
    return () => {
      unregister();
    };
  }, [form, name, binding]);

  const value = (form?.values[name] !== undefined ? form.values[name] : binding?.defaultValue) as T;
  const error = form?.errors[name];
  const touched = Boolean(form?.touched[name]);
  const isInvalid = Boolean(error && touched);

  const setValue = useCallback(
    (val: T, shouldValidate?: boolean) => {
      form?.setFieldValue(name, val, shouldValidate);
    },
    [form, name],
  );

  const setTouched = useCallback(
    (isTouched: boolean = true, shouldValidate?: boolean) => {
      form?.setFieldTouched(name, isTouched, shouldValidate);
    },
    [form, name],
  );

  const setError = useCallback(
    (err: string | null) => {
      form?.setFieldError(name, err);
    },
    [form, name],
  );

  const onChange = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement> | T,
    ) => {
      if (e && typeof e === 'object' && 'target' in e && e.target) {
        const target = e.target as HTMLInputElement;
        if (target.type === 'checkbox') {
          setValue(target.checked as unknown as T);
        } else if (target.type === 'number') {
          const num = target.value === '' ? '' : Number(target.value);
          setValue(num as unknown as T);
        } else {
          setValue(target.value as unknown as T);
        }
      } else {
        setValue(e as T);
      }
    },
    [setValue],
  );

  const onBlur = useCallback(() => {
    setTouched(true);
  }, [setTouched]);

  return {
    value,
    error,
    touched,
    isInvalid,
    setValue,
    setTouched,
    setError,
    onChange,
    onBlur,
  };
}
