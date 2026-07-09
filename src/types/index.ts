// Kiểu dữ liệu khớp với backend NestJS/Prisma (thien-duc-website-backend).
// Chỉ khai báo những field khung UI cần; mở rộng dần khi nối API thật.

export type Role = "EDITOR" | "ADMIN" | "SUPER_ADMIN";

/** Trạng thái nội dung: nháp → chờ duyệt → đã đăng (ContentStatus). */
export type ContentStatus = "DRAFT" | "PENDING" | "PUBLISHED";

/** Trạng thái dự án (ProjectStatus) — khớp enum Prisma của backend. */
export type ProjectStatus =
  | "DA_BAN_GIAO"
  | "DANG_THI_CONG"
  | "CHUAN_BI_KHOI_CONG";

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

/** Một ảnh trong `project_gallery`. `projectItemId` null = ảnh ở cấp dự án. */
export interface ProjectGalleryImage {
  id: string;
  projectId: string;
  projectItemId: string | null;
  url: string;
  caption: Bilingual | null;
  order: number;
  createdAt: string;
}

/** Hạng mục con của dự án (`project_items`). */
export interface ProjectItem {
  id: string;
  projectId: string;
  slug: string;
  title: Bilingual;
  summary: Bilingual | null;
  /** Hạng mục có thể không đặt tình trạng riêng — khi đó lấy theo dự án cha. */
  status: ProjectStatus | null;
  image: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

/** GET /projects/admin — mỗi dự án kèm hạng mục con và số lượng ảnh. */
export interface Project {
  id: string;
  slug: string;
  title: Bilingual;
  summary: Bilingual;
  status: ProjectStatus;
  contentStatus: ContentStatus;
  location: string | null;
  image: string | null;
  category: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
  items: ProjectItem[];
  _count: { galleryImages: number };
}

/** GET /projects/:slug — thêm danh sách ảnh đầy đủ, bỏ `_count`. */
export interface ProjectDetail extends Omit<Project, "_count"> {
  description: Bilingual | null;
  galleryImages: ProjectGalleryImage[];
}

/** Chuyên mục tin (`news_categories`). `_count` chỉ có ở `GET /news/categories`. */
export interface NewsCategory {
  id: string;
  slug: string;
  name: Bilingual;
  order: number;
  _count?: { posts: number };
}

/**
 * Bài viết (`news_posts`). `content` là **mảng đoạn văn** song ngữ chứ không
 * phải một khối HTML — trang công khai render mỗi phần tử thành một thẻ `<p>`.
 */
export interface NewsPost {
  id: string;
  slug: string;
  title: Bilingual;
  summary: Bilingual;
  content: Bilingual[] | null;
  categoryId: string | null;
  category: NewsCategory | null;
  author: string | null;
  image: string | null;
  eventDate: string | null;
  publishedAt: string | null;
  scheduledAt: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StaticPage {
  id: string;
  slug: string;
  title: Bilingual;
  /** Nội dung tự do (JSONB) — dùng mảng đoạn văn giống `NewsPost.content`. */
  content: Bilingual[] | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Banner {
  id: string;
  image: string;
  eyebrow: Bilingual | null;
  title: Bilingual;
  subtitle: Bilingual | null;
  href: string;
  ctaLabel: Bilingual | null;
  objectPosition: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Form liên hệ (`contact_submissions`). */
export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  inquiryType: string | null;
  message: string;
  status: LeadStatus;
  /** Ghi chú nội bộ của Admin — không hiển thị ra ngoài website. */
  internalNote: string | null;
  ipAddress: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Ảnh trên Cloudinary (`media_assets`). */
export interface MediaAsset {
  id: string;
  url: string;
  /** Đường dẫn đầy đủ kể cả thư mục — cần nguyên vẹn thì xóa mới đúng ảnh. */
  publicId: string | null;
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number | null;
  folder: string | null;
  uploadedById: string | null;
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
