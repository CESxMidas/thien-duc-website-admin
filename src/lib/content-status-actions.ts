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

/** Vai trò được duyệt/gỡ nội dung (khớp `@Roles(ADMIN, SUPER_ADMIN)` ở backend). */
function canApproveRole(role?: Role | null): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Vai trò bỏ qua luồng duyệt cho chính thao tác của mình. */
function canBypassRole(role?: Role | null): boolean {
  return role === "SUPER_ADMIN";
}

const REVERT: ContentStatusAction = {
  to: "DRAFT",
  label: "Trả về nháp",
  intent: "revert",
};

/**
 * Các thao tác đổi trạng thái khả dụng cho một vai trò tại một trạng thái, dùng
 * chung cho mọi module theo bậc thang `DRAFT → PENDING → PUBLISHED`
 * (Tin tức, Dự án). Gom về một chỗ để không lặp logic nút ở từng trang.
 *
 * - **SUPER_ADMIN** bỏ qua luồng duyệt: từ DRAFT **đăng thẳng** (PUBLISHED) với
 *   nhãn "Đăng ngay", không phải "Gửi duyệt" — không tự gửi duyệt nội dung của
 *   chính mình.
 * - **ADMIN** giữ luồng duyệt: DRAFT → "Gửi duyệt" (PENDING) → "Duyệt & đăng".
 * - **EDITOR** chỉ gửi duyệt được bản nháp; không duyệt/gỡ.
 *
 * Backend (`PATCH .../status`, `@Roles(ADMIN, SUPER_ADMIN)`) mới là nơi chốt
 * quyền; helper này chỉ quyết định UI hiển thị nhãn/thao tác nào.
 */
export function contentStatusActions(
  role: Role | undefined | null,
  status: ContentStatus,
): ContentStatusAction[] {
  switch (status) {
    case "DRAFT":
      return canBypassRole(role)
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
