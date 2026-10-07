import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ImageOff,
  Images,
  Library,
  Loader2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
type PreviewFit = "cover" | "contain";
const PREVIEW_FIT_CLASS: Record<PreviewFit, string> = {
  cover: "object-cover",
  contain: "object-contain",
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
  /** Cách căn ảnh trong khung xem trước. Logo nên dùng contain, ảnh nội dung giữ cover. */
  previewFit?: PreviewFit;
  /** Class bổ sung cho khung xem trước. */
  previewClassName?: string;
  onBatchUploaded?: (urls: string[]) => void;
}

/** Ảnh xem trước, tự đổi sang ô giữ chỗ khi URL hỏng. */
function Preview({
  url,
  aspectClass,
  fitClass,
  className,
  alt,
}: {
  url: string;
  aspectClass: string;
  fitClass: string;
  className?: string;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const frameClassName = `${aspectClass} w-full overflow-hidden rounded-lg border border-line bg-cream ${className ?? ""}`;

  if (failed) {
    return (
      <div
        className={`${frameClassName} grid place-items-center text-slate/50`}
        title="Không tải được ảnh từ URL này"
      >
        <ImageOff className="size-6" aria-hidden />
        <span className="sr-only">Không tải được ảnh</span>
      </div>
    );
  }

  return (
    <div className={frameClassName}>
      <img
        key={url}
        src={resolveAssetUrl(url)}
        alt={alt}
        className={`size-full ${fitClass}`}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

export function ImagePickerField({
  value,
  onChange,
  folder = "banners",
  aspect = "3/1",
  alt = "Ảnh đã chọn",
  previewFit = "cover",
  previewClassName,
  onBatchUploaded,
}: ImagePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploadedChoices, setUploadedChoices] = useState<MediaAsset[]>([]);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const aspectClass = ASPECT_CLASS[aspect];
  const fitClass = PREVIEW_FIT_CLASS[previewFit];

  async function handleFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    const chosen = Array.from(files);
    const accepted = chosen.filter((file) => {
      const reason = validateFile(file);
      if (reason) toast.error(reason);
      return reason === null;
    });
    if (accepted.length === 0) return;

    const uploaded: MediaAsset[] = [];
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        setUploadProgress({ current: index + 1, total: accepted.length });
        try {
          uploaded.push(await upload.mutateAsync({ file, folder }));
        } catch (error) {
          toast.error(resolveApiError(error, `Không tải lên được ${file.name}.`));
        }
      }

      if (uploaded.length > 0) {
        if (uploaded.length === 1) {
          onChange(uploaded[0].url);
        } else {
          onBatchUploaded?.(uploaded.map((asset) => asset.url));
          setUploadedChoices(uploaded);
        }
        toast.success(
          uploaded.length === 1
            ? "Đã tải lên và chọn ảnh."
            : `Đã tải lên ${uploaded.length} ảnh. Hãy chọn ảnh đại diện trong danh sách xem trước.`,
        );
      }
    } finally {
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const isUploading = uploadProgress !== null || upload.isPending;
  const uploadLabel = uploadProgress
    ? `Đang tải ${uploadProgress.current}/${uploadProgress.total}`
    : null;

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      {value ? (
        <div className="space-y-2">
          <Preview
            key={value}
            url={value}
            aspectClass={aspectClass}
            fitClass={fitClass}
            className={previewClassName}
            alt={alt}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploadLabel ?? "Đổi hoặc tải thêm ảnh"}
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
            void handleFiles(event.dataTransfer.files);
          }}
          className="grid place-items-center gap-3 rounded-lg border border-dashed border-line bg-cream/40 px-4 py-8 text-center"
        >
          <ImageOff className="size-8 text-slate/40" aria-hidden />
          <p className="text-sm text-slate">Thêm ảnh</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploadLabel ?? "Tải ảnh"}
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
        onSelect={(assets) => {
          const asset = assets[0];
          if (!asset) return;
          onChange(asset.url);
          setLibraryOpen(false);
        }}
      />
      <UploadedImageChoiceDialog
        assets={uploadedChoices}
        open={uploadedChoices.length > 1}
        onOpenChange={(open) => {
          if (!open) setUploadedChoices([]);
        }}
        onSelect={(asset) => {
          onChange(asset.url);
          setUploadedChoices([]);
        }}
      />
    </div>
  );
}

function UploadedImageChoiceDialog({
  assets,
  open,
  onOpenChange,
  onSelect,
}: {
  assets: MediaAsset[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: MediaAsset) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Chọn ảnh đại diện</DialogTitle>
          <DialogDescription>Chọn ảnh chính.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <button
              key={asset.id}
              type="button"
              className="group overflow-hidden rounded-lg border border-line bg-white text-left transition hover:border-brand focus-visible:border-brand focus-visible:outline-none"
              aria-label={`Chọn ${fileNameOf(asset)} làm ảnh đại diện`}
              onClick={() => onSelect(asset)}
            >
              <span className="grid aspect-3/2 place-items-center bg-cream/50">
                <img
                  src={resolveAssetUrl(asset.url)}
                  alt={fileNameOf(asset)}
                  className="max-h-full max-w-full object-contain transition group-hover:opacity-90"
                />
              </span>
              <span className="block truncate px-3 py-2 text-xs text-slate">
                {fileNameOf(asset)}
              </span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Chọn sau
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface MultiImagePickerFieldProps {
  value: string[];
  onChange: (urls: string[]) => void;
  folder?: string;
  disabled?: boolean;
  footer?: ReactNode;
}

/** Bộ chọn theo lô cho gallery: tải/chọn nhiều ảnh rồi thêm tất cả cùng lúc. */
export function MultiImagePickerField({
  value,
  onChange,
  folder = "projects",
  disabled = false,
  footer,
}: MultiImagePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadMedia();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);

  function appendUrls(urls: string[]) {
    onChange(Array.from(new Set([...value, ...urls])));
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const chosen = Array.from(files);
    const accepted = chosen.filter((file) => {
      const reason = validateFile(file);
      if (reason) toast.error(reason);
      return reason === null;
    });
    if (accepted.length === 0) return;

    const urls: string[] = [];
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        setUploadProgress({ current: index + 1, total: accepted.length });
        try {
          const asset = await upload.mutateAsync({ file, folder });
          urls.push(asset.url);
        } catch (error) {
          toast.error(resolveApiError(error, `Không tải lên được ${file.name}.`));
        }
      }
      if (urls.length > 0) {
        appendUrls(urls);
        toast.success(
          urls.length === 1
            ? "Đã chọn 1 ảnh."
            : `Đã tải lên và chọn ${urls.length} ảnh.`,
        );
      }
    } finally {
      setUploadProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const isUploading = uploadProgress !== null || upload.isPending;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME.join(",")}
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!disabled && !isUploading) void handleFiles(event.dataTransfer.files);
        }}
        className="rounded-lg border border-dashed border-line bg-white p-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-slate">
            <Images className="size-5 text-brand" aria-hidden />
            <span>Thêm nhiều ảnh</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {uploadProgress
                ? `Đang tải ${uploadProgress.current}/${uploadProgress.total}`
                : "Tải nhiều ảnh"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => setLibraryOpen(true)}
            >
              <Library className="size-4" /> Chọn nhiều từ thư viện
            </Button>
          </div>
        </div>
        {footer ? (
          <div className="mt-4 border-t border-line/70 pt-4">{footer}</div>
        ) : null}
      </div>

      {value.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-slate">
            Đã chọn {value.length} ảnh
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {value.map((url, index) => (
              <li
                key={url}
                className="group relative overflow-hidden rounded-lg border border-line bg-cream"
              >
                <img
                  src={resolveAssetUrl(url)}
                  alt={`Ảnh đã chọn ${index + 1}`}
                  className="aspect-3/2 w-full object-cover"
                />
                <button
                  type="button"
                  aria-label={`Bỏ ảnh đã chọn ${index + 1}`}
                  className="absolute right-1.5 top-1.5 grid size-8 place-items-center rounded-md bg-white/90 text-slate shadow-sm transition hover:text-red-600"
                  onClick={() => onChange(value.filter((item) => item !== url))}
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <MediaLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        folder={folder}
        multiple
        onSelect={(assets) => {
          appendUrls(assets.map((asset) => asset.url));
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
  multiple?: boolean;
  onSelect: (assets: MediaAsset[]) => void;
}

/** Lưới ảnh có sẵn trong một thư mục để chọn lại, không cần tải mới. */
function MediaLibraryDialog({
  open,
  onOpenChange,
  folder,
  multiple = false,
  onSelect,
}: MediaLibraryDialogProps) {
  // Chỉ gọi API khi dialog mở — tránh nạp thư viện lúc chưa cần.
  const { data: media = [], isLoading } = useMedia(open ? folder : undefined);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) setSelectedIds([]);
  }, [open]);

  function choose(asset: MediaAsset) {
    if (!multiple) {
      onSelect([asset]);
      return;
    }
    setSelectedIds((current) =>
      current.includes(asset.id)
        ? current.filter((id) => id !== asset.id)
        : [...current, asset.id],
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Chọn ảnh từ thư viện</DialogTitle>
          <DialogDescription>Thư viện media</DialogDescription>
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
                onClick={() => choose(asset)}
                aria-pressed={multiple ? selectedIds.includes(asset.id) : undefined}
                className={`group relative overflow-hidden rounded-lg border bg-cream text-left transition hover:border-brand focus-visible:border-brand focus-visible:outline-none ${
                  selectedIds.includes(asset.id)
                    ? "border-brand ring-2 ring-gold/50"
                    : "border-line"
                }`}
                title={fileNameOf(asset)}
              >
                <img
                  src={resolveAssetUrl(asset.url)}
                  alt={fileNameOf(asset)}
                  loading="lazy"
                  className="aspect-3/2 w-full bg-white object-contain transition group-hover:opacity-90"
                />
                {selectedIds.includes(asset.id) && (
                  <span className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-brand text-white shadow">
                    <Check className="size-4" aria-hidden />
                    <span className="sr-only">Đã chọn</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {multiple && media.length > 0 && (
          <DialogFooter>
            <Button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() =>
                onSelect(media.filter((asset) => selectedIds.includes(asset.id)))
              }
            >
              Dùng {selectedIds.length} ảnh đã chọn
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
