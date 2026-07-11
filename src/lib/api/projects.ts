// Service dự án — nối API thật của backend NestJS (module `projects`):
//   GET    /projects/admin                    -> Project[]      (kể cả nháp/chờ duyệt)
//   GET    /projects/:slug                    -> ProjectDetail
//   POST   /projects                          -> Project        (EDITOR trở lên)
//   PATCH  /projects/:slug                    -> Project
//   PATCH  /projects/:slug/status             -> Project        (duyệt — ADMIN trở lên)
//   DELETE /projects/:slug                    -> { deleted }    (ADMIN trở lên)
//
//   POST   /projects/:slug/items              -> ProjectItem
//   PATCH  /projects/:slug/items/:itemSlug    -> ProjectItem
//   DELETE /projects/:slug/items/:itemSlug    -> { deleted }    (ADMIN trở lên)
//
//   GET    /projects/:slug/gallery            -> ProjectGalleryImage[]
//   POST   /projects/:slug/gallery            -> ProjectGalleryImage
//   PATCH  /projects/:slug/gallery/reorder    -> ProjectGalleryImage[]
//   PATCH  /projects/:slug/gallery/:imageId   -> ProjectGalleryImage
//   DELETE /projects/:slug/gallery/:imageId   -> { deleted }
//
// Backend trả message tiếng Việt cho lỗi nghiệp vụ (slug trùng → 409) — UI chỉ
// việc đưa qua `resolveApiError` rồi hiện toast.

import { apiFetch } from "./client";
import type {
  Bilingual,
  ContentStatus,
  Project,
  ProjectDetail,
  ProjectFact,
  ProjectGalleryImage,
  ProjectItem,
  ProjectMapLocation,
  ProjectStatus,
} from "@/types";

export interface CreateProjectInput {
  slug: string;
  title: Bilingual;
  summary: Bilingual;
  status: ProjectStatus;
  location?: string;
  category?: string;
  image?: string;
  description?: Bilingual;
  /** Mảng field song ngữ; gửi cả `.vi` và `.en` để không mất bản dịch. */
  highlights?: Bilingual[];
  quickFacts?: ProjectFact[];
  mapLocation?: ProjectMapLocation;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

export interface CreateProjectItemInput {
  slug: string;
  title: Bilingual;
  summary?: Bilingual;
  status?: ProjectStatus;
  image?: string;
}

export type UpdateProjectItemInput = Partial<CreateProjectItemInput>;

export interface CreateGalleryImageInput {
  url: string;
  caption?: Bilingual;
  /** Slug hạng mục nếu ảnh thuộc hạng mục con; bỏ trống = ảnh của dự án. */
  itemSlug?: string;
}

export interface UpdateGalleryImageInput {
  url?: string;
  caption?: Bilingual;
  /** Chuỗi rỗng = gỡ ảnh khỏi hạng mục, đưa về cấp dự án (quy ước của backend). */
  itemSlug?: string;
}

/* -------------------------------- Dự án --------------------------------- */

/** Danh sách cho Admin CMS: gồm cả bản nháp và bài chờ duyệt. */
export function listProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/projects/admin");
}

/** Route `admin` — route công khai `/projects/:slug` chỉ trả dự án đã xuất bản. */
export function getProject(slug: string): Promise<ProjectDetail> {
  return apiFetch<ProjectDetail>(`/projects/admin/${slug}`);
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return apiFetch<Project>("/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProject(
  slug: string,
  input: UpdateProjectInput,
): Promise<Project> {
  return apiFetch<Project>(`/projects/${slug}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Duyệt / trả lại nội dung (nháp → chờ duyệt → đã đăng). Chỉ ADMIN trở lên. */
export function updateProjectStatus(
  slug: string,
  status: ContentStatus,
): Promise<Project> {
  return apiFetch<Project>(`/projects/${slug}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** Xóa dự án — hạng mục và ảnh xóa theo cascade. Chỉ ADMIN trở lên. */
export function deleteProject(slug: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/projects/${slug}`, {
    method: "DELETE",
  });
}

/* ----------------------------- Hạng mục con ------------------------------ */

export function createProjectItem(
  slug: string,
  input: CreateProjectItemInput,
): Promise<ProjectItem> {
  return apiFetch<ProjectItem>(`/projects/${slug}/items`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateProjectItem(
  slug: string,
  itemSlug: string,
  input: UpdateProjectItemInput,
): Promise<ProjectItem> {
  return apiFetch<ProjectItem>(`/projects/${slug}/items/${itemSlug}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteProjectItem(
  slug: string,
  itemSlug: string,
): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/projects/${slug}/items/${itemSlug}`, {
    method: "DELETE",
  });
}

/* ------------------------------ Thư viện ảnh ----------------------------- */

export function listGallery(slug: string): Promise<ProjectGalleryImage[]> {
  return apiFetch<ProjectGalleryImage[]>(`/projects/admin/${slug}/gallery`);
}

export function addGalleryImage(
  slug: string,
  input: CreateGalleryImageInput,
): Promise<ProjectGalleryImage> {
  return apiFetch<ProjectGalleryImage>(`/projects/${slug}/gallery`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateGalleryImage(
  slug: string,
  imageId: string,
  input: UpdateGalleryImageInput,
): Promise<ProjectGalleryImage> {
  return apiFetch<ProjectGalleryImage>(`/projects/${slug}/gallery/${imageId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteGalleryImage(
  slug: string,
  imageId: string,
): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(`/projects/${slug}/gallery/${imageId}`, {
    method: "DELETE",
  });
}

/**
 * Sắp xếp lại thư viện. Backend đòi **đủ** id ảnh của dự án trong một lần gọi
 * (thiếu → 409), nên luôn truyền toàn bộ danh sách đang hiển thị.
 */
export function reorderGallery(
  slug: string,
  imageIds: string[],
): Promise<ProjectGalleryImage[]> {
  return apiFetch<ProjectGalleryImage[]>(`/projects/${slug}/gallery/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ imageIds }),
  });
}
