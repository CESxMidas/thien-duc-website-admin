import { useRef, useState } from "react";
import { ImageOff, Library, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMedia, useUploadMedia } from "@/lib/api/queries";
import { ACCEPTED_MIME, fileNameOf, validateFile } from "@/lib/api/media";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import type { MediaAsset } from "@/types";

/** Tỷ lệ khung ảnh xem trước — map sang class Tailwind tĩnh (không nội suy). */
type AspectRatio = "3/1" | "16/9" | "3/2" | "1/1";
const ASPECT_CLASS: Record<AspectRatio, string> = {
  "3/1": "aspect-3/1",
  "16/9": "aspect-video",
  "3/2": "aspect-3/2",
  "1/1": "aspect-square",
};

interface ImagePickerFieldProps {
  /** URL ảnh hiện tại (chuỗi rỗng = chưa chọn). */
  value: string;
  onChange: (url: string) => void;
  /** Thư mục Cloudinary để tải lên và lọc thư viện. */
  folder?: string;
  /** Tỷ lệ khung ảnh xem trước (mặc định 3/1 kiểu banner). */
  aspect?: AspectRatio;
  /** Văn bản thay thế cho ảnh xem trước. */
  alt?: string;
}

/** Ảnh xem trước, tự đổi sang ô giữ chỗ khi URL hỏng. */
function Preview({
  url,
  aspectClass,
  alt,
}: {
  url: string;
  aspectClass: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className={`grid ${aspectClass} w-full place-items-center rounded-lg bg-cream text-slate/50`}
        title="Không tải được ảnh từ URL này"
      >
        <ImageOff className="size-6" aria-hidden />
        <span className="sr-only">Không tải được ảnh</span>
      </div>
    );
  }

  return (
    <img
      key={url}
      src={resolveAssetUrl(url)}
      alt={alt}
      className={`${aspectClass} w-full rounded-lg border border-line bg-cream object-cover`}
      onError={() => setFailed(true)}
    />
  );
}

export function ImagePickerField({
  value,
  onChange,
  folder = "banners",
  aspect = "3/1",
  alt = "Ảnh đã chọn",
}: ImagePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const aspectClass = ASPECT_CLASS[aspect];

  async function handleFile(file: File | undefined) {
    if (!file) return;
    const reason = validateFile(file);
    if (reason) {
      toast.error(reason);
      return;
    }
    try {
      const asset = await upload.mutateAsync({ file, folder });
      onChange(asset.url);
      toast.success("Đã tải ảnh lên.");
    } catch (error) {
      toast.error(resolveApiError(error, "Không tải lên được ảnh."));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        className="hidden"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {value ? (
        <div className="space-y-2">
          <Preview url={value} aspectClass={aspectClass} alt={alt} />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Đổi ảnh khác
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLibraryOpen(true)}
            >
              <Library className="size-4" /> Chọn từ thư viện
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => onChange("")}
            >
              <Trash2 className="size-4" /> Bỏ ảnh
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void handleFile(event.dataTransfer.files?.[0]);
          }}
          className="grid place-items-center gap-3 rounded-lg border border-dashed border-line bg-cream/40 px-4 py-8 text-center"
        >
          <ImageOff className="size-8 text-slate/40" aria-hidden />
          <p className="text-sm text-slate">
            Kéo ảnh vào đây, hoặc chọn cách bên dưới.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {upload.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Tải ảnh từ máy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setLibraryOpen(true)}
            >
              <Library className="size-4" /> Chọn từ thư viện
            </Button>
          </div>
        </div>
      )}

      <MediaLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        folder={folder}
        onSelect={(asset) => {
          onChange(asset.url);
          setLibraryOpen(false);
        }}
      />
    </div>
  );
}

interface MediaLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folder: string;
  onSelect: (asset: MediaAsset) => void;
}

/** Lưới ảnh có sẵn trong một thư mục để chọn lại, không cần tải mới. */
function MediaLibraryDialog({
  open,
  onOpenChange,
  folder,
  onSelect,
}: MediaLibraryDialogProps) {
  // Chỉ gọi API khi dialog mở — tránh nạp thư viện lúc chưa cần.
  const { data: media = [], isLoading } = useMedia(open ? folder : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chọn ảnh từ thư viện</DialogTitle>
          <DialogDescription>
            Bấm vào một ảnh để sử dụng. Muốn thêm ảnh mới thì đóng cửa sổ này và
            bấm “Tải ảnh từ máy”.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="aspect-3/2 animate-pulse rounded-lg bg-cream"
              />
            ))}
          </div>
        ) : media.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate">
            Thư mục này chưa có ảnh nào. Hãy tải ảnh từ máy.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {media.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onSelect(asset)}
                className="group overflow-hidden rounded-lg border border-line bg-cream text-left transition hover:border-brand focus-visible:border-brand focus-visible:outline-none"
                title={fileNameOf(asset)}
              >
                <img
                  src={resolveAssetUrl(asset.url)}
                  alt={fileNameOf(asset)}
                  loading="lazy"
                  className="aspect-3/2 w-full object-cover transition group-hover:opacity-90"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
