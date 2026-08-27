import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import path from "node:path";

import {
  resolveSentryPluginOptions,
  resolveSentryRelease,
  resolveSourcemapSetting,
} from "./src/lib/sentry-build";

/**
 * Upload source map lên Sentry (backlog §6 "Sentry source map upload").
 *
 * Không có source map thì stack trace production của Admin chỉ là tên hàm đã
 * minify — gần như vô dụng. `@sentry/vite-plugin` là tích hợp CHÍNH THỨC cho
 * Vite (tương đương `withSentryConfig` bên frontend Next.js).
 *
 * CỔNG BẬT: chỉ chạy khi có ĐỦ `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` +
 * `SENTRY_PROJECT`. Thiếu bất kỳ cái nào (máy dev, CI thường, `npm run build`
 * cục bộ) thì plugin **vắng mặt hoàn toàn** khỏi config — build vẫn xanh,
 * không gọi mạng. Token KHÔNG bao giờ nằm trong repo; chỉ đọc từ biến môi
 * trường của môi trường build. Logic cổng nằm ở `src/lib/sentry-build.ts` và
 * có test riêng.
 *
 * SOURCE MAP: chỉ sinh khi cổng bật, và sinh dạng `hidden` (không gắn
 * `//# sourceMappingURL=` vào bundle), rồi plugin xoá `.map` khỏi `dist/` sau
 * khi upload. `dist/` là thứ được deploy nên KHÔNG bao giờ phát source map
 * công khai.
 *
 * CHÍNH SÁCH KHI UPLOAD LỖI — **A: build ĐỔ**. Cố ý khác frontend, và đây là
 * khác biệt có lý do: `withSentryConfig` của Next chạy trên Vercel, nơi một bản
 * deploy đổ vì Sentry sẽ chặn cả một release vốn lành lặn. Admin build trong
 * CI/CD của chính ta, nơi cổng chỉ bật khi ta CHỦ ĐỘNG đặt đủ ba biến — lúc đó
 * upload hỏng nghĩa là release sắp lên production mà KHÔNG có source map dùng
 * được, tức "thành công giả". Thà đỏ ngay còn hơn phát hiện lúc đang đọc stack
 * trace vô nghĩa giữa sự cố. Khi cổng tắt thì không có gì để hỏng.
 */
const sentryPluginOptions = resolveSentryPluginOptions(process.env);
const sentryRelease = resolveSentryRelease(process.env);

/**
 * ĐƯỜNG DẪN CÔNG KHAI của Admin (Batch 15B).
 *
 * Admin lộ ra ở `https://www.thienduccons.vn/admin` — FE public (Next.js, Vercel
 * project KHÁC) rewrite `/admin/:path*` sang đây và GIỮ NGUYÊN tiền tố.
 *
 * `base` chỉ đổi **URL** trong bundle, KHÔNG đổi **vị trí file** trong `dist/`.
 * Nếu để `outDir` mặc định (`dist/`), file nằm ở `dist/assets/…` trong khi
 * trình duyệt xin `/admin/assets/…` → Vercel (phục vụ tĩnh thuần, không strip
 * base như `vite preview`) không thấy file → rơi vào SPA fallback → trả
 * `index.html` với `Content-Type: text/html` cho một request `.js` → trắng
 * trang. Vì vậy `outDir` phải là `dist/admin` để **đường dẫn file khớp đúng
 * đường dẫn URL**; khi đó Vercel tự phục vụ file thật trước khi xét rewrite.
 *
 * Dùng CHUNG cho dev và build (không phụ thuộc mode): dev server cũng chạy ở
 * `/admin/` nên lỗi liên quan tới base lộ ra ngay trên máy, không đợi tới
 * production. `import.meta.env.BASE_URL` là nguồn sự thật cho mã runtime
 * (xem `src/lib/base-path.ts`).
 */
const BASE_PATH = "/admin/";

/**
 * Dev server: `/admin` (KHÔNG có dấu `/` cuối) → 302 sang `/admin/`.
 *
 * Vite dev chỉ phục vụ nội dung cho đường dẫn nằm TRONG `base`; `/admin` trần
 * rơi ra ngoài nên nó trả trang cảnh báo "The server is configured with a public
 * base URL of /admin/". Điều đó **thật sự xảy ra khi dùng bình thường**: sau khi
 * đăng nhập, React Router (basename `/admin`) để thanh địa chỉ ở `/admin`, nên
 * bấm F5 ngay lúc đó là gặp trang cảnh báo thay vì app. E2E đã bắt đúng ca này
 * ("phiên đăng nhập được giữ qua reload").
 *
 * Production KHÔNG có vấn đề này — cả `vercel.json` của Admin lẫn `rewrites()`
 * của FE đều có rule riêng cho `/admin` trần. Middleware này chỉ để **dev khớp
 * với production**, thay vì để lệch rồi phải nhớ một ngoại lệ.
 */
function adminBaseRedirect(): PluginOption {
  const bare = BASE_PATH.replace(/\/$/, ""); // "/admin"
  return {
    name: "admin-base-redirect",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // So sánh trên pathname: `/admin?x=1` cũng phải được chuyển hướng.
        const [pathname, query] = (req.url ?? "").split("?");
        if (pathname === bare) {
          res.writeHead(302, {
            Location: query ? `${BASE_PATH}?${query}` : BASE_PATH,
          });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  base: BASE_PATH,
  plugins: [
    react(),
    tailwindcss(),
    adminBaseRedirect(),
    // Cổng tắt → mảng rỗng → plugin không tồn tại trong config.
    ...(sentryPluginOptions ? [sentryVitePlugin(sentryPluginOptions)] : []),
  ],
  define: {
    // Release của RUNTIME phải KHỚP release đã upload, nếu không source map
    // trên Sentry không map được lỗi nào. Cả hai cùng lấy từ
    // `resolveSentryRelease` nên không thể lệch. `null` khi không suy được →
    // `Sentry.init` bỏ qua field này (xem src/main.tsx).
    __SENTRY_RELEASE__: JSON.stringify(sentryRelease ?? null),
  },
  build: {
    sourcemap: resolveSourcemapSetting(process.env),
    // Phải KHỚP `base` ở trên — xem giải thích tại `BASE_PATH`. Vercel giữ
    // `outputDirectory` mặc định của preset Vite là `dist`, nên file thật sẽ
    // nằm đúng tại `/admin/*` trên URL.
    outDir: "dist/admin",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5174,
    // Cổng CỨNG: mặc định Vite thấy 5174 bận thì im lặng nhảy sang 5175, còn
    // Playwright/CI vẫn thăm dò 5174 → chờ mãi rồi báo timeout mà không nói vì
    // sao. Thà fail ngay với "port is already in use" còn hơn treo.
    strictPort: true,
  },
});
