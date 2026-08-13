// Ghép / tách mốc thời gian theo **giờ Việt Nam** cho ô nhập ngày + giờ.
//
// Vì sao có module riêng thay vì dùng `new Date(...)` tại chỗ: mọi phép quy đổi
// mặc định của JS đều đi qua múi giờ của MÁY đang mở trình duyệt. Biên tập viên
// ngồi ở Việt Nam, nhưng máy có thể đặt sai múi giờ, hoặc CMS được mở từ máy ở
// nước ngoài — khi đó `new Date("2026-08-20T08:00").toISOString()` cho ra một
// instant khác hẳn ý người nhập, và KHÔNG có thông báo lỗi nào. Với một field
// quyết định *khi nào bài lên website*, sai lệch im lặng là không chấp nhận được.
//
// Hợp đồng: mọi hàm ở đây **thuần** và **không đọc múi giờ máy**. Chúng chỉ làm
// số học trên epoch với một offset cố định, nên chạy ở Hà Nội hay ở Berlin đều
// cho cùng một kết quả.
//
// Vì sao offset cố định `+07:00` mà không dùng `Intl` với `Asia/Ho_Chi_Minh`:
// Việt Nam không áp dụng giờ mùa hè từ 1975, nên vùng này là UTC+7 quanh năm.
// Một hằng số kiểm chứng được bằng số học thì round-trip (ISO → ô nhập → ISO)
// đúng tuyệt đối, còn `Intl` phụ thuộc bảng tz của từng runtime.

/** Offset tường minh gắn vào chuỗi gửi backend (`IsIsoInstant` bắt buộc có). */
export const VIETNAM_UTC_OFFSET = "+07:00";

/** Nhãn múi giờ hiện cạnh ô nhập — luôn hiện, không giấu trong tooltip. */
export const VIETNAM_TIMEZONE_LABEL = "GMT+7 — Việt Nam";

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

/** `<input type="date">` luôn trả `YYYY-MM-DD`. */
const DATE_INPUT = /^\d{4}-\d{2}-\d{2}$/;

/** `<input type="time">` trả `HH:mm`, một số trình duyệt kèm `:ss`. */
const TIME_INPUT = /^(\d{2}):(\d{2})(?::\d{2})?$/;

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

/**
 * Ngày có thật trên lịch không? V8 âm thầm cuộn `2026-02-31` thành `2026-03-03`
 * thay vì trả `NaN`, nên chỉ kiểm regex là chưa đủ: gõ nhầm ngày sẽ khiến bài
 * lên muộn ba ngày mà không ai báo lỗi. Dựng bằng `Date.UTC` rồi đọc lại — lệch
 * nghĩa là ngày đó đã bị cuộn.
 */
export function isRealCalendarDate(date: string): boolean {
  if (!DATE_INPUT.test(date)) return false;
  const [year, month, day] = date.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/** Giờ hợp lệ (00:00–23:59) không? Nhận cả `HH:mm` lẫn `HH:mm:ss`. */
export function isValidClockTime(time: string): boolean {
  const match = TIME_INPUT.exec(time);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

/**
 * `2026-08-20` + `08:00` → `2026-08-20T08:00:00+07:00`.
 *
 * Trả `null` nếu một trong hai phần sai định dạng hoặc không có thật. Giây luôn
 * là `00`: ô nhập chỉ tới phút, và ghi thừa giây từ chuỗi trình duyệt trả về sẽ
 * làm lệch phép so sánh round-trip.
 */
export function composeVietnamInstant(
  date: string,
  time: string,
): string | null {
  if (!isRealCalendarDate(date)) return null;
  const match = TIME_INPUT.exec(time);
  if (!match || !isValidClockTime(time)) return null;
  return `${date}T${match[1]}:${match[2]}:00${VIETNAM_UTC_OFFSET}`;
}

/** Hai ô nhập của hộp thoại đặt lịch. */
export interface VietnamDateTimeFields {
  /** `YYYY-MM-DD` — hợp lệ cho `<input type="date">`. */
  date: string;
  /** `HH:mm` — hợp lệ cho `<input type="time">`. */
  time: string;
}

/**
 * Instant bất kỳ (backend luôn trả UTC dạng `...Z`) → hai ô nhập theo giờ VN.
 *
 * `2026-08-20T01:00:00.000Z` → `{ date: "2026-08-20", time: "08:00" }`.
 *
 * Cộng offset vào epoch rồi đọc các thành phần **UTC** — cách duy nhất lấy được
 * "giờ tại Việt Nam" mà không chạm tới múi giờ máy.
 */
export function toVietnamFields(iso: string): VietnamDateTimeFields | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const shifted = new Date(ms + VIETNAM_OFFSET_MS);
  return {
    date: `${pad(shifted.getUTCFullYear(), 4)}-${pad(
      shifted.getUTCMonth() + 1,
    )}-${pad(shifted.getUTCDate())}`,
    time: `${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}`,
  };
}

/** Instant → `20/08/2026 · 08:00` (dòng phụ dưới huy hiệu trạng thái). */
export function formatVietnamDateTime(iso: string): string | null {
  const fields = toVietnamFields(iso);
  if (!fields) return null;
  const [year, month, day] = fields.date.split("-");
  return `${day}/${month}/${year} · ${fields.time}`;
}

/** Instant → `08:00, 20/08/2026` (chèn vào câu tóm tắt trong hộp thoại). */
export function formatVietnamSentence(iso: string): string | null {
  const fields = toVietnamFields(iso);
  if (!fields) return null;
  const [year, month, day] = fields.date.split("-");
  return `${fields.time}, ${day}/${month}/${year}`;
}
