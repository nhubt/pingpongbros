import { useEffect, useState, type FormEvent } from 'react';
import { isValidEmail, isValidVietnamPhone, validateCustomerContact } from '../utils/validation';
import { sendRegisterOtp, registerUser } from '../services/api';

interface LoginPageProps {
  error: string;
  onLogin: (identifier: string, password: string) => Promise<void>;
}

export function LoginPage({ error, onLogin }: LoginPageProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [registerMessage, setRegisterMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Trạng thái cho form đăng ký
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regOtp, setRegOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [isTeacher, setIsTeacher] = useState(false);

  // Đảm bảo không sinh thanh cuộn trên body
  useEffect(() => {
    document.body.classList.add('is-login');
    return () => {
      document.body.classList.remove('is-login');
    };
  }, []);

  // Đếm ngược thời gian gửi lại OTP
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setInterval(() => setOtpCooldown((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [otpCooldown]);

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    const trimmedEmail = identifier.trim();
    if (!trimmedEmail) {
      setFormError('Vui lòng nhập địa chỉ Email đăng nhập.');
      return;
    }

    // Chặn hoàn toàn số điện thoại
    if (/^[0-9+]+$/.test(trimmedEmail)) {
      setFormError('Hệ thống chỉ cho phép đăng nhập bằng địa chỉ Email, không hỗ trợ đăng nhập bằng số điện thoại.');
      return;
    }

    if (!isValidEmail(trimmedEmail) && trimmedEmail.toLowerCase() !== 'admin') {
      setFormError('Email đăng nhập không đúng định dạng (ví dụ: admin@pingpongbros.vn).');
      return;
    }

    if (!password) {
      setFormError('Vui lòng nhập mật khẩu tài khoản.');
      return;
    }

    setSubmitting(true);
    try {
      await onLogin(trimmedEmail, password);
    } catch {
      // The API error is shown by the parent.
    } finally {
      setSubmitting(false);
    }
  };

  // Gửi mã OTP xác thực qua email
  const handleSendOtp = async () => {
    if (!regEmail || !isValidEmail(regEmail)) {
      setRegisterMessage('Vui lòng nhập địa chỉ Email hợp lệ trước khi nhận mã OTP.');
      return;
    }
    setSendingOtp(true);
    setRegisterMessage('');
    try {
      const res = await sendRegisterOtp(regEmail.trim(), regName.trim());
      setOtpSent(true);
      setOtpCooldown(60);
      setRegisterMessage(res.message || `Mã OTP xác thực đã được gửi đến hộp thư ${regEmail}.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Không thể gửi mã OTP qua email. Vui lòng kiểm tra lại.';
      setRegisterMessage(msg);
    } finally {
      setSendingOtp(false);
    }
  };

  const submitRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRegisterMessage('');

    const validation = validateCustomerContact(regName, regPhone, regEmail, true);
    if (!validation.valid) {
      setRegisterMessage(validation.errors[0]);
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setRegisterMessage('Mật khẩu tài khoản phải có độ dài tối thiểu 6 ký tự.');
      return;
    }
    if (!otpSent) {
      setRegisterMessage('Vui lòng nhấn nút "Nhận OTP" bên cạnh Email để nhận mã xác thực.');
      return;
    }
    if (!regOtp || regOtp.trim().length !== 6) {
      setRegisterMessage('Vui lòng nhập đầy đủ 6 chữ số mã xác thực OTP từ email.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await registerUser({
        ho_ten: regName.trim(),
        sdt: regPhone.trim(),
        email: regEmail.trim(),
        mat_khau: regPassword,
        otp: regOtp.trim(),
        vai_tro: isTeacher ? 'TEACHER' : 'GUEST',
      });

      setRegisterMessage(`✓ ${res.message || 'Đăng ký tài khoản thành công!'} Đang chuyển sang tab Đăng nhập...`);
      setIdentifier(regEmail.trim());
      setPassword(regPassword);
      setTimeout(() => {
        setTab('login');
        setRegisterMessage('');
      }, 1800);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Đăng ký tài khoản thất bại. Vui lòng thử lại.';
      setRegisterMessage(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-wrapper">
      {/* CỘT TRÁI: BANNER THƯƠNG HIỆU & SLOGAN ĐẶC TẢ */}
      <section className="login-hero" aria-label="Giới thiệu PingPongBros Club">
        <div className="hero-top">
          <div className="hero-brand">
            <PaddleLogo />
            <div className="brand-text">
              <b>PINGPONGBROS</b>
              <span>CLB BÓNG BÀN ĐÀ NẴNG</span>
            </div>
          </div>
          <div className="hero-tag">HỆ THỐNG ĐẶT BÀN THÔNG MINH</div>
        </div>

        <div className="hero-body">
          <h1 className="hero-slogan">
            Thể thao là không ngừng <em>bỏ cuộc!</em>
          </h1>
          <p className="hero-desc">
            Không gian rèn luyện thể chất và đam mê bóng bàn hàng đầu Đà Nẵng với 16 bàn chuẩn thi đấu ITTF.
          </p>

          <div className="hero-illustration">
            <TableTennisIllustration />
          </div>
        </div>

        <div className="hero-footer">
          <div className="hero-meta-item">
            <span className="meta-icon">📍</span>
            <span>Đà Nẵng</span>
          </div>
          <div className="hero-meta-divider">•</div>
          <div className="hero-meta-item">
            <span className="meta-icon">⏰</span>
            <span>06:00 – 21:00</span>
          </div>
          <div className="hero-meta-divider">•</div>
          <div className="hero-meta-item">
            <span className="meta-icon">📞</span>
            <span>0918.901.284</span>
          </div>
        </div>
      </section>

      {/* CỘT PHẢI: HỘP THOẠI ĐĂNG NHẬP / ĐĂNG KÝ HIỆN ĐẠI KHÔNG CUỘN */}
      <section className="login-pane">
        <div className="auth-card">
          {/* TAB CHUYỂN ĐỔI GIỮA ĐĂNG NHẬP VÀ ĐĂNG KÝ */}
          <div className="auth-tabs" role="tablist">
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'login' ? 'active' : ''}`}
              role="tab"
              aria-selected={tab === 'login'}
              onClick={() => {
                setTab('login');
                setFormError('');
                setRegisterMessage('');
              }}
            >
              <span className="tab-icon">🔑</span>
              <span>Đăng nhập</span>
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${tab === 'register' ? 'active' : ''}`}
              role="tab"
              aria-selected={tab === 'register'}
              onClick={() => {
                setTab('register');
                setFormError('');
                setRegisterMessage('');
              }}
            >
              <span className="tab-icon">✨</span>
              <span>Đăng ký tài khoản</span>
            </button>
          </div>

          {/* TAB ĐĂNG NHẬP */}
          {tab === 'login' ? (
            <form onSubmit={submitLogin} noValidate className="auth-form">
              <div className="auth-header">
                <h3>Đăng Nhập Hệ Thống</h3>
                <p>Nhập địa chỉ email của bạn để tiếp tục</p>
              </div>

              <div className="auth-fields">
                <div className="field-group">
                  <label htmlFor="login-id">Địa chỉ Email</label>
                  <div className="input-with-icon">
                    <span className="input-icon">✉️</span>
                    <input
                      className="auth-input"
                      id="login-id"
                      type="email"
                      autoComplete="email"
                      placeholder="admin@pingpongbros.vn"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                    />
                  </div>
                </div>

                <div className="field-group">
                  <div className="label-row">
                    <label htmlFor="login-pass">Mật khẩu</label>
                    <button
                      type="button"
                      className="btn-toggle-pass"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                  <div className="input-with-icon">
                    <span className="input-icon">🔒</span>
                    <input
                      className="auth-input"
                      id="login-pass"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                {(formError || error) && (
                  <div className="auth-alert err" role="alert">
                    <span>⚠️</span>
                    <span>{formError || error}</span>
                  </div>
                )}

                <button className="btn-auth-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Đang xác thực...' : 'Đăng Nhập Vào Hệ Thống →'}
                </button>
              </div>
            </form>
          ) : (
            /* TAB ĐĂNG KÝ TÀI KHOẢN */
            <form onSubmit={submitRegister} noValidate className="auth-form register-mode">
              <div className="auth-header">
                <h3>Tạo Tài Khoản Mới</h3>
                <p>Nhận mã xác thực OTP gửi trực tiếp về email của bạn</p>
              </div>

              <div className="auth-fields">
                {/* 2 CỘT GỌN GÀNG: HỌ TÊN VÀ SĐT */}
                <div className="fields-grid-2">
                  <div className="field-group">
                    <label htmlFor="reg-name">Họ và tên</label>
                    <input
                      className="auth-input compact"
                      id="reg-name"
                      autoComplete="name"
                      placeholder="Nguyễn Văn A"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                  </div>
                  <div className="field-group">
                    <label htmlFor="reg-phone">Số điện thoại</label>
                    <input
                      className="auth-input compact"
                      id="reg-phone"
                      inputMode="tel"
                      placeholder="09xx xxx xxx"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* HÀNG EMAIL KÈM NÚT NHẬN OTP */}
                <div className="field-group">
                  <label htmlFor="reg-email">Địa chỉ Email xác thực</label>
                  <div className="email-otp-group">
                    <input
                      className="auth-input compact"
                      id="reg-email"
                      inputMode="email"
                      placeholder="email-cua-ban@gmail.com"
                      value={regEmail}
                      onChange={(e) => {
                        setRegEmail(e.target.value);
                        setOtpSent(false);
                      }}
                    />
                    <button
                      type="button"
                      className={`btn-send-otp ${otpSent ? 'sent' : ''}`}
                      disabled={sendingOtp || otpCooldown > 0}
                      onClick={handleSendOtp}
                    >
                      {sendingOtp ? 'Đang gửi...' : otpCooldown > 0 ? `${otpCooldown}s` : otpSent ? 'Gửi lại' : 'Nhận OTP'}
                    </button>
                  </div>
                </div>

                {/* KHUNG NHẬP MÃ OTP NỔI BẬT */}
                {otpSent && (
                  <div className="otp-alert-card">
                    <div className="otp-card-top">
                      <span className="otp-badge">ĐÃ GỬI OTP</span>
                      <small className="otp-hint">Kiểm tra hộp thư đến (hoặc Spam) của <b>{regEmail}</b></small>
                    </div>
                    <div className="otp-input-wrapper">
                      <input
                        className="auth-input otp-field"
                        id="reg-otp"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="••••••"
                        value={regOtp}
                        onChange={(e) => setRegOtp(e.target.value.replace(/\D/g, ''))}
                        autoFocus
                      />
                      <span className="otp-chars-count">{regOtp.length}/6</span>
                    </div>
                  </div>
                )}

                {/* HÀNG MẬT KHẨU */}
                <div className="field-group">
                  <label htmlFor="reg-pass">Mật khẩu (tối thiểu 6 ký tự)</label>
                  <input
                    className="auth-input compact"
                    id="reg-pass"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Nhập mật khẩu an toàn"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                  />
                </div>

                {/* CHECKBOX GIÁO VIÊN */}
                <div className="field-group-checkbox">
                  <label className="checkbox-custom-label">
                    <input
                      type="checkbox"
                      checked={isTeacher}
                      onChange={(e) => setIsTeacher(e.target.checked)}
                    />
                    <span>Tôi là <b>Giáo viên bóng bàn</b> (đặt lịch lớp học tại CLB)</span>
                  </label>
                </div>

                {registerMessage && (
                  <div
                    className={`auth-alert ${
                      registerMessage.includes('✓') ||
                      registerMessage.includes('thành công') ||
                      registerMessage.includes('hộp thư')
                        ? 'ok'
                        : 'err'
                    }`}
                    role="status"
                  >
                    <span>{registerMessage.includes('✓') ? '✅' : 'ℹ️'}</span>
                    <span>{registerMessage}</span>
                  </div>
                )}

                <button className="btn-auth-submit" type="submit" disabled={submitting}>
                  {submitting ? 'Đang khởi tạo tài khoản...' : 'Xác Thực OTP & Đăng Ký →'}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function PaddleLogo() {
  return (
    <svg width="42" height="42" viewBox="0 0 40 40" aria-hidden="true">
      <g transform="rotate(-35 20 20)">
        <rect x="17" y="27" width="6" height="11" rx="2" fill="#f0dbb0" stroke="#fff" strokeWidth="1.6" />
        <line x1="17.5" y1="31" x2="22.5" y2="31" stroke="#8c6a3a" strokeWidth="1.2" />
        <ellipse cx="20" cy="16" rx="12.5" ry="13.5" fill="#e53935" stroke="#fff" strokeWidth="2.4" />
        <path d="M12 12 Q20 6 28 12" stroke="#ffffff66" strokeWidth="1.6" fill="none" />
      </g>
      <circle cx="33.5" cy="30" r="4.2" fill="#fff" stroke="#c9d2e6" strokeWidth=".8" />
    </svg>
  );
}

function TableTennisIllustration() {
  return (
    <svg viewBox="0 0 540 260" role="img" aria-label="Bàn bóng bàn thi đấu" style={{ width: '100%', maxHeight: '200px' }}>
      {/* Mặt bàn xanh thể thao với viền trắng */}
      <rect x="40" y="60" width="380" height="160" rx="8" fill="#1b4798" stroke="#ffffff" strokeWidth="4" />
      {/* Lưới giữa bàn */}
      <line x1="230" y1="60" x2="230" y2="220" stroke="#ffffff" strokeWidth="3" />
      <line x1="40" y1="140" x2="420" y2="140" stroke="#ffffff55" strokeWidth="2" strokeDasharray="6 4" />
      <rect x="227" y="48" width="6" height="184" fill="#ffffffcc" rx="2" />

      {/* Chân bàn */}
      <g stroke="#ffffffaa" strokeWidth="3">
        <line x1="70" y1="220" x2="70" y2="250" />
        <line x1="390" y1="220" x2="390" y2="250" />
        <line x1="70" y1="245" x2="390" y2="245" stroke="#ffffff44" strokeWidth="2" />
      </g>

      {/* Vợt bóng bàn đỏ rực rỡ */}
      <circle cx="450" cy="75" r="46" fill="#d32f2f" stroke="#ffffff" strokeWidth="4" />
      <circle cx="450" cy="75" r="30" fill="none" stroke="#ffffff44" strokeWidth="2" />
      <rect x="438" y="115" width="24" height="54" rx="10" transform="rotate(-25 450 140)" fill="#e5c898" stroke="#ffffff" strokeWidth="3" />

      {/* Quả bóng bàn với quỹ đạo chuyển động */}
      <circle cx="340" cy="45" r="11" fill="#ffffff" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />
      <path d="M315 65 Q275 95 240 115" stroke="#ffffff88" strokeWidth="2.5" fill="none" strokeDasharray="5 5" />
    </svg>
  );
}
