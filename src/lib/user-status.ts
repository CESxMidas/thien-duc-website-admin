// Trạng thái hiển thị của một tài khoản CMS, gộp `isActive` + `setupCompletedAt`.
//
// Ưu tiên (theo CMS-ACCOUNT-INVITATION-PHASE3):
//   1) isActive === false           -> "Đã vô hiệu hóa"
//   2) setupCompletedAt === null     -> "Chờ thiết lập" (tài khoản do lời mời tạo,
//                                       chưa tự đặt mật khẩu)
//   3) còn lại                       -> "Đang hoạt động"
//
// LƯU Ý (khoảng trống backend): hiện `GET /users` và `GET /users/:id` CHƯA trả
// `setupCompletedAt`, nên field có thể là `undefined`. Khi `undefined` ta coi
// tài khoản là "Đang hoạt động" (không suy đoán). Trạng thái "Chờ thiết lập"
// chỉ hiện khi backend expose `setupCompletedAt = null` — xem báo cáo Phase 3.

import type { AdminUser } from "@/types";
import type { BadgeTone } from "@/lib/labels";

export type UserStatusKey = "disabled" | "pending" | "active";

export interface UserStatus {
  key: UserStatusKey;
  label: string;
  tone: BadgeTone;
  /** Tài khoản đang chờ người dùng tự thiết lập mật khẩu (lời mời chưa hoàn tất). */
  isPending: boolean;
}

/** Tài khoản đang ở trạng thái chờ thiết lập (dùng để bật/tắt hành động lời mời). */
export function isPendingSetup(
  user: Pick<AdminUser, "setupCompletedAt">,
): boolean {
  return user.setupCompletedAt === null;
}

export function getUserStatus(
  user: Pick<AdminUser, "isActive" | "setupCompletedAt">,
): UserStatus {
  if (!user.isActive) {
    return {
      key: "disabled",
      label: "Đã vô hiệu hóa",
      tone: "gray",
      isPending: false,
    };
  }
  if (user.setupCompletedAt === null) {
    return {
      key: "pending",
      label: "Chờ thiết lập",
      tone: "amber",
      isPending: true,
    };
  }
  return {
    key: "active",
    label: "Đang hoạt động",
    tone: "green",
    isPending: false,
  };
}
