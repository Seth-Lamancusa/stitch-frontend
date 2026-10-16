// Allowlisted message font presets. Ids must match the backend allowlist
// in stitch-backend/app/models/fonts.py. Values are CSS font-family stacks
// for system fonts — v1 does not load remote files.

export const FONT_PRESETS = {
  georgia: {
    label: 'Georgia',
    family: 'Georgia, "Times New Roman", Times, serif',
    source: 'system',
  },
  times: {
    label: 'Times New Roman',
    family: '"Times New Roman", Times, serif',
    source: 'system',
  },
  palatino: {
    label: 'Palatino',
    family: 'Palatino, "Palatino Linotype", "Book Antiqua", serif',
    source: 'system',
  },
  garamond: {
    label: 'Garamond',
    family: 'Garamond, "EB Garamond", "Times New Roman", serif',
    source: 'system',
  },
  courier: {
    label: 'Courier',
    family: '"Courier New", Courier, monospace',
    source: 'system',
  },
  'comic-sans': {
    label: 'Comic Sans',
    family: '"Comic Sans MS", "Comic Sans", cursive',
    source: 'system',
  },
  trebuchet: {
    label: 'Trebuchet',
    family: '"Trebuchet MS", Trebuchet, sans-serif',
    source: 'system',
  },
  verdana: {
    label: 'Verdana',
    family: 'Verdana, Geneva, sans-serif',
    source: 'system',
  },
  impact: {
    label: 'Impact',
    family: 'Impact, Haettenschweiler, "Arial Narrow Bold", sans-serif',
    source: 'system',
  },
};

export const FONT_PRESET_LIST = Object.entries(FONT_PRESETS).map(([id, preset]) => ({
  id,
  ...preset,
}));

export function resolveMessageFont(id) {
  if (!id || typeof id !== 'string') return null;
  return FONT_PRESETS[id]?.family ?? null;
}

export function messageFontStyle(id) {
  const family = resolveMessageFont(id);
  return family ? { '--author-font': family } : undefined;
}
