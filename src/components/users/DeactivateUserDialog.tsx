import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeactivateUser } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import type { AdminUser } from "@/types";

/**
 * Xác nhận trước khi khóa tài khoản — thao tác này đăng xuất người đó khỏi mọi
 * thiết bị ngay lập tức, nên không được để lỡ tay một cú nhấp.
 */
export function DeactivateUserDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const deactivate = useDeactivateUser();
  const [submitting, setSubmitting] = useState(false);

  async function onConfirm() {
    if (!user) return;
    setSubmitting(true);
    try {
      await deactivate.mutateAsync(user.id);
      toast.success(`Đã khóa tài khoản ${user.email}.`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không khóa được tài khoản. Vui lòng thử lại."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Khóa tài khoản này?</DialogTitle>
          <DialogDescription>
            {user?.name} ({user?.email}) sẽ bị đăng xuất khỏi mọi thiết bị và
            không đăng nhập lại được. Bạn có thể mở khóa bất cứ lúc nào.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
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
              <Lock className="size-4" />
            )}
            Khóa tài khoản
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
