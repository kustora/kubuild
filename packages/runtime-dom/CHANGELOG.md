# @kubuild/runtime-dom

## 0.1.0

### Minor Changes

- Animation generator effect plugins, played with Motion (STORA-660).

  - **plugin-animation** (new): `animate-entrance` (fade/slide/zoom/pop/rotate reveals on scroll-in, springs, child stagger, replay), `animate-loop` (float, pulse, spin, wiggle, … paused off-screen) and `animate-hover` (lift, grow, tilt, push, …), exported as `animationPlugins`; `/dom` carries the runtimes only. The pure preset generator (`entranceFrames`, `loopFrames`, `hoverFrames`, `sampleFrames`) is exported too. Skipped under `prefers-reduced-motion`.
  - **plugin-animation** complex animations (STORA-662): `animate-timeline` (custom keyframe timelines with per-step easing, repeat/loop/alternate, child stagger), `animate-text` (word/letter split reveals and typewriter, accessible and restored exactly), `animate-counter` (formatted number count-up), `animate-draw` (SVG stroke drawing, incl. HTML-embed shadow roots) and `scroll-pin` (sticky storytelling sections). They share one trigger driver (`drive`): in view, load, hover or scrubbed by scroll — optionally following the progress of the pinned section around them.
  - **core**: new `keyframes` effect field type (`EffectKeyframe`, `EffectKeyframeChannel`).
  - **editor**: the Effects panel renders `keyframes` fields as a per-step timeline editor.
  - **effect-kit** (new): the per-element motion compositor (`createMotionChannel`), scroll and pin helpers (`onScrollFrame`, `scrollProgress`, `PIN_ATTRIBUTE`, `pinProgress`, `sourceProgress`), `zodParser` / `toConfigJsonSchema` and media helpers, shared so effects from different plugins compose on one element.
  - **plugin-parallax**: uses `@kubuild/effect-kit` (compositor and scroll helpers) instead of private copies; behavior unchanged.
  - **runtime-dom**: `kubuild-runtime.js` also boots the animation runtimes (now ~40 KB, ~15 KB gzipped, about half of it Motion's value engine).

- Plugin-driven node effects (STORA-651): parallax, scroll-linked transforms and pointer motion — editable, previewable, AI-addressable and exportable as static HTML.

  - **plugin-parallax** (new): `parallax-scroll`, `parallax-background`, `scroll-transform` and `pointer-parallax`, exported together as `parallaxPlugins`. The `/dom` entry carries the runtimes only (no zod) for page bundles. Runtimes compose on one element, follow scrolling containers (or an element marked `data-kb-scroll-viewport`), correct for a zoomed ancestor and are skipped under `prefers-reduced-motion`.
  - **runtime-dom** (new): `bootEffects` / `mountNodeEffects` and `kubuild-runtime.js`, a ~6 KB framework-free script that mounts effects on static exports. `@kubuild/runtime-dom/source` exposes it as a string for exporters.
  - **core**: `exportPackage` downloads the URL an `assetProvider` resolves to instead of packaging the URL text as the asset file; a failed download counts as not collected (so `allowExternalFallback` applies). URL strings given as asset data are downloaded too, percent-encoded `data:` URLs are decoded, and the new `fetchAsset` option overrides the download.
  - **core**: `EffectRuntime` / `AnyEffectRuntime` types; `buildEffectManifest` and, on the dependency-free `@kubuild/core/effect-manifest` subpath, `parseEffectManifest` plus the `EFFECT_MANIFEST_ELEMENT_ID`, `EFFECT_NODE_ATTRIBUTE` and `EFFECT_SCROLL_VIEWPORT_ATTRIBUTE` constants.
  - **renderer**: `generateStandaloneHtml` writes an asset reference's `fallbackUrl` instead of `[object Object]`, and escapes the node class on YouTube/Vimeo wrappers.
  - **renderer**: `KubuildRenderer` / `PreviewViewportAdapter` take `effects` (and `runEffects`, default `mode === 'runtime'`). `generateStandaloneHtml` takes `effects: { registry, runtime: { src } | { inline } }` and emits the manifest plus the runtime script only when something can run. **Security:** node ids are now escaped in exported class attributes and CSS selectors, `<` in exported CSS is hex-escaped so style values can't close the `<style>` element, and `html-embed` content is sanitized in exports unless `sanitize: false` (matching the live renderer).
  - **editor**: the static-site export copies local assets (`blob:` uploads, `asset:` URIs, `{ type: 'asset' }` references, also inside style `url(…)`) into `assets/` and rewrites them to relative paths (STORA-657); `buildStaticSiteArchive` / `downloadDocumentAsStaticSite` are async and report `assetFailures`. `localizeDocumentAssets` is exported for custom pipelines.
  - **editor**: `KubuildEditor` takes `effects`; the inspector gets an Effects section (Simple and Advance) generated from plugin `fields`; effects play in Preview, where the canvas now also scrolls with the wheel; the toolbar gets an **HTML** static-site export (`buildStaticSiteArchive`, `downloadDocumentAsStaticSite`); store action `updateNodeEffects`. Agent `replace-node` ops keep the node's effects.
  - **ai**: `effects` engine/agent option adds an effect catalog to the agent prompt and a `set_node_effects` tool producing the new `set-effects` agent op.

### Patch Changes

- Updated dependencies [[`f7d2ced`](https://github.com/kustora/kubuild/commit/f7d2ced32a97c833edf9d654e2fe357ac599392a), [`ede6941`](https://github.com/kustora/kubuild/commit/ede69414258a0539db8a3c1c40f4d977180a3d8f), `ba4a207`]:
  - @kubuild/core@0.13.0
