import { useRef, useState } from "react";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/context/AuthContext";
import { useDeleteMedia, useMedia, useUploadMedia } from "@/lib/api/queries";
import {
  MEDIA_FOLDERS,
  fileNameOf,
  formatBytes,
  validateFile,
} from "@/lib/api/media";
import { resolveApiError } from "@/lib/api-error-message";
import { formatDateTime } from "@/lib/labels";
import type { MediaAsset } from "@/types";

type FolderValue = (typeof MEDIA_FOLDERS)[number]["value"];

export function MediaPage() {
  const [folder, setFolder] = useState<FolderValue>("projects");
  const [pending, setPending] = useState<MediaAsset | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { user } = useAuth();
  const { data: media = [], isLoading } = useMedia(folder);
  const upload = useUploadMedia();
  const remove = useDeleteMedia();

  // Xóa ảnh là thao tác phá hủy (gỡ khỏi Cloudinary, có thể hỏng trang đang dùng)
  // — chỉ ADMIN trở lên, khớp `@Roles(ADMIN, SUPER_ADMIN)` ở backend. EDITOR vẫn
  // tải ảnh lên bình thường, chỉ không thấy nút xóa.
  const canDelete = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;

    // Chặn tệp sai định dạng/quá lớn ngay tại client để người dùng biết trước
    // khi tốn thời gian truyền — backend vẫn kiểm lại lần nữa.
    const chosen = Array.from(files);
    const rejected = chosen.map(validateFile).filter(Boolean) as string[];
    rejected.forEach((message) => toast.error(message));

    const accepted = chosen.filter((file) => validateFile(file) === null);
    if (accepted.length === 0) return;

    // Tải tuần tự: gói Cloudinary free giới hạn request đồng thời, và upload
    // song song nhiều ảnh nặng dễ vượt giới hạn rồi hỏng giữa chừng.
    let uploaded = 0;
    for (const file of accepted) {
      try {
        await upload.mutateAsync({ file, folder });
        uploaded += 1;
      } catch (error) {
        toast.error(resolveApiError(error, `Không tải lên được ${file.name}.`));
      }
    }

    if (uploaded > 0) {
      toast.success(
        uploaded === 1 ? "Đã tải lên 1 ảnh." : `Đã tải lên ${uploaded} ảnh.`,
      );
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleDelete() {
    if (!pending) return;
    try {
      await remove.mutateAsync(pending.id);
      toast.success("Đã xóa ảnh.");
      setPending(null);
    } catch (error) {
      toast.error(resolveApiError(error, "Không xóa được ảnh."));
    }
  }

  return (
    <div>
      <PageHeader
        title="Thư viện ảnh"
        description="Ảnh tải lên Cloudinary, tự chuyển WebP và thu về tối đa 1200px (ED-05). Nhận JPG, PNG, WebP, AVIF — tối đa 10MB mỗi tệp."
        actions={
          <Button
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            {upload.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {upload.isPending ? "Đang tải lên..." : "Tải ảnh lên"}
          </Button>
        }
      />

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <div
        role="tablist"
        aria-label="Lọc theo thư mục"
        className="mb-6 flex flex-wrap gap-2"
      >
        {MEDIA_FOLDERS.map((item) => {
          const active = item.value === folder;
          return (
            <button
              key={item.value}
              role="tab"
              aria-selected={active}
              onClick={() => setFolder(item.value)}
              className={
                active
                  ? "rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white"
                  : "rounded-full border border-line px-4 py-1.5 text-sm font-medium text-slate transition hover:border-brand hover:text-brand"
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-3/2 animate-pulse rounded-xl bg-cream" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-line bg-white px-6 py-16 text-center">
          <ImageIcon className="size-10 text-slate/40" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Thư mục này chưa có ảnh
          </h2>
          <p className="mt-2 max-w-md text-sm text-slate">
            Tải ảnh lên để dùng cho dự án, bài viết và banner. Ảnh được tối ưu tự
            động sau khi tải.
          </p>
          <Button className="mt-6" onClick={() => inputRef.current?.click()}>
            <Upload className="size-4" /> Tải ảnh lên
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {media.map((asset) => (
            <figure
              key={asset.id}
              className="group overflow-hidden rounded-xl border border-line bg-white"
            >
              <div className="relative aspect-3/2 bg-cream">
                <img
                  src={asset.url}
                  alt={fileNameOf(asset)}
                  loading="lazy"
                  className="size-full object-cover"
                />
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setPending(asset)}
                    aria-label={`Xóa ảnh ${fileNameOf(asset)}`}
                    className="absolute right-2 top-2 grid size-9 place-items-center rounded-lg bg-white/90 text-slate opacity-0 transition hover:bg-white hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
              <figcaption className="px-3 py-2">
                <p className="truncate text-xs font-medium text-ink">
                  {fileNameOf(asset)}
                </p>
                <p className="text-xs text-slate">
                  {[
                    formatBytes(asset.bytes),
                    asset.width && asset.height
                      ? `${asset.width}×${asset.height}`
                      : null,
                    asset.format?.toUpperCase(),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Xóa ảnh khỏi thư viện?"
        description={
          pending ? (
            <>
              Ảnh <strong>{fileNameOf(pending)}</strong> (tải lên{" "}
              {formatDateTime(pending.createdAt)}) sẽ bị xóa khỏi Cloudinary và
              không khôi phục được. Trang nào đang dùng ảnh này sẽ hiển thị lỗi.
            </>
          ) : null
        }
        submitting={remove.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
