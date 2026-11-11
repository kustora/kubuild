/**
 * Splits an element's text into animatable spans and puts it back exactly.
 *
 * Every text node is replaced by spans (words, or characters grouped in unbreakable word
 * spans) and restored on cleanup by reinserting the *same* text node objects, so a framework
 * that holds references to them (React) finds them where it left them. Screen readers get a
 * visually hidden copy of the full text; the split pieces are `aria-hidden`.
 */

export type SplitMode = 'word' | 'char';

export interface SplitText {
  pieces: HTMLElement[];
  restore(): void;
}

const SKIP = /^(SCRIPT|STYLE|TEXTAREA|SVG|svg)$/;
const VISUALLY_HIDDEN =
  'position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0';

export function splitText(root: HTMLElement, mode: SplitMode): SplitText {
  const doc = root.ownerDocument;
  const textNodes: Text[] = [];
  const walk = (node: Node): void => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        if ((child as Text).data.trim() !== '') textNodes.push(child as Text);
      } else if (child.nodeType === 1 && !SKIP.test((child as Element).tagName)) {
        walk(child);
      }
    }
  };
  walk(root);
  if (textNodes.length === 0) return { pieces: [], restore: () => {} };

  const label = doc.createElement('span');
  label.style.cssText = VISUALLY_HIDDEN;
  label.textContent = root.textContent;

  const pieces: HTMLElement[] = [];
  const replaced: Array<{ original: Text; nodes: ChildNode[] }> = [];
  const span = (text: string, display: string): HTMLElement => {
    const el = doc.createElement('span');
    el.style.display = display;
    if (text) el.textContent = text;
    return el;
  };

  for (const original of textNodes) {
    const nodes: ChildNode[] = [];
    for (const token of original.data.split(/(\s+)/)) {
      if (token === '') continue;
      if (/^\s+$/.test(token)) {
        nodes.push(doc.createTextNode(token));
        continue;
      }
      if (mode === 'word') {
        const word = span(token, 'inline-block');
        word.setAttribute('aria-hidden', 'true');
        pieces.push(word);
        nodes.push(word);
      } else {
        const word = span('', 'inline-block');
        word.style.whiteSpace = 'nowrap';
        word.setAttribute('aria-hidden', 'true');
        for (const char of Array.from(token)) {
          const piece = span(char, 'inline-block');
          pieces.push(piece);
          word.appendChild(piece);
        }
        nodes.push(word);
      }
    }
    const parent = original.parentNode!;
    for (const node of nodes) parent.insertBefore(node, original);
    parent.removeChild(original);
    replaced.push({ original, nodes });
  }
  root.insertBefore(label, root.firstChild);

  return {
    pieces,
    restore() {
      label.remove();
      for (const { original, nodes } of replaced) {
        const anchor = nodes[0];
        anchor.parentNode?.insertBefore(original, anchor);
        for (const node of nodes) node.remove();
      }
    },
  };
}
