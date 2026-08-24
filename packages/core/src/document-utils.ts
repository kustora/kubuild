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

/**
 * Remap asset references in a node tree based on an ID mapping dictionary.
 * Mutates the node props in place and returns the number of references updated.
 */
export function remapAssetReferences(
  rootNode: Node,
  idMap: Record<string, string> | Map<string, string>,
): number {
  let remappedCount = 0;
  const getMappedId = (id: string): string | undefined => {
    if (idMap instanceof Map) return idMap.get(id);
    return idMap[id];
  };

  function traverseProps(propsObj: unknown): void {
    if (!propsObj || typeof propsObj !== 'object') return;

    if (Array.isArray(propsObj)) {
      for (const item of propsObj) {
        traverseProps(item);
      }
      return;
    }

    const record = propsObj as Record<string, unknown>;

    if (record.type === 'asset' && typeof record.assetId === 'string') {
      const newId = getMappedId(record.assetId);
      if (newId !== undefined && newId !== record.assetId) {
        record.assetId = newId;
        remappedCount++;
      }
    }

    for (const val of Object.values(record)) {
      if (val && typeof val === 'object') {
        traverseProps(val);
      }
    }
  }

  function traverseNode(node: Node): void {
    if (node.props) {
      traverseProps(node.props);
    }
    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        traverseNode(child);
      }
    }
  }

  traverseNode(rootNode);
  return remappedCount;
}

/**
 * Remaps all asset references throughout a PageDocument.
 */
export function remapDocumentAssetReferences(
  doc: PageDocument,
  idMap: Record<string, string> | Map<string, string>,
): PageDocument {
  if (doc && doc.document) {
    remapAssetReferences(doc.document, idMap);
  }
  return doc;
}

export interface MissingComponentNodeInfo {
  nodeId: string;
  componentType: string;
  props: Record<string, unknown>;
  node: Node;
}

/**
 * Finds all nodes in a node tree that reference component types not registered in the host.
 * This is useful in placeholder mode to inspect missing nodes and their preserved props.
 */
export function findMissingComponentNodes(
  rootNode: Node,
  registry?: ComponentRegistryLike,
  knownTypes?: string[] | Set<string>,
): MissingComponentNodeInfo[] {
  const missing: MissingComponentNodeInfo[] = [];
  const knownSet = new Set<string>();

  if (knownTypes) {
    for (const t of knownTypes) knownSet.add(t);
  }

  const standardBuiltIns = [
    'page',
    'section',
    'container',
    'columns',
    'heading',
    'text',
    'image',
    'button',
    'collection',
  ];
  for (const b of standardBuiltIns) knownSet.add(b);

  function checkNode(node: Node): void {
    let isSupported = knownSet.has(node.type);
    if (!isSupported && registry) {
      isSupported = registry.has(node.type);
    }

    if (!isSupported) {
      missing.push({
        nodeId: node.id,
        componentType: node.type,
        props: node.props ? { ...node.props } : {},
        node,
      });
    }

    if (node.children && Array.isArray(node.children)) {
      for (const child of node.children) {
        checkNode(child);
      }
    }
  }

  checkNode(rootNode);
  return missing;
}


