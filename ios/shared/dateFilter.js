/** Oslo calendar dates for Loppis event filter. Do not use UTC-today. */

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

const WEEKDAY_SUN0 = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export const DATE_PRESETS = [
  { id: 'today', label: 'I dag' },
  { id: 'tomorrow', label: 'I morgen' },
  { id: 'weekend', label: 'Helg' },
  { id: '7d', label: '7 dager' },
  { id: 'month', label: 'Denne måneden' },
  { id: 'dated', label: 'Med dato' },
  { id: 'custom', label: 'Fra–til' },
];

export function isValidYmd(value) {
  if (!YMD_RE.test(String(value || ''))) return false;
  return Number.isFinite(Date.parse(`${value}T12:00:00.000Z`));
}

export function todayOslo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(now);
}

export function weekdayOslo(now = new Date()) {
  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Oslo',
    weekday: 'short',
  }).format(now);
  return WEEKDAY_SUN0[raw.slice(0, 3)] ?? 0;
}

export function addDaysYmd(ymd, days) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  return dt.toISOString().slice(0, 10);
}

export function lastDayOfMonth(ymd) {
  const [y, m] = String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

export function normalizeDateRange(from, to) {
  const f = from && isValidYmd(from) ? from : null;
  const t = to && isValidYmd(to) ? to : null;
  if (f && t && f > t) return { from: t, to: f };
  return { from: f, to: t };
}

/** Next Fri–Sun in Europe/Oslo (if Sat/Sun, use the current weekend). */
export function nextWeekendRange(now = new Date()) {
  const today = todayOslo(now);
  const day = weekdayOslo(now);
  let toFriday;
  if (day === 0) toFriday = -2;
  else if (day === 6) toFriday = -1;
  else if (day === 5) toFriday = 0;
  else toFriday = 5 - day;
  const fri = addDaysYmd(today, toFriday);
  return { from: fri, to: addDaysYmd(fri, 2) };
}

/**
 * @param {string | null | undefined} id
 * @param {{ from?: string | null, to?: string | null }} [custom]
 * @param {Date} [now]
 */
export function rangeForPreset(id, custom = {}, now = new Date()) {
  const today = todayOslo(now);
  if (!id) return {};
  if (id === 'today') return { from: today, to: today };
  if (id === 'tomorrow') {
    const t = addDaysYmd(today, 1);
    return { from: t, to: t };
  }
  if (id === 'weekend') return nextWeekendRange(now);
  if (id === '7d') return { from: today, to: addDaysYmd(today, 6) };
  if (id === 'month') return { from: today, to: lastDayOfMonth(today) };
  if (id === 'dated') return { dated: true };
  if (id === 'custom') {
    const n = normalizeDateRange(custom.from, custom.to);
    if (n.from && !n.to) return { from: n.from, to: n.from };
    return n;
  }
  return {};
}

export function parseDateParam(raw) {
  const v = String(raw || '').trim();
  return isValidYmd(v) ? v : null;
}

export function placeEventDates(place) {
  const out = [];
  const raw = place?.attrs?.eventDates;
  if (Array.isArray(raw)) {
    for (const d of raw) if (isValidYmd(d)) out.push(d);
  }
  if (!out.length && isValidYmd(place?.attrs?.nextDate)) out.push(place.attrs.nextDate);
  return [...new Set(out)].sort();
}

/**
 * Dated filter hides standing shops without a sale date.
 * A multi-day event matches if any ISO day overlaps [from, to].
 */
export function placeMatchesDateFilter(place, filter = {}) {
  const from = filter.from && isValidYmd(filter.from) ? filter.from : null;
  const to = filter.to && isValidYmd(filter.to) ? filter.to : null;
  const datedOnly = Boolean(filter.dated);
  if (!from && !to && !datedOnly) return true;
  const dates = placeEventDates(place);
  if (!dates.length) return false;
  if (!from && !to) return true;
  const start = from || '0000-01-01';
  const end = to || '9999-12-31';
  return dates.some((d) => d >= start && d <= end);
}
