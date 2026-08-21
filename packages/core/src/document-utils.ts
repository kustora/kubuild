import { PageDocument, Node, PageDocumentSchema } from '@kubuild/schema';

export function validateDocument(document: unknown): {
  success: boolean;
  data?: PageDocument;
  errors?: string[];
} {
  const result = PageDocumentSchema.safeParse(document);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return {
    success: false,
    errors: result.error.issues.map((e) => `${e.path.map(String).join('.')}: ${e.message}`),
  };
}

export function createBlankDocument(title = 'Untitled Page'): PageDocument {
  return {
    schema: 'stora.page',
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
      children: [],
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
