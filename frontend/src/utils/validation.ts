/**
 * Tiện ích kiểm tra và chuẩn hóa dữ liệu đầu vào theo quy định nghiệp vụ PingPongBros:
 * - Số điện thoại Việt Nam hợp lệ: 10 chữ số, thuộc các đầu mạng 03, 05, 07, 08, 09 (hoặc +84).
 * - Email đúng định dạng tiêu chuẩn.
 */

export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/[\s().-]/g, '').trim();
  if (cleaned.startsWith('+84')) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('84') && cleaned.length === 11) {
    return '0' + cleaned.slice(2);
  }
  return cleaned;
}

export function isValidVietnamPhone(raw: string): boolean {
  if (!raw) return false;
  const normalized = normalizePhone(raw);
  // Định dạng: 10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09
  const vnPhoneRegex = /^(03[2-9]|05[2689]|07[06-9]|08[1-9]|09[0-9])\d{7}$/;
  return vnPhoneRegex.test(normalized);
}

export function isValidEmail(raw: string): boolean {
  if (!raw) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(raw.trim());
}

export function validateCustomerContact(name: string, phone: string, email: string, isGuest: boolean = false): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!name || !name.trim()) {
    errors.push('Vui lòng nhập họ tên.');
  }

  if (!phone || !phone.trim()) {
    errors.push('Vui lòng nhập số điện thoại.');
  } else if (!isValidVietnamPhone(phone)) {
    errors.push('Số điện thoại không đúng định dạng số di động Việt Nam (gồm 10 số, bắt đầu bằng 03, 05, 07, 08, 09).');
  }

  if (email && email.trim()) {
    if (!isValidEmail(email)) {
      errors.push('Định dạng email không hợp lệ (ví dụ: ten@domain.com).');
    }
  } else if (!isGuest) {
    errors.push('Vui lòng nhập email.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

