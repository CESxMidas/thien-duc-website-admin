// Tab "Hình ảnh" của modal chi tiết dự án: thêm ảnh theo URL, gắn ảnh vào một
// hạng mục con, đổi thứ tự hiển thị và xóa ảnh.
//
// Thứ tự: backend đòi đủ id ảnh của dự án mỗi lần sắp xếp lại, nên nút lên/xuống
// hoán đổi hai ảnh liền kề rồi gửi lại **toàn bộ** danh sách.

import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, ImageOff, Loader2, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAddGalleryImage,
  useDeleteGalleryImage,
  useReorderGallery,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import type { ProjectDetail, ProjectGalleryImage } from "@/types";

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

export function ProjectGalleryTab({ project }: { project: ProjectDetail }) {
  const images = project.galleryImages;
  const addImage = useAddGalleryImage();
  const deleteImage = useDeleteGalleryImage();
  const reorder = useReorderGallery();

  const [url, setUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [itemSlug, setItemSlug] = useState<string>(NO_ITEM);
  const [toDelete, setToDelete] = useState<ProjectGalleryImage | null>(null);

  /** Tên hạng mục để dán nhãn lên ảnh — id ảnh chỉ lưu projectItemId. */
  const itemTitleById = new Map(
    project.items.map((item) => [item.id, item.title.vi]),
  );

  async function onAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!url.trim()) return;
    try {
      await addImage.mutateAsync({
        slug: project.slug,
        data: {
          url: url.trim(),
          ...(caption.trim() && { caption: { vi: caption.trim() } }),
          ...(itemSlug !== NO_ITEM && { itemSlug }),
        },
      });
      toast.success("Đã thêm ảnh vào thư viện.");
      setUrl("");
      setCaption("");
    } catch (error) {
      toast.error(resolveApiError(error, "Không thêm được ảnh. Vui lòng thử lại."));
    }
  }

  async function onMove(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= images.length) return;

    const ids = images.map((image) => image.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];

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
      toast.success("Đã xóa ảnh.");
      setToDelete(null);
    } catch (error) {
      toast.error(resolveApiError(error, "Không xóa được ảnh. Vui lòng thử lại."));
    }
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={onAdd}
        className="space-y-3 rounded-xl border border-line bg-cream/40 p-4"
      >
        <div className="space-y-1.5">
          <Label>Thêm ảnh con</Label>
          <ImagePickerField
            value={url}
            onChange={setUrl}
            folder="projects"
            aspect="3/2"
            alt="Ảnh con đã chọn"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gallery-caption">Chú thích (không bắt buộc)</Label>
          <Input
            id="gallery-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Phối cảnh mặt tiền"
          />
        </div>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1.5">
            <Label>Thuộc hạng mục</Label>
            <Select value={itemSlug} onValueChange={setItemSlug}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ITEM}>Ảnh của cả dự án</SelectItem>
                {project.items.map((item) => (
                  <SelectItem key={item.id} value={item.slug}>
                    {item.title.vi}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!url.trim() || addImage.isPending}>
            {addImage.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Thêm ảnh
          </Button>
        </div>
      </form>

      {images.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate">
          Thư viện chưa có ảnh nào.
        </p>
      ) : (
        <ul className="space-y-2">
          {images.map((image, index) => (
            <li
              key={image.id}
              style={{ "--row-index": Math.min(index, 7) } as CSSProperties}
              className="row-in flex items-center gap-3 rounded-xl border border-line p-2 transition-colors duration-150 hover:border-line-strong"
            >
              <GalleryThumb url={image.url} alt={image.caption?.vi ?? ""} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-ink">
                  {image.caption?.vi || (
                    <span className="text-slate italic">Không có chú thích</span>
                  )}
                </p>
                {/* Chỉ hiện tên file cho gọn; rê chuột xem URL đầy đủ. */}
                <p className="truncate text-xs text-slate" title={image.url}>
                  {image.url.split("/").pop() || image.url}
                </p>
                {image.projectItemId && (
                  <Badge variant="blue" className="mt-1">
                    {itemTitleById.get(image.projectItemId) ?? "Hạng mục"}
                  </Badge>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
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
                  disabled={index === images.length - 1 || reorder.isPending}
                  onClick={() => void onMove(index, 1)}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Xóa ảnh"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setToDelete(image)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {images.length === 0 && project.items.length === 0 && (
        <p className="flex items-center justify-center gap-2 text-xs text-slate">
          <ImageOff className="size-3.5" />
          Tạo hạng mục trước nếu muốn gắn ảnh vào từng hạng mục.
        </p>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Xóa ảnh này?"
        description="Ảnh sẽ bị gỡ khỏi thư viện dự án. Thao tác không hoàn tác được."
        confirmLabel="Xóa ảnh"
        submitting={deleteImage.isPending}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
}
