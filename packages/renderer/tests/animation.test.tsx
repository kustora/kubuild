import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { PageDocument } from '@kubuild/schema';
import { createBlankDocument } from '@kubuild/core';
import {
  getHoverEffectCss,
  getLoopEffectCss,
  getEntranceAnimationCss,
  collectAnimationStylesCss,
  ANIMATION_KEYFRAMES_CSS,
} from '../src/animation';
import { KubuildRenderer } from '../src/renderer';
import { generateDocumentCss } from '../src/code-generator';

describe('Hover Micro-Interactions & Motion CSS Generator (STORA-264)', () => {
  describe('Hover Micro-Interactions CSS Generator', () => {
    it('generates lift hover effect with -4px translation and box-shadow (Acceptance Criteria)', () => {
      const rules = getHoverEffectCss('btn-1', 'lift');
      expect(rules).toHaveLength(2);
      expect(rules[0]).toContain('[data-kubuild-node="btn-1"] { transition: transform 0.25s');
      expect(rules[1]).toContain('[data-kubuild-node="btn-1"]:hover { transform: translateY(-4px) !important;');
      expect(rules[1]).toContain('box-shadow:');
    });

    it('generates scale hover effect with 1.04 transform', () => {
      const rules = getHoverEffectCss('card-1', 'scale');
      expect(rules).toHaveLength(2);
      expect(rules[0]).toContain('[data-kubuild-node="card-1"] { transition: transform');
      expect(rules[1]).toContain('[data-kubuild-node="card-1"]:hover { transform: scale(1.04) !important; }');
    });

    it('generates glow hover effect with box-shadow', () => {
      const rules = getHoverEffectCss('badge-1', 'glow');
      expect(rules).toHaveLength(2);
      expect(rules[0]).toContain('transition: box-shadow');
      expect(rules[1]).toContain('[data-kubuild-node="badge-1"]:hover { box-shadow: 0 0 20px 2px rgba(59, 130, 246, 0.5) !important; }');
    });

    it('generates tilt hover effect with rotation and subtle scale', () => {
      const rules = getHoverEffectCss('img-1', 'tilt');
      expect(rules).toHaveLength(2);
      expect(rules[1]).toContain('[data-kubuild-node="img-1"]:hover { transform: rotate(2deg) scale(1.02) !important; }');
    });

    it('returns empty array for none or invalid hover effect', () => {
      expect(getHoverEffectCss('btn-1', 'none')).toEqual([]);
      expect(getHoverEffectCss('btn-1', 'unknown')).toEqual([]);
    });
  });

  describe('Loop Effects CSS Generator', () => {
    it.each([
      ['pulse', 'kb-loop-pulse'],
      ['bounce', 'kb-loop-bounce'],
      ['spin', 'kb-loop-spin'],
      ['float', 'kb-loop-float'],
      ['shimmer', 'kb-loop-shimmer'],
    ])('generates infinite loop rule for "%s"', (effect, keyframeName) => {
      const rules = getLoopEffectCss('hero-icon', effect);
      expect(rules).toHaveLength(1);
      expect(rules[0]).toContain(`[data-kubuild-node="hero-icon"] { animation: ${keyframeName}`);
      expect(rules[0]).toContain('infinite !important;');
    });
  });

  describe('Entrance Animations CSS Generator', () => {
    it('generates entrance animation rule with duration, delay, and easing curve', () => {
      const rules = getEntranceAnimationCss('hero-title', {
        type: 'fade-up',
        duration: 850,
        delay: 150,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        once: true,
        hoverEffect: 'none',
        loopEffect: 'none',
      });

      expect(rules).toHaveLength(1);
      expect(rules[0]).toContain('[data-kubuild-node="hero-title"]');
      expect(rules[0]).toContain('animation-name: kb-anim-fade-up !important;');
      expect(rules[0]).toContain('animation-duration: 850ms !important;');
      expect(rules[0]).toContain('animation-delay: 150ms !important;');
      expect(rules[0]).toContain('animation-timing-function: cubic-bezier(0.16, 1, 0.3, 1) !important;');
    });
  });

  describe('collectAnimationStylesCss', () => {
    it('returns empty string when no nodes have animations', () => {
      const doc = createBlankDocument('No Animations');
      expect(collectAnimationStylesCss(doc)).toBe('');
      expect(collectAnimationStylesCss(null)).toBe('');
    });

    it('collects all keyframes and node animation rules across the entire document tree', () => {
      const doc = createBlankDocument('Animated Page');
      doc.document.children = [
        {
          id: 'cta-btn',
          type: 'button',
          props: { label: 'Click Me' },
          animation: {
            type: 'slide-up',
            duration: 500,
            delay: 100,
            easing: 'ease-out',
            once: true,
            hoverEffect: 'lift',
            loopEffect: 'none',
          },
        },
        {
          id: 'badge-icon',
          type: 'icon',
          animation: {
            type: 'none',
            duration: 600,
            delay: 0,
            easing: 'ease-out',
            once: true,
            hoverEffect: 'glow',
            loopEffect: 'pulse',
          },
        },
      ];

      const css = collectAnimationStylesCss(doc);
      expect(css).toContain('@keyframes kb-anim-slide-up');
      expect(css).toContain('@keyframes kb-loop-pulse');
      expect(css).toContain('[data-kubuild-node="cta-btn"]:hover { transform: translateY(-4px)');
      expect(css).toContain('[data-kubuild-node="cta-btn"] { animation-name: kb-anim-slide-up');
      expect(css).toContain('[data-kubuild-node="badge-icon"] { animation: kb-loop-pulse');
      expect(css).toContain('[data-kubuild-node="badge-icon"]:hover { box-shadow:');
    });
  });

  describe('KubuildRenderer and Static Code Generator Integration', () => {
    it('injects <style data-kubuild-animation-styles> in KubuildRenderer when animated nodes exist', () => {
      const doc = createBlankDocument('Renderer Test');
      doc.document.children = [
        {
          id: 'animated-card',
          type: 'container',
          animation: {
            type: 'fade-up',
            duration: 700,
            delay: 0,
            easing: 'ease-out',
            once: true,
            hoverEffect: 'scale',
            loopEffect: 'none',
          },
        },
      ];

      const html = renderToString(<KubuildRenderer document={doc} />);
      expect(html).toContain('data-kubuild-animation-styles');
      expect(html).toContain('kb-anim-fade-up');
      expect(html).toContain('transform: scale(1.04)');
    });

    it('includes animation keyframes and scoped rules in generateDocumentCss', () => {
      const doc = createBlankDocument('Code Gen Test');
      doc.document.children = [
        {
          id: 'hero-btn',
          type: 'button',
          props: { label: 'Submit' },
          animation: {
            type: 'none',
            duration: 600,
            delay: 0,
            easing: 'ease-out',
            once: true,
            hoverEffect: 'lift',
            loopEffect: 'pulse',
          },
        },
      ];

      const css = generateDocumentCss(doc);
      expect(css).toContain('Animations & Motion Keyframes');
      expect(css).toContain('translateY(-4px)');
      expect(css).toContain('kb-loop-pulse');
    });
  });
});
