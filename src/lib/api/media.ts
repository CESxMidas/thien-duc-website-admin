// Service thư viện ảnh — nối module `media` của backend:
//   GET    /media?folder=            -> MediaAsset[]
//   POST   /media/upload?folder=     -> MediaAsset   (multipart, field `file`)
//   DELETE /media/:id                -> { deleted }  (xóa cả trên Cloudinary)
//
// Backend ép ảnh về ≤1200px/WebP nên không cần nén phía client. Giới hạn 10MB
// và whitelist mime được kiểm ở cả hai đầu — chặn sớm ở đây để người dùng biết
// ngay thay vì chờ upload xong mới nhận lỗi.

import { apiFetch } from "./client";
import type { MediaAsset } from "@/types";

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
];

/** Thư mục chuẩn trên Cloudinary — khớp cách xếp ảnh đã thống nhất. */
export const MEDIA_FOLDERS = [
  { value: "projects", label: "Dự án" },
  { value: "news", label: "Tin tức" },
  { value: "banners", label: "Banner" },
  { value: "pages", label: "Trang nội dung" },
  { value: "misc", label: "Khác" },
] as const;

export function listMedia(folder?: string): Promise<MediaAsset[]> {
  const query = folder ? `?folder=${encodeURIComponent(folder)}` : "";
  return apiFetch<MediaAsset[]>(`/media${query}`);
}

/** Lý do từ chối tệp, hoặc `null` nếu hợp lệ. */
export function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME.includes(file.type)) {
    return `${file.name}: chỉ nhận ảnh JPG, PNG, WebP hoặc AVIF.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name}: vượt quá 10MB.`;
  }
  return null;
}

export function uploadMedia(file: File, folder: string): Promise<MediaAsset> {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<MediaAsset>(
    `/media/upload?folder=${encodeURIComponent(folder)}`,
    { method: "POST", body },
  );
}

export function deleteMedia(id: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/media/${id}`, { method: "DELETE" });
}

/** `1536000` → `1,5 MB`. Cloudinary trả `bytes`, UI cần đơn vị người đọc được. */
export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/** Lấy tên tệp từ publicId để hiển thị, vd `news/2026/abc123` → `abc123`. */
export function fileNameOf(asset: MediaAsset): string {
  const publicId = asset.publicId ?? asset.url;
  return publicId.split("/").pop() ?? publicId;
}
