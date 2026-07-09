// Map lỗi đăng nhập sang thông báo tiếng Việt ngắn gọn cho toast.
// Bảo mật: không phân biệt "email không tồn tại" vs "sai mật khẩu" — cùng
// dùng thông báo chung ở 401. Không lộ chi tiết kỹ thuật/stack trace.

import { ApiRequestError } from "@/lib/api/client";

/** Thông báo theo HTTP status khi đăng nhập (mục 5 & 13 của spec). */
export function getLoginErrorMessage(status?: number): string {
  switch (status) {
    case 400:
      return "Thông tin đăng nhập không hợp lệ.";
    case 401:
      return "Email hoặc mật khẩu không đúng.";
    case 403:
      return "Tài khoản không có quyền truy cập hệ thống quản trị.";
    case 423:
      return "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.";
    case 429:
      return "Bạn đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.";
    case 500:
      return "Hệ thống đang gặp lỗi. Vui lòng thử lại sau.";
    case 0:
      return "Không thể kết nối máy chủ. Vui lòng kiểm tra mạng.";
    default:
      return "Có lỗi xảy ra. Vui lòng thử lại sau.";
  }
}

/**
 * Rút status từ lỗi bất kỳ ném ra trong lúc đăng nhập.
 * Lưu ý: backend khóa tài khoản trả 401 (không phải 423) kèm message riêng —
 * bắt theo message để hiển thị đúng "tài khoản bị khóa".
 */
export function resolveLoginError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (
      error.status === 401 &&
      /khóa|khoa|lock/i.test(error.message)
    ) {
      return getLoginErrorMessage(423);
    }
    return getLoginErrorMessage(error.status);
  }
  return getLoginErrorMessage();
}
