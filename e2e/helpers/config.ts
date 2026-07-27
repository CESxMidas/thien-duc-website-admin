import { backendEnv } from './backend-env';

/** URL dịch vụ E2E — LUÔN cục bộ. Cấm mọi URL production. */
export const ADMIN_URL = process.env.E2E_ADMIN_URL ?? 'http://localhost:5174';
export const FRONTEND_URL =
  process.env.E2E_FRONTEND_URL ?? 'http://localhost:3000';
export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3001/api';

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
