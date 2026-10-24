// Cấu hình kết nối dữ liệu GIS. Để trống `url` thì tính năng tương ứng tự ẩn.
//
// Cách lấy URL (khoảng 5 phút, làm trên máy tính):
// 1. Mở https://gisportal.danang.gov.vn/sxd/ bằng Chrome, bấm F12 → tab Network.
// 2. Bật lớp quy hoạch trên bản đồ, kéo bản đồ một chút.
// 3. Gõ "MapServer" vào ô lọc. Copy một URL dạng
//    https://.../arcgis/rest/services/<Tên>/MapServer/export?...  → lấy phần trước "/export".
// 4. Bấm vào một thửa đất. Tìm request ".../MapServer/<số>/query" hoặc ".../identify",
//    xem tab Response để biết tên trường số tờ, số thửa, mã xã.
window.QH_CONFIG = {
  // Dữ liệu ArcGIS 10.41 của Cổng thông tin quy hoạch xây dựng Đà Nẵng (Sở Xây dựng).
  // Hiển thị: ảnh export tải thẳng từ máy chủ Sở. Tra cứu (identify/query/legend): qua proxy /api/gis.
  official: {
    host: 'https://thongtinquyhoachxaydung.danang.gov.vn',
    base: '/arcgis/rest/services/SoXayDung',
    layers: [
      { id: 'qhdt', service: 'QuyHoachDoThi', name: 'Quy hoạch đô thị (Sở Xây dựng)', on: true, opacity: 0.7, identify: true, summary: true, legend: true },
      { id: 'rgqhct', service: 'RanhGioiQHCT', name: 'Ranh giới đồ án quy hoạch chi tiết', on: false, opacity: 0.9, identify: true, maxShow: 1 },
      { id: 'dc', service: 'DiaChinh', name: 'Thửa đất (địa chính)', on: false, opacity: 0.9, minZoom: 16, identify: true, maxShow: 1 },
    ],
    parcelService: 'DiaChinh', // dùng cho tra "tờ 12 thửa 345"; lớp và tên trường được tự dò
  },
  // Không bao giờ hiển thị các trường có tên khớp mẫu này (thông tin cá nhân, trường kỹ thuật)
  hiddenField: /chusudung|chu_?sd|ten_?chu|owner|cmnd|cccd|gcn|giaychung|so_?seri|diachi_?chu|sdt|phone|objectid|shape|globalid|fid$/i,
};
