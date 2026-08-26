# Admin CMS — Thiên Đức

Quy ước dùng chung cho cả frontend, admin và backend nằm ở `../AGENTS.md` — đọc
file đó trước (response envelope, token màu, enum, quy trình lint/build). Chỉ
thêm vào đây quy tắc riêng của Admin CMS.

File cha **chỉ tồn tại trong workspace nhiều repo**; clone riêng repo này sẽ
không có nó. Đó là trường hợp được hỗ trợ: mục dưới đây đủ để làm việc an toàn
với admin một mình, còn `../AGENTS.md` là phần bổ sung khi có.

@../AGENTS.md

## Quy tắc tối thiểu khi chỉ có repo này

- **Không tự ý `git commit` / `git push`** khi người dùng chưa yêu cầu.
- **Trước khi báo xong việc code**: `npm run lint`, `npm run test` (vitest) và
  `npm run build` (đã gồm `tsc -b`) phải chạy sạch lỗi. CI chạy lint,
  `test:coverage` và build.
- **`VITE_*` là cấu hình lộ ra trình duyệt** — không bao giờ đặt secret vào biến
  mang tiền tố đó. Ngữ nghĩa từng biến, kể cả base API, xem `.env.example`.
- **Chốt quyền nằm ở backend.** Các vị từ trong `src/lib/content-editing.ts` chỉ
  để không hiện nút chắc chắn nổ 403 — đó là UX, không phải hàng rào bảo mật.
