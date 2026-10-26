import type { AuthUser } from "@/types";

// Chỉ phục vụ hiển thị nút; backend đọc lại quyền trong DB cho mỗi lần xóa.
export function canDeleteContent(
  user: Pick<AuthUser, "role" | "canDeleteCms"> | null | undefined,
): boolean {
  return user?.role === "SUPER_ADMIN" || user?.canDeleteCms === true;
}
