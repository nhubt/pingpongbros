# PingPongBros - Hệ Thống Đặt Bàn và Quản Lý Sân Bóng Bàn

Hệ thống đặt bàn và quản lý câu lạc bộ bóng bàn trực tuyến chuyên nghiệp **PingPongBros**, được thiết kế và triển khai tuân thủ đầy đủ tài liệu đặc tả yêu cầu nghiệp vụ và kiến trúc phần mềm.

---

## 1. Cấu Trúc Dự Án

* `frontend/`: Ứng dụng giao diện người dùng viết bằng **React 18 + TypeScript + Vite**.
* `backend/`: Máy chủ API RESTful viết bằng **Node.js + Express + TypeScript**, tích hợp tác vụ chạy ngầm định kỳ (Background Scheduler).
* `database/`: Kịch bản khởi tạo cơ sở dữ liệu **SQL Server (T-SQL)** (`schema.sql` và `seed.sql`).

---

## 2. Các Tính Năng Nghiệp Vụ Chính Đã Hoàn Thiện

### 2.1 Ràng Buộc Dữ Liệu & Xác Thực
* **Kiểm tra dữ liệu đầu vào**: Ràng buộc số điện thoại Việt Nam chuẩn (10 chữ số, các đầu số mạng hợp lệ 03, 05, 07, 08, 09), đúng định dạng Email RFC.
* **Màn hình Đăng nhập**: Thiết kế cố định trên 1 khung màn hình không sinh thanh cuộn, phân quyền chính xác theo từng vai trò (Quản lý, Nhân viên, Giáo viên, Khách tháng, Khách vãng lai).

### 2.2 Sơ Đồ Sân & Điều Phối Bàn
* **Quy mô**: 16 bàn, chia làm 4 dãy:
  * Dãy 1 (Bàn 1–4): Khu dạy học (chỉ mở cho khách sau 19:00 nếu không có lớp).
  * Dãy 2–4 (Bàn 5–16): Khu khách.
* **Thời gian mở cửa**: 06:00 – 21:00 hằng ngày.
* **Check-in nhanh**: Nhân viên tìm kiếm theo Tên, SĐT hoặc Mã đặt bàn và thực hiện check-in trực tiếp.
* **Check-out ngay trên sân**: Khi bấm chi tiết bàn, nhân viên có thể thực hiện check-out:
  * Khách vãng lai: Tự động tính tiền (20.000đ/người/giờ).
  * Khách tháng / Giáo viên: Tự động ghi nhận và trừ 1 lượt chơi (không thu tiền mặt).
* **Hàng chờ (Waitlist)**: Khi khách đặt bàn mà hết chỗ, hiển thị lựa chọn *"Thêm vào hàng chờ"* và tự động phân bổ bàn khi có bàn trống giải phóng.
* **Giữ bàn 15 phút**: Quá 15 phút kể từ giờ đặt mà khách chưa check-in, hệ thống tự động hủy lượt và giải phóng bàn.

### 2.3 Khách Tháng & Gia Hạn Gói Cộng Dồn Lượt
* **Các gói hội viên**: 1 tháng (449.000đ), 3 tháng (1.149.000đ), 6 tháng (1.999.000đ).
* Mỗi kỳ gồm 30 lượt chơi (mặc định 2 giờ/lượt).
* **Cảnh báo sắp hết lượt**: Khi còn $\le 5$ lượt, hệ thống hiển thị trạng thái cảnh báo và nút gia hạn.
* **Quy tắc cộng dồn**: Khi gia hạn gói mới, số lượt còn lại được **cộng dồn** vào tổng lượt (Ví dụ: còn 4 lượt, gia hạn gói 1 tháng $\rightarrow$ có 34 lượt, không bị reset về 30).

### 2.4 Giáo Viên & Duyệt Lớp Học
* **Đơn giá lượt dạy**: 250.000đ/lượt (2 tiếng).
* **Quy tắc**: Mỗi lớp phân bổ 2 bàn thuộc khu dạy học (bàn 1–4) và phải kết thúc trước 19:00.
* **Duyệt lớp học**: Quản lý có chức năng Duyệt/Từ chối với thuật toán kiểm tra xung đột chặt chẽ (không trùng bàn, trùng giờ giữa các lớp).

### 2.5 Bộ Ba Tính Năng Trí Tuệ Nhân Tạo (AI)
1. **AI-1: Đề xuất khung giờ thay thế**: Khi khung giờ khách chọn đã hết bàn, AI quét và đề xuất ngay các khung giờ lân cận (trước/sau 1–2 giờ) còn bàn trống để khách 1-click chọn đổi giờ.
2. **AI-2: Dự báo giờ cao điểm**: Trên dashboard của Quản lý, hiển thị biểu đồ cột phân bố 15 khung giờ trong ngày theo 3 mức độ (Thấp: Xanh, Vừa: Vàng, Cao: Đỏ), đưa ra khuyến nghị bố trí nhân sự giờ cao điểm (17:00 – 20:00).
3. **AI-3: Trợ lý đặt bàn Chatbot NLP**: Nút tròn icon vợt bóng bàn ở góc trái màn hình. Bóc tách ngôn ngữ tự nhiên từ câu gõ tắt (ví dụ: *"tối mai 7h cho 4 người chơi 2 tiếng"* $\rightarrow$ số người, ngày, giờ, thời lượng, độ tin cậy) và cho phép xác nhận đặt bàn trực tiếp. Hiển thị câu hỏi thường gặp động theo vai trò.

### 2.6 Màn Hình Cấu Hình & Nhật Ký Thao Tác
* Quản lý có thể điều chỉnh giá chơi lẻ, giá giáo viên, hạn mức giữ bàn 15 phút, giờ đóng/mở cửa.
* Lưu vết toàn bộ lịch sử chỉnh sửa cấu hình và giao dịch thanh toán vào bảng kiểm toán.

---

## 3. Hướng Dẫn Cài Đặt và Vận Hành

### Yêu cầu môi trường:
* Node.js $\ge 18$
* SQL Server (nếu kết nối database)

### Khởi chạy Backend:
```bash
cd backend
npm install
npm run build
npm run dev
# Máy chủ khởi chạy tại http://localhost:4000
```

### Khởi chạy Frontend:
```bash
cd frontend
npm install
npm run build
npm run dev
# Giao diện khởi chạy tại http://localhost:5173
```
