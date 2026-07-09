// Service banner trang chủ — nối module `banners` của backend:
//   GET    /banners/admin     -> Banner[]      (kể cả banner đã tắt)
//   GET    /banners/admin/:id -> Banner
//   POST   /banners           -> Banner        (EDITOR trở lên)
//   PATCH  /banners/reorder   -> Banner[]      (ghi lại `order`)
//   PATCH  /banners/:id       -> Banner
//   DELETE /banners/:id       -> { deleted }   (ADMIN trở lên)
//
// `GET /banners` công khai chỉ trả banner đang bật — Admin CMS dùng `/banners/admin`.

import { apiFetch } from "./client";
import type { Banner, Bilingual } from "@/types";

export interface CreateBannerInput {
  image: string;
  title: Bilingual;
  href: string;
  eyebrow?: Bilingual;
  subtitle?: Bilingual;
  ctaLabel?: Bilingual;
  objectPosition?: string;
  order?: number;
  isActive?: boolean;
}

export type UpdateBannerInput = Partial<CreateBannerInput>;

export function listBanners(): Promise<Banner[]> {
  return apiFetch<Banner[]>("/banners/admin");
}

export function getBanner(id: string): Promise<Banner> {
  return apiFetch<Banner>(`/banners/admin/${id}`);
}

export function createBanner(input: CreateBannerInput): Promise<Banner> {
  return apiFetch<Banner>("/banners", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateBanner(
  id: string,
  input: UpdateBannerInput,
): Promise<Banner> {
  return apiFetch<Banner>(`/banners/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/**
 * Backend bắt gửi **đủ** id của mọi banner theo thứ tự mong muốn — gửi thiếu sẽ
 * bị từ chối (400) vì banner vắng mặt giữ `order` cũ và xen lẫn vào dãy mới.
 */
export function reorderBanners(bannerIds: string[]): Promise<Banner[]> {
  return apiFetch<Banner[]>("/banners/reorder", {
    method: "PATCH",
    body: JSON.stringify({ bannerIds }),
  });
}

export function deleteBanner(id: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/banners/${id}`, { method: "DELETE" });
}
