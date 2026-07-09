// Dữ liệu mẫu cho khung Admin CMS — CHỈ để dựng UI, KHÔNG phải nội dung thật.
// Thay bằng lời gọi apiFetch(...) khi nối backend (Sprint 1–3).

import type {
  AdminUser,
  Banner,
  Lead,
  MediaAsset,
  NewsPost,
  Project,
  StaticPage,
} from "@/types";

export const mockProjects: Project[] = [
  {
    id: "p1",
    slug: "khu-do-thi-hung-phu",
    title: "Khu đô thị Hưng Phú",
    location: "TP. Thủ Đức, TP.HCM",
    status: "DANG_MO_BAN",
    contentStatus: "PUBLISHED",
    updatedAt: "2026-07-06T09:12:00Z",
  },
  {
    id: "p2",
    slug: "cao-oc-thien-duc-tower",
    title: "Cao ốc Thiên Đức Tower",
    location: "Quận 2, TP.HCM",
    status: "DANG_THI_CONG",
    contentStatus: "PENDING",
    updatedAt: "2026-07-05T14:40:00Z",
  },
  {
    id: "p3",
    slug: "khu-dan-cu-an-phu",
    title: "Khu dân cư An Phú",
    location: "TP. Thủ Đức, TP.HCM",
    status: "DA_BAN_GIAO",
    contentStatus: "PUBLISHED",
    updatedAt: "2026-06-28T03:20:00Z",
  },
  {
    id: "p4",
    slug: "biet-thu-ven-song",
    title: "Biệt thự ven sông",
    location: "TP. Thủ Đức, TP.HCM",
    status: "SAP_MO_BAN",
    contentStatus: "DRAFT",
    updatedAt: "2026-07-07T02:05:00Z",
  },
];

export const mockNews: NewsPost[] = [
  {
    id: "n1",
    slug: "le-khoi-cong-du-an-hung-phu",
    title: "Lễ khởi công dự án Hưng Phú",
    category: "Tin công ty",
    status: "PUBLISHED",
    updatedAt: "2026-07-04T08:00:00Z",
  },
  {
    id: "n2",
    slug: "chinh-sach-ban-hang-quy-3",
    title: "Chính sách bán hàng quý 3/2026",
    category: "Chính sách",
    status: "PENDING",
    updatedAt: "2026-07-06T10:30:00Z",
  },
  {
    id: "n3",
    slug: "thi-truong-bds-thu-duc",
    title: "Thị trường BĐS khu Đông nửa cuối 2026",
    category: "Thị trường",
    status: "DRAFT",
    updatedAt: "2026-07-07T01:15:00Z",
  },
];

export const mockPages: StaticPage[] = [
  {
    id: "pg1",
    slug: "gioi-thieu",
    title: "Giới thiệu công ty",
    status: "PUBLISHED",
    updatedAt: "2026-06-20T07:00:00Z",
  },
  {
    id: "pg2",
    slug: "chinh-sach-nhan-su",
    title: "Chính sách nhân sự",
    status: "DRAFT",
    updatedAt: "2026-07-01T09:00:00Z",
  },
  {
    id: "pg3",
    slug: "dao-tao-phat-trien",
    title: "Đào tạo & phát triển",
    status: "DRAFT",
    updatedAt: "2026-07-01T09:05:00Z",
  },
];

export const mockBanners: Banner[] = [
  {
    id: "b1",
    title: "Banner Hưng Phú — mở bán đợt 1",
    order: 1,
    isActive: true,
    updatedAt: "2026-07-05T04:00:00Z",
  },
  {
    id: "b2",
    title: "Banner năng lực thi công",
    order: 2,
    isActive: true,
    updatedAt: "2026-07-02T04:00:00Z",
  },
  {
    id: "b3",
    title: "Banner tuyển dụng 2026",
    order: 3,
    isActive: false,
    updatedAt: "2026-06-30T04:00:00Z",
  },
];

export const mockLeads: Lead[] = [
  {
    id: "l1",
    name: "Nguyễn Văn A",
    phone: "0938759156",
    email: "vana@example.com",
    message: "Xin thông tin bảng giá dự án Hưng Phú.",
    status: "NEW",
    createdAt: "2026-07-08T02:30:00Z",
  },
  {
    id: "l2",
    name: "Trần Thị B",
    phone: "0901234567",
    email: null,
    message: "Cần tư vấn suất mua căn góc.",
    status: "IN_PROGRESS",
    createdAt: "2026-07-07T11:10:00Z",
  },
  {
    id: "l3",
    name: "Lê Văn C",
    phone: "0977111222",
    email: "levanc@example.com",
    message: "Hỏi tiến độ bàn giao khu An Phú.",
    status: "DONE",
    createdAt: "2026-07-06T06:45:00Z",
  },
];

export const mockMedia: MediaAsset[] = Array.from({ length: 8 }, (_, i) => ({
  id: `m${i + 1}`,
  url: "",
  filename: `anh-du-an-${String(i + 1).padStart(2, "0")}.webp`,
  sizeKb: 320 + i * 45,
  createdAt: "2026-07-05T05:00:00Z",
}));

export const mockUsers: AdminUser[] = [
  {
    id: "u1",
    name: "Quản trị viên",
    email: "admin@thienduc.vn",
    role: "SUPER_ADMIN",
    isActive: true,
  },
  {
    id: "u2",
    name: "Biên tập viên 1",
    email: "editor1@thienduc.vn",
    role: "EDITOR",
    isActive: true,
  },
  {
    id: "u3",
    name: "Trưởng nội dung",
    email: "content@thienduc.vn",
    role: "ADMIN",
    isActive: false,
  },
];
