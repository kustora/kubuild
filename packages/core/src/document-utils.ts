import { PageDocument, Node, SCHEMA_NAME } from '@kubuild/schema';

export { validateDocument } from './validator';
export type {
  DocumentValidationResult,
  DocumentValidationError,
  DocumentValidationErrorCode,
  ValidationOptions,
  ComponentDefinitionLike,
  ComponentRegistryLike,
} from './validator';

export function createBlankDocument(title = 'Untitled Page'): PageDocument {
  return {
    schema: SCHEMA_NAME,
    version: '1.0.0',
    metadata: {
      title,
      description: '',
      author: '',
      tags: [],
      category: 'general',
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    document: {
      id: 'root-page',
      type: 'page',
      props: { title },
      styles: { base: { minHeight: '100vh', backgroundColor: '#ffffff' } },
      children: [] as Node[],
    },
  };
}

export function findNodeById(rootNode: Node, targetId: string): Node | null {
  if (rootNode.id === targetId) return rootNode;
  if (!rootNode.children) return null;
  for (const child of rootNode.children) {
    const found = findNodeById(child, targetId);
    if (found) return found;
  }
  return null;
}
