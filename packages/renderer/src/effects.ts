import React from 'react';
import type { PageDocument } from '@kubuild/schema';
import { buildEffectManifest, type AnyEffectRuntime, type EffectRegistry } from '@kubuild/core';
import { createRuntimeMap, mountNodeEffects } from '@kubuild/runtime-dom';

const NODE_ATTRIBUTE = 'data-kubuild-node';

/**
 * Mounts the document's effects (STORA-650) on the rendered elements under `rootRef`, the
 * same way `kubuild-runtime.js` does on an exported page: resolved against `registry`,
 * matched by `data-kubuild-node`, every rendered copy of a node (collections, artboard
 * instances) gets its own mount.
 *
 * Everything is remounted when the document changes, so effects always sit on the current
 * elements. That also means a node's own `translate`/`scale`/`rotate`/`opacity` edited
 * while effects run can be reset by the remount — which is why the editor only runs
 * effects in preview, where the document doesn't change.
 */
export function useDocumentEffects(
  rootRef: React.RefObject<HTMLElement | null>,
  document: PageDocument,
  registry: EffectRegistry | undefined,
  enabled: boolean,
  mode: 'editor' | 'runtime',
): void {
  const manifest = React.useMemo(
    () => (registry && enabled ? buildEffectManifest(document.document, registry).manifest : null),
    [document, registry, enabled],
  );

  React.useEffect(() => {
    const root = rootRef.current;
    if (!root || !registry || !manifest || Object.keys(manifest.nodes).length === 0) return;

    const runtimes = createRuntimeMap(
      registry
        .list()
        .flatMap((plugin): AnyEffectRuntime[] =>
          plugin.mount ? [{ id: plugin.id, reducedMotion: plugin.reducedMotion, mount: plugin.mount }] : [],
        ),
    );
    const cleanups: Array<() => void> = [];
    for (const element of Array.from(root.querySelectorAll<HTMLElement>(`[${NODE_ATTRIBUTE}]`))) {
      const nodeId = element.getAttribute(NODE_ATTRIBUTE);
      if (nodeId === null || !Object.prototype.hasOwnProperty.call(manifest.nodes, nodeId)) continue;
      cleanups.push(
        mountNodeEffects(element, manifest.nodes[nodeId], runtimes, {
          nodeId,
          mode,
          onError: (error, plugin) => console.error(`[kubuild] effect "${plugin}" failed on "${nodeId}"`, error),
        }),
      );
    }
    return () => {
      for (const cleanup of cleanups.reverse()) cleanup();
    };
  }, [rootRef, manifest, registry, mode]);
}
