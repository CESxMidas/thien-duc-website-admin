import {
  BadgeCheck,
  Building2,
  FileText,
  GalleryHorizontalEnd,
  Handshake,
  Images,
  Inbox,
  LayoutDashboard,
  Newspaper,
  Palette,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/types";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Vai trò tối thiểu được thấy mục này, mặc định mọi vai trò. */
  roles?: Role[];
}

export const navItems: NavItem[] = [
  { to: "/", label: "Tổng quan", icon: LayoutDashboard },
  { to: "/du-an", label: "Dự án", icon: Building2 },
  { to: "/du-an-hop-tac", label: "Dự án hợp tác", icon: Handshake },
  { to: "/tin-tuc", label: "Tin tức", icon: Newspaper },
  { to: "/trang", label: "Trang nội dung", icon: FileText },
  {
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
  {
    to: "/thuong-hieu",
    label: "Thương hiệu",
    icon: Palette,
    roles: ["ADMIN", "SUPER_ADMIN"],
  },
  { to: "/ho-so", label: "Thông tin cá nhân", icon: UserCog },
];
