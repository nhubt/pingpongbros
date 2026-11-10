
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

const resendApiKey = process.env.RESEND_API_KEY || '';
const resendFrom =
  process.env.RESEND_FROM || 'PingPongBros <noreply@pingpongbros.aclclouds.online>';

async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<boolean> {
  if (!resendApiKey) {
    console.error('[Resend] Missing RESEND_API_KEY');
    return false;
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFrom,
        to: [to],
        subject,
        html,
      }),
      signal: AbortSignal.timeout(20000),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('[Resend Error]', response.status, result);
      return false;
    }

    console.log(`[Resend] Email accepted for ${to}. ID: ${result.id}`);
    return true;
  } catch (error: any) {
    console.error('[Resend Error]', error?.message || error);
    return false;
  }
}

export function getEmailLogs(): EmailLog[] {
  return [...emailOutbox].reverse();
}

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
    return {
      success: false,
      mode: 'OUTBOX',
      message: 'Không có email người nhận.',
    };
  }

  const bookingCode = `PB-${String(booking.id).padStart(4, '0')}`;
  const startDate = new Date(booking.startTime);
  const timeStr = startDate.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateStr = startDate.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const bType = booking.type || booking.bookingType || 'WALK_IN';

  const subject = `[PingPongBros] Xác nhận đặt bàn thành công - Mã #${bookingCode}`;

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 24px; color: #2d3748; }
        .box { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
        .hdr { background: linear-gradient(135deg, #0d3b66, #1d4ba8); color: #ffffff; padding: 28px; text-align: center; }
        .body { padding: 28px; }
        .code-card { background: #f0f7ff; border: 2px dashed #0066cc; border-radius: 8px; padding: 18px; text-align: center; margin: 20px 0; }
        .code-val { font-size: 28px; font-weight: 800; color: #0066cc; }
        .tbl { width: 100%; border-collapse: collapse; margin-top: 16px; }
        .tbl td { padding: 10px 4px; border-bottom: 1px solid #edf2f7; font-size: 14px; }
        .tbl td:first-child { color: #718096; width: 40%; }
        .tbl td:last-child { font-weight: 600; text-align: right; }
        .alert { background: #fffaf0; border-left: 4px solid #dd6b20; padding: 12px 16px; margin: 20px 0; font-size: 13px; }
        .ftr { background: #f7fafc; padding: 16px; text-align: center; font-size: 12px; color: #718096; }
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
          <p>Cảm ơn bạn đã lựa chọn PingPongBros.</p>
          <div class="code-card">
            <div>Mã check-in của bạn</div>
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
            <b>Quy định giữ bàn (15 phút):</b>
            Vui lòng cung cấp mã ${bookingCode} để check-in trong vòng 15 phút kể từ giờ hẹn.
          </div>
          <p>Hotline: <b>0918 901 284</b></p>
        </div>
        <div class="ftr">
          © ${new Date().getFullYear()} PingPongBros Club - Đam mê trong từng đường bóng.<br/>
          Địa chỉ: 71 Ngũ Hành Sơn, Đà Nẵng
        </div>
      </div>
    </body>
    </html>
  `;

  const emailEntry: EmailLog = {
    id: `EMAIL-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    to: booking.email,
    subject,
    sentAt: new Date().toISOString(),
    status: 'SIMULATED',
    preview: `Mã ${bookingCode} cho ${booking.customerName}`,
  };

  emailOutbox.push(emailEntry);

  recordNotificationSQL(
    null,
    subject,
    `Mã đặt bàn ${bookingCode} cho khách ${booking.customerName} lúc ${timeStr} ${dateStr}`
  ).catch(() => {});

  const sent = await sendEmail(booking.email, subject, htmlContent);

  if (sent) {
    emailEntry.status = 'SENT';
    return {
      success: true,
      mode: 'SMTP',
      message: `Đã gửi email xác nhận tới ${booking.email}`,
    };
  }

  emailEntry.status = 'FAILED';

  return {
    success: false,
    mode: 'OUTBOX',
    message: 'Không thể gửi email xác nhận. Vui lòng thử lại sau.',
  };
}

export async function sendOtpEmail(
  email: string,
  otp: string,
  customerName: string
): Promise<{ success: boolean; message: string }> {
  const subject = '[PingPongBros] Mã xác thực OTP đăng ký tài khoản';

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 24px; color: #2d3748; }
        .box { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; }
        .hdr { background: linear-gradient(135deg, #0d3b66, #1d4ba8); color: #ffffff; padding: 24px; text-align: center; }
        .body { padding: 28px; text-align: center; }
        .otp-box { background: #f0f7ff; border: 2px dashed #0066cc; border-radius: 8px; padding: 16px; margin: 20px 0; }
        .otp-code { font-size: 34px; font-weight: 900; letter-spacing: 6px; color: #0066cc; }
        .alert { background: #fffaf0; border-left: 4px solid #dd6b20; padding: 10px 14px; margin: 16px 0; font-size: 13px; text-align: left; }
        .ftr { background: #f7fafc; padding: 14px; text-align: center; font-size: 12px; color: #718096; }
      </style>
    </head>
    <body>
      <div class="box">
        <div class="hdr">
          <h1>🏓 CLB BÓNG BÀN PINGPONGBROS</h1>
          <p>Xác thực đăng ký tài khoản</p>
        </div>
        <div class="body">
          <p style="text-align:left">Xin chào <b>${customerName || 'Quý khách'}</b>,</p>
          <p style="text-align:left">Đây là mã xác thực OTP đăng ký tài khoản của bạn:</p>
          <div class="otp-box">
            <div>Mã xác thực OTP</div>
            <div class="otp-code">${otp}</div>
          </div>
          <div class="alert">
            <b>Thời hạn:</b> Mã OTP có hiệu lực trong 5 phút.<br/>
            <b>Bảo mật:</b> Không chia sẻ mã này cho bất kỳ ai.
          </div>
          <p style="text-align:left">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.</p>
        </div>
        <div class="ftr">
          © ${new Date().getFullYear()} PingPongBros Club · 71 Ngũ Hành Sơn, Đà Nẵng
        </div>
      </div>
    </body>
    </html>
  `;

  const sent = await sendEmail(email, subject, htmlContent);

  emailOutbox.push({
    id: `EMAIL-OTP-${Date.now()}`,
    to: email,
    subject,
    sentAt: new Date().toISOString(),
    status: sent ? 'SENT' : 'FAILED',
    preview: `Email OTP cho ${customerName} (${email})`,
  });

  if (!sent) {
    return {
      success: false,
      message: 'Không thể gửi email OTP. Vui lòng thử lại sau.',
    };
  }

  return {
    success: true,
    message: `Đã gửi mã OTP đến ${email}`,
  };
}
