import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserFormDialog } from "@/components/users/UserFormDialog";

const createInvitationMutate = vi.fn(async (_input: unknown) => ({}));
const updateUserMutate = vi.fn(async (_input: unknown) => ({}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "me", email: "boss@thienduc.vn", role: "SUPER_ADMIN", name: "Boss" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/api/queries", () => ({
  useCreateUserInvitation: () => ({ mutateAsync: createInvitationMutate }),
  useUpdateUser: () => ({ mutateAsync: updateUserMutate }),
}));

describe("UserFormDialog — chế độ tạo mới (luồng lời mời)", () => {
  beforeEach(() => {
    createInvitationMutate.mockClear();
    updateUserMutate.mockClear();
  });

  async function openCreateDialog() {
    render(<UserFormDialog trigger={<button>Thêm tài khoản</button>} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Thêm tài khoản" }),
    );
    // Chờ modal mở (tiêu đề "Thêm tài khoản").
    await screen.findByText("Thêm tài khoản", { selector: "h2, [id]" }).catch(
      () => undefined,
    );
  }

  it("KHÔNG hiển thị ô mật khẩu khi tạo mới", async () => {
    await openCreateDialog();
    expect(screen.queryByLabelText(/Mật khẩu/i)).toBeNull();
  });

  it("nút submit ghi 'Tạo tài khoản và gửi lời mời'", async () => {
    await openCreateDialog();
    expect(
      screen.getByRole("button", { name: /Tạo tài khoản và gửi lời mời/ }),
    ).toBeInTheDocument();
  });

  it("submit gọi createUserInvitation với payload KHÔNG chứa mật khẩu", async () => {
    await openCreateDialog();

    await userEvent.type(screen.getByLabelText(/Họ tên/i), "Người Mới");
    await userEvent.type(
      screen.getByLabelText(/Email/i),
      "moi@thienduc.vn",
    );
    // Vai trò mặc định EDITOR — không cần đổi.
    await userEvent.click(
      screen.getByRole("button", { name: /Tạo tài khoản và gửi lời mời/ }),
    );

    await waitFor(() => {
      expect(createInvitationMutate).toHaveBeenCalledTimes(1);
    });
    const payload = createInvitationMutate.mock.calls[0][0] as Record<
      string,
      unknown
    > & { password?: unknown };
    expect(payload).toMatchObject({
      name: "Người Mới",
      email: "moi@thienduc.vn",
      role: "EDITOR",
    });
    expect(payload).not.toHaveProperty("password");
  });
});

describe("UserFormDialog — chế độ sửa (không đặt mật khẩu hộ người khác)", () => {
  const target = {
    id: "u-1",
    name: "Biên Tập Viên",
    email: "bt@thienduc.vn",
    role: "EDITOR" as const,
    isActive: true,
    setupCompletedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  beforeEach(() => {
    createInvitationMutate.mockClear();
    updateUserMutate.mockClear();
  });

  async function openEditDialog() {
    render(
      <UserFormDialog trigger={<button>Sửa</button>} user={target} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Sửa" }));
    await screen.findByLabelText(/Họ tên/i);
  }

  it("KHÔNG hiển thị ô 'Mật khẩu mới'", async () => {
    await openEditDialog();
    expect(screen.queryByLabelText(/Mật khẩu/i)).toBeNull();
    expect(screen.queryByText("Mật khẩu mới")).toBeNull();
  });

  it("KHÔNG hiển thị chú thích về việc đổi mật khẩu", async () => {
    await openEditDialog();
    expect(
      screen.queryByText(/Để trống nếu không muốn đổi mật khẩu/i),
    ).toBeNull();
    expect(screen.queryByText(/Đổi mật khẩu/i)).toBeNull();
  });

  it("submit gửi payload KHÔNG chứa mật khẩu", async () => {
    await openEditDialog();

    const nameInput = screen.getByLabelText(/Họ tên/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Tên Đã Sửa");
    await userEvent.click(screen.getByRole("button", { name: /Lưu thay đổi/ }));

    await waitFor(() => {
      expect(updateUserMutate).toHaveBeenCalledTimes(1);
    });
    const payload = updateUserMutate.mock.calls[0][0] as Record<
      string,
      unknown
    > & { password?: unknown };
    expect(payload).toMatchObject({
      id: "u-1",
      name: "Tên Đã Sửa",
      email: "bt@thienduc.vn",
      role: "EDITOR",
    });
    expect(payload).not.toHaveProperty("password");
    expect(Object.keys(payload)).toEqual(
      expect.not.arrayContaining(["password"]),
    );
  });
});
