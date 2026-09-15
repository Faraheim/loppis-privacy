/** Phone-side calendar pull. No git catalog. Facebook = deep-link only. */

import { todayOslo } from './dateFilter.js';
import { statusForEventDates, uniqueEventDates } from './eventStatus.js';
import { NORWAY_BBOX, normalizeName, pointInBBox } from './index.js';
import { sanitizeSources } from './privacy.js';
import { datesFromSourceText } from './sourceDates.js';

export const CALENDAR_SOURCE_IDS = [
  'aktivioslo',
  'baerum',
  'loppify',
  'flea',
  'loppemarkedene',
  'hoopla',
];

export const LIVE_HTML_SOURCES = [
  {
    id: 'aktivioslo',
    url: 'https://aktivioslo.no/guide/loppemarked-oslo/',
    parse: parseAktivioslo,
  },
  {
    id: 'baerum',
    url: 'https://www.baerum.kommune.no/tjenester/avfall-og-gjenvinning/ombruk/oversikt-loppemarked-baerum/',
    parse: parseBaerum,
  },
  { id: 'loppify', url: 'https://loppify.market/markeder', parse: parseLoppify },
  { id: 'flea', url: 'https://flea.no/alle-marked', parse: parseFlea },
  { id: 'loppemarkedene', url: 'https://www.loppemarkedene.com/', parse: parseLoppemarkedene },
];

export const HOOPLA_CITIES = [
  'Oslo',
  'Bergen',
  'Trondheim',
  'Stavanger',
  'Drammen',
  'Kristiansand',
  'Tromsø',
  'Bodø',
  'Ålesund',
  'Fredrikstad',
  'Sandnes',
  'Skien',
  'Porsgrunn',
  'Lillestrøm',
  'Tønsberg',
  'Hamar',
  'Moss',
  'Sarpsborg',
  'Haugesund',
  'Arendal',
  'Lillehammer',
  'Asker',
  'Sandefjord',
  'Larvik',
  'Horten',
  'Kongsberg',
  'Gjøvik',
  'Molde',
];

const SOURCE_META = {
  aktivioslo: { name: 'AktiviOslo', attribution: 'Loppemarked-oversikt © AktiviOslo' },
  baerum: { name: 'Bærum kommune', attribution: 'Oversikt loppemarked © Bærum kommune' },
  loppemarkedene: { name: 'Loppemarkedene', attribution: 'Kart-punkter © loppemarkedene.com' },
  loppify: { name: 'Loppify', attribution: 'Kommende markeder © Loppify' },
  flea: { name: 'Flea', attribution: 'Markedsliste © flea.no' },
  hoopla: { name: 'Hoopla', attribution: 'Arrangement via Hoopla' },
};

const MONTHS = {
  januar: 1,
  jan: 1,
  februar: 2,
  feb: 2,
  mars: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mai: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
};

export function isGitCatalogUrl(url) {
  const s = String(url || '');
  if (/offline-store\.json/i.test(s) && /github/i.test(s)) return true;
  if (/raw\.githubusercontent\.com/i.test(s) && /offline-store/i.test(s)) return true;
  return false;
}

export const LIVE_FETCH_HEADERS = {
  Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
  'User-Agent': 'Loppis/0.1.2 (Norway flea-market map; user-device calendar pull)',
};

export function hooplaEventsUrl(city) {
  return `https://api.hoopla.no/api/public/v3.1/events?c=${encodeURIComponent(city)}`;
}

function decodeHtml(s) {
  return String(s || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&oslash;/gi, 'ø')
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&aring;/gi, 'å')
    .replace(/&Aring;/g, 'Å')
    .replace(/&aelig;/gi, 'æ')
    .replace(/&AElig;/g, 'Æ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function monthNum(raw) {
  const key = String(raw || '')
    .toLowerCase()
    .replace(/\./g, '');
  return MONTHS[key] || null;
}

function uniqueDates(list) {
  return uniqueEventDates(list);
}

function isSocial(url) {
  return /facebook\.com|instagram\.com|tiktok\.com/i.test(url || '');
}

export function venueKey(title, kommune) {
  const core = normalizeName(String(title || '').replace(/loppemarked(et|ene)?/gi, ' '));
  return `${core}|${normalizeName(kommune || '')}`;
}

export function parseAktivioslo(html) {
  const page = 'https://aktivioslo.no/guide/loppemarked-oslo/';
  const out = [];
  const re =
    /<a href="([^"]+)"[^>]*>\s*([^<]+?)\s+(\d{1,2})\.\s*(?:og\s+(\d{1,2})\.\s*)?([a-zæøå]+)\s+(20\d{2})\s*<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const href = m[1];
    const title = decodeHtml(m[2]).replace(/\s+/g, ' ').trim();
    const d1 = Number(m[3]);
    const d2 = m[4] ? Number(m[4]) : d1;
    const month = monthNum(m[5]);
    const year = Number(m[6]);
    if (!title || !month || !year) continue;
    const dates = uniqueDates([isoDate(year, month, d1), isoDate(year, month, d2)]);
    out.push({
      sourceId: 'aktivioslo',
      externalId: `aktivioslo:${title}:${dates[0]}`,
      title: `Loppemarked ${title}`,
      kommune: 'Oslo',
      dates,
      type: 'Loppemarked',
      sourceUrl: page,
      website: isSocial(href) ? null : href,
      deepLink: href,
    });
  }
  return out;
}

export function parseBaerum(html) {
  const page =
    'https://www.baerum.kommune.no/tjenester/avfall-og-gjenvinning/ombruk/oversikt-loppemarked-baerum/';
  const chunks = html.split(/<h3\b[^>]*>/i).slice(1);
  const out = [];
  for (const chunk of chunks) {
    const nameMatch = chunk.match(/^([\s\S]*?)<\/h3>/i);
    if (!nameMatch) continue;
    const title = decodeHtml(nameMatch[1]);
    if (!title || /ønsker du|facebook|tips/i.test(title)) continue;
    const body = chunk.slice(0, 2500);
    const lis = [...body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => decodeHtml(x[1]));
    const scan = lis.length ? lis.join(' ') : body;
    const yearHit = body.match(/\b(20\d{2})\b/);
    const datedScan = yearHit ? `${scan} ${yearHit[1]}` : scan;
    const uniq = datesFromSourceText(datedScan);
    const timeRe = /kl\.?\s*([\d.:]+)\s*[–\-]\s*([\d.:]+)/i;
    const tm = (lis[0] || body).match(timeRe);
    const link = body.match(/href="(https?:[^"]+)"/i);
    const href = link ? decodeHtml(link[1]) : null;
    if (!uniq.length) continue;
    out.push({
      sourceId: 'baerum',
      externalId: `baerum:${title}:${uniq[0]}`,
      title: /loppemarked|brukttøy|kirke|hallen/i.test(title) ? title : `Loppemarked ${title}`,
      kommune: 'Bærum',
      dates: uniq,
      hours: tm ? `${tm[1]}–${tm[2]}` : null,
      type: /kirke|brukttøy/i.test(title) ? 'Bruktmarked' : 'Loppemarked',
      sourceUrl: page,
      website: href && !isSocial(href) ? href : null,
      deepLink: href || page,
    });
  }
  return out;
}

export function parseLoppify(html) {
  const out = [];
  const re =
    /<a class="lp-landing-card" href="([^"]+)">[\s\S]*?lp-landing-card__date">([^<]+)<[\s\S]*?lp-landing-card__name">([^<]+)<[\s\S]*?lp-landing-card__sub">([^<]+)</g;
  let m;
  while ((m = re.exec(html))) {
    let href;
    try {
      href = new URL(m[1], 'https://loppify.market/').href;
    } catch {
      continue;
    }
    const dateText = decodeHtml(m[2]);
    const title = decodeHtml(m[3]);
    const sub = decodeHtml(m[4]);
    const [city, type] = sub.split('·').map((s) => s.trim());
    const dates = loppifyDates(dateText, title);
    if (!title || !dates.length) continue;
    out.push({
      sourceId: 'loppify',
      externalId: `loppify:${href}`,
      title,
      kommune: city || null,
      dates,
      type: type || 'Loppemarked',
      sourceUrl: href,
      website: href,
      deepLink: href,
    });
  }
  return out;
}

function yearInSourceText(text) {
  const m = String(text || '').match(/\b(20\d{2})\b/);
  return m ? Number(m[1]) : null;
}

function loppifyDates(dateText, title) {
  const fromDate = datesFromSourceText(dateText);
  if (fromDate.length) return fromDate;
  const year = yearInSourceText(`${dateText} ${title}`);
  if (!year) return [];
  const dateLine = String(dateText || '')
    .replace(/·.*/, '')
    .trim();
  return datesFromSourceText(`${dateLine} ${year}`);
}

export function parseFlea(html) {
  const out = [];
  const blocks = html.split(/<a href="(https:\/\/flea\.no\/marked\/[^"]+)"/g);
  for (let i = 1; i < blocks.length; i += 2) {
    const href = blocks[i];
    const body = blocks[i + 1] || '';
    const nameMatch = body.match(/>([^<]+)<\/a>/);
    if (!nameMatch) continue;
    const raw = decodeHtml(nameMatch[1]);
    const comma = raw.lastIndexOf(',');
    const title = (comma > 0 ? raw.slice(0, comma) : raw).trim();
    const kommune = (comma > 0 ? raw.slice(comma + 1) : '').trim() || null;
    const dates = [];
    const hours = [];
    const re =
      /(?:Mandag|Tirsdag|Onsdag|Torsdag|Fredag|Lørdag|Søndag)\s+(\d{1,2})\.\s+([a-zæøå]+)\s+(20\d{2})\s+(\d{2}:\d{2}):\d{2}-(\d{2}:\d{2})/gi;
    let dm;
    while ((dm = re.exec(body))) {
      const month = monthNum(dm[2]);
      if (!month) continue;
      dates.push(isoDate(Number(dm[3]), month, Number(dm[1])));
      hours.push(`${dm[4]}–${dm[5]}`);
    }
    const uniq = uniqueDates(dates);
    if (!title || !uniq.length) continue;
    out.push({
      sourceId: 'flea',
      externalId: `flea:${href}`,
      title,
      kommune,
      dates: uniq,
      hours: hours[0] || null,
      type: 'Loppemarked',
      sourceUrl: href,
      website: href,
      deepLink: href,
    });
  }
  return out;
}

export function parseLoppemarkedene(html) {
  const m = String(html || '').match(/var oum_all_locations = (\[[\s\S]*?\]);/);
  if (!m) return [];
  let rows;
  try {
    rows = JSON.parse(m[1]);
  } catch {
    return [];
  }
  const out = [];
  for (const row of rows || []) {
    const title = decodeHtml(row.title || '');
    const content = decodeHtml(row.content || '');
    const lat = Number(row.lat);
    const lon = Number(row.lng ?? row.lon);
    if (!title || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const uniq = datesFromSourceText(content);
    if (!uniq.length) continue;
    const fb = content.match(/https?:\/\/(?:www\.)?facebook\.com\/[^\s<"]+/i);
    const site = content.match(/https?:\/\/(?!www\.facebook\.com|instagram\.com)[^\s<"]+/i);
    out.push({
      sourceId: 'loppemarkedene',
      externalId: `loppemarkedene:${title}:${uniq[0]}`,
      title: /loppemarked/i.test(title) ? title : `Loppemarked ${title}`,
      kommune: null,
      dates: uniq,
      type: 'Loppemarked',
      sourceUrl: 'https://www.loppemarkedene.com/',
      website: site?.[0] || null,
      deepLink: fb?.[0] || site?.[0] || 'https://www.loppemarkedene.com/',
      lat,
      lon,
      geoSource: 'loppemarkedene',
    });
  }
  return out;
}

function isFleaHoopla(row) {
  const blob = `${row.event_name || ''} ${row.description || ''} ${row.category || ''}`.toLowerCase();
  return /loppemarked|loppis|bruktm|garasjesalg|byttemarked|antikkmarked|gjenbruksmarked|loppemarknad/.test(
    blob,
  );
}

export function parseHooplaEvents(body, city) {
  const events = Array.isArray(body?.events) ? body.events : [];
  const out = [];
  for (const row of events) {
    if (row.is_cancelled || !isFleaHoopla(row)) continue;
    const title = String(row.event_name || '').trim();
    const start = row.start ? new Date(row.start) : null;
    if (!title || !start || Number.isNaN(start.getTime())) continue;
    const end = row.end ? new Date(row.end) : start;
    const lat = Number(row.location?.coordinates?.latitude);
    const lon = Number(row.location?.coordinates?.longitude);
    const dates = uniqueDates([todayOslo(start), todayOslo(end)]);
    const url = row.event_sales_page_url || null;
    out.push({
      sourceId: 'hoopla',
      externalId: `hoopla:${row.event_id || row.event_identifier}`,
      title,
      kommune: row.location?.city || city,
      dates,
      type: 'Loppemarked',
      sourceUrl: url || 'https://hoopla.no/',
      website: url,
      deepLink: url,
      lat: Number.isFinite(lat) ? lat : undefined,
      lon: Number.isFinite(lon) ? lon : undefined,
      geoSource: Number.isFinite(lat) ? 'hoopla' : undefined,
      address: [row.location?.street_address, row.location?.place].filter(Boolean).join(', ') || null,
      operator: row.organization?.name || null,
    });
  }
  return out;
}

export function attachKnownGeo(rows, localPlaces = []) {
  const known = new Map();
  for (const p of localPlaces || []) {
    if (!Number.isFinite(p?.lat) || !Number.isFinite(p?.lon)) continue;
    known.set(venueKey(p.title, p.attrs?.kommune || p.kommune), { lat: p.lat, lon: p.lon });
  }
  for (const row of rows || []) {
    if (Number.isFinite(row.lat) && Number.isFinite(row.lon)) {
      known.set(venueKey(row.title, row.kommune), { lat: row.lat, lon: row.lon });
    }
  }
  return (rows || []).map((row) => {
    if (Number.isFinite(row.lat) && Number.isFinite(row.lon)) return row;
    const hit = known.get(venueKey(row.title, row.kommune));
    if (!hit) return row;
    return { ...row, lat: hit.lat, lon: hit.lon, geoSource: row.geoSource || 'reuse' };
  });
}

function kindFromType(type, title) {
  const blob = `${type || ''} ${title || ''}`.toLowerCase();
  if (/antikk/.test(blob) && !/loppemarked/.test(blob)) return 'antiques';
  if (/bruktmarked|torg|gjenbruk/.test(blob) && !/loppemarked|loppis/.test(blob)) return 'market';
  return 'flea_market';
}

function indoorFromTitle(title, type) {
  const blob = `${title || ''} ${type || ''}`.toLowerCase();
  if (/torg|park|utomhus|ute/.test(blob) && !/skole|hall|kirke/.test(blob)) return false;
  if (/skole|hall|kirke|samfunnshus/.test(blob)) return true;
  return true;
}

function formatEventWhen(dates) {
  const ds = uniqueDates(dates);
  if (!ds.length) return null;
  const fmt = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d}.${m}.${y}`;
  };
  if (ds.length === 1) return fmt(ds[0]);
  return `${fmt(ds[0])} – ${fmt(ds[ds.length - 1])}`;
}

function placeId(sourceId, externalId) {
  return `loppis-${sha1Hex(`${sourceId}:${externalId}`).slice(0, 12)}`;
}

export function rowsToPlaces(rows, today = todayOslo()) {
  const out = [];
  for (const row of rows || []) {
    const dates = uniqueDates(row.dates).filter((d) => d >= today);
    if (!dates.length) continue;
    if (!Number.isFinite(row.lat) || !Number.isFinite(row.lon)) continue;
    if (!pointInBBox(row.lat, row.lon, NORWAY_BBOX)) continue;
    const sourceUrl = row.sourceUrl;
    const organizer = row.website && !isSocial(row.website) ? row.website : null;
    out.push({
      id: placeId(row.sourceId, row.externalId),
      title: row.title,
      lat: row.lat,
      lon: row.lon,
      sourceId: row.sourceId,
      sourceUrl,
      externalId: row.externalId,
      deepLink: row.deepLink || organizer || sourceUrl,
      status: statusForEventDates(dates, today),
      statusSource: row.sourceId,
      statusNote: `Kalenderdato fra ${row.sourceId}; sjekk kilden før du drar`,
      openedAt: dates[0] || null,
      closedAt: dates[dates.length - 1] || null,
      lastVerifiedAt: new Date().toISOString(),
      sourceIds: [row.sourceId],
      attrs: {
        kind: row.kind || kindFromType(row.type, row.title),
        indoor: row.indoor ?? indoorFromTitle(row.title, row.type),
        kommune: row.kommune || null,
        fylke: null,
        address: row.address || null,
        openingHours: row.hours || null,
        website: organizer,
        phone: null,
        notes: row.notes || null,
        operator: row.operator || null,
        eventWhen: formatEventWhen(dates),
        eventDates: dates,
        nextDate: dates.find((d) => d >= today) || dates[0],
        geoSource: row.geoSource || null,
      },
      lastSyncedAt: new Date().toISOString(),
    });
  }
  return out;
}

export function mergeLiveCalendars(local, bySource = {}, failedSourceIds = []) {
  const failed = new Set(failedSourceIds);
  const localPlaces = Array.isArray(local?.places) ? local.places : [];
  const kept = [];
  const removed = [];
  for (const p of localPlaces) {
    if (!p?.id) continue;
    if (!CALENDAR_SOURCE_IDS.includes(p.sourceId) || failed.has(p.sourceId)) {
      kept.push(p);
      continue;
    }
    removed.push(p.id);
  }
  const incoming = [];
  for (const id of CALENDAR_SOURCE_IDS) {
    if (failed.has(id)) continue;
    incoming.push(...(bySource[id] || []));
  }
  const seen = new Set(kept.map((p) => p.id));
  const added = [];
  const places = [...kept];
  for (const p of incoming) {
    if (!p?.id || seen.has(p.id)) continue;
    seen.add(p.id);
    added.push(p.id);
    places.push(p);
  }
  const now = new Date().toISOString();
  const prevSources = Array.isArray(local?.sources) ? local.sources : [];
  const byId = new Map(prevSources.map((s) => [s.id, s]));
  for (const id of CALENDAR_SOURCE_IDS) {
    const meta = SOURCE_META[id];
    const prev = byId.get(id) || {};
    byId.set(id, {
      ...prev,
      id,
      name: meta.name,
      attribution: meta.attribution,
      lastSyncAt: failed.has(id) ? prev.lastSyncAt || null : now,
    });
  }
  return {
    store: {
      updatedAt: now,
      sources: sanitizeSources([...byId.values()]),
      places,
    },
    diff: { added, removed, updated: [] },
  };
}

/** @param {{ htmlBySource?: Record<string, string>, hooplaByCity?: Record<string, unknown>, localPlaces?: object[], localSources?: object[], failedSourceIds?: string[], today?: string }} [opts] */
export function catalogFromFetched({
  htmlBySource = {},
  hooplaByCity = {},
  localPlaces = [],
  localSources = [],
  failedSourceIds = [],
  today = todayOslo(),
} = {}) {
  const rows = [];
  const failed = [...failedSourceIds];
  for (const src of LIVE_HTML_SOURCES) {
    if (failed.includes(src.id)) continue;
    const html = htmlBySource[src.id];
    if (!String(html || '').trim()) {
      failed.push(src.id);
      continue;
    }
    try {
      rows.push(...src.parse(html));
    } catch {
      failed.push(src.id);
    }
  }
  if (!failed.includes('hoopla')) {
    const cities = Object.entries(hooplaByCity || {});
    if (!cities.length) failed.push('hoopla');
    else {
      for (const [city, body] of cities) {
        try {
          rows.push(...parseHooplaEvents(body, city));
        } catch {
          /* skip one city */
        }
      }
    }
  }
  const geocoded = attachKnownGeo(rows, localPlaces);
  const places = rowsToPlaces(geocoded, today);
  const bySource = {};
  for (const p of places) {
    if (!bySource[p.sourceId]) bySource[p.sourceId] = [];
    bySource[p.sourceId].push(p);
  }
  for (const src of LIVE_HTML_SOURCES) {
    if (failed.includes(src.id)) continue;
    if (!(bySource[src.id] || []).length) failed.push(src.id);
  }
  if (!failed.includes('hoopla') && !(bySource.hoopla || []).length) failed.push('hoopla');
  return mergeLiveCalendars(
    { places: localPlaces, sources: localSources },
    bySource,
    failed,
  );
}

function sha1Hex(message) {
  const bytes =
    typeof TextEncoder === 'function'
      ? Array.from(new TextEncoder().encode(String(message)))
      : utf8Bytes(String(message));
  const words = [];
  for (let i = 0; i < bytes.length; i += 1) {
    words[i >> 2] = (words[i >> 2] || 0) | (bytes[i] << (24 - (i % 4) * 8));
  }
  const bitLen = bytes.length * 8;
  words[bitLen >> 5] |= 0x80 << (24 - (bitLen % 32));
  words[(((bitLen + 64) >> 9) << 4) + 15] = bitLen;
  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const w = new Array(80);
  for (let i = 0; i < words.length; i += 16) {
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let t = 0; t < 80; t += 1) {
      w[t] =
        t < 16 ? words[i + t] | 0 : rotl(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
      const temp = (rotl(a, 5) + ft(t, b, c, d) + e + w[t] + kt(t)) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0;
  }
  return [h0, h1, h2, h3, h4].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
}

function utf8Bytes(s) {
  const out = [];
  for (let i = 0; i < s.length; i += 1) {
    const c = s.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
  }
  return out;
}

function rotl(n, s) {
  return (n << s) | (n >>> (32 - s));
}

function ft(t, b, c, d) {
  if (t < 20) return (b & c) | (~b & d);
  if (t < 40) return b ^ c ^ d;
  if (t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}

function kt(t) {
  if (t < 20) return 0x5a827999;
  if (t < 40) return 0x6ed9eba1;
  if (t < 60) return 0x8f1bbcdc;
  return 0xca62c1d6;
}
