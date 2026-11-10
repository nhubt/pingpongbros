-- ====================================================================
-- DỮ LIỆU KHỞI TẠO (SEED DATA) CHO SQL SERVER - PINGPONGBROS
-- Đã xóa toàn bộ dữ liệu mẫu, chỉ tạo duy nhất 1 tài khoản ADMIN
-- ====================================================================

-- Dọn dẹp dữ liệu giao dịch và dữ liệu mẫu cũ theo thứ tự khóa ngoại
IF OBJECT_ID('chi_tiet_dat_ban', 'U') IS NOT NULL DELETE FROM chi_tiet_dat_ban;
IF OBJECT_ID('dat_ban', 'U') IS NOT NULL DELETE FROM dat_ban;
IF OBJECT_ID('lop_hoc', 'U') IS NOT NULL DELETE FROM lop_hoc;
IF OBJECT_ID('dang_ky_goi', 'U') IS NOT NULL DELETE FROM dang_ky_goi;
IF OBJECT_ID('thanh_toan', 'U') IS NOT NULL DELETE FROM thanh_toan;
IF OBJECT_ID('khach', 'U') IS NOT NULL DELETE FROM khach;
IF OBJECT_ID('nguoi_dung', 'U') IS NOT NULL DELETE FROM nguoi_dung;
IF OBJECT_ID('ban', 'U') IS NOT NULL DELETE FROM ban;
IF OBJECT_ID('cau_hinh', 'U') IS NOT NULL DELETE FROM cau_hinh;
IF OBJECT_ID('goi_dang_ky', 'U') IS NOT NULL DELETE FROM goi_dang_ky;

-- 1. DUY NHẤT 1 TÀI KHOẢN QUẢN TRỊ VIÊN HỆ THỐNG (ADMIN)
INSERT INTO nguoi_dung (vai_tro, ho_ten, sdt, email, mat_khau_bam)
VALUES 
    ('MANAGER', N'Quản Trị Viên (Admin)', '0905123456', 'admin@pingpongbros.vn', 'admin123');

-- 2. DANH MỤC GÓI ĐĂNG KÝ HỘI VIÊN NỀN TẢNG
INSERT INTO goi_dang_ky (id, ten, so_thang, gia, luot_moi_ky)
VALUES 
    ('p1', N'Gói 1 tháng', 1, 449000, 30),
    ('p3', N'Gói 3 tháng', 3, 1149000, 30),
    ('p6', N'Gói 6 tháng', 6, 1999000, 30);

-- 3. CẤU HÌNH VẬN HÀNH HỆ THỐNG MẶC ĐỊNH
INSERT INTO cau_hinh (khoa, gia_tri, mo_ta)
VALUES 
    ('court_price', '20000', N'Giá chơi lẻ 20.000đ/người/giờ'),
    ('teacher_price', '250000', N'Đơn giá lượt dạy của giáo viên 250.000đ/lượt'),
    ('hold_limit_minutes', '15', N'Thời gian giữ bàn tối đa 15 phút'),
    ('default_hours', '2', N'Thời lượng chơi mặc định 2 giờ'),
    ('max_people_per_table', '4', N'Sức chứa tối đa 4 người/bàn'),
    ('opening_hour', '6', N'Giờ mở cửa 06:00'),
    ('closing_hour', '21', N'Giờ đóng cửa 21:00'),
    ('class_cutoff_hour', '19', N'Lớp học kết thúc trước 19:00, sau đó mở cho khách'),
    ('alert_minutes', '30', N'Nhắc lịch trước 30 phút');

-- 4. 16 BÀN BÓNG BÀN (Tất cả bàn đều ở trạng thái Trống - available)
INSERT INTO ban (so_ban, khu, day_so, suc_chua, trang_thai)
VALUES 
    (1, 'day_hoc', 1, 4, 'available'),
    (2, 'day_hoc', 1, 4, 'available'),
    (3, 'day_hoc', 1, 4, 'available'),
    (4, 'day_hoc', 1, 4, 'available'),
    (5, 'khach', 2, 4, 'available'),
    (6, 'khach', 2, 4, 'available'),
    (7, 'khach', 2, 4, 'available'),
    (8, 'khach', 2, 4, 'available'),
    (9, 'khach', 3, 4, 'available'),
    (10, 'khach', 3, 4, 'available'),
    (11, 'khach', 3, 4, 'available'),
    (12, 'khach', 3, 4, 'available'),
    (13, 'khach', 4, 4, 'available'),
    (14, 'khach', 4, 4, 'available'),
    (15, 'khach', 4, 4, 'available'),
    (16, 'khach', 4, 4, 'available');
