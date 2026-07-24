import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { useAuth } from "@/context/AuthContext";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

vi.mocked(useAuth).mockReturnValue({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
} as ReturnType<typeof useAuth>);

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage (smoke)", () => {
  it("renders the login form when unauthenticated", () => {
    renderPage();
    expect(
      screen.getByRole("heading", { name: /Đăng nhập hệ thống quản trị/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Đăng nhập/i }),
    ).toBeInTheDocument();
  });

  it('hiển thị link "Quên mật khẩu?" trỏ tới /quen-mat-khau', () => {
    renderPage();
    const link = screen.getByRole("link", { name: /Quên mật khẩu\?/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/quen-mat-khau");
  });

  it("vẫn giữ dòng liên hệ Super Admin, KHÔNG thêm link đăng ký", () => {
    renderPage();
    expect(
      screen.getByText(/Vui lòng liên hệ Super Admin/i),
    ).toBeInTheDocument();
    // Không có bất kỳ link "đăng ký" công khai nào.
    expect(
      screen.queryByRole("link", { name: /đăng ký/i }),
    ).not.toBeInTheDocument();
  });
});
