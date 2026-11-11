# @kubuild/plugin-animation

[![npm version](https://img.shields.io/npm/v/@kubuild/plugin-animation.svg)](https://www.npmjs.com/package/@kubuild/plugin-animation)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Preset-driven animation effect plugins for **KUBUILD**, played with [Motion](https://motion.dev).

| Plugin             | What it does                                                                            |
| ------------------ | --------------------------------------------------------------------------------------- |
| `animate-entrance` | Fade / slide / zoom / pop / rotate reveals on scroll-in, springs, child stagger, replay |
| `animate-loop`     | Float, pulse, spin, wiggle, … (paused off-screen)                                       |
| `animate-hover`    | Lift, grow, tilt, push, …                                                               |
| `animate-timeline` | Custom keyframe timelines with per-step easing, repeat / alternate, stagger             |
| `animate-text`     | Word / letter split reveals and typewriter                                              |
| `animate-counter`  | Formatted number count-up                                                               |
| `animate-draw`     | SVG stroke drawing                                                                      |
| `scroll-pin`       | Sticky storytelling sections                                                            |

Every runtime is skipped under `prefers-reduced-motion`.

## Installation

```bash
pnpm add @kubuild/plugin-animation @kubuild/core
```

## Usage

```ts
import { createEffectRegistry } from '@kubuild/core';
import { animationPlugins } from '@kubuild/plugin-animation';

const effects = createEffectRegistry(animationPlugins);

// <KubuildEditor effects={effects} … /> or <KubuildRenderer effects={effects} … />
```

For page bundles that only need to _play_ effects (no editor fields, no zod), import the runtimes from the `/dom` entry and boot them with `@kubuild/runtime-dom`:

```ts
import { bootEffects } from '@kubuild/runtime-dom';
import { animationRuntimes } from '@kubuild/plugin-animation/dom';

bootEffects({ runtimes: animationRuntimes });
```

The pure preset generator (`entranceFrames`, `loopFrames`, `hoverFrames`, `sampleFrames`) is exported from the main entry too.

## License

Apache-2.0
