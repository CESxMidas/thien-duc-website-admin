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

/**
 * Một dòng thông số nhanh của dự án (`quick_facts`) — nhãn + giá trị **song ngữ**
 * (EN-FULL-C3). Chấp nhận cả `string` để tương thích dữ liệu cũ (chưa song ngữ
 * hóa); Admin luôn ghi lại dạng `Bilingual`.
 */
export interface ProjectFact {
  label: Bilingual | string;
  value: Bilingual | string;
}

/** Loại nhãn vẽ đè lên ảnh bản đồ nền của dự án. */
export type ProjectMapLabelKind = "place" | "area" | "road" | "direction";

/** Một nhãn chữ trên ảnh bản đồ, vị trí tính theo phần trăm (0-100). */
export interface ProjectMapLabel {
  text: string;
  left: number;
  top: number;
  kind?: ProjectMapLabelKind;
}

/** Khối bản đồ vị trí (`map_location`) — ảnh nền + marker + nhãn. */
export interface ProjectMapLocation {
  image: string;
  googleMapsUrl: string;
  // Prose song ngữ (EN-FULL-C5a); chấp nhận `string` cho dữ liệu cũ chưa migrate.
  heading?: Bilingual | string;
  description?: Bilingual | string;
  address?: Bilingual | string;
  markerLeft: number;
  markerTop: number;
  /** Nhãn chữ vẽ đè lên ảnh nền — hiện chỉ chỉnh qua seed, admin giữ nguyên (C5b). */
  labels?: ProjectMapLabel[];
}

/** Một nhóm ảnh có tiêu đề (`gallery_sections`) hiển thị ở trang chi tiết. */
export interface ProjectGallerySection {
  title: string;
  description?: string;
  images: string[];
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
  /** Nội dung chi tiết; chấp nhận chuỗi thuần để đọc dữ liệu JSON cũ an toàn. */
  description: Bilingual | string | null;
  /** Các điểm nổi bật của riêng hạng mục. */
  highlights: (Bilingual | string)[] | null;
  /** Thông số nhanh (nhãn/giá trị) của riêng hạng mục. */
  quickFacts: ProjectFact[] | null;
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
  /** TÌNH TRẠNG THI CÔNG — không liên quan tới bậc thang duyệt/xuất bản. */
  status: ProjectStatus;
  /** Bậc thang duyệt: DRAFT → PENDING → PUBLISHED. */
  contentStatus: ContentStatus;
  /**
   * Mốc công khai LẦN ĐẦU và lịch hẹn đăng (Batch 9) — cùng ngữ nghĩa với
   * `NewsPost`. "Đã lên lịch" là trạng thái SUY RA từ `contentStatus` +
   * `scheduledAt` + `publishedAt`, không phải một giá trị enum lưu xuống DB.
   */
  publishedAt: string | null;
  scheduledAt: string | null;
  location: Bilingual | null;
  image: string | null;
  category: Bilingual | null;
  /** Điểm nổi bật — mảng field song ngữ; UI đọc/sửa `.vi` (EN tùy chọn). */
  highlights: Bilingual[] | null;
  /** Thông số nhanh (nhãn/giá trị). */
  quickFacts: ProjectFact[] | null;
  /** Ảnh gallery cấp dự án (mảng URL) — khác `galleryImages` (bản ghi đầy đủ). */
  gallery: string[];
  gallerySections: ProjectGallerySection[] | null;
  mapLocation: ProjectMapLocation | null;
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

/**
 * Chuyên mục tin (`news_categories`).
 *
 * `publishedCount` có ở CẢ route công khai lẫn route admin — website dùng nó để
 * ẩn chuyên mục chưa có bài đã đăng khỏi bộ lọc.
 *
 * `totalCount` CHỈ có ở `GET /news/categories/admin`: nó gộp cả bài nháp và bài
 * chờ duyệt, là thông tin nội bộ và không được lộ ra route công khai. Admin cần
 * nó để biết chuyên mục có xóa được không.
 */
export interface NewsCategory {
  id: string;
  slug: string;
  name: Bilingual;
  order: number;
  publishedCount: number;
  totalCount?: number;
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

/**
 * Dự án hợp tác (`cooperation_projects`) — hiển thị ở section "Dự án hợp tác"
 * trang chủ. Không có trang chi tiết, không ảnh; mọi field chữ đều song ngữ.
 */
export interface CooperationProject {
  id: string;
  name: Bilingual;
  location: Bilingual;
  role: Bilingual;
  partner: Bilingual;
  scale: Bilingual;
  status: Bilingual;
  /** Ảnh phối cảnh (tùy chọn). */
  image: string | null;
  contentStatus: ContentStatus;
  order: number;
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
  /**
   * Thời điểm tài khoản hoàn tất thiết lập mật khẩu (luồng lời mời).
   * `null` = tài khoản do lời mời tạo ra, đang chờ người dùng tự đặt mật khẩu.
   * `undefined` = backend chưa expose field này trong response (xem
   * getUserStatus): coi như đã hoạt động, không hiện trạng thái "chờ thiết lập".
   */
  setupCompletedAt?: string | null;
}

/** GET /users/:id — chi tiết một tài khoản (modal xem thông tin). */
export interface AdminUserDetail extends AdminUser {
  updatedAt: string;
  /** Hạn khóa tạm do đăng nhập sai nhiều lần; null = không bị khóa tạm. */
  lockedUntil: string | null;
}

/** POST /users/invitations — SUPER_ADMIN tạo tài khoản qua lời mời (không mật khẩu). */
export interface CreateAccountInvitationInput {
  name: string;
  email: string;
  role: Role;
}

/** Metadata lời mời an toàn để hiển thị (KHÔNG bao giờ gồm token thô). */
export interface AccountInvitationMeta {
  id: string;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
}

/** Response của POST /users/invitations: tài khoản mới + metadata lời mời. */
export interface CreateAccountInvitationResult {
  user: AdminUser;
  invitation: AccountInvitationMeta;
}

/** POST /auth/accept-invitation — người được mời tự đặt mật khẩu đầu tiên. */
export interface AcceptInvitationInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/** POST /auth/reset-password — đặt lại mật khẩu bằng token gửi qua email. */
export interface ResetPasswordInput {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/** Trạng thái yêu cầu cập nhật hồ sơ (ProfileChangeStatus của backend). */
export type ProfileChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Các field hồ sơ nhân viên tự cập nhật được (payload yêu cầu). */
export interface ProfilePayload {
  name?: string;
  phone?: string;
  avatarUrl?: string;
  position?: string;
  department?: string;
  bio?: string;
}

/** Một yêu cầu cập nhật hồ sơ đang/đã xử lý. */
export interface ProfileChangeRequest {
  id: string;
  userId: string;
  payload: ProfilePayload;
  status: ProfileChangeStatus;
  reviewNote: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /users/me — hồ sơ đầy đủ của người đang đăng nhập. */
export interface MyProfile {
  id: string;
  email: string;
  name: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  position: string | null;
  department: string | null;
  bio: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Yêu cầu đang chờ duyệt của chính mình (nếu có). */
  pendingRequest: ProfileChangeRequest | null;
}

/** Một dòng trong hàng chờ duyệt — kèm thông tin người gửi/người duyệt. */
export interface ProfileChangeRequestRow extends ProfileChangeRequest {
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    avatarUrl: string | null;
  };
  reviewedBy: { id: string; name: string } | null;
}
