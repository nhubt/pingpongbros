# Mapping từ tài liệu sang hệ thống

| Màn hình | Vai trò | Chức năng | Quy tắc nghiệp vụ | API | Database | BPMN task |
| --- | --- | --- | --- | --- | --- | --- |
| Sơ đồ sân | Quản lý / nhân viên | Quản lý trạng thái bàn | 16 bàn, 4 dãy; khu dạy học bàn 1-4; khu khách 5-16; 4 người/bàn | `/api/tables` | `tables` | Tiếp nhận nhu cầu / phân bổ bàn |
| Đặt bàn online | Khách / nhân viên | Đặt bàn | Giá 20.000đ/người/giờ; mặc định 2 giờ; mở cửa 06:00-21:00 | `/api/bookings` | `bookings` | Đặt bàn / xác nhận | 
| Khách tháng | Quản lý / nhân viên | Quản lý gói hội viên | Gói 1/3/6 tháng; 30 lượt/tháng; cảnh báo nếu <=5 lượt | `/api/members` | `members` | Kiểm tra gói, nhắc gia hạn |
| Lớp học | Giáo viên / quản lý | Đăng ký và duyệt lớp | Lớp học trước 19:00; 2 bàn/lớp | `/api/classes` | `class_sessions` | Duyệt lớp học |
| Quầy nhân viên | Nhân viên | Check-in / xử lý khách | Bàn khu dạy học mở cho khách sau 19:00 nếu không xung đột | `/api/bookings` | `bookings` | Check-in / check-out |
| Thanh toán | Nhân viên / quản lý | Thu tiền | Tính tiền mặt hoặc hóa đơn từ số giờ và số người | `/api/payments` | `payments` | Thu tiền / tổng hợp doanh thu |
| Thống kê | Quản lý | Báo cáo, dự đoán | Dữ liệu theo giờ sử dụng, doanh thu, số lượng khách | `/api/dashboard` | `bookings`, `payments` | Tổng hợp doanh thu |
| Cấu hình | Quản lý | Quản lý hệ thống | Mở cửa, giờ dạy, tối đa 4 người/bàn | `/api/dashboard` | `configs` | Cấu hình hệ thống |
| Chatbot | Khách / nhân viên | Hỗ trợ nhanh | Hướng dẫn đặt bàn, gói và lịch học | `/api/dashboard` | `users` / `members` | Hỗ trợ AI |

Lưu ý: các quy tắc về tiền và quyền được ưu tiên lấy từ đặc tả xác nhận, trong khi luồng nghiệp vụ ưu tiên từ BPMN TO-BE.
