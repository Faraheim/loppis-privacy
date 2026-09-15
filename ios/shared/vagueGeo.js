/** City-only / sentrum queries pin on a centroid — skip them. */

const VAGUE_TOKEN = /^(sentrum|centrum|senter|downtown|city|norge|norway|noreg)$/i;

export function isVagueGeoQuery(q) {
  const tokens = String(q || '')
    .toLowerCase()
    .replace(/[,.]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !VAGUE_TOKEN.test(t) && !/^\d+$/.test(t));
  return tokens.length <= 1;
}
