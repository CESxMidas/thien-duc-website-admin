/**
 * Ảnh dự án lưu trong DB dưới dạng đường dẫn tương đối của website công khai
 * (`/images/projects/...`). Admin CMS chạy ở origin khác nên các đường dẫn đó
 * trỏ vào chính nó và luôn 404 — ảnh xem trước hiện ra trống.
 *
 * `VITE_SITE_URL` (ví dụ `https://thienduc.vn`) là gốc để ghép. Chưa đặt thì trả
 * nguyên đường dẫn: ảnh có thể hỏng nhưng URL vẫn hiện để biên tập viên đối chiếu.
 */
const SITE_URL = (import.meta.env.VITE_SITE_URL ?? "").replace(/\/$/, "");

export function resolveAssetUrl(url: string): string {
  // URL tuyệt đối (Cloudinary, CDN) dùng nguyên trạng.
  if (/^https?:\/\//i.test(url)) return url;
  if (!SITE_URL || !url.startsWith("/")) return url;
  return `${SITE_URL}${url}`;
}
