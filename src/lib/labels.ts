// Nhãn tiếng Việt + kiểu hiển thị cho các enum backend.

import type { PublicationState } from "@/lib/news-schedule";
import type {
  ContentStatus,
  LeadStatus,
  ProfileChangeStatus,
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

/**
 * Nhãn cho trạng thái xuất bản **suy ra** của tin tức (xem `news-schedule.ts`).
 * Ba giá trị đầu trùng `contentStatusLabel`; hai giá trị sau chỉ tồn tại ở tầng
 * hiển thị vì lịch đăng không có enum riêng trong DB.
 */
export const publicationStateLabel: Record<PublicationState, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  SCHEDULED: "Đã lên lịch",
  DUE: "Đã đến giờ đăng",
  PUBLISHED: "Đã đăng",
};

/**
 * Sắc thái huy hiệu — dùng lại đúng token đã có, không thêm màu mới.
 *
 * `DUE` lấy sắc cảnh báo chứ không phải xanh lá: bài ĐANG hiển thị công khai
 * (vị từ Batch 2) nhưng dữ liệu chưa được reconciler đồng bộ, nên nó là một
 * trạng thái quá độ cần chú ý, không phải trạng thái ổn định. Nhãn chữ mới là
 * thứ phân biệt chính — màu chỉ hỗ trợ, không mang thông tin riêng.
 */
export const publicationStateTone: Record<PublicationState, BadgeTone> = {
  DRAFT: "gray",
  PENDING: "amber",
  SCHEDULED: "blue",
  DUE: "amber",
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

export const profileStatusLabel: Record<ProfileChangeStatus, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
};

export const profileStatusTone: Record<ProfileChangeStatus, BadgeTone> = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
};

/** Nhãn field hồ sơ — dùng khi liệt kê các thay đổi trong yêu cầu duyệt. */
export const profileFieldLabel: Record<string, string> = {
  name: "Tên hiển thị",
  phone: "Số điện thoại",
  avatarUrl: "Ảnh đại diện",
  position: "Chức vụ",
  department: "Phòng ban",
  bio: "Giới thiệu",
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
