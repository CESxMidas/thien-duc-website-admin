/**
 * Chuyên mục là **bắt buộc ở form Admin**, trong khi API vẫn để tuỳ chọn
 * (`categoryId String?`) để không phá hợp đồng với consumer cũ.
 *
 * Điều dễ hỏng nhất: bài CŨ chưa phân loại (`categoryId: null`) phải mở được
 * form bình thường — siết yêu cầu mà làm sập màn sửa bài cũ là đổi một vấn đề
 * nhỏ lấy một vấn đề lớn hơn.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { NewsFormDialog } from "@/components/news/NewsFormDialog";
import { Button } from "@/components/ui/button";
import type { NewsCategory, NewsPost } from "@/types";

const { createNews, updateNews } = vi.hoisted(() => ({
  createNews: vi.fn(async () => {}),
  updateNews: vi.fn(async () => {}),
}));

const categoryList = vi.hoisted(() => ({ current: [] as NewsCategory[] }));

const categories: NewsCategory[] = [
  {
    id: "c1",
    slug: "tin-du-an",
    name: { vi: "Tin dự án" },
    order: 0,
    publishedCount: 2,
  },
  {
    id: "c2",
    slug: "tin-cong-ty",
    name: { vi: "Tin công ty" },
    order: 1,
    publishedCount: 0,
  },
];

/** Bài CŨ chưa phân loại — đúng hình dạng API trả về cho dữ liệu tồn đọng. */
const legacyPost: NewsPost = {
  id: "n1",
  slug: "bai-cu-chua-phan-loai",
  title: { vi: "Bài cũ chưa phân loại" },
  summary: { vi: "Tóm tắt bài cũ đủ dài để qua ràng buộc." },
  content: null,
  categoryId: null,
  category: null,
  author: null,
  image: null,
  eventDate: null,
  publishedAt: null,
  scheduledAt: null,
  status: "DRAFT",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: () => Promise<void>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  return {
    queryKeys: {},
    useNewsCategories: () => ({ data: categoryList.current, isLoading: false }),
    useCreateNews: mutation(createNews),
    useUpdateNews: mutation(updateNews),
    useMedia: () => ({ data: [], isLoading: false }),
    useUploadMedia: mutation(async () => {}),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "ADMIN" } }),
}));

function renderForm(ui: ReactElement) {
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
  createNews.mockClear();
  updateNews.mockClear();
  categoryList.current = categories;
});

async function openForm(post?: NewsPost) {
  const user = userEvent.setup();
  renderForm(<NewsFormDialog post={post} trigger={<Button>Mở</Button>} />);
  await user.click(screen.getByRole("button", { name: "Mở" }));
  return { user, dialog: await screen.findByRole("dialog") };
}

describe("NewsFormDialog — chuyên mục bắt buộc", () => {
  it('KHÔNG còn lựa chọn "Chưa phân loại"', async () => {
    const { user, dialog } = await openForm();

    await user.click(within(dialog).getByRole("combobox", { name: /Chuyên mục/i }));

    // Radix render cả danh sách bật lên lẫn một <select> ẩn cho autofill, nên
    // bám vào role="option" thay vì text thuần (text khớp cả hai).
    expect(screen.queryByRole("option", { name: "Chưa phân loại" })).toBeNull();
    expect(
      await screen.findByRole("option", { name: "Tin dự án" }),
    ).toBeInTheDocument();
  });

  it("không chọn chuyên mục thì không gửi được, có thông báo rõ", async () => {
    const { user, dialog } = await openForm();

    // Form có nhiều BilingualField (tiêu đề, tóm tắt, nội dung) — ô đầu tiên
    // là tiêu đề.
    await user.type(
      within(dialog).getAllByRole("textbox", { name: "Tiếng Việt" })[0],
      "Tiêu đề bài mới",
    );
    await user.click(
      within(dialog).getByRole("button", { name: /Lưu|Tạo|Đăng/ }),
    );

    expect(
      await within(dialog).findByText("Hãy chọn chuyên mục cho bài viết."),
    ).toBeInTheDocument();
    expect(createNews).not.toHaveBeenCalled();
  });

  it("bài cũ CHƯA phân loại vẫn mở được form sửa, không crash", async () => {
    const { dialog } = await openForm(legacyPost);

    // Form hiện ra bình thường và giữ nguyên dữ liệu cũ.
    expect(
      within(dialog).getByDisplayValue("bai-cu-chua-phan-loai"),
    ).toBeInTheDocument();
    // Ô chuyên mục để trống, chờ người dùng chọn.
    expect(
      within(dialog).getByRole("combobox", { name: /Chuyên mục/i }),
    ).toHaveTextContent("Chọn chuyên mục");
  });

  it("bài cũ chưa phân loại: phải chọn chuyên mục mới lưu được", async () => {
    const { user, dialog } = await openForm(legacyPost);

    await user.click(
      within(dialog).getByRole("button", { name: /Lưu|Cập nhật/ }),
    );

    expect(
      await within(dialog).findByText("Hãy chọn chuyên mục cho bài viết."),
    ).toBeInTheDocument();
    expect(updateNews).not.toHaveBeenCalled();
  });

  it("chọn chuyên mục hợp lệ thì payload mang đúng categoryId", async () => {
    const { user, dialog } = await openForm(legacyPost);

    await user.click(
      within(dialog).getByRole("combobox", { name: /Chuyên mục/i }),
    );
    await user.click(await screen.findByRole("option", { name: "Tin dự án" }));
    await user.click(
      within(dialog).getByRole("button", { name: /Lưu|Cập nhật/ }),
    );

    await waitFor(() => expect(updateNews).toHaveBeenCalledTimes(1));
    const [payload] = updateNews.mock.calls[0] as unknown as [
      { data: { categoryId?: string } },
    ];
    expect(payload.data.categoryId).toBe("c1");
  });
});

describe("NewsFormDialog — chưa có chuyên mục nào", () => {
  it("khoá ô chọn và chỉ đường sang trang quản lý chuyên mục", async () => {
    categoryList.current = [];
    const { dialog } = await openForm();

    expect(
      within(dialog).getByRole("combobox", { name: /Chuyên mục/i }),
    ).toBeDisabled();
    const link = within(dialog).getByRole("link", { name: "Tạo chuyên mục" });
    expect(link).toHaveAttribute("href", "/tin-tuc/chuyen-muc");
  });
});
