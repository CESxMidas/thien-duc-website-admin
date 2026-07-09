// Nhãn tiếng Việt + kiểu hiển thị cho các enum backend.

import type {
  ContentStatus,
  LeadStatus,
  ProjectStatus,
  Role,
} from "@/types";

export type BadgeTone = "gray" | "amber" | "green" | "blue" | "red";

export const contentStatusLabel: Record<ContentStatus, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  PUBLISHED: "Đã đăng",
};

export const contentStatusTone: Record<ContentStatus, BadgeTone> = {
  DRAFT: "gray",
  PENDING: "amber",
  PUBLISHED: "green",
};

export const projectStatusLabel: Record<ProjectStatus, string> = {
  CHUAN_BI_KHOI_CONG: "Chuẩn bị khởi công",
  DANG_THI_CONG: "Đang thi công",
  DA_BAN_GIAO: "Đã bàn giao",
};

export const leadStatusLabel: Record<LeadStatus, string> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  DONE: "Hoàn thành",
};

export const leadStatusTone: Record<LeadStatus, BadgeTone> = {
  NEW: "blue",
  IN_PROGRESS: "amber",
  DONE: "green",
};

export const roleLabel: Record<Role, string> = {
  EDITOR: "Biên tập viên",
  ADMIN: "Quản trị",
  SUPER_ADMIN: "Super Admin",
};

/**
 * Định dạng thời gian theo giờ VN (UTC+7).
 * Backend lưu UTC — bắt buộc quy đổi khi hiển thị (ghi chú KE-HOACH-CODING.md).
 */
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
