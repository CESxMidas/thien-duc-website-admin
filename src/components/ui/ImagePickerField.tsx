import { useRef, useState } from "react";
import { ImageOff, Library, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ImagePickerFieldProps {
  /** URL ảnh hiện tại (chuỗi rỗng = chưa chọn). */
  value: string;
  onChange: (url: string) => void;
  /** Thư mục Cloudinary để tải lên và lọc thư viện. */
  folder?: string;
}

/** Ảnh xem trước, tự đổi sang ô giữ chỗ khi URL hỏng. */
function Preview({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div
        className="grid aspect-3/1 w-full place-items-center rounded-lg bg-cream text-slate/50"
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
      alt="Ảnh banner đã chọn"
      className="aspect-3/1 w-full rounded-lg border border-line bg-cream object-cover"
      onError={() => setFailed(true)}
    />
  );
}

export function ImagePickerField({
  value,
  onChange,
  folder = "banners",
}: ImagePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [manualUrl, setManualUrl] = useState(false);

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
          <Preview url={value} />
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

      {/* Lối thoát cho người dùng nâng cao: vẫn dán URL trực tiếp nếu muốn. */}
      {manualUrl ? (
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="https://res.cloudinary.com/..."
        />
      ) : (
        <button
          type="button"
          onClick={() => setManualUrl(true)}
          className="text-xs text-slate underline-offset-2 hover:text-brand hover:underline"
        >
          Hoặc dán URL thủ công
        </button>
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
            Bấm vào một ảnh để dùng cho banner. Muốn thêm ảnh mới thì đóng cửa
            sổ này và bấm “Tải ảnh từ máy”.
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
            Thư mục “Banner” chưa có ảnh nào. Hãy tải ảnh từ máy.
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
