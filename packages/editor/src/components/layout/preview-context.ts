import type { AssetProvider, RuntimeContext } from '@kubuild/core';

/**
 * Builds the render context the canvas previews with.
 *
 * - Catalog sample values fill variable gaps; host `context.variables` win on conflicts, so
 *   the canvas can preview bindings without the host wiring live data itself.
 * - The editor's `assetProvider` prop is forwarded so uploaded / `asset://` images resolve
 *   on the canvas without the host passing it twice; an explicit `context.assetProvider` wins.
 *
 * Returns `context` unchanged (same reference) when there is nothing to add.
 */
export function buildEditorPreviewContext(
  context: RuntimeContext | undefined,
  sampleVariables: Record<string, unknown>,
  assetProvider: AssetProvider | undefined,
): RuntimeContext | undefined {
  const hasSamples = Object.keys(sampleVariables).length > 0;
  const forwardAssetProvider = !!assetProvider && !context?.assetProvider;
  if (!hasSamples && !forwardAssetProvider) {
    return context;
  }
  return {
    ...context,
    ...(forwardAssetProvider ? { assetProvider } : {}),
    ...(hasSamples ? { variables: { ...sampleVariables, ...(context?.variables ?? {}) } } : {}),
  };
}
