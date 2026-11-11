---
'@kubuild/plugin-animation': minor
'@kubuild/effect-kit': minor
'@kubuild/plugin-parallax': minor
'@kubuild/runtime-dom': minor
---

Animation generator effect plugins, played with Motion (STORA-660).

- **plugin-animation** (new): `animate-entrance` (fade/slide/zoom/pop/rotate reveals on scroll-in, springs, child stagger, replay), `animate-loop` (float, pulse, spin, wiggle, … paused off-screen) and `animate-hover` (lift, grow, tilt, push, …), exported as `animationPlugins`; `/dom` carries the runtimes only. The pure preset generator (`entranceFrames`, `loopFrames`, `hoverFrames`, `sampleFrames`) is exported too. Skipped under `prefers-reduced-motion`.
- **plugin-animation** complex animations (STORA-662): `animate-timeline` (custom keyframe timelines with per-step easing, repeat/loop/alternate, child stagger), `animate-text` (word/letter split reveals and typewriter, accessible and restored exactly), `animate-counter` (formatted number count-up), `animate-draw` (SVG stroke drawing, incl. HTML-embed shadow roots) and `scroll-pin` (sticky storytelling sections). They share one trigger driver (`drive`): in view, load, hover or scrubbed by scroll — optionally following the progress of the pinned section around them.
- **core**: new `keyframes` effect field type (`EffectKeyframe`, `EffectKeyframeChannel`).
- **editor**: the Effects panel renders `keyframes` fields as a per-step timeline editor.
- **effect-kit** (new): the per-element motion compositor (`createMotionChannel`), scroll and pin helpers (`onScrollFrame`, `scrollProgress`, `PIN_ATTRIBUTE`, `pinProgress`, `sourceProgress`), `zodParser` / `toConfigJsonSchema` and media helpers, shared so effects from different plugins compose on one element.
- **plugin-parallax**: uses `@kubuild/effect-kit` (compositor and scroll helpers) instead of private copies; behavior unchanged.
- **runtime-dom**: `kubuild-runtime.js` also boots the animation runtimes (now ~40 KB, ~15 KB gzipped, about half of it Motion's value engine).
