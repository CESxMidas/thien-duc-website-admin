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
> token khi access token hết hạn và khôi phục phiên khi tải lại trang.
> **Toàn bộ trang dữ liệu (Dự án, Tin tức, Trang nội dung, Banner, Liên hệ, Thư
> viện ảnh, Tài khoản, Tổng quan) đã nối API thật — không còn mock data.**
> Tiến độ chi tiết: `thien-duc-website-docs/KE-HOACH-CODING.md`.
> Quy ước code dùng chung cho FE/BE/Admin: `../AGENTS.md`.

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
│  ├─ ui/          shadcn/ui: button, badge, card, input, label, textarea, table,
│  │               dialog, select, form, tabs + DataTable / PageHeader / StatCard
│  │               / DetailDialog (modal chi tiết) / ConfirmDialog
│  ├─ projects/    ProjectFormDialog, ProjectDetailDialog (3 tab), GalleryTab, ItemsTab
│  ├─ news/        NewsFormDialog
│  ├─ contact/     LeadDetailDialog (đổi trạng thái + ghi chú nội bộ)
│  ├─ users/       UserFormDialog, UserDetailDialog, DeactivateUserDialog
│  ├─ PasswordInput.tsx
│  └─ ProtectedRoute.tsx
├─ context/        AuthContext (JWT thật, ghi nhớ đăng nhập)
├─ lib/
│  ├─ api/client.ts   apiFetch() + tự refresh token, envelope {success,data}
│  ├─ api/queries.ts  Hook TanStack Query — đã nối API thật toàn bộ
│  ├─ api/*.ts        auth, projects, news, pages, banners, contact, media, users
│  ├─ api-error-message.ts / auth-error-message.ts   Dịch lỗi backend sang toast
│  ├─ asset-url.ts    Chuẩn hóa URL ảnh Cloudinary
│  ├─ jwt.ts          Decode payload access token
│  ├─ use-presence.ts Hiệu ứng mount/unmount cho dialog
│  ├─ utils.ts        cn() cho shadcn/ui
│  └─ labels.ts       Nhãn tiếng Việt cho enum + formatDateTime (giờ VN)
├─ pages/          Login, Dashboard, Projects, News, Pages, Banners,
│                  Contact (lead), Media, Users, Forbidden, NotFound
├─ types/          Kiểu khớp backend Prisma
├─ index.css       @theme thương hiệu + token shadcn/ui
└─ App.tsx         Router
```

## Quy ước khi thêm màn hình mới

1. Viết hàm gọi API ở `src/lib/api/<module>.ts` — luôn qua `apiFetch`, không
   `fetch` trần (mất tự động refresh token).
2. Bọc bằng hook TanStack Query ở `src/lib/api/queries.ts`; ghi dữ liệu dùng
   `useMutation` + `queryClient.invalidateQueries` (mẫu: `ProjectFormDialog`).
3. Form: React Hook Form + Zod resolver. Lỗi hiện bằng `sonner` toast, dịch qua
   `resolveApiError`.
4. Modal chi tiết dùng `DetailDialog`; xác nhận hành động nguy hiểm dùng
   `ConfirmDialog`.

## Màu thương hiệu

Khớp frontend (giữ nguyên): nâu đồng `#B06613`, nâu đậm `#7f4b0d`, vàng `#fdcd04`,
đen `#191919`, xám chữ `#59646a`, nền kem `#fff8ea` — khai báo `@theme` trong
`src/index.css`. Lưu ý: token `--color-gold` (vàng) và `--color-slate` (xám chữ)
được đặt tên riêng để không đè lên token ngữ nghĩa `accent`/`muted` của shadcn/ui.

Cùng bộ token này cũng đã khai báo ở `globals.css` của frontend public — hai bên
dùng chung tên (`text-brand`, `bg-gold`, `text-slate`…), không gõ mã hex trong
component.

**Viền focus** dùng nâu đồng chứ không dùng vàng: vàng trên nền trắng chỉ đạt
1.5:1, dưới ngưỡng 3:1 của WCAG 2.4.11. Nâu đồng đạt 4.42:1 trên trắng và
3.32:1 trên nền đen `#191919`, hợp lệ trên cả nền sáng lẫn tối.

## Font

Inter tự host qua `@fontsource-variable/inter` (import trong `src/main.tsx`),
không gọi Google Fonts. Family đăng ký tên **`Inter Variable`** — `--font-sans`
phải liệt kê đúng tên đó, nếu không trình duyệt lặng lẽ rơi về `system-ui`.

## Chế độ tối

Chưa có. Handoff spec không yêu cầu, không nơi nào gắn class `.dark`, markup
không dùng biến thể `dark:`. Muốn thêm: khai báo lại `@custom-variant dark`,
bộ token tối, một nút chuyển, và cho `body` đọc `var(--background)` thay vì
`var(--color-canvas)`.
