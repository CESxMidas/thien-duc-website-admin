// Service xác thực Admin/CMS — nối API thật của backend NestJS:
//   POST /auth/login   { email, password }        -> { accessToken, refreshToken }
//   POST /auth/logout   { refreshToken }           -> { loggedOut: true }
//   POST /auth/refresh  { refreshToken }           -> { accessToken, refreshToken }
//
// Login chỉ trả token (không có object user, chưa có endpoint /auth/me), nên
// thông tin user hiển thị được suy ra từ payload JWT (sub, email, role).

import type { AuthUser, Role } from "@/types";
import { decodeJwt, isTokenExpired, type JwtPayload } from "@/lib/jwt";
import {
  apiFetch,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  hasRefreshToken,
  refreshAccessToken,
  setTokens,
} from "./client";

interface LoginTokens {
  accessToken: string;
  refreshToken: string;
}

const KNOWN_ROLES: readonly Role[] = ["EDITOR", "ADMIN", "SUPER_ADMIN"];

function normalizeRole(role: string): Role {
  return (KNOWN_ROLES as readonly string[]).includes(role)
    ? (role as Role)
    : "EDITOR";
}

/** Suy AuthUser từ payload JWT. Tên hiển thị tạm lấy phần trước @ của email
 * (backend chưa trả tên qua login / chưa có /auth/me). */
function buildUser(payload: JwtPayload): AuthUser {
  const localPart = payload.email.split("@")[0] ?? payload.email;
  return {
    id: payload.sub,
    email: payload.email,
    name: localPart,
    role: normalizeRole(payload.role),
  };
}

/**
 * Đăng nhập. Ném `ApiRequestError` (kèm `status`) khi thất bại để LoginPage map
 * sang toast. `skipAuthHandler` để 401 (sai mật khẩu) không kích hoạt luồng
 * "phiên hết hạn" toàn cục.
 */
export async function login(
  email: string,
  password: string,
  remember: boolean,
): Promise<AuthUser> {
  const tokens = await apiFetch<LoginTokens>(
    "/auth/login",
    { method: "POST", body: JSON.stringify({ email, password }) },
    { skipAuthHandler: true },
  );

  const payload = decodeJwt(tokens.accessToken);
  if (!payload) {
    throw new Error("Access token không hợp lệ.");
  }

  setTokens(tokens.accessToken, tokens.refreshToken, remember);
  return buildUser(payload);
}

/** Đăng xuất: thu hồi refresh token ở backend (best-effort) rồi xóa token cục bộ. */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken) {
    try {
      await apiFetch(
        "/auth/logout",
        { method: "POST", body: JSON.stringify({ refreshToken }) },
        { skipAuthHandler: true },
      );
    } catch {
      // Kệ lỗi mạng/thu hồi — vẫn xóa token phía client bên dưới.
    }
  }
  clearTokens();
}

/**
 * Khôi phục phiên khi tải lại trang: đọc access token đang lưu, decode. Nếu hết
 * hạn hoặc hỏng thì dọn token và trả `null`.
 */
export function restoreUser(): AuthUser | null {
  const token = getAccessToken();
  if (!token) return null;

  const payload = decodeJwt(token);
  if (!payload || isTokenExpired(payload)) {
    // Access token hết hạn: chưa xóa vội — có thể còn refresh token để khôi phục
    // phiên bất đồng bộ (xem restoreSession). Chỉ dọn khi không còn gì để cứu.
    if (!hasRefreshToken()) clearTokens();
    return null;
  }
  return buildUser(payload);
}

/** Còn khả năng khôi phục phiên bất đồng bộ không (access hết hạn nhưng còn refresh). */
export function canRestoreSession(): boolean {
  return restoreUser() === null && hasRefreshToken();
}

/**
 * Khôi phục phiên khi access token đã hết hạn: đổi refresh token lấy token mới.
 * Thành công → trả AuthUser; thất bại → dọn token và trả `null`.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  const newAccessToken = await refreshAccessToken();
  if (!newAccessToken) {
    clearTokens();
    return null;
  }
  const payload = decodeJwt(newAccessToken);
  if (!payload) {
    clearTokens();
    return null;
  }
  return buildUser(payload);
}
