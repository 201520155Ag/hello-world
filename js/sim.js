/**
 * Main City — simulation: RNG, terrain, player actions, derived grids, demand, growth, budget, clock.
 * Pure logic over the City object from data.js; deterministic, DOM-free, Node-safe.
 */
import {
  MAP_W, MAP_H, TERRAIN, ZONE, BUILDINGS, ZONE_LEVELS, BALANCE, LV_W, APPROVAL_W, DEMAND_W,
  TOOL, TOOL_ZONE, BLOCK, COVER, ERR, SPEED_MS,
  idx, inBounds, xyOf, toolKind, createCityShell, footprint,
} from './data.js';

const N = MAP_W * MAP_H;
// Scratch buffers reused by recomputeDerived (single-threaded; never escape this module).
const rangeScratch = new Uint8Array(N);
const pollutionScratch = new Float32Array(N);
const nearWaterScratch = new Uint8Array(N);
// Reused rectangle holder for clampRect (avoids per-call allocation).
const rect = { x0: 0, y0: 0, x1: 0, y1: 0 };

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------------------
// RNG and hashing

/** mulberry32 PRNG. `state()`/`set()` expose the 32-bit state so saves resume the same stream. */
export function createRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    /** Integer in [0, n); 0 when n ≤ 0. */
    int: (n) => (n > 0 ? Math.floor(next() * n) : 0),
    state: () => s >>> 0,
    set: (v) => { s = v >>> 0; },
  };
}

/** FNV-1a hash of a string → uint32 (lets a city name act as a seed). */
export function hashString(s) {
  let h = 0x811c9dc5;
  const str = String(s ?? '');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// Terrain generation

/** Clamps the rectangle (x0..x1, y0..y1) to the map into the shared `rect`. */
function clampRect(x0, y0, x1, y1) {
  rect.x0 = Math.max(0, x0); rect.y0 = Math.max(0, y0);
  rect.x1 = Math.min(MAP_W - 1, x1); rect.y1 = Math.min(MAP_H - 1, y1);
  return rect;
}

/** The central always-grass square (§1.1): CLEAR_RADIUS tiles each side of the map centre. */
function inClearZone(x, y) {
  const cx = MAP_W >> 1, cy = MAP_H >> 1, r = BALANCE.CLEAR_RADIUS;
  return x >= cx - r && x < cx + r && y >= cy - r && y < cy + r;
}

/** Grows a blob of `terrain` from `start` over grass tiles outside the clear zone; returns tiles placed. */
function growBlob(tiles, rng, start, target, terrain) {
  const frontier = [start];
  let placed = 0;
  while (placed < target && frontier.length) {
    const k = rng.int(frontier.length);
    const i = frontier[k];
    frontier[k] = frontier[frontier.length - 1];
    frontier.pop();
    const { x, y } = xyOf(i);
    if (tiles[i].terrain !== TERRAIN.GRASS || inClearZone(x, y)) continue;
    tiles[i].terrain = terrain;
    placed++;
    if (x > 0) frontier.push(i - 1);
    if (x < MAP_W - 1) frontier.push(i + 1);
    if (y > 0) frontier.push(i - MAP_W);
    if (y < MAP_H - 1) frontier.push(i + MAP_W);
  }
  return placed;
}

/** Random grass tile outside the clear zone, or -1 after a bounded number of tries. */
function pickBlobStart(tiles, rng) {
  for (let tries = 0; tries < 64; tries++) {
    const i = rng.int(N);
    const { x, y } = xyOf(i);
    if (tiles[i].terrain === TERRAIN.GRASS && !inClearZone(x, y)) return i;
  }
  return -1;
}

function generateTerrain(city, rng) {
  const tiles = city.tiles;
  const waterTotal = Math.round(N * (BALANCE.WATER_MIN + rng.next() * (BALANCE.WATER_MAX - BALANCE.WATER_MIN)));
  const blobs = BALANCE.WATER_BLOBS_MIN + rng.int(BALANCE.WATER_BLOBS_MAX - BALANCE.WATER_BLOBS_MIN + 1);
  let left = waterTotal;
  for (let b = 0; b < blobs && left > 0; b++) {
    const size = b === blobs - 1 ? left : Math.round(waterTotal / blobs);
    const start = pickBlobStart(tiles, rng);
    if (start < 0) break;
    left -= growBlob(tiles, rng, start, size, TERRAIN.WATER);
  }
  let trees = Math.round(N * BALANCE.TREE_SHARE);
  for (let guard = 0; trees > 0 && guard < 200; guard++) {
    const size = BALANCE.TREE_CLUSTER_MIN + rng.int(BALANCE.TREE_CLUSTER_MAX - BALANCE.TREE_CLUSTER_MIN + 1);
    const start = pickBlobStart(tiles, rng);
    if (start < 0) break;
    trees -= growBlob(tiles, rng, start, Math.min(size, trees), TERRAIN.TREE);
  }
}

/** A new city: shell + seeded terrain + derived data. `rngState` is advanced past terrain generation. */
export function createCity({ name, seed, skin } = {}) {
  const city = createCityShell({ name, seed, skin });
  const rng = createRng(city.seed);
  generateTerrain(city, rng);
  city.rngState = rng.state();
  recomputeDerived(city);
  return city;
}

// ---------------------------------------------------------------------------
// Tool geometry and validation

/**
 * Tiles a tool touches for a gesture from (x0,y0) to (x1,y1):
 * 'line' → L-path (horizontal then vertical), 'rect' → inclusive rectangle, 'pan' → one tile,
 * 'single' → footprint anchored at (x1,y1), shifted inward so a multi-tile building still fits at the map edge.
 */
export function toolTiles(city, tool, x0, y0, x1, y1) {
  const kind = toolKind(tool);
  if (kind === 'single') {
    const def = BUILDINGS[tool];
    if (!def || !inBounds(x1, y1)) return [];
    return footprint(Math.min(x1, MAP_W - def.w), Math.min(y1, MAP_H - def.h), def.w, def.h);
  }
  if (kind === 'pan') return inBounds(x1, y1) ? [idx(x1, y1)] : [];
  if (![x0, y0, x1, y1].every(Number.isFinite)) return [];
  const ax = clamp(Math.round(x0), 0, MAP_W - 1), ay = clamp(Math.round(y0), 0, MAP_H - 1);
  const bx = clamp(Math.round(x1), 0, MAP_W - 1), by = clamp(Math.round(y1), 0, MAP_H - 1);
  const out = [];
  if (kind === 'line') {
    const sx = bx >= ax ? 1 : -1, sy = by >= ay ? 1 : -1;
    for (let x = ax; x !== bx + sx; x += sx) out.push(idx(x, ay));
    for (let y = ay + sy; y !== by + sy; y += sy) out.push(idx(bx, y));
  } else {
    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++) {
      for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++) out.push(idx(x, y));
    }
  }
  return out;
}

const treeSurcharge = (t) => (t.terrain === TERRAIN.TREE ? BALANCE.TREE_CLEAR : 0);

/** Per-tile check: { cost } for a valid change, { cost:0 } for a harmless skip, { error } when invalid. */
function checkRoad(t) {
  if (t.terrain === TERRAIN.WATER) return { cost: 0, error: ERR.WATER };
  if (t.road) return { cost: 0, error: null };
  if (t.building || t.level > 0) return { cost: 0, error: ERR.OCCUPIED };
  return { cost: BALANCE.ROAD_COST + treeSurcharge(t), error: null };
}

function checkZone(t, zone) {
  if (t.terrain === TERRAIN.WATER) return { cost: 0, error: ERR.WATER };
  if (t.zone === zone) return { cost: 0, error: null };
  if (t.road || t.building || t.level > 0) return { cost: 0, error: ERR.OCCUPIED };
  return { cost: BALANCE.ZONE_COST + treeSurcharge(t), error: null };
}

function checkBuildingTile(t) {
  if (t.terrain === TERRAIN.WATER) return ERR.WATER;
  if (t.road || t.building || t.level > 0) return ERR.OCCUPIED;
  return null;
}

const hasSomething = (t) => t.road || t.building !== null || t.zone !== ZONE.NONE || t.terrain === TERRAIN.TREE;

/** Set of tiles a bulldoze over `tiles` clears (whole footprints for buildings). Only tiles with something count. */
function bulldozeSet(city, tiles) {
  const set = new Set();
  for (const i of tiles) {
    const t = city.tiles[i];
    if (!t || !hasSomething(t)) continue;
    if (t.building) {
      const b = buildingAt(city, i);
      const fp = b && footprint(b.x, b.y, BUILDINGS[b.id].w, BUILDINGS[b.id].h);
      for (const j of fp || [i]) set.add(j);
    } else set.add(i);
  }
  return set;
}

/** Preview of applying `tool` to `tiles`: per-tile validity, total cost, ERR.MONEY when it would breach the build floor. */
export function preview(city, tool, tiles) {
  const list = Array.isArray(tiles) ? tiles.filter((i) => city.tiles[i]) : [];
  const ok = new Array(list.length).fill(true);
  let cost = 0;
  let checkMoney = true;
  const kind = toolKind(tool);
  if (tool === TOOL.ROAD || TOOL_ZONE[tool]) {
    list.forEach((i, k) => {
      const r = tool === TOOL.ROAD ? checkRoad(city.tiles[i]) : checkZone(city.tiles[i], TOOL_ZONE[tool]);
      ok[k] = r.error === null;
      cost += r.cost;
    });
  } else if (tool === TOOL.BULLDOZE) {
    cost = bulldozeSet(city, list).size * BALANCE.BULLDOZE_COST;
    checkMoney = false;
  } else if (kind === 'single') {
    const def = BUILDINGS[tool];
    let valid = def && list.length === def.w * def.h;
    list.forEach((i, k) => {
      ok[k] = checkBuildingTile(city.tiles[i]) === null;
      if (!ok[k]) valid = false;
      cost += treeSurcharge(city.tiles[i]);
    });
    cost = valid ? def.cost + cost : 0;
  } else checkMoney = false;
  const error = checkMoney && cost > 0 && city.cash - cost < BALANCE.BUILD_FLOOR ? ERR.MONEY : null;
  return { tiles: list, ok, cost, error };
}

// ---------------------------------------------------------------------------
// Actions

const fail = (error) => ({ ok: false, error, cost: 0, changed: [] });

/** Pushes `i` and its 4 neighbours onto dirty so road masks around a changed road repaint. */
function dirtyWithNeighbours(city, i) {
  const { x, y } = xyOf(i);
  markDirty(city, i);
  if (x > 0) markDirty(city, i - 1);
  if (x < MAP_W - 1) markDirty(city, i + 1);
  if (y > 0) markDirty(city, i - MAP_W);
  if (y < MAP_H - 1) markDirty(city, i + MAP_W);
}

/** Shared tail of every successful action: charge, dirty, clear fromLink, recompute. */
function commit(city, cost, changed, roadsChanged) {
  city.cash -= cost;
  for (const i of changed) (roadsChanged ? dirtyWithNeighbours : markDirty)(city, i);
  city.fromLink = false;
  recomputeDerived(city);
  return { ok: true, cost, changed };
}

/** Validates a per-tile action; returns { valid, cost } or a failure result. */
function collectValid(city, tiles, check) {
  const valid = [];
  let cost = 0;
  let firstError = null;
  for (const i of Array.isArray(tiles) ? tiles : []) {
    const t = city.tiles[i];
    if (!t) continue;
    const r = check(t);
    if (r.error) { firstError = firstError ?? r.error; continue; }
    if (r.cost > 0) { valid.push(i); cost += r.cost; }
  }
  if (!valid.length) return fail(firstError ?? ERR.NOTHING);
  if (city.cash - cost < BALANCE.BUILD_FLOOR) return fail(ERR.MONEY);
  return { valid, cost };
}

/** Dispatches a tool to its action; pan/inspect do nothing. */
export function applyTool(city, tool, tiles) {
  if (tool === TOOL.ROAD) return placeRoad(city, tiles);
  if (TOOL_ZONE[tool]) return zoneTiles(city, TOOL_ZONE[tool], tiles);
  if (tool === TOOL.BULLDOZE) return bulldoze(city, tiles);
  if (toolKind(tool) === 'single' && BUILDINGS[tool]) {
    if (!Array.isArray(tiles) || !tiles.length) return fail(ERR.BOUNDS);
    const { x, y } = xyOf(tiles[0]);
    return placeBuilding(city, tool, x, y);
  }
  return fail(ERR.NOTHING);
}

/** Lays roads on every valid tile (trees cleared, empty lots dezoned). */
export function placeRoad(city, tiles) {
  const r = collectValid(city, tiles, checkRoad);
  if (!r.valid) return r;
  for (const i of r.valid) {
    const t = city.tiles[i];
    t.road = true; t.zone = ZONE.NONE; t.level = 0; t.starve = 0; t.terrain = TERRAIN.GRASS;
  }
  return commit(city, r.cost, r.valid, true);
}

/** Zones every valid tile as `zone` ('r' | 'c' | 'i'). */
export function zoneTiles(city, zone, tiles) {
  if (!ZONE_LEVELS[zone]) return fail(ERR.NOTHING);
  const r = collectValid(city, tiles, (t) => checkZone(t, zone));
  if (!r.valid) return r;
  for (const i of r.valid) {
    const t = city.tiles[i];
    t.zone = zone; t.level = 0; t.starve = 0; t.terrain = TERRAIN.GRASS;
  }
  return commit(city, r.cost, r.valid, false);
}

/** Places service building `id` with its top-left at (x, y); all-or-nothing. */
export function placeBuilding(city, id, x, y) {
  const def = BUILDINGS[id];
  if (!def) return fail(ERR.NOTHING);
  const fp = footprint(x, y, def.w, def.h);
  if (!fp) return fail(ERR.BOUNDS);
  let cost = def.cost;
  for (const i of fp) {
    const err = checkBuildingTile(city.tiles[i]);
    if (err) return fail(err);
    cost += treeSurcharge(city.tiles[i]);
  }
  if (city.cash - cost < BALANCE.BUILD_FLOOR) return fail(ERR.MONEY);
  const anchor = idx(x, y);
  for (const i of fp) {
    const t = city.tiles[i];
    t.building = id; t.anchor = anchor; t.zone = ZONE.NONE; t.level = 0; t.starve = 0; t.terrain = TERRAIN.GRASS;
  }
  city.buildings.push({ id, x, y });
  return commit(city, cost, fp, false);
}

/** Clears roads, lots, trees and whole service footprints; always allowed (may push cash below the floor). */
export function bulldoze(city, tiles) {
  const set = bulldozeSet(city, Array.isArray(tiles) ? tiles : []);
  if (!set.size) return fail(ERR.NOTHING);
  const changed = [...set];
  const removedAnchors = new Set();
  for (const i of changed) {
    const t = city.tiles[i];
    if (t.building) removedAnchors.add(t.anchor);
    t.road = false; t.zone = ZONE.NONE; t.level = 0; t.starve = 0;
    t.building = null; t.anchor = -1; t.terrain = TERRAIN.GRASS;
  }
  if (removedAnchors.size) city.buildings = city.buildings.filter((b) => !removedAnchors.has(idx(b.x, b.y)));
  return commit(city, changed.length * BALANCE.BULLDOZE_COST, changed, true);
}

/** Sets the tax rate (integer, clamped to TAX_MIN..TAX_MAX; non-numbers are ignored) and recomputes. */
export function setTaxRate(city, rate) {
  if (Number.isFinite(rate)) city.taxRate = clamp(Math.round(rate), BALANCE.TAX_MIN, BALANCE.TAX_MAX);
  recomputeDerived(city);
}

/** Sets speed 0..3; a positive speed is remembered as lastSpeed for togglePause. */
export function setSpeed(city, speed) {
  const s = Number.isInteger(speed) && SPEED_MS[speed] !== undefined ? speed : city.clock.speed;
  city.clock.speed = s;
  if (s > 0) city.clock.lastSpeed = s;
  else city.clock.accMs = 0;
}

/** Pause ↔ last positive speed. */
export function togglePause(city) {
  setSpeed(city, city.clock.speed === 0 ? city.clock.lastSpeed : 0);
}

/** The Building whose footprint covers tile `i`, or null. */
export function buildingAt(city, i) {
  const t = city.tiles[i];
  if (!t || t.anchor < 0) return null;
  return city.buildings.find((b) => idx(b.x, b.y) === t.anchor) ?? null;
}

/** Queues tile `i` for repaint. */
export function markDirty(city, i) { city.dirty.tiles.push(i); }

// ---------------------------------------------------------------------------
// Derived data (§1.6–1.9)

/** Chebyshev distance from (tx,ty) to the nearest tile of a w×h footprint at (x,y). */
function footprintDist(tx, ty, x, y, w, h) {
  const dx = Math.max(x - tx, tx - (x + w - 1), 0);
  const dy = Math.max(y - ty, ty - (y + h - 1), 0);
  return Math.max(dx, dy);
}

/** True when any footprint tile of building `b` is marked in `grid`. */
function footprintMarked(grid, b, def) {
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) if (grid[idx(b.x + dx, b.y + dy)]) return true;
  }
  return false;
}

/** Sets `flag` on every footprint tile of `b`. */
function setFootprintFlag(city, b, def, flag, value) {
  for (let dy = 0; dy < def.h; dy++) {
    for (let dx = 0; dx < def.w; dx++) city.tiles[idx(b.x + dx, b.y + dy)][flag] = value;
  }
}

const UTILITIES = Object.freeze({
  power: { cap: 'capPower', need: 'power', flag: 'powered', statCap: 'powerCap', statUse: 'powerUse' },
  water: { cap: 'capWater', need: 'water', flag: 'watered', statCap: 'waterCap', statUse: 'waterUse' },
});

/**
 * Power or water distribution (§1.6): services first, then developed lots in ascending index,
 * while supply lasts; level-0 lots in range are served iff there is no city-wide shortage.
 */
function distributeUtility(city, u) {
  const tiles = city.tiles;
  rangeScratch.fill(0);
  let cap = 0;
  for (const b of city.buildings) {
    const def = BUILDINGS[b.id];
    if (!def[u.cap]) continue;
    cap += def[u.cap];
    const r = clampRect(b.x - def.radius, b.y - def.radius, b.x + def.w - 1 + def.radius, b.y + def.h - 1 + def.radius);
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) rangeScratch[idx(x, y)] = 1;
  }
  let use = 0, granted = 0;
  for (const b of city.buildings) {
    const def = BUILDINGS[b.id];
    const inRange = footprintMarked(rangeScratch, b, def);
    const need = def[u.need];
    if (inRange) {
      use += need;
      if (granted + need <= cap) { granted += need; setFootprintFlag(city, b, def, u.flag, true); }
    }
  }
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (t.zone === ZONE.NONE || t.level === 0 || !rangeScratch[i]) continue;
    const need = ZONE_LEVELS[t.zone][t.level][u.need];
    use += need;
    if (granted + need <= cap) { granted += need; t[u.flag] = true; }
  }
  if (use <= cap) {
    for (let i = 0; i < N; i++) {
      const t = tiles[i];
      if (t.zone !== ZONE.NONE && t.level === 0 && rangeScratch[i]) t[u.flag] = true;
    }
  }
  city.stats[u.statCap] = cap;
  city.stats[u.statUse] = use;
}

/** Service coverage bitmask per tile; all zero while services are suspended. */
function computeCover(city) {
  const cover = city.grids.cover;
  cover.fill(0);
  if (city.servicesCut) return;
  for (const b of city.buildings) {
    const def = BUILDINGS[b.id];
    if (!def.cover) continue;
    const r = clampRect(b.x - def.radius, b.y - def.radius, b.x + def.w - 1 + def.radius, b.y + def.h - 1 + def.radius);
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) cover[idx(x, y)] |= def.cover;
  }
}

/** Adds `emission × (1 − d/(radius+1))` around a w×h source for Chebyshev d ≤ radius. */
function emitPollution(x, y, w, h, emission, radius) {
  const r = clampRect(x - radius, y - radius, x + w - 1 + radius, y + h - 1 + radius);
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const d = footprintDist(tx, ty, x, y, w, h);
      pollutionScratch[idx(tx, ty)] += emission * (1 - d / (radius + 1));
    }
  }
}

/** Emissions from developed I lots and plants, minus PARK_POLLUTION_ABSORB on park-covered tiles (needs `computeCover` first). */
function computePollution(city) {
  pollutionScratch.fill(0);
  const tiles = city.tiles, cover = city.grids.cover;
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (t.zone !== ZONE.I || t.level === 0) continue;
    const { x, y } = xyOf(i);
    emitPollution(x, y, 1, 1, ZONE_LEVELS.i[t.level].pollution, BALANCE.LOT_POLLUTION_RADIUS);
  }
  for (const b of city.buildings) {
    const def = BUILDINGS[b.id];
    if (def.pollution) emitPollution(b.x, b.y, def.w, def.h, def.pollution, def.pollutionRadius);
  }
  const out = city.grids.pollution;
  for (let i = 0; i < N; i++) {
    const absorbed = cover[i] & COVER.PARK ? BALANCE.PARK_POLLUTION_ABSORB : 0;
    out[i] = Math.round(clamp(pollutionScratch[i] - absorbed, 0, 100));
  }
}

/** True when any 8-neighbour of (x,y) is a developed industrial lot. */
function nearIndustry(tiles, x, y) {
  const r = clampRect(x - 1, y - 1, x + 1, y + 1);
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const t = tiles[idx(tx, ty)];
      if (t.zone === ZONE.I && t.level > 0 && (tx !== x || ty !== y)) return true;
    }
  }
  return false;
}

function computeLandValue(city) {
  const tiles = city.tiles, cover = city.grids.cover, pollution = city.grids.pollution, lv = city.grids.landValue;
  nearWaterScratch.fill(0);
  const wr = LV_W.WATER_RADIUS;
  for (let i = 0; i < N; i++) {
    if (tiles[i].terrain !== TERRAIN.WATER) continue;
    const { x, y } = xyOf(i);
    const r = clampRect(x - wr, y - wr, x + wr, y + wr);
    for (let ty = r.y0; ty <= r.y1; ty++) for (let tx = r.x0; tx <= r.x1; tx++) nearWaterScratch[idx(tx, ty)] = 1;
  }
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (t.terrain === TERRAIN.WATER) { lv[i] = 0; continue; }
    const c = cover[i];
    let v = LV_W.BASE
      + (c & COVER.PARK ? LV_W.PARK : 0) + (c & COVER.SCHOOL ? LV_W.SCHOOL : 0)
      + (c & COVER.HOSPITAL ? LV_W.HOSPITAL : 0) + (c & COVER.POLICE ? LV_W.POLICE : 0)
      + (nearWaterScratch[i] ? LV_W.NEAR_WATER : 0)
      - LV_W.POLLUTION * pollution[i];
    if (t.zone === ZONE.R) {
      const { x, y } = xyOf(i);
      if (nearIndustry(tiles, x, y)) v -= LV_W.INDUSTRY_NEIGHBOUR;
    }
    lv[i] = Math.round(clamp(v, 0, 100));
  }
}

/** Growth gate chain (§1.10 step 2); returns the first failing BLOCK or BLOCK.NONE. */
function gateBlock(city, t, i) {
  const D = city.demand[t.zone], L = t.level;
  if (!t.access) return BLOCK.ROAD;
  if (!t.powered) return BLOCK.POWER;
  if (L === 0 ? D <= 0 : D <= 0.2) return BLOCK.DEMAND;
  if (L >= 1 && !t.watered) return BLOCK.WATER;
  if (L === 3) return BLOCK.FULL;
  if (t.zone !== ZONE.I && city.grids.landValue[i] < BALANCE.LV_REQ[L + 1]) return BLOCK.VALUE;
  if (t.zone === ZONE.R && city.grids.pollution[i] > BALANCE.POLLUTION_BLOCK_R) return BLOCK.POLLUTION;
  return BLOCK.NONE;
}

/**
 * Recomputes every derived field: access, power, water, coverage, pollution, land value, stats,
 * approval, demand and per-lot `block`. Returns alert-transition events (firstHouse, powerShort, waterShort).
 */
export function recomputeDerived(city) {
  const tiles = city.tiles, stats = city.stats, events = [];
  // Reset per-tile flags and count roads; access = a road among the 4 neighbours.
  let roads = 0;
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    t.powered = false; t.watered = false; t.block = BLOCK.NONE;
    if (t.road) { roads++; t.access = false; continue; }
    const x = i % MAP_W;
    t.access = (x > 0 && tiles[i - 1].road) || (x < MAP_W - 1 && tiles[i + 1].road)
      || (i >= MAP_W && tiles[i - MAP_W].road) || (i < N - MAP_W && tiles[i + MAP_W].road);
  }
  stats.roads = roads;
  distributeUtility(city, UTILITIES.power);
  distributeUtility(city, UTILITIES.water);
  computeCover(city);
  computePollution(city);
  computeLandValue(city);

  // Aggregates over lots.
  const dev = { r: 0, c: 0, i: 0 };
  let pop = 0, cJobs = 0, iJobs = 0, zoned = 0, pollutionSum = 0;
  let lvSumR = 0, pollSumR = 0, unpoweredR = 0, dense = 0, unwateredDense = 0;
  const covR = { police: 0, fire: 0, school: 0, hospital: 0, park: 0 };
  const { cover, pollution, landValue } = city.grids;
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (t.zone === ZONE.NONE) continue;
    zoned++;
    pollutionSum += pollution[i];
    if (t.level === 0) continue;
    dev[t.zone]++;
    const cap = ZONE_LEVELS[t.zone][t.level].cap;
    if (t.zone === ZONE.R) {
      pop += cap;
      lvSumR += landValue[i];
      pollSumR += pollution[i];
      if (!t.powered) unpoweredR++;
      if (t.level >= 2) { dense++; if (!t.watered) unwateredDense++; }
      const c = cover[i];
      if (c & COVER.POLICE) covR.police++;
      if (c & COVER.FIRE) covR.fire++;
      if (c & COVER.SCHOOL) covR.school++;
      if (c & COVER.HOSPITAL) covR.hospital++;
      if (c & COVER.PARK) covR.park++;
    } else if (t.zone === ZONE.C) cJobs += cap;
    else iJobs += cap;
  }
  const jobs = cJobs + iJobs;
  const workers = Math.round(pop * BALANCE.WORKER_SHARE);
  const unemployment = Math.max(0, workers - jobs) / Math.max(1, workers);
  const nR = dev.r;
  const share = (n) => (nR ? n / nR : 0);
  stats.pop = pop; stats.cJobs = cJobs; stats.iJobs = iJobs; stats.jobs = jobs;
  stats.workers = workers; stats.unemployment = unemployment; stats.developed = dev;
  stats.pollutionIndex = zoned ? pollutionSum / zoned / 100 : 0;
  stats.lvAvgR = nR ? lvSumR / nR : LV_W.DEFAULT_AVG_R;

  // Approval (§1.8).
  if (!nR) stats.approval = APPROVAL_W.BASE;
  else {
    const A = APPROVAL_W;
    const score = A.BASE + (BALANCE.TAX_DEFAULT - city.taxRate) * A.TAX
      + A.POLICE * share(covR.police) + A.FIRE * share(covR.fire) + A.SCHOOL * share(covR.school)
      + A.HOSPITAL * share(covR.hospital) + A.PARK * share(covR.park)
      + (stats.lvAvgR - LV_W.DEFAULT_AVG_R) / A.VALUE_DIV
      - A.POLLUTION * (pollSumR / nR)
      - A.UNEMPLOYMENT * unemployment
      - A.UNPOWERED * share(unpoweredR) - A.UNWATERED * (dense ? unwateredDense / dense : 0)
      - (city.cash < 0 ? A.DEBT : 0);
    stats.approval = Math.round(clamp(score, 0, 100));
  }

  // RCI demand (§1.9).
  const W = DEMAND_W;
  const taxMod = (city.taxRate - BALANCE.TAX_DEFAULT) * W.TAX_MOD;
  const jobGap = (jobs - workers) / Math.max(W.MIN_WORKERS, workers);
  const shops = pop * W.C_SHOPS_PER_POP;
  city.demand.r = pop === 0 ? W.R_SEED
    : clamp(W.R_BASE + W.R_JOBGAP * jobGap + (stats.approval - APPROVAL_W.BASE) / W.R_APPROVAL_DIV - taxMod, -1, 1);
  city.demand.c = clamp(W.C_BASE + (shops - cJobs) / Math.max(W.C_MIN_DEN, shops) + W.C_SCHOOL * share(covR.school) - taxMod, -1, 1);
  city.demand.i = clamp(W.I_BASE + W.I_JOBGAP * Math.max(0, -jobGap) - W.I_POLLUTION * stats.pollutionIndex - taxMod, -1, 1);

  // Growth blockers for every lot (gates only).
  const counts = stats.blockCounts;
  for (const k of Object.keys(counts)) counts[k] = 0;
  for (let i = 0; i < N; i++) {
    const t = tiles[i];
    if (t.zone === ZONE.NONE) continue;
    t.block = gateBlock(city, t, i);
    counts[t.block]++;
  }

  // Alert transitions.
  const alerts = city.alerts;
  if (pop > 0 && !alerts.everPop) { alerts.everPop = true; events.push({ type: 'firstHouse' }); }
  const powerShort = stats.powerUse > stats.powerCap;
  if (powerShort !== alerts.powerShort) { alerts.powerShort = powerShort; events.push({ type: 'powerShort', on: powerShort }); }
  const waterShort = stats.waterUse > stats.waterCap;
  if (waterShort !== alerts.waterShort) { alerts.waterShort = waterShort; events.push({ type: 'waterShort', on: waterShort }); }
  return events;
}

// ---------------------------------------------------------------------------
// Daily step, month end, clock

/** Growth/decline evaluation of one lot (§1.10); pushes grow/decline events. */
function evaluateLot(city, rng, i, events) {
  const t = city.tiles[i];
  const D = city.demand[t.zone], pollution = city.grids.pollution[i];
  if (t.level >= 1) {
    let declineBlock = null;
    if (!t.access || !t.powered) {
      t.starve++;
      if (t.starve >= BALANCE.STARVE_EVALS) { t.starve = 0; declineBlock = gateBlock(city, t, i); }
    } else {
      t.starve = 0;
      if (D < BALANCE.DECLINE_DEMAND && rng.next() < BALANCE.DECLINE_P) declineBlock = BLOCK.DEMAND;
      else if (t.zone === ZONE.R && pollution > BALANCE.POLLUTION_DECLINE_R && rng.next() < BALANCE.POLLUTION_DECLINE_P) {
        declineBlock = BLOCK.POLLUTION;
      }
    }
    if (declineBlock) {
      t.level--;
      t.block = declineBlock;
      markDirty(city, i);
      events.push({ type: 'decline', i, level: t.level });
      return;
    }
  }
  t.block = gateBlock(city, t, i);
  if (t.block !== BLOCK.NONE) return;
  const lv = city.grids.landValue[i] / 100;
  const p = (BALANCE.GROW_BASE + BALANCE.GROW_DEMAND * D) * (BALANCE.GROW_LV_BASE + BALANCE.GROW_LV_WEIGHT * lv);
  if (rng.next() < p) {
    t.level++;
    t.starve = 0;
    markDirty(city, i);
    events.push({ type: 'grow', i, level: t.level, zone: t.zone });
  }
}

/** Month-end fires (§1.11): each developed lot may burn down to level 0; no spreading. */
function rollFires(city, rng, events) {
  const cover = city.grids.cover;
  for (let i = 0; i < N; i++) {
    const t = city.tiles[i];
    if (t.zone === ZONE.NONE || t.level === 0) continue;
    const p = BALANCE.FIRE_P * (cover[i] & COVER.FIRE ? BALANCE.FIRE_COVERED_MULT : 1);
    if (rng.next() < p) {
      t.level = 0; t.starve = 0;
      markDirty(city, i);
      events.push({ type: 'fire', i });
    }
  }
}

/** Month-end budget (§1.12) for the month that just ended; pushes month/debt/services events. */
function settleBudget(city, month, year, events) {
  const s = city.stats;
  const income = Math.round(city.taxRate / 100 * (s.pop * BALANCE.INCOME_POP + s.cJobs * BALANCE.INCOME_CJOB + s.iJobs * BALANCE.INCOME_IJOB));
  let upkeep = s.roads * BALANCE.ROAD_UPKEEP;
  for (const b of city.buildings) upkeep += BUILDINGS[b.id].upkeep;
  const interest = city.cash < 0 ? Math.round(BALANCE.INTEREST * -city.cash) : 0;
  const expenses = upkeep + interest;
  city.cash += income - expenses;
  city.debtMonths = city.cash < 0 ? city.debtMonths + 1 : 0;
  const wasCut = city.servicesCut;
  city.servicesCut = city.cash < BALANCE.SERVICES_CUT_CASH;
  s.income = income; s.expenses = expenses;
  city.history.push({ month, year, pop: s.pop, cash: city.cash, income, expenses });
  if (city.history.length > BALANCE.HISTORY_CAP) city.history.splice(0, city.history.length - BALANCE.HISTORY_CAP);
  events.push({ type: 'month', income, expenses, cash: city.cash });
  const debt = city.cash < 0;
  if (debt !== city.alerts.debt) { city.alerts.debt = debt; events.push({ type: debt ? 'debt' : 'debtCleared' }); }
  if (city.servicesCut !== wasCut) events.push({ type: city.servicesCut ? 'servicesCut' : 'servicesRestored' });
}

/** Advances the city by one day (§3.2.2) and returns the events it produced. */
export function stepDay(city) {
  const rng = createRng(city.rngState);
  const events = recomputeDerived(city);
  const clock = city.clock;
  const stride = BALANCE.EVAL_STRIDE;
  for (let i = (clock.day - 1) % stride; i < N; i += stride) {
    if (city.tiles[i].zone !== ZONE.NONE) evaluateLot(city, rng, i, events);
  }
  clock.day++;
  if (clock.day > BALANCE.DAYS_PER_MONTH) {
    const endedMonth = clock.month, endedYear = clock.year;
    clock.day = 1;
    clock.month++;
    if (clock.month > BALANCE.MONTHS_PER_YEAR) { clock.month = 1; clock.year++; }
    events.push(...recomputeDerived(city));
    rollFires(city, rng, events);
    settleBudget(city, endedMonth, endedYear, events);
  }
  city.rngState = rng.state();
  return events;
}

/** Accumulates frame time and runs up to MAX_TICKS_PER_FRAME days; returns all events. Paused → []. */
export function advance(city, dtMs) {
  const clock = city.clock;
  const ms = SPEED_MS[clock.speed];
  if (!(ms > 0)) { clock.accMs = 0; return []; }
  clock.accMs += Number.isFinite(dtMs) && dtMs > 0 ? dtMs : 0;
  const events = [];
  let ticks = 0;
  while (clock.accMs >= ms && ticks < BALANCE.MAX_TICKS_PER_FRAME) {
    clock.accMs -= ms;
    for (const e of stepDay(city)) events.push(e);
    ticks++;
  }
  if (ticks >= BALANCE.MAX_TICKS_PER_FRAME) clock.accMs = 0;
  return events;
}
