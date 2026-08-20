// Ai được **sửa nội dung** ở trạng thái nào — bản song song của chốt quyền
// backend (`assertContentEditAllowed` + vị từ riêng của từng module).
//
// ── Ranh giới quan trọng ────────────────────────────────────────────────────
// Backend là NƠI CHỐT. Route `PATCH /news/:slug`, `/projects/:slug`,
// `/cooperation/:id`, `/pages/:slug` đều nạp bản ghi hiện tại, so vai trò đã xác
// thực với trạng thái đã lưu, rồi mới ghi — gọi API trực tiếp cũng bị 403. File
// này chỉ để **không hiện một nút chắc chắn nổ 403**: người dùng không nên mở
// được form sửa rồi mới biết mình không có quyền lưu.
//
// ── Vì sao cần chốt này ─────────────────────────────────────────────────────
// Trước batch này, EDITOR sửa được bài SAU khi ADMIN đã hẹn giờ đăng:
//
//   07:00  ADMIN đặt lịch 08:00
//   07:59  EDITOR sửa nội dung
//   08:00  bản ĐÃ SỬA tự ra công khai
//
// Tức bản ADMIN duyệt không phải bản ra công khai. Ranh giới mới: EDITOR sửa
// nội dung còn trong khâu biên tập, hết quyền khi nội dung đã qua cửa duyệt.

import type { ContentStatus, Role } from "@/types";
import type { SchedulableContent } from "@/lib/news-schedule";
import type { SchedulableCooperationProject } from "@/lib/cooperation-schedule";
import type { SchedulablePage } from "@/lib/page-schedule";
import type { SchedulableProject } from "@/lib/project-schedule";

/**
 * Vai trò sửa được nội dung ở MỌI trạng thái. Đây là luồng đính chính của quản
 * trị (sửa gấp một bài đang chạy trên website) — batch này KHÔNG siết nó.
 */
function canEditAnyState(role?: Role | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Luật sửa CŨ theo bậc thang duyệt, không xét lịch sử xuất bản: EDITOR sửa được
 * nháp/chờ duyệt, không sửa được nội dung ĐANG hiển thị công khai.
 *
 * **Không còn module nội dung nào dùng hàm này**: Dự án tách ra từ Batch 9
 * (`canEditProject`), Dự án hợp tác từ Batch 10 (`canEditCooperation`), Trang
 * nội dung từ Batch 11 (`canEditPage`) — cả ba nay có cột mốc thời gian nên
 * dùng luật chặt hơn. Giữ lại vì `Banner` và các màn khác có thể còn cần một vị
 * từ chỉ-theo-trạng-thái; xoá hẳn thuộc một đợt dọn riêng.
 */
export function canEditPublishableContent(
  role: Role | undefined | null,
  status: ContentStatus,
): boolean {
  if (canEditAnyState(role)) return true;
  if (role !== "EDITOR") return false;
  return status === "DRAFT" || status === "PENDING";
}

/**
 * Sửa được nội dung DỰ ÁN không? (Batch 9 — dự án nay có lịch đăng.)
 *
 * Trước Batch 9 dự án dùng chung `canEditPublishableContent`: chặn ở PUBLISHED,
 * cho sửa mọi PENDING. Nay một dự án ĐÃ ĐƯỢC LÊN LỊCH vẫn lưu là `PENDING`, nên
 * luật cũ sẽ hiện nút "Sửa" cho một dự án mà backend chắc chắn từ chối — và tệ
 * hơn, nếu backend cũng còn luật cũ thì EDITOR sửa được bản sắp tự ra công khai.
 *
 * Luật khớp từng ca với bài viết, chỉ khác tên cột. Xem `canEditNews` cho lý do
 * hàm này không cần `now`.
 */
export function canEditProject(
  role: Role | undefined | null,
  project: SchedulableProject,
): boolean {
  if (canEditAnyState(role)) return true;
  if (role !== "EDITOR") return false;
  if (project.publishedAt !== null) return false;
  if (project.contentStatus === "DRAFT") return true;
  return project.contentStatus === "PENDING" && project.scheduledAt === null;
}

/**
 * Sửa được nội dung DỰ ÁN HỢP TÁC không? (Batch 10 — nay có lịch đăng.)
 *
 * Trước Batch 10 dự án hợp tác dùng chung `canEditPublishableContent`: chặn ở
 * PUBLISHED, cho sửa mọi PENDING. Nay một bản ĐÃ ĐƯỢC LÊN LỊCH vẫn lưu là
 * `PENDING`, nên luật cũ sẽ hiện nút "Sửa" cho một bản mà backend chắc chắn từ
 * chối — và tệ hơn, nếu backend cũng còn luật cũ thì EDITOR sửa được bản sắp tự
 * ra trang chủ.
 *
 * Luật khớp từng ca với bài viết và dự án, chỉ khác tên cột. Xem `canEditNews`
 * cho lý do hàm này không cần `now`.
 *
 * Lưu ý: `project.status` của model này là TIẾN ĐỘ DỰ ÁN bằng chữ, không liên
 * quan — nó vẫn sửa được bình thường ở các trạng thái được phép.
 */
export function canEditCooperation(
  role: Role | undefined | null,
  project: SchedulableCooperationProject,
): boolean {
  if (canEditAnyState(role)) return true;
  if (role !== "EDITOR") return false;
  if (project.publishedAt !== null) return false;
  if (project.contentStatus === "DRAFT") return true;
  return project.contentStatus === "PENDING" && project.scheduledAt === null;
}

/**
 * Sửa được nội dung TRANG không? (Batch 11 — trang nay có lịch đăng.)
 *
 * Trước Batch 11 trang dùng chung `canEditPublishableContent`: chặn ở PUBLISHED,
 * cho sửa mọi PENDING. Nay một trang ĐÃ ĐƯỢC LÊN LỊCH vẫn lưu là `PENDING`, nên
 * luật cũ sẽ hiện nút "Sửa" cho một trang mà backend chắc chắn từ chối — và tệ
 * hơn, nếu backend cũng còn luật cũ thì EDITOR sửa được bản sắp tự ra công khai.
 *
 * Trang gọi cột bậc thang duyệt là `status`, đúng như `NewsPost` — nên luật ở
 * đây đọc giống hệt `canEditNews`. Xem `canEditNews` cho lý do hàm này không
 * cần `now`.
 */
export function canEditPage(
  role: Role | undefined | null,
  page: SchedulablePage,
): boolean {
  if (canEditAnyState(role)) return true;
  if (role !== "EDITOR") return false;
  if (page.publishedAt !== null) return false;
  if (page.status === "DRAFT") return true;
  return page.status === "PENDING" && page.scheduledAt === null;
}

/**
 * Sửa được nội dung bài viết không? (News có thêm lịch đăng nên luật chặt hơn.)
 *
 * EDITOR chỉ sửa được:
 * - **nháp chưa từng công khai** (`DRAFT`, không có `publishedAt`), và
 * - **bài chờ duyệt chưa được hẹn giờ** (`PENDING`, không mốc nào).
 *
 * Bị chặn: bài đã lên lịch, bài tới hạn chưa đồng bộ, bài đang đăng, và **nháp
 * TỪNG đăng** — `status = DRAFT` một mình nói sai về bài đã ra ngoài.
 *
 * **Không nhận `now`, và đó là cố ý.** Lệnh đặt lịch ghi `publishedAt =
 * scheduledAt`, nên cả lịch tương lai lẫn lịch đã tới hạn đều có `publishedAt`.
 * Chỉ cần xét sự tồn tại của mốc là đủ — quyết định giống nhau ở trước hạn,
 * đúng hạn và sau hạn, nên đồng hồ máy client không ảnh hưởng gì tới nó (khác
 * với huy hiệu "Đã đến giờ đăng", vốn phải suy ra theo giờ).
 */
export function canEditNews(
  role: Role | undefined | null,
  post: SchedulableContent,
): boolean {
  if (canEditAnyState(role)) return true;
  if (role !== "EDITOR") return false;
  if (post.publishedAt !== null) return false;
  if (post.status === "DRAFT") return true;
  return post.status === "PENDING" && post.scheduledAt === null;
}
