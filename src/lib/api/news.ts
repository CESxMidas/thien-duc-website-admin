// Service tin tức — nối module `news` của backend:
//   GET    /news/admin          -> NewsPost[]   (kể cả nháp/chờ duyệt)
//   GET    /news/admin/:slug    -> NewsPost
//   POST   /news                -> NewsPost     (EDITOR trở lên)
//   PATCH  /news/:slug          -> NewsPost
//   PATCH  /news/:slug/status   -> NewsPost     (duyệt — ADMIN trở lên)
//   DELETE /news/:slug          -> { deleted }  (ADMIN trở lên)
//
//   GET    /news/categories           -> NewsCategory[] (công khai, kèm _count)
//   POST   /news/categories           -> NewsCategory
//   PATCH  /news/categories/:slug     -> NewsCategory
//   DELETE /news/categories/:slug     -> { deleted }
//
// Lưu ý: `GET /news` (không có `/admin`) chỉ trả bài đã đăng — dùng cho trang
// công khai. Admin CMS luôn phải gọi `/news/admin`, nếu không sẽ không thấy bài
// nháp của chính mình.

import { apiFetch } from "./client";
import type { Bilingual, ContentStatus, NewsCategory, NewsPost } from "@/types";

export interface CreateNewsPostInput {
  slug: string;
  title: Bilingual;
  summary: Bilingual;
  content?: Bilingual[];
  categoryId?: string;
  author?: string;
  image?: string;
  /** ISO date, vd `2021-03-31`. */
  eventDate?: string;
  scheduledAt?: string;
}

export type UpdateNewsPostInput = Partial<CreateNewsPostInput>;

export interface CreateNewsCategoryInput {
  slug: string;
  name: Bilingual;
  order?: number;
}

export type UpdateNewsCategoryInput = Partial<CreateNewsCategoryInput>;

export function listNews(): Promise<NewsPost[]> {
  return apiFetch<NewsPost[]>("/news/admin");
}

export function getNews(slug: string): Promise<NewsPost> {
  return apiFetch<NewsPost>(`/news/admin/${encodeURIComponent(slug)}`);
}

export function createNews(input: CreateNewsPostInput): Promise<NewsPost> {
  return apiFetch<NewsPost>("/news", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNews(
  slug: string,
  input: UpdateNewsPostInput,
): Promise<NewsPost> {
  return apiFetch<NewsPost>(`/news/${encodeURIComponent(slug)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateNewsStatus(
  slug: string,
  status: ContentStatus,
): Promise<NewsPost> {
  return apiFetch<NewsPost>(`/news/${encodeURIComponent(slug)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function deleteNews(slug: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/news/${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

export function listNewsCategories(): Promise<NewsCategory[]> {
  return apiFetch<NewsCategory[]>("/news/categories");
}

export function createNewsCategory(
  input: CreateNewsCategoryInput,
): Promise<NewsCategory> {
  return apiFetch<NewsCategory>("/news/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateNewsCategory(
  slug: string,
  input: UpdateNewsCategoryInput,
): Promise<NewsCategory> {
  return apiFetch<NewsCategory>(
    `/news/categories/${encodeURIComponent(slug)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteNewsCategory(slug: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(
    `/news/categories/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
}
