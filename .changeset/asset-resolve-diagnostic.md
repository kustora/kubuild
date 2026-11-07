---
"@kubuild/core": patch
"@kubuild/renderer": patch
"@kubuild/editor": patch
---

Asset resolution diagnostics, a canvas layout fix, and inspector translations.

- **core**: new `AssetDiagnostic` (`code: 'ASSET_RESOLVE_ASYNC'`) in the `Diagnostic` union.
- **renderer**: media nodes resolve `src` synchronously during render, so an `AssetProvider.resolve()` that returns a Promise was ignored without any signal. The renderer still falls back to the asset reference's `fallbackUrl` (or the raw `src`), but now reports `ASSET_RESOLVE_ASYNC` through `onDiagnostic`, once per provider and value, and swallows a later rejection of that Promise. `resolveAssetSync()` takes an optional third `onAsyncResolve` callback.
- **editor**: the canvas viewport used `minHeight: '100%'`, which kept it from shrinking inside the canvas column and pushed the breadcrumb bar below the editor's bottom edge. It now uses `minHeight: 0`.
- **editor**: the inspector's "Event Pixel" section was hardcoded in mixed Indonesian and English. Its labels now come from the i18n dictionaries under the new `pixelEvent` group (`en` and `id`), so they follow `locale` and can be overridden with `translations`. The agent-apply fallback error is now English (`Failed to apply: …`).
