// Service quản lý tài khoản — nối API thật của backend NestJS:
//   GET    /users        -> AdminUser[]        (ADMIN, SUPER_ADMIN)
//   POST   /users        -> AdminUser          (chỉ SUPER_ADMIN)
//   PATCH  /users/:id    -> AdminUser          (chỉ SUPER_ADMIN)
//   DELETE /users/:id    -> { deactivated }    (chỉ SUPER_ADMIN — khóa mềm)
//
// Backend tự chặn các thao tác nguy hiểm (tự hạ quyền, tự khóa, hạ quyền Super
// Admin cuối cùng) và trả 400 kèm message tiếng Việt — UI chỉ việc hiện toast.

import { apiFetch } from "./client";
import type { AdminUser, AdminUserDetail, Role } from "@/types";

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

/** Mọi field đều tùy chọn; `password` có truyền thì đặt lại mật khẩu. */
export interface UpdateUserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: Role;
  isActive?: boolean;
}

export function listUsers(): Promise<AdminUser[]> {
  return apiFetch<AdminUser[]>("/users");
}

/** Chi tiết một tài khoản — thêm updatedAt, lockedUntil so với danh sách. */
export function getUser(id: string): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(`/users/${id}`);
}

export function createUser(input: CreateUserInput): Promise<AdminUser> {
  return apiFetch<AdminUser>("/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Khóa tài khoản (soft delete). Backend đồng thời thu hồi mọi phiên đang mở. */
export function deactivateUser(id: string): Promise<{ deactivated: boolean }> {
  return apiFetch<{ deactivated: boolean }>(`/users/${id}`, {
    method: "DELETE",
  });
}

/** Mở khóa lại tài khoản đã bị khóa. */
export function reactivateUser(id: string): Promise<AdminUser> {
  return updateUser(id, { isActive: true });
}
