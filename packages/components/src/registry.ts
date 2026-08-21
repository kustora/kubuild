import { Node } from '@kubuild/schema';

export type ComponentCategory = 'layout' | 'typography' | 'media' | 'interactive' | 'data' | 'custom';

export interface ComponentFieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'image' | 'action' | 'json';
  defaultValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  description?: string;
}

export interface ComponentDefinition {
  type: string;
  label: string;
  category: ComponentCategory;
  description?: string;
  icon?: string;
  acceptsChildren?: boolean;
  allowedChildren?: string[];
  disallowedParents?: string[];
  defaultProps?: Record<string, unknown>;
  defaultStyles?: Record<string, unknown>;
  propFields?: ComponentFieldDefinition[];
  validateProps?: (props: Record<string, unknown>) => boolean | string[];
}

export class ComponentRegistry {
  private components = new Map<string, ComponentDefinition>();

  register(definition: ComponentDefinition, allowOverride = false): void {
    if (!allowOverride && this.components.has(definition.type)) {
      throw new Error(`Component type "${definition.type}" is already registered.`);
    }
    this.components.set(definition.type, definition);
  }

  unregister(type: string): boolean {
    return this.components.delete(type);
  }

  get(type: string): ComponentDefinition | undefined {
    return this.components.get(type);
  }

  has(type: string): boolean {
    return this.components.has(type);
  }

  list(): ComponentDefinition[] {
    return Array.from(this.components.values());
  }

  listByCategory(category: ComponentCategory): ComponentDefinition[] {
    return this.list().filter((c) => c.category === category);
  }

  validateNode(node: Node): { valid: boolean; errors: string[] } {
    const def = this.get(node.type);
    const errors: string[] = [];

    if (!def) {
      errors.push(`Unknown component type: "${node.type}"`);
      return { valid: false, errors };
    }

    if (!def.acceptsChildren && node.children && node.children.length > 0) {
      errors.push(`Component "${node.type}" does not accept children.`);
    }

    if (def.validateProps && node.props) {
      const propResult = def.validateProps(node.props);
      if (Array.isArray(propResult) && propResult.length > 0) {
        errors.push(...propResult);
      } else if (propResult === false) {
        errors.push(`Props validation failed for component "${node.type}".`);
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
