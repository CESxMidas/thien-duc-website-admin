// Service trang nội dung tĩnh — nối module `pages` của backend:
//   GET    /pages/admin        -> StaticPage[]  (kể cả nháp/chờ duyệt)
//   GET    /pages/admin/:slug  -> StaticPage
//   POST   /pages              -> StaticPage    (EDITOR trở lên)
//   PATCH  /pages/:slug        -> StaticPage
//   PATCH  /pages/:slug/status -> StaticPage    (duyệt — ADMIN trở lên)
//   PATCH  /pages/:slug/schedule -> StaticPage  (đặt/đổi lịch — ADMIN trở lên)
//   DELETE /pages/:slug/schedule -> StaticPage  (huỷ lịch chưa tới hạn)
//   DELETE /pages/:slug        -> { deleted }   (ADMIN trở lên)
//
// `GET /pages` công khai chỉ trả trang đã đăng — Admin CMS phải dùng `/pages/admin`.

import { apiFetch } from "./client";
import type { Bilingual, ContentStatus, StaticPage } from "@/types";

export interface CreatePageInput {
  slug: string;
  title: Bilingual;
  content: Bilingual[];
  // KHÔNG có `status`, `scheduledAt`, `publishedAt`: backend không khai báo ba
  // field này trong DTO nội dung và `forbidNonWhitelisted` trả 400 nếu gửi lên.
  // Đăng và hẹn giờ là lệnh riêng, có phân quyền riêng.
}

export type UpdatePageInput = Partial<CreatePageInput>;

export function listPages(): Promise<StaticPage[]> {
  return apiFetch<StaticPage[]>("/pages/admin");
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

/**
 * Đặt / đổi lịch đăng — lệnh RIÊNG, không đi qua `PATCH /pages/:slug`.
 *
 * `scheduledAt` bắt buộc là instant ISO-8601 **kèm múi giờ tường minh**
 * (`2026-08-20T08:00:00+07:00`). Backend từ chối chuỗi không có offset: nó phụ
 * thuộc múi giờ máy chủ, mà đây là field quyết định *khi nào nội dung ra công
 * khai*.
 *
 * Backend ghi nguyên tử `status = PENDING`, `scheduledAt` và `publishedAt` cùng
 * bằng mốc đã hẹn, KHÔNG chạm nội dung. Chỉ dành cho lần công khai ĐẦU TIÊN —
 * trang đã/từng đăng trả 409. Đây cũng là cách **duyệt bằng lịch** một trang do
 * biên tập viên gửi lên.
 */
export function schedulePagePublication(
  slug: string,
  scheduledAt: string,
): Promise<StaticPage> {
  return apiFetch<StaticPage>(
    `/pages/${encodeURIComponent(slug)}/schedule`,
    { method: "PATCH", body: JSON.stringify({ scheduledAt }) },
  );
}

/**
 * Huỷ lịch đăng CHƯA tới hạn — trang về `DRAFT`, xoá cả `scheduledAt` lẫn
 * `publishedAt` (mốc chưa từng thành sự thật), tức thu hồi luôn phê duyệt. Lịch
 * đã qua giờ trả 409: khi đó trang đang hiển thị công khai, việc cần làm là
 * "Trả về nháp".
 */
export function cancelPagePublication(slug: string): Promise<StaticPage> {
  return apiFetch<StaticPage>(
    `/pages/${encodeURIComponent(slug)}/schedule`,
    { method: "DELETE" },
  );
}
