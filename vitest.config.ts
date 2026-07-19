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
  },
});
