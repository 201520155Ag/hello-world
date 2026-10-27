/**
 * Input: turns Pointer Events (mouse, touch, pen), the wheel and the keyboard
 * into tool callbacks and camera calls (§3.5). Never touches `city`.
 *
 * Gesture model: the first pointer owns a "gesture" that is either a paint
 * (line/rect tools: drag start/move/end) or a press (tap, pan, long press,
 * right-click cancel). A second touch pointer cancels the gesture and switches
 * to two-finger pan + pinch until every pointer is lifted.
 */
import { BALANCE, MAP_W, MAP_H, TILE, toolKind } from './data.js';

/** Mouse pointer-downs arriving this soon after a touch are dropped (touch/mouse double-fire guard). */
const TOUCH_MOUSE_GUARD_MS = 500;
const PAINT_KINDS = new Set(['line', 'rect']);
const TOOL_KEYS = Object.freeze({ r: 'road', b: 'bulldoze', i: 'inspect' });
const PAN_KEYS = Object.freeze({ w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0] });
const ARROW_KEYS = Object.freeze({ ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] });

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} camera Camera from `createCamera`
 * @param {{ getTool(): string, onHover(t: {x:number,y:number}|null): void, onTap(x:number,y:number): void,
 *   onLongPress(x:number,y:number): void, onDrag(phase:string,x0:number,y0:number,x1:number,y1:number): void,
 *   onCommand(cmd: object): void, onCameraChange(): void }} handlers
 * @returns {{ update(dtMs:number): void, setEnabled(on:boolean): void, cancelPaint(): void, destroy(): void }}
 */
export function createInput(canvas, camera, handlers) {
  let enabled = false;
  /** @type {Map<number, {x:number,y:number,type:string}>} active pointers (CSS px, canvas-relative) */
  const pointers = new Map();
  /** @type {object|null} single-pointer gesture, see `beginGesture` */
  let gesture = null;
  /** @type {{a:number,b:number,dist:number,mx:number,my:number,ended:boolean}|null} two-finger pan/pinch */
  let pinch = null;
  let lastHover = null;
  let lastTouchMs = -Infinity;
  const held = new Set();

  canvas.style.touchAction = 'none';

  /* ---------------------------------------------------------------- helpers */

  function screenPos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Tile under a screen point, snapped to the nearest border tile when outside the map. */
  function clampedTile(sx, sy) {
    const w = camera.screenToWorld(sx, sy);
    const clamp = (v, max) => Math.min(max, Math.max(0, Number.isFinite(v) ? Math.floor(v / TILE) : 0));
    return { x: clamp(w.x, MAP_W - 1), y: clamp(w.y, MAP_H - 1) };
  }

  function setHover(tile) {
    const same = tile === lastHover || (tile && lastHover && tile.x === lastHover.x && tile.y === lastHover.y);
    if (same) return;
    lastHover = tile;
    handlers.onHover(tile);
  }

  function clearLongPress() {
    if (gesture?.timer) {
      clearTimeout(gesture.timer);
      gesture.timer = 0;
    }
  }

  function dragCancel(g) {
    handlers.onDrag('cancel', g.tile.x, g.tile.y, g.last.x, g.last.y);
  }

  /** Ends the live gesture without applying it (open paints are cancelled). */
  function cancelGesture() {
    if (!gesture) return;
    clearLongPress();
    if (gesture.paint && !gesture.done) dragCancel(gesture);
    gesture = null;
  }

  /** Cancels only a live paint: a tool change mid-drag must not apply the new tool to the old shape. */
  function cancelPaint() {
    if (gesture?.paint) cancelGesture();
  }

  /* ---------------------------------------------------------------- pointers */

  function beginGesture(e, p) {
    const tile = camera.screenToTile(p.x, p.y);
    const primary = e.button === 0;
    const paint = primary && tile !== null && PAINT_KINDS.has(toolKind(handlers.getTool()));
    gesture = {
      id: e.pointerId, button: e.button, paint, tile, last: tile,
      startX: p.x, startY: p.y, lastX: p.x, lastY: p.y, startMs: e.timeStamp,
      moved: false, done: false, timer: 0,
    };
    if (paint) handlers.onDrag('start', tile.x, tile.y, tile.x, tile.y);
    if (primary && tile) gesture.timer = setTimeout(onLongPress, BALANCE.LONG_PRESS_MS);
  }

  function onLongPress() {
    const g = gesture;
    if (!g || g.moved || g.done) return;
    g.timer = 0;
    g.done = true;
    if (g.paint) dragCancel(g);
    handlers.onLongPress(g.tile.x, g.tile.y);
  }

  function beginPinch(aId, bId) {
    cancelGesture();
    const a = pointers.get(aId), b = pointers.get(bId);
    pinch = { a: aId, b: bId, dist: Math.hypot(b.x - a.x, b.y - a.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, ended: false };
    setHover(null);
  }

  function onPointerDown(e) {
    if (!enabled) return;
    if (e.pointerType === 'mouse' && e.timeStamp - lastTouchMs < TOUCH_MOUSE_GUARD_MS) return;
    if (e.pointerType === 'touch') lastTouchMs = e.timeStamp;
    e.preventDefault();
    canvas.focus({ preventScroll: true });
    const p = screenPos(e);
    pointers.set(e.pointerId, { x: p.x, y: p.y, type: e.pointerType });
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released: moves still arrive while over the canvas */
    }
    if (pointers.size === 1) {
      cancelGesture();
      pinch = null;
      beginGesture(e, p);
    } else if (pointers.size === 2 && !pinch && e.pointerType === 'touch') {
      const other = [...pointers.keys()].find((id) => id !== e.pointerId);
      if (pointers.get(other).type === 'touch') beginPinch(other, e.pointerId);
    }
  }

  function onPointerMove(e) {
    if (!enabled) return;
    const p = screenPos(e);
    const tracked = pointers.get(e.pointerId);
    if (tracked) {
      tracked.x = p.x;
      tracked.y = p.y;
    }
    if (pinch) {
      if (!pinch.ended && (e.pointerId === pinch.a || e.pointerId === pinch.b)) movePinch();
      return;
    }
    if (gesture && gesture.id === e.pointerId) moveGesture(gesture, p);
    setHover(camera.screenToTile(p.x, p.y));
  }

  function movePinch() {
    const a = pointers.get(pinch.a), b = pointers.get(pinch.b);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (pinch.dist > 1 && dist > 1) camera.zoomAt(dist / pinch.dist, mx, my);
    camera.panBy(mx - pinch.mx, my - pinch.my);
    pinch.dist = dist;
    pinch.mx = mx;
    pinch.my = my;
    handlers.onCameraChange();
  }

  function moveGesture(g, p) {
    if (g.done) return;
    if (!g.moved && Math.hypot(p.x - g.startX, p.y - g.startY) > BALANCE.TAP_PX) {
      g.moved = true;
      clearLongPress();
    }
    if (g.paint) {
      const t = clampedTile(p.x, p.y);
      if (t.x !== g.last.x || t.y !== g.last.y) {
        g.last = t;
        handlers.onDrag('move', g.tile.x, g.tile.y, t.x, t.y);
      }
    } else if (g.moved) {
      camera.panBy(p.x - g.lastX, p.y - g.lastY);
      handlers.onCameraChange();
    }
    if (g.moved) {
      g.lastX = p.x;
      g.lastY = p.y;
    }
  }

  function onPointerUp(e) {
    if (!enabled || !pointers.has(e.pointerId)) return;
    const type = pointers.get(e.pointerId).type;
    pointers.delete(e.pointerId);
    if (type === 'touch') lastTouchMs = e.timeStamp;
    if (pinch) {
      // The pinch owns the rest of this touch: a remaining finger must not start a paint. Only one
      // of its own two fingers ends it; a stray third touch (palm, fingertip) lifting is ignored.
      if (e.pointerId === pinch.a || e.pointerId === pinch.b) pinch.ended = true;
      if (pointers.size === 0) pinch = null;
    } else if (gesture && gesture.id === e.pointerId) {
      endGesture(gesture, e.type === 'pointerup', e.timeStamp);
      gesture = null;
    }
    if (type === 'touch') setHover(null);
  }

  function endGesture(g, completed, nowMs) {
    clearLongPress();
    if (g.done) return;
    if (!completed) {
      if (g.paint) dragCancel(g);
    } else if (g.paint) {
      // g.last is the tile the last onDrag('move') previewed (moveGesture tracks tile changes even for
      // sub-TAP_PX movement), so the applied shape always equals the ghost the player saw.
      handlers.onDrag('end', g.tile.x, g.tile.y, g.last.x, g.last.y);
    } else if (!g.moved && g.button === 2) {
      handlers.onCommand({ type: 'cancel' });
    } else if (!g.moved && g.button === 0 && g.tile && nowMs - g.startMs < BALANCE.TAP_MS) {
      handlers.onTap(g.tile.x, g.tile.y);
    }
  }

  function onPointerLeave(e) {
    if (enabled && !pointers.has(e.pointerId)) setHover(null);
  }

  function onWheel(e) {
    if (!enabled) return;
    e.preventDefault();
    if (!e.deltaY) return;
    const p = screenPos(e);
    camera.zoomAt(e.deltaY < 0 ? BALANCE.ZOOM_STEP : 1 / BALANCE.ZOOM_STEP, p.x, p.y);
    handlers.onCameraChange();
    if (!pinch) setHover(camera.screenToTile(p.x, p.y));
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  /**
   * A tap is handled on pointerup, which may open a panel; the click the browser then synthesizes
   * would be hit-tested against the new layout and land on that panel. The canvas has no click
   * handlers, so cancelling touchend's default actions loses nothing.
   */
  function onTouchEnd(e) {
    if (enabled && e.cancelable) e.preventDefault();
  }

  /* ---------------------------------------------------------------- keyboard */

  function focusInField() {
    const el = document.activeElement;
    return Boolean(el && (el.matches('input, select, textarea') || el.isContentEditable));
  }

  /** Space/Enter activate a focused control; the game must not react to them as well. */
  function focusOnControl() {
    const el = document.activeElement;
    return Boolean(el && el.matches('button, a[href], summary, [role="button"]'));
  }

  /** Arrow keys inside a tab list switch tabs (ui.js); they must not move the map cursor too. */
  function focusInTabList() {
    const el = document.activeElement;
    return Boolean(el && el.closest('[role="tablist"]'));
  }

  /** While the confirm <dialog> is modal, every key belongs to it (Esc = its native cancel). */
  const modalOpen = () => document.querySelector('dialog[open]') !== null;

  function zoomStep(factor) {
    camera.zoomAt(factor, camera.vw / 2, camera.vh / 2);
    handlers.onCameraChange();
  }

  /**
   * Shortcut name for a key event: lower-case ASCII letters and other single characters come from
   * e.key; when the active layout yields a non-Latin letter (Cyrillic 'к', Hebrew 'ר'…) the
   * physical key (e.code 'KeyR' → 'r') is used instead, so R/Z/B/I/O/H/WASD work in every layout.
   * @param {KeyboardEvent} e
   * @returns {string}
   */
  function shortcutKey(e) {
    if (e.key.length === 1 && /[a-z]/i.test(e.key)) return e.key.toLowerCase();
    if (/^Key[A-Z]$/.test(e.code)) return e.code[3].toLowerCase();
    return e.key;
  }

  /** @returns {boolean} whether the key was handled (→ preventDefault) */
  function handleKey(e) {
    const key = shortcutKey(e);
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey && key === 's') {
      handlers.onCommand({ type: 'save' });
      return true;
    }
    if (mod || e.altKey) return false;
    if (key in PAN_KEYS) {
      held.add(key);
      return true;
    }
    if (key in ARROW_KEYS) {
      if (focusInTabList()) return false;
      const [dx, dy] = ARROW_KEYS[key];
      handlers.onCommand({ type: 'cursorMove', dx, dy });
      return true;
    }
    if (key in TOOL_KEYS) {
      cancelPaint();
      handlers.onCommand({ type: 'tool', tool: TOOL_KEYS[key] });
      return true;
    }
    switch (key) {
      case 'z': cancelPaint(); handlers.onCommand({ type: 'zoneCycle' }); return true;
      case 'o': handlers.onCommand({ type: 'overlayCycle' }); return true;
      case 'h': case '?': handlers.onCommand({ type: 'help' }); return true;
      case '1': case '2': case '3': handlers.onCommand({ type: 'speed', speed: Number(key) }); return true;
      case '+': case '=': zoomStep(BALANCE.ZOOM_STEP); return true;
      case '-': zoomStep(1 / BALANCE.ZOOM_STEP); return true;
      case 'Escape':
        cancelGesture();
        handlers.onCommand({ type: 'cancel' });
        return true;
      case ' ':
        if (focusOnControl()) return false;
        handlers.onCommand({ type: 'pause' });
        return true;
      case 'Enter':
        if (focusOnControl()) return false;
        handlers.onCommand({ type: 'cursorApply' });
        return true;
      default: return false;
    }
  }

  function onKeyDown(e) {
    if (!enabled || typeof e.key !== 'string' || e.isComposing || focusInField() || modalOpen()) return;
    if (handleKey(e)) e.preventDefault();
  }

  function onKeyUp(e) {
    if (typeof e.key === 'string') held.delete(shortcutKey(e));
  }

  function onBlur() {
    held.clear();
  }

  /* ---------------------------------------------------------------- lifecycle */

  const listeners = [
    [canvas, 'pointerdown', onPointerDown], [canvas, 'pointermove', onPointerMove],
    [canvas, 'pointerup', onPointerUp], [canvas, 'pointercancel', onPointerUp],
    [canvas, 'pointerleave', onPointerLeave], [canvas, 'wheel', onWheel, { passive: false }],
    [canvas, 'contextmenu', onContextMenu], [canvas, 'touchend', onTouchEnd, { passive: false }],
    [window, 'keydown', onKeyDown], [window, 'keyup', onKeyUp], [window, 'blur', onBlur],
  ];
  for (const [target, type, fn, opts] of listeners) target.addEventListener(type, fn, opts);

  /** Applies held WASD panning at KEY_PAN_SPEED px/s; call once per frame. */
  function update(dtMs) {
    if (!enabled || held.size === 0 || !Number.isFinite(dtMs)) return;
    let dx = 0, dy = 0;
    for (const k of held) {
      dx += PAN_KEYS[k][0];
      dy += PAN_KEYS[k][1];
    }
    if (!dx && !dy) return;
    const step = BALANCE.KEY_PAN_SPEED * dtMs / 1000;
    camera.panBy(-dx * step, -dy * step);
    handlers.onCameraChange();
  }

  /** Enables or disables all input; disabling cancels any live gesture and clears hover. */
  function setEnabled(on) {
    enabled = Boolean(on);
    if (enabled) return;
    cancelGesture();
    pinch = null;
    pointers.clear();
    held.clear();
    setHover(null);
  }

  /** Removes every listener and timer. */
  function destroy() {
    setEnabled(false);
    for (const [target, type, fn, opts] of listeners) target.removeEventListener(type, fn, opts);
  }

  return { update, setEnabled, cancelPaint, destroy };
}
