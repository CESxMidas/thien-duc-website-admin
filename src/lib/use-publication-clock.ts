import { useEffect, useState } from "react";

/** Cập nhật đúng mốc lịch gần nhất và khi quay lại tab, không cần người dùng tải lại. */
export function usePublicationClock(
  schedules: readonly (string | null | undefined)[],
) {
  const [now, setNow] = useState(() => new Date());
  const next = Math.min(
    now.getTime() + 60_000,
    ...schedules
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter((value) => Number.isFinite(value) && value > now.getTime()),
  );

  useEffect(() => {
    const refresh = () => setNow(new Date());
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const timer = window.setTimeout(refresh, Math.max(1, next - Date.now()));
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [next]);

  return now;
}
