import { defineConfig } from "vite";
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
