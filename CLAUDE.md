# iolanthe-crew

Crew-facing PWA for Princess Iolanthe. Served at `/crew/` by `iolanthe-server`.
Accessible from the crew VLAN (10.33.3.0/24) and bridge VLAN (10.33.2.0/24).

> **Status (2026-10-14): not developed and not in use.** The crew site is an early sketch: nobody on board relies on it
> yet, so it is not a release target. Keep changes to it minimal (only what a cross-site change such as spec T needs);
> do not spend effort on polish, versioned assets or hardening here until David decides to develop it.

## Architecture position

```
iolanthe-server  (serves /crew/* from CREW_STATIC_DIR)
        ↓
iolanthe-crew  (index.html, crew.css, crew.js, sw.js)
        ↓  API calls (all relative URLs)
/api/nmea  /api/charter  /api/charter/watches
```

## Tabs

| Tab | ID | Data source |
|-----|----|-------------|
| Navigation | `nav` | `/api/nmea` — polls every 3 s; `/api/track` — polls every 30 s |
| Watches | `watches` | `/api/charter/watches` |
| Charter | `charter` | `/api/charter` |
| Weather | `weather` | `/api/weather` — polls every 30 min |

The Navigation tab includes a Leaflet satellite map (Esri tiles via CDN) with live vessel position, heading-rotated marker, and the shared track line from `/api/track`.

## Stack

- Plain HTML, CSS, JavaScript — no build step, no framework, no npm
- `crew.css` — dark navy theme, tablet/desktop-friendly
- `crew.js` — IIFE, all client-side logic
- `sw.js` — service worker for offline shell caching

## Running locally

```powershell
# In the iolanthe-server repo:
$env:DATA_DIR="$PWD\data-local"
$env:GUEST_STATIC_DIR="..\..\portal\iolanthe-guest"
$env:ADMIN_STATIC_DIR="..\..\portal\iolanthe-admin"
$env:CREW_STATIC_DIR="..\..\portal\iolanthe-crew"
node server.js
```

Then open `http://localhost:8000/crew/`.

## Path conventions

All asset paths use the `/crew/` prefix so they resolve correctly when served
from `CREW_STATIC_DIR` by `iolanthe-server`:

```
/crew/crew.css
/crew/crew.js
/crew/sw.js
/crew/manifest.webmanifest
```

## Wording (spec T, Trip mode)

Every visible "charter", "APA", "client", "agent" or "proposal" word is read from the vessel's wording map, never typed
in code, so a private boat can run in `trip` mode. `wording.js` (UMD: the browser and `node --test` share it) is the
helper: `w(key, { plural, lower, vars })`. The server sends `wording` (the vessel's mode already resolved) and
`vessel_mode` in the `/api/charter` payload that `fetchCharter` reads; `setWording(d.wording)` stores it and
`applyStatic(document)` fills every `data-w="<key>"` element (the Charter tab, the "Active Charter" heading). A missing
map or key uses `BUILT_IN`, the charter copy of every key this site uses, so charter mode looks exactly as before and
nothing shows a raw key or a blank. The words load once per page load: a mode change shows after a reload.

- New visible word: add the key to `BUILT_IN` (the charter text, exactly as it was), use `w('key')` in code or
  `data-w="key"` in `index.html` (leave the element empty), and give the server plan's table (iolanthe-server
  `wording.json`) all four strings. `test/wording-wiring.test.js` fails on an unknown or unused key.
- `test/trip-guard.test.js` fails on a visible commercial word typed in any root `.js`/`.html` file (`wording.js`
  excepted). Its `ALLOW_LIST` is empty and must stay empty.
- Tests need no install: `cd <repo> && node --test test/*.test.js`.

## Service worker cache

Bump `CACHE` version in `sw.js` whenever static assets change.
Never cache `/api/*` routes — telemetry and charter data must always
come from the network.

## Key constraints

- No build step. No npm. No dependencies.
- All API calls use relative URLs.
- Keep all asset paths prefixed with `/crew/`.

## Deployment (docker-vm)

`iolanthe-server` bind-mounts `./iolanthe-crew:/static/crew:ro` in the
vessel compose file. Updates:

```bash
cd /opt/projects/vessel/iolanthe-crew && git pull
# No container restart needed — bind-mount serves live files
```
