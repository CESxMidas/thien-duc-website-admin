// Service quản lý tài khoản — nối API thật của backend NestJS:
//   GET    /users        -> AdminUser[]        (ADMIN, SUPER_ADMIN)
//   PATCH  /users/:id    -> AdminUser          (chỉ SUPER_ADMIN)
//   DELETE /users/:id    -> { deactivated }    (chỉ SUPER_ADMIN — khóa mềm)
//
// Backend tự chặn các thao tác nguy hiểm (tự hạ quyền, tự khóa, hạ quyền Super
// Admin cuối cùng) và trả 400 kèm message tiếng Việt — UI chỉ việc hiện toast.

import { apiFetch } from "./client";
import type {
  AccountInvitationMeta,
  AdminUser,
  AdminUserDetail,
  CreateAccountInvitationInput,
  CreateAccountInvitationResult,
  MyProfile,
  ProfileChangeRequestRow,
  ProfileChangeStatus,
  ProfilePayload,
  Role,
} from "@/types";

/**
 * Mọi field đều tùy chọn. KHÔNG có `password`: SUPER_ADMIN không được đặt mật
 * khẩu cho tài khoản khác — người dùng tự đặt qua lời mời, tự đổi qua luồng
 * quên mật khẩu. Backend cũng từ chối `password` trong PATCH /users/:id.
 */
export interface UpdateUserInput {
  name?: string;
  email?: string;
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

/* -------------------------------------------------------------------------
   Lời mời thiết lập tài khoản — lối cấp tài khoản DUY NHẤT.
   CMS-RETIRE-DIRECT-USER-CREATE-M1: `createUser()` gọi `POST /users` (tạo
   trực tiếp kèm mật khẩu) đã bị gỡ khỏi client cùng lúc route backend bị gỡ.
   Đừng thêm lại — quản trị viên không đặt mật khẩu cho người khác.
   POST /users/invitations          -> { user, invitation }   (SUPER_ADMIN)
   POST /users/:id/resend-invitation -> AccountInvitationMeta  (SUPER_ADMIN)
   POST /users/:id/revoke-invitation -> { revoked }            (SUPER_ADMIN)

   KHÔNG có field mật khẩu ở input; response KHÔNG bao giờ chứa token thô —
   token chỉ được gửi qua email tới người được mời.
   ------------------------------------------------------------------------- */

/** SUPER_ADMIN tạo tài khoản qua lời mời — không đặt/không thấy mật khẩu. */
export function createUserInvitation(
  input: CreateAccountInvitationInput,
): Promise<CreateAccountInvitationResult> {
  return apiFetch<CreateAccountInvitationResult>("/users/invitations", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Gửi lại lời mời (thu hồi lời mời cũ, tạo lời mời mới + gửi email lại). */
export function resendUserInvitation(
  userId: string,
): Promise<AccountInvitationMeta> {
  return apiFetch<AccountInvitationMeta>(
    `/users/${userId}/resend-invitation`,
    { method: "POST" },
  );
}

/** Thu hồi lời mời đang hiệu lực của một tài khoản chờ thiết lập. */
export function revokeUserInvitation(
  userId: string,
): Promise<{ revoked: boolean }> {
  return apiFetch<{ revoked: boolean }>(
    `/users/${userId}/revoke-invitation`,
    { method: "POST" },
  );
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

/* -------------------------------------------------------------------------
   Hồ sơ cá nhân + luồng duyệt
   GET   /users/me                       -> MyProfile
   PATCH /users/me                       -> MyProfile (EDITOR: chờ duyệt)
   GET   /users/profile-requests         -> ProfileChangeRequestRow[]
   PATCH /users/profile-requests/:id     -> quyết định duyệt/từ chối
   ------------------------------------------------------------------------- */

/** Hồ sơ đầy đủ của người đang đăng nhập (mọi vai trò). */
export function getMyProfile(): Promise<MyProfile> {
  return apiFetch<MyProfile>("/users/me");
}

/** Gửi cập nhật hồ sơ. EDITOR → tạo yêu cầu chờ duyệt; admin → áp thẳng. */
export function updateMyProfile(input: ProfilePayload): Promise<MyProfile> {
  return apiFetch<MyProfile>("/users/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Danh sách yêu cầu cập nhật hồ sơ để ADMIN/SUPER_ADMIN duyệt. */
export function listProfileRequests(
  status?: ProfileChangeStatus,
): Promise<ProfileChangeRequestRow[]> {
  const query = status ? `?status=${status}` : "";
  return apiFetch<ProfileChangeRequestRow[]>(`/users/profile-requests${query}`);
}

export interface ReviewProfileRequestInput {
  action: "APPROVE" | "REJECT";
  note?: string;
}

/** Duyệt hoặc từ chối một yêu cầu cập nhật hồ sơ. */
export function reviewProfileRequest(
  id: string,
  input: ReviewProfileRequestInput,
): Promise<ProfileChangeRequestRow> {
  return apiFetch<ProfileChangeRequestRow>(`/users/profile-requests/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
