import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
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
