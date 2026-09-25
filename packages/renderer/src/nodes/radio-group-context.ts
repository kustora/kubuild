import { createContext } from 'react';

/**
 * Provided by a `radio-group` node to its `radio` / `radio-item` children. The group owns
 * the form field binding (name, required, default selection); children only read and write
 * the shared value, so renaming the group renames every option's field.
 */
export interface RadioGroupContextValue {
  name: string;
  required?: boolean;
  disabled?: boolean;
}

export const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);
