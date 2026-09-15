/** Match hunt/search rows to catalog.searched by nr or fylke — never first duplicate name. */

export function findSearchedRow(list, row) {
  const kommune = String(row?.kommune || '').trim();
  if (!kommune) return null;
  const matches = (list || []).filter((s) => s.kommune === kommune);
  if (!matches.length) return null;
  if (row.nr != null && String(row.nr).trim() !== '') {
    return matches.find((s) => String(s.nr) === String(row.nr)) || null;
  }
  if (row.fylke) {
    return matches.find((s) => s.fylke === row.fylke) || null;
  }
  if (matches.length === 1) return matches[0];
  return null;
}
