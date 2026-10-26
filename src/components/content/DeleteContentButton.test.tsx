import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteContentButton } from "./DeleteContentButton";
import type { AuthUser } from "@/types";

const state = vi.hoisted(() => ({
  user: { role: "SUPER_ADMIN", canDeleteCms: false } as Pick<
    AuthUser,
    "role" | "canDeleteCms"
  >,
  trash: vi.fn(),
  purge: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock("@/lib/api/cms-trash", () => ({
  trashRecord: (...args: unknown[]) => state.trash(...args),
  purgeRecord: (...args: unknown[]) => state.purge(...args),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
function view() {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({ defaultOptions: { mutations: { retry: false } } })
      }
    >
      <DeleteContentButton
        kind="news"
        id="record-id"
        title="Bài viết thử nghiệm"
      />
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { role: "SUPER_ADMIN", canDeleteCms: false };
  state.trash.mockResolvedValue({ trashed: true });
  state.purge.mockResolvedValue({ deleted: true });
});

describe("Chọn một trong hai cách xóa", () => {
  it.each(["EDITOR", "ADMIN"] as const)(
    "%s không có quyền thì không thấy nút; được cấp quyền chung thì thấy",
    (role) => {
      state.user = { role, canDeleteCms: false };
      const result = view();
      expect(screen.queryByRole("button", { name: /Xóa/ })).toBeNull();
      state.user = { role, canDeleteCms: true };
      result.rerender(
        <QueryClientProvider client={new QueryClient()}>
          <DeleteContentButton
            kind="news"
            id="record-id"
            title="Bài viết thử nghiệm"
          />
        </QueryClientProvider>,
      );
      expect(
        screen.getByRole("button", { name: "Xóa Bài viết thử nghiệm" }),
      ).toBeInTheDocument();
    },
  );

  it("mặc định chọn thùng rác, hủy không gửi API, xác nhận mới xóa", async () => {
    const user = userEvent.setup();
    view();
    await user.click(
      screen.getByRole("button", { name: "Xóa Bài viết thử nghiệm" }),
    );
    expect(
      screen.getByRole("radio", { name: /Đưa vào thùng rác/ }),
    ).toBeChecked();
    expect(state.trash).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(state.trash).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "Xóa Bài viết thử nghiệm" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Chuyển vào thùng rác" }),
    );
    await waitFor(() =>
      expect(state.trash).toHaveBeenCalledWith("news", "record-id"),
    );
    expect(state.purge).not.toHaveBeenCalled();
  });

  it("xóa vĩnh viễn phải chọn phương thức và tích xác nhận thêm", async () => {
    const user = userEvent.setup();
    view();
    await user.click(
      screen.getByRole("button", { name: "Xóa Bài viết thử nghiệm" }),
    );
    await user.click(screen.getByRole("radio", { name: /Xóa vĩnh viễn/ }));
    const button = screen.getByRole("button", { name: "Xóa vĩnh viễn" });
    expect(button).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Tôi hiểu/ }));
    expect(button).toBeEnabled();
    await user.click(button);
    await waitFor(() =>
      expect(state.purge).toHaveBeenCalledWith("news", "record-id"),
    );
    expect(state.trash).not.toHaveBeenCalled();
  });

  it("API từ chối sau khi thu hồi quyền: giữ hộp thoại và thông báo lỗi", async () => {
    state.trash.mockRejectedValue(new Error("denied"));
    const user = userEvent.setup();
    view();
    await user.click(
      screen.getByRole("button", { name: "Xóa Bài viết thử nghiệm" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Chuyển vào thùng rác" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không xóa được nội dung",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
