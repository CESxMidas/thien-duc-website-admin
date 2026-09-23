/**
 * Ảnh dự án lưu trong DB dưới dạng đường dẫn tương đối của website công khai
 * (`/images/projects/...`). Admin CMS chạy ở origin khác nên các đường dẫn đó
 * trỏ vào chính nó và luôn 404 — ảnh xem trước hiện ra trống.
 *
 * `VITE_SITE_URL` (ví dụ `https://thienduc.vn`) là gốc để ghép. Khi dev local
 * chưa đặt biến này, mặc định ghép sang frontend `http://localhost:3000` để
 * logo/ảnh public không bị trình duyệt hiểu nhầm là asset của admin port 5174.
 */
const configuredSiteUrl = (import.meta.env.VITE_SITE_URL ?? "").replace(
  /\/$/,
  "",
);
const SITE_URL =
  configuredSiteUrl || (import.meta.env.DEV ? "http://localhost:3000" : "");

export function resolveAssetUrl(url: string): string {
  // URL tuyệt đối (Cloudinary, CDN) dùng nguyên trạng.
  if (/^(https?:|data:|blob:)/i.test(url)) return url;
  if (!SITE_URL || !url.startsWith("/")) return url;
  return `${SITE_URL}${url}`;
}
