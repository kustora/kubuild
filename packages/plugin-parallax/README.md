# @kubuild/plugin-parallax

[![npm version](https://img.shields.io/npm/v/@kubuild/plugin-parallax.svg)](https://www.npmjs.com/package/@kubuild/plugin-parallax)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Parallax and scroll-linked effect plugins for **KUBUILD**: `parallax-scroll`, `parallax-background`, `scroll-transform` and `pointer-parallax`.

Runtimes compose on one element, follow scrolling containers (or an element marked `data-kb-scroll-viewport`), correct for a zoomed ancestor and are skipped under `prefers-reduced-motion`.

## Installation

```bash
pnpm add @kubuild/plugin-parallax @kubuild/core
```

## Usage

```ts
import { createEffectRegistry } from '@kubuild/core';
import { parallaxPlugins } from '@kubuild/plugin-parallax';

const effects = createEffectRegistry(parallaxPlugins);

// <KubuildEditor effects={effects} … /> or <KubuildRenderer effects={effects} … />
```

Runtimes only (no zod), for page bundles:

```ts
import { bootEffects } from '@kubuild/runtime-dom';
import { parallaxRuntimes } from '@kubuild/plugin-parallax/dom';

bootEffects({ runtimes: parallaxRuntimes });
```

## License

Apache-2.0
