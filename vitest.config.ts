import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Harness test cho Admin CMS (SYS-P1-ADMIN-ROBUSTNESS). Tách khỏi vite.config.ts
// để không kéo plugin tailwind vào lúc chạy test (không cần CSS trong jsdom).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/test/**",
        "src/main.tsx",
        "src/vite-env.d.ts",
        "src/**/*.d.ts",
        "src/types/**",
      ],
      // Ngưỡng đặt DƯỚI baseline đo được (§16): lines 36.85 · funcs 40.84 ·
      // branch 68.26. Global cố tình thấp vì nhiều trang (Banners, Cooperation,
      // Dashboard, Profile...) chưa có unit test — chúng được phủ bởi E2E
      // Playwright. Các file tới hạn của luồng auth phủ 90-100% ở unit test
      // (Login/Forgot/Reset/AccountSetup/user-status), còn API client + route
      // protection được phủ end-to-end. Ngưỡng này chỉ để CHỐNG HỒI QUY.
      thresholds: {
        lines: 34,
        statements: 34,
        functions: 38,
        branches: 64,
      },
    },
  },
});
