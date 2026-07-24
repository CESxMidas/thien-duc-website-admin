import { StrictMode } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { ApiRequestError } from "@/lib/api/client";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const validatePasswordReset = vi.fn();
const resetPassword = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  validatePasswordReset: (token: string) => validatePasswordReset(token),
  resetPassword: (input: unknown) => resetPassword(input),
}));

const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (msg: string) => toastError(msg), success: vi.fn() },
}));

const TOKEN = "raw-reset-token-xyz";

function setUrl(search: string) {
  window.history.replaceState({}, "", `/dat-lai-mat-khau${search}`);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ResetPasswordPage />
    </MemoryRouter>,
  );
}

/** Nhập cặp mật khẩu vào form (đã ở trạng thái "form"). */
async function fillPasswords(pw: string, confirm = pw) {
  await userEvent.type(screen.getByLabelText(/Mật khẩu mới/i), pw);
  await userEvent.type(screen.getByLabelText(/Xác nhận mật khẩu/i), confirm);
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    validatePasswordReset.mockReset();
    resetPassword.mockReset();
    toastError.mockClear();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    setUrl("");
  });

  it("thiếu token → trạng thái không hợp lệ, không gọi validate", async () => {
    setUrl("");
    renderPage();

    expect(
      await screen.findByText(/Liên kết không còn hiệu lực/i),
    ).toBeInTheDocument();
    expect(validatePasswordReset).not.toHaveBeenCalled();
  });

  it("token không hợp lệ → thông báo chung", async () => {
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: false });
    renderPage();

    expect(
      await screen.findByText(
        /Link đặt lại mật khẩu không hợp lệ, đã được sử dụng hoặc đã hết hạn/i,
      ),
    ).toBeInTheDocument();
  });

  it("StrictMode (dev): token sống sót qua effect kép, vẫn hiện form", async () => {
    // Regression: đọc token trong thân render (không trong effect) để lần gọi
    // effect thứ hai của StrictMode — sau khi URL đã bị strip — không mất token.
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: true });
    render(
      <StrictMode>
        <MemoryRouter>
          <ResetPasswordPage />
        </MemoryRouter>
      </StrictMode>,
    );

    expect(await screen.findByLabelText(/Mật khẩu mới/i)).toBeInTheDocument();
    expect(validatePasswordReset).toHaveBeenCalledWith(TOKEN);
    expect(window.location.search).toBe("");
  });

  it("token hợp lệ → hiện form; token bị xoá khỏi URL và KHÔNG lưu storage", async () => {
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: true });
    renderPage();

    expect(await screen.findByLabelText(/Mật khẩu mới/i)).toBeInTheDocument();
    expect(validatePasswordReset).toHaveBeenCalledWith(TOKEN);
    // Token bị xoá khỏi URL ngay.
    expect(window.location.search).toBe("");
    // Không bao giờ nằm trong localStorage/sessionStorage.
    expect(JSON.stringify(localStorage)).not.toContain(TOKEN);
    expect(JSON.stringify(sessionStorage)).not.toContain(TOKEN);
    // Token không hiển thị ra màn hình.
    expect(document.body.textContent).not.toContain(TOKEN);
  });

  it("mật khẩu quá ngắn bị chặn", async () => {
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: true });
    renderPage();

    await screen.findByLabelText(/Mật khẩu mới/i);
    await fillPasswords("1234567");
    await userEvent.click(
      screen.getByRole("button", { name: /Đặt lại mật khẩu/i }),
    );

    expect(
      await screen.findByText(/ít nhất 8 ký tự/i),
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("mật khẩu quá dài bị chặn", async () => {
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: true });
    renderPage();

    await screen.findByLabelText(/Mật khẩu mới/i);
    const tooLong = "a".repeat(129);
    await fillPasswords(tooLong);
    await userEvent.click(
      screen.getByRole("button", { name: /Đặt lại mật khẩu/i }),
    );

    expect(await screen.findByText(/tối đa 128 ký tự/i)).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("xác nhận không khớp bị chặn, không gọi reset", async () => {
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: true });
    renderPage();

    await screen.findByLabelText(/Mật khẩu mới/i);
    await fillPasswords("MatKhau123", "KhacHoanToan1");
    await userEvent.click(
      screen.getByRole("button", { name: /Đặt lại mật khẩu/i }),
    );

    expect(
      await screen.findByText(/Mật khẩu xác nhận không khớp/i),
    ).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("gửi hợp lệ → gọi resetPassword đúng payload, hiện thành công, KHÔNG tự đăng nhập", async () => {
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: true });
    resetPassword.mockResolvedValue({ success: true, message: "ok" });
    renderPage();

    await screen.findByLabelText(/Mật khẩu mới/i);
    await fillPasswords("MatKhauMoi123");
    await userEvent.click(
      screen.getByRole("button", { name: /Đặt lại mật khẩu/i }),
    );

    await waitFor(() => expect(resetPassword).toHaveBeenCalledTimes(1));
    expect(resetPassword).toHaveBeenCalledWith({
      token: TOKEN,
      newPassword: "MatKhauMoi123",
      confirmPassword: "MatKhauMoi123",
    });

    expect(
      await screen.findByRole("heading", {
        name: /Đặt lại mật khẩu thành công/i,
      }),
    ).toBeInTheDocument();
    // KHÔNG tự đăng nhập / tự điều hướng — chỉ điều hướng khi bấm nút.
    expect(navigateSpy).not.toHaveBeenCalled();
    // Token không bao giờ được render.
    expect(document.body.textContent).not.toContain(TOKEN);
  });

  it('màn hình thành công: bấm "Đăng nhập" điều hướng về /dang-nhap', async () => {
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: true });
    resetPassword.mockResolvedValue({ success: true, message: "ok" });
    renderPage();

    await screen.findByLabelText(/Mật khẩu mới/i);
    await fillPasswords("MatKhauMoi123");
    await userEvent.click(
      screen.getByRole("button", { name: /Đặt lại mật khẩu/i }),
    );

    await screen.findByRole("heading", {
      name: /Đặt lại mật khẩu thành công/i,
    });
    await userEvent.click(screen.getByRole("button", { name: /Đăng nhập/i }));
    expect(navigateSpy).toHaveBeenCalledWith("/dang-nhap", { replace: true });
  });

  it("token chết giữa chừng (backend từ chối) → chuyển sang trạng thái không hợp lệ", async () => {
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: true });
    resetPassword.mockRejectedValue(
      new ApiRequestError(400, {
        code: "BAD_REQUEST",
        message: "generic",
      }),
    );
    renderPage();

    await screen.findByLabelText(/Mật khẩu mới/i);
    await fillPasswords("MatKhauMoi123");
    await userEvent.click(
      screen.getByRole("button", { name: /Đặt lại mật khẩu/i }),
    );

    expect(
      await screen.findByText(/Liên kết không còn hiệu lực/i),
    ).toBeInTheDocument();
  });

  it("lỗi mạng khi submit → toast chung, giữ nguyên form", async () => {
    setUrl(`?token=${TOKEN}`);
    validatePasswordReset.mockResolvedValue({ valid: true });
    resetPassword.mockRejectedValue(
      new ApiRequestError(0, { code: "NETWORK_ERROR", message: "no net" }),
    );
    renderPage();

    await screen.findByLabelText(/Mật khẩu mới/i);
    await fillPasswords("MatKhauMoi123");
    await userEvent.click(
      screen.getByRole("button", { name: /Đặt lại mật khẩu/i }),
    );

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    // Vẫn ở form (token còn hạn, cho thử lại).
    expect(screen.getByLabelText(/Mật khẩu mới/i)).toBeInTheDocument();
  });

  it('trạng thái không hợp lệ có "Yêu cầu liên kết mới" → /quen-mat-khau', async () => {
    setUrl("");
    renderPage();

    await screen.findByText(/Liên kết không còn hiệu lực/i);
    expect(
      screen.getByRole("link", { name: /Yêu cầu liên kết mới/i }),
    ).toHaveAttribute("href", "/quen-mat-khau");
    expect(
      screen.getByRole("link", { name: /Quay lại đăng nhập/i }),
    ).toHaveAttribute("href", "/dang-nhap");
  });
});
