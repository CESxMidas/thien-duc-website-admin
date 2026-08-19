// Trạng thái xuất bản **suy ra** của một DỰ ÁN + thao tác đặt lịch khả dụng.
//
// ── Vì sao file này mỏng ────────────────────────────────────────────────────
// Luật suy trạng thái lịch không phụ thuộc loại nội dung: nó chỉ đọc ba giá trị
// (trạng thái duyệt, `scheduledAt`, `publishedAt`) và đã được viết + khoá test
// kỹ ở `lib/news-schedule.ts`. Chép lại cho dự án là chép luôn những chỗ tinh
// tế nhất — phép so bằng `publishedAt === scheduledAt` để phân biệt *dự định*
// với *lịch sử thật*, và các nhánh fail-closed cho tổ hợp dị dạng. Hai bản sao
// sẽ lệch nhau ngay lần sửa thứ hai.
//
// Nên ở đây chỉ làm đúng một việc: **đổi tên trường** cho khớp rồi gọi lại luật
// đã có. Dự án gọi cột trạng thái duyệt là `contentStatus` (vì `status` của nó
// đã được dùng cho TÌNH TRẠNG THI CÔNG), tin tức gọi là `status`.
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
import type { ContentStatus, Role } from "@/types";

/** Phần dữ liệu cần để xét lịch của một dự án. */
export interface SchedulableProject {
  contentStatus: ContentStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
}

/**
 * Đưa dự án về hình dạng chung mà luật lịch nhận vào.
 *
 * Chỉ đổi tên `contentStatus` → `status`. Cố ý KHÔNG nhận cả object dự án rồi
 * đọc bừa `status`: làm thế thì một lần gọi nhầm sẽ đem TÌNH TRẠNG THI CÔNG vào
 * vị từ xuất bản, và TypeScript sẽ không kêu vì cả hai đều là chuỗi enum.
 */
function toSchedulable(project: SchedulableProject): SchedulableContent {
  return {
    status: project.contentStatus,
    scheduledAt: project.scheduledAt,
    publishedAt: project.publishedAt,
  };
}

/** Trạng thái hiển thị của một dự án: DRAFT/PENDING/SCHEDULED/DUE/PUBLISHED. */
export function deriveProjectPublicationState(
  project: SchedulableProject,
  now: Date,
): PublicationState {
  return derivePublicationState(toSchedulable(project), now);
}

/** Dự án đang giữ một lịch tương lai hợp lệ (đổi được, huỷ được). */
export function isActiveFutureProjectSchedule(
  project: SchedulableProject,
  now: Date,
): boolean {
  return isActiveFutureSchedule(toSchedulable(project), now);
}

/** Lịch ĐÃ tới hạn nhưng reconciler chưa chạy — dự án đã hiển thị công khai. */
export function isDueProjectSchedule(
  project: SchedulableProject,
  now: Date,
): boolean {
  return isDueSchedule(toSchedulable(project), now);
}

/** Dự án đã có lịch sử xuất bản thật chưa? */
export function projectHasHistoricalPublication(
  project: SchedulableProject,
  now: Date,
): boolean {
  return hasHistoricalPublication(toSchedulable(project), now);
}

/**
 * Dự án này có đặt / đổi lịch được không (luật v1 — CHỈ lần công khai đầu).
 *
 * - Đang PUBLISHED: không. Một slug là một URL đang phục vụ công khai.
 * - Đang giữ lịch tương lai hợp lệ: có — đây là luồng **đổi lịch**.
 * - Từng công khai thật (kể cả đã gỡ về nháp, kể cả lịch đã tới hạn): không.
 *   Backend từ chối 409.
 */
export function canScheduleProject(
  role: Role | undefined | null,
  project: SchedulableProject,
  now: Date,
): boolean {
  if (!canScheduleRole(role)) return false;
  if (project.contentStatus === "PUBLISHED") return false;
  if (isActiveFutureProjectSchedule(project, now)) return true;
  return !projectHasHistoricalPublication(project, now);
}

/**
 * Ma trận thao tác đặt lịch cho một vai trò tại một trạng thái. Chỉ quyết định
 * UI hiện nút nào — luôn khớp với thứ backend cho phép, để không bao giờ hiện
 * một nút chắc chắn nổ 403/409.
 */
export function projectScheduleActions(
  role: Role | undefined | null,
  project: SchedulableProject,
  now: Date,
): NewsScheduleActions {
  const active =
    canScheduleRole(role) && isActiveFutureProjectSchedule(project, now);
  return {
    schedule: canScheduleProject(role, project, now) && !active,
    reschedule: active,
    cancel: active,
  };
}
