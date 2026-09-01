import React, { useState } from 'react';
import { Node, ValidationRule, ValidationRuleType, FormConfig } from '@kubuild/schema';
import {
  ShieldCheck,
  Plus,
  Trash2,
  CheckCircle2,
  Mail,
  Code2,
  Minimize,
  Maximize,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export interface FormValidationRulesPanelProps {
  node: Node;
  onUpdateFormConfig: (formConfig: Partial<FormConfig> | null) => void;
  onCommitProp?: (propName: string, value: unknown) => void;
  className?: string;
}

interface RuleTypeDefinition {
  type: ValidationRuleType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  defaultMessage: string;
  hasValue: boolean;
  valueType?: 'number' | 'string';
  defaultValue?: unknown;
  valuePlaceholder?: string;
}

export const SUPPORTED_RULES: RuleTypeDefinition[] = [
  {
    type: 'required',
    label: 'Required',
    description: 'Field must not be empty or blank',
    icon: CheckCircle2,
    defaultMessage: 'This field is required',
    hasValue: false,
  },
  {
    type: 'email',
    label: 'Email',
    description: 'Must be a valid email format',
    icon: Mail,
    defaultMessage: 'Please enter a valid email address',
    hasValue: false,
  },
  {
    type: 'custom_regex',
    label: 'Custom Regex',
    description: 'Must match custom Regular Expression pattern',
    icon: Code2,
    defaultMessage: 'Input format is invalid',
    hasValue: true,
    valueType: 'string',
    defaultValue: '^[a-zA-Z0-9_-]+$',
    valuePlaceholder: 'e.g. ^[0-9]{5}$',
  },
  {
    type: 'min_length',
    label: 'Min Length',
    description: 'Minimum number of characters required',
    icon: Minimize,
    defaultMessage: 'Must be at least 3 characters',
    hasValue: true,
    valueType: 'number',
    defaultValue: 3,
    valuePlaceholder: 'Min characters count',
  },
  {
    type: 'max_length',
    label: 'Max Length',
    description: 'Maximum number of characters allowed',
    icon: Maximize,
    defaultMessage: 'Must not exceed 50 characters',
    hasValue: true,
    valueType: 'number',
    defaultValue: 50,
    valuePlaceholder: 'Max characters count',
  },
];

export function getRuleDefinition(type: string): RuleTypeDefinition | undefined {
  return SUPPORTED_RULES.find((r) => r.type === type);
}

export function isFormFieldNode(node: Node | null): boolean {
  if (!node) return false;
  const formTypes = ['input', 'textarea', 'select', 'checkbox', 'radio'];
  if (formTypes.includes(node.type)) return true;
  if (node.props && typeof node.props.name === 'string' && node.props.name.trim().length > 0) {
    return true;
  }
  return false;
}

export const FormValidationRulesPanel: React.FC<FormValidationRulesPanelProps> = ({
  node,
  onUpdateFormConfig,
  onCommitProp,
  className,
}) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);

  // Read rules from node.formConfig.rules or node.props.rules
  const existingRules: ValidationRule[] =
    node.formConfig?.rules || (node.props?.rules as ValidationRule[]) || [];

  const handleCommitRules = (nextRules: ValidationRule[]) => {
    const currentFormConfig = node.formConfig;
    const updatedFormConfig: FormConfig = {
      formId: currentFormConfig?.formId || (node.props?.name as string) || node.id,
      resetOnSubmit: currentFormConfig?.resetOnSubmit ?? false,
      scrollToFirstError: currentFormConfig?.scrollToFirstError ?? true,
      validateOn: currentFormConfig?.validateOn ?? 'submit',
      initialValues: currentFormConfig?.initialValues,
      rules: nextRules,
    };

    onUpdateFormConfig(updatedFormConfig);
    onCommitProp?.('rules', nextRules);
  };

  const handleAddRule = (ruleDef: RuleTypeDefinition) => {
    setIsAddMenuOpen(false);
    const newRule: ValidationRule = {
      type: ruleDef.type,
      message: ruleDef.defaultMessage,
      ...(ruleDef.hasValue ? { value: ruleDef.defaultValue } : {}),
    };

    const nextRules = [...existingRules, newRule];
    handleCommitRules(nextRules);
  };

  const handleDeleteRule = (index: number) => {
    const nextRules = existingRules.filter((_, idx) => idx !== index);
    handleCommitRules(nextRules);
  };

  const handleUpdateRuleMessage = (index: number, message: string) => {
    const nextRules = existingRules.map((rule, idx) => {
      if (idx !== index) return rule;
      return { ...rule, message };
    });
    handleCommitRules(nextRules);
  };

  const handleUpdateRuleValue = (index: number, rawVal: unknown, valueType?: 'number' | 'string') => {
    const nextRules = existingRules.map((rule, idx) => {
      if (idx !== index) return rule;
      let finalVal = rawVal;
      if (valueType === 'number') {
        const parsed = Number(rawVal);
        finalVal = Number.isNaN(parsed) ? 0 : parsed;
      }
      return { ...rule, value: finalVal };
    });
    handleCommitRules(nextRules);
  };

  return (
    <div
      data-testid="form-validation-rules-panel"
      className={`rounded-lg border border-slate-200 bg-slate-50/70 p-3 flex flex-col gap-3 ${className || ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
            Validation Rules
          </span>
          {existingRules.length > 0 && (
            <span
              data-testid="rules-count-badge"
              className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full"
            >
              {existingRules.length}
            </span>
          )}
        </div>

        {/* Add Rule Dropdown Toggle */}
        <div className="relative">
          <button
            type="button"
            data-testid="add-rule-btn"
            onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
            className="px-2 py-1 text-xs font-medium text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 rounded-md transition flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Rule</span>
          </button>

          {isAddMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsAddMenuOpen(false)}
              />
              <div
                data-testid="add-rule-menu"
                className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-xl border border-slate-200 z-50 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
              >
                <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Select Rule Type
                </div>
                {SUPPORTED_RULES.map((ruleDef) => {
                  const Icon = ruleDef.icon;
                  return (
                    <button
                      key={ruleDef.type}
                      type="button"
                      data-testid={`add-rule-${ruleDef.type}`}
                      onClick={() => handleAddRule(ruleDef)}
                      className="w-full text-left px-2.5 py-1.5 hover:bg-blue-50 text-xs text-slate-700 hover:text-blue-700 flex items-start gap-2 transition cursor-pointer"
                    >
                      <Icon className="w-3.5 h-3.5 mt-0.5 text-slate-500 group-hover:text-blue-600 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="font-semibold text-[11px] leading-tight text-slate-800">
                          {ruleDef.label}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate">
                          {ruleDef.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Rules List */}
      {existingRules.length === 0 ? (
        <div
          data-testid="empty-rules-state"
          className="text-center py-3 px-2 border border-dashed border-slate-200 rounded-md bg-white text-slate-400 text-xs flex flex-col items-center gap-1"
        >
          <HelpCircle className="w-4 h-4 text-slate-300" />
          <span>No validation rules configured.</span>
          <span className="text-[10px] text-slate-400">
            Click "+ Add Rule" to enforce required fields, email format, or min/max lengths.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5" data-testid="active-rules-list">
          {existingRules.map((rule, idx) => {
            const ruleDef = getRuleDefinition(rule.type);
            const Icon = ruleDef?.icon || AlertCircle;
            const hasValue = ruleDef?.hasValue ?? (rule.value !== undefined);
            const valueType = ruleDef?.valueType || (typeof rule.value === 'number' ? 'number' : 'string');

            return (
              <div
                key={`${rule.type}-${idx}`}
                data-testid={`rule-card-${idx}`}
                className="rounded-md border border-slate-200 bg-white p-2.5 shadow-2xs flex flex-col gap-2 transition hover:border-slate-300"
              >
                {/* Rule Item Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="font-semibold text-xs text-slate-800">
                      {ruleDef?.label || rule.type}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      #{idx + 1}
                    </span>
                  </div>

                  <button
                    type="button"
                    data-testid={`delete-rule-${idx}`}
                    title="Delete rule"
                    onClick={() => handleDeleteRule(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Optional Value Input (for min/max/regex) */}
                {hasValue && (
                  <div>
                    <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                      {rule.type === 'min_length'
                        ? 'Min Characters'
                        : rule.type === 'max_length'
                        ? 'Max Characters'
                        : rule.type === 'custom_regex' || rule.type === 'pattern'
                        ? 'Regex Pattern'
                        : 'Rule Value'}
                    </label>
                    <input
                      type={valueType === 'number' ? 'number' : 'text'}
                      data-testid={`rule-value-${idx}`}
                      value={rule.value !== undefined && rule.value !== null ? String(rule.value) : ''}
                      placeholder={ruleDef?.valuePlaceholder || ''}
                      onChange={(e) => handleUpdateRuleValue(idx, e.target.value, valueType)}
                      className="w-full text-xs font-mono bg-slate-50 text-slate-900 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                    />
                  </div>
                )}

                {/* Custom Error Message Input */}
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-0.5">
                    Custom Error Message
                  </label>
                  <input
                    type="text"
                    data-testid={`rule-message-${idx}`}
                    value={rule.message || ''}
                    placeholder="Enter custom error message displayed to user"
                    onChange={(e) => handleUpdateRuleMessage(idx, e.target.value)}
                    className="w-full text-xs bg-slate-50 text-slate-900 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
