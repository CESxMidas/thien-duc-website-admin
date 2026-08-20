// Trạng thái xuất bản **suy ra** của một TRANG NỘI DUNG + thao tác đặt lịch
// khả dụng.
//
// ── Vì sao file này mỏng ────────────────────────────────────────────────────
// Luật suy trạng thái lịch không phụ thuộc loại nội dung: nó chỉ đọc ba giá trị
// (trạng thái duyệt, `scheduledAt`, `publishedAt`) và đã được viết + khoá test
// kỹ ở `lib/news-schedule.ts`, rồi dùng lại ở `project-schedule.ts` và
// `cooperation-schedule.ts`. Chép lại lần thứ tư là chép luôn những chỗ tinh tế
// nhất — phép so `publishedAt === scheduledAt` để phân biệt *dự định* với *lịch
// sử thật*, và các nhánh fail-closed cho tổ hợp dị dạng.
//
// Trang nội dung gọi cột bậc thang duyệt là `status`, **đúng bằng** tên mà
// `SchedulableContent` dùng — nên ở đây không cần hàm chuyển tên như Dự án hay
// Dự án hợp tác. `StaticPage` khớp cấu trúc sẵn.
//
// ── Ranh giới ──────────────────────────────────────────────────────────────
// Backend là NƠI CHỐT. Mọi thứ ở đây chỉ để hiển thị trong CMS: chọn nhãn huy
// hiệu và ẩn bớt nút chắc chắn bị từ chối. Dùng đồng hồ máy client là chấp nhận
// được vì không quyết định hiển thị công khai nào phụ thuộc vào nó.

import {
  canScheduleRole,
  derivePublicationState,
  hasHistoricalPublication,
  isActiveFutureSchedule,
  isDueSchedule,
  type NewsScheduleActions,
  type PublicationState,
  type SchedulableContent,
} from "@/lib/news-schedule";
import type { Role } from "@/types";

/**
 * Phần dữ liệu cần để xét lịch của một trang.
 *
 * Trùng đúng hình dạng `SchedulableContent`, khai lại ở đây để chỗ gọi đọc lên
 * rõ là "trang", và để nếu sau này `Page` đổi tên cột thì chỉ một alias phải sửa.
 */
export type SchedulablePage = SchedulableContent;

/** Trạng thái hiển thị: DRAFT/PENDING/SCHEDULED/DUE/PUBLISHED. */
export function derivePagePublicationState(
  page: SchedulablePage,
  now: Date,
): PublicationState {
  return derivePublicationState(page, now);
}

/** Đang giữ một lịch tương lai hợp lệ (đổi được, huỷ được). */
export function isActiveFuturePageSchedule(
  page: SchedulablePage,
  now: Date,
): boolean {
  return isActiveFutureSchedule(page, now);
}

/** Lịch ĐÃ tới hạn nhưng reconciler chưa chạy — trang đã hiển thị công khai. */
export function isDuePageSchedule(page: SchedulablePage, now: Date): boolean {
  return isDueSchedule(page, now);
}

/** Trang đã có lịch sử xuất bản thật chưa? */
export function pageHasHistoricalPublication(
  page: SchedulablePage,
  now: Date,
): boolean {
  return hasHistoricalPublication(page, now);
}

/**
 * Trang này có đặt / đổi lịch được không (luật v1 — CHỈ lần công khai đầu).
 *
 * - Đang PUBLISHED: không. Một slug là một URL đang phục vụ công khai.
 * - Đang giữ lịch tương lai hợp lệ: có — đây là luồng **đổi lịch**.
 * - Từng công khai thật (kể cả đã gỡ về nháp, kể cả lịch đã tới hạn): không.
 *   Backend từ chối 409.
 */
export function canSchedulePage(
  role: Role | undefined | null,
  page: SchedulablePage,
  now: Date,
): boolean {
  if (!canScheduleRole(role)) return false;
  if (page.status === "PUBLISHED") return false;
  if (isActiveFuturePageSchedule(page, now)) return true;
  return !pageHasHistoricalPublication(page, now);
}

/**
 * Ma trận thao tác đặt lịch cho một vai trò tại một trạng thái. Chỉ quyết định
 * UI hiện nút nào — luôn khớp với thứ backend cho phép, để không bao giờ hiện
 * một nút chắc chắn nổ 403/409.
 */
export function pageScheduleActions(
  role: Role | undefined | null,
  page: SchedulablePage,
  now: Date,
): NewsScheduleActions {
  const active = canScheduleRole(role) && isActiveFuturePageSchedule(page, now);
  return {
    schedule: canSchedulePage(role, page, now) && !active,
    reschedule: active,
    cancel: active,
  };
}
