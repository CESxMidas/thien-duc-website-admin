import { DeleteContentButton } from "@/components/content/DeleteContentButton";
import { ContentOrderDialog } from "@/components/content/ContentOrderDialog";
import { useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  Loader2,
  Pencil,
  Plus,
  Send,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { RecruitmentPositionFormDialog } from "@/components/recruitment/RecruitmentPositionFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ContentListCell } from "@/components/ui/ContentListCell";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import {
  useRecruitmentPositions,
  useUpdateRecruitmentPosition,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { canEditPublishableContent } from "@/lib/content-editing";
import { contentStatusActions } from "@/lib/content-status-actions";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
} from "@/lib/labels";
import type { ContentStatus, RecruitmentPosition } from "@/types";

type StatusFilter = "ALL" | ContentStatus;

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả trạng thái" },
  { value: "DRAFT", label: contentStatusLabel.DRAFT },
  { value: "PENDING", label: contentStatusLabel.PENDING },
  { value: "PUBLISHED", label: contentStatusLabel.PUBLISHED },
];

function formatDeadline(deadline: string | null): string {
  if (!deadline) return "Chưa đặt hạn";
  const dateOnly = deadline.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly.split("-").reverse().join("/");
  }
  return new Date(deadline).toLocaleDateString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export function RecruitmentPositionsPage() {
  const { user } = useAuth();
  const { data: positions = [], isLoading } = useRecruitmentPositions();
  const updatePosition = useUpdateRecruitmentPosition();
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const visiblePositions = useMemo(
    () =>
      positions.filter(
        (position) => filter === "ALL" || position.status === filter,
      ),
    [filter, positions],
  );

  async function changeStatus(
    position: RecruitmentPosition,
    status: ContentStatus,
  ) {
    setBusyId(position.id);
    try {
      // Backend contract không có route trạng thái riêng: chỉ PATCH /:id.
      await updatePosition.mutateAsync({
        id: position.id,
        data: { status },
      });
      toast.success(`Đã chuyển sang "${contentStatusLabel[status]}".`);
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được trạng thái."));
    } finally {
      setBusyId(null);
    }
  }

  const columns: Column<RecruitmentPosition>[] = [
    {
      key: "order",
      header: "#",
      render: (position) => (
        <span className="text-sm text-slate">{position.order}</span>
      ),
    },
    {
      key: "title",
      header: "Vị trí",
      render: (position) => (
        <ContentListCell
          title={position.title.vi}
          fallbackIcon={BriefcaseBusiness}
          fallbackTitle="Vị trí tuyển dụng"
          metadata={`${position.department.vi} · ${position.location.vi}`}
          detail={position.type.vi}
        />
      ),
    },
    {
      key: "deadline",
      header: "Hạn hồ sơ",
      hideOnMobile: true,
      render: (position) => (
        <span className="text-xs text-slate">
          {formatDeadline(position.deadline)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (position) => (
        <Badge variant={contentStatusTone[position.status]}>
          {contentStatusLabel[position.status]}
        </Badge>
      ),
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      hideOnMobile: true,
      render: (position) => (
        <span className="text-xs text-slate">
          {formatDateTime(position.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      render: (position) => {
        const busy = busyId === position.id;
        const actions = contentStatusActions(user?.role, position.status);
        return (
          <div
            className="flex flex-wrap items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            {busy && <Loader2 className="size-4 animate-spin text-slate" />}
            {actions.map((action) => (
              <Button
                key={action.to}
                size="sm"
                variant={
                  action.intent === "publish" || action.intent === "approve"
                    ? undefined
                    : "ghost"
                }
                disabled={busy}
                onClick={() => void changeStatus(position, action.to)}
              >
                {action.intent === "revert" ? (
                  <Undo2 className="size-4" />
                ) : (
                  <Send className="size-4" />
                )}
                {action.label}
              </Button>
            ))}
            {canEditPublishableContent(user?.role, position.status) && (
              <RecruitmentPositionFormDialog
                position={position}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Sửa ${position.title.vi}`}
                  >
                    <Pencil className="size-4" />
                  </Button>
                }
              />
            )}
            <DeleteContentButton
              kind="recruitment"
              id={position.id}
              title={position.title.vi}
            />
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Vị trí tuyển dụng"
        description="Quản lý thông tin tuyển dụng và trạng thái hiển thị."
        actions={
          <div className="flex flex-wrap gap-2">
            <ContentOrderDialog
              collection="recruitment-positions"
              items={positions.map((item) => ({
                id: item.id,
                title: item.title.vi,
              }))}
              disabled={isLoading}
            />
            <RecruitmentPositionFormDialog
              trigger={
                <Button>
                  <Plus className="size-4" /> Thêm vị trí
                </Button>
              }
            />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate">{visiblePositions.length} vị trí</p>
        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as StatusFilter)}
        >
          <SelectTrigger className="w-full sm:w-52" aria-label="Lọc trạng thái">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={visiblePositions}
        loading={isLoading}
        emptyText={
          filter === "ALL"
            ? "Chưa có vị trí tuyển dụng."
            : "Không có vị trí ở trạng thái này."
        }
      />
    </div>
  );
}
