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
      // `GET /api` là endpoint không cần đăng nhập, trả 200, không phụ thuộc dữ
      // liệu đã seed và không redirect → đúng chuẩn URL sẵn sàng.
      command: 'npm run start',
      cwd: BACKEND_DIR,
      url: `${API_URL}`,
      timeout: 120_000,
      // Ở CI, workflow đã tự dựng và kiểm sẵn sàng từng service TRƯỚC (xem
      // `e2e-fullstack.yml`) để lỗi khởi động lộ ra theo từng bước có log riêng.
      // Cho phép dùng lại tiến trình đó thay vì dựng chồng lên cổng đang bận.
      reuseExistingServer: isCI,
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
        // Origin của trình duyệt giờ là 127.0.0.1 (xem `helpers/config.ts`), nên
        // CORS phải cho phép đúng hai origin đó. Ghi ở đây thay vì bắt mọi máy
        // dev sửa `.env` — và `.env` cục bộ mới chỉ liệt kê `localhost`.
        CORS_ORIGIN: `${FRONTEND_URL},${ADMIN_URL}`,
      },
    },
    {
      // Admin SPA (Vite) trên 5174 — .env đã trỏ VITE_API_URL về backend cục bộ.
      // Ghi rõ host + cổng + `--strictPort`: không để Vite âm thầm nhảy 5175
      // trong khi Playwright vẫn chờ ở 5174.
      command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
      cwd: ADMIN_DIR,
      url: ADMIN_URL,
      timeout: 120_000,
      // Dùng lại được ở CẢ HAI môi trường: ở CI vì workflow đã dựng sẵn và kiểm
      // sức khỏe từng service; ở máy dev vì `npm run dev` đang chạy không gây
      // hại gì. Khác backend — backend luôn dựng mới để chắc chắn dùng transport
      // email GIẢ, không lỡ gửi mail thật qua một tiến trình dev sẵn có.
      reuseExistingServer: true,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        // Trang admin chạy ở origin 127.0.0.1 nên phải gọi API cũng bằng
        // 127.0.0.1, nếu không sẽ thành cross-origin và bị CORS chặn.
        VITE_API_URL: API_URL,
        VITE_PUBLIC_SITE_URL: FRONTEND_URL,
        VITE_SENTRY_DSN: '',
      },
    },
    {
      // Frontend public (Next.js) trên 3000. Dùng `next dev` để không prerender
      // lúc build (tránh phụ thuộc backend khi build).
      //
      // CỐ Ý KHÔNG truyền `--hostname`. Mặc định `next dev` đã bind `0.0.0.0`,
      // tức là nhận cả 127.0.0.1 — thăm dò bằng IPv4 vẫn tới nơi.
      // ĐỪNG thêm `--hostname 127.0.0.1`: đã đo được ở Next 16, cờ đó làm
      // `NextResponse.rewrite` trong `src/proxy.ts` biến thành **redirect**, gây
      // vòng lặp 308 vô tận `/` → `/vi` → `/` (mọi trang hỏng, ERR_TOO_MANY_
      // REDIRECTS). Bỏ cờ đi thì `/`, `/lien-he`, `/en` đều trả 200, 0 redirect.
      //
      // URL sẵn sàng CỐ Ý là một trang thật: nó vừa kiểm sẵn sàng vừa **làm
      // nóng** `[locale]/layout.tsx` (Tailwind + `next/font/google`). Nếu chỉ
      // chờ `/api/health` — rẻ hơn nhưng không biên dịch trang nào — thì test
      // đầu tiên điều hướng sẽ phải trả toàn bộ chi phí biên dịch và dễ vượt
      // `expect` timeout trên máy nguội (đo được: 43→12 test đỏ vì lý do này).
      // `/lien-he` tĩnh, không cần backend, trả 200 và KHÔNG redirect.
      // `/api/health` vẫn tồn tại và được workflow CI dùng cho readiness check.
      command: 'npm run dev -- --port 3000',
      cwd: FRONTEND_DIR,
      url: `${FRONTEND_URL}/lien-he`,
      timeout: 180_000,
      reuseExistingServer: true,
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
