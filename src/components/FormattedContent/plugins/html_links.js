/**
 * HTML Links Formatter Plugin
 *
 * Converts plain HTML anchor tags into Markdown links so that downstream
 * markdown-it (with html disabled) will still render them as links.
 */
import { createFormatter } from './base';
import { protectCodeBlocks, protectInlineCode, protectLatexBlocks, protectInlineLatex, restoreProtectedContent } from '../helpers/protection';

/**
 * Convert HTML anchors to Markdown link syntax
 * - Handles: <a href="URL">TEXT</a>
 * - Preserves attributes only for href; others are discarded for safety
 * - Skips processing inside protected zones (code/latex)
 */
function convertAnchorsToMarkdown(input) {
  if (!input) return '';

  // Replace <a ...>...</a> with [text](href)
  // This is deliberately conservative: it captures href attribute in common forms
  const anchorRegex = /<a\s+[^>]*href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;

  return input.replace(anchorRegex, (match, _hrefAll, hrefDouble, hrefSingle, hrefBare, text) => {
    const href = hrefDouble || hrefSingle || hrefBare || '';
    const visibleText = (text || '').replace(/\s+/g, ' ').trim() || href;

    // Basic safety: only allow http(s), mailto, or relative URLs
    const isSafe = /^(https?:|mailto:|\/?(?!\/)|#)/i.test(href);
    if (!isSafe) {
      return visibleText; // Drop unsafe links but keep text
    }

    return `[${visibleText}](${href})`;
  });
}

export const htmlLinksFormatter = createFormatter(
  'html_links',
  {},
  30, // Run before markdown (markdown is 40)
  async (content, context) => {
    if (!content) return '';

    // Protect areas that should not be altered
    let processed = content;
    processed = protectCodeBlocks(processed, context);
    processed = protectInlineCode(processed, context);
    processed = protectLatexBlocks(processed, context);
    processed = protectInlineLatex(processed, context);

    // Convert anchors outside protected zones
    processed = convertAnchorsToMarkdown(processed);

    // Restore protected content
    processed = restoreProtectedContent(processed, context);

    return processed;
  }
);

export default htmlLinksFormatter;


