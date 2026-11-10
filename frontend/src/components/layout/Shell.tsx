import { useEffect, useState } from 'react';
import type { Role, User } from '../../types';

export type PageId = 'san' | 'goi' | 'hv' | 'lop' | 'khach' | 'doanh' | 'cauhinh';

export const menus: Record<Role, [PageId, string][]> = {
  GUEST: [['san', 'Sân']],
  MEMBER: [['san', 'Sân'], ['hv', 'Góc Hội viên']],
  TEACHER: [['san', 'Sân'], ['lop', 'Lớp dạy của tôi']],
  STAFF: [['san', 'Sân'], ['khach', 'Khách tháng'], ['doanh', 'Thống kê']],
  MANAGER: [['san', 'Sân'], ['lop', 'Lớp học'], ['khach', 'Khách tháng'], ['doanh', 'Doanh thu'], ['cauhinh', 'Cấu hình']],
};

const roleLabels: Record<Role, string> = {
  GUEST: 'Khách vãng lai',
  MEMBER: 'Khách tháng',
  TEACHER: 'Giáo viên',
  STAFF: 'Nhân viên',
  MANAGER: 'Quản lý',
};

function Paddle({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <g transform="rotate(-35 20 20)">
        <rect x="17" y="27" width="6" height="11" rx="2" fill="#e9d7b5" stroke="#fff" strokeWidth="1.6" />
        <line x1="17.5" y1="31" x2="22.5" y2="31" stroke="#8c6a3a" strokeWidth="1.2" />
        <ellipse cx="20" cy="16" rx="12.5" ry="13.5" fill="#8c1c2c" stroke="#fff" strokeWidth="2.4" />
        <path d="M12 12 Q20 6 28 12" stroke="#ffffff66" strokeWidth="1.6" fill="none" />
      </g>
      <circle cx="33.5" cy="30" r="4.2" fill="#fff" stroke="#c9d2e6" strokeWidth=".8" />
    </svg>
  );
}

interface HeaderProps {
  user: User;
  activePage: PageId;
  theme: 'light' | 'dark' | 'system';
  onThemeChange: (theme: 'light' | 'dark' | 'system') => void;
  onNavigate: (page: PageId) => void;
  onLogout: () => void;
  onAccount: () => void;
  onNotifications: () => void;
}

export function Header({ user, activePage, theme, onThemeChange, onNavigate, onLogout, onAccount, onNotifications }: HeaderProps) {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setTime(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const toggleTheme = () => onThemeChange(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');

  return (
    <header className="hdr">
      <div className="gut">
        <div className="wrap">
          <div className="hdr-top">
            <div className="brand">
              <Paddle />
              <div><b>PingPongBros</b><span>Câu lạc bộ bóng bàn</span></div>
            </div>
            <button className="btn sm ghost theme-toggle" type="button" onClick={toggleTheme} title="Chuyển Light/Dark mode">
              {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Auto'}
            </button>
            <div className="clock">
              <b>{time.toLocaleTimeString('vi-VN', { hour12: false })}</b>
              <small>{['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][time.getDay()]}, {time.toLocaleDateString('vi-VN')}</small>
            </div>
            <button className="bell" type="button" aria-label="Thông báo" onClick={onNotifications}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />
              </svg>
            </button>
            <div className="chip-u">
              <span>{user.name}</span><em>{roleLabels[user.role]}</em>
              <button className="btn sm ghost" type="button" onClick={onAccount}>Tài khoản</button>
              <button className="btn sm ghost" type="button" onClick={onLogout}>Thoát</button>
            </div>
          </div>
          <nav className="nav" aria-label="Chức năng">
            {menus[user.role].map(([id, label]) => (
              <button key={id} type="button" aria-current={activePage === id ? 'page' : undefined} onClick={() => onNavigate(id)}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="ftr">
      <div className="gut">
        <div className="wrap">
          <div><h3>PingPongBros</h3><p><b>"Thể thao là không ngừng bỏ cuộc!"</b><br />Câu lạc bộ bóng bàn 16 bàn, 4 dãy: đặt bàn trực tuyến, lớp học bóng bàn và gói chơi theo tháng.</p></div>
          <div><h3>Liên hệ</h3><p>Địa chỉ: Đà Nẵng<br />Hotline: 0918901284<br />Email: pingpongbros@gmail.com</p></div>
          <div><h3>Giờ vận hành</h3><p>Hằng ngày 06:00 – 21:00<br />Khu dạy học (dãy 1) mở cho khách sau 19:00<br />Giữ bàn 15 phút kể từ giờ đặt</p></div>
          <div><h3>Nhà sáng lập</h3><p>Hoàng Bảo Ngọc - Trần Thị Phương Thảo - Bùi Kiều Linh - Trần Thị Hà Vi - Bùi Thị Như - Huỳnh Nam Trân</p></div>
        </div>
      </div>
    </footer>
  );
}
