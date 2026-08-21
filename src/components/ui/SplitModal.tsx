// Khung modal chuẩn dùng chung cho toàn bộ Admin CMS Thiên Đức.
//
// Mục tiêu (theo yêu cầu chuẩn hóa UI/UX):
//  1. Một quy chuẩn giao diện duy nhất cho mọi modal (header · thân · footer).
//  2. Bố cục 2 cột "ảnh một bên · nội dung một bên" khi có `media` — người dùng
//     xem/sửa mà không phải lăn chuột.
//  3. Chống cuộn dọc: modal nở rộng theo cỡ (`size`) để nội dung vừa khung; chỉ
//     khi hiếm hoi tràn thì từng cột mới cuộn riêng, ảnh vẫn luôn nhìn thấy.
//
// Dùng `MediaSection` để dán nhãn phân cấp ảnh: "Ảnh chính" (cover) và
// "Ảnh con" (thư viện) — thống nhất giữa dự án và hạng mục.

import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Bề rộng tối đa theo lượng nội dung — modal nở ra để tránh cuộn dọc. */
const SIZE = {
  default: "sm:max-w-lg",
  wide: "sm:max-w-2xl",
  split: "sm:max-w-5xl",
  "split-lg": "sm:max-w-6xl",
} as const;

export type SplitModalSize = keyof typeof SIZE;

interface SplitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Phần tử mở modal (nút "Tạo…", "Sửa…"). Bỏ trống nếu điều khiển từ ngoài. */
  trigger?: ReactNode;
  /** Cột trái = khu vực ảnh. Có `media` ⇒ 2 cột; không có ⇒ 1 cột. */
  media?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Mặc định: có ảnh ⇒ "split", không ảnh ⇒ "wide". */
  size?: SplitModalSize;
}

export function SplitModal({
  open,
  onOpenChange,
  title,
  description,
  trigger,
  media,
  children,
  footer,
  size,
}: SplitModalProps) {
  const resolvedSize = size ?? (media ? "split" : "wide");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={cn(
          // p-0 + flex cột: header/footer cố định, thân ở giữa co giãn.
          "flex max-h-[92vh] flex-col gap-0 overflow-hidden p-0",
          SIZE[resolvedSize],
        )}
      >
        <DialogHeader className="shrink-0 border-b border-line bg-white px-6 py-4 pr-12 text-left">
          <DialogTitle className="font-display text-lg text-ink">
            {title}
          </DialogTitle>
          {description ? (
            <DialogDescription className="text-slate">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {media ? (
          // Cột ảnh hẹp hơn cột nội dung một chút — ảnh đủ lớn để quan sát mà
          // vẫn ưu tiên không gian cho các trường nhập.
          // Desktop: mỗi cột cuộn riêng (ảnh luôn thấy). Mobile: xếp dọc, cả
          // thân cuộn chung để tránh hai vùng cuộn lồng nhau.
          <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:overflow-hidden">
            <aside className="space-y-5 border-b border-line bg-cream/40 p-5 md:min-h-0 md:overflow-y-auto md:border-b-0 md:border-r">
              {media}
            </aside>
            <div className="p-6 md:min-h-0 md:overflow-y-auto">{children}</div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
        )}

        {footer ? (
          <DialogFooter className="shrink-0 border-t border-line bg-white px-6 py-4">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Một khối trong cột ảnh, có nhãn chữ hoa nhỏ. Dùng để phân biệt rõ
 * "Ảnh chính" và "Ảnh con" theo cùng một phong cách ở mọi modal.
 */
export function MediaSection({
  label,
  hint,
  count,
  action,
  children,
}: {
  label: string;
  hint?: ReactNode;
  count?: number;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-[0.14em] text-slate uppercase">
          {label}
          {/*
            KHÔNG mờ đi bằng `/60`: trên nền trắng nó cho tỉ lệ tương phản 2.59,
            dưới xa ngưỡng 4.5 của WCAG AA cho chữ thường. Kế thừa `text-slate`
            của <h3> (6.08) là đủ — số đếm đã tự tách khỏi nhãn nhờ dấu "·" và
            `font-weight` của nhãn.
          */}
          {typeof count === "number" ? (
            <span className="ml-1 tabular-nums">· {count}</span>
          ) : null}
        </h3>
        {action}
      </div>
      {/*
        `text-slate` đặc thay cho `text-slate/80`. Ở `text-xs` (12px, không đậm)
        WCAG AA đòi 4.5:1 — đây KHÔNG phải "chữ lớn" (ngưỡng 3:1 chỉ áp cho
        >=18pt, hoặc >=14pt in đậm). `/80` trộn ra #7a8388 trên nền trắng, chỉ
        đạt 3.87:1; bỏ độ mờ đưa về 6.08:1. Không đổi cỡ chữ, không đổi bảng màu.
      */}
      {hint ? <p className="text-xs leading-relaxed text-slate">{hint}</p> : null}
      {children}
    </section>
  );
}
