import { apiFetch } from "./client";
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
