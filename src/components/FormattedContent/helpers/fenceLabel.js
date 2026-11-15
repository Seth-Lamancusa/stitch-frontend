/**
 * The label written after a fence's opening ticks.
 * A bracketed label keeps its brackets, including spaces inside them.
 * A plain label is the first word, usually a language name.
 */
export function fenceLabelFromInfo(info) {
  const trimmed = String(info || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']');
    if (end > 0) return trimmed.slice(0, end + 1);
  }
  return trimmed.split(/\s+/)[0];
}

export function fenceLabelFromClass(className) {
  const match = String(className || '').match(/(?:^|\s)language-(\S+)/);
  return match ? match[1] : '';
}
