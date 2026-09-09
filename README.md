# Thiên Đức — Admin CMS

Vite + React 19 + TypeScript. Admin production được phục vụ tại
`https://www.thienduccons.vn/admin` qua rewrite của Frontend sang một Vercel
project riêng.

## Local Development

### Yêu cầu và cài đặt

- Node.js **22.x LTS** (nguồn chuẩn: `.nvmrc` và `package.json#engines`).
- npm với `package-lock.json`; Backend phải chạy và có tài khoản CMS hợp lệ.

```bash
nvm use
npm ci
cp .env.example .env
npm run dev
```

Mở `http://localhost:5174/admin/`. Đặt:

```dotenv
VITE_API_URL=http://localhost:3001/api
VITE_SITE_URL=http://localhost:3000
VITE_SENTRY_DSN=
```

`VITE_API_URL` là bắt buộc để đăng nhập/gọi API; `VITE_SITE_URL` dùng xem trước
ảnh đường dẫn tương đối; Sentry là tùy chọn. Tài khoản đăng nhập do Backend cấp.
Không commit `.env` hay token đăng nhập.

### Kiểm tra và build

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run preview
```

`npm run build` cũng chạy `tsc -b` và xuất file vào `dist/admin`. Base URL phải
giữ là `/admin/`; không đổi `base`/`outDir` nếu chưa cập nhật đồng bộ rewrite.

E2E full-stack chạy từ repo này, cần ba repository ở cạnh nhau, PostgreSQL test
`thien_duc_test` và Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

Playwright có hàng rào chặn database từ xa; xem hướng dẫn đầy đủ trước khi chạy.

## CI/CD

`.github/workflows/ci.yml` chạy trên push/PR nhánh `main`: `npm ci` → lint →
typecheck → Vitest coverage → build. `e2e-fullstack.yml` checkout cả Backend và
Frontend, dựng PostgreSQL 17 dùng một lần, khởi động ba app và chạy Playwright.
Repo private cần GitHub secret `WORKSPACE_TOKEN` chỉ có quyền đọc ba repo.

CI không deploy. Vercel triển khai qua Git integration; branch protection và
việc Vercel có chờ required checks là cấu hình thủ công. Xem
[CI/CD](../thien-duc-website-docs/07-deployment/ci-cd.md).

## Deployment / Handover

- URL chính: `https://www.thienduccons.vn/admin`.
- URL chẩn đoán trực tiếp: `https://thien-duc-website-admin.vercel.app/admin/`.
- Vercel: Framework Vite, root `./`, install `npm ci`, build `npm run build`,
  output `dist`.
- Production cần `VITE_API_URL`; nên có `VITE_SITE_URL`; Sentry/source map tùy chọn.
- Sau deploy kiểm tra `/admin`, hard refresh `/admin/dang-nhap`, đăng nhập,
  request API và MIME của `/admin/assets/*.js`.

Quy trình deploy, rollback, env và checklist bàn giao nằm trong
[tài liệu triển khai](../thien-duc-website-docs/07-deployment/deployment-guide.md)
và [checklist bàn giao](../thien-duc-website-docs/09-handover/handover-checklist.md).
