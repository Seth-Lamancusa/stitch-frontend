/**
 * List / paragraph boundary helper for the message markdown renderer.
 *
 * markdown-it follows CommonMark lazy continuation: a line that is not
 * indented, directly under the last bullet, stays inside that list item.
 * With `breaks: true` it shows up on the next line, still padded with the
 * list, so it lines up with the bullet text instead of a normal paragraph.
 *
 * A blank line already ends the list. A line of its own between bullets, or
 * after the last one, is not an indented continuation of the item. Insert the
 * blank line in that case so the text uses the normal paragraph margin.
 */

const LIST_ITEM_RE = /^( *)([-+*]|\d{1,9}[.)])( +)(.*)$/;
const THEMATIC_BREAK_RE = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;

function expandTabs(line) {
  let column = 0;
  let expanded = '';
  for (const char of line) {
    if (char === '\t') {
      const size = 4 - (column % 4);
      expanded += ' '.repeat(size);
      column += size;
    } else {
      expanded += char;
      column += 1;
    }
  }
  return expanded;
}

function leadingColumns(line) {
  const match = /^ */.exec(line);
  return match ? match[0].length : 0;
}

function isBlank(line) {
  return line.trim() === '';
}

/**
 * A fence can sit at column 0 (it interrupts a list) or at the current list
 * item's content column (it belongs to that item).
 */
function matchFence(line, contentIndent) {
  const bases = contentIndent > 0 ? [0, contentIndent] : [0];
  let found = null;
  for (const offset of bases) {
    if (offset > 0 && !line.startsWith(' '.repeat(offset))) continue;
    const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(line.slice(offset));
    if (!match) continue;
    found = {
      char: match[2][0],
      len: match[2].length,
      tail: match[3],
      indent: offset + match[1].length
    };
  }
  return found;
}

function parseListItem(line) {
  if (THEMATIC_BREAK_RE.test(line)) return null;
  const match = LIST_ITEM_RE.exec(line);
  if (!match) return null;
  const markerIndent = match[1].length;
  const marker = match[2];
  const gap = match[3];
  const rest = match[4];
  const contentIndent = rest.length === 0
    ? markerIndent + marker.length + 1
    : markerIndent + marker.length + gap.length;
  return { markerIndent, contentIndent };
}

/**
 * List markers indented 4+ spaces at the root are code blocks. Inside a list,
 * a marker indented 4+ past the item content is a code block too.
 */
function classifyListItem(line, stack) {
  const item = parseListItem(line);
  if (!item) return null;
  if (stack.length === 0) {
    return item.markerIndent < 4 ? item : null;
  }
  const top = stack[stack.length - 1];
  if (item.markerIndent >= top.contentIndent + 4) return null;
  return item;
}

function openListItem(stack, item) {
  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (item.markerIndent > top.markerIndent) {
      if (item.markerIndent < top.contentIndent) {
        stack.pop();
        continue;
      }
      stack.push({ markerIndent: item.markerIndent, contentIndent: item.contentIndent });
      return;
    }
    if (item.markerIndent === top.markerIndent) {
      top.contentIndent = item.contentIndent;
      return;
    }
    stack.pop();
  }
  if (item.markerIndent < 4) {
    stack.push({ markerIndent: item.markerIndent, contentIndent: item.contentIndent });
  }
}

function contentIndentOf(stack) {
  return stack.length > 0 ? stack[stack.length - 1].contentIndent : 0;
}

function detachFollowingParagraph(stack, output, line) {
  if (stack.length === 0) return;
  const indent = leadingColumns(line);
  // Indented far enough to belong to the current item, including a wrapped
  // bullet line. A following bullet does not pull an unindented line back in.
  if (indent >= stack[stack.length - 1].contentIndent) return;

  let closed = false;
  while (stack.length > 0 && indent < stack[stack.length - 1].contentIndent) {
    stack.pop();
    closed = true;
  }
  if (closed && output.length > 0 && !isBlank(output[output.length - 1])) {
    output.push('');
  }
}

/**
 * Insert a blank line between a finished list and a paragraph that follows
 * it on the next line, so that paragraph is not rendered inside the list.
 *
 * @param {string} content
 * @returns {string}
 */
export function separateParagraphsAfterLists(content) {
  if (!content) return content;

  const newline = content.includes('\r\n') ? '\r\n' : '\n';
  const originalLines = content.split(/\r?\n/);
  const lines = originalLines.map(expandTabs);
  const output = [];
  const stack = [];
  let fence = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fenceMatch = matchFence(line, fence ? 0 : contentIndentOf(stack));

    if (fence) {
      output.push(originalLines[i]);
      if (fenceMatch && fenceMatch.char === fence.char && fenceMatch.len >= fence.len && fenceMatch.tail.trim() === '') {
        fence = null;
      }
      continue;
    }

    if (fenceMatch) {
      const indent = leadingColumns(line);
      while (stack.length > 0 && indent < stack[stack.length - 1].contentIndent) {
        stack.pop();
      }
      fence = fenceMatch;
      output.push(originalLines[i]);
      continue;
    }

    if (isBlank(line)) {
      output.push(originalLines[i]);
      continue;
    }

    const item = classifyListItem(line, stack);
    if (item) {
      openListItem(stack, item);
      output.push(originalLines[i]);
      continue;
    }

    detachFollowingParagraph(stack, output, line);
    output.push(originalLines[i]);
  }

  return output.join(newline);
}
