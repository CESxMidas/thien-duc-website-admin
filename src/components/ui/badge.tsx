import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// `transition-colors` CỐ Ý không có ở đây: huy hiệu trạng thái là nhãn tĩnh,
// không có state hover/focus nào đổi màu, nên hiệu ứng chuyển màu chỉ tạo ra
// khoảng thời gian màu bị nội suy — đúng thứ làm axe đo tương phản ra số khác
// nhau mỗi lần chạy. Nút và link vẫn giữ transition của riêng chúng.
const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 gap-1",
  {
    variants: {
      // Sắc thái trạng thái nội dung / lead. Tên biến thể giữ nguyên (là API đã
      // dùng khắp app qua `BadgeTone`), nhưng màu lấy từ token NGỮ NGHĨA
      // `--color-status-*` khai báo ở `src/index.css` — không còn gõ thẳng bảng
      // màu Tailwind ở component. Xem chú thích trong index.css cho tỉ lệ
      // tương phản của từng cặp.
      variant: {
        default: "border-transparent bg-brand text-white",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-white",
        outline: "text-ink border-line-strong",
        gray: "border-status-neutral-border bg-status-neutral-surface text-status-neutral-fg",
        amber:
          "border-status-warning-border bg-status-warning-surface text-status-warning-fg",
        green:
          "border-status-success-border bg-status-success-surface text-status-success-fg",
        blue: "border-status-info-border bg-status-info-surface text-status-info-fg",
        red: "border-status-danger-border bg-status-danger-surface text-status-danger-fg",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants };
