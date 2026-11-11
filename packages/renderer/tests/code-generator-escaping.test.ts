import { describe, it, expect } from 'vitest';
import { createBlankDocument } from '@kubuild/core';
import type { Node, PageDocument } from '@kubuild/schema';
import { generateStandaloneHtml, generateDocumentCss } from '../src/code-generator';
import { escapeCssIdentifier, nodeAttributeSelector } from '../src/styles';

function docWith(node: Node): PageDocument {
  const doc = createBlankDocument('Escaping');
  doc.document.children = [node];
  return doc;
}

const section = (id: string, styles: Node['styles'] = { base: { color: 'red' } }, type = 'section'): Node => ({
  id,
  type,
  props: {},
  styles,
  children: [],
});

/** Everything between the page's own `<style>` and `</style>`, plus whether anything leaked past it. */
function countTags(html: string) {
  return {
    styleClose: html.match(/<\/style/gi)?.length ?? 0,
    img: html.match(/<img/gi)?.length ?? 0,
    script: html.match(/<script/gi)?.length ?? 0,
  };
}

describe('standalone HTML escaping of untrusted document data', () => {
  it('keeps a hostile node id inside the class attribute and the CSS selector', () => {
    const id = 'x"><img src=x onerror=alert(1)>{}</style><script>alert(2)</script>';
    const html = generateStandaloneHtml(docWith(section(id)));
    expect(countTags(html)).toEqual({ styleClose: 1, img: 0, script: 0 });
    expect(html).toContain('class="kb-section kb-node-x&quot;&gt;&lt;img');
    expect(html).toContain(`.kb-node-${escapeCssIdentifier(id)} {`);
  });

  it('keeps a hostile node type inside the class attribute', () => {
    const html = generateStandaloneHtml(docWith(section('n', {}, 'x"><img src=x onerror=alert(1)>')));
    expect(countTags(html).img).toBe(0);
  });

  it('cannot be broken out of by a style value', () => {
    const html = generateStandaloneHtml(
      docWith(section('n', { base: { color: 'red</style><img src=x onerror=alert(1)>' } })),
    );
    expect(countTags(html)).toEqual({ styleClose: 1, img: 0, script: 0 });
  });

  it('leaves ordinary ids and their selectors byte-identical', () => {
    const doc = docWith(section('hero_1-a', { base: { color: 'red' }, mobile: { color: 'blue' } }));
    const html = generateStandaloneHtml(doc);
    expect(html).toContain('class="kb-section kb-node-hero_1-a"');
    expect(generateDocumentCss(doc)).toContain('.kb-node-hero_1-a {');
    expect(generateDocumentCss(doc)).toMatch(/@media[^{]+\{\s+\.kb-node-hero_1-a \{/);
  });
});

describe('escapeCssIdentifier', () => {
  it('hex-escapes every ASCII character outside [A-Za-z0-9_-] and keeps non-ASCII', () => {
    expect(escapeCssIdentifier('a-b_C9')).toBe('a-b_C9');
    expect(escapeCssIdentifier('a"b')).toBe('a\\22 b');
    expect(escapeCssIdentifier('</style>')).toBe('\\3c \\2f style\\3e ');
    expect(escapeCssIdentifier('héllo')).toBe('héllo');
  });

  it('is used by the runtime attribute selectors', () => {
    expect(nodeAttributeSelector('a"]{}<b')).toBe('[data-kubuild-node="a\\22 \\5d \\7b \\7d \\3c b"]');
  });
});

describe('html-embed in standalone HTML', () => {
  const embed = (props: Record<string, unknown>): Node => ({ id: 'e', type: 'html-embed', props, styles: {}, children: [] });
  const payload = '<p>ok</p><script>alert(1)</script><img src=x onerror="alert(2)">';

  it('is sanitized like the runtime renderer does', () => {
    const html = generateStandaloneHtml(docWith(embed({ html: payload })));
    expect(html).toContain('<p>ok</p>');
    expect(html).not.toContain('alert(1)');
    expect(html).not.toContain('onerror');
  });

  it('passes through untouched only when the author opted out with sanitize: false', () => {
    const html = generateStandaloneHtml(docWith(embed({ html: payload, sanitize: false })));
    expect(html).toContain('<script>alert(1)</script>');
  });
});

describe('media URLs in standalone HTML', () => {
  const media = (type: string, props: Record<string, unknown>, id = 'm'): Node => ({ id, type, props, styles: {}, children: [] });

  it('uses an asset reference fallback URL instead of printing the object', () => {
    const html = generateStandaloneHtml(
      docWith(media('image', { src: { type: 'asset', assetId: 'a', fallbackUrl: 'https://cdn.example.com/a.png' } })),
    );
    expect(html).toContain('src="https://cdn.example.com/a.png"');
    expect(html).not.toContain('[object Object]');
    expect(generateStandaloneHtml(docWith(media('image', { src: { type: 'asset', assetId: 'a' } })))).toContain('src=""');
  });

  it('escapes the node class on YouTube and Vimeo wrappers too', () => {
    for (const src of ['https://youtu.be/dQw4w9WgXcQ', 'https://vimeo.com/123456']) {
      const html = generateStandaloneHtml(docWith(media('video', { src }, 'v"><img src=x onerror=alert(1)>')));
      expect(html).not.toMatch(/<img/i);
      expect(html).toContain('class="kb-video-wrapper kb-node-v&quot;&gt;&lt;img');
    }
  });
});
