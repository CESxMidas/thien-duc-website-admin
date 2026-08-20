/**
 * **Batch 11 — màn Trang nội dung với lịch đăng.**
 *
 * Ba thứ được khoá ở đây:
 *  1. Huy hiệu XUẤT BẢN phân biệt được năm trạng thái bằng CHỮ.
 *  2. Ma trận thao tác đúng theo vai trò × trạng thái — không hiện nút mà backend
 *     chắc chắn từ chối (huỷ lịch đã tới hạn, lên lịch trang từng đăng).
 *  3. Luồng đặt / đổi / huỷ lịch gọi đúng route lệnh với đúng slug và instant.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PagesPage } from "@/pages/PagesPage";
import type { Role, StaticPage } from "@/types";

const {
  schedulePublication,
  cancelPublication,
  updateStatus,
  pageRows,
  role,
} = vi.hoisted(() => ({
  schedulePublication: vi.fn(async () => {}),
  cancelPublication: vi.fn(async () => {}),
  updateStatus: vi.fn(async () => {}),
  pageRows: { current: [] as StaticPage[] },
  role: { current: "ADMIN" as Role },
}));

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  const empty = () => ({ data: [], isLoading: false, isError: false });
  return {
    queryKeys: {},
    usePages: () => ({ data: pageRows.current, isLoading: false }),
    useCreatePage: mutation(async () => ({ slug: "trang-moi" })),
    useUpdatePage: mutation(async () => {}),
    useUpdatePageStatus: mutation(updateStatus),
    useSchedulePagePublication: mutation(schedulePublication),
    useCancelPagePublication: mutation(cancelPublication),
    useMedia: empty,
    useUploadMedia: mutation(async () => {}),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "A", email: "a@b.c", role: role.current },
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/** "Bây giờ" cố định: 13/08/2026 17:00 giờ VN. */
const NOW = new Date("2026-08-13T10:00:00.000Z");
/** Mốc hẹn ở tương lai — 20/08/2026 08:00 giờ VN. */
const FUTURE = "2026-08-20T01:00:00.000Z";
/** Mốc đã qua — 13/08/2026 16:00 giờ VN (một giờ trước). */
const PAST = "2026-08-13T09:00:00.000Z";

function makePage(
  overrides: Partial<StaticPage> & { slug: string },
): StaticPage {
  return {
    id: overrides.slug,
    title: { vi: `Trang ${overrides.slug}` },
    content: [{ vi: "Nội dung." }],
    status: "DRAFT",
    publishedAt: null,
    scheduledAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const ROWS = {
  draft: makePage({ slug: "nhap" }),
  pending: makePage({ slug: "cho-duyet", status: "PENDING" }),
  scheduled: makePage({
    slug: "da-len-lich",
    status: "PENDING",
    scheduledAt: FUTURE,
    publishedAt: FUTURE,
  }),
  due: makePage({
    slug: "toi-han",
    status: "PENDING",
    scheduledAt: PAST,
    publishedAt: PAST,
  }),
  published: makePage({
    slug: "da-dang",
    status: "PUBLISHED",
    publishedAt: PAST,
  }),
  historicalDraft: makePage({ slug: "nhap-tung-dang", publishedAt: PAST }),
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <PagesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Hàng của bảng theo tiêu đề trang. */
function rowOf(slug: string) {
  return screen.getByText(`Trang ${slug}`).closest("tr") as HTMLElement;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  role.current = "ADMIN";
  pageRows.current = Object.values(ROWS);
  schedulePublication.mockClear();
  cancelPublication.mockClear();
  updateStatus.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("huy hiệu xuất bản (§45)", () => {
  it.each([
    ["nhap", "Nháp"],
    ["cho-duyet", "Chờ duyệt"],
    ["da-len-lich", "Đã lên lịch"],
    ["toi-han", "Đã đến giờ đăng"],
    ["da-dang", "Đã đăng"],
  ])("%s → %s", (slug, label) => {
    renderPage();
    expect(within(rowOf(slug)).getByText(label)).toBeInTheDocument();
  });

  it("hàng đã lên lịch hiện mốc giờ đã hẹn", () => {
    renderPage();
    expect(
      within(rowOf("da-len-lich")).getByText(/20\/08\/2026/),
    ).toBeInTheDocument();
  });
});

describe("ma trận thao tác — ADMIN (§39)", () => {
  it("nháp: có Lên lịch và Đăng ngay, không có Huỷ lịch", () => {
    renderPage();
    const row = within(rowOf("nhap"));
    expect(row.getByRole("button", { name: /Lên lịch/ })).toBeInTheDocument();
    expect(row.getByRole("button", { name: /Đăng ngay/ })).toBeInTheDocument();
    expect(row.queryByRole("button", { name: /Huỷ lịch/ })).toBeNull();
  });

  it("chờ duyệt chưa hẹn giờ: có Lên lịch (duyệt bằng lịch) và Duyệt & đăng", () => {
    renderPage();
    const row = within(rowOf("cho-duyet"));
    expect(row.getByRole("button", { name: /Lên lịch/ })).toBeInTheDocument();
    expect(
      row.getByRole("button", { name: /Duyệt & đăng/ }),
    ).toBeInTheDocument();
  });

  it("đã lên lịch: Đổi lịch + Huỷ lịch + Đăng ngay, KHÔNG có Trả về nháp", () => {
    renderPage();
    const row = within(rowOf("da-len-lich"));
    expect(row.getByRole("button", { name: /Đổi lịch/ })).toBeInTheDocument();
    expect(row.getByRole("button", { name: /Huỷ lịch/ })).toBeInTheDocument();
    expect(row.getByRole("button", { name: /Đăng ngay/ })).toBeInTheDocument();
    expect(row.queryByRole("button", { name: /Trả về nháp/ })).toBeNull();
  });

  /** §39 — tới hạn nghĩa là đã công khai; huỷ lịch tương lai không còn nghĩa. */
  it("đã tới hạn: KHÔNG có Huỷ lịch", () => {
    renderPage();
    expect(
      within(rowOf("toi-han")).queryByRole("button", { name: /Huỷ lịch/ }),
    ).toBeNull();
  });

  it("đã đăng: không đặt lịch lần đầu được", () => {
    renderPage();
    const row = within(rowOf("da-dang"));
    expect(row.queryByRole("button", { name: /Lên lịch/ })).toBeNull();
    expect(row.getByRole("button", { name: /Trả về nháp/ })).toBeInTheDocument();
  });

  it("nháp từng đăng: không hẹn giờ lại được", () => {
    renderPage();
    expect(
      within(rowOf("nhap-tung-dang")).queryByRole("button", {
        name: /Lên lịch/,
      }),
    ).toBeNull();
  });
});

describe("ma trận thao tác — EDITOR (§39, §54)", () => {
  beforeEach(() => {
    role.current = "EDITOR";
  });

  it("không thấy thao tác lịch nào ở bất kỳ hàng nào", () => {
    renderPage();
    expect(screen.queryByRole("button", { name: /Lên lịch/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Đổi lịch/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Huỷ lịch/ })).toBeNull();
  });

  it("sửa được nháp và chờ duyệt chưa hẹn giờ", () => {
    renderPage();
    for (const slug of ["nhap", "cho-duyet"]) {
      expect(
        within(rowOf(slug)).getByRole("button", { name: "Sửa trang" }),
      ).toBeInTheDocument();
    }
  });

  it.each(["da-len-lich", "toi-han", "da-dang", "nhap-tung-dang"])(
    "KHÔNG sửa được: %s",
    (slug) => {
      renderPage();
      expect(
        within(rowOf(slug)).queryByRole("button", { name: "Sửa trang" }),
      ).toBeNull();
    },
  );

  it("vẫn gửi duyệt được bản nháp như trước", () => {
    renderPage();
    expect(
      within(rowOf("nhap")).getByRole("button", { name: /Gửi duyệt/ }),
    ).toBeInTheDocument();
  });
});

describe("lệnh lịch gọi đúng route", () => {
  it("huỷ lịch gửi đúng slug", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(
      within(rowOf("da-len-lich")).getByRole("button", { name: /Huỷ lịch/ }),
    );

    expect(cancelPublication).toHaveBeenCalledWith("da-len-lich");
  });

  it("đặt lịch gửi slug + instant có múi giờ tường minh", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(
      within(rowOf("nhap")).getByRole("button", { name: /Lên lịch/ }),
    );
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Ngày đăng"), "2026-08-20");
    await user.type(within(dialog).getByLabelText("Giờ đăng"), "08:00");
    await user.click(within(dialog).getByRole("button", { name: /Lên lịch/ }));

    expect(schedulePublication).toHaveBeenCalledWith({
      slug: "nhap",
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
  });

  it("Đổi lịch nạp sẵn mốc hiện tại theo giờ Việt Nam", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(
      within(rowOf("da-len-lich")).getByRole("button", { name: /Đổi lịch/ }),
    );
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Ngày đăng")).toHaveValue(
      "2026-08-20",
    );
    expect(within(dialog).getByLabelText("Giờ đăng")).toHaveValue("08:00");
  });

  /** "Đăng ngay" một trang đang hẹn giờ vẫn đi qua route trạng thái như cũ. */
  it('"Đăng ngay" trên hàng đã lên lịch gọi lệnh trạng thái, không phải lệnh lịch', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(
      within(rowOf("da-len-lich")).getByRole("button", { name: /Đăng ngay/ }),
    );

    expect(updateStatus).toHaveBeenCalledWith({
      slug: "da-len-lich",
      status: "PUBLISHED",
    });
    expect(schedulePublication).not.toHaveBeenCalled();
  });
});
