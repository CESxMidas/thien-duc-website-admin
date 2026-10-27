// Hỏi lại trước một thao tác không hoàn tác được (xóa dự án, hạng mục, ảnh).
// Trạng thái `submitting` do component cha giữ — nút xác nhận khóa trong lúc gọi API.

import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SplitModal } from "@/components/ui/SplitModal";
import type { SplitModalSize } from "@/components/ui/SplitModal";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Xóa",
  submitting = false,
  confirmDisabled = false,
  onConfirm,
  size = "default",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  submitting?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  size?: SplitModalSize;
}) {
  return (
    <SplitModal
      open={open}
      onOpenChange={onOpenChange}
      size={size}
      title={title}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={submitting || confirmDisabled}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm leading-relaxed text-slate">{description}</div>
    </SplitModal>
  );
}
