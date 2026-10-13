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

export const legacyNewsImageFallback =
  "/images/news/legacy/tin-tuc-thien-duc-placeholder-01.jpg";

const legacyNewsImageMap: Record<string, string> = {
  "796930583506.jpg":
    "/images/news/2021/le-khoi-cong-fancy-tower-2021-04-07.jpg",
};

function legacyImageFileName(url: URL): string | undefined {
  if (
    !["thienduccons.vn", "www.thienduccons.vn"].includes(url.hostname) ||
    !url.pathname.startsWith("/img_data/images/")
  ) {
    return undefined;
  }

  return url.pathname.split("/").pop();
}

function resolveLegacyNewsImage(url: string): string {
  try {
    const parsed = new URL(url);
    const fileName = legacyImageFileName(parsed);

    if (fileName) {
      return legacyNewsImageMap[fileName] ?? legacyNewsImageFallback;
    }
  } catch {
    // Relative URLs are handled below.
  }

  return url;
}

export function resolveAssetUrl(url: string | null | undefined): string {
  if (!url?.trim()) return url ?? "";
  const resolvedUrl = resolveLegacyNewsImage(url);

  if (/^(https?:|data:|blob:)/i.test(resolvedUrl)) return resolvedUrl;
  if (!SITE_URL || !resolvedUrl.startsWith("/")) return resolvedUrl;
  return `${SITE_URL}${resolvedUrl}`;
}
