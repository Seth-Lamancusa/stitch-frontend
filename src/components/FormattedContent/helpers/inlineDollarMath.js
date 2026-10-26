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
 * Map curly quotes and unicode primes onto ASCII `'`, which KaTeX typesets as a prime.
 */
const UNICODE_PRIMES = [
  [/‴/g, "'''"],
  [/″/g, "''"],
  [/[’‘‛ʼ′‵]/g, "'"]
];

export function normalizeMathPrimes(text) {
  let out = text ?? '';
  for (const [pattern, replacement] of UNICODE_PRIMES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

function skipSpaces(text, i) {
  while (text[i] === ' ' || text[i] === '\t') i++;
  return i;
}

function consumePrimes(text, i) {
  while (text[i] === "'") i++;
  return i;
}

/**
 * A number, optionally carrying a degree mark (`0°`, `135°`).
 * Commas are list separators, so `1,285.7` is two numeric atoms.
 */
function parseNumber(text, i) {
  const match = /^-?\d+(?:\.\d+)?(?:[xX]|%)?°?/.exec(text.slice(i));
  return match ? i + match[0].length : -1;
}

function parseDelimited(text, i, open, close) {
  if (text[i] !== open) return -1;
  const innerEnd = parseExprList(text, skipSpaces(text, i + 1));
  if (innerEnd < 0) return -1;
  const end = skipSpaces(text, innerEnd);
  if (text[end] !== close) return -1;
  return end + 1;
}

/**
 * An identifier (`n`, `foo`, `x1`, `a.b`), trailing primes, and an optional
 * call whose arguments are themselves a math list: `E(a, b)`, `E(a, b')`.
 */
function parseIdent(text, i) {
  const match = /^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)*/.exec(text.slice(i));
  if (!match) return -1;
  let pos = consumePrimes(text, i + match[0].length);
  if (text[pos] !== '(') return pos;

  pos = skipSpaces(text, pos + 1);
  const innerEnd = parseExprList(text, pos);
  if (innerEnd < 0) return -1;
  pos = skipSpaces(text, innerEnd);
  if (text[pos] !== ')') return -1;
  return consumePrimes(text, pos + 1);
}

function parsePrimary(text, i) {
  if (i >= text.length) return -1;
  if (text[i] === '{') return parseDelimited(text, i, '{', '}');
  if (text[i] === '(') return parseDelimited(text, i, '(', ')');
  const asNumber = parseNumber(text, i);
  if (asNumber > i) return asNumber;
  return parseIdent(text, i);
}

/** Tight superscripts and subscripts: `$a^2$`, `$x_1$`, `$x_{ab}$`. */
function parsePostfix(text, i) {
  let pos = parsePrimary(text, i);
  if (pos < 0) return -1;
  while (text[pos] === '^' || text[pos] === '_') {
    const next = parsePrimary(text, pos + 1);
    if (next < 0) return -1;
    pos = next;
  }
  return pos;
}

function parseUnary(text, i) {
  if (text[i] === '+' || text[i] === '-') return parseUnary(text, i + 1);
  return parsePostfix(text, i);
}

/**
 * Atoms joined by `=`, `+`, or `-`. Spaces are allowed beside those
 * operators and beside commas, and nowhere else. A prose hyphen such as
 * `full-year` only counts when the entire span is that expression, so a
 * later currency dollar cannot swallow the sentence in between.
 */
function parseExpr(text, i) {
  let pos = parseUnary(text, i);
  if (pos < 0) return -1;
  while (pos < text.length) {
    const op = skipSpaces(text, pos);
    if (text[op] !== '=' && text[op] !== '+' && text[op] !== '-') return pos;
    const next = parseUnary(text, skipSpaces(text, op + 1));
    if (next < 0) return -1;
    pos = next;
  }
  return pos;
}

function parseExprList(text, i) {
  let pos = parseExpr(text, i);
  if (pos < 0) return -1;
  while (pos < text.length) {
    const comma = skipSpaces(text, pos);
    if (text[comma] !== ',') return pos;
    const next = parseExpr(text, skipSpaces(text, comma + 1));
    if (next < 0) return -1;
    pos = next;
  }
  return pos;
}

function isMathExpression(text) {
  return parseExprList(text, 0) === text.length;
}

/**
 * Heuristic: decide whether `$...$` is intended as LaTeX math.
 *
 * Goal:
 * - Allow math-ish short forms like `$n$`, `$a'$`, `$a, a'$`, `$E(a, b)$`, `$0°$`.
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

  const normalized = normalizeMathPrimes(trimmed);

  // A LaTeX command is enough on its own. A bare hyphen or plus is not:
  // `$4.6 billion ... full-year ... $380M` would otherwise become one span.
  if (/(\\[a-zA-Z]+)|\\[%$&_^{}]/.test(normalized)) return true;

  return isMathExpression(normalized);
}
