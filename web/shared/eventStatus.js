/** Open only when today is an actual event date — not the span between first and last. */

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

export function uniqueEventDates(dates) {
  return [...new Set((dates || []).filter(isYmd))].sort();
}

export function statusForEventDates(dates, today) {
  const ds = uniqueEventDates(dates);
  if (!ds.length) return 'planned';
  if (isYmd(today) && ds.includes(today)) return 'open';
  return 'planned';
}
