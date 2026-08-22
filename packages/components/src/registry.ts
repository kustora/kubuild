import { Node, ResponsiveStyles } from '@kubuild/schema';

export type ComponentCategory = 'layout' | 'typography' | 'media' | 'interactive' | 'data' | 'custom';

export interface ComponentFieldDefinition {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'color' | 'image' | 'action' | 'json';
  defaultValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  description?: string;
}

export interface ComponentDefinition<TRenderer = unknown> {
  type: string;
  label: string;
  category: ComponentCategory;
  description?: string;
  icon?: string;
  acceptsChildren?: boolean;
  allowedChildren?: string[];
  disallowedParents?: string[];
  defaultProps?: Record<string, unknown>;
  /** Default responsive style override (base/desktop/tablet/mobile), matching a Node's `styles` field. */
  defaultStyles?: ResponsiveStyles;
  /**
   * Inspector metadata: describes each editable prop (label, input type, options)
   * so a host editor can render property controls without hardcoding per-type UI.
   */
  propFields?: ComponentFieldDefinition[];
  /**
   * Prop schema slot: validates a node's props for this component type.
   * Returns `true`/`[]` (valid), `false` (generic failure), or an array of
   * human-readable error messages.
   */
  validateProps?: (props: Record<string, unknown>) => boolean | string[];
  /**
   * Type-to-renderer mapping slot. Deliberately untyped here (`unknown` by
   * default) so `@kubuild/components` stays framework-agnostic — no React
   * import. A consumer package (e.g. `@kubuild/renderer`) specializes
   * `ComponentDefinition<TRenderer>`/`ComponentRegistry<TRenderer>` with a
   * concrete renderer type (e.g. `React.ComponentType<...>`) and populates
   * or reads this field with that type.
   */
  renderer?: TRenderer;
  /**
   * Host-provided runtime capabilities this component type needs to fully
   * resolve at render time (e.g. `'assetProvider'`, `'actionRegistry'` — see
   * `@kubuild/core`'s `RuntimeContext`). Names correspond to entries a host
   * would list in a `.stora` manifest's `requiredCapabilities` (see
   * `@kubuild/schema`'s `ManifestSchema`) so an importer can check it has
   * everything a document needs before accepting it.
   */
  capabilities?: string[];
}

export class ComponentRegistry<TRenderer = unknown> {
  private components = new Map<string, ComponentDefinition<TRenderer>>();

  register(definition: ComponentDefinition<TRenderer>, allowOverride = false): void {
    if (!allowOverride && this.components.has(definition.type)) {
      throw new Error(`Component type "${definition.type}" is already registered.`);
    }
    this.components.set(definition.type, definition);
  }

  unregister(type: string): boolean {
    return this.components.delete(type);
  }

  get(type: string): ComponentDefinition<TRenderer> | undefined {
    return this.components.get(type);
  }

  has(type: string): boolean {
    return this.components.has(type);
  }

  list(): ComponentDefinition<TRenderer>[] {
    return Array.from(this.components.values());
  }

  listByCategory(category: ComponentCategory): ComponentDefinition<TRenderer>[] {
    return this.list().filter((c) => c.category === category);
  }

  validateNode(node: Node, parentType?: string): { valid: boolean; errors: string[] } {
    const def = this.get(node.type);
    const errors: string[] = [];

    if (!def) {
      errors.push(`Unknown component type: "${node.type}"`);
      return { valid: false, errors };
    }

    if (!def.acceptsChildren && node.children && node.children.length > 0) {
      errors.push(`Component "${node.type}" does not accept children.`);
    }

    if (def.allowedChildren && node.children) {
      for (const child of node.children) {
        const childCategory = this.get(child.type)?.category;
        const allowed =
          def.allowedChildren.includes('*') ||
          def.allowedChildren.includes(child.type) ||
          (childCategory !== undefined && def.allowedChildren.includes(childCategory));
        if (!allowed) {
          errors.push(`Component "${node.type}" does not allow child type "${child.type}".`);
        }
      }
    }

    if (parentType && def.disallowedParents?.includes(parentType)) {
      errors.push(`Component "${node.type}" is not allowed inside parent "${parentType}".`);
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
