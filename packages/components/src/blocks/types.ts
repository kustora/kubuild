import { Node } from '@kubuild/schema';

export interface BlockDefinition {
  id: string;
  name: string;
  category: 'layout' | 'sections' | 'ui' | 'pricing' | 'cta' | 'forms' | string;
  categoryLabel?: string;
  description?: string;
  icon?: string;
  thumbnailSvg?: string;
  createNodeTree: (generateId?: (prefix?: string) => string) => Node;
}

let nextId = 1;
export function defaultGenId(prefix = 'node'): string {
  return `${prefix}-${Date.now().toString(36)}-${(nextId++).toString(36)}`;
}

