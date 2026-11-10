/**
 * @kubuild/html-import
 * Tailwind utility class mapper (STORA-622, ADR-002).
 *
 * AI-generated pages often style everything with Tailwind utility classes loaded from the
 * Play CDN, so there is no stylesheet for the cascade to read. This module translates the
 * common subset of Tailwind v3 utilities (default theme scale) into plain CSS rules that are
 * appended to the stylesheet bundle. The regular cascade then treats them like any other
 * class rule: class specificity, source order, `@media (min-width)` → breakpoints, and
 * `:hover`/`:focus`/`:active` → `styles.states`. Nothing Tailwind-specific reaches the
 * document; the output stays a portable style object.
 *
 * The module is DOM-free and never executes `tailwind.config`: only a strict, static
 * object-literal subset (colors, fontFamily) is read; anything else is reported.
 */

import type { DefaultTreeAdapterMap } from 'parse5';
import { addDiagnostic, type HtmlImportReport } from './types.js';
import type { ParsedCssDeclaration, ParsedCssRule } from './stylesheet.js';

type TreeNode = DefaultTreeAdapterMap['node'];
type TreeElement = DefaultTreeAdapterMap['element'];

/**
 * Tailwind handling mode (`HtmlImportOptions.tailwind`).
 * - `'auto'` (default): map utilities when Tailwind is detected (Play CDN script,
 *   `tailwind.config` script, `<style type="text/tailwindcss">`) or the class names carry a
 *   clear Tailwind signature (variant prefixes such as `md:`/`hover:`, palette shades such as
 *   `bg-gray-50`).
 * - `true`: always map. - `false`: never map.
 */
export type TailwindMode = 'auto' | boolean;

/** Tailwind usage signals found in the raw (pre-sanitization) HTML. */
export interface TailwindDetection {
  /** A Tailwind Play CDN / browser build script or `text/tailwindcss` style was present. */
  cdn: boolean;
  /** Inline script sources that assign `tailwind.config` (never executed). */
  configSources: string[];
}

/** One CSS declaration as `[kebab-case property, value]`. */
export type TailwindDeclaration = readonly [string, string];

/** Resolved CSS for a single utility (without variants). */
export interface TailwindUtilityResolution {
  declarations: TailwindDeclaration[];
  /** Sort key approximating Tailwind's utility output order (later wins on conflicts). */
  order: number;
  /** Selector suffix for utilities that style children (e.g. `space-x-*`). */
  childSelector?: string;
  /** Additional responsive rules emitted by the utility itself (e.g. `container`). */
  extraMedia?: Array<{ mediaQuery: string; declarations: TailwindDeclaration[] }>;
}

/** A class token split into variants and utility. */
export interface ParsedTailwindClass {
  token: string;
  variants: string[];
  utility: string;
  important: boolean;
  negative: boolean;
}

/** Fully mapped class: one or more CSS rules, or the reason it could not be mapped. */
export type TailwindClassMapping =
  | {
      ok: true;
      rules: Array<{
        selector: string;
        mediaQuery?: string;
        declarations: ParsedCssDeclaration[];
        variantOrder: number;
        order: number;
      }>;
    }
  | { ok: false; reason: string };

/** Theme used by the mapper: default Tailwind v3 scale plus static `tailwind.config` additions. */
export interface TailwindTheme {
  colors: Record<string, string>;
  fontFamily: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Default theme (Tailwind v3)
// ---------------------------------------------------------------------------

const SHADES = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

const PALETTE: Record<string, string> = {
  slate: '#f8fafc #f1f5f9 #e2e8f0 #cbd5e1 #94a3b8 #64748b #475569 #334155 #1e293b #0f172a #020617',
  gray: '#f9fafb #f3f4f6 #e5e7eb #d1d5db #9ca3af #6b7280 #4b5563 #374151 #1f2937 #111827 #030712',
  zinc: '#fafafa #f4f4f5 #e4e4e7 #d4d4d8 #a1a1aa #71717a #52525b #3f3f46 #27272a #18181b #09090b',
  neutral:
    '#fafafa #f5f5f5 #e5e5e5 #d4d4d4 #a3a3a3 #737373 #525252 #404040 #262626 #171717 #0a0a0a',
  stone: '#fafaf9 #f5f5f4 #e7e5e4 #d6d3d1 #a8a29e #78716c #57534e #44403c #292524 #1c1917 #0c0a09',
  red: '#fef2f2 #fee2e2 #fecaca #fca5a5 #f87171 #ef4444 #dc2626 #b91c1c #991b1b #7f1d1d #450a0a',
  orange: '#fff7ed #ffedd5 #fed7aa #fdba74 #fb923c #f97316 #ea580c #c2410c #9a3412 #7c2d12 #431407',
  amber: '#fffbeb #fef3c7 #fde68a #fcd34d #fbbf24 #f59e0b #d97706 #b45309 #92400e #78350f #451a03',
  yellow: '#fefce8 #fef9c3 #fef08a #fde047 #facc15 #eab308 #ca8a04 #a16207 #854d0e #713f12 #422006',
  lime: '#f7fee7 #ecfccb #d9f99d #bef264 #a3e635 #84cc16 #65a30d #4d7c0f #3f6212 #365314 #1a2e05',
  green: '#f0fdf4 #dcfce7 #bbf7d0 #86efac #4ade80 #22c55e #16a34a #15803d #166534 #14532d #052e16',
  emerald:
    '#ecfdf5 #d1fae5 #a7f3d0 #6ee7b7 #34d399 #10b981 #059669 #047857 #065f46 #064e3b #022c22',
  teal: '#f0fdfa #ccfbf1 #99f6e4 #5eead4 #2dd4bf #14b8a6 #0d9488 #0f766e #115e59 #134e4a #042f2e',
  cyan: '#ecfeff #cffafe #a5f3fc #67e8f9 #22d3ee #06b6d4 #0891b2 #0e7490 #155e75 #164e63 #083344',
  sky: '#f0f9ff #e0f2fe #bae6fd #7dd3fc #38bdf8 #0ea5e9 #0284c7 #0369a1 #075985 #0c4a6e #082f49',
  blue: '#eff6ff #dbeafe #bfdbfe #93c5fd #60a5fa #3b82f6 #2563eb #1d4ed8 #1e40af #1e3a8a #172554',
  indigo: '#eef2ff #e0e7ff #c7d2fe #a5b4fc #818cf8 #6366f1 #4f46e5 #4338ca #3730a3 #312e81 #1e1b4b',
  violet: '#f5f3ff #ede9fe #ddd6fe #c4b5fd #a78bfa #8b5cf6 #7c3aed #6d28d9 #5b21b6 #4c1d95 #2e1065',
  purple: '#faf5ff #f3e8ff #e9d5ff #d8b4fe #c084fc #a855f7 #9333ea #7e22ce #6b21a8 #581c87 #3b0764',
  fuchsia:
    '#fdf4ff #fae8ff #f5d0fe #f0abfc #e879f9 #d946ef #c026d3 #a21caf #86198f #701a75 #4a044e',
  pink: '#fdf2f8 #fce7f3 #fbcfe8 #f9a8d4 #f472b6 #ec4899 #db2777 #be185d #9d174d #831843 #500724',
  rose: '#fff1f2 #ffe4e6 #fecdd3 #fda4af #fb7185 #f43f5e #e11d48 #be123c #9f1239 #881337 #4c0519',
};

const SPECIAL_COLORS: Record<string, string> = {
  inherit: 'inherit',
  current: 'currentColor',
  transparent: 'transparent',
  black: '#000000',
  white: '#ffffff',
};

function buildDefaultColors(): Record<string, string> {
  const colors: Record<string, string> = { ...SPECIAL_COLORS };
  for (const [name, list] of Object.entries(PALETTE)) {
    list.split(' ').forEach((hex, i) => {
      colors[`${name}-${SHADES[i]}`] = hex;
    });
  }
  return colors;
}

const DEFAULT_FONT_FAMILY: Record<string, string> = {
  sans: 'ui-sans-serif, system-ui, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

/** Returns a fresh copy of the default Tailwind v3 theme subset used by the mapper. */
export function createDefaultTailwindTheme(): TailwindTheme {
  return { colors: buildDefaultColors(), fontFamily: { ...DEFAULT_FONT_FAMILY } };
}

const SPACING_KEYS = new Set([
  '0.5',
  '1',
  '1.5',
  '2',
  '2.5',
  '3',
  '3.5',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  '11',
  '12',
  '14',
  '16',
  '20',
  '24',
  '28',
  '32',
  '36',
  '40',
  '44',
  '48',
  '52',
  '56',
  '60',
  '64',
  '72',
  '80',
  '96',
]);

const FONT_SIZES: Record<string, [string, string]> = {
  xs: ['0.75rem', '1rem'],
  sm: ['0.875rem', '1.25rem'],
  base: ['1rem', '1.5rem'],
  lg: ['1.125rem', '1.75rem'],
  xl: ['1.25rem', '1.75rem'],
  '2xl': ['1.5rem', '2rem'],
  '3xl': ['1.875rem', '2.25rem'],
  '4xl': ['2.25rem', '2.5rem'],
  '5xl': ['3rem', '1'],
  '6xl': ['3.75rem', '1'],
  '7xl': ['4.5rem', '1'],
  '8xl': ['6rem', '1'],
  '9xl': ['8rem', '1'],
};

const FONT_WEIGHTS: Record<string, string> = {
  thin: '100',
  extralight: '200',
  light: '300',
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
  black: '900',
};

const LINE_HEIGHTS: Record<string, string> = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
  '3': '.75rem',
  '4': '1rem',
  '5': '1.25rem',
  '6': '1.5rem',
  '7': '1.75rem',
  '8': '2rem',
  '9': '2.25rem',
  '10': '2.5rem',
};

const LETTER_SPACING: Record<string, string> = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
};

const RADII: Record<string, string> = {
  none: '0px',
  sm: '0.125rem',
  '': '0.25rem',
  md: '0.375rem',
  lg: '0.5rem',
  xl: '0.75rem',
  '2xl': '1rem',
  '3xl': '1.5rem',
  full: '9999px',
};

const SHADOWS: Record<string, string> = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  '': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  none: '0 0 #0000',
};

const MAX_WIDTHS: Record<string, string> = {
  none: 'none',
  xs: '20rem',
  sm: '24rem',
  md: '28rem',
  lg: '32rem',
  xl: '36rem',
  '2xl': '42rem',
  '3xl': '48rem',
  '4xl': '56rem',
  '5xl': '64rem',
  '6xl': '72rem',
  '7xl': '80rem',
  full: '100%',
  min: 'min-content',
  max: 'max-content',
  fit: 'fit-content',
  prose: '65ch',
  'screen-sm': '640px',
  'screen-md': '768px',
  'screen-lg': '1024px',
  'screen-xl': '1280px',
  'screen-2xl': '1536px',
};

/** Responsive variants: mobile-first `min-width` queries (Tailwind default screens). */
export const TAILWIND_SCREENS: Readonly<Record<string, number>> = Object.freeze({
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
});

const SCREEN_ORDER = ['sm', 'md', 'lg', 'xl', '2xl'];

const STATE_VARIANTS: Record<string, string> = {
  hover: ':hover',
  focus: ':focus',
  active: ':active',
  'focus-visible': ':focus-visible',
  disabled: ':disabled',
};

/** Classes Tailwind uses as markers only (no CSS of their own). */
const MARKER_CLASSES = new Set(['group', 'peer', 'dark', 'light', 'prose']);

const TRANSITION_PROPERTIES =
  'color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter';
const DEFAULT_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const DEFAULT_BORDER_COLOR = '#e5e7eb';

/** Family sort order, approximating Tailwind's core plugin order. */
const FAMILY_ORDER = [
  'container',
  'pointer-events',
  'visibility',
  'position',
  'inset',
  'z-index',
  'order',
  'grid-column',
  'grid-row',
  'margin',
  'box-sizing',
  'display',
  'aspect-ratio',
  'size',
  'height',
  'max-height',
  'min-height',
  'width',
  'min-width',
  'max-width',
  'flex',
  'flex-shrink',
  'flex-grow',
  'flex-basis',
  'transform',
  'cursor',
  'user-select',
  'list-style',
  'grid-template-columns',
  'grid-template-rows',
  'grid-flow',
  'flex-direction',
  'flex-wrap',
  'align-content',
  'align-items',
  'justify-content',
  'justify-items',
  'gap',
  'space',
  'align-self',
  'justify-self',
  'overflow',
  'text-overflow',
  'whitespace',
  'word-break',
  'border-radius',
  'border-width',
  'border-style',
  'border-color',
  'background-color',
  'background-image',
  'gradient-stops',
  'background-size',
  'background-attachment',
  'background-position',
  'background-repeat',
  'object-fit',
  'object-position',
  'padding',
  'text-align',
  'vertical-align',
  'font-family',
  'font-size',
  'font-weight',
  'text-transform',
  'font-style',
  'line-height',
  'letter-spacing',
  'text-color',
  'text-decoration',
  'font-smoothing',
  'opacity',
  'box-shadow',
  'transition',
  'duration',
  'ease',
] as const;

type Family = (typeof FAMILY_ORDER)[number];

function orderOf(family: Family, sub = 0): number {
  return FAMILY_ORDER.indexOf(family) * 10 + sub;
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

/** Characters allowed inside arbitrary values (`p-[13px]`); no quotes, braces, colons or url(). */
const ARBITRARY_VALUE_PATTERN = /^[a-zA-Z0-9#.%,()+\-*/ ]{1,80}$/;

/** Returns the inner value of an arbitrary `[...]` key when it is safe, else `null`. */
export function parseArbitraryValue(key: string): string | null {
  if (!key.startsWith('[') || !key.endsWith(']')) return null;
  const value = key.slice(1, -1).replace(/_/g, ' ').trim();
  if (!ARBITRARY_VALUE_PATTERN.test(value)) return null;
  if (/url\s*\(|expression|var\s*\(|javascript|attr\s*\(|image-set|@/i.test(value)) return null;
  return value;
}

function isLengthLike(value: string): boolean {
  return /^-?(\d|\.\d)|^(calc|min|max|clamp)\(/i.test(value);
}

function isColorLike(value: string): boolean {
  return /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([0-9.,%\s/a-z-]+\)|[a-z]+)$/i.test(value);
}

function spacing(key: string): string | null {
  if (key === '0') return '0px';
  if (key === 'px') return '1px';
  if (SPACING_KEYS.has(key)) return `${Number(key) * 0.25}rem`;
  const arbitrary = parseArbitraryValue(key);
  return arbitrary && isLengthLike(arbitrary) ? arbitrary : null;
}

function fraction(key: string): string | null {
  const match = /^(\d+)\/(\d+)$/.exec(key);
  if (!match) return null;
  const [num, den] = [Number(match[1]), Number(match[2])];
  if (![2, 3, 4, 5, 6, 12].includes(den) || num <= 0 || num >= den) return null;
  return `${Math.round((num / den) * 100 * 1e6) / 1e6}%`;
}

function negate(value: string): string | null {
  if (value === '0px' || value === '0') return value;
  if (/^\d|^\./.test(value)) return `-${value}`;
  if (/^calc\(/i.test(value)) return `calc(${value} * -1)`;
  return null;
}

function hexToRgbChannels(hex: string): string | null {
  let h = hex.replace('#', '');
  if (h.length === 3)
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  if (h.length !== 6 || !/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function color(key: string, theme: TailwindTheme): string | null {
  let base = key;
  let alpha: string | undefined;
  const slash = key.lastIndexOf('/');
  if (slash > 0 && !key.startsWith('[')) {
    base = key.slice(0, slash);
    alpha = key.slice(slash + 1);
  } else if (key.startsWith('[') && /\]\/[\d.]+$/.test(key)) {
    base = key.slice(0, key.lastIndexOf('/'));
    alpha = key.slice(key.lastIndexOf('/') + 1);
  }
  let value: string | null = theme.colors[base] ?? null;
  if (!value) {
    const arbitrary = parseArbitraryValue(base);
    value = arbitrary && isColorLike(arbitrary) && !isLengthLike(arbitrary) ? arbitrary : null;
  }
  if (!value) return null;
  if (alpha === undefined) return value;
  const alphaNum = Number(alpha);
  if (!Number.isFinite(alphaNum) || alphaNum < 0 || alphaNum > 100) return null;
  const channels = value.startsWith('#') ? hexToRgbChannels(value) : null;
  if (!channels) return null;
  return `rgb(${channels} / ${Math.round(alphaNum) / 100})`;
}

function transparentOf(value: string): string {
  const channels = value.startsWith('#') ? hexToRgbChannels(value) : null;
  return channels ? `rgb(${channels} / 0)` : 'transparent';
}

// ---------------------------------------------------------------------------
// Utility resolution
// ---------------------------------------------------------------------------

const DISPLAY: Record<string, string> = {
  block: 'block',
  'inline-block': 'inline-block',
  inline: 'inline',
  flex: 'flex',
  'inline-flex': 'inline-flex',
  grid: 'grid',
  'inline-grid': 'inline-grid',
  table: 'table',
  'table-row': 'table-row',
  'table-cell': 'table-cell',
  contents: 'contents',
  'list-item': 'list-item',
  hidden: 'none',
  'flow-root': 'flow-root',
};

const POSITION = new Set(['static', 'fixed', 'absolute', 'relative', 'sticky']);

/** Static single-class utilities: class → [family, declarations]. */
const STATIC_UTILITIES: Record<string, [Family, TailwindDeclaration[]]> = {
  visible: ['visibility', [['visibility', 'visible']]],
  invisible: ['visibility', [['visibility', 'hidden']]],
  'pointer-events-none': ['pointer-events', [['pointer-events', 'none']]],
  'pointer-events-auto': ['pointer-events', [['pointer-events', 'auto']]],
  'box-border': ['box-sizing', [['box-sizing', 'border-box']]],
  'box-content': ['box-sizing', [['box-sizing', 'content-box']]],
  'aspect-auto': ['aspect-ratio', [['aspect-ratio', 'auto']]],
  'aspect-square': ['aspect-ratio', [['aspect-ratio', '1 / 1']]],
  'aspect-video': ['aspect-ratio', [['aspect-ratio', '16 / 9']]],
  'flex-1': ['flex', [['flex', '1 1 0%']]],
  'flex-auto': ['flex', [['flex', '1 1 auto']]],
  'flex-initial': ['flex', [['flex', '0 1 auto']]],
  'flex-none': ['flex', [['flex', 'none']]],
  shrink: ['flex-shrink', [['flex-shrink', '1']]],
  'shrink-0': ['flex-shrink', [['flex-shrink', '0']]],
  'flex-shrink': ['flex-shrink', [['flex-shrink', '1']]],
  'flex-shrink-0': ['flex-shrink', [['flex-shrink', '0']]],
  grow: ['flex-grow', [['flex-grow', '1']]],
  'grow-0': ['flex-grow', [['flex-grow', '0']]],
  'flex-grow': ['flex-grow', [['flex-grow', '1']]],
  'flex-grow-0': ['flex-grow', [['flex-grow', '0']]],
  'cursor-pointer': ['cursor', [['cursor', 'pointer']]],
  'cursor-default': ['cursor', [['cursor', 'default']]],
  'cursor-not-allowed': ['cursor', [['cursor', 'not-allowed']]],
  'cursor-text': ['cursor', [['cursor', 'text']]],
  'cursor-move': ['cursor', [['cursor', 'move']]],
  'select-none': ['user-select', [['user-select', 'none']]],
  'select-text': ['user-select', [['user-select', 'text']]],
  'select-all': ['user-select', [['user-select', 'all']]],
  'list-none': ['list-style', [['list-style-type', 'none']]],
  'list-disc': ['list-style', [['list-style-type', 'disc']]],
  'list-decimal': ['list-style', [['list-style-type', 'decimal']]],
  'list-inside': ['list-style', [['list-style-position', 'inside']]],
  'list-outside': ['list-style', [['list-style-position', 'outside']]],
  'grid-flow-row': ['grid-flow', [['grid-auto-flow', 'row']]],
  'grid-flow-col': ['grid-flow', [['grid-auto-flow', 'column']]],
  'grid-flow-dense': ['grid-flow', [['grid-auto-flow', 'dense']]],
  'grid-flow-row-dense': ['grid-flow', [['grid-auto-flow', 'row dense']]],
  'grid-flow-col-dense': ['grid-flow', [['grid-auto-flow', 'column dense']]],
  'flex-row': ['flex-direction', [['flex-direction', 'row']]],
  'flex-row-reverse': ['flex-direction', [['flex-direction', 'row-reverse']]],
  'flex-col': ['flex-direction', [['flex-direction', 'column']]],
  'flex-col-reverse': ['flex-direction', [['flex-direction', 'column-reverse']]],
  'flex-wrap': ['flex-wrap', [['flex-wrap', 'wrap']]],
  'flex-wrap-reverse': ['flex-wrap', [['flex-wrap', 'wrap-reverse']]],
  'flex-nowrap': ['flex-wrap', [['flex-wrap', 'nowrap']]],
  truncate: [
    'text-overflow',
    [
      ['overflow', 'hidden'],
      ['text-overflow', 'ellipsis'],
      ['white-space', 'nowrap'],
    ],
  ],
  'text-ellipsis': ['text-overflow', [['text-overflow', 'ellipsis']]],
  'text-clip': ['text-overflow', [['text-overflow', 'clip']]],
  'break-normal': [
    'word-break',
    [
      ['overflow-wrap', 'normal'],
      ['word-break', 'normal'],
    ],
  ],
  'break-words': ['word-break', [['overflow-wrap', 'break-word']]],
  'break-all': ['word-break', [['word-break', 'break-all']]],
  'border-solid': ['border-style', [['border-style', 'solid']]],
  'border-dashed': ['border-style', [['border-style', 'dashed']]],
  'border-dotted': ['border-style', [['border-style', 'dotted']]],
  'border-double': ['border-style', [['border-style', 'double']]],
  'border-none': ['border-style', [['border-style', 'none']]],
  'bg-fixed': ['background-attachment', [['background-attachment', 'fixed']]],
  'bg-local': ['background-attachment', [['background-attachment', 'local']]],
  'bg-scroll': ['background-attachment', [['background-attachment', 'scroll']]],
  'bg-auto': ['background-size', [['background-size', 'auto']]],
  'bg-cover': ['background-size', [['background-size', 'cover']]],
  'bg-contain': ['background-size', [['background-size', 'contain']]],
  'bg-center': ['background-position', [['background-position', 'center']]],
  'bg-top': ['background-position', [['background-position', 'top']]],
  'bg-bottom': ['background-position', [['background-position', 'bottom']]],
  'bg-left': ['background-position', [['background-position', 'left']]],
  'bg-right': ['background-position', [['background-position', 'right']]],
  'bg-repeat': ['background-repeat', [['background-repeat', 'repeat']]],
  'bg-no-repeat': ['background-repeat', [['background-repeat', 'no-repeat']]],
  'bg-repeat-x': ['background-repeat', [['background-repeat', 'repeat-x']]],
  'bg-repeat-y': ['background-repeat', [['background-repeat', 'repeat-y']]],
  'bg-none': ['background-image', [['background-image', 'none']]],
  'object-contain': ['object-fit', [['object-fit', 'contain']]],
  'object-cover': ['object-fit', [['object-fit', 'cover']]],
  'object-fill': ['object-fit', [['object-fit', 'fill']]],
  'object-none': ['object-fit', [['object-fit', 'none']]],
  'object-scale-down': ['object-fit', [['object-fit', 'scale-down']]],
  'object-center': ['object-position', [['object-position', 'center']]],
  'object-top': ['object-position', [['object-position', 'top']]],
  'object-bottom': ['object-position', [['object-position', 'bottom']]],
  'align-top': ['vertical-align', [['vertical-align', 'top']]],
  'align-middle': ['vertical-align', [['vertical-align', 'middle']]],
  'align-bottom': ['vertical-align', [['vertical-align', 'bottom']]],
  'align-baseline': ['vertical-align', [['vertical-align', 'baseline']]],
  uppercase: ['text-transform', [['text-transform', 'uppercase']]],
  lowercase: ['text-transform', [['text-transform', 'lowercase']]],
  capitalize: ['text-transform', [['text-transform', 'capitalize']]],
  'normal-case': ['text-transform', [['text-transform', 'none']]],
  italic: ['font-style', [['font-style', 'italic']]],
  'not-italic': ['font-style', [['font-style', 'normal']]],
  underline: ['text-decoration', [['text-decoration-line', 'underline']]],
  overline: ['text-decoration', [['text-decoration-line', 'overline']]],
  'line-through': ['text-decoration', [['text-decoration-line', 'line-through']]],
  'no-underline': ['text-decoration', [['text-decoration-line', 'none']]],
  antialiased: [
    'font-smoothing',
    [
      ['-webkit-font-smoothing', 'antialiased'],
      ['-moz-osx-font-smoothing', 'grayscale'],
    ],
  ],
  'subpixel-antialiased': [
    'font-smoothing',
    [
      ['-webkit-font-smoothing', 'auto'],
      ['-moz-osx-font-smoothing', 'auto'],
    ],
  ],
  transition: [
    'transition',
    [
      ['transition-property', TRANSITION_PROPERTIES],
      ['transition-timing-function', DEFAULT_EASE],
      ['transition-duration', '150ms'],
    ],
  ],
  'transition-all': [
    'transition',
    [
      ['transition-property', 'all'],
      ['transition-timing-function', DEFAULT_EASE],
      ['transition-duration', '150ms'],
    ],
  ],
  'transition-colors': [
    'transition',
    [
      [
        'transition-property',
        'color, background-color, border-color, text-decoration-color, fill, stroke',
      ],
      ['transition-timing-function', DEFAULT_EASE],
      ['transition-duration', '150ms'],
    ],
  ],
  'transition-opacity': [
    'transition',
    [
      ['transition-property', 'opacity'],
      ['transition-timing-function', DEFAULT_EASE],
      ['transition-duration', '150ms'],
    ],
  ],
  'transition-shadow': [
    'transition',
    [
      ['transition-property', 'box-shadow'],
      ['transition-timing-function', DEFAULT_EASE],
      ['transition-duration', '150ms'],
    ],
  ],
  'transition-transform': [
    'transition',
    [
      ['transition-property', 'transform'],
      ['transition-timing-function', DEFAULT_EASE],
      ['transition-duration', '150ms'],
    ],
  ],
  'transition-none': ['transition', [['transition-property', 'none']]],
  'ease-linear': ['ease', [['transition-timing-function', 'linear']]],
  'ease-in': ['ease', [['transition-timing-function', 'cubic-bezier(0.4, 0, 1, 1)']]],
  'ease-out': ['ease', [['transition-timing-function', 'cubic-bezier(0, 0, 0.2, 1)']]],
  'ease-in-out': ['ease', [['transition-timing-function', DEFAULT_EASE]]],
  'whitespace-normal': ['whitespace', [['white-space', 'normal']]],
  'whitespace-nowrap': ['whitespace', [['white-space', 'nowrap']]],
  'whitespace-pre': ['whitespace', [['white-space', 'pre']]],
  'whitespace-pre-line': ['whitespace', [['white-space', 'pre-line']]],
  'whitespace-pre-wrap': ['whitespace', [['white-space', 'pre-wrap']]],
  'text-wrap': ['whitespace', [['text-wrap', 'wrap']]],
  'text-nowrap': ['whitespace', [['text-wrap', 'nowrap']]],
  'text-balance': ['whitespace', [['text-wrap', 'balance']]],
  'text-pretty': ['whitespace', [['text-wrap', 'pretty']]],
  'order-first': ['order', [['order', '-9999']]],
  'order-last': ['order', [['order', '9999']]],
  'order-none': ['order', [['order', '0']]],
  'col-auto': ['grid-column', [['grid-column', 'auto']]],
  'col-span-full': ['grid-column', [['grid-column', '1 / -1']]],
  'row-auto': ['grid-row', [['grid-row', 'auto']]],
  'row-span-full': ['grid-row', [['grid-row', '1 / -1']]],
  'grid-cols-none': ['grid-template-columns', [['grid-template-columns', 'none']]],
  'grid-rows-none': ['grid-template-rows', [['grid-template-rows', 'none']]],
  'mx-auto': [
    'margin',
    [
      ['margin-left', 'auto'],
      ['margin-right', 'auto'],
    ],
  ],
};

const ALIGN: Record<string, string> = {
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  baseline: 'baseline',
  stretch: 'stretch',
};
const JUSTIFY: Record<string, string> = {
  normal: 'normal',
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  between: 'space-between',
  around: 'space-around',
  evenly: 'space-evenly',
  stretch: 'stretch',
};
const SELF: Record<string, string> = {
  auto: 'auto',
  start: 'flex-start',
  end: 'flex-end',
  center: 'center',
  stretch: 'stretch',
  baseline: 'baseline',
};
const OVERFLOW = new Set(['auto', 'hidden', 'clip', 'visible', 'scroll']);

const SIDE_PROPS: Record<string, string[]> = {
  '': [''],
  x: ['-left', '-right'],
  y: ['-top', '-bottom'],
  t: ['-top'],
  r: ['-right'],
  b: ['-bottom'],
  l: ['-left'],
  s: ['-inline-start'],
  e: ['-inline-end'],
};

const CORNERS: Record<string, string[]> = {
  t: ['top-left', 'top-right'],
  r: ['top-right', 'bottom-right'],
  b: ['bottom-right', 'bottom-left'],
  l: ['top-left', 'bottom-left'],
  tl: ['top-left'],
  tr: ['top-right'],
  br: ['bottom-right'],
  bl: ['bottom-left'],
};

const GRADIENT_DIRECTIONS: Record<string, string> = {
  t: 'to top',
  tr: 'to top right',
  r: 'to right',
  br: 'to bottom right',
  b: 'to bottom',
  bl: 'to bottom left',
  l: 'to left',
  tl: 'to top left',
};

function resolution(
  family: Family,
  declarations: TailwindDeclaration[],
  sub = 0,
): TailwindUtilityResolution {
  return { declarations, order: orderOf(family, sub) };
}

function sizeValue(key: string, kind: 'w' | 'h'): string | null {
  const keywords: Record<string, string> = {
    auto: 'auto',
    full: '100%',
    screen: kind === 'w' ? '100vw' : '100vh',
    svh: '100svh',
    dvh: '100dvh',
    min: 'min-content',
    max: 'max-content',
    fit: 'fit-content',
  };
  return keywords[key] ?? spacing(key) ?? fraction(key);
}

/**
 * Resolves a variant-free utility (e.g. `px-4`, `text-xl`, `bg-gray-50`) against `theme`.
 * Returns `null` when the utility is unknown or its value is not safe.
 */
export function resolveTailwindUtility(
  utility: string,
  theme: TailwindTheme = createDefaultTailwindTheme(),
  negative = false,
): TailwindUtilityResolution | null {
  if (!utility) return null;

  // Negative values only make sense for offsets/margins/translate/order.
  const withSign = (value: string | null): string | null =>
    value === null ? null : negative ? negate(value) : value;

  if (!negative) {
    const fixed = STATIC_UTILITIES[utility];
    if (fixed) return resolution(fixed[0], [...fixed[1]]);
    if (utility in DISPLAY) return resolution('display', [['display', DISPLAY[utility]]]);
    if (POSITION.has(utility)) return resolution('position', [['position', utility]]);
    if (utility === 'container') {
      return {
        declarations: [['width', '100%']],
        order: orderOf('container'),
        extraMedia: SCREEN_ORDER.map((screen) => ({
          mediaQuery: `(min-width: ${TAILWIND_SCREENS[screen]}px)`,
          declarations: [['max-width', `${TAILWIND_SCREENS[screen]}px`]],
        })),
      };
    }
  }

  let match: RegExpExecArray | null;

  // Margin / padding: m-4, mx-auto, -mt-2, p-[13px]
  if ((match = /^([mp])([xytrblse]?)-(.+)$/.exec(utility))) {
    const [, kind, side, key] = match;
    if (kind === 'p' && negative) return null;
    const prop = kind === 'm' ? 'margin' : 'padding';
    const value = key === 'auto' && kind === 'm' ? 'auto' : withSign(spacing(key));
    if (!value) return null;
    const sub = side === '' ? 0 : side === 'x' || side === 'y' ? 1 : 2;
    return resolution(
      kind === 'm' ? 'margin' : 'padding',
      SIDE_PROPS[side].map((suffix) => [`${prop}${suffix}`, value] as const),
      sub,
    );
  }

  // Inset: top-0, inset-x-0, -left-4, inset-1/2
  if ((match = /^(inset-x|inset-y|inset|top|right|bottom|left|start|end)-(.+)$/.exec(utility))) {
    const [, kind, key] = match;
    const raw = key === 'auto' ? 'auto' : key === 'full' ? '100%' : (spacing(key) ?? fraction(key));
    const value = raw === 'auto' ? (negative ? null : raw) : withSign(raw);
    if (!value) return null;
    const props: Record<string, string[]> = {
      inset: ['top', 'right', 'bottom', 'left'],
      'inset-x': ['left', 'right'],
      'inset-y': ['top', 'bottom'],
      top: ['top'],
      right: ['right'],
      bottom: ['bottom'],
      left: ['left'],
      start: ['inset-inline-start'],
      end: ['inset-inline-end'],
    };
    const sub = kind === 'inset' ? 0 : kind.startsWith('inset-') ? 1 : 2;
    return resolution(
      'inset',
      props[kind].map((p) => [p, value] as const),
      sub,
    );
  }

  // Translate / scale / rotate (standalone transform; combining several is a known gap)
  if ((match = /^translate-([xy])-(.+)$/.exec(utility))) {
    const value = withSign(
      match[2] === 'full' ? '100%' : (spacing(match[2]) ?? fraction(match[2])),
    );
    if (!value) return null;
    return resolution('transform', [['transform', `translate${match[1].toUpperCase()}(${value})`]]);
  }
  if ((match = /^scale(-[xy])?-(\d{1,3})$/.exec(utility))) {
    if (negative) return null;
    const axis = match[1] ? match[1].slice(1).toUpperCase() : '';
    return resolution('transform', [['transform', `scale${axis}(${Number(match[2]) / 100})`]]);
  }
  if ((match = /^rotate-(\d{1,3})$/.exec(utility))) {
    return resolution('transform', [
      ['transform', `rotate(${negative ? '-' : ''}${Number(match[1])}deg)`],
    ]);
  }

  if (negative) {
    if ((match = /^order-(\d+)$/.exec(utility))) {
      return resolution('order', [['order', `-${match[1]}`]]);
    }
    if ((match = /^space-([xy])-(.+)$/.exec(utility))) {
      return resolveSpace(match[1], withSign(spacing(match[2])));
    }
    return null;
  }

  if ((match = /^z-(\d+|auto)$/.exec(utility)))
    return resolution('z-index', [['z-index', match[1]]]);
  if ((match = /^order-(\d+)$/.exec(utility))) return resolution('order', [['order', match[1]]]);
  if ((match = /^opacity-(\d{1,3})$/.exec(utility))) {
    const n = Number(match[1]);
    return n <= 100 ? resolution('opacity', [['opacity', String(n / 100)]]) : null;
  }
  if ((match = /^duration-(\d+)$/.exec(utility))) {
    return resolution('duration', [['transition-duration', `${match[1]}ms`]]);
  }
  if ((match = /^delay-(\d+)$/.exec(utility))) {
    return resolution('duration', [['transition-delay', `${match[1]}ms`]]);
  }

  // Sizing
  if ((match = /^(w|h|size)-(.+)$/.exec(utility))) {
    const [, kind, key] = match;
    const value = sizeValue(key, kind === 'h' ? 'h' : 'w');
    if (!value) return null;
    if (kind === 'size') {
      return resolution('size', [
        ['width', value],
        ['height', value],
      ]);
    }
    return resolution(kind === 'w' ? 'width' : 'height', [
      [kind === 'w' ? 'width' : 'height', value],
    ]);
  }
  if ((match = /^(min|max)-(w|h)-(.+)$/.exec(utility))) {
    const [, bound, axis, key] = match;
    const prop = `${bound}-${axis === 'w' ? 'width' : 'height'}`;
    let value: string | null;
    if (bound === 'max' && axis === 'w') {
      value = MAX_WIDTHS[key] ?? spacing(key);
    } else {
      value = key === 'none' ? 'none' : sizeValue(key, axis as 'w' | 'h');
    }
    if (!value) return null;
    return resolution(prop as Family, [[prop, value]]);
  }
  if ((match = /^basis-(.+)$/.exec(utility))) {
    const value = sizeValue(match[1], 'w');
    return value ? resolution('flex-basis', [['flex-basis', value]]) : null;
  }

  // Flexbox & grid alignment
  if ((match = /^items-(.+)$/.exec(utility)) && ALIGN[match[1]]) {
    return resolution('align-items', [['align-items', ALIGN[match[1]]]]);
  }
  if ((match = /^justify-items-(.+)$/.exec(utility))) {
    const value = { start: 'start', end: 'end', center: 'center', stretch: 'stretch' }[match[1]];
    return value ? resolution('justify-items', [['justify-items', value]]) : null;
  }
  if ((match = /^justify-self-(.+)$/.exec(utility))) {
    const value = {
      auto: 'auto',
      start: 'start',
      end: 'end',
      center: 'center',
      stretch: 'stretch',
    }[match[1]];
    return value ? resolution('justify-self', [['justify-self', value]]) : null;
  }
  if ((match = /^justify-(.+)$/.exec(utility)) && JUSTIFY[match[1]]) {
    return resolution('justify-content', [['justify-content', JUSTIFY[match[1]]]]);
  }
  if ((match = /^content-(.+)$/.exec(utility)) && JUSTIFY[match[1]]) {
    return resolution('align-content', [['align-content', JUSTIFY[match[1]]]]);
  }
  if ((match = /^self-(.+)$/.exec(utility)) && SELF[match[1]]) {
    return resolution('align-self', [['align-self', SELF[match[1]]]]);
  }
  if ((match = /^place-items-(start|end|center|stretch|baseline)$/.exec(utility))) {
    return resolution('align-items', [['place-items', match[1]]]);
  }
  if ((match = /^place-content-(start|end|center|between|around|evenly|stretch)$/.exec(utility))) {
    return resolution('align-content', [['place-content', JUSTIFY[match[1]] ?? match[1]]]);
  }
  if ((match = /^gap(-[xy])?-(.+)$/.exec(utility))) {
    const value = spacing(match[2]);
    if (!value) return null;
    const prop = match[1] === '-x' ? 'column-gap' : match[1] === '-y' ? 'row-gap' : 'gap';
    return resolution('gap', [[prop, value]], match[1] ? 1 : 0);
  }
  if ((match = /^space-([xy])-(.+)$/.exec(utility))) {
    return resolveSpace(match[1], spacing(match[2]));
  }
  if ((match = /^grid-(cols|rows)-(\d{1,2})$/.exec(utility))) {
    const n = Number(match[2]);
    if (n < 1 || n > 12) return null;
    const prop = match[1] === 'cols' ? 'grid-template-columns' : 'grid-template-rows';
    return resolution(prop as Family, [[prop, `repeat(${n}, minmax(0, 1fr))`]]);
  }
  if ((match = /^(col|row)-span-(\d{1,2})$/.exec(utility))) {
    const prop = match[1] === 'col' ? 'grid-column' : 'grid-row';
    return resolution(prop as Family, [[prop, `span ${match[2]} / span ${match[2]}`]]);
  }
  if ((match = /^(col|row)-(start|end)-(\d{1,2}|auto)$/.exec(utility))) {
    const prop = `grid-${match[1] === 'col' ? 'column' : 'row'}-${match[2]}`;
    return resolution(match[1] === 'col' ? 'grid-column' : 'grid-row', [[prop, match[3]]], 1);
  }

  // Overflow
  if ((match = /^overflow(-[xy])?-(.+)$/.exec(utility)) && OVERFLOW.has(match[2])) {
    return resolution('overflow', [[`overflow${match[1] ?? ''}`, match[2]]], match[1] ? 1 : 0);
  }

  // Border radius: rounded, rounded-lg, rounded-t-xl, rounded-[10px]
  if ((match = /^rounded(?:-(t|r|b|l|tl|tr|br|bl))?(?:-(.+))?$/.exec(utility))) {
    const [, side, key = ''] = match;
    const value = RADII[key] ?? (key ? parseArbitraryValue(key) : null);
    if (!value || (key.startsWith('[') && !isLengthLike(value))) return null;
    const props = side
      ? CORNERS[side].map((corner) => `border-${corner}-radius`)
      : ['border-radius'];
    return resolution(
      'border-radius',
      props.map((p) => [p, value] as const),
      side ? (side.length === 1 ? 1 : 2) : 0,
    );
  }

  // Border width / color: border, border-2, border-t, border-x-4, border-gray-300
  if ((match = /^border(?:-([xytrbl]))?(?:-(0|2|4|8|\[.+\]))?$/.exec(utility))) {
    const [, side = '', key] = match;
    const width =
      key === undefined ? '1px' : key.startsWith('[') ? parseArbitraryValue(key) : `${key}px`;
    if (width && isLengthLike(width)) {
      const suffixes = SIDE_PROPS[side];
      return resolution(
        'border-width',
        [
          ...suffixes.map((s) => [`border${s}-width`, width] as const),
          ...suffixes.map((s) => [`border${s}-style`, 'solid'] as const),
          ['border-color', DEFAULT_BORDER_COLOR],
        ],
        side === '' ? 0 : side === 'x' || side === 'y' ? 1 : 2,
      );
    }
  }
  if ((match = /^border-([xytrbl]-)?(.+)$/.exec(utility))) {
    const value = color(match[2], theme);
    if (!value) return null;
    const side = match[1] ? match[1].slice(0, -1) : '';
    return resolution(
      'border-color',
      SIDE_PROPS[side].map((s) => [`border${s}-color`, value] as const),
      side ? 1 : 0,
    );
  }

  // Background: gradients and colors
  if ((match = /^bg-gradient-to-(t|tr|r|br|b|bl|l|tl)$/.exec(utility))) {
    return resolution('background-image', [
      [
        'background-image',
        `linear-gradient(${GRADIENT_DIRECTIONS[match[1]]}, var(--tw-gradient-stops))`,
      ],
    ]);
  }
  if ((match = /^(from|via|to)-(.+)$/.exec(utility))) {
    const value = color(match[2], theme);
    if (!value) return null;
    if (match[1] === 'from') {
      return resolution('gradient-stops', [
        ['--tw-gradient-from', value],
        ['--tw-gradient-to', transparentOf(value)],
        ['--tw-gradient-stops', 'var(--tw-gradient-from), var(--tw-gradient-to)'],
      ]);
    }
    if (match[1] === 'via') {
      return resolution(
        'gradient-stops',
        [
          ['--tw-gradient-to', transparentOf(value)],
          ['--tw-gradient-stops', `var(--tw-gradient-from), ${value}, var(--tw-gradient-to)`],
        ],
        1,
      );
    }
    return resolution('gradient-stops', [['--tw-gradient-to', value]], 2);
  }
  if ((match = /^bg-(.+)$/.exec(utility))) {
    const value = color(match[1], theme);
    return value ? resolution('background-color', [['background-color', value]]) : null;
  }

  // Typography
  if ((match = /^text-(left|center|right|justify|start|end)$/.exec(utility))) {
    return resolution('text-align', [['text-align', match[1]]]);
  }
  if ((match = /^text-(.+)$/.exec(utility))) {
    const key = match[1];
    const size = FONT_SIZES[key];
    if (size) {
      return resolution('font-size', [
        ['font-size', size[0]],
        ['line-height', size[1]],
      ]);
    }
    const arbitrary = parseArbitraryValue(key);
    if (arbitrary && isLengthLike(arbitrary)) {
      return resolution('font-size', [['font-size', arbitrary]]);
    }
    const value = color(key, theme);
    return value ? resolution('text-color', [['color', value]]) : null;
  }
  if ((match = /^font-(.+)$/.exec(utility))) {
    const key = match[1];
    if (FONT_WEIGHTS[key]) return resolution('font-weight', [['font-weight', FONT_WEIGHTS[key]]]);
    if (theme.fontFamily[key])
      return resolution('font-family', [['font-family', theme.fontFamily[key]]]);
    const arbitrary = parseArbitraryValue(key);
    if (arbitrary && /^\d{3}$/.test(arbitrary))
      return resolution('font-weight', [['font-weight', arbitrary]]);
    return null;
  }
  if ((match = /^leading-(.+)$/.exec(utility))) {
    const value = LINE_HEIGHTS[match[1]] ?? parseArbitraryValue(match[1]);
    return value ? resolution('line-height', [['line-height', value]]) : null;
  }
  if ((match = /^tracking-(.+)$/.exec(utility))) {
    const value = LETTER_SPACING[match[1]] ?? parseArbitraryValue(match[1]);
    return value ? resolution('letter-spacing', [['letter-spacing', value]]) : null;
  }

  // Shadow
  if ((match = /^shadow(?:-(.+))?$/.exec(utility))) {
    const value = SHADOWS[match[1] ?? ''];
    return value ? resolution('box-shadow', [['box-shadow', value]]) : null;
  }

  return null;
}

function resolveSpace(axis: string, value: string | null): TailwindUtilityResolution | null {
  if (!value) return null;
  return {
    declarations: [[axis === 'x' ? 'margin-left' : 'margin-top', value]],
    order: orderOf('space'),
    childSelector: ' > :not([hidden]) ~ :not([hidden])',
  };
}

// ---------------------------------------------------------------------------
// Class parsing & mapping
// ---------------------------------------------------------------------------

/** Splits a class token into variants and utility (`md:hover:bg-x` → `[md, hover]`, `bg-x`). */
export function parseTailwindClass(token: string): ParsedTailwindClass {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of token) {
    if (ch === '[') depth++;
    if (ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ':' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  parts.push(current);
  let utility = parts.pop() ?? '';
  let important = false;
  if (utility.startsWith('!')) {
    important = true;
    utility = utility.slice(1);
  } else if (utility.endsWith('!')) {
    important = true;
    utility = utility.slice(0, -1);
  }
  let negative = false;
  if (utility.startsWith('-')) {
    negative = true;
    utility = utility.slice(1);
  }
  return { token, variants: parts, utility, important, negative };
}

/** Builds a selector matching elements whose `class` contains `token` (class specificity). */
export function tailwindClassSelector(token: string): string {
  return `[class~="${token.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
}

function variantMedia(variant: string): { query: string; order: number } | null {
  if (variant in TAILWIND_SCREENS) {
    return {
      query: `(min-width: ${TAILWIND_SCREENS[variant]}px)`,
      order: SCREEN_ORDER.indexOf(variant) + 1,
    };
  }
  const max = /^max-(sm|md|lg|xl|2xl)$/.exec(variant);
  if (max) {
    return {
      query: `(max-width: ${TAILWIND_SCREENS[max[1]] - 1}px)`,
      order: 10 - SCREEN_ORDER.indexOf(max[1]),
    };
  }
  return null;
}

/**
 * Maps a full class token (with variants) to CSS rules, or explains why it cannot be mapped.
 * Responsive variants become `min-width` media queries; state variants become pseudo-classes.
 */
export function mapTailwindClass(
  token: string,
  theme: TailwindTheme = createDefaultTailwindTheme(),
): TailwindClassMapping {
  if (token.length > 120) return { ok: false, reason: 'class name too long' };
  const parsed = parseTailwindClass(token);
  let media: { query: string; order: number } | null = null;
  let state: string | undefined;
  for (const variant of parsed.variants) {
    const asMedia = variantMedia(variant);
    if (asMedia && !media) {
      media = asMedia;
    } else if (STATE_VARIANTS[variant] && !state) {
      state = STATE_VARIANTS[variant];
    } else {
      return { ok: false, reason: `unsupported variant "${variant}:"` };
    }
  }
  if (media && state) {
    return { ok: false, reason: 'responsive and state variants cannot be combined' };
  }
  if (parsed.utility.startsWith('[')) {
    return { ok: false, reason: 'arbitrary properties are not supported' };
  }

  const resolved = resolveTailwindUtility(parsed.utility, theme, parsed.negative);
  if (!resolved) return { ok: false, reason: 'unknown utility or unsupported value' };
  if (resolved.childSelector && state) {
    return { ok: false, reason: 'state variants on child utilities are not supported' };
  }
  if (resolved.extraMedia && (media || state)) {
    return { ok: false, reason: 'variants on container are not supported' };
  }

  const toDecls = (decls: readonly TailwindDeclaration[]): ParsedCssDeclaration[] =>
    decls.map(([property, value]) => ({ property, value, important: parsed.important }));
  const selector = `${tailwindClassSelector(token)}${state ?? ''}${resolved.childSelector ?? ''}`;
  const rules: Extract<TailwindClassMapping, { ok: true }>['rules'] = [
    {
      selector,
      ...(media ? { mediaQuery: media.query } : {}),
      declarations: toDecls(resolved.declarations),
      variantOrder: media?.order ?? 0,
      order: resolved.order,
    },
  ];
  for (const extra of resolved.extraMedia ?? []) {
    const screen = /min-width: (\d+)px/.exec(extra.mediaQuery);
    const width = screen ? Number(screen[1]) : 0;
    const screenName = Object.keys(TAILWIND_SCREENS).find((s) => TAILWIND_SCREENS[s] === width);
    rules.push({
      selector,
      mediaQuery: extra.mediaQuery,
      declarations: toDecls(extra.declarations),
      variantOrder: screenName ? SCREEN_ORDER.indexOf(screenName) + 1 : 0,
      order: resolved.order,
    });
  }
  return { ok: true, rules };
}

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const TAILWIND_SCRIPT_SRC =
  /(^|\/\/|\.)cdn\.tailwindcss\.com|@tailwindcss\/browser|\/tailwindcss(@[^/]*)?\/(dist|lib|src)\/[^?#]*\.js/i;

function isTag(node: TreeNode): node is TreeElement {
  return typeof (node as { tagName?: unknown }).tagName === 'string';
}

function attr(element: TreeElement, name: string): string | undefined {
  return element.attrs?.find((a) => a.name.toLowerCase() === name)?.value;
}

function childNodesOf(node: TreeNode): TreeNode[] {
  const withChildren = node as { childNodes?: TreeNode[]; content?: { childNodes?: TreeNode[] } };
  return withChildren.childNodes ?? withChildren.content?.childNodes ?? [];
}

function textOf(node: TreeNode): string {
  if ((node as { nodeName?: string }).nodeName === '#text') {
    return (node as { value?: string }).value ?? '';
  }
  return childNodesOf(node).map(textOf).join('');
}

function walk(node: TreeNode, visit: (element: TreeElement) => void): void {
  const stack: TreeNode[] = [node];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (isTag(current)) visit(current);
    const children = childNodesOf(current);
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
}

/**
 * Looks for Tailwind usage signals in the raw HTML tree. Must run before sanitization,
 * which strips the `<script>` elements carrying them.
 */
export function detectTailwind(root: TreeNode): TailwindDetection {
  const detection: TailwindDetection = { cdn: false, configSources: [] };
  walk(root, (element) => {
    const tag = element.tagName.toLowerCase();
    if (tag === 'script') {
      const src = attr(element, 'src');
      if (src && TAILWIND_SCRIPT_SRC.test(src.trim())) detection.cdn = true;
      if (!src) {
        const text = textOf(element);
        if (/\btailwind\.config\s*=/.test(text)) detection.configSources.push(text);
      }
    } else if (
      tag === 'style' &&
      (attr(element, 'type') ?? '').toLowerCase() === 'text/tailwindcss'
    ) {
      detection.cdn = true;
    }
  });
  return detection;
}

const SIGNATURE_PATTERN = new RegExp(
  `^(?:(?:sm|md|lg|xl|2xl|hover|focus):.+|(?:bg|text|border|from|via|to)-(?:${Object.keys(PALETTE).join('|')})-(?:50|[1-9]00|950)(?:/\\d+)?)$`,
);

/** Minimum distinct signature classes for `'auto'` mode without an explicit Tailwind script. */
export const TAILWIND_SIGNATURE_THRESHOLD = 5;

/** Counts class tokens that are distinctly Tailwind (variant prefixes, palette shades). */
export function countTailwindSignatureClasses(tokens: Iterable<string>): number {
  let count = 0;
  for (const token of tokens) {
    if (SIGNATURE_PATTERN.test(token) && mapTailwindClass(token).ok) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// tailwind.config (static subset)
// ---------------------------------------------------------------------------

type ConfigValue = string | number | boolean | ConfigValue[] | { [key: string]: ConfigValue };

/**
 * Parses the object literal assigned to `tailwind.config` without executing it. Only plain
 * data is accepted (object/array literals, strings, numbers, booleans, identifier keys);
 * functions, spreads, references and calls make the whole config unsupported (`null`).
 */
export function parseTailwindConfigSource(source: string): Record<string, ConfigValue> | null {
  const start = /\btailwind\.config\s*=\s*/.exec(source);
  if (!start || source.length > 50_000) return null;
  const text = source.slice(start.index + start[0].length);
  let pos = 0;

  const skip = () => {
    for (;;) {
      const rest = text.slice(pos);
      const ws = /^(\s+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/.exec(rest);
      if (!ws) return;
      pos += ws[0].length;
    }
  };
  const fail = (): never => {
    throw new Error('unsupported');
  };
  const parseString = (): string => {
    const quote = text[pos];
    let out = '';
    pos++;
    while (pos < text.length && text[pos] !== quote) {
      if (text[pos] === '\\' || text[pos] === '\n') fail();
      out += text[pos++];
    }
    if (text[pos] !== quote) fail();
    pos++;
    return out;
  };
  const parseValue = (depth: number): ConfigValue => {
    if (depth > 8) fail();
    skip();
    const ch = text[pos];
    if (ch === '{') {
      pos++;
      const obj: Record<string, ConfigValue> = {};
      for (;;) {
        skip();
        if (text[pos] === '}') {
          pos++;
          return obj;
        }
        let key: string;
        if (text[pos] === '"' || text[pos] === "'") {
          key = parseString();
        } else {
          const ident = /^[A-Za-z_$][\w$-]*|^\d+/.exec(text.slice(pos));
          if (!ident) fail();
          key = ident![0];
          pos += key.length;
        }
        skip();
        if (text[pos] !== ':') fail();
        pos++;
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') fail();
        obj[key] = parseValue(depth + 1);
        skip();
        if (text[pos] === ',') pos++;
        else if (text[pos] !== '}') fail();
      }
    }
    if (ch === '[') {
      pos++;
      const arr: ConfigValue[] = [];
      for (;;) {
        skip();
        if (text[pos] === ']') {
          pos++;
          return arr;
        }
        arr.push(parseValue(depth + 1));
        skip();
        if (text[pos] === ',') pos++;
        else if (text[pos] !== ']') fail();
      }
    }
    if (ch === '"' || ch === "'") return parseString();
    const literal = /^(-?\d+(\.\d+)?|true|false)/.exec(text.slice(pos));
    if (literal) {
      pos += literal[0].length;
      return literal[0] === 'true' ? true : literal[0] === 'false' ? false : Number(literal[0]);
    }
    return fail();
  };

  try {
    const value = parseValue(0);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

const CONFIG_COLOR_PATTERN = /^(#[0-9a-f]{3,8}|(rgb|rgba|hsl|hsla)\([0-9.,%\s/deg]+\)|[a-z]+)$/i;

function isPlainObject(value: unknown): value is Record<string, ConfigValue> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function flattenColors(
  value: Record<string, ConfigValue>,
  prefix: string,
  out: Record<string, string>,
  isSafe: (value: string) => boolean,
): void {
  for (const [key, raw] of Object.entries(value)) {
    const name = key === 'DEFAULT' ? prefix : prefix ? `${prefix}-${key}` : key;
    if (!name) continue;
    if (typeof raw === 'string') {
      if (CONFIG_COLOR_PATTERN.test(raw.trim()) && isSafe(raw)) out[name] = raw.trim();
    } else if (isPlainObject(raw)) {
      flattenColors(raw, name, out, isSafe);
    }
  }
}

function fontStack(value: ConfigValue): string | null {
  const list = Array.isArray(value) ? value : typeof value === 'string' ? [value] : null;
  if (!list) return null;
  const names: string[] = [];
  for (const item of list) {
    if (typeof item !== 'string' || !/^[\w\s-]{1,60}$/.test(item.trim())) return null;
    const name = item.trim();
    names.push(/\s/.test(name) ? `"${name}"` : name);
  }
  return names.length > 0 ? names.join(', ') : null;
}

/**
 * Applies the supported, static parts of a parsed `tailwind.config` (`theme.colors`,
 * `theme.fontFamily` and their `theme.extend` counterparts) to `theme`.
 * Returns the theme keys that were present but are not supported.
 */
export function applyTailwindConfig(
  theme: TailwindTheme,
  config: Record<string, ConfigValue>,
  isSafe: (value: string) => boolean = () => true,
): string[] {
  const unsupported: string[] = [];
  const themeConfig = config.theme;
  if (!isPlainObject(themeConfig)) return unsupported;

  const apply = (section: Record<string, ConfigValue>, extend: boolean, path: string) => {
    for (const [key, value] of Object.entries(section)) {
      if (key === 'extend' && !extend) continue;
      if (key === 'colors' && isPlainObject(value)) {
        if (!extend) theme.colors = { ...SPECIAL_COLORS };
        flattenColors(value, '', theme.colors, isSafe);
      } else if (key === 'fontFamily' && isPlainObject(value)) {
        if (!extend) theme.fontFamily = {};
        for (const [name, stack] of Object.entries(value)) {
          const css = fontStack(stack);
          if (css && isSafe(css)) theme.fontFamily[name] = css;
        }
      } else {
        unsupported.push(`${path}${key}`);
      }
    }
  };
  apply(themeConfig, false, 'theme.');
  if (isPlainObject(themeConfig.extend)) apply(themeConfig.extend, true, 'theme.extend.');
  return unsupported;
}

// ---------------------------------------------------------------------------
// Bundle integration
// ---------------------------------------------------------------------------

/** Input for `buildTailwindRules`. */
export interface BuildTailwindRulesParams {
  /** Sanitized HTML tree whose `class` attributes are mapped. */
  root: TreeNode;
  /** Detection result recorded before sanitization. */
  detection?: TailwindDetection;
  mode?: TailwindMode;
  /** Rules already in the bundle; classes they define are left to them. */
  existingRules: readonly ParsedCssRule[];
  sourceOrderStart: number;
  report?: HtmlImportReport;
  /** Declaration-level safety check (the stylesheet pipeline's `isDangerousDeclaration`). */
  isSafeDeclaration: (property: string, value: string) => boolean;
}

function collectClassTokens(root: TreeNode): Set<string> {
  const tokens = new Set<string>();
  walk(root, (element) => {
    const cls = attr(element, 'class');
    if (!cls) return;
    for (const token of cls.split(/\s+/)) {
      if (token) tokens.add(token);
    }
  });
  return tokens;
}

function collectStylesheetClassNames(rules: readonly ParsedCssRule[]): Set<string> {
  const names = new Set<string>();
  const pattern = /\.((?:\\.|[\w-])+)/g;
  for (const rule of rules) {
    for (const match of rule.selector.matchAll(pattern)) {
      names.add(match[1].replace(/\\(.)/g, '$1'));
    }
  }
  return names;
}

function reportClass(report: HtmlImportReport | undefined, token: string, reason: string): void {
  if (!report) return;
  addDiagnostic(report, {
    code: 'CSS_UNSUPPORTED_SELECTOR',
    severity: 'info',
    message: `Tailwind class "${token}" was not mapped: ${reason}`,
    location: { selector: `.${token}` },
    details: { source: 'tailwind', className: token, reason },
  });
}

/**
 * Translates the Tailwind classes used in `root` into CSS rules appended after the existing
 * stylesheet rules (Tailwind's utilities layer comes last). Returns no rules when Tailwind is
 * disabled or not detected. Every unmapped class is reported once per import as
 * `CSS_UNSUPPORTED_SELECTOR` (info, `details.source = 'tailwind'`).
 */
export function buildTailwindRules(params: BuildTailwindRulesParams): {
  rules: ParsedCssRule[];
  nextSourceOrder: number;
  applied: boolean;
} {
  const { root, detection, existingRules, report, isSafeDeclaration } = params;
  const mode = params.mode ?? 'auto';
  const empty = { rules: [], nextSourceOrder: params.sourceOrderStart, applied: false };
  if (mode === false || !root) return empty;

  const definedByStylesheets = collectStylesheetClassNames(existingRules);
  const tokens = [...collectClassTokens(root)].filter((t) => !definedByStylesheets.has(t));

  const detected =
    mode === true ||
    Boolean(detection?.cdn) ||
    (detection?.configSources.length ?? 0) > 0 ||
    countTailwindSignatureClasses(tokens) >= TAILWIND_SIGNATURE_THRESHOLD;
  if (!detected) return empty;

  const theme = createDefaultTailwindTheme();
  for (const source of detection?.configSources ?? []) {
    const config = parseTailwindConfigSource(source);
    if (!config) {
      if (report) {
        addDiagnostic(report, {
          code: 'CSS_UNSUPPORTED_PROPERTY',
          severity: 'warning',
          message:
            'tailwind.config is not a static object literal and was ignored (it is never executed)',
          details: { source: 'tailwind' },
        });
      }
      continue;
    }
    const unsupported = applyTailwindConfig(theme, config, (v) => isSafeDeclaration('color', v));
    if (unsupported.length > 0 && report) {
      addDiagnostic(report, {
        code: 'CSS_UNSUPPORTED_PROPERTY',
        severity: 'info',
        message: `tailwind.config keys not supported (only colors and fontFamily are read): ${unsupported.join(', ')}`,
        details: { source: 'tailwind', keys: unsupported },
      });
    }
  }

  const pending: Array<
    Extract<TailwindClassMapping, { ok: true }>['rules'][number] & { token: string }
  > = [];
  for (const token of tokens) {
    if (MARKER_CLASSES.has(token)) continue;
    const mapping = mapTailwindClass(token, theme);
    if (!mapping.ok) {
      reportClass(report, token, mapping.reason);
      continue;
    }
    const unsafe = mapping.rules.some((rule) =>
      rule.declarations.some((d) => !isSafeDeclaration(d.property, d.value)),
    );
    if (unsafe) {
      reportClass(report, token, 'unsafe value');
      continue;
    }
    for (const rule of mapping.rules) pending.push({ ...rule, token });
  }

  pending.sort(
    (a, b) =>
      a.variantOrder - b.variantOrder ||
      a.order - b.order ||
      (a.token < b.token ? -1 : a.token > b.token ? 1 : 0),
  );

  let order = params.sourceOrderStart;
  const rules: ParsedCssRule[] = pending.map((rule) => ({
    selector: rule.selector,
    ...(rule.mediaQuery ? { mediaQuery: rule.mediaQuery } : {}),
    declarations: rule.declarations,
    sourceOrder: order++,
  }));
  return { rules, nextSourceOrder: order, applied: true };
}
