import { describe, expect, it } from 'vitest';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';
import {
  sanitizeAst,
  sanitizeHtmlSnippet,
  isSafeStyleValue,
  isSafeSrcset,
  importHtml,
  htmlToNodes,
  createEmptyReport,
} from '../src/index.js';

describe('AST-based HTML Sanitizer (STORA-603)', () => {
  describe('XSS Payload Removal and URL Blocking', () => {
    it('removes <script> tags completely along with their inner text', () => {
      const input = '<div><script>alert(1)</script><p>Konten aman</p></div>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert(1)');
      expect(html).toContain('<p>Konten aman</p>');

      const dropped = report.diagnostics.filter((d) => d.code === 'ELEMENT_DROPPED');
      expect(dropped.length).toBeGreaterThanOrEqual(1);
      expect(dropped[0].location?.tagName).toBe('script');
      expect(dropped[0].severity).toBe('warning');
      expect(report.stats.droppedCount).toBeGreaterThanOrEqual(1);
    });

    it('strips inline event handler attributes like onerror', () => {
      const input = '<img src="x" onerror="alert(1)">';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).toContain('src="x"');
      expect(html).not.toContain('onerror');
      expect(html).not.toContain('alert(1)');

      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].details?.attribute).toBe('onerror');
      expect(blocked[0].location?.tagName).toBe('img');
      expect(blocked[0].location?.line).toBeDefined();
    });

    it('strips javascript: URLs in <a> href attributes', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('javascript:alert(1)');
      expect(html).toContain('<a>Click</a>');

      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].details?.attribute).toBe('href');
      expect(blocked[0].location?.tagName).toBe('a');
    });

    it('strips whitespace-encoded javascript: URLs in href', () => {
      const input = '<a href=" javascript: alert(1) ">Click</a>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('javascript');
      expect(html).toContain('<a>Click</a>');

      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].details?.attribute).toBe('href');
    });

    it('strips xlink:href in SVG containing javascript: URLs', () => {
      const input = '<svg><a xlink:href="javascript:alert(1)"><text>Click</text></a></svg>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('javascript:alert(1)');
      expect(html).toContain('<text>Click</text>');

      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].location?.tagName).toBe('a');
    });

    it('removes <script> inside <svg> elements', () => {
      const input = '<svg><script>alert(1)</script><circle cx="50" cy="50" r="40"></circle></svg>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('<script');
      expect(html).not.toContain('alert(1)');
      expect(html).toContain('<circle');

      const dropped = report.diagnostics.filter((d) => d.code === 'ELEMENT_DROPPED');
      expect(dropped.length).toBe(1);
      expect(dropped[0].location?.tagName).toBe('script');
    });

    it('strips data:text/html URLs in iframe src', () => {
      const input = '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('data:text/html');
      expect(html).not.toContain('alert(1)');
      expect(html).toContain('<iframe></iframe>');

      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].details?.attribute).toBe('src');
    });

    it('strips inline style with expression(...) and url(javascript:...)', () => {
      const input1 = '<div style="width: expression(alert(1)); color: red;">Test</div>';
      const res1 = sanitizeHtmlSnippet(input1);
      expect(res1.html).not.toContain('style');
      expect(res1.html).not.toContain('expression');
      expect(res1.html).toContain('<div>Test</div>');
      expect(res1.report.diagnostics.some((d) => d.code === 'URL_BLOCKED')).toBe(true);

      const input2 = '<div style="background-image: url(\'javascript:alert(1)\');">Test</div>';
      const res2 = sanitizeHtmlSnippet(input2);
      expect(res2.html).not.toContain('style');
      expect(res2.html).not.toContain('javascript');
      expect(res2.html).toContain('<div>Test</div>');
      expect(res2.report.diagnostics.some((d) => d.code === 'URL_BLOCKED')).toBe(true);
    });

    it('strips formaction attribute on buttons and inputs', () => {
      const input = '<form><button formaction="javascript:alert(1)">Submit</button></form>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('formaction');
      expect(html).not.toContain('javascript:alert(1)');
      expect(html).toContain('<button>Submit</button>');

      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].details?.attribute).toBe('formaction');
    });

    it('strips srcset attribute containing unsafe candidate URLs', () => {
      const input = '<img src="safe.jpg" srcset="safe.jpg 1x, javascript:evil 2x" alt="Hero">';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).toContain('src="safe.jpg"');
      expect(html).toContain('alt="Hero"');
      expect(html).not.toContain('srcset');
      expect(html).not.toContain('javascript:evil');

      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].details?.attribute).toBe('srcset');
    });
  });

  describe('Prohibited Tags and Attributes Removal', () => {
    it('completely removes prohibited tags: object, embed, applet, base, template, noscript', () => {
      const input = `
        <div>
          <object data="evil.swf"></object>
          <embed src="evil.swf" />
          <applet code="Evil.class"></applet>
          <base href="https://attacker.com/" />
          <template><p>secret</p></template>
          <noscript><p>no js</p></noscript>
          <p>Konten yang diizinkan</p>
        </div>
      `;
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('<object');
      expect(html).not.toContain('<embed');
      expect(html).not.toContain('<applet');
      expect(html).not.toContain('<base');
      expect(html).not.toContain('<template');
      expect(html).not.toContain('<noscript');
      expect(html).toContain('<p>Konten yang diizinkan</p>');

      const dropped = report.diagnostics.filter((d) => d.code === 'ELEMENT_DROPPED');
      expect(dropped.length).toBeGreaterThanOrEqual(6);
      expect(report.stats.droppedCount).toBeGreaterThanOrEqual(6);
    });

    it('completely removes frameset and frame documents', () => {
      const input = '<!DOCTYPE html><html><frameset><frame src="evil.html"></frameset></html>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('<frameset');
      expect(html).not.toContain('<frame');

      const dropped = report.diagnostics.filter((d) => d.code === 'ELEMENT_DROPPED');
      expect(dropped.length).toBeGreaterThanOrEqual(1);
    });

    it('drops <meta> with http-equiv but preserves standard metadata', () => {
      const input = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <meta name="description" content="Aman" />
            <meta http-equiv="refresh" content="0;url=http://evil.com" />
          </head>
          <body><p>Hello</p></body>
        </html>
      `;
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).toContain('<meta charset="utf-8"');
      expect(html).toContain('<meta name="description" content="Aman"');
      expect(html).not.toContain('http-equiv');

      const dropped = report.diagnostics.filter(
        (d) => d.code === 'ELEMENT_DROPPED' && d.details?.attribute === 'http-equiv',
      );
      expect(dropped.length).toBe(1);
    });

    it('drops <link> if rel is malicious or not stylesheet/icon', () => {
      const input = `
        <!DOCTYPE html>
        <html>
          <head>
            <link rel="stylesheet" href="/style.css" />
            <link rel="icon" href="/favicon.ico" />
            <link rel="import" href="/malicious.html" />
            <link rel="stylesheet" href="javascript:alert(1)" />
          </head>
          <body><p>Hello</p></body>
        </html>
      `;
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).toContain('href="/style.css"');
      expect(html).toContain('href="/favicon.ico"');
      expect(html).not.toContain('malicious.html');
      expect(html).not.toContain('javascript:alert(1)');

      const dropped = report.diagnostics.filter((d) => d.code === 'ELEMENT_DROPPED');
      expect(dropped.length).toBeGreaterThanOrEqual(2);
    });

    it('blocks dangerous SVG elements like foreignObject, animate, and set', () => {
      const input = `
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="red" />
          <foreignObject width="100" height="100">
            <div><p>Bad</p></div>
          </foreignObject>
          <animate attributeName="x" from="0" to="100" />
          <set attributeName="href" to="javascript:alert(1)" />
        </svg>
      `;
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).toContain('<circle');
      expect(html).not.toContain('foreignObject');
      expect(html).not.toContain('<animate');
      expect(html).not.toContain('<set');

      const dropped = report.diagnostics.filter((d) => d.code === 'ELEMENT_DROPPED');
      expect(dropped.length).toBe(3);
    });

    it('strips srcdoc attribute', () => {
      const input = '<iframe srcdoc="<script>alert(1)</script>"></iframe>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).not.toContain('srcdoc');
      expect(html).not.toContain('alert(1)');
      expect(html).toBe('<iframe></iframe>');
    });
  });

  describe('Safe Elements and Attributes Preservation', () => {
    it('preserves safe elements, layouts, and semantic tags', () => {
      const input = `
        <header class="header">
          <nav>
            <a href="https://example.com" title="Home">Home</a>
            <a href="/about">About</a>
            <a href="#features">Features</a>
          </nav>
        </header>
        <main>
          <h1>Judul Halaman</h1>
          <p>Paragraf dengan <strong>tebal</strong>, <em>miring</em>, dan <code>kode</code>.</p>
          <img src="https://cdn.example.com/logo.png" alt="Logo" width="200" height="80" loading="lazy" />
          <table>
            <thead>
              <tr><th>Kolom 1</th><th>Kolom 2</th></tr>
            </thead>
            <tbody>
              <tr><td>Baris 1</td><td>Nilai 1</td></tr>
            </tbody>
          </table>
          <form action="/submit" method="post">
            <label for="name">Nama:</label>
            <input type="text" id="name" name="name" value="Budi" required />
            <button type="submit">Kirim</button>
          </form>
        </main>
      `;
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).toContain('<header class="header">');
      expect(html).toContain('<a href="https://example.com" title="Home">Home</a>');
      expect(html).toContain('<a href="/about">About</a>');
      expect(html).toContain('<a href="#features">Features</a>');
      expect(html).toContain('<h1>Judul Halaman</h1>');
      expect(html).toContain('<strong>tebal</strong>');
      expect(html).toContain('<img src="https://cdn.example.com/logo.png" alt="Logo" width="200" height="80" loading="lazy">');
      expect(html).toContain('<table>');
      expect(html).toContain('<form action="/submit" method="post">');
      expect(html).toContain('<input type="text" id="name" name="name" value="Budi"');
      expect(html).toContain('required');
      expect(html).toContain('<button type="submit">Kirim</button>');

      expect(report.diagnostics).toHaveLength(0);
      expect(report.stats.droppedCount).toBe(0);
      expect(report.stats.fidelityScore).toBe(100);
    });

    it('preserves safe inline CSS styles', () => {
      const input = '<div style="color: red; font-size: 16px; margin: 10px 20px; display: flex;">Kotak</div>';
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).toContain('style="color: red; font-size: 16px; margin: 10px 20px; display: flex;"');
      expect(report.diagnostics).toHaveLength(0);
    });

    it('preserves safe data:image/ URLs and safe srcset', () => {
      const dataImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const input = `<img src="${dataImg}" srcset="/img-1x.jpg 1x, /img-2x.jpg 2x" alt="Icon">`;
      const { html, report } = sanitizeHtmlSnippet(input);

      expect(html).toContain('src="data:image/png;base64,');
      expect(html).toContain('srcset="/img-1x.jpg 1x, /img-2x.jpg 2x"');
      expect(report.diagnostics).toHaveLength(0);
    });
  });

  describe('Diagnostic Reporting and Source Locations', () => {
    it('records ELEMENT_DROPPED and URL_BLOCKED with line, column, and tagName', () => {
      const input = `<div>
  <script>evil()</script>
  <img src="valid.png" onerror="alert(1)" />
  <a href="javascript:void(0)">Link</a>
</div>`;
      const { report } = sanitizeHtmlSnippet(input);

      const scriptDiag = report.diagnostics.find(
        (d) => d.code === 'ELEMENT_DROPPED' && d.location?.tagName === 'script',
      );
      expect(scriptDiag).toBeDefined();
      expect(scriptDiag?.severity).toBe('warning');
      expect(scriptDiag?.location?.line).toBe(2);
      expect(scriptDiag?.location?.column).toBe(3);

      const onerrorDiag = report.diagnostics.find(
        (d) => d.code === 'URL_BLOCKED' && d.details?.attribute === 'onerror',
      );
      expect(onerrorDiag).toBeDefined();
      expect(onerrorDiag?.severity).toBe('warning');
      expect(onerrorDiag?.location?.tagName).toBe('img');
      expect(onerrorDiag?.location?.line).toBe(3);

      const hrefDiag = report.diagnostics.find(
        (d) => d.code === 'URL_BLOCKED' && d.details?.attribute === 'href',
      );
      expect(hrefDiag).toBeDefined();
      expect(hrefDiag?.location?.tagName).toBe('a');
      expect(hrefDiag?.location?.line).toBe(4);
    });
  });

  describe('Direct AST Sanitization (sanitizeAst)', () => {
    it('mutates parsed parse5 AST in-place', () => {
      const ast = parseFragment('<div><script>alert(1)</script><p>Text</p></div>', {
        sourceCodeLocationInfo: true,
      });
      const report = createEmptyReport();

      sanitizeAst(ast, report);

      const div = (ast as DefaultTreeAdapterMap['documentFragment']).childNodes[0] as DefaultTreeAdapterMap['element'];
      expect(div.childNodes).toHaveLength(1);
      expect((div.childNodes[0] as DefaultTreeAdapterMap['element']).tagName).toBe('p');
      expect(report.stats.droppedCount).toBe(1);
    });
  });

  describe('Helper Functions Validation', () => {
    it('isSafeStyleValue correctly identifies dangerous and safe CSS', () => {
      expect(isSafeStyleValue('color: blue; font-weight: bold;')).toBe(true);
      expect(isSafeStyleValue('background-image: url("https://cdn.example.com/bg.png");')).toBe(true);
      expect(isSafeStyleValue('width: expression(alert(1));')).toBe(false);
      expect(isSafeStyleValue('background: url(javascript:alert(1));')).toBe(false);
      expect(isSafeStyleValue('behavior: url(test.htc);')).toBe(false);
      expect(isSafeStyleValue('-moz-binding: url(test.xml#x);')).toBe(false);
      expect(isSafeStyleValue('@import url(evil.css);')).toBe(false);
      expect(isSafeStyleValue('/* safe comment */ color: red;')).toBe(true);
      expect(isSafeStyleValue('java/*comment*/script:alert(1)')).toBe(false);
    });

    it('isSafeSrcset validates srcset candidates', () => {
      expect(isSafeSrcset('safe.jpg 1x, safe-2x.jpg 2x')).toBe(true);
      expect(isSafeSrcset('https://example.com/1.png 480w, https://example.com/2.png 800w')).toBe(true);
      expect(isSafeSrcset('safe.jpg 1x, javascript:alert(1) 2x')).toBe(false);
      expect(isSafeSrcset('data:text/html,evil 1x')).toBe(false);
    });
  });

  describe('Integration with importHtml and htmlToNodes', () => {
    it('runs sanitizer during importHtml and reports dropped scripts', async () => {
      const html = `<!DOCTYPE html>
<html>
  <head>
    <title>Halaman Uji</title>
  </head>
  <body>
    <h1>Selamat Datang</h1>
    <script>alert('xss')</script>
    <img src="pic.jpg" onerror="alert(2)" />
  </body>
</html>`;

      const result = await importHtml(html);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      const dropped = result.report.diagnostics.filter((d) => d.code === 'ELEMENT_DROPPED');
      expect(dropped.length).toBeGreaterThanOrEqual(1);

      const blocked = result.report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBeGreaterThanOrEqual(1);

      expect(result.report.stats.droppedCount).toBeGreaterThanOrEqual(1);
    });

    it('runs sanitizer during htmlToNodes on fragments', async () => {
      const fragment = '<div onclick="hack()"><script>bad()</script><p>Aman</p></div>';
      const result = await htmlToNodes(fragment);

      expect(result.success).toBe(true);
      expect(result.report.diagnostics.some((d) => d.code === 'ELEMENT_DROPPED')).toBe(true);
      expect(result.report.diagnostics.some((d) => d.code === 'URL_BLOCKED')).toBe(true);
    });
  });
});
