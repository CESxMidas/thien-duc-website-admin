/**
 * Màn quản lý chuyên mục tin.
 *
 * Ba điều dễ hỏng nhất và là lý do file này tồn tại:
 * - **Slug bị đổi sau khi tạo** → chết URL công khai đã lập chỉ mục. Form sửa
 *   phải khoá slug, và payload PATCH tuyệt đối không được mang `slug`.
 * - **Xóa chuyên mục còn bài** → hàng loạt bài mất phân loại, không Undo.
 * - **EDITOR xóa được** → vượt phân quyền backend (`@Roles(ADMIN, SUPER_ADMIN)`).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { NewsCategoriesPage } from "@/pages/NewsCategoriesPage";
import type { NewsCategory, Role } from "@/types";

const { updateCategory, createCategory, deleteCategory } = vi.hoisted(() => ({
  updateCategory: vi.fn(async () => {}),
  createCategory: vi.fn(async () => {}),
  deleteCategory: vi.fn(async () => {}),
}));

const role = vi.hoisted(() => ({ current: "ADMIN" as Role }));

/** Ba chuyên mục: có bài đã đăng · rỗng hoàn toàn · chỉ có bài nháp. */
const categories: NewsCategory[] = [
  {
    id: "c1",
    slug: "tin-du-an",
    name: { vi: "Tin dự án", en: "Project news" },
    order: 0,
    publishedCount: 2,
    totalCount: 3,
  },
  {
    id: "c2",
    slug: "tin-cong-ty",
    name: { vi: "Tin công ty" },
    order: 1,
    publishedCount: 0,
    totalCount: 0,
  },
  {
    id: "c3",
    slug: "tin-kien-truc",
    name: { vi: "Kiến trúc & Xây dựng" },
    order: 2,
    publishedCount: 0,
    totalCount: 5,
  },
];

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: () => Promise<void>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  return {
    queryKeys: {},
    useNewsCategoriesForAdmin: () => ({ data: categories, isLoading: false }),
    useUpdateNewsCategory: mutation(updateCategory),
    useCreateNewsCategory: mutation(createCategory),
    useDeleteNewsCategory: mutation(deleteCategory),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { role: role.current } }),
}));

function renderPage(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  updateCategory.mockClear();
  createCategory.mockClear();
  deleteCategory.mockClear();
  role.current = "ADMIN";
});

describe("NewsCategoriesPage — hiển thị", () => {
  it("liệt kê chuyên mục kèm tên VI và EN", () => {
    renderPage(<NewsCategoriesPage />);

    expect(screen.getByText("Tin dự án")).toBeInTheDocument();
    expect(screen.getByText("Project news")).toBeInTheDocument();
    expect(screen.getByText("Kiến trúc & Xây dựng")).toBeInTheDocument();
  });

  it("báo rõ chuyên mục chưa có tên tiếng Anh", () => {
    renderPage(<NewsCategoriesPage />);

    // c2 và c3 chưa dịch; c1 đã có nên không bị đánh dấu.
    expect(screen.getAllByText("Chưa có tên tiếng Anh")).toHaveLength(2);
  });

  it("hiện số bài đã đăng và tổng số bài theo từng hàng", () => {
    renderPage(<NewsCategoriesPage />);

    // Bám vào HÀNG cụ thể: các con số nhỏ (1,2,3) còn xuất hiện ở cột thứ tự.
    const row = screen.getByText("Tin dự án").closest("tr")!;
    expect(within(row).getByText("2")).toBeInTheDocument(); // đã đăng
    expect(within(row).getByText("3")).toBeInTheDocument(); // tổng

    const archRow = screen.getByText("Kiến trúc & Xây dựng").closest("tr")!;
    expect(within(archRow).getByText("5")).toBeInTheDocument();
  });

  it("nói rõ chuyên mục 0 bài đăng chưa hiện trên website", () => {
    renderPage(<NewsCategoriesPage />);

    // c2 và c3 đều chưa có bài đã đăng.
    expect(screen.getAllByText(/chưa hiện/)).toHaveLength(2);
  });
});

describe("NewsCategoriesPage — đổi thứ tự", () => {
  it("nút lên/xuống có tên truy cập được, không chỉ mũi tên", () => {
    renderPage(<NewsCategoriesPage />);

    expect(
      screen.getByLabelText("Đưa chuyên mục Tin dự án xuống dưới"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Đưa chuyên mục Tin công ty lên trên"),
    ).toBeInTheDocument();
  });

  it("hàng đầu không lên được, hàng cuối không xuống được", () => {
    renderPage(<NewsCategoriesPage />);

    expect(
      screen.getByLabelText("Đưa chuyên mục Tin dự án lên trên"),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("Đưa chuyên mục Kiến trúc & Xây dựng xuống dưới"),
    ).toBeDisabled();
  });

  it("đổi chỗ gửi HAI lệnh PATCH order, chuẩn hoá về chỉ số hàng", async () => {
    const user = userEvent.setup();
    renderPage(<NewsCategoriesPage />);

    await user.click(screen.getByLabelText("Đưa chuyên mục Tin dự án xuống dưới"));

    await waitFor(() => expect(updateCategory).toHaveBeenCalledTimes(2));
    expect(updateCategory).toHaveBeenNthCalledWith(1, {
      slug: "tin-du-an",
      data: { order: 1 },
    });
    expect(updateCategory).toHaveBeenNthCalledWith(2, {
      slug: "tin-cong-ty",
      data: { order: 0 },
    });
  });
});

describe("NewsCategoriesPage — tạo chuyên mục", () => {
  it("slug sinh tự động từ tên tiếng Việt, có bỏ dấu", async () => {
    const user = userEvent.setup();
    renderPage(<NewsCategoriesPage />);

    await user.click(screen.getByRole("button", { name: /Thêm chuyên mục/ }));
    const dialog = await screen.findByRole("dialog");

    await user.type(
      within(dialog).getByRole("textbox", { name: "Tiếng Việt" }),
      "Kiến trúc & Xây dựng",
    );

    await waitFor(() =>
      expect(within(dialog).getByDisplayValue("kien-truc-xay-dung")).toBeInTheDocument(),
    );
  });

  it("slug người dùng tự sửa KHÔNG bị ghi đè khi gõ tiếp vào tên", async () => {
    const user = userEvent.setup();
    renderPage(<NewsCategoriesPage />);

    await user.click(screen.getByRole("button", { name: /Thêm chuyên mục/ }));
    const dialog = await screen.findByRole("dialog");
    const nameInput = within(dialog).getByRole("textbox", {
      name: "Tiếng Việt",
    });
    const slugInput = within(dialog).getByRole("textbox", {
      name: /Đường dẫn/i,
    });

    await user.type(nameInput, "Tin dự án");
    await user.clear(slugInput);
    await user.type(slugInput, "chuyen-muc-rieng");
    // Gõ thêm vào tên — slug đã bị "chạm" nên phải giữ nguyên.
    await user.type(nameInput, " mới");

    expect(slugInput).toHaveValue("chuyen-muc-rieng");
  });

  it("gửi payload kèm order nối vào cuối danh sách", async () => {
    const user = userEvent.setup();
    renderPage(<NewsCategoriesPage />);

    await user.click(screen.getByRole("button", { name: /Thêm chuyên mục/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: "Tiếng Việt" }),
      "Sự kiện",
    );
    await user.click(
      within(dialog).getByRole("button", { name: "Thêm chuyên mục" }),
    );

    await waitFor(() => expect(createCategory).toHaveBeenCalledTimes(1));
    expect(createCategory).toHaveBeenCalledWith({
      slug: "su-kien",
      name: { vi: "Sự kiện" },
      order: 3, // 3 chuyên mục sẵn có → mục mới đứng cuối
    });
  });

  it("slug sai định dạng bị chặn ngay ở form, không gọi API", async () => {
    const user = userEvent.setup();
    renderPage(<NewsCategoriesPage />);

    await user.click(screen.getByRole("button", { name: /Thêm chuyên mục/ }));
    const dialog = await screen.findByRole("dialog");
    await user.type(
      within(dialog).getByRole("textbox", { name: "Tiếng Việt" }),
      "Tin dự án",
    );
    const slugInput = within(dialog).getByRole("textbox", {
      name: /Đường dẫn/i,
    });
    await user.clear(slugInput);
    await user.type(slugInput, "tin--du-an");
    await user.click(
      within(dialog).getByRole("button", { name: "Thêm chuyên mục" }),
    );

    // Bám vào phần RIÊNG của thông báo lỗi — chú thích dưới ô cũng nói về
    // "chữ thường không dấu", nên chuỗi chung sẽ khớp cả hai.
    expect(
      await within(dialog).findByText(/ví dụ: tin-du-an/),
    ).toBeInTheDocument();
    expect(createCategory).not.toHaveBeenCalled();
  });
});

describe("NewsCategoriesPage — sửa chuyên mục", () => {
  it("slug chỉ đọc và payload KHÔNG mang slug", async () => {
    const user = userEvent.setup();
    renderPage(<NewsCategoriesPage />);

    await user.click(screen.getByLabelText("Sửa chuyên mục Tin dự án"));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByDisplayValue("tin-du-an")).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(updateCategory).toHaveBeenCalledTimes(1));
    const [payload] = updateCategory.mock.calls[0] as unknown as [
      { slug: string; data: Record<string, unknown> },
    ];
    // `slug` ở đây là tham số ĐỊNH TUYẾN, không phải field được sửa.
    expect(payload.data).not.toHaveProperty("slug");
    expect(payload.data).toHaveProperty("name");
  });

  it("giải thích vì sao slug bị khoá, không để ô mờ không lời giải thích", async () => {
    const user = userEvent.setup();
    renderPage(<NewsCategoriesPage />);

    await user.click(screen.getByLabelText("Sửa chuyên mục Tin dự án"));
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText(/không đổi được sau khi tạo/),
    ).toBeInTheDocument();
  });
});

describe("NewsCategoriesPage — xóa", () => {
  it("chuyên mục CÒN bài: nút xóa bị khoá kèm lý do", () => {
    renderPage(<NewsCategoriesPage />);

    const button = screen.getByLabelText("Xóa chuyên mục Kiến trúc & Xây dựng");
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute(
      "title",
      expect.stringContaining("5 bài viết"),
    );
  });

  it("chuyên mục rỗng: xóa được, hộp xác nhận nêu tên + slug + số bài", async () => {
    const user = userEvent.setup();
    renderPage(<NewsCategoriesPage />);

    await user.click(screen.getByLabelText("Xóa chuyên mục Tin công ty"));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).getByText(/Xóa chuyên mục "Tin công ty"\?/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/tin-cong-ty/)).toBeInTheDocument();
    expect(
      within(dialog).getByText(/không có bài viết nào/),
    ).toBeInTheDocument();

    await user.click(
      within(dialog).getByRole("button", { name: "Xóa chuyên mục" }),
    );
    await waitFor(() =>
      expect(deleteCategory).toHaveBeenCalledWith("tin-cong-ty"),
    );
  });

  it("EDITOR không thấy nút xóa", () => {
    role.current = "EDITOR";
    renderPage(<NewsCategoriesPage />);

    expect(screen.queryByLabelText(/^Xóa chuyên mục/)).toBeNull();
    // Nhưng vẫn sửa được — EDITOR có quyền create/update ở backend.
    expect(screen.getByLabelText("Sửa chuyên mục Tin dự án")).toBeInTheDocument();
  });
});
