# Quy hoạch Đà Nẵng 2050

Công cụ tra vị trí lô đất theo Quy hoạch chung TP Đà Nẵng đến 2050 (QĐ 2016/QĐ-TTg ngày 21/10/2026), làm cho môi giới.

## Tính năng
- **Tìm vị trí:** địa chỉ (OpenStreetMap Nominatim), toạ độ WGS84, link Google Maps đầy đủ, toạ độ VN2000 trên sổ đỏ (kinh tuyến trục 107°45'), số tờ/số thửa (khi đã kết nối dữ liệu địa chính), GPS, hoặc chạm bản đồ.
- **Kết quả:** vùng quy hoạch chứa điểm, lý do và rủi ro, 5 mốc hạ tầng gần nhất, địa chỉ gần đúng.
- **Lớp quy hoạch chính thức:** phủ lớp ArcGIS của Sở Xây dựng và tra thông tin tại điểm khi điền URL trong `config.js`.
- **Môi giới:** lưu lô (trên máy), copy nội dung tin đăng, link gửi khách có ảnh xem trước khi gửi Zalo, trang của khách có nút Gọi / Zalo / Chỉ đường.
- **Đo:** khoảng cách và diện tích trên bản đồ.

## Cấu trúc
- `index.html`, `app.css`, `app.js` — ứng dụng (Leaflet 1.9.4, esri-leaflet 3.0.12, Turf 6.5.0, proj4 2.9.2 qua CDN)
- `data.js` — 14 vùng (vẽ minh hoạ), khu lấn biển, hạ tầng, mốc khoảng cách
- `config.js` — URL dịch vụ GIS chính thức, trường bị ẩn
- `api/s.js` + `vercel.json` — `/l?d=...` trả thẻ Open Graph rồi chuyển sang `/?s=...`
- `og.png` — ảnh xem trước 1200×630

## Lưu ý
Ranh giới 14 vùng là minh hoạ, không phải bản đồ quy hoạch chính thức. Không hiển thị thông tin chủ sử dụng đất. Kiểm tra điều khoản sử dụng dữ liệu của cơ quan quản lý trước khi kết nối lớp chính thức.
