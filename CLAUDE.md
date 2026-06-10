# iolanthe-crew

Crew-facing PWA for Princess Iolanthe. Served at `/crew/` by `iolanthe-server`.
Accessible from the crew VLAN (10.33.3.0/24) and bridge VLAN (10.33.2.0/24).

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
