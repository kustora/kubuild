# @kubuild/runtime-dom

[![npm version](https://img.shields.io/npm/v/@kubuild/runtime-dom.svg)](https://www.npmjs.com/package/@kubuild/runtime-dom)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Framework-free runtime that mounts **KUBUILD** node effects on static HTML exports.

- `bootEffects({ runtimes })` — reads the effect manifest (`<script id="kb-effects">`) and mounts every effect; returns a cleanup function.
- `mountNodeEffects` / `createRuntimeMap` — lower-level mounting.
- `@kubuild/runtime-dom/kubuild-runtime.js` — a prebuilt script that boots the parallax and animation runtimes.
- `@kubuild/runtime-dom/source` — the same script as a string, for exporters that inline it.

```bash
pnpm add @kubuild/runtime-dom
```

```ts
import { bootEffects } from '@kubuild/runtime-dom';
import { parallaxRuntimes } from '@kubuild/plugin-parallax/dom';
import { animationRuntimes } from '@kubuild/plugin-animation/dom';

bootEffects({ runtimes: [...parallaxRuntimes, ...animationRuntimes] });
```

## License

Apache-2.0
