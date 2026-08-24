import { describe, it, expect } from 'vitest';
import {
  isSafeUrl,
  sanitizeUrl,
  containsProhibitedKeys,
  validateDocumentSecurity,
  isDangerousAssetFilename,
  checkZipBomb,
  DEFAULT_DOCUMENT_SECURITY_LIMITS,
} from './security';
import { validateDocument } from './validator';
import { starterPageFixture, PageDocument } from '@kubuild/schema';

describe('STORA-083: Security Audit & Safety Controls Suite', () => {
  describe('1. URL Sanitization & Protocol Allowlist', () => {
    it('blocks dangerous XSS URL schemes (javascript:, vbscript:, data:text/html)', () => {
      expect(isSafeUrl('javascript:alert(document.cookie)')).toBe(false);
      expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
      expect(isSafeUrl('javascript:void(0)')).toBe(false);
      expect(isSafeUrl('vbscript:msgbox("hello")')).toBe(false);
      expect(isSafeUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe(false);
      expect(isSafeUrl('data:application/javascript;base64,YWxlcnQoMSk=')).toBe(false);
      expect(isSafeUrl('javascript\0:alert(1)')).toBe(false);
    });

    it('allows legitimate safe web URLs and media', () => {
      expect(isSafeUrl('https://example.com/page')).toBe(true);
      expect(isSafeUrl('http://example.com')).toBe(true);
      expect(isSafeUrl('mailto:support@kustora.com')).toBe(true);
      expect(isSafeUrl('tel:+1234567890')).toBe(true);
      expect(isSafeUrl('#hero-section')).toBe(true);
      expect(isSafeUrl('/about-us')).toBe(true);
      expect(isSafeUrl('./relative/path.jpg')).toBe(true);
      expect(isSafeUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==')).toBe(true);
      expect(isSafeUrl('data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==')).toBe(true);
    });

    it('sanitizeUrl falls back to safe default on dangerous input', () => {
      expect(sanitizeUrl('javascript:alert(1)', '#')).toBe('#');
      expect(sanitizeUrl('https://kustora.com', '#')).toBe('https://kustora.com');
      expect(sanitizeUrl('', '')).toBe('');
      expect(sanitizeUrl(null, '#')).toBe('#');
    });
  });

  describe('2. Prototype Pollution Defense', () => {
    it('detects and reports prohibited prototype pollution keys in nested objects', () => {
      const maliciousObj = JSON.parse('{"title":"Safe Title","metadata":{"author":"Attacker","__proto__":{"isAdmin":true}}}');

      const result = containsProhibitedKeys(maliciousObj);
      expect(result.found).toBe(true);
      expect(result.key.toLowerCase()).toBe('__proto__');
      expect(result.path).toContain('__proto__');
    });

    it('detects constructor and prototype pollution attempts in array structures', () => {
      const maliciousArray = JSON.parse('[{"name":"item1"},{"constructor":{"prototype":{"polluted":true}}}]');

      const result = containsProhibitedKeys(maliciousArray);
      expect(result.found).toBe(true);
      expect(['constructor', 'prototype']).toContain(result.key.toLowerCase());
    });

    it('validateDocument rejects documents containing prototype pollution keys', () => {
      const pollutedDoc = JSON.parse(JSON.stringify(starterPageFixture));
      Object.defineProperty(pollutedDoc.document, '__proto__', {
        value: { hacked: true },
        enumerable: true,
        configurable: true,
      });

      const validation = validateDocument(pollutedDoc);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e) => e.code === 'PROTOTYPE_POLLUTION_DETECTED')).toBe(true);
    });
  });

  describe('3. Document Structural & Depth Security Limits', () => {
    it('enforces maximum tree depth limit', () => {
      let currentChild: any = {
        id: 'leaf-node',
        type: 'heading',
        props: { text: 'Deep Node' },
      };

      // Create a deeply nested chain exceeding depth limit of 10
      for (let i = 0; i < 15; i++) {
        currentChild = {
          id: `nested-container-${i}`,
          type: 'container',
          children: [currentChild],
        };
      }

      const deepDoc: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'root-section',
              type: 'section',
              children: [currentChild],
            },
          ],
        },
      };

      const securityResult = validateDocumentSecurity(deepDoc, { maxTreeDepth: 10 });
      expect(securityResult.safe).toBe(false);
      expect(securityResult.errors.some((e) => e.code === 'MAX_TREE_DEPTH_EXCEEDED')).toBe(true);
    });

    it('enforces maximum node count limit', () => {
      const manyChildren = Array.from({ length: 50 }, (_, i) => ({
        id: `node-${i}`,
        type: 'text',
        props: { content: `Text ${i}` },
      }));

      const largeDoc: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'section-1',
              type: 'section',
              children: [
                {
                  id: 'container-1',
                  type: 'container',
                  children: manyChildren,
                },
              ],
            },
          ],
        },
      };

      const securityResult = validateDocumentSecurity(largeDoc, { maxNodeCount: 20 });
      expect(securityResult.safe).toBe(false);
      expect(securityResult.errors.some((e) => e.code === 'MAX_NODE_COUNT_EXCEEDED')).toBe(true);
    });

    it('enforces maximum string length limit on props', () => {
      const docWithLongString: PageDocument = {
        schema: 'stora.page',
        version: '1.0.0',
        document: {
          id: 'root-page',
          type: 'page',
          children: [
            {
              id: 'text-1',
              type: 'text',
              props: { content: 'A'.repeat(5000) },
            },
          ],
        },
      };

      const securityResult = validateDocumentSecurity(docWithLongString, { maxStringLength: 1000 });
      expect(securityResult.safe).toBe(false);
      expect(securityResult.errors.some((e) => e.code === 'MAX_STRING_LENGTH_EXCEEDED')).toBe(true);
    });
  });

  describe('4. Asset File Safety & Zip Bomb Defense', () => {
    it('identifies and rejects dangerous or executable asset extensions', () => {
      expect(isDangerousAssetFilename('payload.exe')).toBe(true);
      expect(isDangerousAssetFilename('script.sh')).toBe(true);
      expect(isDangerousAssetFilename('malware.bat')).toBe(true);
      expect(isDangerousAssetFilename('exploit.js')).toBe(true);
      expect(isDangerousAssetFilename('shell.php')).toBe(true);
      expect(isDangerousAssetFilename('backdoor.py')).toBe(true);
      expect(isDangerousAssetFilename('trojan.exe.png')).toBe(true); // double extension
      expect(isDangerousAssetFilename('banner.jpg.php')).toBe(true);

      // Safe image and media files
      expect(isDangerousAssetFilename('hero.png')).toBe(false);
      expect(isDangerousAssetFilename('photo.webp')).toBe(false);
      expect(isDangerousAssetFilename('graphic.svg')).toBe(false);
      expect(isDangerousAssetFilename('logo.jpeg')).toBe(false);
    });

    it('detects potential zip bomb decompression ratios', () => {
      // 1KB compressed expands to 50MB (ratio 50,000x)
      const compressedSize = 1024;
      const uncompressedSize = 50 * 1024 * 1024;
      expect(checkZipBomb(compressedSize, uncompressedSize, 100)).toBe(true);

      // Normal compression ratio (e.g. 2MB compressed expands to 3MB)
      expect(checkZipBomb(2 * 1024 * 1024, 3 * 1024 * 1024, 100)).toBe(false);
    });
  });
});
