// Service dự án hợp tác — nối module `cooperation` của backend:
//   GET    /cooperation/admin      -> CooperationProject[]  (kể cả nháp/chờ duyệt)
//   GET    /cooperation/admin/:id  -> CooperationProject
//   POST   /cooperation            -> CooperationProject     (EDITOR trở lên)
//   PATCH  /cooperation/reorder    -> CooperationProject[]   (ghi lại `order`)
//   PATCH  /cooperation/:id        -> CooperationProject
//   PATCH  /cooperation/:id/status -> CooperationProject     (ADMIN trở lên)
//   PATCH  /cooperation/:id/schedule -> CooperationProject   (đặt/đổi lịch — ADMIN trở lên)
//   DELETE /cooperation/:id/schedule -> CooperationProject   (huỷ lịch chưa tới hạn)
//   DELETE /cooperation/:id        -> { deleted }            (ADMIN trở lên)
//
// `GET /cooperation` công khai chỉ trả bản PUBLISHED — Admin CMS dùng `/admin`.

import { apiFetch } from "./client";
import type { Bilingual, ContentStatus, CooperationProject } from "@/types";

export interface CreateCooperationInput {
  name: Bilingual;
  location: Bilingual;
  role: Bilingual;
  partner: Bilingual;
  scale: Bilingual;
  status: Bilingual;
  image?: string;
  order?: number;
  // KHÔNG có `contentStatus`, `scheduledAt`, `publishedAt`: backend đã gỡ ba
  // field này khỏi DTO nội dung và `forbidNonWhitelisted` trả 400 nếu gửi lên.
  // Đăng và hẹn giờ là lệnh riêng, có phân quyền riêng.
}

export type UpdateCooperationInput = Partial<CreateCooperationInput>;

export function listCooperationProjects(): Promise<CooperationProject[]> {
  return apiFetch<CooperationProject[]>("/cooperation/admin");
}

export function createCooperationProject(
  input: CreateCooperationInput,
): Promise<CooperationProject> {
  return apiFetch<CooperationProject>("/cooperation", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateCooperationProject(
  id: string,
  input: UpdateCooperationInput,
): Promise<CooperationProject> {
  return apiFetch<CooperationProject>(`/cooperation/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function updateCooperationStatus(
  id: string,
  status: ContentStatus,
): Promise<CooperationProject> {
  return apiFetch<CooperationProject>(`/cooperation/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/**
 * Backend bắt gửi **đủ** id của mọi dự án hợp tác theo thứ tự mong muốn — gửi
 * thiếu sẽ bị từ chối (400) vì bản vắng mặt giữ `order` cũ, xen lẫn vào dãy mới.
 */
export function reorderCooperationProjects(
  ids: string[],
): Promise<CooperationProject[]> {
  return apiFetch<CooperationProject[]>("/cooperation/reorder", {
    method: "PATCH",
    body: JSON.stringify({ cooperationProjectIds: ids }),
  });
}

/**
 * Đặt / đổi lịch đăng — lệnh RIÊNG, không đi qua `PATCH /cooperation/:id`.
 *
 * `scheduledAt` bắt buộc là instant ISO-8601 **kèm múi giờ tường minh**
 * (`2026-08-20T08:00:00+07:00`). Backend từ chối chuỗi không có offset: nó phụ
 * thuộc múi giờ máy chủ, mà đây là field quyết định *khi nào nội dung ra công
 * khai*.
 *
 * Backend ghi nguyên tử `contentStatus = PENDING`, `scheduledAt` và
 * `publishedAt` cùng bằng mốc đã hẹn, KHÔNG chạm `status` (chữ mô tả). Chỉ dành
 * cho lần công khai ĐẦU TIÊN — bản đã/từng đăng trả 409.
 *
 * Đây cũng là cách **duyệt bằng lịch** một bản do biên tập viên gửi lên.
 */
export function scheduleCooperationPublication(
  id: string,
  scheduledAt: string,
): Promise<CooperationProject> {
  return apiFetch<CooperationProject>(
    `/cooperation/${encodeURIComponent(id)}/schedule`,
    { method: "PATCH", body: JSON.stringify({ scheduledAt }) },
  );
}

/**
 * Huỷ lịch đăng CHƯA tới hạn — bản ghi về `DRAFT`, xoá cả `scheduledAt` lẫn
 * `publishedAt` (mốc chưa từng thành sự thật), tức thu hồi luôn phê duyệt. Lịch
 * đã qua giờ trả 409: khi đó dự án hợp tác đang hiển thị công khai, việc cần làm
 * là "Trả về nháp".
 */
export function cancelCooperationPublication(
  id: string,
): Promise<CooperationProject> {
  return apiFetch<CooperationProject>(
    `/cooperation/${encodeURIComponent(id)}/schedule`,
    { method: "DELETE" },
  );
}

export function deleteCooperationProject(
  id: string,
): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/cooperation/${id}`, {
    method: "DELETE",
  });
}
