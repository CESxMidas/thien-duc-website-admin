// Trạng thái xuất bản **suy ra** của một bài viết + thao tác đặt lịch khả dụng.
//
// ── Ranh giới quan trọng ────────────────────────────────────────────────────
// Backend là NƠI DUY NHẤT quyết định bài có công khai hay không (vị từ hiển thị
// của Batch 2 + reconciler). Mọi thứ ở file này chỉ để **hiển thị trong CMS**:
// chọn nhãn huy hiệu và ẩn bớt nút chắc chắn sẽ bị từ chối. Vì thế dùng đồng hồ
// MÁY CLIENT ở đây là chấp nhận được — máy lệch giờ thì cùng lắm biên tập viên
// thấy nhãn "Đã lên lịch" trong khi bài vừa tới hạn, và ngược lại; không có
// quyết định hiển thị công khai nào phụ thuộc vào con số này.
//
// Tuyệt đối KHÔNG mang logic này sang website công khai để quyết định render.
// Backend luôn được gọi lại và vẫn từ chối các thao tác không hợp lệ, kể cả khi
// UI lỡ hiện nút.
//
// ── Vì sao không có enum `SCHEDULED` ────────────────────────────────────────
// Schema chỉ có `DRAFT | PENDING | PUBLISHED`. Bài đã hẹn giờ được lưu là
// PENDING (fail safe: mọi truy vấn cũ lọc `status = PUBLISHED` đều tự giấu nó
// đi). "Đã lên lịch" là một trạng thái SUY RA từ ba cột `status`, `scheduledAt`,
// `publishedAt` — không được persist ở đâu cả.

import { composeVietnamInstant } from "@/lib/vietnam-time";
import type { ContentStatus, Role } from "@/types";

/** Trạng thái xuất bản hiển thị trong CMS (suy ra, không lưu xuống DB). */
export type PublicationState =
  | "DRAFT"
  | "PENDING"
  | "SCHEDULED"
  | "DUE"
  | "PUBLISHED";

/** Phần dữ liệu cần để xét lịch — nhận cả `NewsPost` lẫn object rút gọn. */
export interface SchedulableContent {
  status: ContentStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
}

/** Lịch phải cách hiện tại ít nhất chừng này (khớp backend). */
export const MIN_SCHEDULE_LEAD_MS = 60_000;

/** Trần 2 năm — chủ yếu bắt lỗi gõ nhầm năm (khớp backend). */
export const MAX_SCHEDULE_HORIZON_MS = 2 * 365 * 24 * 60 * 60 * 1000;

/** Dưới ngưỡng này thì cảnh báo mềm "rất gần" — KHÔNG chặn gửi. */
export const NEAR_SCHEDULE_WARNING_MS = 15 * 60 * 1000;

/**
 * Vai trò được đặt / đổi / huỷ lịch (khớp `@Roles(ADMIN, SUPER_ADMIN)`).
 *
 * Dùng chung cho cả hàng trong bảng lẫn nút "Đặt lịch" ở form viết bài mới:
 * bài mới của MỌI vai trò nay đều sinh ra ở `DRAFT` sạch (chưa từng công khai),
 * nên điều kiện hẹn giờ của backend chỉ còn lại đúng vai trò.
 */
export function canScheduleRole(role?: Role | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Epoch ms của một chuỗi ISO, `null` nếu thiếu hoặc không phân giải được. */
function instant(iso: string | null): number | null {
  if (iso === null) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * `publishedAt` có ĐÚNG BẰNG `scheduledAt` không — dấu hiệu cho biết mốc công
 * khai kia do chính lệnh đặt lịch ghi ra (một *dự định*), chứ không phải một
 * lần xuất bản đã xảy ra thật.
 *
 * Tổ hợp dị dạng (thiếu một trong hai, hoặc hai mốc khác nhau) trả `false` —
 * fail closed: bài đó sẽ không được coi là "đang có lịch", nên không hiện nút
 * đổi/huỷ lịch mà backend chắc chắn từ chối.
 */
function scheduleMarkersAgree(post: SchedulableContent): boolean {
  const scheduled = instant(post.scheduledAt);
  const published = instant(post.publishedAt);
  return scheduled !== null && published !== null && scheduled === published;
}

/**
 * Bài đang giữ một **lịch tương lai hợp lệ** (đổi được, huỷ được).
 *
 * Cả bốn điều kiện đều cần: PENDING, có `scheduledAt`, mốc đó ở tương lai, và
 * `publishedAt` trùng khít. Bỏ phép so bằng thì một bài từng đăng năm 2020 rồi
 * bị gán lịch sẽ bị coi là lịch hợp lệ — và thao tác huỷ sẽ xoá mất mốc 2020.
 */
export function isActiveFutureSchedule(
  post: SchedulableContent,
  now: Date,
): boolean {
  const scheduled = instant(post.scheduledAt);
  return (
    post.status === "PENDING" &&
    scheduled !== null &&
    scheduleMarkersAgree(post) &&
    scheduled > now.getTime()
  );
}

/**
 * Lịch **đã tới hạn** nhưng reconciler chưa chạy. Theo vị từ hiển thị của
 * Batch 2, bài này ĐÃ hiện công khai rồi dù `status` còn là PENDING.
 */
export function isDueSchedule(post: SchedulableContent, now: Date): boolean {
  const scheduled = instant(post.scheduledAt);
  return (
    post.status === "PENDING" &&
    scheduled !== null &&
    scheduleMarkersAgree(post) &&
    scheduled <= now.getTime()
  );
}

/**
 * Bài đã có **lịch sử xuất bản thật** chưa? Có `publishedAt`, và mốc đó không
 * phải dự định của một lịch tương lai đang chờ.
 *
 * Đây là vế phân biệt của v1: chỉ nội dung CHƯA TỪNG công khai mới hẹn giờ
 * được, nên "có publishedAt" một mình không đủ để kết luận điều gì.
 */
export function hasHistoricalPublication(
  post: SchedulableContent,
  now: Date,
): boolean {
  return post.publishedAt !== null && !isActiveFutureSchedule(post, now);
}

/**
 * Trạng thái hiển thị của một bài. Thứ tự nhánh chính là thứ tự ưu tiên:
 * `PUBLISHED` và `DRAFT` đọc thẳng từ `status`, chỉ PENDING mới phải phân giải
 * tiếp thành CHỜ DUYỆT / ĐÃ LÊN LỊCH / ĐÃ ĐẾN GIỜ.
 *
 * PENDING mang tổ hợp lịch dị dạng rơi về `PENDING` — fail closed.
 */
export function derivePublicationState(
  post: SchedulableContent,
  now: Date,
): PublicationState {
  if (post.status === "PUBLISHED") return "PUBLISHED";
  if (post.status === "DRAFT") return "DRAFT";
  if (isActiveFutureSchedule(post, now)) return "SCHEDULED";
  if (isDueSchedule(post, now)) return "DUE";
  return "PENDING";
}

/**
 * Bài này có đặt / đổi lịch được không (theo luật v1 — CHỈ lần công khai đầu).
 *
 * - Đang PUBLISHED: không. Một slug là một URL đang phục vụ công khai.
 * - Đang giữ lịch tương lai hợp lệ: có — đây là luồng **đổi lịch**.
 * - Từng công khai thật (kể cả đã gỡ về nháp, kể cả lịch đã tới hạn): không.
 *   Đặt lịch mới sẽ ghi đè `publishedAt`, tức âm thầm định nghĩa lại field đó
 *   thành "lần đăng gần nhất". Backend từ chối 409.
 */
export function canScheduleNews(
  role: Role | undefined | null,
  post: SchedulableContent,
  now: Date,
): boolean {
  if (!canScheduleRole(role)) return false;
  if (post.status === "PUBLISHED") return false;
  if (isActiveFutureSchedule(post, now)) return true;
  return !hasHistoricalPublication(post, now);
}

/** Ba nút đặt lịch có thể xuất hiện trên một hàng của bảng tin tức. */
export interface NewsScheduleActions {
  /** "Lên lịch" — bài chưa từng công khai và chưa có lịch. */
  schedule: boolean;
  /** "Đổi lịch" — đang có lịch tương lai hợp lệ. */
  reschedule: boolean;
  /**
   * "Huỷ lịch" — chỉ khi lịch CHƯA tới hạn. Lịch đã qua giờ nghĩa là bài đang
   * công khai; backend từ chối 409 và việc cần làm là "Trả về nháp".
   */
  cancel: boolean;
}

/**
 * Ma trận thao tác đặt lịch cho một vai trò tại một trạng thái. Chỉ quyết định
 * UI hiện nút nào — luôn khớp với thứ backend cho phép, để không bao giờ hiện
 * một nút chắc chắn nổ 403/409.
 */
export function newsScheduleActions(
  role: Role | undefined | null,
  post: SchedulableContent,
  now: Date,
): NewsScheduleActions {
  const active = canScheduleRole(role) && isActiveFutureSchedule(post, now);
  return {
    schedule: canScheduleNews(role, post, now) && !active,
    reschedule: active,
    cancel: active,
  };
}

/** Ô nhập gây ra lỗi — để gắn `aria-invalid` đúng chỗ. */
export type ScheduleField = "date" | "time";

export type ScheduleValidation =
  | { ok: true; scheduledAt: string; leadMs: number }
  | { ok: false; field: ScheduleField; message: string };

/**
 * Kiểm hai ô nhập TRƯỚC khi gọi API — chỉ để bắt lỗi hiển nhiên và trả lời
 * ngay, không thay backend làm trọng tài.
 *
 * Cố ý **không** chép lại regex ISO của backend: ở đây đầu vào là hai ô nhập
 * native đã tự ràng buộc hình dạng, nên chỉ cần kiểm ngày có thật, giờ hợp lệ,
 * rồi so hai ngưỡng nghiệp vụ (tối thiểu 1 phút, tối đa 2 năm) trên cùng một
 * `now` với lúc dựng chuỗi. Backend kiểm lại tất cả bằng `now` của chính nó và
 * vẫn là bên chốt cuối.
 */
export function validateScheduleFields(
  date: string,
  time: string,
  now: Date,
): ScheduleValidation {
  if (date.trim() === "") {
    return { ok: false, field: "date", message: "Hãy chọn ngày đăng." };
  }
  if (time.trim() === "") {
    return { ok: false, field: "time", message: "Hãy chọn giờ đăng." };
  }

  const scheduledAt = composeVietnamInstant(date, time);
  if (scheduledAt === null) {
    // `composeVietnamInstant` gộp hai lý do; ngày sai là trường hợp áp đảo
    // (gõ 31/02 hoặc năm bốn chữ số bất thường), nên trỏ vào ô ngày.
    return {
      ok: false,
      field: "date",
      message: "Ngày hoặc giờ không hợp lệ. Hãy kiểm tra lại.",
    };
  }

  const leadMs = Date.parse(scheduledAt) - now.getTime();
  if (leadMs < MIN_SCHEDULE_LEAD_MS) {
    return {
      ok: false,
      field: "time",
      message:
        'Thời điểm đăng phải ở tương lai, cách hiện tại ít nhất 1 phút. Dùng "Đăng ngay" nếu muốn đăng lúc này.',
    };
  }
  if (leadMs > MAX_SCHEDULE_HORIZON_MS) {
    return {
      ok: false,
      field: "date",
      message: "Thời điểm đăng quá xa (tối đa 2 năm). Hãy kiểm tra lại năm.",
    };
  }

  return { ok: true, scheduledAt, leadMs };
}

/**
 * Xếp các bài theo lịch gần nhất trước. Dùng cho bộ lọc "Đã lên lịch", nơi câu
 * hỏi của người dùng luôn là "bài nào sắp lên?" chứ không phải "bài nào vừa sửa?".
 * Bài thiếu `scheduledAt` (không nên có trong nhóm này) xuống cuối thay vì làm
 * phép so sánh trả `NaN`.
 */
export function bySoonestSchedule(
  a: SchedulableContent,
  b: SchedulableContent,
): number {
  const left = instant(a.scheduledAt) ?? Number.POSITIVE_INFINITY;
  const right = instant(b.scheduledAt) ?? Number.POSITIVE_INFINITY;
  return left - right;
}
