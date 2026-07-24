import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";

const requestPasswordReset = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  requestPasswordReset: (email: string) => requestPasswordReset(email),
}));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    error: (msg: string) => toastError(msg),
    success: (msg: string) => toastSuccess(msg),
  },
}));

const EMAIL = "nguoidung@thienduc.vn";

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    requestPasswordReset.mockReset();
    toastError.mockClear();
    toastSuccess.mockClear();
  });

  it("email trống / sai định dạng → báo lỗi, không gọi API", async () => {
    renderPage();

    await userEvent.click(
      screen.getByRole("button", { name: /Gửi hướng dẫn/i }),
    );
    expect(await screen.findByText(/Vui lòng nhập email/i)).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/Email/i), "khong-phai-email");
    await userEvent.click(
      screen.getByRole("button", { name: /Gửi hướng dẫn/i }),
    );
    expect(
      await screen.findByText(/Email không đúng định dạng/i),
    ).toBeInTheDocument();

    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("gửi hợp lệ → gọi requestPasswordReset và hiện xác nhận trung tính", async () => {
    requestPasswordReset.mockResolvedValue({ success: true, message: "ok" });
    renderPage();

    await userEvent.type(screen.getByLabelText(/Email/i), EMAIL);
    await userEvent.click(
      screen.getByRole("button", { name: /Gửi hướng dẫn/i }),
    );

    await waitFor(() =>
      expect(requestPasswordReset).toHaveBeenCalledWith(EMAIL),
    );
    expect(
      await screen.findByRole("heading", { name: /Kiểm tra email của bạn/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Nếu email tồn tại trong hệ thống/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/hiệu lực trong 20 phút/i)).toBeInTheDocument();
  });

  it("KHÔNG lộ email đã nhập ở màn hình xác nhận (chống dò tài khoản)", async () => {
    requestPasswordReset.mockResolvedValue({ success: true, message: "ok" });
    renderPage();

    await userEvent.type(screen.getByLabelText(/Email/i), EMAIL);
    await userEvent.click(
      screen.getByRole("button", { name: /Gửi hướng dẫn/i }),
    );

    await screen.findByRole("heading", { name: /Kiểm tra email của bạn/i });
    // Email vừa nhập tuyệt đối không được hiển thị lại trên màn hình xác nhận.
    expect(document.body.textContent).not.toContain(EMAIL);
  });

  it("đang gửi → nút bị vô hiệu hóa (chặn double submit)", async () => {
    // Promise không bao giờ resolve để giữ trạng thái đang gửi.
    requestPasswordReset.mockReturnValue(new Promise(() => {}));
    renderPage();

    await userEvent.type(screen.getByLabelText(/Email/i), EMAIL);
    await userEvent.click(
      screen.getByRole("button", { name: /Gửi hướng dẫn/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Đang gửi/i }),
      ).toBeDisabled();
    });
    // Chỉ gọi đúng một lần dù người dùng có bấm thêm.
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("lỗi mạng/máy chủ → toast chung, giữ nguyên form để thử lại", async () => {
    requestPasswordReset.mockRejectedValue(new Error("network"));
    renderPage();

    await userEvent.type(screen.getByLabelText(/Email/i), EMAIL);
    await userEvent.click(
      screen.getByRole("button", { name: /Gửi hướng dẫn/i }),
    );

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    // Vẫn ở form (không nhảy sang màn hình xác nhận).
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /Kiểm tra email của bạn/i }),
    ).not.toBeInTheDocument();
  });

  it('có link "Quay lại đăng nhập" trỏ tới /dang-nhap', () => {
    renderPage();
    expect(
      screen.getByRole("link", { name: /Quay lại đăng nhập/i }),
    ).toHaveAttribute("href", "/dang-nhap");
  });
});
