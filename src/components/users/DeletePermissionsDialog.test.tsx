import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeletePermissionsDialog } from "./DeletePermissionsDialog";

const state = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiFetch: (...args: unknown[]) => state.api(...args),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
beforeEach(() => {
  vi.clearAllMocks();
  state.api.mockResolvedValue({});
});
describe("Một quyền xóa chung trên từng thành viên", () => {
  it.each([false, true])(
    "cấp/thu hồi từ trạng thái ban đầu %s",
    async (canDeleteCms) => {
      const user = userEvent.setup();
      render(
        <QueryClientProvider client={new QueryClient()}>
          <DeletePermissionsDialog
            user={{
              id: "member",
              name: "Nhân viên",
              email: "member@thienduc.vn",
              role: "EDITOR",
              isActive: true,
              createdAt: "2026-10-26",
              canDeleteCms,
            }}
          />
        </QueryClientProvider>,
      );
      await user.click(screen.getByRole("button", { name: "Quyền xóa" }));
      expect(screen.getAllByRole("checkbox")).toHaveLength(1);
      expect(
        screen.getByRole("button", { name: "Lưu quyền xóa" }),
      ).toBeDisabled();
      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "Lưu quyền xóa" }));
      await waitFor(() =>
        expect(state.api).toHaveBeenCalledWith(
          "/users/member/delete-permissions",
          {
            method: "PATCH",
            body: JSON.stringify({ canDeleteCms: !canDeleteCms }),
          },
        ),
      );
    },
  );
});
