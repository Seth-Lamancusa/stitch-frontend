/**
 * MCP Examples Formatter Plugin
 *
 * Detects MCP tool example sections and converts them into fenced code blocks
 * with appropriate languages (json, typescript, python). It also inserts a
 * centered visual separator for lines containing only "..." or "…" and for
 * consecutive blank line runs (>= 2).
 */
import { createFormatter } from './base';

function normalizeSmartQuotes(input) {
  if (!input) return input;
  return input
    .replace(/[“”„‟]/g, '"')
    .replace(/[‘’‚‛]/g, "'");
}

function isSeparatorLine(line) {
  if (line == null) return false;
  const trimmed = line.trim();
  return trimmed === '...' || trimmed === '…';
}

// Headers to detect sections
const SECTION_HEADERS = [
  { key: 'json', regex: /pure\s+json[^(]*\([^)]*\)?:/i, lang: 'json' },
  { key: 'ts', regex: /typescript\s+sdk\s+shape[^(]*\([^)]*\)?:/i, lang: 'typescript' },
  { key: 'py', regex: /python\s+sdk[^(]*\([^)]*\)?:/i, lang: 'python' }
];

export const mcpExamplesFormatter = createFormatter(
  'mcp_examples',
  {},
  30, // Run before markdown (which is 40)
  async (content, context) => {
    if (!content) return '';

    const { protectedZones } = context;
    const lines = content.split('\n');
    const outputLines = [];

    function pushSeparator() {
      const placeholder = `STITCH_PROTECTED_SEPARATOR_${Math.random().toString(36).slice(2)}`;
      protectedZones.set(placeholder, '<div class="fc-separator">…</div>');
      outputLines.push(placeholder);
    }

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Handle separator line ("..." or "…")
      if (isSeparatorLine(line)) {
        pushSeparator();
        i += 1;
        continue;
      }

      // Handle consecutive blank lines as separator
      if (trimmed === '') {
        let j = i;
        while (j < lines.length && lines[j].trim() === '') j += 1;
        const blankCount = j - i;
        if (blankCount >= 2) {
          pushSeparator();
          i = j;
          continue;
        }
        // Keep a single blank line
        outputLines.push('');
        i += 1;
        continue;
      }

      // Section header detection
      const header = SECTION_HEADERS.find(h => h.regex.test(line));
      if (header) {
        // Collect block lines until next header, separator, or end
        i += 1; // skip header line
        const block = [];
        while (i < lines.length) {
          const l = lines[i];
          if (isSeparatorLine(l)) break;
          if (l.trim() === '') {
            // Lookahead: if next non-empty is another header, stop here to avoid
            // swallowing that header's block.
            let k = i + 1;
            while (k < lines.length && lines[k].trim() === '') k += 1;
            if (k < lines.length && SECTION_HEADERS.some(h => h.regex.test(lines[k]))) {
              break;
            }
          }
          if (SECTION_HEADERS.some(h => h.regex.test(l))) break;
          block.push(l);
          i += 1;
        }

        // Trim trailing blanks from block
        while (block.length && block[block.length - 1].trim() === '') block.pop();
        // Normalize quotes in code
        const code = normalizeSmartQuotes(block.join('\n'));
        outputLines.push('```' + header.lang);
        outputLines.push(code);
        outputLines.push('```');
        continue;
      }

      // Default: passthrough line
      outputLines.push(line);
      i += 1;
    }

    return outputLines.join('\n');
  }
);

export default mcpExamplesFormatter;


