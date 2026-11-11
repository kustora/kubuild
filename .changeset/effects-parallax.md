---
"@kubuild/core": minor
"@kubuild/renderer": minor
"@kubuild/editor": minor
"@kubuild/ai": minor
"@kubuild/plugin-parallax": minor
"@kubuild/runtime-dom": minor
---

Plugin-driven node effects (STORA-651): parallax, scroll-linked transforms and pointer motion — editable, previewable, AI-addressable and exportable as static HTML.

- **plugin-parallax** (new): `parallax-scroll`, `parallax-background`, `scroll-transform` and `pointer-parallax`, exported together as `parallaxPlugins`. The `/dom` entry carries the runtimes only (no zod) for page bundles. Runtimes compose on one element, follow scrolling containers (or an element marked `data-kb-scroll-viewport`), correct for a zoomed ancestor and are skipped under `prefers-reduced-motion`.
- **runtime-dom** (new): `bootEffects` / `mountNodeEffects` and `kubuild-runtime.js`, a ~6 KB framework-free script that mounts effects on static exports. `@kubuild/runtime-dom/source` exposes it as a string for exporters.
- **core**: `exportPackage` downloads the URL an `assetProvider` resolves to instead of packaging the URL text as the asset file; a failed download counts as not collected (so `allowExternalFallback` applies). URL strings given as asset data are downloaded too, percent-encoded `data:` URLs are decoded, and the new `fetchAsset` option overrides the download.
- **core**: `EffectRuntime` / `AnyEffectRuntime` types; `buildEffectManifest` and, on the dependency-free `@kubuild/core/effect-manifest` subpath, `parseEffectManifest` plus the `EFFECT_MANIFEST_ELEMENT_ID`, `EFFECT_NODE_ATTRIBUTE` and `EFFECT_SCROLL_VIEWPORT_ATTRIBUTE` constants.
- **renderer**: `generateStandaloneHtml` writes an asset reference's `fallbackUrl` instead of `[object Object]`, and escapes the node class on YouTube/Vimeo wrappers.
- **renderer**: `KubuildRenderer` / `PreviewViewportAdapter` take `effects` (and `runEffects`, default `mode === 'runtime'`). `generateStandaloneHtml` takes `effects: { registry, runtime: { src } | { inline } }` and emits the manifest plus the runtime script only when something can run. **Security:** node ids are now escaped in exported class attributes and CSS selectors, `<` in exported CSS is hex-escaped so style values can't close the `<style>` element, and `html-embed` content is sanitized in exports unless `sanitize: false` (matching the live renderer).
- **editor**: the static-site export copies local assets (`blob:` uploads, `asset:` URIs, `{ type: 'asset' }` references, also inside style `url(…)`) into `assets/` and rewrites them to relative paths (STORA-657); `buildStaticSiteArchive` / `downloadDocumentAsStaticSite` are async and report `assetFailures`. `localizeDocumentAssets` is exported for custom pipelines.
- **editor**: `KubuildEditor` takes `effects`; the inspector gets an Effects section (Simple and Advance) generated from plugin `fields`; effects play in Preview, where the canvas now also scrolls with the wheel; the toolbar gets an **HTML** static-site export (`buildStaticSiteArchive`, `downloadDocumentAsStaticSite`); store action `updateNodeEffects`. Agent `replace-node` ops keep the node's effects.
- **ai**: `effects` engine/agent option adds an effect catalog to the agent prompt and a `set_node_effects` tool producing the new `set-effects` agent op.
