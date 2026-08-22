/**
 * Thông báo lỗi song ngữ trên BA FORM CMS THẬT — Banner, Trang nội dung, Tin tức.
 *
 * `FormMessage.nested.test.tsx` khoá hợp đồng chung ở tầng hạ tầng. Bộ này trả
 * lời câu hỏi khác: bản sửa DÙNG CHUNG có thật sự chạy trong các form production
 * mà **không** cần chỉnh riêng từng form hay không. Vì thế nó dựng đúng component
 * dialog thật, với schema thật, và kiểm luôn hai điều người dùng quan tâm nhất:
 *
 *  - form không hợp lệ thì **không có request nào** rời khỏi trình duyệt,
 *  - và người dùng **đọc được** vì sao.
 *
 * Ba form này đại diện cho cả sáu nhóm dùng `bilingualText`: Cooperation và
 * Project đi qua đúng cặp `FormField` + `FormMessage` đó (mỗi file 7 FormMessage),
 * còn `ProjectContentTab`/`ProjectItemsTab` không dùng react-hook-form nên nằm
 * ngoài phạm vi lỗi này.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { BannerFormDialog } from "@/components/banners/BannerFormDialog";
import { PageFormDialog } from "@/components/pages/PageFormDialog";
import { NewsFormDialog } from "@/components/news/NewsFormDialog";
import { Button } from "@/components/ui/button";
import type { NewsCategory } from "@/types";

const spies = vi.hoisted(() => ({
  createBanner: vi.fn(async () => ({})),
  updateBanner: vi.fn(async () => ({})),
  createPage: vi.fn(async () => ({})),
  updatePage: vi.fn(async () => ({})),
  createNews: vi.fn(async () => ({})),
  updateNews: vi.fn(async () => ({})),
  /** Mọi lệnh phụ — phải đứng yên khi form không hợp lệ. */
  other: vi.fn(async () => ({})),
}));

const categories: NewsCategory[] = [
  { id: "c1", slug: "tin-du-an", name: { vi: "Tin dự án" }, order: 0, publishedCount: 0 },
];

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  return {
    queryKeys: {},
    useCreateBanner: mutation(spies.createBanner),
    useUpdateBanner: mutation(spies.updateBanner),
    useCreatePage: mutation(spies.createPage),
    useUpdatePage: mutation(spies.updatePage),
    useUpdatePageStatus: mutation(spies.other),
    useSchedulePagePublication: mutation(spies.other),
    useCreateNews: mutation(spies.createNews),
    useUpdateNews: mutation(spies.updateNews),
    useUpdateNewsStatus: mutation(spies.other),
    useScheduleNewsPublication: mutation(spies.other),
    useNewsCategories: () => ({ data: categories, isLoading: false }),
    useMedia: () => ({ data: [], isLoading: false }),
    useUploadMedia: mutation(spies.other),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "Quản trị", email: "a@b.c", role: "ADMIN" },
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderUI(ui: ReactElement) {
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
  for (const spy of Object.values(spies)) spy.mockClear();
});

/** Ô nhập của field mang nhãn đã cho, trong phạm vi hộp thoại. */
function controlIn(dialog: HTMLElement, labelText: string): HTMLElement {
  const label = within(dialog)
    .getByText(labelText)
    .closest("label") as HTMLLabelElement;
  return document.getElementById(label.getAttribute("for")!) as HTMLElement;
}

function describedTextOf(control: HTMLElement): string {
  return (control.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
}

/**
 * Ba form, cùng một kỳ vọng. Mỗi mục mô tả: cách mở, nút gửi, thông báo phải
 * thấy, và spy tạo mới tương ứng.
 */
const FORMS = [
  {
    name: "Banner",
    open: "Thêm banner",
    submit: "Thêm banner",
    field: "Tiêu đề",
    message: "Tiêu đề tối thiểu 3 ký tự.",
    valid: "Khu đô thị Hưng Phú",
    create: spies.createBanner,
    render: () => (
      <BannerFormDialog trigger={<Button>Thêm banner</Button>} />
    ),
  },
  {
    name: "Trang nội dung",
    open: "Tạo trang",
    submit: "Lưu nháp",
    field: "Tiêu đề",
    message: "Tiêu đề tối thiểu 3 ký tự.",
    valid: "Giới thiệu công ty",
    create: spies.createPage,
    render: () => <PageFormDialog trigger={<Button>Tạo trang</Button>} />,
  },
  {
    name: "Tin tức",
    open: "Viết tin",
    submit: "Lưu nháp",
    field: "Tiêu đề",
    message: "Tiêu đề tối thiểu 3 ký tự.",
    valid: "Bài viết mới của Thiên Đức",
    create: spies.createNews,
    render: () => <NewsFormDialog trigger={<Button>Viết tin</Button>} />,
  },
] as const;

describe.each(FORMS)(
  "$name — field song ngữ bắt buộc bỏ trống",
  ({ open, submit, field, message, valid, create, render: renderForm }) => {
    async function openDialog() {
      const user = userEvent.setup();
      renderUI(renderForm());
      await user.click(screen.getByRole("button", { name: open }));
      return { user, dialog: await screen.findByRole("dialog") };
    }

    it("hiện ĐÚNG thông báo của schema (trước đây trống trơn)", async () => {
      const { user, dialog } = await openDialog();
      await user.click(within(dialog).getByRole("button", { name: submit }));

      expect(await within(dialog).findByText(message)).toBeInTheDocument();
    });

    /** §14 + §22 — không hợp lệ thì KHÔNG có request nào rời đi. */
    it("không gửi request nào khi form không hợp lệ", async () => {
      const { user, dialog } = await openDialog();
      await user.click(within(dialog).getByRole("button", { name: submit }));
      await within(dialog).findByText(message);

      expect(create).not.toHaveBeenCalled();
      expect(spies.other).not.toHaveBeenCalled();
    });

    /** §10 + §12F/G — thông báo phải thật sự tới được trình đọc màn hình. */
    it("thông báo được nối vào ô nhập, aria-invalid bật, tên field không đổi", async () => {
      const { user, dialog } = await openDialog();
      await user.click(within(dialog).getByRole("button", { name: submit }));
      await within(dialog).findByText(message);

      const control = controlIn(dialog, field);
      expect(control).toHaveAttribute("aria-invalid", "true");
      expect(describedTextOf(control)).toContain(message);
      // Batch 13A không bị kéo lùi.
      expect(control).not.toHaveAttribute("aria-label");
      expect(within(dialog).getByRole("textbox", { name: field })).toBe(control);
      expect(describedTextOf(control)).toContain("Tiếng Việt");
    });

    /** §14 — sửa đúng thì lỗi tự mất và nội dung đang gõ còn nguyên. */
    it("gõ giá trị hợp lệ: thông báo biến mất, nội dung giữ nguyên", async () => {
      const { user, dialog } = await openDialog();
      await user.click(within(dialog).getByRole("button", { name: submit }));
      await within(dialog).findByText(message);

      await user.type(controlIn(dialog, field), valid);

      await waitFor(() =>
        expect(within(dialog).queryByText(message)).toBeNull(),
      );
      expect(controlIn(dialog, field)).toHaveValue(valid);
    });
  },
);

/**
 * §15 — chuyển tab VI/EN trên một field ĐANG lỗi. `en` là tùy chọn nên không
 * được tự nhiên trở thành bắt buộc, và thông báo cũng không được nhân đôi.
 */
describe("Chuyển VI/EN khi field đang lỗi", () => {
  it("Banner: lỗi VI giữ nguyên đúng một thông báo, EN không thành bắt buộc", async () => {
    const user = userEvent.setup();
    renderUI(<BannerFormDialog trigger={<Button>Thêm banner</Button>} />);
    await user.click(screen.getByRole("button", { name: "Thêm banner" }));
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByRole("button", { name: "Thêm banner" }));
    await within(dialog).findByText("Tiêu đề tối thiểu 3 ký tự.");

    const item = within(dialog)
      .getByText("Tiêu đề")
      .closest("[data-slot='form-item']") as HTMLElement;
    await user.click(item.querySelectorAll("button[aria-pressed]")[1]);

    const messages = item.querySelectorAll("[data-slot='form-message']");
    expect(messages).toHaveLength(1);
    expect(messages[0].textContent).toBe("Tiêu đề tối thiểu 3 ký tự.");

    // Ô EN rỗng và vẫn được nối đúng thông báo + danh tính field.
    const control = controlIn(dialog, "Tiêu đề");
    expect(control).toHaveValue("");
    expect(within(dialog).getByRole("textbox", { name: "Tiêu đề" })).toBe(control);
    expect(describedTextOf(control)).toContain("Tiêu đề tối thiểu 3 ký tự.");
    expect(describedTextOf(control)).toContain("English");
  });
});
