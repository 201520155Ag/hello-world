/**
 * Camera: pan/zoom state plus screen <-> world <-> tile conversions.
 *
 * Screen coordinates are CSS pixels relative to the canvas top-left. World
 * coordinates are map pixels at zoom 1 (`TILE` px per tile, (0,0) at the
 * top-left corner of tile (0,0)). The camera stores the world point shown at
 * the viewport centre, so zooming never drifts with viewport size.
 * @module camera
 */
import { MAP_W, MAP_H, TILE, BALANCE } from './data.js';

const WORLD_W = MAP_W * TILE;
const WORLD_H = MAP_H * TILE;
/** CSS px kept free around the map by `fitMap()`. */
const FIT_MARGIN = 32;

/** Returns `v` when it is a finite number, otherwise `fallback`. */
function finite(v, fallback) {
  return Number.isFinite(v) ? v : fallback;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * @typedef {object} Camera
 * @property {number} x        World px at the viewport centre (horizontal).
 * @property {number} y        World px at the viewport centre (vertical).
 * @property {number} zoom     Scale, `BALANCE.ZOOM_MIN..ZOOM_MAX`, initially 1.
 * @property {number} vw       Viewport width in CSS px.
 * @property {number} vh       Viewport height in CSS px.
 * @property {number} dpr      Device pixel ratio in use (capped at 2 by the renderer).
 * @property {number} version  Incremented on every change; a cheap dirty check for render.
 * @property {(cssW:number, cssH:number, dpr:number) => void} resize
 * @property {(dxScreen:number, dyScreen:number) => void} panBy     Centre moves by −d/zoom.
 * @property {(factor:number, sx:number, sy:number) => void} zoomAt  Multiplies zoom; screen point (sx,sy) stays over the same world point.
 * @property {(z:number, sx:number, sy:number) => void} setZoom     Absolute variant of `zoomAt`.
 * @property {(tx:number, ty:number) => void} centerOn               Centres on the middle of tile (tx,ty).
 * @property {() => void} fitMap                                     Zooms so the whole map fits (within zoom limits) and centres it.
 * @property {(wx:number, wy:number) => {x:number,y:number}} worldToScreen
 * @property {(sx:number, sy:number) => {x:number,y:number}} screenToWorld
 * @property {(sx:number, sy:number) => ({x:number,y:number}|null)} screenToTile  Null outside the map.
 * @property {(tx:number, ty:number) => {x:number,y:number,size:number}} tileToScreen  Top-left CSS px of a tile and its on-screen size.
 * @property {() => {x0:number,y0:number,x1:number,y1:number}} visibleTileRect  Inclusive tile range, clamped to the map.
 * @property {(ctx:CanvasRenderingContext2D) => void} applyTransform  Sets the world→device transform on a 2D context.
 */

/**
 * Creates a camera centred on the map at zoom 1 with a 1×1 viewport; call
 * `resize()` before using any conversion.
 * @returns {Camera}
 */
export function createCamera() {
  const cam = {
    x: WORLD_W / 2,
    y: WORLD_H / 2,
    zoom: 1,
    vw: 1,
    vh: 1,
    dpr: 1,
    version: 0,
    resize,
    panBy,
    zoomAt,
    setZoom,
    centerOn,
    fitMap,
    worldToScreen,
    screenToWorld,
    screenToTile,
    tileToScreen,
    visibleTileRect,
    applyTransform,
  };

  /** Repairs NaN, clamps zoom and keeps the centre inside the map, then bumps `version`. */
  function commit() {
    cam.zoom = clamp(finite(cam.zoom, 1), BALANCE.ZOOM_MIN, BALANCE.ZOOM_MAX);
    cam.x = clamp(finite(cam.x, WORLD_W / 2), 0, WORLD_W);
    cam.y = clamp(finite(cam.y, WORLD_H / 2), 0, WORLD_H);
    cam.version += 1;
  }

  function resize(cssW, cssH, dpr) {
    cam.vw = Math.max(1, finite(cssW, cam.vw));
    cam.vh = Math.max(1, finite(cssH, cam.vh));
    cam.dpr = Math.max(0.1, finite(dpr, cam.dpr));
    commit();
  }

  function panBy(dxScreen, dyScreen) {
    cam.x -= finite(dxScreen, 0) / cam.zoom;
    cam.y -= finite(dyScreen, 0) / cam.zoom;
    commit();
  }

  function zoomAt(factor, sx, sy) {
    const f = finite(factor, 1);
    if (f <= 0) return;
    const px = finite(sx, cam.vw / 2);
    const py = finite(sy, cam.vh / 2);
    const anchor = screenToWorld(px, py);
    const z = clamp(cam.zoom * f, BALANCE.ZOOM_MIN, BALANCE.ZOOM_MAX);
    // Solve screenToWorld(px, py) === anchor for the new centre at zoom z.
    cam.zoom = z;
    cam.x = anchor.x - (px - cam.vw / 2) / z;
    cam.y = anchor.y - (py - cam.vh / 2) / z;
    commit();
  }

  function setZoom(z, sx, sy) {
    const target = finite(z, cam.zoom);
    if (target <= 0) return;
    zoomAt(target / cam.zoom, sx, sy);
  }

  function centerOn(tx, ty) {
    cam.x = (finite(tx, MAP_W / 2) + 0.5) * TILE;
    cam.y = (finite(ty, MAP_H / 2) + 0.5) * TILE;
    commit();
  }

  function fitMap() {
    const fit = Math.min((cam.vw - FIT_MARGIN) / WORLD_W, (cam.vh - FIT_MARGIN) / WORLD_H);
    cam.zoom = clamp(fit, BALANCE.ZOOM_MIN, BALANCE.ZOOM_MAX);
    cam.x = WORLD_W / 2;
    cam.y = WORLD_H / 2;
    commit();
  }

  function worldToScreen(wx, wy) {
    return { x: (wx - cam.x) * cam.zoom + cam.vw / 2, y: (wy - cam.y) * cam.zoom + cam.vh / 2 };
  }

  function screenToWorld(sx, sy) {
    return { x: cam.x + (sx - cam.vw / 2) / cam.zoom, y: cam.y + (sy - cam.vh / 2) / cam.zoom };
  }

  function screenToTile(sx, sy) {
    const w = screenToWorld(sx, sy);
    const tx = Math.floor(w.x / TILE);
    const ty = Math.floor(w.y / TILE);
    // NaN fails both comparisons, so bad input also yields null.
    if (!(tx >= 0 && tx < MAP_W && ty >= 0 && ty < MAP_H)) return null;
    return { x: tx, y: ty };
  }

  function tileToScreen(tx, ty) {
    const s = worldToScreen(tx * TILE, ty * TILE);
    return { x: s.x, y: s.y, size: TILE * cam.zoom };
  }

  function visibleTileRect() {
    const tl = screenToWorld(0, 0);
    const br = screenToWorld(cam.vw, cam.vh);
    return {
      x0: clamp(Math.floor(tl.x / TILE), 0, MAP_W - 1),
      y0: clamp(Math.floor(tl.y / TILE), 0, MAP_H - 1),
      x1: clamp(Math.ceil(br.x / TILE) - 1, 0, MAP_W - 1),
      y1: clamp(Math.ceil(br.y / TILE) - 1, 0, MAP_H - 1),
    };
  }

  function applyTransform(ctx) {
    const s = cam.dpr * cam.zoom;
    ctx.setTransform(s, 0, 0, s, cam.dpr * (cam.vw / 2 - cam.x * cam.zoom), cam.dpr * (cam.vh / 2 - cam.y * cam.zoom));
  }

  return cam;
}
