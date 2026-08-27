import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * ADMIN-SPA-SECURITY-HEADERS-M1: Admin CMS (Vite static trên Vercel) phải kèm
 * các header bảo mật trình duyệt cơ bản như FE public. Test khóa cấu hình
 * `vercel.json` để không ai gỡ nhầm header hoặc mất SPA fallback.
 */
type VercelConfig = {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
  rewrites?: { source: string; destination: string }[];
  redirects?: { source: string; destination: string; permanent?: boolean }[];
};

function loadVercelConfig(): VercelConfig {
  // Vitest chạy với cwd = thư mục gốc của admin repo.
  const raw = readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf-8");
  return JSON.parse(raw) as VercelConfig;
}

describe("vercel.json — header bảo mật Admin SPA", () => {
  const config = loadVercelConfig();
  const rule = config.headers?.find((h) => h.source === "/(.*)");

  it("áp cho mọi route qua source /(.*)", () => {
    expect(rule).toBeDefined();
  });

  it("có đủ các header bảo mật với giá trị đúng", () => {
    const map = new Map(rule!.headers.map((h) => [h.key, h.value]));
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(map.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
    // Batch 15B: CMS không bao giờ được vào chỉ mục tìm kiếm. Lớp header này
    // song song với thẻ <meta name="robots"> trong index.html — bot chỉ đọc
    // header (hoặc xin file không phải HTML) vẫn nhận được tín hiệu.
    expect(map.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  /**
   * Batch 15B — Admin build với `base: '/admin/'` + `outDir: 'dist/admin'`, nên
   * file thật nằm ở `dist/admin/**` và URL công khai là `/admin/**`.
   *
   * Catch-all cũ (`/(.*)` → `/index.html`) không còn dùng được: `/index.html`
   * KHÔNG còn tồn tại (đã chuyển thành `/admin/index.html`), và một catch-all ở
   * gốc sẽ nuốt luôn cả request asset.
   */
  describe("SPA fallback dưới tiền tố /admin (Batch 15B)", () => {
    const rewrites = config.rewrites ?? [];

    it("deep link /admin/:path* trả về /admin/index.html", () => {
      expect(rewrites).toContainEqual({
        source: "/admin/:path*",
        destination: "/admin/index.html",
      });
    });

    it("/admin trần (không có dấu / cuối) cũng trả index.html", () => {
      expect(rewrites).toContainEqual({
        source: "/admin",
        destination: "/admin/index.html",
      });
    });

    it("KHÔNG còn catch-all ở gốc (sẽ nuốt cả asset)", () => {
      const rootCatchAll = rewrites.find((r) => r.source === "/(.*)");
      expect(rootCatchAll).toBeUndefined();
    });

    /**
     * Chốt an toàn quan trọng nhất của kiến trúc này: KHÔNG có rule nào trỏ
     * `/admin/assets/*` hay `/admin/images/*` về `index.html`.
     *
     * Vercel xét FILE TĨNH TRƯỚC rewrite, nên `/admin/assets/index-abc.js`
     * khớp file thật `dist/admin/assets/index-abc.js` và được phục vụ với
     * `Content-Type: text/javascript` — rule `/admin/:path*` ở trên không bao
     * giờ chạm tới nó. Đây chính là lý do `outDir` phải khớp `base`: nếu file
     * nằm ở `dist/assets` mà URL là `/admin/assets`, sẽ không có file nào khớp,
     * fallback nhảy vào và trả HTML cho request `.js` → trắng trang.
     */
    it("không có rule nào ép asset về index.html", () => {
      const assetRule = rewrites.find(
        (r) => r.source.includes("assets") || r.source.includes("images"),
      );
      expect(assetRule).toBeUndefined();
    });
  });

  /**
   * URL Vercel trực tiếp (`thien-duc-website-admin.vercel.app`) chỉ còn là kênh
   * CHẨN ĐOÁN khi proxy của FE public gặp sự cố. Gốc `/` không còn nội dung nên
   * đẩy về `/admin/` cho tiện. Không ảnh hưởng đường proxy: FE chỉ gọi
   * `/admin/*`, không bao giờ gọi `/`.
   */
  it("redirect gốc / về /admin/ (tạm thời, không permanent)", () => {
    const redirect = config.redirects?.find((r) => r.source === "/");
    expect(redirect).toBeDefined();
    expect(redirect!.destination).toBe("/admin/");
    // 307/308 tạm: không để trình duyệt cache vĩnh viễn một quyết định hạ tầng.
    expect(redirect!.permanent).toBe(false);
  });
});
