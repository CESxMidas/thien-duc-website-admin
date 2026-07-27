import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_URL, API_URL, FRONTEND_URL } from './e2e/helpers/config';
import { BACKEND_DIR } from './e2e/helpers/backend-env';

const ADMIN_DIR = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIR = path.resolve(ADMIN_DIR, '../thien-duc-website-frontend');

/**
 * Cấu hình Playwright E2E full-stack cho Thiên Đức (host tại repo Admin).
 * Chỉ dùng URL cục bộ — cấm production. webServer tự dựng Backend (3001) +
 * Admin (5174) nên chạy được bằng một lệnh. Backend chạy với transport email
 * GIẢ (MAIL_FAKE_TRANSPORT=1) + tắt Resend/Cloudinary/Sentry để không gọi dịch
 * vụ ngoài. globalSetup có cầu chì DB + migrate deploy + seed E2E.
 */
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  // Full-flow có trạng thái (DB dùng chung) → chạy tuần tự để tất định.
  fullyParallel: false,
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: ADMIN_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      // Backend NestJS trên 3001 — env test, transport email giả, tắt dịch vụ ngoài.
      command: 'npm run start',
      cwd: BACKEND_DIR,
      url: `${API_URL}`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NODE_ENV: 'test',
        MAIL_FAKE_TRANSPORT: '1',
        // Defense-in-depth: fake transport đã chặn Resend, nhưng vẫn tắt hẳn
        // mọi dịch vụ ngoài để tuyệt đối không có lời gọi mạng ra ngoài.
        RESEND_API_KEY: '',
        CLOUDINARY_CLOUD_NAME: '',
        CLOUDINARY_API_KEY: '',
        CLOUDINARY_API_SECRET: '',
        SENTRY_DSN: '',
        MAIL_FROM: 'Thien Duc Test <no-reply@test.local>',
        CONTACT_NOTIFY_TO: 'receiver@test.local',
        ADMIN_APP_URL: ADMIN_URL,
        FRONTEND_URL,
      },
    },
    {
      // Admin SPA (Vite) trên 5174 — .env đã trỏ VITE_API_URL về backend cục bộ.
      command: 'npm run dev',
      cwd: ADMIN_DIR,
      url: ADMIN_URL,
      timeout: 120_000,
      reuseExistingServer: !isCI,
      stdout: 'pipe',
      stderr: 'pipe',
    },
    {
      // Frontend public (Next.js) trên 3000. Dùng `next dev` để không prerender
      // lúc build (tránh phụ thuộc backend khi build). URL health = trang liên hệ
      // (tĩnh, không cần backend) để vừa kiểm sẵn sàng vừa "làm nóng" route.
      command: 'npm run dev',
      cwd: FRONTEND_DIR,
      url: `${FRONTEND_URL}/lien-he`,
      timeout: 180_000,
      reuseExistingServer: !isCI,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_PUBLIC_SITE_URL: FRONTEND_URL,
        NEXT_PUBLIC_SENTRY_DSN: '',
      },
    },
  ],
});
