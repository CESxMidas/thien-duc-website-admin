// Các hook lấy dữ liệu bằng TanStack Query (mục 2.5 — "Lấy dữ liệu: TanStack Query").
//
// Hiện tại queryFn trả về mock data (dựng khung). Khi nối backend thật chỉ cần
// đổi thân queryFn thành `apiFetch<T>('/duong-dan')` — giữ nguyên queryKey và
// mọi component đang dùng hook.

import { useQuery } from "@tanstack/react-query";
import {
  mockBanners,
  mockLeads,
  mockMedia,
  mockNews,
  mockPages,
  mockProjects,
  mockUsers,
} from "@/data/mock";
// import { apiFetch } from "./client"; // bật khi nối API thật

/** Giả lập độ trễ mạng để thấy trạng thái loading của khung. */
function mockAsync<T>(data: T, ms = 350): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

export const queryKeys = {
  projects: ["projects"] as const,
  news: ["news"] as const,
  pages: ["pages"] as const,
  banners: ["banners"] as const,
  leads: ["leads"] as const,
  media: ["media"] as const,
  users: ["users"] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => mockAsync(mockProjects),
    // queryFn: () => apiFetch<Project[]>("/projects"),
  });
}

export function useNews() {
  return useQuery({
    queryKey: queryKeys.news,
    queryFn: () => mockAsync(mockNews),
  });
}

export function usePages() {
  return useQuery({
    queryKey: queryKeys.pages,
    queryFn: () => mockAsync(mockPages),
  });
}

export function useBanners() {
  return useQuery({
    queryKey: queryKeys.banners,
    queryFn: () => mockAsync(mockBanners),
  });
}

export function useLeads() {
  return useQuery({
    queryKey: queryKeys.leads,
    queryFn: () => mockAsync(mockLeads),
  });
}

export function useMedia() {
  return useQuery({
    queryKey: queryKeys.media,
    queryFn: () => mockAsync(mockMedia),
  });
}

export function useUsers() {
  return useQuery({
    queryKey: queryKeys.users,
    queryFn: () => mockAsync(mockUsers),
  });
}
