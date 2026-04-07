function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function tokensFromQuery(query: string): string[] {
  const normalized = normalize(query);
  return normalized ? normalized.split(' ') : [];
}

function matchesTokens(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  return tokens.every((token) => text.includes(token));
}

function getSearchText(el: Element): string {
  const text = el.textContent ?? '';
  const keys = el.getAttribute('data-search-keys') ?? '';
  const panelTitle = el.getAttribute('data-panel-title') ?? '';
  return normalize([text, keys, panelTitle].join(' '));
}

export { getSearchText, matchesTokens, normalize, tokensFromQuery };
