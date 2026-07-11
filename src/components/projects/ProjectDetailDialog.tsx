// Modal chi tiết dự án — mở khi bấm vào một hàng ở trang Dự án.
//
// Ba tab: Thông tin (trường cơ bản + luồng duyệt), Hình ảnh (thư viện ảnh),
// Hạng mục (các dự án con). Dữ liệu lấy từ GET /projects/:slug, chỉ gọi khi modal
// đang mở — danh sách ngoài trang không kèm ảnh nên phải nạp riêng.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageOff, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailList } from "@/components/ui/DetailDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { ProjectContentTab } from "@/components/projects/ProjectContentTab";
import { ProjectGalleryTab } from "@/components/projects/ProjectGalleryTab";
import { ProjectItemsTab } from "@/components/projects/ProjectItemsTab";
import { useAuth } from "@/context/AuthContext";
import { useProject, useUpdateProjectStatus } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
  projectStatusLabel,
} from "@/lib/labels";
import type { ContentStatus, ProjectDetail } from "@/types";

type TabValue = "info" | "content" | "gallery" | "items";

/** Các bước duyệt hợp lệ từ trạng thái hiện tại (ED-03: nháp → chờ duyệt → đã đăng). */
const STATUS_ACTIONS: Record<
  ContentStatus,
  { to: ContentStatus; label: string; variant?: "outline" }[]
> = {
  DRAFT: [{ to: "PENDING", label: "Gửi duyệt" }],
  PENDING: [
    { to: "PUBLISHED", label: "Duyệt & đăng" },
    { to: "DRAFT", label: "Trả về nháp", variant: "outline" },
  ],
  PUBLISHED: [{ to: "DRAFT", label: "Gỡ xuống, về nháp", variant: "outline" }],
};

export function ProjectDetailDialog({
  slug,
  open,
  onOpenChange,
}: {
  slug: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: project, isLoading, isError } = useProject(open ? slug : null);
  const [tab, setTab] = useState<TabValue>("info");

  // Mở dự án khác phải bắt đầu lại từ tab Thông tin.
  useEffect(() => {
    if (open) setTab("info");
  }, [open, slug]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            {project?.title.vi ?? "Chi tiết dự án"}
          </DialogTitle>
          <DialogDescription>
            {project ? `/${project.slug}` : "Đang tải dữ liệu dự án…"}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-cream" />
            ))}
          </div>
        ) : isError || !project ? (
          <p className="py-4 text-sm text-slate">
            Không tải được dữ liệu dự án. Đóng và thử lại.
          </p>
        ) : (
          <Tabs<TabValue>
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "info", label: "Thông tin" },
              { value: "content", label: "Nội dung" },
              {
                value: "gallery",
                label: "Hình ảnh",
                count: project.galleryImages.length,
              },
              { value: "items", label: "Hạng mục", count: project.items.length },
            ]}
          >
            {tab === "info" && <InfoTab project={project} />}
            {tab === "content" && <ProjectContentTab project={project} />}
            {tab === "gallery" && <ProjectGalleryTab project={project} />}
            {tab === "items" && <ProjectItemsTab project={project} />}
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InfoTab({ project }: { project: ProjectDetail }) {
  const { user } = useAuth();
  const updateStatus = useUpdateProjectStatus();

  // Duyệt/gỡ nội dung là quyền ADMIN trở lên (backend cũng chặn).
  const canApprove = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";
  const actions = STATUS_ACTIONS[project.contentStatus];

  async function onChangeStatus(to: ContentStatus) {
    try {
      await updateStatus.mutateAsync({ slug: project.slug, status: to });
      toast.success(`Đã chuyển sang "${contentStatusLabel[to]}".`);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không đổi được trạng thái. Vui lòng thử lại."),
      );
    }
  }

  return (
    <div className="space-y-4">
      {project.image ? (
        <img
          src={resolveAssetUrl(project.image)}
          alt={`Ảnh đại diện ${project.title.vi}`}
          className="aspect-3/2 w-full rounded-xl border border-line bg-cream object-cover"
        />
      ) : (
        <div className="grid aspect-3/2 w-full place-items-center rounded-xl border border-dashed border-line bg-cream/40 text-slate/60">
          <div className="flex flex-col items-center gap-1 text-sm">
            <ImageOff className="size-6" aria-hidden />
            Chưa có ảnh đại diện — thêm ở nút “Sửa”.
          </div>
        </div>
      )}

      <DetailList
        fields={[
          { label: "Vị trí", value: project.location ?? "—" },
          { label: "Phân loại", value: project.category ?? "—" },
          { label: "Tình trạng", value: projectStatusLabel[project.status] },
          {
            label: "Trạng thái nội dung",
            value: (
              <Badge variant={contentStatusTone[project.contentStatus]}>
                {contentStatusLabel[project.contentStatus]}
              </Badge>
            ),
          },
          { label: "Mô tả ngắn", value: project.summary.vi, block: true },
          ...(project.description?.vi
            ? [
                {
                  label: "Mô tả chi tiết",
                  value: project.description.vi,
                  block: true,
                },
              ]
            : []),
          { label: "Ngày tạo", value: formatDateTime(project.createdAt) },
          {
            label: "Cập nhật gần nhất",
            value: formatDateTime(project.updatedAt),
          },
        ]}
      />

      {canApprove && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          {actions.map((action) => (
            <Button
              key={action.to}
              variant={action.variant}
              disabled={updateStatus.isPending}
              onClick={() => void onChangeStatus(action.to)}
            >
              {updateStatus.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
