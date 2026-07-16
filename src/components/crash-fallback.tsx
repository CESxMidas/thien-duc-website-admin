/**
 * UI dự phòng khi App crash (task →5) — hiển thị bởi Sentry.ErrorBoundary ở
 * main.tsx, thay cho màn hình trắng. Cùng tông màu admin (canvas/espresso).
 */
export function CrashFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas px-6 text-center">
      <h1 className="font-display text-xl font-bold text-ink">
        Trang quản trị gặp sự cố
      </h1>
      <p className="text-sm text-slate">
        Lỗi đã được ghi nhận. Vui lòng tải lại trang — nếu vẫn lỗi, báo đội kỹ
        thuật.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-md bg-espresso px-5 py-2 text-sm font-semibold text-white hover:bg-espresso-soft"
      >
        Tải lại trang
      </button>
    </div>
  );
}
