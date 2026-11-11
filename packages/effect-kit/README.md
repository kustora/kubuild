# @kubuild/effect-kit

[![npm version](https://img.shields.io/npm/v/@kubuild/effect-kit.svg)](https://www.npmjs.com/package/@kubuild/effect-kit)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

Shared building blocks for **KUBUILD** effect plugins, so effects from different plugins compose on one element:

- **Motion compositor** — `createMotionChannel`
- **Scroll & pin helpers** — `onScrollFrame`, `scrollProgress`, `PIN_ATTRIBUTE`, `pinProgress`, `sourceProgress`
- **Config** — `zodParser`, `toConfigJsonSchema`
- **Media helpers**

The `/dom` entry carries only the DOM helpers (no zod).

```bash
pnpm add @kubuild/effect-kit
```

Used by [`@kubuild/plugin-parallax`](https://www.npmjs.com/package/@kubuild/plugin-parallax) and [`@kubuild/plugin-animation`](https://www.npmjs.com/package/@kubuild/plugin-animation).

## License

Apache-2.0
