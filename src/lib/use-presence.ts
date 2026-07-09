import { useEffect, useState } from "react";

/**
 * Giữ phần tử trong DOM thêm một nhịp sau khi đóng, để animation thoát kịp chạy.
 *
 * `{open && <div/>}` chỉ có hiệu ứng lúc mở: khi đóng, React gỡ phần tử ngay và
 * không animation nào kịp diễn ra. Hook trả về `mounted` (còn render không) và
 * `state` để gắn vào `data-state` — khớp quy ước của Radix nên dùng chung được
 * các lớp `data-[state=closed]:animate-out` của tw-animate-css.
 *
 * `exitMs` phải bằng thời lượng animation thoát, nếu không phần tử sẽ biến mất
 * giữa chừng hoặc nán lại sau khi đã trong suốt.
 */
export function usePresence(open: boolean, exitMs = 150) {
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, exitMs]);

  return {
    mounted,
    state: open ? ("open" as const) : ("closed" as const),
  };
}
