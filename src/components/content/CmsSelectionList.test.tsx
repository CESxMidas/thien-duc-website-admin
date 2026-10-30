import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataTable } from "@/components/ui/DataTable";
import type { AuthUser } from "@/types";
import type { CmsRecordKind } from "@/lib/api/cms-trash";

const state = vi.hoisted(() => ({
  user: { id: "actor", role: "SUPER_ADMIN", canDeleteCms: false } as Pick<
    AuthUser,
    "id" | "role" | "canDeleteCms"
  >,
  bulk: vi.fn(),
  rowClick: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock("@/lib/api/cms-trash", () => ({
  bulkDeleteRecords: (...args: unknown[]) => state.bulk(...args),
  trashRecord: vi.fn(),
  purgeRecord: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

type Row = { id: string; title: string; role?: string };
const rows: Row[] = [
  { id: "one", title: "Bài một" },
  { id: "two", title: "Bài hai" },
];
let client: QueryClient;
function view(records = rows, kind: CmsRecordKind = "news", scope = "") {
  return (
    <QueryClientProvider client={client}>
      <DataTable
        deletionKind={kind}
        deletionScope={scope}
        rows={records}
        columns={[
          { key: "title", header: "Tiêu đề", render: (row) => row.title },
        ]}
        onRowClick={state.rowClick}
      />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  state.user = { id: "actor", role: "SUPER_ADMIN", canDeleteCms: false };
  state.bulk.mockImplementation((_kind: string, ids: string[]) =>
    Promise.resolve({ succeededIds: ids, failed: [], remainingIds: [] }),
  );
});

describe("Chọn và xóa các mục CMS", () => {
  it.each(["ADMIN", "EDITOR"] as const)(
    "%s chỉ thấy lựa chọn khi được cấp quyền xóa chung",
    (role) => {
      state.user = { id: "actor", role, canDeleteCms: false };
      const result = render(view());
      expect(screen.queryByRole("checkbox")).toBeNull();
      state.user.canDeleteCms = true;
      result.rerender(view());
      expect(
        screen.getByRole("checkbox", { name: "Chọn Bài một" }),
      ).toBeInTheDocument();
    },
  );

  it("chọn từng mục và tất cả, có trạng thái một phần, không mở chi tiết hàng", async () => {
    const user = userEvent.setup();
    render(view());
    expect(
      screen.getByRole("button", { name: "Xóa 0 mục đã chọn" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: "Chọn Bài một" }));
    expect(
      screen.getByRole("checkbox", { name: "Chọn tất cả các hàng" }),
    ).toHaveAttribute("aria-checked", "mixed");
    expect(state.rowClick).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("checkbox", { name: "Chọn tất cả đang hiển thị" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 2/2");
    await user.click(screen.getByRole("button", { name: "Bỏ chọn" }));
    expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 0/2");
  });

  it("đổi bộ lọc/trang không giữ lựa chọn bị ẩn hoặc làm nó xuất hiện trở lại", async () => {
    const user = userEvent.setup();
    const result = render(view());
    await user.click(screen.getByRole("checkbox", { name: "Chọn Bài hai" }));
    result.rerender(view([rows[0]]));
    result.rerender(view());
    expect(
      screen.getByRole("checkbox", { name: "Chọn Bài hai" }),
    ).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: "Chọn Bài một" }));
    result.rerender(view(rows, "news", "page-2"));
    expect(
      screen.getByRole("checkbox", { name: "Chọn Bài một" }),
    ).not.toBeChecked();
  });

  it("tài khoản chính mình và Super Admin không được chọn bởi người được ủy quyền", async () => {
    state.user = { id: "actor", role: "EDITOR", canDeleteCms: true };
    const user = userEvent.setup();
    render(
      view(
        [
          { id: "actor", title: "Chính mình", role: "EDITOR" },
          { id: "super", title: "Quản trị cao nhất", role: "SUPER_ADMIN" },
          rows[0],
        ],
        "users",
      ),
    );
    expect(
      screen
        .getAllByRole("checkbox")
        .filter((box) => (box as HTMLInputElement).disabled),
    ).toHaveLength(2);
    await user.click(
      screen.getByRole("checkbox", { name: "Chọn tất cả đang hiển thị" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 1/1");
  });

  it("chọn một mục rồi xác nhận mới gọi API, mặc định vào thùng rác", async () => {
    const user = userEvent.setup();
    render(view());
    await user.click(screen.getByRole("checkbox", { name: "Chọn Bài một" }));
    await user.click(screen.getByRole("button", { name: "Xóa 1 mục đã chọn" }));
    expect(state.bulk).not.toHaveBeenCalled();
    expect(
      screen.getByRole("radio", { name: /Đưa vào thùng rác/ }),
    ).toBeChecked();
    await user.click(
      screen.getByRole("button", { name: "Chuyển vào thùng rác" }),
    );
    await waitFor(() =>
      expect(state.bulk).toHaveBeenCalledWith("news", ["one"], false),
    );
  });

  it("xóa vĩnh viễn nhiều mục phải tích xác nhận; thử lại chỉ gửi mục thất bại", async () => {
    state.bulk.mockResolvedValueOnce({
      succeededIds: ["one"],
      failed: [{ id: "two", status: 409, message: "Nội dung vừa thay đổi." }],
      remainingIds: [],
    });
    const user = userEvent.setup();
    render(view());
    await user.click(
      screen.getByRole("checkbox", { name: "Chọn tất cả đang hiển thị" }),
    );
    await user.click(screen.getByRole("button", { name: "Xóa 2 mục đã chọn" }));
    await user.click(screen.getByRole("radio", { name: /Xóa vĩnh viễn/ }));
    expect(
      screen.getByRole("button", { name: "Xóa vĩnh viễn" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("checkbox", { name: /Tôi hiểu/ }));
    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Còn 1 mục chưa xóa được",
    );
    expect(
      screen.getByRole("heading", { name: "Xóa 1 mục đã chọn?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Tôi hiểu/ }),
    ).not.toBeChecked();
    await user.click(screen.getByRole("checkbox", { name: /Tôi hiểu/ }));
    await user.click(screen.getByRole("button", { name: "Xóa vĩnh viễn" }));
    await waitFor(() =>
      expect(state.bulk).toHaveBeenLastCalledWith("news", ["two"], true),
    );
    expect(state.bulk).toHaveBeenCalledTimes(2);
  });
});
