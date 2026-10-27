/**
 * Main City — entry point (integrator). Owns `city` and `view`, runs the frame loop
 * (requestAnimationFrame + fixed-step sim ticks inside `sim.advance`), and wires
 * input → tools → sim, sim → render/ui, save/autosave, the landing flow, URL-hash
 * city loading and language initialisation (DESIGN.md §3.9).
 */
import { MAP_W, MAP_H, SKINS, OVERLAY_ORDER, TOOL_ORDER, TOOL, ERR, BALANCE, idx, xyOf, toolKind, cycleZoneTool } from './data.js';
import * as sim from './sim.js';
import { createCamera } from './camera.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { createUI } from './ui.js';
import { detectLang, setLang, getLang, applyDom, formatMoney } from './i18n.js';
import {
  KEYS, saveLocal, loadLocal, hasLocal, metaOf, newestLocalKey, loadSettings, saveSettings,
  encodeShare, decodeShare, shareUrl, codeFromHash, clearHash,
} from './save.js';

const UI_INTERVAL_MS = 100;        // HUD refresh period while playing (≤ 10 Hz)
const DEFAULT_NAME = 'Main City';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// State owned by main

const settings = loadSettings();
/** @type {import('./data.js').City|null} */
let city = null;
let sharedCode = codeFromHash(location.hash);
let badgeAt = null;               // tile the price badge is anchored to
let lastFrame = 0, lastUi = 0;

const reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const view = {
  playing: false, tool: TOOL.PAN, overlay: 'none',
  hover: null, cursor: null, drag: null, ghost: null, selected: null,
  reducedMotion: reducedMotionQuery.matches,
};

// 1. Language before any DOM text is produced (createUI translates on construction).
setLang(detectLang(location.search, settings.lang, navigator.language));
applyDom(document);

// 2. Canvas, camera, renderer.
const canvas = document.getElementById('game-canvas');
const camera = createCamera();
const renderer = createRenderer(canvas, camera);

// ---------------------------------------------------------------------------
// Helpers shared by api and handlers

function updateUi() { if (city) ui.update(city, view); }

/** Positions the DOM price badge next to `badgeAt` (or hides it when the ghost is free). */
function placeBadge() {
  const g = view.ghost;
  if (!g || !g.cost || !badgeAt) { ui.setPriceBadge(0, 0, null); return; }
  const s = camera.tileToScreen(badgeAt.x, badgeAt.y);
  ui.setPriceBadge(s.x + s.size, s.y, formatMoney(g.cost));
}

/** Recomputes the ghost preview for the live drag, else the hover tile, else the keyboard cursor. */
function refreshGhost() {
  view.ghost = null;
  badgeAt = null;
  if (city && toolKind(view.tool) !== 'pan') {
    const d = view.drag;
    const at = d ? { x: d.x1, y: d.y1 } : (view.hover ?? view.cursor);
    if (at) {
      const tiles = d ? sim.toolTiles(city, view.tool, d.x0, d.y0, d.x1, d.y1)
        : sim.toolTiles(city, view.tool, at.x, at.y, at.x, at.y);
      view.ghost = sim.preview(city, view.tool, tiles);
      badgeAt = at;
    }
  }
  placeBadge();
}

/** Applies the current tool to `tiles`; toasts the reason when a single-tile action fails. */
function applyAt(tiles) {
  if (!city || !tiles.length) return;
  const r = sim.applyTool(city, view.tool, tiles);
  if (!r.ok && (tiles.length === 1 || r.error !== ERR.NOTHING)) {
    // err.money quotes the floor via {n} so it is grouped like the HUD cash figure in every locale.
    ui.toast(r.error, r.error === ERR.MONEY ? { n: formatMoney(BALANCE.BUILD_FLOOR) } : {}, 'warn');
  }
  refreshGhost();
  updateUi();
}

/** Tool/select action at a single tile (taps and the keyboard cursor). */
function actAt(x, y) {
  if (toolKind(view.tool) === 'pan') api.select(idx(x, y));
  else applyAt(sim.toolTiles(city, view.tool, x, y, x, y));
}

function moveCursor(dx, dy) {
  const base = view.cursor ?? camera.screenToTile(camera.vw / 2, camera.vh / 2) ?? { x: MAP_W >> 1, y: MAP_H >> 1 };
  const c = { x: clamp(base.x + dx, 0, MAP_W - 1), y: clamp(base.y + dy, 0, MAP_H - 1) };
  view.cursor = c;
  const s = camera.tileToScreen(c.x, c.y);
  if (s.x < 0 || s.y < 0 || s.x + s.size > camera.vw || s.y + s.size > camera.vh) camera.centerOn(c.x, c.y);
  refreshGhost();
}

/** Writes the autosave slot unless the city is an unedited shared one (§1.15). */
function autosave() {
  if (view.playing && city && !city.fromLink) saveLocal(KEYS.AUTOSAVE, city);
}

/**
 * Makes `c` the live city: derived data, skin, camera, view reset, input on, landing off.
 * @param {object} c City from sim.createCity or save.deserialize
 * @param {boolean} fromLink true for shared/imported cities (no autosave until edited)
 * @param {string} toastKey welcome message key
 */
function startCity(c, fromLink, toastKey) {
  city = c;
  city.skin = SKINS[city.skin] ? city.skin : settings.skin;
  sim.recomputeDerived(city);
  city.dirty.all = true;
  city.fromLink = fromLink;
  camera.fitMap();
  renderer.setSkin(city.skin);
  ui.applySkin(city.skin);
  Object.assign(view, { playing: true, tool: TOOL.PAN, hover: null, cursor: null, drag: null, ghost: null, selected: null });
  badgeAt = null;
  input.setEnabled(true);
  ui.openPanel(null);
  ui.hideLanding();
  ui.update(city, view);
  ui.toast(toastKey, { name: city.name });
}

/** Loads a share code/link into the game; returns whether it was valid. */
function openCode(text) {
  const r = decodeShare(text);
  if (r.ok) startCity(r.city, true, 'share.loaded');
  return r.ok;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GameApi used by ui.js (§3.8)

const api = {
  newCity({ name } = {}) {
    const seed = (Math.random() * 2 ** 32) >>> 0;
    startCity(sim.createCity({ name: name || DEFAULT_NAME, seed, skin: settings.skin }), false, 'toast.welcome');
  },
  continueCity() {
    const key = newestLocalKey();
    const r = key ? loadLocal(key) : { ok: false, error: 'save.none' };
    if (r.ok) startCity(r.city, false, 'save.loaded');
    else ui.toast(r.error, {}, 'error');
  },
  loadShared() {
    if (openCode(sharedCode)) { clearHash(); sharedCode = null; } else ui.toast('share.invalid', {}, 'error');
  },
  setTool(tool) {
    if (!TOOL_ORDER.includes(tool)) return;
    input.cancelPaint();   // a toolbar click mid-drag must not apply the new tool to the old shape
    view.tool = tool;
    view.drag = null;
    refreshGhost();
    updateUi();
  },
  setSpeed(n) { if (city) { sim.setSpeed(city, n); updateUi(); } },
  togglePause() { if (city) { sim.togglePause(city); updateUi(); } },
  setTax(n) { if (city) { sim.setTaxRate(city, n); updateUi(); } },
  setSkin(id) {
    if (!SKINS[id]) return;
    if (city) city.skin = id;
    settings.skin = id;
    saveSettings({ skin: id });
    renderer.setSkin(id);
    ui.applySkin(id);
  },
  setLang(id) {
    setLang(id);
    settings.lang = getLang();
    saveSettings({ lang: settings.lang });
    ui.relabel();
  },
  setOverlay(id) {
    if (OVERLAY_ORDER.includes(id)) view.overlay = id;
    updateUi();
  },
  zoomBy(factor) { camera.zoomAt(factor, camera.vw / 2, camera.vh / 2); placeBadge(); },
  centerMap() { camera.fitMap(); placeBadge(); },
  select(i) {
    view.selected = Number.isInteger(i) ? i : null;
    ui.openPanel(view.selected === null ? null : 'inspector');
    updateUi();
  },
  save() {
    if (!city) return;
    if (saveLocal(KEYS.MANUAL, city)) ui.toast('save.saved');
    else ui.toast('save.failed', {}, 'error');
  },
  async load() {
    if (!hasLocal(KEYS.MANUAL)) { ui.toast('save.none', {}, 'warn'); return; }
    if (!(await ui.confirm('save.confirmLoad'))) return;
    const r = loadLocal(KEYS.MANUAL);
    if (r.ok) startCity(r.city, false, 'save.loaded');
    else ui.toast(r.error, {}, 'error');
  },
  exportCode() { return city ? encodeShare(city) : ''; },
  importCode(text) { return openCode(text); },
  copyCode() { return city ? copyText(encodeShare(city)) : Promise.resolve(false); },
  copyLink() { return city ? copyText(shareUrl(encodeShare(city), getLang())) : Promise.resolve(false); },
  getCity() { return city; },
  getView() { return view; },
};

// 3. DOM shell.
const ui = createUI(api);
ui.applySkin(settings.skin);
renderer.setSkin(settings.skin);

// ---------------------------------------------------------------------------
// Input handlers (§3.5)

const handlers = {
  getTool: () => view.tool,
  onHover(tile) { view.hover = tile; refreshGhost(); },
  onTap(x, y) { if (city) actAt(x, y); },
  onLongPress(x, y) { if (city) api.select(idx(x, y)); },
  onDrag(phase, x0, y0, x1, y1) {
    if (!city) return;
    if (phase === 'start' || phase === 'move') view.drag = { x0, y0, x1, y1 };
    else {
      view.drag = null;
      if (phase === 'end') applyAt(sim.toolTiles(city, view.tool, x0, y0, x1, y1));
    }
    refreshGhost();
  },
  onCommand(cmd) {
    if (!city) return;
    switch (cmd.type) {
      case 'tool': api.setTool(cmd.tool); break;
      case 'zoneCycle': api.setTool(cycleZoneTool(view.tool)); break;
      case 'pause': api.togglePause(); break;
      case 'speed': api.setSpeed(cmd.speed); break;
      case 'cancel': view.drag = null; api.setTool(TOOL.PAN); api.select(null); break;
      case 'overlayCycle': api.setOverlay(OVERLAY_ORDER[(OVERLAY_ORDER.indexOf(view.overlay) + 1) % OVERLAY_ORDER.length]); break;
      case 'help': ui.openPanel(ui.isPanelOpen('help') ? null : 'help'); break;
      case 'cursorMove': moveCursor(cmd.dx, cmd.dy); break;
      case 'cursorApply': if (view.cursor) actAt(view.cursor.x, view.cursor.y); break;
      case 'save': api.save(); break;
      default: break;
    }
  },
  onCameraChange() { placeBadge(); },
};

// 4. Input (enabled once a city starts).
const input = createInput(canvas, camera, handlers);
input.setEnabled(false);

// 5. Keep the backing store in sync with the canvas's CSS size (renderer.draw itself follows
//    devicePixelRatio changes). Resize and redraw in the same task: reassigning canvas.width clears
//    the bitmap, and a ResizeObserver callback runs after this frame's rAF, so leaving the repaint to
//    the next frame would present one blank frame on every panel open/close and window resize.
function syncCanvas() {
  renderer.resize();
  renderer.draw(view.playing ? city : null, view, performance.now());
}
if (typeof ResizeObserver === 'function') new ResizeObserver(syncCanvas).observe(canvas);
else window.addEventListener('resize', syncCanvas);
syncCanvas();

// 6. Landing.
const newestKey = newestLocalKey();
ui.showLanding({ meta: newestKey ? metaOf(newestKey) : null, hasShared: Boolean(sharedCode) });

// 7. Autosave when the page is hidden or left; errors become a toast.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosave(); });
window.addEventListener('pagehide', autosave);
window.addEventListener('error', () => ui.toast('err.unexpected', {}, 'error'));
window.addEventListener('unhandledrejection', () => ui.toast('err.unexpected', {}, 'error'));
reducedMotionQuery.addEventListener('change', (e) => { view.reducedMotion = e.matches; });

if (/[?&]debug=1(&|$)/.test(location.search)) window.MC = { city: () => city, sim, view };

// ---------------------------------------------------------------------------
// Sim events → toasts/autosave (§3.9 handleEvent)

function handleEvent(e) {
  switch (e.type) {
    case 'month': autosave(); break;
    case 'firstHouse': ui.toast('toast.firstHouse'); break;
    case 'fire': ui.toast('toast.fire', xyOf(e.i), 'warn'); break;
    case 'debt': case 'servicesCut': ui.toast(`toast.${e.type}`, {}, 'warn'); break;
    case 'debtCleared': case 'servicesRestored': ui.toast(`toast.${e.type}`); break;
    case 'powerShort': case 'waterShort': if (e.on) ui.toast(`toast.${e.type}`, {}, 'warn'); break;
    default: break;   // grow / decline: visible on the map already
  }
}

// 8. Frame loop: input → sim → render → HUD (§6).
function loop(now) {
  const dt = Math.min(now - lastFrame, BALANCE.FRAME_DT_CLAMP);
  lastFrame = now;
  input.update(dt);
  if (view.playing) for (const e of sim.advance(city, dt)) handleEvent(e);
  renderer.draw(view.playing ? city : null, view, now);
  if (view.playing && now - lastUi >= UI_INTERVAL_MS) { ui.update(city, view); lastUi = now; }
  requestAnimationFrame(loop);
}
lastFrame = performance.now();
requestAnimationFrame(loop);
