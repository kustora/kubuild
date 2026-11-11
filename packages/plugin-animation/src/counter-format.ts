/**
 * Reads and writes the number inside a counter's text ("12,500+", "Rp 1.250.000", "98.6%",
 * "4,8/5"), keeping everything around it and its digit grouping. Pure, so tests and the AI
 * see what the runtime will show.
 */

export interface CounterFormat {
  prefix: string;
  suffix: string;
  value: number;
  decimals: number;
  group: string;
  decimal: string;
}

// Grouping by (narrow) no-break space is accepted; a plain space ends the number ("10 20").
const NUMBER = /-?\d[\d.,\u00a0\u202f]*\d|-?\d/;

/**
 * Finds the first number in `text`. A separator is a decimal point when it appears once and
 * is not followed by exactly three digits, or when both kinds appear and it comes last;
 * everything else is grouping. `null` when the text holds no digits.
 */
export function parseCounterText(text: string): CounterFormat | null {
  const match = NUMBER.exec(text);
  if (!match) return null;
  const token = match[0];
  const prefix = text.slice(0, match.index);
  const suffix = text.slice(match.index + token.length);
  const separators = [...token.matchAll(/[.,]/g)].map((m) => ({ char: m[0], index: m.index! }));

  let decimal = '';
  if (separators.length > 0) {
    const kinds = new Set(separators.map((s) => s.char));
    const lastSep = separators[separators.length - 1];
    const digitsAfter = token.length - lastSep.index - 1;
    if (kinds.size > 1) decimal = lastSep.char;
    else if (separators.length === 1 && digitsAfter !== 3) decimal = lastSep.char;
  }
  const groupMatch = token.match(
    decimal === ',' ? /[.\u00a0\u202f]/ : decimal === '.' ? /[,\u00a0\u202f]/ : /[.,\u00a0\u202f]/,
  );
  const group = groupMatch ? groupMatch[0] : '';

  const decimalIndex = decimal ? token.lastIndexOf(decimal) : -1;
  const intPart = (decimalIndex >= 0 ? token.slice(0, decimalIndex) : token).replace(/[^\d-]/g, '');
  const fracPart = decimalIndex >= 0 ? token.slice(decimalIndex + 1).replace(/\D/g, '') : '';
  const value = Number(`${intPart}${fracPart ? `.${fracPart}` : ''}`);
  if (!Number.isFinite(value)) return null;
  return { prefix, suffix, value, decimals: fracPart.length, group, decimal: decimal || '.' };
}

export function formatCounter(value: number, format: CounterFormat): string {
  const fixed = Math.abs(value).toFixed(format.decimals);
  const [int, frac] = fixed.split('.');
  const grouped = format.group ? int.replace(/\B(?=(\d{3})+(?!\d))/g, format.group) : int;
  const sign = value < 0 && Number(fixed) !== 0 ? '-' : '';
  return `${format.prefix}${sign}${grouped}${frac ? `${format.decimal}${frac}` : ''}${format.suffix}`;
}
