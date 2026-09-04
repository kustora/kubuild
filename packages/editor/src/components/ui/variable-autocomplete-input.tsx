import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { PageDocument, Node } from '@kubuild/schema';
import {
  Code2,
  FileText,
  Database,
  Globe,
  Variable,
  Layers,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import {
  collectDocumentNodes,
  collectDocumentFormFields,
} from '../../utils/document-scanner';

export type VariableCategory = 'form' | 'variables' | 'response' | 'state';

export interface VariableSuggestionItem {
  key: string;
  label: string;
  category: VariableCategory;
  description: string;
  sample?: string;
}

// ------------------------------------------------------------------------------------------------
// Document Scanners & Suggestion Generators
// ------------------------------------------------------------------------------------------------


export function getAllVariableSuggestions(doc?: PageDocument): VariableSuggestionItem[] {
  const dynamicFormFields = collectDocumentFormFields(doc);
  const baseFormFields = ['email', 'name', 'phone', 'message', 'address', 'searchQuery', 'quantity'];
  const allFormFields = Array.from(new Set([...dynamicFormFields, ...baseFormFields]));

  const suggestions: VariableSuggestionItem[] = [];

  // 1. Form fields: form.<field>
  for (const field of allFormFields) {
    suggestions.push({
      key: `form.${field}`,
      label: `form.${field}`,
      category: 'form',
      description: `Value of the "${field}" form field`,
      sample: field === 'email' ? 'user@example.com' : field === 'name' ? 'Jane Doe' : undefined,
    });
  }

  // 2. Variables: variables.<key>
  const variableKeys = [
    { key: 'variables.token', desc: 'Auth token or session bearer', sample: 'eyJhbGciOi...' },
    { key: 'variables.userId', desc: 'Current authenticated user ID', sample: 'usr_94821' },
    { key: 'variables.apiKey', desc: 'Public or workspace API key', sample: 'pk_live_...' },
    { key: 'variables.currentTimestamp', desc: 'Unix timestamp of trigger event', sample: '1741234567' },
    { key: 'variables.currentPage', desc: 'Current route or page path', sample: '/checkout' },
  ];
  for (const v of variableKeys) {
    suggestions.push({
      key: v.key,
      label: v.key,
      category: 'variables',
      description: v.desc,
      sample: v.sample,
    });
  }

  // 3. Response fields: response.<field>
  const responseKeys = [
    { key: 'response.data', desc: 'Parsed JSON response body object', sample: '{"id": 1}' },
    { key: 'response.id', desc: 'Primary ID returned by API response', sample: '101' },
    { key: 'response.token', desc: 'Token or secret returned by endpoint', sample: 'tok_abc...' },
    { key: 'response.message', desc: 'Status message from API response', sample: 'Success' },
    { key: 'response.status', desc: 'HTTP status code (e.g. 200, 201)', sample: '200' },
  ];
  for (const r of responseKeys) {
    suggestions.push({
      key: r.key,
      label: r.key,
      category: 'response',
      description: r.desc,
      sample: r.sample,
    });
  }

  // 4. Runtime state: state.<key>
  const stateKeys = [
    { key: 'state.isSubmitted', desc: 'State flag whether form was submitted', sample: 'true' },
    { key: 'state.selectedPlan', desc: 'User selected plan or tier', sample: 'pro' },
    { key: 'state.cartCount', desc: 'Number of items in shopping cart', sample: '3' },
  ];
  for (const s of stateKeys) {
    suggestions.push({
      key: s.key,
      label: s.key,
      category: 'state',
      description: s.desc,
      sample: s.sample,
    });
  }

  return suggestions;
}

export function filterVariableSuggestions(
  query: string,
  doc?: PageDocument,
): VariableSuggestionItem[] {
  const all = getAllVariableSuggestions(doc);
  const cleanQuery = query.toLowerCase().trim().replace(/^\{\{/, '').replace(/\}\}$/, '');

  if (!cleanQuery) return all;

  return all.filter(
    (item) =>
      item.key.toLowerCase().includes(cleanQuery) ||
      item.description.toLowerCase().includes(cleanQuery) ||
      item.category.toLowerCase().includes(cleanQuery),
  );
}

/**
 * Replaces or inserts the variable token at cursor position.
 * If cursor is right after `{{...`, it replaces the partial `{{...` with `{{variableKey}}`.
 */
export function insertVariableToken(
  currentText: string,
  cursorPosition: number,
  variableKey: string,
): { nextText: string; newCursorPos: number } {
  const templateStr = `{{${variableKey}}}`;
  const textBefore = currentText.substring(0, cursorPosition);
  const textAfter = currentText.substring(cursorPosition);

  // Check if there is an unclosed `{{` right before the cursor
  const lastOpenBraceIndex = textBefore.lastIndexOf('{{');
  const lastCloseBraceIndex = textBefore.lastIndexOf('}}');

  if (lastOpenBraceIndex !== -1 && lastOpenBraceIndex > lastCloseBraceIndex) {
    // Replace from `{{` to cursor (and skip any immediately following closing `}}` if present)
    const prefix = textBefore.substring(0, lastOpenBraceIndex);
    let suffix = textAfter;
    if (suffix.startsWith('}}')) {
      suffix = suffix.substring(2);
    }
    const nextText = `${prefix}${templateStr}${suffix}`;
    const newCursorPos = prefix.length + templateStr.length;
    return { nextText, newCursorPos };
  }

  // Otherwise, simple insertion at cursor
  const nextText = `${textBefore}${templateStr}${textAfter}`;
  const newCursorPos = textBefore.length + templateStr.length;
  return { nextText, newCursorPos };
}

// ------------------------------------------------------------------------------------------------
// Autocomplete Suggestion Popup Menu Component
// ------------------------------------------------------------------------------------------------

export interface VariableSuggestionMenuProps {
  suggestions: VariableSuggestionItem[];
  selectedIndex: number;
  onSelect: (item: VariableSuggestionItem) => void;
  onClose: () => void;
}

export const VariableSuggestionMenu: React.FC<VariableSuggestionMenuProps> = ({
  suggestions,
  selectedIndex,
  onSelect,
  onClose,
}) => {
  const getCategoryMeta = (category: VariableCategory) => {
    switch (category) {
      case 'form':
        return {
          label: 'Form Field',
          icon: FileText,
          colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        };
      case 'variables':
        return {
          label: 'Variable',
          icon: Variable,
          colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        };
      case 'response':
        return {
          label: 'API Response',
          icon: Globe,
          colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
        };
      case 'state':
        return {
          label: 'State',
          icon: Database,
          colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        };
    }
  };

  return (
    <div
      data-testid="variable-autocomplete-menu"
      className="absolute left-0 top-full mt-1.5 w-80 max-h-64 overflow-y-auto bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-50 p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100 select-none"
    >
      <div className="flex items-center justify-between px-2.5 py-1 border-b border-slate-800 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Insert Variable ({suggestions.length})</span>
        </span>
        <span className="text-[9px] text-slate-500">Tab / Enter to pick</span>
      </div>

      {suggestions.length === 0 ? (
        <div className="p-3 text-xs text-slate-500 text-center italic">
          No matching variables found
        </div>
      ) : (
        suggestions.map((item, idx) => {
          const meta = getCategoryMeta(item.category);
          const Icon = meta.icon;
          const isSelected = idx === selectedIndex;

          return (
            <button
              key={item.key}
              type="button"
              data-testid={`variable-option-${item.key}`}
              onMouseDown={(e) => {
                e.preventDefault(); // Prevent input blur
                onSelect(item);
              }}
              className={`flex items-start gap-2.5 p-2 rounded-lg text-left transition cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-200 hover:bg-slate-800/90'
              }`}
            >
              <div
                className={`p-1 rounded mt-0.5 border ${
                  isSelected ? 'bg-blue-700 text-white border-blue-400' : meta.colorClass
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-semibold truncate">{`{{${item.key}}}`}</span>
                  <span
                    className={`text-[9px] font-medium px-1.5 py-0.2 rounded border ${
                      isSelected
                        ? 'bg-blue-700/60 text-blue-100 border-blue-400'
                        : meta.colorClass
                    }`}
                  >
                    {meta.label}
                  </span>
                </div>
                <p
                  className={`text-[10px] truncate mt-0.5 ${
                    isSelected ? 'text-blue-100' : 'text-slate-400'
                  }`}
                >
                  {item.description}
                  {item.sample && ` (e.g. ${item.sample})`}
                </p>
              </div>
            </button>
          );
        })
      )}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Variable Autocomplete Input Component
// ------------------------------------------------------------------------------------------------

export interface VariableAutocompleteInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  document?: PageDocument;
  containerClassName?: string;
}

export const VariableAutocompleteInput: React.FC<VariableAutocompleteInputProps> = ({
  value,
  onChange,
  document,
  placeholder,
  className = '',
  containerClassName = '',
  ...inputProps
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const suggestions = useMemo(() => {
    return filterVariableSuggestions(searchQuery, document);
  }, [searchQuery, document]);

  // Check if cursor is right after `{{`
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(val);

    const textBefore = val.substring(0, cursorPos);
    const lastOpenIndex = textBefore.lastIndexOf('{{');
    const lastCloseIndex = textBefore.lastIndexOf('}}');

    if (lastOpenIndex !== -1 && lastOpenIndex > lastCloseIndex) {
      const query = textBefore.substring(lastOpenIndex + 2);
      setSearchQuery(query);
      setSelectedIndex(0);
      setIsOpen(true);
    } else if (isOpen && !val.includes('{{')) {
      setIsOpen(false);
    }
  };

  const handleSelectSuggestion = (item: VariableSuggestionItem) => {
    const el = inputRef.current;
    const cursorPos = el?.selectionStart ?? value.length;
    const { nextText, newCursorPos } = insertVariableToken(value, cursorPos, item.key);

    onChange(nextText);
    setIsOpen(false);

    setTimeout(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === '{' && (value.endsWith('{') || e.currentTarget.selectionStart === 0)) {
        // Typing second `{`
        setIsOpen(true);
        setSearchQuery('');
        setSelectedIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(suggestions.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % Math.max(suggestions.length, 1));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (suggestions.length > 0 && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const togglePicker = () => {
    setSearchQuery('');
    setSelectedIndex(0);
    setIsOpen(!isOpen);
    if (!isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className={`relative flex items-center w-full ${containerClassName}`}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          // Delay closing so mouseDown on options registers
          setTimeout(() => setIsOpen(false), 200);
        }}
        placeholder={placeholder}
        style={{ color: '#f1f5f9', ...inputProps.style }}
        className={`w-full pr-8 text-xs font-mono bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700/90 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-inner transition ${className}`}
        {...inputProps}
      />

      {/* Quick Variable Chip Launcher Button */}
      <button
        type="button"
        tabIndex={-1}
        data-testid="toggle-variable-picker-btn"
        onClick={togglePicker}
        title="Insert dynamic variable ({{...}})"
        className="absolute right-1.5 p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition cursor-pointer"
      >
        <Code2 className="w-3.5 h-3.5" />
      </button>

      {/* Floating Autocomplete Suggestion Menu */}
      {isOpen && (
        <VariableSuggestionMenu
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSelect={handleSelectSuggestion}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};

// ------------------------------------------------------------------------------------------------
// Variable Autocomplete Textarea Component
// ------------------------------------------------------------------------------------------------

export interface VariableAutocompleteTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  document?: PageDocument;
  containerClassName?: string;
}

export const VariableAutocompleteTextarea: React.FC<VariableAutocompleteTextareaProps> = ({
  value,
  onChange,
  document,
  placeholder,
  rows = 4,
  className = '',
  containerClassName = '',
  ...textareaProps
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const suggestions = useMemo(() => {
    return filterVariableSuggestions(searchQuery, document);
  }, [searchQuery, document]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart || 0;
    onChange(val);

    const textBefore = val.substring(0, cursorPos);
    const lastOpenIndex = textBefore.lastIndexOf('{{');
    const lastCloseIndex = textBefore.lastIndexOf('}}');

    if (lastOpenIndex !== -1 && lastOpenIndex > lastCloseIndex) {
      const query = textBefore.substring(lastOpenIndex + 2);
      setSearchQuery(query);
      setSelectedIndex(0);
      setIsOpen(true);
    } else if (isOpen && !val.includes('{{')) {
      setIsOpen(false);
    }
  };

  const handleSelectSuggestion = (item: VariableSuggestionItem) => {
    const el = textareaRef.current;
    const cursorPos = el?.selectionStart ?? value.length;
    const { nextText, newCursorPos } = insertVariableToken(value, cursorPos, item.key);

    onChange(nextText);
    setIsOpen(false);

    setTimeout(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isOpen) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(suggestions.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % Math.max(suggestions.length, 1));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (suggestions.length > 0 && selectedIndex >= 0 && selectedIndex < suggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const togglePicker = () => {
    setSearchQuery('');
    setSelectedIndex(0);
    setIsOpen(!isOpen);
    if (!isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  return (
    <div className={`relative flex flex-col w-full ${containerClassName}`}>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          rows={rows}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          placeholder={placeholder}
          style={{ color: '#f1f5f9', ...textareaProps.style }}
          className={`w-full text-xs font-mono bg-slate-950 text-slate-100 placeholder:text-slate-500 border border-slate-700/90 rounded-lg p-2.5 pr-8 focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed shadow-inner transition ${className}`}
          {...textareaProps}
        />

        <button
          type="button"
          tabIndex={-1}
          data-testid="toggle-textarea-variable-picker-btn"
          onClick={togglePicker}
          title="Insert dynamic variable ({{...}})"
          className="absolute right-2 top-2 p-1 rounded text-slate-400 hover:text-blue-400 hover:bg-slate-800 transition cursor-pointer"
        >
          <Code2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {isOpen && (
        <VariableSuggestionMenu
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSelect={handleSelectSuggestion}
          onClose={() => setIsOpen(false)}
        />
      )}
    </div>
  );
};
