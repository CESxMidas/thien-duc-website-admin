import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import { AccountSetupPage } from "@/pages/AccountSetupPage";

const navigateSpy = vi.fn();
vi.mock("react-router-dom", async (orig) => {
  const actual = await orig<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const validateInvitation = vi.fn();
const acceptInvitation = vi.fn();
vi.mock("@/lib/api/auth", () => ({
  validateInvitation: (token: string) => validateInvitation(token),
  acceptInvitation: (input: unknown) => acceptInvitation(input),
}));

const TOKEN = "raw-invitation-token-xyz";

function setUrl(search: string) {
  window.history.replaceState({}, "", `/thiet-lap-tai-khoan${search}`);
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AccountSetupPage />
    </MemoryRouter>,
  );
}

describe("AccountSetupPage", () => {
  beforeEach(() => {
    navigateSpy.mockClear();
    validateInvitation.mockReset();
    acceptInvitation.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    setUrl("");
  });

  it("thiếu token → trạng thái không hợp lệ, không gọi validate", async () => {
    setUrl("");
    renderPage();

    expect(await screen.findByText("Link không hợp lệ")).toBeInTheDocument();
    expect(validateInvitation).not.toHaveBeenCalled();
  });

  it("token không hợp lệ → hiện thông báo chung", async () => {
    setUrl(`?token=${TOKEN}`);
    validateInvitation.mockResolvedValue({ valid: false });
    renderPage();

    expect(
      await screen.findByText(
        /Link thiết lập tài khoản không hợp lệ hoặc đã hết hạn/,
      ),
    ).toBeInTheDocument();
  });

  it("token hợp lệ → hiện form; token bị xoá khỏi URL và KHÔNG lưu storage", async () => {
    setUrl(`?token=${TOKEN}`);
    validateInvitation.mockResolvedValue({ valid: true });
    renderPage();

    expect(await screen.findByLabelText(/Mật khẩu mới/i)).toBeInTheDocument();
    // Token đã được truyền vào validate...
    expect(validateInvitation).toHaveBeenCalledWith(TOKEN);
    // ...nhưng bị xoá khỏi URL ngay.
    expect(window.location.search).toBe("");
    // ...và không bao giờ nằm trong localStorage/sessionStorage.
    expect(JSON.stringify(localStorage)).not.toContain(TOKEN);
    expect(JSON.stringify(sessionStorage)).not.toContain(TOKEN);
  });

  it("mật khẩu xác nhận không khớp → chặn submit, không gọi accept", async () => {
    setUrl(`?token=${TOKEN}`);
    validateInvitation.mockResolvedValue({ valid: true });
    renderPage();

    await screen.findByLabelText(/Mật khẩu mới/i);
    await userEvent.type(screen.getByLabelText(/Mật khẩu mới/i), "MatKhau123");
    await userEvent.type(
      screen.getByLabelText(/Nhập lại mật khẩu/i),
      "KhacHoanToan1",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Hoàn tất thiết lập/ }),
    );

    expect(
      await screen.findByText(/Mật khẩu xác nhận không khớp/),
    ).toBeInTheDocument();
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it("thành công → gọi accept kèm token, hiện trạng thái thành công", async () => {
    setUrl(`?token=${TOKEN}`);
    validateInvitation.mockResolvedValue({ valid: true });
    acceptInvitation.mockResolvedValue({ success: true, loginRequired: true });
    renderPage();

    await screen.findByLabelText(/Mật khẩu mới/i);
    await userEvent.type(screen.getByLabelText(/Mật khẩu mới/i), "MatKhau123");
    await userEvent.type(
      screen.getByLabelText(/Nhập lại mật khẩu/i),
      "MatKhau123",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /Hoàn tất thiết lập/ }),
    );

    await waitFor(() => {
      expect(acceptInvitation).toHaveBeenCalledTimes(1);
    });
    expect(acceptInvitation).toHaveBeenCalledWith({
      token: TOKEN,
      newPassword: "MatKhau123",
      confirmPassword: "MatKhau123",
    });
    expect(
      await screen.findByText(/Thiết lập mật khẩu thành công/),
    ).toBeInTheDocument();
  });
});
