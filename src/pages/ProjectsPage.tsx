import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CalendarX2,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import { SchedulePublishDialog } from "@/components/content/SchedulePublishDialog";
import { useAuth } from "@/context/AuthContext";
import {
  useCancelProjectPublication,
  useDeleteProject,
  useProjects,
  useScheduleProjectPublication,
  useUpdateProjectStatus,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { canEditProject } from "@/lib/content-editing";
import { contentStatusActions } from "@/lib/content-status-actions";
import {
  deriveProjectPublicationState,
  isActiveFutureProjectSchedule,
  projectScheduleActions,
} from "@/lib/project-schedule";
import type { PublicationState } from "@/lib/news-schedule";
import {
  formatDateTime,
  projectStatusLabel,
  publicationStateLabel,
  publicationStateTone,
} from "@/lib/labels";
import { formatVietnamDateTime } from "@/lib/vietnam-time";
import type { ContentStatus, Project } from "@/types";

/**
 * Bộ lọc theo trạng thái XUẤT BẢN suy ra — không phải theo `Project.status`
 * (tình trạng thi công). Hai khái niệm này ở dự án rất dễ lẫn, nên cột và chip
 * lọc của chúng được giữ tách bạch cả về nhãn lẫn về mã.
 *
 * "Đã lên lịch" gộp cả `SCHEDULED` lẫn `DUE` vì cả hai đều sinh ra từ một lịch
 * đăng — người dùng đi tìm "những dự án tôi đã hẹn giờ". Huy hiệu trên từng hàng
 * vẫn tách bạch hai trạng thái đó. Ngược lại "Chờ duyệt" CỐ Ý không gộp `DUE`:
 * một dự án đã tới hạn đang hiển thị công khai, xếp chung với hàng chờ duyệt là
 * nói sai sự thật.
 */
type ProjectFilter = "ALL" | "DRAFT" | "PENDING" | "SCHEDULED" | "PUBLISHED";

const filters: { value: ProjectFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "DRAFT", label: "Nháp" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "SCHEDULED", label: "Đã lên lịch" },
  { value: "PUBLISHED", label: "Đã đăng" },
];

function matchesFilter(
  state: PublicationState,
  filter: ProjectFilter,
): boolean {
  if (filter === "ALL") return true;
  if (filter === "SCHEDULED") return state === "SCHEDULED" || state === "DUE";
  return state === filter;
}

export function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const { user } = useAuth();
  const deleteProject = useDeleteProject();
  const updateStatus = useUpdateProjectStatus();
  const schedulePublication = useScheduleProjectPublication();
  const cancelPublication = useCancelProjectPublication();

  const [detailSlug, setDetailSlug] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<Project | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProjectFilter>("ALL");
  const [scheduleTarget, setScheduleTarget] = useState<Project | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Chỉ ADMIN trở lên xóa được dự án (backend cũng chặn).
  const canDelete = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  // Đồng hồ MÁY, chỉ để chọn nhãn và ẩn nút chắc chắn bị từ chối — backend mới
  // là nơi quyết định dự án có công khai hay không (xem `project-schedule.ts`).
  const now = new Date();

  async function changeStatus(project: Project, status: ContentStatus) {
    setBusySlug(project.slug);
    try {
      await updateStatus.mutateAsync({ slug: project.slug, status });
      toast.success(
        status === "PUBLISHED"
          ? "Đã đăng dự án."
          : status === "PENDING"
            ? "Đã gửi duyệt."
            : "Đã trả về nháp.",
      );
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được trạng thái."));
    } finally {
      setBusySlug(null);
    }
  }

  async function handleSchedule(scheduledAt: string) {
    if (!scheduleTarget) return;
    const isReschedule = isActiveFutureProjectSchedule(scheduleTarget, now);
    setScheduleError(null);
    try {
      await schedulePublication.mutateAsync({
        slug: scheduleTarget.slug,
        scheduledAt,
      });
      toast.success(isReschedule ? "Đã đổi lịch đăng." : "Đã lên lịch đăng.");
      setScheduleTarget(null);
    } catch (error) {
      // Lỗi nghiệp vụ (400 quá gần/quá xa, 409 dự án đã từng đăng) hiện NGAY
      // trong hộp thoại: người dùng còn nguyên giá trị vừa nhập để sửa lại.
      setScheduleError(resolveApiError(error, "Không đặt được lịch đăng."));
    }
  }

  /**
   * Huỷ lịch — KHÔNG hỏi lại. Quy ước hiện có của CMS: hộp thoại xác nhận chỉ
   * dành cho thao tác không hoàn tác được (xóa dự án, xóa ảnh); các thao tác đổi
   * trạng thái thực hiện thẳng. Huỷ lịch cùng loại với chúng — dự án về nháp và
   * đặt lại lịch được ngay.
   */
  async function handleCancelSchedule(project: Project) {
    setBusySlug(project.slug);
    try {
      await cancelPublication.mutateAsync(project.slug);
      toast.success("Đã huỷ lịch đăng. Dự án trở về nháp.");
    } catch (error) {
      toast.error(resolveApiError(error, "Không huỷ được lịch đăng."));
    } finally {
      setBusySlug(null);
    }
  }

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
      // TÌNH TRẠNG THI CÔNG — giữ nguyên, không dính dáng gì tới lịch đăng.
      key: "status",
      header: "Tình trạng",
      render: (p) => (
        <span className="text-sm">{projectStatusLabel[p.status]}</span>
      ),
    },
    {
      key: "contentStatus",
      header: "Trạng thái đăng",
      // Dòng phụ (mốc hẹn / ghi chú đồng bộ) cần xuống dòng được.
      cellClassName: "whitespace-normal",
      render: (p) => {
        const state = deriveProjectPublicationState(p, now);
        const scheduledLabel = p.scheduledAt
          ? formatVietnamDateTime(p.scheduledAt)
          : null;
        return (
          <div className="space-y-1">
            {/* Nhãn CHỮ là thứ mang thông tin; màu chỉ hỗ trợ. */}
            <Badge variant={publicationStateTone[state]}>
              {publicationStateLabel[state]}
            </Badge>
            {state === "SCHEDULED" && scheduledLabel ? (
              <p className="text-xs text-slate">{scheduledLabel}</p>
            ) : null}
            {state === "DUE" ? (
              // Không nói "chờ duyệt": theo vị từ hiển thị của backend, dự án
              // này ĐÃ ra công khai rồi, chỉ còn chờ reconciler ghi lại trạng thái.
              <p className="text-xs text-slate">
                Đã hiển thị công khai, đang chờ đồng bộ
              </p>
            ) : null}
          </div>
        );
      },
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
      render: (p) => {
        const busy = busySlug === p.slug;
        const state = deriveProjectPublicationState(p, now);
        const schedule = projectScheduleActions(user?.role, p, now);
        const statusActions = contentStatusActions(user?.role, p.contentStatus)
          // Ở trạng thái "Đã lên lịch", "Trả về nháp" và "Huỷ lịch" cho ra CÙNG
          // một kết quả (DRAFT, xoá cả hai mốc). Giữ lại nút nói đúng việc đang
          // làm; ở mọi trạng thái khác "Trả về nháp" vẫn nguyên như trước.
          .filter(
            (action) => !(state === "SCHEDULED" && action.intent === "revert"),
          );
        return (
          // stopPropagation: hàng đã bấm được để mở chi tiết — các nút thao tác
          // không được kích hoạt luôn cả modal.
          <div
            className="flex flex-wrap items-center justify-end gap-1 xl:flex-nowrap"
            onClick={(e) => e.stopPropagation()}
          >
            {busy && <Loader2 className="size-4 animate-spin text-slate" />}

            {statusActions.map((action) => (
              <Button
                key={action.to}
                // Thao tác chính (đăng/duyệt) là nút đậm; gửi duyệt/trả nháp là ghost.
                variant={
                  action.intent === "publish" || action.intent === "approve"
                    ? undefined
                    : "ghost"
                }
                size="sm"
                disabled={busy}
                onClick={() => void changeStatus(p, action.to)}
              >
                {(action.intent === "submit" ||
                  action.intent === "publish") && <Send className="size-4" />}
                {action.intent === "revert" && <Undo2 className="size-4" />}
                {/* Dự án đang hẹn giờ: "Duyệt & đăng" thành "Đăng ngay" — vẫn đi
                    qua route `status` như cũ, backend chuyển mốc công khai về
                    hiện tại và xoá lịch. */}
                {state === "SCHEDULED" && action.intent === "approve"
                  ? "Đăng ngay"
                  : action.label}
              </Button>
            ))}

            {(schedule.schedule || schedule.reschedule) && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setScheduleError(null);
                  setScheduleTarget(p);
                }}
              >
                <CalendarClock className="size-4" />
                {schedule.reschedule ? "Đổi lịch" : "Lên lịch"}
              </Button>
            )}

            {schedule.cancel && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void handleCancelSchedule(p)}
              >
                <CalendarX2 className="size-4" />
                Huỷ lịch
              </Button>
            )}

            {/* EDITOR mất quyền sửa từ lúc dự án được hẹn giờ hoặc đã từng công
                khai — backend trả 403, nên không hiện nút. */}
            {canEditProject(user?.role, p) && (
              <ProjectFormDialog
                project={p}
                trigger={
                  <Button variant="ghost" size="sm">
                    <Pencil className="size-4" />
                    Sửa
                  </Button>
                }
              />
            )}
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
        );
      },
    },
  ];

  const rows = projects.filter((p) =>
    matchesFilter(deriveProjectPublicationState(p, now), filter),
  );

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

      {/* Chip lọc theo cùng khuôn với màn Tin tức. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((option) => {
          const count = projects.filter((p) =>
            matchesFilter(deriveProjectPublicationState(p, now), option.value),
          ).length;
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line-strong bg-white text-slate hover:border-brand hover:text-brand"
              }`}
            >
              {option.label} ({count})
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        emptyText="Không có dự án nào ở trạng thái này."
        onRowClick={(p) => setDetailSlug(p.slug)}
      />

      <ProjectDetailDialog
        slug={detailSlug}
        open={detailSlug !== null}
        onOpenChange={(open) => !open && setDetailSlug(null)}
      />

      <SchedulePublishDialog
        open={scheduleTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleTarget(null);
            setScheduleError(null);
          }
        }}
        contentTitle={scheduleTarget?.title.vi ?? ""}
        currentScheduledAt={
          scheduleTarget && isActiveFutureProjectSchedule(scheduleTarget, now)
            ? scheduleTarget.scheduledAt
            : null
        }
        submitting={schedulePublication.isPending}
        errorMessage={scheduleError}
        onSubmit={(scheduledAt) => void handleSchedule(scheduledAt)}
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
