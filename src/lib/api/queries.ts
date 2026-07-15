// Các hook lấy dữ liệu bằng TanStack Query (mục 2.5 — "Lấy dữ liệu: TanStack Query").
//
// Toàn bộ hook đã nối API thật — không còn mock data trong Admin CMS.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as bannersApi from "./banners";
import * as contactApi from "./contact";
import * as cooperationApi from "./cooperation";
import * as mediaApi from "./media";
import * as newsApi from "./news";
import * as pagesApi from "./pages";
import * as projectsApi from "./projects";
import * as usersApi from "./users";
import type { ContentStatus } from "@/types";

export const queryKeys = {
  projects: ["projects"] as const,
  news: ["news"] as const,
  newsCategories: ["news", "categories"] as const,
  pages: ["pages"] as const,
  banners: ["banners"] as const,
  cooperation: ["cooperation"] as const,
  leads: ["leads"] as const,
  media: ["media"] as const,
  users: ["users"] as const,
  myProfile: ["my-profile"] as const,
  profileRequests: ["profile-requests"] as const,
};

/* -------------------------------------------------------------------------
   Liên hệ (lead) — /contact
   ------------------------------------------------------------------------- */

// `/contact` chỉ dành cho ADMIN/SUPER_ADMIN — truyền `enabled: false` để EDITOR
// không gọi và nổ 403. Giữ nguyên queryKey theo quy ước.
export function useLeads(enabled = true) {
  return useQuery({
    queryKey: queryKeys.leads,
    queryFn: contactApi.listLeads,
    enabled,
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: contactApi.UpdateLeadInput }) =>
      contactApi.updateLead(id, data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.leads }),
  });
}

/* -------------------------------------------------------------------------
   Tin tức — /news
   ------------------------------------------------------------------------- */

export function useNews() {
  return useQuery({ queryKey: queryKeys.news, queryFn: newsApi.listNews });
}

export function useNewsCategories() {
  return useQuery({
    queryKey: queryKeys.newsCategories,
    queryFn: newsApi.listNewsCategories,
  });
}

/**
 * `queryKeys.news` là tiền tố của `queryKeys.newsCategories`, nên một lần
 * invalidate làm mới cả bài viết lẫn chuyên mục — `_count.posts` của chuyên mục
 * đổi mỗi khi thêm/xóa bài.
 */
function useNewsMutation<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.news }),
  });
}

export function useCreateNews() {
  return useNewsMutation(newsApi.createNews);
}

export function useUpdateNews() {
  return useNewsMutation(
    ({ slug, data }: { slug: string; data: newsApi.UpdateNewsPostInput }) =>
      newsApi.updateNews(slug, data),
  );
}

export function useUpdateNewsStatus() {
  return useNewsMutation(
    ({ slug, status }: { slug: string; status: ContentStatus }) =>
      newsApi.updateNewsStatus(slug, status),
  );
}

export function useDeleteNews() {
  return useNewsMutation(newsApi.deleteNews);
}

/* -------------------------------------------------------------------------
   Trang nội dung — /pages
   ------------------------------------------------------------------------- */

export function usePages() {
  return useQuery({ queryKey: queryKeys.pages, queryFn: pagesApi.listPages });
}

function usePagesMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.pages }),
  });
}

export function useCreatePage() {
  return usePagesMutation(pagesApi.createPage);
}

export function useUpdatePage() {
  return usePagesMutation(
    ({ slug, data }: { slug: string; data: pagesApi.UpdatePageInput }) =>
      pagesApi.updatePage(slug, data),
  );
}

export function useUpdatePageStatus() {
  return usePagesMutation(
    ({ slug, status }: { slug: string; status: ContentStatus }) =>
      pagesApi.updatePageStatus(slug, status),
  );
}

/* -------------------------------------------------------------------------
   Banner — /banners
   ------------------------------------------------------------------------- */

export function useBanners() {
  return useQuery({
    queryKey: queryKeys.banners,
    queryFn: bannersApi.listBanners,
  });
}

function useBannersMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.banners }),
  });
}

export function useCreateBanner() {
  return useBannersMutation(bannersApi.createBanner);
}

export function useUpdateBanner() {
  return useBannersMutation(
    ({ id, data }: { id: string; data: bannersApi.UpdateBannerInput }) =>
      bannersApi.updateBanner(id, data),
  );
}

export function useReorderBanners() {
  return useBannersMutation(bannersApi.reorderBanners);
}

/* -------------------------------------------------------------------------
   Dự án hợp tác — /cooperation
   ------------------------------------------------------------------------- */

export function useCooperationProjects() {
  return useQuery({
    queryKey: queryKeys.cooperation,
    queryFn: cooperationApi.listCooperationProjects,
  });
}

function useCooperationMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.cooperation }),
  });
}

export function useCreateCooperationProject() {
  return useCooperationMutation(cooperationApi.createCooperationProject);
}

export function useUpdateCooperationProject() {
  return useCooperationMutation(
    ({ id, data }: { id: string; data: cooperationApi.UpdateCooperationInput }) =>
      cooperationApi.updateCooperationProject(id, data),
  );
}

export function useUpdateCooperationStatus() {
  return useCooperationMutation(
    ({ id, status }: { id: string; status: ContentStatus }) =>
      cooperationApi.updateCooperationStatus(id, status),
  );
}

export function useReorderCooperationProjects() {
  return useCooperationMutation(cooperationApi.reorderCooperationProjects);
}

export function useDeleteCooperationProject() {
  return useCooperationMutation(cooperationApi.deleteCooperationProject);
}

/* -------------------------------------------------------------------------
   Thư viện ảnh — /media
   ------------------------------------------------------------------------- */

export function useMedia(folder?: string) {
  return useQuery({
    queryKey: [...queryKeys.media, folder ?? "all"],
    queryFn: () => mediaApi.listMedia(folder),
  });
}

function useMediaMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.media }),
  });
}

export function useUploadMedia() {
  return useMediaMutation(({ file, folder }: { file: File; folder: string }) =>
    mediaApi.uploadMedia(file, folder),
  );
}

export function useDeleteMedia() {
  return useMediaMutation(mediaApi.deleteMedia);
}

/* -------------------------------------------------------------------------
   Dự án — đã nối API thật (/projects).
   ------------------------------------------------------------------------- */

/** Danh sách cho CMS: /projects/admin trả cả bản nháp và bài chờ duyệt. */
export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: projectsApi.listProjects,
  });
}

/** Chi tiết một dự án (kèm hạng mục + ảnh) — chỉ gọi khi modal đang mở. */
export function useProject(slug: string | null) {
  return useQuery({
    queryKey: [...queryKeys.projects, slug],
    queryFn: () => projectsApi.getProject(slug!),
    enabled: slug !== null,
  });
}

/**
 * Mọi thao tác ghi (dự án, hạng mục, ảnh) đều làm mới cả danh sách lẫn chi tiết:
 * `queryKeys.projects` là tiền tố của key chi tiết nên một lần invalidate là đủ.
 */
function useProjectsMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useCreateProject() {
  return useProjectsMutation(projectsApi.createProject);
}

// `data` tách riêng khỏi `slug` định danh: payload cũng có thể chứa `slug` mới.
export function useUpdateProject() {
  return useProjectsMutation(
    ({ slug, data }: { slug: string; data: projectsApi.UpdateProjectInput }) =>
      projectsApi.updateProject(slug, data),
  );
}

export function useUpdateProjectStatus() {
  return useProjectsMutation(
    ({ slug, status }: { slug: string; status: ContentStatus }) =>
      projectsApi.updateProjectStatus(slug, status),
  );
}

export function useDeleteProject() {
  return useProjectsMutation(projectsApi.deleteProject);
}

export function useCreateProjectItem() {
  return useProjectsMutation(
    ({
      slug,
      data,
    }: {
      slug: string;
      data: projectsApi.CreateProjectItemInput;
    }) => projectsApi.createProjectItem(slug, data),
  );
}

export function useUpdateProjectItem() {
  return useProjectsMutation(
    ({
      slug,
      itemSlug,
      data,
    }: {
      slug: string;
      itemSlug: string;
      data: projectsApi.UpdateProjectItemInput;
    }) => projectsApi.updateProjectItem(slug, itemSlug, data),
  );
}

export function useDeleteProjectItem() {
  return useProjectsMutation(
    ({ slug, itemSlug }: { slug: string; itemSlug: string }) =>
      projectsApi.deleteProjectItem(slug, itemSlug),
  );
}

export function useAddGalleryImage() {
  return useProjectsMutation(
    ({
      slug,
      data,
    }: {
      slug: string;
      data: projectsApi.CreateGalleryImageInput;
    }) => projectsApi.addGalleryImage(slug, data),
  );
}

export function useDeleteGalleryImage() {
  return useProjectsMutation(
    ({ slug, imageId }: { slug: string; imageId: string }) =>
      projectsApi.deleteGalleryImage(slug, imageId),
  );
}

export function useReorderGallery() {
  return useProjectsMutation(
    ({ slug, imageIds }: { slug: string; imageIds: string[] }) =>
      projectsApi.reorderGallery(slug, imageIds),
  );
}

/* -------------------------------------------------------------------------
   Tài khoản — đã nối API thật (/users).
   ------------------------------------------------------------------------- */

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: usersApi.listUsers,
  });
}

/** Chi tiết một tài khoản — chỉ gọi khi có id (modal đang mở). */
export function useUser(id: string | null) {
  return useQuery({
    queryKey: [...queryKeys.users, id],
    queryFn: () => usersApi.getUser(id!),
    enabled: id !== null,
  });
}

/** Làm mới danh sách sau mỗi thao tác ghi. */
function useUsersMutation<TArgs, TResult>(
  fn: (args: TArgs) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export function useCreateUser() {
  return useUsersMutation(usersApi.createUser);
}

export function useUpdateUser() {
  return useUsersMutation(
    ({ id, ...input }: usersApi.UpdateUserInput & { id: string }) =>
      usersApi.updateUser(id, input),
  );
}

export function useDeactivateUser() {
  return useUsersMutation(usersApi.deactivateUser);
}

export function useReactivateUser() {
  return useUsersMutation(usersApi.reactivateUser);
}

/* -------------------------------------------------------------------------
   Hồ sơ cá nhân + luồng duyệt — /users/me, /users/profile-requests
   ------------------------------------------------------------------------- */

/** Hồ sơ của người đang đăng nhập (mọi vai trò). */
export function useMyProfile() {
  return useQuery({
    queryKey: queryKeys.myProfile,
    queryFn: usersApi.getMyProfile,
  });
}

/** Gửi cập nhật hồ sơ; làm mới lại hồ sơ và (nếu admin) hàng chờ duyệt. */
export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: usersApi.updateMyProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
      queryClient.invalidateQueries({ queryKey: queryKeys.profileRequests });
    },
  });
}

/** Hàng chờ duyệt hồ sơ — chỉ ADMIN/SUPER_ADMIN gọi (truyền enabled). */
export function useProfileRequests(enabled = true) {
  return useQuery({
    queryKey: queryKeys.profileRequests,
    queryFn: () => usersApi.listProfileRequests(),
    enabled,
  });
}

/** Duyệt/từ chối; làm mới hàng chờ và hồ sơ (phòng khi admin duyệt của mình). */
export function useReviewProfileRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: usersApi.ReviewProfileRequestInput;
    }) => usersApi.reviewProfileRequest(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profileRequests });
      queryClient.invalidateQueries({ queryKey: queryKeys.myProfile });
    },
  });
}
