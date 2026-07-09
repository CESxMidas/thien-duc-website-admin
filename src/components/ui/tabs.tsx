// Tabs tối giản — đủ cho modal chi tiết dự án (Thông tin / Hình ảnh / Hạng mục).
// Tự dựng thay vì thêm @radix-ui/react-tabs: chỉ cần đổi panel tại chỗ, không có
// nhu cầu về orientation, activation tự động hay lồng nhau.
//
// Điều hướng bàn phím: mũi tên trái/phải chuyển tab, theo WAI-ARIA Tabs pattern.

import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TabDef<T extends string> {
  value: T;
  label: string;
  /** Con số phụ bên phải nhãn (số ảnh, số hạng mục). */
  count?: number;
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (value: T) => void;
  children: ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function onKeyDown(event: React.KeyboardEvent) {
    const delta =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();

    const index = tabs.findIndex((tab) => tab.value === value);
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onChange(next.value);
    // Tab mới phải nhận focus, nếu không mũi tên tiếp theo không tới được nó.
    listRef.current
      ?.querySelector<HTMLButtonElement>(`[data-value="${next.value}"]`)
      ?.focus();
  }

  return (
    // `min-w-0`: phần tử này là con của một lưới (DialogContent dùng `grid`), mà
    // con của lưới mặc định `min-width:auto` — nó không chịu co xuống dưới bề
    // rộng nội dung. Một dòng URL `truncate` (tức `white-space:nowrap`) vì thế
    // kéo giãn cả hộp thoại và sinh thanh cuộn ngang.
    <div className="min-w-0">
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-line"
      >
        {tabs.map((tab) => {
          const active = tab.value === value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              data-value={tab.value}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.value)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none",
                active
                  ? "border-brand text-ink"
                  : "border-transparent text-slate hover:text-ink",
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums transition-colors duration-150",
                    active ? "bg-brand/12 text-brand" : "bg-cream text-slate",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* `key` theo tab đang chọn: đổi tab thì panel dựng lại nên nội dung mới
          mờ dần vào thay vì thay thế đột ngột. Chỉ mờ, không trượt ngang —
          các tab là ngang hàng, không có chiều tiến/lùi để diễn tả. */}
      <div key={value} role="tabpanel" className="rise-in pt-4">
        {children}
      </div>
    </div>
  );
}
