import { Node, isVariableBinding } from '@kubuild/schema';
import { ComponentDefinition, ComponentFieldDefinition, primitiveTypeForField } from '@kubuild/components';
import { resolveBinding, Diagnostic, RenderContext } from '@kubuild/core';
import { resolveVariable } from './render-context';

export interface ResolvedNodeProps {
  props: Record<string, unknown>;
  diagnostics: Diagnostic[];
}

function emptyValueFor(primitiveType: 'string' | 'number' | 'boolean'): unknown {
  switch (primitiveType) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
  }
}

function resolveBindableField(
  node: Node,
  field: ComponentFieldDefinition,
  definition: ComponentDefinition,
  context: RenderContext | undefined,
  diagnostics: Diagnostic[],
): unknown {
  const rawValue = node.props?.[field.name];
  const expectedType = primitiveTypeForField(field);
  if (expectedType === undefined || rawValue === undefined) {
    return rawValue;
  }

  const fallbackValue = definition.defaultProps?.[field.name] ?? field.defaultValue ?? emptyValueFor(expectedType);

  if (isVariableBinding(rawValue)) {
    const outcome = resolveBinding(rawValue, context);
    if (typeof outcome.value === expectedType) {
      return outcome.value;
    }
    diagnostics.push({
      code: 'INCOMPATIBLE_BINDING_TYPE',
      nodeId: node.id,
      propName: field.name,
      expectedType,
      actualType: typeof outcome.value,
      message: `Prop "${field.name}" on node "${node.id}" expected a ${expectedType} but resolved binding "${rawValue.key}" produced a ${typeof outcome.value}.`,
    });
    return fallbackValue;
  }

  if (expectedType === 'string' && typeof rawValue === 'string' && rawValue.includes('{{')) {
    return resolveVariable(context, rawValue);
  }

  return rawValue;
}

/**
 * Resolves every binding-compatible prop on a node up front, before the component
 * receives its render props — centralizes what was previously ad hoc per-field
 * `resolveVariable` calls scattered across the renderer switch. Non-bindable
 * fields (select/image/action/json) and fields absent from `propFields` pass
 * through unchanged; validating their static shape remains `validateProps`' job.
 */
export function resolvePropsForNode(
  node: Node,
  definition: ComponentDefinition | undefined,
  context: RenderContext | undefined,
): ResolvedNodeProps {
  const rawProps = node.props || {};
  if (!definition || !definition.propFields || definition.propFields.length === 0) {
    return { props: rawProps, diagnostics: [] };
  }

  const diagnostics: Diagnostic[] = [];
  const resolved: Record<string, unknown> = { ...rawProps };

  for (const field of definition.propFields) {
    if (primitiveTypeForField(field) === undefined) {
      continue;
    }
    resolved[field.name] = resolveBindableField(node, field, definition, context, diagnostics);
  }

  return { props: resolved, diagnostics };
}
