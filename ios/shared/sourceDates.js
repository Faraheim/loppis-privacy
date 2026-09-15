/** Parse Norwegian calendar phrases. Skip dates that have no year in the source text. */

const MONTHS = {
  jan: 1,
  januar: 1,
  feb: 2,
  februar: 2,
  mar: 3,
  mars: 3,
  apr: 4,
  april: 4,
  mai: 5,
  jun: 6,
  juni: 6,
  jul: 7,
  juli: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  okt: 10,
  oktober: 10,
  nov: 11,
  november: 11,
  des: 12,
  desember: 12,
};

function monthNum(raw) {
  const key = String(raw || '')
    .toLowerCase()
    .replace(/\./g, '');
  return MONTHS[key] || 0;
}

function isoDate(year, month, day) {
  if (!year || !month || !day) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return dt.toISOString().slice(0, 10);
}

function uniqueSorted(dates) {
  return [...new Set(dates.filter(Boolean))].sort();
}

export function datesFromSourceText(text) {
  const src = String(text || '');
  const out = [];

  const iso = [...src.matchAll(/\b(20\d{2})-(\d{2})-(\d{2})\b/g)];
  for (const m of iso) {
    out.push(isoDate(Number(m[1]), Number(m[2]), Number(m[3])));
  }

  const withYear =
    /(\d{1,2})\.?(?:\s*(?:og|&)\s*(\d{1,2}))?\.?\s*(januar|februar|mars|april|mai|juni|juli|august|september|oktober|november|desember|jan|feb|mar|apr|jun|jul|aug|sept?|okt|nov|des)\.?\s+(20\d{2})/gi;
  let m;
  while ((m = withYear.exec(src))) {
    const month = monthNum(m[3]);
    const year = Number(m[4]);
    out.push(isoDate(year, month, Number(m[1])));
    if (m[2]) out.push(isoDate(year, month, Number(m[2])));
  }

  return uniqueSorted(out);
}
