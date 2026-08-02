import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Sentry from "@sentry/react";
import { Toaster } from "sonner";
// Inter tự host (không gọi Google Fonts): --font-sans trong index.css khai báo
// "Inter" nên phải nạp thật, nếu không trình duyệt lặng lẽ rơi về system-ui.
import "@fontsource-variable/inter/index.css";
// Be Vietnam Pro: font tiêu đề (--font-display trong index.css) — chỉ nạp hai
// weight dùng thật (600/700) kèm subset vietnamese để đủ dấu.
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./index.css";
import App from "./App.tsx";
import { CrashFallback } from "./components/crash-fallback.tsx";

// Sentry (task →5) — errors-only, thiếu VITE_SENTRY_DSN thì không init (app
// chạy bình thường). Không gửi PII; lỗi API vẫn hiện toast sonner như cũ,
// Sentry chỉ bắt lỗi render/runtime mà trước đây là trắng trang lặng lẽ.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0,
    sendDefaultPii: false,
    // Release do `vite.config.ts` chèn lúc build (backlog §6 "Sentry source map
    // upload"). PHẢI khớp release mà `@sentry/vite-plugin` gắn cho source map
    // đã upload — cả hai cùng gọi `resolveSentryRelease`, nên không thể lệch.
    // `null` (không suy được SHA) → bỏ hẳn field, KHÔNG bịa chuỗi.
    ...(__SENTRY_RELEASE__ ? { release: __SENTRY_RELEASE__ } : {}),
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<CrashFallback />}>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster position="top-right" richColors closeButton />
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
