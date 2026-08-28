// Service xác thực Admin/CMS — nối API thật của backend NestJS:
//   POST /auth/login    { email, password }  -> { accessToken, refreshToken }
//   POST /auth/logout   { refreshToken }     -> { loggedOut: true }
//   POST /auth/refresh  { refreshToken }     -> { accessToken, refreshToken }
//   GET  /auth/me                            -> { id, name, email, role }
//
// Login chỉ trả token, nên tên hiển thị lấy từ /auth/me. Payload JWT (sub,
// email, role) dùng để dựng user tạm ngay lập tức — tránh chờ mạng khi tải
// trang — và làm phương án dự phòng nếu /auth/me lỗi.

import type {
  AcceptInvitationInput,
  AuthUser,
  ChangePasswordInput,
  ResetPasswordInput,
  Role,
} from "@/types";
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

/** Suy AuthUser từ payload JWT. Tên hiển thị tạm lấy phần trước @ của email —
 * chỉ dùng khi chưa/không lấy được hồ sơ thật từ /auth/me. */
function buildUser(payload: JwtPayload): AuthUser {
  const localPart = payload.email.split("@")[0] ?? payload.email;
  return {
    id: payload.sub,
    email: payload.email,
    name: localPart,
    role: normalizeRole(payload.role),
  };
}

interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
}

/** Hồ sơ tài khoản đang đăng nhập (nguồn duy nhất cho tên hiển thị thật). */
export async function fetchMe(): Promise<AuthUser> {
  const me = await apiFetch<MeResponse>("/auth/me");
  return { ...me, role: normalizeRole(me.role) };
}

/** Lấy hồ sơ thật; lỗi mạng/endpoint → lùi về thông tin suy từ JWT. */
async function fetchMeOrFallback(payload: JwtPayload): Promise<AuthUser> {
  try {
    return await fetchMe();
  } catch {
    return buildUser(payload);
  }
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
  return fetchMeOrFallback(payload);
}

/* -------------------------------------------------------------------------
   Lời mời thiết lập tài khoản — endpoint CÔNG KHAI (không cần đăng nhập).
   Dùng `skipAuthHandler` để lỗi 400/401 của token lời mời KHÔNG kích hoạt luồng
   "phiên hết hạn" toàn cục (toast + điều hướng về /dang-nhap). Token chỉ nằm
   trong tham số hàm, không lưu storage, không log.
   ------------------------------------------------------------------------- */

/**
 * Kiểm tra nhanh token lời mời cho UX (backend vẫn tự xác thực lại khi accept).
 * Trả `{ valid }` — không kèm email/tên/vai trò.
 */
export async function validateInvitation(
  token: string,
): Promise<{ valid: boolean }> {
  return apiFetch<{ valid: boolean }>(
    "/auth/validate-invitation",
    { method: "POST", body: JSON.stringify({ token }) },
    { skipAuthHandler: true },
  );
}

/**
 * Chấp nhận lời mời + đặt mật khẩu đầu tiên. KHÔNG tạo phiên đăng nhập —
 * người dùng đăng nhập lại bình thường sau đó.
 */
export async function acceptInvitation(
  input: AcceptInvitationInput,
): Promise<{ success: boolean; loginRequired: boolean }> {
  return apiFetch<{ success: boolean; loginRequired: boolean }>(
    "/auth/accept-invitation",
    { method: "POST", body: JSON.stringify(input) },
    { skipAuthHandler: true },
  );
}

/* -------------------------------------------------------------------------
   Quên mật khẩu — 3 endpoint CÔNG KHAI (không cần đăng nhập). Dùng
   `skipAuthHandler` để 400/401/429 KHÔNG kích hoạt luồng "phiên hết hạn" toàn
   cục. Token đặt lại chỉ nằm trong tham số hàm — không lưu storage, không đưa
   vào queryKey, không log.
   ------------------------------------------------------------------------- */

/**
 * Yêu cầu gửi email đặt lại mật khẩu. Response LUÔN trung tính (backend không
 * tiết lộ email có tồn tại hay không) — UI chỉ cần biết request đã được nhận.
 */
export async function requestPasswordReset(
  email: string,
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(
    "/auth/forgot-password",
    { method: "POST", body: JSON.stringify({ email }) },
    { skipAuthHandler: true },
  );
}

/**
 * Kiểm tra nhanh token đặt lại cho UX (backend vẫn tự xác thực lại khi reset).
 * Trả `{ valid }` — không kèm email/tên/vai trò/metadata token.
 */
export async function validatePasswordReset(
  token: string,
): Promise<{ valid: boolean }> {
  return apiFetch<{ valid: boolean }>(
    "/auth/validate-password-reset",
    { method: "POST", body: JSON.stringify({ token }) },
    { skipAuthHandler: true },
  );
}

/**
 * Đặt lại mật khẩu bằng token. KHÔNG tạo phiên đăng nhập — người dùng đăng nhập
 * lại bình thường sau đó. Mọi phiên cũ đã bị backend thu hồi.
 */
export async function resetPassword(
  input: ResetPasswordInput,
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(
    "/auth/reset-password",
    { method: "POST", body: JSON.stringify(input) },
    { skipAuthHandler: true },
  );
}

/**
 * Đổi mật khẩu khi ĐANG ĐĂNG NHẬP. Backend xác minh `currentPassword`, đổi hash
 * rồi thu hồi TOÀN BỘ refresh token của tài khoản — kể cả phiên đang gọi.
 *
 * CỐ Ý **KHÔNG** dùng `skipAuthHandler` (khác `login` / `resetPassword`).
 * Ở đây 401 mang đúng nghĩa gốc "phiên hết hạn" nên xử lý toàn cục là ĐÚNG:
 * tự `/auth/refresh` rồi thử lại, hết đường mới dọn token và về trang đăng
 * nhập. Sai `currentPassword` KHÔNG rơi vào nhánh này vì backend trả **400**
 * — đó chính là lý do backend chọn 400 thay vì 401/403.
 *
 * KHÔNG tự dọn token ở đây: việc đó thuộc về caller sau khi đã hiện thông báo
 * thành công (xem `ChangePasswordDialog`), để thứ tự "báo rồi mới đá ra" nằm
 * gọn một chỗ.
 */
export async function changePassword(
  input: ChangePasswordInput,
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
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
  return fetchMeOrFallback(payload);
}
