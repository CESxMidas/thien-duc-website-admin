import { CmsSelectionList, CmsSelectionCheckbox } from "@/components/content/CmsSelectionList";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { DeleteContentButton } from "@/components/content/DeleteContentButton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import {
  cmsKinds,
  listTrash,
  restoreRecord,
  type CmsRecordKind,
} from "@/lib/api/cms-trash";
import { canDeleteContent } from "@/lib/delete-permissions";
import { resolveApiError } from "@/lib/api-error-message";
import { formatDateTime } from "@/lib/labels";

export function TrashPage() {
  const { user } = useAuth();
  const kinds = (Object.keys(cmsKinds) as CmsRecordKind[]).filter(() =>
    canDeleteContent(user),
  );
  const [selected, setSelected] = useState<CmsRecordKind>(
    kinds[0] ?? "projects",
  );
  const kind = kinds.includes(selected) ? selected : kinds[0];
  return (
    <div>
      <PageHeader
        title="Thùng rác"
        description="Khôi phục nội dung đã xóa. Nội dung xuất bản trở về nháp; banner, ảnh thư viện và tài khoản cần được bật lại sau khi kiểm tra."
      />
      {!kind ? (
        <p className="text-sm text-slate">
          Bạn chưa được cấp quyền xóa hoặc khôi phục. Liên hệ Super Admin để
          được cấp quyền.
        </p>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2" aria-label="Loại nội dung">
            {kinds.map((item) => (
              <Button
                key={item}
                variant={item === kind ? "default" : "outline"}
                className="min-h-11"
                aria-pressed={item === kind}
                onClick={() => setSelected(item)}
              >
                {cmsKinds[item].label}
              </Button>
            ))}
          </div>
          <TrashList key={kind} kind={kind} />
        </>
      )}
    </div>
  );
}

function TrashList({ kind }: { kind: CmsRecordKind }) {
  const [page, setPage] = useState(1);
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["cms-trash", kind, page],
    queryFn: () => listTrash(kind, page),
  });
  const restore = useMutation({
    mutationFn: (id: string) => restoreRecord(kind, id),
    onSuccess: () => client.invalidateQueries(),
  });
  async function handleRestore(id: string) {
    try {
      await restore.mutateAsync(id);
      toast.success(
        "Đã khôi phục nội dung. Hãy kiểm tra trước khi bật hoặc đăng lại.",
      );
    } catch (err) {
      toast.error(resolveApiError(err, "Không khôi phục được nội dung."));
    }
  }
  if (query.isPending) return <p role="status">Đang tải thùng rác...</p>;
  if (query.isError)
    return (
      <div>
        <p role="alert" className="mb-3 text-sm text-slate">
          Không tải được thùng rác. Quyền của bạn có thể đã thay đổi.
        </p>
        <Button variant="outline" onClick={() => void query.refetch()}>
          Thử lại
        </Button>
      </div>
    );
  return (
    <CmsSelectionList kind={kind} records={query.data.items} scope={String(page)} permanentOnly>
    <div className="rounded-xl border border-line bg-white">
      {!query.data.items.length ? (
        <p className="p-6 text-sm text-slate">
          Không có nội dung trong thùng rác.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {query.data.items.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 p-4"
            >
              <CmsSelectionCheckbox id={row.id} />
              <div className="min-w-0 flex-1">
                <p className="break-words text-sm font-medium text-ink [overflow-wrap:anywhere]">
                  {(typeof row.title === "string"
                    ? row.title
                    : row.title?.vi) || "Nội dung chưa đặt tên"}
                </p>
                <p className="mt-1 text-xs text-slate">
                  Đã xóa: {formatDateTime(row.deletedAt)}
                </p>
              </div>
              <DeleteContentButton
                kind={kind}
                id={row.id}
                title={
                  (typeof row.title === "string" ? row.title : row.title?.vi) ||
                  row.id
                }
                permanentOnly
              />
              <Button
                variant="outline"
                className="min-h-11"
                disabled={restore.isPending}
                onClick={() => void handleRestore(row.id)}
              >
                <RotateCcw className="size-4" />
                Khôi phục
              </Button>
            </li>
          ))}
        </ul>
      )}
      {query.data.total > 30 && (
        <div className="flex items-center justify-between gap-2 border-t border-line p-4">
          <Button
            variant="outline"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage((value) => value - 1)}
          >
            Trước
          </Button>
          <span className="text-sm text-slate">Trang {page}</span>
          <Button
            variant="outline"
            disabled={page * 30 >= query.data.total || query.isFetching}
            onClick={() => setPage((value) => value + 1)}
          >
            Sau
          </Button>
        </div>
      )}
    </div>
    </CmsSelectionList>
  );
}
