import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  BackgroundImageControls,
  extractImageUrl,
  formatBackgroundImageUrl,
  BG_SIZE_OPTIONS,
  BG_POSITION_OPTIONS,
  BG_REPEAT_OPTIONS,
  BG_ATTACHMENT_OPTIONS,
} from '../src/components/style-manager/background-image-controls';
import {
  StyleManagerAccordion,
  STYLE_SECTORS,
} from '../src/components/style-manager/style-manager-accordion';

describe('Background Image Controls in Decorations Sector', () => {
  describe('extractImageUrl & formatBackgroundImageUrl helpers', () => {
    it('extracts URL from url("...") CSS string', () => {
      expect(extractImageUrl('url("https://example.com/hero.jpg")')).toBe('https://example.com/hero.jpg');
      expect(extractImageUrl("url('https://example.com/bg.png')")).toBe('https://example.com/bg.png');
      expect(extractImageUrl('url(https://example.com/test.webp)')).toBe('https://example.com/test.webp');
    });

    it('returns raw string if not wrapped in url()', () => {
      expect(extractImageUrl('https://example.com/image.jpg')).toBe('https://example.com/image.jpg');
      expect(extractImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=');
    });

    it('ignores gradients and empty values', () => {
      expect(extractImageUrl('linear-gradient(90deg, #fff, #000)')).toBe('');
      expect(extractImageUrl('radial-gradient(circle, #fff, #000)')).toBe('');
      expect(extractImageUrl('')).toBe('');
      expect(extractImageUrl('none')).toBe('');
      expect(extractImageUrl(undefined)).toBe('');
    });

    it('formats raw URL into valid CSS url("...") string', () => {
      expect(formatBackgroundImageUrl('https://example.com/hero.jpg')).toBe('url("https://example.com/hero.jpg")');
      expect(formatBackgroundImageUrl('data:image/png;base64,123')).toBe('url("data:image/png;base64,123")');
    });

    it('preserves existing url(...) without double-wrapping', () => {
      expect(formatBackgroundImageUrl('url("https://example.com/bg.jpg")')).toBe('url("https://example.com/bg.jpg")');
    });

    it('returns empty string for empty input or none', () => {
      expect(formatBackgroundImageUrl('')).toBe('');
      expect(formatBackgroundImageUrl('none')).toBe('');
    });
  });

  describe('BackgroundImageControls component rendering', () => {
    it('renders empty background image control with input and upload button', () => {
      const html = renderToString(
        <BackgroundImageControls
          styles={{}}
          onChange={() => {}}
        />
      );

      expect(html).toContain('Background Image');
      expect(html).toContain('data-testid="bg-image-url-input"');
      expect(html).toContain('data-testid="bg-image-upload-btn"');
      expect(html).toContain('placeholder="https://... or upload local image"');
      // Sizing/position/repeat should be hidden when no image is set
      expect(html).not.toContain('data-testid="bg-image-preview"');
      expect(html).not.toContain('data-testid="bg-size-cover"');
    });

    it('renders active background image with preview, size, position, repeat, and attachment controls', () => {
      const html = renderToString(
        <BackgroundImageControls
          styles={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
          }}
          onChange={() => {}}
        />
      );

      expect(html).toContain('Background Image');
      expect(html).toContain('data-testid="bg-image-preview"');
      expect(html).toContain('data-testid="bg-image-clear-btn"');

      // Size buttons
      expect(html).toContain('data-testid="bg-size-cover"');
      expect(html).toContain('data-testid="bg-size-contain"');
      expect(html).toContain('data-testid="bg-size-auto"');

      // Position dropdown
      expect(html).toContain('data-testid="bg-position-select"');
      expect(html).toContain('Center');
      expect(html).toContain('Top Left');

      // Repeat dropdown
      expect(html).toContain('data-testid="bg-repeat-select"');
      expect(html).toContain('No Repeat');
      expect(html).toContain('Tile');

      // Attachment buttons
      expect(html).toContain('data-testid="bg-attachment-scroll"');
      expect(html).toContain('data-testid="bg-attachment-fixed"');
    });
  });

  describe('Decorations Sector Integration', () => {
    it('includes background properties in decorations sector definition', () => {
      const decorations = STYLE_SECTORS.find((s) => s.id === 'decorations');
      expect(decorations).toBeDefined();
      expect(decorations?.properties).toContain('backgroundColor');
      expect(decorations?.properties).toContain('backgroundImage');
      expect(decorations?.properties).toContain('backgroundSize');
      expect(decorations?.properties).toContain('backgroundPosition');
      expect(decorations?.properties).toContain('backgroundRepeat');
      expect(decorations?.properties).toContain('backgroundAttachment');
    });

    it('renders BackgroundImageControls inside StyleManagerAccordion decorations sector', () => {
      const html = renderToString(
        <StyleManagerAccordion
          styles={{
            backgroundImage: 'url("https://example.com/banner.png")',
          }}
          initialState={{ decorations: true }}
          onCommitStyle={() => {}}
        />
      );

      expect(html).toContain('Decorations');
      expect(html).toContain('Background Color &amp; Gradient');
      expect(html).toContain('Background Image');
      expect(html).toContain('data-testid="bg-image-url-input"');
      expect(html).toContain('data-testid="bg-image-preview"');
    });
  });
});
