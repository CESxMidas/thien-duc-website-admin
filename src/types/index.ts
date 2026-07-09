// Kiểu dữ liệu khớp với backend NestJS/Prisma (thien-duc-website-backend).
// Chỉ khai báo những field khung UI cần; mở rộng dần khi nối API thật.

export type Role = "EDITOR" | "ADMIN" | "SUPER_ADMIN";

/** Trạng thái nội dung: nháp → chờ duyệt → đã đăng (ContentStatus). */
export type ContentStatus = "DRAFT" | "PENDING" | "PUBLISHED";

/** Trạng thái dự án (ProjectStatus). */
export type ProjectStatus =
  | "DA_BAN_GIAO"
  | "DANG_THI_CONG"
  | "SAP_MO_BAN"
  | "DANG_MO_BAN";

/** Trạng thái xử lý form liên hệ (lead). */
export type LeadStatus = "NEW" | "IN_PROGRESS" | "DONE";

/** Field song ngữ backend lưu dạng { vi, en? }. */
export interface Bilingual {
  vi: string;
  en?: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  location: string;
  status: ProjectStatus;
  contentStatus: ContentStatus;
  updatedAt: string;
}

export interface NewsPost {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: ContentStatus;
  updatedAt: string;
}

export interface StaticPage {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  updatedAt: string;
}

export interface Banner {
  id: string;
  title: string;
  order: number;
  isActive: boolean;
  updatedAt: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  message: string;
  status: LeadStatus;
  createdAt: string;
}

export interface MediaAsset {
  id: string;
  url: string;
  filename: string;
  sizeKb: number;
  createdAt: string;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

/** GET /users/:id — chi tiết một tài khoản (modal xem thông tin). */
export interface AdminUserDetail extends AdminUser {
  updatedAt: string;
  /** Hạn khóa tạm do đăng nhập sai nhiều lần; null = không bị khóa tạm. */
  lockedUntil: string | null;
}
