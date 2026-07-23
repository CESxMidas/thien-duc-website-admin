import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { UsersPage } from "@/pages/UsersPage";
import type { AdminUser, Role } from "@/types";

/**
 * ADMIN-ROLE-VISIBILITY-AUDIT-M1 / R3 (lock-in): trang Tài khoản.
 * - ADMIN: xem được danh sách nhưng KHÔNG thấy nút thêm/sửa/khóa/mở khóa.
 * - SUPER_ADMIN: thấy đầy đủ nút quản lý.
 * - EDITOR: chặn ở tầng route (đã có ProtectedRoute.test) + ẩn khỏi nav
 *   (nav.test) nên không kiểm lại ở đây.
 */

const row: AdminUser = {
  id: "u2",
  name: "Nguyễn Văn A",
  email: "a@thienduc.vn",
  role: "EDITOR",
  isActive: true,
  createdAt: "2026-07-01T00:00:00Z",
};

let currentRole: Role = "ADMIN";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "me", email: "boss@thienduc.vn", role: currentRole, name: "Boss" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

let usersData: AdminUser[] = [row];

vi.mock("@/lib/api/queries", () => {
  const hook = () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => {}),
  });
  return {
    useUsers: () => ({ data: usersData, isLoading: false }),
    useUser: hook,
    useCreateUser: hook,
    useCreateUserInvitation: hook,
    useUpdateUser: hook,
    useDeactivateUser: hook,
    useReactivateUser: hook,
    useResendUserInvitation: hook,
    useRevokeUserInvitation: hook,
  };
});

function renderUsersPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("UsersPage — quyền quản lý theo vai trò", () => {
  beforeEach(() => {
    currentRole = "ADMIN";
    usersData = [row];
  });

  it("ADMIN: xem danh sách nhưng KHÔNG có nút thêm/sửa/khóa", () => {
    currentRole = "ADMIN";
    renderUsersPage();

    // Danh sách hiển thị (đọc được).
    expect(screen.getByText("Nguyễn Văn A")).toBeInTheDocument();
    expect(screen.getByText("a@thienduc.vn")).toBeInTheDocument();

    // Không có thao tác thay đổi nào.
    expect(
      screen.queryByRole("button", { name: /Thêm tài khoản/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Sửa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Khóa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Mở khóa/ })).toBeNull();
  });

  it("SUPER_ADMIN: thấy nút thêm/sửa/khóa tài khoản", () => {
    currentRole = "SUPER_ADMIN";
    renderUsersPage();

    expect(
      screen.getByRole("button", { name: /Thêm tài khoản/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sửa/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Khóa/ })).toBeInTheDocument();
  });

  it("tài khoản chờ thiết lập: badge 'Chờ thiết lập' + nút gửi lại/thu hồi (SUPER_ADMIN)", () => {
    currentRole = "SUPER_ADMIN";
    usersData = [{ ...row, setupCompletedAt: null }];
    renderUsersPage();

    expect(screen.getByText("Chờ thiết lập")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Gửi lại lời mời/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Thu hồi/ })).toBeInTheDocument();
    // Không hiện nút "Khóa" cho tài khoản chờ thiết lập.
    expect(screen.queryByRole("button", { name: /^Khóa/ })).toBeNull();
  });

  it("tài khoản đã hoạt động (setupCompletedAt != null): badge 'Đang hoạt động', không có nút lời mời", () => {
    currentRole = "SUPER_ADMIN";
    usersData = [{ ...row, setupCompletedAt: "2026-07-01T00:00:00Z" }];
    renderUsersPage();

    expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Gửi lại lời mời/ }),
    ).toBeNull();
  });

  it("tài khoản bị vô hiệu hóa: badge 'Đã vô hiệu hóa'", () => {
    currentRole = "SUPER_ADMIN";
    usersData = [{ ...row, isActive: false, setupCompletedAt: null }];
    renderUsersPage();

    // isActive=false ưu tiên hơn chờ thiết lập.
    expect(screen.getByText("Đã vô hiệu hóa")).toBeInTheDocument();
  });

  it("ADMIN: KHÔNG thấy nút gửi lại/thu hồi lời mời của tài khoản chờ thiết lập", () => {
    currentRole = "ADMIN";
    usersData = [{ ...row, setupCompletedAt: null }];
    renderUsersPage();

    expect(screen.getByText("Chờ thiết lập")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Gửi lại lời mời/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: /Thu hồi/ })).toBeNull();
  });
});
