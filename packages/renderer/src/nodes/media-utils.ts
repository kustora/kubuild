/**
 * Helper to convert strings to PascalCase (e.g. for icon names).
 */
export function toPascalCase(str: string): string {
  if (!str) return '';
  return str
    .replace(/[-_](\w)/g, (_, c) => c.toUpperCase())
    .replace(/^\w/, (c) => c.toUpperCase());
}

/**
 * Extracts YouTube video ID from various YouTube URL formats.
 */
export function getYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
  );
  return match ? match[1] : null;
}

/**
 * Extracts Vimeo video ID from Vimeo URL formats.
 */
export function getVimeoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(
    /(?:vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/([^\/]*)\/videos\/|album\/(\d+)\/video\/|video\/|))(\d+)/i,
  );
  return match ? match[3] : null;
}

/**
 * Converts aspect ratio token to CSS aspectRatio value.
 */
export function aspectRatioToCss(ratio: unknown): string | undefined {
  if (ratio === '16:9') return '16 / 9';
  if (ratio === '4:3') return '4 / 3';
  if (ratio === '1:1') return '1 / 1';
  if (ratio === '9:16') return '9 / 16';
  if (typeof ratio === 'string' && ratio !== 'auto') return ratio.replace(':', ' / ');
  return undefined;
}

