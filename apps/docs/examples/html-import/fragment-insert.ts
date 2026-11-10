import { htmlToNodes } from '@kubuild/html-import';
import { cloneTreeWithNewIds, collectNodeIdSet, insertNode } from '@kubuild/core';
import type { PageDocument } from '@kubuild/schema';

/** Appends an HTML snippet to `parentId` without going through the editor. */
export async function appendHtmlSnippet(
  doc: PageDocument,
  parentId: string,
  html: string,
): Promise<PageDocument> {
  const result = await htmlToNodes(html);
  if (!result.success) {
    throw new Error(result.error ?? 'Could not convert the snippet');
  }

  // htmlToNodes ids are deterministic (node-1, node-1-1, ...), so give every
  // inserted subtree fresh ids that do not collide with the document's.
  const existingIds = collectNodeIdSet(doc.document);
  let next = doc;
  for (const node of result.nodes) {
    const { clonedNode } = cloneTreeWithNewIds(node, undefined, existingIds);
    collectNodeIdSet(clonedNode).forEach((id) => existingIds.add(id));
    next = insertNode(next, { parentId, node: clonedNode }).document;
  }
  return next;
}
