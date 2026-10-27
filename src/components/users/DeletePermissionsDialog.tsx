import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SplitModal } from "@/components/ui/SplitModal";
import { apiFetch } from "@/lib/api/client";
import { resolveApiError } from "@/lib/api-error-message";
import type { AdminUser } from "@/types";
import { usePresence } from "@/lib/use-presence";

export function DeletePermissionsDialog({ user }: { user: AdminUser }) {
  const [open, setOpen] = useState(false);
  const presence = usePresence(open, 180);
  if (user.role === "SUPER_ADMIN") return null;
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="min-h-11"
        onClick={() => setOpen(true)}
      >
        <ShieldCheck className="size-4" />
        Quyền xóa
      </Button>
      {presence.mounted && (
        <PermissionsEditor
          user={user}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function PermissionsEditor({
  user,
  onClose,
  open,
}: {
  user: AdminUser;
  onClose: () => void;
  open: boolean;
}) {
  const [selected, setSelected] = useState(user.canDeleteCms === true);
  const [error, setError] = useState<string | null>(null);
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(`/users/${user.id}/delete-permissions`, {
        method: "PATCH",
        body: JSON.stringify({ canDeleteCms: selected }),
      }),
  });
  const dirty = selected !== (user.canDeleteCms === true);
  async function save() {
    setError(null);
    try {
      await mutation.mutateAsync();
      await client.invalidateQueries({ queryKey: ["users"] });
      toast.success("Đã cập nhật quyền xóa.");
      onClose();
    } catch (err) {
      setError(resolveApiError(err, "Không cập nhật được quyền xóa."));
    }
  }
  return (
    <SplitModal
      open={open}
      onOpenChange={(value) => {
        if (!value && !mutation.isPending) onClose();
      }}
      size="default"
      title={`Quyền xóa của ${user.name}`}
      footer={
        <>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            disabled={mutation.isPending || !dirty}
            onClick={() => void save()}
          >
            {mutation.isPending ? "Đang lưu..." : "Lưu quyền xóa"}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm leading-6 text-slate">
        Quyền này cho phép đưa vào thùng rác, khôi phục và xóa vĩnh viễn trong
        toàn CMS. Thành viên không được cấp quyền cho người khác hoặc xóa Super
        Admin. Quyền truy cập và biên tập hiện có giữ nguyên.
      </p>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-line p-3">
        <input
          type="checkbox"
          className="size-4 accent-brand"
          disabled={mutation.isPending}
          checked={selected}
          onChange={(event) => setSelected(event.target.checked)}
        />
        <span className="text-sm font-medium">
          Cho phép xóa nội dung toàn CMS
        </span>
      </label>
      <p className="mt-3 text-sm text-slate">
        Bỏ chọn và lưu để thu hồi quyền. Quyền xóa được thu hồi ngay khi lưu.
      </p>
      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {error}
        </p>
      )}
    </SplitModal>
  );
}
