import type { AuthUser, Role } from "@/types";

/**
 * SUPER_ADMIN là vai trò cao nhất — bỏ qua luồng duyệt nội dung (nháp → chờ
 * duyệt → đăng) cho chính thao tác của họ. Backend là nơi chốt hành vi (nội
 * dung do SUPER_ADMIN tạo được xuất bản ngay); helper này chỉ dùng để UI hiển
 * thị đúng thông điệp, không thay cho kiểm tra quyền phía server.
 */
export function isSuperAdmin(user?: { role: Role } | AuthUser | null): boolean {
  return user?.role === "SUPER_ADMIN";
}

/** Vai trò được bỏ qua luồng duyệt khi tạo/sửa nội dung. */
export function canBypassApproval(
  user?: { role: Role } | AuthUser | null,
): boolean {
  return isSuperAdmin(user);
}
