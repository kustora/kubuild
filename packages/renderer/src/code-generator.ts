import { PageDocument, Node } from '@kubuild/schema';
import { DEFAULT_CSS_RESET, styleDefinitionToCssDeclarations } from './styles';
import { collectAnimationStylesCss } from './animation';

export interface GenerateHtmlOptions {
  /**
   * Whether to include internal node ID classes (`kb-node-{id}`).
   * Defaults to true so generated CSS matches HTML elements.
   */
  includeNodeClasses?: boolean;
  /**
   * Indentation width in spaces. Defaults to 2.
   */
  indentSize?: number;
  /**
   * Root tag for the page container ('main' | 'div'). Defaults to 'main'.
   */
  rootTag?: 'main' | 'div';
}

export interface GenerateCssOptions {
  /**
   * Whether to include the baseline CSS reset. Defaults to true.
   */
  includeReset?: boolean;
  /**
   * Custom CSS class prefix for node selectors. Defaults to 'kb-node-'.
   */
  classPrefix?: string;
}

export interface StandaloneHtmlOptions {
  htmlOptions?: GenerateHtmlOptions;
  cssOptions?: GenerateCssOptions;
  /** Custom language attribute for <html>. Defaults to 'en'. */
  lang?: string;
}

function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str: unknown): string {
  return escapeHtml(str);
}

function getYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
  );
  return match ? match[1] : null;
}

function getVimeoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|))(\d+)/i,
  );
  return match ? match[3] : null;
}

/**
 * Recursively generates clean, indented semantic HTML markup for a node tree.
 */
function renderNodeToHtml(node: Node, indentLevel: number, options: GenerateHtmlOptions): string {
  const indent = ' '.repeat(indentLevel * (options.indentSize ?? 2));
  const innerIndent = ' '.repeat((indentLevel + 1) * (options.indentSize ?? 2));
  const props = node.props || {};
  const children = node.children || [];
  const includeNodeClass = options.includeNodeClasses !== false;
  const nodeClass = includeNodeClass ? `kb-node-${node.id}` : '';

  const buildClass = (...classes: (string | undefined | false)[]) => {
    return classes.filter(Boolean).join(' ');
  };

  const idAttr = props.id ? ` id="${escapeAttr(props.id)}"` : '';

  switch (node.type) {
    case 'page': {
      const tag = options.rootTag || 'main';
      const cls = buildClass('kb-page', nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<${tag} class="${cls}"${idAttr}></${tag}>`;
      }
      return `${indent}<${tag} class="${cls}"${idAttr}>\n${childHtml}\n${indent}</${tag}>`;
    }

    case 'section': {
      const ariaLabel = props.ariaLabel ? ` aria-label="${escapeAttr(props.ariaLabel)}"` : '';
      const cls = buildClass('kb-section', nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<section class="${cls}"${idAttr}${ariaLabel}></section>`;
      }
      return `${indent}<section class="${cls}"${idAttr}${ariaLabel}>\n${childHtml}\n${indent}</section>`;
    }

    case 'container': {
      const cls = buildClass('kb-container', nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<div class="${cls}"${idAttr}></div>`;
      }
      return `${indent}<div class="${cls}"${idAttr}>\n${childHtml}\n${indent}</div>`;
    }

    case 'columns': {
      const cls = buildClass('kb-columns', nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<div class="${cls}"${idAttr}></div>`;
      }
      return `${indent}<div class="${cls}"${idAttr}>\n${childHtml}\n${indent}</div>`;
    }

    case 'heading': {
      let level = 'h2';
      if (typeof props.level === 'string' && /^h[1-6]$/i.test(props.level)) {
        level = props.level.toLowerCase();
      } else if (typeof props.level === 'number' && props.level >= 1 && props.level <= 6) {
        level = `h${props.level}`;
      } else if (typeof props.tag === 'string' && /^h[1-6]$/i.test(props.tag)) {
        level = props.tag.toLowerCase();
      }
      const text = props.text ?? props.value ?? props.content ?? 'Heading';
      const cls = buildClass('kb-heading', nodeClass);
      return `${indent}<${level} class="${cls}"${idAttr}>${escapeHtml(text)}</${level}>`;
    }

    case 'paragraph': {
      const text = props.text ?? props.value ?? props.content ?? '';
      const cls = buildClass('kb-paragraph', nodeClass);
      return `${indent}<p class="${cls}"${idAttr}>${escapeHtml(text)}</p>`;
    }

    case 'text': {
      const tag = (props.as as string) || 'p';
      const text = props.text ?? props.value ?? props.content ?? '';
      const cls = buildClass('kb-text', nodeClass);
      return `${indent}<${tag} class="${cls}"${idAttr}>${escapeHtml(text)}</${tag}>`;
    }

    case 'link': {
      const href = props.href ? ` href="${escapeAttr(props.href)}"` : ' href="#"';
      const target = props.target ? ` target="${escapeAttr(props.target)}"` : '';
      const rel = props.rel ? ` rel="${escapeAttr(props.rel)}"` : target.includes('_blank') ? ' rel="noopener noreferrer"' : '';
      const text = props.text ?? props.label ?? props.value;
      const cls = buildClass('kb-link', nodeClass);

      if (children.length > 0) {
        const childHtml = children
          .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
          .join('\n');
        return `${indent}<a class="${cls}"${idAttr}${href}${target}${rel}>\n${childHtml}\n${indent}</a>`;
      }
      return `${indent}<a class="${cls}"${idAttr}${href}${target}${rel}>${escapeHtml(text ?? 'Link')}</a>`;
    }

    case 'blockquote': {
      const cite = props.cite ? ` cite="${escapeAttr(props.cite)}"` : '';
      const quote = props.quote ?? props.text ?? props.value;
      const author = props.author ?? props.citeAuthor;
      const cls = buildClass('kb-blockquote', nodeClass);

      if (quote || author) {
        const quoteHtml = quote ? `${innerIndent}<p>${escapeHtml(quote)}</p>` : '';
        const authorHtml = author ? `${innerIndent}<cite>${escapeHtml(author)}</cite>` : '';
        const parts = [quoteHtml, authorHtml].filter(Boolean).join('\n');
        return `${indent}<blockquote class="${cls}"${idAttr}${cite}>\n${parts}\n${indent}</blockquote>`;
      }

      if (children.length > 0) {
        const childHtml = children
          .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
          .join('\n');
        return `${indent}<blockquote class="${cls}"${idAttr}${cite}>\n${childHtml}\n${indent}</blockquote>`;
      }
      return `${indent}<blockquote class="${cls}"${idAttr}${cite}></blockquote>`;
    }

    case 'badge': {
      const text = props.text ?? props.label ?? props.value ?? 'Badge';
      const cls = buildClass('kb-badge', nodeClass);
      return `${indent}<span class="${cls}"${idAttr}>${escapeHtml(text)}</span>`;
    }

    case 'code-block': {
      const code = props.code ?? props.text ?? props.value ?? '';
      const lang = props.language || props.lang;
      const langClass = lang ? ` class="language-${escapeAttr(lang)}"` : '';
      const cls = buildClass('kb-code-block', nodeClass);
      return `${indent}<pre class="${cls}"${idAttr}><code${langClass}>${escapeHtml(code)}</code></pre>`;
    }

    case 'divider': {
      const cls = buildClass('kb-divider', nodeClass);
      const text = props.text ?? props.label;
      if (text) {
        return `${indent}<div class="${cls}"${idAttr} role="separator"><span>${escapeHtml(text)}</span></div>`;
      }
      return `${indent}<hr class="${cls}"${idAttr} />`;
    }

    case 'spacer': {
      const cls = buildClass('kb-spacer', nodeClass);
      return `${indent}<div class="${cls}"${idAttr} aria-hidden="true"></div>`;
    }

    case 'image': {
      const src = props.src ? ` src="${escapeAttr(props.src)}"` : ' src=""';
      const alt = props.alt ? ` alt="${escapeAttr(props.alt)}"` : ' alt=""';
      const loading = props.loading ? ` loading="${escapeAttr(props.loading)}"` : ' loading="lazy"';
      const cls = buildClass('kb-image', nodeClass);
      return `${indent}<img class="${cls}"${idAttr}${src}${alt}${loading} />`;
    }

    case 'video': {
      const src = (props.src as string) || '';
      const ytId = getYouTubeId(src);
      const vmId = getVimeoId(src);
      const cls = buildClass('kb-video', nodeClass);

      if (ytId) {
        return `${indent}<div class="kb-video-wrapper ${nodeClass}"${idAttr}>\n${innerIndent}<iframe src="https://www.youtube-nocookie.com/embed/${escapeAttr(ytId)}" title="${escapeAttr(props.title || 'Video player')}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>\n${indent}</div>`;
      }
      if (vmId) {
        return `${indent}<div class="kb-video-wrapper ${nodeClass}"${idAttr}>\n${innerIndent}<iframe src="https://player.vimeo.com/video/${escapeAttr(vmId)}" title="${escapeAttr(props.title || 'Video player')}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>\n${indent}</div>`;
      }

      const poster = props.poster ? ` poster="${escapeAttr(props.poster)}"` : '';
      const controls = props.controls !== false ? ' controls' : '';
      const autoplay = props.autoplay ? ' autoplay' : '';
      const loop = props.loop ? ' loop' : '';
      const muted = props.muted ? ' muted' : '';
      const videoSrc = src ? ` src="${escapeAttr(src)}"` : '';
      return `${indent}<video class="${cls}"${idAttr}${videoSrc}${poster}${controls}${autoplay}${loop}${muted}></video>`;
    }

    case 'icon': {
      const name = props.name || props.icon || 'star';
      const ariaLabel = props.ariaLabel ? ` aria-label="${escapeAttr(props.ariaLabel)}"` : ' aria-hidden="true"';
      const cls = buildClass('kb-icon', nodeClass);
      return `${indent}<span class="${cls}"${idAttr}${ariaLabel} data-icon="${escapeAttr(name)}"></span>`;
    }

    case 'html-embed': {
      const rawHtml = (props.html ?? props.content ?? '') as string;
      const cls = buildClass('kb-html-embed', nodeClass);
      if (!rawHtml) {
        return `${indent}<div class="${cls}"${idAttr}></div>`;
      }
      return `${indent}<div class="${cls}"${idAttr}>\n${innerIndent}${rawHtml}\n${indent}</div>`;
    }

    case 'button': {
      const label = props.label ?? props.text ?? props.value ?? 'Button';
      const type = props.type ? ` type="${escapeAttr(props.type)}"` : ' type="button"';
      const disabled = props.disabled ? ' disabled' : '';
      const cls = buildClass('kb-button', nodeClass);

      if (props.href) {
        const href = ` href="${escapeAttr(props.href)}"`;
        const target = props.target ? ` target="${escapeAttr(props.target)}"` : '';
        return `${indent}<a class="${cls}"${idAttr}${href}${target}>${escapeHtml(label)}</a>`;
      }

      return `${indent}<button class="${cls}"${idAttr}${type}${disabled}>${escapeHtml(label)}</button>`;
    }

    case 'form': {
      const action = props.action ? ` action="${escapeAttr(props.action)}"` : '';
      const method = props.method ? ` method="${escapeAttr(props.method)}"` : ' method="POST"';
      const cls = buildClass('kb-form', nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<form class="${cls}"${idAttr}${action}${method}></form>`;
      }
      return `${indent}<form class="${cls}"${idAttr}${action}${method}>\n${childHtml}\n${indent}</form>`;
    }

    case 'input': {
      const type = props.type ? ` type="${escapeAttr(props.type)}"` : ' type="text"';
      const name = props.name ? ` name="${escapeAttr(props.name)}"` : '';
      const placeholder = props.placeholder ? ` placeholder="${escapeAttr(props.placeholder)}"` : '';
      const value = props.value !== undefined ? ` value="${escapeAttr(props.value)}"` : '';
      const required = props.required ? ' required' : '';
      const disabled = props.disabled ? ' disabled' : '';
      const cls = buildClass('kb-input', nodeClass);
      return `${indent}<input class="${cls}"${idAttr}${type}${name}${placeholder}${value}${required}${disabled} />`;
    }

    case 'textarea': {
      const name = props.name ? ` name="${escapeAttr(props.name)}"` : '';
      const placeholder = props.placeholder ? ` placeholder="${escapeAttr(props.placeholder)}"` : '';
      const rows = props.rows ? ` rows="${escapeAttr(props.rows)}"` : ' rows="4"';
      const value = props.value ?? props.defaultValue ?? '';
      const required = props.required ? ' required' : '';
      const disabled = props.disabled ? ' disabled' : '';
      const cls = buildClass('kb-textarea', nodeClass);
      return `${indent}<textarea class="${cls}"${idAttr}${name}${placeholder}${rows}${required}${disabled}>${escapeHtml(value)}</textarea>`;
    }

    case 'select': {
      const name = props.name ? ` name="${escapeAttr(props.name)}"` : '';
      const required = props.required ? ' required' : '';
      const disabled = props.disabled ? ' disabled' : '';
      const cls = buildClass('kb-select', nodeClass);
      const optionsList = Array.isArray(props.options) ? props.options : [];
      const optionIndent = ' '.repeat((indentLevel + 1) * (options.indentSize ?? 2));

      const optionsHtml = optionsList
        .map((opt: any) => {
          const optVal = typeof opt === 'object' ? opt.value : opt;
          const optLabel = typeof opt === 'object' ? opt.label : opt;
          const selected = props.value === optVal || props.defaultValue === optVal ? ' selected' : '';
          return `${optionIndent}<option value="${escapeAttr(optVal)}"${selected}>${escapeHtml(optLabel)}</option>`;
        })
        .join('\n');

      if (!optionsHtml) {
        return `${indent}<select class="${cls}"${idAttr}${name}${required}${disabled}></select>`;
      }
      return `${indent}<select class="${cls}"${idAttr}${name}${required}${disabled}>\n${optionsHtml}\n${indent}</select>`;
    }

    case 'checkbox': {
      const name = props.name ? ` name="${escapeAttr(props.name)}"` : '';
      const checked = props.checked || props.defaultChecked ? ' checked' : '';
      const label = props.label ?? props.text ?? '';
      const cls = buildClass('kb-checkbox-label', nodeClass);
      return `${indent}<label class="${cls}"${idAttr}><input type="checkbox"${name}${checked} /><span>${escapeHtml(label)}</span></label>`;
    }

    case 'radio': {
      const name = props.name ? ` name="${escapeAttr(props.name)}"` : '';
      const value = props.value ? ` value="${escapeAttr(props.value)}"` : '';
      const checked = props.checked || props.defaultChecked ? ' checked' : '';
      const label = props.label ?? props.text ?? '';
      const cls = buildClass('kb-radio-label', nodeClass);
      return `${indent}<label class="${cls}"${idAttr}><input type="radio"${name}${value}${checked} /><span>${escapeHtml(label)}</span></label>`;
    }

    case 'list': {
      const tag = props.tag === 'ol' || props.type === 'ol' || props.ordered ? 'ol' : 'ul';
      const cls = buildClass('kb-list', nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<${tag} class="${cls}"${idAttr}></${tag}>`;
      }
      return `${indent}<${tag} class="${cls}"${idAttr}>\n${childHtml}\n${indent}</${tag}>`;
    }

    case 'list-item': {
      const text = props.text ?? props.value;
      const cls = buildClass('kb-list-item', nodeClass);
      if (children.length > 0) {
        const childHtml = children
          .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
          .join('\n');
        return `${indent}<li class="${cls}"${idAttr}>\n${childHtml}\n${indent}</li>`;
      }
      return `${indent}<li class="${cls}"${idAttr}>${escapeHtml(text ?? 'List item')}</li>`;
    }

    case 'table': {
      const cls = buildClass('kb-table', nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<table class="${cls}"${idAttr}></table>`;
      }
      return `${indent}<table class="${cls}"${idAttr}>\n${childHtml}\n${indent}</table>`;
    }

    case 'table-row': {
      const cls = buildClass('kb-table-row', nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<tr class="${cls}"${idAttr}></tr>`;
      }
      return `${indent}<tr class="${cls}"${idAttr}>\n${childHtml}\n${indent}</tr>`;
    }

    case 'table-cell': {
      const isHeader = props.isHeader || props.type === 'header' || props.tag === 'th';
      const tag = isHeader ? 'th' : 'td';
      const colSpan = props.colSpan && Number(props.colSpan) > 1 ? ` colspan="${escapeAttr(props.colSpan)}"` : '';
      const rowSpan = props.rowSpan && Number(props.rowSpan) > 1 ? ` rowspan="${escapeAttr(props.rowSpan)}"` : '';
      const text = props.text ?? props.value ?? '';
      const cls = buildClass('kb-table-cell', nodeClass);

      if (children.length > 0) {
        const childHtml = children
          .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
          .join('\n');
        return `${indent}<${tag} class="${cls}"${idAttr}${colSpan}${rowSpan}>\n${childHtml}\n${indent}</${tag}>`;
      }
      return `${indent}<${tag} class="${cls}"${idAttr}${colSpan}${rowSpan}>${escapeHtml(text)}</${tag}>`;
    }

    case 'collection': {
      const cls = buildClass('kb-collection', nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<div class="${cls}"${idAttr}></div>`;
      }
      return `${indent}<div class="${cls}"${idAttr}>\n${childHtml}\n${indent}</div>`;
    }

    default: {
      const cls = buildClass(`kb-${node.type}`, nodeClass);
      const childHtml = children
        .map((child) => renderNodeToHtml(child, indentLevel + 1, options))
        .join('\n');
      if (!childHtml) {
        return `${indent}<div class="${cls}"${idAttr}></div>`;
      }
      return `${indent}<div class="${cls}"${idAttr}>\n${childHtml}\n${indent}</div>`;
    }
  }
}

/**
 * Generates a clean, formatted semantic HTML string for a PageDocument or Node.
 */
export function generateSemanticHtml(
  docOrNode: PageDocument | Node,
  options: GenerateHtmlOptions = {},
): string {
  const rootNode = 'document' in docOrNode ? docOrNode.document : docOrNode;
  if (!rootNode) return '';
  return renderNodeToHtml(rootNode, 0, options);
}

/**
 * Format a set of CSS property-value declarations into indented multi-line CSS block.
 */
function formatCssRule(selector: string, declarationsStr: string, indent = ''): string {
  if (!declarationsStr.trim()) return '';
  const rules = declarationsStr
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean);
  if (rules.length === 0) return '';

  const indentedRules = rules.map((r) => `${indent}  ${r};`).join('\n');
  return `${indent}${selector} {\n${indentedRules}\n${indent}}`;
}

/**
 * Generates structured, readable CSS for the given document, compiling
 * base styles, responsive breakpoints (tablet/mobile), and pseudo-classes.
 */
export function generateDocumentCss(
  docOrNode: PageDocument | Node,
  options: GenerateCssOptions = {},
): string {
  const rootNode = 'document' in docOrNode ? docOrNode.document : docOrNode;
  if (!rootNode) return '';

  const classPrefix = options.classPrefix || 'kb-node-';
  const baseRules: string[] = [];
  const tabletRules: string[] = [];
  const mobileRules: string[] = [];
  const stateRules: string[] = [];

  const walk = (node: Node) => {
    const selector = `.${classPrefix}${node.id}`;

    // Base & Desktop styles
    if (node.styles) {
      const baseStyles = {
        ...(node.styles.base || {}),
        ...(node.styles.desktop || {}),
      };
      const baseDecls = styleDefinitionToCssDeclarations(baseStyles);
      if (baseDecls) {
        baseRules.push(formatCssRule(selector, baseDecls));
      }

      // Tablet styles
      if (node.styles.tablet) {
        const tabletDecls = styleDefinitionToCssDeclarations(node.styles.tablet);
        if (tabletDecls) {
          tabletRules.push(formatCssRule(selector, tabletDecls, '  '));
        }
      }

      // Mobile styles
      if (node.styles.mobile) {
        const mobileDecls = styleDefinitionToCssDeclarations(node.styles.mobile);
        if (mobileDecls) {
          mobileRules.push(formatCssRule(selector, mobileDecls, '  '));
        }
      }

      // Pseudo-state styles (e.g. :hover, :focus, :active)
      if (node.styles.states && typeof node.styles.states === 'object') {
        for (const [state, styleDef] of Object.entries(node.styles.states)) {
          if (!styleDef) continue;
          const safeState = /^::?[a-zA-Z-]+$/.test(state) ? state : null;
          if (!safeState) continue;
          const stateDecls = styleDefinitionToCssDeclarations(styleDef as Record<string, unknown>);
          if (stateDecls) {
            stateRules.push(formatCssRule(`${selector}${safeState}`, stateDecls));
          }
        }
      }
    }

    node.children?.forEach(walk);
  };

  walk(rootNode);

  const sections: string[] = [];

  // Reset
  if (options.includeReset !== false) {
    sections.push(`/* ==========================================================================\n   Baseline Reset & Typography Standards\n   ========================================================================== */\n${DEFAULT_CSS_RESET}`);
  }

  // Base Styles
  if (baseRules.length > 0) {
    sections.push(`/* ==========================================================================\n   Component Styles\n   ========================================================================== */\n${baseRules.join('\n\n')}`);
  }

  // Interactive / Pseudo-States
  if (stateRules.length > 0) {
    sections.push(`/* ==========================================================================\n   Interactive & Hover States\n   ========================================================================== */\n${stateRules.join('\n\n')}`);
  }

  // Tablet Media Query
  if (tabletRules.length > 0) {
    sections.push(`/* ==========================================================================\n   Tablet Breakpoint (max-width: 1024px)\n   ========================================================================== */\n@media (max-width: 1024px) {\n${tabletRules.join('\n\n')}\n}`);
  }

  // Mobile Media Query
  if (mobileRules.length > 0) {
    sections.push(`/* ==========================================================================\n   Mobile Breakpoint (max-width: 640px)\n   ========================================================================== */\n@media (max-width: 640px) {\n${mobileRules.join('\n\n')}\n}`);
  }

  // Animation & Motion Styles (STORA-264)
  const pageDoc: PageDocument = 'document' in docOrNode
    ? docOrNode
    : { schema: 'stora.page', version: '1.0.0', document: rootNode as any };
  const animStyles = collectAnimationStylesCss(pageDoc);
  if (animStyles) {
    sections.push(`/* ==========================================================================\n   Animations & Motion Keyframes\n   ========================================================================== */\n${animStyles}`);
  }

  return sections.join('\n\n');
}

/**
 * Generates a complete, standalone, production-ready HTML document string
 * with metadata, responsive viewport tags, embedded stylesheet, and semantic body markup.
 */
export function generateStandaloneHtml(
  doc: PageDocument,
  options: StandaloneHtmlOptions = {},
): string {
  const title = escapeHtml(doc.metadata?.title || 'KUBUILD Page');
  const description = doc.metadata?.description ? escapeAttr(doc.metadata.description) : '';
  const author = doc.metadata?.author ? escapeAttr(doc.metadata.author) : '';
  const lang = options.lang || 'en';

  const css = generateDocumentCss(doc, options.cssOptions);
  const html = generateSemanticHtml(doc, options.htmlOptions);

  const metaDescription = description ? `  <meta name="description" content="${description}">\n` : '';
  const metaAuthor = author ? `  <meta name="author" content="${author}">\n` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
${metaDescription}${metaAuthor}  <style>
${css}
  </style>
</head>
<body>
${html}
</body>
</html>`;
}
