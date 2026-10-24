// Proxy chỉ-đọc tới máy chủ ArcGIS của Sở Xây dựng Đà Nẵng, để trình duyệt gọi được identify/query.
// Chỉ cho phép đúng host và đường dẫn /arcgis/rest/services/..., chỉ GET.
const HOST = 'thongtinquyhoachxaydung.danang.gov.vn';
const PATH_OK = /^\/arcgis\/rest\/services\/[A-Za-z0-9_\/]+\/(MapServer|FeatureServer)(\/\d+)?\/(identify|query)$/;

module.exports = async (req, res) => {
  const path = String((req.query && req.query.path) || '');
  if (req.method !== 'GET' || !PATH_OK.test(path)) { res.statusCode = 400; return res.end('{"error":"path not allowed"}'); }
  const qs = new URLSearchParams();
  Object.entries(req.query || {}).forEach(([k, v]) => { if (k !== 'path') qs.set(k, String(v).slice(0, 2000)); });
  qs.set('f', 'json');
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
    const r = await fetch(`https://${HOST}${path}?${qs}`, { signal: ctl.signal, headers: { 'User-Agent': 'quyhoachdanang/1.0', Referer: `https://${HOST}/` } });
    clearTimeout(t);
    const body = await r.text();
    res.statusCode = r.ok ? 200 : 502;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=600');
    res.end(body);
  } catch (e) { res.statusCode = 504; res.end('{"error":"upstream timeout"}'); }
};
