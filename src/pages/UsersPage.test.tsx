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
    useUsers: () => ({ data: [row], isLoading: false }),
    useUser: hook,
    useCreateUser: hook,
    useUpdateUser: hook,
    useDeactivateUser: hook,
    useReactivateUser: hook,
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
});
