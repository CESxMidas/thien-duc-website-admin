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

/**
 * Vai trò sửa được nội dung ở MỌI trạng thái. Đây là luồng đính chính của quản
 * trị (sửa gấp một bài đang chạy trên website) — batch này KHÔNG siết nó.
 */
function canEditAnyState(role?: Role | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/**
 * Sửa được nội dung của Dự án / Dự án hợp tác / Trang không?
 *
 * Ba model này chưa có cột lịch sử xuất bản, nên không phân biệt được "nháp chưa
 * từng đăng" với "nháp đã từng đăng rồi gỡ xuống". Luật vì thế lấy đúng phần
 * chắc chắn: EDITOR sửa được nháp/chờ duyệt, không sửa được nội dung ĐANG hiển
 * thị công khai. Khớp `editorMayEditUnpublished` ở backend.
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
