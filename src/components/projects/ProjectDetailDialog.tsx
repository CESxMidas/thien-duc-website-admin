// Modal chi tiết dự án — mở khi bấm vào một hàng ở trang Dự án.
//
// Quy chuẩn modal 2 cột (SplitModal): CỘT ẢNH bên trái gom toàn bộ hình ảnh với
// phân cấp rõ ràng — "Ảnh chính" (cover, hiện ở list + đầu trang chi tiết) và
// "Ảnh con" (thư viện, quản lý thêm/sắp xếp/xóa). CỘT NỘI DUNG bên phải là các
// tab chữ: Thông tin · Nội dung · Hạng mục. Nhờ tách ảnh/chữ ra hai cột, người
// dùng xem và sửa mà không phải cuộn dọc.
//
// Dữ liệu lấy từ GET /projects/admin/:slug, chỉ gọi khi modal đang mở.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ImageOff, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailList } from "@/components/ui/DetailDialog";
import { MediaSection, SplitModal } from "@/components/ui/SplitModal";
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
  formatDateTime,
  projectStatusLabel,
  publicationStateLabel,
  publicationStateTone,
} from "@/lib/labels";
import { deriveProjectPublicationState } from "@/lib/project-schedule";
import { formatVietnamDateTime } from "@/lib/vietnam-time";
import { contentStatusActions } from "@/lib/content-status-actions";
import type { ContentStatus, ProjectDetail } from "@/types";

type TabValue = "info" | "content" | "items";

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

  const ready = !isLoading && !isError && project;

  return (
    <SplitModal
      open={open}
      onOpenChange={onOpenChange}
      size={ready ? "split-lg" : "wide"}
      title={project?.title.vi ?? "Chi tiết dự án"}
      description={project ? `/${project.slug}` : "Đang tải dữ liệu dự án…"}
      media={
        ready ? (
          <>
            <MediaSection
              label="Ảnh chính"
              hint="Ảnh đại diện — sửa ở nút “Sửa dự án”."
            >
              <CoverPreview project={project} />
            </MediaSection>
            <MediaSection
              label="Ảnh con · thư viện"
              count={project.galleryImages.length}
              hint="Ảnh phụ hiển thị ở trang chi tiết; có thể gắn vào từng hạng mục."
            >
              <ProjectGalleryTab project={project} />
            </MediaSection>
          </>
        ) : undefined
      }
    >
      {isLoading ? (
        <div className="space-y-3 py-2">
          {Array.from({ length: 6 }).map((_, i) => (
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
            { value: "items", label: "Hạng mục", count: project.items.length },
          ]}
        >
          {tab === "info" && <InfoTab project={project} />}
          {tab === "content" && <ProjectContentTab project={project} />}
          {tab === "items" && <ProjectItemsTab project={project} />}
        </Tabs>
      )}
    </SplitModal>
  );
}

/** Ảnh chính (cover) — chỉ xem trong modal chi tiết; sửa ở form "Sửa dự án". */
function CoverPreview({ project }: { project: ProjectDetail }) {
  if (!project.image) {
    return (
      <div className="grid aspect-3/2 w-full place-items-center rounded-xl border border-dashed border-line bg-white text-slate/60">
        <div className="flex flex-col items-center gap-1 text-sm">
          <ImageOff className="size-6" aria-hidden />
          Chưa có ảnh chính
        </div>
      </div>
    );
  }
  return (
    <img
      src={resolveAssetUrl(project.image)}
      alt={`Ảnh chính ${project.title.vi}`}
      className="aspect-3/2 w-full rounded-xl border border-line bg-white object-cover shadow-sm"
    />
  );
}

function InfoTab({ project }: { project: ProjectDetail }) {
  const { user } = useAuth();
  const updateStatus = useUpdateProjectStatus();

  // Thao tác trạng thái do helper dùng chung quyết định theo vai trò:
  // SUPER_ADMIN DRAFT → "Đăng ngay"; EDITOR DRAFT → "Gửi duyệt"; PENDING/PUBLISHED
  // chỉ ADMIN trở lên có nút. Ẩn cả cụm khi vai trò không có thao tác nào hợp lệ.
  const actions = contentStatusActions(user?.role, project.contentStatus);

  // Đồng hồ máy, chỉ để chọn nhãn hiển thị — backend mới quyết định dự án có
  // công khai hay không.
  const publicationState = deriveProjectPublicationState(project, new Date());

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
      <DetailList
        fields={[
          { label: "Vị trí", value: project.location?.vi ?? "—" },
          { label: "Phân loại", value: project.category?.vi ?? "—" },
          { label: "Tình trạng", value: projectStatusLabel[project.status] },
          {
            // Trạng thái XUẤT BẢN suy ra (gồm cả "Đã lên lịch" / "Đã đến giờ
            // đăng"), tách bạch với "Tình trạng" thi công ở dòng trên.
            label: "Trạng thái đăng",
            value: (
              <span className="flex flex-wrap items-center gap-2">
                <Badge variant={publicationStateTone[publicationState]}>
                  {publicationStateLabel[publicationState]}
                </Badge>
                {publicationState === "SCHEDULED" && project.scheduledAt ? (
                  <span className="text-xs text-slate">
                    {formatVietnamDateTime(project.scheduledAt)}
                  </span>
                ) : null}
              </span>
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

      {actions.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          {actions.map((action) => (
            <Button
              key={action.to}
              // Thao tác lùi trạng thái (trả về nháp) là nút viền; còn lại nút đậm.
              variant={action.intent === "revert" ? "outline" : undefined}
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
