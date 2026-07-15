// Lớp gọi API dùng chung cho Admin CMS.
// Khớp response chuẩn của backend: { success, data, message }
//                          hoặc lỗi { success:false, error:{ code, message, details } }.

import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const ACCESS_TOKEN_KEY = "td_admin_access_token";
const REFRESH_TOKEN_KEY = "td_admin_refresh_token";

/** Đường dẫn trang đăng nhập (khớp route trong App.tsx). */
export const LOGIN_PATH = "/dang-nhap";

/**
 * Đọc token ưu tiên localStorage (đã tick "Ghi nhớ đăng nhập") rồi tới
 * sessionStorage (phiên tạm — mất khi đóng tab).
 */
function readToken(key: string): string | null {
  return localStorage.getItem(key) ?? sessionStorage.getItem(key);
}

export function getAccessToken(): string | null {
  return readToken(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  return readToken(REFRESH_TOKEN_KEY);
}

/** Còn refresh token đang lưu không (để quyết định có thử khôi phục phiên). */
export function hasRefreshToken(): boolean {
  return getRefreshToken() !== null;
}

/**
 * Chế độ lưu hiện tại có phải "ghi nhớ" (localStorage) không. Dùng khi làm mới
 * token để giữ đúng nơi lưu ban đầu — không vô tình chuyển phiên tạm thành lâu dài.
 */
function isRemembered(): boolean {
  return localStorage.getItem(ACCESS_TOKEN_KEY) !== null;
}

/**
 * Lưu cặp token. `remember=true` → localStorage (giữ qua các phiên);
 * `false` → sessionStorage (mất khi đóng tab). Luôn xóa storage còn lại
 * để không sót token cũ.
 */
export function setTokens(
  accessToken: string,
  refreshToken: string,
  remember: boolean,
): void {
  const store = remember ? localStorage : sessionStorage;
  const other = remember ? sessionStorage : localStorage;
  store.setItem(ACCESS_TOKEN_KEY, accessToken);
  store.setItem(REFRESH_TOKEN_KEY, refreshToken);
  other.removeItem(ACCESS_TOKEN_KEY);
  other.removeItem(REFRESH_TOKEN_KEY);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, error: ApiError) {
    super(error.message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = error.code;
  }
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string | null;
  error?: ApiError;
}

interface FetchConfig {
  /**
   * Bỏ qua xử lý 401/403 toàn cục (toast + điều hướng). Dùng cho request
   * đăng nhập — nơi 401 nghĩa là "sai tài khoản/mật khẩu" chứ không phải
   * "phiên hết hạn", và được caller tự map thông báo.
   */
  skipAuthHandler?: boolean;
}

/** Điều hướng cứng về trang đăng nhập, tránh lặp khi đang ở sẵn trang đó. */
function redirectToLogin(): void {
  if (window.location.pathname !== LOGIN_PATH) {
    window.location.assign(LOGIN_PATH);
  }
}

// Đang có một lượt làm mới token chạy dở — dùng chung cho mọi request để nhiều
// request 401 cùng lúc chỉ gọi /auth/refresh một lần (single-flight).
let refreshPromise: Promise<string | null> | null = null;

/**
 * Đổi refresh token lấy cặp token mới qua `POST /auth/refresh`. Trả access token
 * mới nếu thành công, `null` nếu không (hết hạn/bị thu hồi/mạng lỗi). Gọi bằng
 * `fetch` trực tiếp — không qua `apiFetch` để tránh đệ quy khi refresh cũng 401.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(null);

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as ApiEnvelope<{
        accessToken: string;
        refreshToken: string;
      }>;
      const data = body?.data;
      if (!data?.accessToken || !data?.refreshToken) return null;
      // Backend xoay vòng refresh token → phải lưu cả cặp mới, giữ đúng nơi lưu.
      setTokens(data.accessToken, data.refreshToken, isRemembered());
      return data.accessToken;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  config: FetchConfig = {},
): Promise<T> {
  return requestWithRefresh<T>(path, options, config, true);
}

/**
 * Thân xử lý request. Khi gặp 401 (và không phải request tự map lỗi như đăng
 * nhập), thử làm mới token đúng một lần rồi gọi lại request. Refresh thất bại →
 * dọn phiên, toast, về trang đăng nhập.
 */
async function requestWithRefresh<T>(
  path: string,
  options: RequestInit,
  config: FetchConfig,
  allowRefresh: boolean,
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  // Với FormData (upload ảnh) phải để trình duyệt tự đặt Content-Type kèm
  // `boundary` — ép sẵn application/json thì backend không parse được file.
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    // Lỗi mạng / timeout / CORS — không có response.
    throw new ApiRequestError(0, {
      code: "NETWORK_ERROR",
      message: "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.",
    });
  }

  let body: ApiEnvelope<T> | null = null;
  try {
    body = (await res.json()) as ApiEnvelope<T>;
  } catch {
    // trả về rỗng — xử lý theo status bên dưới
  }

  if (!res.ok || (body && body.success === false)) {
    if (!config.skipAuthHandler) {
      if (res.status === 401) {
        // Access token có thể chỉ vừa hết hạn — thử làm mới rồi gọi lại một lần.
        if (allowRefresh) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            return requestWithRefresh<T>(path, options, config, false);
          }
        }
        clearTokens();
        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
        redirectToLogin();
      } else if (res.status === 403) {
        toast.error("Bạn không có quyền thực hiện thao tác này.");
      }
    }

    throw new ApiRequestError(
      res.status,
      body?.error ?? {
        code: "UNKNOWN",
        message: `Yêu cầu thất bại (HTTP ${res.status}).`,
      },
    );
  }

  return (body?.data ?? (body as unknown)) as T;
}
