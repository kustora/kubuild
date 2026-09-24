import React, { useEffect, useMemo, useState } from 'react';
import type { ValidationRule, ValidateOnEvent, ActionPipeline, PageDocument, Node } from '@kubuild/schema';
import { icons as lucideIcons, Loader2 } from 'lucide-react';
import { useFormRuntime, type FormFieldBindingInput } from '../form-context';
import { executeNodeActions } from '../action-dispatcher';
import type { RenderContext, Diagnostic } from '../render-context';
import { EditableText } from './editable-text';
import { RadioGroupContext, type RadioGroupContextValue } from './radio-group-context';
import { handleFormButtonClick } from './form-nodes';
import { toPascalCase } from './media-utils';

/**
 * Form field renderers for `switch`, `file-upload`, `radio-group` and `button-submit`
 * (STORA-531). Each one integrates with the enclosing `FormRuntimeProvider`: the value is
 * registered under the node's `name` and `required` is enforced by form validation.
 */

type ActionDispatchFn = (actionType: string, payload: Record<string, unknown> | undefined, nodeId: string) => void;

interface FieldActionProps {
  actions?: ActionPipeline[];
  nodeId?: string;
  document?: PageDocument;
  renderContext?: RenderContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: ActionDispatchFn;
}

const visuallyHiddenStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

const helperTextStyle: React.CSSProperties = { fontSize: '12px', color: '#64748b' };
const errorTextStyle: React.CSSProperties = { fontSize: '12px', color: '#dc2626' };
const EMPTY_RULES: ValidationRule[] = [];

/**
 * Registers a field binding with the enclosing form runtime (synchronously during render so
 * default values are visible to the first submit, and again in an effect for cleanup) —
 * the same pattern the built-in input/checkbox nodes use.
 */
function useRegisteredField(binding: FormFieldBindingInput | null): ReturnType<typeof useFormRuntime> {
  const formRuntime = useFormRuntime();
  if (formRuntime && binding?.name) {
    formRuntime.registerField(binding);
  }
  const name = binding?.name;
  const { defaultValue, required, disabled, rules, validateOn } = binding || {};
  useEffect(() => {
    if (!formRuntime || !name) return;
    return formRuntime.registerField({ name, defaultValue, required, disabled, rules: rules || [], validateOn });
  }, [formRuntime, name, defaultValue, required, disabled, rules, validateOn]);
  return formRuntime;
}

function runFieldActions(
  props: FieldActionProps,
  type: string,
  trigger: 'change' | 'blur',
  formRuntime: ReturnType<typeof useFormRuntime>,
  fieldName: string,
  fieldValue: unknown,
): void {
  if (!props.actions || props.actions.length === 0) return;
  executeNodeActions({
    node: { id: props.nodeId || fieldName, type, actions: props.actions },
    trigger,
    document: props.document,
    context: props.renderContext,
    formContext: formRuntime,
    extraContext: { fieldName, fieldValue },
    onDiagnostic: props.onDiagnostic,
    onActionDispatch: props.onActionDispatch,
  });
}

function FieldFeedback({
  id,
  helperText,
  error,
}: {
  id?: string;
  helperText?: string;
  error?: string;
}): React.ReactElement | null {
  if (!helperText && !error) return null;
  return (
    <>
      {helperText ? (
        <span style={helperTextStyle} data-kubuild-helper-text>
          {helperText}
        </span>
      ) : null}
      {error ? (
        <span id={id ? `${id}-error` : undefined} role="alert" style={errorTextStyle} data-kubuild-field-error>
          {error}
        </span>
      ) : null}
    </>
  );
}

// ------------------------------------------------------------------------------------------------
// radio-group
// ------------------------------------------------------------------------------------------------

export interface FormRadioGroupNodeProps {
  id?: string;
  name?: string;
  defaultSelected?: string;
  required?: boolean;
  disabled?: boolean;
  orientation?: 'vertical' | 'horizontal';
  helperText?: string;
  ariaLabel?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  dataKubuildNode?: string;
  children?: React.ReactNode;
}

export const FormRadioGroupNode: React.FC<FormRadioGroupNodeProps> = ({
  id,
  name,
  defaultSelected,
  required,
  disabled,
  orientation = 'vertical',
  helperText,
  ariaLabel,
  style,
  onClick,
  dataKubuildNode,
  children,
}) => {
  const formRuntime = useRegisteredField(
    name ? { name, defaultValue: defaultSelected || undefined, required, disabled, rules: EMPTY_RULES } : null,
  );

  const groupContext = useMemo<RadioGroupContextValue | null>(
    () => (name ? { name, required, disabled } : null),
    [name, required, disabled],
  );

  const error = formRuntime && name && formRuntime.touched[name] ? formRuntime.errors[name] : undefined;
  const groupStyle: React.CSSProperties = {
    ...style,
    ...(orientation === 'horizontal' ? { flexDirection: 'row', flexWrap: 'wrap' } : {}),
  };

  return (
    <RadioGroupContext.Provider value={groupContext}>
      <div
        id={id}
        role="radiogroup"
        aria-label={ariaLabel}
        aria-required={required ? true : undefined}
        aria-disabled={disabled ? true : undefined}
        aria-invalid={error ? true : undefined}
        aria-orientation={orientation}
        style={groupStyle}
        onClick={onClick}
        data-kubuild-node={dataKubuildNode}
        data-field={name}
      >
        {children}
        <FieldFeedback id={id} helperText={helperText} error={error} />
      </div>
    </RadioGroupContext.Provider>
  );
};

// ------------------------------------------------------------------------------------------------
// switch
// ------------------------------------------------------------------------------------------------

const SWITCH_SIZES = {
  sm: { width: 28, height: 16 },
  md: { width: 36, height: 20 },
  lg: { width: 44, height: 24 },
} as const;

export interface FormSwitchNodeProps extends FieldActionProps {
  id?: string;
  name?: string;
  label?: string;
  /** Value stored in the form when on. Empty → `true`. When off the field holds `false`. */
  value?: string;
  defaultChecked?: boolean;
  switchSize?: 'sm' | 'md' | 'lg';
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  ariaLabel?: string;
  rules?: ValidationRule[];
  validateOn?: ValidateOnEvent;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  dataKubuildNode?: string;
  isEditable?: boolean;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
}

export const FormSwitchNode: React.FC<FormSwitchNodeProps> = (props) => {
  const {
    id,
    name,
    label = '',
    value,
    defaultChecked = false,
    switchSize = 'md',
    required,
    disabled,
    helperText,
    ariaLabel,
    rules,
    validateOn,
    style,
    onClick,
    dataKubuildNode,
    isEditable,
    onNodePropChange,
  } = props;
  const onValue: unknown = value !== undefined && value !== '' ? value : true;

  const formRuntime = useRegisteredField(
    name
      ? { name, defaultValue: defaultChecked ? onValue : false, required, disabled, rules: rules || [], validateOn }
      : null,
  );
  const [localChecked, setLocalChecked] = useState<boolean>(defaultChecked);

  const bound = Boolean(formRuntime && name);
  const current = bound ? formRuntime!.values[name!] : undefined;
  const isChecked = bound
    ? current !== undefined
      ? current === onValue || current === true
      : defaultChecked
    : localChecked;
  const error = bound && formRuntime!.touched[name!] ? formRuntime!.errors[name!] : undefined;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextValue = e.target.checked ? onValue : false;
    if (bound) {
      formRuntime!.setFieldValue(name!, nextValue);
    } else {
      setLocalChecked(e.target.checked);
    }
    runFieldActions(props, 'switch', 'change', formRuntime, name || id || 'switch', nextValue);
  };

  const handleBlur = () => {
    if (bound) formRuntime!.setFieldTouched(name!, true);
    runFieldActions(props, 'switch', 'blur', formRuntime, name || id || 'switch', isChecked ? onValue : false);
  };

  const size = SWITCH_SIZES[switchSize] || SWITCH_SIZES.md;
  const thumbSize = size.height - 4;
  const trackStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-block',
    flexShrink: 0,
    width: size.width,
    height: size.height,
    borderRadius: size.height,
    backgroundColor: isChecked ? '#2563eb' : '#cbd5e1',
    opacity: disabled ? 0.5 : 1,
    transition: 'background-color 150ms ease',
  };
  const thumbStyle: React.CSSProperties = {
    position: 'absolute',
    top: 2,
    left: isChecked ? size.width - thumbSize - 2 : 2,
    width: thumbSize,
    height: thumbSize,
    borderRadius: '50%',
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
    transition: 'left 150ms ease',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label
        id={id}
        style={{ position: 'relative', ...style, cursor: disabled ? 'not-allowed' : style?.cursor }}
        onClick={onClick}
        data-kubuild-node={dataKubuildNode}
      >
        <input
          type="checkbox"
          role="switch"
          name={name}
          value={typeof onValue === 'string' ? onValue : undefined}
          checked={isChecked}
          aria-checked={isChecked}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          onChange={handleChange}
          onBlur={handleBlur}
          required={required}
          disabled={disabled}
          style={visuallyHiddenStyle}
          data-field={name}
        />
        <span aria-hidden="true" style={trackStyle} data-kubuild-switch-track data-state={isChecked ? 'on' : 'off'}>
          <span style={thumbStyle} />
        </span>
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
      <FieldFeedback id={id} helperText={helperText} error={error} />
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// file-upload
// ------------------------------------------------------------------------------------------------

export interface FormFileUploadNodeProps extends FieldActionProps {
  id?: string;
  name?: string;
  label?: string;
  accept?: string;
  /** Maximum size per file, in megabytes. */
  maxFileSize?: number;
  multiple?: boolean;
  showPreview?: boolean;
  required?: boolean;
  disabled?: boolean;
  helperText?: string;
  ariaLabel?: string;
  rules?: ValidationRule[];
  validateOn?: ValidateOnEvent;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  mode?: 'editor' | 'runtime';
  dataKubuildNode?: string;
  isEditable?: boolean;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Splits picked files into accepted / rejected by the per-file size limit (MB).
 * Exported for tests.
 */
export function partitionFilesBySize<T extends { size: number }>(
  files: T[],
  maxFileSizeMb?: number,
): { accepted: T[]; rejected: T[] } {
  if (typeof maxFileSizeMb !== 'number' || !(maxFileSizeMb > 0)) {
    return { accepted: files, rejected: [] };
  }
  const limit = maxFileSizeMb * 1024 * 1024;
  return {
    accepted: files.filter((f) => f.size <= limit),
    rejected: files.filter((f) => f.size > limit),
  };
}

export const FormFileUploadNode: React.FC<FormFileUploadNodeProps> = (props) => {
  const {
    id,
    name,
    label = '',
    accept,
    maxFileSize,
    multiple = false,
    showPreview = true,
    required,
    disabled,
    helperText,
    ariaLabel,
    rules,
    validateOn,
    style,
    onClick,
    mode,
    dataKubuildNode,
    isEditable,
    onNodePropChange,
  } = props;

  const formRuntime = useRegisteredField(
    name ? { name, required, disabled, rules: rules || [], validateOn } : null,
  );
  const [selected, setSelected] = useState<File[]>([]);
  const [sizeError, setSizeError] = useState<string | undefined>(undefined);

  const bound = Boolean(formRuntime && name);
  const inputId = id ? `${id}-input` : undefined;
  const formError = bound && formRuntime!.touched[name!] ? formRuntime!.errors[name!] : undefined;
  const error = sizeError || formError;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files || []);
    const { accepted, rejected } = partitionFilesBySize(picked, maxFileSize);
    const nextSizeError =
      rejected.length > 0
        ? `${rejected.map((f) => `"${f.name}"`).join(', ')} exceed${rejected.length === 1 ? 's' : ''} the ${maxFileSize} MB limit`
        : undefined;
    setSizeError(nextSizeError);
    setSelected(accepted);

    const nextValue = multiple ? accepted : accepted[0] ?? null;
    if (bound) {
      formRuntime!.setFieldValue(name!, nextValue);
      formRuntime!.setFieldTouched(name!, true, !nextSizeError);
      if (nextSizeError) formRuntime!.setFieldError(name!, nextSizeError);
    }
    runFieldActions(props, 'file-upload', 'change', formRuntime, name || id || 'file-upload', nextValue);
  };

  // Keep the local selection in sync when the form is reset.
  const currentValue = bound ? formRuntime!.values[name!] : undefined;
  useEffect(() => {
    if (bound && (currentValue === undefined || currentValue === null)) {
      setSelected([]);
    }
  }, [bound, currentValue]);

  return (
    <div id={id} style={style} onClick={onClick} data-kubuild-node={dataKubuildNode}>
      {isEditable ? (
        <EditableText
          as="span"
          value={label}
          isEditable={isEditable}
          nodeId={dataKubuildNode || ''}
          onChange={(val, isBlur) => onNodePropChange?.(dataKubuildNode || '', 'label', val, isBlur)}
        />
      ) : label ? (
        <label htmlFor={inputId}>{label}</label>
      ) : null}
      <input
        id={inputId}
        type="file"
        name={name}
        accept={accept && accept !== '*/*' ? accept : undefined}
        multiple={multiple}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={error ? true : undefined}
        aria-errormessage={error && id ? `${id}-error` : undefined}
        onChange={handleChange}
        // In the editor a click must select the node, not open the OS file picker.
        tabIndex={mode === 'editor' ? -1 : undefined}
        style={mode === 'editor' ? { pointerEvents: 'none' } : undefined}
        data-field={name}
      />
      {showPreview && selected.length > 0 ? (
        <ul data-kubuild-file-preview style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: '#475569' }}>
          {selected.map((file) => (
            <li key={`${file.name}-${file.size}`}>
              {file.name} ({formatFileSize(file.size)})
            </li>
          ))}
        </ul>
      ) : null}
      <FieldFeedback id={id} helperText={helperText} error={error} />
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// button-submit
// ------------------------------------------------------------------------------------------------

const SPINNER_KEYFRAMES = '@keyframes kubuild-spin{to{transform:rotate(360deg)}}';

function resolveLucideIcon(name?: string): React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }> | null {
  if (!name) return null;
  const registry = lucideIcons as unknown as Record<string, React.ComponentType<{ size?: number }>>;
  return registry[toPascalCase(name)] || registry[name] || null;
}

export interface FormButtonSubmitNodeProps {
  id?: string;
  label: string;
  loadingText?: string;
  showSpinner?: boolean;
  autoDisableOnSubmit?: boolean;
  buttonType: 'submit' | 'button' | 'reset';
  variant?: string;
  disabled?: boolean;
  prefixIcon?: string;
  suffixIcon?: string;
  ariaLabel?: string;
  title?: string;
  style?: React.CSSProperties;
  onClick?: (e: React.MouseEvent) => void;
  node?: Node;
  document?: PageDocument;
  renderContext?: RenderContext;
  onDiagnostic?: (diagnostic: Diagnostic) => void;
  onActionDispatch?: ActionDispatchFn;
  dataKubuildNode?: string;
  isEditable?: boolean;
  onNodePropChange?: (nodeId: string, propName: string, value: unknown, isBlur?: boolean) => void;
}

/**
 * Submit button honouring `loadingText`, `showSpinner` and `autoDisableOnSubmit` while the
 * enclosing form's submit pipeline runs (`formRuntime.isSubmitting`) or its own click is
 * still being handled.
 */
export const FormButtonSubmitNode: React.FC<FormButtonSubmitNodeProps> = ({
  id,
  label,
  loadingText,
  showSpinner = true,
  autoDisableOnSubmit = true,
  buttonType,
  variant,
  disabled,
  prefixIcon,
  suffixIcon,
  ariaLabel,
  title,
  style,
  onClick,
  node,
  document,
  renderContext,
  onDiagnostic,
  onActionDispatch,
  dataKubuildNode,
  isEditable,
  onNodePropChange,
}) => {
  const formRuntime = useFormRuntime();
  const [isHandlingClick, setIsHandlingClick] = useState(false);
  const isBusy =
    isHandlingClick || (buttonType === 'submit' && formRuntime?.isSubmitting === true);
  const isEffectivelyDisabled = Boolean(disabled) || (autoDisableOnSubmit && isBusy);

  const handleClick = async (e: React.MouseEvent) => {
    if (isEffectivelyDisabled) return;
    setIsHandlingClick(true);
    try {
      await handleFormButtonClick({
        event: e,
        buttonType,
        disabled: isEffectivelyDisabled,
        formRuntime,
        onClick,
        node,
        document,
        renderContext,
        onDiagnostic,
        onActionDispatch,
      });
    } finally {
      setIsHandlingClick(false);
    }
  };

  const PrefixIcon = resolveLucideIcon(prefixIcon);
  const SuffixIcon = resolveLucideIcon(suffixIcon);
  const text = isBusy && loadingText ? loadingText : label;

  return (
    <button
      id={id}
      type={buttonType}
      disabled={isEffectivelyDisabled}
      aria-disabled={isEffectivelyDisabled ? true : undefined}
      aria-busy={isBusy ? true : undefined}
      aria-label={ariaLabel}
      title={title}
      tabIndex={isEffectivelyDisabled ? -1 : 0}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', ...style }}
      onClick={isEffectivelyDisabled ? undefined : handleClick}
      data-kubuild-node={dataKubuildNode}
      data-variant={variant}
      data-state={isBusy ? 'submitting' : 'idle'}
    >
      {isBusy && showSpinner ? (
        <>
          <style>{SPINNER_KEYFRAMES}</style>
          <Loader2
            size={16}
            aria-hidden="true"
            data-kubuild-spinner
            style={{ animation: 'kubuild-spin 1s linear infinite' }}
          />
        </>
      ) : PrefixIcon ? (
        <PrefixIcon size={16} aria-hidden />
      ) : null}
      {isEditable && !isBusy ? (
        <EditableText
          as="span"
          value={label}
          isEditable={isEditable}
          nodeId={dataKubuildNode || ''}
          onChange={(val, isBlur) => onNodePropChange?.(dataKubuildNode || '', 'label', val, isBlur)}
        />
      ) : (
        <span>{text}</span>
      )}
      {!isBusy && SuffixIcon ? <SuffixIcon size={16} aria-hidden /> : null}
    </button>
  );
};
