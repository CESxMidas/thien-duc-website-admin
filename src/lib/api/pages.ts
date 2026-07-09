// Service trang nội dung tĩnh — nối module `pages` của backend:
//   GET    /pages/admin        -> StaticPage[]  (kể cả nháp/chờ duyệt)
//   GET    /pages/admin/:slug  -> StaticPage
//   POST   /pages              -> StaticPage    (EDITOR trở lên)
//   PATCH  /pages/:slug        -> StaticPage
//   PATCH  /pages/:slug/status -> StaticPage    (duyệt — ADMIN trở lên)
//   DELETE /pages/:slug        -> { deleted }   (ADMIN trở lên)
//
// `GET /pages` công khai chỉ trả trang đã đăng — Admin CMS phải dùng `/pages/admin`.

import { apiFetch } from "./client";
import type { Bilingual, ContentStatus, StaticPage } from "@/types";

export interface CreatePageInput {
  slug: string;
  title: Bilingual;
  content: Bilingual[];
}

export type UpdatePageInput = Partial<CreatePageInput>;

export function listPages(): Promise<StaticPage[]> {
  return apiFetch<StaticPage[]>("/pages/admin");
}

export function getPage(slug: string): Promise<StaticPage> {
  return apiFetch<StaticPage>(`/pages/admin/${encodeURIComponent(slug)}`);
}

export function createPage(input: CreatePageInput): Promise<StaticPage> {
  return apiFetch<StaticPage>("/pages", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updatePage(
  slug: string,
  input: UpdatePageInput,
): Promise<StaticPage> {
  return apiFetch<StaticPage>(`/pages/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updatePageStatus(
  slug: string,
  status: ContentStatus,
): Promise<StaticPage> {
  return apiFetch<StaticPage>(`/pages/${encodeURIComponent(slug)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deletePage(slug: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/pages/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}
