(function () {
  'use strict';

  // ── Tab navigation ────────────────────────────────────────────────────────
  const tabBtns   = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  function activateTab(id) {
    tabBtns.forEach(btn => {
      const active = btn.dataset.tab === id;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === 'tab-' + id);
    });
    if (id === 'nav') invalidateMapSize();
  }

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => activateTab(btn.dataset.tab));
  });

  // ── UTC clock ─────────────────────────────────────────────────────────────
  const clockEl = document.getElementById('utcClock');
  function tickClock() {
    const now = new Date();
    clockEl.textContent =
      now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }
  tickClock();
  setInterval(tickClock, 1000);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function fmt(val, decimals = 1) {
    if (val == null) return '—';
    return Number(val).toFixed(decimals);
  }

  function fmtLatLon(lat, lon) {
    if (lat == null || lon == null) return '—';
    const latStr = Math.abs(lat).toFixed(4) + '° ' + (lat >= 0 ? 'N' : 'S');
    const lonStr = Math.abs(lon).toFixed(4) + '° ' + (lon >= 0 ? 'E' : 'W');
    return latStr + '\n' + lonStr;
  }

  function fmtTtg(minutes) {
    if (minutes == null) return '—';
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  function fmtEta(isoStr) {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    } catch (_) { return isoStr; }
  }

  function set(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ── DOM builder ───────────────────────────────────────────────────────────
  function el(tag, attrs, children) {
    attrs = attrs || {};
    children = children || [];
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    });
    children.forEach(child => {
      if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else if (child) node.appendChild(child);
    });
    return node;
  }

  function safeText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number' && !Number.isFinite(value)) return '';
    if (typeof value === 'object' || typeof value === 'function') return '';
    const text = String(value).trim();
    const lower = text.toLowerCase();
    if (!text || lower === 'null' || lower === 'undefined' || lower === 'nan') return '';
    return text;
  }

  function replaceChildren(node) {
    const kids = Array.prototype.slice.call(arguments, 1);
    if (!node) return;
    if (typeof node.replaceChildren === 'function') {
      node.replaceChildren.apply(node, kids);
      return;
    }
    while (node.firstChild) node.removeChild(node.firstChild);
    kids.forEach(child => {
      if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else if (child) node.appendChild(child);
    });
  }

  // ── Compass helpers ───────────────────────────────────────────────────────
  const COMPASS_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const CARDINAL_DIRS = ['N','NE','E','SE','S','SW','W','NW'];

  function toCompass(degrees) {
    if (!Number.isFinite(degrees)) return '—';
    const norm = ((degrees % 360) + 360) % 360;
    return COMPASS_DIRS[Math.round(norm / 22.5) % COMPASS_DIRS.length];
  }

  function degreesToCardinal(deg) {
    if (deg === null || deg === undefined || isNaN(deg)) return null;
    return CARDINAL_DIRS[Math.round(Number(deg) / 45) % 8];
  }

  // ── NMEA / telemetry poll ─────────────────────────────────────────────────
  const dataAgeEl = document.getElementById('dataAge');
  const routeCard = document.getElementById('routeCard');

  async function fetchTelemetry() {
    try {
      const res  = await fetch('/api/nmea');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      const pos   = data.position   || {};
      const nav   = data.navigation || {};
      const wind  = data.wind       || {};
      const route = data.route      || {};

      set('tv-position', fmtLatLon(pos.latitude, pos.longitude));
      set('tv-cog',  fmt(nav.course_over_ground_deg, 1));
      set('tv-sog',  fmt(nav.speed_over_ground_knots, 1));
      set('tv-hdg',  fmt(nav.heading_true_deg, 1));
      set('tv-depth', fmt(nav.depth_m, 1));
      set('tv-rot',  fmt(nav.rate_of_turn_deg_per_min, 1));

      const awa = wind.apparent_angle_deg != null
        ? fmt(wind.apparent_angle_deg, 0) + ' / ' + fmt(wind.apparent_speed_knots, 1)
        : '—';
      set('tv-awa', awa);

      const twd = wind.true_direction_deg != null
        ? fmt(wind.true_direction_deg, 0) + ' / ' + fmt(wind.true_speed_knots, 1)
        : '—';
      set('tv-twd', twd);

      // Data age indicator
      const age = data.age_seconds;
      if (age == null) {
        dataAgeEl.textContent = 'No SignalK data';
        dataAgeEl.className = 'data-age warn';
      } else if (age > 30) {
        dataAgeEl.textContent = `SignalK data ${Math.round(age)}s old`;
        dataAgeEl.className = 'data-age error';
      } else {
        dataAgeEl.textContent = `Updated ${Math.round(age)}s ago`;
        dataAgeEl.className = 'data-age';
      }

      // Route panel
      if (route.active) {
        routeCard.classList.add('visible');
        set('rv-dest', route.destination_waypoint_id || '—');
        set('rv-dtw',  fmt(route.distance_to_waypoint_nm, 2));
        set('rv-btw',  fmt(route.bearing_to_waypoint_true_deg, 1));
        set('rv-xte',  fmt(route.cross_track_error_nm, 3));
        set('rv-cv',   fmt(route.closing_velocity_knots, 1));
        set('rv-ttg',  fmtTtg(route.ttg_minutes));
        set('rv-eta',  fmtEta(route.eta_utc));
      } else {
        routeCard.classList.remove('visible');
      }

      // Update the moving map
      if (pos.latitude != null && pos.longitude != null) {
        const heading = Number.isFinite(nav.heading_true_deg)
          ? nav.heading_true_deg
          : (Number.isFinite(nav.course_over_ground_deg) ? nav.course_over_ground_deg : null);
        syncMap(pos.latitude, pos.longitude, heading);
      }

    } catch (_) {
      dataAgeEl.textContent = 'Cannot reach server';
      dataAgeEl.className = 'data-age error';
    }
  }

  fetchTelemetry();
  setInterval(fetchTelemetry, 3000);

  // ── Charter info ──────────────────────────────────────────────────────────
  const charterNameEl = document.getElementById('charterName');
  const charterDetail = document.getElementById('charterDetail');

  function renderCharterField(label, value) {
    if (!value) return '';
    return `<div class="charter-field">
      <span class="charter-field-label">${label}</span>
      <span class="charter-field-value">${value}</span>
    </div>`;
  }

  async function fetchCharter() {
    try {
      const res = await fetch('/api/charter');
      if (!res.ok) return;
      const d = await res.json();

      if (d.name) charterNameEl.textContent = d.name;

      const fields = [
        ['Charter',   d.name],
        ['Principal', d.principal_name],
        ['Start',     d.start_date],
        ['End',       d.end_date],
        ['Vessel',    d.vessel_name],
        ['Area',      d.area],
        ['Guests',    d.guest_count != null ? String(d.guest_count) : null]
      ];

      charterDetail.innerHTML = fields
        .map(([label, value]) => renderCharterField(label, value))
        .join('');
    } catch (_) { /* keep blank */ }
  }

  fetchCharter();

  // ── Watch schedule ────────────────────────────────────────────────────────
  const watchList = document.getElementById('watchList');

  function isCurrentWatch(watch) {
    try {
      const now = new Date();
      const [startTime] = (watch.period || '').split('–');
      if (!watch.date || !startTime) return false;
      const start = new Date(`${watch.date}T${startTime.replace(/(\d{2})(\d{2})/, '$1:$2')}:00Z`);
      const end   = new Date(start.getTime() + 4 * 60 * 60 * 1000);
      return now >= start && now < end;
    } catch (_) { return false; }
  }

  async function fetchWatches() {
    try {
      const res = await fetch('/api/charter/watches');
      if (!res.ok) return;
      const d = await res.json();
      const watches = Array.isArray(d.watches) ? d.watches : [];

      if (!watches.length) {
        watchList.innerHTML = '<p class="watch-empty">No watch schedule set for this charter.</p>';
        return;
      }

      watchList.innerHTML = watches.map(w => {
        const current = isCurrentWatch(w) ? ' current-watch' : '';
        const crew    = Array.isArray(w.crew) ? w.crew.join(', ') : (w.crew || '');
        const notes   = w.notes
          ? `<span class="watch-notes">${w.notes}</span>`
          : '';
        return `<div class="watch-row${current}">
          <span class="watch-date">${w.date || ''}</span>
          <span class="watch-period">${w.period || ''}</span>
          <span class="watch-crew">${crew}</span>
          ${notes}
        </div>`;
      }).join('');
    } catch (_) { /* keep blank */ }
  }

  fetchWatches();

  // ── Moving map ────────────────────────────────────────────────────────────
  const MAP_MIN_ZOOM    = 9;
  const MAP_MAX_ZOOM    = 18;
  const MAP_DEFAULT_ZOOM = 11;
  const MAP_TILE_ERROR_THRESHOLD = 4;
  const MAP_TILE_ERROR_WINDOW_MS = 2000;
  const MAP_ZOOM_COOLDOWN_MS     = 2000;
  const MAP_UNAVAILABLE_MSG = 'Map detail unavailable offshore at this zoom level';

  const unavailableZooms = new Set();

  let mapNav = {
    map:            null,
    marker:         null,
    trackLine:      null,
    tileLayer:      null,
    initialized:    false,
    hasCentered:    false,
    followVessel:   true,
    lastHeading:    null,
    trackPoints:    [],
    tileRecovery: {
      errorTimestampsByZoom: new Map(),
      lastHandledByZoom:     new Map(),
      lastCorrectionAt:      0,
      programmaticZooms:     0,
      listenersBound:        false
    }
  };

  function createSatelliteTileLayer() {
    return window.L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: 'Tiles &copy; Esri', minZoom: MAP_MIN_ZOOM, maxZoom: MAP_MAX_ZOOM }
    );
  }

  function createVesselIcon() {
    return window.L.divIcon({
      className: 'nav-vessel-marker',
      html: '<div class="nav-vessel-shell">' +
            '<div class="nav-vessel-pulse"></div>' +
            '<div class="nav-vessel-ship"><div class="nav-vessel-shape"></div></div>' +
            '</div>',
      iconSize:   [56, 56],
      iconAnchor: [28, 28]
    });
  }

  function applyVesselHeading() {
    if (!mapNav.marker) return;
    const markerEl = mapNav.marker.getElement();
    if (markerEl) {
      markerEl.style.setProperty(
        '--vessel-heading',
        Number.isFinite(mapNav.lastHeading) ? `${mapNav.lastHeading}deg` : '0deg'
      );
    }
  }

  function setMapPlaceholder(title, message) {
    const mapNode = document.getElementById('navigationMap');
    if (!mapNode || mapNav.initialized) return;
    mapNode.innerHTML = '';
    mapNode.appendChild(el('div', { class: 'nav-map-placeholder' }, [
      el('div', {}, [
        el('strong', {}, [title]),
        el('div', { class: 'nav-map-placeholder-msg' }, [message])
      ])
    ]));
  }

  function getMapNoticeNode() {
    return document.getElementById('mapUnavailableNotice');
  }

  function setMapNotice(message) {
    const notice = getMapNoticeNode();
    if (!notice) return;
    const text = typeof message === 'string' ? message.trim() : '';
    notice.hidden = !text;
    notice.textContent = text;
  }

  function syncMapNotice() {
    if (!mapNav.map) { setMapNotice(''); return; }
    const zoom = mapNav.map.getZoom();
    setMapNotice(unavailableZooms.has(Math.round(zoom)) ? MAP_UNAVAILABLE_MSG : '');
  }

  function getFollowBtn() {
    return document.getElementById('mapFollowBtn');
  }

  function isMapCenteredOnVessel() {
    if (!mapNav.map || !mapNav.marker || !mapNav.hasCentered) return true;
    const center = mapNav.map.getCenter();
    const pos    = mapNav.marker.getLatLng();
    const px = mapNav.map.latLngToContainerPoint(center);
    const py = mapNav.map.latLngToContainerPoint(pos);
    return Math.abs(px.x - py.x) < 6 && Math.abs(px.y - py.y) < 6;
  }

  function syncFollowButton() {
    const btn = getFollowBtn();
    if (!btn) return;
    const shouldShow = mapNav.hasCentered && !mapNav.followVessel && !isMapCenteredOnVessel();
    btn.hidden = !shouldShow;
    btn.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  }

  function clampZoom(zoom) {
    const parsed = Number(zoom);
    if (!Number.isFinite(parsed)) return MAP_DEFAULT_ZOOM;
    let effective = MAP_MIN_ZOOM;
    unavailableZooms.forEach(z => { if (z >= effective) effective = z + 1; });
    effective = Math.max(MAP_MIN_ZOOM, effective);
    return Math.max(effective, Math.min(MAP_MAX_ZOOM, Math.round(parsed)));
  }

  function markZoomUnavailable(zoom) {
    const z = Math.round(Number(zoom));
    if (!Number.isFinite(z)) return;
    unavailableZooms.add(z);
  }

  function handleTileError(event) {
    if (!mapNav.map || !mapNav.tileRecovery) return;
    const map      = mapNav.map;
    const recovery = mapNav.tileRecovery;
    const curZoom  = Math.round(map.getZoom());
    const evtZoom  = event && event.coords && Number.isFinite(event.coords.z)
      ? Math.round(event.coords.z)
      : curZoom;
    if (evtZoom !== curZoom) return;

    const now = Date.now();
    const ts  = (recovery.errorTimestampsByZoom.get(curZoom) || [])
      .filter(t => now - t <= MAP_TILE_ERROR_WINDOW_MS);
    ts.push(now);
    recovery.errorTimestampsByZoom.set(curZoom, ts);

    if (ts.length < MAP_TILE_ERROR_THRESHOLD) {
      if (unavailableZooms.has(curZoom)) setMapNotice(MAP_UNAVAILABLE_MSG);
      return;
    }

    const lastHandled = recovery.lastHandledByZoom.get(curZoom) || 0;
    if (now - lastHandled < MAP_ZOOM_COOLDOWN_MS) {
      setMapNotice(MAP_UNAVAILABLE_MSG);
      return;
    }

    recovery.lastHandledByZoom.set(curZoom, now);
    markZoomUnavailable(curZoom);

    if (now - recovery.lastCorrectionAt < MAP_ZOOM_COOLDOWN_MS) {
      setMapNotice(MAP_UNAVAILABLE_MSG);
      return;
    }
    recovery.lastCorrectionAt = now;

    const nextZoom = clampZoom(curZoom + 1);
    if (nextZoom !== curZoom) {
      recovery.programmaticZooms += 1;
      map.setZoom(nextZoom, { animate: false });
    } else {
      setMapNotice(MAP_UNAVAILABLE_MSG);
    }
  }

  function bindTileRecovery(tileLayer) {
    if (!mapNav.map || mapNav.tileRecovery.listenersBound) return;
    mapNav.tileRecovery.listenersBound = true;
    const map      = mapNav.map;
    const recovery = mapNav.tileRecovery;

    tileLayer.on('tileerror', event => { handleTileError(event); });
    tileLayer.on('tileload',  () => {
      if (!unavailableZooms.has(Math.round(map.getZoom()))) setMapNotice('');
    });
    map.on('zoomend', () => {
      if (recovery.programmaticZooms > 0) { recovery.programmaticZooms -= 1; }
      syncMapNotice();
    });
  }

  function invalidateMapSize() {
    if (mapNav.map) mapNav.map.invalidateSize(false);
  }

  function initMap() {
    if (mapNav.map) return mapNav.map;
    const mapNode = document.getElementById('navigationMap');
    if (!mapNode) return null;
    if (!window.L || typeof window.L.map !== 'function') {
      setMapPlaceholder('Map library unavailable',
        'Load this page once while online so Leaflet can cache.');
      return null;
    }

    mapNode.innerHTML = '';

    const map = window.L.map(mapNode, {
      zoomControl: false,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      worldCopyJump: true
    });

    const tileLayer = createSatelliteTileLayer();
    tileLayer.addTo(map);
    window.L.control.zoom({ position: 'topleft' }).addTo(map);

    const trackLine = window.L.polyline([], {
      color:       '#d94a43',
      weight:      3,
      opacity:     0.88,
      smoothFactor: 0,
      noClip:      true
    }).addTo(map);

    const marker = window.L.marker([0, 0], {
      icon:     createVesselIcon(),
      keyboard: false
    }).addTo(map);
    marker.bindTooltip('Princess Iolanthe', { direction: 'top', offset: [0, -12] });

    map.on('dragstart', () => {
      mapNav.followVessel = false;
      syncFollowButton();
    });
    map.on('moveend', () => { syncFollowButton(); });

    const followBtn = getFollowBtn();
    if (followBtn && !followBtn.dataset.bound) {
      followBtn.dataset.bound = 'true';
      followBtn.addEventListener('click', () => {
        mapNav.followVessel = true;
        if (mapNav.marker) {
          const pos = mapNav.marker.getLatLng();
          map.panTo(pos, { animate: true, duration: 0.6 });
        }
        syncFollowButton();
      });
    }

    mapNav.map       = map;
    mapNav.marker    = marker;
    mapNav.trackLine = trackLine;
    mapNav.tileLayer = tileLayer;
    mapNav.initialized = true;

    bindTileRecovery(tileLayer);
    syncMapNotice();
    syncFollowButton();

    // Draw any track points collected before map was ready
    if (mapNav.trackPoints.length) {
      trackLine.setLatLngs(mapNav.trackPoints.map(p => [p.lat, p.lng]));
    }

    return map;
  }

  function syncMap(latitude, longitude, heading) {
    mapNav.lastHeading = heading;

    if (!mapNav.initialized) {
      const map = initMap();
      if (!map) {
        setMapPlaceholder('Waiting for map library', 'Load the page online to cache Leaflet.');
        return;
      }
    }

    if (!mapNav.map) return;

    mapNav.marker.setLatLng([latitude, longitude]);
    applyVesselHeading();

    if (!mapNav.hasCentered) {
      const zoom = clampZoom(MAP_DEFAULT_ZOOM);
      mapNav.map.setView([latitude, longitude], zoom, { animate: false });
      mapNav.hasCentered = true;
    } else if (mapNav.followVessel) {
      mapNav.map.panTo([latitude, longitude], { animate: true, duration: 0.8 });
    }

    syncFollowButton();
    invalidateMapSize();
  }

  // ── Track polling ─────────────────────────────────────────────────────────
  async function fetchTrack() {
    try {
      const res = await fetch('/api/track');
      if (!res.ok) return;
      const data = await res.json();
      const points = Array.isArray(data.points) ? data.points : [];
      mapNav.trackPoints = points.filter(
        p => Number.isFinite(p.lat) && Number.isFinite(p.lng)
      );
      if (mapNav.trackLine) {
        mapNav.trackLine.setLatLngs(mapNav.trackPoints.map(p => [p.lat, p.lng]));
      }
    } catch (_) { /* track is optional */ }
  }

  fetchTrack();
  setInterval(fetchTrack, 30000);

  // ── Weather ───────────────────────────────────────────────────────────────
  const WEATHER_API_URL = '/api/weather';
  const WEATHER_POLL_MS = 30 * 60 * 1000;

  const HOURLY_WIND_DIR_FIELDS = [
    'wind_direction_10m', 'wind_direction', 'winddirection',
    'wind_dir', 'winddir', 'wind_dir_10m', 'winddirection_10m',
    'windDirection', 'windDirection10m', 'winddirDegree',
    'wind_dir_degree', 'wind_direction_deg'
  ];

  const MOON_PHASE_BASE = '/assets/moon-phases';
  const MOON_PHASE_IMGS = [
    'new-moon-000.png', 'waxing-cres-125.png', 'first-quarter-250.png',
    'waxing-gib-375.png', 'full-moon-500.png', 'waning-gib-625.png',
    'last-quarter-750.png', 'waning-cres-875.png'
  ];

  let weatherState = { loading: true, data: null, error: '', moon: null };

  // Formatters
  function formatTemperature(v) {
    return Number.isFinite(v) ? `${Math.round(v)}°C` : '—';
  }

  function formatPercent(v) {
    return Number.isFinite(v) ? `${Math.round(v)}%` : '—';
  }

  function formatWeatherWind(v) {
    if (!Number.isFinite(v)) return '—';
    const knots = v / 1.852;
    return `${knots.toFixed(knots < 10 ? 1 : 0)} kts`;
  }

  function formatPrecipitation(v) {
    return Number.isFinite(v) ? `${v.toFixed(v < 10 ? 1 : 0)} mm` : '—';
  }

  function formatWeatherWindDirection(v) {
    if (!Number.isFinite(v)) return '';
    return `${toCompass(v)} ${Math.round(v)}°T`;
  }

  function formatCoordinate(v, pos, neg) {
    if (!Number.isFinite(v)) return '—';
    return `${Math.abs(v).toFixed(3)}° ${v >= 0 ? pos : neg}`;
  }

  function formatClock(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(d);
  }

  function formatDayLabel(v) {
    if (!v) return '—';
    const d = new Date(v);
    if (isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    }).format(d);
  }

  function describeWeatherCode(code, isDay) {
    const label = {
      0:  isDay === 0 ? 'Clear night' : 'Clear sky',
      1:  'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast',
      45: 'Fog',          48: 'Rime fog',
      51: 'Light drizzle', 53: 'Drizzle',        55: 'Dense drizzle',
      56: 'Freezing drizzle', 57: 'Heavy freezing drizzle',
      61: 'Light rain',   63: 'Rain',            65: 'Heavy rain',
      66: 'Freezing rain', 67: 'Heavy freezing rain',
      71: 'Light snow',   73: 'Snow',            75: 'Heavy snow',
      77: 'Snow grains',
      80: 'Light showers', 81: 'Showers',        82: 'Heavy showers',
      85: 'Snow showers', 86: 'Heavy snow showers',
      95: 'Thunderstorm', 96: 'Thunderstorm and hail', 99: 'Severe thunderstorm and hail'
    }[code];
    return label || '—';
  }

  function buildWeatherWindValue(current) {
    const src   = current && typeof current === 'object' ? current : {};
    const speed = formatWeatherWind(src.wind_speed_10m);
    const dir   = formatWeatherWindDirection(src.wind_direction_10m);
    if (speed.includes('kts') && dir) return `${speed} / ${dir}`;
    return speed.includes('kts') ? speed : (dir || '—');
  }

  function buildWeatherGustDetail(current) {
    const src = current && typeof current === 'object' ? current : {};
    return Number.isFinite(src.wind_gusts_10m)
      ? `Gusts ${formatWeatherWind(src.wind_gusts_10m)}`
      : '';
  }

  // Moon helpers
  function moonPhaseImageForPhase(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return '';
    let phase = Math.abs(n) > 1 && Math.abs(n) <= 100 ? n / 100 : n;
    phase %= 1;
    if (phase < 0) phase += 1;
    return `${MOON_PHASE_BASE}/${MOON_PHASE_IMGS[Math.round(phase * 8) % 8]}`;
  }

  function normalizeMoon(value) {
    const src = value && typeof value === 'object' ? value : {};
    const phase = Number(src.phase);
    const illumination = Number(src.illumination);
    const phaseName = safeText(src.phase_name || src.phaseName);
    const image = safeText(src.image) || moonPhaseImageForPhase(phase);
    if (!Number.isFinite(phase) && !phaseName && !image) return null;
    return {
      phase: Number.isFinite(phase) ? phase : null,
      phaseName: phaseName || 'Moon Phase',
      illumination: Number.isFinite(illumination)
        ? Math.max(0, Math.min(100, Math.round(illumination))) : null,
      image
    };
  }

  function getWeatherMoon(payload) {
    const src = payload && typeof payload === 'object' ? payload : {};
    return normalizeMoon(src.moon)
      || normalizeMoon(src.current_position && src.current_position.data && src.current_position.data.moon)
      || null;
  }

  // Hourly helpers
  function getHourlyValue(hourly, index, fields) {
    const src = hourly && typeof hourly === 'object' ? hourly : {};
    for (const field of fields) {
      const values = src[field];
      const raw    = Array.isArray(values) ? values[index] : undefined;
      if (raw === null || raw === undefined || raw === '') continue;
      const n = Number(raw);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }

  function getHourlyRows(forecast) {
    if (!forecast || !forecast.hourly || !Array.isArray(forecast.hourly.time)) return [];
    const hourly  = forecast.hourly;
    const current = forecast.current && forecast.current.time
      ? forecast.current.time : hourly.time[0];
    const todayKey = current.split('T')[0];
    const startIndex = Math.max(0, hourly.time.findIndex(t => t >= current));
    const rows = [];

    for (let i = startIndex; i < hourly.time.length; i++) {
      if (!hourly.time[i].startsWith(todayKey)) break;
      if (i !== startIndex && (i - startIndex) % 3 !== 0) continue;
      rows.push({
        time:                       hourly.time[i],
        weather_code:               hourly.weather_code ? hourly.weather_code[i] : null,
        temperature_2m:             hourly.temperature_2m ? hourly.temperature_2m[i] : null,
        precipitation_probability:  hourly.precipitation_probability ? hourly.precipitation_probability[i] : null,
        wind_speed_10m:             hourly.wind_speed_10m ? hourly.wind_speed_10m[i] : null,
        wind_direction:             getHourlyValue(hourly, i, HOURLY_WIND_DIR_FIELDS)
      });
    }
    return rows.slice(0, 8);
  }

  // Render functions
  function renderWeatherStat(label, value, detail) {
    return el('div', { class: 'w-stat' }, [
      el('div', { class: 'w-stat-label' }, [label]),
      el('strong', { class: 'w-stat-value' }, [value]),
      ...(detail ? [el('div', { class: 'w-stat-detail' }, [detail])] : [])
    ]);
  }

  function renderHourlyWindCell(row) {
    const src       = row && typeof row === 'object' ? row : {};
    const dir       = Number.isFinite(src.wind_direction) ? src.wind_direction : null;
    const cardinal  = degreesToCardinal(dir);
    const speed     = formatWeatherWind(src.wind_speed_10m);
    const children  = [];
    const attrs     = {};

    if (cardinal && Number.isFinite(dir)) {
      const norm    = ((dir % 360) + 360) % 360;
      attrs.title   = `Wind: ${String(Math.round(norm)).padStart(3, '0')}° (${cardinal})`;
    }
    if (Number.isFinite(src.wind_speed_10m)) {
      children.push(el('span', { class: 'w-wind-speed' }, [speed]));
    }
    if (cardinal) {
      children.push(el('span', { class: 'w-wind-dir' }, [cardinal]));
    }
    if (!children.length) children.push(speed);

    return el('td', attrs, children);
  }

  function renderHourlyTable(forecast) {
    const rows  = getHourlyRows(forecast);
    const table = el('table', { class: 'w-hourly-table' });
    const thead = el('thead', {}, [
      el('tr', {}, [
        el('th', {}, ['Time']),
        el('th', {}, ['Conditions']),
        el('th', {}, ['Temp']),
        el('th', {}, ['Rain']),
        el('th', {}, ['Wind'])
      ])
    ]);
    const tbody = el('tbody');

    rows.forEach(row => {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, [formatClock(row.time)]),
        el('td', {}, [describeWeatherCode(row.weather_code, 1)]),
        el('td', {}, [formatTemperature(row.temperature_2m)]),
        el('td', {}, [formatPercent(row.precipitation_probability)]),
        renderHourlyWindCell(row)
      ]));
    });

    if (!rows.length) {
      tbody.appendChild(el('tr', {}, [
        el('td', { colspan: '5' }, ['No hourly data available for the rest of today.'])
      ]));
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    return table;
  }

  function renderForecastGrid(forecast) {
    const daily = forecast && forecast.daily ? forecast.daily : null;
    const cards = [];

    if (daily && Array.isArray(daily.time)) {
      for (let i = 1; i < Math.min(daily.time.length, 6); i++) {
        cards.push(el('div', { class: 'w-day-card' }, [
          el('div', { class: 'w-day-label' }, [formatDayLabel(daily.time[i])]),
          el('strong', { class: 'w-day-value' }, [describeWeatherCode(daily.weather_code[i], 1)]),
          el('div', { class: 'w-day-detail' }, [
            `High ${formatTemperature(daily.temperature_2m_max[i])} · Low ${formatTemperature(daily.temperature_2m_min[i])}`
          ]),
          el('div', { class: 'w-day-detail' }, [
            `Rain ${formatPercent(daily.precipitation_probability_max[i])} · ${formatPrecipitation(daily.precipitation_sum[i])}`
          ]),
          el('div', { class: 'w-day-detail' }, [
            `Max wind ${formatWeatherWind(daily.wind_speed_10m_max[i])}`
          ])
        ]));
      }
    }

    return el('div', { class: 'w-forecast-grid' }, cards.length
      ? cards
      : [el('div', { class: 'w-day-card' }, ['Forecast unavailable.'])]);
  }

  function renderMoonImage(moon) {
    const src = normalizeMoon(moon);
    if (!src || !src.image) return null;
    const img = el('img', {
      class:          'w-moon-image',
      src:            src.image,
      alt:            '',
      'aria-hidden':  'true',
      loading:        'lazy',
      decoding:       'async'
    });
    img.addEventListener('error', () => { img.hidden = true; });
    return img;
  }

  function renderWeatherPanel() {
    const content = document.getElementById('weatherContent');
    if (!content) return;

    if (weatherState.loading) {
      replaceChildren(content,
        el('div', { class: 'w-card' }, [
          el('p', { class: 'w-muted' }, ['Checking the onboard weather cache…'])
        ])
      );
      return;
    }

    if (!weatherState.data) {
      replaceChildren(content,
        el('div', { class: 'w-card' }, [
          el('h2', { class: 'card-heading' }, ['Weather']),
          el('p', { class: 'w-muted' }, [
            safeText(weatherState.error) || 'Weather data is not available right now.'
          ])
        ])
      );
      return;
    }

    const data      = weatherState.data;
    const forecast  = data.forecast || {};
    const current   = forecast.current || {};
    const daily     = forecast.daily  || {};
    const today     = describeWeatherCode(current.weather_code, current.is_day);
    const sourceText = safeText(data.source) || 'Onboard weather cache';
    const updatedClock = data.updatedAt ? formatClock(data.updatedAt) : '';
    const tzText    = safeText(forecast.timezone).replace(/_/g, ' ');

    const heroChildren = [
      el('h2', { class: 'card-heading' }, ['Weather']),
    ];

    // Moon image (absolute positioned)
    const moonImg = renderMoonImage(weatherState.moon || (data && data.moon));
    if (moonImg) heroChildren.push(moonImg);

    // Location
    if (data.coords) {
      heroChildren.push(el('p', { class: 'w-location' }, [
        formatCoordinate(data.coords.latitude, 'N', 'S') + ' ' +
        formatCoordinate(data.coords.longitude, 'E', 'W')
      ]));
    }

    // Pills
    const pills = [];
    pills.push(el('span', { class: 'w-pill' }, [`Source: ${sourceText}`]));
    if (updatedClock) pills.push(el('span', { class: 'w-pill' }, [`Updated ${updatedClock}`]));
    if (tzText)       pills.push(el('span', { class: 'w-pill' }, [`Timezone: ${tzText}`]));
    heroChildren.push(el('div', { class: 'w-pills' }, pills));

    // Current conditions hero
    heroChildren.push(el('div', { class: 'w-hero' }, [
      el('div', { class: 'w-temp-now' }, [formatTemperature(current.temperature_2m)]),
      el('div', {}, [
        el('strong', { class: 'w-condition' }, [today]),
        el('div', { class: 'w-muted' }, [`Feels like ${formatTemperature(current.apparent_temperature)}`])
      ])
    ]));

    // Stats row
    heroChildren.push(el('div', { class: 'w-stat-grid' }, [
      renderWeatherStat('Humidity',      formatPercent(current.relative_humidity_2m)),
      renderWeatherStat('Wind',          buildWeatherWindValue(current), buildWeatherGustDetail(current)),
      renderWeatherStat('Precipitation', formatPrecipitation(current.precipitation)),
      renderWeatherStat('Cloud Cover',   formatPercent(current.cloud_cover))
    ]));

    // Today summary line
    heroChildren.push(el('p', { class: 'w-today-line' }, [
      `Today: ${formatTemperature(daily.temperature_2m_min ? daily.temperature_2m_min[0] : null)}` +
      ` to ${formatTemperature(daily.temperature_2m_max ? daily.temperature_2m_max[0] : null)}` +
      ` · Sunrise ${formatClock(daily.sunrise ? daily.sunrise[0] : '')}` +
      ` · Sunset ${formatClock(daily.sunset ? daily.sunset[0] : '')}`
    ]));

    const heroCard = el('div', { class: 'w-card w-hero-card' }, heroChildren);

    // Forecast grid card
    const forecastCard = el('div', { class: 'w-card' }, [
      el('h3', { class: 'card-heading' }, ['5-Day Outlook']),
      renderForecastGrid(forecast)
    ]);

    // Hourly table card
    const hourlyCard = el('div', { class: 'w-card' }, [
      el('h3', { class: 'card-heading' }, ["Today's Hourly Detail"]),
      renderHourlyTable(forecast)
    ]);

    replaceChildren(content, heroCard, forecastCard, hourlyCard);
  }

  function extractWeatherClientData(entry) {
    const src = entry && typeof entry === 'object' ? entry : {};
    const location = src.location && typeof src.location === 'object' ? src.location : {};
    const lat = Number(location.latitude);
    const lon = Number(location.longitude);
    const forecast = src.data && typeof src.data === 'object' ? src.data : null;
    return {
      coords: {
        latitude:  Number.isFinite(lat) ? lat : null,
        longitude: Number.isFinite(lon) ? lon : null,
        label:     safeText(location.label),
        source:    safeText(location.source)
      },
      forecast,
      moon:      normalizeMoon(forecast && forecast.moon),
      source:    safeText(src.source || location.source) || 'Onboard weather cache',
      updatedAt: safeText(src.last_success_at || src.last_attempt_at),
      error:     src.status === 'rate_limited'
        ? 'Weather service temporarily rate limited. Showing last successful update.'
        : safeText(src.message)
    };
  }

  async function fetchWeather() {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let res;
      try {
        res = await fetch(WEATHER_API_URL, { cache: 'no-store', signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }
      if (!res.ok) throw new Error(`Weather returned ${res.status}`);
      const payload = await res.json();

      const rawCurrent = extractWeatherClientData(payload.current_position);
      const rawNext    = extractWeatherClientData(payload.next_stop_forecast);
      const data = (rawCurrent && rawCurrent.forecast) ? rawCurrent
        : (rawNext && rawNext.forecast) ? rawNext : null;
      const moon = getWeatherMoon(payload)
        || (rawCurrent && rawCurrent.moon)
        || (rawNext && rawNext.moon);

      weatherState = { loading: false, data, error: '', moon };
    } catch (err) {
      weatherState = {
        loading: false,
        data:    weatherState.data,  // keep last good data
        error:   err && err.message ? err.message : 'Unable to reach weather service.',
        moon:    weatherState.moon
      };
    }

    renderWeatherPanel();
  }

  fetchWeather();
  setInterval(fetchWeather, WEATHER_POLL_MS);

  // ── Service worker ────────────────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/crew/sw.js')
      .catch(() => { /* silently fail offline */ });
  }

}());
