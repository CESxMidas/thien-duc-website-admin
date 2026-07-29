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
export const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://127.0.0.1:5174';
export const FRONTEND_URL =
  process.env.E2E_FRONTEND_URL ?? 'http://127.0.0.1:3000';
export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3001/api';

for (const url of [ADMIN_URL, FRONTEND_URL, API_URL]) {
  if (/render\.com|vercel\.app|onrender\.com/i.test(url)) {
    throw new Error(`E2E: cấm URL production trong cấu hình: ${url}`);
  }
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
