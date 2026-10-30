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
  bulkDeleteRecords,
  type BulkDeleteResult,
  type CmsDeleteTarget,
  type CmsRecordKind,
} from "@/lib/api/cms-trash";
import { canDeleteContent } from "@/lib/delete-permissions";
import { resolveApiError } from "@/lib/api-error-message";
import { usePresence } from "@/lib/use-presence";

type Props = {
  kind: CmsRecordKind;
  id: string;
  title: string;
  onDeleted?: (deletedIds: string[]) => void;
  permanentOnly?: boolean;
  records?: CmsDeleteTarget[];
  label?: string;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
};
export function DeleteContentButton(props: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<CmsDeleteTarget[] | undefined>();
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
        disabled={props.disabled}
        aria-label={`Xóa ${props.title}`}
        onClick={() => {
          setTargets(props.records?.map((record) => ({ ...record })));
          setOpen(true);
        }}
      >
        <Trash2 className="size-4" />
        {props.label ?? "Xóa"}
      </Button>
      {presence.mounted && (
        <DeleteConfirmation
          {...props}
          records={targets}
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
  records,
  onPendingChange,
}: Props & { onClose: () => void; open: boolean }) {
  const client = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [permanent, setPermanent] = useState(permanentOnly === true);
  const [acknowledged, setAcknowledged] = useState(false);
  const [remaining, setRemaining] = useState(records ?? []);
  const [failures, setFailures] = useState<BulkDeleteResult["failed"]>([]);
  useEffect(() => {
    if (open) {
      setPermanent(permanentOnly === true);
      setAcknowledged(false);
      setError(null);
      setRemaining(records ?? []);
      setFailures([]);
    }
  }, [open, permanentOnly, records]);
  const mutation = useMutation({
    retry: false,
    mutationFn: async (): Promise<BulkDeleteResult> => {
      if (records)
        return bulkDeleteRecords(
          kind,
          remaining.map((record) => record.id),
          permanent,
        );
      if (permanent) await purgeRecord(kind, id);
      else await trashRecord(kind, id);
      return { succeededIds: [id], failed: [], remainingIds: [] };
    },
  });
  async function confirm() {
    setError(null);
    onPendingChange?.(true);
    try {
      const result = await mutation.mutateAsync();
      if (result.succeededIds.length) onDeleted?.(result.succeededIds);
      if (result.failed.length || result.remainingIds.length) {
        const unresolved = new Set([
          ...result.failed.map((item) => item.id),
          ...result.remainingIds,
        ]);
        setRemaining((items) =>
          items.filter((item) => unresolved.has(item.id)),
        );
        setFailures(result.failed);
        setAcknowledged(false);
        const message = `Đã xử lý ${result.succeededIds.length} mục. Còn ${unresolved.size} mục chưa xóa được; chỉ các mục này được giữ lại để thử lại.`;
        setError(message);
        toast.error(message);
        await client.invalidateQueries();
        return;
      }
      await client.invalidateQueries();
      toast.success(
        records
          ? permanent
            ? `Đã xóa vĩnh viễn ${result.succeededIds.length} mục.`
            : `Đã chuyển ${result.succeededIds.length} mục vào thùng rác.`
          : permanent
          ? "Đã xóa vĩnh viễn nội dung."
          : "Đã chuyển nội dung vào thùng rác.",
      );
      onClose();
    } catch (err) {
      const message = resolveApiError(
        err,
        "Không xóa được nội dung. Vui lòng thử lại.",
      );
      setError(message);
      toast.error(message);
    } finally {
      onPendingChange?.(false);
    }
  }
  return (
    <ConfirmDialog
      open={open}
      size="wide"
      onOpenChange={(value) => {
        if (!value && !mutation.isPending) onClose();
      }}
      title={records ? `Xóa ${remaining.length} mục đã chọn?` : `Xóa ${title}?`}
      description={
        <div className="space-y-3">
          {records && (
            <div>
              <p className="font-medium text-ink">Các mục sẽ được xử lý:</p>
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-line p-3 text-sm">
                {remaining.map((record) => (
                  <li
                    key={record.id}
                    className="break-words py-1 [overflow-wrap:anywhere]"
                  >
                    {record.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          {failures.length > 0 && (
            <ul className="space-y-1 text-destructive">
              {failures.map((failure) => (
                <li key={failure.id}>
                  {remaining.find((record) => record.id === failure.id)
                    ?.title ?? "Nội dung"}
                  : {failure.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      }
      confirmLabel={permanent ? "Xóa vĩnh viễn" : "Chuyển vào thùng rác"}
      submitting={mutation.isPending}
      confirmDisabled={
        (permanent && !acknowledged) ||
        (records !== undefined && remaining.length === 0)
      }
      onConfirm={() => {
        if (!permanent || acknowledged) void confirm();
      }}
    />
  );
}
