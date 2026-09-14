/** Client-side catalog for hosted iPhone PWA (same snapshot as the APK). */

const KIND_LABELS = {
  flea_market: 'Loppemarked',
  thrift: 'Bruktbutikk',
  antiques: 'Antikk',
  clothes: 'Klær',
  books: 'Bøker',
  market: 'Torg',
};

let store = { places: [], sources: [], updatedAt: '' };

export function useOfflinePwa() {
  const q = new URLSearchParams(location.search);
  if (q.get('live') === '1') return false;
  if (typeof window !== 'undefined' && window.LOPPIS_OFFLINE === true) return true;
  const h = location.hostname;
  return Boolean(h && h !== '127.0.0.1' && h !== 'localhost');
}

export function publicKind(kind) {
  return kind === 'charity' ? 'thrift' : kind;
}

function kindLabel(kind) {
  return KIND_LABELS[publicKind(kind)] || 'Sted';
}

function isValidYmd(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  return Number.isFinite(Date.parse(`${value}T12:00:00.000Z`));
}

function placeEventDates(place) {
  const out = [];
  const raw = place?.attrs?.eventDates;
  if (Array.isArray(raw)) {
    for (const d of raw) if (isValidYmd(d)) out.push(d);
  }
  if (!out.length && isValidYmd(place?.attrs?.nextDate)) out.push(place.attrs.nextDate);
  return [...new Set(out)].sort();
}

function placeMatchesDateFilter(place, filter = {}) {
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

function parseBBox(raw) {
  if (!raw) return null;
  const parts = String(raw)
    .split(',')
    .map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  return { west, south, east, north };
}

function pointInBBox(lat, lon, bbox) {
  return lat >= bbox.south && lat <= bbox.north && lon >= bbox.west && lon <= bbox.east;
}

function googleDirectionsUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

function googleStreetViewUrl(lat, lon) {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`;
}

export async function loadOfflineStore(url = './offline-store.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`offline-store ${res.status}`);
  const data = await res.json();
  store = {
    places: Array.isArray(data.places) ? data.places : [],
    sources: Array.isArray(data.sources) ? data.sources : [],
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
  return store.places.length;
}

export function offlinePlaceCount() {
  return store.places.length;
}

function toFeature(place, extra = {}) {
  const kind = publicKind(place.attrs?.kind || 'thrift');
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [place.lon, place.lat] },
    properties: {
      kind: 'venue',
      id: place.id,
      name: place.title,
      placeKind: kind,
      kindLabel: kindLabel(kind),
      indoor: Boolean(place.attrs?.indoor),
      status: place.status || 'unknown',
      sourceId: place.sourceId,
      sourceUrl: place.sourceUrl,
      deepLink: place.deepLink || place.sourceUrl,
      lastSyncedAt: place.lastSyncedAt,
      website: place.attrs?.website || null,
      kommune: place.attrs?.kommune || null,
      openingHours: place.attrs?.openingHours || null,
      address: place.attrs?.address || null,
      eventWhen: place.attrs?.eventWhen || null,
      nextDate: place.attrs?.nextDate || null,
      ...extra,
    },
  };
}

export function offlineMap(params = {}) {
  const bbox = parseBBox(params.bbox);
  const kinds = params.kinds || [];
  const q = (params.q || '').trim().toLowerCase();
  const hideClosed = params.hideClosed !== false;
  const limit = Math.min(params.limit ?? 2000, 5000);

  let places = store.places.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
  if (hideClosed) places = places.filter((p) => p.status !== 'closed');
  if (kinds.length) {
    const want = new Set(kinds.map((k) => publicKind(k)));
    places = places.filter((p) => want.has(publicKind(p.attrs?.kind)));
  }
  if (params.dateFrom || params.dateTo || params.datedOnly) {
    places = places.filter((p) =>
      placeMatchesDateFilter(p, {
        from: params.dateFrom,
        to: params.dateTo,
        dated: params.datedOnly,
      }),
    );
  }
  if (bbox) places = places.filter((p) => pointInBBox(p.lat, p.lon, bbox));
  if (q) {
    places = places.filter((p) => {
      const hay = [
        p.title,
        p.attrs?.kommune,
        p.attrs?.fylke,
        p.attrs?.operator,
        p.attrs?.address,
        p.attrs?.eventWhen,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }
  places = [...places].sort((a, b) => {
    const da = a.attrs?.nextDate || '9999-12-31';
    const db = b.attrs?.nextDate || '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return String(a.title || '').localeCompare(String(b.title || ''), 'nb');
  });
  const totalMatched = places.length;
  const sliced = places.slice(0, limit);
  return {
    type: 'FeatureCollection',
    features: sliced.map((p) => toFeature(p)),
    meta: {
      count: sliced.length,
      totalMatched,
      generatedAt: store.updatedAt,
      storeTotal: store.places.length,
    },
  };
}

export function offlinePlace(id) {
  const place = store.places.find((p) => p.id === id);
  if (!place) return null;
  const source = store.sources.find((s) => s.id === place.sourceId) || null;
  const kind = publicKind(place.attrs?.kind || 'thrift');
  return {
    place: {
      id: place.id,
      title: place.title,
      lat: place.lat,
      lon: place.lon,
      status: place.status || 'unknown',
      sourceId: place.sourceId,
      sourceUrl: place.sourceUrl,
      deepLink: place.deepLink || place.sourceUrl,
      lastSyncedAt: place.lastSyncedAt,
      attrs: {
        kind,
        indoor: Boolean(place.attrs?.indoor),
        kommune: place.attrs?.kommune ?? null,
        fylke: place.attrs?.fylke ?? null,
        address: place.attrs?.address ?? null,
        openingHours: place.attrs?.openingHours ?? null,
        website: place.attrs?.website ?? null,
        phone: place.attrs?.phone ?? null,
        notes: place.attrs?.notes ?? null,
        operator: place.attrs?.operator ?? null,
        eventWhen: place.attrs?.eventWhen ?? null,
        eventDates: place.attrs?.eventDates ?? null,
        nextDate: place.attrs?.nextDate ?? null,
      },
    },
    source: source
      ? { id: source.id, name: source.name, attribution: source.attribution || '' }
      : null,
    links: {
      directions: googleDirectionsUrl(place.lat, place.lon),
      streetView: googleStreetViewUrl(place.lat, place.lon),
    },
  };
}
