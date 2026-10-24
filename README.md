# Quy hoạch Đà Nẵng 2050

Bản đồ trực quan Quy hoạch chung TP Đà Nẵng đến năm 2050, tầm nhìn 2075 (Quyết định 2016/QĐ-TTg ngày 21/10/2026) và các khu vực tiềm năng.

- Một file `index.html` tĩnh (Leaflet + OpenStreetMap / Esri), không cần build.
- Ranh giới các vùng vẽ gần đúng theo mô tả trong quyết định, không phải bản đồ quy hoạch chính thức.
- Mức tiềm năng là nhận định từ văn bản quy hoạch, không phải tư vấn đầu tư.

Nguồn: https://danang.gov.vn/vi/w/phe-duyet-quy-hoach-chung-thanh-pho-da-nang-den-nam-2050-tam-nhin-den-nam-2075

## Tính năng cho môi giới

- **Tra cứu:** nhập toạ độ WGS84, link Google Maps đầy đủ, toạ độ VN2000 trên sổ đỏ (kinh tuyến trục 107°45'), hoặc chạm lên bản đồ / dùng GPS. Trả về vùng quy hoạch chứa điểm và khoảng cách tới hạ tầng chính.
- **Trang gửi khách:** tạo link `?s=...` chứa vị trí, tiêu đề, giá, ghi chú, tên và SĐT môi giới (mã hoá base64 ngay trong link, không có backend). Khách mở link thấy thẻ thông tin lô đất, vùng quy hoạch, nút Gọi / Zalo / Chỉ đường.
- Thư viện: Leaflet 1.9.4, Turf.js 6.5.0, proj4js 2.9.2 (cdnjs).
