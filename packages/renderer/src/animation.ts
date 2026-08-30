import { PageDocument, Node, AnimationConfig } from '@kubuild/schema';

/**
 * Standard Keyframes for Entrance, Scroll, and Continuous Loop Animations (STORA-263, STORA-264)
 */
export const ANIMATION_KEYFRAMES_CSS = `
/* Entrance / AOS Keyframes */
@keyframes kb-anim-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes kb-anim-fade-up {
  from { opacity: 0; transform: translateY(24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes kb-anim-fade-down {
  from { opacity: 0; transform: translateY(-24px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes kb-anim-fade-left {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes kb-anim-fade-right {
  from { opacity: 0; transform: translateX(-24px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes kb-anim-zoom-in {
  from { opacity: 0; transform: scale(0.92); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes kb-anim-zoom-out {
  from { opacity: 0; transform: scale(1.08); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes kb-anim-slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}
@keyframes kb-anim-slide-down {
  from { transform: translateY(-100%); }
  to { transform: translateY(0); }
}
@keyframes kb-anim-slide-left {
  from { transform: translateX(100%); }
  to { transform: translateX(0); }
}
@keyframes kb-anim-slide-right {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
@keyframes kb-anim-flip-up {
  from { opacity: 0; transform: perspective(600px) rotateX(45deg); }
  to { opacity: 1; transform: perspective(600px) rotateX(0deg); }
}
@keyframes kb-anim-flip-down {
  from { opacity: 0; transform: perspective(600px) rotateX(-45deg); }
  to { opacity: 1; transform: perspective(600px) rotateX(0deg); }
}

/* Continuous Loop Keyframes */
@keyframes kb-loop-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.9; }
}
@keyframes kb-loop-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
@keyframes kb-loop-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
@keyframes kb-loop-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-6px); }
}
@keyframes kb-loop-shimmer {
  0%, 100% { opacity: 0.75; }
  50% { opacity: 1; }
}
`.trim();

/**
 * Escape a node id for safe interpolation into an attribute selector.
 */
function escapeCssIdent(value: string): string {
  return value.replace(/["\\\]]/g, '\\$&');
}

/**
 * Generate CSS rules for Hover Micro-Interactions (STORA-264)
 */
export function getHoverEffectCss(nodeId: string, hoverEffect: string): string[] {
  const safeId = escapeCssIdent(nodeId);
  const rules: string[] = [];

  switch (hoverEffect) {
    case 'lift':
      rules.push(
        `[data-kubuild-node="${safeId}"] { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease !important; will-change: transform; }`,
        `[data-kubuild-node="${safeId}"]:hover { transform: translateY(-4px) !important; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1) !important; }`,
      );
      break;
    case 'scale':
      rules.push(
        `[data-kubuild-node="${safeId}"] { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important; will-change: transform; }`,
        `[data-kubuild-node="${safeId}"]:hover { transform: scale(1.04) !important; }`,
      );
      break;
    case 'glow':
      rules.push(
        `[data-kubuild-node="${safeId}"] { transition: box-shadow 0.25s ease !important; }`,
        `[data-kubuild-node="${safeId}"]:hover { box-shadow: 0 0 20px 2px rgba(59, 130, 246, 0.5) !important; }`,
      );
      break;
    case 'tilt':
      rules.push(
        `[data-kubuild-node="${safeId}"] { transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important; will-change: transform; }`,
        `[data-kubuild-node="${safeId}"]:hover { transform: rotate(2deg) scale(1.02) !important; }`,
      );
      break;
    default:
      break;
  }

  return rules;
}

/**
 * Generate CSS rules for Continuous Loop Effects (STORA-264)
 */
export function getLoopEffectCss(nodeId: string, loopEffect: string): string[] {
  const safeId = escapeCssIdent(nodeId);
  const rules: string[] = [];

  switch (loopEffect) {
    case 'pulse':
      rules.push(
        `[data-kubuild-node="${safeId}"] { animation: kb-loop-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite !important; }`,
      );
      break;
    case 'bounce':
      rules.push(
        `[data-kubuild-node="${safeId}"] { animation: kb-loop-bounce 1.5s ease-in-out infinite !important; }`,
      );
      break;
    case 'spin':
      rules.push(
        `[data-kubuild-node="${safeId}"] { animation: kb-loop-spin 3s linear infinite !important; }`,
      );
      break;
    case 'float':
      rules.push(
        `[data-kubuild-node="${safeId}"] { animation: kb-loop-float 3s ease-in-out infinite !important; }`,
      );
      break;
    case 'shimmer':
      rules.push(
        `[data-kubuild-node="${safeId}"] { animation: kb-loop-shimmer 2s ease-in-out infinite !important; }`,
      );
      break;
    default:
      break;
  }

  return rules;
}

/**
 * Generate CSS rules for Entrance / Scroll Animations (STORA-263)
 */
export function getEntranceAnimationCss(nodeId: string, anim: AnimationConfig): string[] {
  if (!anim.type || anim.type === 'none') return [];
  const safeId = escapeCssIdent(nodeId);
  const duration = typeof anim.duration === 'number' ? anim.duration : 600;
  const delay = typeof anim.delay === 'number' ? anim.delay : 0;
  const easing = anim.easing || 'ease-out';

  return [
    `[data-kubuild-node="${safeId}"] { animation-name: kb-anim-${anim.type} !important; animation-duration: ${duration}ms !important; animation-delay: ${delay}ms !important; animation-timing-function: ${easing} !important; animation-fill-mode: both !important; }`,
  ];
}

/**
 * Walk the document and collect all compiled CSS rules for animations, hover micro-interactions, and loop effects.
 */
export function collectAnimationStylesCss(document: PageDocument | undefined | null): string {
  if (!document?.document) return '';
  const rules: string[] = [];
  let hasAnyAnimation = false;

  const walk = (node: Node): void => {
    const anim = node.animation;
    if (anim) {
      if (anim.hoverEffect && anim.hoverEffect !== 'none') {
        rules.push(...getHoverEffectCss(node.id, anim.hoverEffect));
        hasAnyAnimation = true;
      }
      if (anim.loopEffect && anim.loopEffect !== 'none') {
        rules.push(...getLoopEffectCss(node.id, anim.loopEffect));
        hasAnyAnimation = true;
      }
      if (anim.type && anim.type !== 'none') {
        rules.push(...getEntranceAnimationCss(node.id, anim));
        hasAnyAnimation = true;
      }
    }
    node.children?.forEach(walk);
  };

  walk(document.document);

  if (!hasAnyAnimation) return '';

  return `${ANIMATION_KEYFRAMES_CSS}\n\n${rules.join('\n')}`;
}

/**
 * Replay CSS animation on a specific DOM element by node ID (STORA-262)
 */
export function replayNodeAnimation(nodeId: string, rootElement?: HTMLElement | Document | null): boolean {
  const root = rootElement || (typeof window !== 'undefined' ? window.document : null);
  if (!root) return false;

  const el = root.querySelector(`[data-kubuild-node="${escapeCssIdent(nodeId)}"]`) as HTMLElement | null;
  if (!el) return false;

  const currentAnimation = el.style.animation;
  el.style.animation = 'none';
  // Force browser layout reflow to restart CSS keyframe animations
  void el.offsetWidth;
  el.style.animation = currentAnimation;

  // Dispatch custom event for observers
  el.dispatchEvent(new CustomEvent('kubuild:replay-animation', { bubbles: true, detail: { nodeId } }));
  return true;
}
