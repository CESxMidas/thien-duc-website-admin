import { apiFetch, ApiRequestError } from "./client";
import type { Bilingual } from "@/types";

export const cmsKinds = {
  projects: { label: "Dự án" },
  "project-items": { label: "Hạng mục dự án" },
  "project-images": { label: "Ảnh dự án" },
  news: { label: "Tin tức" },
  "news-categories": { label: "Chuyên mục tin tức" },
  pages: { label: "Trang nội dung" },
  banners: { label: "Banner" },
  cooperation: { label: "Dự án hợp tác" },
  recruitment: { label: "Vị trí tuyển dụng" },
  contact: { label: "Yêu cầu liên hệ" },
  media: { label: "Thư viện ảnh" },
  users: { label: "Tài khoản" },
  "profile-requests": { label: "Yêu cầu cập nhật hồ sơ" },
} as const;
export type CmsRecordKind = keyof typeof cmsKinds;
export type CmsDeleteTarget = { id: string; title: string };
export type BulkDeleteResult = {
  succeededIds: string[];
  failed: { id: string; message: string; status: number }[];
  remainingIds: string[];
};

/** Chia lô nhỏ, dừng khi mất quyền/lỗi mạng; không gửi lại các mục đã thành công. */
export async function bulkDeleteRecords(
  kind: CmsRecordKind,
  ids: string[],
  permanent: boolean,
): Promise<BulkDeleteResult> {
  const result: BulkDeleteResult = {
    succeededIds: [],
    failed: [],
    remainingIds: [],
  };
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100);
    try {
      const response = await apiFetch<BulkDeleteResult>(
        `/cms-trash/${kind}/bulk-delete`,
        {
          method: "POST",
          body: JSON.stringify({
            ids: batch,
            mode: permanent ? "permanent" : "trash",
            ...(permanent ? { confirm: true } : {}),
          }),
        },
      );
      result.succeededIds.push(...response.succeededIds);
      result.failed.push(...response.failed);
      if (
        response.remainingIds.length ||
        response.failed.some(
          (item) => [401, 403, 429].includes(item.status) || item.status >= 500,
        )
      ) {
        result.remainingIds.push(
          ...response.remainingIds,
          ...ids.slice(offset + batch.length),
        );
        break;
      }
    } catch (error) {
      result.failed.push({
        id: batch[0],
        message:
          error instanceof Error
            ? error.message
            : "Không xóa được các mục đã chọn.",
        status: error instanceof ApiRequestError ? error.status : 500,
      });
      result.remainingIds.push(...ids.slice(offset + 1));
      break;
    }
  }
  return result;
}
export type TrashItem = {
  id: string;
  title: string | Bilingual | null;
  deletedAt: string;
  deletedBy: string | null;
};
export type TrashList = {
  items: TrashItem[];
  total: number;
  page: number;
  pageSize: number;
};
export const listTrash = (kind: CmsRecordKind, page: number) =>
  apiFetch<TrashList>(`/cms-trash/${kind}?page=${page}`);
export const trashRecord = (kind: CmsRecordKind, id: string) =>
  apiFetch(`/cms-trash/${kind}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
export const restoreRecord = (kind: CmsRecordKind, id: string) =>
  apiFetch(`/cms-trash/${kind}/${encodeURIComponent(id)}/restore`, {
    method: "POST",
  });
export const purgeRecord = (kind: CmsRecordKind, id: string) =>
  apiFetch(`/cms-trash/${kind}/${encodeURIComponent(id)}/permanent`, {
    method: "DELETE",
    body: JSON.stringify({ confirm: true }),
  });
