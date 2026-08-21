// Cửa sổ hiển thị banner — trạng thái SUY RA + kiểm ô nhập, cho Admin CMS.
//
// ── Ranh giới quan trọng ────────────────────────────────────────────────────
// Backend là NƠI DUY NHẤT quyết định banner có ra trang chủ hay không: vị từ
// `isActive AND [displayFrom, displayUntil)` được xét ngay lúc truy vấn. Mọi
// thứ ở file này chỉ để **hiển thị trong CMS** và bắt lỗi hiển nhiên trước khi
// gọi API. Vì thế dùng đồng hồ MÁY CLIENT ở đây là chấp nhận được — máy lệch
// giờ thì cùng lắm biên tập viên thấy nhãn "Sắp hiển thị" trong khi banner vừa
// tới giờ; không có quyết định hiển thị công khai nào phụ thuộc con số này.
//
// ── Vì sao KHÔNG dùng lại `news-schedule.ts` ────────────────────────────────
// Chúng giải hai bài toán khác nhau. Ở đó là LỊCH XUẤT BẢN: đúng một mốc, gắn
// với vòng đời DRAFT/PENDING/PUBLISHED, ngưỡng tối thiểu 1 phút và trần 2 năm.
// Ở đây là CẤU HÌNH THỜI GIAN HIỂN THỊ: hai biên độc lập, đều tùy chọn, không
// vòng đời, không ngưỡng nào cả. Ép chung một trừu tượng sẽ kéo theo đúng những
// luật không nên có.
//
// ── Vì sao KHÔNG có enum trong DB ───────────────────────────────────────────
// Bốn trạng thái dưới đây được TÍNH RA từ hai cột `display_from`/`display_until`
// cộng đồng hồ. Lưu chúng xuống sẽ tạo ra thứ phải đồng bộ lại mỗi khi thời gian
// trôi — đúng thứ kiến trúc query-time sinh ra để tránh.

import {
  composeVietnamInstant,
  formatVietnamDateTime,
  toVietnamFields,
} from "@/lib/vietnam-time";

/** Hai mốc cấu hình cửa sổ hiển thị của một banner. */
export interface DisplayWindow {
  displayFrom: string | null;
  displayUntil: string | null;
}

/**
 * Trạng thái cửa sổ hiển thị, hiện thành huy hiệu trong bảng.
 *
 * Cố ý KHÔNG đặt tên PUBLISHED/SCHEDULED: banner không có vòng đời xuất bản, và
 * mượn từ vựng đó sẽ khiến người dùng tưởng có một luồng duyệt ở đây.
 *
 * `ALWAYS` tách khỏi `ACTIVE` vì hai câu trả lời khác nhau cho câu hỏi "khi nào
 * banner này ngừng hiện?": ALWAYS là "không bao giờ, trừ khi tắt tay", còn
 * ACTIVE là "tới mốc đã đặt". Gộp lại sẽ giấu mất thông tin có giá trị nhất.
 */
export type BannerDisplayState = "ALWAYS" | "UPCOMING" | "ACTIVE" | "EXPIRED";

/** Epoch ms của một chuỗi ISO, `null` nếu thiếu hoặc không phân giải được. */
function instant(iso: string | null): number | null {
  if (iso === null) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Trạng thái cửa sổ tại một thời điểm. `now` luôn do lời gọi truyền vào — test
 * đóng băng được đồng hồ, không có `sleep` nào và không có nhấp nháy nào.
 *
 * Thứ tự nhánh chính là thứ tự ưu tiên và khớp khít vị từ của backend:
 *  - chưa tới biên dưới  → UPCOMING (dù biên trên là gì)
 *  - đã qua biên trên    → EXPIRED
 *  - không biên nào      → ALWAYS
 *  - còn lại             → ACTIVE
 *
 * Cửa sổ dị dạng (`from > until`, chỉ vào được nếu sửa tay dưới DB) rơi vào
 * UPCOMING rồi EXPIRED — cả hai đều là "không hiện", khớp đúng hành vi thật của
 * backend: một cửa sổ như vậy không bao giờ đủ điều kiện.
 */
export function deriveDisplayState(
  window: DisplayWindow,
  now: Date,
): BannerDisplayState {
  const from = instant(window.displayFrom);
  const until = instant(window.displayUntil);
  const ms = now.getTime();

  if (from !== null && ms < from) return "UPCOMING";
  if (until !== null && ms >= until) return "EXPIRED";
  if (from === null && until === null) return "ALWAYS";
  return "ACTIVE";
}

/** Nhãn tiếng Việt của huy hiệu — từ vựng HIỂN THỊ, không phải xuất bản. */
export const DISPLAY_STATE_LABEL: Record<BannerDisplayState, string> = {
  ALWAYS: "Luôn hiển thị",
  UPCOMING: "Sắp hiển thị",
  ACTIVE: "Trong thời gian hiển thị",
  EXPIRED: "Đã hết thời gian",
};

/** Sắc thái huy hiệu. Khớp `BadgeTone` đang dùng khắp app. */
export const DISPLAY_STATE_TONE: Record<
  BannerDisplayState,
  "gray" | "blue" | "green" | "amber"
> = {
  // Xám = "không có gì đặc biệt", đúng với đại đa số banner.
  ALWAYS: "gray",
  UPCOMING: "blue",
  ACTIVE: "green",
  // Hổ phách chứ không phải đỏ: hết hạn là kết cục ĐÚNG Ý người cấu hình, không
  // phải lỗi. Đỏ ở đây sẽ khiến biên tập viên đi "sửa" thứ đang chạy đúng.
  EXPIRED: "amber",
};

/** Nhãn khi một biên bỏ trống — nói rõ hệ quả, không chỉ nói "trống". */
export const NO_START_LABEL = "Ngay lập tức";
export const NO_END_LABEL = "Không giới hạn";

/** `dd/MM/yyyy · HH:mm` giờ VN, hoặc nhãn mặc định khi biên bỏ trống. */
export function formatBound(iso: string | null, emptyLabel: string): string {
  if (iso === null) return emptyLabel;
  return formatVietnamDateTime(iso) ?? emptyLabel;
}

/* -------------------------------------------------------------------------
   Ô NHẬP — bốn ô native (ngày + giờ) × (từ, đến)
   ------------------------------------------------------------------------- */

/**
 * Bốn ô nhập của phần "Thời gian hiển thị".
 *
 * Dùng `date` + `time` tách rời thay cho `datetime-local` vì đúng lý do đã ghi ở
 * `SchedulePublishDialog`: giá trị của `datetime-local` là chuỗi trần không mang
 * múi giờ, và mọi phép quy đổi tại chỗ đều đi qua múi giờ MÁY. Tự ghép bằng
 * `composeVietnamInstant` thì chuỗi gửi đi luôn là `...+07:00` — đúng thứ biên
 * tập viên nhìn thấy, bất kể máy đặt múi giờ nào.
 */
export interface DisplayWindowFields {
  fromDate: string;
  fromTime: string;
  untilDate: string;
  untilTime: string;
}

export const EMPTY_DISPLAY_WINDOW_FIELDS: DisplayWindowFields = {
  fromDate: "",
  fromTime: "",
  untilDate: "",
  untilTime: "",
};

/** Ô nhập nào gây lỗi — để gắn `aria-invalid` đúng chỗ. */
export type DisplayWindowField = keyof DisplayWindowFields;

export type DisplayWindowValidation =
  | { ok: true; window: DisplayWindow }
  | { ok: false; field: DisplayWindowField; message: string };

/**
 * Một biên: hai ô rỗng ⇒ `null` (không đặt biên). Một ô có, một ô trống ⇒ lỗi —
 * KHÔNG tự điền `00:00`, vì "quên chọn giờ" và "cố ý chọn nửa đêm" là hai ý định
 * khác nhau và đoán sai sẽ làm banner hiện sớm/muộn cả nửa ngày.
 */
function readBound(
  date: string,
  time: string,
  dateField: DisplayWindowField,
  timeField: DisplayWindowField,
  noun: string,
): { ok: true; iso: string | null } | { ok: false; field: DisplayWindowField; message: string } {
  const hasDate = date.trim() !== "";
  const hasTime = time.trim() !== "";

  if (!hasDate && !hasTime) return { ok: true, iso: null };
  if (!hasDate) {
    return { ok: false, field: dateField, message: `Hãy chọn ngày ${noun}.` };
  }
  if (!hasTime) {
    return { ok: false, field: timeField, message: `Hãy chọn giờ ${noun}.` };
  }

  const iso = composeVietnamInstant(date, time);
  if (iso === null) {
    return {
      ok: false,
      field: dateField,
      message: `Ngày hoặc giờ ${noun} không hợp lệ. Hãy kiểm tra lại.`,
    };
  }
  return { ok: true, iso };
}

/**
 * Kiểm bốn ô nhập TRƯỚC khi gọi API — chỉ để trả lời ngay những lỗi hiển nhiên,
 * không thay backend làm trọng tài. Backend kiểm lại toàn bộ (kể cả trạng thái
 * sau khi trộn với giá trị đang lưu) và vẫn là bên chốt cuối.
 *
 * Luật duy nhất ở đây trùng với backend: có đủ hai biên thì `từ < đến`.
 * KHÔNG có ngưỡng "cách hiện tại tối thiểu 1 phút", KHÔNG có trần 2 năm, và
 * KHÔNG cấm mốc quá khứ — cả ba đều là luật của lịch xuất bản, không phải của
 * cửa sổ hiển thị.
 */
export function validateDisplayWindowFields(
  fields: DisplayWindowFields,
): DisplayWindowValidation {
  const from = readBound(
    fields.fromDate,
    fields.fromTime,
    "fromDate",
    "fromTime",
    "bắt đầu hiển thị",
  );
  if (!from.ok) return from;

  const until = readBound(
    fields.untilDate,
    fields.untilTime,
    "untilDate",
    "untilTime",
    "kết thúc hiển thị",
  );
  if (!until.ok) return until;

  if (from.iso !== null && until.iso !== null) {
    if (Date.parse(from.iso) >= Date.parse(until.iso)) {
      return {
        ok: false,
        field: "untilDate",
        message: "“Hiển thị đến” phải sau “Hiển thị từ”.",
      };
    }
  }

  return {
    ok: true,
    window: { displayFrom: from.iso, displayUntil: until.iso },
  };
}

/**
 * Cửa sổ đang lưu (ISO, backend trả UTC) → bốn ô nhập theo GIỜ VIỆT NAM.
 *
 * Round-trip phải khít: nạp lên rồi lưu lại mà không sửa gì thì instant gửi đi
 * phải bằng đúng instant đang lưu.
 */
export function toDisplayWindowFields(
  window: DisplayWindow,
): DisplayWindowFields {
  const empty = { date: "", time: "" };
  const from = (window.displayFrom && toVietnamFields(window.displayFrom)) || empty;
  const until =
    (window.displayUntil && toVietnamFields(window.displayUntil)) || empty;

  return {
    fromDate: from.date,
    fromTime: from.time,
    untilDate: until.date,
    untilTime: until.time,
  };
}
