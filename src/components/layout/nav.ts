import {
  LayoutDashboard,
  Building2,
  Newspaper,
  FileText,
  GalleryHorizontalEnd,
  Inbox,
  Images,
  Users,
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
  { to: "/tin-tuc", label: "Tin tức", icon: Newspaper },
  { to: "/trang", label: "Trang nội dung", icon: FileText },
  { to: "/banner", label: "Banner", icon: GalleryHorizontalEnd },
  { to: "/lien-he", label: "Liên hệ (Lead)", icon: Inbox },
  { to: "/thu-vien", label: "Thư viện ảnh", icon: Images },
  {
    to: "/tai-khoan",
    label: "Tài khoản",
    icon: Users,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
];
