/**
 * Main City — shared enums, tuning tables, skins and tiny factories.
 * Pure data: no DOM, no randomness, no imports. Every tuning number lives here.
 */

export const MAP_W = 40;
export const MAP_H = 40;
export const TILE = 32;
export const SAVE_VERSION = 1;

/**
 * Frozen lookup table with no prototype, so `TABLE[id]` is truthy only for our own
 * keys: untrusted ids such as 'constructor' or '__proto__' from a save or share code
 * must not resolve to Object.prototype members.
 */
const table = (entries) => Object.freeze(Object.assign(Object.create(null), entries));

export const TERRAIN = Object.freeze({ GRASS: 'grass', TREE: 'tree', WATER: 'water' });
export const ZONE = Object.freeze({ NONE: 'none', R: 'r', C: 'c', I: 'i' });
export const ZONE_ORDER = Object.freeze(['r', 'c', 'i']);
export const BUILDING = Object.freeze({
  POWER: 'power', WATER: 'water', PARK: 'park', POLICE: 'police', FIRE: 'fire', SCHOOL: 'school', HOSPITAL: 'hospital',
});
export const BUILDING_ORDER = Object.freeze(['power', 'water', 'park', 'police', 'fire', 'school', 'hospital']);
export const TOOL = Object.freeze({
  PAN: 'pan', INSPECT: 'inspect', ROAD: 'road', ZONE_R: 'zone_r', ZONE_C: 'zone_c', ZONE_I: 'zone_i',
  BULLDOZE: 'bulldoze', POWER: 'power', WATER: 'water', PARK: 'park', POLICE: 'police',
  FIRE: 'fire', SCHOOL: 'school', HOSPITAL: 'hospital',
});
/** Toolbar order. */
export const TOOL_ORDER = Object.freeze(['pan', 'inspect', 'road', 'zone_r', 'zone_c', 'zone_i', 'bulldoze',
  'power', 'water', 'park', 'police', 'fire', 'school', 'hospital']);
export const TOOL_KIND = table({
  pan: 'pan', inspect: 'pan', road: 'line', zone_r: 'rect', zone_c: 'rect', zone_i: 'rect',
  bulldoze: 'rect', power: 'single', water: 'single', park: 'single', police: 'single',
  fire: 'single', school: 'single', hospital: 'single',
});
export const TOOL_ZONE = table({ zone_r: 'r', zone_c: 'c', zone_i: 'i' });
/** Shortcut labels only; key handling lives in input.js. */
export const TOOL_KEY = Object.freeze({ pan: 'Esc', inspect: 'I', road: 'R', zone_r: 'Z', zone_c: 'Z', zone_i: 'Z', bulldoze: 'B' });
export const OVERLAY = Object.freeze({ NONE: 'none', POWER: 'power', WATER: 'water', VALUE: 'value', POLLUTION: 'pollution', BLOCK: 'block' });
export const OVERLAY_ORDER = Object.freeze(['none', 'power', 'water', 'value', 'pollution', 'block']);
export const BLOCK = Object.freeze({
  NONE: 'none', ROAD: 'road', POWER: 'power', WATER: 'water', DEMAND: 'demand', VALUE: 'value', POLLUTION: 'pollution', FULL: 'full',
});
/** Growth-blocker overlay colours; `none` is not painted. */
export const BLOCK_COLORS = table({
  road: '#8a8a8a', power: '#f5c518', water: '#3aa0ff', demand: '#b06cff', value: '#ff8a3c', pollution: '#6b4a2a', full: '#2ecc71',
});
export const COVER = Object.freeze({ POLICE: 1, FIRE: 2, SCHOOL: 4, HOSPITAL: 8, PARK: 16 });
export const ERR = Object.freeze({
  WATER: 'err.water', OCCUPIED: 'err.occupied', MONEY: 'err.money', BOUNDS: 'err.bounds',
  NOTHING: 'err.nothing', SAVE: 'err.save', VERSION: 'err.version', STORAGE: 'err.storage',
});
/** Milliseconds per simulated day for speeds 0 (pause), 1x, 2x, 3x. */
export const SPEED_MS = Object.freeze([0, 500, 250, 167]);

/**
 * @typedef {{ w:number, h:number, cost:number, upkeep:number, radius:number, power:number, water:number,
 *   capPower?:number, capWater?:number, pollution?:number, pollutionRadius?:number, cover?:number }} BuildingDef
 */
/** @type {Readonly<Record<string, BuildingDef>>} */
export const BUILDINGS = table({
  power:    { w: 2, h: 2, cost: 2500, upkeep: 100, radius: 10, power: 0, water: 0, capPower: 400, pollution: 25, pollutionRadius: 4 },
  water:    { w: 1, h: 1, cost: 600,  upkeep: 30,  radius: 7,  power: 2, water: 0, capWater: 150 },
  park:     { w: 1, h: 1, cost: 150,  upkeep: 10,  radius: 4,  power: 0, water: 0, cover: 16 },
  police:   { w: 2, h: 2, cost: 800,  upkeep: 40,  radius: 8,  power: 4, water: 2, cover: 1 },
  fire:     { w: 2, h: 2, cost: 800,  upkeep: 40,  radius: 8,  power: 4, water: 2, cover: 2 },
  school:   { w: 2, h: 2, cost: 1000, upkeep: 50,  radius: 9,  power: 4, water: 2, cover: 4 },
  hospital: { w: 2, h: 2, cost: 1500, upkeep: 75,  radius: 9,  power: 4, water: 2, cover: 8 },
});

/** `ZONE_LEVELS[zone][level]` → { cap, power, water, pollution }; level 0 is an empty lot. */
export const ZONE_LEVELS = Object.freeze({
  r: [{ cap: 0, power: 0, water: 0, pollution: 0 }, { cap: 8, power: 1, water: 1, pollution: 0 },
      { cap: 20, power: 2, water: 2, pollution: 0 }, { cap: 50, power: 3, water: 3, pollution: 0 }],
  c: [{ cap: 0, power: 0, water: 0, pollution: 0 }, { cap: 6, power: 2, water: 1, pollution: 0 },
      { cap: 15, power: 4, water: 2, pollution: 0 }, { cap: 40, power: 6, water: 3, pollution: 0 }],
  i: [{ cap: 0, power: 0, water: 0, pollution: 0 }, { cap: 8, power: 3, water: 2, pollution: 10 },
      { cap: 20, power: 6, water: 3, pollution: 20 }, { cap: 50, power: 9, water: 4, pollution: 30 }],
});

export const BALANCE = Object.freeze({
  START_CASH: 20000, TAX_DEFAULT: 9, TAX_MIN: 0, TAX_MAX: 20, BUILD_FLOOR: -10000, SERVICES_CUT_CASH: -5000, INTEREST: 0.01,
  ROAD_COST: 10, ROAD_UPKEEP: 1, ZONE_COST: 5, BULLDOZE_COST: 2, TREE_CLEAR: 3,
  DAYS_PER_MONTH: 30, MONTHS_PER_YEAR: 12, MAX_TICKS_PER_FRAME: 5, FRAME_DT_CLAMP: 250, EVAL_STRIDE: 10,
  WORKER_SHARE: 0.55, INCOME_POP: 10, INCOME_CJOB: 14, INCOME_IJOB: 12,
  GROW_BASE: 0.25, GROW_DEMAND: 0.35, GROW_LV_BASE: 0.7, GROW_LV_WEIGHT: 0.3,
  LV_REQ: [0, 0, 35, 55], STARVE_EVALS: 3, DECLINE_DEMAND: -0.4, DECLINE_P: 0.3,
  POLLUTION_BLOCK_R: 60, POLLUTION_DECLINE_R: 80, POLLUTION_DECLINE_P: 0.5, LOT_POLLUTION_RADIUS: 3, PARK_POLLUTION_ABSORB: 20,
  FIRE_P: 0.003, FIRE_COVERED_MULT: 0.15, HISTORY_CAP: 60,
  WATER_MIN: 0.06, WATER_MAX: 0.12, WATER_BLOBS_MIN: 2, WATER_BLOBS_MAX: 3,
  TREE_SHARE: 0.12, TREE_CLUSTER_MIN: 4, TREE_CLUSTER_MAX: 14, CLEAR_RADIUS: 6,
  ZOOM_MIN: 0.25, ZOOM_MAX: 3, ZOOM_STEP: 1.1, KEY_PAN_SPEED: 600, TAP_MS: 300, TAP_PX: 6, LONG_PRESS_MS: 450,
});

/** Land-value formula weights (§1.7). */
export const LV_W = Object.freeze({
  BASE: 30, PARK: 20, SCHOOL: 10, HOSPITAL: 8, POLICE: 5, NEAR_WATER: 8, WATER_RADIUS: 2,
  POLLUTION: 0.5, INDUSTRY_NEIGHBOUR: 10, DEFAULT_AVG_R: 40,
});
/** Approval formula weights (§1.8). */
export const APPROVAL_W = Object.freeze({
  BASE: 50, TAX: 2, POLICE: 8, FIRE: 6, SCHOOL: 10, HOSPITAL: 8, PARK: 8, VALUE_DIV: 4,
  POLLUTION: 0.3, UNEMPLOYMENT: 25, UNPOWERED: 15, UNWATERED: 10, DEBT: 10,
});
/** RCI demand formula weights (§1.9). */
export const DEMAND_W = Object.freeze({
  TAX_MOD: 0.06, MIN_WORKERS: 60, R_SEED: 0.6, R_BASE: 0.35, R_JOBGAP: 0.9, R_APPROVAL_DIV: 150,
  C_BASE: 0.05, C_SHOPS_PER_POP: 0.3, C_MIN_DEN: 40, C_SCHOOL: 0.1, I_BASE: 0.3, I_JOBGAP: 0.8, I_POLLUTION: 0.3,
});

/**
 * @typedef {{ id:string, bg:string, ground:[string,string,string,string], groundDetail:string,
 *   water:string, waterEdge:string, treeTrunk:string, treeCanopy:[string,string],
 *   road:string, roadLine:string, roadEdge:string,
 *   lot:{r:string,c:string,i:string}, wall:{r:string[],c:string[],i:string[]}, roof:{r:string,c:string,i:string},
 *   window:string, windowLit:string, smoke:string,
 *   service:Record<string,{base:string,accent:string}>,
 *   grid:string, ghostOk:string, ghostBad:string, select:string, cursor:string, badge:string, badgeBg:string,
 *   night:boolean, ui:{bg:string,panel:string,fg:string,accent:string} }} Skin
 */

/** Marker/UI colours shared by the daytime skins. */
const MARKERS = {
  grid: 'rgba(0,0,0,0.12)', ghostOk: '#45d47a', ghostBad: '#e34b4b', select: '#ffffff', cursor: '#ffe36b',
  badge: '#ffffff', badgeBg: 'rgba(0,0,0,0.65)', window: '#5a6b7a', windowLit: '#ffd766', smoke: 'rgba(120,120,120,0.6)',
};
const SERVICE_COLORS = {
  power: { base: '#5c5c66', accent: '#ffd23f' }, water: { base: '#7aa7c7', accent: '#eaf5ff' },
  park: { base: '#4caf50', accent: '#2e7d32' }, police: { base: '#3b5ba5', accent: '#ffffff' },
  fire: { base: '#c0392b', accent: '#ffb347' }, school: { base: '#d9a441', accent: '#ffffff' },
  hospital: { base: '#f2f2f2', accent: '#e53935' },
};
const LOT_TINTS = { r: 'rgba(76,175,80,0.35)', c: 'rgba(47,128,237,0.35)', i: 'rgba(242,153,74,0.35)' };

const GRASSLAND = {
  id: 'grassland', bg: '#1d2b1f',
  ground: ['#7cc26b', '#76bd66', '#82c771', '#79c06a'], groundDetail: '#6aae5b',
  water: '#3d8fd1', waterEdge: '#8ecbf0', treeTrunk: '#6b4a2a', treeCanopy: ['#2f7d3a', '#3f9a4a'],
  road: '#4a4a4f', roadLine: '#d9d9d9', roadEdge: '#2f2f33', lot: LOT_TINTS,
  wall: { r: ['#e8d7b5', '#d8c39a', '#f0e2c4', '#cdb892'], c: ['#9fb8d8', '#8aa8cc', '#b4c9e2', '#7f9fc4'],
          i: ['#b7b2a6', '#a39d90', '#c4bfb3', '#948d80'] },
  roof: { r: '#b5553a', c: '#2f5f9e', i: '#6b665c' },
  service: SERVICE_COLORS, ...MARKERS, night: false,
  ui: { bg: '#1f2a1f', panel: '#2b3a2b', fg: '#f3f6f1', accent: '#8fd97a' },
};

/** Multiplies every `#rrggbb` string inside a palette by `f` (nested objects/arrays included). */
function shadeColors(value, f) {
  if (typeof value === 'string') {
    if (!/^#[0-9a-f]{6}$/i.test(value)) return value;
    const n = parseInt(value.slice(1), 16);
    const ch = (shift) => Math.round(((n >> shift) & 255) * f).toString(16).padStart(2, '0');
    return `#${ch(16)}${ch(8)}${ch(0)}`;
  }
  if (Array.isArray(value)) return value.map((v) => shadeColors(v, f));
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = shadeColors(value[k], f);
    return out;
  }
  return value;
}

/** @type {Readonly<Record<string, Skin>>} */
export const SKINS = table({
  grassland: GRASSLAND,
  desert: {
    id: 'desert', bg: '#3a2a1a',
    ground: ['#e3c98a', '#dcc181', '#e9d094', '#d8bd7c'], groundDetail: '#c9a95f',
    water: '#2aa8a0', waterEdge: '#9fe3dc', treeTrunk: '#7a5a33', treeCanopy: ['#4f8f3f', '#6aa64f'],
    road: '#5a4f45', roadLine: '#f0e2c4', roadEdge: '#3b332c', lot: LOT_TINTS,
    wall: { r: ['#d9a066', '#c98f57', '#e2ad78', '#bf8650'], c: ['#c7a98a', '#b89a7b', '#d4b89b', '#a98b6c'],
            i: ['#a8957f', '#998672', '#b5a28c', '#8b7965'] },
    roof: { r: '#8e3b2a', c: '#4a6b7c', i: '#5f574d' },
    service: SERVICE_COLORS, ...MARKERS, night: false,
    ui: { bg: '#3a2a1a', panel: '#4a3826', fg: '#f8f1e4', accent: '#f0b457' },
  },
  snow: {
    id: 'snow', bg: '#1b2733',
    ground: ['#eef3f7', '#e7edf2', '#f4f8fb', '#e2e9ef'], groundDetail: '#cfd9e2',
    water: '#9fd3ef', waterEdge: '#d6ecf8', treeTrunk: '#4a3320', treeCanopy: ['#1f4d2b', '#2d6a3b'],
    road: '#4b5158', roadLine: '#e8edf2', roadEdge: '#2c3137', lot: LOT_TINTS,
    wall: { r: ['#c9b8a3', '#bba894', '#d6c7b4', '#ad9b86'], c: ['#8fa6bd', '#7d95ad', '#a2b6ca', '#6d859d'],
            i: ['#9a9a9a', '#8a8a8a', '#a9a9a9', '#7b7b7b'] },
    roof: { r: '#7a3b2c', c: '#2f4f70', i: '#4e4a44' },
    service: SERVICE_COLORS, ...MARKERS, night: false,
    ui: { bg: '#1b2733', panel: '#283845', fg: '#f1f6fa', accent: '#7fc8f0' },
  },
  night: {
    ...shadeColors(GRASSLAND, 0.45), id: 'night', bg: '#0b0f16', night: true,
    roadLine: '#ffe680', window: '#2b3340', windowLit: '#ffd766', smoke: 'rgba(90,90,90,0.6)',
    grid: 'rgba(255,255,255,0.08)', ghostOk: MARKERS.ghostOk, ghostBad: MARKERS.ghostBad,
    select: '#ffffff', cursor: '#ffe36b', badge: '#ffffff', badgeBg: 'rgba(0,0,0,0.75)', lot: LOT_TINTS,
    ui: { bg: '#0b0f16', panel: '#161c26', fg: '#e8edf5', accent: '#ffd766' },
  },
});
export const SKIN_ORDER = Object.freeze(['grassland', 'desert', 'snow', 'night']);
export const DEFAULT_SKIN = 'grassland';

/** Tile index of (x, y); no bounds check. */
export function idx(x, y) { return y * MAP_W + x; }

/** True when (x, y) is an integer tile inside the map. */
export function inBounds(x, y) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
}

/** Coordinates of tile index `i`. */
export function xyOf(i) { return { x: i % MAP_W, y: Math.floor(i / MAP_W) }; }

/** Interaction kind of a tool: 'pan' | 'line' | 'rect' | 'single'. */
export function toolKind(tool) { return TOOL_KIND[tool] ?? 'pan'; }

/** zone_r → zone_c → zone_i → zone_r; any other tool → zone_r. */
export function cycleZoneTool(tool) {
  if (tool === TOOL.ZONE_R) return TOOL.ZONE_C;
  if (tool === TOOL.ZONE_C) return TOOL.ZONE_I;
  return TOOL.ZONE_R;
}

/** Stateless visual variant 0..3 for a tile. */
export function tileVariant(x, y, seed) { return (x * 7 + y * 13 + seed) & 3; }

/** A fresh Tile (§2) with the given terrain. */
export function createTile(terrain = TERRAIN.GRASS) {
  return {
    terrain, road: false, zone: ZONE.NONE, level: 0, building: null, anchor: -1, starve: 0,
    access: false, powered: false, watered: false, block: BLOCK.NONE,
  };
}

/** Zeroed Stats (§2). */
function createStats() {
  const blockCounts = {};
  for (const k of Object.values(BLOCK)) blockCounts[k] = 0;
  return {
    pop: 0, cJobs: 0, iJobs: 0, jobs: 0, workers: 0, unemployment: 0,
    approval: 50, developed: { r: 0, c: 0, i: 0 }, roads: 0,
    powerCap: 0, powerUse: 0, waterCap: 0, waterUse: 0, pollutionIndex: 0, lvAvgR: LV_W.DEFAULT_AVG_R,
    income: 0, expenses: 0, blockCounts,
  };
}

/** An all-grass City (§2) with no derived data computed yet. */
export function createCityShell({ name, seed, skin } = {}) {
  const n = MAP_W * MAP_H;
  const tiles = new Array(n);
  for (let i = 0; i < n; i++) tiles[i] = createTile();
  const seed32 = Number.isFinite(seed) ? seed >>> 0 : 0;
  const cityName = typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : 'Main City';
  return {
    v: SAVE_VERSION, name: cityName, seed: seed32, rngState: seed32, w: MAP_W, h: MAP_H,
    tiles, buildings: [],
    clock: { day: 1, month: 1, year: 1, speed: 1, lastSpeed: 1, accMs: 0 },
    cash: BALANCE.START_CASH, taxRate: BALANCE.TAX_DEFAULT, debtMonths: 0, servicesCut: false,
    skin: SKINS[skin] ? skin : DEFAULT_SKIN, history: [],
    demand: { r: 0, c: 0, i: 0 },
    stats: createStats(),
    grids: { pollution: new Uint8Array(n), landValue: new Uint8Array(n), cover: new Uint8Array(n) },
    alerts: { powerShort: false, waterShort: false, debt: false, everPop: false },
    dirty: { all: true, tiles: [] },
    fromLink: false,
  };
}

/** Indices of a w×h footprint anchored top-left at (x, y), or null if any tile is out of bounds. */
export function footprint(x, y, w, h) {
  if (!inBounds(x, y) || !inBounds(x + w - 1, y + h - 1)) return null;
  const out = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push(idx(x + dx, y + dy));
  return out;
}
