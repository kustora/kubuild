import { PageDocument, Node, SCHEMA_NAME } from '@kubuild/schema';
import type { ComponentRegistryLike } from './validator';

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

export interface CollectedAssetReference {
  assetId: string;
  reference: {
    type: 'asset';
    assetId: string;
    filename?: string;
    mimeType?: string;
    fallbackUrl?: string;
  };
  nodeId: string;
  propPath: string;
}

/**
 * Collect all AssetReference objects throughout a document tree.
 */
export function collectAssetReferences(rootNode: Node): CollectedAssetReference[] {
  const results: CollectedAssetReference[] = [];

  function traverseProps(propsObj: unknown, currentPath: string, nodeId: string): void {
    if (!propsObj || typeof propsObj !== 'object') return;

    if (Array.isArray(propsObj)) {
      propsObj.forEach((item, index) => {
        traverseProps(item, `${currentPath}/${index}`, nodeId);
      });
      return;
    }

    const record = propsObj as Record<string, unknown>;

    if (record.type === 'asset' && typeof record.assetId === 'string' && record.assetId.trim().length > 0) {
      results.push({
        assetId: record.assetId,
        reference: {
          type: 'asset',
          assetId: record.assetId,
          filename: typeof record.filename === 'string' ? record.filename : undefined,
          mimeType: typeof record.mimeType === 'string' ? record.mimeType : undefined,
          fallbackUrl: typeof record.fallbackUrl === 'string' ? record.fallbackUrl : undefined,
        },
        nodeId,
        propPath: currentPath,
      });
    }

    for (const [key, val] of Object.entries(record)) {
      if (val && typeof val === 'object') {
        traverseProps(val, `${currentPath}/${key}`, nodeId);
      }
    }
  }

  function traverseNode(node: Node): void {
    if (node.props) {
      traverseProps(node.props, `/document/${node.id}/props`, node.id);
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverseNode(child);
      }
    }
  }

  traverseNode(rootNode);
  return results;
}

export interface TreeRequirements {
  requiredComponents: string[];
  requiredCapabilities: string[];
}

/**
 * Extracts custom component types and capabilities required by a node tree.
 */
export function extractRequirementsFromTree(
  rootNode: Node,
  registry?: ComponentRegistryLike,
): TreeRequirements {
  const requiredComponents = new Set<string>();
  const requiredCapabilities = new Set<string>();

  function traverse(node: Node): void {
    if (registry) {
      const def = registry.get(node.type);
      if (def?.category === 'custom') {
        requiredComponents.add(node.type);
      }
      if (def?.capabilities && Array.isArray(def.capabilities)) {
        for (const cap of def.capabilities) {
          requiredCapabilities.add(cap);
        }
      }
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverse(child);
      }
    }
  }

  traverse(rootNode);

  return {
    requiredComponents: Array.from(requiredComponents).sort(),
    requiredCapabilities: Array.from(requiredCapabilities).sort(),
  };
}

