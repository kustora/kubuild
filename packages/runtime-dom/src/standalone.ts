/**
 * Entry for the `kubuild-runtime.js` IIFE that static HTML exports load with
 * `<script src defer>`. Boots every first-party effect runtime against the page's manifest.
 */
import { animationRuntimes } from '@kubuild/plugin-animation/dom';
import { parallaxRuntimes } from '@kubuild/plugin-parallax/dom';
import { bootEffects } from './boot.js';

declare global {
  interface Window {
    KubuildRuntime?: { destroy(): void };
  }
}

function start(): void {
  const destroy = bootEffects({
    runtimes: [...parallaxRuntimes, ...animationRuntimes],
    onError: (error, plugin) => console.error(`[kubuild] effect "${plugin}" failed`, error),
  });
  window.KubuildRuntime = { destroy };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
