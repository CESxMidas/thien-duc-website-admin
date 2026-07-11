// Service dự án hợp tác — nối module `cooperation` của backend:
//   GET    /cooperation/admin      -> CooperationProject[]  (kể cả nháp/chờ duyệt)
//   GET    /cooperation/admin/:id  -> CooperationProject
//   POST   /cooperation            -> CooperationProject     (EDITOR trở lên)
//   PATCH  /cooperation/reorder    -> CooperationProject[]   (ghi lại `order`)
//   PATCH  /cooperation/:id        -> CooperationProject
//   PATCH  /cooperation/:id/status -> CooperationProject     (ADMIN trở lên)
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
  contentStatus?: ContentStatus;
  order?: number;
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

export function deleteCooperationProject(
  id: string,
): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/cooperation/${id}`, {
    method: "DELETE",
  });
}
