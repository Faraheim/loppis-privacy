import { loadOfflineStore, offlineMap, offlinePlace, offlinePlaceCount, useOfflinePwa } from './offline.js';

const API = (window.LOPPIS_API || localStorage.getItem('loppisApi') || 'http://127.0.0.1:8795').replace(
  /\/$/,
  '',
);

let offline = false;

const KIND_IDS = [
  'flea_market',
  'thrift',
  'antiques',
  'clothes',
  'books',
  'market',
];

const PACKS = {
  nb: {
    settings: 'Innstillinger',
    done: 'Ferdig',
    language: 'Språk',
    appearance: 'Utseende',
    dark: 'Mørk',
    light: 'Lys',
    favorites: 'Favoritter',
    favoritesEmpty: 'Ingen favoritter ennå.',
    removeFav: 'Fjern fra favoritter',
    refresh: 'Oppdater loppemarked',
    locate: 'Min posisjon',
    locating: 'Henter posisjon…',
    search: 'Søk sted, butikk eller kommune',
    flea_market: 'Loppemarked',
    thrift: 'Bruktbutikk',
    antiques: 'Antikk',
    clothes: 'Klær',
    books: 'Bøker',
    market: 'Torg',
    today: 'I dag',
    tomorrow: 'I morgen',
    weekend: 'Helg',
    '7d': '7 dager',
    month: 'Denne måneden',
    dated: 'Med dato',
    custom: 'Fra–til',
    places: 'Steder',
    fav: 'Favoritt',
  },
  en: {
    settings: 'Settings',
    done: 'Done',
    language: 'Language',
    appearance: 'Appearance',
    dark: 'Dark',
    light: 'Light',
    favorites: 'Favorites',
    favoritesEmpty: 'No favorites yet.',
    removeFav: 'Remove from favorites',
    refresh: 'Update flea markets',
    locate: 'My location',
    locating: 'Getting location…',
    search: 'Search place, shop or municipality',
    flea_market: 'Flea market',
    thrift: 'Thrift',
    antiques: 'Antiques',
    clothes: 'Clothes',
    books: 'Books',
    market: 'Market',
    today: 'Today',
    tomorrow: 'Tomorrow',
    weekend: 'Weekend',
    '7d': '7 days',
    month: 'This month',
    dated: 'With date',
    custom: 'From–to',
    places: 'Places',
    fav: 'Favorite',
  },
};

let lang = localStorage.getItem('loppis.lang') === 'en' ? 'en' : 'nb';
function t(key) {
  return (PACKS[lang] || PACKS.nb)[key] || key;
}

const KINDS = [];
function refreshLabelArrays() {
  KINDS.length = 0;
  for (const id of KIND_IDS) KINDS.push([id, t(id)]);
  DATE_PRESETS.length = 0;
  for (const id of DATE_IDS) DATE_PRESETS.push([id, t(id)]);
}

const KIND_COLOR = {
  flea_market: '#e07a3d',
  thrift: '#c9a227',
  antiques: '#b56b4a',
  clothes: '#c47a8a',
  books: '#7a8f6a',
  market: '#8b6f47',
};

const DATE_IDS = ['today', 'tomorrow', 'weekend', '7d', 'month', 'dated', 'custom'];
const DATE_PRESETS = [];
refreshLabelArrays();

const kindsSel = new Set();
let datePreset = null;
let customFrom = '';
let customTo = '';
let map;
let layer;
let selected = null;
let q = '';

function todayOslo(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(now);
}

function addDaysYmd(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function weekdayOslo(now = new Date()) {
  const raw = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Oslo',
    weekday: 'short',
  }).format(now);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[raw.slice(0, 3)] ?? 0;
}

function weekendRange() {
  const today = todayOslo();
  const day = weekdayOslo();
  let toFriday;
  if (day === 0) toFriday = -2;
  else if (day === 6) toFriday = -1;
  else if (day === 5) toFriday = 0;
  else toFriday = 5 - day;
  const fri = addDaysYmd(today, toFriday);
  return { from: fri, to: addDaysYmd(fri, 2) };
}

function lastDayOfMonth(ymd) {
  const [y, m] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function currentDateFilter() {
  const today = todayOslo();
  if (!datePreset) return {};
  if (datePreset === 'today') return { from: today, to: today };
  if (datePreset === 'tomorrow') {
    const t = addDaysYmd(today, 1);
    return { from: t, to: t };
  }
  if (datePreset === 'weekend') return weekendRange();
  if (datePreset === '7d') return { from: today, to: addDaysYmd(today, 6) };
  if (datePreset === 'month') return { from: today, to: lastDayOfMonth(today) };
  if (datePreset === 'dated') return { dated: true };
  if (datePreset === 'custom') {
    let from = customFrom || null;
    let to = customTo || null;
    if (from && to && from > to) [from, to] = [to, from];
    if (from && !to) to = from;
    return { from, to };
  }
  return {};
}

const statusEl = document.getElementById('status');
const listEl = document.getElementById('list');
const listSummary = document.getElementById('listSummary');
const sheetEl = document.getElementById('sheet');

function pinColor(kind) {
  return KIND_COLOR[kind === 'charity' ? 'thrift' : kind] || '#c45c26';
}

function qs(extra = {}) {
  const u = new URLSearchParams({
    bbox: '4.3,57.8,31.5,71.3',
    limit: '2000',
    ...extra,
  });
  if (kindsSel.size) u.set('kinds', [...kindsSel].join(','));
  if (q.trim()) u.set('q', q.trim());
  const df = currentDateFilter();
  if (df.from) u.set('from', df.from);
  if (df.to) u.set('to', df.to);
  if (df.dated) u.set('dated', '1');
  return u.toString();
}

function renderChips() {
  const row = document.getElementById('kindChips');
  row.replaceChildren(
    ...KINDS.map(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `chip${kindsSel.has(id) ? ' on' : ''}`;
      b.textContent = label;
      b.addEventListener('click', () => {
        kindsSel.has(id) ? kindsSel.delete(id) : kindsSel.add(id);
        renderChips();
        load();
      });
      return b;
    }),
  );
}

function renderDateChips() {
  const row = document.getElementById('dateChips');
  const customBox = document.getElementById('dateCustom');
  const hint = document.getElementById('dateHint');
  const df = currentDateFilter();
  const nb = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-');
    return `${Number(d)}.${Number(m)}.${y}`;
  };
  hint.textContent =
    df.from && df.to
      ? `Dato · ${df.from === df.to ? nb(df.from) : `${nb(df.from)} – ${nb(df.to)}`}`
      : df.dated
        ? 'Dato · bare steder med salgsdato'
        : 'Dato';
  hint.hidden = true;
  customBox.hidden = datePreset !== 'custom';
  row.replaceChildren(
    ...DATE_PRESETS.map(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `chip${datePreset === id ? ' on' : ''}`;
      b.textContent = label;
      b.addEventListener('click', () => {
        datePreset = datePreset === id ? null : id;
        renderDateChips();
        load();
      });
      return b;
    }),
  );
}

let ignoreMapClick = false;
function bumpIgnoreMapClick() {
  ignoreMapClick = true;
  window.setTimeout(() => {
    ignoreMapClick = false;
  }, 450);
}

function dismissMapOverlays() {
  closeSheet();
  if (map) map.closePopup();
}

function ensureMap() {
  if (map) return;
  map = L.map('map', { zoomControl: false, attributionControl: false }).setView([59.91, 10.75], 6);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  layer = L.layerGroup().addTo(map);
  map.on('click', () => {
    if (ignoreMapClick) return;
    dismissMapOverlays();
  });
}

function closeSheet() {
  selected = null;
  sheetEl.hidden = true;
}

function renderSheet(place, source, links) {
  const kind = place.attrs?.kind || 'thrift';
  const kindName = KINDS.find(([id]) => id === kind)?.[1] || kind;
  document.getElementById('sheetKind').textContent = kindName;
  document.getElementById('sheetTitle').textContent = place.title;
  const meta = [
    place.attrs?.eventWhen,
    place.attrs?.kommune,
    place.attrs?.address,
    place.status === 'open' ? 'Åpen nå' : place.status === 'planned' ? 'Kommende' : place.status,
  ]
    .filter(Boolean)
    .join(' · ');
  document.getElementById('sheetMeta').textContent = meta;
  document.getElementById('sheetHours').textContent = place.attrs?.eventWhen
    ? `Når: ${place.attrs.eventWhen}${place.attrs?.openingHours ? ` · ${place.attrs.openingHours}` : ''}`
    : place.attrs?.openingHours
      ? `Åpning: ${place.attrs.openingHours}`
      : 'Åpningstider ikke i kilden — sjekk butikken.';
  const box = document.getElementById('sheetLinks');
  box.replaceChildren();
  const add = (href, label) => {
    if (!href) return;
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label;
    box.append(a);
  };
  add(place.attrs?.website || place.deepLink, 'Hjemmeside');
  add(place.sourceUrl, source?.name || 'Kilde');
  add(links?.directions, 'Veibeskrivelse');
  add(links?.streetView, 'Street View');
  document.getElementById('sheetFav').textContent = `${isFav(selected) ? '♥' : '♡'} ${t('fav')}`;
  sheetEl.hidden = false;
}

async function openPlace(id) {
  selected = id;
  if (map) map.closePopup();
  try {
    let data;
    if (offline) {
      data = offlinePlace(id);
      if (!data) throw new Error('place missing');
    } else {
      data = await fetch(`${API}/v1/place/${encodeURIComponent(id)}`).then((r) => {
        if (!r.ok) throw new Error(`place ${r.status}`);
        return r.json();
      });
    }
    renderSheet(data.place, data.source, data.links);
  } catch (err) {
    renderSheet(
      {
        title: 'Kunne ikke hente mer info',
        attrs: { kind: 'thrift', notes: err.message },
        status: 'unknown',
      },
      null,
      {},
    );
  }
}

function renderList(features) {
  const sorted = [...features].sort((a, b) => {
    const da = a.properties.nextDate || '9999-12-31';
    const db = b.properties.nextDate || '9999-12-31';
    if (da !== db) return da.localeCompare(db);
    return String(a.properties.name || '').localeCompare(String(b.properties.name || ''), 'nb');
  });
  const items = sorted.slice(0, 40);
  const upcoming = features.filter((f) => f.properties.nextDate).length;
  listSummary.textContent = items.length
    ? `Steder (${features.length}${upcoming ? ` · ${upcoming} med dato` : ''})`
    : 'Steder';
  if (!items.length) {
    listEl.innerHTML =
      '<div class="empty">Ingen treff i dette filteret. Prøv en annen type, dato eller fjern søket.</div>';
    return;
  }
  listEl.replaceChildren(
    ...items.map((f) => {
      const el = document.createElement('article');
      el.className = 'card';
      el.innerHTML = `<div class="kind"></div><h3></h3><p></p>`;
      el.querySelector('.kind').textContent = f.properties.kindLabel || f.properties.placeKind;
      el.querySelector('h3').textContent = f.properties.name;
      el.querySelector('p').textContent = [
        f.properties.eventWhen,
        f.properties.kommune,
        f.properties.openingHours,
      ]
        .filter(Boolean)
        .join(' · ');
      el.addEventListener('click', () => openPlace(f.properties.id));
      return el;
    }),
  );
}

function mapParams() {
  const df = currentDateFilter();
  return {
    bbox: '4.3,57.8,31.5,71.3',
    limit: 2000,
    kinds: [...kindsSel],
    q: q.trim(),
    dateFrom: df.from || null,
    dateTo: df.to || null,
    datedOnly: Boolean(df.dated),
  };
}

async function load() {
  statusEl.textContent = 'Henter treff…';
  try {
    let mapRes;
    if (offline) {
      mapRes = offlineMap(mapParams());
    } else {
      mapRes = await fetch(`${API}/v1/map?${qs()}`).then((r) => {
        if (!r.ok) throw new Error(`map ${r.status}`);
        return r.json();
      });
    }
    const features = mapRes.features || [];
    statusEl.textContent = offline
      ? `${mapRes.meta?.count ?? 0} treff · ${offlinePlaceCount()} i katalogen`
      : `${mapRes.meta?.count ?? 0} treff · ${API}`;
    renderList(features);
    ensureMap();
    map.invalidateSize();
    layer.clearLayers();
    const bounds = [];
    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      bounds.push([lat, lng]);
      L.circleMarker([lat, lng], {
        radius: 7,
        color: pinColor(f.properties.placeKind),
        weight: 1,
        fillOpacity: 0.85,
      })
        .bindPopup(
          `<strong>${f.properties.name}</strong><br/>${f.properties.kindLabel || ''}<br/><button type="button" data-id="${f.properties.id}">Mer info</button>`,
        )
        .on('click', (ev) => {
          try {
            L.DomEvent.stopPropagation(ev);
          } catch {
            /* ignore */
          }
          bumpIgnoreMapClick();
        })
        .on('popupopen', (ev) => {
          const btn = ev.popup.getElement()?.querySelector('button[data-id]');
          if (!btn) return;
          btn.addEventListener('click', (clickEv) => {
            clickEv.preventDefault();
            clickEv.stopPropagation();
            bumpIgnoreMapClick();
            openPlace(f.properties.id);
          });
        })
        .addTo(layer);
    }
    if (bounds.length) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 12 });
  } catch (err) {
    statusEl.textContent = `API nede (${API})`;
    listEl.innerHTML = `<div class="empty">Klarte ikke å hente data. Start API: <code>cd loppis && npm run api</code> (port 8795).</div>`;
  }
}

function setRefreshUi(running, percent, label) {
  const btn = document.getElementById('refreshBtn');
  const track = document.getElementById('refreshTrack');
  const fill = document.getElementById('refreshFill');
  const pct = document.getElementById('refreshPct');
  btn.disabled = running;
  btn.textContent = running ? `${t('refresh')}…` : t('refresh');
  track.hidden = !running && !label;
  fill.style.width = `${Math.max(0, Math.min(100, percent || 0))}%`;
  pct.textContent = running ? `${Math.round(percent || 0)}%` : label || '';
}

async function refreshList() {
  if (offline) {
    statusEl.textContent = 'Katalog er innebygd. Ny versjon kommer som app-oppdatering.';
    setRefreshUi(false, 0, '');
    return;
  }
  setRefreshUi(true, 1, '');
  statusEl.textContent = 'Oppdaterer loppemarked…';
  try {
    const start = await fetch(`${API}/v1/refresh`, { method: 'POST' }).then((r) => r.json());
    setRefreshUi(true, start.percent || 1, '');
    let last = start;
    for (let i = 0; i < 900; i++) {
      await new Promise((r) => setTimeout(r, 500));
      last = await fetch(`${API}/v1/refresh`).then((r) => r.json());
      setRefreshUi(Boolean(last.running), last.percent || 0, last.stage || '');
      statusEl.textContent = last.stage
        ? `${last.stage} · ${Math.round(last.percent || 0)}%`
        : statusEl.textContent;
      if (!last.running) break;
    }
    if (last.ok) {
      statusEl.textContent = `Liste oppdatert — ${last.places ?? 0} steder`;
      setRefreshUi(false, 100, 'Ferdig');
      await load();
    } else {
      statusEl.textContent = last.error || 'Oppdatering feilet';
      setRefreshUi(false, last.percent || 0, 'Feilet');
    }
  } catch (err) {
    statusEl.textContent = `Oppdatering feilet (${err.message || err})`;
    setRefreshUi(false, 0, 'Feilet');
  }
}

function applyTheme(mode) {
  const next = mode === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('loppis.theme', next);
  document.getElementById('themeDark')?.classList.toggle('on', next === 'dark');
  document.getElementById('themeLight')?.classList.toggle('on', next === 'light');
}

function applyLang(next) {
  lang = next === 'en' ? 'en' : 'nb';
  localStorage.setItem('loppis.lang', lang);
  document.documentElement.lang = lang;
  refreshLabelArrays();
  applyChrome();
  renderChips();
  renderDateChips();
}

function applyChrome() {
  document.getElementById('settingsTitle').textContent = t('settings');
  document.getElementById('settingsClose').textContent = t('done');
  document.getElementById('langLabel').textContent = t('language');
  document.getElementById('themeLabel').textContent = t('appearance');
  document.getElementById('themeDark').textContent = t('dark');
  document.getElementById('themeLight').textContent = t('light');
  document.getElementById('refreshBtn').textContent = t('refresh');
  document.getElementById('favTitle').textContent = t('favorites');
  document.getElementById('favClose').textContent = t('done');
  document.getElementById('favBtn').setAttribute('aria-label', t('favorites'));
  document.getElementById('settingsBtn').setAttribute('aria-label', t('settings'));
  const compass = document.getElementById('compassBtn');
  compass.setAttribute('aria-label', compass.classList.contains('is-locating') ? t('locating') : t('locate'));
  document.getElementById('q').placeholder = t('search');
  document.getElementById('langNb').classList.toggle('on', lang === 'nb');
  document.getElementById('langEn').classList.toggle('on', lang === 'en');
  renderFavHeart();
}

function loadFavs() {
  try {
    const raw = JSON.parse(localStorage.getItem('loppis.favorites') || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveFavs(list) {
  localStorage.setItem('loppis.favorites', JSON.stringify(list));
}

function isFav(id) {
  return loadFavs().some((p) => p.id === id);
}

function renderFavHeart() {
  const favs = loadFavs();
  document.getElementById('favBtn').textContent = favs.length ? '♥' : '♡';
  document.getElementById('favBtn').classList.toggle('on', favs.length > 0);
}

function renderFavList() {
  const box = document.getElementById('favList');
  const favs = loadFavs();
  if (!favs.length) {
    box.innerHTML = `<div class="empty">${t('favoritesEmpty')}</div>`;
    return;
  }
  box.replaceChildren(
    ...favs.map((p) => {
      const el = document.createElement('article');
      el.className = 'card fav-card';
      el.innerHTML = '<div class="fav-main"><h3></h3><p></p></div><button type="button" class="fav-heart" aria-label=""></button>';
      el.querySelector('h3').textContent = p.name;
      el.querySelector('p').textContent = p.kommune || '';
      const heart = el.querySelector('.fav-heart');
      heart.textContent = '♥';
      heart.setAttribute('aria-label', t('removeFav'));
      heart.addEventListener('click', (ev) => {
        ev.stopPropagation();
        saveFavs(loadFavs().filter((x) => x.id !== p.id));
        renderFavHeart();
        renderFavList();
      });
      el.querySelector('.fav-main').addEventListener('click', () => {
        document.getElementById('favPanel').hidden = true;
        if (map && Number.isFinite(p.lat) && Number.isFinite(p.lon)) {
          map.setView([p.lat, p.lon], 13);
        }
        if (p.id) openPlace(p.id);
      });
      return el;
    }),
  );
}

function toggleFavFromSheet() {
  if (!selected) return;
  const title = document.getElementById('sheetTitle').textContent;
  const kommune = document.getElementById('sheetMeta').textContent;
  const prev = loadFavs();
  const next = isFav(selected)
    ? prev.filter((p) => p.id !== selected)
    : [...prev, { id: selected, name: title, kommune, lat: null, lon: null }];
  saveFavs(next);
  renderFavHeart();
  document.getElementById('sheetFav').textContent = `${isFav(selected) ? '♥' : '♡'} ${t('fav')}`;
}

let userMarker = null;
let userRipple = null;
let locating = false;

function setCompassLocating(on) {
  locating = on;
  const btn = document.getElementById('compassBtn');
  btn.classList.toggle('is-locating', on);
  btn.setAttribute('aria-busy', on ? 'true' : 'false');
  btn.setAttribute('aria-label', t(on ? 'locating' : 'locate'));
}

function locateMe() {
  if (!navigator.geolocation || locating) return;
  setCompassLocating(true);
  const started = Date.now();
  const finish = () => {
    const wait = Math.max(0, 500 - (Date.now() - started));
    window.setTimeout(() => setCompassLocating(false), wait);
  };
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      ensureMap();
      if (userMarker) userMarker.remove();
      if (userRipple) userRipple.remove();
      userMarker = L.circleMarker([lat, lon], {
        radius: 8,
        color: '#1d4ed8',
        fillOpacity: 0.9,
      }).addTo(map);
      userRipple = L.marker([lat, lon], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({
          className: 'user-fix-ripple',
          iconSize: [72, 72],
          iconAnchor: [36, 36],
        }),
      }).addTo(map);
      window.setTimeout(() => {
        if (userRipple) {
          userRipple.remove();
          userRipple = null;
        }
      }, 1400);
      map.setView([lat, lon], 12);
      finish();
    },
    () => {
      finish();
    },
    { enableHighAccuracy: true, timeout: 12000 },
  );
  const ori = window.DeviceOrientationEvent;
  if (ori && typeof ori.requestPermission === 'function') {
    void ori.requestPermission().catch(() => {});
  }
}

function showIosHint() {
  const el = document.getElementById('iosHint');
  if (!el) return;
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!ios || standalone || localStorage.getItem('loppis.iosHint') === '1') return;
  el.hidden = false;
  document.getElementById('iosHintClose')?.addEventListener('click', () => {
    localStorage.setItem('loppis.iosHint', '1');
    el.hidden = true;
  });
}

async function boot() {
  applyTheme(localStorage.getItem('loppis.theme') || 'light');
  applyChrome();
  offline = useOfflinePwa();
  if (offline) {
    try {
      await loadOfflineStore();
      document.getElementById('refreshBtn').hidden = true;
    } catch (err) {
      statusEl.textContent = `Klarte ikke å laste katalogen (${err.message || err})`;
      return;
    }
  }
  showIosHint();
  renderChips();
  renderDateChips();
  const fromEl = document.getElementById('dateFrom');
  const toEl = document.getElementById('dateTo');
  fromEl.addEventListener('change', () => {
    customFrom = fromEl.value;
    renderDateChips();
    load();
  });
  toEl.addEventListener('change', () => {
    customTo = toEl.value;
    renderDateChips();
    load();
  });
  const input = document.getElementById('q');
  let t = null;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      q = input.value;
      load();
    }, 280);
  });
  document.getElementById('sheetClose').addEventListener('click', closeSheet);
  document.getElementById('sheetFav').addEventListener('click', toggleFavFromSheet);
  document.getElementById('refreshBtn').addEventListener('click', () => void refreshList());
  document.getElementById('settingsBtn').addEventListener('click', () => {
    document.getElementById('favPanel').hidden = true;
    const p = document.getElementById('settingsPanel');
    p.hidden = !p.hidden;
  });
  document.getElementById('settingsClose').addEventListener('click', () => {
    document.getElementById('settingsPanel').hidden = true;
  });
  document.getElementById('favBtn').addEventListener('click', () => {
    document.getElementById('settingsPanel').hidden = true;
    const p = document.getElementById('favPanel');
    p.hidden = !p.hidden;
    if (!p.hidden) renderFavList();
  });
  document.getElementById('favClose').addEventListener('click', () => {
    document.getElementById('favPanel').hidden = true;
  });
  document.getElementById('langNb').addEventListener('click', () => applyLang('nb'));
  document.getElementById('langEn').addEventListener('click', () => applyLang('en'));
  document.getElementById('themeDark').addEventListener('click', () => applyTheme('dark'));
  document.getElementById('themeLight').addEventListener('click', () => applyTheme('light'));
  document.getElementById('compassBtn').addEventListener('click', locateMe);
  window.addEventListener('deviceorientation', (ev) => {
    const heading =
      ev.webkitCompassHeading != null
        ? ev.webkitCompassHeading
        : ev.alpha != null
          ? 360 - ev.alpha
          : null;
    if (heading == null) return;
    const dial = document.getElementById('compassDial');
    if (dial) dial.style.transform = `rotate(${-heading}deg)`;
  });
  void load();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js?v=4');
}

void boot();
