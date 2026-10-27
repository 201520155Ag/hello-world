/**
 * Persistence: versioned serialize/deserialize (§4.1), localStorage slots and
 * settings (§4.3), share codes and URL hash helpers (§4.2).
 *
 * `serialize`, `deserialize`, `encodeShare` and `decodeShare` are pure and run in
 * Node; only the functions documented as doing so touch `localStorage`,
 * `location` or `history`. Every storage access is wrapped in try/catch.
 */
import {
  SAVE_VERSION, MAP_W, MAP_H, BUILDINGS, SKINS, DEFAULT_SKIN, ERR, BALANCE, TERRAIN, ZONE,
  createCityShell, footprint, idx,
} from './data.js';

/** localStorage keys for the two city slots and the settings record. */
export const KEYS = Object.freeze({ AUTOSAVE: 'maincity.autosave', MANUAL: 'maincity.save', SETTINGS: 'maincity.settings' });

const SHARE_PREFIX = /^MC(\d+)\.([A-Za-z0-9_-]*)$/;
const MAX_NAME = 40;
const DEFAULT_NAME = 'Main City';

/** Zone letter per level: index 0 = empty lot, 1..3 = developed. */
const ZONE_CHARS = Object.freeze({ r: 'rRST', c: 'cCDE', i: 'iIJK' });
const CH_WATER = '~', CH_GRASS = '.', CH_TREE = 't', CH_ROAD = '#', CH_SERVICE = '@';

/** Every legal tile character → how to rebuild the tile from it. */
const CHAR_INFO = (() => {
  const info = {
    [CH_WATER]: { terrain: TERRAIN.WATER }, [CH_GRASS]: { terrain: TERRAIN.GRASS }, [CH_TREE]: { terrain: TERRAIN.TREE },
    [CH_ROAD]: { road: true }, [CH_SERVICE]: { service: true },
  };
  for (const zone of Object.keys(ZONE_CHARS)) {
    for (let level = 0; level < ZONE_CHARS[zone].length; level++) info[ZONE_CHARS[zone][level]] = { zone, level };
  }
  return Object.freeze(info);
})();

/**
 * Migration chain: `MIGRATIONS[v]` upgrades a save of version `v` to `v + 1`.
 * Empty today; `deserialize` walks it until `save.v === SAVE_VERSION`.
 * @type {Record<number, (save: object) => object>}
 */
const MIGRATIONS = Object.freeze({});

const fail = (error) => ({ ok: false, error });
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

/* ------------------------------------------------------------------ tile string */

function tileChar(t) {
  if (t.building) return CH_SERVICE;
  if (t.road) return CH_ROAD;
  if (t.zone !== ZONE.NONE) return ZONE_CHARS[t.zone]?.[t.level] ?? CH_GRASS;
  if (t.terrain === TERRAIN.WATER) return CH_WATER;
  return t.terrain === TERRAIN.TREE ? CH_TREE : CH_GRASS;
}

/** Row-major RLE: a decimal run length precedes a char only for runs ≥ 2. */
function encodeTiles(tiles) {
  let out = '', prev = '', run = 0;
  const flush = () => { if (run > 0) out += (run > 1 ? run : '') + prev; };
  for (const t of tiles) {
    const ch = tileChar(t);
    if (ch === prev) { run++; continue; }
    flush();
    prev = ch;
    run = 1;
  }
  flush();
  return out;
}

/** Expands an RLE tile string to exactly `n` known chars, or returns null. */
function decodeTiles(str, n) {
  const out = [];
  let count = 0;
  for (let k = 0; k < str.length; k++) {
    const code = str.charCodeAt(k);
    if (code >= 48 && code <= 57) {
      count = count * 10 + (code - 48);
      if (count > n) return null;
      continue;
    }
    const ch = str[k];
    if (!CHAR_INFO[ch]) return null;
    const reps = count || 1;
    if (out.length + reps > n) return null;
    for (let r = 0; r < reps; r++) out.push(ch);
    count = 0;
  }
  return out.length === n && count === 0 ? out : null;
}

/* ------------------------------------------------------------------ serialize */

/**
 * Builds the SaveV1 record (§4.1) from a city. Pure; derived fields are never written.
 * `savedAt` is added by `saveLocal`, not here.
 * @param {import('./data.js').City} city
 * @returns {object} SaveV1 without `savedAt`
 */
export function serialize(city) {
  const c = city.clock;
  return {
    v: SAVE_VERSION, name: city.name, seed: city.seed >>> 0, rng: city.rngState >>> 0, w: city.w, h: city.h,
    tiles: encodeTiles(city.tiles),
    buildings: city.buildings.map((b) => [b.id, b.x, b.y]),
    cash: city.cash, tax: city.taxRate,
    clock: [c.day, c.month, c.year, c.speed, c.lastSpeed],
    skin: city.skin, debtMonths: city.debtMonths, cut: Boolean(city.servicesCut), pop: city.stats.pop,
    history: city.history.map((h) => [h.month, h.year, h.pop, h.cash, h.income, h.expenses]),
  };
}

/**
 * Validates a SaveV1-shaped object (running migrations for older versions) and
 * rebuilds a City with zeroed derived fields; `main` calls `sim.recomputeDerived`.
 * @param {unknown} obj parsed JSON
 * @returns {{ok:true, city:object}|{ok:false, error:string}}
 */
export function deserialize(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !Number.isInteger(obj.v)) return fail(ERR.SAVE);
  if (obj.v > SAVE_VERSION) return fail(ERR.VERSION);
  let save = obj;
  while (save.v < SAVE_VERSION) {
    const migrate = MIGRATIONS[save.v];
    if (!migrate) return fail(ERR.SAVE);
    save = migrate(save);
  }

  if (save.w !== MAP_W || save.h !== MAP_H || typeof save.tiles !== 'string') return fail(ERR.SAVE);
  if (!isNum(save.seed) || !isNum(save.rng) || !isNum(save.cash) || !isInt(save.tax, BALANCE.TAX_MIN, BALANCE.TAX_MAX)) return fail(ERR.SAVE);
  const clock = Array.isArray(save.clock) ? save.clock : [];
  const [day, month, year, speed, lastSpeed] = clock;
  if (!isInt(day, 1, BALANCE.DAYS_PER_MONTH) || !isInt(month, 1, 12) || !isInt(year, 1, Number.MAX_SAFE_INTEGER)
    || !isInt(speed, 0, 3) || !isInt(lastSpeed, 1, 3)) return fail(ERR.SAVE);
  if (save.debtMonths !== undefined && !isInt(save.debtMonths, 0, Number.MAX_SAFE_INTEGER)) return fail(ERR.SAVE);

  const n = MAP_W * MAP_H;
  const chars = decodeTiles(save.tiles, n);
  if (!chars) return fail(ERR.SAVE);

  const history = [];
  if (save.history !== undefined) {
    if (!Array.isArray(save.history)) return fail(ERR.SAVE);
    for (const h of save.history) {
      if (!Array.isArray(h) || h.length < 6 || !h.slice(0, 6).every(isNum)) return fail(ERR.SAVE);
      history.push({ month: h[0], year: h[1], pop: h[2], cash: h[3], income: h[4], expenses: h[5] });
    }
  }

  const name = typeof save.name === 'string' && save.name.trim() && save.name.length <= MAX_NAME ? save.name : DEFAULT_NAME;
  const city = createCityShell({ name, seed: save.seed, skin: SKINS[save.skin] ? save.skin : DEFAULT_SKIN });
  const tiles = city.tiles;
  for (let i = 0; i < n; i++) {
    const info = CHAR_INFO[chars[i]];
    if (info.terrain) tiles[i].terrain = info.terrain;
    else if (info.road) tiles[i].road = true;
    else if (info.zone) { tiles[i].zone = info.zone; tiles[i].level = info.level; }
  }

  const buildings = save.buildings === undefined ? [] : save.buildings;
  if (!Array.isArray(buildings)) return fail(ERR.SAVE);
  for (const b of buildings) {
    if (!Array.isArray(b) || !BUILDINGS[b[0]] || !Number.isInteger(b[1]) || !Number.isInteger(b[2])) return fail(ERR.SAVE);
    const [id, x, y] = b;
    const def = BUILDINGS[id];
    const fp = footprint(x, y, def.w, def.h);
    if (!fp) return fail(ERR.SAVE);
    for (const i of fp) {
      if (chars[i] !== CH_SERVICE || tiles[i].building) return fail(ERR.SAVE);
      tiles[i].building = id;
      tiles[i].anchor = idx(x, y);
    }
    city.buildings.push({ id, x, y });
  }
  for (let i = 0; i < n; i++) if (chars[i] === CH_SERVICE && !tiles[i].building) return fail(ERR.SAVE);

  city.rngState = save.rng >>> 0;
  city.cash = save.cash;
  city.taxRate = save.tax;
  city.clock = { day, month, year, speed, lastSpeed, accMs: 0 };
  city.debtMonths = save.debtMonths ?? 0;
  city.servicesCut = Boolean(save.cut);
  city.history = history.slice(-BALANCE.HISTORY_CAP);
  // Not stored, and not rebuilt by recomputeDerived: the debt alert follows cash so the
  // "in debt" toast does not repeat after a load; last month's figures come from history.
  city.alerts.debt = city.cash < 0;
  const lastMonth = city.history[city.history.length - 1];
  if (lastMonth) {
    city.stats.income = lastMonth.income;
    city.stats.expenses = lastMonth.expenses;
  }
  return { ok: true, city };
}

/* ------------------------------------------------------------------ localStorage */

/** Returns the storage object or throws (caller catches); keeps every access in one place. */
function storage() {
  const s = globalThis.localStorage;
  if (!s) throw new Error('no storage');
  return s;
}

function readJson(key) {
  try {
    const raw = storage().getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Writes `serialize(city)` plus `savedAt` under `key`. Touches localStorage.
 * @returns {boolean} false on any exception (quota, disabled storage, bad city)
 */
export function saveLocal(key, city) {
  try {
    const data = serialize(city);
    data.savedAt = Date.now();
    storage().setItem(key, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/**
 * Loads and deserializes the city under `key`. Touches localStorage.
 * @returns {{ok:true, city:object}|{ok:false, error:string}} missing/damaged → ERR.SAVE
 */
export function loadLocal(key) {
  const data = readJson(key);
  return data === null ? fail(ERR.SAVE) : deserialize(data);
}

/** @returns {boolean} whether a record exists under `key`. Touches localStorage. */
export function hasLocal(key) {
  try {
    return storage().getItem(key) !== null;
  } catch {
    return false;
  }
}

/**
 * Cheap landing-screen summary of a stored save (no city rebuild). Touches localStorage.
 * @returns {{name:string, pop:number, month:number, year:number, savedAt:number}|null}
 */
export function metaOf(key) {
  const data = readJson(key);
  if (!data || typeof data !== 'object') return null;
  const clock = Array.isArray(data.clock) ? data.clock : [];
  return {
    name: typeof data.name === 'string' && data.name.trim() ? data.name.slice(0, MAX_NAME) : DEFAULT_NAME,
    pop: isNum(data.pop) ? data.pop : 0,
    month: isInt(clock[1], 1, 12) ? clock[1] : 1,
    year: isInt(clock[2], 1, Number.MAX_SAFE_INTEGER) ? clock[2] : 1,
    savedAt: isNum(data.savedAt) ? data.savedAt : 0,
  };
}

/** @returns {string|null} the slot key with the most recent `savedAt`, or null when neither exists. */
export function newestLocalKey() {
  const auto = metaOf(KEYS.AUTOSAVE);
  const manual = metaOf(KEYS.MANUAL);
  if (!auto && !manual) return null;
  if (!auto) return KEYS.MANUAL;
  if (!manual) return KEYS.AUTOSAVE;
  return manual.savedAt > auto.savedAt ? KEYS.MANUAL : KEYS.AUTOSAVE;
}

function sanitizeSettings(obj) {
  const out = {};
  if (obj && typeof obj === 'object') {
    if (typeof obj.lang === 'string' || obj.lang === null) out.lang = obj.lang;
    if (SKINS[obj.skin]) out.skin = obj.skin;
  }
  return out;
}

/** @returns {{lang:string|null, skin:string}} stored settings over defaults; never throws. */
export function loadSettings() {
  return { lang: null, skin: DEFAULT_SKIN, ...sanitizeSettings(readJson(KEYS.SETTINGS)) };
}

/**
 * Merges `partial` into the stored settings. Touches localStorage.
 * @returns {boolean} false when storage is unavailable
 */
export function saveSettings(partial) {
  try {
    storage().setItem(KEYS.SETTINGS, JSON.stringify({ ...loadSettings(), ...sanitizeSettings(partial) }));
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ share code */

function toBase64Url(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** @returns {string|null} decoded UTF-8 text, or null for malformed input. */
function fromBase64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  try {
    const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Compact share code: `'MC1.' + base64url(utf8(JSON))` of the save without
 * `history`/`savedAt` (§4.2). Pure.
 * @returns {string}
 */
export function encodeShare(city) {
  const compact = serialize(city);
  delete compact.history;
  return `MC${SAVE_VERSION}.${toBase64Url(JSON.stringify(compact))}`;
}

/**
 * Decodes a share code. Accepts a bare code, one with surrounding or embedded
 * whitespace (chat line wraps), or a full URL containing `#c=`. Pure.
 * @returns {{ok:true, city:object}|{ok:false, error:string}}
 */
export function decodeShare(text) {
  if (typeof text !== 'string') return fail(ERR.SAVE);
  let code = text.replace(/\s+/g, '');
  const hashAt = code.indexOf('#');
  if (hashAt !== -1) code = codeFromHash(code.slice(hashAt)) ?? '';
  const m = SHARE_PREFIX.exec(code);
  if (!m) return fail(ERR.SAVE);
  if (Number(m[1]) > SAVE_VERSION) return fail(ERR.VERSION);
  const json = fromBase64Url(m[2]);
  if (json === null) return fail(ERR.SAVE);
  let obj;
  try {
    obj = JSON.parse(json);
  } catch {
    return fail(ERR.SAVE);
  }
  return deserialize(obj);
}

/**
 * Builds the shareable link for `code` on the current page. Reads `location`.
 * @param {string} code from `encodeShare`
 * @param {string} lang language id placed in `?lang=`; omitted when empty
 * @returns {string}
 */
export function shareUrl(code, lang) {
  const query = lang ? `?lang=${encodeURIComponent(lang)}` : '';
  return `${location.origin}${location.pathname}${query}#c=${code}`;
}

/**
 * Extracts the `c` parameter from a URL hash such as `#c=MC1.…` or `#x=1&c=MC1.…`. Pure.
 * @param {string} hash with or without the leading `#`
 * @returns {string|null}
 */
export function codeFromHash(hash) {
  if (typeof hash !== 'string') return null;
  const body = hash.startsWith('#') ? hash.slice(1) : hash;
  for (const part of body.split('&')) {
    if (!part.startsWith('c=')) continue;
    const raw = part.slice(2);
    try {
      return decodeURIComponent(raw) || null;
    } catch {
      return raw || null;
    }
  }
  return null;
}

/** Removes the hash from the address bar without reloading. Touches `history`/`location`. */
export function clearHash() {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    /* history API unavailable (e.g. sandboxed frame): the hash is harmless */
  }
}
