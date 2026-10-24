// Quy hoạch Đà Nẵng 2050 — ứng dụng tra cứu vị trí cho môi giới.
// Phụ thuộc: Leaflet, esri-leaflet, Turf, proj4 (CDN); QH_CONFIG (config.js); TIER, Z, RECLAIM, POI, LINES, TARGETS (data.js)
(function () {
  'use strict';
  const CFG = window.QH_CONFIG || {};
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const cut = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  };
  const isDesktop = () => window.matchMedia('(min-width:900px)').matches;

  // ---------- toast ----------
  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2400); }
  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg || 'Đã copy'); return true; }
    catch (_) {
      const ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch (_) {}
      ta.remove(); toast(ok ? (okMsg || 'Đã copy') : 'Không copy được, hãy bấm giữ để copy'); return ok;
    }
  }

  // ---------- bản đồ ----------
  const map = L.map('map', { zoomControl: false, tap: true, maxBoundsViscosity: 0.7 }).setView([16.04, 108.21], 12);
  map.setMaxBounds([[14.6, 106.8], [16.9, 109.5]]);
  const bases = {
    street: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Bản đồ © Esri, HERE, Garmin, OpenStreetMap' }),
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }),
    sat: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Ảnh © Esri' }),
    gray: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', { maxZoom: 16, attribution: '© Esri' }),
  };
  // khoá lưu mới (v2) để bỏ lựa chọn OSM cũ đã lưu trên máy người dùng
  let base = bases[store.get('qh_base2', 'street')] ? store.get('qh_base2', 'street') : 'street';
  bases[base].addTo(map);
  // nền bị chặn (nhiều tile lỗi, không tile nào tải được) → tự chuyển sang nền kế tiếp
  const FALLBACK = { osm: 'street', street: 'gray', gray: 'sat', sat: 'street' };
  Object.entries(bases).forEach(([k, layer]) => {
    let ok = 0, bad = 0;
    layer.on('tileload', () => { ok++; });
    layer.on('tileerror', () => {
      bad++;
      if (k !== base || bad < 6 || bad < ok * 2) return;
      const next = FALLBACK[k];
      bad = -1000; // chỉ chuyển một lần cho mỗi nền
      setBase(next, true);
    });
  });
  function setBase(k, auto) {
    if (!bases[k] || k === base) return;
    map.removeLayer(bases[base]); base = k; bases[base].addTo(map); bases[base].bringToBack();
    store.set('qh_base2', base);
    document.querySelectorAll('#base-seg button').forEach((x) => x.setAttribute('aria-pressed', x.dataset.base === base));
    if (auto) toast('Bản đồ nền không tải được, đã chuyển sang nền khác');
  }
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);

  const zoneLayer = L.layerGroup(), reclaimLayer = L.layerGroup(),
        infraLayer = L.layerGroup(), poiLayer = L.layerGroup();
  const polys = {}, pins = {};
  Z.forEach((z) => {
    const c = TIER[z.t].c;
    const p = L.polygon(z.poly, { color: c, weight: 2, fillColor: c, fillOpacity: 0.16, dashArray: z.t === 'c' ? '5 4' : null, bubblingMouseEvents: true });
    p.addTo(zoneLayer); polys[z.id] = p;
    const m = L.marker(p.getBounds().getCenter(), { icon: L.divIcon({ className: '', html: `<div class="zpin" style="background:${c}">${z.id}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }) });
    m.on('click', () => { showZoneOnMap(z.id); });
    m.addTo(zoneLayer); pins[z.id] = m;
  });
  RECLAIM.forEach((r) => L.polygon(r.poly, { color: '#0b5e86', weight: 2, dashArray: '3 3', fillColor: '#3aa7d8', fillOpacity: 0.4, bubblingMouseEvents: true }).addTo(reclaimLayer));
  LINES.forEach((l) => L.polyline(l.pts, { color: l.c, weight: 3.5, dashArray: l.d, opacity: 0.85, bubblingMouseEvents: true }).addTo(infraLayer));
  POI.forEach(([n, la, lo]) => L.circleMarker([la, lo], { radius: 5, color: '#fff', weight: 2, fillColor: '#16211f', fillOpacity: 1, bubblingMouseEvents: true })
    .bindTooltip(n, { permanent: true, direction: 'right', className: 'lbl poi', offset: [6, 0] }).addTo(poiLayer));
  function labels() { const on = map.getZoom() >= 12; $$('.lbl.poi').forEach((e) => e.classList.toggle('off', !on)); }
  map.on('zoomend', labels);

  // ---------- dữ liệu chính thức của Sở Xây dựng (ArcGIS REST) ----------
  const OFF = CFG.official || { layers: [] };
  const svcPath = (svc) => `${OFF.base}/${svc}/MapServer`;
  // Gọi thẳng máy chủ Sở bằng JSONP (ArcGIS hỗ trợ callback=), vì máy chủ chặn CORS và có thể chặn IP nước ngoài của proxy.
  let jsonpN = 0;
  function jsonp(url, params, timeout) {
    return new Promise((resolve, reject) => {
      const cb = `__qhjp${++jsonpN}_${Date.now().toString(36)}`;
      const sc = document.createElement('script');
      const qs = new URLSearchParams(Object.assign({}, params, { f: 'json', callback: cb }));
      const done = () => { clearTimeout(tm); window[cb] = () => {}; sc.remove(); };
      const tm = setTimeout(() => { done(); reject(new Error('timeout')); }, timeout || 15000);
      window[cb] = (data) => { done(); resolve(data); };
      sc.onerror = () => { done(); reject(new Error('jsonp')); };
      sc.src = `${url}?${qs}`;
      document.head.appendChild(sc);
    });
  }
  async function gis(path, params) {
    let j;
    try { j = await jsonp(OFF.host + path, params); }
    catch (e) {
      // dự phòng qua proxy /api/gis
      const qs = new URLSearchParams(params || {});
      const r = await fetch(`/api/gis?path=${encodeURIComponent(path)}&${qs}`);
      if (!r.ok) throw new Error('gis ' + r.status);
      j = await r.json();
    }
    if (!j || j.error) throw new Error('gis ' + ((j && j.error && j.error.message) || 'empty'));
    return j;
  }
  map.createPane('officialPane'); map.getPane('officialPane').style.zIndex = 380; // dưới lớp vector của app
  const officials = (OFF.layers || []).map((d) => {
    const layer = L.esri ? L.esri.dynamicMapLayer({ url: OFF.host + svcPath(d.service), opacity: d.opacity || 0.7, useCors: false, f: 'image',
      pane: 'officialPane', attribution: 'Quy hoạch © Sở Xây dựng Đà Nẵng' }) : null;
    return Object.assign({}, d, { layer, on: store.get('qh_off_' + d.id, !!d.on) });
  });
  function syncOfficial() {
    officials.forEach((o) => {
      if (!o.layer) return;
      const want = o.on && map.getZoom() >= (o.minZoom || 0);
      if (want && !map.hasLayer(o.layer)) o.layer.addTo(map); else if (!want && map.hasLayer(o.layer)) map.removeLayer(o.layer);
    });
    const qh = officials.find((o) => o.summary);
    Object.values(polys).forEach((p) => p.setStyle({ fillOpacity: qh && qh.on ? 0.04 : 0.16 }));
  }
  map.on('zoomend', syncOfficial);

  // ---------- bảng lớp ----------
  $('#legend').innerHTML = Object.values(TIER).map((t) => `<div><i style="background:${t.c}"></i>${t.n}</div>`).join('') +
    '<div><i style="background:#3aa7d8"></i>Khu lấn biển</div>';
  $('#btn-layers').addEventListener('click', (e) => { e.stopPropagation(); const p = $('#layers-panel'); p.hidden = !p.hidden; $('#btn-layers').setAttribute('aria-pressed', !p.hidden); });
  document.addEventListener('click', (e) => { const p = $('#layers-panel'); if (!p.hidden && !p.contains(e.target) && e.target.closest('#btn-layers') == null) { p.hidden = true; $('#btn-layers').setAttribute('aria-pressed', 'false'); } });
  $$('#base-seg button').forEach((b) => {
    b.setAttribute('aria-pressed', b.dataset.base === base);
    b.addEventListener('click', () => setBase(b.dataset.base));
  });
  // Các lớp vẽ minh hoạ (vùng đánh số, khu lấn biển, hạ tầng, điểm mốc): mặc định ẩn để chỉ thấy dữ liệu chính thức.
  // Mỗi lớp bật riêng trong bảng lớp; nút đa giác trên bản đồ bật/tắt tất cả.
  const ILLUS = {
    zones: { layer: zoneLayer, cb: 'ov-zones' },
    reclaim: { layer: reclaimLayer, cb: 'ov-reclaim' },
    infra: { layer: infraLayer, cb: 'ov-infra' },
    poi: { layer: poiLayer, cb: 'ov-poi' },
  };
  function syncIllusBtn() { $('#btn-zones').setAttribute('aria-pressed', Object.values(ILLUS).some((x) => map.hasLayer(x.layer))); }
  function setIllus(key, on) {
    const x = ILLUS[key];
    if (on) x.layer.addTo(map); else map.removeLayer(x.layer);
    $('#' + x.cb).checked = on; store.set('qh_ill_' + key, on); syncIllusBtn();
    if (key === 'poi') labels();
  }
  const setZones = (on) => setIllus('zones', on);
  Object.entries(ILLUS).forEach(([k, x]) => {
    setIllus(k, store.get('qh_ill_' + k, false));
    $('#' + x.cb).addEventListener('change', (e) => setIllus(k, e.target.checked));
  });
  $('#btn-zones').addEventListener('click', () => {
    const on = !Object.values(ILLUS).some((x) => map.hasLayer(x.layer));
    Object.keys(ILLUS).forEach((k) => setIllus(k, on));
    toast(on ? 'Đã hiện các lớp minh hoạ' : 'Đã ẩn các lớp minh hoạ');
  });
  // hàng bật/tắt cho từng lớp của Sở + chú giải tải khi mở bảng lớp
  officials.forEach((o) => {
    const row = el('label', 'chk');
    const cb = el('input'); cb.type = 'checkbox'; cb.id = 'ov-off-' + o.id; cb.checked = o.on;
    row.append(cb, document.createTextNode(' ' + o.name + (o.minZoom ? ' (phóng to để xem)' : '')));
    cb.addEventListener('change', () => { o.on = cb.checked; store.set('qh_off_' + o.id, o.on); syncOfficial(); });
    $('#ov-official').append(row);
    if (o.legend) { o.legendBox = el('div', 'oflegend'); o.legendBox.hidden = true; $('#ov-official').append(o.legendBox); }
  });
  const okImg = (ct, data) => /^image\/(png|jpeg|gif)$/.test(ct || '') && /^[A-Za-z0-9+/=]+$/.test(data || '');
  async function loadLegend(o) {
    if (o.legendLoaded || !o.legendBox) return;
    o.legendLoaded = true; o.legendBox.hidden = false; o.legendBox.textContent = 'Đang tải chú giải…';
    try {
      const j = await gis(svcPath(o.service) + '/legend', {});
      o.legendBox.replaceChildren(el('div', 'lp-h', 'Chú giải quy hoạch'));
      let n = 0;
      (j.layers || []).forEach((ly) => (ly.legend || []).forEach((it) => {
        if (n++ >= 60 || !okImg(it.contentType, it.imageData)) return;
        const r = el('div', 'lg-row'); const img = el('img'); img.alt = ''; img.src = `data:${it.contentType};base64,${it.imageData}`;
        r.append(img, el('span', null, it.label || ly.layerName || '')); o.legendBox.append(r);
      }));
      if (!n) o.legendBox.hidden = true;
    } catch (_) { o.legendBox.textContent = 'Không tải được chú giải.'; o.legendLoaded = false; }
  }
  $('#btn-layers').addEventListener('click', () => officials.forEach(loadLegend));

  // ---------- bottom sheet ----------
  const sheet = $('#sheet');
  function setSheet(state) { if (isDesktop()) return; sheet.dataset.state = state; sheet.style.removeProperty('--sheet-h'); }
  (function dragSheet() {
    let startY = 0, startH = 0, moved = false, dragging = false;
    const handles = [$('#grab'), $('.sh-head')];
    const onDown = (e) => {
      if (isDesktop() || e.target.closest('button,a,input')) return;
      dragging = true; moved = false; startY = e.clientY; startH = sheet.getBoundingClientRect().height;
      sheet.classList.add('dragging'); e.currentTarget.setPointerCapture(e.pointerId);
    };
    const onMove = (e) => {
      if (!dragging) return;
      const dy = startY - e.clientY; if (Math.abs(dy) > 4) moved = true;
      sheet.style.setProperty('--sheet-h', Math.max(90, startH + dy) + 'px');
    };
    const onUp = (e) => {
      if (!dragging) return; dragging = false; sheet.classList.remove('dragging');
      const h = sheet.getBoundingClientRect().height, vh = window.innerHeight;
      if (!moved) { setSheet(sheet.dataset.state === 'peek' ? 'half' : sheet.dataset.state === 'half' ? 'full' : 'peek'); return; }
      const dy = startY - e.clientY;
      if (h < vh * 0.32) setSheet(dy > 60 ? 'half' : 'peek');
      else if (h < vh * 0.72) setSheet(dy > 60 ? 'full' : dy < -60 ? 'peek' : 'half');
      else setSheet(dy < -60 ? 'half' : 'full');
    };
    handles.forEach((h) => { h.addEventListener('pointerdown', onDown); h.addEventListener('pointermove', onMove); h.addEventListener('pointerup', onUp); h.addEventListener('pointercancel', onUp); });
  })();

  // ---------- tab ----------
  function showTab(name) {
    const was = document.body.classList.contains('composing');
    document.body.classList.toggle('composing', name === 'post');
    if (was !== (name === 'post')) setTimeout(() => map.invalidateSize(), 300);
    $$('#tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name));
    ['place', 'post', 'saved', 'zones', 'facts'].forEach((t) => { $('#pane-' + t).hidden = t !== name; });
    $('#sh-body').scrollTop = 0;
    if (sheet.dataset.state === 'peek') setSheet('half');
  }
  $$('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ---------- phân tích vị trí ----------
  const VN2000 = '+proj=tmerc +lat_0=0 +lon_0=107.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 ' +
    '+towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs';
  const ll = (p) => [p[1], p[0]];
  const ring = (poly) => { const r = poly.map(ll); r.push(r[0]); return r; };
  const zonePolys = Z.map((z) => ({ z, f: turf.polygon([ring(z.poly)]) }));
  const reclaimPolys = RECLAIM.map((r) => ({ r, f: turf.polygon([ring(r.poly)]) }));
  const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`);
  const fmtNum = (n, d) => n.toLocaleString('vi-VN', { maximumFractionDigits: d || 0 });

  function analyze(lat, lng) {
    const p = turf.point([lng, lat]);
    const inZone = zonePolys.find((x) => turf.booleanPointInPolygon(p, x.f));
    let nearZone = null;
    if (!inZone) {
      let best = Infinity;
      zonePolys.forEach((x) => { const d = turf.pointToLineDistance(p, turf.polygonToLine(x.f), { units: 'kilometers' }); if (d < best) { best = d; nearZone = { z: x.z, km: d }; } });
    }
    const inReclaim = reclaimPolys.find((x) => turf.booleanPointInPolygon(p, x.f));
    const dist = TARGETS.map((t) => ({
      name: t.name,
      km: t.pt ? turf.distance(p, turf.point(ll(t.pt)), { units: 'kilometers' }) : turf.pointToLineDistance(p, turf.lineString(t.line.map(ll)), { units: 'kilometers' }),
    })).sort((a, b) => a.km - b.km).slice(0, 5);
    return { inZone: inZone && inZone.z, nearZone, inReclaim: inReclaim && inReclaim.r, dist };
  }
  const inDN = (lat, lng) => lat > 14.8 && lat < 16.6 && lng > 107.1 && lng < 109.2;

  // Đọc chuỗi người dùng nhập → {kind:'point'|'parcel'|'address'}
  function parseInput(raw) {
    const s = (raw || '').trim();
    if (!s) return { err: 'Bạn chưa nhập gì.' };
    if (/goo\.gl|maps\.app/i.test(s)) return { err: 'Link rút gọn của Google Maps không đọc được. Mở link, chạm giữ vào điểm để copy toạ độ rồi dán vào đây.' };
    const pc = s.match(/t[ờo]\s*(?:b[ảa]n\s*đ[ồo]\s*)?(?:s[ốo]\s*)?(\d{1,4})\D+?th[ửu]a\s*(?:s[ốo]\s*)?(\d{1,5})(.*)$/i);
    if (pc) return { kind: 'parcel', to: +pc[1], thua: +pc[2], xa: pc[3].replace(/^[\s,.-]+/, '').trim() };
    let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/[@=](-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (m) return point(+m[1], +m[2], 'WGS84');
    if (/^[\sXYxy:=,.;\d-]+$/.test(s)) {
      const nums = (s.match(/-?\d+(?:[.,]\d+)?/g) || []).map((n) => +n.replace(',', '.'));
      if (nums.length >= 2) {
        const [a, b] = nums;
        if (a > 1000 && b > 1000) {
          const X = Math.max(a, b), Y = Math.min(a, b);
          if (X < 1.5e6 || X > 2.0e6 || Y < 2e5 || Y > 9e5) return { err: 'Toạ độ VN2000 có vẻ không thuộc Đà Nẵng. Nhập dạng: X 1777000 Y 551000' };
          const [lng, lat] = proj4(VN2000, 'WGS84', [Y, X]);
          return point(lat, lng, 'VN2000');
        }
        if (a > 100 && b < 30) return point(b, a, 'WGS84');
        return point(a, b, 'WGS84');
      }
    }
    return { kind: 'address', q: s };
  }
  function point(lat, lng, src) { return inDN(lat, lng) ? { kind: 'point', lat, lng, src } : { err: 'Vị trí nằm ngoài khu vực Đà Nẵng.' }; }

  // ---------- địa chỉ (Nominatim, © OpenStreetMap) ----------
  const NOMI = 'https://nominatim.openstreetmap.org';
  const shortAddr = (a, display) => {
    if (!a) return display || '';
    const parts = [a.house_number && a.road ? `${a.house_number} ${a.road}` : a.road, a.quarter || a.suburb || a.village || a.neighbourhood, a.city_district || a.town || a.county, a.city || a.state];
    return parts.filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(', ') || display || '';
  };
  // Tìm địa chỉ: Esri World Geocoder trước (cùng nguồn bản đồ nền, gọi được trên mạng chặn OSM), rồi Nominatim, rồi Photon.
  const ESRI_GC = 'https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer';
  const DN_EXTENT = '107.1,14.8,109.2,16.6';
  const withTimeout = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
  async function getJSON(url) { const r = await fetch(url, { signal: withTimeout(9000) }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  const cleanEsri = (t) => String(t || '').replace(/,?\s*(Việt Nam|Vietnam|VNM)$/i, '').trim();

  async function reverse(lat, lng) {
    try {
      const j = await getJSON(`${ESRI_GC}/reverseGeocode?location=${lng},${lat}&langCode=VI&f=json`);
      const a = j.address || {};
      const t = cleanEsri(a.LongLabel || a.Match_addr || [a.Address, a.Neighborhood, a.District, a.City].filter(Boolean).join(', '));
      if (t) return t;
    } catch (_) {}
    try {
      const j = await getJSON(`${NOMI}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=vi`);
      return shortAddr(j.address, j.display_name);
    } catch (_) { return ''; }
  }

  const inArea = (x) => x.lat > 14.8 && x.lat < 16.6 && x.lng > 107.1 && x.lng < 109.2;
  async function geoEsri(q) {
    const u = `${ESRI_GC}/findAddressCandidates?SingleLine=${encodeURIComponent(q)}&countryCode=VNM&searchExtent=${DN_EXTENT}&location=108.2,16.05&maxLocations=8&langCode=VI&outFields=PlaceName,Addr_type,Score&f=json`;
    const j = await getJSON(u);
    return (j.candidates || []).filter((c) => c.score >= 60).map((c) => {
      const addr = cleanEsri(c.address);
      const name = (c.attributes && c.attributes.PlaceName) || addr.split(',')[0];
      return { lat: c.location.y, lng: c.location.x, title: name, sub: addr };
    });
  }
  async function geoNominatim(qq) {
    const j = await getJSON(`${NOMI}/search?format=jsonv2&q=${encodeURIComponent(qq)}&countrycodes=vn&viewbox=107.1,16.6,109.2,14.8&bounded=1&limit=6&addressdetails=1&accept-language=vi`);
    return j.map((x) => ({ lat: +x.lat, lng: +x.lon, title: x.name || shortAddr(x.address, x.display_name).split(',')[0], sub: shortAddr(x.address, x.display_name) }));
  }
  async function geoPhoton(qq) {
    const j = await getJSON(`https://photon.komoot.io/api/?q=${encodeURIComponent(qq)}&lat=16.05&lon=108.2&limit=6&bbox=${DN_EXTENT}`);
    return (j.features || []).map((f) => { const p = f.properties || {}; return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], title: p.name || [p.housenumber, p.street].filter(Boolean).join(' '), sub: [p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street, p.district, p.city].filter(Boolean).join(', ') }; });
  }
  // trả về { results, reached }: reached = có ít nhất một dịch vụ trả lời (để phân biệt "không tìm thấy" và "không kết nối được")
  async function geocode(q) {
    const qq = /đà nẵng|da nang|quảng nam|hội an|tam kỳ/i.test(q) ? q : q + ', Đà Nẵng';
    let reached = false;
    for (const fn of [() => geoEsri(qq), () => geoNominatim(qq), () => geoPhoton(qq)]) {
      try {
        const res = (await fn()).filter(inArea);
        reached = true;
        if (res.length) {
          const seen = new Set();
          return { results: res.filter((x) => { const k = x.lat.toFixed(4) + x.lng.toFixed(4); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6), reached };
        }
      } catch (_) {}
    }
    return { results: [], reached };
  }

  // ---------- lớp quy hoạch / thửa đất chính thức ----------
  const niceKey = (k) => k.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
  function attrRows(props) {
    return Object.entries(props || {}).filter(([k, v]) => v !== null && v !== '' && v !== 'Null' && !(CFG.hiddenField && CFG.hiddenField.test(k))).slice(0, 14);
  }
  // tóm tắt loại đất / chức năng từ kết quả identify
  function officialSummary(groups) {
    if (!Array.isArray(groups)) return '';
    for (const g of groups) {
      if (!g.o.summary || !g.feats || !g.feats.length) continue;
      const p = g.feats[0].properties || {};
      const vals = Object.keys(p)
        .filter((k) => /lo[aạ]i\s*đ[aấ]t|ch[ứu]c\s*n[aă]ng|m[ụu]c\s*đ[íi]ch|loai_?dat|chuc_?nang|muc_?dich|ten_?loai|k[ýy]\s*hi[ệe]u|ky_?hieu|kyhieu|ma_?loai/i.test(k) && !(CFG.hiddenField && CFG.hiddenField.test(k)))
        .map((k) => String(p[k]).trim()).filter((v) => v && v !== 'Null' && v !== ' ');
      if (vals.length) return [...new Set(vals)].slice(0, 2).join(' · ');
    }
    return '';
  }
  function renderOfficial(box, groups) {
    box.replaceChildren();
    if (groups === undefined || groups === null) return;
    if (groups === 'loading') {
      const c = el('div', 'official'); c.append(el('h4', null, 'Quy hoạch (Sở Xây dựng)'), el('p', 'muted', 'Đang tải dữ liệu quy hoạch…')); box.append(c); return;
    }
    const sum = officialSummary(groups);
    groups.forEach(({ o, feats, err }) => {
      const c = el('div', 'official'); c.append(el('h4', null, o.name));
      if (o.summary && sum) c.append(el('div', 'ofsum', sum));
      if (err) c.append(el('p', 'muted', 'Không kết nối được máy chủ của Sở. Thử lại sau.'));
      else if (!feats.length) c.append(el('p', 'muted', 'Không có dữ liệu tại điểm này.'));
      else feats.slice(0, o.maxShow || 2).forEach((f) => {
        if (f.layer && feats.length > 1) c.append(el('div', 'ofl', f.layer));
        const kv = el('div', 'kv');
        attrRows(f.properties).forEach(([k, v]) => kv.append(el('span', null, niceKey(k)), el('span', null, String(v))));
        c.append(kv);
      });
      box.append(c);
    });
    box.append(el('p', 'src', 'Nguồn: Cổng thông tin quy hoạch xây dựng Đà Nẵng. Chỉ để tham khảo, cần đối chiếu hồ sơ tại cơ quan có thẩm quyền.'));
  }
  const hasIdentify = () => officials.some((o) => o.identify);
  function identifyOfficial(lat, lng) {
    const targets = officials.filter((o) => o.identify);
    if (!targets.length) return Promise.resolve(null);
    const b = map.getBounds(), sz = map.getSize();
    const params = { geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', sr: '4326', layers: 'all', tolerance: '2',
      mapExtent: [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map((v) => v.toFixed(6)).join(','), imageDisplay: `${sz.x},${sz.y},96`, returnGeometry: 'false' };
    return Promise.all(targets.map(async (o) => {
      try { const j = await gis(svcPath(o.service) + '/identify', params); return { o, feats: (j.results || []).map((x) => ({ layer: x.layerName, properties: x.attributes })) }; }
      catch (_) { return { o, feats: [], err: true }; }
    }));
  }
  // tra tờ/thửa: tự dò lớp thửa và tên trường trong dịch vụ địa chính
  let parcelMeta = null;
  async function parcelInfo() {
    if (parcelMeta) return parcelMeta;
    const svc = svcPath(OFF.parcelService);
    const meta = await gis(svc, {});
    const leaves = (meta.layers || []).filter((l) => !l.subLayerIds);
    const ly = leaves.find((l) => /th[ửu]a|thua/i.test(l.name)) || leaves[0];
    if (!ly) throw new Error('nolayer');
    const fields = (await gis(`${svc}/${ly.id}`, {})).fields || [];
    const find = (re) => fields.find((f) => re.test(f.name) || re.test(f.alias || ''));
    const F = {
      layer: ly.id,
      to: find(/^(so_?)?to(_?ban_?do|bd)?$|^sh_?to|so_?to|tobando|sotobd|shbando|t[ờo]\s*b[ảa]n\s*đ[ồo]|s[ốo]\s*t[ờo]/i),
      thua: find(/thua|th[ửu]a/i),
      xa: find(/ten_?(phuong|xa)|ph[ưu][ờo]ng|x[ãa]\b|^xa$|tenxa/i),
      dientich: find(/dien_?tich|di[ệe]n\s*t[íi]ch|^dt$/i),
      loaidat: find(/loai_?dat|lo[ạa]i\s*đ[ấa]t|mdsd|m[ụu]c\s*đ[íi]ch|ky_?hieu/i),
    };
    if (!F.to || !F.thua) throw new Error('nofields');
    parcelMeta = F; return F;
  }
  // mã phường/xã 5 chữ số (dữ liệu địa chính dùng mã trước sáp nhập 7/2025) → tên
  const WARDS = window.QH_WARDS || {};
  const wardName = (v) => { const k = String(v == null ? '' : v).trim(); return WARDS[k] || ''; };
  const fold = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();
  async function queryParcel(to, thua, xa) {
    const F = await parcelInfo();
    const val = (f, v) => (/String/.test(f.type) ? `'${String(v | 0)}'` : String(v | 0));
    const where = `${F.to.name}=${val(F.to, to)} AND ${F.thua.name}=${val(F.thua, thua)}`;
    const j = await gis(`${svcPath(OFF.parcelService)}/${F.layer}/query`, { where, outFields: '*', returnGeometry: 'true', outSR: '4326' });
    let feats = (j.features || []).map((f) => ({ type: 'Feature', properties: f.attributes || {}, geometry: f.geometry && f.geometry.rings ? { type: 'Polygon', coordinates: f.geometry.rings } : null })).filter((f) => f.geometry);
    // lọc theo tên phường/xã người dùng gõ: so với các trường chữ và tên phường đổi từ mã
    const k = fold(xa).toLowerCase().replace(/^(p|x|phuong|xa)\.?\s+/, '');
    if (k) {
      const hit = feats.filter((f) => Object.values(f.properties).some((v) => v != null && (fold(v).toLowerCase().includes(k) || fold(wardName(v)).toLowerCase().includes(k))));
      if (hit.length) feats = hit; else feats.noMatch = true;
    }
    const out = feats.slice(0, 20); out.noMatch = !!feats.noMatch;
    return out;
  }

  // ---------- ghim ----------
  const pinIcon = L.divIcon({ className: '', html: '<div class="lotpin"></div>', iconSize: [26, 26], iconAnchor: [13, 31] });
  let pin = null, parcelShape = null;
  function placePin(lat, lng, zoom) {
    if (pin) pin.setLatLng([lat, lng]); else pin = L.marker([lat, lng], { icon: pinIcon, zIndexOffset: 1000, keyboard: false }).addTo(map);
    const z = Math.max(map.getZoom(), zoom || 15);
    if (!isDesktop()) {
      // đẩy điểm lên trên phần sheet đang che
      const target = map.project([lat, lng], z).add([0, window.innerHeight * 0.22]);
      map.setView(map.unproject(target, z), z);
    } else map.setView([lat, lng], z);
  }

  // ---------- hiển thị kết quả ----------
  function zoneCard(a) {
    const c = el('div', 'zonecard');
    if (a.inZone) {
      const z = a.inZone; c.style.borderColor = TIER[z.t].c;
      const tt = el('div', 'zt', TIER[z.t].n); tt.style.color = TIER[z.t].c;
      c.append(tt, el('div', 'zn', `Vùng ${z.id}. ${z.name}`), el('div', 'zh', z.h));
      const ul = el('ul'); z.why.forEach((w) => ul.append(el('li', null, w))); c.append(ul, el('div', 'zr', 'Lưu ý: ' + z.risk));
    } else {
      c.append(el('div', 'zn', 'Ngoài các vùng tiềm năng đã đánh dấu'));
      if (a.nearZone) c.append(el('div', 'zh', `Gần nhất: vùng ${a.nearZone.z.id}. ${a.nearZone.z.name}, cách ${fmtKm(a.nearZone.km)}`));
    }
    if (a.inReclaim) c.append(el('div', 'zr', `Điểm nằm trong ${a.inReclaim.name} (vẽ minh hoạ).`));
    c.append(el('div', 'zfoot', 'Vùng vẽ minh hoạ theo QĐ 2016/QĐ-TTg; mức tiềm năng là nhận định, không phải tư vấn đầu tư.'));
    return c;
  }
  function distRows(box, a) { box.replaceChildren(); a.dist.forEach((d) => box.append(el('span', null, d.name), el('b', null, fmtKm(d.km)))); }

  let current = null; // {lat,lng,addr,a,official}
  let reqId = 0;
  async function lookup(lat, lng, opts) {
    opts = opts || {};
    const id = ++reqId;
    const a = analyze(lat, lng);
    current = { lat, lng, addr: opts.addr || '', a, src: opts.src };
    showTab('place');
    $('#place-empty').hidden = true; $('#place').hidden = false;
    $('#p-addr').textContent = opts.addr || 'Đang tìm địa chỉ…';
    $('#p-coord').textContent = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    const note = $('#p-note');
    note.hidden = !(opts.src === 'VN2000' || opts.note);
    note.textContent = opts.note || 'Đã đổi từ VN2000 sang WGS84, sai số có thể vài mét.';
    $('#p-zone').replaceChildren(zoneCard(a));
    distRows($('#p-dist'), a);
    $('#a-dir').href = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    $('#lot-form').hidden = true; $('#share-out').hidden = true;
    markSaved();
    placePin(lat, lng, opts.zoom);
    setSheet('half');
    renderNearby($('#p-nearby'), lat, lng);
    renderOfficial($('#p-official'), hasIdentify() ? 'loading' : null);
    if (hasIdentify()) {
      const groups = await identifyOfficial(lat, lng);
      if (id === reqId) { current.official = groups; renderOfficial($('#p-official'), groups); }
    }
    if (!opts.addr) {
      const addr = await reverse(lat, lng);
      if (id === reqId) { current.addr = addr; $('#p-addr').textContent = addr || 'Vị trí đã chọn'; }
    }
  }

  map.on('click', (e) => {
    if (measuring || document.body.classList.contains('guest')) return;
    lookup(e.latlng.lat, e.latlng.lng);
  });

  // ---------- tìm kiếm ----------
  const q = $('#q'), sug = $('#suggest');
  q.addEventListener('input', () => { $('#btn-clear').hidden = !q.value; if (!q.value) sug.hidden = true; });
  $('#btn-clear').addEventListener('click', () => { q.value = ''; $('#btn-clear').hidden = true; sug.hidden = true; q.focus(); });
  function suggestMsg(text) { sug.replaceChildren(el('div', 'msg', text)); sug.hidden = false; }
  function suggestList(items, onPick, header) {
    sug.replaceChildren();
    if (header) sug.append(el('div', 'msg', header));
    items.forEach((it) => { const b = el('button'); b.type = 'button'; b.append(el('b', null, it.title), el('small', null, it.sub || '')); b.addEventListener('click', () => { sug.hidden = true; onPick(it); }); sug.append(b); });
    sug.hidden = false;
  }
  async function runSearch(text) {
    const r = parseInput(text);
    if (r.err) return suggestMsg(r.err);
    sug.hidden = true;
    if (r.kind === 'point') { q.blur(); return lookup(r.lat, r.lng, { src: r.src, zoom: 17 }); }
    if (r.kind === 'parcel') {
      if (!OFF.parcelService) return suggestMsg('Tra theo số tờ, số thửa chưa được kết nối dữ liệu địa chính. Tạm thời hãy nhập toạ độ VN2000 trên sổ đỏ (X, Y của một góc thửa).');
      suggestMsg('Đang tìm thửa đất…');
      try {
        const feats = await queryParcel(r.to, r.thua, r.xa);
        if (!feats.length) return suggestMsg(`Không tìm thấy tờ ${r.to} thửa ${r.thua}${r.xa ? ' ở ' + r.xa : ''}. Thêm tên phường/xã, ví dụ: tờ 12 thửa 345 Hòa Xuân`);
        const F = await parcelInfo();
        const f = { xa: F.xa && F.xa.name, dientich: F.dientich && F.dientich.name, loaidat: F.loaidat && F.loaidat.name };
        const pick = (feat) => {
          sug.hidden = true;
          if (parcelShape) map.removeLayer(parcelShape);
          parcelShape = L.geoJSON(feat, { style: { color: '#e0245e', weight: 3, fillOpacity: 0.12 } }).addTo(map);
          const c = turf.pointOnFeature(feat).geometry.coordinates;
          const pr = feat.properties || {};
          const bits = [pr[f.dientich] && `Diện tích ${fmtNum(+pr[f.dientich], 1)} m²`, pr[f.loaidat] && `Loại đất ${pr[f.loaidat]}`].filter(Boolean).join(' · ');
          const wn = placeOf(pr);
          lookup(c[1], c[0], { zoom: 18, addr: wn || undefined, note: `Tờ ${r.to}, thửa ${r.thua}${wn ? ', ' + wn : ''}${bits ? ' · ' + bits : ''}` });
        };
        // tên phường: trường mã xã đổi ra tên; không có thì thử mọi trường có giá trị là mã
        const placeOf = (pr) => wardName(pr[f.xa]) || Object.values(pr).map(wardName).find(Boolean) || (pr[f.xa] && !/^\d+$/.test(String(pr[f.xa])) ? String(pr[f.xa]) : '');
        if (feats.length === 1) { q.blur(); return pick(feats[0]); }
        const items = feats.map((ft) => {
          const pr = ft.properties || {}, wn = placeOf(pr);
          const extra = [pr[f.dientich] && `${fmtNum(+pr[f.dientich], 1)} m²`, pr[f.loaidat]].filter(Boolean).join(' · ');
          return { title: wn || `Mã xã ${pr[f.xa] || '?'} (ngoài Đà Nẵng hoặc không xác định)`, sub: `Tờ ${r.to} thửa ${r.thua}${extra ? ' · ' + extra : ''}`, ft, known: !!wn };
        }).sort((a, b) => (b.known - a.known) || a.title.localeCompare(b.title, 'vi'));
        const head = feats.noMatch
          ? `Không có thửa nào ở "${r.xa}". Có ${items.length} thửa cùng số ở các phường/xã dưới đây:`
          : r.xa ? `${items.length} thửa khớp:` : `Có ${items.length} thửa cùng số tờ ${r.to} thửa ${r.thua} (mỗi phường/xã đánh số riêng). Chọn đúng phường, hoặc gõ thêm tên, ví dụ: tờ ${r.to} thửa ${r.thua} Hòa Xuân`;
        suggestList(items, (it) => pick(it.ft), head);
      } catch (e) { suggestMsg(/nofields|nolayer/.test(e.message) ? 'Chưa nhận diện được cấu trúc dữ liệu địa chính. Tạm thời hãy nhập toạ độ VN2000 trên sổ đỏ.' : 'Không kết nối được dữ liệu địa chính của Sở. Thử lại sau.'); }
      return;
    }
    suggestMsg('Đang tìm địa chỉ…');
    const { results, reached } = await geocode(r.q);
    if (!reached) return suggestMsg('Không kết nối được dịch vụ tìm địa chỉ. Kiểm tra mạng, hoặc dán toạ độ / chạm vào bản đồ.');
    if (!results.length) return suggestMsg('Không tìm thấy địa chỉ này. Số nhà trong kiệt thường chưa có trên bản đồ: thử tên đường kèm phường (ví dụ: Mân Quang 7, Sơn Trà), rồi chạm đúng vị trí trên bản đồ.');
    suggestList(results, (it) => { q.blur(); lookup(it.lat, it.lng, { addr: it.sub || it.title, zoom: 18 }); }, 'Vị trí tìm theo địa chỉ là gần đúng, kiểm tra lại trên bản đồ:');
  }
  $('#search-form').addEventListener('submit', (e) => { e.preventDefault(); runSearch(q.value); });
  $$('.tip').forEach((t) => t.addEventListener('click', () => { q.value = t.dataset.q; $('#btn-clear').hidden = false; runSearch(t.dataset.q); }));
  document.addEventListener('click', (e) => { if (!e.target.closest('.topbar')) sug.hidden = true; });
  $('#p-coord').addEventListener('click', () => current && copyText(`${current.lat.toFixed(6)}, ${current.lng.toFixed(6)}`, 'Đã copy toạ độ'));

  // ---------- GPS ----------
  let meMarker = null;
  $('#btn-gps').addEventListener('click', () => {
    if (!navigator.geolocation) return toast('Trình duyệt không hỗ trợ lấy vị trí');
    toast('Đang lấy vị trí…');
    navigator.geolocation.getCurrentPosition((p) => {
      const { latitude: la, longitude: lo } = p.coords;
      if (meMarker) meMarker.setLatLng([la, lo]); else meMarker = L.marker([la, lo], { icon: L.divIcon({ className: '', html: '<div class="mylocation"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }) }).addTo(map);
      if (!inDN(la, lo)) { map.setView([la, lo], 15); return toast('Bạn đang ở ngoài khu vực Đà Nẵng'); }
      if (document.body.classList.contains('guest')) { map.setView([la, lo], 15); return; }
      lookup(la, lo, { zoom: 18, note: `Vị trí GPS, sai số khoảng ${Math.round(p.coords.accuracy)} m` });
    }, () => toast('Không lấy được vị trí. Hãy cho phép quyền vị trí.'), { enableHighAccuracy: true, timeout: 12000 });
  });

  // ---------- đo khoảng cách / diện tích ----------
  let measuring = false, mPts = [], mLayer = L.layerGroup();
  function drawMeasure() {
    mLayer.clearLayers();
    mPts.forEach((p) => L.marker(p, { icon: L.divIcon({ className: '', html: '<div class="mpt"></div>', iconSize: [12, 12], iconAnchor: [6, 6] }), interactive: false }).addTo(mLayer));
    if (mPts.length >= 2) L.polyline(mPts, { color: '#0d5c63', weight: 3 }).addTo(mLayer);
    if (mPts.length >= 3) L.polygon(mPts, { color: '#0d5c63', weight: 1, fillOpacity: 0.15, dashArray: '4 4' }).addTo(mLayer);
    let len = 0; for (let i = 1; i < mPts.length; i++) len += map.distance(mPts[i - 1], mPts[i]);
    $('#m-len').textContent = mPts.length < 2 ? 'Chạm lên bản đồ để đặt điểm' : `Dài ${len < 1000 ? fmtNum(len, 1) + ' m' : fmtNum(len / 1000, 2) + ' km'}`;
    if (mPts.length >= 3) {
      const area = turf.area(turf.polygon([ring(mPts.map((p) => [p.lat, p.lng]))]));
      $('#m-area').textContent = ` · Diện tích ${area < 10000 ? fmtNum(area, 1) + ' m²' : fmtNum(area / 10000, 2) + ' ha'}`;
    } else $('#m-area').textContent = '';
  }
  function setMeasure(on) {
    measuring = on; document.body.classList.toggle('measuring', on);
    $('#btn-measure').setAttribute('aria-pressed', on); $('#measurebar').hidden = !on;
    if (on) { mPts = []; mLayer.addTo(map); drawMeasure(); toast('Chạm lần lượt các góc để đo'); } else { map.removeLayer(mLayer); }
  }
  $('#btn-measure').addEventListener('click', () => setMeasure(!measuring));
  $('#m-done').addEventListener('click', () => setMeasure(false));
  $('#m-undo').addEventListener('click', () => { mPts.pop(); drawMeasure(); });
  map.on('click', (e) => { if (measuring) { mPts.push(e.latlng); drawMeasure(); } });

  // ---------- link gửi khách ----------
  const b64 = {
    enc: (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: (s) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))),
  };
  const SHARE_KEYS = ['v', 'la', 'lo', 't', 'p', 's', 'n', 'a', 'b', 'ph'];
  const shareUrl = (o) => { const x = {}; SHARE_KEYS.forEach((k) => { if (o[k] !== undefined && o[k] !== '') x[k] = o[k]; }); x.v = 1; return `${location.origin}/l?d=${b64.enc(x)}`; };
  const broker = store.get('qh_broker', { name: '', phone: '' });
  const lotFromForm = () => ({
    v: 1, la: +current.lat.toFixed(6), lo: +current.lng.toFixed(6),
    t: cut($('#f-title').value, 80), p: cut($('#f-price').value, 40), s: cut($('#f-area').value, 20), n: cut($('#f-note').value, 300),
    a: cut(current.addr, 120), b: cut($('#f-name').value, 50), ph: cut($('#f-phone').value, 15).replace(/[^\d+]/g, ''),
  });
  let formMode = 'share';
  function openForm(mode, lot) {
    if (!current) return;
    formMode = mode;
    $('#lot-form-h').textContent = mode === 'save' ? 'Lưu lô này' : 'Tạo trang gửi khách';
    $('#f-submit').textContent = mode === 'save' ? 'Lưu' : 'Tạo link';
    $('#f-title').value = (lot && lot.t) || ''; $('#f-price').value = (lot && lot.p) || ''; $('#f-area').value = (lot && lot.s) || ''; $('#f-note').value = (lot && lot.n) || '';
    $('#f-name').value = broker.name; $('#f-phone').value = broker.phone;
    $('#lot-form').hidden = false; $('#share-out').hidden = true;
    setSheet('full');
    setTimeout(() => $('#lot-form').scrollIntoView({ behavior: 'smooth', block: 'start' }), 280);
  }
  $('#a-share').addEventListener('click', () => openForm('share', findSaved()));
  $('#a-save').addEventListener('click', () => { const s = findSaved(); if (s) { removeLot(s.id); toast('Đã bỏ lưu'); markSaved(); } else openForm('save'); });
  $('#f-cancel').addEventListener('click', () => { $('#lot-form').hidden = true; });
  $('#lot-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const o = lotFromForm();
    broker.name = o.b; broker.phone = o.ph; store.set('qh_broker', broker);
    upsertLot(o);
    if (formMode === 'save') { $('#lot-form').hidden = true; toast('Đã lưu lô'); return; }
    const url = shareUrl(o);
    $('#share-url').value = url; $('#share-open').href = url;
    $('#lot-form').hidden = true; $('#share-out').hidden = false;
    copyText(url, 'Đã copy link, dán vào Zalo để gửi khách');
  });
  $('#share-copy').addEventListener('click', () => copyText($('#share-url').value, 'Đã copy link'));

  function postText(o, a, url, nearby, official) {
    const qh = officialSummary(official);
    const z = a.inZone ? `thuộc vùng "${a.inZone.name}" (${TIER[a.inZone.t].n.toLowerCase()})` : 'ngoài các vùng tiềm năng đã đánh dấu';
    const d = a.dist.slice(0, 3).map((x) => `${x.name.replace(/ \(.+\)$/, '')} ${fmtKm(x.km)}`).join(' · ');
    return [
      o.t || 'Bán lô đất',
      o.p && `Giá: ${o.p}`, o.s && `Diện tích: ${o.s}`,
      o.a && `Vị trí: ${o.a}`,
      qh && `Quy hoạch (Sở Xây dựng): ${qh}`,
      `Quy hoạch chung ĐN 2050: ${z}`,
      `Cách: ${d}`,
      nearbyLine(nearby),
      o.n,
      (o.b || o.ph) && `Liên hệ: ${[o.b, o.ph].filter(Boolean).join(' – ')}`,
      url && `Xem vị trí và quy hoạch: ${url}`,
    ].filter(Boolean).join('\n');
  }
  $('#a-post').addEventListener('click', () => { if (current) openPost(findSaved()); });

  // ---------- lô đã lưu ----------
  let lots = store.get('qh_lots', []);
  const saveLots = () => { store.set('qh_lots', lots); renderSaved(); };
  const near = (o) => current && Math.abs(o.la - current.lat) < 2e-6 && Math.abs(o.lo - current.lng) < 2e-6;
  function findSaved() { return lots.find(near); }
  function upsertLot(o) { const i = lots.findIndex(near); const rec = Object.assign({ id: Date.now().toString(36), at: Date.now() }, i >= 0 ? { id: lots[i].id, at: lots[i].at } : {}, o); if (i >= 0) lots[i] = rec; else lots.unshift(rec); saveLots(); markSaved(); }
  function removeLot(id) { lots = lots.filter((x) => x.id !== id); saveLots(); }
  function markSaved() { const s = !!findSaved(); $('#a-save').classList.toggle('on', s); $('#a-save span').textContent = s ? 'Đã lưu' : 'Lưu lô'; }
  function renderSaved() {
    const list = $('#saved-list'); list.replaceChildren();
    $('#saved-empty').hidden = lots.length > 0;
    const cnt = $('#saved-count'); cnt.hidden = !lots.length; cnt.textContent = lots.length;
    lots.forEach((o) => {
      const a = analyze(o.la, o.lo);
      const c = el('div', 'lot');
      c.append(el('b', null, o.t || 'Lô chưa đặt tên'));
      const meta = [o.p, o.s, o.a].filter(Boolean).join(' · ');
      if (meta) c.append(el('div', 'meta', meta));
      const zt = el('div', 'z', a.inZone ? `Vùng ${a.inZone.id}. ${a.inZone.name}` : 'Ngoài các vùng đã đánh dấu');
      if (a.inZone) zt.style.color = TIER[a.inZone.t].c;
      c.append(zt);
      const row = el('div', 'row');
      const bOpen = el('button', 'btn sm', 'Xem'); bOpen.type = 'button';
      bOpen.addEventListener('click', () => lookup(o.la, o.lo, { addr: o.a, zoom: 17 }));
      const bShare = el('button', 'btn ghost sm', 'Copy link'); bShare.type = 'button';
      bShare.addEventListener('click', () => copyText(shareUrl(o), 'Đã copy link gửi khách'));
      const bPost = el('button', 'btn ghost sm', 'Tạo tin'); bPost.type = 'button';
      bPost.addEventListener('click', async () => { await lookup(o.la, o.lo, { addr: o.a, zoom: 17 }); openPost(o); });
      const bDel = el('button', 'btn danger sm', 'Xoá'); bDel.type = 'button';
      bDel.addEventListener('click', () => { if (bDel.dataset.confirm) { removeLot(o.id); markSaved(); } else { bDel.dataset.confirm = '1'; bDel.textContent = 'Bấm lần nữa để xoá'; setTimeout(() => { delete bDel.dataset.confirm; bDel.textContent = 'Xoá'; }, 3000); } });
      row.append(bOpen, bShare, bPost, bDel); c.append(row);
      list.append(c);
    });
  }

  // ---------- danh sách vùng ----------
  function showZoneOnMap(id) {
    if (!map.hasLayer(zoneLayer)) setZones(true);
    const z = Z.find((x) => x.id === id);
    map.flyToBounds(polys[id].getBounds(), { padding: [40, 40], maxZoom: 13, duration: 0.7 });
    pins[id].bindPopup(`<h4>${z.id}. ${z.name}</h4><div style="color:${TIER[z.t].c};font-weight:600;font-size:12px">${TIER[z.t].n}</div><div>${z.h}</div>`).openPopup();
  }
  (function zoneList() {
    const chips = $('#chips'), list = $('#zone-list');
    let filt = 'all';
    const draw = () => {
      list.replaceChildren();
      Z.filter((z) => filt === 'all' || z.t === filt).forEach((z) => {
        const b = el('button', 'zitem'); b.type = 'button';
        const n = el('span', 'n', z.id); n.style.background = TIER[z.t].c;
        const t = el('span'); t.append(el('b', null, z.name), el('small', null, z.h));
        b.append(n, t); b.addEventListener('click', () => { if (!isDesktop()) setSheet('peek'); showZoneOnMap(z.id); });
        list.append(b);
      });
    };
    [['all', 'Tất cả', null], ...Object.entries(TIER).map(([k, v]) => [k, v.n, v.c])].forEach(([k, n, c]) => {
      const b = el('button', 'chip'); b.type = 'button'; b.setAttribute('aria-pressed', k === 'all');
      if (c) { const d = el('span', 'dot'); d.style.background = c; b.append(d); }
      b.append(document.createTextNode(n));
      b.addEventListener('click', () => { filt = k; $$('.chip', chips).forEach((x) => x.setAttribute('aria-pressed', x === b)); draw(); });
      chips.append(b);
    });
    draw();
  })();


  // ---------- tiện ích xung quanh (OpenStreetMap qua Overpass API) ----------
  const escH = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CATS = {
    school: { n: 'Trường học', c: '#2f6fdf', g: 'T' },
    market: { n: 'Chợ, siêu thị', c: '#d9822b', g: 'C' },
    health: { n: 'Y tế', c: '#d6336c', g: '+' },
    park: { n: 'Công viên', c: '#2f9e44', g: 'P' },
    bank: { n: 'Ngân hàng', c: '#7048e8', g: '$' },
    admin: { n: 'Hành chính', c: '#495057', g: 'H' },
  };
  const SUB = { kindergarten: 'Mầm non', school: 'Trường học', college: 'Cao đẳng', university: 'Đại học', marketplace: 'Chợ', supermarket: 'Siêu thị',
    mall: 'Trung tâm thương mại', department_store: 'Trung tâm thương mại', hospital: 'Bệnh viện', clinic: 'Phòng khám', doctors: 'Phòng khám',
    pharmacy: 'Nhà thuốc', park: 'Công viên', bank: 'Ngân hàng', townhall: 'UBND', police: 'Công an' };
  const NEED_NAME = /^(pharmacy|clinic|doctors|bank|police)$/;
  function catOf(t) {
    const a = t.amenity, sh = t.shop;
    if (/^(kindergarten|school|college|university)$/.test(a)) return 'school';
    if (a === 'marketplace' || /^(supermarket|mall|department_store)$/.test(sh)) return 'market';
    if (/^(hospital|clinic|doctors|pharmacy)$/.test(a)) return 'health';
    if (t.leisure === 'park') return 'park';
    if (a === 'bank') return 'bank';
    if (/^(townhall|police)$/.test(a)) return 'admin';
    return null;
  }
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  const nbCache = new Map();
  function parseOverpass(j, lat, lng, r) {
    const p0 = turf.point([lng, lat]), seen = new Set();
    return (j.elements || []).map((e) => {
      const t = e.tags || {}, cat = catOf(t);
      if (!cat) return null;
      const la = e.lat != null ? e.lat : e.center && e.center.lat, lo = e.lon != null ? e.lon : e.center && e.center.lon;
      if (la == null || lo == null) return null;
      const kind = t.amenity || t.shop || t.leisure, name = cut(t['name:vi'] || t.name || '', 80);
      if (!name && NEED_NAME.test(kind)) return null;
      const label = name || `${SUB[kind] || CATS[cat].n} (chưa có tên)`;
      const key = cat + label + la.toFixed(3) + lo.toFixed(3);
      if (seen.has(key)) return null; seen.add(key);
      return { cat, kind, sub: SUB[kind] || CATS[cat].n, name: label, named: !!name, lat: la, lng: lo, km: turf.distance(p0, turf.point([lo, la]), { units: 'kilometers' }) };
    }).filter((x) => x && x.km * 1000 <= r * 1.05).sort((a, b) => a.km - b.km);
  }
  async function fetchNearby(lat, lng, r) {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)},${r}`;
    if (nbCache.has(key)) return nbCache.get(key);
    const A = `(around:${r},${lat.toFixed(6)},${lng.toFixed(6)})`;
    const q = `[out:json][timeout:25];(nwr${A}[amenity~"^(kindergarten|school|college|university|marketplace|hospital|clinic|doctors|pharmacy|bank|townhall|police)$"];nwr${A}[shop~"^(supermarket|mall|department_store)$"];nwr${A}[leisure=park];);out center tags 400;`;
    let lastErr;
    for (const ep of OVERPASS) {
      try {
        const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 25000);
        const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: ctl.signal });
        clearTimeout(tm);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const items = parseOverpass(await res.json(), lat, lng, r);
        nbCache.set(key, items);
        return items;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('overpass');
  }

  const nbLayer = L.layerGroup().addTo(map);
  const amIcon = (cat) => L.divIcon({ className: '', html: `<div class="amk" style="background:${CATS[cat].c}">${CATS[cat].g}</div>`, iconSize: [22, 22], iconAnchor: [11, 11] });
  const nbState = { r: store.get('qh_nb_r', 1000), show: new Set(Object.keys(CATS)) };
  let nbReq = 0;
  function clearNearby() { nbReq++; nbLayer.clearLayers(); }

  async function renderNearby(box, lat, lng) {
    const id = ++nbReq;
    box.replaceChildren();
    nbLayer.clearLayers();
    const rad = el('div', 'chips nb-r');
    [[500, '500 m'], [1000, '1 km'], [2000, '2 km']].forEach(([r, t]) => {
      const b = el('button', 'chip', t); b.type = 'button'; b.setAttribute('aria-pressed', nbState.r === r);
      b.addEventListener('click', () => { nbState.r = r; store.set('qh_nb_r', r); renderNearby(box, lat, lng); });
      rad.append(b);
    });
    const status = el('p', 'hint', 'Đang tải tiện ích xung quanh…');
    box.append(rad, status);
    const ring = L.circle([lat, lng], { radius: nbState.r, color: '#0d5c63', weight: 1.5, dashArray: '5 6', fill: false, interactive: false }).addTo(nbLayer);
    let items;
    try { items = await fetchNearby(lat, lng, nbState.r); }
    catch (_) {
      if (id !== nbReq) return;
      status.textContent = 'Không tải được tiện ích lúc này (máy chủ OpenStreetMap đang bận).';
      const retry = el('button', 'btn ghost sm', 'Thử lại'); retry.type = 'button';
      retry.addEventListener('click', () => renderNearby(box, lat, lng)); box.append(retry);
      return;
    }
    if (id !== nbReq) return;
    if (current && current.lat === lat && current.lng === lng) current.nearby = items;
    status.remove();
    if (!items.length) { box.append(el('p', 'hint', 'Chưa có tiện ích nào trong bán kính này trên OpenStreetMap. Thử bán kính lớn hơn.')); return; }

    // gần nhất theo từng loại
    const sum = el('div', 'nb-sum');
    Object.entries(CATS).forEach(([k, v]) => {
      const f = items.find((x) => x.cat === k && x.named) || items.find((x) => x.cat === k);
      if (!f) return;
      const d = el('span', 'dot'); d.style.background = v.c;
      const lbl = el('span', 'nb-k'); lbl.append(d, document.createTextNode(v.n));
      sum.append(lbl, el('span', 'nb-n', f.name), el('b', null, fmtKm(f.km)));
    });

    const cats = el('div', 'chips');
    const list = el('div', 'nb-list');
    let limit = 12;
    const draw = () => {
      nbLayer.clearLayers(); ring.addTo(nbLayer);
      const markers = [];
      items.forEach((it) => {
        if (!nbState.show.has(it.cat)) return;
        const m = L.marker([it.lat, it.lng], { icon: amIcon(it.cat), keyboard: false })
          .bindPopup(`<b>${escH(it.name)}</b><br>${escH(it.sub)} · cách ${fmtKm(it.km)}`);
        if (!$('#ov-nearby').checked) return;
        m.addTo(nbLayer); markers.push([it, m]);
      });
      list.replaceChildren();
      const shown = items.filter((it) => nbState.show.has(it.cat));
      shown.slice(0, limit).forEach((it) => {
        const b = el('button', 'nb-item'); b.type = 'button';
        const ic = el('span', 'amk sm', CATS[it.cat].g); ic.style.background = CATS[it.cat].c;
        const tx = el('span', 'nb-t'); tx.append(el('b', null, it.name), el('small', null, it.sub));
        b.append(ic, tx, el('span', 'nb-d', fmtKm(it.km)));
        b.addEventListener('click', () => {
          if (!isDesktop()) setSheet('peek');
          map.setView([it.lat, it.lng], Math.max(map.getZoom(), 16));
          const mk = markers.find(([x]) => x === it); if (mk) mk[1].openPopup();
        });
        list.append(b);
      });
      if (shown.length > limit) {
        const more = el('button', 'btn ghost sm nb-more', `Xem thêm ${shown.length - limit}`); more.type = 'button';
        more.addEventListener('click', () => { limit += 20; draw(); }); list.append(more);
      }
    };
    Object.entries(CATS).forEach(([k, v]) => {
      const n = items.filter((x) => x.cat === k).length;
      if (!n) return;
      const b = el('button', 'chip'); b.type = 'button'; b.setAttribute('aria-pressed', nbState.show.has(k));
      const d = el('span', 'dot'); d.style.background = v.c; b.append(d, document.createTextNode(`${v.n} ${n}`));
      b.addEventListener('click', () => { if (nbState.show.has(k)) nbState.show.delete(k); else nbState.show.add(k); b.setAttribute('aria-pressed', nbState.show.has(k)); draw(); });
      cats.append(b);
    });
    box.append(sum, cats, list, el('p', 'src', 'Tiện ích: © OpenStreetMap contributors. Có thể thiếu hoặc chưa cập nhật; khoảng cách là đường chim bay.'));
    draw();
  }
  $('#ov-nearby').addEventListener('change', (e) => { if (e.target.checked) nbLayer.addTo(map); else map.removeLayer(nbLayer); });
  function nearbyLine(items) {
    if (!items || !items.length) return '';
    const parts = [];
    ['school', 'market', 'health', 'park'].forEach((k) => {
      const f = items.find((x) => x.cat === k && x.named);
      if (f) parts.push(`${f.name} ${fmtKm(f.km)}`);
    });
    return parts.length ? `Gần: ${parts.join(' · ')}` : '';
  }


  // ---------- tạo tin rao (listing.js) ----------
  const LG = window.QHListing;
  const s2 = (v) => String(v == null ? '' : v).trim().slice(0, 50);
  const PF_FIELDS = ['area', 'phone', 'main', 'road', 'price', 'landArea', 'useArea', 'floors', 'front', 'depth', 'beds', 'wcs', 'direction', 'legal', 'furniture', 'amenities', 'highlights', 'note', 'name'];
  const PF_DEFAULT = { mode: 'ban', type: 'nha', roadKind: '', tone: 'friendly', channel: 'fb' };
  const pf = Object.assign({ variant: 0, sug: [] }, PF_DEFAULT);
  const f$ = (k) => $('#pf-' + k);

  function syncRadios() {
    $$('#pf-type .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === pf.type));
    $$('#pf-tone .chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === pf.tone));
    [['#pf-mode', 'mode'], ['#pf-roadkind', 'roadKind'], ['#pf-channel', 'channel']].forEach(([sel, key]) =>
      $$(sel + ' button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === pf[key])));
  }
  function radioChips(box, items, key) {
    Object.entries(items).forEach(([k, v]) => {
      const b = el('button', 'chip', typeof v === 'string' ? v : v.label); b.type = 'button'; b.dataset.v = k;
      b.addEventListener('click', () => { pf[key] = k; syncRadios(); if (key === 'type') { fillStatus(); syncTypeFields(); } saveDraft(); });
      box.append(b);
    });
  }
  radioChips($('#pf-type'), LG.TYPES, 'type');
  radioChips($('#pf-tone'), LG.TONES, 'tone');
  [['#pf-mode', 'mode'], ['#pf-roadkind', 'roadKind'], ['#pf-channel', 'channel']].forEach(([sel, key]) =>
    $$(sel + ' button').forEach((b) => b.addEventListener('click', () => { pf[key] = b.dataset.v; syncRadios(); saveDraft(); })));

  const STATUS = {
    nha: ['Nhà cấp 4', 'Nhà gác lửng', 'Nhà phố', 'Nhà mới xây', 'Nhà cũ', 'Nhà có sân vườn'],
    dat: ['Đất trống', 'Đất có nhà cũ', 'Đất nền dự án'],
    canho: ['Căn hộ mới', 'Căn hộ đã qua sử dụng', 'Căn hộ dịch vụ'],
    phong: ['Phòng mới', 'Phòng có gác', 'Phòng khép kín'],
    khac: ['Kiot', 'Mặt bằng kinh doanh', 'Kho xưởng'],
  };
  function fillStatus(keep) {
    const sel = f$('mainSel'), cur = keep != null ? keep : (sel.value === '__other' ? f$('main').value : sel.value);
    sel.replaceChildren();
    const add = (v, t) => { const o = el('option', null, t || v); o.value = v; sel.append(o); };
    add('', 'Không ghi');
    (STATUS[pf.type] || []).forEach((v) => add(v));
    add('__other', 'Khác (tự nhập)…');
    if (!cur) sel.value = '';
    else if ((STATUS[pf.type] || []).includes(cur)) sel.value = cur;
    else { sel.value = '__other'; f$('main').value = cur; }
    f$('main').hidden = sel.value !== '__other';
  }
  f$('mainSel').addEventListener('change', () => {
    const other = f$('mainSel').value === '__other';
    f$('main').hidden = !other;
    if (other) f$('main').focus(); else f$('main').value = '';
  });
  // đất nền không có tầng/phòng: ẩn bớt cho gọn
  function syncTypeFields() {
    const noRooms = pf.type === 'dat';
    ['floors', 'beds', 'wcs'].forEach((k) => { f$(k).closest('label').hidden = noRooms; if (noRooms) f$(k).value = ''; });
  }

  function readForm() {
    const d = { mode: pf.mode, type: pf.type, roadKind: pf.roadKind, tone: pf.tone, channel: pf.channel };
    PF_FIELDS.forEach((k) => { d[k] = f$(k).value; });
    if (f$('mainSel').value !== '__other') d.main = f$('mainSel').value;
    const on = pf.sug.filter((x) => x.cb.checked);
    d.nearby = on.filter((x) => x.kind === 'nearby').map((x) => x.text);
    const pl = on.find((x) => x.kind === 'planning'); if (pl) d.planning = pl.text;
    const lk = on.find((x) => x.kind === 'link'); if (lk) d.link = lk.text;
    return d;
  }
  function writeForm(d) {
    Object.keys(PF_DEFAULT).forEach((k) => { pf[k] = d[k] != null && d[k] !== undefined ? d[k] : PF_DEFAULT[k]; });
    PF_FIELDS.forEach((k) => {
      const e = f$(k), v = d[k] || '';
      if (e.tagName === 'SELECT' && v && ![...e.options].some((o) => o.value === v)) { const o = el('option', null, v); o.value = v; e.append(o); }
      e.value = v;
    });
    fillStatus(d.main || '');
    syncTypeFields();
    if (['useArea', 'front', 'depth', 'direction', 'legal', 'furniture', 'amenities', 'highlights', 'note'].some((k) => d[k])) $('#pf-more').open = true;
    syncRadios();
  }
  const hasData = () => PF_FIELDS.some((k) => f$(k).value.trim());
  let draftT;
  function saveDraft() {
    clearTimeout(draftT);
    draftT = setTimeout(() => { const d = readForm(); delete d.nearby; delete d.planning; delete d.link; store.set('qh_post_draft', d); }, 300);
  }
  $('#pf').addEventListener('input', saveDraft);
  $('#pf').addEventListener('change', saveDraft);

  function showErr(k, msg) { const e = $(`#pf-${k}-err`); if (!e) return; e.textContent = msg || ''; e.hidden = !msg; f$(k).classList.toggle('bad', !!msg); f$(k).setAttribute('aria-invalid', !!msg); }
  ['area', 'phone'].forEach((k) => f$(k).addEventListener('input', () => showErr(k, '')));

  function renderOut(r) {
    $('#pf-out').hidden = false;
    $('#pf-title').value = r.title;
    $('#pf-body').value = r.body;
    const w = r.warnings.slice();
    if (r.unknownNumbers.length) w.push(`Tin có con số không nằm trong dữ liệu đã nhập (${r.unknownNumbers.join(', ')}). Hãy kiểm tra lại.`);
    const box = $('#pf-warn'); box.replaceChildren(); box.hidden = !w.length;
    w.forEach((t) => box.append(el('div', null, t)));
    setTimeout(() => $('#pf-out').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  $('#pf').addEventListener('submit', (e) => {
    e.preventDefault();
    const d = readForm();
    const errs = LG.validate(d);
    showErr('area', errs.area); showErr('phone', errs.phone);
    if (errs.area || errs.phone) { (errs.area ? f$('area') : f$('phone')).focus(); toast('Còn thiếu thông tin bắt buộc'); return; }
    const btn = $('#pf-go'); btn.disabled = true; btn.textContent = 'Đang tạo…';
    setTimeout(() => {
      pf.variant = 0; renderOut(LG.generate(d, 0));
      btn.disabled = false; btn.textContent = 'Tạo tin rao';
      broker.name = s2(d.name); broker.phone = s2(d.phone); store.set('qh_broker', broker);
    }, 120);
  });
  $('#pf-again').addEventListener('click', () => {
    const d = readForm(); if (Object.keys(LG.validate(d)).length) return $('#pf').requestSubmit();
    pf.variant++; renderOut(LG.generate(d, pf.variant)); toast(`Phiên bản ${pf.variant + 1}`);
  });
  $('#pf-copy').addEventListener('click', () => copyText(`${$('#pf-title').value.trim()}\n\n${$('#pf-body').value.trim()}`, 'Đã sao chép tin rao!'));
  $('#pf-copy-top').addEventListener('click', () => $('#pf-copy').click());

  // đăng lên Facebook/Zalo: web không được phép tự đăng, nên copy sẵn rồi mở ứng dụng/trang để dán
  const fullText = () => `${$('#pf-title').value.trim()}\n\n${$('#pf-body').value.trim()}`;
  const isMobile = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const lotLink = () => { const lk = pf.sug.find((x) => x.kind === 'link'); return lk ? lk.text : ''; };
  async function nativeShare(text) {
    if (!navigator.share) return false;
    try { await navigator.share({ title: $('#pf-title').value.trim(), text }); return true; }
    catch (e) { return e && e.name === 'AbortError'; } // người dùng tự huỷ thì coi như xong
  }
  $('#pf-fb').addEventListener('click', () => {
    copyText(fullText(), 'Đã copy tin. Dán vào bài viết Facebook để đăng.'); // không chờ, để trình duyệt không chặn cửa sổ mới
    // có link lô đất thì mở hộp chia sẻ link (Facebook hiện ảnh xem trước); không thì mở Facebook
    const link = lotLink();
    const url = link ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}` : 'https://www.facebook.com/';
    window.open(url, '_blank', 'noopener');
  });
  $('#pf-zalo').addEventListener('click', async () => {
    if (isMobile() && await nativeShare(fullText())) return; // điện thoại: bảng chia sẻ của máy, chọn Zalo
    copyText(fullText(), 'Đã copy tin. Dán vào cuộc trò chuyện Zalo để gửi.');
    window.open('https://chat.zalo.me/', '_blank', 'noopener');
  });
  $('#pf-share').addEventListener('click', async () => {
    if (await nativeShare(fullText())) return;
    copyText(fullText(), 'Máy không hỗ trợ chia sẻ trực tiếp, đã copy tin để bạn dán.');
  });
  $('#pf-sample').addEventListener('click', () => { writeForm(LG.SAMPLE); $('#pf-sample-note').hidden = false; ['area', 'phone'].forEach((k) => showErr(k, '')); saveDraft(); toast('Đã điền dữ liệu minh họa'); });
  $('#pf-reset').addEventListener('click', () => {
    const b = $('#pf-reset');
    if (hasData() && !b.dataset.confirm) { b.dataset.confirm = '1'; b.textContent = 'Bấm lần nữa để xoá hết'; setTimeout(() => { delete b.dataset.confirm; b.textContent = 'Làm mới biểu mẫu'; }, 3500); return; }
    delete b.dataset.confirm; b.textContent = 'Làm mới biểu mẫu';
    writeForm({ name: f$('name').value, phone: f$('phone').value }); pf.sug.forEach((x) => { x.cb.checked = false; }); // giữ thông tin liên hệ
    $('#pf-out').hidden = true; $('#pf-sample-note').hidden = true; $('#pf-more').open = false;
    ['area', 'phone'].forEach((k) => showErr(k, ''));
    try { localStorage.removeItem('qh_post_draft'); } catch (_) {}
    toast('Đã làm mới biểu mẫu');
  });

  // gợi ý từ lô đang chọn: chỉ đưa vào tin khi người dùng tick
  const approx = (km) => (km < 1 ? `khoảng ${Math.max(50, Math.round(km * 1000 / 50) * 50)} m` : `khoảng ${km.toFixed(1).replace('.', ',')} km`);
  function setSuggestions(lot) {
    const list = $('#pf-sug-list'); list.replaceChildren(); pf.sug = [];
    if (!current) { $('#pf-sug').hidden = true; return; }
    const items = [];
    const qh = officialSummary(current.official);
    if (qh) items.push({ kind: 'planning', text: `${qh} (theo cổng thông tin quy hoạch xây dựng Đà Nẵng)`, label: `Quy hoạch: ${qh}` });
    const near = (current.nearby || []).filter((x) => x.named);
    const picked = [];
    ['school', 'market', 'health', 'park'].forEach((c) => near.filter((x) => x.cat === c).slice(0, 2).forEach((x) => picked.push(x)));
    picked.sort((a, b) => a.km - b.km).slice(0, 6).forEach((x) => { const t = `${x.name} (${approx(x.km)})`; items.push({ kind: 'nearby', text: t, label: t }); });
    const o = lot || { v: 1, la: +current.lat.toFixed(6), lo: +current.lng.toFixed(6), a: cut(current.addr, 120), b: broker.name, ph: broker.phone };
    items.push({ kind: 'link', text: shareUrl(o), label: 'Link xem vị trí và quy hoạch trên bản đồ' });
    items.forEach((it) => {
      const row = el('label', 'chk');
      const cb = el('input'); cb.type = 'checkbox';
      row.append(cb, document.createTextNode(' ' + it.label));
      list.append(row); pf.sug.push(Object.assign(it, { cb }));
    });
    $('#pf-sug').hidden = !items.length;
  }
  function openPost(lot) {
    showTab('post'); setSheet('full');
    if (current) {
      if (!f$('area').value.trim() && (current.addr || (lot && lot.a))) f$('area').value = (lot && lot.a) || current.addr;
      if (lot) {
        if (!f$('price').value.trim() && lot.p) f$('price').value = lot.p;
        if (!f$('landArea').value.trim() && lot.s) f$('landArea').value = lot.s;
        if (!f$('note').value.trim() && lot.n) { f$('note').value = lot.n; $('#pf-more').open = true; }
      }
      if (!f$('name').value.trim() && ((lot && lot.b) || broker.name)) f$('name').value = (lot && lot.b) || broker.name;
      if (!f$('phone').value.trim() && ((lot && lot.ph) || broker.phone)) f$('phone').value = (lot && lot.ph) || broker.phone;
      setSuggestions(lot);
      saveDraft();
    }
  }
  $$('#tabs button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.tab === 'post' && current) setSuggestions(findSaved()); }));
  (function restoreDraft() { const d = store.get('qh_post_draft', null) || {}; if (!d.name) d.name = broker.name; if (!d.phone) d.phone = broker.phone; writeForm(d); })();
  $('#pf-back').addEventListener('click', () => { showTab('place'); setSheet(current ? 'half' : 'peek'); });

  // ---------- trang của khách (?s=...) ----------
  function guestMode(o) {
    document.body.classList.add('guest');
    ['place', 'post', 'saved', 'zones', 'facts'].forEach((t) => { $('#pane-' + t).hidden = true; });
    $('#pane-guest').hidden = false;
    $('#g-title').textContent = cut(o.t, 80) || 'Vị trí lô đất';
    $('#g-price').textContent = cut(o.p, 40); $('#g-area').textContent = cut(o.s, 20);
    $('#g-addr').textContent = cut(o.a, 120);
    $('#g-note').textContent = cut(o.n, 300); $('#g-note').hidden = !o.n;
    const a = analyze(o.la, o.lo);
    $('#g-zone').replaceChildren(zoneCard(a));
    distRows($('#g-dist'), a);
    const name = cut(o.b, 50), phone = cut(o.ph, 15).replace(/[^\d+]/g, '');
    if (name || phone) {
      $('#contact').hidden = false;
      $('#c-name').textContent = name || 'Môi giới'; $('#c-phone').textContent = phone;
      $('#c-call').href = 'tel:' + phone; $('#c-call').hidden = !phone;
      $('#c-zalo').href = 'https://zalo.me/' + phone.replace(/^\+84/, '0'); $('#c-zalo').hidden = !phone;
    }
    document.title = (cut(o.t, 60) || 'Vị trí lô đất') + ' · Quy hoạch Đà Nẵng';
    current = { lat: o.la, lng: o.lo, addr: o.a, a };
    placePin(o.la, o.lo, 16);
    setSheet('half');
    renderNearby($('#g-nearby'), o.la, o.lo);
    if (hasIdentify()) { renderOfficial($('#g-official'), 'loading'); identifyOfficial(o.la, o.lo).then((g) => renderOfficial($('#g-official'), g)); }
  }

  // ---------- khởi động ----------
  renderSaved();
  labels();
  syncOfficial();
  const sp = new URLSearchParams(location.search).get('s');
  let guest = null;
  if (sp) { try { guest = b64.dec(sp); } catch (_) {} }
  if (guest && typeof guest.la === 'number' && typeof guest.lo === 'number' && inDN(guest.la, guest.lo)) guestMode(guest);
  window.addEventListener('resize', () => map.invalidateSize());
  // máy tính: ẩn/hiện bảng bên trái
  function setPanel(hidden) {
    document.body.classList.toggle('panel-hidden', hidden); store.set('qh_panel_hidden', hidden);
    $('#panel-toggle').setAttribute('aria-expanded', !hidden);
    setTimeout(() => map.invalidateSize(), 280);
  }
  setPanel(store.get('qh_panel_hidden', false));
  $('#panel-toggle').addEventListener('click', () => setPanel(!document.body.classList.contains('panel-hidden')));

  // cho phép kiểm thử logic từ console / node
  window.__qh = { parseInput, analyze, fmtKm, postText, b64, parseOverpass, nearbyLine, officialSummary, parcelInfo, queryParcel };
})();
