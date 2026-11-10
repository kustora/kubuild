import { describe, expect, it, vi } from 'vitest';
import type { AssetReference, PageDocument } from '@kubuild/schema';
import {
  createEmptyReport,
  extractFilenameFromUrl,
  extractFontFamiliesFromCss,
  extractFontFamiliesFromGoogleFontsUrl,
  extractPathnameFromUrl,
  fontNameToTokenKey,
  htmlToNodes,
  importHtml,
  isDangerousAssetUrl,
  processDocumentAssets,
  resolveAssetUrl,
  type PageNode,
} from '../src/index.js';

describe('Asset Resolution and Rehosting (STORA-613)', () => {
  describe('URL Resolution (resolveAssetUrl)', () => {
    it('resolves relative URLs against standard baseUrl', () => {
      const baseUrl = 'https://example.com/sub/dir/index.html';

      expect(resolveAssetUrl('images/hero.png', baseUrl)).toBe(
        'https://example.com/sub/dir/images/hero.png',
      );
      expect(resolveAssetUrl('./cat.jpg', baseUrl)).toBe(
        'https://example.com/sub/dir/cat.jpg',
      );
      expect(resolveAssetUrl('../banner.webp', baseUrl)).toBe(
        'https://example.com/sub/banner.webp',
      );
      expect(resolveAssetUrl('/logo.svg', baseUrl)).toBe(
        'https://example.com/logo.svg',
      );
    });

    it('resolves against root and directory-trailing baseUrl', () => {
      const baseUrl = 'https://cdn.example.org/assets/';

      expect(resolveAssetUrl('photo.jpg', baseUrl)).toBe(
        'https://cdn.example.org/assets/photo.jpg',
      );
      expect(resolveAssetUrl('/root.png', baseUrl)).toBe(
        'https://cdn.example.org/root.png',
      );
      expect(resolveAssetUrl('./nested/icon.svg', baseUrl)).toBe(
        'https://cdn.example.org/assets/nested/icon.svg',
      );
    });

    it('resolves protocol-relative URLs against baseUrl scheme', () => {
      expect(resolveAssetUrl('//images.unsplash.com/photo.jpg', 'https://example.com')).toBe(
        'https://images.unsplash.com/photo.jpg',
      );
      expect(resolveAssetUrl('//images.unsplash.com/photo.jpg', 'http://example.com')).toBe(
        'http://images.unsplash.com/photo.jpg',
      );
    });

    it('preserves absolute http and https URLs unchanged', () => {
      const absUrl = 'https://external-cdn.com/lib/bundle.png';
      expect(resolveAssetUrl(absUrl, 'https://example.com')).toBe(absUrl);
      expect(resolveAssetUrl('http://insecure.site/test.gif', 'https://example.com')).toBe(
        'http://insecure.site/test.gif',
      );
    });

    it('preserves safe data:image/ URLs unchanged', () => {
      const dataUri =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      expect(resolveAssetUrl(dataUri, 'https://example.com')).toBe(dataUri);
      expect(resolveAssetUrl(dataUri)).toBe(dataUri);
    });

    it('keeps relative paths safely when baseUrl is absent or invalid', () => {
      expect(resolveAssetUrl('/logo.svg')).toBe('/logo.svg');
      expect(resolveAssetUrl('./cat.jpg')).toBe('./cat.jpg');
      expect(resolveAssetUrl('images/hero.png')).toBe('images/hero.png');
      expect(resolveAssetUrl('../banner.webp')).toBe('../banner.webp');

      expect(resolveAssetUrl('/logo.svg', 'not-a-valid-url')).toBe('/logo.svg');
      expect(resolveAssetUrl('./cat.jpg', 'invalid-scheme://::bad')).toBe('./cat.jpg');
    });

    it('blocks dangerous URL schemes via isSafeUrl returning empty string', () => {
      expect(resolveAssetUrl('javascript:alert(1)', 'https://example.com')).toBe('');
      expect(resolveAssetUrl('JAVASCRIPT:void(0)', 'https://example.com')).toBe('');
      expect(resolveAssetUrl('vbscript:msgbox(1)', 'https://example.com')).toBe('');
      expect(
        resolveAssetUrl(
          'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
          'https://example.com',
        ),
      ).toBe('');
      expect(resolveAssetUrl('file:///etc/passwd', 'https://example.com')).toBe('');
    });
  });

  describe('Dangerous Filename Checks and Extraction', () => {
    it('extracts pathnames and filenames accurately', () => {
      expect(extractPathnameFromUrl('https://example.com/assets/images/hero.png?query=1#hash')).toBe(
        '/assets/images/hero.png',
      );
      expect(extractFilenameFromUrl('https://example.com/assets/images/hero.png?query=1#hash')).toBe(
        'hero.png',
      );
      expect(extractFilenameFromUrl('/scripts/payload.exe')).toBe('payload.exe');
      expect(extractFilenameFromUrl('malware.bat')).toBe('malware.bat');
    });

    it('identifies dangerous asset filenames and double extensions', () => {
      expect(isDangerousAssetUrl('payload.exe')).toBe(true);
      expect(isDangerousAssetUrl('shell.php')).toBe(true);
      expect(isDangerousAssetUrl('script.sh')).toBe(true);
      expect(isDangerousAssetUrl('malware.bat')).toBe(true);
      expect(isDangerousAssetUrl('backdoor.py')).toBe(true);
      expect(isDangerousAssetUrl('trojan.exe.png')).toBe(true);
      expect(isDangerousAssetUrl('banner.jpg.php')).toBe(true);
      expect(isDangerousAssetUrl('https://example.com/files/exploit.js?v=2')).toBe(true);

      expect(isDangerousAssetUrl('hero.png')).toBe(false);
      expect(isDangerousAssetUrl('photo.webp')).toBe(false);
      expect(isDangerousAssetUrl('graphic.svg')).toBe(false);
      expect(isDangerousAssetUrl('logo.jpeg')).toBe(false);
      expect(isDangerousAssetUrl('https://example.com/assets/video.mp4')).toBe(false);
    });

    it('rejects dangerous filenames in image src, strips prop, and records URL_BLOCKED', async () => {
      const nodes: PageNode[] = [
        {
          id: 'img-1',
          type: 'image',
          props: {
            src: 'malware.exe',
            alt: 'Malicious file',
          },
        },
      ];

      const report = createEmptyReport();
      const { nodes: resultNodes } = await processDocumentAssets(
        nodes,
        { baseUrl: 'https://example.com' },
        report,
      );

      expect(resultNodes[0].props?.src).toBeUndefined();
      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].severity).toBe('warning');
      expect(blocked[0].location?.path).toBe('malware.exe');
    });

    it('rejects dangerous filenames in video src and poster, strips props, and records URL_BLOCKED', async () => {
      const nodes: PageNode[] = [
        {
          id: 'vid-1',
          type: 'video',
          props: {
            src: 'https://example.com/shell.php',
            poster: 'trojan.exe.png',
          },
        },
      ];

      const report = createEmptyReport();
      const { nodes: resultNodes } = await processDocumentAssets(nodes, {}, report);

      expect(resultNodes[0].props?.src).toBeUndefined();
      expect(resultNodes[0].props?.poster).toBeUndefined();
      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(2);
      expect(blocked.every((d) => d.severity === 'warning')).toBe(true);
    });

    it('rejects dangerous filenames in style backgroundImage url(...)', async () => {
      const nodes: PageNode[] = [
        {
          id: 'div-1',
          type: 'container',
          props: {},
          styles: {
            base: {
              backgroundImage: 'url("https://example.com/backdoor.py")',
              color: '#333333',
            },
          },
        },
      ];

      const report = createEmptyReport();
      const { nodes: resultNodes } = await processDocumentAssets(nodes, {}, report);

      const baseStyles = resultNodes[0].styles?.base as Record<string, unknown>;
      expect(baseStyles.backgroundImage).toBeUndefined();
      expect(baseStyles.color).toBe('#333333');

      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].severity).toBe('warning');
    });

    it('filters out dangerous candidate URLs from image srcset', async () => {
      const nodes: PageNode[] = [
        {
          id: 'img-srcset',
          type: 'image',
          props: {
            src: 'safe.jpg',
            srcset: 'safe.jpg 1x, malware.exe 2x, hero-2x.png 3x',
          },
        },
      ];

      const report = createEmptyReport();
      const { nodes: resultNodes } = await processDocumentAssets(nodes, {}, report);

      expect(resultNodes[0].props?.src).toBe('safe.jpg');
      expect(resultNodes[0].props?.srcset).toBe('safe.jpg 1x, hero-2x.png 3x');

      const blocked = report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBe(1);
      expect(blocked[0].location?.path).toBe('malware.exe');
    });
  });

  describe('Asset Rehosting via assetResolver', () => {
    it('calls assetResolver for image src and replaces value with resolved asset', async () => {
      const nodes: PageNode[] = [
        {
          id: 'img-1',
          type: 'image',
          props: {
            src: 'images/hero.png',
            alt: 'Hero banner',
          },
        },
      ];

      const resolver = vi.fn().mockImplementation(async ({ url, type }) => {
        expect(type).toBe('image');
        expect(url).toBe('https://example.com/sub/images/hero.png');
        return 'https://cdn.kubuild.io/rehosted/hero-hash.png';
      });

      const report = createEmptyReport();
      const { nodes: resultNodes } = await processDocumentAssets(
        nodes,
        {
          baseUrl: 'https://example.com/sub/',
          assetResolver: resolver,
        },
        report,
      );

      expect(resolver).toHaveBeenCalledTimes(1);
      expect(resultNodes[0].props?.src).toBe('https://cdn.kubuild.io/rehosted/hero-hash.png');
      expect(report.diagnostics).toHaveLength(0);
    });

    it('supports assetResolver returning an AssetReference object', async () => {
      const assetRef: AssetReference = {
        type: 'asset',
        assetId: 'ast_abc123',
        filename: 'banner.png',
        fallbackUrl: 'https://example.com/banner.png',
      };

      const nodes: PageNode[] = [
        {
          id: 'img-asset-ref',
          type: 'image',
          props: {
            src: 'banner.png',
            alt: 'Banner',
          },
        },
      ];

      const { nodes: resultNodes } = await processDocumentAssets(nodes, {
        baseUrl: 'https://example.com/',
        assetResolver: async () => assetRef,
      });

      expect(resultNodes[0].props?.src).toEqual(assetRef);
    });

    it('calls assetResolver for video src and poster', async () => {
      const nodes: PageNode[] = [
        {
          id: 'vid-1',
          type: 'video',
          props: {
            src: 'media/intro.mp4',
            poster: 'media/thumb.jpg',
          },
        },
      ];

      const calls: Array<{ url: string; type: string }> = [];
      const resolver = vi.fn().mockImplementation(async ({ url, type }) => {
        calls.push({ url, type });
        return `https://cdn.example.com/${type}/${url.split('/').pop()}`;
      });

      const { nodes: resultNodes } = await processDocumentAssets(
        nodes,
        {
          baseUrl: 'https://example.com/',
          assetResolver: resolver,
        },
      );

      expect(resolver).toHaveBeenCalledTimes(2);
      expect(calls).toEqual([
        { url: 'https://example.com/media/intro.mp4', type: 'video' },
        { url: 'https://example.com/media/thumb.jpg', type: 'image' },
      ]);
      expect(resultNodes[0].props?.src).toBe('https://cdn.example.com/video/intro.mp4');
      expect(resultNodes[0].props?.poster).toBe('https://cdn.example.com/image/thumb.jpg');
    });

    it('calls assetResolver for CSS background url(...) in node styles', async () => {
      const nodes: PageNode[] = [
        {
          id: 'section-1',
          type: 'container',
          props: {},
          styles: {
            base: {
              backgroundImage: 'url("images/pattern.svg")',
              backgroundSize: 'cover',
            },
          },
        },
      ];

      const resolver = vi.fn().mockResolvedValue('https://cdn.example.com/assets/pattern.svg');

      const { nodes: resultNodes } = await processDocumentAssets(nodes, {
        baseUrl: 'https://example.com/site/',
        assetResolver: resolver,
      });

      expect(resolver).toHaveBeenCalledWith({
        url: 'https://example.com/site/images/pattern.svg',
        type: 'image',
      });

      const baseStyles = resultNodes[0].styles?.base as Record<string, unknown>;
      expect(baseStyles.backgroundImage).toBe('url("https://cdn.example.com/assets/pattern.svg")');
    });

    it('preserves safe absolute URLs directly when assetResolver is NOT provided', async () => {
      const nodes: PageNode[] = [
        {
          id: 'img-no-resolver',
          type: 'image',
          props: {
            src: 'images/cat.jpg',
          },
          styles: {
            base: {
              backgroundImage: 'url("./bg.png")',
            },
          },
        },
      ];

      const { nodes: resultNodes } = await processDocumentAssets(nodes, {
        baseUrl: 'https://example.com/sub/',
      });

      expect(resultNodes[0].props?.src).toBe('https://example.com/sub/images/cat.jpg');
      const baseStyles = resultNodes[0].styles?.base as Record<string, unknown>;
      expect(baseStyles.backgroundImage).toBe('url("https://example.com/sub/bg.png")');
    });
  });

  describe('Graceful Fallback on Resolver Failure', () => {
    it('preserves URL, records ASSET_UNRESOLVED (info), and succeeds when resolver returns null', async () => {
      const nodes: PageNode[] = [
        {
          id: 'img-null-res',
          type: 'image',
          props: {
            src: 'assets/hero.jpg',
          },
        },
      ];

      const report = createEmptyReport();
      const { nodes: resultNodes } = await processDocumentAssets(
        nodes,
        {
          baseUrl: 'https://example.com/',
          assetResolver: async () => null,
        },
        report,
      );

      // Safe absolute URL is kept
      expect(resultNodes[0].props?.src).toBe('https://example.com/assets/hero.jpg');

      // Diagnostic recorded with code ASSET_UNRESOLVED and severity info
      const unresolved = report.diagnostics.filter((d) => d.code === 'ASSET_UNRESOLVED');
      expect(unresolved).toHaveLength(1);
      expect(unresolved[0].severity).toBe('info');
      expect(unresolved[0].location?.path).toBe('https://example.com/assets/hero.jpg');
    });

    it('preserves URL, records ASSET_UNRESOLVED (info), and succeeds when resolver throws', async () => {
      const nodes: PageNode[] = [
        {
          id: 'img-throw-res',
          type: 'image',
          props: {
            src: 'assets/hero.jpg',
          },
          styles: {
            base: {
              backgroundImage: 'url("assets/bg.jpg")',
            },
          },
        },
      ];

      const report = createEmptyReport();
      const { nodes: resultNodes } = await processDocumentAssets(
        nodes,
        {
          baseUrl: 'https://example.com/',
          assetResolver: async () => {
            throw new Error('S3 connection timeout');
          },
        },
        report,
      );

      expect(resultNodes[0].props?.src).toBe('https://example.com/assets/hero.jpg');
      const baseStyles = resultNodes[0].styles?.base as Record<string, unknown>;
      expect(baseStyles.backgroundImage).toBe('url("https://example.com/assets/bg.jpg")');

      const unresolved = report.diagnostics.filter((d) => d.code === 'ASSET_UNRESOLVED');
      expect(unresolved).toHaveLength(2);
      expect(unresolved.every((d) => d.severity === 'info')).toBe(true);
    });
  });

  describe('Font Family Extraction and Theme Mapping', () => {
    it('converts font family names to safe theme token keys', () => {
      expect(fontNameToTokenKey('Roboto')).toBe('roboto');
      expect(fontNameToTokenKey('Playfair Display')).toBe('playfair-display');
      expect(fontNameToTokenKey('Open Sans')).toBe('open-sans');
      expect(fontNameToTokenKey('Inter')).toBe('inter');
      expect(fontNameToTokenKey('Fira Code')).toBe('fira-code');
      expect(fontNameToTokenKey('Source_Sans_Pro')).toBe('source_sans_pro');
    });

    it('extracts font families from Google Fonts CSS API v2 URLs', () => {
      const url =
        'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=Playfair+Display:ital,wght@0,400;1,700&display=swap';
      const families = extractFontFamiliesFromGoogleFontsUrl(url);

      expect(families).toEqual(['Inter', 'Playfair Display']);
    });

    it('extracts font families from Google Fonts CSS API v1 URLs', () => {
      const url = 'https://fonts.googleapis.com/css?family=Roboto:400,700|Open+Sans:300,600';
      const families = extractFontFamiliesFromGoogleFontsUrl(url);

      expect(families).toEqual(['Roboto', 'Open Sans']);
    });

    it('extracts font families from @font-face rules in CSS text', () => {
      const css = `
        @font-face {
          font-family: 'BrandSans';
          src: url('fonts/brandsans.woff2') format('woff2');
          font-weight: 400;
        }
        @font-face {
          font-family: "Custom Serif", serif;
          src: url('/fonts/custom-serif.woff') format('woff');
        }
      `;
      const families = extractFontFamiliesFromCss(css);

      expect(families).toEqual(['BrandSans', 'Custom Serif']);
    });

    it('maps Google Fonts links and @font-face into theme.fonts', async () => {
      const stylesheets = [
        'https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&family=Open+Sans&display=swap',
        `
        @font-face {
          font-family: 'Fira Code';
          src: url('/fonts/fira.woff2') format('woff2');
        }
        `,
      ];

      const initialTheme = {
        colors: { primary: '#0070f3' },
        fonts: { base: 'sans-serif' },
      };

      const { theme } = await processDocumentAssets(
        [],
        { stylesheets },
        undefined,
        initialTheme,
      );

      expect(theme).toBeDefined();
      expect(theme?.colors?.primary).toBe('#0070f3');
      expect(theme?.fonts?.base).toBe('sans-serif');
      expect(theme?.fonts?.roboto).toBe('Roboto');
      expect(theme?.fonts?.['open-sans']).toBe('Open Sans');
      expect(theme?.fonts?.['fira-code']).toBe('Fira Code');
    });
  });

  describe('Integration with importHtml and htmlToNodes', () => {
    it('integrates asset resolution and font extraction into importHtml', async () => {
      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Asset Test</title>
            <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap">
            <style>
              .hero {
                background-image: url("images/hero-bg.webp");
              }
            </style>
          </head>
          <body>
            <div class="hero">
              <img src="images/logo.png" alt="Logo" />
              <video src="media/demo.mp4" poster="media/poster.jpg"></video>
            </div>
          </body>
        </html>
      `;

      const resolver = vi.fn().mockImplementation(async ({ url, type }) => {
        return `https://rehosted.cdn/${type}/${url.split('/').pop()}`;
      });

      const result = await importHtml(html, {
        baseUrl: 'https://mywebsite.com/home/',
        assetResolver: resolver,
      });

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();

      const doc = result.document as PageDocument;
      // Fonts extracted into theme.fonts
      expect(doc.theme?.fonts?.poppins).toBe('Poppins');

      // Check image node rehosted
      const heroContainer = doc.document.children?.[0];
      const imgNode = heroContainer?.children?.[0];
      expect(imgNode?.type).toBe('image');
      expect(imgNode?.props?.src).toBe('https://rehosted.cdn/image/logo.png');

      // Check video node rehosted
      const videoNode = heroContainer?.children?.[1];
      expect(videoNode?.type).toBe('video');
      expect(videoNode?.props?.src).toBe('https://rehosted.cdn/video/demo.mp4');
      expect(videoNode?.props?.poster).toBe('https://rehosted.cdn/image/poster.jpg');
    });

    it('integrates asset resolution into htmlToNodes', async () => {
      const fragment = '<img src="./cat.jpg" alt="A cat" />';

      const result = await htmlToNodes(fragment, {
        baseUrl: 'https://pets.example.com/',
        assetResolver: async ({ url }) => `https://cdn.pets.io/${url.split('/').pop()}`,
      });

      expect(result.success).toBe(true);
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].type).toBe('image');
      expect(result.nodes[0].props?.src).toBe('https://cdn.pets.io/cat.jpg');
    });

    it('rejects malware in importHtml and succeeds with URL_BLOCKED diagnostic', async () => {
      const html = '<img src="payload.exe" alt="Exploit">';

      const result = await importHtml(html, {
        baseUrl: 'https://example.com/',
      });

      expect(result.success).toBe(true);
      const imgNode = result.document?.document.children?.[0];
      expect(imgNode?.type).toBe('image');
      expect(imgNode?.props?.src).toBeUndefined();

      const blocked = result.report.diagnostics.filter((d) => d.code === 'URL_BLOCKED');
      expect(blocked.length).toBeGreaterThanOrEqual(1);
    });

    it('handles unresolved asset in importHtml gracefully without failing import', async () => {
      const html = '<img src="missing.png" alt="Missing">';

      const result = await importHtml(html, {
        baseUrl: 'https://example.com/',
        assetResolver: async () => {
          throw new Error('Asset not found');
        },
      });

      expect(result.success).toBe(true);
      const imgNode = result.document?.document.children?.[0];
      expect(imgNode?.props?.src).toBe('https://example.com/missing.png');

      const unresolved = result.report.diagnostics.filter((d) => d.code === 'ASSET_UNRESOLVED');
      expect(unresolved.length).toBeGreaterThanOrEqual(1);
      expect(unresolved[0].severity).toBe('info');
    });
  });
});
