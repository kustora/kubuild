---
'@kubuild/ai': patch
'@kubuild/components': patch
'@kubuild/core': patch
'@kubuild/editor': patch
'@kubuild/react': patch
'@kubuild/renderer': patch
'@kubuild/schema': patch
---

Fix published type declarations for consumers using `moduleResolution: node16`/`nodenext`. Declarations previously re-exported relative modules without file extensions (e.g. `export * from './document'`), which NodeNext cannot resolve in `"type": "module"` packages, so the main entry exposed no types. Relative imports now carry `.js` extensions, and each package also ships CommonJS `.d.cts` declarations wired to the `require` export condition.
