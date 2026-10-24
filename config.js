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
  // Lớp quy hoạch chính thức (ArcGIS MapServer). Ví dụ: 'https://.../arcgis/rest/services/QuyHoach/MapServer'
  planning: {
    // Lớp đang thử: dịch vụ SoNhaTest của Sở Xây dựng (bắt được từ thongtinquyhoachxaydung.danang.gov.vn).
    // Đổi sang dịch vụ quy hoạch khi tìm được tên đúng trong /arcgis/rest/services/SoXayDung
    type: 'wms',
    url: 'https://thongtinquyhoachxaydung.danang.gov.vn/arcgis/services/SoXayDung/SoNhaTest/MapServer/WMSServer',
    layers: '0',
    identifyPath: '/arcgis/rest/services/SoXayDung/SoNhaTest/MapServer', // dùng cho tra thông tin tại điểm qua /api/gis
    opacity: 0.8,
    name: 'Dữ liệu Sở Xây dựng (thử nghiệm)',
  },
  // Lớp thửa đất để tra theo số tờ, số thửa. Ví dụ: 'https://.../MapServer/3'
  parcel: {
    url: '',
    fields: { to: 'SOTO', thua: 'SOTHUA', xa: 'TENXA', dientich: 'DIENTICH', loaidat: 'LOAIDAT' },
  },
  // Không bao giờ hiển thị các trường có tên khớp mẫu này (thông tin cá nhân)
  hiddenField: /chu|owner|cmnd|cccd|gcn|giaychung|diachi_?chu|sdt|phone|objectid|shape|globalid/i,
};
