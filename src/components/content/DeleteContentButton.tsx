import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  purgeRecord,
  trashRecord,
  type CmsRecordKind,
} from "@/lib/api/cms-trash";
import { canDeleteContent } from "@/lib/delete-permissions";
import { resolveApiError } from "@/lib/api-error-message";
import { usePresence } from "@/lib/use-presence";

type Props = {
  kind: CmsRecordKind;
  id: string;
  title: string;
  onDeleted?: () => void;
  permanentOnly?: boolean;
};
export function DeleteContentButton(props: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const presence = usePresence(open, 180);
  if (!canDeleteContent(user)) return null;
  return (
    <span
      className="inline-flex shrink-0"
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="min-h-11 text-destructive"
        aria-label={`Xóa ${props.title}`}
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
        Xóa
      </Button>
      {presence.mounted && (
        <DeleteConfirmation
          {...props}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </span>
  );
}

function DeleteConfirmation({
  kind,
  id,
  title,
  onDeleted,
  onClose,
  permanentOnly,
  open,
}: Props & { onClose: () => void; open: boolean }) {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [permanent, setPermanent] = useState(permanentOnly === true);
  const [acknowledged, setAcknowledged] = useState(false);
  useEffect(() => {
    if (open) {
      setPermanent(permanentOnly === true);
      setAcknowledged(false);
      setError(null);
    }
  }, [open, permanentOnly]);
  const mutation = useMutation({
    mutationFn: () =>
      permanent ? purgeRecord(kind, id) : trashRecord(kind, id),
  });
  async function confirm() {
    setError(null);
    try {
      await mutation.mutateAsync();
      await client.invalidateQueries();
      toast.success(
        permanent
          ? "Đã xóa vĩnh viễn nội dung."
          : "Đã chuyển nội dung vào thùng rác.",
      );
      onDeleted?.();
      onClose();
    } catch (err) {
      const message = resolveApiError(
        err,
        "Không xóa được nội dung. Vui lòng thử lại.",
      );
      setError(message);
      toast.error(message);
    }
  }
  return (
    <ConfirmDialog
      open={open}
      size="wide"
      onOpenChange={(value) => {
        if (!value && !mutation.isPending) onClose();
      }}
      title={`Xóa ${title}?`}
      description={
        <div className="space-y-3">
          {!permanentOnly && (
            <fieldset disabled={mutation.isPending} className="space-y-2">
              <legend className="mb-2 font-medium text-ink">
                Chọn cách xóa
              </legend>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="delete-mode"
                  checked={!permanent}
                  onChange={() => setPermanent(false)}
                  className="size-4 shrink-0 accent-brand"
                />
                Đưa vào thùng rác (có thể khôi phục)
              </label>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="radio"
                  name="delete-mode"
                  checked={permanent}
                  onChange={() => setPermanent(true)}
                  className="size-4 shrink-0 accent-brand"
                />
                Xóa vĩnh viễn (không thể khôi phục)
              </label>
            </fieldset>
          )}
          {permanent ? (
            <>
              <p className="text-pretty font-medium text-destructive">
                Xóa vĩnh viễn khỏi CMS. Không thể khôi phục.
              </p>
              <label className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  disabled={mutation.isPending}
                  onChange={(event) => setAcknowledged(event.target.checked)}
                  className="size-4 shrink-0 accent-brand"
                />
                Tôi hiểu và đồng ý xóa vĩnh viễn.
              </label>
            </>
          ) : (
            <p className="text-pretty">
              Nội dung ngừng hiển thị và có thể khôi phục trong mục Thùng rác.
            </p>
          )}
          {kind === "projects" && (
            <p>
              {permanent
                ? "Hạng mục và thư viện ảnh thuộc dự án cũng bị xóa vĩnh viễn."
                : "Các hạng mục và ảnh thuộc dự án cũng ngừng hiển thị theo dự án."}
            </p>
          )}
          {kind === "users" && (
            <p>
              Các phiên đăng nhập sẽ mất hiệu lực. Xóa vĩnh viễn cũng xóa lời
              mời và hồ sơ liên quan.
            </p>
          )}
          {kind === "media" && (
            <p>
              Xóa bản ghi khỏi thư viện CMS. Tệp nguồn đang được nội dung khác
              sử dụng được giữ lại.
            </p>
          )}
          {error && (
            <p role="alert" className="text-destructive">
              {error}
            </p>
          )}
        </div>
      }
      confirmLabel={permanent ? "Xóa vĩnh viễn" : "Chuyển vào thùng rác"}
      submitting={mutation.isPending}
      confirmDisabled={permanent && !acknowledged}
      onConfirm={() => {
        if (!permanent || acknowledged) void confirm();
      }}
    />
  );
}
