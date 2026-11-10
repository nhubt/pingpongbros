import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { checkInBooking, checkOutBooking, createBooking, createClassSession, createWaitlist, fetchDashboard } from '../services/api';
import type { Booking, DashboardResponse, TableInfo, User } from '../types';
import { venueNow } from '../utils/time';
import { validateCustomerContact } from '../utils/validation';
import { BookingSuccessModal, type BookingSuccessInfo } from '../components/common/BookingSuccessModal';

type CourtState = 'trong' | 'dat' | 'choi' | 'lop' | 'hoc' | 'dong';
type CourtStatus = { state: CourtState; booking?: Booking; className?: string; end?: number };
type Filter = 'all' | CourtState;

const stateLabels: Record<CourtState, string> = {
  trong: 'Trống',
  dat: 'Đã đặt',
  choi: 'Đang chơi',
  lop: 'Đang dạy',
  hoc: 'Khu dạy học',
  dong: 'Đóng cửa',
};
const bookingLabels: Record<Booking['status'], [string, string]> = {
  PENDING: ['Chờ xác nhận', 't-am'],
  CONFIRMED: ['Đã xác nhận', 't-bl'],
  CHECKED_IN: ['Đang chơi', 't-rd'],
  CHECKED_OUT: ['Hoàn thành', 't-ok'],
  CANCELLED: ['Đã hủy', 't-gr'],
};
const money = (amount: number) => `${Math.round(amount).toLocaleString('vi-VN')}đ`;
const timeText = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
const dateText = (value: string) => new Date(value).toLocaleDateString('vi-VN');
const dayKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

interface CourtPageProps {
  dashboard: DashboardResponse;
  user: User;
  onNotify: (message: string) => void;
}

export function CourtPage({ dashboard, user, onNotify }: CourtPageProps) {
  const isStaff = user.role === 'MANAGER' || user.role === 'STAFF';
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [date, setDate] = useState(() => dayKey(venueNow()));
  const [time, setTime] = useState(() => timeText(venueNow()));
  const [live, setLive] = useState(true);
  const [search, setSearch] = useState('');
  const [data, setData] = useState(dashboard);
  const [successModal, setSuccessModal] = useState<BookingSuccessInfo | null>(null);
  const [walkInCheckoutTarget, setWalkInCheckoutTarget] = useState<{ booking: Booking; tableNumber: number } | null>(null);
  const viewedAt = live ? venueNow() : new Date(`${date}T${time || '06:00'}:00`);

  // Polling tự động cập nhật bản đồ sân thời gian thực mỗi 5 giây theo yêu cầu phi chức năng mục 6.4
  useEffect(() => {
    if (!live) return;
    const interval = setInterval(() => {
      fetchDashboard()
        .then((fresh) => setData(fresh))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(interval);
  }, [live]);

  const getStatus = (table: TableInfo): CourtStatus => {
    const hour = viewedAt.getHours() + viewedAt.getMinutes() / 60;
    const opening = data.config.openingHour;
    const closing = data.config.closingHour;
    if (hour < opening || hour >= closing) return { state: 'dong' };

    const classSession = data.classes.find((item) => {
      if (item.status !== 'approved' || !item.tables.includes(table.tableNumber)) return false;
      const start = new Date(item.date);
      return dayKey(start) === dayKey(viewedAt) && hour >= item.startHour && hour < item.endHour;
    });
    if (classSession) return { state: 'lop', className: classSession.teacherName, end: classSession.endHour };

    const booking = data.bookings.find((item) => {
      if (item.tableId !== table.tableNumber || !['PENDING', 'CONFIRMED', 'CHECKED_IN'].includes(item.status)) return false;
      const start = new Date(item.startTime);
      const end = new Date(start.getTime() + item.duration * 60 * 60 * 1000);
      return viewedAt >= start && viewedAt < end;
    });
    if (booking) {
      return {
        state: booking.status === 'CHECKED_IN' ? 'choi' : 'dat',
        booking,
        end: new Date(new Date(booking.startTime).getTime() + booking.duration * 60 * 60 * 1000).getTime(),
      };
    }

    if (live && table.status === 'busy') return { state: 'choi' };
    if (table.zone === 'teaching' && hour < data.config.classCutoffHour) return { state: 'hoc' };
    return { state: 'trong' };
  };

  const counts = useMemo(() => {
    const result = { trong: 0, dat: 0, choi: 0, lop: 0 };
    data.tables.forEach((table) => {
      const state = getStatus(table).state;
      if (state in result) result[state as keyof typeof result] += 1;
    });
    return result;
  }, [data, date, time, live]);

  const refresh = async () => {
    const fresh = await fetchDashboard();
    setData(fresh);
  };

  const selected = data.tables.find((table) => table.tableNumber === selectedTable) ?? null;

  const handleCheckIn = async (bookingId: number) => {
    try {
      await checkInBooking(bookingId);
      await refresh();
      onNotify('Check-in thành công cho lượt đặt #' + bookingId);
    } catch {
      onNotify('Lỗi khi thực hiện check-in.');
    }
  };

  const handleCheckOut = async (bookingId: number) => {
    try {
      const res = await checkOutBooking(bookingId);
      await refresh();
      setSelectedTable(null);
      onNotify(res.message || 'Check-out hoàn tất.');
    } catch {
      onNotify('Lỗi khi thực hiện check-out.');
    }
  };

  const upcomingBookings = useMemo(() => {
    const now = new Date();
    return data.bookings.filter((b) => {
      const isUserBooking =
        (user.phone && b.phone === user.phone) ||
        (user.email && b.email === user.email) ||
        (b.customerName && b.customerName.toLowerCase() === user.name.toLowerCase());
      if (!isUserBooking) return false;
      if (b.status !== 'CONFIRMED') return false;

      const start = new Date(b.startTime);
      const diffMs = start.getTime() - now.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      return diffMinutes >= -15 && diffMinutes <= 30;
    });
  }, [data.bookings, user]);

  return (
    <>
      <div className="pg-h">
        <div>
          <h2>Sơ đồ sân</h2>
          <p>{isStaff ? 'Theo dõi thời gian thực, check-in và check-out ngay trên sân. Bấm vào bàn để xem chi tiết.' : user.role === 'TEACHER' ? 'Xem sân và đặt bàn lớp học ở khu dạy học. Hệ thống tự phân 2 bàn cho lớp.' : 'Xem sân theo ngày giờ và đặt bàn. Hệ thống tự phân bàn trống cho bạn.'}</p>
        </div>
        <div className="legend">
          {(['trong', 'dat', 'choi', 'lop'] as CourtState[]).map((state) => <span className={`tag st-${state}`} key={state}>{stateLabels[state]}</span>)}
          <span className="tag st-hoc">Khu dạy học / đóng cửa</span>
        </div>
      </div>

      {/* NHẮC NHỞ LỊCH ĐẶT BÀN TRƯỚC 30 PHÚT CHO KHÁCH */}
      {upcomingBookings.map((b) => {
        const diffMinutes = Math.floor((new Date(b.startTime).getTime() - Date.now()) / 60000);
        const timeText = diffMinutes > 0 ? `còn khoảng ${diffMinutes} phút nữa` : `đang trong khung giờ chơi`;
        return (
          <div
            key={b.id}
            className="alert info"
            style={{
              marginBottom: 16,
              background: '#eff6ff',
              border: '1.5px solid #2563eb',
              borderRadius: 10,
              padding: '14px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              boxShadow: '0 4px 12px rgba(37,99,235,0.08)'
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="tag t-am" style={{ fontWeight: 'bold' }}>🔔 NHẮC NHỞ LỊCH ĐẶT BÀN (TRƯỚC 30 PHÚT)</span>
                <span style={{ fontWeight: 600, color: '#1d4ed8' }}>Đơn #{b.id}</span>
              </div>
              <div style={{ fontSize: 14, color: '#1e293b' }}>
                Chào bạn <b>{b.customerName}</b>, bạn có lịch đặt tại <b>Bàn {b.tableId}</b> vào lúc <b>{new Date(b.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</b> ({timeText}).
                Vui lòng đến trước 10–15 phút để làm thủ tục check-in nhận bàn nhé!
              </div>
            </div>
            <button className="btn sm" type="button" onClick={() => setSelectedTable(b.tableId)}>
              Xem vị trí bàn {b.tableId}
            </button>
          </div>
        );
      })}

      {/* GIỚI THIỆU CÁC GÓI THÁNG DÀNH CHO KHÁCH (CHUYỂN VÀO MỤC SÂN) */}
      {user.role === 'GUEST' && (
        <section className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, #0f172a, #1e3a8a)', color: '#fff', borderRadius: 12, padding: '20px 22px', boxShadow: '0 4px 16px rgba(15,23,42,0.15)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div>
              <span className="tag" style={{ background: '#f59e0b', color: '#000', fontWeight: 'bold', marginBottom: 6 }}>TIẾT KIỆM ĐẾN 40%</span>
              <h3 style={{ margin: '4px 0', fontSize: 19, color: '#fff' }}>Gói tháng Hội viên PingPongBros</h3>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.9 }}>
                Đăng ký gói tháng để tận hưởng mức giá ưu đãi chỉ từ 11.106đ mỗi lượt 2 giờ. Lượt chơi được cộng dồn khi gia hạn!
              </p>
            </div>
            <button className="btn" style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '10px 18px', fontWeight: 'bold' }} type="button" onClick={() => onNotify('Vui lòng gặp nhân viên quầy hoặc liên hệ Hotline 0918 901 284 để kích hoạt gói tháng!')}>
              Đăng ký tại quầy ngay
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
            {/* Gói 1 tháng */}
            <div style={{ background: 'rgba(255,255,255,0.08)', padding: '16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ fontWeight: 'bold', fontSize: 16 }}>Gói 1 tháng</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', margin: '6px 0' }}>449.000đ</div>
              <div style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.5 }}>
                • <b>30 lượt</b> trong 30 ngày<br />
                • <b>14.967đ</b> mỗi lượt 2 giờ<br />
                • Chủ động đặt bàn linh hoạt
              </div>
            </div>

            {/* Gói 3 tháng */}
            <div style={{ background: 'rgba(255,255,255,0.12)', padding: '16px', borderRadius: 10, border: '1.5px solid #60a5fa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: 16 }}>Gói 3 tháng</span>
                <span className="tag" style={{ background: '#3b82f6', color: '#fff', fontSize: 10, fontWeight: 'bold' }}>PHỔ BIẾN</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', margin: '6px 0' }}>1.149.000đ</div>
              <div style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.5 }}>
                • <b>90 lượt</b> trong 90 ngày<br />
                • <b>12.767đ</b> mỗi lượt 2 giờ<br />
                • Tiết kiệm hơn cho người chơi đều đặn
              </div>
            </div>

            {/* Gói 6 tháng */}
            <div style={{ background: 'rgba(255,255,255,0.15)', padding: '16px', borderRadius: 10, border: '1.5px solid #f59e0b' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 'bold', fontSize: 16 }}>Gói 6 tháng</span>
                <span className="tag" style={{ background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 'bold' }}>TIẾT KIỆM NHẤT</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 900, color: '#fbbf24', margin: '6px 0' }}>1.999.000đ</div>
              <div style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.5 }}>
                • <b>180 lượt</b> trong 180 ngày<br />
                • <b>11.106đ</b> mỗi lượt 2 giờ<br />
                • Tặng thêm quyền ưu tiên giữ bàn
              </div>
            </div>
          </div>
        </section>
      )}

      {/* THÔNG TIN CHI TIẾT GÓI THÁNG DÀNH CHO KHÁCH THÁNG (THEO ĐẶC TẢ NGHIỆP VỤ BR07, BR08) */}
      {user.role === 'MEMBER' && (() => {
        const mem = data.members.find((m) => m.id === user.memberId || m.phone === user.phone || m.email === user.email);
        if (!mem) return null;
        const leftTurns = mem.totalTurns - mem.usedTurns;
        const isExpiring = leftTurns <= 5;
        const packName = mem.packageType === 'p6' ? 'Gói VIP 6 Tháng (180 lượt)' : mem.packageType === 'p3' ? 'Gói Nâng Cao 3 Tháng (90 lượt)' : 'Gói Tháng Cơ Bản P1 (30 lượt)';
        return (
          <section className="card" style={{ marginBottom: 16, background: '#f8fafc', border: isExpiring ? '2px solid #e67e22' : '1px solid #cbd5e1', borderRadius: 10, padding: '16px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 17, color: '#0f172a' }}>Thông tin gói tháng của bạn: {packName}</h3>
                  <span className={`tag ${leftTurns === 0 ? 't-rd' : isExpiring ? 't-am' : 't-ok'}`}>
                    {leftTurns === 0 ? 'Hết lượt' : isExpiring ? 'Sắp hết lượt' : 'Đang hoạt động'}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
                  Hội viên: <b>{mem.name}</b> ({mem.phone}) · Hạn sử dụng: <b>{new Date(mem.startDate).toLocaleDateString('vi-VN')} – {new Date(mem.endDate).toLocaleDateString('vi-VN')}</b>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>Lượt chơi còn lại:</span>
                <div style={{ fontSize: 26, fontWeight: 900, color: leftTurns === 0 ? '#dc2626' : isExpiring ? '#d97706' : '#16a34a' }}>
                  {leftTurns} <span style={{ fontSize: 14, fontWeight: 'normal', color: '#64748b' }}>/ {mem.totalTurns} lượt</span>
                </div>
              </div>
            </div>

            {/* Cảnh báo BR08 khi còn dưới 5 lượt */}
            {isExpiring && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 6, fontSize: 13, color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  ⚠️ <b>Nhắc nhở hội viên (BR08):</b> Gói của bạn chỉ còn <b>{leftTurns} lượt chơi</b>! Vui lòng liên hệ nhân viên quầy để gia hạn cộng dồn lượt trước khi hết hạn.
                </div>
                <button className="btn sm" style={{ background: '#d97706', color: '#fff', border: 'none' }} type="button" onClick={() => onNotify('Vui lòng gặp nhân viên quầy để được hỗ trợ gia hạn cộng dồn số lượt còn lại!')}>
                  Gia hạn ngay tại quầy
                </button>
              </div>
            )}
          </section>
        );
      })()}

      <div className="two">
        <section className="card" aria-label="Xem sân">
          <div className="fg">
            <div><label htmlFor="court-date">Ngày</label><input className="in" type="date" id="court-date" min={isStaff ? undefined : dayKey(new Date())} value={date} onChange={(event) => { setDate(event.target.value); setLive(false); }} /></div>
            <div><label htmlFor="court-time">Giờ</label><div className="row-in"><input className="in" type="time" id="court-time" value={time} onChange={(event) => { setTime(event.target.value); setLive(false); }} /><button className="btn ghost sm" type="button" onClick={() => { const now = venueNow(); setDate(dayKey(now)); setTime(timeText(now)); setLive(true); }}>Bây giờ</button></div></div>
          </div>
          <p className="hint" style={{ margin: '8px 0 12px' }}>
            <span className={`tag ${live ? 't-ok' : 't-am'}`}>{live ? 'Thời gian thực' : `Đang xem ${time} · ${dateText(`${date}T00:00:00`)}`}</span>
            {' '}{live ? 'Bản đồ tự cập nhật theo dữ liệu hiện tại.' : 'Bấm "Bây giờ" để về thời gian thực.'}
          </p>
          {isStaff && <StaffSearch value={search} onChange={setSearch} bookings={data.bookings} onSelect={(booking) => setSelectedTable(booking.tableId)} onCheckIn={handleCheckIn} />}
          <label>Trạng thái sân</label>
          <div className="chips" role="group" aria-label="Lọc trạng thái">
            {([
              ['all', 'Tất cả', 16],
              ['trong', 'Trống', counts.trong],
              ['dat', 'Đã đặt', counts.dat],
              ['choi', 'Đang chơi', counts.choi],
              ['lop', 'Đang dạy', counts.lop],
            ] as [Filter, string, number][]).map(([id, label, count]) => (
              <button className="fchip" type="button" key={id} aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} <b>{count}</b></button>
            ))}
          </div>

          <div className="court-map">
            {Array.from({ length: 4 }, (_, row) => (
              <div className="row-d" key={row}>
                <small>Dãy {row + 1}{row === 0 ? ` · khu dạy học (mở cho khách sau ${data.config.classCutoffHour}:00)` : ''}</small>
                <div className="row-t">
                  {data.tables.filter((table) => Math.floor((table.tableNumber - 1) / 4) === row).map((table) => {
                    const status = getStatus(table);
                    const dimmed = filter !== 'all' && filter !== status.state;
                    const description = status.booking ? `${status.booking.customerName} · đến ${timeText(new Date(status.end ?? Date.now()))}` : status.className ? `${status.className} · đến ${status.end}:00` : '';
                    const content = <><span className="n">{table.tableNumber}</span><span className="s">{stateLabels[status.state]}</span><span className="w">{description}</span></>;
                    return isStaff ? (
                      <button key={table.id} className={`tile st-${status.state}${dimmed ? ' dim' : ''}`} type="button" data-t={table.tableNumber} aria-pressed={selectedTable === table.tableNumber} aria-label={`Bàn ${table.tableNumber}, ${stateLabels[status.state]}`} onClick={() => setSelectedTable(selectedTable === table.tableNumber ? null : table.tableNumber)}>{content}</button>
                    ) : (
                      <div key={table.id} className={`tile st-${status.state}${dimmed ? ' dim' : ''}`} role="img" aria-label={`Bàn ${table.tableNumber}, ${stateLabels[status.state]}`}>{content}</div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="col">
          <section className="card" aria-label={isStaff && selected ? 'Chi tiết bàn' : 'Đặt bàn'}>
            {isStaff && selected
              ? <CourtDetail
                  table={selected}
                  status={getStatus(selected)}
                  config={data.config}
                  onBack={() => setSelectedTable(null)}
                  onCheckIn={handleCheckIn}
                  onCheckOut={handleCheckOut}
                  onOpenWalkInCheckout={(target) => setWalkInCheckoutTarget(target)}
                />
              : user.role === 'TEACHER'
                ? <ClassRequest config={data.config} onNotify={onNotify} onRefresh={refresh} user={user} />
                : <BookingForm dashboard={data} user={user} onNotify={onNotify} onRefresh={refresh} onSuccessBooking={(info) => setSuccessModal(info)} />}
          </section>
          <section className="card">
            {isStaff
              ? <WaitlistPanel bookings={data.bookings} />
              : <MyBookings bookings={data.bookings.filter((booking) => booking.phone === user.phone)} />}
          </section>
        </div>
      </div>
      {successModal && <BookingSuccessModal info={successModal} onClose={() => setSuccessModal(null)} />}

      {/* MODAL CHECK-OUT: HIỂN THỊ SỐ TIỀN CẦN THANH TOÁN HOẶC LƯỢT TRỪ TRƯỚC KHI XÁC NHẬN */}
      {walkInCheckoutTarget && (() => {
        const { booking, tableNumber } = walkInCheckoutTarget;
        const checkInTime = booking.checkedInAt ? new Date(booking.checkedInAt).getTime() : new Date(booking.startTime).getTime();
        const nowTime = Date.now();
        const actualHours = Math.max(1, Math.round(((nowTime - checkInTime) / 3600000) * 10) / 10);
        const billableHours = Math.max(booking.duration, Math.ceil(actualHours));

        const isMember = booking.type === 'MEMBER';
        const member = isMember ? data.members.find((m) => m.id === booking.memberId || m.phone === booking.phone) : null;
        const leftTurns = member ? Math.max(0, member.totalTurns - member.usedTurns) : 0;
        const turnsNeeded = billableHours <= 2 ? 1 : 2;

        let payableAmount = 0;
        let memberDeductText = '';

        if (!isMember) {
          payableAmount = booking.amount > 0 && billableHours === booking.duration ? booking.amount : (booking.people * billableHours * data.config.courtPrice);
        } else {
          if (leftTurns >= turnsNeeded) {
            payableAmount = 0;
            memberDeductText = `Trừ ${turnsNeeded} lượt trong gói tháng (${billableHours}h chơi). Không thu tiền mặt.`;
          } else if (leftTurns > 0) {
            const coveredHours = leftTurns * 2;
            const uncoveredHours = Math.max(0, billableHours - coveredHours);
            payableAmount = booking.people * uncoveredHours * data.config.courtPrice;
            memberDeductText = `Trừ ${leftTurns} lượt còn lại (${coveredHours}h). Phụ thu ngoài gói cho ${uncoveredHours}h vượt quá.`;
          } else {
            payableAmount = booking.people * billableHours * data.config.courtPrice;
            memberDeductText = `Khách tháng đã hết lượt (0 lượt). Tính phí theo giá thông thường khách vãng lai.`;
          }
        }

        return (
          <div className="mask" role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ width: 480, maxWidth: '92%', padding: 24, borderRadius: 12, background: '#fff' }}>
              <h3 style={{ marginTop: 0, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>💳 Xác nhận Check-out {isMember ? '(Khách tháng)' : '(Khách vãng lai)'}</span>
              </h3>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 14 }}>
                {payableAmount > 0
                  ? 'Vui lòng kiểm tra số tiền cần thu trước khi xác nhận hoàn tất check-out.'
                  : 'Xác nhận hoàn tất lượt chơi và giải phóng bàn.'}
              </p>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 14, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '6px 12px', fontSize: 14 }}>
                  <span style={{ color: '#64748b' }}>Khách hàng:</span>
                  <b>{booking.customerName} ({booking.phone || 'Không có SĐT'})</b>
                  <span style={{ color: '#64748b' }}>Bàn sử dụng:</span>
                  <b>Bàn {tableNumber}</b>
                  <span style={{ color: '#64748b' }}>Hình thức:</span>
                  <span>{isMember ? 'Khách tháng (Hội viên)' : 'Khách vãng lai'}</span>
                  <span style={{ color: '#64748b' }}>Số người chơi:</span>
                  <b>{booking.people} người</b>
                  <span style={{ color: '#64748b' }}>Giờ check-in:</span>
                  <span>{new Date(checkInTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ color: '#64748b' }}>Giờ check-out:</span>
                  <span>{new Date(nowTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} (Hiện tại)</span>
                  <span style={{ color: '#64748b' }}>Thời lượng:</span>
                  <b>{billableHours} giờ</b>
                  {isMember && (
                    <>
                      <span style={{ color: '#64748b' }}>Trừ gói tháng:</span>
                      <b style={{ color: '#166534' }}>{memberDeductText}</b>
                    </>
                  )}
                </div>

                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1.5px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
                    {payableAmount > 0 ? 'SỐ TIỀN CẦN THU:' : 'TIỀN MẶT CẦN THU:'}
                  </span>
                  <span style={{ fontSize: 24, fontWeight: 900, color: payableAmount > 0 ? '#dc2626' : '#16a34a' }}>
                    {payableAmount > 0 ? `${payableAmount.toLocaleString('vi-VN')}đ` : '0đ (Trừ lượt gói)'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn ghost" type="button" onClick={() => setWalkInCheckoutTarget(null)}>Quay lại</button>
                <button
                  className="btn"
                  style={{ background: '#16a34a', color: '#fff', fontWeight: 'bold' }}
                  type="button"
                  onClick={async () => {
                    const bId = booking.id;
                    setWalkInCheckoutTarget(null);
                    await handleCheckOut(bId);
                  }}
                >
                  ✓ Xác nhận Hoàn tất Check-out
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

function CourtDetail({
  table,
  status,
  config,
  onBack,
  onCheckIn,
  onCheckOut,
  onOpenWalkInCheckout,
}: {
  table: TableInfo;
  status: CourtStatus;
  config: DashboardResponse['config'];
  onBack: () => void;
  onCheckIn: (id: number) => void;
  onCheckOut: (id: number) => void;
  onOpenWalkInCheckout: (target: { booking: Booking; tableNumber: number }) => void;
}) {
  const booking = status.booking;
  const isPlaying = booking && (booking.status === 'CHECKED_IN' || status.state === 'choi');
  const isBooked = booking && (booking.status === 'CONFIRMED' || booking.status === 'PENDING' || status.state === 'dat');

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <small className="hint">Chi tiết bàn</small>
          <div className="pill-big" style={{ fontSize: 22, fontWeight: 'bold' }}>Bàn {table.tableNumber}</div>
        </div>
        <span className={`tag st-${status.state}`}>{stateLabels[status.state]}</span>
      </div>

      {booking ? (
        <dl className="det" style={{ marginTop: 12 }}>
          <dt>Họ tên khách</dt><dd><b>{booking.customerName}</b></dd>
          <dt>Số điện thoại</dt><dd>{booking.phone || '—'}</dd>
          <dt>Email</dt><dd>{booking.email || '—'}</dd>
          <dt>Loại khách</dt><dd>{booking.type === 'MEMBER' ? 'Khách tháng (Hội viên)' : booking.type === 'TEACHER' ? 'Giáo viên' : 'Khách vãng lai'}</dd>
          <dt>Số bàn đã đặt</dt><dd><b>Bàn {table.tableNumber}</b> (Sức chứa {table.capacity} người)</dd>
          <dt>Số người chơi</dt><dd><b>{booking.people} người</b></dd>
          <dt>Ngày & Giờ đặt</dt><dd>{new Date(booking.startTime).toLocaleDateString('vi-VN')} lúc {new Date(booking.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</dd>
          <dt>Thời lượng</dt><dd>{booking.duration} giờ</dd>
          {booking.checkedInAt && (
            <>
              <dt>Check-in thực tế</dt>
              <dd style={{ color: '#16a34a', fontWeight: 'bold' }}>
                {new Date(booking.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </dd>
            </>
          )}
          <dt>Trạng thái</dt><dd><span className={`tag ${booking.status === 'CHECKED_IN' ? 't-ok' : 't-am'}`}>{bookingLabels[booking.status][0]}</span></dd>
        </dl>
      ) : status.state === 'lop' ? (
        <p className="hint" style={{ margin: '10px 0' }}>{status.className} đang sử dụng bàn này. Lớp kết thúc lúc {status.end}:00.</p>
      ) : status.state === 'trong' ? (
        <p className="hint" style={{ margin: '10px 0' }}>Bàn trống lúc {timeText(new Date())}. Sức chứa tối đa {table.capacity} người.</p>
      ) : status.state === 'hoc' ? (
        <p className="hint" style={{ margin: '10px 0' }}>Bàn thuộc khu dạy học. Chỉ mở cho khách sau {config.classCutoffHour}:00 và khi không có lớp.</p>
      ) : (
        <p className="hint" style={{ margin: '10px 0' }}>Ngoài giờ mở cửa ({String(config.openingHour).padStart(2, '0')}:00 – {String(config.closingHour).padStart(2, '0')}:00).</p>
      )}

      {/* Nút check-in nếu trạng thái bàn là "Đã đặt" */}
      {booking && isBooked && !isPlaying && (
        <button
          className="btn"
          style={{ width: '100%', marginTop: 14, background: '#2563eb', color: '#fff', fontWeight: 'bold' }}
          type="button"
          onClick={() => onCheckIn(booking.id)}
        >
          Check-in nhận bàn
        </button>
      )}

      {/* Nút check-out nếu trạng thái bàn là "Đang chơi" */}
      {booking && isPlaying && (
        <button
          className="btn red"
          style={{ width: '100%', marginTop: 14, fontWeight: 'bold' }}
          type="button"
          onClick={() => {
            onOpenWalkInCheckout({ booking, tableNumber: table.tableNumber });
          }}
        >
          Check-out & Xác nhận
        </button>
      )}

      <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} type="button" onClick={onBack}>Về khung đặt bàn</button>
    </>
  );
}

function StaffSearch({ value, onChange, bookings, onSelect, onCheckIn }: { value: string; onChange: (value: string) => void; bookings: Booking[]; onSelect: (booking: Booking) => void; onCheckIn: (id: number) => void }) {
  const query = value.trim().toLowerCase();
  const numericQuery = query.replace(/^pb-0*/i, '').replace(/\D/g, '');

  const matches = bookings
    .filter((booking) => {
      if (!['CONFIRMED', 'PENDING', 'CHECKED_IN'].includes(booking.status)) return false;
      const codeFull = `pb-${String(booking.id).padStart(4, '0')}`.toLowerCase();
      const codeShort = `pb-${booking.id}`.toLowerCase();
      const searchTarget = `${booking.customerName} ${booking.phone} ${booking.id} ${codeFull} ${codeShort} bàn ${booking.tableId}`.toLowerCase();

      return (
        searchTarget.includes(query) ||
        (numericQuery && String(booking.id) === numericQuery)
      );
    })
    .slice(0, 6);

  return (
    <>
      <label htmlFor="court-search">Check-in</label>
      <input
        className="in"
        id="court-search"
        placeholder="Nhập mã check-in (ví dụ: PB-0001), tên hoặc SĐT"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <ul className="res-list">
          {matches.map((booking) => (
            <li key={booking.id}>
              <span>
                <b>PB-{String(booking.id).padStart(4, '0')}</b> · Bàn {booking.tableId} · {booking.customerName}
                <br />
                <small className="hint">{booking.phone} · {timeText(new Date(booking.startTime))}</small>
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {booking.status !== 'CHECKED_IN' && (
                  <button className="btn sm" type="button" onClick={() => onCheckIn(booking.id)}>Check-in</button>
                )}
                <button className="btn sm ghost" type="button" onClick={() => onSelect(booking)}>
                  {booking.status === 'CHECKED_IN' ? 'Xem bàn' : 'Chi tiết'}
                </button>
              </div>
            </li>
          ))}
          {!matches.length && (
            <li>
              <span className="hint">
                Không tìm thấy lượt đặt phù hợp.
                {bookings.length === 0 && ' (Hệ thống hiện chưa có lượt đặt nào, vui lòng đặt bàn trước để tạo mã)'}
              </span>
            </li>
          )}
        </ul>
      )}
      <div style={{ height: 12 }} />
    </>
  );
}

function BookingForm({ dashboard, user, onNotify, onRefresh, onSuccessBooking }: { dashboard: DashboardResponse; user: User; onNotify: (message: string) => void; onRefresh: () => Promise<void>; onSuccessBooking: (info: BookingSuccessInfo) => void }) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [email, setEmail] = useState(user.email);
  const [bookingDate, setBookingDate] = useState(dayKey(new Date()));
  const [startTime, setStartTime] = useState(() => timeText(new Date()));
  const [duration, setDuration] = useState(dashboard.config.defaultHours);
  const [people, setPeople] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [noTableWarning, setNoTableWarning] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [forceWalkIn, setForceWalkIn] = useState(false);
  const [checkInImmediately, setCheckInImmediately] = useState(false);
  const isStaff = user.role === 'STAFF' || user.role === 'MANAGER';

  // Lắng nghe đề xuất từ Chatbot AI-3 để tự động điền form cho người dùng tự kiểm tra & xác nhận
  useEffect(() => {
    const handler = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      if (detail.date) setBookingDate(detail.date);
      if (detail.time) setStartTime(detail.time);
      if (detail.duration) setDuration(detail.duration);
      if (detail.people) setPeople(detail.people);
    };
    window.addEventListener('ai3-fill-booking', handler);
    return () => window.removeEventListener('ai3-fill-booking', handler);
  }, []);

  // Kiểm tra thông tin gói của khách tháng
  const memberInfo = dashboard.members.find((m) => m.id === user.memberId || m.phone === user.phone);
  const leftTurns = memberInfo ? Math.max(0, memberInfo.totalTurns - memberInfo.usedTurns) : 0;
  const isMemberExpired = user.role === 'MEMBER' && !forceWalkIn && leftTurns <= 0;
  const estimatedTurns = Math.max(1, Math.ceil(duration / 2));

  const isWalkIn = user.role !== 'MEMBER' || forceWalkIn;
  const cost = people * duration * dashboard.config.courtPrice;
  const endTime = (() => {
    const [hour, minute] = startTime.split(':').map(Number);
    const total = hour * 60 + minute + duration * 60;
    return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  })();

  // Kiểm tra bàn có trống trong khoảng thời gian [start, start + duration]
  const isTableAvailable = (tableNumber: number, targetDate: string, targetTime: string, dur: number): boolean => {
    const reqStart = new Date(`${targetDate}T${targetTime}:00`).getTime();
    const reqEnd = reqStart + dur * 3600000;
    const startH = new Date(`${targetDate}T${targetTime}:00`).getHours();

    // Bàn khu dạy học (1-4) chỉ mở cho khách sau 19:00
    if (tableNumber >= 1 && tableNumber <= 4 && startH < dashboard.config.classCutoffHour) {
      return false;
    }

    // 1. Kiểm tra trùng booking khác
    const hasBookingConflict = dashboard.bookings.some((b) => {
      if (b.tableId !== tableNumber) return false;
      if (['CANCELLED', 'CHECKED_OUT'].includes(b.status)) return false;
      const bStart = new Date(b.startTime).getTime();
      const bEnd = bStart + b.duration * 3600000;
      return !(reqEnd <= bStart || reqStart >= bEnd);
    });
    if (hasBookingConflict) return false;

    // 2. Kiểm tra trùng lớp học đã duyệt
    const hasClassConflict = dashboard.classes.some((c) => {
      if (c.status !== 'approved' || !c.tables.includes(tableNumber)) return false;
      if (dayKey(new Date(c.date)) !== targetDate) return false;
      const endH = startH + dur;
      return !(endH <= c.startHour || startH >= c.endHour);
    });

    return !hasClassConflict;
  };

  // AI-1: Đề xuất các khung giờ thay thế có bàn trống lân cận
  const findAlternativeHours = (targetDate: string, targetTime: string, dur: number): string[] => {
    const [targetH] = targetTime.split(':').map(Number);
    const candidates = [targetH - 1, targetH + 1, targetH - 2, targetH + 2];
    const availableHours: string[] = [];

    for (const h of candidates) {
      if (h >= dashboard.config.openingHour && h + dur <= dashboard.config.closingHour) {
        const timeStr = `${String(h).padStart(2, '0')}:00`;
        const hasAvailable = dashboard.tables.some((t) => isTableAvailable(t.tableNumber, targetDate, timeStr, dur));

        if (hasAvailable && !availableHours.includes(timeStr)) {
          availableHours.push(timeStr);
        }
      }
    }
    return availableHours.slice(0, 3);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNoTableWarning(false);
    const contactValidation = validateCustomerContact(name, phone, email, true);
    if (!contactValidation.valid) {
      onNotify(contactValidation.errors[0]);
      return;
    }

    if (isMemberExpired) {
      onNotify('Gói tháng của bạn đã hết lượt chơi. Hãy gia hạn gói hoặc chọn đặt dưới tư cách khách vãng lai.');
      return;
    }

    const errors: string[] = [];
    if (!bookingDate || !startTime) errors.push('Chọn ngày và giờ bắt đầu.');
    if (people < 1 || people > dashboard.config.maxPeoplePerTable) errors.push(`Mỗi bàn tối đa ${dashboard.config.maxPeoplePerTable} người.`);
    const start = new Date(`${bookingDate}T${startTime}:00`);
    const now = new Date();
    if (start < now) errors.push('Giờ bắt đầu đã qua, vui lòng chọn giờ khác.');
    if (start.getHours() < dashboard.config.openingHour || start.getHours() + duration > dashboard.config.closingHour) errors.push('Thời lượng phải nằm trong giờ mở cửa.');

    if (errors.length) {
      onNotify(errors[0]);
      return;
    }

    // Thuật toán tìm bàn trống chống trùng giờ: ưu tiên bàn 5-16 trước, sau 19h mới chọn 1-4
    const candidateTableNumbers = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 1, 2, 3, 4];
    const freeTableNumber = candidateTableNumbers.find((tNum) => isTableAvailable(tNum, bookingDate, startTime, duration));

    if (!freeTableNumber) {
      const suggestions = findAlternativeHours(bookingDate, startTime, duration);
      setAiSuggestions(suggestions);
      setNoTableWarning(true);
      return;
    }

    setSubmitting(true);
    try {
      const created = await createBooking({
        tableId: freeTableNumber,
        customerName: name.trim(),
        phone,
        email,
        type: isWalkIn ? 'WALK_IN' : 'MEMBER',
        startTime: checkInImmediately ? new Date().toISOString() : start.toISOString(),
        duration,
        people,
        amount: isWalkIn ? cost : 0,
        memberId: isWalkIn ? null : (user.memberId ?? null),
        checkInImmediately,
      });
      await onRefresh();
      onSuccessBooking({
        bookingId: created?.id || dashboard.bookings.length + 1,
        tableNumber: freeTableNumber,
        customerName: name.trim(),
        phone,
        date: bookingDate,
        startTime: checkInImmediately ? timeText(new Date()) : startTime,
        duration,
        people,
        amount: isWalkIn ? cost : 0,
        isMember: !isWalkIn,
      });
      onNotify(checkInImmediately ? `Đã đặt bàn và check-in Bàn ${freeTableNumber} thành công theo thời gian thực!` : `Đặt bàn thành công: Bàn ${freeTableNumber} · ${bookingDate} ${startTime} (${duration} giờ).`);
    } catch (reason: any) {
      const msg = reason?.response?.data?.message || (reason instanceof Error ? reason.message : 'Không thể tạo lượt đặt.');
      onNotify(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToWaitlist = async () => {
    setSubmitting(true);
    try {
      const start = new Date(`${bookingDate}T${startTime}:00`);
      await createWaitlist({
        customerName: name.trim(),
        phone,
        email,
        people,
        startTime: start.toISOString(),
        duration,
        type: isWalkIn ? 'WALK_IN' : 'MEMBER',
      });
      await onRefresh();
      setNoTableWarning(false);
      onNotify('Đã thêm khách vào danh sách chờ. Hệ thống sẽ tự động gán bàn khi có bàn trống phù hợp!');
    } catch (reason) {
      onNotify(reason instanceof Error ? reason.message : 'Lỗi khi thêm vào danh sách chờ.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <h3>Đặt bàn</h3>
      <p className="hint" style={{ marginTop: 4 }}>
        Hệ thống tự phân bàn trống chống trùng lịch. Mặc định chơi 2 giờ, tối đa {dashboard.config.maxPeoplePerTable} người mỗi bàn.
      </p>

      {/* Cảnh báo khi khách tháng hết 30 lượt */}
      {isMemberExpired && (
        <div className="alert" style={{ background: '#fdedec', borderColor: '#c0392b', color: '#922b21', margin: '12px 0', padding: 12, borderRadius: 8 }}>
          <b>⚠️ Gói tháng của bạn đã hết lượt chơi (0/{memberInfo?.totalTurns} lượt)!</b>
          <p style={{ margin: '6px 0 10px', fontSize: 13 }}>
            Theo quy định, bạn không thể tiếp tục đặt bàn miễn phí bằng gói. Bạn có thể nhờ nhân viên gia hạn gói (cộng dồn lượt) hoặc đặt bàn theo chế độ khách vãng lai:
          </p>
          <button className="btn sm red" type="button" onClick={() => setForceWalkIn(true)}>
            Chuyển sang đặt kiểu Khách vãng lai ({money(dashboard.config.courtPrice)}/người/giờ)
          </button>
        </div>
      )}

      {forceWalkIn && user.role === 'MEMBER' && (
        <div style={{ padding: '6px 10px', background: '#fef9e7', border: '1px solid #f39c12', borderRadius: 6, margin: '8px 0', fontSize: 13, color: '#7d6608' }}>
          Đang đặt dưới hình thức: <b>Khách vãng lai</b> (tính phí theo giờ). <button className="btn sm ghost" style={{ marginLeft: 8 }} onClick={() => setForceWalkIn(false)}>Hủy</button>
        </div>
      )}

      {noTableWarning && (
        <div className="alert" style={{ background: '#fdf2e9', borderColor: '#e08a3c', color: '#8a4b08', margin: '12px 0', padding: 12, borderRadius: 8 }}>
          <b>⚠️ Hiện tại khung giờ {startTime} ({bookingDate}) đã hết bàn trống!</b>
          {aiSuggestions.length > 0 && (
            <div style={{ marginTop: 8, padding: '8px 10px', background: '#fff', borderRadius: 6, border: '1px dashed #e08a3c' }}>
              <span style={{ fontSize: 13, fontWeight: 'bold', color: 'var(--brand)' }}>🤖 AI-1 Đề xuất khung giờ thay thế:</span>
              <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                {aiSuggestions.map((sugg) => (
                  <button
                    key={sugg}
                    type="button"
                    className="btn sm"
                    style={{ background: '#1d4ba8', color: '#fff', fontSize: 12 }}
                    onClick={() => {
                      setStartTime(sugg);
                      setNoTableWarning(false);
                      onNotify(`Đã chuyển sang khung giờ gợi ý của AI: ${sugg}. Bạn có thể bấm Đặt bàn.`);
                    }}
                  >
                    Đổi sang {sugg}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p style={{ margin: '8px 0 10px', fontSize: 13 }}>Hoặc thêm khách vào danh sách chờ để tự động nhận bàn ngay khi có bàn trống:</p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn sm red" type="button" onClick={handleAddToWaitlist} disabled={submitting}>
              Thêm vào hàng chờ
            </button>
            <button className="btn sm ghost" type="button" onClick={() => setNoTableWarning(false)}>
              Hủy
            </button>
          </div>
        </div>
      )}

      <form noValidate style={{ marginTop: 12 }} onSubmit={submit}>
        <div className="fg">
          <div className="full"><label htmlFor="bk-name">Họ tên khách</label><input className="in" id="bk-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div><label htmlFor="bk-phone">Số điện thoại</label><input className="in" id="bk-phone" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
          <div><label htmlFor="bk-email">Email (không bắt buộc)</label><input className="in" id="bk-email" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div>
          <div><label htmlFor="bk-date">Ngày</label><input className="in" type="date" id="bk-date" value={bookingDate} min={dayKey(new Date())} onChange={(event) => setBookingDate(event.target.value)} /></div>
          <div><label htmlFor="bk-time">Giờ bắt đầu</label><select className="in" id="bk-time" value={startTime} onChange={(event) => setStartTime(event.target.value)}>{Array.from({ length: (dashboard.config.closingHour - dashboard.config.openingHour) * 2 }, (_, index) => { const mins = dashboard.config.openingHour * 60 + index * 30; const value = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`; return <option key={value} value={value}>{value}</option>; })}</select></div>
          <div><label htmlFor="bk-dur">Thời lượng</label><select className="in" id="bk-dur" value={duration} onChange={(event) => setDuration(Number(event.target.value))}>{[1, 1.5, 2, 2.5, 3, 3.5, 4].map((hours) => <option key={hours} value={hours}>{hours % 1 ? `${Math.floor(hours)} giờ 30` : `${hours} giờ`}</option>)}</select></div>
          <div><label>Giờ dự kiến kết thúc</label><div className="in ro">{endTime}</div></div>
          <div><label htmlFor="bk-people">Số người (tối đa 4)</label><select className="in" id="bk-people" value={people} onChange={(event) => setPeople(Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></div>
          <div className="full hint">
            {!isWalkIn
              ? `Khách tháng: Thời lượng ${duration} giờ sẽ tính ${estimatedTurns} lượt (còn lại ${leftTurns}/${memberInfo?.totalTurns ?? 30} lượt). Không thu tiền mặt.`
              : `Tạm tính: ${people} người × ${duration} giờ × ${money(dashboard.config.courtPrice)} = ${money(cost)}`}
          </div>
          {isStaff && (
            <div className="full" style={{ padding: '10px 14px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, color: '#166534', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={checkInImmediately}
                  onChange={(e) => setCheckInImmediately(e.target.checked)}
                />
                <span>⚡ Khách chơi trực tiếp (Check-in nhận bàn ngay bây giờ)</span>
              </label>
              <small style={{ display: 'block', color: '#15803d', marginTop: 4, fontSize: 12 }}>
                Hệ thống sẽ lưu thời gian thực lúc check-in và chuyển bàn sang trạng thái "Đang chơi".
              </small>
            </div>
          )}
          <div className="full">
            <button className="btn red" style={{ width: '100%' }} type="submit" disabled={submitting}>
              {submitting ? 'Đang xử lý...' : checkInImmediately ? 'Đặt bàn & Check-in ngay' : 'Đặt bàn'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

function ClassRequest({ config, onNotify, onRefresh, user }: { config: DashboardResponse['config']; onNotify: (message: string) => void; onRefresh: () => Promise<void>; user: User }) {
  const [date, setDate] = useState(dayKey(new Date()));
  const [start, setStart] = useState(10);
  const [teacher, setTeacher] = useState(user.name || 'Giáo viên');
  const [sending, setSending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (start + 2 > config.classCutoffHour || start < config.openingHour) {
      onNotify(`Lớp chỉ được học trong khoảng ${config.openingHour}:00 – ${config.classCutoffHour}:00.`);
      return;
    }
    setSending(true);
    try {
      await createClassSession({
        teacherId: user.id,
        teacherName: teacher.trim(),
        date,
        startHour: start,
      });
      await onRefresh();
      onNotify("Đăng ký lớp học thành công! Yêu cầu đang ở trạng thái 'Chờ duyệt' và chuyển Quản lý phê duyệt.");
    } catch (err: any) {
      const msg = err?.response?.data?.message || (err instanceof Error ? err.message : 'Không thể đăng ký lớp.');
      onNotify(msg);
    } finally {
      setSending(false);
    }
  };
  return (
    <>
      <h3>Đặt bàn lớp học</h3>
      <p className="hint" style={{ marginTop: 4 }}>Giáo viên chỉ đặt ở khu dạy học. Hệ thống tự phân 2 bàn, lớp kéo dài 2 giờ và kết thúc trước {config.classCutoffHour}:00.</p>
      <form noValidate style={{ marginTop: 12 }} onSubmit={submit}>
        <div className="fg">
          <div className="full"><label htmlFor="cl-teacher">Giáo viên phụ trách</label><input className="in" id="cl-teacher" value={teacher} onChange={(event) => setTeacher(event.target.value)} /></div>
          <div><label htmlFor="cl-date">Ngày học</label><input className="in" type="date" id="cl-date" value={date} min={dayKey(new Date())} onChange={(event) => setDate(event.target.value)} /></div>
          <div><label htmlFor="cl-start">Giờ bắt đầu</label><select className="in" id="cl-start" value={start} onChange={(event) => setStart(Number(event.target.value))}>{Array.from({ length: config.classCutoffHour - config.openingHour - 1 }, (_, index) => config.openingHour + index).map((hour) => <option value={hour} key={hour}>{String(hour).padStart(2, '0')}:00</option>)}</select></div>
          <div><label>Giờ kết thúc (tự tính)</label><div className="in ro">{String(start + 2).padStart(2, '0')}:00</div></div>
          <div><label>Trạng thái phê duyệt</label><div className="in ro">Chờ phê duyệt</div></div>
          <div><label>Số tiền dự kiến</label><div className="in ro">Theo cấu hình sân</div></div>
          <div className="full"><button className="btn red" type="submit" style={{ width: '100%' }} disabled={sending}>Đặt bàn lớp học</button></div>
        </div>
      </form>
    </>
  );
}

function MyBookings({ bookings }: { bookings: Booking[] }) {
  return (
    <>
      <h3>Lịch đặt bàn của tôi</h3>
      {bookings.length ? <ul className="res-list" style={{ marginTop: 10 }}>{bookings.slice(0, 12).map((booking) => {
        const status = bookingLabels[booking.status];
        const start = new Date(booking.startTime);
        return <li key={booking.id} style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}><div style={{ minWidth: 0 }}><b>Bàn {booking.tableId}</b> · {dateText(booking.startTime)} {timeText(start)} · {booking.duration} giờ<br /><small className="hint">Mã #{booking.id} · {booking.people} người</small></div><span className={`tag ${status[1]}`}>{status[0]}</span></li>;
      })}</ul> : <p className="hint" style={{ marginTop: 10 }}>Bạn chưa có lượt đặt nào.</p>}
    </>
  );
}

function WaitlistPanel({ bookings }: { bookings: Booking[] }) {
  return (
    <>
      <h3>Danh sách chờ</h3>
      <div className="ovf" style={{ marginTop: 10 }}>
        <table><thead><tr><th>Khách</th><th>SĐT</th><th>Người</th><th>Thời gian</th><th>Tình trạng</th></tr></thead>
          <tbody>{bookings.filter((booking) => booking.status === 'PENDING').map((booking) => <tr key={booking.id}><td>{booking.customerName}</td><td>{booking.phone}</td><td className="num">{booking.people}</td><td className="num">{timeText(new Date(booking.startTime))} · {booking.duration} giờ</td><td><span className="tag t-am">Đang chờ</span></td></tr>)}</tbody>
        </table>
      </div>
      {!bookings.some((booking) => booking.status === 'PENDING') && <p className="hint" style={{ marginTop: 8 }}>Chưa có khách nào đang chờ.</p>}
    </>
  );
}
