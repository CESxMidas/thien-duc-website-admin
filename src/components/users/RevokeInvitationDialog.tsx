import { useState } from "react";
import { toast } from "sonner";
import { Loader2, MailX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SplitModal } from "@/components/ui/SplitModal";
import { useRevokeUserInvitation } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import type { AdminUser } from "@/types";

/**
 * Xác nhận trước khi thu hồi lời mời — link thiết lập đã gửi sẽ hết hiệu lực
 * ngay. KHÔNG hiển thị token/link ở bất kỳ đâu (email là kênh gửi duy nhất).
 */
export function RevokeInvitationDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const revoke = useRevokeUserInvitation();
  const [submitting, setSubmitting] = useState(false);

  async function onConfirm() {
    if (!user) return;
    setSubmitting(true);
    try {
      await revoke.mutateAsync(user.id);
      toast.success("Đã thu hồi lời mời.");
      onOpenChange(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không thu hồi được lời mời. Vui lòng thử lại."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SplitModal
      open={open}
      onOpenChange={onOpenChange}
      size="default"
      title="Thu hồi lời mời này?"
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
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <MailX className="size-4" />
            )}
            Thu hồi lời mời
          </Button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-slate">
        Link thiết lập mật khẩu đã gửi tới {user?.email} sẽ hết hiệu lực ngay.
        Bạn có thể tạo lại lời mời sau nếu cần.
      </p>
    </SplitModal>
  );
}
