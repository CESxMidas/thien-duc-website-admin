// Tab "Hình ảnh" của modal chi tiết dự án: thêm ảnh theo URL, đổi thứ tự hiển
// thị và xóa ảnh. Ở tab dự án chính chỉ quản lý ảnh chung của dự án; ảnh hạng
// mục được tách sang từng hạng mục để người dùng không nhầm cấp nội dung.
//
// Thứ tự: backend đòi đủ id ảnh của dự án mỗi lần sắp xếp lại, nên nút lên/xuống
// hoán đổi hai ảnh liền kề rồi gửi lại **toàn bộ** danh sách.

import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  ImageOff,
  Loader2,
  Plus,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  ImagePickerField,
  MultiImagePickerField,
} from "@/components/ui/ImagePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import {
  useAddGalleryImage,
  useDeleteGalleryImage,
  useReorderGallery,
  useUpdateGalleryImage,
  useUpdateProject,
  useUpdateProjectItem,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import { canEditProject } from "@/lib/content-editing";
import type { ProjectDetail, ProjectGalleryImage, ProjectItem } from "@/types";

/** Giá trị Select cho "ảnh của cả dự án" — Radix không nhận value rỗng. */
const NO_ITEM = "__project__";

/**
 * Ảnh xem trước. Ảnh hỏng (URL sai, hoặc đường dẫn tương đối của website công
 * khai mà admin không phục vụ) phải hiện ô giữ chỗ có nghĩa — ẩn thẻ `img` đi
 * chỉ để lại khoảng trắng khó hiểu, người dùng tưởng hàng bị lỗi.
 */
function GalleryThumb({ url, alt }: { url: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="grid size-16 shrink-0 place-items-center rounded-lg bg-cream text-slate/50"
        title="Không tải được ảnh từ URL này"
      >
        <ImageOff className="size-5" aria-hidden />
        <span className="sr-only">Không tải được ảnh</span>
      </div>
    );
  }

  return (
    <img
      src={resolveAssetUrl(url)}
      alt={alt}
      loading="lazy"
      className="size-16 shrink-0 rounded-lg border border-line bg-cream object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function ProjectGalleryTab({
  project,
  item,
  projectOnly = false,
}: {
  project: ProjectDetail;
  item?: ProjectItem;
  projectOnly?: boolean;
}) {
  const { user } = useAuth();
  const images = project.galleryImages;
  const visibleImages = projectOnly
    ? images.filter((image) => !image.projectItemId)
    : item
      ? images.filter((image) => image.projectItemId === item.id)
    : images;
  const addImage = useAddGalleryImage();
  const deleteImage = useDeleteGalleryImage();
  const updateImage = useUpdateGalleryImage();
  const updateProject = useUpdateProject();
  const updateItem = useUpdateProjectItem();
  const reorder = useReorderGallery();

  // Ảnh thư viện — kể cả THỨ TỰ của chúng — là nội dung công khai của dự án cha,
  // nên quyền sửa thừa hưởng luật của cha: EDITOR mất quyền khi dự án đã xuất
  // bản (backend trả 403 trên thêm / sửa / xóa / sắp xếp). Vẫn cho xem ảnh.
  const canEdit = canEditProject(user?.role, project);

  const [urls, setUrls] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [itemSlug, setItemSlug] = useState<string>(NO_ITEM);
  const [toDelete, setToDelete] = useState<ProjectGalleryImage | null>(null);
  const projectImageCount = images.filter((image) => !image.projectItemId).length;
  const itemImageCount = images.length - projectImageCount;

  /** Tên hạng mục để dán nhãn lên ảnh — id ảnh chỉ lưu projectItemId. */
  const itemTitleById = new Map(
    project.items.map((item) => [item.id, item.title.vi]),
  );

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    if (urls.length === 0) return;

    let added = 0;
    const failed: string[] = [];
    for (const url of urls) {
      try {
        await addImage.mutateAsync({
          slug: project.slug,
          data: {
            url,
            ...(caption.trim() && { caption: { vi: caption.trim() } }),
            ...(item
              ? { itemSlug: item.slug }
              : !projectOnly && itemSlug !== NO_ITEM
                ? { itemSlug }
                : {}),
          },
        });
        added += 1;
      } catch (error) {
        failed.push(url);
        toast.error(
          resolveApiError(
            error,
            `Không thêm được ảnh ${url.split("/").pop() || url}.`,
          ),
        );
      }
    }

    if (added > 0) {
      const targetLabel = item ? "hạng mục" : "dự án";
      toast.success(
        added === 1
          ? `Đã thêm 1 ảnh vào thư viện ${targetLabel}.`
          : `Đã thêm ${added} ảnh vào thư viện ${targetLabel}.`,
      );
    }
    setUrls(failed);
    if (failed.length === 0) setCaption("");
  }

  async function onMove(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= visibleImages.length) return;

    const visibleIds = visibleImages.map((image) => image.id);
    [visibleIds[index], visibleIds[target]] = [
      visibleIds[target],
      visibleIds[index],
    ];
    let visibleIndex = 0;
    const ids = images.map((image) => {
      if ((projectOnly && image.projectItemId) || (item && image.projectItemId !== item.id)) {
        return image.id;
      }
      const id = visibleIds[visibleIndex];
      visibleIndex += 1;
      return id;
    });

    try {
      await reorder.mutateAsync({ slug: project.slug, imageIds: ids });
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được thứ tự ảnh."));
    }
  }

  async function onConfirmDelete() {
    if (!toDelete) return;
    try {
      await deleteImage.mutateAsync({
        slug: project.slug,
        imageId: toDelete.id,
      });
      toast.success("Đã ẩn ảnh.");
      setToDelete(null);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không ẩn được ảnh. Vui lòng thử lại."),
      );
    }
  }

  async function showImage(image: ProjectGalleryImage) {
    try {
      await updateImage.mutateAsync({
        slug: project.slug,
        imageId: image.id,
        data: { isActive: true },
      });
      toast.success("Đã hiện ảnh.");
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không hiện được ảnh. Vui lòng thử lại."),
      );
    }
  }

  async function setCoverImage(image: ProjectGalleryImage) {
    try {
      if (item) {
        await updateItem.mutateAsync({
          slug: project.slug,
          itemSlug: item.slug,
          data: { image: image.url },
        });
        toast.success("Đã đặt ảnh này làm ảnh đại diện hạng mục.");
      } else {
        await updateProject.mutateAsync({
          slug: project.slug,
          data: { image: image.url },
        });
        toast.success("Đã đặt ảnh này làm ảnh đại diện dự án.");
      }
    } catch (error) {
      toast.error(
        resolveApiError(
          error,
          item
            ? "Không đặt được ảnh đại diện hạng mục. Vui lòng thử lại."
            : "Không đặt được ảnh đại diện. Vui lòng thử lại.",
        ),
      );
    }
  }

  const coverImage = item?.image ?? project.image;
  const coverLabel = item ? "hạng mục" : "dự án";

  async function setCoverUrl(url: string) {
    try {
      if (item) {
        await updateItem.mutateAsync({
          slug: project.slug,
          itemSlug: item.slug,
          data: { image: url.trim() || undefined },
        });
        toast.success("Đã cập nhật ảnh chính hạng mục.");
      } else {
        await updateProject.mutateAsync({
          slug: project.slug,
          data: { image: url.trim() || undefined },
        });
        toast.success("Đã cập nhật ảnh chính dự án.");
      }
    } catch (error) {
      toast.error(
        resolveApiError(
          error,
          item
            ? "Không cập nhật được ảnh chính hạng mục."
            : "Không cập nhật được ảnh chính dự án.",
        ),
      );
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-4 rounded-xl border border-line bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">
              Hình ảnh {coverLabel}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="gray">
              {item ? visibleImages.length : projectImageCount} ảnh con
            </Badge>
            {!projectOnly && !item ? (
              <Badge variant="blue">{itemImageCount} ảnh hạng mục</Badge>
            ) : null}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Ảnh chính của {coverLabel}</Label>
          <ImagePickerField
            value={coverImage ?? ""}
            onChange={(url) => void setCoverUrl(url)}
            folder="projects"
            aspect="3/2"
            alt={`Ảnh chính ${coverLabel}`}
          />
        </div>

        {!canEdit && (
          <p className="rounded-lg border border-line bg-cream/40 px-3 py-2 text-xs text-slate">
            Dự án đã xuất bản, chỉ quản trị viên sửa được thư viện ảnh.
          </p>
        )}

        {canEdit && (
          <form onSubmit={onAdd} className="space-y-4 border-b border-line pb-4">
          <div className="space-y-1.5">
            <div>
              <Label className="font-display text-sm font-semibold text-ink">
                Thêm và quản lý ảnh {item ? "hạng mục" : "dự án"}
              </Label>
            </div>
            <MultiImagePickerField
              value={urls}
              onChange={setUrls}
              folder="projects"
              footer={
                <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor="gallery-caption">
                      Chú thích chung (không bắt buộc)
                    </Label>
                    <Input
                      id="gallery-caption"
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Phối cảnh mặt tiền"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="sm:mb-6"
                    disabled={urls.length === 0 || addImage.isPending}
                  >
                    {addImage.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Plus className="size-4" />
                    )}
                    Thêm ảnh
                    {urls.length > 0 && (
                      <span className="rounded-full bg-white/20 px-1.5 text-xs">
                        {urls.length}
                      </span>
                    )}
                  </Button>
                </div>
              }
            />
          </div>

          {!projectOnly && !item && (
            <div className="space-y-1.5">
              <Label>Thuộc hạng mục</Label>
              <Select value={itemSlug} onValueChange={setItemSlug}>
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ITEM}>Ảnh chung của dự án</SelectItem>
                  {project.items.map((item) => (
                    <SelectItem key={item.id} value={item.slug}>
                      Ảnh hạng mục: {item.title.vi}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </form>
        )}

        {visibleImages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate">
            Thư viện chưa có ảnh nào.
          </p>
        ) : (
          <ul className="space-y-2">
            {visibleImages.map((image, index) => {
              const isActive = image.isActive !== false;
              const isCover = coverImage === image.url;
              return (
              <li
                key={image.id}
                style={{ "--row-index": Math.min(index, 7) } as CSSProperties}
                className="row-in flex items-center gap-3 rounded-xl border border-line p-2 transition-colors duration-150 hover:border-line-strong"
              >
                <GalleryThumb url={image.url} alt={image.caption?.vi ?? ""} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {image.caption?.vi || (
                      <span className="text-slate italic">
                        Không có chú thích
                      </span>
                    )}
                  </p>
                  {/* Chỉ hiện tên file cho gọn; rê chuột xem URL đầy đủ. */}
                  <p className="truncate text-xs text-slate" title={image.url}>
                    {image.url.split("/").pop() || image.url}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {!projectOnly && (
                      <Badge variant={image.projectItemId ? "blue" : "gray"}>
                        {image.projectItemId
                          ? `Ảnh hạng mục: ${
                              itemTitleById.get(image.projectItemId) ?? "Hạng mục"
                            }`
                          : "Ảnh chung dự án"}
                      </Badge>
                    )}
                    <Badge variant={isActive ? "green" : "gray"}>
                      {isActive ? "Đang hiện" : "Đang ẩn"}
                    </Badge>
                    {isCover ? <Badge variant="blue">Ảnh chính</Badge> : null}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant={isCover ? "outline" : "ghost"}
                      size="sm"
                      aria-label={
                        isCover
                          ? "Ảnh này đang là ảnh đại diện"
                          : "Đặt làm ảnh đại diện"
                      }
                      title={
                        !isActive
                          ? "Hãy hiện ảnh trước khi đặt làm ảnh đại diện"
                          : isCover
                            ? "Ảnh này đang là ảnh đại diện"
                            : item
                              ? "Đặt làm ảnh đại diện hạng mục"
                              : "Đặt làm ảnh đại diện"
                      }
                      disabled={
                        !isActive ||
                        isCover ||
                        updateProject.isPending ||
                        updateItem.isPending
                      }
                      onClick={() => void setCoverImage(image)}
                    >
                      {isCover ? "Cover" : "Đại diện"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Đưa ảnh lên trước"
                      disabled={index === 0 || reorder.isPending}
                      onClick={() => void onMove(index, -1)}
                    >
                      <ChevronUp className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Đưa ảnh xuống sau"
                      disabled={index === visibleImages.length - 1 || reorder.isPending}
                      onClick={() => void onMove(index, 1)}
                    >
                      <ChevronDown className="size-4" />
                    </Button>
                    {isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Ẩn ảnh"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => setToDelete(image)}
                      >
                        <EyeOff className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Hiện ảnh"
                        onClick={() => void showImage(image)}
                      >
                        <Eye className="size-4" />
                      </Button>
                    )}
                  </div>
                )}
              </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Ẩn ảnh này khỏi website?"
        description="Ảnh sẽ không còn hiển thị công khai trong thư viện dự án. Dữ liệu vẫn được giữ lại để hiện lại sau."
        confirmLabel="Ẩn ảnh"
        submitting={deleteImage.isPending}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
}
