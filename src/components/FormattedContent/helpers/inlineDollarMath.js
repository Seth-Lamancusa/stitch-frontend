/**
 * Inline $...$ delimiter helpers.
 *
 * The content we receive sometimes uses `$...$` both for:
 *  - real inline LaTeX math
 *  - literal currency-ish values like `$1,285.7$`
 *
 * We also may see escaped dollars inside math, like `\\$900`.
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
 * Replace inline `$...$` spans using a heuristic.
 *
 * Important behavior:
 * - If a `$...$` candidate does NOT look like LaTeX, we only emit the
 *   opening `$` as literal and continue scanning from the next character.
 *   This avoids consuming the closing `$` that might be the opening for a
 *   later real LaTeX span (e.g. `$1000 ... $n$`).
 */
export function replaceInlineDollarMath(content, { onMath, onNonMathDollar } = {}) {
  const nonMath = typeof onNonMathDollar === 'function' ? onNonMathDollar : () => '$';

  let out = '';
  let i = 0;
  while (i < content.length) {
    if (content[i] !== '$' || isEscapedByBackslash(content, i)) {
      out += content[i];
      i += 1;
      continue;
    }

    // Find next unescaped '$'
    let j = i + 1;
    while (j < content.length) {
      const next = content.indexOf('$', j);
      if (next === -1) break;
      if (!isEscapedByBackslash(content, next)) {
        j = next;
        break;
      }
      j = next + 1;
    }

    // Unmatched opening '$' => keep rest verbatim.
    if (j >= content.length) {
      out += content.slice(i);
      break;
    }

    const inner = content.slice(i + 1, j);
    if (looksLikeLatexInline(inner)) {
      const raw = content.slice(i, j + 1);
      out += (typeof onMath === 'function') ? onMath({ inner, raw, start: i, end: j + 1 }) : raw;
      i = j + 1;
    } else {
      // Do NOT consume the closing '$'.
      out += nonMath({ start: i });
      i += 1;
    }
  }

  return out;
}

/**
 * Heuristic: decide whether `$...$` is intended as LaTeX math.
 *
 * Goal:
 * - Allow math-ish short forms like `$n$`, `$p$`, `$10$`, `$0.25$`.
 * - Avoid rendering `$...$` spans that look like prose/currency,
 *   e.g. `$1000 dollars and my friend has $...$`.
 */
export function looksLikeLatexInline(inner) {
  const trimmed = (inner ?? '').trim();
  if (!trimmed) return false;

  // If it crosses lines, it's almost certainly not an inline math span.
  if (/\r|\n/.test(inner)) return false;

  // Guardrail: avoid attempting KaTeX on huge spans.
  if (trimmed.length > 200) return false;

  // Strong LaTeX indicators.
  if (/(\\[a-zA-Z]+)|\\[%$&_^{}]/.test(trimmed)) return true;
  if (/(\\(times|cdot|left|right|frac|sqrt|text|mathit|mathrm|mathbf|sum|prod|pm|ge|le|gt|lt)\b)/.test(trimmed)) return true;
  if (/[=+\-^_{}]/.test(trimmed)) return true;

  const hasWhitespace = /\s/.test(trimmed);

  // If it's multi-word prose (like currency descriptions), don't treat it as math.
  // Keep this strict unless there are strong indicators above.
  if (hasWhitespace) return false;

  // No whitespace: accept common math atoms.
  // Examples: n, p, x1, 10, 0.25, 1,285.7
  if (/^-?\d[\d,]*(?:\.\d+)?\s*(?:[xX]|%)?$/.test(trimmed)) return true;
  if (/^[A-Za-z]$/.test(trimmed)) return true;
  if (/^[A-Za-z][A-Za-z0-9_]*$/.test(trimmed)) return true;
  if (/^[A-Za-z0-9]+(?:[._][A-Za-z0-9]+)*$/.test(trimmed)) return true;

  return false;
}
