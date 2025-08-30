export function parseScopes(scopes) {
  const raw = typeof scopes === 'string' ? scopes : (scopes || '');
  return new Set(raw.split(' ').map(s => s.trim()).filter(Boolean));
}

export function hasScope(scopes, name) {
  return parseScopes(scopes).has(name);
}

export function hasAnyScope(scopes, names) {
  const set = parseScopes(scopes);
  return names.some(n => set.has(n));
}


