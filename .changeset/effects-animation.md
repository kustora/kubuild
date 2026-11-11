---
'@kubuild/plugin-animation': minor
'@kubuild/effect-kit': minor
'@kubuild/plugin-parallax': minor
'@kubuild/runtime-dom': minor
---

Animation generator effect plugins, played with Motion (STORA-660).

- **plugin-animation** (new): `animate-entrance` (fade/slide/zoom/pop/rotate reveals on scroll-in, springs, child stagger, replay), `animate-loop` (float, pulse, spin, wiggle, … paused off-screen) and `animate-hover` (lift, grow, tilt, push, …), exported as `animationPlugins`; `/dom` carries the runtimes only. The pure preset generator (`entranceFrames`, `loopFrames`, `hoverFrames`, `sampleFrames`) is exported too. Skipped under `prefers-reduced-motion`.
- **effect-kit** (new): the per-element motion compositor (`createMotionChannel`), `zodParser` / `toConfigJsonSchema` and media helpers, shared so effects from different plugins compose on one element.
- **plugin-parallax**: uses `@kubuild/effect-kit` instead of private copies; behavior unchanged.
- **runtime-dom**: `kubuild-runtime.js` also boots the animation runtimes (now ~32 KB, ~12 KB gzipped, mostly Motion's value engine).
