/** Never keep personal names in public attribution or UI copy. */

const NAME_IN_PARENS =
  /\s*\([^)]*\b[A-ZÆØÅ][a-zæøå]+(?:\s+[A-ZÆØÅ][a-zæøå]+){1,3}\b[^)]*\)/g;

export function stripPersonNames(text) {
  return String(text || '')
    .replace(NAME_IN_PARENS, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .trim();
}

export function sanitizeSources(sources = []) {
  return (Array.isArray(sources) ? sources : []).map((s) => ({
    ...s,
    attribution: stripPersonNames(s?.attribution || ''),
  }));
}
