import { describe, expect, it, vi } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import {
  importHtmlZip,
  resolveEntryHtmlPath,
  resolveInArchive,
  getMimeType,
} from '../src/zip-import.js';
import type { PageNode } from '../src/types.js';

describe('Zip Import Module (@kubuild/html-import)', () => {
  describe('getMimeType', () => {
    it('infers correct mime types for common asset extensions', () => {
      expect(getMimeType('logo.png')).toBe('image/png');
      expect(getMimeType('hero.jpg')).toBe('image/jpeg');
      expect(getMimeType('banner.jpeg')).toBe('image/jpeg');
      expect(getMimeType('photo.webp')).toBe('image/webp');
      expect(getMimeType('icon.svg')).toBe('image/svg+xml');
      expect(getMimeType('video.mp4')).toBe('video/mp4');
      expect(getMimeType('clip.webm')).toBe('video/webm');
      expect(getMimeType('font.woff2')).toBe('font/woff2');
      expect(getMimeType('font.woff')).toBe('font/woff');
      expect(getMimeType('font.ttf')).toBe('font/ttf');
      expect(getMimeType('styles.css')).toBe('text/css');
      expect(getMimeType('index.html')).toBe('text/html');
      expect(getMimeType('data.bin')).toBe('application/octet-stream');
    });
  });

  describe('resolveEntryHtmlPath', () => {
    it('selects explicit entry when provided and present', () => {
      const paths = ['index.html', 'pages/about.html'];
      const res = resolveEntryHtmlPath(paths, 'pages/about.html');
      expect(res.entryPath).toBe('pages/about.html');
      expect(res.error).toBeUndefined();
    });

    it('returns error when specified entry is missing', () => {
      const paths = ['index.html'];
      const res = resolveEntryHtmlPath(paths, 'missing.html');
      expect(res.entryPath).toBeUndefined();
      expect(res.error).toContain('Specified entry HTML file not found in archive');
    });

    it('selects root index.html when present', () => {
      const paths = ['assets/logo.png', 'index.html', 'about.html'];
      const res = resolveEntryHtmlPath(paths);
      expect(res.entryPath).toBe('index.html');
    });

    it('selects index.htm case-insensitively', () => {
      const paths = ['INDEX.HTM', 'styles.css'];
      const res = resolveEntryHtmlPath(paths);
      expect(res.entryPath).toBe('INDEX.HTM');
    });

    it('selects nested index.html if single wrapper directory exists', () => {
      const paths = ['dist/index.html', 'dist/styles.css'];
      const res = resolveEntryHtmlPath(paths);
      expect(res.entryPath).toBe('dist/index.html');
    });

    it('selects single non-index html file', () => {
      const paths = ['landing.html', 'styles.css'];
      const res = resolveEntryHtmlPath(paths);
      expect(res.entryPath).toBe('landing.html');
    });

    it('rejects with error when multiple non-index html files exist without index.html', () => {
      const paths = ['page1.html', 'page2.html'];
      const res = resolveEntryHtmlPath(paths);
      expect(res.entryPath).toBeUndefined();
      expect(res.error).toBe('Ambiguous HTML entry: multiple .html files found without index.html');
    });

    it('rejects with error when zero html files exist', () => {
      const paths = ['styles.css', 'logo.png'];
      const res = resolveEntryHtmlPath(paths);
      expect(res.entryPath).toBeUndefined();
      expect(res.error).toBe('No HTML entry file found in archive');
    });
  });

  describe('resolveInArchive', () => {
    const keyMap = new Map<string, { path: string; data: Uint8Array }>([
      ['styles.css', { path: 'styles.css', data: new Uint8Array([1]) }],
      ['assets/logo.png', { path: 'assets/logo.png', data: new Uint8Array([2]) }],
      ['dist/css/main.css', { path: 'dist/css/main.css', data: new Uint8Array([3]) }],
    ]);

    it('resolves relative to baseDir', () => {
      const found = resolveInArchive('dist', 'css/main.css', keyMap);
      expect(found?.path).toBe('dist/css/main.css');
    });

    it('resolves with leading ./ or /', () => {
      const found = resolveInArchive('', './styles.css', keyMap);
      expect(found?.path).toBe('styles.css');

      const foundSlash = resolveInArchive('dist', '/assets/logo.png', keyMap);
      expect(foundSlash?.path).toBe('assets/logo.png');
    });

    it('strips query strings and hashes', () => {
      const found = resolveInArchive('', 'assets/logo.png?v=1.0#preview', keyMap);
      expect(found?.path).toBe('assets/logo.png');
    });
  });

  describe('importHtmlZip — Happy Paths', () => {
    it('successfully imports valid zip with index.html + styles.css + assets/logo.png', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
  <head>
    <title>Zip Test Page</title>
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <header class="hero-header">
      <h1 class="title">Welcome</h1>
      <img src="assets/logo.png" alt="Company Logo">
    </header>
  </body>
</html>`;

      const cssContent = `
.title {
  color: #ff0000;
  font-size: 24px;
}
.hero-header {
  background-color: #f0f0f0;
}
`;

      const logoPngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

      const archive = zipSync({
        'index.html': strToU8(htmlContent),
        'styles.css': strToU8(cssContent),
        'assets/logo.png': logoPngBytes,
      });

      const result = await importHtmlZip(archive);

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.entryHtmlPath).toBe('index.html');
      expect(result.document).toBeDefined();

      // Verify metadata
      expect(result.document?.metadata.title).toBe('Zip Test Page');

      // Verify PageDocument structure
      const rootPage = result.document?.document;
      expect(rootPage?.type).toBe('page');

      // Find image node and verify asset resolution
      function findNodes(node: PageNode, predicate: (n: PageNode) => boolean): PageNode[] {
        const matches: PageNode[] = [];
        if (predicate(node)) matches.push(node);
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            matches.push(...findNodes(child, predicate));
          }
        }
        return matches;
      }

      const imgNodes = findNodes(rootPage!, (n) => n.type === 'image');
      expect(imgNodes.length).toBeGreaterThanOrEqual(1);
      expect(imgNodes[0].props?.src).toBe('assets/logo.png');

      // Verify styles were cascaded from styles.css
      const headingNodes = findNodes(rootPage!, (n) => n.type === 'heading');
      expect(headingNodes.length).toBeGreaterThanOrEqual(1);
      const headingStyles = headingNodes[0].styles?.base as Record<string, unknown>;
      expect(headingStyles?.color).toBe('#ff0000');

      // Verify archiveAssets extracted
      expect(result.archiveAssets).toBeDefined();
      expect(result.archiveAssets).toHaveLength(1);
      expect(result.archiveAssets?.[0]).toEqual({
        path: 'assets/logo.png',
        data: logoPngBytes,
        mimeType: 'image/png',
      });
    });

    it('automatically picks single non-index HTML file (e.g. landing.html) as entry', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
  <head><title>Landing Page</title></head>
  <body>
    <main>
      <h1>Direct Landing</h1>
      <p>Single HTML file without index.</p>
    </main>
  </body>
</html>`;

      const archive = zipSync({
        'landing.html': strToU8(htmlContent),
      });

      const result = await importHtmlZip(archive);

      expect(result.success).toBe(true);
      expect(result.entryHtmlPath).toBe('landing.html');
      expect(result.document?.metadata.title).toBe('Landing Page');
    });

    it('respects options.entryHtmlPath when explicitly specified', async () => {
      const archive = zipSync({
        'page1.html': strToU8('<!DOCTYPE html><html><body><h1>Page 1</h1></body></html>'),
        'page2.html': strToU8('<!DOCTYPE html><html><body><h1>Page 2</h1></body></html>'),
      });

      const result = await importHtmlZip(archive, {
        entryHtmlPath: 'page2.html',
      });

      expect(result.success).toBe(true);
      expect(result.entryHtmlPath).toBe('page2.html');
    });

    it('works with wrapper subfolder (e.g. site/index.html + site/styles.css)', async () => {
      const archive = zipSync({
        'my-site/index.html': strToU8(
          '<!DOCTYPE html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>Wrapped</h1></body></html>',
        ),
        'my-site/styles.css': strToU8('h1 { color: #0000ff; }'),
        'my-site/images/hero.webp': new Uint8Array([1, 2, 3, 4]),
      });

      const result = await importHtmlZip(archive);

      expect(result.success).toBe(true);
      expect(result.entryHtmlPath).toBe('my-site/index.html');
      expect(result.archiveAssets).toHaveLength(1);
      expect(result.archiveAssets?.[0].path).toBe('my-site/images/hero.webp');
      expect(result.archiveAssets?.[0].mimeType).toBe('image/webp');
    });

    it('calls options.assetResolver when custom resolver is provided', async () => {
      const htmlContent = `<!DOCTYPE html>
<html>
  <body>
    <img src="assets/banner.png" alt="Banner">
  </body>
</html>`;

      const bannerBytes = new Uint8Array([1, 2, 3]);
      const archive = zipSync({
        'index.html': strToU8(htmlContent),
        'assets/banner.png': bannerBytes,
      });

      const resolver = vi.fn().mockImplementation(async ({ url, type }) => {
        expect(type).toBe('image');
        expect(url).toBe('assets/banner.png');
        return 'https://cdn.example.com/hosted/banner-123.png';
      });

      const result = await importHtmlZip(archive, {
        assetResolver: resolver,
      });

      expect(result.success).toBe(true);
      expect(resolver).toHaveBeenCalledTimes(1);

      const rootPage = result.document?.document;
      const imgNode = rootPage?.children?.[0];
      expect(imgNode?.props?.src).toBe('https://cdn.example.com/hosted/banner-123.png');
    });
  });

  describe('importHtmlZip — Error & Security Checks', () => {
    it('rejects ambiguous HTML files without index.html', async () => {
      const archive = zipSync({
        'page1.html': strToU8('<h1>Page 1</h1>'),
        'page2.html': strToU8('<h1>Page 2</h1>'),
      });

      const result = await importHtmlZip(archive);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Ambiguous HTML entry: multiple .html files found without index.html',
      );
    });

    it('rejects zero HTML files in archive', async () => {
      const archive = zipSync({
        'styles.css': strToU8('body { margin: 0; }'),
        'assets/logo.png': new Uint8Array([1, 2, 3]),
      });

      const result = await importHtmlZip(archive);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No HTML entry file found in archive');
    });

    it('rejects zip-slip attack (../../evil.txt)', async () => {
      const archive = zipSync({
        '../../evil.txt': strToU8('malicious content'),
        'index.html': strToU8('<h1>Normal</h1>'),
      });

      const result = await importHtmlZip(archive);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Malicious path in zip archive');
    });

    it('rejects absolute path traversal (/etc/passwd)', async () => {
      const archive = zipSync({
        '/etc/passwd': strToU8('root:...'),
        'index.html': strToU8('<h1>Normal</h1>'),
      });

      const result = await importHtmlZip(archive);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Malicious path in zip archive');
    });

    it('rejects dangerous executable files (assets/malware.exe)', async () => {
      const archive = zipSync({
        'index.html': strToU8('<h1>Site</h1>'),
        'assets/malware.exe': new Uint8Array([77, 90, 144, 0]),
      });

      const result = await importHtmlZip(archive);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dangerous or prohibited file found in archive');
      expect(result.error).toContain('assets/malware.exe');
    });

    it('rejects dangerous script files (script.sh, shell.php, malware.bat)', async () => {
      for (const dangerousName of ['script.sh', 'shell.php', 'malware.bat']) {
        const archive = zipSync({
          'index.html': strToU8('<h1>Site</h1>'),
          [dangerousName]: strToU8('echo hello'),
        });

        const result = await importHtmlZip(archive);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Dangerous or prohibited file found in archive');
      }
    });

    it('rejects zip bomb with excessive compression expansion ratio', async () => {
      // 12 MB buffer of repeating zeros compresses down to ~12 KB (ratio ~1000:1)
      const uncompressedPayload = new Uint8Array(12 * 1024 * 1024);
      const archive = zipSync({
        'index.html': strToU8('<h1>Safe Entry</h1>'),
        'bomb.txt': uncompressedPayload,
      });

      const result = await importHtmlZip(archive);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Zip bomb detected');
    });

    it('rejects archive exceeding maxDocumentSizeBytes limit', async () => {
      const archive = zipSync({
        'index.html': strToU8('<h1>Safe Entry</h1>'),
      });

      const result = await importHtmlZip(archive, {
        limits: {
          maxDocumentSizeBytes: 10, // tiny limit
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Archive size limit exceeded');
    });

    it('rejects empty (0 byte) archive', async () => {
      const emptyBuffer = new Uint8Array(0);
      const result = await importHtmlZip(emptyBuffer);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Archive is empty or 0 bytes');
    });

    it('rejects corrupt archive data', async () => {
      const corruptData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const result = await importHtmlZip(corruptData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to unzip archive');
    });
  });
});
