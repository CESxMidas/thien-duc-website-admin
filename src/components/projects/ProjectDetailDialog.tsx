// Modal chi tiết dự án — mở khi bấm vào một hàng ở trang Dự án.
//
// Quy chuẩn modal 2 cột (SplitModal): CỘT ẢNH bên trái gom toàn bộ hình ảnh với
// phân cấp rõ ràng — "Ảnh chính" (cover, hiện ở list + đầu trang chi tiết) và
// "Ảnh con" (thư viện, quản lý thêm/sắp xếp/xóa). CỘT NỘI DUNG bên phải là các
// tab chữ: Thông tin · Nội dung · Hạng mục. Nhờ tách ảnh/chữ ra hai cột, người
// dùng xem và sửa mà không phải cuộn dọc.
//
// Dữ liệu lấy từ GET /projects/admin/:slug, chỉ gọi khi modal đang mở.

import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ImageOff, Loader2, Pencil, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BilingualField } from "@/components/ui/BilingualField";
import { DetailList } from "@/components/ui/DetailDialog";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MediaSection, SplitModal } from "@/components/ui/SplitModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { ProjectContentTab } from "@/components/projects/ProjectContentTab";
import { ProjectGalleryTab } from "@/components/projects/ProjectGalleryTab";
import { ProjectItemsTab } from "@/components/projects/ProjectItemsTab";
import { useAuth } from "@/context/AuthContext";
import {
  useProject,
  useUpdateProject,
  useUpdateProjectItem,
  useUpdateProjectStatus,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  emptyBilingual,
  toBilingualLoose,
  toBilingualPayload,
  toBilingualValue,
  type BilingualValue,
} from "@/lib/bilingual";
import { canEditProject } from "@/lib/content-editing";
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
import type {
  ContentStatus,
  ProjectDetail,
  ProjectItem,
  ProjectStatus,
} from "@/types";

type TabValue = "project" | `item:${string}`;
const statusOptions = Object.keys(projectStatusLabel) as ProjectStatus[];
const INHERIT_STATUS = "__inherit__";
const SLUG_PATTERN = /^[a-z0-9-]+$/;

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
  const [tab, setTab] = useState<TabValue>("project");

  // Mở dự án khác phải bắt đầu lại từ tab Dự án.
  useEffect(() => {
    if (open) setTab("project");
  }, [open, slug]);

  const ready = !isLoading && !isError && project;
  const selectedItem =
    ready && tab.startsWith("item:")
      ? project.items.find((item) => `item:${item.slug}` === tab)
      : undefined;

  return (
    <SplitModal
      open={open}
      onOpenChange={onOpenChange}
      size="split-lg"
      stableDimensions
      title={project?.title.vi ?? "Chi tiết dự án"}
      description={project ? `/${project.slug}` : "Đang tải dữ liệu dự án"}
      media={
        ready ? (
          <>
            <MediaSection
              label={selectedItem ? "Ảnh chính hạng mục" : "Ảnh chính dự án"}
              hint={
                selectedItem
                  ? "Ảnh đại diện của hạng mục đang chọn."
                  : "Ảnh đại diện của dự án."
              }
            >
              <CoverPreview project={project} item={selectedItem} />
            </MediaSection>
            <MediaSection
              label={selectedItem ? "Ảnh của hạng mục" : "Ảnh chung dự án"}
              count={
                selectedItem
                  ? project.galleryImages.filter(
                      (image) => image.projectItemId === selectedItem.id,
                    ).length
                  : project.galleryImages.filter(
                      (image) => !image.projectItemId,
                    ).length
              }
              hint="Danh sách ảnh đổi theo tab đang chọn."
            >
              <EntityGalleryStrip project={project} item={selectedItem} />
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
            {
              value: "project",
              label: "Dự án",
              count: project.galleryImages.filter(
                (image) => !image.projectItemId,
              ).length,
            },
            ...project.items.map((item) => ({
              value: `item:${item.slug}` as TabValue,
              label: item.title.vi,
              count: project.galleryImages.filter(
                (image) => image.projectItemId === item.id,
              ).length,
            })),
          ]}
        >
          {tab === "project" ? (
            <ProjectWorkspace project={project} />
          ) : selectedItem ? (
            <ProjectItemWorkspace project={project} item={selectedItem} />
          ) : (
            <p className="text-sm text-slate">
              Không tìm thấy hạng mục. Hãy đóng modal và mở lại.
            </p>
          )}
        </Tabs>
      )}
    </SplitModal>
  );
}

function EntityGalleryStrip({
  project,
  item,
}: {
  project: ProjectDetail;
  item?: ProjectItem;
}) {
  const images = project.galleryImages.filter((image) =>
    item ? image.projectItemId === item.id : !image.projectItemId,
  );

  return (
    <div className="space-y-3">
      {images.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-white/70 px-3 py-5 text-center text-sm text-slate">
          Chưa có ảnh trong nhóm này.
        </p>
      ) : (
        <div className="flex snap-x gap-3 overflow-x-auto pb-2">
          {images.map((image) => (
            <img
              key={image.id}
              src={resolveAssetUrl(image.url)}
              alt={image.caption?.vi ?? item?.title.vi ?? project.title.vi}
              className="h-24 w-36 shrink-0 snap-start rounded-lg border border-line bg-white object-cover"
              loading="lazy"
            />
          ))}
        </div>
      )}
      <p className="text-xs leading-5 text-slate">
        Quản lý thêm, ẩn, hiện và gắn ảnh ở phần Hình ảnh trong tab Dự án.
      </p>
    </div>
  );
}

/** Ảnh chính (cover) — chỉ xem trong modal chi tiết; sửa ở form "Sửa dự án". */
function CoverPreview({
  project,
  item,
}: {
  project: ProjectDetail;
  item?: ProjectItem;
}) {
  const image = item?.image ?? project.image;
  const title = item?.title.vi ?? project.title.vi;

  if (!image) {
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
      src={resolveAssetUrl(image)}
      alt={`Ảnh chính ${title}`}
      className="aspect-3/2 w-full rounded-xl border border-line bg-white object-cover shadow-sm"
    />
  );
}

function ProjectWorkspace({ project }: { project: ProjectDetail }) {
  const [editing, setEditing] = useState(false);
  const [itemsOpen, setItemsOpen] = useState(false);

  useEffect(() => {
    setEditing(false);
    setItemsOpen(false);
  }, [project.id]);

  return (
    <div className="space-y-6">
      {editing ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
            <div>
              <p className="font-display text-sm font-semibold text-ink">
                Đang chỉnh sửa dự án
              </p>
              <p className="text-xs text-slate">
                Dự án đang ở chế độ chỉnh sửa.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditing(false)}
            >
              <X className="size-4" />
              Đóng chỉnh sửa
            </Button>
          </div>
          <ProjectGalleryTab project={project} projectOnly />
          <ProjectItemsLauncher
            project={project}
            open={itemsOpen}
            onOpenChange={setItemsOpen}
          />
          <InfoTab
            project={project}
            editing={editing}
            onEditingChange={setEditing}
            hideEditToggle
          />
          <ProjectContentTab project={project} />
        </>
      ) : (
        <>
          <InfoTab
            project={project}
            editing={editing}
            onEditingChange={setEditing}
          />
          <ProjectReadOnlyOverview project={project} />
        </>
      )}
    </div>
  );
}

function ProjectItemsLauncher({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const activeCount = project.items.filter(
    (item) => item.isActive !== false,
  ).length;
  const hiddenCount = project.items.length - activeCount;

  return (
    <>
      <section className="rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">
              Hạng mục dự án
            </h3>
            <p className="mt-1 text-xs text-slate">
              {project.items.length === 0
                ? "Chưa có hạng mục nào."
                : `${project.items.length} hạng mục, ${activeCount} đang hiện${
                    hiddenCount > 0 ? `, ${hiddenCount} đang ẩn` : ""
                  }.`}
            </p>
          </div>
          <Button type="button" onClick={() => onOpenChange(true)}>
            <Plus className="size-4" />
            Quản lý hạng mục
          </Button>
        </div>
      </section>

      <SplitModal
        open={open}
        onOpenChange={onOpenChange}
        title={`Hạng mục của ${project.title.vi}`}
        description="Thêm, sửa, ẩn hoặc hiện các hạng mục của dự án."
        size="split"
        stableDimensions
      >
        <ProjectItemsTab project={project} />
      </SplitModal>
    </>
  );
}

function ProjectReadOnlyOverview({ project }: { project: ProjectDetail }) {
  const projectImageCount = project.galleryImages.filter(
    (image) => !image.projectItemId,
  ).length;
  const itemImageCount = project.galleryImages.length - projectImageCount;

  return (
    <div className="space-y-4">
      <DetailList
        fields={[
          ...(project.description?.vi
            ? [
                {
                  label: "Nội dung chi tiết",
                  value: project.description.vi,
                  block: true,
                },
              ]
            : []),
          {
            label: "Thư viện ảnh",
            value: `${projectImageCount} ảnh chung, ${itemImageCount} ảnh theo hạng mục`,
          },
          {
            label: "Hạng mục",
            value: `${project.items.length} hạng mục`,
          },
          ...(project.highlights?.length
            ? [
                {
                  label: "Điểm nổi bật",
                  value: (
                    <ul className="list-disc space-y-1 pl-4">
                      {project.highlights.map((highlight, index) => (
                        <li key={index}>{highlight.vi}</li>
                      ))}
                    </ul>
                  ),
                  block: true,
                },
              ]
            : []),
        ]}
      />
      <p className="rounded-lg border border-dashed border-line bg-cream/40 px-3 py-3 text-sm text-slate">
        Bấm “Sửa thông tin” để mở các phần chỉnh sửa nội dung, hình ảnh và hạng
        mục.
      </p>
    </div>
  );
}

function ProjectItemWorkspace({
  project,
  item,
}: {
  project: ProjectDetail;
  item: ProjectItem;
}) {
  const { user } = useAuth();
  const updateItem = useUpdateProjectItem();
  const canEdit = canEditProject(user?.role, project);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState<BilingualValue>(emptyBilingual);
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState<BilingualValue>(emptyBilingual);
  const [description, setDescription] =
    useState<BilingualValue>(emptyBilingual);
  const [status, setStatus] = useState<string>(INHERIT_STATUS);
  const [image, setImage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(toBilingualValue(item.title));
    setSlug(item.slug);
    setSummary(toBilingualValue(item.summary));
    setDescription(toBilingualLoose(item.description));
    setStatus(item.status ?? INHERIT_STATUS);
    setImage(item.image ?? "");
    setError(null);
    setEditing(false);
  }, [item]);

  async function onSave(event: FormEvent) {
    event.preventDefault();

    if (title.vi.trim().length < 3) {
      setError("Tên hạng mục tối thiểu 3 ký tự.");
      return;
    }
    if (!SLUG_PATTERN.test(slug)) {
      setError("Slug chỉ gồm chữ thường, số và dấu gạch ngang.");
      return;
    }
    setError(null);

    try {
      await updateItem.mutateAsync({
        slug: project.slug,
        itemSlug: item.slug,
        data: {
          slug,
          title: toBilingualPayload(title),
          summary: toBilingualPayload(summary),
          description: toBilingualPayload(description),
          ...(status !== INHERIT_STATUS && {
            status: status as ProjectStatus,
          }),
          image: image.trim() || undefined,
        },
      });
      toast.success("Đã lưu hạng mục.");
      setEditing(false);
    } catch (err) {
      toast.error(
        resolveApiError(err, "Không lưu được hạng mục. Vui lòng thử lại."),
      );
    }
  }

  const effectiveStatus = item.status ?? project.status;
  const itemGalleryCount = project.galleryImages.filter(
    (imageItem) => imageItem.projectItemId === item.id,
  ).length;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">
              Nội dung hạng mục
            </h3>
            <p className="mt-1 text-xs text-slate">
              Dữ liệu, ảnh chính và thư viện bên trái đang theo hạng mục này.
            </p>
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant={editing ? "ghost" : "outline"}
              size="sm"
              onClick={() => setEditing(!editing)}
            >
              {editing ? (
                <X className="size-4" />
              ) : (
                <Pencil className="size-4" />
              )}
              {editing ? "Đóng chỉnh sửa" : "Sửa hạng mục"}
            </Button>
          ) : null}
        </div>

        {editing ? (
          <form onSubmit={onSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Ảnh chính của hạng mục</Label>
              <ImagePickerField
                value={image}
                onChange={setImage}
                folder="projects"
                aspect="3/2"
                alt="Ảnh chính hạng mục"
              />
              <p className="text-xs text-slate">
                Ảnh này thay đổi phần ảnh đại diện bên trái khi chọn tab hạng
                mục.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label>Tên hạng mục</Label>
              <BilingualField
                value={title}
                onChange={setTitle}
                placeholder={{
                  vi: "Fancy Tower",
                  en: "Fancy Tower",
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`item-slug-${item.id}`}>Slug</Label>
                <Input
                  id={`item-slug-${item.id}`}
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="fancy-tower"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tình trạng</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={INHERIT_STATUS}>
                      Theo dự án ({projectStatusLabel[project.status]})
                    </SelectItem>
                    {statusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {projectStatusLabel[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Mô tả ngắn</Label>
              <BilingualField
                multiline
                rows={3}
                value={summary}
                onChange={setSummary}
                placeholder={{
                  vi: "Một hai câu giới thiệu hạng mục.",
                  en: "One or two sentences for this item.",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Nội dung chi tiết</Label>
              <BilingualField
                multiline
                rows={5}
                value={description}
                onChange={setDescription}
                placeholder={{
                  vi: "Nội dung chi tiết của hạng mục.",
                  en: "Detailed content for this item.",
                }}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={updateItem.isPending}
                onClick={() => setEditing(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={updateItem.isPending}>
                {updateItem.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Lưu hạng mục
              </Button>
            </div>
          </form>
        ) : (
          <DetailList
            fields={[
              { label: "Tên hạng mục", value: item.title.vi },
              { label: "Slug", value: `/${project.slug}/${item.slug}` },
              {
                label: "Mô tả ngắn",
                value: item.summary?.vi ?? "Chưa có mô tả ngắn",
                block: true,
              },
              {
                label: "Tình trạng",
                value: item.status
                  ? projectStatusLabel[item.status]
                  : `Theo dự án (${projectStatusLabel[project.status]})`,
              },
              {
                label: "Ảnh thư viện",
                value: `${itemGalleryCount} ảnh của hạng mục`,
              },
            ]}
          />
        )}
      </section>

      {editing ? <ProjectGalleryTab project={project} item={item} /> : null}

      <DetailList
        fields={[
          {
            label: "Tình trạng hiển thị",
            value: (
              <Badge variant={item.isActive === false ? "gray" : "green"}>
                {item.isActive === false ? "Đang ẩn" : "Đang hiện"}
              </Badge>
            ),
          },
          {
            label: "Tình trạng áp dụng",
            value: projectStatusLabel[effectiveStatus],
          },
          ...(toBilingualLoose(item.description).vi
            ? [
                {
                  label: "Nội dung chi tiết",
                  value: toBilingualLoose(item.description).vi,
                  block: true,
                },
              ]
            : []),
          ...(item.highlights?.length
            ? [
                {
                  label: "Điểm nổi bật",
                  value: (
                    <ul className="list-disc space-y-1 pl-4">
                      {item.highlights.map((highlight, index) => (
                        <li key={index}>{toBilingualLoose(highlight).vi}</li>
                      ))}
                    </ul>
                  ),
                  block: true,
                },
              ]
            : []),
        ]}
      />
    </div>
  );
}

function InfoTab({
  project,
  editing: controlledEditing,
  onEditingChange,
  hideEditToggle = false,
}: {
  project: ProjectDetail;
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
  hideEditToggle?: boolean;
}) {
  const { user } = useAuth();
  const updateProject = useUpdateProject();
  const updateStatus = useUpdateProjectStatus();
  const canEdit = canEditProject(user?.role, project);
  const [localEditing, setLocalEditing] = useState(false);
  const [title, setTitle] = useState<BilingualValue>(emptyBilingual);
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState<BilingualValue>(emptyBilingual);
  const [location, setLocation] = useState<BilingualValue>(emptyBilingual);
  const [category, setCategory] = useState<BilingualValue>(emptyBilingual);
  const [status, setStatus] = useState<ProjectStatus>("CHUAN_BI_KHOI_CONG");
  const editing = controlledEditing ?? localEditing;
  const setEditing = onEditingChange ?? setLocalEditing;

  useEffect(() => {
    setTitle(toBilingualValue(project.title));
    setSlug(project.slug);
    setSummary(toBilingualValue(project.summary));
    setLocation(toBilingualValue(project.location));
    setCategory(toBilingualValue(project.category));
    setStatus(project.status);
    if (controlledEditing === undefined) setLocalEditing(false);
  }, [controlledEditing, project]);

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

  async function onSaveBasic(event: FormEvent) {
    event.preventDefault();

    if (title.vi.trim().length < 3) {
      toast.error("Tên dự án tối thiểu 3 ký tự.");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      toast.error("Slug chỉ gồm chữ thường, số và dấu gạch ngang.");
      return;
    }

    try {
      await updateProject.mutateAsync({
        slug: project.slug,
        data: {
          slug,
          title: toBilingualPayload(title),
          summary: toBilingualPayload(summary),
          status,
          location: location.vi.trim()
            ? toBilingualPayload(location)
            : undefined,
          category: category.vi.trim()
            ? toBilingualPayload(category)
            : undefined,
        },
      });
      toast.success("Đã lưu thông tin dự án.");
      setEditing(false);
    } catch (error) {
      toast.error(
        resolveApiError(
          error,
          "Không lưu được thông tin dự án. Vui lòng thử lại.",
        ),
      );
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-white p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">
              Thông tin cơ bản của dự án
            </h3>
            <p className="mt-1 text-xs text-slate">
              Dùng chung cho danh sách dự án, đầu trang chi tiết và SEO cơ bản.
            </p>
          </div>
          {canEdit && !hideEditToggle ? (
            <Button
              type="button"
              variant={editing ? "ghost" : "outline"}
              size="sm"
              onClick={() => setEditing(!editing)}
            >
              {editing ? (
                <X className="size-4" />
              ) : (
                <Pencil className="size-4" />
              )}
              {editing ? "Đóng chỉnh sửa" : "Sửa thông tin"}
            </Button>
          ) : null}
        </div>

        {editing ? (
          <form onSubmit={onSaveBasic} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Tên dự án</Label>
                <BilingualField
                  value={title}
                  onChange={setTitle}
                  placeholder={{
                    vi: "Khu đô thị Hưng Phú",
                    en: "Hung Phu Urban Area",
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-slug">Slug</Label>
                <Input
                  id="project-slug"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder="khu-do-thi-hung-phu"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tình trạng thi công</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setStatus(value as ProjectStatus)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {projectStatusLabel[option]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Mô tả ngắn</Label>
              <BilingualField
                multiline
                rows={3}
                value={summary}
                onChange={setSummary}
                placeholder={{
                  vi: "Một hai câu giới thiệu dự án, hiển thị ở thẻ danh sách.",
                  en: "One or two sentences shown on the project card.",
                }}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Vị trí</Label>
                <BilingualField
                  value={location}
                  onChange={setLocation}
                  placeholder={{ vi: "Bến Tre", en: "Ben Tre" }}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phân loại</Label>
                <BilingualField
                  value={category}
                  onChange={setCategory}
                  placeholder={{ vi: "Khu đô thị", en: "Urban Area" }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={updateProject.isPending}
                onClick={() => setEditing(false)}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={updateProject.isPending}>
                {updateProject.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Lưu thông tin
              </Button>
            </div>
          </form>
        ) : (
          <DetailList
            fields={[
              { label: "Tên dự án", value: project.title.vi },
              { label: "Slug", value: `/${project.slug}` },
              { label: "Mô tả ngắn", value: project.summary.vi, block: true },
              { label: "Vị trí", value: project.location?.vi ?? "—" },
              { label: "Phân loại", value: project.category?.vi ?? "—" },
              {
                label: "Tình trạng",
                value: projectStatusLabel[project.status],
              },
            ]}
          />
        )}
      </section>

      <DetailList
        fields={[
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

      {editing && actions.length > 0 && (
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
