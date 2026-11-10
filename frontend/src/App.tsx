import { useEffect, useState } from 'react';
import { fetchDashboard, login } from './services/api';
import type { DashboardResponse, Role, User } from './types';
import { Header, Footer, type PageId, menus } from './components/layout/Shell';
import { LoginPage } from './pages/LoginPage';
import { CourtPage } from './pages/CourtPage';
import { ManagementPage } from './pages/ManagementPage';
import { ChatWidget } from './components/chatbot/ChatWidget';
import { Modal } from './components/common/Modal';

function App() {
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);

  // Khôi phục phiên đăng nhập từ localStorage để tránh bị văng ra trang Login khi F5 / Reload
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem('pingpongbros_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // Khôi phục trang đang xem từ localStorage
  const [activePage, setActivePage] = useState<PageId>(() => {
    try {
      const stored = localStorage.getItem('pingpongbros_page') as PageId | null;
      return stored || 'san';
    } catch {
      return 'san';
    }
  });

  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [error, setError] = useState('');
  const [modal, setModal] = useState<{ title: string; content: string } | null>(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetchDashboard()
      .then(setDashboard)
      .catch(() => setError('Không thể kết nối nền tảng API.'));
  }, []);

  useEffect(() => {
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
      return;
    }
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Đảm bảo activePage phù hợp với quyền hạn của user
  useEffect(() => {
    if (user && !menus[user.role]?.some(([id]) => id === activePage)) {
      setActivePage('san');
      localStorage.setItem('pingpongbros_page', 'san');
    }
  }, [user, activePage]);

  const handleLogin = async (identifier: string, password: string) => {
    try {
      const { user: authenticatedUser } = await login(identifier, password);
      // Lưu phiên đăng nhập vào localStorage
      localStorage.setItem('pingpongbros_user', JSON.stringify(authenticatedUser));
      setUser(authenticatedUser);
      setActivePage('san');
      localStorage.setItem('pingpongbros_page', 'san');
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Đăng nhập thất bại.');
      throw reason;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('pingpongbros_user');
    localStorage.removeItem('pingpongbros_token');
    localStorage.removeItem('pingpongbros_page');
    setUser(null);
    setActivePage('san');
  };

  const changePage = (page: PageId) => {
    if (!user || menus[user.role]?.some(([id]) => id === page)) {
      setActivePage(page);
      localStorage.setItem('pingpongbros_page', page);
    }
  };

  if (!dashboard) {
    return (
      <div className="gut">
        <div className="wrap">
          <main>
            <section className="card" role={error ? 'alert' : 'status'}>
              {error || 'Đang tải dữ liệu hệ thống...'}
              {error && <button className="btn ghost sm" onClick={() => window.location.reload()}>Thử lại</button>}
            </section>
          </main>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <LoginPage error={error} onLogin={handleLogin} />
        {notice && (
          <div className="toast-region" role="status">
            <span>{notice}</span>
            <button className="btn sm ghost" style={{ marginLeft: 8 }} onClick={() => setNotice('')}>Đóng</button>
          </div>
        )}
      </>
    );
  }

  const role: Role = user.role;

  return (
    <>
      <Header
        user={user}
        activePage={activePage}
        theme={theme}
        onThemeChange={setTheme}
        onNavigate={changePage}
        onLogout={handleLogout}
        onAccount={() => setModal({ title: 'Tài khoản của tôi', content: `${user.name} · ${user.email} · ${user.phone}` })}
        onNotifications={() => setModal({ title: 'Thông báo', content: 'Chưa có thông báo mới.' })}
      />
      <main className="gut">
        <div className="wrap">
          <div id="alerts" aria-live="polite">{notice && <div className="alert info" role="status"><span>{notice}</span><button className="btn sm ghost" onClick={() => setNotice('')}>Đóng</button></div>}</div>
          {activePage === 'san' ? (
            <CourtPage dashboard={dashboard} user={user} onNotify={setNotice} />
          ) : (
            <ManagementPage
              page={activePage}
              dashboard={dashboard}
              user={user}
              onNotify={setNotice}
              onOpenModal={(title, content) => setModal({ title, content })}
            />
          )}
        </div>
      </main>
      <Footer />
      <ChatWidget user={user} dashboard={dashboard} onNavigate={changePage} onNotify={setNotice} />
      {modal && <Modal title={modal.title} onClose={() => setModal(null)}>{modal.content}</Modal>}
    </>
  );
}

export default App;
