import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export interface BookingSuccessInfo {
  bookingId: number;
  tableNumber: number;
  customerName: string;
  phone: string;
  date: string;
  startTime: string;
  duration: number;
  people: number;
  amount: number;
  isMember: boolean;
}

interface BookingSuccessModalProps {
  info: BookingSuccessInfo;
  onClose: () => void;
}

export function BookingSuccessModal({ info, onClose }: BookingSuccessModalProps) {
  const code = `PB-${String(info.bookingId).padStart(4, '0')}`;
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Nội dung đầy đủ chi tiết đặt bàn hiển thị khi quét mã QR
  const fullBookingDetails = [
    `🏓 CLB BÓNG BÀN PINGPONGBROS`,
    `--------------------------------`,
    `• Mã đặt bàn: ${code}`,
    `• Bàn số: Bàn ${info.tableNumber}`,
    `• Khách hàng: ${info.customerName}`,
    `• Số điện thoại: ${info.phone}`,
    `• Thời gian hẹn: ${info.startTime} (Ngày ${info.date})`,
    `• Thời lượng: ${info.duration} giờ (${info.people} người)`,
    `• Hình thức: ${info.isMember ? 'Trừ lượt gói hội viên' : `${info.amount.toLocaleString('vi-VN')} VNĐ`}`,
    `--------------------------------`,
    `⚠️ Lưu ý: Quý khách vui lòng đến đúng giờ. Hệ thống giữ bàn tối đa 15 phút.`,
  ].join('\n');

  // Sinh mã QR thật chuẩn ISO/IEC 18004 chứa trọn vẹn thông tin đặt bàn
  useEffect(() => {
    let isMounted = true;

    QRCode.toDataURL(fullBookingDetails, {
      width: 240,
      margin: 1,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'L', // Dùng level L cho payload nhiều text để các ô pixel to, quét cực nhanh
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Lỗi sinh mã QR:', err);
      });

    return () => {
      isMounted = false;
    };
  }, [fullBookingDetails]);

  const handleCopy = () => {
    navigator.clipboard.writeText(fullBookingDetails).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 480, textAlign: 'center', padding: '24px 20px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: '#eafaf1',
            color: '#27ae60',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 12px',
            fontSize: 28,
          }}
        >
          ✓
        </div>

        <h2 id="booking-success-title" style={{ fontSize: 22, color: 'var(--brand)', marginBottom: 6 }}>
          Đặt bàn thành công!
        </h2>
        <p className="hint" style={{ fontSize: 13, marginBottom: 16 }}>
          Dùng <b>Camera điện thoại</b> hoặc <b>Zalo</b> quét mã QR dưới đây để xem ngay toàn bộ thông tin đặt bàn.
        </p>

        {/* Khung hiển thị Mã bàn & QR thật */}
        <div
          style={{
            background: 'var(--surface2, #f4f6fa)',
            border: '2px dashed var(--brand)',
            borderRadius: 12,
            padding: '16px 12px',
            margin: '0 0 16px',
          }}
        >
          <small
            style={{
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: 'var(--muted)',
              fontSize: 11,
              fontWeight: 'bold',
            }}
          >
            Mã check-in của bạn
          </small>
          <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 3, color: '#c0392b', margin: '4px 0' }}>
            {code}
          </div>
          <div style={{ fontWeight: 'bold', color: 'var(--brand)', fontSize: 16 }}>
            Bàn số {info.tableNumber}
          </div>

          {/* Hiển thị mã QR Code thật 100% quét được */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Mã QR Thông tin đặt bàn ${code}`}
                style={{
                  width: 180,
                  height: 180,
                  background: '#fff',
                  padding: 8,
                  borderRadius: 8,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                  objectFit: 'contain',
                }}
              />
            ) : (
              <div
                style={{
                  width: 180,
                  height: 180,
                  background: '#f0f0f0',
                  borderRadius: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  color: '#888',
                }}
              >
                Đang tạo mã QR...
              </div>
            )}
          </div>
          <small className="hint" style={{ display: 'block', marginTop: 8, fontSize: 12, color: '#1a5276', fontWeight: 500 }}>
            📲 Quét mã để xem ngay trọn vẹn thông tin đặt bàn trên điện thoại
          </small>
        </div>

        {/* Thông tin tóm tắt lượt đặt */}
        <div
          style={{
            textAlign: 'left',
            fontSize: 13,
            background: '#fff',
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            padding: '12px 14px',
            marginBottom: 14,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Khách hàng:</span>
            <b>
              {info.customerName} ({info.phone})
            </b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Thời gian:</span>
            <b>
              {info.startTime} · Ngày {info.date}
            </b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Thời lượng & Số người:</span>
            <span>
              {info.duration} giờ · {info.people} người
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span style={{ color: 'var(--muted)' }}>Hình thức thanh toán:</span>
            <b style={{ color: info.isMember ? '#27ae60' : '#c0392b' }}>
              {info.isMember ? 'Trừ lượt gói hội viên' : `${info.amount.toLocaleString('vi-VN')}đ (thu khi checkout)`}
            </b>
          </div>
        </div>

        <div
          style={{
            padding: '8px 12px',
            background: '#fef9e7',
            border: '1px solid #f39c12',
            borderRadius: 6,
            fontSize: 12,
            color: '#7d6608',
            marginBottom: 14,
          }}
        >
          ⏱️ <b>Quy định giữ bàn:</b> Sân giữ bàn tối đa <b>15 phút</b> kể từ giờ đặt ({info.startTime}). Quá hạn bàn
          sẽ tự động được giải phóng cho khách chờ.
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            className="btn ghost"
            type="button"
            style={{ flex: 1, padding: '10px 0', fontSize: 13 }}
            onClick={handleCopy}
          >
            {copied ? '✓ Đã sao chép!' : '📋 Sao chép thông tin'}
          </button>
          <button
            className="btn red"
            type="button"
            style={{ flex: 1, padding: '10px 0', fontSize: 14 }}
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
