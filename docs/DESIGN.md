# Main City — Authoritative Design & Architecture Spec

Version 1.0 (lead architect's merge of three designer specs). **This document is the only shared contract.** Implementers A–D work in parallel on disjoint files and see nothing but this text; the integrator writes `js/main.js` afterwards. Every number lives in `js/data.js` (`BALANCE`, `BUILDINGS`, `ZONE_LEVELS`, `SKINS`); logic never hard-codes a tuning value.

Tagline: *"Build a city on your own, right in your browser."* Title: **Main City**.

---

## 0. Pillars, conventions, ownership

### 0.1 Pillars
1. **Every "no" has a reason.** A zoned lot that is not growing carries a machine-readable `tile.block` (`BLOCK.*`), shown in the inspector with a hint sentence and painted by the *Growth blockers* overlay.
2. **Deterministic, cheap, DOM-free simulation.** One seeded RNG stored in the save; typed-array grids; sim/data/save code runs in Node (no `window`, `document`, `Date`, `Math.random` inside `js/sim.js`, `js/data.js`; `js/save.js` touches `localStorage`/`location` only inside the functions documented as doing so).
3. **Baked map + thin overlay.** The static map is painted once into an offscreen canvas and only dirty tiles are repainted; each frame blits it and draws cursors/ghosts/badges for visible tiles only.
4. **One translation table, one palette table, one tuning table.**

### 0.2 Conventions
- Vanilla ES modules (`<script type="module" src="./js/main.js">`), strict mode implied. No frameworks, bundlers, CDNs, images. All paths relative (`./`) so GitHub Pages project sites work.
- `camelCase` identifiers, `UPPER_SNAKE` constants, enum values are lower-case **strings**. Plain objects + factory functions (`createX(...)` returns an object with methods); no classes, no inheritance.
- Tile index `i = y * MAP_W + x`. Coordinates: `x` right, `y` down, tile (0,0) top-left. Screen coordinates are CSS pixels relative to the canvas top-left.
- `Result<T> = { ok: true, ...T } | { ok: false, error: string /* ERR.* i18n key */ }`. Functions never throw for user-caused failures.
- No text is drawn on the canvas (badges are vector glyphs; price labels are DOM) so i18n/RTL never touches rendering.
- Comments only where non-obvious; no dead code; `node --check` clean.

### 0.3 File list and ownership (nobody edits another owner's file)

| Owner | Files | Budget (lines) |
|---|---|---|
| **A** | `js/data.js` (enums, tables, skins, tiny factories) · `js/sim.js` (RNG, terrain, actions, derived grids, demand, growth, budget, clock) | 300 · 800 |
| **B** | `js/camera.js` · `js/render.js` | 130 · 520 |
| **C** | `index.html` · `css/style.css` · `js/ui.js` · `js/i18n.js` (logic **and** the four dictionaries) | 170 · 420 · 600 · 560 |
| **D** | `js/save.js` · `js/input.js` | 280 · 320 |
| Integrator | `js/main.js` · `README.md` · `.nojekyll` (empty) | 320 · 120 |

Total ≈ 4,480 lines. Delete the starter `styles.css` and `images/` (integrator does this).

Import graph (arrows = "imports from"): `sim → data`; `camera → data`; `render → data, camera (type only)`; `ui → data, i18n`; `input → data`; `save → data`; `i18n → (nothing)`; `main → everything`. **No module imports `sim.js` except `main.js`.** There is no event bus: `sim` returns event arrays, `input` and `ui` call handler/API objects that `main` provides.

---

## 1. Gameplay rules (exact)

### 1.1 World
| Item | Value |
|---|---|
| Map | 40 × 40 (`MAP_W = MAP_H = 40`); save carries `w`,`h` |
| Tile | `TILE = 32` world px at zoom 1; zoom 0.25–3.0 (`ZOOM_MIN` 0.25 so `fitMap()` shows the whole map on a 360 px phone) |
| Terrain | `grass` (buildable), `tree` (buildable; auto-cleared for `BALANCE.TREE_CLEAR` = $3 surcharge per tile), `water` (never buildable) |
| Generation | Seeded: 2–3 water blobs (6–12 % of tiles), tree clusters (~12 %), the central 12×12 is always grass |
| Variant | Visual variety is stateless: `tileVariant(x, y, seed) = (x * 7 + y * 13 + seed) & 3` |

### 1.2 Clock
Day = atomic tick. 30 days/month, 12 months/year, start Day 1 / Month 1 / Year 1.
`SPEED_MS = [0, 500, 250, 167]` ms per day for speeds 0 (pause), 1×, 2×, 3×. At most `MAX_TICKS_PER_FRAME = 5` days per frame; leftover accumulated time beyond that is discarded. Frame `dt` is clamped to 250 ms by `main`.

### 1.3 Tools
`TOOL`: `pan, inspect, road, zone_r, zone_c, zone_i, bulldoze, power, water, park, police, fire, school, hospital`. Service tool ids **equal** `BUILDING` ids.
`TOOL_KIND`: `pan, inspect → 'pan'` (tap selects for inspect) · `road → 'line'` · `zone_* , bulldoze → 'rect'` · services → `'single'`.

### 1.4 Costs, footprints, upkeep, radii (Chebyshev distance from nearest footprint tile)

| Item | Footprint | Cost | Upkeep/month | Radius | Effect |
|---|---|---|---|---|---|
| Road | 1×1 | 10 | 1 | — | access for 4-adjacent lots |
| Zone R/C/I | 1×1 | 5 | 0 | — | level-0 lot |
| Bulldoze | 1×1 | 2 per tile that had something | — | — | clears road/lot/tree/whole service footprint |
| `power` plant | 2×2 | 2500 | 100 | 10 | capacity **400** power; pollution 25, radius 4 |
| `water` tower | 1×1 | 600 | 30 | 7 | capacity **150** water; uses 2 power |
| `park` | 1×1 | 150 | 10 | 4 | cover bit PARK; LV +20, approval |
| `police` | 2×2 | 800 | 40 | 8 | cover bit POLICE; uses 4 power, 2 water |
| `fire` | 2×2 | 800 | 40 | 8 | cover bit FIRE; fires ×0.15 |
| `school` | 2×2 | 1000 | 50 | 9 | cover bit SCHOOL; LV +10, C demand |
| `hospital` | 2×2 | 1500 | 75 | 9 | cover bit HOSPITAL; LV +8 |

Services always function even if unpowered (they still count toward power/water use). Building is refused when `cash − cost < BALANCE.BUILD_FLOOR` (−10,000) → `ERR.MONEY`. Bulldoze is always allowed.

### 1.5 Zone levels (`ZONE_LEVELS[zone][level]`, level 0 = empty lot)

| Zone | capacity L1/L2/L3 | power/level | water/level | pollution emitted L1/L2/L3 (radius 3) |
|---|---|---|---|---|
| r (residents) | 8 / 20 / 50 | 1 | 1 | 0 |
| c (jobs) | 6 / 15 / 40 | 2 | 1 | 0 |
| i (jobs) | 8 / 20 / 50 | 3 | 2 | 10 / 20 / 30 |

Totals: `pop = Σ r cap`, `cJobs`, `iJobs`, `jobs = cJobs + iJobs`, `workers = round(pop × 0.55)`, `unemployment = max(0, workers − jobs) / max(1, workers)`.

### 1.6 Access, power, water (derived each day)
- `access`: zoned tile has a road among its 4 neighbours.
- **Power**: `powerCap = Σ plant capacity`. Consumers = developed lots (level ≥ 1) and service buildings in range of any plant. Services are granted first; then developed lots in **ascending tile index** while `use + need ≤ cap`. Granted → `powered = true`. A level-0 lot is `powered` iff it is in range of a plant **and** `powerUse ≤ powerCap` (no city-wide shortage). Tiles out of range are never powered. `stats.powerUse` = total need of all in-range consumers (may exceed cap → shortage).
- **Water**: identical with towers, `waterCap`, `waterUse`, `watered`.
- Water is required only for **level ≥ 2** (level 1 grows on power alone — intended progression: road → power → houses → water → density).

### 1.7 Coverage, pollution, land value (derived each day)
- `grids.cover[i]` bitmask (`COVER.POLICE=1, FIRE=2, SCHOOL=4, HOSPITAL=8, PARK=16`) from every service in radius. While `city.servicesCut` is true the mask is all zero (parks too).
- `grids.pollution[i]` 0..100: Σ over I buildings `emission × (1 − d/4)` for Chebyshev `d ≤ 3`, plus plants `25 × (1 − d/5)` for `d ≤ 4`, minus `PARK_POLLUTION_ABSORB = 20` on tiles with park cover (so parks really do cut pollution, as the hints say; none while services are cut); clamp 0..100.
- `grids.landValue[i]` 0..100 for non-water tiles:
  ```
  LV = 30 + 20·park + 10·school + 8·hospital + 5·police        (cover bits 0/1)
       + 8 if any water terrain within Chebyshev 2
       − 0.5 · pollution
       − 10 if zone === 'r' and any 8-neighbour is zone 'i' with level ≥ 1
  clamp 0..100, round
  ```
- `stats.pollutionIndex = mean(pollution over zoned tiles) / 100` (0 if none). `stats.lvAvgR` = mean LV over developed R tiles (40 if none).

### 1.8 Approval (0..100, city-wide, derived each day)
If there are no developed R tiles, `approval = 50`. Otherwise, with means taken over developed R tiles (`cov(X)` = share covered by X):
```
taxTerm       = (9 − taxRate) × 2
servicesTerm  = 8·cov(police) + 6·cov(fire) + 10·cov(school) + 8·cov(hospital) + 8·cov(park)
valueTerm     = (lvAvgR − 40) / 4
pollutionTerm = 0.3 × mean pollution over developed R
unemployTerm  = 25 × unemployment
utilityTerm   = 15 × (share of developed R unpowered) + 10 × (share of R with level ≥ 2 unwatered)
debtTerm      = cash < 0 ? 10 : 0
approval = round(clamp(50 + taxTerm + servicesTerm + valueTerm − pollutionTerm − unemployTerm − utilityTerm − debtTerm, 0, 100))
```
HUD shows a face: ≥ 70 happy, 40–69 neutral, < 40 unhappy, plus the number.

### 1.9 RCI demand (each −1..1, derived each day)
```
taxMod  = (taxRate − 9) × 0.06
den     = max(60, workers)
jobGap  = (jobs − workers) / den                  // > 0: jobs waiting for people
schoolShare = cov(school) over developed R tiles (0 if none)
D_r = pop === 0 ? 0.6 : clamp(0.35 + 0.9·jobGap + (approval − 50)/150 − taxMod, −1, 1)
D_c = clamp(0.05 + (pop·0.30 − cJobs) / max(40, pop·0.30) + 0.1·schoolShare − taxMod, −1, 1)
D_i = clamp(0.30 + 0.8·max(0, −jobGap) − 0.3·pollutionIndex − taxMod, −1, 1)
```
Arc: R and I start positive; R collapses when jobs lag; C turns on as population appears; I decays as pollution builds unless parks/C jobs are added.

### 1.10 Growth & decline (`stepDay`)
Each zoned tile is evaluated when `i % 10 === (day − 1) % 10` (three times per month), in ascending index order, `D = demand[zone]`, `L = level`, `LV = landValue[i]`:

1. **Decline first** (only `L ≥ 1`):
   - `starve = (!access || !powered) ? starve + 1 : 0`; if `starve ≥ 3` → `L −= 1`, `starve = 0`.
   - else if `D < −0.4` and `rng() < 0.3` → `L −= 1`.
   - else if zone r and `pollution > 80` and `rng() < 0.5` → `L −= 1`.
   - A decline sets `tile.block` for this pass and skips growth. Level 0 keeps the zone.
2. **Gates** in this order; the first failing gate sets `tile.block` and stops:

| # | Gate | `block` |
|---|---|---|
| 1 | `!access` | `road` |
| 2 | `!powered` | `power` |
| 3 | `L === 0 ? D ≤ 0 : D ≤ 0.2` | `demand` |
| 4 | `L ≥ 1 && !watered` | `water` |
| 5 | `L === 3` | `full` |
| 6 | zone r or c and `LV < LV_REQ[L + 1]` where `LV_REQ = [0, 0, 35, 55]` | `value` |
| 7 | zone r and `pollution > 60` | `pollution` |
| — | all pass | `none` |

3. **Growth roll**: `p = (0.25 + 0.35·D) × (0.7 + 0.3·LV/100)`; if `rng() < p` → `L += 1`, `starve = 0`, event `grow`.

`recomputeDerived` also refreshes `tile.block` for **every** zoned tile (gates only, no RNG, no decline) so the inspector and overlay are always current.

### 1.11 Fires
At month end each developed zoned tile rolls `rng() < 0.003 × (fire covered ? 0.15 : 1)`. On fire: `level = 0`, `starve = 0`, event `{ type:'fire', i }`, tile marked dirty. No spreading.

### 1.12 Budget (month end)
```
income   = round(taxRate/100 × (pop·10 + cJobs·14 + iJobs·12))
upkeep   = roads·1 + Σ BUILDINGS[b.id].upkeep
interest = cash < 0 ? round(0.01·|cash|) : 0
expenses = upkeep + interest
cash    += income − expenses
debtMonths  = cash < 0 ? debtMonths + 1 : 0
servicesCut = cash < −5000
history.push({ month, year, pop, cash, income, expenses })   // cap 60 entries
```
`BALANCE`: `START_CASH 20000`, `TAX_DEFAULT 9`, `TAX_MIN 0`, `TAX_MAX 20`. Debt: 1 % interest, approval −10, toast on entering/leaving; below −5,000 services are suspended (coverage zero, greyed in render); below −10,000 building is refused. No game over.

Balance check: 20 R lots at L2 (400 pop), 8 I lots L2 (160 jobs), 4 C lots L2 (60 jobs) at 9 % → income ≈ $608; upkeep plant 100 + tower 30 + 40 roads + park 10 + school 50 ≈ $230 → +$378/month. Starting cash covers plant + tower + 60 roads + 40 lots (~$3,900) with $16k to spare.

### 1.13 Overlays (`OVERLAY`)
`none, power, water, value, pollution, block`. Cycled by `O`, selectable in the header.

### 1.14 Skins
`grassland` (default), `desert`, `snow`, `night`. Palette-only (`SKINS`); switchable any time; stored in settings and in the save.

### 1.15 Landing, panels, persistence
- Landing overlay: title, tagline, city-name input (default "Main City"), **New city**, **Continue** (disabled with no save; shows name · population · date), **Open shared city** (only when `#c=` is in the URL).
- Panels: Inspector, Budget, Help/Legend, Save & Share. Desktop: right side panel with tabs; phone: bottom sheet.
- Autosave at every month end and on `visibilitychange→hidden` / `pagehide` (skipped while `city.fromLink` is true, i.e. a shared city nobody has edited). One manual slot. Share: copy code, copy link (`#c=`), import code or link.

### 1.16 i18n & a11y
Languages `en` (default), `es`, `ru`, `he` (RTL). Order: `?lang=` → settings → `navigator.language` prefix → `en`. All strings via `t()`. Real `<button>`s with `aria-label`, `aria-pressed` on tool/speed/overlay buttons, toasts in `aria-live="polite"`, visible `:focus-visible` ring, canvas `role="application" tabindex="0"`. Keys: `R` road, `Z` cycle zones, `B` bulldoze, `I` inspect, `Space` pause, `1/2/3` speed, `Esc` cancel (→ pan, close panels), `O` overlay, `H` help, `WASD` pan, arrows move keyboard cursor, `Enter` applies tool at cursor, `+`/`=` and `−` zoom, `Ctrl/Cmd+S` save. Letter shortcuts fall back to the physical key (`e.code` `KeyR` → `r`) when the layout yields a non-Latin letter, so they work under Cyrillic/Hebrew layouts. `prefers-reduced-motion`: no CSS transitions, no blinking badges.

---

## 2. Shared data model (allocated by `data.js` factories)

```ts
type Terrain = 'grass'|'tree'|'water';
type Zone    = 'none'|'r'|'c'|'i';

interface Tile {
  terrain: Terrain;
  road: boolean;            // exclusive with zone !== 'none' and building !== null
  zone: Zone;
  level: 0|1|2|3;           // only meaningful when zone !== 'none'
  building: string|null;    // BUILDING id, set on EVERY footprint tile
  anchor: number;           // index of footprint top-left (== own index for 1×1), -1 if none
  starve: number;           // consecutive failing evaluations (not saved)
  // derived (not saved, written by sim.recomputeDerived):
  access: boolean; powered: boolean; watered: boolean;
  block: string;            // BLOCK.*, 'none' for non-zoned tiles
}

interface Building { id: string; x: number; y: number; }   // anchor top-left

interface Clock { day: number; month: number; year: number; speed: 0|1|2|3; lastSpeed: 1|2|3; accMs: number; }

interface Stats {
  pop: number; cJobs: number; iJobs: number; jobs: number; workers: number; unemployment: number;
  approval: number; developed: { r: number; c: number; i: number }; roads: number;
  powerCap: number; powerUse: number; waterCap: number; waterUse: number;
  pollutionIndex: number; lvAvgR: number;
  income: number; expenses: number;                      // last settled month
  blockCounts: Record<string, number>;                   // BLOCK.* → count of zoned tiles
}

interface HistoryEntry { month: number; year: number; pop: number; cash: number; income: number; expenses: number; }

interface City {
  v: 1; name: string; seed: number; rngState: number; w: 40; h: 40;
  tiles: Tile[]; buildings: Building[];
  clock: Clock; cash: number; taxRate: number; debtMonths: number; servicesCut: boolean;
  skin: string; history: HistoryEntry[];
  demand: { r: number; c: number; i: number };
  stats: Stats;
  grids: { pollution: Uint8Array; landValue: Uint8Array; cover: Uint8Array };   // transient
  alerts: { powerShort: boolean; waterShort: boolean; debt: boolean; everPop: boolean }; // transient
  dirty: { all: boolean; tiles: number[] };   // transient; render consumes & clears
  fromLink: boolean;                          // transient; true until first successful action
}

interface Settings { lang: string; skin: string; }
interface SaveMeta { name: string; pop: number; month: number; year: number; savedAt: number; }

interface Preview { tiles: number[]; ok: boolean[]; cost: number; error: string|null; }   // error = ERR.MONEY or null
interface ActionResult { ok: boolean; error?: string; cost: number; changed: number[]; }  // ok:false → cost 0, changed []

interface View {                      // owned & mutated by main only; read by render and ui
  playing: boolean; tool: string; overlay: string;
  hover: {x:number,y:number}|null;    // pointer tile
  cursor: {x:number,y:number}|null;   // keyboard cursor
  drag: {x0,y0,x1,y1}|null;           // live drag shape in tiles
  ghost: Preview|null;                // preview for hover/cursor/drag with current tool
  selected: number|null;              // inspected tile index
  reducedMotion: boolean;
}

type SimEvent =
  | { type:'month'; income:number; expenses:number; cash:number }
  | { type:'grow'; i:number; level:number; zone:Zone } | { type:'decline'; i:number; level:number }
  | { type:'fire'; i:number } | { type:'firstHouse' }
  | { type:'debt' } | { type:'debtCleared' } | { type:'servicesCut' } | { type:'servicesRestored' }
  | { type:'powerShort'; on:boolean } | { type:'waterShort'; on:boolean };
```

---

## 3. Module contracts

### 3.1 `js/data.js` (A)
```js
export const MAP_W = 40, MAP_H = 40, TILE = 32, SAVE_VERSION = 1;
export const TERRAIN  = Object.freeze({ GRASS:'grass', TREE:'tree', WATER:'water' });
export const ZONE     = Object.freeze({ NONE:'none', R:'r', C:'c', I:'i' });
export const ZONE_ORDER = Object.freeze(['r','c','i']);
export const BUILDING = Object.freeze({ POWER:'power', WATER:'water', PARK:'park', POLICE:'police', FIRE:'fire', SCHOOL:'school', HOSPITAL:'hospital' });
export const BUILDING_ORDER = Object.freeze(['power','water','park','police','fire','school','hospital']);
export const TOOL     = Object.freeze({ PAN:'pan', INSPECT:'inspect', ROAD:'road', ZONE_R:'zone_r', ZONE_C:'zone_c', ZONE_I:'zone_i',
                                        BULLDOZE:'bulldoze', POWER:'power', WATER:'water', PARK:'park', POLICE:'police',
                                        FIRE:'fire', SCHOOL:'school', HOSPITAL:'hospital' });
export const TOOL_ORDER = Object.freeze(['pan','inspect','road','zone_r','zone_c','zone_i','bulldoze',
                                         'power','water','park','police','fire','school','hospital']);   // toolbar order
export const TOOL_KIND  = Object.freeze({ pan:'pan', inspect:'pan', road:'line', zone_r:'rect', zone_c:'rect', zone_i:'rect',
                                          bulldoze:'rect', power:'single', water:'single', park:'single', police:'single',
                                          fire:'single', school:'single', hospital:'single' });
export const TOOL_ZONE  = Object.freeze({ zone_r:'r', zone_c:'c', zone_i:'i' });
export const TOOL_KEY   = Object.freeze({ pan:'Esc', inspect:'I', road:'R', zone_r:'Z', zone_c:'Z', zone_i:'Z', bulldoze:'B' }); // label only
export const OVERLAY  = Object.freeze({ NONE:'none', POWER:'power', WATER:'water', VALUE:'value', POLLUTION:'pollution', BLOCK:'block' });
export const OVERLAY_ORDER = Object.freeze(['none','power','water','value','pollution','block']);
export const BLOCK    = Object.freeze({ NONE:'none', ROAD:'road', POWER:'power', WATER:'water', DEMAND:'demand', VALUE:'value', POLLUTION:'pollution', FULL:'full' });
export const BLOCK_COLORS = Object.freeze({ road:'#8a8a8a', power:'#f5c518', water:'#3aa0ff', demand:'#b06cff', value:'#ff8a3c', pollution:'#6b4a2a', full:'#2ecc71' }); // none → not painted
export const COVER    = Object.freeze({ POLICE:1, FIRE:2, SCHOOL:4, HOSPITAL:8, PARK:16 });
export const ERR      = Object.freeze({ WATER:'err.water', OCCUPIED:'err.occupied', MONEY:'err.money', BOUNDS:'err.bounds',
                                        NOTHING:'err.nothing', SAVE:'err.save', VERSION:'err.version', STORAGE:'err.storage' });
export const SPEED_MS = Object.freeze([0, 500, 250, 167]);

/** @typedef {{ w:number,h:number,cost:number,upkeep:number,radius:number,power:number,water:number,
 *              capPower?:number,capWater?:number,pollution?:number,pollutionRadius?:number,cover?:number }} BuildingDef */
export const BUILDINGS = Object.freeze({
  power:    { w:2,h:2, cost:2500, upkeep:100, radius:10, power:0, water:0, capPower:400, pollution:25, pollutionRadius:4 },
  water:    { w:1,h:1, cost:600,  upkeep:30,  radius:7,  power:2, water:0, capWater:150 },
  park:     { w:1,h:1, cost:150,  upkeep:10,  radius:4,  power:0, water:0, cover:16 },
  police:   { w:2,h:2, cost:800,  upkeep:40,  radius:8,  power:4, water:2, cover:1 },
  fire:     { w:2,h:2, cost:800,  upkeep:40,  radius:8,  power:4, water:2, cover:2 },
  school:   { w:2,h:2, cost:1000, upkeep:50,  radius:9,  power:4, water:2, cover:4 },
  hospital: { w:2,h:2, cost:1500, upkeep:75,  radius:9,  power:4, water:2, cover:8 },
});
export const ZONE_LEVELS = Object.freeze({    // [level] → { cap, power, water, pollution }
  r: [{cap:0,power:0,water:0,pollution:0},{cap:8,power:1,water:1,pollution:0},{cap:20,power:2,water:2,pollution:0},{cap:50,power:3,water:3,pollution:0}],
  c: [{cap:0,power:0,water:0,pollution:0},{cap:6,power:2,water:1,pollution:0},{cap:15,power:4,water:2,pollution:0},{cap:40,power:6,water:3,pollution:0}],
  i: [{cap:0,power:0,water:0,pollution:0},{cap:8,power:3,water:2,pollution:10},{cap:20,power:6,water:3,pollution:20},{cap:50,power:9,water:4,pollution:30}],
});
export const BALANCE = Object.freeze({
  START_CASH:20000, TAX_DEFAULT:9, TAX_MIN:0, TAX_MAX:20, BUILD_FLOOR:-10000, SERVICES_CUT_CASH:-5000, INTEREST:0.01,
  ROAD_COST:10, ROAD_UPKEEP:1, ZONE_COST:5, BULLDOZE_COST:2, TREE_CLEAR:3,
  DAYS_PER_MONTH:30, MAX_TICKS_PER_FRAME:5, FRAME_DT_CLAMP:250, EVAL_STRIDE:10,
  WORKER_SHARE:0.55, INCOME_POP:10, INCOME_CJOB:14, INCOME_IJOB:12,
  GROW_BASE:0.25, GROW_DEMAND:0.35, LV_REQ:[0,0,35,55], STARVE_EVALS:3, DECLINE_DEMAND:-0.4, DECLINE_P:0.3,
  POLLUTION_BLOCK_R:60, POLLUTION_DECLINE_R:80, POLLUTION_DECLINE_P:0.5,
  FIRE_P:0.003, FIRE_COVERED_MULT:0.15, HISTORY_CAP:60,
  WATER_MIN:0.06, WATER_MAX:0.12, TREE_SHARE:0.12, CLEAR_RADIUS:6,
  ZOOM_MIN:0.25, ZOOM_MAX:3, ZOOM_STEP:1.1, KEY_PAN_SPEED:600, TAP_MS:300, TAP_PX:6, LONG_PRESS_MS:450,
});

/** @typedef {{ id:string, bg:string, ground:[string,string,string,string], groundDetail:string,
 *   water:string, waterEdge:string, treeTrunk:string, treeCanopy:[string,string],
 *   road:string, roadLine:string, roadEdge:string,
 *   lot:{r:string,c:string,i:string},                        // rgba tints for level-0 lots
 *   wall:{r:string[],c:string[],i:string[]}, roof:{r:string,c:string,i:string},   // 4 wall variants each
 *   window:string, windowLit:string, smoke:string,
 *   service:Record<string,{base:string,accent:string}>,     // one entry per BUILDING id
 *   grid:string, ghostOk:string, ghostBad:string, select:string, cursor:string, badge:string, badgeBg:string,
 *   night:boolean, ui:{bg:string,panel:string,fg:string,accent:string} }} Skin */
export const SKINS = Object.freeze({ grassland:{...}, desert:{...}, snow:{...}, night:{...} });
// SKINS, BUILDINGS, TOOL_KIND, TOOL_ZONE and BLOCK_COLORS are built on a null prototype (data.js `table()`), so
// `TABLE[id]` is truthy only for real ids: 'constructor' / '__proto__' from a save or share code resolve to undefined.
export const SKIN_ORDER = Object.freeze(['grassland','desert','snow','night']);
export const DEFAULT_SKIN = 'grassland';

export function idx(x, y)            // y*MAP_W + x (no bounds check)
export function inBounds(x, y)       // boolean
export function xyOf(i)              // { x, y }
export function toolKind(tool)       // TOOL_KIND[tool] ?? 'pan'
export function cycleZoneTool(tool)  // zone_r→zone_c→zone_i→zone_r; any other tool → 'zone_r'
export function tileVariant(x, y, seed)   // (x*7 + y*13 + seed) & 3
export function createTile(terrain = 'grass')   // Tile with road false, zone 'none', level 0, building null, anchor -1, starve 0, access/powered/watered false, block 'none'
export function createCityShell({ name, seed, skin })  // City per §2: all-grass tiles, buildings [], clock {1,1,1,speed 1,lastSpeed 1,accMs 0},
                                                       // cash START_CASH, taxRate TAX_DEFAULT, debtMonths 0, servicesCut false, history [],
                                                       // demand {0,0,0}, zeroed Stats (blockCounts with every BLOCK key = 0), grids allocated (w*h),
                                                       // alerts all false, dirty {all:true, tiles:[]}, fromLink false, rngState = seed>>>0, v 1, w 40, h 40
export function footprint(x, y, w, h)  // number[] of indices, or null if any tile out of bounds
```
Skin guidance: desert = sand/ochre ground, adobe walls, teal water, cacti-coloured trees; snow = `#eef3f7` ground, dark pines, ice-blue water; night = everything ~55 % darker, `night:true` (lit windows, bright road lines), `ui` dark. `ui` colours are applied to CSS variables by `ui.applySkin`.

### 3.2 `js/sim.js` (A)
```js
export function createRng(seed)                 // mulberry32 → { next(): number /*[0,1)*/, int(n): number /*[0,n)*/, state(): number, set(s): void }
export function hashString(s)                   // FNV-1a → uint32 (for "name as seed")
export function createCity({ name, seed, skin }) // createCityShell + seeded terrain (§1.1) + recomputeDerived; rngState advanced past terrain gen

export function toolTiles(city, tool, x0, y0, x1, y1)  // number[]:
   // 'line'   → L-path from (x0,y0): horizontal to x1, then vertical to y1 (inclusive, deduped, clamped to map)
   // 'rect'   → inclusive rectangle between the two corners, clamped
   // 'single' → footprint of BUILDINGS[tool] anchored top-left at (x1,y1), shifted inward so a w×h building still fits
   //            when the pointer is on the last column/row (anchor = min(x1, MAP_W − w), min(y1, MAP_H − h)); [] if (x1,y1) is off the map
   // 'pan'    → [idx(x1,y1)] if in bounds else []
export function preview(city, tool, tiles)      // Preview: per-tile validity + total cost + ERR.MONEY if cash - cost < BUILD_FLOOR; pure
export function applyTool(city, tool, tiles)    // dispatch: road→placeRoad, zone_*→zoneTiles, bulldoze→bulldoze, service→placeBuilding(tiles[0]);
                                                // pan/inspect → { ok:false, error: ERR.NOTHING, cost:0, changed:[] }
export function placeRoad(city, tiles)          // ActionResult
export function zoneTiles(city, zone, tiles)    // ActionResult
export function placeBuilding(city, id, x, y)   // ActionResult (all-or-nothing)
export function bulldoze(city, tiles)           // ActionResult
export function setTaxRate(city, rate)          // clamps to integer TAX_MIN..TAX_MAX, recomputeDerived
export function setSpeed(city, speed)           // 0..3; speed>0 also sets lastSpeed
export function togglePause(city)               // 0 ↔ lastSpeed
export function buildingAt(city, i)             // Building|null via tiles[i].anchor
export function markDirty(city, i)              // push i (and nothing else) onto city.dirty.tiles
export function recomputeDerived(city)          // §1.6–1.9 + block for all zoned tiles + stats + alerts transitions (returns SimEvent[] of alert transitions)
export function stepDay(city)                   // SimEvent[]  (§3.2.2)
export function advance(city, dtMs)             // SimEvent[]: clock.accMs += dt; while accMs ≥ SPEED_MS[speed] && ticks < MAX_TICKS_PER_FRAME: stepDay; if ticks hit the cap → accMs = 0; speed 0 → [] and accMs stays 0
```

**3.2.1 Action rules.** Each action validates every tile first, computes the cost of the valid subset, refuses the whole action with `ERR.MONEY` if `cash − cost < BUILD_FLOOR`, otherwise applies the valid subset atomically, charges, pushes every changed index onto `city.dirty.tiles` (plus the 4 neighbours of changed roads so road masks repaint), sets `city.fromLink = false`, and calls `recomputeDerived`. If nothing would change → `{ ok:false, error: ERR.NOTHING }`. Per-tile validity:

| Action | Valid when | Cost per tile | Skip (no cost, counts as ok) | Invalid error |
|---|---|---|---|---|
| road | not water, no building, `zone === 'none'` or `level === 0` (lot is dezoned) | 10 (+3 if tree → becomes grass) | already road | water → `ERR.WATER`; building or developed lot → `ERR.OCCUPIED` |
| zone z | not water, not road, no building, and (`zone === 'none'` or `level === 0`) | 5 (+3 tree) | already zone z | water → `ERR.WATER`; road/building/developed other zone → `ERR.OCCUPIED` |
| building | every footprint tile in bounds, not water, not road, no building, `level === 0` (lots dezoned) | BUILDINGS cost (+3 per tree tile), all-or-nothing | — | out of bounds → `ERR.BOUNDS`, water → `ERR.WATER`, else `ERR.OCCUPIED` |
| bulldoze | tile has road, zone, building, or tree | 2 per tile that had something (a service footprint counts each of its tiles once) | nothing there, water | — |

Bulldozing any footprint tile removes the whole building (all footprint tiles cleared, `buildings[]` entry removed). Bulldozing a lot clears zone and level; a tree becomes grass. `preview.ok[k]` is true for "valid" and "skip" tiles.

**3.2.2 `stepDay` order.**
```
1. events = recomputeDerived(city)                  // access, power, water, cover, pollution, LV, stats, demand, approval, block, alerts
2. growth pass (§1.10) over zoned tiles with i % EVAL_STRIDE === (day-1) % EVAL_STRIDE, ascending i; changed tiles → dirty, grow/decline events
3. (the 'firstHouse' event is produced by the next recomputeDerived — see below)
4. clock.day += 1; if day > DAYS_PER_MONTH: day = 1, month += 1 (month > 12 → month = 1, year += 1), then:
     recomputeDerived(city); fires (§1.11); settle budget (§1.12); push 'month' event;
     debt/servicesCut transitions → 'debt'/'debtCleared'/'servicesCut'/'servicesRestored' events
5. city.rngState = rng.state()
6. return events
```
`firstHouse` is emitted by `recomputeDerived` the first time `stats.pop > 0` while `alerts.everPop` is false (then sets it). `powerShort`/`waterShort` events fire on transitions of `powerUse > powerCap` / `waterUse > waterCap`, remembered in `city.alerts`. The sim RNG is `createRng(city.rngState)` created at the start of `stepDay` and `createCity`; no other randomness exists in sim.

### 3.3 `js/camera.js` (B)
```js
export function createCamera()   // Camera
// Camera = {
//   x, y,                 // world px at the viewport centre
//   zoom,                 // ZOOM_MIN..ZOOM_MAX, initial 1
//   vw, vh, dpr,          // viewport CSS px, device pixel ratio (≤ 2)
//   version,              // integer, ++ on every change (render uses it as a dirty check)
//   resize(cssW, cssH, dpr),
//   panBy(dxScreen, dyScreen),      // centre moves by −d/zoom; then clamp
//   zoomAt(factor, sx, sy),         // multiply zoom, keep screen point (sx,sy) over the same world point; clamp zoom and position
//   setZoom(z, sx, sy),
//   centerOn(tx, ty),               // centre on the middle of tile (tx,ty)
//   fitMap(),                       // zoom = clamp(min((vw-32)/(MAP_W*TILE), (vh-32)/(MAP_H*TILE))), centre on map
//   worldToScreen(wx, wy),          // { x, y }
//   screenToWorld(sx, sy),          // { x, y }
//   screenToTile(sx, sy),           // { x, y } tile or null when outside the map
//   tileToScreen(tx, ty),           // { x, y, size }  top-left CSS px of the tile and its on-screen size (TILE*zoom)
//   visibleTileRect(),              // { x0, y0, x1, y1 } inclusive, clamped to the map
//   applyTransform(ctx),            // ctx.setTransform(dpr*zoom, 0, 0, dpr*zoom, dpr*(vw/2 − x*zoom), dpr*(vh/2 − y*zoom))
// }
```
Clamp rule: centre `x` stays within `[0, MAP_W*TILE]`, `y` within `[0, MAP_H*TILE]` (the map can never leave the viewport entirely). Phone default: `fitMap()` is called by `main` on start, so the whole map is visible.

### 3.4 `js/render.js` (B)
```js
export function createRenderer(canvas, camera)   // Renderer
// Renderer = {
//   resize(),                 // reads canvas.clientWidth/Height and min(devicePixelRatio,2); sets canvas.width/height; camera.resize(...)
//   setSkin(id),              // swaps palette, forces a full rebake on next draw (canvas only; CSS variables are ui.applySkin's job)
//   draw(city, view, nowMs),  // §3.4.1; city may be null (draws skin bg only)
//   invalidate(),             // force full rebake + redraw on next draw
// }
```
**3.4.1 Bake.** Offscreen canvas `MAP_W*TILE × MAP_H*TILE` (1280², 1×, no dpr). On `draw`: if the `city` object identity changed, `setSkin`/`invalidate` was called, or `city.dirty.all` → repaint every tile; else repaint each index in `city.dirty.tiles` (for a tile with `building`, repaint the whole footprint from its anchor; for roads/water also repaint the 4 neighbours so edge masks stay right). Then set `city.dirty.all = false; city.dirty.tiles.length = 0`. **Render is the only module that clears `dirty`.**

Tile painting (per tile, in order): ground (`ground[variant]` + 3–5 `groundDetail` specks hashed from `(x,y,seed)`), water (`water` + `waterEdge` 2 px rim on sides adjoining land), tree (`treeTrunk` + two `treeCanopy` circles), road (asphalt square, arms extended to connected 4-neighbours; `roadEdge` 1 px on unconnected sides; dashed `roadLine` along connected axes; isolated road = square with a dot), level-0 lot (`lot[zone]` tint + 1 px dashed outline in zone colour), building (inset box in `wall[zone][variant]`, roof band `roof[zone]` whose height grows with level, window grid `(level+1)×(level+1)` in `window` or `windowLit` when `night` and `powered`; level 3 detail: R chimney, C sign strip in roof colour, I two stacks; unpowered developed tile drawn 40 % darker), services (whole footprint at anchor: `service[id].base` box + glyph in `accent`: power = two stacks + bolt, water = tank on legs, park = three circles + path, police = shield, fire = flame polygon, school = flag, hospital = cross; drawn desaturated/greyer when `city.servicesCut` and the building has a `cover` bit).

**3.4.2 Per-frame compose** (skip entirely when nothing changed: `camera.version`, `view` fields, `nowMs` blink phase and dirty all unchanged — keep a cheap signature):
1. Fill `skin.bg`; `camera.applyTransform(ctx)`; `imageSmoothingEnabled = zoom < 1`; `drawImage(bake, 0, 0)`.
2. For visible tiles (`camera.visibleTileRect()`):
   - Overlay (`view.overlay !== 'none'`), alpha 0.55 fills: `power`/`water`: green `powered/watered` vs red for zoned tiles & services, water towers'/plants' radius outlined; `value`: ramp `#4a2a6b → #ffd34d` on `landValue/100`; `pollution`: transparent → `#5a3b1a` on `pollution/100`; `block`: `BLOCK_COLORS[tile.block]` on zoned tiles.
   - Badges (only when overlay is `none`): on zoned tiles whose `block` is `road`, `power` or `water` draw a 10×10 glyph (road sign / lightning / drop) in `badge` on `badgeBg` at the top-right; blink at 1 Hz unless `view.reducedMotion`.
   - Grid lines (`grid`, 1 px) when `zoom ≥ 1.5`.
3. Radius ring: when `toolKind(view.tool) === 'single'` and `view.hover || view.cursor` exists → dashed Chebyshev square of `BUILDINGS[tool].radius` around the footprint, in `ghostOk`; also around a selected service (`view.selected` with `building`).
4. Ghost: for each `view.ghost.tiles[k]` fill `ghostOk`/`ghostBad` (alpha 0.45) by `ok[k]`; drag L-path/rect uses the same tiles. If `ghost.error` → all `ghostBad`.
5. Selection outline (`select`, 2 px) on `view.selected`; keyboard cursor outline (`cursor`, 3 px) on `view.cursor`; hover outline (1 px `select`) on `view.hover`.
6. Map border (2 px `grid`).
No allocations per frame beyond locals; no text.

### 3.5 `js/input.js` (D)
```js
export function createInput(canvas, camera, handlers)   // Input
// handlers = {
//   getTool(): string,
//   onHover(tile|null),                         // tile = {x,y}; called on change only
//   onTap(x, y),                                // short press/click (< TAP_MS, < TAP_PX) — any tool
//   onLongPress(x, y),                          // ≥ LONG_PRESS_MS without moving (touch & mouse)
//   onDrag(phase, x0, y0, x1, y1),              // phase 'start'|'move'|'end'|'cancel'; tiles; only for 'line'/'rect' tool kinds
//   onCommand(cmd),                             // see command list
//   onCameraChange(),                           // after any pan/zoom performed by input
// }
// Input = { update(dtMs): void /* held WASD pan: KEY_PAN_SPEED px/s */, setEnabled(on: boolean): void, destroy(): void }
```
Pointer rules (Pointer Events only; `canvas.style.touchAction = 'none'`, `contextmenu` prevented):
- One pointer, left button/touch: kind `line`/`rect` → `onDrag('start')` at down tile, `onDrag('move')` on tile change, `onDrag('end')` at up. Kind `pan`/`single` → movement beyond `TAP_PX` pans; release within `TAP_MS` and `TAP_PX` → `onTap`. A `pointerup` for `line`/`rect` without any move is still `start`+`end` on the same tile (one-tile paint).
- Right or middle button drag always pans; a right **click** (no move) → `onCommand({type:'cancel'})`.
- Second touch pointer: cancel any drag (`onDrag('cancel')`) and switch to two-finger pan + pinch (`camera.zoomAt(dist/prevDist, midX, midY)`, `camera.panBy(midDelta)`).
- Wheel: `camera.zoomAt(deltaY < 0 ? ZOOM_STEP : 1/ZOOM_STEP, sx, sy)`.
- Long press (no move for `LONG_PRESS_MS`) → `onLongPress(x, y)` and the gesture ends (no tap/drag end).
- `onHover` on pointer move/leave; `onHover(null)` when outside the map.
Keyboard (`window` keydown; ignored when `!enabled`, when focus is in `input/select/textarea`, or while a modal `<dialog>` is open so Esc reaches its native cancel; `preventDefault` on handled keys). Space/Enter are left to a focused button, and arrows to a focused tab list. Tool keys (`r b i z`) first cancel a live paint so the new tool is never applied to the old drag shape:

| Key | Command |
|---|---|
| `r` | `{type:'tool', tool:'road'}` · `b` → bulldoze · `i` → inspect |
| `z` | `{type:'zoneCycle'}` |
| `Space` | `{type:'pause'}` |
| `1` `2` `3` | `{type:'speed', speed:n}` |
| `Escape` | `{type:'cancel'}` |
| `o` | `{type:'overlayCycle'}` · `h` / `?` → `{type:'help'}` |
| `ArrowUp/Down/Left/Right` | `{type:'cursorMove', dx, dy}` |
| `Enter` | `{type:'cursorApply'}` |
| `Ctrl/Cmd+s` | `{type:'save'}` |
| `+` `=` / `-` | `camera.zoomAt(ZOOM_STEP or 1/ZOOM_STEP, vw/2, vh/2)` then `onCameraChange()` (no command) |
| `w a s d` held | panning in `update(dt)` |

### 3.6 `js/save.js` (D)
```js
export const KEYS = Object.freeze({ AUTOSAVE:'maincity.autosave', MANUAL:'maincity.save', SETTINGS:'maincity.settings' });
export function serialize(city)            // SaveV1 (§4.1), pure
export function deserialize(obj)           // Result<{ city: City }>: migrate → validate → City via createCityShell + tiles + buildings; derived fields zero (main calls sim.recomputeDerived)
                                           // except alerts.debt = cash < 0 and stats.income/expenses seeded from the last history entry (not recomputable)
export function saveLocal(key, city)       // boolean; JSON of serialize(city) with savedAt; false on any exception
export function loadLocal(key)             // Result<{ city }>; missing → { ok:false, error: ERR.SAVE }
export function hasLocal(key)              // boolean
export function metaOf(key)                // SaveMeta|null (reads name/pop/clock/savedAt without full deserialize)
export function newestLocalKey()           // KEYS.AUTOSAVE or KEYS.MANUAL with the latest savedAt, or null
export function loadSettings()             // Settings with defaults { lang:null, skin:'grassland' }; never throws
export function saveSettings(partial)      // boolean; merges
export function encodeShare(city)          // string 'MC1.' + base64url(utf8(JSON.stringify(compact)))  (§4.2)
export function decodeShare(text)          // Result<{ city }>; accepts a bare code or a full URL containing '#c='; trims whitespace
export function shareUrl(code, lang)       // `${location.origin}${location.pathname}?lang=${lang}#c=${code}`
export function codeFromHash(hash)         // string|null from '#c=...' (also '#c=' inside other params)
export function clearHash()                // history.replaceState(null, '', location.pathname + location.search)
```

### 3.7 `js/i18n.js` (C)
```js
export const LANGS = Object.freeze([{ id:'en', label:'English', dir:'ltr' }, { id:'es', label:'Español', dir:'ltr' },
                                    { id:'ru', label:'Русский', dir:'ltr' }, { id:'he', label:'עברית', dir:'rtl' }]);
export function detectLang(search, stored, navLang)  // '?lang=xx' → stored → navLang prefix → 'en'; unknown ids fall to the next source
export function setLang(id)      // sync; sets document.documentElement.lang and dir; unknown id → 'en'
export function getLang()        // current id
export function isRTL()          // boolean
export function t(key, params)   // '{name}' interpolation; fallback current → en → key
export function applyDom(root)   // [data-i18n] → textContent, [data-i18n-aria] → aria-label, [data-i18n-title] → title, [data-i18n-placeholder] → placeholder
export function formatMoney(n)   // Intl.NumberFormat(lang, {maximumFractionDigits:0}); '$' prefix; negative as '−$1,234' wrapped in an LTR isolate (U+2066…U+2069) so the sign leads in RTL text
export function formatInt(n)
export function monthName(m)     // t('month.'+m)
export function formatDate(clock) // t('date.fmt', { d: day, m: monthName(month), y: year })
```
All four dictionaries live in this file as flat objects `{ 'key': 'string' }` with the **identical key set** (§5). `en` is authoritative.

### 3.8 `js/ui.js` (C)
```js
export function createUI(api)   // wires the static DOM of index.html; builds toolbar buttons from TOOL_ORDER, skin/lang/overlay selects
// api (GameApi, implemented by main) = {
//   newCity({ name }), continueCity(), loadShared(),
//   setTool(tool), setSpeed(n), togglePause(), setTax(n), setSkin(id), setLang(id), setOverlay(id),
//   zoomBy(factor), centerMap(), select(i|null),
//   save(), load(), exportCode(): string, importCode(text): boolean, copyCode(): Promise<boolean>, copyLink(): Promise<boolean>,
//   getCity(): City|null, getView(): View,
// }
// UI = {
//   showLanding({ meta: SaveMeta|null, hasShared: boolean }), hideLanding(),   // #app is `inert` while the landing is shown
//                                     // HUD/toolbar/zoom buttons refocus the canvas after a click; closing a panel that holds focus does too
//   update(city, view),               // HUD (cash/pop/jobs/approval face/date/RCI bars with aria-valuenow), speed & tool & overlay aria-pressed,
//                                     // debt banner, inspector (if view.selected), budget panel (if open) — called ≤ 10 Hz by main and after actions
//   toast(key, params?, kind?: 'info'|'warn'|'error'),   // max 3 stacked, 3.5 s, aria-live region
//   setPriceBadge(sx, sy, text|null), // DOM badge near the pointer; null hides
//   openPanel(id: 'inspector'|'budget'|'help'|'save'|null), isPanelOpen(id?): boolean (any panel, or that panel when id is given),
//   confirm(key, params?): Promise<boolean>,             // <dialog>-based, keyboard accessible
//   applySkin(id),                    // sets CSS vars --ui-bg --ui-panel --ui-fg --ui-accent from SKINS[id].ui; data-skin on <body>
//   relabel(),                        // applyDom + rebuild dynamic labels (lang change)
// }
```
Inspector content for `view.selected`: coordinates; terrain/road/lot/building line; residents or jobs; power/water/access status; land value; pollution; services list; for zoned tiles the block line `t('inspect.whyNot', {reason: t('block.'+block)})` or `t('inspect.growing')`, followed by the hint (`hint.<block>`; for `power` use `hint.powerCapacity` when `stats.powerUse > stats.powerCap`, for `water` likewise, for `demand` use `hint.demand.<zone>`). For a service: name, radius, upkeep. Budget panel: tax slider (`#tax-slider`, step 1), last month income/upkeep/interest/net, power/water use vs cap, `budget.waiting` from `stats.blockCounts`, debt lines, 60-month cash sparkline on `#budget-spark` (240×48 canvas drawn by ui). Save panel: Save/Load buttons, read-only `<textarea id="share-code">`, Copy code, Copy link, import textarea + Import button, sharing note. Help panel: controls, keys, how-to text, legend swatches, blocker colour legend. Toolbar buttons: `title`/`aria-label` = tool name + cost + key.

**DOM id contract** (index.html; used by ui, main and tests): `#app`, `#landing`, `#landing-name`, `#btn-new`, `#btn-continue`, `#btn-continue-meta`, `#btn-shared`, `#game-canvas`, `#hud-cash`, `#hud-pop`, `#hud-jobs`, `#hud-approval`, `#hud-date`, `#rci-r`, `#rci-c`, `#rci-i`, `#speed-0`..`#speed-3`, `#toolbar` (buttons `button[data-tool]`), `#overlay-select`, `#skin-select`, `#lang-select`, `#btn-help`, `#btn-save-panel`, `#btn-zoom-in`, `#btn-zoom-out`, `#btn-center`, `#panels`, `#panel-inspector`, `#panel-budget`, `#panel-help`, `#panel-save`, `#panel-close`, `#tax-slider`, `#tax-value`, `#budget-spark`, `#debt-banner`, `#share-code`, `#btn-copy-code`, `#btn-copy-link`, `#share-import`, `#btn-import`, `#btn-save`, `#btn-load`, `#price-badge`, `#toasts[aria-live=polite]`, `#confirm` (`<dialog aria-labelledby="confirm-text">`).

**Layout** (`css/style.css`): CSS variables `--ui-bg --ui-panel --ui-fg --ui-accent` (+ RCI colours r `#4caf50`, c `#2f80ed`, i `#f2994a`). Desktop ≥ 900 px: grid `header / [toolbar 64px | canvas 1fr | panels 320px]`, `100dvh`, `body{overflow:hidden}`. Phone < 900 px: header in two rows (title+date+speed / cash+pop+face+RCI mini bars), canvas fills, toolbar as a horizontally scrollable bottom strip of ≥ 44×44 buttons (`padding-bottom: env(safe-area-inset-bottom)`), panels as a bottom sheet above the tool strip (`inset-block-end: var(--toolbar-h)`, `max-height: calc(55vh - var(--toolbar-h))`) so tools stay tappable while a sheet is open; stat labels stay visible at 9 px (title tooltips do not exist on touch). Zoom +/−/centre buttons float bottom-end over the canvas. Canvas `display:block; width:100%; height:100%; touch-action:none`. Logical properties only (`margin-inline-*`, `inset-inline-*`, `text-align:start`) so `dir=rtl` just works; RCI bars grow from `inline-start`. `:focus-visible{outline:3px solid var(--ui-accent)}`. `@media (prefers-reduced-motion: reduce){ *{transition:none!important; animation:none!important} }`. No horizontal scroll at 360 px (`html{overscroll-behavior:none}`).

### 3.9 `js/main.js` (integrator) — exact duties
```
boot():
  1. settings = loadSettings(); lang = detectLang(location.search, settings.lang, navigator.language); setLang(lang); applyDom(document)
  2. camera = createCamera(); renderer = createRenderer(#game-canvas, camera); view = { playing:false, tool:'pan', overlay:'none',
     hover:null, cursor:null, drag:null, ghost:null, selected:null, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches }
  3. ui = createUI(api); ui.applySkin(settings.skin); renderer.setSkin(settings.skin)
  4. input = createInput(canvas, camera, handlers); input.setEnabled(false)
  5. ResizeObserver on canvas → renderer.resize(); initial resize
  6. sharedCode = codeFromHash(location.hash); ui.showLanding({ meta: metaOf(newestLocalKey()), hasShared: !!sharedCode })
  7. addEventListener visibilitychange/pagehide → autosave()
  8. requestAnimationFrame(loop)

startCity(c, { fromLink }):
  city = c; city.skin = SKINS[city.skin] ? city.skin : settings.skin; sim.recomputeDerived(city); city.dirty.all = true; city.fromLink = !!fromLink
  camera.fitMap(); renderer.setSkin(city.skin); ui.applySkin(city.skin); view.playing = true; view.tool = 'pan'; view.selected = null
  input.setEnabled(true); ui.hideLanding(); ui.update(city, view); toast 'toast.welcome' (or 'share.loaded' when fromLink)

api.newCity({name}): city = sim.createCity({ name: name || 'Main City', seed: (Math.random()*2**32)>>>0, skin: settings.skin }); startCity
api.continueCity(): r = loadLocal(newestLocalKey()); ok → startCity else toast r.error
api.loadShared(): r = decodeShare(sharedCode); ok → startCity(fromLink) + clearHash() else toast 'share.invalid'
api.setTool(t): view.tool = t; view.drag = null; refreshGhost(); ui.update
api.setSpeed / togglePause → sim.*; ui.update          api.setTax(n) → sim.setTaxRate; ui.update
api.setSkin(id): city.skin = id; settings.skin = id; saveSettings; renderer.setSkin(id); ui.applySkin(id)
api.setLang(id): setLang(id); saveSettings({lang:id}); ui.relabel(); ui.update
api.setOverlay(id): view.overlay = id; ui.update       api.zoomBy(f): camera.zoomAt(f, vw/2, vh/2)   api.centerMap(): camera.fitMap()
api.select(i): view.selected = i; ui.openPanel(i == null ? null : 'inspector'); ui.update
api.save(): saveLocal(KEYS.MANUAL, city) ? toast 'save.saved' : toast 'save.failed'
api.load(): await ui.confirm('save.confirmLoad') → loadLocal(KEYS.MANUAL) → startCity
api.exportCode(): encodeShare(city)        api.importCode(text): decodeShare → startCity(fromLink) ; return ok
api.copyCode/copyLink(): navigator.clipboard.writeText(...) → true/false (ui shows 'share.copied' / 'share.copyFailed')

handlers.onHover(t): view.hover = t; refreshGhost(); price badge via camera.tileToScreen
handlers.onTap(x,y): kind pan/inspect → api.select(idx) (pan tool also selects); kind single → applyAt(toolTiles(city, tool, x,y,x,y));
                     kind line/rect never receives taps (input turns them into drags)
handlers.onLongPress(x,y): api.select(idx(x,y))
handlers.onDrag(phase,x0,y0,x1,y1): start/move → view.drag = {...}; refreshGhost(); end → applyAt(toolTiles(...)); view.drag = null; cancel → view.drag = null; refreshGhost()
handlers.onCommand(cmd): tool → api.setTool; zoneCycle → api.setTool(cycleZoneTool(view.tool)); pause → togglePause; speed → setSpeed;
   cancel → view.drag=null, api.setTool('pan'), ui.openPanel(null), api.select(null); overlayCycle → next of OVERLAY_ORDER; help → ui.openPanel(ui.isPanelOpen('help') ? null : 'help') (always brings Help up, even over another panel);
   cursorMove → view.cursor = clamp((cursor ?? centre tile) + d); if off-screen camera.centerOn(cursor); refreshGhost();
   cursorApply → applyAt(toolTiles(city, tool, cx,cy,cx,cy)) or api.select for pan/inspect; save → api.save()
handlers.onCameraChange(): refresh price badge position

applyAt(tiles): r = sim.applyTool(city, view.tool, tiles); if (!r.ok && (tiles.length === 1 || r.error !== ERR.NOTHING)) ui.toast(r.error,{},'warn');
               refreshGhost(); ui.update(city, view)
refreshGhost(): shape = view.drag ?? (view.hover ?? view.cursor as a 1-tile shape); view.ghost = shape ? sim.preview(city, view.tool, sim.toolTiles(...)) : null;
               ui.setPriceBadge(..., ghost && ghost.cost ? formatMoney(ghost.cost) : null)

loop(now): dt = min(now − last, FRAME_DT_CLAMP); last = now
  input.update(dt)
  if (view.playing) { for (e of sim.advance(city, dt)) handleEvent(e) }
  renderer.draw(view.playing ? city : null, view, now)
  if (view.playing && now − lastUi ≥ 100) { ui.update(city, view); lastUi = now }
  requestAnimationFrame(loop)

handleEvent(e): month → autosave() (no toast); 'firstHouse' → toast; 'fire' → toast warn {x,y};
  debt/debtCleared/servicesCut/servicesRestored → toast warn/info; powerShort/waterShort with on:true → toast warn; grow/decline → nothing
autosave(): if (view.playing && !city.fromLink) saveLocal(KEYS.AUTOSAVE, city)
```
`window.MC = { city: () => city, sim, view }` is exposed only when `location.search` contains `debug=1` (used by tests). main also registers `window.addEventListener('error', …)` → `ui.toast('err.unexpected', {}, 'error')`.

---

## 4. Save format & share code

### 4.1 `SaveV1`
```json
{ "v": 1, "name": "Main City", "seed": 123456789, "rng": 987654321, "w": 40, "h": 40,
  "tiles": "12.3t#rR2S~...", "buildings": [["power", 10, 12], ["park", 14, 9]],
  "cash": 18450, "tax": 9, "clock": [3, 2, 1, 1, 1], "skin": "grassland",
  "debtMonths": 0, "cut": false, "pop": 240,
  "history": [[1, 1, 160, 19200, 144, 230]], "savedAt": 1761590400000 }
```
- `clock` = `[day, month, year, speed, lastSpeed]`; `history` entries = `[month, year, pop, cash, income, expenses]`.
- **Tile string**: row-major, one char per tile with run-length prefix (decimal count before the char, emitted only for runs ≥ 2). Alphabet: `~` water · `.` grass · `t` tree · `#` road · `r c i` zoned level 0 · `R C I` level 1 · `S D J` level 2 · `T E K` level 3 · `@` service footprint tile (id comes from `buildings`). Example `"3.#2R"` = three grass, a road, two level-1 R.
- `deserialize` validation: object, `v` integer; `v > SAVE_VERSION` → `ERR.VERSION`; `v < SAVE_VERSION` → run `MIGRATIONS[v]` chain (empty today); `w`,`h` = 40; tile string expands to exactly `w*h` with known chars only; every building id in `BUILDINGS`, footprint in bounds, every footprint tile is `@` and not already stamped; every `@` is covered by some building; finite numbers; `tax` 0–20; `speed` 0–3; `skin` in `SKINS` else `DEFAULT_SKIN`; `name` string ≤ 40 chars (else "Main City"). Failure → `ERR.SAVE`. Derived fields are never trusted/saved; `starve` resets to 0.
- `metaOf` reads `name`, `pop`, `clock[1..2]`, `savedAt` from the stored JSON without rebuilding a city.

### 4.2 Share code
`'MC1.' + base64url(utf8(JSON.stringify(compact)))` where `compact` = SaveV1 without `history` and `savedAt`. base64url = standard base64 with `+/` → `-_`, no padding; via `TextEncoder` + `btoa` (and the reverse). No compression: RLE keeps a 40×40 city at ≈ 600–2,500 chars, safe for URL hashes and chat. `decodeShare` accepts a bare code, a code with surrounding whitespace, or a full URL (extracts after `#c=`); prefix must match `/^MC(\d+)\./`. A city opened from a link or import has `fromLink = true` and is not autosaved until the player makes a change (first `ok` action clears the flag) — so trying a friend's city never destroys your own autosave.

### 4.3 Storage
Keys in `KEYS`. Every `localStorage` access is in try/catch; failures return `false`/`null`. Settings: `{ lang, skin }`.

---

## 5. i18n key list (identical in en/es/ru/he; English values are the reference)

```
app.title "Main City"                          app.tagline "Build a city on your own, right in your browser."
landing.new "New city"  landing.continue "Continue"  landing.openShared "Open shared city"  landing.name "City name"
landing.continueMeta "{name} · {pop} people · {date}"   landing.noSave "No saved city yet"
hud.cash "Cash"  hud.pop "Population"  hud.jobs "Jobs"  hud.approval "Approval"  hud.date "Date"  hud.demand "Demand"
hud.r "R"  hud.c "C"  hud.i "I"
speed.0 "Pause"  speed.1 "Normal speed"  speed.2 "Fast"  speed.3 "Fastest"
tool.pan "Pan"  tool.inspect "Inspect"  tool.road "Road"  tool.zone_r "Residential zone"  tool.zone_c "Commercial zone"
tool.zone_i "Industrial zone"  tool.bulldoze "Bulldoze"  tool.power "Power plant"  tool.water "Water tower"  tool.park "Park"
tool.police "Police station"  tool.fire "Fire station"  tool.school "School"  tool.hospital "Hospital"
tool.cost "Cost: {n}"  tool.upkeep "Upkeep: {n}/month"  tool.radius "Radius: {n}"  tool.key "Key: {k}"
overlay.label "Overlay"  overlay.none "None"  overlay.power "Power"  overlay.water "Water"  overlay.value "Land value"
overlay.pollution "Pollution"  overlay.block "Growth blockers"
panel.inspector "Inspector"  panel.budget "Budget"  panel.help "Help"  panel.save "Save & share"  panel.close "Close"
inspect.none "Select a tile to inspect it."  inspect.coords "Tile {x}, {y}"  inspect.grass "Grass"  inspect.tree "Trees"
inspect.water "Water"  inspect.road "Road"  inspect.lot "{zone} lot (empty)"  inspect.building "{zone} building, level {level}"
zone.r "Residential"  zone.c "Commercial"  zone.i "Industrial"
inspect.residents "Residents: {n}"  inspect.jobs "Jobs: {n}"  inspect.powered "Powered"  inspect.unpowered "No power"
inspect.watered "Water supplied"  inspect.unwatered "No water"  inspect.access "Road access"  inspect.noAccess "No road access"
inspect.landValue "Land value: {n}"  inspect.pollution "Pollution: {n}"  inspect.services "Services: {list}"  inspect.noServices "Services: none"
inspect.whyNot "Not growing: {reason}"  inspect.growing "Growing"  inspect.service "{name} — radius {radius}, upkeep {upkeep}/month"
block.road "no road next to it"  block.power "no power"  block.water "no water"  block.demand "low demand"
block.value "land value too low"  block.pollution "too much pollution"  block.full "fully developed"
hint.road "Build a road touching this lot."  hint.power "Place a power plant within range."
hint.powerCapacity "Your power plants are overloaded — build another."  hint.water "Place a water tower within range (needed above level 1)."
hint.waterCapacity "Your water towers are overloaded — build another."  hint.demand.r "Residents need jobs — zone commercial or industrial."
hint.demand.c "Shops need customers — zone more residential."  hint.demand.i "Industry needs workers — zone residential, or add parks to cut pollution."
hint.value "Parks, schools and hospitals raise land value."  hint.pollution "Move industry away or add parks."  hint.full "This lot is at maximum level."
budget.tax "Tax rate: {n}%"  budget.lastMonth "Last month"  budget.income "Income"  budget.upkeep "Upkeep"  budget.interest "Interest"
budget.net "Net"  budget.power "Power: {use} / {cap}"  budget.water "Water: {use} / {cap}"  budget.history "Cash, last {n} months"
budget.debt "In debt: 1% interest per month, approval −10."  budget.cut "Below −$5,000: police, fire, schools, hospitals and parks are suspended."
budget.waiting "Lots waiting: {road} need a road, {power} need power, {water} need water, {demand} low demand, {value} low land value"
save.save "Save"  save.load "Load"  save.saved "City saved."  save.loaded "City loaded."  save.none "No saved city."
save.failed "Could not save — storage is unavailable."  save.confirmLoad "Load the saved city? Unsaved progress is lost."
save.confirmNew "Start a new city? The current city is lost unless saved."
share.title "Share"  share.code "City code"  share.copyCode "Copy code"  share.copyLink "Copy link"  share.import "Import"
share.paste "Paste a city code or link here"  share.copied "Copied to clipboard."  share.copyFailed "Copy failed — select the text and copy it manually."
share.invalid "That is not a valid Main City code."  share.loaded "Shared city loaded. It is not autosaved until you make a change."
share.note "Sharing is by city code or link only — there is no live multiplayer."
help.controls "Controls"  help.mouse "Mouse: left click or drag uses the tool, right or middle drag pans, wheel zooms."
help.touch "Touch: tap to place, drag with the Pan tool to move, pinch to zoom, two fingers always pan, long-press to inspect."
help.keys "R road · Z cycle zones · B bulldoze · I inspect · Space pause · 1/2/3 speed · Esc cancel · O overlay · H help · WASD pan · arrows move cursor · Enter build · +/− zoom · Ctrl+S save"
help.howTo "How to grow"
help.howToText "1. Draw roads. 2. Zone lots touching roads. 3. Power them with a plant in range. 4. Add a water tower for taller buildings. 5. Balance homes and jobs — watch the RCI bars. 6. Parks and schools raise land value."
help.legend "Legend"  help.legend.r "Residential — green"  help.legend.c "Commercial — blue"  help.legend.i "Industrial — orange"
help.legend.badges "Badges: lightning = no power, drop = no water, road sign = no road access"  help.blockers "Blocker overlay colours"
err.water "Can't build on water."  err.occupied "That spot is occupied."  err.money "Not enough money (limit −$10,000)."
err.bounds "Outside the map."  err.nothing "Nothing to do here."  err.save "The save data is damaged."
err.version "Made with a newer version of the game."  err.storage "Storage is unavailable in this browser."  err.unexpected "Something went wrong."
toast.welcome "Welcome to {name}! Draw a road and zone next to it."  toast.firstHouse "Your first residents moved in!"
toast.fire "Fire destroyed a building at {x}, {y}."  toast.debt "The city is in debt — interest is now charged."  toast.debtCleared "Out of debt."
toast.servicesCut "Services suspended for lack of funds."  toast.servicesRestored "Services restored."
toast.powerShort "Power shortage — build another plant."  toast.waterShort "Water shortage — build another tower."
skin.label "Map style"  skin.grassland "Grassland"  skin.desert "Desert"  skin.snow "Snow"  skin.night "Night"
lang.label "Language"
month.1 "Jan" … month.12 "Dec"   date.fmt "{m} {d}, year {y}"
ui.yes "Yes"  ui.no "No"  ui.ok "OK"  ui.cancel "Cancel"
a11y.canvas "City map. Pick a tool, move the cursor with the arrow keys and press Enter to build."
a11y.toolbar "Build tools"  a11y.speed "Game speed"  a11y.zoomIn "Zoom in"  a11y.zoomOut "Zoom out"  a11y.center "Fit map"
a11y.rci "{zone} demand {n} percent"  a11y.toasts "Notifications"  a11y.panels "Panels"
```
A key-set equality test across the four dictionaries is part of acceptance. Interpolation only uses `{name}`-style placeholders; avoid plurals by phrasing.

---

## 6. Order of operations summary

- **Per frame**: `input.update` → `sim.advance` (0–5 `stepDay`, each: derived → growth → clock → [month: derived, fires, budget]) → `handleEvent` → `renderer.draw` (bake dirty tiles, compose) → `ui.update` (≤ 10 Hz).
- **Per action**: pointer/key → `input` → `handlers` → `main.applyAt` → `sim.applyTool` (validate, charge, mutate, dirty, `recomputeDerived`) → toast on error → `refreshGhost` → `ui.update`. The next `draw` already shows the change; derived data (badges, inspector) is current even while paused.
- **Mutation ownership**: `sim.js` is the only writer of `tiles`, `buildings`, `cash`, `clock`, `stats`, `demand`, `grids`, `alerts`; `render.js` the only one clearing `dirty`; `main.js` the only writer of `view`, `city.skin`, `city.fromLink` (besides sim clearing it on an ok action); `ui.js`/`input.js` never touch `city`.

---

## 7. README requirements (integrator)
Title + tagline; play link placeholder (`https://<user>.github.io/<repo>/`); feature list; controls table (mouse/touch/keyboard); **"Sharing your city — by city code or link only; there is no live multiplayer and no server"**; languages via `?lang=en|es|ru|he`; skins; local development (`python3 -m http.server`, ES modules do not load from `file://`); deployment (GitHub Pages from the repo root, no build step, `.nojekyll`); one-line architecture map per module; license.

---

## 8. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Phone frame rate | Baked map, per-tile repaint, visible-rect culling, dpr cap 2, typed grids, no per-frame allocation/text, growth staggered 1/10 per day, derived recompute O(10k) ops |
| Touch paint vs pan | Pan is the default tool and the `Esc` target; two fingers always pan/zoom and cancel paints; right/middle mouse pans; long-press inspects; ghosts + price badge show the outcome before release |
| "Why doesn't it grow?" | Deterministic gate chain → `tile.block`, inspector hint, badges, Growth-blockers overlay, `budget.waiting` counts |
| Economy stalls/snowballs | All numbers in `BALANCE`; demand clamped ±1 with seeded positive R/I; water only gates level ≥ 2; soft debt ladder (interest → services cut → build floor), no game over; `?debug=1` exposes `MC` for tuning scripts |
| Save corruption / hostile codes | Versioned, exhaustively validated, migration chain; derived data never persisted; `textContent` only for names |
| Storage blocked | try/catch everywhere; toasts; share codes still work |
| Hash vs autosave | `fromLink` cities never autosave until edited; hash cleared after load |
| RTL | Logical CSS properties only; canvas has no text |
| Pages subpath / `file://` | Relative paths, `.nojekyll`; README documents serving |
| Line budget | Budgets per file in §0.3; data-driven buildings/skins/strings; one input pipeline; no sprites/effects systems |

---

## 9. Acceptance checklist (Playwright scripts live outside the repo; zero console errors / pageerrors throughout)
1. `/` shows landing with "Main City"; New city → canvas visible, `#hud-cash` = $20,000, date advances at 1×.
2. With `?debug=1`: place power plant, road, 6 adjacent R lots → within 3 months ≥ 1 lot level ≥ 1; a lot without road has `block === 'road'`; bulldoze the plant → levels fall within 2 months and `block === 'power'`.
3. No water tower → no lot exceeds level 1 after 6 months; add tower → some reach level 2 (with LV ≥ 35, e.g. a park nearby).
4. Tax 20 % → `demand.r` drops ≥ 0.6 vs 9 %. Cash below −5,000 → `servicesCut` true and badge/grey rendering; purchase refused below −10,000 with `err.money` toast.
5. Save, reload, Continue → identical tile string and cash. `encodeShare` → `decodeShare` round trip equal; `#c=` link offers "Open shared city", loads it, clears the hash, and does not autosave until an action.
6. `?lang=he` → `html[dir=rtl]`, Hebrew header; es/ru dictionaries have the same key set as en; no raw keys visible.
7. Viewport 360×740: `scrollWidth ≤ 360`, toolbar scrolls horizontally, all tool buttons ≥ 44 px.
8. Keys R/Z/B/I/Space/1/2/3/Esc/O change `aria-pressed`/speed/overlay; arrows + Enter build a road; 60 frames at 3× on a developed 40×40 map average < 16 ms.
9. Switching all four skins changes the canvas centre pixel and raises no errors.
10. Node determinism: import `js/sim.js` + `js/save.js`, run 365 `stepDay`s twice from the same deserialized save → identical `serialize` output.
