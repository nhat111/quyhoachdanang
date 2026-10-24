// Tạo tin rao bất động sản từ dữ liệu người dùng nhập — hàm thuần, không gọi mạng.
// Nguyên tắc: chỉ dùng dữ liệu được cung cấp, trường trống thì bỏ hẳn, mẫu câu không chứa con số hay khẳng định.
// Dùng được trong trình duyệt (window.QHListing) và Node (module.exports) để kiểm thử.
(function (root) {
  'use strict';

  const TYPES = {
    nha: { label: 'Nhà ở', noun: 'nhà', road: 'đường trước nhà' },
    dat: { label: 'Đất nền', noun: 'lô đất', road: 'đường trước lô' },
    canho: { label: 'Căn hộ', noun: 'căn hộ', road: 'đường trước tòa nhà' },
    phong: { label: 'Phòng trọ', noun: 'phòng trọ', road: 'đường trước nhà' },
    khac: { label: 'Khác', noun: 'bất động sản', road: 'đường trước' },
  };
  const TONES = { short: 'Ngắn gọn', friendly: 'Thân thiện', pro: 'Chuyên nghiệp', catchy: 'Thu hút' };
  const CHANNELS = { fb: 'Facebook', zalo: 'Zalo', both: 'Cả hai' };

  const s = (v) => (v == null ? '' : String(v).replace(/\s+/g, ' ').trim());
  const list = (v) => s(v) ? String(v).split(/[,;\n]+/).map(s).filter(Boolean) : [];
  const cap = (t) => t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  const lower1 = (t) => t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
  const fold = (v) => s(v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  const pick = (arr, n) => arr[((n % arr.length) + arr.length) % arr.length];

  // "5m5", "7m5", "10m", "4,5 m" giữ nguyên; chỉ thêm "m" khi người dùng nhập số trơn
  function road(v) { const t = s(v); return /^\d+([.,]\d+)?$/.test(t) ? `${t}m` : t; }
  function m2(v) { const t = s(v); return /^\d+([.,]\d+)?$/.test(t) ? `${t} m²` : t; }
  function meters(v) { const t = s(v); return /^\d+([.,]\d+)?$/.test(t) ? `${t}m` : t; }
  const num = (v) => { const m = s(v).replace(/(\d)m(\d)/i, '$1.$2').replace(',', '.').match(/\d+(\.\d+)?/); return m ? parseFloat(m[0]) : NaN; };

  function normalize(d) {
    d = d || {};
    const out = {};
    ['mode', 'type', 'area', 'road', 'roadKind', 'main', 'price', 'landArea', 'useArea', 'front', 'depth', 'floors', 'beds', 'wcs',
      'direction', 'legal', 'furniture', 'note', 'name', 'phone', 'channel', 'tone', 'planning', 'link'].forEach((k) => { out[k] = s(d[k]); });
    out.type = TYPES[out.type] ? out.type : 'nha';
    out.mode = out.mode === 'thue' ? 'thue' : 'ban';
    out.tone = TONES[out.tone] ? out.tone : 'friendly';
    out.channel = CHANNELS[out.channel] ? out.channel : 'fb';
    out.amenities = list(d.amenities).concat(Array.isArray(d.nearby) ? d.nearby.map(s).filter(Boolean) : []);
    out.highlights = list(d.highlights);
    if (/^chưa cung cấp$/i.test(out.legal)) out.legal = '';
    return out;
  }

  // ---- kiểm tra đầu vào ----
  function validate(d) {
    const e = {};
    if (!s(d.type)) e.type = 'Chọn loại bất động sản';
    if (!s(d.area)) e.area = 'Nhập địa chỉ hoặc khu vực';
    const digits = s(d.phone).replace(/[^\d]/g, '');
    if (!s(d.phone)) e.phone = 'Nhập số điện thoại liên hệ';
    else if (digits.length < 9 || digits.length > 12 || /[^\d\s.+()-]/.test(s(d.phone))) e.phone = 'Số điện thoại có vẻ chưa đúng, hãy kiểm tra lại';
    return e;
  }

  // ---- cảnh báo nhẹ khi dữ liệu có vẻ mâu thuẫn ----
  function warnings(d) {
    const w = [];
    if (d.type === 'dat' && (d.beds || d.wcs || d.floors || d.furniture)) w.push('Loại "Đất nền" nhưng có nhập phòng ngủ, WC, số tầng hoặc nội thất. Kiểm tra lại loại bất động sản.');
    const la = num(d.landArea), ua = num(d.useArea), fl = num(d.floors) || 1, fr = num(d.front), dp = num(d.depth);
    if (la > 0 && ua > 0 && ua > la * fl * 1.3) w.push('Diện tích sử dụng lớn hơn nhiều so với diện tích đất nhân số tầng.');
    if (la > 0 && fr > 0 && dp > 0) { const r = (fr * dp) / la; if (r < 0.7 || r > 1.3) w.push('Mặt tiền nhân chiều sâu chênh nhiều so với diện tích đất.'); }
    if (d.mode === 'thue' && /tỷ/i.test(d.price)) w.push('Đang chọn "Cho thuê" nhưng giá ghi bằng "tỷ".');
    if (d.mode === 'ban' && /tháng/i.test(d.price)) w.push('Đang chọn "Bán" nhưng giá ghi theo tháng.');
    return w;
  }

  // ---- mọi con số trong tin phải có trong dữ liệu nhập ----
  function digitsOf(t) { return (String(t).match(/\d+/g) || []).map((x) => x.replace(/^0+(?=\d)/, '')); }
  function checkNumbers(text, d) {
    const src = new Set(digitsOf(Object.values(d).map((v) => (Array.isArray(v) ? v.join(' ') : v)).join(' ')));
    const body = String(text).replace(/https?:\/\/\S+/g, ' ').replace(s(d.phone), ' ');
    return [...new Set(digitsOf(body))].filter((n) => !src.has(n));
  }

  // ---- hashtag từ dữ liệu thật ----
  function hashtags(d) {
    const tag = (t) => '#' + fold(t).split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    const out = [];
    const verb = d.mode === 'thue' ? 'Cho thuê ' : 'Bán ';
    out.push(tag(verb + TYPES[d.type].noun.replace('bất động sản', 'nhà đất')));
    const places = d.area.split(',').map(s).filter(Boolean).map((p) => p.replace(/^(phường|p\.|quận|q\.|xã|huyện|tp\.?|thành phố)\s*/i, '')).filter((p) => !/^\d/.test(p));
    places.slice(-2).reverse().forEach((p) => { if (p.length <= 24) out.push(tag(p)); });
    const city = places.length ? places[places.length - 1] : '';
    if (city) out.push(tag(TYPES[d.type].noun.replace('lô đất', 'đất').replace('bất động sản', 'nhà đất') + ' ' + city));
    out.push(d.mode === 'thue' ? '#ChoThueNhaDat' : '#NhaDat');
    return [...new Set(out.filter((t) => t.length > 2))].slice(0, 6);
  }

  // ---- mẫu câu (không chứa số, không khẳng định ngoài dữ liệu) ----
  const INTRO = {
    short: [() => ''],
    friendly: [
      (d) => `Gửi đến anh chị ${TYPES[d.type].noun} ${d.mode === 'thue' ? 'cho thuê' : 'đang bán'} với thông tin như sau:`,
      (d) => `Anh chị đang tìm ${TYPES[d.type].noun} khu vực ${d.area} có thể tham khảo căn này:`,
      () => 'Mời anh chị xem thông tin chi tiết bên dưới:',
    ],
    pro: [
      (d) => `Thông tin ${TYPES[d.type].noun} ${d.mode === 'thue' ? 'cho thuê' : 'chuyển nhượng'}:`,
      () => 'Chi tiết bất động sản:',
      (d) => `Giới thiệu ${TYPES[d.type].noun} tại ${d.area}:`,
    ],
    catchy: [
      (d) => `Cơ hội cho anh chị đang tìm ${TYPES[d.type].noun} tại ${d.area}!`,
      () => 'Đừng bỏ lỡ, xem ngay thông tin bên dưới!',
      (d) => `${cap(TYPES[d.type].noun)} ${d.mode === 'thue' ? 'cho thuê' : 'cần bán'}, thông tin rõ ràng:`,
    ],
  };
  const CLOSE = {
    short: [() => ''],
    friendly: [(d) => `Anh chị quan tâm cứ gọi hoặc nhắn Zalo để xem ${viewNoun(d)} trực tiếp nhé.`, () => 'Liên hệ để được tư vấn và hẹn lịch xem.'],
    pro: [() => 'Vui lòng liên hệ để nhận thông tin chi tiết và hẹn lịch xem.', () => 'Liên hệ để được tư vấn cụ thể.'],
    catchy: [(d) => `Gọi ngay để hẹn xem ${viewNoun(d)}!`, () => 'Liên hệ ngay để được xem trực tiếp!'],
  };

  const viewNoun = (d) => ({ dat: 'đất', phong: 'phòng', canho: 'căn hộ' }[d.type] || 'nhà');
  function roadPhrase(d) {
    if (!d.road) return '';
    const r = road(d.road);
    if (d.roadKind === 'kiet') return `kiệt ${r}`;
    if (d.roadKind === 'mattien') return `mặt tiền đường ${r}`;
    return `${TYPES[d.type].road} ${r}`;
  }

  function title(d, v) {
    const verb = d.mode === 'thue' ? 'Cho thuê' : 'Bán';
    const floorsTxt = d.floors && d.type === 'nha' ? `nhà ${d.floors} tầng` : '';
    const what = d.main ? lower1(d.main) + (floorsTxt && !/tầng/i.test(d.main) ? ` ${d.floors} tầng` : '') : (floorsTxt || TYPES[d.type].noun);
    const rp = roadPhrase(d);
    const hi = d.highlights[0];
    const opts = [
      `${verb} ${what} ${d.area}` + (rp ? ` – ${rp}` : ''),
      `${verb} ${what} tại ${d.area}` + (hi ? `, ${lower1(hi)}` : d.landArea ? `, ${m2(d.landArea)}` : rp ? `, ${rp}` : ''),
      `${verb} ${what}` + (d.landArea ? ` ${m2(d.landArea)}` : '') + (rp ? `, ${rp}` : '') + `, ${d.area}`,
    ];
    const t = cap(pick(opts, v).replace(/\s+,/g, ','));
    return d.tone === 'catchy' ? `🔥 ${t}` : t;
  }

  function lines(d) {
    const L = [];
    const add = (icon, label, value) => { if (value) L.push({ icon, label, value }); };
    add('📍', 'Vị trí', d.area);
    if (d.road) add('🛣', d.roadKind === 'kiet' ? 'Kiệt' : d.roadKind === 'mattien' ? 'Mặt tiền đường' : cap(TYPES[d.type].road), road(d.road));
    add('🏠', 'Hiện trạng', d.main);
    add('📐', 'Diện tích đất', d.landArea && m2(d.landArea));
    add('', 'Diện tích sử dụng', d.useArea && m2(d.useArea));
    if (d.front || d.depth) add('', 'Kích thước', [d.front && `mặt tiền ${meters(d.front)}`, d.depth && `chiều sâu ${meters(d.depth)}`].filter(Boolean).join(', '));
    add('', 'Số tầng', d.floors);
    if (d.beds || d.wcs) add('🛏', 'Công năng', [d.beds && `${d.beds} phòng ngủ`, d.wcs && `${d.wcs} WC`].filter(Boolean).join(', '));
    add('', 'Hướng', d.direction);
    add('📄', 'Pháp lý', d.legal);
    add('', 'Nội thất', d.furniture);
    add('', 'Tiện ích', d.amenities.join(', '));
    add('⭐', 'Điểm nổi bật', d.highlights.join(', '));
    add('🗺', 'Quy hoạch', d.planning);
    add('', 'Ghi chú', d.note);
    return L;
  }

  // ---- hàm chính ----
  function generate(input, variant) {
    const d = normalize(input);
    const v = variant | 0;
    const tone = d.tone, zalo = d.channel === 'zalo';
    const emojiOk = tone === 'friendly' || tone === 'catchy';
    const bullet = tone === 'short' ? '- ' : '• ';
    const ttl = title(d, v);
    const parts = [];
    const intro = zalo ? '' : pick(INTRO[tone], v)(d);
    if (intro) parts.push(intro);

    // chi tiết: emoji tối đa 4 dòng khi phong cách cho phép
    let emojis = 0;
    const det = lines(d).map((x) => {
      const useEmoji = emojiOk && x.icon && emojis < 4;
      if (useEmoji) emojis++;
      const head = useEmoji ? `${x.icon} ` : bullet;
      return `${head}${x.label}: ${x.value}`;
    });
    if (det.length) parts.push(det.join('\n'));

    if (d.price) parts.push(`${emojiOk ? '💰 ' : ''}${d.mode === 'thue' ? 'Giá thuê' : 'Giá'}: ${d.price}`);
    const who = d.name ? `${d.phone} (${d.name})` : d.phone;
    parts.push(`${emojiOk ? '☎️ ' : ''}Liên hệ: ${who}`);
    if (d.link) parts.push(`Xem vị trí và quy hoạch: ${d.link}`);
    const close = zalo ? '' : pick(CLOSE[tone], v)(d);
    if (close) parts.push(close);
    if (!zalo) parts.push(hashtags(d).join(' '));

    const body = parts.filter(Boolean).join('\n\n');
    const full = `${ttl}\n\n${body}`;
    return { title: ttl, body, text: full, warnings: warnings(d), unknownNumbers: checkNumbers(full, d), data: d };
  }

  const SAMPLE = {
    mode: 'ban', type: 'nha', area: 'Sơn Trà, Đà Nẵng', road: '5m5', main: '', floors: '3', landArea: '75', beds: '3', wcs: '3',
    amenities: 'Gần chợ, trường học', price: '4,8 tỷ', phone: '0900000000', tone: 'friendly', channel: 'fb',
  };

  const api = { generate, validate, warnings, checkNumbers, normalize, hashtags, TYPES, TONES, CHANNELS, SAMPLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.QHListing = api;
})(typeof window !== 'undefined' ? window : globalThis);
