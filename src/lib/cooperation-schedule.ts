// Trạng thái xuất bản **suy ra** của một DỰ ÁN HỢP TÁC + thao tác đặt lịch
// khả dụng.
//
// ── Vì sao file này mỏng ────────────────────────────────────────────────────
// Luật suy trạng thái lịch không phụ thuộc loại nội dung: nó chỉ đọc ba giá trị
// (trạng thái duyệt, `scheduledAt`, `publishedAt`) và đã được viết + khoá test
// kỹ ở `lib/news-schedule.ts`, rồi dùng lại ở `lib/project-schedule.ts`. Chép
// lại lần thứ ba là chép luôn những chỗ tinh tế nhất — phép so
// `publishedAt === scheduledAt` để phân biệt *dự định* với *lịch sử thật*, và
// các nhánh fail-closed cho tổ hợp dị dạng.
//
// Nên ở đây chỉ làm đúng một việc: **đổi tên trường** cho khớp rồi gọi lại luật
// đã có. Dự án hợp tác gọi cột trạng thái duyệt là `contentStatus`, tin tức gọi
// là `status`.
//
// ── Cảnh báo đặt tên, riêng của model này ──────────────────────────────────
// `CooperationProject.status` KHÔNG phải trạng thái xuất bản: nó là chuỗi song
// ngữ mô tả tiến độ dự án ("Đã bàn giao", "Đang triển khai") và hiện thẳng trên
// thẻ ở trang chủ. Nhầm hai field ở đây sẽ đem một câu tiếng Việt vào vị từ
// xuất bản, và TypeScript **không** kêu nếu ta nhận cả object rồi đọc `.status`
// — nên phép đổi tên bên dưới đi qua một hàm chuyển có kiểu chặt.
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

/** Phần dữ liệu cần để xét lịch của một dự án hợp tác. */
export interface SchedulableCooperationProject {
  contentStatus: ContentStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
}

/**
 * Đưa dự án hợp tác về hình dạng chung mà luật lịch nhận vào.
 *
 * Chỉ đổi tên `contentStatus` → `status`. Cố ý KHÔNG nhận cả object dự án rồi
 * đọc bừa `status`: làm thế thì một lần gọi nhầm sẽ đem TIẾN ĐỘ DỰ ÁN (một câu
 * tiếng Việt) vào vị từ xuất bản.
 */
function toSchedulable(
  project: SchedulableCooperationProject,
): SchedulableContent {
  return {
    status: project.contentStatus,
    scheduledAt: project.scheduledAt,
    publishedAt: project.publishedAt,
  };
}

/** Trạng thái hiển thị: DRAFT/PENDING/SCHEDULED/DUE/PUBLISHED. */
export function deriveCooperationPublicationState(
  project: SchedulableCooperationProject,
  now: Date,
): PublicationState {
  return derivePublicationState(toSchedulable(project), now);
}

/** Đang giữ một lịch tương lai hợp lệ (đổi được, huỷ được). */
export function isActiveFutureCooperationSchedule(
  project: SchedulableCooperationProject,
  now: Date,
): boolean {
  return isActiveFutureSchedule(toSchedulable(project), now);
}

/** Lịch ĐÃ tới hạn nhưng reconciler chưa chạy — bản ghi đã hiển thị công khai. */
export function isDueCooperationSchedule(
  project: SchedulableCooperationProject,
  now: Date,
): boolean {
  return isDueSchedule(toSchedulable(project), now);
}

/** Đã có lịch sử xuất bản thật chưa? */
export function cooperationHasHistoricalPublication(
  project: SchedulableCooperationProject,
  now: Date,
): boolean {
  return hasHistoricalPublication(toSchedulable(project), now);
}

/**
 * Dự án hợp tác này có đặt / đổi lịch được không (luật v1 — CHỈ lần công khai
 * đầu).
 *
 * - Đang PUBLISHED: không. Bản ghi đang chạy trên trang chủ.
 * - Đang giữ lịch tương lai hợp lệ: có — đây là luồng **đổi lịch**.
 * - Từng công khai thật (kể cả đã gỡ về nháp, kể cả lịch đã tới hạn): không.
 *   Backend từ chối 409.
 */
export function canScheduleCooperation(
  role: Role | undefined | null,
  project: SchedulableCooperationProject,
  now: Date,
): boolean {
  if (!canScheduleRole(role)) return false;
  if (project.contentStatus === "PUBLISHED") return false;
  if (isActiveFutureCooperationSchedule(project, now)) return true;
  return !cooperationHasHistoricalPublication(project, now);
}

/**
 * Ma trận thao tác đặt lịch cho một vai trò tại một trạng thái. Chỉ quyết định
 * UI hiện nút nào — luôn khớp với thứ backend cho phép, để không bao giờ hiện
 * một nút chắc chắn nổ 403/409.
 */
export function cooperationScheduleActions(
  role: Role | undefined | null,
  project: SchedulableCooperationProject,
  now: Date,
): NewsScheduleActions {
  const active =
    canScheduleRole(role) && isActiveFutureCooperationSchedule(project, now);
  return {
    schedule: canScheduleCooperation(role, project, now) && !active,
    reschedule: active,
    cancel: active,
  };
}
