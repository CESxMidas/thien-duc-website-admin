import { backendEnv } from './backend-env';

/**
 * URL dịch vụ E2E — LUÔN cục bộ. Cấm mọi URL production.
 *
 * Dùng `127.0.0.1` chứ KHÔNG dùng `localhost`: trên máy CI, `localhost` phân
 * giải ra `::1` (IPv6) trước, trong khi `next dev` bind mặc định `0.0.0.0` (chỉ
 * IPv4) và Vite bind `127.0.0.1`. Log `DEBUG=pw:webserver` cho thấy mọi lượt
 * thăm dò đều bắt đầu bằng `connect ECONNREFUSED ::1:<port>`; trên Linux không
 * dual-stack, nó sẽ ECONNREFUSED mãi cho tới khi hết hạn chờ webServer. Ghi
 * thẳng IPv4 thì không còn phụ thuộc vào thứ tự phân giải DNS của từng máy.
 */
/**
 * ORIGIN của Admin — scheme + host + port, KHÔNG kèm đường dẫn.
 *
 * Tách riêng khỏi `ADMIN_URL` vì có chỗ bắt buộc phải là origin thuần:
 * `CORS_ORIGIN` của backend so khớp header `Origin` của trình duyệt, mà header
 * đó KHÔNG BAO GIỜ chứa path. Nhét `/admin` vào đấy thì mọi request trong E2E
 * chết vì CORS — và thông báo lỗi sẽ chỉ là "network error", rất khó lần ra.
 */
export const ADMIN_ORIGIN =
  process.env.E2E_ADMIN_ORIGIN ?? 'http://127.0.0.1:5174';

/**
 * Tiền tố đường dẫn của Admin — khớp `base` trong `vite.config.ts` (Batch 15B).
 * Vite dev server cũng tôn trọng `base`, nên kể cả chạy local thì Admin cũng
 * nằm ở `/admin`, không phải gốc `/`.
 */
export const ADMIN_BASE_PATH = '/admin';

/** Gốc điều hướng của Admin: origin + tiền tố base. */
export const ADMIN_URL =
  process.env.E2E_ADMIN_URL ?? `${ADMIN_ORIGIN}${ADMIN_BASE_PATH}`;

export const FRONTEND_URL =
  process.env.E2E_FRONTEND_URL ?? 'http://127.0.0.1:3000';
export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001/api';

for (const url of [ADMIN_ORIGIN, ADMIN_URL, FRONTEND_URL, API_URL]) {
  if (/render\.com|vercel\.app|onrender\.com/i.test(url)) {
    throw new Error(`E2E: cấm URL production trong cấu hình: ${url}`);
  }
}

/**
 * Dựng đường dẫn Admin cho `page.goto()`.
 *
 * BẮT BUỘC dùng thay cho `page.goto('/dang-nhap')` trần. Lý do: Playwright ghép
 * path bằng `new URL(path, baseURL)`, mà một path bắt đầu bằng `/` sẽ THAY THẾ
 * toàn bộ pathname của baseURL — `'/dang-nhap'` với baseURL
 * `http://127.0.0.1:5174/admin` cho ra `http://127.0.0.1:5174/dang-nhap`, tức
 * đi lạc ra ngoài app. Playwright cũng KHÔNG biết gì về `basename` của React
 * Router, nên không có cơ chế nào tự sửa hộ.
 *
 * `adminPath('/dang-nhap')` → `'/admin/dang-nhap'`.
 */
export function adminPath(path: string): string {
  return `${ADMIN_BASE_PATH}/${path.replace(/^\/+/, '')}`;
}

/** Domain riêng cho tài khoản fixture E2E (khớp backend TestUsersService). */
export const E2E_DOMAIN = '@e2e.test';

/** Tài khoản seed cố định — mật khẩu đọc từ backend/.env (không hardcode). */
export function seedAccounts() {
  const env = backendEnv();
  return {
    superAdmin: {
      email: env.SUPER_ADMIN_EMAIL ?? 'superadmin@test.local',
      password: env.SUPER_ADMIN_PASSWORD ?? '',
      role: 'SUPER_ADMIN' as const,
    },
    admin: {
      email: env.ADMIN_EMAIL ?? 'admin-e2e@test.local',
      password: env.ADMIN_PASSWORD ?? '',
      role: 'ADMIN' as const,
    },
  };
}

/** Email fixture E2E duy nhất mỗi lần chạy (tránh va chạm giữa các lần chạy). */
export function uniqueE2eEmail(prefix: string): string {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${stamp}${E2E_DOMAIN}`;
}
