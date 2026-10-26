import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, expect, it, vi } from "vitest";
import { ContentOrderDialog } from "./ContentOrderDialog";

const state = vi.hoisted(() => ({ role: "ADMIN", request: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { role: state.role } }),
}));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiFetch: state.request,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const items = [
  { id: "a", title: "Dự án A" },
  { id: "b", title: "Dự án B" },
  { id: "c", title: "Dự án C" },
];
beforeEach(() => {
  state.role = "ADMIN";
  state.request.mockReset();
  state.request.mockResolvedValue({});
});

it("đưa mục cuối lên đầu và lưu đầy đủ ID theo thứ tự mới", async () => {
  const user = userEvent.setup();
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <ContentOrderDialog collection="projects" items={items} />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Sắp xếp hiển thị" }));
  await user.click(
    within(screen.getByRole("group", { name: "Thứ tự Dự án C" })).getByRole(
      "button",
      { name: "Đưa lên đầu" },
    ),
  );
  expect(
    screen.getAllByRole("listitem").map((node) => node.textContent),
  ).toEqual(["1Dự án C", "2Dự án A", "3Dự án B"]);
  await user.click(screen.getByRole("button", { name: "Lưu thứ tự" }));
  await waitFor(() =>
    expect(state.request).toHaveBeenCalledWith("/projects/admin/reorder", {
      method: "PATCH",
      body: JSON.stringify({ ids: ["c", "a", "b"] }),
    }),
  );
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
});

it("giữ hộp thoại và thứ tự đang sửa khi API lưu thất bại", async () => {
  const user = userEvent.setup();
  state.request.mockRejectedValue(new Error("Không lưu được"));
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ContentOrderDialog collection="news" items={items} />
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Sắp xếp hiển thị" }));
  await user.click(
    within(screen.getByRole("group", { name: "Thứ tự Dự án C" })).getByRole(
      "button",
      { name: "Đưa lên đầu" },
    ),
  );
  await user.click(screen.getByRole("button", { name: "Lưu thứ tự" }));
  await waitFor(() => expect(state.request).toHaveBeenCalled());
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem")[0]).toHaveTextContent("Dự án C");
});

it("EDITOR không thấy thao tác đổi thứ tự nội dung công khai", () => {
  state.role = "EDITOR";
  render(<ContentOrderDialog collection="projects" items={items} />);
  expect(
    screen.queryByRole("button", { name: "Sắp xếp hiển thị" }),
  ).not.toBeInTheDocument();
});
