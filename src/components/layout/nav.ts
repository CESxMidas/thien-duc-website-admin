import {
  LayoutDashboard,
  Building2,
  Handshake,
  Newspaper,
  FileText,
  GalleryHorizontalEnd,
  Inbox,
  Images,
  Users,
  UserCog,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Vai trò tối thiểu được thấy mục này (mặc định mọi vai trò). */
  roles?: Role[];
}

export const navItems: NavItem[] = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/du-an", label: "Dự án", icon: Building2 },
  { to: "/du-an-hop-tac", label: "Dự án hợp tác", icon: Handshake },
  { to: "/tin-tuc", label: "Tin tức", icon: Newspaper },
  { to: "/trang", label: "Trang nội dung", icon: FileText },
  {
    // Banner là nội dung trang chủ hiển thị cao, không có luồng duyệt riêng —
    // chỉ ADMIN trở lên quản lý (khớp `@Roles(ADMIN, SUPER_ADMIN)` ở backend).
    to: "/banner",
    label: "Banner",
    icon: GalleryHorizontalEnd,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    to: "/lien-he",
    label: "Liên hệ",
    icon: Inbox,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  { to: "/thu-vien", label: "Thư viện ảnh", icon: Images },
  {
    to: "/duyet-ho-so",
    label: "Duyệt hồ sơ",
    icon: BadgeCheck,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  {
    to: "/tai-khoan",
    label: "Tài khoản",
    icon: Users,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  { to: "/ho-so", label: "Thông tin cá nhân", icon: UserCog },
];
