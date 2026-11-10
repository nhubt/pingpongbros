import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DashboardResponse, User } from '../../types';
import type { PageId } from '../layout/Shell';
import { BookingSuccessModal, type BookingSuccessInfo } from '../common/BookingSuccessModal';

interface ExtractedBooking {
  customerName: string;
  people: number;
  date: string;
  time: string;
  duration: number;
  confidence: number;
}

interface ChatMessage {
  id: number;
  role: 'assistant' | 'user';
  text: string;
  extracted?: ExtractedBooking;
  action?: { label: string; page: PageId };
  transferredToTeacher?: boolean;
}

interface ChatWidgetProps {
  user: User;
  dashboard: DashboardResponse;
  onNavigate: (page: PageId) => void;
  onNotify: (message: string) => void;
}

export function ChatWidget({ user, dashboard, onNavigate, onNotify }: ChatWidgetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [botSuccessModal, setBotSuccessModal] = useState<BookingSuccessInfo | null>(null);
  const thread = useRef<HTMLDivElement>(null);

  useEffect(() => {
    thread.current?.scrollTo({ top: thread.current.scrollHeight });
  }, [messages, open]);

  // Bộ bóc tách ngôn ngữ tự nhiên NLP của AI-3
  const parseBookingIntent = (text: string): ExtractedBooking | null => {
    const raw = text.toLowerCase();

    // 1. Nhận dạng số người (vd: 4 người, 4 ng, 2 bạn, đánh đôi -> 4, đánh đơn -> 2)
    let people = 2;
    let hasPeople = false;
    const peopleMatch = raw.match(/(\d+)\s*(người|nguoi|ng|bạn|ban|khách|khach)/);
    if (peopleMatch) {
      people = Math.min(4, Math.max(1, parseInt(peopleMatch[1], 10)));
      hasPeople = true;
    } else if (raw.includes('đánh đôi') || raw.includes('danh doi')) {
      people = 4;
      hasPeople = true;
    } else if (raw.includes('đánh đơn') || raw.includes('danh don')) {
      people = 2;
      hasPeople = true;
    }

    // 2. Nhận dạng ngày chơi (hỗ trợ cụ thể: 15/11, ngày 15/11, 15-11, ngày 15 tháng 11, ngày 15, hôm nay, mai, mốt)
    const today = new Date();
    let targetDate = new Date(today);
    let hasDate = false;

    // 2.1. Nhận dạng ngày cụ thể: 15/11, 15/11/2026, ngày 15/11, 15-11, ngày 15 tháng 11
    const explicitDateMatch = raw.match(/(?:ngày\s+)?(\d{1,2})(?:[\/\-](\d{1,2})(?:[\/\-](\d{4}))?|\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?)/);
    if (explicitDateMatch) {
      const d = parseInt(explicitDateMatch[1], 10);
      const m = parseInt(explicitDateMatch[2] || explicitDateMatch[4], 10);
      const y = explicitDateMatch[3] || explicitDateMatch[5] ? parseInt(explicitDateMatch[3] || explicitDateMatch[5], 10) : today.getFullYear();
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        targetDate = new Date(y, m - 1, d);
        hasDate = true;
      }
    } else {
      const singleDayMatch = raw.match(/ngày\s+(\d{1,2})\b/);
      if (singleDayMatch) {
        const d = parseInt(singleDayMatch[1], 10);
        if (d >= 1 && d <= 31) {
          targetDate = new Date(today.getFullYear(), today.getMonth(), d);
          hasDate = true;
        }
      }
    }

    // 2.2. Nhận dạng ngày tương đối
    if (!hasDate) {
      if (raw.includes('mai') || raw.includes('ngay mai') || raw.includes('tối mai') || raw.includes('chieu mai') || raw.includes('sáng mai')) {
        targetDate.setDate(today.getDate() + 1);
        hasDate = true;
      } else if (raw.includes('mốt') || raw.includes('ngay mot') || raw.includes('ngày kia')) {
        targetDate.setDate(today.getDate() + 2);
        hasDate = true;
      } else if (raw.includes('hôm nay') || raw.includes('hnay') || raw.includes('hn') || raw.includes('tối nay') || raw.includes('chieu nay') || raw.includes('sáng nay')) {
        hasDate = true;
      }
    }

    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    // 3. Nhận dạng giờ bắt đầu (start time)
    // Ưu tiên các cụm rõ nghĩa: "từ 20 giờ tối", "từ 20h", "lúc 20:00", "20 giờ tối", "20h", "8h tối", "8 giờ tối"
    let timeStr = '19:00';
    let hasTime = false;

    // Tìm giờ có từ khóa định vị: "từ X giờ", "lúc X giờ", "vào lúc X giờ", "từ Xh", "lúc Xh", "từ X:XX", "lúc X:XX"
    const prefixTimeMatch = raw.match(/(?:từ|tu|lúc|luc|vào|vao)\s+(\d{1,2})(?::(\d{2})|\s*(?:h|giờ|gio)(?:\s*(\d{2}))?)?\s*(tối|toi|chiều|chieu|sáng|sang|pm|am)?/);
    if (prefixTimeMatch) {
      let h = parseInt(prefixTimeMatch[1], 10);
      const m = prefixTimeMatch[2] || prefixTimeMatch[3] ? parseInt(prefixTimeMatch[2] || prefixTimeMatch[3], 10) : 0;
      const period = prefixTimeMatch[4] || '';
      if ((period.includes('tối') || period.includes('toi') || period.includes('chiều') || period.includes('chieu') || period === 'pm') && h < 12) {
        h += 12;
      }
      timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      hasTime = true;
    } else {
      // Tìm giờ có buổi đi kèm: "20 giờ tối", "20h tối", "8h tối", "8 giờ tối", "8h chiều", "7h pm"
      const suffixTimeMatch = raw.match(/(\d{1,2})(?::(\d{2})|\s*(?:h|giờ|gio)(?:\s*(\d{2}))?)\s*(tối|toi|chiều|chieu|sáng|sang|pm|am)/);
      if (suffixTimeMatch) {
        let h = parseInt(suffixTimeMatch[1], 10);
        const m = suffixTimeMatch[2] || suffixTimeMatch[3] ? parseInt(suffixTimeMatch[2] || suffixTimeMatch[3], 10) : 0;
        const period = suffixTimeMatch[4] || '';
        if ((period.includes('tối') || period.includes('toi') || period.includes('chiều') || period.includes('chieu') || period === 'pm') && h < 12) {
          h += 12;
        }
        timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
        hasTime = true;
      } else {
        // Tìm giờ định dạng 24h: 19h, 20h, 19:00, 20:00 (không nằm trong cụm "trong X giờ" hoặc "chơi X giờ")
        const genericTime = raw.match(/(?<!trong\s|chơi\s|choi\s)(\b(1[0-9]|2[0-2]|[6-9])\s*(?:h|:00)\b)/);
        if (genericTime) {
          const h = parseInt(genericTime[2], 10);
          timeStr = `${String(h).padStart(2, '0')}:00`;
          hasTime = true;
        }
      }
    }

    // 4. Nhận dạng thời lượng (duration: 2 tiếng, 2 giờ, 1.5h, 3 tiếng, trong 2 giờ)
    let duration = 2;
    let hasDuration = false;
    const durMatch = raw.match(/(\d+(?:\.\d+)?)\s*(?:tiếng|tieng|tiếng đồng hồ)(?!\w)/)
      || raw.match(/(?<!từ\s|tu\s|lúc\s|luc\s|vào\s|vao\s)(\d+(?:\.\d+)?)\s*(?:giờ|gio)(?!\s*(?:tối|toi|chiều|chieu|sáng|sang|am|pm|\d))(?!\w)/);

    if (durMatch) {
      duration = parseFloat(durMatch[1]);
      hasDuration = true;
    }

    // 5. Tính độ tin cậy
    let score = 0;
    if (hasPeople) score += 25;
    if (hasDate) score += 25;
    if (hasTime) score += 25;
    if (hasDuration) score += 25;

    // Nếu chứa từ khóa đặt bàn hoặc có ít nhất 1 thực thể
    const isBookingQuestion = /đặt|dat|book|chơi|choi|bàn|ban|giữ|giu/.test(raw);
    if (isBookingQuestion || score >= 25) {
      return {
        customerName: user.name,
        people,
        date: dateStr,
        time: timeStr,
        duration: duration || 2,
        confidence: score,
      };
    }

    return null;
  };

  const answer = (raw: string): { text: string; extracted?: ExtractedBooking; transferredToTeacher?: boolean } => {
    const text = raw.toLowerCase().trim();

    // 1. Thử phân tích ý định đặt bàn bằng NLP
    const bookingIntent = parseBookingIntent(raw);
    if (bookingIntent) {
      const CONFIDENCE_THRESHOLD = 70;
      if (bookingIntent.confidence < CONFIDENCE_THRESHOLD) {
        return {
          text: `⚠️ Độ tin cậy của thông tin bóc tách là **${bookingIntent.confidence}%** (dưới ngưỡng quy định 70%).\n\n` +
            `Yêu cầu của bạn chưa đủ dữ liệu hoặc cần hỗ trợ chuyên sâu hơn. Trợ lý AI đang **chuyển cuộc hội thoại đến Giáo viên / Nhân viên câu lạc bộ** để tiếp tục xử lý và hỗ trợ bạn trực tiếp!`,
          transferredToTeacher: true,
        };
      }

      return {
        text: `🤖 AI-3 đã bóc tách thông tin đặt bàn từ câu của bạn (Độ tin cậy: ${bookingIntent.confidence}%):\n` +
          `• Khách hàng: ${bookingIntent.customerName}\n` +
          `• Ngày chơi: ${bookingIntent.date}\n` +
          `• Giờ bắt đầu: ${bookingIntent.time}\n` +
          `• Thời lượng: ${bookingIntent.duration} giờ\n` +
          `• Số người: ${bookingIntent.people} người (Tối đa 4 người/bàn)\n\n` +
          `👉 *Lưu ý: Chatbot chỉ có vai trò tư vấn và hướng dẫn. Bạn có toàn quyền kiểm tra, chỉnh sửa thông tin và xác nhận đặt bàn trên Form Đặt Bàn.*`,
        extracted: bookingIntent,
      };
    }

    // 2. Các câu hỏi nghiệp vụ thường gặp
    if (/giá|gia|bao nhiêu|bao nhieu|chi phí|tiền/.test(text)) {
      return {
        text: `💰 Giá chơi lẻ: ${dashboard.config.courtPrice.toLocaleString('vi-VN')}đ/người/giờ (mặc định 2 giờ). Ví dụ 2 người chơi 2 giờ là ${(2 * 2 * dashboard.config.courtPrice).toLocaleString('vi-VN')}đ.\n` +
          `Giáo viên: 250.000đ/lượt (2 tiếng).\n` +
          `Gói tháng: 1 tháng (449.000đ), 3 tháng (1.149.000đ), 6 tháng (1.999.000đ).`,
      };
    }
    if (/giờ|mở cửa|mo cua|đóng cửa|dong cua/.test(text)) {
      return {
        text: `⏰ Câu lạc bộ mở cửa từ ${String(dashboard.config.openingHour).padStart(2, '0')}:00 đến ${String(dashboard.config.closingHour).padStart(2, '0')}:00 hằng ngày.\n` +
          `Bàn khu dạy học (dãy 1) mở cho khách sau ${dashboard.config.classCutoffHour}:00.`,
      };
    }
    if (/gói|tháng|hội viên|gia hạn|cộng dồn/.test(text)) {
      return {
        text: `🎟️ Gói tháng có 30 lượt/kỳ 30 ngày. Khi còn ≤5 lượt, hệ thống cảnh báo và nhân viên hỗ trợ gia hạn. Khi gia hạn, số lượt còn lại được CỘNG DỒN vào gói mới (không bị reset)!`,
      };
    }
    if (/bàn|trống|con ban|còn chỗ/.test(text)) {
      const available = dashboard.tables.filter((t) => t.status === 'available').length;
      return {
        text: `🏓 Hiện tại CLB có ${available}/16 bàn đang trống. Hãy nhập yêu cầu đặt bàn (ví dụ: 'tối mai 7h cho 4 người chơi 2 tiếng') để AI hỗ trợ đặt ngay nhé!`,
      };
    }
    if (/lớp|dạy|giáo viên|giao vien/.test(text)) {
      return {
        text: `🎓 Lớp học diễn ra 2 tiếng tại khu dạy học (bàn 1-4) và phải kết thúc trước ${dashboard.config.classCutoffHour}:00. Mỗi lớp phân bổ 2 bàn và cần Quản lý duyệt trước khi lên sân.`,
      };
    }

    return {
      text: 'Chào bạn! Mình là Trợ lý AI-3 của PingPongBros. Bạn có thể gõ câu tự nhiên như "tối mai 7h cho 4 người chơi 2 tiếng" hoặc hỏi về giá chơi, gói tháng, tình trạng sân và lớp học.',
    };
  };

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const id = Date.now();
    const response = answer(text);
    setMessages((current) => [
      ...current,
      { id, role: 'user', text },
      { id: id + 1, role: 'assistant', text: response.text, extracted: response.extracted, transferredToTeacher: response.transferredToTeacher },
    ]);
    setDraft('');
  };

  const handleOpenBookingForm = (extracted: ExtractedBooking) => {
    setOpen(false);
    onNavigate('san');
    window.dispatchEvent(new CustomEvent('ai3-fill-booking', { detail: extracted }));
    onNotify(`Đã mở Form Đặt Bàn với thông tin đề xuất: Ngày ${extracted.date} lúc ${extracted.time} (${extracted.duration} giờ, ${extracted.people} người). Vui lòng kiểm tra và xác nhận.`);
  };

  // Câu hỏi thường gặp hiển thị theo từng giao diện vai trò của người dùng
  const quickQuestions = user.role === 'TEACHER'
    ? ['Đăng ký lớp học thế nào?', 'Giá 1 lượt dạy là bao nhiêu?', 'Quy định giờ dạy học?', 'Tối mai 17h cho lớp 2 bàn']
    : user.role === 'MEMBER'
      ? ['Gói tháng còn bao nhiêu lượt?', 'Gia hạn gói có cộng dồn không?', 'Tối mai 19h cho 4 người chơi 2 tiếng', 'Còn bàn trống không?']
      : user.role === 'STAFF' || user.role === 'MANAGER'
        ? ['Quy tắc giữ bàn 15 phút?', 'Hết 30 lượt xử lý thế nào?', 'Giờ cao điểm dự báo lúc nào?', 'Tối mai 19h cho 4 người']
        : ['Giá chơi lẻ bao nhiêu?', 'Tối mai 7h cho 4 người chơi 2 tiếng', 'Gói tháng giá thế nào?', 'CLB mở cửa đến mấy giờ?'];

  const askQuestion = (question: string) => {
    const id = Date.now();
    const response = answer(question);
    setMessages((current) => [
      ...current,
      { id, role: 'user', text: question },
      { id: id + 1, role: 'assistant', text: response.text, extracted: response.extracted, transferredToTeacher: response.transferredToTeacher },
    ]);
  };

  return (
    <>
      {open && (
        <section className="bot" role="dialog" aria-label="Trợ lý đặt bàn AI">
          <div className="bot-h">
            <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>Trợ lý đặt bàn</span>
              <span className="tag" style={{ background: '#ffffff33', color: '#fff' }}>AI-3 NLP</span>
            </b>
            <button className="btn sm ghost" type="button" aria-label="Đóng trợ lý" onClick={() => setOpen(false)}>
              Đóng
            </button>
          </div>
          <div className="bot-st">
            <span>Xin chào, {user.name} ({user.role === 'MEMBER' ? 'Khách tháng' : user.role === 'TEACHER' ? 'Giáo viên' : user.role === 'MANAGER' ? 'Quản lý' : user.role === 'STAFF' ? 'Nhân viên' : 'Khách vãng lai'})</span>
          </div>
          <div className="bot-m" ref={thread} aria-live="polite">
            {!messages.length && (
              <div className="msg b">
                Xin chào! Tôi là Trợ lý AI-3. Bạn có thể nhập câu tự nhiên (ví dụ: <i>"tối mai 7h cho 4 người chơi 2 tiếng"</i>) hoặc chọn các câu hỏi bên dưới.
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={`msg ${message.role === 'assistant' ? 'b' : 'u'}`}>
                <div style={{ whiteSpace: 'pre-line' }}>{message.text}</div>
                {message.extracted && (
                  <div style={{ marginTop: 8, padding: '10px', background: '#eff6ff', borderRadius: 8, border: '1.5px solid #3b82f6' }}>
                    <button
                      className="btn sm"
                      type="button"
                      style={{ width: '100%', fontSize: 13, fontWeight: 'bold', background: '#1d4ed8', color: '#fff', padding: '8px 12px' }}
                      onClick={() => handleOpenBookingForm(message.extracted!)}
                    >
                      📝 Mở Form Đặt Bàn Để Kiểm Tra & Xác Nhận
                    </button>
                  </div>
                )}
                {message.transferredToTeacher && (
                  <div style={{ marginTop: 8, padding: '8px 12px', background: '#fef3c7', borderRadius: 6, border: '1px solid #f59e0b', fontSize: 12, color: '#92400e', lineHeight: 1.4 }}>
                    <b>👨‍🏫 Đã chuyển cuộc hội thoại:</b> Yêu cầu của bạn đã được chuyển đến Giáo viên trực sân. Giáo viên hoặc Nhân viên sẽ liên hệ lại với bạn sớm nhất!
                  </div>
                )}
                {message.action && (
                  <div className="btns">
                    <button className="btn sm red" type="button" onClick={() => onNavigate(message.action!.page)}>
                      {message.action.label}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="faq" aria-label="Câu hỏi thường gặp theo vai trò">
            {quickQuestions.map((question) => (
              <button key={question} type="button" onClick={() => askQuestion(question)}>
                {question}
              </button>
            ))}
          </div>

          <form className="bot-f" onSubmit={send}>
            <input
              className="in"
              placeholder="Nhập yêu cầu: tối mai 7h cho 4 người..."
              autoComplete="off"
              aria-label="Tin nhắn"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button className="btn" type="submit">
              Gửi
            </button>
          </form>
        </section>
      )}

      <button
        className="bot-fab"
        type="button"
        aria-label={open ? 'Đóng trợ lý đặt bàn AI' : 'Mở trợ lý đặt bàn AI'}
        title="Trợ lý đặt bàn AI (AI-3)"
        onClick={() => setOpen((value) => !value)}
      >
        <Paddle size={34} />
      </button>

      {botSuccessModal && (
        <BookingSuccessModal info={botSuccessModal} onClose={() => setBotSuccessModal(null)} />
      )}
    </>
  );
}

function Paddle({ size }: { size: number }) {
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
