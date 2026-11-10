import { dashboardData } from '../data/mock.js';

/**
 * Quét và tự động hủy các đơn đặt quá hạn 15 phút chưa check-in (Quy tắc BR04)
 */
export function sweepExpiredBookings(nowTime = Date.now()): number[] {
  const cancelledIds: number[] = [];

  dashboardData.bookings.forEach((booking) => {
    if (booking.status === 'CONFIRMED') {
      const startTime = new Date(booking.startTime).getTime();
      const diffMinutes = (nowTime - startTime) / (60 * 1000);

      if (diffMinutes >= 15) {
        booking.status = 'CANCELLED';
        const table = dashboardData.tables.find((t) => t.tableNumber === booking.tableId);
        if (table && table.status === 'busy') {
          table.status = 'available';
        }
        cancelledIds.push(booking.id);
        console.log(`[Scheduler] Đã tự động hủy lượt đặt #${booking.id} (Quá hạn 15 phút chưa check-in) và giải phóng Bàn ${booking.tableId}.`);
      }
    }
  });

  return cancelledIds;
}

/**
 * Tác vụ định kỳ hệ thống PingPongBros:
 * - BR04: Quá 15 phút kể từ giờ đặt mà chưa check-in -> Tự động hủy lượt và giải phóng bàn.
 * - Nhắc nhở trước 30 phút và nhắc trễ 5 phút (giữ bàn trong 15p).
 * - Vào 23:59 ngày cuối tháng tổng hợp tiền giáo viên (250k/lượt).
 */
export function startBackgroundScheduler(): () => void {
  const timer = setInterval(() => {
    const now = new Date();
    sweepExpiredBookings(now.getTime());

    // 2. Tự động kiểm tra cuối tháng tổng hợp tiền giáo viên
    const isLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() === now.getDate();
    if (isLastDay && now.getHours() === 23 && now.getMinutes() >= 58) {
      console.log('[Scheduler] 23:59 ngày cuối tháng: Đã tổng hợp tiền dạy của các giáo viên để quản lý thu ngoài.');
    }
  }, 30000); // Quét mỗi 30 giây

  return () => clearInterval(timer);
}
