import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Handshake,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";

import { CooperationFormDialog } from "@/components/cooperation/CooperationFormDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useAuth } from "@/context/AuthContext";
import {
  useCooperationProjects,
  useDeleteCooperationProject,
  useReorderCooperationProjects,
  useUpdateCooperationStatus,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import { contentStatusActions } from "@/lib/content-status-actions";
import { contentStatusLabel, contentStatusTone, formatDateTime } from "@/lib/labels";
import type { ContentStatus, CooperationProject } from "@/types";

/** Đổi chỗ hai phần tử, trả mảng mới — không sửa mảng gốc của React Query. */
function swap(
  items: CooperationProject[],
  from: number,
  to: number,
): CooperationProject[] {
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function CooperationPage() {
  const { data: projects = [], isLoading } = useCooperationProjects();
  const { user } = useAuth();
  const reorder = useReorderCooperationProjects();
  const updateStatus = useUpdateCooperationStatus();
  const deleteProject = useDeleteCooperationProject();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CooperationProject | null>(null);

  // Duyệt/đăng và xóa chỉ dành cho ADMIN trở lên (backend cũng chặn).
  const canManage = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= projects.length) return;

    const ids = swap(projects, index, target).map((item) => item.id);
    setBusyId(projects[index].id);
    try {
      await reorder.mutateAsync(ids);
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được thứ tự."));
    } finally {
      setBusyId(null);
    }
  }

  // Thao tác trạng thái theo bậc thang DRAFT → PENDING → PUBLISHED, dùng chung
  // helper với Tin tức/Dự án/Trang. Nút và trạng thái đích do vai trò quyết định.
  async function changeStatus(project: CooperationProject, status: ContentStatus) {
    setBusyId(project.id);
    try {
      await updateStatus.mutateAsync({ id: project.id, status });
      toast.success(`Đã chuyển sang "${contentStatusLabel[status]}".`);
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được trạng thái."));
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmDelete() {
    if (!toDelete) return;
    try {
      await deleteProject.mutateAsync(toDelete.id);
      toast.success(`Đã xóa dự án hợp tác "${toDelete.name.vi}".`);
      setToDelete(null);
    } catch (error) {
      toast.error(resolveApiError(error, "Không xóa được. Vui lòng thử lại."));
    }
  }

  const columns: Column<CooperationProject>[] = [
    {
      key: "order",
      header: "#",
      render: (project) => {
        const index = projects.findIndex((item) => item.id === project.id);
        const busy = busyId === project.id;
        return (
          <div
            className="flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="w-5 text-slate">{index + 1}</span>
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Đưa lên trên"
                disabled={index === 0 || busy}
                onClick={() => void move(index, -1)}
                className="text-slate transition hover:text-brand disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Đưa xuống dưới"
                disabled={index === projects.length - 1 || busy}
                onClick={() => void move(index, 1)}
                className="text-slate transition hover:text-brand disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            {busy && <Loader2 className="size-3.5 animate-spin text-slate" />}
          </div>
        );
      },
    },
    {
      key: "name",
      header: "Dự án",
      render: (project) => (
        <div className="flex items-center gap-3">
          {project.image ? (
            <img
              src={resolveAssetUrl(project.image)}
              alt=""
              loading="lazy"
              className="size-11 shrink-0 rounded-lg border border-line bg-cream object-cover"
            />
          ) : (
            <div
              className="grid size-11 shrink-0 place-items-center rounded-lg bg-cream text-slate/50"
              title="Chưa có ảnh phối cảnh"
            >
              <Handshake className="size-5" aria-hidden />
            </div>
          )}
          <div className="min-w-0">
            <p className="font-medium text-ink">{project.name.vi}</p>
            <p className="text-xs text-slate">
              {project.location.vi} · {project.role.vi}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: "partner",
      header: "Đối tác",
      hideOnMobile: true,
      render: (project) => (
        <span className="text-sm text-slate">{project.partner.vi}</span>
      ),
    },
    {
      key: "contentStatus",
      header: "Trạng thái",
      render: (project) => (
        <Badge variant={contentStatusTone[project.contentStatus]}>
          {contentStatusLabel[project.contentStatus]}
        </Badge>
      ),
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      hideOnMobile: true,
      render: (project) => (
        <span className="text-xs text-slate">
          {formatDateTime(project.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      render: (project) => (
        <div
          className="flex justify-end gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          {busyId === project.id && (
            <Loader2 className="size-3.5 animate-spin text-slate" />
          )}
          {contentStatusActions(user?.role, project.contentStatus).map(
            (action) => (
              <Button
                key={action.to}
                // Đăng/duyệt là nút đậm; gửi duyệt/trả nháp là ghost.
                variant={
                  action.intent === "publish" || action.intent === "approve"
                    ? undefined
                    : "ghost"
                }
                size="sm"
                disabled={busyId === project.id}
                onClick={() => void changeStatus(project, action.to)}
              >
                {(action.intent === "submit" ||
                  action.intent === "publish") && <Send className="size-4" />}
                {action.intent === "revert" && <Undo2 className="size-4" />}
                {action.label}
              </Button>
            ),
          )}
          <CooperationFormDialog
            project={project}
            trigger={
              <Button variant="ghost" size="sm" aria-label="Sửa dự án hợp tác">
                <Pencil className="size-4" />
              </Button>
            }
          />
          {canManage && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Xóa dự án hợp tác"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setToDelete(project)}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Dự án hợp tác"
        description="Dự án đồng phát triển cùng đối tác, hiển thị ở trang chủ. Thứ tự trong bảng là thứ tự chạy trên slider."
        actions={
          <CooperationFormDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Thêm dự án hợp tác
              </Button>
            }
          />
        }
      />

      {!isLoading && projects.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-line bg-white px-6 py-16 text-center">
          <Handshake className="size-10 text-slate/40" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Chưa có dự án hợp tác nào
          </h2>
          <p className="mt-2 max-w-md text-sm text-slate">
            Section “Dự án hợp tác” trên trang chủ đang bị ẩn. Thêm ít nhất một
            dự án và đăng để nó hiển thị.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} rows={projects} loading={isLoading} />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Xóa dự án hợp tác "${toDelete?.name.vi ?? ""}"?`}
        description="Thao tác không hoàn tác được."
        confirmLabel="Xóa"
        submitting={deleteProject.isPending}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
}
