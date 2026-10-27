/**
 * Canvas renderer. The static map (terrain, roads, lots, buildings) is baked
 * once into an offscreen canvas at 1× and only dirty tiles are repainted; each
 * frame blits the bake through the camera transform and draws overlays,
 * badges, ghosts, cursors and the grid for visible tiles only.
 *
 * Everything is procedural vector drawing: no images, no text. The renderer
 * never mutates game state except clearing `city.dirty`, which it owns.
 * @module render
 */
import {
  MAP_W, MAP_H, TILE, SKINS, DEFAULT_SKIN, BUILDINGS, BLOCK_COLORS, BLOCK, ZONE, TERRAIN,
  toolKind, tileVariant,
} from './data.js';

const WORLD_W = MAP_W * TILE;
const WORLD_H = MAP_H * TILE;
const TILE_COUNT = MAP_W * MAP_H;

/** Zone colours shared with the UI's RCI bars (lot outlines only). */
const ZONE_COLORS = Object.freeze({ r: '#4caf50', c: '#2f80ed', i: '#f2994a' });
const ZONE_BITS = Object.freeze({ none: 0, r: 1, c: 2, i: 3 });
const OVERLAY_OK = '#2ecc71';
const OVERLAY_BAD = '#e74c3c';
const OVERLAY_ALPHA = 0.55;
const GHOST_ALPHA = 0.45;
const UNPOWERED_SHADE = 'rgba(0,0,0,0.4)';
const SERVICES_CUT_SHADE = 'rgba(128,128,128,0.55)';
const ROAD_VERGE = 5;          // world px of ground on each side of a road body
const BADGE_SCREEN_PX = 10;    // badge glyph size in CSS px
const BLINK_MS = 500;          // half-period of the 1 Hz badge blink
const FALLBACK_SERVICE = Object.freeze({ base: '#888888', accent: '#f0f0f0' });

/** Pre-built fill styles indexed 0..100 so per-frame overlays allocate nothing. */
const VALUE_RAMP = buildRamp((k) => `rgb(${lerp(0x4a, 0xff, k)},${lerp(0x2a, 0xd3, k)},${lerp(0x6b, 0x4d, k)})`);
const POLLUTION_RAMP = buildRamp((k) => `rgba(90,59,26,${k.toFixed(2)})`);

function lerp(a, b, k) {
  return Math.round(a + (b - a) * k);
}

function buildRamp(fn) {
  const out = new Array(101);
  for (let i = 0; i <= 100; i++) out[i] = fn(i / 100);
  return out;
}

/** Stateless 32-bit hash of a tile position, used for ground specks and tree shapes. */
function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + (seed | 0)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

/** Clamps a 0..100 grid value (possibly NaN/undefined) to a ramp index. */
function rampIndex(v) {
  return v > 0 ? (v < 100 ? Math.round(v) : 100) : 0;
}

/**
 * Pack the visual state of a tile into one integer. The bake stores the key
 * of every painted tile so tiles whose derived state changed without a dirty
 * mark (power lost, services suspended) can be found and repainted.
 */
function tileKey(t, servicesCut) {
  let k = t.terrain === TERRAIN.WATER ? 1 : t.terrain === TERRAIN.TREE ? 2 : 0;
  if (t.road) k |= 4;
  k |= (ZONE_BITS[t.zone] || 0) << 3;
  k |= (t.level & 3) << 5;
  if (t.powered) k |= 128;
  if (t.building) {
    k |= 256;
    const def = BUILDINGS[t.building];
    if (servicesCut && def && def.cover) k |= 512;
  }
  return k + 1; // never 0, so an unpainted slot always compares as stale
}

/**
 * @typedef {object} Renderer
 * @property {() => void} resize                     Reads the canvas CSS size and devicePixelRatio (≤ 2), sizes the backing store, updates the camera.
 * @property {(id:string) => void} setSkin           Swaps the palette; the map is fully rebaked on the next draw.
 * @property {(city:object|null, view:object, nowMs:number) => void} draw  Bakes dirty tiles and composes a frame; `null` city paints the skin background only.
 * @property {() => void} invalidate                 Forces a full rebake and redraw on the next draw.
 */

/**
 * Creates the renderer for a canvas driven by `camera`.
 * @param {HTMLCanvasElement} canvas
 * @param {import('./camera.js').Camera} camera
 * @returns {Renderer}
 */
export function createRenderer(canvas, camera) {
  const ctx = canvas.getContext('2d');
  const bake = document.createElement('canvas');
  bake.width = WORLD_W;
  bake.height = WORLD_H;
  const g = bake.getContext('2d');
  const bakeKeys = new Int32Array(TILE_COUNT);

  let skin = SKINS[DEFAULT_SKIN];
  let fullBake = true;      // repaint every tile on the next draw
  let forceCompose = true;  // redraw the frame even if the signature is unchanged
  let bakedCity = null;     // city object the bake currently shows
  let seed = 0;

  /** Signature of the last composed frame; a frame is skipped when nothing in it changed. */
  const prev = {
    camVersion: -1, city: null, stamp: -1, tool: '', overlay: '', hx: -2, hy: -2, cx: -2, cy: -2,
    dx0: -2, dy0: -2, dx1: -2, dy1: -2, ghost: null, selected: -2, reduced: false, blink: -1,
  };

  // ---------------------------------------------------------------- bake ---

  function roadAt(city, x, y) {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && city.tiles[y * MAP_W + x].road;
  }

  function landAt(city, x, y) {
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H && city.tiles[y * MAP_W + x].terrain !== TERRAIN.WATER;
  }

  function paintWater(city, x, y, px, py) {
    g.fillStyle = skin.water;
    g.fillRect(px, py, TILE, TILE);
    g.fillStyle = skin.waterEdge;
    if (landAt(city, x, y - 1)) g.fillRect(px, py, TILE, 2);
    if (landAt(city, x, y + 1)) g.fillRect(px, py + TILE - 2, TILE, 2);
    if (landAt(city, x - 1, y)) g.fillRect(px, py, 2, TILE);
    if (landAt(city, x + 1, y)) g.fillRect(px + TILE - 2, py, 2, TILE);
  }

  function paintGround(x, y, px, py, h) {
    g.fillStyle = skin.ground[tileVariant(x, y, seed)] || skin.ground[0];
    g.fillRect(px, py, TILE, TILE);
    g.fillStyle = skin.groundDetail;
    const specks = 3 + (h % 3);
    for (let k = 0; k < specks; k++) {
      const ox = (h >>> (2 + k * 6)) & 31;
      const oy = (h >>> (5 + k * 6)) & 31;
      g.fillRect(px + ox, py + oy, 1.5, 1.5);
    }
  }

  function paintTree(px, py, h) {
    const cx = px + TILE / 2;
    const cy = py + TILE / 2;
    g.fillStyle = skin.treeTrunk;
    g.fillRect(cx - 1.5, cy, 3, TILE / 2 - 4);
    const r = 6 + (h & 3);
    const ox = ((h >>> 8) & 7) - 3.5;
    g.fillStyle = skin.treeCanopy[0];
    g.beginPath();
    g.arc(cx + ox, cy - 2, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = skin.treeCanopy[1];
    g.beginPath();
    g.arc(cx - ox * 0.6, cy - 5, r - 2, 0, Math.PI * 2);
    g.fill();
  }

  /** Road body with arms to connected neighbours; edges are the body painted 1 px larger. */
  function paintRoad(city, x, y, px, py) {
    const n = roadAt(city, x, y - 1);
    const s = roadAt(city, x, y + 1);
    const w = roadAt(city, x - 1, y);
    const e = roadAt(city, x + 1, y);
    const m = ROAD_VERGE;
    const top = n ? py : py + m;
    const bottom = s ? py + TILE : py + TILE - m;
    const left = w ? px : px + m;
    const right = e ? px + TILE : px + TILE - m;
    g.fillStyle = skin.roadEdge;
    g.fillRect(px + m, top, TILE - 2 * m, bottom - top);
    g.fillRect(left, py + m, right - left, TILE - 2 * m);
    g.fillStyle = skin.road;
    const t1 = n ? 0 : 1, b1 = s ? 0 : 1, l1 = w ? 0 : 1, r1 = e ? 0 : 1;
    g.fillRect(px + m + 1, top + t1, TILE - 2 * m - 2, bottom - top - t1 - b1);
    g.fillRect(left + l1, py + m + 1, right - left - l1 - r1, TILE - 2 * m - 2);
    const cx = px + TILE / 2;
    const cy = py + TILE / 2;
    g.fillStyle = skin.roadLine;
    if (!n && !s && !w && !e) {
      g.fillRect(cx - 1.5, cy - 1.5, 3, 3);
      return;
    }
    g.strokeStyle = skin.roadLine;
    g.lineWidth = 1;
    g.setLineDash([4, 4]);
    g.beginPath();
    if (n || s) {
      g.moveTo(cx, n ? py : cy);
      g.lineTo(cx, s ? py + TILE : cy);
    }
    if (w || e) {
      g.moveTo(w ? px : cx, cy);
      g.lineTo(e ? px + TILE : cx, cy);
    }
    g.stroke();
    g.setLineDash([]);
  }

  function paintLot(zone, px, py) {
    g.fillStyle = skin.lot[zone];
    g.fillRect(px, py, TILE, TILE);
    g.strokeStyle = ZONE_COLORS[zone];
    g.lineWidth = 1;
    g.setLineDash([3, 3]);
    g.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
    g.setLineDash([]);
  }

  /** Developed lot: wall box, roof band, window grid and level-3 details. */
  function paintZoneBuilding(t, x, y, px, py) {
    const zone = t.zone;
    const level = t.level;
    const inset = 5 - level;
    const bx = px + inset, by = py + inset, bw = TILE - 2 * inset, bh = TILE - 2 * inset;
    const roofH = 3 + level * 2;
    const walls = skin.wall[zone];
    g.fillStyle = walls[tileVariant(x, y, seed)] || walls[0];
    g.fillRect(bx, by, bw, bh);
    g.fillStyle = skin.roof[zone];
    g.fillRect(bx, by, bw, roofH);

    const n = level + 1;
    const areaX = bx + 2, areaY = by + roofH + 2, areaW = bw - 4, areaH = bh - roofH - 4;
    const cw = areaW / n, ch = areaH / n;
    g.fillStyle = skin.night && t.powered ? skin.windowLit : skin.window;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        g.fillRect(areaX + c * cw + cw * 0.25, areaY + r * ch + ch * 0.25, cw * 0.5, ch * 0.5);
      }
    }
    if (level === 3) {
      if (zone === ZONE.R) {
        g.fillStyle = skin.treeTrunk;
        g.fillRect(bx + bw - 7, by - 3, 4, 6);
      } else if (zone === ZONE.C) {
        g.fillStyle = skin.roof[zone];
        g.fillRect(bx + 2, by + roofH + areaH / 2 - 1, bw - 4, 3);
      } else {
        g.fillStyle = skin.roadEdge;
        g.fillRect(bx + 3, by - 4, 4, 8);
        g.fillRect(bx + 10, by - 4, 4, 8);
        g.fillStyle = skin.smoke;
        g.beginPath();
        g.arc(bx + 5, by - 6, 2.5, 0, Math.PI * 2);
        g.arc(bx + 13, by - 7, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
    if (!t.powered) {
      g.fillStyle = UNPOWERED_SHADE;
      g.fillRect(bx, by, bw, bh);
    }
  }

  /** Paints one tile's ground layer and anything on it except a service building. */
  function paintTile(city, i) {
    const t = city.tiles[i];
    const x = i % MAP_W;
    const y = (i - x) / MAP_W;
    const px = x * TILE;
    const py = y * TILE;
    bakeKeys[i] = tileKey(t, city.servicesCut);
    if (t.terrain === TERRAIN.WATER) {
      paintWater(city, x, y, px, py);
      return;
    }
    const h = hash(x, y, seed);
    paintGround(x, y, px, py, h);
    if (t.building) return; // painted by paintService over the whole footprint
    if (t.road) paintRoad(city, x, y, px, py);
    else if (t.zone !== ZONE.NONE && ZONE_COLORS[t.zone]) {
      if (t.level > 0) paintZoneBuilding(t, x, y, px, py);
      else paintLot(t.zone, px, py);
    } else if (t.terrain === TERRAIN.TREE) paintTree(px, py, h);
  }

  function glyphPolygon(points, w, h) {
    g.beginPath();
    for (let k = 0; k < points.length; k += 2) {
      if (k === 0) g.moveTo(points[k] * w, points[k + 1] * h);
      else g.lineTo(points[k] * w, points[k + 1] * h);
    }
    g.closePath();
    g.fill();
  }

  function circle(cx, cy, r) {
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }

  /** Service glyph in local footprint coordinates (origin at the footprint's top-left). */
  function paintGlyph(id, w, h) {
    switch (id) {
      case 'power':
        g.fillRect(w * 0.18, h * 0.18, w * 0.12, h * 0.55);
        g.fillRect(w * 0.36, h * 0.3, w * 0.12, h * 0.43);
        g.fillRect(w * 0.15, h * 0.7, w * 0.4, h * 0.14);
        glyphPolygon([0.74, 0.16, 0.58, 0.5, 0.69, 0.5, 0.6, 0.86, 0.86, 0.44, 0.74, 0.44], w, h);
        break;
      case 'water':
        g.fillRect(w * 0.22, h * 0.14, w * 0.56, h * 0.36);
        g.lineWidth = Math.max(2, w * 0.07);
        g.beginPath();
        g.moveTo(w * 0.3, h * 0.5); g.lineTo(w * 0.2, h * 0.9);
        g.moveTo(w * 0.7, h * 0.5); g.lineTo(w * 0.8, h * 0.9);
        g.moveTo(w * 0.25, h * 0.72); g.lineTo(w * 0.75, h * 0.72);
        g.stroke();
        break;
      case 'park':
        circle(w * 0.3, h * 0.36, w * 0.16);
        circle(w * 0.66, h * 0.3, w * 0.14);
        circle(w * 0.5, h * 0.62, w * 0.13);
        g.lineWidth = Math.max(2, w * 0.08);
        g.beginPath();
        g.moveTo(w * 0.12, h * 0.9); g.lineTo(w * 0.88, h * 0.56);
        g.stroke();
        break;
      case 'police':
        glyphPolygon([0.5, 0.12, 0.8, 0.24, 0.76, 0.58, 0.5, 0.88, 0.24, 0.58, 0.2, 0.24], w, h);
        break;
      case 'fire':
        glyphPolygon([0.5, 0.1, 0.68, 0.36, 0.62, 0.44, 0.8, 0.64, 0.62, 0.9, 0.38, 0.9, 0.2, 0.64, 0.38, 0.44, 0.32, 0.36], w, h);
        break;
      case 'school':
        g.fillRect(w * 0.3, h * 0.14, w * 0.06, h * 0.72);
        glyphPolygon([0.36, 0.14, 0.76, 0.28, 0.36, 0.42], w, h);
        break;
      case 'hospital':
        g.fillRect(w * 0.42, h * 0.15, w * 0.16, h * 0.7);
        g.fillRect(w * 0.15, h * 0.42, w * 0.7, h * 0.16);
        break;
      default:
        circle(w * 0.5, h * 0.5, Math.min(w, h) * 0.25);
    }
  }

  /** Paints a whole service building from its anchor tile (ground already painted). */
  function paintService(city, anchor) {
    const t = city.tiles[anchor];
    const def = BUILDINGS[t.building];
    if (!def) return;
    const ax = anchor % MAP_W;
    const ay = (anchor - ax) / MAP_W;
    const w = def.w * TILE;
    const h = def.h * TILE;
    const colors = skin.service[t.building] || FALLBACK_SERVICE;
    g.save();
    g.translate(ax * TILE, ay * TILE);
    g.fillStyle = colors.base;
    g.fillRect(2, 2, w - 4, h - 4);
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    g.strokeRect(2.5, 2.5, w - 5, h - 5);
    g.fillStyle = colors.accent;
    g.strokeStyle = colors.accent;
    paintGlyph(t.building, w, h);
    if (city.servicesCut && def.cover) {
      g.fillStyle = SERVICES_CUT_SHADE;
      g.fillRect(2, 2, w - 4, h - 4);
    }
    g.restore();
  }

  /** Repaints a tile; a service footprint tile repaints the whole footprint. */
  function repaintTile(city, i) {
    const t = city.tiles[i];
    const def = t.building ? BUILDINGS[t.building] : null;
    if (def && t.anchor >= 0 && t.anchor < TILE_COUNT) {
      const ax = t.anchor % MAP_W;
      const ay = (t.anchor - ax) / MAP_W;
      for (let dy = 0; dy < def.h; dy++) {
        for (let dx = 0; dx < def.w; dx++) {
          if (ax + dx < MAP_W && ay + dy < MAP_H) paintTile(city, t.anchor + dy * MAP_W + dx);
        }
      }
      paintService(city, t.anchor);
    } else paintTile(city, i);
  }

  /** Repaints a dirty index plus the 4 neighbours of roads and water so edge masks stay right. */
  function repaintDirty(city, i) {
    if (!(i >= 0 && i < TILE_COUNT)) return;
    repaintTile(city, i);
    const t = city.tiles[i];
    if (!t.road && t.terrain !== TERRAIN.WATER) return;
    const x = i % MAP_W;
    if (x > 0) repaintTile(city, i - 1);
    if (x < MAP_W - 1) repaintTile(city, i + 1);
    if (i >= MAP_W) repaintTile(city, i - MAP_W);
    if (i < TILE_COUNT - MAP_W) repaintTile(city, i + MAP_W);
  }

  function paintAll(city) {
    for (let i = 0; i < TILE_COUNT; i++) paintTile(city, i);
    const list = city.buildings || [];
    for (let k = 0; k < list.length; k++) {
      const b = list[k];
      if (b.x >= 0 && b.y >= 0 && b.x < MAP_W && b.y < MAP_H) paintService(city, b.y * MAP_W + b.x);
    }
  }

  /** Repaints tiles whose visual key changed without a dirty mark (e.g. power lost). */
  function repaintStaleKeys(city) {
    const tiles = city.tiles;
    const cut = city.servicesCut;
    for (let i = 0; i < TILE_COUNT; i++) {
      if (bakeKeys[i] !== tileKey(tiles[i], cut)) repaintTile(city, i);
    }
  }

  /** Changes whenever derived data may have been recomputed without dirty tiles. */
  function stampOf(city) {
    const c = city.clock || {};
    return (((c.year | 0) * 13 + (c.month | 0)) * 32 + (c.day | 0)) * 64 + ((city.taxRate | 0) & 31) * 2 + (city.servicesCut ? 1 : 0);
  }

  /** Brings the bake up to date; returns true when anything was repainted. */
  function updateBake(city, stampChanged) {
    const dirty = city.dirty;
    const full = fullBake || bakedCity !== city || !dirty || dirty.all;
    let painted = full;
    if (full) paintAll(city);
    else {
      const list = dirty.tiles;
      for (let k = 0; k < list.length; k++) repaintDirty(city, list[k]);
      if (list.length || stampChanged) {
        painted = true;
        repaintStaleKeys(city);
      }
    }
    if (dirty) {
      dirty.all = false;
      dirty.tiles.length = 0;
    }
    fullBake = false;
    bakedCity = city;
    return painted;
  }

  // ------------------------------------------------------------- compose ---

  /** Updates the frame signature; returns true when the frame must be redrawn. */
  function frameChanged(city, view, stamp, blink) {
    const h = view.hover, c = view.cursor, d = view.drag;
    const hx = h ? h.x : -1, hy = h ? h.y : -1;
    const cx = c ? c.x : -1, cy = c ? c.y : -1;
    const dx0 = d ? d.x0 : -1, dy0 = d ? d.y0 : -1, dx1 = d ? d.x1 : -1, dy1 = d ? d.y1 : -1;
    const sel = view.selected == null ? -1 : view.selected;
    const changed = forceCompose || prev.camVersion !== camera.version || prev.city !== city || prev.stamp !== stamp
      || prev.tool !== view.tool || prev.overlay !== view.overlay || prev.hx !== hx || prev.hy !== hy
      || prev.cx !== cx || prev.cy !== cy || prev.dx0 !== dx0 || prev.dy0 !== dy0 || prev.dx1 !== dx1 || prev.dy1 !== dy1
      || prev.ghost !== view.ghost || prev.selected !== sel || prev.reduced !== view.reducedMotion || prev.blink !== blink;
    if (changed) {
      prev.camVersion = camera.version; prev.city = city; prev.stamp = stamp; prev.tool = view.tool; prev.overlay = view.overlay;
      prev.hx = hx; prev.hy = hy; prev.cx = cx; prev.cy = cy; prev.dx0 = dx0; prev.dy0 = dy0; prev.dx1 = dx1; prev.dy1 = dy1;
      prev.ghost = view.ghost; prev.selected = sel; prev.reduced = view.reducedMotion; prev.blink = blink;
      forceCompose = false;
    }
    return changed;
  }

  function fillBackground() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = skin.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  /** Dashed Chebyshev-radius square around a footprint anchored at tile (ax, ay). */
  function strokeRadius(ax, ay, def) {
    const r = def.radius;
    const x0 = (ax - r) * TILE;
    const y0 = (ay - r) * TILE;
    ctx.setLineDash([8 / camera.zoom, 6 / camera.zoom]);
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(x0, y0, (def.w + 2 * r) * TILE, (def.h + 2 * r) * TILE);
    ctx.setLineDash([]);
  }

  function drawOverlay(city, view, rect) {
    const tiles = city.tiles;
    const grids = city.grids || {};
    const landValue = grids.landValue || null;
    const pollution = grids.pollution || null;
    const overlay = view.overlay;
    const utility = overlay === 'power' || overlay === 'water';
    ctx.globalAlpha = OVERLAY_ALPHA;
    for (let y = rect.y0; y <= rect.y1; y++) {
      for (let x = rect.x0; x <= rect.x1; x++) {
        const i = y * MAP_W + x;
        const t = tiles[i];
        let style = null;
        if (utility) {
          if (t.zone !== ZONE.NONE || t.building) style = (overlay === 'power' ? t.powered : t.watered) ? OVERLAY_OK : OVERLAY_BAD;
        } else if (overlay === 'value') {
          if (landValue && t.terrain !== TERRAIN.WATER) style = VALUE_RAMP[rampIndex(landValue[i])];
        } else if (overlay === 'pollution') {
          const p = pollution ? rampIndex(pollution[i]) : 0;
          if (p > 0) style = POLLUTION_RAMP[p];
        } else if (overlay === 'block') {
          if (t.zone !== ZONE.NONE && t.block !== BLOCK.NONE) style = BLOCK_COLORS[t.block] || null;
        }
        if (style) {
          ctx.fillStyle = style;
          ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    ctx.globalAlpha = 1;
    if (utility) {
      ctx.strokeStyle = OVERLAY_OK;
      const list = city.buildings || [];
      for (let k = 0; k < list.length; k++) {
        const b = list[k];
        if (b.id === overlay && BUILDINGS[b.id]) strokeRadius(b.x, b.y, BUILDINGS[b.id]);
      }
    }
  }

  /** Blocker badge glyph (road sign / lightning / drop) in local badge coordinates 0..s. */
  function drawBadgeGlyph(block, s) {
    ctx.beginPath();
    if (block === BLOCK.POWER) {
      ctx.moveTo(s * 0.6, s * 0.1); ctx.lineTo(s * 0.3, s * 0.55); ctx.lineTo(s * 0.5, s * 0.55);
      ctx.lineTo(s * 0.4, s * 0.9); ctx.lineTo(s * 0.72, s * 0.42); ctx.lineTo(s * 0.52, s * 0.42);
    } else if (block === BLOCK.WATER) {
      ctx.moveTo(s * 0.5, s * 0.1); ctx.lineTo(s * 0.78, s * 0.55);
      ctx.arc(s * 0.5, s * 0.62, s * 0.28, 0, Math.PI, false);
    } else {
      ctx.rect(s * 0.46, s * 0.5, s * 0.08, s * 0.42);
      ctx.moveTo(s * 0.5, s * 0.08); ctx.lineTo(s * 0.88, s * 0.3); ctx.lineTo(s * 0.5, s * 0.52); ctx.lineTo(s * 0.12, s * 0.3);
    }
    ctx.closePath();
    ctx.fill();
  }

  function drawBadges(city, rect) {
    const tiles = city.tiles;
    const s = Math.min(BADGE_SCREEN_PX / camera.zoom, TILE * 0.6);
    for (let y = rect.y0; y <= rect.y1; y++) {
      for (let x = rect.x0; x <= rect.x1; x++) {
        const t = tiles[y * MAP_W + x];
        if (t.zone === ZONE.NONE) continue;
        const b = t.block;
        if (b !== BLOCK.ROAD && b !== BLOCK.POWER && b !== BLOCK.WATER) continue;
        ctx.save();
        ctx.translate((x + 1) * TILE - s - 1, y * TILE + 1);
        ctx.fillStyle = skin.badgeBg;
        ctx.fillRect(0, 0, s, s);
        ctx.fillStyle = skin.badge;
        drawBadgeGlyph(b, s);
        ctx.restore();
      }
    }
  }

  function drawGrid(rect) {
    ctx.strokeStyle = skin.grid;
    ctx.lineWidth = 1 / camera.zoom;
    ctx.beginPath();
    const x0 = rect.x0 * TILE, x1 = (rect.x1 + 1) * TILE, y0 = rect.y0 * TILE, y1 = (rect.y1 + 1) * TILE;
    for (let x = rect.x0; x <= rect.x1 + 1; x++) {
      ctx.moveTo(x * TILE, y0);
      ctx.lineTo(x * TILE, y1);
    }
    for (let y = rect.y0; y <= rect.y1 + 1; y++) {
      ctx.moveTo(x0, y * TILE);
      ctx.lineTo(x1, y * TILE);
    }
    ctx.stroke();
  }

  function drawRadiusRings(city, view) {
    ctx.strokeStyle = skin.ghostOk;
    const tool = view.tool;
    const ghost = view.ghost;   // for 'single' tools its first tile is the (edge-clamped) footprint anchor
    if (ghost && ghost.tiles.length && toolKind(tool) === 'single' && BUILDINGS[tool]) {
      strokeRadius(ghost.tiles[0] % MAP_W, Math.floor(ghost.tiles[0] / MAP_W), BUILDINGS[tool]);
    }
    const sel = view.selected;
    if (sel != null && sel >= 0 && sel < TILE_COUNT) {
      const t = city.tiles[sel];
      const def = t.building ? BUILDINGS[t.building] : null;
      if (def && t.anchor >= 0) strokeRadius(t.anchor % MAP_W, Math.floor(t.anchor / MAP_W), def);
    }
  }

  function drawGhost(ghost) {
    const tiles = ghost.tiles;
    if (!tiles) return;
    const ok = ghost.ok || [];
    ctx.globalAlpha = GHOST_ALPHA;
    for (let k = 0; k < tiles.length; k++) {
      const i = tiles[k];
      if (!(i >= 0 && i < TILE_COUNT)) continue;
      const x = i % MAP_W;
      ctx.fillStyle = !ghost.error && ok[k] ? skin.ghostOk : skin.ghostBad;
      ctx.fillRect(x * TILE, ((i - x) / MAP_W) * TILE, TILE, TILE);
    }
    ctx.globalAlpha = 1;
  }

  /** Outline of tile (tx, ty) with a stroke `px` CSS pixels wide, drawn inside the tile. */
  function outlineTile(tx, ty, px, style) {
    const lw = px / camera.zoom;
    ctx.strokeStyle = style;
    ctx.lineWidth = lw;
    ctx.strokeRect(tx * TILE + lw / 2, ty * TILE + lw / 2, TILE - lw, TILE - lw);
  }

  function compose(city, view) {
    fillBackground();
    camera.applyTransform(ctx);
    ctx.imageSmoothingEnabled = camera.zoom < 1;
    ctx.drawImage(bake, 0, 0);
    const rect = camera.visibleTileRect();
    if (view.overlay && view.overlay !== 'none') drawOverlay(city, view, rect);
    else if (view.reducedMotion || prev.blink === 0) drawBadges(city, rect);
    if (camera.zoom >= 1.5) drawGrid(rect);
    drawRadiusRings(city, view);
    if (view.ghost) drawGhost(view.ghost);
    const sel = view.selected;
    if (sel != null && sel >= 0 && sel < TILE_COUNT) outlineTile(sel % MAP_W, Math.floor(sel / MAP_W), 2, skin.select);
    if (view.cursor) outlineTile(view.cursor.x, view.cursor.y, 3, skin.cursor);
    if (view.hover) outlineTile(view.hover.x, view.hover.y, 1, skin.select);
    ctx.strokeStyle = skin.grid;
    ctx.lineWidth = 2 / camera.zoom;
    ctx.strokeRect(0, 0, WORLD_W, WORLD_H);
  }

  // -------------------------------------------------------------- public ---

  function resize() {
    const cssW = Math.max(1, canvas.clientWidth | 0);
    const cssH = Math.max(1, canvas.clientHeight | 0);
    const raw = window.devicePixelRatio;
    const dpr = Math.min(raw > 0 ? raw : 1, 2);
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    camera.resize(cssW, cssH, dpr);
    forceCompose = true;
  }

  function setSkin(id) {
    skin = SKINS[id] || SKINS[DEFAULT_SKIN];
    invalidate();
  }

  function invalidate() {
    fullBake = true;
    forceCompose = true;
  }

  function draw(city, view, nowMs) {
    if (!city || !city.tiles || city.tiles.length !== TILE_COUNT) {
      if (forceCompose || prev.city !== null || prev.camVersion !== camera.version) {
        fillBackground();
        prev.city = null;
        prev.camVersion = camera.version;
        forceCompose = false;
      }
      return;
    }
    seed = city.seed | 0;
    const stamp = stampOf(city);
    const painted = updateBake(city, stamp !== prev.stamp || city !== prev.city);
    const blink = view.reducedMotion ? 0 : Math.floor((nowMs || 0) / BLINK_MS) & 1;
    if (!frameChanged(city, view, stamp, blink) && !painted) return;
    compose(city, view);
  }

  return { resize, setSkin, draw, invalidate };
}
