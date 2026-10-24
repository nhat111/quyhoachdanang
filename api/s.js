// Trang trung gian cho link gửi khách: trả về thẻ Open Graph (Zalo, Facebook đọc được)
// rồi chuyển ngay sang /?s=... để mở bản đồ.
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

module.exports = (req, res) => {
  const d = String((req.query && req.query.d) || '');
  const valid = /^[A-Za-z0-9_-]{8,3000}$/.test(d);
  let o = {};
  if (valid) {
    try { o = JSON.parse(Buffer.from(d.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')) || {}; } catch (_) { o = {}; }
  }
  const title = String(o.t || 'Vị trí lô đất').slice(0, 80);
  const desc = [o.p && `Giá ${String(o.p).slice(0, 40)}`, o.s && String(o.s).slice(0, 20), o.a && String(o.a).slice(0, 120), 'Xem vị trí và quy hoạch Đà Nẵng 2050']
    .filter(Boolean).join(' · ');
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const origin = host ? `https://${host}` : '';
  const target = valid ? `/?s=${d}` : '/';
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  res.end(`<!doctype html><html lang="vi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(origin)}/og.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:url" content="${esc(origin + req.url)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body><p><a href="${esc(target)}">Mở bản đồ vị trí lô đất</a></p>
<script>location.replace(${JSON.stringify(target)})</script></body></html>`);
};
