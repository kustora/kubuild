import type { AnyEffectRuntime, EffectCleanup, EffectManifestEntry } from '@kubuild/core';

export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface MountNodeEffectsOptions {
  nodeId: string;
  mode?: 'editor' | 'runtime';
  /** Called when a runtime throws while mounting or cleaning up; the other effects still run. */
  onError?: (error: unknown, plugin: string) => void;
}

function prefersReducedMotion(element: HTMLElement): boolean {
  const view = element.ownerDocument?.defaultView;
  return typeof view?.matchMedia === 'function' ? view.matchMedia(REDUCED_MOTION_QUERY).matches : false;
}

/**
 * Mounts one node's effects on its element and returns a cleanup that unmounts them in
 * reverse order. Effects whose runtime isn't in `runtimes` are skipped — a page can carry
 * effects from plugins this bundle doesn't ship, and it must still render.
 */
export function mountNodeEffects(
  element: HTMLElement,
  effects: readonly EffectManifestEntry[],
  runtimes: ReadonlyMap<string, AnyEffectRuntime>,
  options: MountNodeEffectsOptions,
): EffectCleanup {
  const reducedMotion = prefersReducedMotion(element);
  const context = { nodeId: options.nodeId, mode: options.mode ?? 'runtime', reducedMotion } as const;
  const cleanups: Array<{ plugin: string; cleanup: EffectCleanup }> = [];

  for (const effect of effects) {
    const runtime = runtimes.get(effect.plugin);
    if (!runtime) continue;
    if (reducedMotion && (runtime.reducedMotion ?? 'skip') === 'skip') continue;
    try {
      const cleanup = runtime.mount(element, effect.config, context);
      if (typeof cleanup === 'function') cleanups.push({ plugin: effect.plugin, cleanup });
    } catch (error) {
      options.onError?.(error, effect.plugin);
    }
  }

  return () => {
    for (const { plugin, cleanup } of cleanups.reverse()) {
      try {
        cleanup();
      } catch (error) {
        options.onError?.(error, plugin);
      }
    }
  };
}

export function createRuntimeMap(runtimes: Iterable<AnyEffectRuntime>): Map<string, AnyEffectRuntime> {
  const map = new Map<string, AnyEffectRuntime>();
  for (const runtime of runtimes) map.set(runtime.id, runtime);
  return map;
}
