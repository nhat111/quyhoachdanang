// Dữ liệu vùng quy hoạch (vẽ minh hoạ từ QĐ 2016/QĐ-TTg), hạ tầng và mốc khoảng cách.
const TIER={
  "1":{c:"#c0264f",n:"Động lực trực tiếp (2026–2035)"},
  "2":{c:"#d4860b",n:"Đô thị loại II / cực Nam"},
  "3":{c:"#2c8a62",n:"Dài hạn (2035–2050)"},
  "c":{c:"#7d8a91",n:"Hạn chế phát triển"}
};
const Z=[
 {id:1,t:"1",name:"Cảng Liên Chiểu – Hòa Hiệp",h:"Cảng cửa ngõ, logistics, FTZ",
  poly:[[16.142,108.118],[16.140,108.138],[16.124,108.140],[16.110,108.133],[16.112,108.115]],
  why:["Dự án ưu tiên hàng đầu về logistics và giao thương quốc tế","Kết nối trực tiếp Khu thương mại tự do, Khu CNC, hành lang Đông – Tây"],
  risk:"Hợp đất kho bãi, nhà trọ, dịch vụ phục vụ cảng hơn nhà ở cao cấp."},
 {id:2,t:"1",name:"Trục Nguyễn Tất Thành – IFC",h:"Trục chính Trung tâm Tài chính quốc tế",
  poly:[[16.112,108.140],[16.100,108.152],[16.088,108.168],[16.080,108.183],[16.075,108.198],[16.078,108.212],[16.071,108.215],[16.068,108.198],[16.074,108.180],[16.083,108.163],[16.095,108.146],[16.106,108.134]],
  why:["IFC phát triển dọc Nguyễn Tất Thành và hai bên sông Hàn","Nằm ngay sau khu lấn biển vịnh Đà Nẵng 1.500 ha"],
  risk:"Giá mặt tiền biển đã cao; dư địa lớn hơn ở các lô phía sau tuyến."},
 {id:3,t:"1",name:"CBD An Đồn",h:"Khu tài chính tập trung, ven sông Hàn",
  poly:[[16.0890,108.2290],[16.0880,108.2400],[16.0740,108.2410],[16.0715,108.2300]],
  why:["Được nêu tên là CBD, kết nối trục Phạm Văn Đồng – Võ Văn Kiệt","Gần khu lấn biển Nam Sơn Trà"],
  risk:"Thuộc nhóm giá cao nhất thành phố; phần trăm tăng có thể thấp hơn vùng ven."},
 {id:4,t:"1",name:"Khu Công nghệ cao mở rộng",h:"1.710 ha · Liên Chiểu và Bà Nà",
  poly:[[16.125,108.030],[16.125,108.095],[16.090,108.105],[16.070,108.070],[16.085,108.030]],
  why:["Bán dẫn, AI, công nghệ sinh học, năng lượng sạch","Thành phố đang mời nhà máy pin ô tô vào đây"],
  risk:"Nhà ở chuyên gia tăng theo tốc độ lấp đầy nhà máy, không theo quy hoạch."},
 {id:5,t:"1",name:"Hòa Xuân – Nam Ngũ Hành Sơn",h:"Aeon Mall Hòa Xuân sắp khởi công",
  poly:[[16.028,108.208],[16.025,108.240],[15.995,108.258],[15.975,108.262],[15.972,108.238],[15.990,108.210]],
  why:["Khởi công Aeon Mall bên lề hội nghị công bố quy hoạch","Cầu nối lõi Đà Nẵng với Điện Bàn – Hội An trên trục ven biển"],
  risk:"Nguồn cung đất nền, căn hộ lớn; cạnh tranh cao."},
 {id:6,t:"2",name:"Điện Bàn (Điện Ngọc – Điện Nam)",h:"Đô thị loại II · 605.000 dân 2050",
  poly:[[15.970,108.235],[15.966,108.276],[15.935,108.300],[15.905,108.322],[15.886,108.300],[15.885,108.255],[15.905,108.218],[15.945,108.213]],
  why:["Đô thị động lực gắn Đà Nẵng và Hội An","Quy mô dân số 2050 lớn nhất sau lõi Đà Nẵng"],
  risk:"Từng sốt rồi đóng băng; nhiều dự án vướng pháp lý. Chọn khu đã có sổ, hạ tầng xong."},
 {id:7,t:"2",name:"Chu Lai – Núi Thành",h:"Trung tâm logistics quốc gia, sân bay",
  poly:[[15.465,108.600],[15.470,108.650],[15.440,108.690],[15.400,108.722],[15.370,108.700],[15.375,108.630],[15.420,108.595]],
  why:["Logistics tích hợp biển – hàng không – bộ – sắt","Nâng cấp sân bay Chu Lai; thêm 3 KCN tại Núi Thành, Tam Anh"],
  risk:"Cách trung tâm Đà Nẵng ~90 km; phụ thuộc tiến độ sân bay và việc làm."},
 {id:8,t:"2",name:"Tam Kỳ",h:"Đô thị loại II · 275.000 dân 2050",
  poly:[[15.610,108.440],[15.605,108.525],[15.550,108.540],[15.535,108.470],[15.565,108.430]],
  why:["Đầu mối tuyến xuyên biển nối Khu kinh tế mở Chu Lai","Trung tâm nghiên cứu, y tế, giáo dục của cực Nam"],
  risk:"Mất vai trò tỉnh lỵ sau sáp nhập; cần thời gian bù việc làm."},
 {id:9,t:"3",name:"Cực Nam Hội An",h:"Duy Nghĩa · Thăng An · Thăng Trường · Thăng Điền",
  poly:[[15.862,108.378],[15.835,108.400],[15.760,108.440],[15.690,108.485],[15.668,108.465],[15.738,108.418],[15.815,108.372]],
  why:["Cực liên kết thứ ba: đô thị mới, du lịch, thương mại","Cầu Bình Dương, Hưng Mỹ, kênh thoát lũ đang giải phóng mặt bằng"],
  risk:"Hoàn thiện chủ yếu 2030–2040; vùng trũng Trường Giang dễ ngập."},
 {id:10,t:"3",name:"Hòa Vang – Hòa Tiến",h:"Đô thị mở rộng phía Tây",
  poly:[[16.010,108.105],[16.010,108.185],[15.955,108.200],[15.940,108.130],[15.965,108.100]],
  why:["Nằm giữa sân bay, cao tốc và Khu CNC","Quỹ đất lớn cho mở rộng đô thị lõi"],
  risk:"Nhiều đất nông nghiệp; vị trí ga tốc độ cao chưa công bố."},
 {id:11,t:"3",name:"Đại Lộc – Vu Gia",h:"Vùng công nghiệp mới phía Tây cao tốc",
  poly:[[15.910,108.040],[15.910,108.150],[15.860,108.160],[15.835,108.070],[15.860,108.030]],
  why:["Dọc QL14B, 14E, ĐT611","Vu Gia là một trong 7 đô thị mới"],
  risk:"Chủ yếu đất công nghiệp, nhà ở công nhân; tăng chậm."},
 {id:12,t:"c",name:"Bán đảo Sơn Trà",h:"Khu du lịch quốc gia, kiểm soát nghiêm",
  poly:[[16.104,108.262],[16.122,108.232],[16.138,108.243],[16.152,108.262],[16.140,108.298],[16.146,108.328],[16.128,108.336],[16.108,108.312],[16.103,108.285]],
  why:["Bảo vệ voọc chà vá chân nâu, giữ 'rừng trong phố'"],risk:"Rất khó có dự án mới."},
 {id:13,t:"c",name:"Phố cổ Hội An",h:"Bảo tồn di sản",
  poly:[[15.884,108.318],[15.884,108.340],[15.873,108.341],[15.872,108.318]],
  why:["Tam giác di sản Hội An – Cù Lao Chàm – Mỹ Sơn"],risk:"Hợp kinh doanh lưu trú hơn chờ tăng giá theo hạ tầng."},
 {id:14,t:"c",name:"Bà Nà – Núi Chúa",h:"Rừng nguyên sinh, bảo vệ nghiêm ngặt",
  poly:[[16.040,107.950],[16.040,108.035],[15.975,108.040],[15.955,107.965]],
  why:["Khu du lịch quốc gia sinh thái, nghỉ dưỡng"],risk:"Không phải nơi mua đất chờ tăng giá."}
];
const RECLAIM=[
 {name:"Lấn biển vịnh Đà Nẵng · ~1.500 ha",poly:[[16.1040,108.1730],[16.1180,108.1620],[16.1290,108.1800],[16.1220,108.2060],[16.1020,108.2130],[16.0920,108.1960]]},
 {name:"Lấn biển cảng Liên Chiểu · ~450 ha",poly:[[16.1250,108.1480],[16.1420,108.1520],[16.1400,108.1720],[16.1220,108.1660]]},
 {name:"Lấn biển Nam Sơn Trà · ~100 ha",poly:[[16.0965,108.2650],[16.0990,108.2730],[16.0925,108.2770],[16.0895,108.2630]]}
];
const POI=[
 ["Cảng Liên Chiểu",16.128,108.137,"Cảng cửa ngõ quốc tế, dự án ưu tiên"],
 ["Sân bay quốc tế Đà Nẵng",16.0439,108.1994,"Cửa ngõ phía Bắc"],
 ["Sân bay Chu Lai",15.4033,108.7059,"Nâng cấp, mở rộng kèm trung tâm logistics hàng không"],
 ["Cảng Tiên Sa",16.121,108.215,"Cảng hiện hữu"],
 ["Cù Lao Chàm",15.953,108.513,"Khu du lịch quốc gia, dự trữ sinh quyển thế giới"],
 ["KKT cửa khẩu Nam Giang",15.745,107.47,"31.060 ha · cửa ngõ sang Nam Lào, Đông Bắc Thái Lan"],
 ["Khu CNTT tập trung",16.005,108.135,"341 ha (vị trí gần đúng)"]
];
const LINES=[
 {name:"Cao tốc Bắc – Nam",c:"#8a5a2b",d:"8 5",pts:[[16.135,108.105],[16.06,108.125],[15.99,108.150],[15.90,108.185],[15.78,108.270],[15.66,108.360],[15.55,108.440],[15.45,108.560],[15.34,108.660]]},
 {name:"Trục ven biển Hoàng Sa – Võ Nguyên Giáp – Trường Sa",c:"#1f7fb0",d:null,pts:[[16.098,108.256],[16.088,108.2495],[16.0717,108.2465],[16.05,108.249],[16.03,108.254],[16.00,108.266],[15.975,108.280],[15.94,108.300],[15.915,108.336],[15.895,108.360]]},
 {name:"QL14B (hành lang công nghiệp phía Tây)",c:"#6b4fa0",d:"4 4",pts:[[16.00,108.170],[15.95,108.090],[15.90,108.000],[15.87,107.90],[15.80,107.84]]},
 {name:"QL14D → cửa khẩu Nam Giang",c:"#6b4fa0",d:"4 4",pts:[[15.79,107.84],[15.77,107.70],[15.76,107.58],[15.745,107.47]]}
];

const TARGETS=[
 {name:"Trung tâm (Cầu Rồng)",pt:[16.0612,108.2272]},
 {name:"Sân bay quốc tế Đà Nẵng",pt:[16.0439,108.1994]},
 {name:"Bãi biển gần nhất (trục ven biển)",line:LINES[1].pts},
 {name:"Cảng Liên Chiểu",pt:[16.128,108.137]},
 {name:"Phố cổ Hội An",pt:[15.8775,108.3281]},
 {name:"Khu CNC mở rộng",pt:[16.098,108.068]},
 {name:"Cao tốc Bắc – Nam (tuyến)",line:LINES[0].pts},
 {name:"Sân bay Chu Lai",pt:[15.4033,108.7059]}
];
