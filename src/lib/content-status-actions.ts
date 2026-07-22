import type { ContentStatus, Role } from "@/types";

/**
 * Ý nghĩa một thao tác đổi trạng thái — dùng để component chọn icon/kiểu nút mà
 * không phải suy ra từ nhãn chữ.
 */
export type StatusIntent = "submit" | "publish" | "approve" | "revert";

export interface ContentStatusAction {
  /** Trạng thái đích khi bấm nút. */
  to: ContentStatus;
  /** Nhãn hiển thị trên nút. */
  label: string;
  /** Loại thao tác (để chọn icon/kiểu nút, không đổi hành vi gọi API). */
  intent: StatusIntent;
}

/**
 * Vai trò được **đăng thẳng / duyệt / gỡ** nội dung (khớp chốt quyền backend:
 * route `.../status` cho EDITOR trở lên gọi, nhưng `assertContentStatusTransition`
 * chỉ để ADMIN/SUPER_ADMIN đặt trạng thái tùy ý).
 */
function canApproveRole(role?: Role | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

const REVERT: ContentStatusAction = {
  to: "DRAFT",
  label: "Trả về nháp",
  intent: "revert",
};

/**
 * Các thao tác đổi trạng thái khả dụng cho một vai trò tại một trạng thái, dùng
 * chung cho cả bốn module nội dung (Tin tức, Dự án, Trang, Dự án hợp tác) theo
 * bậc thang `DRAFT → PENDING → PUBLISHED`. Gom về một chỗ để không lặp logic nút.
 *
 * Quy tắc nghiệp vụ (Option B — công ty nhỏ, ít quản trị viên):
 * - **ADMIN / SUPER_ADMIN**: từ DRAFT **đăng thẳng** (PUBLISHED) với nhãn
 *   "Đăng ngay" — không phải tự gửi duyệt nội dung của chính mình; vẫn duyệt được
 *   bài EDITOR gửi lên (PENDING → PUBLISHED) và trả về nháp.
 * - **EDITOR**: chỉ **gửi duyệt** bản nháp (DRAFT → PENDING); không đăng/duyệt/gỡ.
 *
 * Backend (`PATCH .../status` + `assertContentStatusTransition`) mới là nơi chốt
 * quyền; helper này chỉ quyết định UI hiển thị nhãn/thao tác nào, luôn khớp với
 * những gì backend cho phép để không hiện nút gây 403.
 */
export function contentStatusActions(
  role: Role | undefined | null,
  status: ContentStatus,
): ContentStatusAction[] {
  switch (status) {
    case "DRAFT":
      return canApproveRole(role)
        ? [{ to: "PUBLISHED", label: "Đăng ngay", intent: "publish" }]
        : [{ to: "PENDING", label: "Gửi duyệt", intent: "submit" }];
    case "PENDING":
      return canApproveRole(role)
        ? [{ to: "PUBLISHED", label: "Duyệt & đăng", intent: "approve" }, REVERT]
        : [];
    case "PUBLISHED":
      return canApproveRole(role) ? [REVERT] : [];
    default:
      return [];
  }
}
