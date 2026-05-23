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

  // ── NMEA / telemetry poll ─────────────────────────────────────────────────
  const dataAgeEl = document.getElementById('dataAge');
  const routeCard = document.getElementById('routeCard');

  async function fetchTelemetry() {
    try {
      const res  = await fetch('/api/nmea');
      if (!res.ok) throw new Error(res.status);
      const data = await res.json();

      const pos = data.position || {};
      const nav = data.navigation || {};
      const wind = data.wind || {};
      const route = data.route || {};

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

    } catch (_) {
      dataAgeEl.textContent = 'Cannot reach server';
      dataAgeEl.className = 'data-age error';
    }
  }

  fetchTelemetry();
  setInterval(fetchTelemetry, 3000);

  // ── Charter info ──────────────────────────────────────────────────────────
  const charterNameEl  = document.getElementById('charterName');
  const charterDetail  = document.getElementById('charterDetail');

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

      if (d.name) {
        charterNameEl.textContent = d.name;
      }

      const fields = [
        ['Charter', d.name],
        ['Principal', d.principal_name],
        ['Start', d.start_date],
        ['End',   d.end_date],
        ['Vessel', d.vessel_name],
        ['Area',  d.area],
        ['Guests', d.guest_count != null ? String(d.guest_count) : null]
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

  // ── Service worker ────────────────────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/crew/sw.js')
      .catch(() => { /* silently fail offline */ });
  }

}());
