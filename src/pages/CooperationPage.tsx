import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  CalendarX2,
  Handshake,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";

import { CooperationFormDialog } from "@/components/cooperation/CooperationFormDialog";
import { SchedulePublishDialog } from "@/components/content/SchedulePublishDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useAuth } from "@/context/AuthContext";
import {
  useCancelCooperationPublication,
  useCooperationProjects,
  useDeleteCooperationProject,
  useReorderCooperationProjects,
  useScheduleCooperationPublication,
  useUpdateCooperationStatus,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import { canEditCooperation } from "@/lib/content-editing";
import { contentStatusActions } from "@/lib/content-status-actions";
import {
  cooperationScheduleActions,
  deriveCooperationPublicationState,
  isActiveFutureCooperationSchedule,
} from "@/lib/cooperation-schedule";
import {
  contentStatusLabel,
  formatDateTime,
  publicationStateLabel,
  publicationStateTone,
} from "@/lib/labels";
import { formatVietnamDateTime } from "@/lib/vietnam-time";
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
  const schedulePublication = useScheduleCooperationPublication();
  const cancelPublication = useCancelCooperationPublication();
  const deleteProject = useDeleteCooperationProject();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<CooperationProject | null>(null);
  const [scheduleTarget, setScheduleTarget] =
    useState<CooperationProject | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Duyệt/đăng và xóa chỉ dành cho ADMIN trở lên (backend cũng chặn).
  const canManage = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  // Đồng hồ MÁY, chỉ để chọn nhãn và ẩn nút chắc chắn bị từ chối — backend mới
  // là nơi quyết định bản ghi có công khai hay không (xem `cooperation-schedule.ts`).
  const now = new Date();

  /**
   * `order` là thứ tự các thẻ chạy ở trang chủ, nên đổi thứ tự **là** đổi nội
   * dung công khai. Backend (Batch 10) chỉ cho biên tập viên sắp xếp khi MỌI bản
   * ghi còn trong khâu biên tập — lệnh reorder ghi lại `order` của cả danh sách
   * nên không thể xét riêng một hàng. Ẩn nút ở đây cho khớp, để không ai bấm vào
   * một thao tác chắc chắn trả 403; backend vẫn là nơi chốt.
   */
  const canReorder = projects.every((project) =>
    canEditCooperation(user?.role, project),
  );

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

  async function handleSchedule(scheduledAt: string) {
    if (!scheduleTarget) return;
    const isReschedule = isActiveFutureCooperationSchedule(scheduleTarget, now);
    setScheduleError(null);
    try {
      await schedulePublication.mutateAsync({
        id: scheduleTarget.id,
        scheduledAt,
      });
      toast.success(isReschedule ? "Đã đổi lịch đăng." : "Đã lên lịch đăng.");
      setScheduleTarget(null);
    } catch (error) {
      // Lỗi nghiệp vụ (400 quá gần/quá xa, 409 đã từng đăng) hiện NGAY trong
      // hộp thoại: người dùng còn nguyên giá trị vừa nhập để sửa lại.
      setScheduleError(resolveApiError(error, "Không đặt được lịch đăng."));
    }
  }

  /**
   * Huỷ lịch — KHÔNG hỏi lại. Quy ước hiện có của CMS: hộp thoại xác nhận chỉ
   * dành cho thao tác không hoàn tác được (xóa dự án); các thao tác đổi trạng
   * thái thực hiện thẳng. Huỷ lịch cùng loại với chúng — bản ghi về nháp và đặt
   * lại lịch được ngay.
   */
  async function handleCancelSchedule(project: CooperationProject) {
    setBusyId(project.id);
    try {
      await cancelPublication.mutateAsync(project.id);
      toast.success("Đã huỷ lịch đăng. Dự án hợp tác trở về nháp.");
    } catch (error) {
      toast.error(resolveApiError(error, "Không huỷ được lịch đăng."));
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
                disabled={index === 0 || busy || !canReorder}
                title={
                  canReorder
                    ? undefined
                    : "Danh sách có dự án đã đăng hoặc đã lên lịch — chỉ quản trị viên đổi được thứ tự."
                }
                onClick={() => void move(index, -1)}
                className="text-slate transition hover:text-brand disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Đưa xuống dưới"
                disabled={index === projects.length - 1 || busy || !canReorder}
                title={
                  canReorder
                    ? undefined
                    : "Danh sách có dự án đã đăng hoặc đã lên lịch — chỉ quản trị viên đổi được thứ tự."
                }
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
      // Huy hiệu XUẤT BẢN. Cột "Tiến độ" bên dưới là `status` (chữ mô tả) — hai
      // khái niệm khác nhau nên cố ý tách thành hai cột, không gộp một chỗ.
      key: "contentStatus",
      header: "Xuất bản",
      render: (project) => {
        const state = deriveCooperationPublicationState(project, now);
        const scheduledLabel = project.scheduledAt
          ? formatVietnamDateTime(project.scheduledAt)
          : null;
        return (
          <div className="grid gap-0.5">
            <Badge variant={publicationStateTone[state]}>
              {publicationStateLabel[state]}
            </Badge>
            {state === "SCHEDULED" && scheduledLabel ? (
              <p className="text-xs text-slate">{scheduledLabel}</p>
            ) : null}
          </div>
        );
      },
    },
    {
      // `status` = TIẾN ĐỘ dự án bằng chữ ("Đã bàn giao"). Không phải trạng thái
      // xuất bản — để cạnh nhau mà không nói rõ là mời gọi nhầm lẫn.
      key: "status",
      header: "Tiến độ",
      hideOnMobile: true,
      render: (project) => (
        <span className="text-sm text-slate">{project.status.vi}</span>
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
          {contentStatusActions(user?.role, project.contentStatus)
            // Ở trạng thái "Đã lên lịch", "Trả về nháp" và "Huỷ lịch" cho ra
            // CÙNG một kết quả (DRAFT, xoá cả hai mốc). Giữ lại nút nói đúng
            // việc đang làm; ở mọi trạng thái khác "Trả về nháp" vẫn như trước.
            .filter(
              (action) =>
                !(
                  deriveCooperationPublicationState(project, now) ===
                    "SCHEDULED" && action.intent === "revert"
                ),
            )
            .map((action) => (
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
                {/* Đang hẹn giờ: "Duyệt & đăng" thành "Đăng ngay" — vẫn đi qua
                    route `status` như cũ, backend chuyển mốc công khai về hiện
                    tại và xoá lịch. */}
                {deriveCooperationPublicationState(project, now) ===
                  "SCHEDULED" && action.intent === "approve"
                  ? "Đăng ngay"
                  : action.label}
              </Button>
            ))}

          {(() => {
            const schedule = cooperationScheduleActions(
              user?.role,
              project,
              now,
            );
            return (
              <>
                {(schedule.schedule || schedule.reschedule) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyId === project.id}
                    onClick={() => {
                      setScheduleError(null);
                      setScheduleTarget(project);
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
                    disabled={busyId === project.id}
                    onClick={() => void handleCancelSchedule(project)}
                  >
                    <CalendarX2 className="size-4" />
                    Huỷ lịch
                  </Button>
                )}
              </>
            );
          })()}

          {/* EDITOR mất quyền sửa từ lúc dự án hợp tác được hẹn giờ hoặc đã từng
              công khai — backend trả 403, nên không hiện nút. ADMIN trở lên giữ
              nguyên quyền sửa. */}
          {canEditCooperation(user?.role, project) && (
            <CooperationFormDialog
              project={project}
              trigger={
                <Button variant="ghost" size="sm" aria-label="Sửa dự án hợp tác">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
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

      {/* Dùng lại đúng hộp thoại của Tin tức/Dự án — cùng ràng buộc giờ Việt
          Nam, cùng hai ngưỡng 1 phút / 2 năm. Không dựng UI ngày giờ thứ hai. */}
      <SchedulePublishDialog
        open={scheduleTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleTarget(null);
            setScheduleError(null);
          }
        }}
        contentTitle={scheduleTarget?.name.vi ?? ""}
        currentScheduledAt={
          scheduleTarget &&
          isActiveFutureCooperationSchedule(scheduleTarget, now)
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
        title={`Xóa dự án hợp tác "${toDelete?.name.vi ?? ""}"?`}
        description="Thao tác không hoàn tác được."
        confirmLabel="Xóa"
        submitting={deleteProject.isPending}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
}
