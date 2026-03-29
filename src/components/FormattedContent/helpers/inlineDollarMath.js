/**
 * Inline $...$ delimiter helpers.
 *
 * The content we receive sometimes uses `$...$` both for:
 *  - real inline LaTeX math
 *  - literal currency like `$1,285.7$`
 *
 * Also, we may see escaped dollars inside math, like `\$900`.
 * A naive regex like /\$([^$\n]+)\$/ breaks on those inner `$` characters.
 */

/**
 * Returns true if the character at `pos` is escaped by an odd number
 * of immediately preceding backslashes.
 */
export function isEscapedByBackslash(str, pos) {
  let backslashes = 0;
  for (let i = pos - 1; i >= 0 && str[i] === '\\'; i--) backslashes++;
  return backslashes % 2 === 1;
}

/**
 * Scans for unescaped `$...$` spans.
 *
 * Returns segments in the order they appear in the string.
 * Each segment contains:
 *  - start: index of opening `$`
 *  - end: index AFTER closing `$`
 *  - inner: content between the delimiters
 */
export function getInlineDollarSegments(content) {
  const segments = [];
  const n = content.length;

  for (let i = 0; i < n; i++) {
    if (content[i] !== '$') continue;
    if (isEscapedByBackslash(content, i)) continue;

    // Find next unescaped '$'
    let j = i + 1;
    while (j < n) {
      j = content.indexOf('$', j);
      if (j === -1) break;
      if (!isEscapedByBackslash(content, j)) {
        const inner = content.slice(i + 1, j);
        segments.push({ start: i, end: j + 1, inner });
        i = j; // advance outer loop
        break;
      }
      j = j + 1;
    }
  }

  return segments;
}

/**
 * Heuristic: decide whether `$...$` is intended as LaTeX math.
 *
 * If there's no sign of real LaTeX, we treat it as currency-ish text
 * and skip KaTeX, converting `$123$` -> `$123`.
 */
export function looksLikeLatexInline(inner) {
  const trimmed = inner.trim();
  if (!trimmed) return false;

  // If the `$...$` span crosses lines, it's very likely not intended as
  // inline math (and can easily happen when a `$` is unmatched).
  // In that case, we should treat it as plain text.
  if (/[\n\r]/.test(inner)) return false;

  // Guardrail: if it's enormous, avoid attempting KaTeX.
  if (trimmed.length > 200) return false;

  // Strong LaTeX indicators: commands/operators.
  // - \% , \times , \text{x}, \frac{...}
  // - braces, subscripts/superscripts, equals/signs, etc.
  if (/(\\[a-zA-Z]+)|(~)|\\[%$&_^{}]/.test(trimmed)) return true;
  if (/(\\(times|cdot|left|right|frac|sqrt|text|mathit|mathrm|mathbf|sum|prod|pm|ge|le|gt|lt)\b)/.test(trimmed)) {
    return true;
  }
  if (/[=+\-^_{}]/.test(trimmed)) return true;

  // If the content is basically just a number-ish token, it's probably currency.
  // Examples: 33.5\% (would be caught above by \\%), 900, 1,158.7
  if (/^-?\d[\d,]*(?:\.\d+)?\s*(?:[xX]|%)?\s*$/.test(trimmed)) return false;

  // Default: if it contains a backslash anywhere, it's probably LaTeX.
  if (trimmed.includes('\\')) return true;

  // Otherwise, treat as non-LaTeX.
  return false;
}
