import React, { useEffect } from 'react';
import type { ValidationRule, ValidateOnEvent, ActionPipeline, PageDocument, Node } from '@kubuild/schema';
import { useFormRuntime } from '../form-context';
import { EditableText } from './editable-text';
import { executeNodeActions } from '../action-dispatcher';
import type { RenderContext, Diagnostic } from '../render-context';

export interface FormContainerNodeProps {
  id?: string;
  name?: string;
  action?: string;
  method?: string;
  target?: string;
  autoComplete?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  mode?: 'editor' | 'runtime';
  dataKubuildNode?: string;
  actions?: ActionPipeline[];
  children?: React.ReactNode;
}

export const FormContainerNode: React.FC<FormContainerNodeProps> = ({
  id,
  name,
  action,
  method = 'POST',
  target,
  autoComplete,
  style,
  onClick,
  mode,
  dataKubuildNode,
  children,
}) => {
  const formRuntime = useFormRuntime();

  const handleSubmit = (e: React.FormEvent) => {
    if (mode === 'editor') {
      e.preventDefault();
      return;
    }
    if (formRuntime) {
      formRuntime.handleFormSubmit(e);
    }
  };

  const handleReset = () => {
    if (formRuntime) {
      formRuntime.resetForm();
    }
  };

  return (
    <form
      id={id}
      name={name}
      action={action}
      method={method}
      target={target}
      autoComplete={autoComplete}
      style={style}
      onClick={onClick}
      onSubmit={handleSubmit}
      onReset={handleReset}
      data-kubuild-node={dataKubuildNode}
      role="form"
      aria-label={name}
    >
      {children}
    </form>
  );
};

export interface FormInputNodeProps {
  id?: string;
  name?: string;
  type?: string;
  placeholder?: string;
  defaultValue?: unknown;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  rules?: ValidationRule[];
  validateOn?: ValidateOnEvent;
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'number';
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  actions?: ActionPipeline[];
  nodeId?: string;
  document?: PageDocument;
  renderContext?: RenderContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  dataKubuildNode?: string;
}

export const FormInputNode: React.FC<FormInputNodeProps> = ({
  id,
  name,
  type = 'text',
  placeholder,
  defaultValue,
  required,
  disabled,
  readOnly,
  rules,
  validateOn,
  transform,
  style,
  onClick,
  actions,
  nodeId,
  document,
  renderContext,
  onDiagnostic,
  onActionDispatch,
  dataKubuildNode,
}) => {
  const formRuntime = useFormRuntime();

  if (formRuntime && name) {
    formRuntime.registerField({
      name,
      defaultValue,
      required,
      disabled,
      rules: rules || [],
      validateOn,
      transform,
    });
  }

  useEffect(() => {
    if (!formRuntime || !name) return;
    const unregister = formRuntime.registerField({
      name,
      defaultValue,
      required,
      disabled,
      rules: rules || [],
      validateOn,
      transform,
    });
    return () => {
      unregister();
    };
  }, [formRuntime, name, defaultValue, required, disabled, rules, validateOn, transform]);

  if (!formRuntime || !name) {
    return (
      <input
        id={id}
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue !== undefined ? String(defaultValue) : undefined}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        style={style}
        onClick={onClick}
        data-kubuild-node={dataKubuildNode}
      />
    );
  }

  const value = formRuntime.values[name];
  const stringVal =
    value !== undefined && value !== null
      ? String(value)
      : defaultValue !== undefined && defaultValue !== null
      ? String(defaultValue)
      : '';
  const error = formRuntime.errors[name];
  const isTouched = Boolean(formRuntime.touched[name]);
  const isInvalid = Boolean(error && isTouched);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val: unknown = e.target.value;
    if (type === 'number') {
      val = e.target.value === '' ? '' : Number(e.target.value);
    }
    formRuntime.setFieldValue(name, val);

    if (actions && actions.length > 0) {
      executeNodeActions({
        node: { id: nodeId || id || name, type: 'input', actions },
        trigger: 'change',
        document,
        context: renderContext,
        formContext: formRuntime,
        extraContext: { fieldName: name, fieldValue: val },
        onDiagnostic,
        onActionDispatch,
      });
    }
  };

  const handleBlur = () => {
    formRuntime.setFieldTouched(name, true);

    if (actions && actions.length > 0) {
      executeNodeActions({
        node: { id: nodeId || id || name, type: 'input', actions },
        trigger: 'blur',
        document,
        context: renderContext,
        formContext: formRuntime,
        extraContext: { fieldName: name, fieldValue: formRuntime.values[name] },
        onDiagnostic,
        onActionDispatch,
      });
    }
  };

  const handleFocus = () => {
    if (actions && actions.length > 0) {
      executeNodeActions({
        node: { id: nodeId || id || name, type: 'input', actions },
        trigger: 'focus',
        document,
        context: renderContext,
        formContext: formRuntime,
        extraContext: { fieldName: name, fieldValue: formRuntime.values[name] },
        onDiagnostic,
        onActionDispatch,
      });
    }
  };

  return (
    <input
      id={id}
      type={type}
      name={name}
      placeholder={placeholder}
      value={stringVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      style={style}
      onClick={onClick}
      data-kubuild-node={dataKubuildNode}
      data-field={name}
      data-invalid={isInvalid ? 'true' : undefined}
      aria-invalid={isInvalid ? true : undefined}
      aria-errormessage={error ? `${id}-error` : undefined}
    />
  );
};

export interface FormTextareaNodeProps {
  id?: string;
  name?: string;
  placeholder?: string;
  defaultValue?: unknown;
  rows?: number;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  rules?: ValidationRule[];
  validateOn?: ValidateOnEvent;
  transform?: 'trim' | 'lowercase' | 'uppercase' | 'number';
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  actions?: ActionPipeline[];
  nodeId?: string;
  document?: PageDocument;
  renderContext?: RenderContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  dataKubuildNode?: string;
}

export const FormTextareaNode: React.FC<FormTextareaNodeProps> = ({
  id,
  name,
  placeholder,
  defaultValue,
  rows = 4,
  required,
  disabled,
  readOnly,
  rules,
  validateOn,
  transform,
  style,
  onClick,
  actions,
  nodeId,
  document,
  renderContext,
  onDiagnostic,
  onActionDispatch,
  dataKubuildNode,
}) => {
  const formRuntime = useFormRuntime();

  if (formRuntime && name) {
    formRuntime.registerField({
      name,
      defaultValue,
      required,
      disabled,
      rules: rules || [],
      validateOn,
      transform,
    });
  }

  useEffect(() => {
    if (!formRuntime || !name) return;
    const unregister = formRuntime.registerField({
      name,
      defaultValue,
      required,
      disabled,
      rules: rules || [],
      validateOn,
      transform,
    });
    return () => {
      unregister();
    };
  }, [formRuntime, name, defaultValue, required, disabled, rules, validateOn, transform]);

  if (!formRuntime || !name) {
    return (
      <textarea
        id={id}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue !== undefined ? String(defaultValue) : undefined}
        rows={rows}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        style={style}
        onClick={onClick}
        data-kubuild-node={dataKubuildNode}
      />
    );
  }

  const value = formRuntime.values[name];
  const stringVal =
    value !== undefined && value !== null
      ? String(value)
      : defaultValue !== undefined && defaultValue !== null
      ? String(defaultValue)
      : '';
  const error = formRuntime.errors[name];
  const isTouched = Boolean(formRuntime.touched[name]);
  const isInvalid = Boolean(error && isTouched);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    formRuntime.setFieldValue(name, e.target.value);

    if (actions && actions.length > 0) {
      executeNodeActions({
        node: { id: nodeId || id || name, type: 'textarea', actions },
        trigger: 'change',
        document,
        context: renderContext,
        formContext: formRuntime,
        extraContext: { fieldName: name, fieldValue: e.target.value },
        onDiagnostic,
        onActionDispatch,
      });
    }
  };

  const handleBlur = () => {
    formRuntime.setFieldTouched(name, true);

    if (actions && actions.length > 0) {
      executeNodeActions({
        node: { id: nodeId || id || name, type: 'textarea', actions },
        trigger: 'blur',
        document,
        context: renderContext,
        formContext: formRuntime,
        extraContext: { fieldName: name, fieldValue: formRuntime.values[name] },
        onDiagnostic,
        onActionDispatch,
      });
    }
  };

  const handleFocus = () => {
    if (actions && actions.length > 0) {
      executeNodeActions({
        node: { id: nodeId || id || name, type: 'textarea', actions },
        trigger: 'focus',
        document,
        context: renderContext,
        formContext: formRuntime,
        extraContext: { fieldName: name, fieldValue: formRuntime.values[name] },
        onDiagnostic,
        onActionDispatch,
      });
    }
  };

  return (
    <textarea
      id={id}
      name={name}
      placeholder={placeholder}
      rows={rows}
      value={stringVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      required={required}
      disabled={disabled}
      readOnly={readOnly}
      style={style}
      onClick={onClick}
      data-kubuild-node={dataKubuildNode}
      data-field={name}
      data-invalid={isInvalid ? 'true' : undefined}
      aria-invalid={isInvalid ? true : undefined}
      aria-errormessage={error ? `${id}-error` : undefined}
    />
  );
};

export interface FormSelectNodeProps {
  id?: string;
  name?: string;
  placeholder?: string;
  defaultValue?: unknown;
  required?: boolean;
  disabled?: boolean;
  rules?: ValidationRule[];
  validateOn?: ValidateOnEvent;
  optionsList: Array<{ label: string; value: string }>;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  actions?: ActionPipeline[];
  nodeId?: string;
  document?: PageDocument;
  renderContext?: RenderContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  dataKubuildNode?: string;
}

export const FormSelectNode: React.FC<FormSelectNodeProps> = ({
  id,
  name,
  placeholder,
  defaultValue,
  required,
  disabled,
  rules,
  validateOn,
  optionsList,
  style,
  onClick,
  actions,
  nodeId,
  document,
  renderContext,
  onDiagnostic,
  onActionDispatch,
  dataKubuildNode,
}) => {
  const formRuntime = useFormRuntime();

  if (formRuntime && name) {
    formRuntime.registerField({
      name,
      defaultValue,
      required,
      disabled,
      rules: rules || [],
      validateOn,
    });
  }

  useEffect(() => {
    if (!formRuntime || !name) return;
    const unregister = formRuntime.registerField({
      name,
      defaultValue,
      required,
      disabled,
      rules: rules || [],
      validateOn,
    });
    return () => {
      unregister();
    };
  }, [formRuntime, name, defaultValue, required, disabled, rules, validateOn]);

  if (!formRuntime || !name) {
    return (
      <select
        id={id}
        name={name}
        defaultValue={defaultValue !== undefined ? String(defaultValue) : ''}
        required={required}
        disabled={disabled}
        style={style}
        onClick={onClick}
        data-kubuild-node={dataKubuildNode}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {optionsList.map((opt, i) => (
          <option key={i} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  const value = formRuntime.values[name];
  const stringVal =
    value !== undefined && value !== null
      ? String(value)
      : defaultValue !== undefined && defaultValue !== null
      ? String(defaultValue)
      : '';
  const error = formRuntime.errors[name];
  const isTouched = Boolean(formRuntime.touched[name]);
  const isInvalid = Boolean(error && isTouched);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    formRuntime.setFieldValue(name, e.target.value);

    if (actions && actions.length > 0) {
      executeNodeActions({
        node: { id: nodeId || id || name, type: 'select', actions },
        trigger: 'change',
        document,
        context: renderContext,
        formContext: formRuntime,
        extraContext: { fieldName: name, fieldValue: e.target.value },
        onDiagnostic,
        onActionDispatch,
      });
    }
  };

  const handleBlur = () => {
    formRuntime.setFieldTouched(name, true);

    if (actions && actions.length > 0) {
      executeNodeActions({
        node: { id: nodeId || id || name, type: 'select', actions },
        trigger: 'blur',
        document,
        context: renderContext,
        formContext: formRuntime,
        extraContext: { fieldName: name, fieldValue: formRuntime.values[name] },
        onDiagnostic,
        onActionDispatch,
      });
    }
  };

  const handleFocus = () => {
    if (actions && actions.length > 0) {
      executeNodeActions({
        node: { id: nodeId || id || name, type: 'select', actions },
        trigger: 'focus',
        document,
        context: renderContext,
        formContext: formRuntime,
        extraContext: { fieldName: name, fieldValue: formRuntime.values[name] },
        onDiagnostic,
        onActionDispatch,
      });
    }
  };

  return (
    <select
      id={id}
      name={name}
      value={stringVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={handleFocus}
      required={required}
      disabled={disabled}
      style={style}
      onClick={onClick}
      data-kubuild-node={dataKubuildNode}
      data-field={name}
      data-invalid={isInvalid ? 'true' : undefined}
      aria-invalid={isInvalid ? true : undefined}
      aria-errormessage={error ? `${id}-error` : undefined}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {optionsList.map((opt, i) => (
        <option key={i} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

export interface FormCheckboxNodeProps {
  id?: string;
  name?: string;
  label?: string;
  value?: string;
  defaultChecked?: boolean;
  required?: boolean;
  disabled?: boolean;
  rules?: ValidationRule[];
  validateOn?: ValidateOnEvent;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  actions?: ActionPipeline[];
  nodeId?: string;
  document?: PageDocument;
  renderContext?: RenderContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  dataKubuildNode?: string;
  isEditable?: boolean;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
}

export const FormCheckboxNode: React.FC<FormCheckboxNodeProps> = ({
  id,
  name,
  label = '',
  defaultChecked = false,
  required,
  disabled,
  rules,
  validateOn,
  style,
  onClick,
  actions,
  nodeId,
  document,
  renderContext,
  onDiagnostic,
  onActionDispatch,
  dataKubuildNode,
  isEditable,
  onNodePropChange,
}) => {
  const formRuntime = useFormRuntime();

  if (formRuntime && name) {
    formRuntime.registerField({
      name,
      defaultValue: defaultChecked,
      required,
      disabled,
      rules: rules || [],
      validateOn,
    });
  }

  useEffect(() => {
    if (!formRuntime || !name) return;
    const unregister = formRuntime.registerField({
      name,
      defaultValue: defaultChecked,
      required,
      disabled,
      rules: rules || [],
      validateOn,
    });
    return () => {
      unregister();
    };
  }, [formRuntime, name, defaultChecked, required, disabled, rules, validateOn]);

  const isChecked =
    formRuntime && name
      ? formRuntime.values[name] !== undefined
        ? Boolean(formRuntime.values[name])
        : defaultChecked
      : defaultChecked;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (formRuntime && name) {
      formRuntime.setFieldValue(name, e.target.checked);

      if (actions && actions.length > 0) {
        executeNodeActions({
          node: { id: nodeId || id || name, type: 'checkbox', actions },
          trigger: 'change',
          document,
          context: renderContext,
          formContext: formRuntime,
          extraContext: { fieldName: name, fieldValue: e.target.checked },
          onDiagnostic,
          onActionDispatch,
        });
      }
    }
  };

  const handleBlur = () => {
    if (formRuntime && name) {
      formRuntime.setFieldTouched(name, true);

      if (actions && actions.length > 0) {
        executeNodeActions({
          node: { id: nodeId || id || name, type: 'checkbox', actions },
          trigger: 'blur',
          document,
          context: renderContext,
          formContext: formRuntime,
          extraContext: { fieldName: name, fieldValue: isChecked },
          onDiagnostic,
          onActionDispatch,
        });
      }
    }
  };

  return (
    <label id={id} style={style} onClick={onClick} data-kubuild-node={dataKubuildNode}>
      <input
        type="checkbox"
        name={name}
        checked={isChecked}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        data-field={name}
      />
      {isEditable ? (
        <EditableText
          as="span"
          value={label}
          isEditable={isEditable}
          nodeId={dataKubuildNode || ''}
          onChange={(val, isBlur) => onNodePropChange?.(dataKubuildNode || '', 'label', val, isBlur)}
        />
      ) : (
        <span>{label}</span>
      )}
    </label>
  );
};

export interface FormRadioNodeProps {
  id?: string;
  name?: string;
  label?: string;
  value?: string;
  defaultChecked?: boolean;
  required?: boolean;
  disabled?: boolean;
  rules?: ValidationRule[];
  validateOn?: ValidateOnEvent;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  actions?: ActionPipeline[];
  nodeId?: string;
  document?: PageDocument;
  renderContext?: RenderContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  dataKubuildNode?: string;
  isEditable?: boolean;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
}

export const FormRadioNode: React.FC<FormRadioNodeProps> = ({
  id,
  name,
  label = '',
  value = '',
  defaultChecked = false,
  required,
  disabled,
  rules,
  validateOn,
  style,
  onClick,
  actions,
  nodeId,
  document,
  renderContext,
  onDiagnostic,
  onActionDispatch,
  dataKubuildNode,
  isEditable,
  onNodePropChange,
}) => {
  const formRuntime = useFormRuntime();

  if (formRuntime && name) {
    formRuntime.registerField({
      name,
      defaultValue: defaultChecked ? value : undefined,
      required,
      disabled,
      rules: rules || [],
      validateOn,
    });
  }

  useEffect(() => {
    if (!formRuntime || !name) return;
    const unregister = formRuntime.registerField({
      name,
      defaultValue: defaultChecked ? value : undefined,
      required,
      disabled,
      rules: rules || [],
      validateOn,
    });
    return () => {
      unregister();
    };
  }, [formRuntime, name, defaultChecked, value, required, disabled, rules, validateOn]);

  const isChecked =
    formRuntime && name
      ? formRuntime.values[name] !== undefined
        ? formRuntime.values[name] === value
        : defaultChecked
      : defaultChecked;

  const handleChange = () => {
    if (formRuntime && name) {
      formRuntime.setFieldValue(name, value);

      if (actions && actions.length > 0) {
        executeNodeActions({
          node: { id: nodeId || id || name, type: 'radio', actions },
          trigger: 'change',
          document,
          context: renderContext,
          formContext: formRuntime,
          extraContext: { fieldName: name, fieldValue: value },
          onDiagnostic,
          onActionDispatch,
        });
      }
    }
  };

  const handleBlur = () => {
    if (formRuntime && name) {
      formRuntime.setFieldTouched(name, true);

      if (actions && actions.length > 0) {
        executeNodeActions({
          node: { id: nodeId || id || name, type: 'radio', actions },
          trigger: 'blur',
          document,
          context: renderContext,
          formContext: formRuntime,
          extraContext: { fieldName: name, fieldValue: value },
          onDiagnostic,
          onActionDispatch,
        });
      }
    }
  };

  return (
    <label id={id} style={style} onClick={onClick} data-kubuild-node={dataKubuildNode}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={isChecked}
        onChange={handleChange}
        onBlur={handleBlur}
        required={required}
        disabled={disabled}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
        data-field={name}
      />
      {isEditable ? (
        <EditableText
          as="span"
          value={label}
          isEditable={isEditable}
          nodeId={dataKubuildNode || ''}
          onChange={(val, isBlur) => onNodePropChange?.(dataKubuildNode || '', 'label', val, isBlur)}
        />
      ) : (
        <span>{label}</span>
      )}
    </label>
  );
};

export interface FormSubmitButtonNodeProps {
  id?: string;
  buttonType: 'submit' | 'button' | 'reset';
  disabled?: boolean;
  ariaLabel?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  actions?: ActionPipeline[];
  node?: Node;
  document?: PageDocument;
  renderContext?: RenderContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;
  dataKubuildNode?: string;
  actionAttrs?: Record<string, unknown>;
  children: React.ReactNode;
}

export const FormSubmitButtonNode: React.FC<FormSubmitButtonNodeProps> = ({
  id,
  buttonType,
  disabled,
  ariaLabel,
  style,
  onClick,
  actions,
  node,
  document,
  renderContext,
  onDiagnostic,
  onActionDispatch,
  dataKubuildNode,
  actionAttrs,
  children,
}) => {
  const formRuntime = useFormRuntime();
  const isSubmitting = formRuntime?.isSubmitting === true;
  const isEffectivelyDisabled = disabled || (buttonType === 'submit' && isSubmitting);

  const handleClick = async (e: React.MouseEvent) => {
    if (isEffectivelyDisabled) return;

    // 1. Submit validation & execution
    if (buttonType === 'submit') {
      if (formRuntime) {
        const isValid = await formRuntime.handleFormSubmit(e);
        if (!isValid) {
          // Validation failed: do not proceed with click action pipelines
          return;
        }
      }
    } else if (buttonType === 'reset') {
      if (formRuntime) {
        formRuntime.resetForm();
      }
    }

    // 2. Execute button node action pipelines if any
    const targetNode = node || {
      id: dataKubuildNode || id || 'button',
      type: 'button',
      actions,
    };

    if (targetNode.actions && targetNode.actions.length > 0) {
      await executeNodeActions({
        node: targetNode,
        trigger: 'click',
        document,
        context: renderContext,
        formContext: formRuntime,
        onDiagnostic,
        onActionDispatch,
      });
    }

    if (onClick) {
      onClick(e);
    }
  };

  return (
    <button
      id={id}
      type={buttonType}
      disabled={isEffectivelyDisabled}
      aria-disabled={isEffectivelyDisabled ? true : undefined}
      aria-label={ariaLabel}
      aria-busy={buttonType === 'submit' && isSubmitting ? true : undefined}
      tabIndex={isEffectivelyDisabled ? -1 : 0}
      style={style}
      onClick={isEffectivelyDisabled ? undefined : handleClick}
      data-kubuild-node={dataKubuildNode}
      {...actionAttrs}
    >
      {children}
    </button>
  );
};
