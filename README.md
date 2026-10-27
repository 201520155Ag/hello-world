# Main City

*Build a city on your own, right in your browser.*

Main City is a free, no-install city-builder that runs entirely in the browser. Draw roads,
zone land, keep the lights and water on, balance the budget and watch your town grow — on a
laptop or a phone. There is no server and nothing to download: the whole game is a static
web page.

**Play:** `https://<user>.github.io/<repo>/` (replace with your GitHub Pages address).

## Features

- 40 × 40 tile map with seeded terrain (grass, trees, water), rendered on a single canvas.
- Roads, residential / commercial / industrial zoning with an RCI demand model; lots grow
  into level 1–3 buildings when they have a road, power, water (above level 1), demand and
  enough land value.
- Service buildings with radius effects: power plant, water tower, park, police, fire station,
  school, hospital. Pollution, land value, coverage and approval are recomputed every day.
- Budget with tax rate, upkeep and interest; you can go into debt (interest, unhappy citizens,
  services suspended below −$5,000, building refused below −$10,000). No game over.
- Game clock with pause / 1× / 2× / 3×, day and month ticks, fires at month end.
- Overlays: power, water, land value, pollution, growth blockers. Every lot that is not
  growing tells you why in the Inspector.
- Four map styles: grassland, desert, snow, night — switchable at any time.
- Autosave, a manual save slot, and share codes / links.
- Four languages (English, Español, Русский, עברית with right-to-left layout).
- Keyboard, mouse and touch; works at 360 px wide; respects `prefers-reduced-motion`.

## How to play

1. Pick **Road** and drag to lay a road.
2. Zone **R**, **C** or **I** lots touching the road (drag a rectangle).
3. Place a **Power plant** within range (radius 10). Houses appear on powered lots.
4. Add a **Water tower** so buildings can grow past level 1.
5. Keep homes and jobs balanced — watch the R / C / I demand bars in the header.
6. Parks, schools and hospitals raise land value, which higher levels require.
7. Open **Budget** to set the tax rate and see income, upkeep and a cash history.

### Tools

| Tool | Cost | Notes |
|---|---|---|
| Pan / Inspect | — | Tap a tile to inspect it |
| Road | $10 | Upkeep $1/month; trees cost $3 extra to clear |
| Residential / Commercial / Industrial zone | $5 per tile | Level-0 lot |
| Bulldoze | $2 per tile | Clears roads, lots, trees and whole buildings |
| Power plant (2×2) | $2,500 | 400 power, radius 10, pollutes |
| Water tower | $600 | 150 water, radius 7 |
| Park | $150 | Radius 4, land value +20, pollution −20 on covered tiles |
| Police / Fire station (2×2) | $800 | Radius 8; fire cover cuts fire risk ×0.15 |
| School (2×2) | $1,000 | Radius 9, land value +10, boosts commercial demand |
| Hospital (2×2) | $1,500 | Radius 9, land value +8 |

### Controls

| Input | Action |
|---|---|
| Mouse | Left click / drag uses the tool; right or middle drag pans; wheel zooms |
| Touch | Tap to place; drag with the Pan tool to move; pinch to zoom; two fingers always pan; long-press to inspect |
| `R` / `Z` / `B` / `I` | Road · cycle zones · Bulldoze · Inspect |
| `Space`, `1` `2` `3` | Pause · speed 1× / 2× / 3× |
| `Esc` | Cancel: back to Pan, close panels |
| `O`, `H` | Cycle overlay · Help |
| `W A S D`, arrows, `Enter` | Pan · move the keyboard cursor · build at the cursor |
| `+` / `−` | Zoom |
| `Ctrl`/`Cmd` + `S` | Save |

## Map styles

Grassland (default), Desert, Snow and Night. The style is a palette only — change it from the
header at any time; it is remembered with your settings and stored in the save.

## Saving and sharing

- The game **autosaves** to your browser's local storage at every month end and when you leave
  the page. The landing screen's **Continue** button reopens the newest save.
- **Save & share** has one manual save slot (Save / Load) and a **city code**: a compact
  text string (`MC1.…`) that encodes the whole city. **Copy code** or **Copy link** and send it
  to a friend; they paste it into **Import**, or open the link (`…/#c=CODE`) and press
  **Open shared city**.
- A city opened from a link or code is not autosaved over your own city until you change
  something, so trying a friend's city never destroys yours.

**Sharing is by city code or link only — there is no live multiplayer and no server.**
Nothing ever leaves your browser.

## Languages

English is the default. Add `?lang=es`, `?lang=ru` or `?lang=he` to the URL, or use the
language switcher in the header. Hebrew switches the whole layout to right-to-left. Your
choice is remembered.

## Running locally

The game uses native ES modules, which browsers refuse to load from `file://`. Serve the
folder with any static server, for example:

```sh
python3 -m http.server 8123 --bind 127.0.0.1
# then open http://127.0.0.1:8123/
```

Add `?debug=1` to expose `window.MC = { city(), sim, view }` for tinkering.

## Deployment

Main City is a static site: no build step, no dependencies, no CDN. Publish the repository
root with GitHub Pages (Settings → Pages → deploy from branch). The empty `.nojekyll` file
keeps Pages from processing the files, and all paths are relative so project sub-paths work.

## Architecture

| File | Role |
|---|---|
| `index.html`, `css/style.css` | Static DOM shell, responsive layout, theme variables |
| `js/data.js` | Enums, tuning tables (`BALANCE`, `BUILDINGS`, `ZONE_LEVELS`), skins, factories |
| `js/sim.js` | Deterministic simulation: RNG, terrain, actions, derived grids, demand, growth, budget, clock |
| `js/camera.js` | Pan/zoom state and screen ↔ world ↔ tile conversions |
| `js/render.js` | Canvas renderer: baked map, dirty-tile repaint, overlays, ghosts, badges |
| `js/input.js` | Pointer, wheel and keyboard events → tool callbacks and camera moves |
| `js/ui.js` | HUD, toolbar, panels, toasts, dialogs |
| `js/i18n.js` | Translation table (en/es/ru/he) and formatting helpers |
| `js/save.js` | Save format, local storage, share codes and URL hash helpers |
| `js/main.js` | Entry point: game loop, state ownership, wiring between modules |

`docs/DESIGN.md` is the full design and architecture specification.

## License

MIT
