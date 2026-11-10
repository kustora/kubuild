/**
 * @kubuild/html-import
 * Asset resolution, security screening, rehosting, and font extraction.
 */

import { isDangerousAssetFilename, isSafeUrl } from '@kubuild/core';
import type { AssetReference, Theme } from '@kubuild/schema';
import {
  addDiagnostic,
  type HtmlImportOptions,
  type HtmlImportReport,
  type PageNode,
} from './types.js';

/**
 * Supported asset categories passed to custom host asset resolvers.
 */
export type HtmlImportAssetType = 'image' | 'video' | 'font' | 'other';

/**
 * Extracts the pathname from a URL or relative path without query strings or fragments.
 */
export function extractPathnameFromUrl(url: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) return '';

  try {
    const parsed = new URL(trimmed, 'http://localhost');
    return parsed.pathname;
  } catch {
    return trimmed.split('?')[0].split('#')[0];
  }
}

/**
 * Extracts the filename component from a URL or file path.
 */
export function extractFilenameFromUrl(url: string): string {
  const pathname = extractPathnameFromUrl(url);
  if (!pathname) return '';
  const segments = pathname.split('/').filter(Boolean);
  return segments.pop() || pathname;
}

/**
 * Checks whether an asset URL or path targets an executable or prohibited file type.
 */
export function isDangerousAssetUrl(url: string, prohibitedExtensions?: string[]): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:')) return false;

  const pathname = extractPathnameFromUrl(trimmed);
  const filename = extractFilenameFromUrl(trimmed);

  return (
    isDangerousAssetFilename(filename, prohibitedExtensions) ||
    isDangerousAssetFilename(pathname, prohibitedExtensions)
  );
}

/**
 * Resolves a relative URL against an optional base URL and pre-screens for dangerous URL schemes.
 *
 * If `url` is unsafe (e.g. `javascript:`, `data:text/html`), returns an empty string.
 * If `baseUrl` is absent or invalid, relative paths with leading `/` or `./` are kept or resolved safely.
 *
 * @param url The asset or link URL string to resolve
 * @param baseUrl Optional base URL to resolve relative paths against
 * @returns Safe resolved URL string, or empty string if unsafe
 */
export function resolveAssetUrl(url: string, baseUrl?: string): string {
  if (!url || typeof url !== 'string') {
    return '';
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return '';
  }

  // Pre-screen against unsafe schemes (e.g. javascript:, vbscript:, data:text/html)
  if (!isSafeUrl(trimmed, { allowDataImage: true })) {
    return '';
  }

  // Safe data:image/ URLs are already absolute and valid
  if (trimmed.toLowerCase().startsWith('data:')) {
    return trimmed;
  }

  // If no baseUrl is provided or baseUrl is empty, return trimmed safe relative URL
  if (!baseUrl || typeof baseUrl !== 'string' || baseUrl.trim().length === 0) {
    return trimmed;
  }

  try {
    const resolved = new URL(trimmed, baseUrl.trim()).toString();
    if (!isSafeUrl(resolved, { allowDataImage: true })) {
      return '';
    }
    return resolved;
  } catch {
    // If baseUrl is invalid or URL resolution fails, return original trimmed string if safe
    return isSafeUrl(trimmed, { allowDataImage: true }) ? trimmed : '';
  }
}

/**
 * Converts a font family display name into a safe CSS theme token key.
 *
 * E.g. 'Roboto' -> 'roboto', 'Open Sans' -> 'open-sans', 'Playfair Display' -> 'playfair-display'.
 */
export function fontNameToTokenKey(fontName: string): string {
  const slug = fontName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'font';
}

/**
 * Extracts font family names from a Google Fonts stylesheet URL.
 *
 * Supports both Google Fonts CSS API v1 and v2 syntax.
 */
export function extractFontFamiliesFromGoogleFontsUrl(url: string): string[] {
  const results: string[] = [];
  if (!url || typeof url !== 'string') return results;

  try {
    const parsed = new URL(url, 'https://fonts.googleapis.com');
    if (!parsed.hostname.includes('fonts.googleapis.com') && !parsed.hostname.includes('fonts.bunny.net')) {
      return results;
    }

    const familyParams = parsed.searchParams.getAll('family');
    for (const famParam of familyParams) {
      // Multiple families may be separated by '|' (v1 syntax)
      const subFamilies = famParam.split('|');
      for (const sub of subFamilies) {
        // Strip weight/axis specifications (e.g. :wght@400;700 or :400,700)
        const familyName = sub.split(':')[0].replace(/\+/g, ' ').trim();
        if (familyName && !results.includes(familyName)) {
          results.push(familyName);
        }
      }
    }
  } catch {
    // Fallback regex parsing if URL object parsing encounters irregular format
    const matches = url.matchAll(/[?&]family=([^&]+)/g);
    for (const m of matches) {
      const decoded = decodeURIComponent(m[1]);
      const subFamilies = decoded.split('|');
      for (const sub of subFamilies) {
        const name = sub.split(':')[0].replace(/\+/g, ' ').trim();
        if (name && !results.includes(name)) {
          results.push(name);
        }
      }
    }
  }

  return results;
}

/**
 * Extracts font-family declarations from @font-face rules in CSS text.
 */
export function extractFontFamiliesFromCss(css: string): string[] {
  const results: string[] = [];
  if (!css || typeof css !== 'string') return results;

  const fontFaceRegex = /@font-face\s*\{([^}]+)\}/gi;
  let match: RegExpExecArray | null;

  while ((match = fontFaceRegex.exec(css)) !== null) {
    const block = match[1];
    const familyMatch = block.match(/font-family\s*:\s*([^;!}]+)/i);
    if (familyMatch) {
      const rawFamily = familyMatch[1].trim();
      const primary = rawFamily
        .split(',')[0]
        .replace(/^['"\s]+|['"\s]+$/g, '')
        .trim();
      if (primary && !results.includes(primary)) {
        results.push(primary);
      }
    }
  }

  return results;
}

/**
 * Parses srcset string into candidate items with url and descriptor.
 */
interface SrcsetEntry {
  url: string;
  descriptor?: string;
}

function parseSrcsetEntries(srcset: string): SrcsetEntry[] {
  if (!srcset || typeof srcset !== 'string') return [];
  const parts = srcset.split(/\s*,\s*/);
  const entries: SrcsetEntry[] = [];

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    const url = tokens[0];
    const descriptor = tokens.slice(1).join(' ') || undefined;
    if (url) {
      entries.push({ url, descriptor });
    }
  }

  return entries;
}

/**
 * Traverses a PageNode tree and collected styles to resolve URLs against `baseUrl`,
 * reject prohibited file extensions with `URL_BLOCKED` diagnostics, rehost media and font
 * assets via `options.assetResolver`, and map external webfonts into document `theme.fonts`.
 *
 * @param nodes The array of PageNodes to process
 * @param options HTML import configuration including baseUrl, assetResolver, and stylesheets
 * @param report Optional report to record diagnostics
 * @param theme Optional initial document theme tokens
 * @returns Object containing the processed PageNodes and updated Theme
 */
export async function processDocumentAssets(
  nodes: PageNode[],
  options?: HtmlImportOptions,
  report?: HtmlImportReport,
  theme?: Partial<Theme>,
): Promise<{ nodes: PageNode[]; theme?: Theme }> {
  const collectedFonts: Record<string, string> = {};

  // 1. Extract fonts from stylesheets / Google Fonts links / @font-face rules
  if (options?.stylesheets && Array.isArray(options.stylesheets)) {
    for (const sheet of options.stylesheets) {
      if (typeof sheet !== 'string' || sheet.trim().length === 0) continue;

      const trimmedSheet = sheet.trim();

      // Check Google Fonts URLs
      if (
        trimmedSheet.includes('fonts.googleapis.com') ||
        trimmedSheet.includes('fonts.bunny.net')
      ) {
        const families = extractFontFamiliesFromGoogleFontsUrl(trimmedSheet);
        for (const family of families) {
          const key = fontNameToTokenKey(family);
          collectedFonts[key] = family;
        }
      }

      // Check @font-face rules in inline CSS content
      if (trimmedSheet.includes('@font-face')) {
        const families = extractFontFamiliesFromCss(trimmedSheet);
        for (const family of families) {
          const key = fontNameToTokenKey(family);
          collectedFonts[key] = family;
        }

        // Also check if @font-face references external font files to rehost
        if (options.assetResolver) {
          const urlMatches = trimmedSheet.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi);
          for (const uMatch of urlMatches) {
            const fontUrl = uMatch[2].trim();
            if (!fontUrl || fontUrl.startsWith('data:')) continue;

            if (isDangerousAssetUrl(fontUrl)) {
              if (report) {
                addDiagnostic(report, {
                  code: 'URL_BLOCKED',
                  severity: 'warning',
                  message: `Dangerous font asset URL blocked: "${fontUrl}"`,
                  location: { tagName: 'style', path: fontUrl },
                  details: { url: fontUrl, type: 'font' },
                });
              }
              continue;
            }

            const resolvedFontUrl = resolveAssetUrl(fontUrl, options.baseUrl);
            try {
              const res = await options.assetResolver({
                url: resolvedFontUrl,
                type: 'font',
              });
              if (!res && report) {
                addDiagnostic(report, {
                  code: 'ASSET_UNRESOLVED',
                  severity: 'info',
                  message: `Font asset could not be resolved by host resolver: "${resolvedFontUrl}"`,
                  location: { tagName: 'style', path: resolvedFontUrl },
                  details: { url: resolvedFontUrl, type: 'font' },
                });
              }
            } catch (err) {
              if (report) {
                addDiagnostic(report, {
                  code: 'ASSET_UNRESOLVED',
                  severity: 'info',
                  message: `Font asset resolver threw an error for "${resolvedFontUrl}": ${err instanceof Error ? err.message : String(err)}`,
                  location: { tagName: 'style', path: resolvedFontUrl },
                  details: {
                    url: resolvedFontUrl,
                    type: 'font',
                    error: err instanceof Error ? err.message : String(err),
                  },
                });
              }
            }
          }
        }
      }
    }
  }

  // 2. Helper to rehost or keep a single URL
  async function resolveOrRehost(
    rawUrl: string,
    type: HtmlImportAssetType,
    node: PageNode,
    attributeName: string,
  ): Promise<string | AssetReference | null> {
    if (isDangerousAssetUrl(rawUrl)) {
      if (report) {
        addDiagnostic(report, {
          code: 'URL_BLOCKED',
          severity: 'warning',
          message: `Prohibited asset file extension blocked in ${node.type} "${attributeName}": "${rawUrl}"`,
          location: { tagName: node.type, path: rawUrl },
          details: { url: rawUrl, attribute: attributeName, nodeId: node.id, nodeType: node.type },
        });
      }
      return null;
    }

    const resolved = resolveAssetUrl(rawUrl, options?.baseUrl);
    if (!resolved) {
      if (report) {
        addDiagnostic(report, {
          code: 'URL_BLOCKED',
          severity: 'warning',
          message: `Unsafe URL blocked in ${node.type} "${attributeName}": "${rawUrl}"`,
          location: { tagName: node.type, path: rawUrl },
          details: { url: rawUrl, attribute: attributeName, nodeId: node.id, nodeType: node.type },
        });
      }
      return null;
    }

    if (!options?.assetResolver) {
      return resolved;
    }

    try {
      const rehosted = await options.assetResolver({
        url: resolved,
        type,
      });

      if (rehosted !== null && rehosted !== undefined) {
        return rehosted;
      }

      // Resolver returned null: keep resolved URL and record ASSET_UNRESOLVED info
      if (report) {
        addDiagnostic(report, {
          code: 'ASSET_UNRESOLVED',
          severity: 'info',
          message: `Asset could not be resolved by host resolver: "${resolved}"`,
          location: { tagName: node.type, path: resolved },
          details: { url: resolved, type, nodeId: node.id, attribute: attributeName },
        });
      }
      return resolved;
    } catch (err) {
      // Resolver threw: keep resolved URL and record ASSET_UNRESOLVED info
      if (report) {
        addDiagnostic(report, {
          code: 'ASSET_UNRESOLVED',
          severity: 'info',
          message: `Asset resolver failed for "${resolved}": ${err instanceof Error ? err.message : String(err)}`,
          location: { tagName: node.type, path: resolved },
          details: {
            url: resolved,
            type,
            nodeId: node.id,
            attribute: attributeName,
            error: err instanceof Error ? err.message : String(err),
          },
        });
      }
      return resolved;
    }
  }

  // 3. Process node styles with url(...)
  async function processNodeStyles(node: PageNode): Promise<void> {
    if (!node.styles || typeof node.styles !== 'object') return;

    for (const breakpointKey of Object.keys(node.styles)) {
      const styleGroup = node.styles[breakpointKey];
      if (!styleGroup || typeof styleGroup !== 'object' || Array.isArray(styleGroup)) continue;

      const styleObj = styleGroup as Record<string, unknown>;

      for (const [propName, propVal] of Object.entries(styleObj)) {
        if (typeof propVal !== 'string' || !propVal.includes('url(')) continue;

        const urlMatches = Array.from(propVal.matchAll(/url\(\s*(['"]?)(.*?)\1\s*\)/gi));
        if (urlMatches.length === 0) continue;

        let hasBlocked = false;
        let updatedVal = propVal;

        for (const match of urlMatches) {
          const fullMatch = match[0];
          const rawUrl = match[2].trim();

          if (isDangerousAssetUrl(rawUrl)) {
            hasBlocked = true;
            if (report) {
              addDiagnostic(report, {
                code: 'URL_BLOCKED',
                severity: 'warning',
                message: `Prohibited asset file extension blocked in style "${propName}": "${rawUrl}"`,
                location: { tagName: node.type, path: rawUrl },
                details: { url: rawUrl, property: propName, nodeId: node.id },
              });
            }
            break;
          }

          const resolved = resolveAssetUrl(rawUrl, options?.baseUrl);
          if (!resolved) {
            hasBlocked = true;
            if (report) {
              addDiagnostic(report, {
                code: 'URL_BLOCKED',
                severity: 'warning',
                message: `Unsafe URL blocked in style "${propName}": "${rawUrl}"`,
                location: { tagName: node.type, path: rawUrl },
                details: { url: rawUrl, property: propName, nodeId: node.id },
              });
            }
            break;
          }

          let replacementUrl = resolved;
          if (options?.assetResolver) {
            try {
              const rehosted = await options.assetResolver({
                url: resolved,
                type: 'image',
              });
              if (rehosted) {
                if (typeof rehosted === 'string') {
                  replacementUrl = rehosted;
                } else if (typeof rehosted === 'object' && 'fallbackUrl' in rehosted && rehosted.fallbackUrl) {
                  replacementUrl = rehosted.fallbackUrl;
                }
              } else {
                replacementUrl = resolved;
                if (report) {
                  addDiagnostic(report, {
                    code: 'ASSET_UNRESOLVED',
                    severity: 'info',
                    message: `CSS background asset could not be resolved by host resolver: "${resolved}"`,
                    location: { tagName: node.type, path: resolved },
                    details: { url: resolved, type: 'image', nodeId: node.id, property: propName },
                  });
                }
              }
            } catch (err) {
              replacementUrl = resolved;
              if (report) {
                addDiagnostic(report, {
                  code: 'ASSET_UNRESOLVED',
                  severity: 'info',
                  message: `Asset resolver threw an error for CSS background "${resolved}": ${err instanceof Error ? err.message : String(err)}`,
                  location: { tagName: node.type, path: resolved },
                  details: {
                    url: resolved,
                    type: 'image',
                    nodeId: node.id,
                    property: propName,
                    error: err instanceof Error ? err.message : String(err),
                  },
                });
              }
            }
          }

          updatedVal = updatedVal.replace(fullMatch, `url("${replacementUrl}")`);
        }

        if (hasBlocked) {
          delete styleObj[propName];
        } else {
          styleObj[propName] = updatedVal;
        }
      }
    }
  }

  // 4. Recursive node processor
  async function processNode(node: PageNode): Promise<void> {
    if (!node || typeof node !== 'object') return;

    if (!node.props) {
      node.props = {};
    }

    // Process image nodes: props.src, props.srcset
    if (node.type === 'image') {
      if (typeof node.props.src === 'string' && node.props.src.trim().length > 0) {
        const rehosted = await resolveOrRehost(node.props.src, 'image', node, 'src');
        if (rehosted === null) {
          delete node.props.src;
        } else {
          node.props.src = rehosted;
        }
      }

      if (typeof node.props.srcset === 'string' && node.props.srcset.trim().length > 0) {
        const entries = parseSrcsetEntries(node.props.srcset);
        const resolvedEntries: string[] = [];

        for (const entry of entries) {
          if (isDangerousAssetUrl(entry.url)) {
            if (report) {
              addDiagnostic(report, {
                code: 'URL_BLOCKED',
                severity: 'warning',
                message: `Prohibited asset file extension blocked in image "srcset": "${entry.url}"`,
                location: { tagName: 'image', path: entry.url },
                details: { url: entry.url, attribute: 'srcset', nodeId: node.id },
              });
            }
            continue;
          }

          const resolved = resolveAssetUrl(entry.url, options?.baseUrl);
          if (!resolved) {
            if (report) {
              addDiagnostic(report, {
                code: 'URL_BLOCKED',
                severity: 'warning',
                message: `Unsafe URL blocked in image "srcset": "${entry.url}"`,
                location: { tagName: 'image', path: entry.url },
                details: { url: entry.url, attribute: 'srcset', nodeId: node.id },
              });
            }
            continue;
          }

          let candidateUrl = resolved;
          if (options?.assetResolver) {
            try {
              const res = await options.assetResolver({
                url: resolved,
                type: 'image',
              });
              if (typeof res === 'string') {
                candidateUrl = res;
              } else if (res && typeof res === 'object' && 'fallbackUrl' in res && res.fallbackUrl) {
                candidateUrl = res.fallbackUrl;
              } else if (!res && report) {
                addDiagnostic(report, {
                  code: 'ASSET_UNRESOLVED',
                  severity: 'info',
                  message: `Asset in srcset could not be resolved by host resolver: "${resolved}"`,
                  location: { tagName: 'image', path: resolved },
                  details: { url: resolved, type: 'image', nodeId: node.id },
                });
              }
            } catch (err) {
              if (report) {
                addDiagnostic(report, {
                  code: 'ASSET_UNRESOLVED',
                  severity: 'info',
                  message: `Asset resolver threw an error for srcset item "${resolved}": ${err instanceof Error ? err.message : String(err)}`,
                  location: { tagName: 'image', path: resolved },
                  details: {
                    url: resolved,
                    type: 'image',
                    nodeId: node.id,
                    error: err instanceof Error ? err.message : String(err),
                  },
                });
              }
            }
          }

          resolvedEntries.push(
            entry.descriptor ? `${candidateUrl} ${entry.descriptor}` : candidateUrl,
          );
        }

        if (resolvedEntries.length === 0) {
          delete node.props.srcset;
        } else {
          node.props.srcset = resolvedEntries.join(', ');
        }
      }
    }

    // Process video nodes: props.src, props.poster
    if (node.type === 'video') {
      if (typeof node.props.src === 'string' && node.props.src.trim().length > 0) {
        const rehosted = await resolveOrRehost(node.props.src, 'video', node, 'src');
        if (rehosted === null) {
          delete node.props.src;
        } else {
          node.props.src = rehosted;
        }
      }

      if (typeof node.props.poster === 'string' && node.props.poster.trim().length > 0) {
        const rehosted = await resolveOrRehost(node.props.poster, 'image', node, 'poster');
        if (rehosted === null) {
          delete node.props.poster;
        } else {
          node.props.poster = rehosted;
        }
      }
    }

    // Process styles
    await processNodeStyles(node);

    // Process children recursively
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        await processNode(child);
      }
    }
  }

  // Traverse all nodes
  for (const node of nodes) {
    await processNode(node);
  }

  // 5. Build and return theme if fonts were collected or initial theme provided
  const hasCollectedFonts = Object.keys(collectedFonts).length > 0;
  const hasInitialTheme = theme !== undefined && theme !== null;

  let resultTheme: Theme | undefined = undefined;
  if (hasInitialTheme || hasCollectedFonts) {
    resultTheme = {
      ...(theme ?? {}),
      ...(hasCollectedFonts
        ? {
            fonts: {
              ...(theme?.fonts ?? {}),
              ...collectedFonts,
            },
          }
        : {}),
    };
  }

  return {
    nodes,
    ...(resultTheme ? { theme: resultTheme } : {}),
  };
}
