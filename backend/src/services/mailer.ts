import nodemailer, { type Transporter } from 'nodemailer';
import dotenv from 'dotenv';
import { recordNotificationSQL } from './db.js';

dotenv.config();

export interface EmailLog {
  id: string;
  to: string;
  subject: string;
  sentAt: string;
  status: 'SENT' | 'SIMULATED' | 'FAILED';
  preview: string;
}

const emailOutbox: EmailLog[] = [];

// Khởi tạo SMTP Transporter
const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpSecure = process.env.SMTP_SECURE === 'true';
const smtpUser = process.env.SMTP_USER || '';
// Loại bỏ khoảng trắng trong mật khẩu ứng dụng Gmail nếu có
const rawPass = process.env.SMTP_PASS || '';
const cleanPass = rawPass.replace(/["'\s]/g, '');
const smtpFrom = process.env.SMTP_FROM || `"PingPongBros Club" <pingpongbros.club@gmail.com>`;

// Kiểm tra có thông tin SMTP thực tế
const hasSmtpCredentials = Boolean(
  smtpUser &&
  cleanPass &&
  cleanPass !== 'your-app-password' &&
  !smtpUser.includes('example')
);

let transporter: Transporter | null = null;

if (hasSmtpCredentials) {
  transporter = nodemailer.createTransport({
    service: smtpHost.includes('gmail') ? 'gmail' : undefined,
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: cleanPass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
  console.log(`[SMTP] Initialized SMTP Transporter for ${smtpUser} via ${smtpHost}`);
}

/**
 * Lấy lịch sử email đã gửi trong phiên hoạt động
 */
export function getEmailLogs(): EmailLog[] {
  return [...emailOutbox].reverse();
}

/**
 * Gửi email xác nhận đặt bàn thành công (Mô hình Transactional Outbox Pattern)
 */
export async function sendBookingConfirmationEmail(booking: {
  id: number;
  customerName: string;
  phone: string;
  email?: string;
  tableId: number;
  startTime: string;
  duration: number;
  people: number;
  type?: string;
  bookingType?: string;
}): Promise<{ success: boolean; mode: 'SMTP' | 'OUTBOX'; message: string }> {
  if (!booking.email) {
    return { success: false, mode: 'OUTBOX', message: 'Không có email người nhận.' };
  }

  const bookingCode = `PB-${String(booking.id).padStart(4, '0')}`;
  const startDate = new Date(booking.startTime);
  const timeStr = startDate.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const bType = booking.type || booking.bookingType || 'WALK_IN';

  const subject = `[PingPongBros] Xác nhận đặt bàn thành công - Mã #${bookingCode}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 24px; color: #2d3748; }
        .box { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
        .hdr { background: linear-gradient(135deg, #0d3b66, #1d4ba8); color: #ffffff; padding: 28px; text-align: center; }
        .hdr h1 { margin: 0; font-size: 22px; letter-spacing: 0.5px; }
        .hdr p { margin: 6px 0 0; opacity: 0.85; font-size: 14px; }
        .body { padding: 28px; }
        .code-card { background: #f0f7ff; border: 2px dashed #0066cc; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0; }
        .code-val { font-size: 28px; font-weight: 800; color: #0066cc; letter-spacing: 2px; }
        .tbl { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .tbl td { padding: 10px 4px; border-bottom: 1px solid #edf2f7; font-size: 14px; }
        .tbl td:first-child { color: #718096; width: 40%; }
        .tbl td:last-child { font-weight: 600; color: #1a202c; text-align: right; }
        .alert { background: #fffaf0; border-left: 4px solid #dd6b20; padding: 12px 16px; margin: 20px 0; border-radius: 4px; font-size: 13px; color: #7b341e; }
        .ftr { background: #f7fafc; padding: 16px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="hdr">
          <h1>🏓 CLB BÓNG BÀN PINGPONGBROS</h1>
          <p>Xác nhận đặt bàn thành công</p>
        </div>
        <div class="body">
          <p>Xin chào <b>${booking.customerName}</b>,</p>
          <p>Cảm ơn bạn đã lựa chọn trải nghiệm dịch vụ tại PingPongBros. Đơn đặt bàn của bạn đã được ghi nhận trên hệ thống:</p>
          
          <div class="code-card">
            <div style="font-size: 12px; text-transform: uppercase; color: #4a5568; margin-bottom: 4px;">Mã check-in của bạn</div>
            <div class="code-val">${bookingCode}</div>
          </div>

          <table class="tbl">
            <tr><td>Bàn số</td><td>Bàn ${booking.tableId}</td></tr>
            <tr><td>Ngày chơi</td><td>${dateStr}</td></tr>
            <tr><td>Giờ bắt đầu</td><td>${timeStr}</td></tr>
            <tr><td>Thời lượng</td><td>${booking.duration} giờ</td></tr>
            <tr><td>Số người chơi</td><td>${booking.people} người</td></tr>
            <tr><td>Hình thức</td><td>${bType === 'MEMBER' ? 'Khách tháng (Hội viên)' : 'Khách vãng lai'}</td></tr>
          </table>

          <div class="alert">
            ⚠️ <b>Quy định giữ bàn (15 phút):</b><br/>
            Quý khách vui lòng đến quầy và cung cấp mã <b>${bookingCode}</b> để nhân viên check-in trong vòng <b>15 phút</b> kể từ giờ hẹn. Sau 15 phút, hệ thống sẽ tự động hủy lịch để nhường bàn cho khách hàng trong hàng chờ.
          </div>

          <p style="font-size: 13px; color: #4a5568;">Mọi thắc mắc xin vui lòng liên hệ hotline: <b>0918 901 284</b> hoặc phản hồi trực tiếp email này.</p>
        </div>
        <div class="ftr">
          © ${new Date().getFullYear()} PingPongBros Club - Đam mê trong từng đường bóng.<br/>
          Địa chỉ: 71 Ngũ Hành Sơn, Đà Nẵng
        </div>
      </div>
    </body>
    </html>
  `;

  // 1. Ghi nhận ngay vào Email Outbox
  const emailEntry: EmailLog = {
    id: `EMAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    to: booking.email,
    subject,
    sentAt: new Date().toISOString(),
    status: 'SIMULATED',
    preview: `Mã ${bookingCode} cho ${booking.customerName} (${booking.email}). Giao diện HTML đã kết xuất.`,
  };
  emailOutbox.push(emailEntry);

  // 2. Lưu vết thông báo vào SQL Server nếu có kết nối
  recordNotificationSQL(null, subject, `Mã đặt bàn ${bookingCode} cho khách ${booking.customerName} lúc ${timeStr} ${dateStr}`).catch(() => {});

  // 3. Gửi email thực tế qua Google SMTP
  if (transporter && hasSmtpCredentials) {
    try {
      console.log(`[SMTP] Sending real email to ${booking.email}...`);
      const info = await transporter.sendMail({
        from: smtpFrom,
        to: booking.email,
        subject,
        html: htmlContent,
      });

      emailEntry.status = 'SENT';
      console.log(`[SMTP] Successfully delivered email to ${booking.email}! MessageId: ${info.messageId}`);
      return { success: true, mode: 'SMTP', message: `Đã gửi email xác nhận thành công tới ${booking.email}` };
    } catch (err: any) {
      console.warn(`[SMTP Warning] Error delivering to ${booking.email} via SMTP:`, err?.message || err);
      emailEntry.status = 'FAILED';
    }
  }

  return {
    success: true,
    mode: 'OUTBOX',
    message: `Đã ghi nhận gửi email mã #${bookingCode} tới ${booking.email} (Outbox sẵn sàng)`,
  };
}


/**
 * Gửi email chứa mã xác thực OTP đăng ký tài khoản
 */
export async function sendOtpEmail(email: string, otp: string, customerName: string): Promise<{ success: boolean; message: string }> {
  const subject = `[PingPongBros] Mã xác thực OTP đăng ký tài khoản: ${otp}`;
  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 24px; color: #2d3748; }
        .box { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
        .hdr { background: linear-gradient(135deg, #0d3b66, #1d4ba8); color: #ffffff; padding: 24px; text-align: center; }
        .hdr h1 { margin: 0; font-size: 20px; color: #ffffff; }
        .body { padding: 28px; text-align: center; }
        .otp-box { background: #f0f7ff; border: 2px dashed #0066cc; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .otp-code { font-size: 34px; font-weight: 900; letter-spacing: 6px; color: #0066cc; }
        .alert { background: #fffaf0; border-left: 4px solid #dd6b20; padding: 10px 14px; margin: 16px 0; border-radius: 4px; font-size: 13px; color: #7b341e; text-align: left; }
        .ftr { background: #f7fafc; padding: 14px; text-align: center; font-size: 12px; color: #a0aec0; border-top: 1px solid #edf2f7; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="hdr">
          <h1>🏓 CLB BÓNG BÀN PINGPONGBROS</h1>
          <p style="margin: 4px 0 0; opacity: 0.85; font-size: 13px; color: #ffffff;">Xác thực đăng ký tài khoản</p>
        </div>
        <div class="body">
          <p style="text-align: left; margin: 0 0 12px;">Xin chào <b>${customerName || 'Quý khách'}</b>,</p>
          <p style="text-align: left; margin: 0; font-size: 14px; color: #4a5568;">
            Bạn đang thực hiện đăng ký tài khoản tại hệ thống CLB Bóng bàn PingPongBros. Dưới đây là mã xác thực OTP của bạn:
          </p>

          <div class="otp-box">
            <div style="font-size: 12px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; font-weight: bold;">Mã xác thực OTP</div>
            <div class="otp-code">${otp}</div>
          </div>

          <div class="alert">
            ⏱️ <b>Thời hạn:</b> Mã OTP này có hiệu lực trong vòng <b>5 phút</b>.<br/>
            🔒 <b>Bảo mật:</b> Vui lòng tuyệt đối không chia sẻ mã này cho bất kỳ ai.
          </div>

          <p style="text-align: left; font-size: 13px; color: #718096; margin-top: 16px;">
            Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
          </p>
        </div>
        <div class="ftr">
          © ${new Date().getFullYear()} PingPongBros Club · 71 Ngũ Hành Sơn, Đà Nẵng
        </div>
      </div>
    </body>
    </html>
  `;

  emailOutbox.push({
    id: `EMAIL-OTP-${Date.now()}`,
    to: email,
    subject,
    sentAt: new Date().toISOString(),
    status: hasSmtpCredentials ? 'SENT' : 'SIMULATED',
    preview: `Mã OTP ${otp} cho ${customerName} (${email})`,
  });

  if (transporter && hasSmtpCredentials) {
    try {
      console.log(`[SMTP] Sending OTP ${otp} to ${email}...`);
      await transporter.sendMail({
        from: smtpFrom,
        to: email,
        subject,
        html: htmlContent,
      });
      console.log(`[SMTP] Successfully delivered OTP email to ${email}!`);
      return { success: true, message: `Đã gửi mã OTP đến ${email}` };
    } catch (err: any) {
      console.warn(`[SMTP Warning] Error delivering OTP to ${email}:`, err?.message || err);
    }
  }

  return { success: true, message: `Đã tạo mã OTP cho ${email} (Outbox sẵn sàng)` };
}
