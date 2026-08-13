// Service tin tức — nối module `news` của backend:
//   GET    /news/admin          -> NewsPost[]   (kể cả nháp/chờ duyệt)
//   GET    /news/admin/:slug    -> NewsPost
//   POST   /news                -> NewsPost     (EDITOR trở lên)
//   PATCH  /news/:slug          -> NewsPost
//   PATCH  /news/:slug/status   -> NewsPost     (duyệt — ADMIN trở lên)
//   PATCH  /news/:slug/schedule -> NewsPost     (đặt/đổi lịch — ADMIN trở lên)
//   DELETE /news/:slug/schedule -> NewsPost     (huỷ lịch chưa tới hạn)
//   DELETE /news/:slug          -> { deleted }  (ADMIN trở lên)
//
//   GET    /news/categories           -> NewsCategory[] (công khai, chỉ publishedCount)
//   GET    /news/categories/admin     -> NewsCategory[] (kèm totalCount)
//   POST   /news/categories           -> NewsCategory
//   PATCH  /news/categories/:slug     -> NewsCategory   (KHÔNG sửa được slug)
//   DELETE /news/categories/:slug     -> { deleted }    (409 nếu còn bài)
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
  // CỐ Ý không có `scheduledAt`: backend đã gỡ field này khỏi DTO nội dung
  // (chốt bảo mật — EDITOR sửa được bài nhưng không được uỷ quyền đăng trong
  // tương lai) và `forbidNonWhitelisted` sẽ trả 400 nếu payload có nó. Đặt lịch
  // đi qua route lệnh riêng bên dưới.
}

export type UpdateNewsPostInput = Partial<CreateNewsPostInput>;

export function listNews(): Promise<NewsPost[]> {
  return apiFetch<NewsPost[]>("/news/admin");
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

/**
 * Đặt hoặc đổi lịch đăng — route LỆNH riêng, chốt ADMIN trở lên.
 *
 * `scheduledAt` bắt buộc là instant ISO-8601 **kèm múi giờ tường minh**
 * (`2026-08-20T08:00:00+07:00`). Chuỗi trần không có offset bị backend từ chối
 * 400 vì nó được diễn giải theo múi giờ tiến trình — dùng
 * `composeVietnamInstant()` để dựng, đừng dùng `new Date(...).toISOString()`
 * trên giá trị của ô nhập.
 *
 * Backend ghi nguyên tử `status = PENDING`, `scheduledAt` và `publishedAt` cùng
 * bằng mốc đã hẹn, nên response trả về đủ để UI vẽ lại trạng thái "Đã lên lịch".
 */
export function scheduleNewsPublication(
  slug: string,
  scheduledAt: string,
): Promise<NewsPost> {
  return apiFetch<NewsPost>(`/news/${encodeURIComponent(slug)}/schedule`, {
    method: "PATCH",
    body: JSON.stringify({ scheduledAt }),
  });
}

/**
 * Huỷ lịch đăng CHƯA tới hạn — bài về `DRAFT`, xoá cả `scheduledAt` lẫn
 * `publishedAt` (mốc chưa bao giờ thành sự thật).
 *
 * 409 nếu lịch đã qua giờ: khi đó bài đang hiển thị công khai và việc cần làm
 * là "Trả về nháp", không phải huỷ lịch.
 */
export function cancelNewsPublication(slug: string): Promise<NewsPost> {
  return apiFetch<NewsPost>(`/news/${encodeURIComponent(slug)}/schedule`, {
    method: "DELETE",
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

/**
 * Danh sách cho màn quản lý chuyên mục — kèm `totalCount`.
 *
 * Bắt buộc dùng route `/admin`: route công khai cố ý KHÔNG trả tổng số bài (nó
 * gộp cả bài nháp), nên Admin không thể suy ra con số quyết định "có xóa được
 * không" từ đó.
 */
export function listNewsCategoriesForAdmin(): Promise<NewsCategory[]> {
  return apiFetch<NewsCategory[]>("/news/categories/admin");
}

export interface CreateNewsCategoryInput {
  slug: string;
  name: Bilingual;
  order?: number;
}

export function createNewsCategory(
  input: CreateNewsCategoryInput,
): Promise<NewsCategory> {
  return apiFetch<NewsCategory>("/news/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** 409 `CATEGORY_IN_USE` nếu chuyên mục còn bài viết (mọi trạng thái). */
export function deleteNewsCategory(slug: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(
    `/news/categories/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
}

/**
 * Sửa chuyên mục (PATCH /news/categories/:slug). Backend nhận `Partial` của
 * DTO tạo mới nên chỉ cần gửi field muốn đổi — ở đây là `name` song ngữ để bổ
 * sung bản dịch tiếng Anh. Không đổi `slug` để giữ liên kết công khai.
 */
export interface UpdateNewsCategoryInput {
  name?: Bilingual;
  order?: number;
}

export function updateNewsCategory(
  slug: string,
  input: UpdateNewsCategoryInput,
): Promise<NewsCategory> {
  return apiFetch<NewsCategory>(
    `/news/categories/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}
