/**
 * Security Limits and Sanitization Utilities for KUBUILD documents, assets, and actions.
 */

export interface DocumentSecurityLimits {
  /**
   * Maximum allowed total nodes in the document tree (default: 5000).
   */
  maxNodeCount?: number;

  /**
   * Maximum allowed nesting depth of nodes (default: 32).
   */
  maxTreeDepth?: number;

  /**
   * Maximum number of direct properties per node (default: 200).
   */
  maxPropsCount?: number;

  /**
   * Maximum character length for any individual string property (default: 100,000).
   */
  maxStringLength?: number;

  /**
   * Maximum number of direct children per node (default: 1000).
   */
  maxChildrenPerNode?: number;

  /**
   * Maximum allowed JSON serialized size in bytes (default: 10MB).
   */
  maxDocumentSizeBytes?: number;

  /**
   * Allowed URL schemes for links and media.
   * Default: ['http:', 'https:', 'mailto:', 'tel:', '#', 'relative', 'data:image/']
   */
  allowedUrlSchemes?: string[];

  /**
   * Prohibited property keys to defend against Prototype Pollution.
   * Default: ['__proto__', 'constructor', 'prototype', '__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__']
   */
  prohibitedPropertyKeys?: string[];

  /**
   * Prohibited asset file extensions to prevent executable uploads.
   * Default: ['.exe', '.dll', '.so', '.sh', '.bat', '.cmd', '.js', '.mjs', '.cjs', '.php', '.py', '.vbs', '.wasm', '.bin', '.com', '.scr', '.pif']
   */
  prohibitedAssetExtensions?: string[];

  /**
   * Maximum compression expansion ratio before flagging potential zip bomb (default: 100).
   */
  maxZipExpansionRatio?: number;
}

export const DEFAULT_DOCUMENT_SECURITY_LIMITS: Required<DocumentSecurityLimits> = {
  maxNodeCount: 5000,
  maxTreeDepth: 32,
  maxPropsCount: 200,
  maxStringLength: 100_000,
  maxChildrenPerNode: 1000,
  maxDocumentSizeBytes: 10 * 1024 * 1024, // 10 MB
  allowedUrlSchemes: ['http:', 'https:', 'mailto:', 'tel:', '#', 'relative', 'data:image/'],
  prohibitedPropertyKeys: [
    '__proto__',
    'constructor',
    'prototype',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__',
  ],
  prohibitedAssetExtensions: [
    '.exe',
    '.dll',
    '.so',
    '.sh',
    '.bat',
    '.cmd',
    '.js',
    '.mjs',
    '.cjs',
    '.php',
    '.py',
    '.vbs',
    '.wasm',
    '.bin',
    '.com',
    '.scr',
    '.pif',
    '.hta',
    '.jar',
  ],
  maxZipExpansionRatio: 100,
};

export interface SecurityViolation {
  code:
    | 'PROTOTYPE_POLLUTION_DETECTED'
    | 'MAX_NODE_COUNT_EXCEEDED'
    | 'MAX_TREE_DEPTH_EXCEEDED'
    | 'MAX_PROPS_COUNT_EXCEEDED'
    | 'MAX_STRING_LENGTH_EXCEEDED'
    | 'MAX_CHILDREN_COUNT_EXCEEDED'
    | 'MAX_DOCUMENT_SIZE_EXCEEDED'
    | 'UNSAFE_URL_DETECTED'
    | 'EXECUTABLE_ASSET_DETECTED'
    | 'ZIP_BOMB_DETECTED';
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

/**
 * Checks whether a URL is safe according to the allowed URL schemes.
 * Rejects dangerous schemes such as javascript:, vbscript:, data:text/html, etc.
 */
export function isSafeUrl(
  url: unknown,
  options?: {
    allowedSchemes?: string[];
    allowDataImage?: boolean;
  }
): boolean {
  if (typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (trimmed.length === 0) return true;

  // Relative URLs & fragments are safe
  if (
    trimmed.startsWith('/') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../') ||
    trimmed.startsWith('?')
  ) {
    return true;
  }

  // Check for control characters or null bytes
  if (/[\u0000-\u001F\u007F-\u009F]/.test(trimmed)) {
    return false;
  }

  // Extract scheme
  const colonIndex = trimmed.indexOf(':');
  if (colonIndex === -1) {
    // Relative path or plain fragment without scheme
    return true;
  }

  const scheme = trimmed.substring(0, colonIndex + 1).toLowerCase();

  // Explicitly block dangerous protocols
  const dangerousSchemes = ['javascript:', 'vbscript:', 'file:', 'data:'];
  if (scheme !== 'data:' && dangerousSchemes.includes(scheme)) {
    return false;
  }

  // Handle data: scheme
  if (scheme === 'data:') {
    const allowDataImage = options?.allowDataImage ?? true;
    if (!allowDataImage) return false;

    // Only allow safe data:image/ mime types
    const dataPrefix = trimmed.substring(0, 30).toLowerCase();
    const safeDataImagePrefixes = [
      'data:image/png',
      'data:image/jpeg',
      'data:image/jpg',
      'data:image/webp',
      'data:image/gif',
      'data:image/avif',
      'data:image/svg+xml',
    ];
    return safeDataImagePrefixes.some((p) => dataPrefix.startsWith(p));
  }

  // Verify against allowed schemes list
  const allowed = options?.allowedSchemes || DEFAULT_DOCUMENT_SECURITY_LIMITS.allowedUrlSchemes;
  return allowed.some((s) => s.toLowerCase() === scheme);
}

/**
 * Sanitizes a URL, returning a safe URL or a fallback (default empty string or '#').
 */
export function sanitizeUrl(url: unknown, fallback: string = ''): string {
  if (typeof url !== 'string') return fallback;
  return isSafeUrl(url) ? url : fallback;
}

/**
 * Checks an object recursively for prohibited prototype pollution keys.
 */
export function containsProhibitedKeys(
  obj: unknown,
  prohibitedKeys: string[] = DEFAULT_DOCUMENT_SECURITY_LIMITS.prohibitedPropertyKeys
): { found: boolean; path: string; key: string } {
  const prohibitedSet = new Set(prohibitedKeys.map((k) => k.toLowerCase()));
  const visited = new WeakSet<object>();

  function check(value: unknown, currentPath: string): { found: boolean; path: string; key: string } {
    if (!value || typeof value !== 'object') {
      return { found: false, path: '', key: '' };
    }

    if (visited.has(value)) {
      return { found: false, path: '', key: '' };
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const res = check(value[i], `${currentPath}[${i}]`);
        if (res.found) return res;
      }
      return { found: false, path: '', key: '' };
    }

    const record = value as Record<string, unknown>;
    const keysToCheck = Array.from(new Set([...Object.keys(record), ...Object.getOwnPropertyNames(record)]));

    for (const key of keysToCheck) {
      if (prohibitedSet.has(key.toLowerCase())) {
        return { found: true, path: currentPath ? `${currentPath}.${key}` : key, key };
      }
      const res = check(record[key], currentPath ? `${currentPath}.${key}` : key);
      if (res.found) return res;
    }

    // Check if __proto__ was injected and altered standard prototype
    if (Object.prototype.hasOwnProperty.call(record, '__proto__')) {
      return { found: true, path: currentPath ? `${currentPath}.__proto__` : '__proto__', key: '__proto__' };
    }

    return { found: false, path: '', key: '' };
  }

  return check(obj, '');
}

/**
 * Validates a document against security limits (node count, tree depth, props count, string length, prototype pollution).
 */
export function validateDocumentSecurity(
  doc: unknown,
  customLimits?: DocumentSecurityLimits
): { safe: boolean; errors: SecurityViolation[] } {
  const limits = { ...DEFAULT_DOCUMENT_SECURITY_LIMITS, ...customLimits };
  const errors: SecurityViolation[] = [];

  if (!doc || typeof doc !== 'object') {
    return { safe: true, errors: [] };
  }

  // 1. Prototype Pollution Check
  const protoCheck = containsProhibitedKeys(doc, limits.prohibitedPropertyKeys);
  if (protoCheck.found) {
    errors.push({
      code: 'PROTOTYPE_POLLUTION_DETECTED',
      message: `Prohibited property key "${protoCheck.key}" detected at path "${protoCheck.path}" (Prototype Pollution Defense).`,
      path: protoCheck.path,
      details: { key: protoCheck.key },
    });
  }

  // 2. Document Serialized Size Check
  try {
    const jsonStr = JSON.stringify(doc);
    if (jsonStr.length > limits.maxDocumentSizeBytes) {
      errors.push({
        code: 'MAX_DOCUMENT_SIZE_EXCEEDED',
        message: `Document size (${jsonStr.length} bytes) exceeds limit of ${limits.maxDocumentSizeBytes} bytes.`,
        details: { size: jsonStr.length, limit: limits.maxDocumentSizeBytes },
      });
    }
  } catch {
    // Ignore JSON stringify errors
  }

  // 3. Tree Depth & Node Count Checks
  const docObj = doc as Record<string, unknown>;
  const rootNode = docObj.document;

  if (rootNode && typeof rootNode === 'object') {
    let totalNodes = 0;

    function traverse(node: unknown, depth: number, currentPath: string): void {
      if (!node || typeof node !== 'object' || Array.isArray(node)) return;

      totalNodes++;
      if (totalNodes > limits.maxNodeCount) {
        errors.push({
          code: 'MAX_NODE_COUNT_EXCEEDED',
          message: `Total document nodes (${totalNodes}) exceeded security limit of ${limits.maxNodeCount}.`,
          path: currentPath,
          details: { nodeCount: totalNodes, limit: limits.maxNodeCount },
        });
        return;
      }

      if (depth > limits.maxTreeDepth) {
        errors.push({
          code: 'MAX_TREE_DEPTH_EXCEEDED',
          message: `Document nesting depth (${depth}) exceeded security limit of ${limits.maxTreeDepth}.`,
          path: currentPath,
          details: { depth, limit: limits.maxTreeDepth },
        });
        return;
      }

      const nodeRecord = node as Record<string, unknown>;

      // Check Props Limits
      if (nodeRecord.props && typeof nodeRecord.props === 'object' && !Array.isArray(nodeRecord.props)) {
        const propsRecord = nodeRecord.props as Record<string, unknown>;
        const propKeys = Object.keys(propsRecord);

        if (propKeys.length > limits.maxPropsCount) {
          errors.push({
            code: 'MAX_PROPS_COUNT_EXCEEDED',
            message: `Node has ${propKeys.length} props, exceeding limit of ${limits.maxPropsCount}.`,
            path: `${currentPath}/props`,
            details: { count: propKeys.length, limit: limits.maxPropsCount },
          });
        }

        for (const [k, val] of Object.entries(propsRecord)) {
          if (typeof val === 'string' && val.length > limits.maxStringLength) {
            errors.push({
              code: 'MAX_STRING_LENGTH_EXCEEDED',
              message: `Prop "${k}" string length (${val.length}) exceeds limit of ${limits.maxStringLength}.`,
              path: `${currentPath}/props/${k}`,
              details: { length: val.length, limit: limits.maxStringLength },
            });
          }
        }
      }

      // Check Children Limits
      if (nodeRecord.children && Array.isArray(nodeRecord.children)) {
        if (nodeRecord.children.length > limits.maxChildrenPerNode) {
          errors.push({
            code: 'MAX_CHILDREN_COUNT_EXCEEDED',
            message: `Node has ${nodeRecord.children.length} direct children, exceeding limit of ${limits.maxChildrenPerNode}.`,
            path: `${currentPath}/children`,
            details: { count: nodeRecord.children.length, limit: limits.maxChildrenPerNode },
          });
        }

        for (let i = 0; i < nodeRecord.children.length; i++) {
          traverse(nodeRecord.children[i], depth + 1, `${currentPath}/children/${i}`);
        }
      }
    }

    traverse(rootNode, 1, '/document');
  }

  return {
    safe: errors.length === 0,
    errors,
  };
}

/**
 * Checks if an asset filename has a dangerous or executable extension.
 */
export function isDangerousAssetFilename(
  filename: string,
  prohibitedExtensions: string[] = DEFAULT_DOCUMENT_SECURITY_LIMITS.prohibitedAssetExtensions
): boolean {
  if (!filename || typeof filename !== 'string') return true;

  const lower = filename.toLowerCase().trim();

  // Check double extensions like "malicious.exe.png" or "script.php.jpg"
  return prohibitedExtensions.some((ext) => {
    const extLower = ext.toLowerCase();
    return lower.endsWith(extLower) || lower.includes(`${extLower}.`);
  });
}

/**
 * Checks whether an archive expansion ratio indicates a zip bomb attack.
 */
export function checkZipBomb(
  compressedSize: number,
  uncompressedSize: number,
  maxRatio: number = DEFAULT_DOCUMENT_SECURITY_LIMITS.maxZipExpansionRatio
): boolean {
  if (compressedSize <= 0) return false;
  // Only enforce ratio for archives whose uncompressed payload is non-trivial (>10MB)
  if (uncompressedSize > 10 * 1024 * 1024) {
    const ratio = uncompressedSize / compressedSize;
    return ratio > maxRatio;
  }
  return false;
}

/**
 * Sanitizes an HTML string by stripping unsafe tags (<script>, <object>, <embed>, <applet>, <base>, <link rel="import">),
 * removing inline event handlers (on* attributes like onclick, onerror, onload, etc.),
 * and disarming javascript:/vbscript:/data:text/html URLs in attributes.
 */
export function sanitizeHtml(rawHtml: unknown): string {
  if (typeof rawHtml !== 'string') return '';
  let html = rawHtml;

  // 1. Remove script tags and their content
  html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // 2. Remove object, embed, applet, base, and link tags
  html = html.replace(/<\/?(object|embed|applet|base|link)\b[^>]*>/gi, '');

  // 3. Remove on* event handler attributes (e.g. onload=, onclick=, onerror=, onfocus=)
  html = html.replace(/\s+on[a-z0-9_-]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // 4. Disarm javascript:, vbscript:, and data:text/html protocol attributes in href/src/data/action
  html = html.replace(
    /\b(href|src|data|action)\s*=\s*(['"])\s*(?:javascript:|vbscript:|data:text\/html)[^'"]*\2/gi,
    '$1="#"'
  );
  html = html.replace(
    /\b(href|src|data|action)\s*=\s*(?:javascript:|vbscript:|data:text\/html)[^\s>]+/gi,
    '$1="#"'
  );

  return html;
}

