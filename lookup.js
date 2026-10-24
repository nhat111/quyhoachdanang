// Tra cứu vị trí + trang gửi khách cho môi giới.
// Dùng chung dữ liệu Z, RECLAIM, LINES, TIER, map, zoneLayer khai báo trong index.html.
(function () {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  // VN2000, kinh tuyến trục 107°45' (Đà Nẵng, Quảng Nam cũ), múi 3°
  const VN2000 = '+proj=tmerc +lat_0=0 +lon_0=107.75 +k=0.9999 +x_0=500000 +y_0=0 +ellps=WGS84 ' +
    '+towgs84=-191.90441429,-39.30318279,-111.45032835,-0.00928836,0.01975479,-0.00427372,0.252906278 +units=m +no_defs';

  const TARGETS = [
    { name: 'Trung tâm (Cầu Rồng)', pt: [16.0612, 108.2272] },
    { name: 'Sân bay quốc tế Đà Nẵng', pt: [16.0439, 108.1994] },
    { name: 'Cảng Liên Chiểu', pt: [16.128, 108.137] },
    { name: 'Phố cổ Hội An', pt: [15.8775, 108.3281] },
    { name: 'Khu CNC mở rộng', pt: [16.098, 108.068] },
    { name: 'Sân bay Chu Lai', pt: [15.4033, 108.7059] },
    { name: 'Cao tốc Bắc – Nam (tuyến, không phải nút giao)', line: LINES[0].pts },
    { name: 'Trục ven biển Võ Nguyên Giáp – Trường Sa', line: LINES[1].pts },
  ];

  const ll = (p) => [p[1], p[0]]; // [lat,lng] -> [lng,lat]
  const ring = (poly) => { const r = poly.map(ll); r.push(r[0]); return r; };
  const zonePolys = Z.map((z) => ({ z, f: turf.polygon([ring(z.poly)]) }));
  const reclaimPolys = RECLAIM.map((r) => ({ r, f: turf.polygon([ring(r.poly)]) }));

  const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`);

  function analyze(lat, lng) {
    const p = turf.point([lng, lat]);
    const inZone = zonePolys.find((x) => turf.booleanPointInPolygon(p, x.f));
    let nearZone = null;
    if (!inZone) {
      let best = Infinity;
      zonePolys.forEach((x) => {
        const d = turf.pointToLineDistance(p, turf.polygonToLine(x.f), { units: 'kilometers' });
        if (d < best) { best = d; nearZone = { z: x.z, km: d }; }
      });
    }
    const inReclaim = reclaimPolys.find((x) => turf.booleanPointInPolygon(p, x.f));
    const dist = TARGETS.map((t) => ({
      name: t.name,
      km: t.pt ? turf.distance(p, turf.point(ll(t.pt)), { units: 'kilometers' })
               : turf.pointToLineDistance(p, turf.lineString(t.line.map(ll)), { units: 'kilometers' }),
    })).sort((a, b) => a.km - b.km).slice(0, 5);
    return { inZone: inZone && inZone.z, nearZone, inReclaim: inReclaim && inReclaim.r, dist };
  }

  // ---- đọc toạ độ người dùng nhập ----
  function parseInput(raw) {
    const s = (raw || '').trim();
    if (!s) return { err: 'Bạn chưa nhập vị trí.' };
    if (/goo\.gl|maps\.app/i.test(s)) return { err: 'Link rút gọn của Google Maps không đọc được. Mở link, chạm giữ vào điểm để copy toạ độ, rồi dán vào đây.' };
    let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/[@=](-?\d+\.\d+),\s*(-?\d+\.\d+)/);
    if (m) return check(+m[1], +m[2], 'WGS84');
    const nums = (s.replace(/(\d),(\d{3})(?!\d)/g, '$1$2').match(/-?\d+(?:[.,]\d+)?/g) || []).map((n) => +n.replace(',', '.'));
    if (nums.length < 2) return { err: 'Không tìm thấy cặp toạ độ. Ví dụ: 16.0544, 108.2022 hoặc VN2000: X 1775432 Y 554210' };
    const [a, b] = nums;
    if (a > 1000 && b > 1000) { // VN2000: X (bắc) ~1.6–1.9 triệu, Y (đông) ~0.3–0.8 triệu
      const X = Math.max(a, b), Y = Math.min(a, b);
      if (X < 1.5e6 || X > 2.0e6 || Y < 2e5 || Y > 9e5) return { err: 'Toạ độ VN2000 có vẻ không thuộc khu vực Đà Nẵng.' };
      const [lng, lat] = proj4(VN2000, 'WGS84', [Y, X]);
      return check(lat, lng, 'VN2000');
    }
    if (a > 100 && b < 30) return check(b, a, 'WGS84');
    return check(a, b, 'WGS84');
  }
  function check(lat, lng, src) {
    if (!(lat > 14.8 && lat < 16.6 && lng > 107.1 && lng < 109.2)) return { err: 'Vị trí nằm ngoài khu vực Đà Nẵng.' };
    return { lat, lng, src };
  }

  // ---- marker ----
  const pinIcon = L.divIcon({ className: '', html: '<div class="lotpin"></div>', iconSize: [22, 22], iconAnchor: [11, 22] });
  let marker = null;
  function placeMarker(lat, lng, zoom) {
    if (marker) marker.setLatLng([lat, lng]); else marker = L.marker([lat, lng], { icon: pinIcon, zIndexOffset: 1000 }).addTo(map);
    map.setView([lat, lng], Math.max(map.getZoom(), zoom || 14));
  }

  function renderInfo(box, lat, lng, a) {
    box.replaceChildren();
    const zoneCard = el('div', 'zonecard');
    if (a.inZone) {
      const z = a.inZone;
      zoneCard.style.borderColor = TIER[z.t].c;
      zoneCard.append(el('div', 'zt', TIER[z.t].n), el('div', 'zn', `Nằm trong vùng ${z.id}. ${z.name}`), el('div', 'zh', z.h));
      const ul = el('ul'); z.why.forEach((w) => ul.append(el('li', null, w))); zoneCard.append(ul, el('div', 'zr', 'Lưu ý: ' + z.risk));
    } else {
      zoneCard.append(el('div', 'zn', 'Không nằm trong vùng nào đã đánh dấu'));
      if (a.nearZone) zoneCard.append(el('div', 'zh', `Gần nhất: vùng ${a.nearZone.z.id}. ${a.nearZone.z.name}, cách ${fmtKm(a.nearZone.km)}`));
    }
    if (a.inReclaim) zoneCard.append(el('div', 'zr', `Điểm này nằm trong ${a.inReclaim.name}. Kiểm tra lại toạ độ.`));
    box.append(zoneCard);
    box.append(el('div', 'subh', 'Khoảng cách đường chim bay'));
    const dl = el('div', 'dist');
    a.dist.forEach((d) => { dl.append(el('span', null, d.name), el('b', null, fmtKm(d.km))); });
    box.append(dl);
    const co = el('div', 'coord', `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    box.append(co);
  }

  // ---- tab Tra cứu ----
  const resBox = $('#lk-result'), msg = $('#lk-msg'), shareBox = $('#lk-share');
  let current = null;
  function doLookup(lat, lng, src) {
    current = { lat, lng };
    msg.textContent = src === 'VN2000' ? 'Đã đổi từ VN2000 sang WGS84 (sai số có thể vài mét).' : '';
    renderInfo(resBox, lat, lng, analyze(lat, lng));
    shareBox.hidden = false;
    $('#lk-link').hidden = true;
    placeMarker(lat, lng, 15);
  }
  $('#lk-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const r = parseInput($('#lk-input').value);
    if (r.err) { msg.textContent = r.err; return; }
    doLookup(r.lat, r.lng, r.src);
  });
  $('#lk-gps').addEventListener('click', () => {
    if (!navigator.geolocation) { msg.textContent = 'Trình duyệt không hỗ trợ lấy vị trí.'; return; }
    msg.textContent = 'Đang lấy vị trí…';
    navigator.geolocation.getCurrentPosition(
      (p) => { const r = check(p.coords.latitude, p.coords.longitude); if (r.err) msg.textContent = r.err; else doLookup(r.lat, r.lng); },
      () => { msg.textContent = 'Không lấy được vị trí. Hãy cho phép quyền vị trí hoặc nhập toạ độ.'; },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
  map.on('click', (e) => {
    if ($('#lookup').hidden || document.body.classList.contains('share')) return;
    doLookup(e.latlng.lat, e.latlng.lng);
  });

  // ---- tạo link gửi khách ----
  const store = { get: (k) => { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
  $('#sh-name').value = store.get('qh_broker_name');
  $('#sh-phone').value = store.get('qh_broker_phone');
  const b64 = { enc: (o) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
                dec: (s) => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))) };
  const cut = (v, n) => String(v || '').trim().slice(0, n);
  $('#sh-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!current) return;
    const o = { v: 1, la: +current.lat.toFixed(6), lo: +current.lng.toFixed(6), t: cut($('#sh-title').value, 80), p: cut($('#sh-price').value, 40),
                n: cut($('#sh-note').value, 300), b: cut($('#sh-name').value, 50), ph: cut($('#sh-phone').value, 15).replace(/[^\d+]/g, '') };
    store.set('qh_broker_name', o.b); store.set('qh_broker_phone', o.ph);
    const url = `${location.origin}${location.pathname}?s=${b64.enc(o)}`;
    $('#sh-url').value = url;
    $('#sh-open').href = url;
    $('#lk-link').hidden = false;
  });
  $('#sh-copy').addEventListener('click', async () => {
    const inp = $('#sh-url');
    try { await navigator.clipboard.writeText(inp.value); $('#sh-copy').textContent = 'Đã copy'; }
    catch (_) { inp.select(); $('#sh-copy').textContent = 'Bấm giữ để copy'; }
    setTimeout(() => { $('#sh-copy').textContent = 'Copy link'; }, 2000);
  });

  // ---- chế độ xem của khách (?s=...) ----
  const sp = new URLSearchParams(location.search).get('s');
  if (sp) {
    let o = null;
    try { o = b64.dec(sp); } catch (_) {}
    const ok = o && typeof o.la === 'number' && typeof o.lo === 'number' && !check(o.la, o.lo).err;
    if (ok) {
      document.body.classList.add('share');
      const v = $('#shareview');
      v.hidden = false;
      $('#sv-title').textContent = cut(o.t, 80) || 'Vị trí lô đất';
      $('#sv-price').textContent = cut(o.p, 40);
      $('#sv-price').hidden = !o.p;
      $('#sv-note').textContent = cut(o.n, 300);
      $('#sv-note').hidden = !o.n;
      renderInfo($('#sv-info'), o.la, o.lo, analyze(o.la, o.lo));
      const name = cut(o.b, 50), phone = cut(o.ph, 15).replace(/[^\d+]/g, '');
      $('#sv-broker').hidden = !(name || phone);
      $('#sv-bname').textContent = name || 'Môi giới';
      $('#sv-bphone').textContent = phone;
      $('#sv-call').href = 'tel:' + phone; $('#sv-call').hidden = !phone;
      $('#sv-zalo').href = 'https://zalo.me/' + phone.replace(/^\+84/, '0'); $('#sv-zalo').hidden = !phone;
      $('#sv-gmaps').href = `https://www.google.com/maps/search/?api=1&query=${o.la},${o.lo}`;
      document.title = (cut(o.t, 60) || 'Vị trí lô đất') + ' · Quy hoạch Đà Nẵng 2050';
      window.addEventListener('load', () => setTimeout(() => { map.invalidateSize(); placeMarker(o.la, o.lo, 15); }, 50));
    }
  }
})();
