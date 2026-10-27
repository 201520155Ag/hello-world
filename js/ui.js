/**
 * Main City — DOM shell (owner C): landing, HUD, toolbar, panels, toasts, confirm dialog, skin CSS variables.
 * Reads `city`/`view` to render and never mutates them; every change goes through `api` (GameApi, spec §3.8).
 */
import {
  TOOL_ORDER, TOOL_KEY, TOOL_ZONE, BUILDINGS, ZONE_LEVELS, ZONE_ORDER, COVER, BLOCK, BLOCK_COLORS,
  SKINS, SKIN_ORDER, DEFAULT_SKIN, OVERLAY_ORDER, BALANCE, xyOf,
} from './data.js';
import { LANGS, t, getLang, isRTL, applyDom, formatMoney, formatInt, monthName, formatDate } from './i18n.js';

const TOAST_MS = 3500;
const TOAST_MAX = 3;
const PANEL_IDS = Object.freeze(['inspector', 'budget', 'help', 'save']);
const SPEEDS = [0, 1, 2, 3];
const SVG_NS = 'http://www.w3.org/2000/svg';

/** 24×24 single-colour toolbar glyphs (fill-rule evenodd). */
const ICONS = Object.freeze({
  pan: 'M12 2l3 3h-2v5h5V8l3 3-3 3v-2h-5v5h2l-3 3-3-3h2v-5H6v2l-3-3 3-3v2h5V5H9z',
  inspect: 'M10 3a7 7 0 1 1 0 14a7 7 0 0 1 0-14zm0 2a5 5 0 1 0 0 10a5 5 0 0 0 0-10zm6.5 10l4.5 4.5-1.5 1.5-4.5-4.5z',
  road: 'M3 21L8.5 3h2L6 21zm15 0L13.5 3h2L21 21zM11 6h2v3h-2zm0 5h2v3h-2zm0 5h2v4h-2z',
  zone_r: 'M12 3l9 8h-3v10H6V11H3zm-2 10v6h4v-6z',
  zone_c: 'M3 3h18v4H3zm1 6h16v12H4zm4 3v4h3v-4zm5 0v4h3v-4z',
  zone_i: 'M3 21V9l5 3V9l5 3V9l5 3V4h3v17z',
  bulldoze: 'M7 13a5 5 0 1 0 .01 0zM12 3h9v2h-6.3l-3.2 6.4-1.8-.9L12.6 5H12z',
  power: 'M13 2L4 14h7l-1 8 9-12h-7z',
  water: 'M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13z',
  park: 'M12 2l6 9h-3.5l4 6H13v5h-2v-5H5.5l4-6H6z',
  police: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  fire: 'M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-10z',
  school: 'M12 4L2 9l10 5 8-4v6h2V9zM6 13v4c0 2 3 3 6 3s6-1 6-3v-4l-6 3z',
  hospital: 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6z',
});
/** Mouth paths for the approval face (viewBox 0 0 20 20). */
const MOUTH = Object.freeze({ happy: 'M6 12.5q4 4 8 0', neutral: 'M6.5 13.5h7', unhappy: 'M6 14.5q4-4 8 0' });

const $ = (id) => document.getElementById(id);
const num = (v) => (Number.isFinite(v) ? v : 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Writes only when changed, so 10 Hz updates do not churn layout. */
function setText(el, text) { if (el.textContent !== text) el.textContent = text; }
function setAttr(el, name, value) { if (el.getAttribute(name) !== value) el.setAttribute(name, value); }

function svgGlyph(d) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(path);
  return svg;
}

/**
 * Makes `ul` show exactly `lines`, reusing <li> nodes. An item may be a string or
 * `{ text, cls }` for a styled line (e.g. the inspector hint).
 */
function fillList(ul, lines) {
  while (ul.children.length > lines.length) ul.lastElementChild.remove();
  while (ul.children.length < lines.length) ul.appendChild(document.createElement('li'));
  lines.forEach((item, k) => {
    const li = ul.children[k];
    const text = typeof item === 'string' ? item : item.text;
    const cls = typeof item === 'string' ? '' : item.cls || '';
    setText(li, text);
    if (li.className !== cls) li.className = cls;
  });
}

/** Fills a <dl> with [label, value] pairs. */
function fillRows(dl, pairs) {
  while (dl.children.length > pairs.length * 2) dl.lastElementChild.remove();
  while (dl.children.length < pairs.length * 2) {
    dl.appendChild(document.createElement('dt'));
    dl.appendChild(document.createElement('dd'));
  }
  pairs.forEach(([label, value], k) => {
    setText(dl.children[k * 2], label);
    setText(dl.children[k * 2 + 1], value);
  });
}

/** Rebuilds a <select>'s options (keeping the selected value when it still exists). */
function fillSelect(select, ids, label) {
  const value = select.value;
  select.replaceChildren(...ids.map((id) => {
    const o = document.createElement('option');
    o.value = id;
    o.textContent = label(id);
    return o;
  }));
  if (ids.includes(value)) select.value = value;
}

/** Price of one use of `tool` (whole footprint for services); 0 for pan/inspect. */
function toolCost(tool) {
  if (tool === 'road') return BALANCE.ROAD_COST;
  if (TOOL_ZONE[tool]) return BALANCE.ZONE_COST;
  if (tool === 'bulldoze') return BALANCE.BULLDOZE_COST;
  return BUILDINGS[tool] ? BUILDINGS[tool].cost : 0;
}

/** Translated names of the services covering a tile, from its cover bitmask. */
function serviceNames(mask) {
  return Object.entries(COVER).filter(([, bit]) => mask & bit).map(([key]) => t(`tool.${key.toLowerCase()}`));
}

/** The hint key for a zoned tile's blocker, specialising power/water/demand per §3.8. */
function hintKey(city, tile) {
  const s = city.stats || {};
  if (tile.block === BLOCK.POWER) return num(s.powerUse) > num(s.powerCap) ? 'hint.powerCapacity' : 'hint.power';
  if (tile.block === BLOCK.WATER) return num(s.waterUse) > num(s.waterCap) ? 'hint.waterCapacity' : 'hint.water';
  if (tile.block === BLOCK.DEMAND) return `hint.demand.${tile.zone}`;
  return `hint.${tile.block}`;
}

/** Inspector lines for tile index `i` (spec §3.8). */
function inspectorLines(city, i) {
  const tile = Number.isInteger(i) ? city.tiles[i] : null;
  if (!tile) return [t('inspect.none')];
  const { x, y } = xyOf(i);
  const lines = [t('inspect.coords', { x, y })];
  const zoned = tile.zone !== 'none';
  const def = tile.building ? BUILDINGS[tile.building] : null;
  if (def) {
    lines.push(t('inspect.service', { name: t(`tool.${tile.building}`), radius: def.radius, upkeep: formatMoney(def.upkeep) }));
  } else if (tile.road) {
    lines.push(t('inspect.road'));
  } else if (zoned) {
    const zone = t(`zone.${tile.zone}`);
    const level = clamp(num(tile.level), 0, 3);
    lines.push(level === 0 ? t('inspect.lot', { zone }) : t('inspect.building', { zone, level }));
    const cap = ZONE_LEVELS[tile.zone] ? ZONE_LEVELS[tile.zone][level].cap : 0;
    lines.push(t(tile.zone === 'r' ? 'inspect.residents' : 'inspect.jobs', { n: formatInt(cap) }));
  } else {
    lines.push(t(`inspect.${tile.terrain}`));
  }
  if (tile.terrain === 'water') return lines;
  if (zoned) lines.push(t(tile.access ? 'inspect.access' : 'inspect.noAccess'));
  if (zoned || (def && def.power > 0)) lines.push(t(tile.powered ? 'inspect.powered' : 'inspect.unpowered'));
  if (zoned || (def && def.water > 0)) lines.push(t(tile.watered ? 'inspect.watered' : 'inspect.unwatered'));
  const grids = city.grids || {};
  lines.push(t('inspect.landValue', { n: num(grids.landValue && grids.landValue[i]) }));
  lines.push(t('inspect.pollution', { n: num(grids.pollution && grids.pollution[i]) }));
  const services = serviceNames(num(grids.cover && grids.cover[i]));
  lines.push(services.length ? t('inspect.services', { list: services.join(', ') }) : t('inspect.noServices'));
  if (zoned) {
    if (tile.block === BLOCK.NONE || !tile.block) {
      lines.push(t('inspect.growing'));
    } else {
      lines.push({ text: t('inspect.whyNot', { reason: t(`block.${tile.block}`) }), cls: tile.block === BLOCK.FULL ? '' : 'warn' });
      lines.push({ text: t(hintKey(city, tile)), cls: 'hint' });
    }
  }
  return lines;
}

/**
 * Wires the static DOM of index.html and returns the UI object main.js drives.
 * @param {object} api GameApi implemented by main (newCity, setTool, setTax, save, exportCode, getCity, …)
 */
export function createUI(api) {
  const el = {
    app: $('app'), landing: $('landing'), landingName: $('landing-name'), landingLang: $('landing-lang'),
    btnNew: $('btn-new'), btnContinue: $('btn-continue'), continueMeta: $('btn-continue-meta'), btnShared: $('btn-shared'),
    canvas: $('game-canvas'), stage: $('game-canvas').parentElement,
    cash: $('hud-cash'), pop: $('hud-pop'), jobs: $('hud-jobs'), approval: $('hud-approval'), mouth: $('hud-face-mouth'),
    date: $('hud-date'), rci: { r: $('rci-r'), c: $('rci-c'), i: $('rci-i') },
    speed: SPEEDS.map((n) => $(`speed-${n}`)),
    toolbar: $('toolbar'), overlay: $('overlay-select'), skin: $('skin-select'), lang: $('lang-select'),
    btnHelp: $('btn-help'), btnSavePanel: $('btn-save-panel'),
    zoomIn: $('btn-zoom-in'), zoomOut: $('btn-zoom-out'), center: $('btn-center'),
    panels: $('panels'), panelClose: $('panel-close'), tabs: [...document.querySelectorAll('.tab[data-panel]')],
    panel: Object.fromEntries(PANEL_IDS.map((id) => [id, $(`panel-${id}`)])),
    inspectorLines: $('inspector-lines'),
    taxSlider: $('tax-slider'), taxValue: $('tax-value'), budgetRows: $('budget-rows'), budgetLines: $('budget-lines'),
    historyLabel: $('budget-history-label'), spark: $('budget-spark'),
    blockerLegend: $('blocker-legend'),
    shareCode: $('share-code'), shareImport: $('share-import'), btnCopyCode: $('btn-copy-code'), btnCopyLink: $('btn-copy-link'),
    btnImport: $('btn-import'), btnSave: $('btn-save'), btnLoad: $('btn-load'), btnNewGame: $('btn-new-game'),
    debt: $('debt-banner'), badge: $('price-badge'), toasts: $('toasts'), landingToasts: $('landing-toasts'),
    confirm: $('confirm'), confirmText: $('confirm-text'),
  };
  /** @type {Map<string, HTMLButtonElement>} */
  const toolButtons = new Map();
  let openId = null;                 // currently open panel id or null
  let last = { city: null, view: null };
  let landingMeta = null;
  let sparkKey = '';                 // "history length:cash" of the last drawn sparkline
  let bannerH = '';                  // --banner-h last written to the stage (phone toasts stack below the banner)

  /** Returns keyboard focus to the map after a mouse-driven HUD action, so Space/Enter/arrows keep working. */
  const focusMap = () => el.canvas.focus({ preventScroll: true });

  // ---- toolbar -------------------------------------------------------------
  for (const tool of TOOL_ORDER) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tool';
    btn.dataset.tool = tool;
    btn.setAttribute('aria-pressed', 'false');
    btn.appendChild(svgGlyph(ICONS[tool] || ICONS.pan));
    const cost = document.createElement('span');
    cost.className = 'tool-cost';
    btn.appendChild(cost);
    btn.addEventListener('click', () => { api.setTool(tool); focusMap(); });
    el.toolbar.appendChild(btn);
    toolButtons.set(tool, btn);
  }

  function labelTool(tool, btn) {
    const cost = toolCost(tool);
    const def = BUILDINGS[tool];
    const parts = [t(`tool.${tool}`)];
    if (cost) parts.push(t('tool.cost', { n: formatMoney(cost) }));
    if (def) parts.push(t('tool.upkeep', { n: formatMoney(def.upkeep) }), t('tool.radius', { n: def.radius }));
    if (TOOL_KEY[tool]) parts.push(t('tool.key', { k: TOOL_KEY[tool] }));
    const label = parts.join(' · ');
    btn.title = label;
    btn.setAttribute('aria-label', label);
    setText(btn.lastElementChild, cost ? formatMoney(cost) : '');
  }

  // ---- header controls -----------------------------------------------------
  el.speed.forEach((btn, n) => btn.addEventListener('click', () => { if (n === 0) api.togglePause(); else api.setSpeed(n); focusMap(); }));
  el.overlay.addEventListener('change', () => api.setOverlay(el.overlay.value));
  el.skin.addEventListener('change', () => api.setSkin(el.skin.value));
  for (const sel of [el.lang, el.landingLang]) sel.addEventListener('change', () => api.setLang(sel.value));
  el.btnHelp.addEventListener('click', () => { ui.openPanel(openId === 'help' ? null : 'help'); focusMap(); });
  el.btnSavePanel.addEventListener('click', () => { ui.openPanel(openId === 'save' ? null : 'save'); focusMap(); });
  el.zoomIn.addEventListener('click', () => { api.zoomBy(BALANCE.ZOOM_STEP); focusMap(); });
  el.zoomOut.addEventListener('click', () => { api.zoomBy(1 / BALANCE.ZOOM_STEP); focusMap(); });
  el.center.addEventListener('click', () => { api.centerMap(); focusMap(); });

  // ---- panels ----------------------------------------------------------------
  for (const tab of el.tabs) tab.addEventListener('click', () => ui.openPanel(tab.dataset.panel));
  el.tabs[0].parentElement.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const k = el.tabs.indexOf(document.activeElement);
    if (k < 0) return;
    e.preventDefault();
    const forward = (e.key === 'ArrowRight') !== isRTL();   // arrows follow the visual order, which RTL reverses
    const next = el.tabs[(k + (forward ? 1 : el.tabs.length - 1)) % el.tabs.length];
    ui.openPanel(next.dataset.panel);
    next.focus();
  });
  // Chromium does not reliably scroll a newly focused tab into view when the strip overflows (long
  // es/ru labels at 320 px), which would leave the tab and its focus ring hidden; `.tablist`'s
  // scroll-padding keeps room for the ring.
  el.tabs[0].parentElement.addEventListener('focusin', (e) => {
    if (el.tabs.includes(e.target)) e.target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });
  el.panelClose.addEventListener('click', () => ui.openPanel(null));

  el.taxSlider.min = String(BALANCE.TAX_MIN);
  el.taxSlider.max = String(BALANCE.TAX_MAX);
  el.taxSlider.addEventListener('input', () => {
    const rate = clamp(Math.round(Number(el.taxSlider.value)), BALANCE.TAX_MIN, BALANCE.TAX_MAX);
    setText(el.taxValue, t('budget.tax', { n: rate }));
    api.setTax(rate);
  });

  function refreshShareCode() {
    el.shareCode.value = api.getCity() ? api.exportCode() : '';
  }
  function copyWith(promiseLike) {
    Promise.resolve(promiseLike)
      .then((ok) => ui.toast(ok ? 'share.copied' : 'share.copyFailed', {}, ok ? 'info' : 'warn'))
      .catch(() => ui.toast('share.copyFailed', {}, 'warn'));
  }
  el.btnSave.addEventListener('click', () => { api.save(); refreshShareCode(); });
  el.btnLoad.addEventListener('click', () => api.load());
  el.btnNewGame.addEventListener('click', async () => {
    if (!(await ui.confirm('save.confirmNew'))) return;
    const city = api.getCity();
    api.newCity({ name: city ? city.name : el.landingName.value.trim() });
  });
  el.btnCopyCode.addEventListener('click', () => { refreshShareCode(); copyWith(api.copyCode()); });
  el.btnCopyLink.addEventListener('click', () => copyWith(api.copyLink()));
  el.btnImport.addEventListener('click', () => {
    const text = el.shareImport.value.trim();
    if (!text) return;
    if (api.importCode(text)) {
      el.shareImport.value = '';
      ui.openPanel(null);
    } else {
      ui.toast('share.invalid', {}, 'error');
    }
  });

  // ---- landing ---------------------------------------------------------------
  const startNew = () => api.newCity({ name: el.landingName.value.trim() });
  el.btnNew.addEventListener('click', startNew);
  el.landingName.addEventListener('keydown', (e) => { if (e.key === 'Enter') startNew(); });
  el.btnContinue.addEventListener('click', () => api.continueCity());
  el.btnShared.addEventListener('click', () => api.loadShared());

  // ---- rendering helpers -------------------------------------------------------
  function renderLandingMeta() {
    if (!landingMeta) { setText(el.continueMeta, t('landing.noSave')); return; }
    const date = t('landing.saveDate', { m: monthName(landingMeta.month), y: num(landingMeta.year) || 1 });
    setText(el.continueMeta, t('landing.continueMeta', { name: landingMeta.name || t('app.title'), pop: formatInt(landingMeta.pop), date }));
  }

  function renderBlockerLegend() {
    const entries = Object.entries(BLOCK_COLORS);
    while (el.blockerLegend.children.length < entries.length) {
      const li = document.createElement('li');
      li.appendChild(document.createElement('i')).className = 'sw';
      li.appendChild(document.createElement('span'));
      el.blockerLegend.appendChild(li);
    }
    entries.forEach(([block, color], k) => {
      const li = el.blockerLegend.children[k];
      li.firstElementChild.style.setProperty('--sw', color);
      setText(li.lastElementChild, t(`block.${block}`));
    });
  }

  function setRci(zone, demand) {
    const bar = el.rci[zone];
    const v = Math.round(clamp(num(demand), -1, 1) * 100);
    setAttr(bar, 'aria-valuenow', String(v));
    setAttr(bar, 'aria-label', t('a11y.rci', { zone: t(`zone.${zone}`), n: v }));
    const fill = bar.firstElementChild;
    fill.style.insetInlineStart = v >= 0 ? '50%' : `${50 + v / 2}%`;
    fill.style.width = `${Math.abs(v) / 2}%`;
    fill.classList.toggle('neg', v < 0);
  }

  function renderInspector(city, selected) {
    fillList(el.inspectorLines, inspectorLines(city, selected));
  }

  function drawSpark(city) {
    const history = Array.isArray(city.history) ? city.history : [];
    const key = `${history.length}:${num(city.cash)}`;
    if (key === sparkKey) return;
    sparkKey = key;
    const ctx = el.spark.getContext('2d');
    if (!ctx) return;
    const W = el.spark.width, H = el.spark.height;
    const values = history.map((h) => num(h.cash));
    if (values.length === 0) values.push(num(city.cash));
    if (values.length === 1) values.push(values[0]);
    const lo = Math.min(0, ...values), hi = Math.max(0, ...values);
    const span = hi - lo || 1;
    const yOf = (v) => H - 4 - ((v - lo) / span) * (H - 8);
    const xOf = (k) => 2 + (k / (values.length - 1)) * (W - 4);
    const style = getComputedStyle(document.body);
    ctx.clearRect(0, 0, W, H);
    ctx.lineWidth = 1;
    ctx.strokeStyle = style.getPropertyValue('--ui-fg').trim() || '#fff';
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.moveTo(0, yOf(0)); ctx.lineTo(W, yOf(0)); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = style.getPropertyValue('--ui-accent').trim() || '#8fd97a';
    ctx.beginPath();
    values.forEach((v, k) => (k === 0 ? ctx.moveTo(xOf(k), yOf(v)) : ctx.lineTo(xOf(k), yOf(v))));
    ctx.stroke();
  }

  function renderBudget(city) {
    const s = city.stats || {};
    const cash = num(city.cash);
    const rate = clamp(num(city.taxRate), BALANCE.TAX_MIN, BALANCE.TAX_MAX);
    if (document.activeElement !== el.taxSlider && Number(el.taxSlider.value) !== rate) el.taxSlider.value = String(rate);
    setText(el.taxValue, t('budget.tax', { n: rate }));
    // Settled figures of the last month (stats.income/expenses, seeded from history after a load). The
    // interest share is not stored; it was INTEREST × the debt before that settlement, and the last
    // history entry holds the cash after it: before = after − income + expenses.
    const income = num(s.income), expenses = num(s.expenses);
    const history = Array.isArray(city.history) ? city.history : [];
    const settled = history.length ? history[history.length - 1] : null;
    const cashBefore = settled ? num(settled.cash) - income + expenses : 0;
    const interest = cashBefore < 0 ? Math.min(expenses, Math.round(BALANCE.INTEREST * -cashBefore)) : 0;
    const upkeep = expenses - interest;
    fillRows(el.budgetRows, [
      [t('budget.income'), formatMoney(income)],
      [t('budget.upkeep'), formatMoney(-upkeep)],
      [t('budget.interest'), formatMoney(-interest)],
      [t('budget.net'), formatMoney(income - upkeep - interest)],
    ]);
    const bc = s.blockCounts || {};
    const lines = [
      { text: t('budget.power', { use: formatInt(s.powerUse), cap: formatInt(s.powerCap) }), cls: num(s.powerUse) > num(s.powerCap) ? 'warn' : '' },
      { text: t('budget.water', { use: formatInt(s.waterUse), cap: formatInt(s.waterCap) }), cls: num(s.waterUse) > num(s.waterCap) ? 'warn' : '' },
      t('budget.waiting', {
        road: num(bc[BLOCK.ROAD]), power: num(bc[BLOCK.POWER]), water: num(bc[BLOCK.WATER]),
        demand: num(bc[BLOCK.DEMAND]), value: num(bc[BLOCK.VALUE]),
      }),
    ];
    if (cash < 0) lines.push({ text: t('budget.debt'), cls: 'warn' });
    if (city.servicesCut) lines.push({ text: t('budget.cut', { n: formatMoney(BALANCE.SERVICES_CUT_CASH) }), cls: 'warn' });
    fillList(el.budgetLines, lines);
    drawSpark(city);
  }

  function renderOpenPanel() {
    if (!last.city) return;
    if (openId === 'inspector') renderInspector(last.city, last.view ? last.view.selected : null);
    else if (openId === 'budget') renderBudget(last.city);
  }

  const ui = {
    /**
     * Shows the landing overlay.
     * @param {{ meta: object|null, hasShared: boolean }} opts  meta = SaveMeta of the newest local save
     */
    showLanding({ meta, hasShared } = {}) {
      landingMeta = meta || null;
      el.btnContinue.disabled = !landingMeta;
      el.btnShared.hidden = !hasShared;
      renderLandingMeta();
      el.app.inert = true;            // the game shell behind the modal landing is neither focusable nor clickable
      el.landing.hidden = false;
      (hasShared ? el.btnShared : el.btnNew).focus();
    },

    /** Hides the landing overlay and focuses the map. */
    hideLanding() {
      el.landing.hidden = true;
      el.app.inert = false;
      focusMap();
    },

    /**
     * Refreshes HUD, toolbar/speed/overlay state, debt banner and the open panel.
     * Called by main at ≤ 10 Hz and after every action.
     * @param {object} city  City (read-only here)
     * @param {object} view  View (read-only here)
     */
    update(city, view) {
      if (!city || !view) return;
      last = { city, view };
      const s = city.stats || {};
      const cash = num(city.cash);
      setText(el.cash, formatMoney(cash));
      el.cash.classList.toggle('neg', cash < 0);
      setText(el.pop, formatInt(s.pop));
      setText(el.jobs, formatInt(s.jobs));
      const approval = Math.round(clamp(num(s.approval), 0, 100));
      setText(el.approval, String(approval));
      const mood = approval >= 70 ? 'happy' : approval >= 40 ? 'neutral' : 'unhappy';
      if (el.mouth.dataset.mood !== mood) {
        el.mouth.dataset.mood = mood;
        el.mouth.setAttribute('d', MOUTH[mood]);
      }
      setText(el.date, formatDate(city.clock));
      const demand = city.demand || {};
      for (const zone of ZONE_ORDER) setRci(zone, demand[zone]);
      const speed = city.clock ? city.clock.speed : 1;
      el.speed.forEach((btn, n) => setAttr(btn, 'aria-pressed', String(speed === n)));
      for (const [tool, btn] of toolButtons) setAttr(btn, 'aria-pressed', String(view.tool === tool));
      if (OVERLAY_ORDER.includes(view.overlay) && el.overlay.value !== view.overlay) el.overlay.value = view.overlay;
      if (SKINS[city.skin] && el.skin.value !== city.skin) el.skin.value = city.skin;
      el.debt.hidden = cash >= 0;
      if (cash < 0) setText(el.debt, city.servicesCut ? t('budget.cut', { n: formatMoney(BALANCE.SERVICES_CUT_CASH) }) : t('budget.debt'));
      const h = cash < 0 ? `${el.debt.offsetHeight}px` : '0px';
      if (h !== bannerH) { bannerH = h; el.stage.style.setProperty('--banner-h', h); }
      renderOpenPanel();
    },

    /**
     * Shows a translated toast for 3.5 s (at most 3 stacked) in an aria-live region: the stage's while
     * playing, the landing's while the landing is shown (#app is inert then, so its region is silent).
     * @param {string} key  i18n key
     * @param {Record<string, unknown>} [params]
     * @param {'info'|'warn'|'error'} [kind]
     */
    toast(key, params = {}, kind = 'info') {
      const host = el.landing.hidden ? el.toasts : el.landingToasts;
      const node = document.createElement('div');
      node.className = `toast toast-${kind === 'warn' || kind === 'error' ? kind : 'info'}`;
      node.dir = 'auto';   // a toast keeps its text through a language switch, so it resolves its own direction
      node.textContent = t(key, params);
      host.appendChild(node);
      while (host.children.length > TOAST_MAX) host.firstElementChild.remove();
      setTimeout(() => node.remove(), TOAST_MS);
    },

    /**
     * Positions the DOM price badge near canvas point (sx, sy) in CSS px; `null` text hides it.
     * The badge is kept inside the canvas area so it never clips at map borders.
     * @param {number} sx
     * @param {number} sy
     * @param {string|null} text
     */
    setPriceBadge(sx, sy, text) {
      if (text === null || text === undefined || text === '' || !Number.isFinite(sx) || !Number.isFinite(sy)) {
        el.badge.hidden = true;
        return;
      }
      setText(el.badge, String(text));
      el.badge.hidden = false;
      const x = clamp(sx + 14, 4, Math.max(4, el.stage.clientWidth - el.badge.offsetWidth - 4));
      const y = clamp(sy - 30, 4, Math.max(4, el.stage.clientHeight - el.badge.offsetHeight - 4));
      el.badge.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    },

    /**
     * Opens one side panel / bottom sheet, or closes all with `null`.
     * @param {'inspector'|'budget'|'help'|'save'|null} id
     */
    openPanel(id) {
      openId = PANEL_IDS.includes(id) ? id : null;
      // Hiding the element that has focus would drop focus to <body>; keep it on the map instead.
      if (openId === null && el.panels.contains(document.activeElement)) focusMap();
      el.panels.hidden = openId === null;
      for (const pid of PANEL_IDS) el.panel[pid].hidden = pid !== openId;
      for (const tab of el.tabs) setAttr(tab, 'aria-selected', String(tab.dataset.panel === openId));
      setAttr(el.btnHelp, 'aria-pressed', String(openId === 'help'));
      setAttr(el.btnSavePanel, 'aria-pressed', String(openId === 'save'));
      if (openId === 'save') refreshShareCode();
      renderOpenPanel();
    },

    /** @returns {boolean} whether any panel is open */
    /** With no argument: is any panel open; with an id: is that specific panel open. */
    isPanelOpen(id) { return id === undefined ? openId !== null : openId === id; },

    /**
     * Asks a yes/no question in the <dialog>; resolves true for "Yes", false for "No" or Esc (a backdrop click does nothing).
     * Falls back to window.confirm where <dialog> is unsupported.
     * @param {string} key
     * @param {Record<string, unknown>} [params]
     * @returns {Promise<boolean>}
     */
    confirm(key, params = {}) {
      const message = t(key, params);
      if (typeof el.confirm.showModal !== 'function') return Promise.resolve(window.confirm(message));
      return new Promise((resolve) => {
        el.confirmText.textContent = message;
        el.confirm.returnValue = '';
        el.confirm.addEventListener('close', () => resolve(el.confirm.returnValue === 'yes'), { once: true });
        if (el.confirm.open) el.confirm.close();
        el.confirm.showModal();
      });
    },

    /**
     * Applies a skin's UI colours as CSS variables and tags <body data-skin>. Unknown ids use the default skin.
     * @param {string} id
     */
    applySkin(id) {
      const skin = SKINS[id] || SKINS[DEFAULT_SKIN];
      const style = document.documentElement.style;
      style.setProperty('--ui-bg', skin.ui.bg);
      style.setProperty('--ui-panel', skin.ui.panel);
      style.setProperty('--ui-fg', skin.ui.fg);
      style.setProperty('--ui-accent', skin.ui.accent);
      document.body.dataset.skin = skin.id;
      const theme = document.querySelector('meta[name="theme-color"]');
      if (theme) theme.setAttribute('content', skin.ui.bg);
      if (el.skin.value !== skin.id) el.skin.value = skin.id;
      sparkKey = '';
    },

    /** Re-applies every translated string after a language change (static DOM and dynamic labels). */
    relabel() {
      applyDom(document);
      for (const [tool, btn] of toolButtons) labelTool(tool, btn);
      fillSelect(el.overlay, OVERLAY_ORDER, (id) => t(`overlay.${id}`));
      fillSelect(el.skin, SKIN_ORDER, (id) => t(`skin.${id}`));
      for (const sel of [el.lang, el.landingLang]) {
        fillSelect(sel, LANGS.map((l) => l.id), (id) => LANGS.find((l) => l.id === id).label);
        sel.value = getLang();
      }
      setText(el.historyLabel, t('budget.history', { n: BALANCE.HISTORY_CAP }));
      renderBlockerLegend();
      renderLandingMeta();
      sparkKey = '';
      if (last.city && last.view) ui.update(last.city, last.view);
    },
  };

  ui.relabel();
  ui.openPanel(null);
  return ui;
}
