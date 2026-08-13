/**
 * Màn Tin tức với lịch đăng (Batch 4).
 *
 * Ba thứ được khoá ở đây:
 *  1. Huy hiệu phân biệt được năm trạng thái bằng CHỮ (không chỉ bằng màu).
 *  2. Ma trận thao tác đúng theo vai trò × trạng thái — không hiện nút mà
 *     backend chắc chắn từ chối (huỷ lịch đã tới hạn, lên lịch bài từng đăng).
 *  3. Luồng đặt / đổi / huỷ lịch gọi đúng route lệnh với đúng chuỗi instant.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { NewsPage } from "@/pages/NewsPage";
import { ApiRequestError } from "@/lib/api/client";
import type { NewsPost, Role } from "@/types";

const { schedulePublication, cancelPublication, updateStatus, newsRows, role } =
  vi.hoisted(() => ({
    schedulePublication: vi.fn(async () => {}),
    cancelPublication: vi.fn(async () => {}),
    updateStatus: vi.fn(async () => {}),
    newsRows: { current: [] as NewsPost[] },
    role: { current: "ADMIN" as Role },
  }));

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  const empty = () => ({ data: [], isLoading: false });
  return {
    queryKeys: {},
    useNews: () => ({ data: newsRows.current, isLoading: false }),
    useNewsCategories: empty,
    useNewsCategoriesForAdmin: empty,
    useCreateNews: mutation(async () => {}),
    useUpdateNews: mutation(async () => {}),
    useUpdateNewsStatus: mutation(updateStatus),
    useDeleteNews: mutation(async () => {}),
    useScheduleNewsPublication: mutation(schedulePublication),
    useCancelNewsPublication: mutation(cancelPublication),
    useMedia: empty,
    useUploadMedia: mutation(async () => {}),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", name: "A", email: "a@b.c", role: role.current } }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** "Bây giờ" cố định: 13/08/2026 17:00 giờ VN. */
const NOW = new Date("2026-08-13T10:00:00.000Z");

/** Mốc hẹn ở tương lai — 20/08/2026 08:00 giờ VN. */
const FUTURE = "2026-08-20T01:00:00.000Z";
/** Mốc đã qua — 13/08/2026 16:00 giờ VN (một giờ trước). */
const PAST = "2026-08-13T09:00:00.000Z";

function makePost(overrides: Partial<NewsPost> & { id: string }): NewsPost {
  return {
    slug: `bai-${overrides.id}`,
    title: { vi: `Bài ${overrides.id}` },
    summary: { vi: "Tóm tắt." },
    content: null,
    categoryId: null,
    category: null,
    author: null,
    image: null,
    eventDate: null,
    publishedAt: null,
    scheduledAt: null,
    status: "DRAFT",
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const draftPost = makePost({ id: "nhap", title: { vi: "Bài nháp" } });
const pendingPost = makePost({
  id: "cho-duyet",
  title: { vi: "Bài chờ duyệt" },
  status: "PENDING",
});
const scheduledPost = makePost({
  id: "len-lich",
  title: { vi: "Bài đã lên lịch" },
  status: "PENDING",
  scheduledAt: FUTURE,
  publishedAt: FUTURE,
});
const duePost = makePost({
  id: "toi-gio",
  title: { vi: "Bài tới giờ" },
  status: "PENDING",
  scheduledAt: PAST,
  publishedAt: PAST,
});
const publishedPost = makePost({
  id: "da-dang",
  title: { vi: "Bài đã đăng" },
  status: "PUBLISHED",
  publishedAt: PAST,
});
const historicalDraft = makePost({
  id: "tung-dang",
  title: { vi: "Bài từng đăng" },
  status: "DRAFT",
  publishedAt: PAST,
});

const ALL_POSTS = [
  draftPost,
  pendingPost,
  scheduledPost,
  duePost,
  publishedPost,
  historicalDraft,
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  schedulePublication.mockClear();
  cancelPublication.mockClear();
  updateStatus.mockClear();
  newsRows.current = ALL_POSTS;
  role.current = "ADMIN";
});

afterEach(() => {
  vi.useRealTimers();
});

function renderPage() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NewsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return user;
}

/** Hàng của bảng chứa bài có tiêu đề cho trước. */
function row(title: string): HTMLElement {
  const cell = screen.getByText(title).closest("tr");
  if (!cell) throw new Error(`Không tìm thấy hàng "${title}"`);
  return cell;
}

function buttonNames(title: string): string[] {
  return within(row(title))
    .getAllByRole("button")
    .map((button) => button.textContent?.trim() ?? "")
    .filter((label) => label !== "");
}

describe("NewsPage — huy hiệu trạng thái", () => {
  it("phân biệt năm trạng thái bằng nhãn chữ", () => {
    renderPage();

    expect(within(row("Bài nháp")).getByText("Nháp")).toBeInTheDocument();
    expect(
      within(row("Bài chờ duyệt")).getByText("Chờ duyệt"),
    ).toBeInTheDocument();
    expect(
      within(row("Bài đã lên lịch")).getByText("Đã lên lịch"),
    ).toBeInTheDocument();
    expect(
      within(row("Bài tới giờ")).getByText("Đã đến giờ đăng"),
    ).toBeInTheDocument();
    expect(within(row("Bài đã đăng")).getByText("Đã đăng")).toBeInTheDocument();
  });

  it("bài đã lên lịch hiện mốc hẹn theo giờ Việt Nam", () => {
    renderPage();
    expect(
      within(row("Bài đã lên lịch")).getByText("20/08/2026 · 08:00"),
    ).toBeInTheDocument();
  });

  it("bài tới giờ nói đúng sự thật: đã công khai, đang chờ đồng bộ", () => {
    renderPage();
    const scheduledRow = row("Bài tới giờ");

    expect(
      within(scheduledRow).getByText("Đã hiển thị công khai, đang chờ đồng bộ"),
    ).toBeInTheDocument();
    // KHÔNG được nói "Chờ duyệt": backend đã cho bài này ra công khai.
    expect(within(scheduledRow).queryByText("Chờ duyệt")).toBeNull();
  });

  it("bài từng đăng đã gỡ về nháp vẫn là Nháp", () => {
    renderPage();
    expect(within(row("Bài từng đăng")).getByText("Nháp")).toBeInTheDocument();
  });
});

describe("NewsPage — ma trận thao tác của ADMIN/SUPER_ADMIN", () => {
  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: nháp chưa từng đăng có Lên lịch",
    (currentRole) => {
      role.current = currentRole;
      renderPage();
      expect(buttonNames("Bài nháp")).toContain("Lên lịch");
    },
  );

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: bài chờ duyệt chưa từng đăng có Lên lịch",
    (currentRole) => {
      role.current = currentRole;
      renderPage();
      expect(buttonNames("Bài chờ duyệt")).toContain("Lên lịch");
    },
  );

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: lịch tương lai có Đăng ngay / Đổi lịch / Huỷ lịch",
    (currentRole) => {
      role.current = currentRole;
      renderPage();
      const labels = buttonNames("Bài đã lên lịch");

      expect(labels).toContain("Đăng ngay");
      expect(labels).toContain("Đổi lịch");
      expect(labels).toContain("Huỷ lịch");
      expect(labels).not.toContain("Lên lịch");
      // "Trả về nháp" bị ẩn ở trạng thái này vì "Huỷ lịch" cho ra cùng kết quả.
      expect(labels).not.toContain("Trả về nháp");
    },
  );

  it("bài đã tới hạn: KHÔNG có Huỷ lịch, vẫn Trả về nháp được", () => {
    renderPage();
    const labels = buttonNames("Bài tới giờ");

    expect(labels).not.toContain("Huỷ lịch");
    expect(labels).not.toContain("Lên lịch");
    expect(labels).toContain("Trả về nháp");
  });

  it("bài đang đăng: không có thao tác lịch nào", () => {
    renderPage();
    const labels = buttonNames("Bài đã đăng");

    expect(labels).not.toContain("Lên lịch");
    expect(labels).not.toContain("Đổi lịch");
    expect(labels).toContain("Trả về nháp");
  });

  it("nháp TỪNG đăng: không có Lên lịch (v1 không hẹn giờ đăng lại)", () => {
    renderPage();
    const labels = buttonNames("Bài từng đăng");

    expect(labels).not.toContain("Lên lịch");
    expect(labels).toContain("Đăng ngay");
  });
});

describe("NewsPage — EDITOR không có quyền đặt lịch", () => {
  beforeEach(() => {
    role.current = "EDITOR";
  });

  it("không thấy nút đặt lịch nào trên toàn bảng", () => {
    renderPage();

    for (const label of ["Lên lịch", "Đổi lịch", "Huỷ lịch"]) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
  });

  it("vẫn gửi duyệt được bản nháp như trước", () => {
    renderPage();
    expect(buttonNames("Bài nháp")).toContain("Gửi duyệt");
  });
});

describe("NewsPage — luồng đặt lịch", () => {
  it("mở hộp thoại, nhập ngày giờ và gọi route lệnh với instant +07:00", async () => {
    const user = renderPage();

    await user.click(
      within(row("Bài nháp")).getByRole("button", { name: "Lên lịch" }),
    );
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Ngày đăng"), "2026-08-20");
    await user.type(within(dialog).getByLabelText("Giờ đăng"), "08:00");
    await user.click(within(dialog).getByRole("button", { name: /Lên lịch/ }));

    expect(schedulePublication).toHaveBeenCalledWith({
      slug: "bai-nhap",
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
  });

  it("thành công thì đóng hộp thoại", async () => {
    const user = renderPage();

    await user.click(
      within(row("Bài nháp")).getByRole("button", { name: "Lên lịch" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Ngày đăng"), "2026-08-20");
    await user.type(within(dialog).getByLabelText("Giờ đăng"), "08:00");
    await user.click(within(dialog).getByRole("button", { name: /Lên lịch/ }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("lỗi 409 của backend hiện NGUYÊN VĂN trong hộp thoại, không đóng", async () => {
    // 409 là lỗi nghiệp vụ, message của backend đã viết cho người dùng cuối —
    // `resolveApiError` cho hiện thẳng thay vì câu chung chung.
    schedulePublication.mockRejectedValueOnce(
      new ApiRequestError(409, {
        code: "CONFLICT",
        message: "Bài viết này đã từng được đăng nên không đặt lịch đăng lại được.",
      }),
    );
    const user = renderPage();

    await user.click(
      within(row("Bài nháp")).getByRole("button", { name: "Lên lịch" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText("Ngày đăng"), "2026-08-20");
    await user.type(within(dialog).getByLabelText("Giờ đăng"), "08:00");
    await user.click(within(dialog).getByRole("button", { name: /Lên lịch/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "đã từng được đăng nên không đặt lịch đăng lại được",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});

describe("NewsPage — đổi lịch, huỷ lịch, đăng ngay", () => {
  it("Đổi lịch nạp sẵn mốc hiện tại theo giờ Việt Nam", async () => {
    const user = renderPage();

    await user.click(
      within(row("Bài đã lên lịch")).getByRole("button", { name: "Đổi lịch" }),
    );
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Ngày đăng")).toHaveValue("2026-08-20");
    expect(within(dialog).getByLabelText("Giờ đăng")).toHaveValue("08:00");
    expect(within(dialog).getByText("Đổi lịch đăng bài")).toBeInTheDocument();
  });

  it("Đổi lịch gửi mốc mới qua cùng một route PATCH", async () => {
    const user = renderPage();

    await user.click(
      within(row("Bài đã lên lịch")).getByRole("button", { name: "Đổi lịch" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.clear(within(dialog).getByLabelText("Giờ đăng"));
    await user.type(within(dialog).getByLabelText("Giờ đăng"), "09:30");
    await user.click(within(dialog).getByRole("button", { name: /Đổi lịch/ }));

    expect(schedulePublication).toHaveBeenCalledWith({
      slug: "bai-len-lich",
      scheduledAt: "2026-08-20T09:30:00+07:00",
    });
  });

  it("Huỷ lịch gọi DELETE, không hỏi lại (thao tác đảo ngược được)", async () => {
    const user = renderPage();

    await user.click(
      within(row("Bài đã lên lịch")).getByRole("button", { name: "Huỷ lịch" }),
    );

    expect(cancelPublication).toHaveBeenCalledWith("bai-len-lich");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Đăng ngay từ lịch tương lai vẫn đi qua route status", async () => {
    const user = renderPage();

    await user.click(
      within(row("Bài đã lên lịch")).getByRole("button", { name: "Đăng ngay" }),
    );

    expect(updateStatus).toHaveBeenCalledWith({
      slug: "bai-len-lich",
      status: "PUBLISHED",
    });
    expect(schedulePublication).not.toHaveBeenCalled();
  });
});

describe("NewsPage — bộ lọc theo trạng thái", () => {
  it('"Đã lên lịch" gộp cả bài đã tới hạn, và đếm đúng', () => {
    renderPage();
    expect(
      screen.getByRole("button", { name: "Đã lên lịch (2)" }),
    ).toBeInTheDocument();
    // Bài tới giờ KHÔNG bị đếm vào hàng chờ duyệt.
    expect(
      screen.getByRole("button", { name: "Chờ duyệt (1)" }),
    ).toBeInTheDocument();
  });

  it("lọc rồi thì bảng chỉ còn bài có lịch, gần nhất lên trước", async () => {
    const user = renderPage();

    await user.click(screen.getByRole("button", { name: "Đã lên lịch (2)" }));

    expect(screen.queryByText("Bài nháp")).toBeNull();
    expect(screen.getByText("Bài tới giờ")).toBeInTheDocument();
    expect(screen.getByText("Bài đã lên lịch")).toBeInTheDocument();

    const titles = screen
      .getAllByRole("row")
      .slice(1)
      .map((tableRow) => within(tableRow).getAllByRole("cell")[0].textContent);
    // PAST (16:00 hôm nay) đứng trước FUTURE (20/08).
    expect(titles[0]).toContain("Bài tới giờ");
    expect(titles[1]).toContain("Bài đã lên lịch");
  });
});
