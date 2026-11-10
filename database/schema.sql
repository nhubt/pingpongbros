-- ====================================================================
-- HỆ THỐNG ĐẶT BÀN VÀ QUẢN LÝ SÂN BÓNG BÀN PINGPONGBROS
-- CƠ SỞ DỮ LIỆU: SQL SERVER (T-SQL)
-- Tuân thủ mục 7.1 và 7.2 của Tài liệu Đặc tả Yêu cầu Nghiệp vụ
-- ====================================================================

-- 1. Bảng Người dùng hệ thống (Tài khoản)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='nguoi_dung' AND xtype='U')
CREATE TABLE nguoi_dung (
    id INT IDENTITY(1,1) PRIMARY KEY,
    vai_tro NVARCHAR(32) NOT NULL CHECK (vai_tro IN ('GUEST', 'MEMBER', 'TEACHER', 'STAFF', 'MANAGER')),
    ho_ten NVARCHAR(255) NOT NULL,
    sdt VARCHAR(20) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    mat_khau_bam NVARCHAR(255) NOT NULL,
    tao_luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 2. Bảng Khách hàng
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='khach' AND xtype='U')
CREATE TABLE khach (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ho_ten NVARCHAR(255) NOT NULL,
    sdt VARCHAR(20) NOT NULL,
    email VARCHAR(255) NULL,
    loai NVARCHAR(32) NOT NULL CHECK (loai IN ('vang_lai', 'thang', 'giao_vien')),
    nguoi_dung_id INT NULL REFERENCES nguoi_dung(id),
    tao_luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 3. Bảng Gói đăng ký hội viên
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='goi_dang_ky' AND xtype='U')
CREATE TABLE goi_dang_ky (
    id NVARCHAR(32) PRIMARY KEY,
    ten NVARCHAR(100) NOT NULL,
    so_thang INT NOT NULL CHECK (so_thang IN (1, 3, 6)),
    gia INT NOT NULL CHECK (gia IN (449000, 1149000, 1999000)),
    luot_moi_ky INT NOT NULL DEFAULT 30
);

-- 4. Bảng Đăng ký gói (Hội viên tham gia gói)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='dang_ky_goi' AND xtype='U')
CREATE TABLE dang_ky_goi (
    id INT IDENTITY(1,1) PRIMARY KEY,
    khach_id INT NOT NULL REFERENCES khach(id),
    goi_id NVARCHAR(32) NOT NULL REFERENCES goi_dang_ky(id),
    bat_dau DATETIME2 NOT NULL,
    ket_thuc DATETIME2 NOT NULL,
    tong_luot INT NOT NULL CHECK (tong_luot > 0),
    da_dung INT NOT NULL DEFAULT 0,
    trang_thai NVARCHAR(32) NOT NULL DEFAULT 'active' CHECK (trang_thai IN ('active', 'warning', 'expired')),
    tao_luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 5. Bảng Bàn bóng bàn (16 bàn, 4 dãy)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ban' AND xtype='U')
CREATE TABLE ban (
    id INT IDENTITY(1,1) PRIMARY KEY,
    so_ban INT NOT NULL UNIQUE CHECK (so_ban BETWEEN 1 AND 16),
    khu NVARCHAR(32) NOT NULL CHECK (khu IN ('day_hoc', 'khach')), -- Dãy 1: 1-4 khu day_hoc; Dãy 2-4: 5-16 khu khach
    day_so INT NOT NULL CHECK (day_so BETWEEN 1 AND 4),
    suc_chua INT NOT NULL DEFAULT 4 CHECK (suc_chua BETWEEN 1 AND 4),
    bao_tri BIT NOT NULL DEFAULT 0,
    trang_thai NVARCHAR(32) NOT NULL DEFAULT 'available'
);

-- 6. Bảng Cấu hình hệ thống
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='cau_hinh' AND xtype='U')
CREATE TABLE cau_hinh (
    khoa NVARCHAR(64) PRIMARY KEY,
    gia_tri NVARCHAR(255) NOT NULL,
    mo_ta NVARCHAR(255) NULL
);

-- 7. Bảng Đặt bàn
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='dat_ban' AND xtype='U')
CREATE TABLE dat_ban (
    id INT IDENTITY(1,1) PRIMARY KEY,
    ma_qr NVARCHAR(64) NULL,
    khach_id INT NULL REFERENCES khach(id),
    ban_id INT NOT NULL REFERENCES ban(id),
    bat_dau DATETIME2 NOT NULL,
    thoi_luong NUMERIC(4,1) NOT NULL DEFAULT 2.0,
    so_nguoi INT NOT NULL CHECK (so_nguoi BETWEEN 1 AND 4),
    kenh NVARCHAR(32) NOT NULL DEFAULT 'web',
    coc INT NOT NULL DEFAULT 0,
    trang_thai NVARCHAR(32) NOT NULL DEFAULT 'CONFIRMED' CHECK (trang_thai IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED')),
    xs_khong_den NUMERIC(4,2) NULL,
    tao_luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 8. Bảng Phiên chơi thực tế (Check-in / Check-out)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='phien_choi' AND xtype='U')
CREATE TABLE phien_choi (
    id INT IDENTITY(1,1) PRIMARY KEY,
    dat_ban_id INT NOT NULL REFERENCES dat_ban(id),
    ban_id INT NOT NULL REFERENCES ban(id),
    khach_id INT NULL REFERENCES khach(id),
    gio_vao DATETIME2 NOT NULL,
    gio_ra DATETIME2 NULL,
    tien INT NOT NULL DEFAULT 0,
    tru_coc INT NOT NULL DEFAULT 0,
    ghi_luot INT NOT NULL DEFAULT 0
);

-- 9. Bảng Lớp học của giáo viên
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='lop_hoc' AND xtype='U')
CREATE TABLE lop_hoc (
    id INT IDENTITY(1,1) PRIMARY KEY,
    giao_vien_id INT NOT NULL,
    giao_vien_ten NVARCHAR(255) NOT NULL,
    ngay DATE NOT NULL,
    bat_dau INT NOT NULL CHECK (bat_dau BETWEEN 6 AND 17),
    ket_thuc INT NOT NULL CHECK (ket_thuc <= 19),
    ban_ids NVARCHAR(64) NOT NULL, -- Phân bổ 2 bàn khu dạy học (VD: '1,2')
    trang_thai NVARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (trang_thai IN ('pending', 'approved', 'rejected')),
    nguoi_duyet NVARCHAR(255) NULL,
    ly_do NVARCHAR(255) NULL,
    tao_luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 10. Bảng Hàng chờ (Waitlist)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='hang_cho' AND xtype='U')
CREATE TABLE hang_cho (
    id INT IDENTITY(1,1) PRIMARY KEY,
    khach_id INT NULL REFERENCES khach(id),
    ho_ten NVARCHAR(255) NOT NULL,
    sdt VARCHAR(20) NOT NULL,
    so_nguoi INT NOT NULL CHECK (so_nguoi BETWEEN 1 AND 4),
    tao_luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    het_han DATETIME2 NULL,
    han_xac_nhan DATETIME2 NULL,
    trang_thai NVARCHAR(32) NOT NULL DEFAULT 'dang_cho' CHECK (trang_thai IN ('dang_cho', 'da_moi', 'da_nhan', 'tu_choi', 'het_han'))
);

-- 11. Bảng Thông báo
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='thong_bao' AND xtype='U')
CREATE TABLE thong_bao (
    id INT IDENTITY(1,1) PRIMARY KEY,
    kenh NVARCHAR(32) NOT NULL CHECK (kenh IN ('email', 'sms', 'tai_khoan')),
    nguoi_nhan NVARCHAR(255) NOT NULL,
    noi_dung NVARCHAR(MAX) NOT NULL,
    trang_thai NVARCHAR(32) NOT NULL DEFAULT 'chua_doc',
    tao_luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 12. Bảng Thanh toán & Doanh thu
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='thanh_toan' AND xtype='U')
CREATE TABLE thanh_toan (
    id INT IDENTITY(1,1) PRIMARY KEY,
    loai NVARCHAR(32) NOT NULL CHECK (loai IN ('coc', 'hoan_coc', 'tien_choi', 'goi')),
    so_tien INT NOT NULL,
    tham_chieu NVARCHAR(255) NOT NULL,
    nguoi_thu NVARCHAR(255) NOT NULL,
    tao_luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 13. Bảng AI Log (Ghi nhận hoạt động AI-1, AI-2, AI-3)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ai_log' AND xtype='U')
CREATE TABLE ai_log (
    id INT IDENTITY(1,1) PRIMARY KEY,
    loai NVARCHAR(32) NOT NULL CHECK (loai IN ('AI-1', 'AI-2', 'AI-3')),
    dau_vao NVARCHAR(MAX) NOT NULL,
    dau_ra NVARCHAR(MAX) NOT NULL,
    do_tin_cay NUMERIC(5,2) NULL,
    hanh_dong NVARCHAR(255) NULL,
    nguoi_quyet NVARCHAR(255) NULL,
    tao_luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 14. Bảng Nhật ký hệ thống (Audit Log)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='nhat_ky' AND xtype='U')
CREATE TABLE nhat_ky (
    id INT IDENTITY(1,1) PRIMARY KEY,
    nguoi NVARCHAR(255) NOT NULL,
    hanh_dong NVARCHAR(255) NOT NULL,
    gia_tri_cu NVARCHAR(MAX) NULL,
    gia_tri_moi NVARCHAR(MAX) NULL,
    luc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
