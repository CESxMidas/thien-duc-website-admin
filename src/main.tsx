import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  </StrictMode>,
);
