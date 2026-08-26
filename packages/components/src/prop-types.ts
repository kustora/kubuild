import { ComponentFieldDefinition } from './registry';

export type PropPrimitiveType = 'string' | 'number' | 'boolean';

/**
 * Maps inspector field types to the primitive type a binding must resolve to.
 * 'select' | 'image' | 'action' | 'json' are excluded — they carry structured
 * or choice-constrained values that a plain variable binding can't safely satisfy.
 */
export function primitiveTypeForField(field: ComponentFieldDefinition): PropPrimitiveType | undefined {
  switch (field.type) {
    case 'string':
    case 'textarea':
    case 'color':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    default:
      return undefined;
  }
}

export function isBindableField(field: ComponentFieldDefinition): boolean {
  return primitiveTypeForField(field) !== undefined;
}
