/**
 * **Batch 10 — màn Dự án hợp tác với lịch đăng.**
 *
 * Bốn thứ được khoá ở đây:
 *  1. Huy hiệu XUẤT BẢN phân biệt được năm trạng thái bằng CHỮ, và không lẫn với
 *     cột "Tiến độ" — vốn là `status`, một chuỗi mô tả bằng chữ hoàn toàn khác.
 *  2. Ma trận thao tác đúng theo vai trò × trạng thái — không hiện nút mà backend
 *     chắc chắn từ chối (huỷ lịch đã tới hạn, lên lịch bản từng đăng).
 *  3. Luồng đặt / đổi / huỷ lịch gọi đúng route lệnh với đúng `id` và instant.
 *  4. Nút đổi thứ tự tắt khi danh sách có bản đã đăng/đã lên lịch (§50) — vì
 *     lệnh reorder ghi lại `order` của CẢ danh sách.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CooperationPage } from "@/pages/CooperationPage";
import type { CooperationProject, Role } from "@/types";

const {
  schedulePublication,
  cancelPublication,
  updateStatus,
  reorder,
  cooperationRows,
  role,
} = vi.hoisted(() => ({
  schedulePublication: vi.fn(async () => {}),
  cancelPublication: vi.fn(async () => {}),
  updateStatus: vi.fn(async () => {}),
  reorder: vi.fn(async () => {}),
  cooperationRows: { current: [] as CooperationProject[] },
  role: { current: "ADMIN" as Role },
}));

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  const empty = () => ({ data: undefined, isLoading: false, isError: false });
  return {
    queryKeys: {},
    useCooperationProjects: () => ({
      data: cooperationRows.current,
      isLoading: false,
    }),
    useCreateCooperationProject: mutation(async () => ({ id: "moi" })),
    useUpdateCooperationProject: mutation(async () => {}),
    useUpdateCooperationStatus: mutation(updateStatus),
    useScheduleCooperationPublication: mutation(schedulePublication),
    useCancelCooperationPublication: mutation(cancelPublication),
    useReorderCooperationProjects: mutation(reorder),
    useDeleteCooperationProject: mutation(async () => {}),
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

function makeCooperation(
  overrides: Partial<CooperationProject> & { id: string },
): CooperationProject {
  const bilingual = { vi: "—" };
  return {
    name: { vi: `Hợp tác ${overrides.id}` },
    location: bilingual,
    role: bilingual,
    partner: bilingual,
    scale: bilingual,
    // TIẾN ĐỘ DỰ ÁN bằng chữ — cố ý đặt cho mọi hàng để chắc chắn nó không lẫn
    // vào cột trạng thái xuất bản.
    status: { vi: "Đã bàn giao" },
    image: null,
    contentStatus: "DRAFT",
    publishedAt: null,
    scheduledAt: null,
    order: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

const ROWS = {
  draft: makeCooperation({ id: "nhap" }),
  pending: makeCooperation({ id: "cho-duyet", contentStatus: "PENDING" }),
  scheduled: makeCooperation({
    id: "da-len-lich",
    contentStatus: "PENDING",
    scheduledAt: FUTURE,
    publishedAt: FUTURE,
  }),
  due: makeCooperation({
    id: "toi-han",
    contentStatus: "PENDING",
    scheduledAt: PAST,
    publishedAt: PAST,
  }),
  published: makeCooperation({
    id: "da-dang",
    contentStatus: "PUBLISHED",
    publishedAt: PAST,
  }),
  historicalDraft: makeCooperation({ id: "nhap-tung-dang", publishedAt: PAST }),
};

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CooperationPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Hàng của bảng theo tên dự án hợp tác. */
function rowOf(name: string) {
  return screen.getByText(name).closest("tr") as HTMLElement;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  role.current = "ADMIN";
  cooperationRows.current = Object.values(ROWS);
  schedulePublication.mockClear();
  cancelPublication.mockClear();
  updateStatus.mockClear();
  reorder.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("huy hiệu xuất bản (§47)", () => {
  it.each([
    ["Hợp tác nhap", "Nháp"],
    ["Hợp tác cho-duyet", "Chờ duyệt"],
    ["Hợp tác da-len-lich", "Đã lên lịch"],
    ["Hợp tác toi-han", "Đã đến giờ đăng"],
    ["Hợp tác da-dang", "Đã đăng"],
  ])("%s → %s", (name, label) => {
    renderPage();
    expect(within(rowOf(name)).getByText(label)).toBeInTheDocument();
  });

  /**
   * Hai cột, hai khái niệm. "Đã bàn giao" là TIẾN ĐỘ dự án; nó phải hiện ở cột
   * riêng và không bao giờ được dùng làm huy hiệu xuất bản.
   */
  it("tiến độ dự án (`status`) hiện riêng, không lẫn với huy hiệu xuất bản", () => {
    renderPage();
    const row = rowOf("Hợp tác nhap");
    expect(within(row).getByText("Đã bàn giao")).toBeInTheDocument();
    expect(within(row).getByText("Nháp")).toBeInTheDocument();
  });

  it("hàng đã lên lịch hiện mốc giờ đã hẹn", () => {
    renderPage();
    // 20/08/2026 08:00 giờ VN.
    expect(
      within(rowOf("Hợp tác da-len-lich")).getByText(/20\/08\/2026/),
    ).toBeInTheDocument();
  });
});

describe("ma trận thao tác — ADMIN (§42)", () => {
  it("nháp: có Lên lịch và Đăng ngay, không có Huỷ lịch", () => {
    renderPage();
    const row = within(rowOf("Hợp tác nhap"));
    expect(row.getByRole("button", { name: /Lên lịch/ })).toBeInTheDocument();
    expect(row.getByRole("button", { name: /Đăng ngay/ })).toBeInTheDocument();
    expect(row.queryByRole("button", { name: /Huỷ lịch/ })).toBeNull();
  });

  it("chờ duyệt chưa hẹn giờ: có Lên lịch (duyệt bằng lịch) và Duyệt & đăng", () => {
    renderPage();
    const row = within(rowOf("Hợp tác cho-duyet"));
    expect(row.getByRole("button", { name: /Lên lịch/ })).toBeInTheDocument();
    expect(
      row.getByRole("button", { name: /Duyệt & đăng/ }),
    ).toBeInTheDocument();
  });

  it("đã lên lịch: Đổi lịch + Huỷ lịch + Đăng ngay, KHÔNG có Trả về nháp", () => {
    renderPage();
    const row = within(rowOf("Hợp tác da-len-lich"));
    expect(row.getByRole("button", { name: /Đổi lịch/ })).toBeInTheDocument();
    expect(row.getByRole("button", { name: /Huỷ lịch/ })).toBeInTheDocument();
    expect(row.getByRole("button", { name: /Đăng ngay/ })).toBeInTheDocument();
    expect(row.queryByRole("button", { name: /Trả về nháp/ })).toBeNull();
  });

  /** §42 — tới hạn nghĩa là đã công khai; huỷ lịch tương lai không còn nghĩa. */
  it("đã tới hạn: KHÔNG có Huỷ lịch", () => {
    renderPage();
    const row = within(rowOf("Hợp tác toi-han"));
    expect(row.queryByRole("button", { name: /Huỷ lịch/ })).toBeNull();
  });

  it("đã đăng: không đặt lịch lần đầu được", () => {
    renderPage();
    const row = within(rowOf("Hợp tác da-dang"));
    expect(row.queryByRole("button", { name: /Lên lịch/ })).toBeNull();
    expect(row.getByRole("button", { name: /Trả về nháp/ })).toBeInTheDocument();
  });

  it("nháp từng đăng: không hẹn giờ lại được", () => {
    renderPage();
    expect(
      within(rowOf("Hợp tác nhap-tung-dang")).queryByRole("button", {
        name: /Lên lịch/,
      }),
    ).toBeNull();
  });
});

describe("ma trận thao tác — EDITOR (§42, §58)", () => {
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
    for (const name of ["Hợp tác nhap", "Hợp tác cho-duyet"]) {
      expect(
        within(rowOf(name)).getByRole("button", {
          name: "Sửa dự án hợp tác",
        }),
      ).toBeInTheDocument();
    }
  });

  it.each([
    "Hợp tác da-len-lich",
    "Hợp tác toi-han",
    "Hợp tác da-dang",
    "Hợp tác nhap-tung-dang",
  ])("KHÔNG sửa được: %s", (name) => {
    renderPage();
    expect(
      within(rowOf(name)).queryByRole("button", { name: "Sửa dự án hợp tác" }),
    ).toBeNull();
  });
});

describe("đổi thứ tự (§50)", () => {
  it("EDITOR: nút đổi thứ tự TẮT khi danh sách có bản đã đăng/đã lên lịch", () => {
    role.current = "EDITOR";
    renderPage();
    expect(
      within(rowOf("Hợp tác nhap")).getByLabelText("Đưa xuống dưới"),
    ).toBeDisabled();
  });

  it("EDITOR: bật lại khi mọi bản đều còn trong khâu biên tập", () => {
    role.current = "EDITOR";
    cooperationRows.current = [ROWS.draft, ROWS.pending];
    renderPage();
    expect(
      within(rowOf("Hợp tác nhap")).getByLabelText("Đưa xuống dưới"),
    ).toBeEnabled();
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: đổi thứ tự được kể cả khi có bản đã đăng",
    (current) => {
      role.current = current;
      renderPage();
      expect(
        within(rowOf("Hợp tác nhap")).getByLabelText("Đưa xuống dưới"),
      ).toBeEnabled();
    },
  );
});

describe("lệnh lịch gọi đúng route", () => {
  it("huỷ lịch gửi đúng id", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(
      within(rowOf("Hợp tác da-len-lich")).getByRole("button", {
        name: /Huỷ lịch/,
      }),
    );

    expect(cancelPublication).toHaveBeenCalledWith("da-len-lich");
  });

  it("đặt lịch gửi id + instant có múi giờ tường minh", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(
      within(rowOf("Hợp tác nhap")).getByRole("button", { name: /Lên lịch/ }),
    );
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Ngày đăng"), "2026-08-20");
    await user.type(within(dialog).getByLabelText("Giờ đăng"), "08:00");
    await user.click(within(dialog).getByRole("button", { name: /Lên lịch/ }));

    // Múi giờ TƯỜNG MINH — backend từ chối chuỗi không có offset.
    expect(schedulePublication).toHaveBeenCalledWith({
      id: "nhap",
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
  });

  /** "Đăng ngay" một bản đang hẹn giờ vẫn đi qua route trạng thái như cũ. */
  it('"Đăng ngay" trên hàng đã lên lịch gọi lệnh trạng thái, không phải lệnh lịch', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage();

    await user.click(
      within(rowOf("Hợp tác da-len-lich")).getByRole("button", {
        name: /Đăng ngay/,
      }),
    );

    expect(updateStatus).toHaveBeenCalledWith({
      id: "da-len-lich",
      status: "PUBLISHED",
    });
    expect(schedulePublication).not.toHaveBeenCalled();
  });
});
