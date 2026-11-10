import { useEditorStore } from '@kubuild/editor';
import { createDefaultComponentRegistry } from '@kubuild/components';

const registry = createDefaultComponentRegistry();

/**
 * Inserts HTML into the open editor the same way a clipboard paste does: into the selected
 * node (or next to it, for leaf nodes), with fresh ids and a single undo step.
 */
export async function insertHtmlIntoEditor(html: string, targetParentId?: string): Promise<boolean> {
  return useEditorStore.getState().pasteHtmlNodes(html, registry, targetParentId);
}
