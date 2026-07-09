// Map lỗi API sang thông báo tiếng Việt cho toast.
//
// Backend trả message tiếng Việt đã được viết cho người dùng cuối ở các lỗi
// nghiệp vụ (400 / 404 / 409) — hiện thẳng. Với 5xx và lỗi lạ thì dùng câu
// chung, tránh lộ chi tiết kỹ thuật (stack trace, lỗi SQL).

import { ApiRequestError } from "@/lib/api/client";

/** Các status mà message của backend là thông báo nghiệp vụ, an toàn để hiện. */
const SAFE_TO_SHOW = new Set([400, 404, 409, 422]);

export function resolveApiError(error: unknown, fallback: string): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 0) {
      return "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.";
    }
    if (SAFE_TO_SHOW.has(error.status) && error.message) {
      return error.message;
    }
    if (error.status === 403) {
      return "Bạn không có quyền thực hiện thao tác này.";
    }
  }
  return fallback;
}
