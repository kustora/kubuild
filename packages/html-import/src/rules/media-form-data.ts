/**
 * @kubuild/html-import
 * Default mapping rules for media, form, list, and table elements (STORA-610).
 *
 * Supported elements:
 * - Media:
 *   - img, picture -> image
 *   - video, iframe (YouTube/Vimeo) -> video
 *   - svg -> icon
 * - Form:
 *   - form -> form
 *   - input (submit/button -> button/button-submit, checkbox -> checkbox, radio -> radio, other -> input)
 *   - textarea -> textarea
 *   - select -> select (with extracted options)
 *   - button (submit -> button-submit, other -> button)
 *   - label -> checkbox/radio unwrapper or text
 *   - a (with button styling heuristic) -> button
 * - List:
 *   - ul, ol -> list
 *   - li -> list-item
 * - Table:
 *   - table -> table (flattening thead/tbody/tfoot rows)
 *   - tr -> table-row
 *   - td, th -> table-cell
 */

import { serialize, type DefaultTreeAdapterMap } from 'parse5';
import { isSafeUrl } from '@kubuild/core';
import {
  addDiagnostic,
  type PageNode,
} from '../types.js';
import { isElement } from '../sanitizer.js';
import {
  getAttribute,
  hasAttribute,
  getTextContent,
} from '../parser.js';
import { buildResponsiveStyles } from '../responsive.js';
import { collapseWhitespace } from './layout-typography.js';
import { handleFallbackElement } from './fallback.js';
import type {
  HtmlMappingRule,
  Parse5DocumentFragment,
} from './types.js';

/**
 * Candidate item parsed from a srcset attribute.
 */
export interface SrcsetCandidate {
  url: string;
  weight: number;
}

/**
 * Parses an HTML srcset attribute into an array of candidates with calculated resolution weights.
 *
 * Supports width descriptors (e.g. '1200w' -> 1200) and pixel density descriptors (e.g. '2x' -> 2000).
 * Candidates without descriptors receive weight 1.
 */
export function parseSrcset(srcset: string): SrcsetCandidate[] {
  if (!srcset || typeof srcset !== 'string') {
    return [];
  }
  const candidates: SrcsetCandidate[] = [];
  const parts = srcset.split(/\s*,\s*/);

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    const url = tokens[0];
    if (!url) continue;

    let weight = 1;
    if (tokens.length > 1) {
      const descriptor = tokens[1].toLowerCase();
      if (descriptor.endsWith('w')) {
        const parsed = parseInt(descriptor.slice(0, -1), 10);
        if (!Number.isNaN(parsed)) weight = parsed;
      } else if (descriptor.endsWith('x')) {
        const parsed = parseFloat(descriptor.slice(0, -1));
        if (!Number.isNaN(parsed)) weight = Math.round(parsed * 1000);
      }
    }
    candidates.push({ url, weight });
  }

  return candidates;
}

/**
 * Picks the highest resolution / best candidate URL from an HTML srcset attribute.
 */
export function pickBestSrcsetCandidate(srcset: string): string | undefined {
  const candidates = parseSrcset(srcset);
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => b.weight - a.weight);
  return candidates[0].url;
}

/**
 * Determines whether a URL points to an embeddable YouTube or Vimeo video.
 */
export function isYouTubeOrVimeoUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase();
  return (
    lower.includes('youtube.com') ||
    lower.includes('youtube-nocookie.com') ||
    lower.includes('youtu.be') ||
    lower.includes('vimeo.com') ||
    lower.includes('player.vimeo.com')
  );
}

/**
 * Checks whether an element's class list contains button-related class names.
 */
export function hasButtonClass(className: string | undefined): boolean {
  if (!className) return false;
  const tokens = className.toLowerCase().split(/\s+/);
  return tokens.some((token) => {
    if (token === 'btn' || token === 'button') return true;
    if (token.startsWith('btn-') || token.startsWith('button-')) return true;
    if (token.endsWith('-btn') || token.endsWith('-button')) return true;
    if (token.includes('btn') || token.includes('button')) return true;
    return false;
  });
}

/**
 * Checks whether computed styles have a non-transparent, visible background color.
 */
export function hasVisibleBackgroundColor(styles?: Record<string, string | number>): boolean {
  if (!styles) return false;
  const bg = String(styles.backgroundColor ?? styles.background ?? '').trim().toLowerCase();
  if (!bg) return false;
  if (
    bg === 'transparent' ||
    bg === 'rgba(0, 0, 0, 0)' ||
    bg === 'rgba(0,0,0,0)' ||
    bg === 'inherit' ||
    bg === 'initial' ||
    bg === 'none'
  ) {
    return false;
  }
  return true;
}

/**
 * Checks whether computed styles have non-zero padding.
 */
export function hasVisiblePadding(styles?: Record<string, string | number>): boolean {
  if (!styles) return false;
  const p =
    styles.padding ??
    styles.paddingTop ??
    styles.paddingBottom ??
    styles.paddingLeft ??
    styles.paddingRight;
  if (p === undefined || p === null) return false;
  const str = String(p).trim().toLowerCase();
  if (!str || str === '0' || str === '0px' || str === '0rem' || str === '0em') {
    return false;
  }
  return true;
}

/**
 * Mapping rule for <img> elements -> image component.
 */
export const imgRule: HtmlMappingRule = {
  id: 'image',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'img',
  convert: (element, context, computed) => {
    const rawSrc = getAttribute(element, 'src') ?? '';
    const srcset = getAttribute(element, 'srcset');
    let bestSrc = rawSrc;

    if (srcset) {
      const candidate = pickBestSrcsetCandidate(srcset);
      if (candidate) {
        bestSrc = candidate;
      }
    }

    if (bestSrc && !isSafeUrl(bestSrc, { allowDataImage: true })) {
      addDiagnostic(context.report, {
        code: 'URL_BLOCKED',
        severity: 'warning',
        message: `Unsafe or disallowed URL scheme in image src="${bestSrc}" was blocked`,
        location: {
          tagName: 'img',
          line: element.sourceCodeLocation?.startLine,
          column: element.sourceCodeLocation?.startCol,
        },
        details: { url: bestSrc, attribute: 'src' },
      });
      bestSrc = '';
    }

    const alt = getAttribute(element, 'alt') ?? '';
    const loadingRaw = getAttribute(element, 'loading')?.toLowerCase();
    const loading: 'lazy' | 'eager' = loadingRaw === 'eager' ? 'eager' : 'lazy';
    const idAttr = getAttribute(element, 'id');
    const title = getAttribute(element, 'title');
    const width = getAttribute(element, 'width');
    const height = getAttribute(element, 'height');

    const props: Record<string, unknown> = {
      src: bestSrc,
      alt,
      loading,
    };
    if (title) props.title = title;
    if (idAttr) props.id = idAttr;
    if (width) props.width = Number(width) || width;
    if (height) props.height = Number(height) || height;

    return {
      id: context.generateId('image'),
      type: 'image',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <picture> elements -> image component.
 * Inspects inner <source srcset="..."> and <img> to pick the highest resolution candidate.
 */
export const pictureRule: HtmlMappingRule = {
  id: 'picture',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'picture',
  convert: (element, context, computed) => {
    let bestSrc = '';
    let maxWeight = -1;
    let alt = '';
    let loading: 'lazy' | 'eager' = 'lazy';
    let idAttr = getAttribute(element, 'id');

    for (const child of element.childNodes) {
      if (!isElement(child)) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'source') {
        const srcset = getAttribute(child, 'srcset');
        if (srcset) {
          const candidates = parseSrcset(srcset);
          for (const cand of candidates) {
            if (cand.weight > maxWeight) {
              maxWeight = cand.weight;
              bestSrc = cand.url;
            }
          }
        } else {
          const s = getAttribute(child, 'src');
          if (s && maxWeight < 1) {
            maxWeight = 1;
            bestSrc = s;
          }
        }
      } else if (tag === 'img') {
        const a = getAttribute(child, 'alt');
        if (a !== undefined) alt = a;
        const l = getAttribute(child, 'loading')?.toLowerCase();
        if (l === 'eager') loading = 'eager';
        if (!idAttr) idAttr = getAttribute(child, 'id');

        const srcset = getAttribute(child, 'srcset');
        if (srcset) {
          const candidates = parseSrcset(srcset);
          for (const cand of candidates) {
            if (cand.weight > maxWeight) {
              maxWeight = cand.weight;
              bestSrc = cand.url;
            }
          }
        }
        const s = getAttribute(child, 'src');
        if (s && (!bestSrc || maxWeight <= 1)) {
          bestSrc = s;
          maxWeight = 1;
        }
      }
    }

    if (bestSrc && !isSafeUrl(bestSrc, { allowDataImage: true })) {
      addDiagnostic(context.report, {
        code: 'URL_BLOCKED',
        severity: 'warning',
        message: `Unsafe or disallowed URL scheme in picture source src="${bestSrc}" was blocked`,
        location: {
          tagName: 'picture',
          line: element.sourceCodeLocation?.startLine,
          column: element.sourceCodeLocation?.startCol,
        },
        details: { url: bestSrc, attribute: 'srcset' },
      });
      bestSrc = '';
    }

    const props: Record<string, unknown> = {
      src: bestSrc,
      alt,
      loading,
    };
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('image'),
      type: 'image',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <video> elements -> video component.
 * Supports direct src attribute as well as nested <source src="..."> elements.
 */
export const videoRule: HtmlMappingRule = {
  id: 'video',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'video',
  convert: (element, context, computed) => {
    let src = getAttribute(element, 'src') ?? '';
    if (!src) {
      for (const child of element.childNodes) {
        if (isElement(child) && child.tagName.toLowerCase() === 'source') {
          const s = getAttribute(child, 'src');
          if (s) {
            src = s;
            break;
          }
        }
      }
    }

    if (src && !isSafeUrl(src)) {
      addDiagnostic(context.report, {
        code: 'URL_BLOCKED',
        severity: 'warning',
        message: `Unsafe or disallowed URL scheme in video src="${src}" was blocked`,
        location: {
          tagName: 'video',
          line: element.sourceCodeLocation?.startLine,
          column: element.sourceCodeLocation?.startCol,
        },
        details: { url: src, attribute: 'src' },
      });
      src = '';
    }

    const poster = getAttribute(element, 'poster');
    const idAttr = getAttribute(element, 'id');
    const title = getAttribute(element, 'title');

    const props: Record<string, unknown> = {
      src,
      controls: hasAttribute(element, 'controls'),
      autoplay: hasAttribute(element, 'autoplay'),
      loop: hasAttribute(element, 'loop'),
      muted: hasAttribute(element, 'muted'),
    };
    if (poster) props.poster = poster;
    if (title) props.title = title;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('video'),
      type: 'video',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for YouTube and Vimeo <iframe> elements -> video component.
 * Non-YouTube/Vimeo iframes do not match and are left for fallback embed (STORA-611).
 */
export const iframeRule: HtmlMappingRule = {
  id: 'iframe-video',
  priority: 55,
  match: (element) => {
    if (element.tagName.toLowerCase() !== 'iframe') return false;
    const src = getAttribute(element, 'src') ?? '';
    return isYouTubeOrVimeoUrl(src);
  },
  convert: (element, context, computed) => {
    const src = getAttribute(element, 'src') ?? '';
    const title = getAttribute(element, 'title') ?? 'Video player';
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {
      src,
      title,
    };
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('video'),
      type: 'video',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <form> elements -> form component.
 * Records diagnostic info if action is present since external actions cannot be automatically executed.
 */
export const formRule: HtmlMappingRule = {
  id: 'form',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'form',
  convert: (element, context, computed) => {
    const action = getAttribute(element, 'action');
    const method = (getAttribute(element, 'method') ?? 'POST').toUpperCase();
    const idAttr = getAttribute(element, 'id');

    if (action !== undefined) {
      addDiagnostic(context.report, {
        code: 'URL_BLOCKED',
        severity: 'info',
        message: `form action not automatically executable: external action "${action}" must be configured in host application`,
        location: {
          tagName: 'form',
          line: element.sourceCodeLocation?.startLine,
          column: element.sourceCodeLocation?.startCol,
        },
        details: { action },
      });
    }

    const props: Record<string, unknown> = {
      method,
    };
    if (action) props.action = action;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('form'),
      type: 'form',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: context.convertChildren(element),
    };
  },
};

/**
 * Mapping rule for <input> elements.
 * Maps submit/button types to button/button-submit, checkbox to checkbox, radio to radio,
 * and text-like types to input.
 */
export const inputRule: HtmlMappingRule = {
  id: 'input',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'input',
  convert: (element, context, computed) => {
    const type = (getAttribute(element, 'type') ?? 'text').toLowerCase();
    const idAttr = getAttribute(element, 'id');

    // 1. Submit button
    if (type === 'submit') {
      const label = getAttribute(element, 'value') ?? 'Submit';
      const disabled = hasAttribute(element, 'disabled');
      const props: Record<string, unknown> = {
        label,
        buttonType: 'submit',
      };
      if (disabled) props.disabled = true;
      if (idAttr) props.id = idAttr;

      return {
        id: context.generateId('button-submit'),
        type: 'button-submit',
        props,
        styles: buildResponsiveStyles(computed, context.report),
        children: [],
      };
    }

    // 2. Button input
    if (type === 'button') {
      const label = getAttribute(element, 'value') ?? 'Button';
      const disabled = hasAttribute(element, 'disabled');
      const props: Record<string, unknown> = {
        label,
        type: 'button',
      };
      if (disabled) props.disabled = true;
      if (idAttr) props.id = idAttr;

      return {
        id: context.generateId('button'),
        type: 'button',
        props,
        styles: buildResponsiveStyles(computed, context.report),
        children: [],
      };
    }

    // 3. Checkbox
    if (type === 'checkbox') {
      const name = getAttribute(element, 'name');
      const checked = hasAttribute(element, 'checked');
      const disabled = hasAttribute(element, 'disabled');
      const value = getAttribute(element, 'value');
      const label =
        getAttribute(element, 'label') ??
        getAttribute(element, 'aria-label') ??
        value ??
        '';

      const props: Record<string, unknown> = {
        checked,
      };
      if (name) props.name = name;
      if (label) props.label = label;
      if (value) props.value = value;
      if (disabled) props.disabled = true;
      if (idAttr) props.id = idAttr;

      return {
        id: context.generateId('checkbox'),
        type: 'checkbox',
        props,
        styles: buildResponsiveStyles(computed, context.report),
        children: [],
      };
    }

    // 4. Radio
    if (type === 'radio') {
      const name = getAttribute(element, 'name');
      const value = getAttribute(element, 'value');
      const checked = hasAttribute(element, 'checked');
      const disabled = hasAttribute(element, 'disabled');
      const label =
        getAttribute(element, 'label') ??
        getAttribute(element, 'aria-label') ??
        '';

      const props: Record<string, unknown> = {
        checked,
      };
      if (name) props.name = name;
      if (value !== undefined) props.value = value;
      if (label) props.label = label;
      if (disabled) props.disabled = true;
      if (idAttr) props.id = idAttr;

      return {
        id: context.generateId('radio'),
        type: 'radio',
        props,
        styles: buildResponsiveStyles(computed, context.report),
        children: [],
      };
    }

    // 5. Standard text-like input
    const name = getAttribute(element, 'name');
    const placeholder = getAttribute(element, 'placeholder');
    const value = getAttribute(element, 'value');
    const required = hasAttribute(element, 'required');
    const disabled = hasAttribute(element, 'disabled');

    const props: Record<string, unknown> = {
      type: type || 'text',
      required,
      disabled,
    };
    if (name) props.name = name;
    if (placeholder) props.placeholder = placeholder;
    if (value !== undefined) props.value = value;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('input'),
      type: 'input',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <textarea> elements -> textarea component.
 */
export const textareaRule: HtmlMappingRule = {
  id: 'textarea',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'textarea',
  convert: (element, context, computed) => {
    const name = getAttribute(element, 'name');
    const placeholder = getAttribute(element, 'placeholder');
    const value = collapseWhitespace(getTextContent(element));
    const rowsAttr = getAttribute(element, 'rows');
    const required = hasAttribute(element, 'required');
    const disabled = hasAttribute(element, 'disabled');
    const idAttr = getAttribute(element, 'id');

    let rows: number | string | undefined;
    if (rowsAttr) {
      const parsed = Number(rowsAttr);
      rows = Number.isNaN(parsed) ? rowsAttr : parsed;
    }

    const props: Record<string, unknown> = {
      value,
      required,
      disabled,
    };
    if (name) props.name = name;
    if (placeholder) props.placeholder = placeholder;
    if (rows !== undefined) props.rows = rows;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('textarea'),
      type: 'textarea',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <select> elements -> select component.
 * Extracts options and labels from nested <option> tags.
 */
export const selectRule: HtmlMappingRule = {
  id: 'select',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'select',
  convert: (element, context, computed) => {
    const name = getAttribute(element, 'name');
    const required = hasAttribute(element, 'required');
    const disabled = hasAttribute(element, 'disabled');
    const idAttr = getAttribute(element, 'id');

    const options: Array<{ value: string; label: string }> = [];
    let selectedValue: string | undefined;

    function extractOptions(node: DefaultTreeAdapterMap['node']): void {
      if (!isElement(node)) return;
      const tag = node.tagName.toLowerCase();
      if (tag === 'option') {
        const val = getAttribute(node, 'value') ?? collapseWhitespace(getTextContent(node));
        const lbl = collapseWhitespace(getTextContent(node)) || val;
        options.push({ value: val, label: lbl });
        if (hasAttribute(node, 'selected')) {
          selectedValue = val;
        }
      } else if (tag === 'optgroup' || tag === 'select') {
        for (const child of node.childNodes) {
          extractOptions(child);
        }
      }
    }

    for (const child of element.childNodes) {
      extractOptions(child);
    }

    const props: Record<string, unknown> = {
      required,
      disabled,
      options,
    };
    if (name) props.name = name;
    if (selectedValue !== undefined) props.value = selectedValue;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('select'),
      type: 'select',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

function hasIconDescendant(element: DefaultTreeAdapterMap['element']): boolean {
  return element.childNodes.some(
    (child) =>
      isElement(child) &&
      (['svg', 'img', 'picture'].includes(child.tagName.toLowerCase()) || hasIconDescendant(child)),
  );
}

/**
 * Mapping rule for <button> elements.
 * If type="submit", maps to button-submit component; otherwise maps to button component.
 */
export const buttonRule: HtmlMappingRule = {
  id: 'button',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'button',
  convert: (element, context, computed) => {
    const rawType = (getAttribute(element, 'type') ?? 'button').toLowerCase();
    const text = collapseWhitespace(getTextContent(element));
    // Icon-only buttons (hamburger, close, …): the `button` component only renders a text
    // label, so keep the sanitized markup as an embed rather than showing "Button".
    if (!text && hasIconDescendant(element)) {
      return handleFallbackElement(element, context, computed);
    }
    const label = text || getAttribute(element, 'aria-label') || 'Button';
    const idAttr = getAttribute(element, 'id');
    const disabled = hasAttribute(element, 'disabled');

    if (rawType === 'submit') {
      const props: Record<string, unknown> = {
        label,
        buttonType: 'submit',
      };
      if (disabled) props.disabled = true;
      if (idAttr) props.id = idAttr;

      return {
        id: context.generateId('button-submit'),
        type: 'button-submit',
        props,
        styles: buildResponsiveStyles(computed, context.report),
        children: [],
      };
    }

    const props: Record<string, unknown> = {
      label,
      type: rawType || 'button',
    };
    if (disabled) props.disabled = true;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('button'),
      type: 'button',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Button styling heuristic for <a> elements.
 *
 * If <a> has role="button", class containing 'btn'/'button', or has both background color
 * and padding, and options.preserveButtonLinks !== true, maps to button component.
 * If options.preserveButtonLinks === true, rule does not match, falling back to linkRule.
 */
export const buttonLinkRule: HtmlMappingRule = {
  id: 'button-link',
  priority: 60,
  match: (element, computed, context) => {
    if (element.tagName.toLowerCase() !== 'a') return false;
    if (context.options?.preserveButtonLinks === true) return false;

    // 1. role="button"
    if (getAttribute(element, 'role') === 'button') return true;

    // 2. Class containing btn or button
    const classAttr = getAttribute(element, 'class');
    if (hasButtonClass(classAttr)) return true;

    // 3. Has both background color and padding in computed styles
    if (hasVisibleBackgroundColor(computed.base) && hasVisiblePadding(computed.base)) {
      return true;
    }

    return false;
  },
  convert: (element, context, computed) => {
    const rawHref = getAttribute(element, 'href') ?? '#';
    let safeHref = rawHref;

    if (!isSafeUrl(rawHref)) {
      addDiagnostic(context.report, {
        code: 'URL_BLOCKED',
        severity: 'warning',
        message: `Unsafe or disallowed URL scheme in button link href="${rawHref}" was sanitized to "#"`,
        location: {
          tagName: element.tagName,
          line: element.sourceCodeLocation?.startLine,
          column: element.sourceCodeLocation?.startCol,
        },
        details: { url: rawHref, attribute: 'href' },
      });
      safeHref = '#';
    }

    const label = collapseWhitespace(getTextContent(element)) || 'Button';
    const target = getAttribute(element, 'target');
    const rel = getAttribute(element, 'rel');
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {
      label,
      href: safeHref,
      link: safeHref,
    };
    if (target) props.target = target;
    if (rel) props.rel = rel;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('button'),
      type: 'button',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <label> elements.
 * Unwraps <label><input type="checkbox|radio"><span>Text</span></label> into checkbox/radio,
 * or maps plain label to text component.
 */
export const labelRule: HtmlMappingRule = {
  id: 'form-label',
  priority: 55,
  match: (element) => element.tagName.toLowerCase() === 'label',
  convert: (element, context, computed) => {
    let inputChild: DefaultTreeAdapterMap['element'] | null = null;
    for (const child of element.childNodes) {
      if (isElement(child) && child.tagName.toLowerCase() === 'input') {
        inputChild = child;
        break;
      }
    }

    if (inputChild) {
      const type = (getAttribute(inputChild, 'type') ?? 'text').toLowerCase();
      const name = getAttribute(inputChild, 'name');
      const checked = hasAttribute(inputChild, 'checked');
      const disabled = hasAttribute(inputChild, 'disabled');
      const value = getAttribute(inputChild, 'value');

      let labelText = '';
      for (const child of element.childNodes) {
        if (child === inputChild) continue;
        const t = collapseWhitespace(getTextContent(child));
        if (t) {
          labelText = labelText ? `${labelText} ${t}` : t;
        }
      }
      if (!labelText) {
        labelText =
          getAttribute(inputChild, 'aria-label') ??
          getAttribute(inputChild, 'value') ??
          '';
      }

      if (type === 'checkbox') {
        const props: Record<string, unknown> = {
          checked,
          label: labelText,
        };
        if (name) props.name = name;
        if (disabled) props.disabled = true;
        if (value) props.value = value;

        return {
          id: context.generateId('checkbox'),
          type: 'checkbox',
          props,
          styles: buildResponsiveStyles(computed, context.report),
          children: [],
        };
      }

      if (type === 'radio') {
        const props: Record<string, unknown> = {
          checked,
          label: labelText,
        };
        if (name) props.name = name;
        if (value !== undefined) props.value = value;
        if (disabled) props.disabled = true;

        return {
          id: context.generateId('radio'),
          type: 'radio',
          props,
          styles: buildResponsiveStyles(computed, context.report),
          children: [],
        };
      }
    }

    const text = collapseWhitespace(getTextContent(element));
    const forAttr = getAttribute(element, 'for') ?? getAttribute(element, 'htmlFor');
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {
      text,
      as: 'label',
    };
    if (forAttr) props.htmlFor = forAttr;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('text'),
      type: 'text',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Mapping rule for <ul> and <ol> list elements -> list component.
 */
export const listRule: HtmlMappingRule = {
  id: 'list',
  priority: 50,
  match: (element) => {
    const tag = element.tagName.toLowerCase();
    return tag === 'ul' || tag === 'ol';
  },
  convert: (element, context, computed) => {
    const tag = element.tagName.toLowerCase();
    const ordered = tag === 'ol';
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {
      ordered,
      tag,
    };
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('list'),
      type: 'list',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: context.convertChildren(element),
    };
  },
};

/**
 * Mapping rule for <li> list item elements -> list-item component.
 */
export const listItemRule: HtmlMappingRule = {
  id: 'list-item',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'li',
  convert: (element, context, computed) => {
    const idAttr = getAttribute(element, 'id');
    const props: Record<string, unknown> = {};
    if (idAttr) props.id = idAttr;

    const hasElementChildren = element.childNodes.some(isElement);
    let children: PageNode[] = [];
    // The renderer outputs `text` *and* children, so mixed content lives in children only.
    if (hasElementChildren) {
      children = context.convertChildren(element);
    } else {
      props.text = collapseWhitespace(getTextContent(element));
    }

    return {
      id: context.generateId('list-item'),
      type: 'list-item',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children,
    };
  },
};

/**
 * Mapping rule for <table> elements -> table component.
 * Automatically flattens rows from <thead>, <tbody>, and <tfoot> cleanly into rows.
 */
export const tableRule: HtmlMappingRule = {
  id: 'table',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'table',
  convert: (element, context, computed) => {
    const idAttr = getAttribute(element, 'id');
    const ariaLabel = getAttribute(element, 'aria-label');

    const props: Record<string, unknown> = {};
    if (idAttr) props.id = idAttr;
    if (ariaLabel) props.ariaLabel = ariaLabel;

    const children: PageNode[] = [];
    for (const child of element.childNodes) {
      if (!isElement(child)) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'tr') {
        const converted = context.convertElement(child);
        if (converted) {
          if (Array.isArray(converted)) children.push(...converted);
          else children.push(converted);
        }
      } else if (tag === 'thead' || tag === 'tbody' || tag === 'tfoot') {
        for (const subChild of child.childNodes) {
          if (!isElement(subChild)) continue;
          if (subChild.tagName.toLowerCase() === 'tr') {
            const converted = context.convertElement(subChild);
            if (converted) {
              if (Array.isArray(converted)) children.push(...converted);
              else children.push(converted);
            }
          }
        }
      }
    }

    return {
      id: context.generateId('table'),
      type: 'table',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children,
    };
  },
};

/**
 * Transparent pass-through rule for <thead>, <tbody>, <tfoot> when evaluated individually.
 */
export const tableSectionRule: HtmlMappingRule = {
  id: 'table-section',
  priority: 45,
  match: (element) => {
    const tag = element.tagName.toLowerCase();
    return tag === 'thead' || tag === 'tbody' || tag === 'tfoot';
  },
  convert: (element, context) => {
    return context.convertChildren(element);
  },
};

/**
 * Mapping rule for <tr> elements -> table-row component.
 */
export const tableRowRule: HtmlMappingRule = {
  id: 'table-row',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'tr',
  convert: (element, context, computed) => {
    const idAttr = getAttribute(element, 'id');
    const props: Record<string, unknown> = {};
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('table-row'),
      type: 'table-row',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: context.convertChildren(element),
    };
  },
};

/**
 * Mapping rule for <td> and <th> elements -> table-cell component.
 */
export const tableCellRule: HtmlMappingRule = {
  id: 'table-cell',
  priority: 50,
  match: (element) => {
    const tag = element.tagName.toLowerCase();
    return tag === 'td' || tag === 'th';
  },
  convert: (element, context, computed) => {
    const tag = element.tagName.toLowerCase();
    const isHeader = tag === 'th';
    const colSpan = getAttribute(element, 'colspan');
    const rowSpan = getAttribute(element, 'rowspan');
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {
      isHeader,
    };
    if (colSpan) {
      const c = Number(colSpan);
      if (!Number.isNaN(c) && c > 1) props.colSpan = c;
    }
    if (rowSpan) {
      const r = Number(rowSpan);
      if (!Number.isNaN(r) && r > 1) props.rowSpan = r;
    }
    if (idAttr) props.id = idAttr;

    const hasElementChildren = element.childNodes.some(isElement);
    let children: PageNode[] = [];
    if (hasElementChildren) {
      children = context.convertChildren(element);
      props.text = collapseWhitespace(getTextContent(element));
    } else {
      props.text = collapseWhitespace(getTextContent(element));
    }

    return {
      id: context.generateId('table-cell'),
      type: 'table-cell',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children,
    };
  },
};

/**
 * Mapping rule for <svg> elements -> icon component.
 * Serializes the SVG into the svg prop, preserving attributes.
 */
export const svgRule: HtmlMappingRule = {
  id: 'svg-icon',
  priority: 50,
  match: (element) => element.tagName.toLowerCase() === 'svg',
  convert: (element, context, computed) => {
    const rawSvg = serialize({
      nodeName: '#document-fragment',
      childNodes: [element],
    } as unknown as Parse5DocumentFragment);

    const ariaLabel = getAttribute(element, 'aria-label') ?? getAttribute(element, 'ariaLabel');
    const role = getAttribute(element, 'role');
    const idAttr = getAttribute(element, 'id');

    const props: Record<string, unknown> = {
      svg: rawSvg,
    };
    if (ariaLabel) props.ariaLabel = ariaLabel;
    if (role) props.role = role;
    if (idAttr) props.id = idAttr;

    return {
      id: context.generateId('icon'),
      type: 'icon',
      props,
      styles: buildResponsiveStyles(computed, context.report),
      children: [],
    };
  },
};

/**
 * Default media, form, list, and table mapping rules.
 */
export const DEFAULT_MEDIA_FORM_DATA_RULES: readonly HtmlMappingRule[] = Object.freeze([
  imgRule,
  pictureRule,
  videoRule,
  iframeRule,
  formRule,
  inputRule,
  textareaRule,
  selectRule,
  buttonRule,
  buttonLinkRule,
  labelRule,
  listRule,
  listItemRule,
  tableRule,
  tableSectionRule,
  tableRowRule,
  tableCellRule,
  svgRule,
]);
