/** Shared helpers (plain ESM for zero-dep Node). */

import { stripPersonNames } from './privacy.js';

export {
  DATE_PRESETS,
  addDaysYmd,
  isValidYmd,
  lastDayOfMonth,
  nextWeekendRange,
  normalizeDateRange,
  parseDateParam,
  placeEventDates,
  placeMatchesDateFilter,
  rangeForPreset,
  todayOslo,
  weekdayOslo,
} from './dateFilter.js';

export { stripPersonNames, sanitizeSources } from './privacy.js';
export { escapeHtml, safeHttpUrl } from './htmlEscape.js';
export { findSearchedRow } from './kommuneMatch.js';
export { datesFromSourceText } from './sourceDates.js';
export { statusForEventDates, uniqueEventDates } from './eventStatus.js';
export { isVagueGeoQuery } from './vagueGeo.js';

export const NORWAY_BBOX = {
  south: 57.8,
  west: 4.3,
  north: 71.3,
  east: 31.5,
};

export const OSLO_CENTER = { latitude: 59.9139, longitude: 10.7522 };

export const KIND_LABELS = {
  flea_market: 'Loppemarked',
  thrift: 'Bruktbutikk',
  antiques: 'Antikk',
  clothes: 'Klær',
  books: 'Bøker',
  market: 'Torg',
};

export const KIND_LETTERS = {
  flea_market: 'L',
  thrift: 'B',
  antiques: 'A',
  clothes: 'K',
  books: 'O',
  market: 'T',
};

/** Owner: ideelle bruktbutikker (Fretex/UFF) er bruktbutikk, ikke egen kategori. */
export function publicKind(kind) {
  return kind === 'charity' ? 'thrift' : kind;
}

export const ATTRIBUTION_BY_SOURCE = {
  osm: '(c) OpenStreetMap contributors',
  seed: 'Kuraterte Loppis-seeds (offentlig kilde + backlink)',
  aktivioslo: 'Loppemarked-oversikt © AktiviOslo',
  baerum: 'Oversikt loppemarked © Bærum kommune',
  loppemarkedene: 'Kart-punkter © loppemarkedene.com',
  loppify: 'Kommende markeder © Loppify',
  flea: 'Markedsliste © flea.no',
  hoopla: 'Arrangement via Hoopla',
};

export function kindLabel(kind) {
  return KIND_LABELS[publicKind(kind)] || 'Sted';
}

export function classifyPlace({ tags = {}, name = '' } = {}) {
  const n = `${name} ${tags.brand || ''} ${tags.operator || ''} ${tags['name:nb'] || ''}`.toLowerCase();
  const shop = tags.shop || '';
  const amenity = tags.amenity || '';

  if (
    shop === 'charity' ||
    /fretex|\buff\b|bymisjon|kirkens bymisjon|redd barna|røde.?kors|rode.?kors|frelsesarm/.test(n)
  ) {
    return 'thrift';
  }
  if (shop === 'antiques' || /antikk|antikvit|antique/.test(n)) return 'antiques';
  if (shop === 'books' || /bruktbok|antikvariat|used.?book/.test(n)) return 'books';
  if (shop === 'clothes' || /bruktkl|vintage.?kl|second.?hand.?cloth/.test(n)) return 'clothes';
  if (shop === 'flea_market' || /loppemarked|loppis|flea.?market|loppemarknad/.test(n)) {
    return 'flea_market';
  }
  if (shop === 'second_hand') return 'thrift';
  if (amenity === 'marketplace') {
    if (/brukt|loppis|loppemarked|vintage/.test(n)) return 'flea_market';
    return 'market';
  }
  if (tags.second_hand === 'yes' && shop === 'books') return 'books';
  if (tags.second_hand === 'yes' && shop === 'clothes') return 'clothes';
  return 'thrift';
}

export function shouldSkipElement(tags = {}, name = '') {
  const shop = tags.shop || '';
  const amenity = tags.amenity || '';
  const blob = `${name} ${shop} ${amenity}`.toLowerCase();
  if (['car', 'car_repair', 'car_parts', 'motorcycle', 'tyres'].includes(shop)) return true;
  if (['hotel', 'restaurant', 'cafe', 'bar', 'fast_food', 'fuel', 'parking'].includes(amenity)) {
    return true;
  }
  if (/bruktbil\b|used.?car|bilforhandler/.test(blob) && !/klær|møbel|møbler|loppis/.test(blob)) {
    return true;
  }
  return false;
}

export function attributionsFromSources(sources = [], places = null) {
  const ids = new Set();
  if (Array.isArray(places)) {
    for (const p of places) {
      if (p?.sourceId) ids.add(p.sourceId);
      for (const sid of p?.sourceIds || []) ids.add(sid);
    }
  } else if (Array.isArray(sources)) {
    for (const s of sources) if (s?.id) ids.add(s.id);
  }
  const lines = [];
  for (const id of ids) {
    const fromSource = sources?.find((s) => s.id === id)?.attribution;
    lines.push(stripPersonNames(fromSource || ATTRIBUTION_BY_SOURCE[id] || id));
  }
  if (!lines.length) lines.push(ATTRIBUTION_BY_SOURCE.osm);
  return [...new Set(lines)];
}

export function pointInBBox(lat, lon, bbox) {
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
}

export function parseBBox(raw) {
  if (!raw) return null;
  const parts = String(raw)
    .split(',')
    .map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  return { west, south, east, north };
}

export function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function googleDirectionsUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

export function googleStreetViewUrl(lat, lon) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
}

export function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function inferIndoor(tags = {}, name = '') {
  if (tags.indoor === 'yes' || tags.building) return true;
  if (/butikk|shop|hall|inne/i.test(name) && !/torg|marked|ute/i.test(name)) return true;
  if (tags.amenity === 'marketplace' && tags.indoor !== 'yes') return false;
  return Boolean(tags.shop);
}
