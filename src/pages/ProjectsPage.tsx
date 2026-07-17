import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import { useAuth } from "@/context/AuthContext";
import { useDeleteProject, useProjects } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
  projectStatusLabel,
} from "@/lib/labels";
import type { Project } from "@/types";

export function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const { user } = useAuth();
  const deleteProject = useDeleteProject();
  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);

  // Chỉ ADMIN trở lên xóa được dự án (backend cũng chặn).
  const canDelete = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  async function onConfirmDelete() {
    if (!toDelete) return;
    try {
      await deleteProject.mutateAsync(toDelete.slug);
      toast.success(`Đã xóa dự án "${toDelete.title.vi}".`);
      setToDelete(null);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không xóa được dự án. Vui lòng thử lại."),
      );
    }
  }

  const columns: Column<Project>[] = [
    {
      key: "title",
      header: "Dự án",
      render: (p) => (
        <div>
          <p className="font-medium text-ink">{p.title.vi}</p>
          <p className="text-xs text-slate">/{p.slug}</p>
        </div>
      ),
    },
    {
      key: "location",
      header: "Vị trí",
      hideOnMobile: true,
      // Địa chỉ đầy đủ dài hơn mọi cột khác — cho xuống dòng trong bề rộng trần,
      // cắt ở dòng thứ hai. `title` giữ lại toàn văn cho ai cần đọc đủ.
      cellClassName: "max-w-64 whitespace-normal",
      render: (p) => (
        <span
          className="line-clamp-2 text-slate"
          title={p.location?.vi ?? undefined}
        >
          {p.location?.vi ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Tình trạng",
      render: (p) => (
        <span className="text-sm">{projectStatusLabel[p.status]}</span>
      ),
    },
    {
      key: "contentStatus",
      header: "Trạng thái",
      render: (p) => (
        <Badge variant={contentStatusTone[p.contentStatus]}>
          {contentStatusLabel[p.contentStatus]}
        </Badge>
      ),
    },
    {
      key: "counts",
      header: "Hạng mục / Ảnh",
      hideOnMobile: true,
      render: (p) => (
        <span className="text-xs text-slate tabular-nums">
          {p.items.length} / {p._count.galleryImages}
        </span>
      ),
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      hideOnMobile: true,
      render: (p) => (
        <span className="text-xs text-slate">
          {formatDateTime(p.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      headerClassName: "text-right",
      render: (p) => (
        // stopPropagation: hàng đã bấm được để mở chi tiết — các nút thao tác
        // không được kích hoạt luôn cả modal.
        <div
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <ProjectFormDialog
            project={p}
            trigger={
              <Button variant="ghost" size="sm">
                <Pencil className="size-4" />
                Sửa
              </Button>
            }
          />
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              aria-label="Xóa dự án"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setToDelete(p)}
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
        title="Dự án"
        description="Quản lý dự án, hạng mục con và thư viện ảnh."
        actions={
          <ProjectFormDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Tạo dự án
              </Button>
            }
          />
        }
      />
      <DataTable
        columns={columns}
        rows={projects}
        loading={isLoading}
        emptyText="Chưa có dự án nào."
        onRowClick={(p) => setDetailSlug(p.slug)}
      />

      <ProjectDetailDialog
        slug={detailSlug}
        open={detailSlug !== null}
        onOpenChange={(open) => !open && setDetailSlug(null)}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Xóa dự án "${toDelete?.title.vi ?? ""}"?`}
        description="Toàn bộ hạng mục con và ảnh trong thư viện của dự án cũng bị xóa theo. Thao tác không hoàn tác được."
        confirmLabel="Xóa dự án"
        submitting={deleteProject.isPending}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
}
