# Thiên Đức — Admin CMS

Trang quản trị nội dung website Thiên Đức. Công nghệ đúng theo **mục 2.5 báo cáo phương án kỹ thuật**:

| Hạng mục    | Công nghệ                                     |
| ----------- | --------------------------------------------- |
| Framework   | Vite + React 19 + TypeScript                  |
| Giao diện   | shadcn/ui + Tailwind CSS v4                   |
| Lấy dữ liệu | TanStack Query                                |
| Form        | React Hook Form + Zod                         |
| Triển khai  | Vercel static — `admin.thienduc.vn` (dự kiến) |

> Trạng thái: **đăng nhập đã nối API thật** (`/auth/login`, `/auth/refresh`,
> `/auth/logout` của backend NestJS) — có bảo vệ route, phân quyền, tự làm mới
> token khi access token hết hạn và khôi phục phiên khi tải lại trang. Các trang
> dữ liệu (dự án, tin tức…) vẫn là **mock**; nối nốt ở Sprint 1–3
> (xem `thien-duc-website-docs/KE-HOACH-CODING.md`).

## Chạy local

```bash
npm install
cp .env.example .env    # sửa VITE_API_URL nếu cần
npm run dev             # http://localhost:5174
```

Đăng nhập: dùng tài khoản thật do backend cấp (cần chạy `thien-duc-website-backend`
và trỏ đúng `VITE_API_URL`).

## Lệnh

| Lệnh              | Việc                          |
| ----------------- | ----------------------------- |
| `npm run dev`     | Dev server (port 5174)        |
| `npm run build`   | Type-check + build production |
| `npm run preview` | Xem thử bản build             |
| `npm run lint`    | ESLint                        |

## Cấu trúc

```
src/
├─ components/
│  ├─ layout/      Sidebar, Topbar, AdminLayout, nav config
│  ├─ ui/          shadcn/ui: button, badge, card, input, label, textarea,
│  │               table, dialog, select, form  + DataTable/PageHeader/StatCard
│  ├─ projects/    ProjectFormDialog (React Hook Form + Zod)
│  └─ ProtectedRoute.tsx
├─ context/        AuthContext (đăng nhập giả lập)
├─ data/mock.ts    Dữ liệu mẫu (thay bằng API khi nối backend)
├─ lib/
│  ├─ api/client.ts   apiFetch() + xử lý token, response chuẩn {success,data}
│  ├─ api/queries.ts  Hook TanStack Query (useProjects, useNews, useLeads…)
│  ├─ utils.ts        cn() cho shadcn/ui
│  └─ labels.ts       Nhãn tiếng Việt cho enum + formatDateTime (giờ VN)
├─ pages/          Login, Dashboard, Projects, News, Pages, Banners,
│                  Contact (lead), Media, Users, NotFound
├─ types/          Kiểu khớp backend Prisma
├─ index.css       @theme thương hiệu + token shadcn/ui
└─ App.tsx         Router
```

## Nối API thật (bước tiếp theo)

1. Đặt `VITE_API_URL` trỏ tới backend (mặc định `http://localhost:3001/api`).
2. ~~Đăng nhập~~ **Đã xong**: `AuthContext` + `lib/api/auth.ts` gọi `/auth/login`,
   `/auth/refresh`, `/auth/logout`; `apiFetch` tự làm mới token khi gặp 401.
3. Trong `src/lib/api/queries.ts`, đổi thân `queryFn` từ `mockAsync(...)` sang
   `apiFetch('/projects')`, `/news`, `/contact`… (giữ nguyên `queryKey` + component).
4. Form ghi dữ liệu: dùng `useMutation` gọi `apiFetch(..., { method: 'POST' })`
   rồi `queryClient.invalidateQueries` (xem mẫu trong `ProjectFormDialog`).

## Màu thương hiệu

Khớp frontend (giữ nguyên): nâu đồng `#B06613`, nâu đậm `#7f4b0d`, vàng `#fdcd04`,
đen `#191919`, xám chữ `#59646a`, nền kem `#fff8ea` — khai báo `@theme` trong
`src/index.css`. Lưu ý: token `--color-gold` (vàng) và `--color-slate` (xám chữ)
được đặt tên riêng để không đè lên token ngữ nghĩa `accent`/`muted` của shadcn/ui.
