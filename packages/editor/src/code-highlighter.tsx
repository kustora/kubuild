import React from 'react';

export type LanguageMode = 'combined' | 'html' | 'css';

interface Token {
  type:
    | 'plain'
    | 'tag-name'
    | 'tag-bracket'
    | 'attr-name'
    | 'attr-equal'
    | 'attr-value'
    | 'comment'
    | 'doctype'
    | 'css-selector-class'
    | 'css-selector-id'
    | 'css-selector-elem'
    | 'css-pseudo'
    | 'css-property'
    | 'css-value-number'
    | 'css-value-color'
    | 'css-value-keyword'
    | 'css-value-string'
    | 'css-value-important'
    | 'css-atrule'
    | 'css-punctuation'
    | 'css-function';
  text: string;
}

const TOKEN_STYLES: Record<Token['type'], string> = {
  plain: 'text-slate-200',
  'tag-name': 'text-sky-400 font-medium',
  'tag-bracket': 'text-slate-500',
  'attr-name': 'text-amber-300',
  'attr-equal': 'text-slate-400',
  'attr-value': 'text-emerald-400',
  comment: 'text-slate-500 italic',
  doctype: 'text-indigo-400 font-semibold',
  'css-selector-class': 'text-amber-300 font-medium',
  'css-selector-id': 'text-amber-400 font-medium',
  'css-selector-elem': 'text-sky-400',
  'css-pseudo': 'text-indigo-300',
  'css-property': 'text-cyan-300',
  'css-value-number': 'text-emerald-300 font-mono',
  'css-value-color': 'text-yellow-300',
  'css-value-keyword': 'text-purple-300',
  'css-value-string': 'text-emerald-400',
  'css-value-important': 'text-rose-400 font-semibold',
  'css-atrule': 'text-purple-400 font-semibold',
  'css-punctuation': 'text-slate-400',
  'css-function': 'text-blue-300',
};

const CSS_KEYWORDS = new Set([
  'block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'inline-grid',
  'none', 'inherit', 'initial', 'unset', 'revert', 'auto', 'normal', 'bold', 'bolder',
  'lighter', 'italic', 'center', 'left', 'right', 'justify', 'start', 'end',
  'flex-start', 'flex-end', 'space-between', 'space-around', 'space-evenly', 'stretch',
  'baseline', 'row', 'row-reverse', 'column', 'column-reverse', 'wrap', 'nowrap',
  'wrap-reverse', 'relative', 'absolute', 'fixed', 'sticky', 'static', 'hidden',
  'visible', 'scroll', 'border-box', 'content-box', 'solid', 'dashed', 'dotted',
  'double', 'groove', 'ridge', 'inset', 'outset', 'transparent', 'currentColor',
  'antialiased', 'subpixel-antialiased', 'pointer', 'default', 'not-allowed',
  'crosshair', 'move', 'text', 'wait', 'grab', 'grabbing', 'nowrap', 'pre', 'pre-wrap',
  'pre-line', 'break-word', 'break-all', 'contain', 'cover', 'fill', 'scale-down',
]);

const HTML_TAG_NAMES = new Set([
  'html', 'head', 'body', 'title', 'meta', 'link', 'style', 'script', 'base',
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'article',
  'aside', 'header', 'footer', 'nav', 'main', 'figure', 'figcaption', 'ul', 'ol',
  'li', 'a', 'button', 'input', 'textarea', 'select', 'option', 'form', 'label',
  'img', 'picture', 'video', 'audio', 'source', 'iframe', 'canvas', 'svg', 'path',
  'circle', 'rect', 'line', 'polyline', 'polygon', 'g', 'defs', 'clippath', 'table',
  'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'blockquote', 'hr', 'br', 'strong',
  'em', 'code', 'pre', 'small', 'sub', 'sup', 'i', 'b', 'time', 'address', 'details',
  'summary', 'dialog',
]);

/**
 * Tokenize a single line of CSS
 */
function tokenizeCssLine(line: string, inBlockRef: { inBlock: boolean }): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    // 1. Whitespace
    if (/\s/.test(line[i])) {
      let ws = '';
      while (i < len && /\s/.test(line[i])) {
        ws += line[i++];
      }
      tokens.push({ type: 'plain', text: ws });
      continue;
    }

    // 2. CSS Comments: /* ... */
    if (line.slice(i, i + 2) === '/*') {
      const closeIdx = line.indexOf('*/', i + 2);
      if (closeIdx !== -1) {
        tokens.push({ type: 'comment', text: line.slice(i, closeIdx + 2) });
        i = closeIdx + 2;
      } else {
        tokens.push({ type: 'comment', text: line.slice(i) });
        i = len;
      }
      continue;
    }

    // 3. At-rules (e.g. @media, @keyframes)
    if (line[i] === '@') {
      let atrule = '';
      while (i < len && /[a-zA-Z0-9_-]/.test(line[i] === '@' ? 'a' : line[i])) {
        atrule += line[i++];
      }
      tokens.push({ type: 'css-atrule', text: atrule });
      continue;
    }

    // 4. Braces & Punctuation
    if (line[i] === '{') {
      inBlockRef.inBlock = true;
      tokens.push({ type: 'css-punctuation', text: '{' });
      i++;
      continue;
    }
    if (line[i] === '}') {
      inBlockRef.inBlock = false;
      tokens.push({ type: 'css-punctuation', text: '}' });
      i++;
      continue;
    }
    if (line[i] === ';' || line[i] === ',') {
      tokens.push({ type: 'css-punctuation', text: line[i] });
      i++;
      continue;
    }

    // 5. Inside declaration block { ... }
    if (inBlockRef.inBlock) {
      // String literals inside values
      if (line[i] === '"' || line[i] === "'") {
        const quote = line[i];
        let str = quote;
        i++;
        while (i < len && line[i] !== quote) {
          if (line[i] === '\\' && i + 1 < len) {
            str += line[i++];
          }
          str += line[i++];
        }
        if (i < len) str += line[i++];
        tokens.push({ type: 'css-value-string', text: str });
        continue;
      }

      // Colon ':' separator
      if (line[i] === ':') {
        tokens.push({ type: 'css-punctuation', text: ':' });
        i++;
        continue;
      }

      // !important
      if (line.slice(i, i + 10).toLowerCase() === '!important') {
        tokens.push({ type: 'css-value-important', text: line.slice(i, i + 10) });
        i += 10;
        continue;
      }

      // Hex colors: #fff, #1a2b3c, etc.
      if (line[i] === '#') {
        let hex = '#';
        i++;
        while (i < len && /[0-9a-fA-F]/.test(line[i])) {
          hex += line[i++];
        }
        tokens.push({ type: 'css-value-color', text: hex });
        continue;
      }

      // Function calls: rgb(), rgba(), hsl(), var(), calc(), url()
      const fnMatch = line.slice(i).match(/^([a-zA-Z_-][a-zA-Z0-9_-]*)\(/);
      if (fnMatch) {
        tokens.push({ type: 'css-function', text: fnMatch[1] });
        tokens.push({ type: 'css-punctuation', text: '(' });
        i += fnMatch[0].length;
        continue;
      }

      // Numbers & Units (e.g. 100%, 16px, 1.5, 0, -2rem)
      const numMatch = line.slice(i).match(/^-?\d+(\.\d+)?(px|rem|em|%|vh|vw|vmin|vmax|s|ms|deg|fr|ch|ex)?/);
      if (numMatch && numMatch[0].length > 0) {
        tokens.push({ type: 'css-value-number', text: numMatch[0] });
        i += numMatch[0].length;
        continue;
      }

      // Identifiers: Property names or keyword values
      const identMatch = line.slice(i).match(/^-?[a-zA-Z_-][a-zA-Z0-9_-]*/);
      if (identMatch) {
        const ident = identMatch[0];
        // Peek forward: if next non-ws char before ';' or '}' is ':', it's a property name
        const rest = line.slice(i + ident.length);
        const nextColon = rest.match(/^\s*:/);
        if (nextColon) {
          tokens.push({ type: 'css-property', text: ident });
        } else if (CSS_KEYWORDS.has(ident.toLowerCase())) {
          tokens.push({ type: 'css-value-keyword', text: ident });
        } else {
          tokens.push({ type: 'plain', text: ident });
        }
        i += ident.length;
        continue;
      }

      // Fallback char
      tokens.push({ type: 'plain', text: line[i++] });
      continue;
    }

    // 6. Outside declaration block: Selectors
    // Class selector (.className)
    if (line[i] === '.') {
      let cls = '.';
      i++;
      while (i < len && /[a-zA-Z0-9_-]/.test(line[i])) {
        cls += line[i++];
      }
      tokens.push({ type: 'css-selector-class', text: cls });
      continue;
    }

    // ID selector (#idName)
    if (line[i] === '#') {
      let idSel = '#';
      i++;
      while (i < len && /[a-zA-Z0-9_-]/.test(line[i])) {
        idSel += line[i++];
      }
      tokens.push({ type: 'css-selector-id', text: idSel });
      continue;
    }

    // Pseudo class or pseudo element (:hover, ::before)
    if (line[i] === ':') {
      let pseudo = ':';
      i++;
      if (i < len && line[i] === ':') {
        pseudo += ':';
        i++;
      }
      while (i < len && /[a-zA-Z0-9_-]/.test(line[i])) {
        pseudo += line[i++];
      }
      tokens.push({ type: 'css-pseudo', text: pseudo });
      continue;
    }

    // Element or Universal selector (* or div or body)
    if (line[i] === '*') {
      tokens.push({ type: 'css-selector-elem', text: '*' });
      i++;
      continue;
    }

    const selElemMatch = line.slice(i).match(/^[a-zA-Z0-9_-]+/);
    if (selElemMatch) {
      tokens.push({ type: 'css-selector-elem', text: selElemMatch[0] });
      i += selElemMatch[0].length;
      continue;
    }

    // Fallback char in selector (e.g. '>', '+', '~')
    tokens.push({ type: 'css-punctuation', text: line[i++] });
  }

  return tokens;
}

/**
 * Tokenize a single line of HTML
 */
function tokenizeHtmlLine(
  line: string,
  state: { inStyleTag: boolean; inCssBlock: boolean; inHtmlComment: boolean }
): Token[] {
  // If we are inside multi-line HTML comment
  if (state.inHtmlComment) {
    const endIdx = line.indexOf('-->');
    if (endIdx !== -1) {
      state.inHtmlComment = false;
      const commentPart = line.slice(0, endIdx + 3);
      const rest = line.slice(endIdx + 3);
      return [
        { type: 'comment', text: commentPart },
        ...tokenizeHtmlLine(rest, state),
      ];
    }
    return [{ type: 'comment', text: line }];
  }

  // If inside <style> block, parse as CSS until </style>
  if (state.inStyleTag) {
    const closeStyleIdx = line.indexOf('</style>');
    if (closeStyleIdx !== -1) {
      const cssPart = line.slice(0, closeStyleIdx);
      const closeTag = '</style>';
      const rest = line.slice(closeStyleIdx + closeTag.length);
      state.inStyleTag = false;

      const cssTokens = tokenizeCssLine(cssPart, { inBlock: state.inCssBlock });
      const tagTokens: Token[] = [
        { type: 'tag-bracket', text: '</' },
        { type: 'tag-name', text: 'style' },
        { type: 'tag-bracket', text: '>' },
      ];
      const restTokens = tokenizeHtmlLine(rest, state);
      return [...cssTokens, ...tagTokens, ...restTokens];
    }
    const blockRef = { inBlock: state.inCssBlock };
    const tokens = tokenizeCssLine(line, blockRef);
    state.inCssBlock = blockRef.inBlock;
    return tokens;
  }

  const tokens: Token[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    // 1. HTML Comment: <!-- ... -->
    if (line.slice(i, i + 4) === '<!--') {
      const closeIdx = line.indexOf('-->', i + 4);
      if (closeIdx !== -1) {
        tokens.push({ type: 'comment', text: line.slice(i, closeIdx + 3) });
        i = closeIdx + 3;
      } else {
        state.inHtmlComment = true;
        tokens.push({ type: 'comment', text: line.slice(i) });
        i = len;
      }
      continue;
    }

    // 2. DOCTYPE declaration: <!DOCTYPE html>
    if (line.slice(i, i + 9).toUpperCase() === '<!DOCTYPE') {
      const closeIdx = line.indexOf('>', i);
      if (closeIdx !== -1) {
        tokens.push({ type: 'doctype', text: line.slice(i, closeIdx + 1) });
        i = closeIdx + 1;
      } else {
        tokens.push({ type: 'doctype', text: line.slice(i) });
        i = len;
      }
      continue;
    }

    // 3. HTML Tags: <tag or </tag
    if (line[i] === '<') {
      let isClosing = false;
      let startIdx = i;
      i++; // consume '<'

      if (i < len && line[i] === '/') {
        isClosing = true;
        i++; // consume '/'
      }

      // Tag name
      let tagName = '';
      while (i < len && /[a-zA-Z0-9_-]/.test(line[i])) {
        tagName += line[i++];
      }

      tokens.push({
        type: 'tag-bracket',
        text: isClosing ? '</' : '<',
      });

      if (tagName) {
        tokens.push({
          type: 'tag-name',
          text: tagName,
        });
      }

      // If it's an opening <style> tag, track state
      if (!isClosing && tagName.toLowerCase() === 'style') {
        state.inStyleTag = true;
      }

      // Parse attributes inside tag until '>' or '/>'
      while (i < len && line[i] !== '>') {
        if (line.slice(i, i + 2) === '/>') {
          tokens.push({ type: 'tag-bracket', text: '/>' });
          i += 2;
          break;
        }

        // Whitespace in tag
        if (/\s/.test(line[i])) {
          let ws = '';
          while (i < len && /\s/.test(line[i])) ws += line[i++];
          tokens.push({ type: 'plain', text: ws });
          continue;
        }

        // Attribute name
        const attrMatch = line.slice(i).match(/^[a-zA-Z0-9_:-]+/);
        if (attrMatch) {
          tokens.push({ type: 'attr-name', text: attrMatch[0] });
          i += attrMatch[0].length;

          // Check if followed by '='
          let wsBeforeEq = '';
          while (i < len && /\s/.test(line[i])) wsBeforeEq += line[i++];

          if (i < len && line[i] === '=') {
            if (wsBeforeEq) tokens.push({ type: 'plain', text: wsBeforeEq });
            tokens.push({ type: 'attr-equal', text: '=' });
            i++;

            // Whitespace after '='
            let wsAfterEq = '';
            while (i < len && /\s/.test(line[i])) wsAfterEq += line[i++];
            if (wsAfterEq) tokens.push({ type: 'plain', text: wsAfterEq });

            // Attribute value
            if (i < len && (line[i] === '"' || line[i] === "'")) {
              const quote = line[i++];
              let val = quote;
              while (i < len && line[i] !== quote) {
                val += line[i++];
              }
              if (i < len) val += line[i++]; // consume closing quote
              tokens.push({ type: 'attr-value', text: val });
            } else {
              // Unquoted attr value
              let unquoted = '';
              while (i < len && !/[\s>]/.test(line[i])) {
                unquoted += line[i++];
              }
              if (unquoted) {
                tokens.push({ type: 'attr-value', text: unquoted });
              }
            }
          }
          continue;
        }

        // Fallback character inside tag
        tokens.push({ type: 'plain', text: line[i++] });
      }

      // Closing '>'
      if (i < len && line[i] === '>') {
        tokens.push({ type: 'tag-bracket', text: '>' });
        i++;
      }
      continue;
    }

    // 4. Plain text between HTML tags
    let text = '';
    while (i < len && line[i] !== '<') {
      text += line[i++];
    }
    if (text) {
      tokens.push({ type: 'plain', text });
    }
  }

  return tokens;
}

/**
 * Tokenize entire code string line-by-line according to the language mode
 */
export function tokenizeCode(code: string, mode: LanguageMode): Token[][] {
  if (!code) return [];
  const lines = code.split('\n');

  if (mode === 'css') {
    const blockRef = { inBlock: false };
    return lines.map((line) => tokenizeCssLine(line, blockRef));
  }

  // HTML or Combined
  const state = {
    inStyleTag: false,
    inCssBlock: false,
    inHtmlComment: false,
  };

  return lines.map((line) => tokenizeHtmlLine(line, state));
}

export interface CodeHighlighterProps {
  code: string;
  mode: LanguageMode;
}

/**
 * Performant, rich syntax-highlighted code display
 */
export const CodeHighlighter: React.FC<CodeHighlighterProps> = ({ code, mode }) => {
  const tokenizedLines = React.useMemo(() => tokenizeCode(code, mode), [code, mode]);

  return (
    <div className="flex-1 font-mono text-[12px] leading-5 whitespace-pre">
      {tokenizedLines.map((lineTokens, lineIdx) => (
        <div key={lineIdx} className="h-5 leading-5 min-w-full">
          {lineTokens.length === 0 ? (
            <span className="inline-block">&nbsp;</span>
          ) : (
            lineTokens.map((tok, tokIdx) => (
              <span key={tokIdx} className={TOKEN_STYLES[tok.type]}>
                {tok.text}
              </span>
            ))
          )}
        </div>
      ))}
    </div>
  );
};
