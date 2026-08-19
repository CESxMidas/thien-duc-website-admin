/**
 * **Batch 9 — màn Dự án với lịch đăng.**
 *
 * Ba thứ được khoá ở đây:
 *  1. Huy hiệu XUẤT BẢN phân biệt được năm trạng thái bằng CHỮ, và không lẫn với
 *     cột "Tình trạng" (thi công) vốn là một khái niệm khác hẳn.
 *  2. Ma trận thao tác đúng theo vai trò × trạng thái — không hiện nút mà backend
 *     chắc chắn từ chối (huỷ lịch đã tới hạn, lên lịch dự án từng đăng).
 *  3. Luồng đặt / đổi / huỷ lịch gọi đúng route lệnh với đúng chuỗi instant.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ProjectsPage } from "@/pages/ProjectsPage";
import { ApiRequestError } from "@/lib/api/client";
import type { Project, Role } from "@/types";

const {
  schedulePublication,
  cancelPublication,
  updateStatus,
  projectRows,
  role,
} = vi.hoisted(() => ({
  schedulePublication: vi.fn(async () => {}),
  cancelPublication: vi.fn(async () => {}),
  updateStatus: vi.fn(async () => {}),
  projectRows: { current: [] as Project[] },
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
    useProjects: () => ({ data: projectRows.current, isLoading: false }),
    useProject: empty,
    useCreateProject: mutation(async () => ({ slug: "du-an-moi" })),
    useUpdateProject: mutation(async () => {}),
    useUpdateProjectStatus: mutation(updateStatus),
    useDeleteProject: mutation(async () => {}),
    useScheduleProjectPublication: mutation(schedulePublication),
    useCancelProjectPublication: mutation(cancelPublication),
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

function makeProject(overrides: Partial<Project> & { id: string }): Project {
  return {
    slug: `du-an-${overrides.id}`,
    title: { vi: `Dự án ${overrides.id}` },
    summary: { vi: "Tóm tắt." },
    // TÌNH TRẠNG THI CÔNG — cố ý đặt cho mọi hàng để chắc chắn nó không lẫn
    // vào cột trạng thái xuất bản.
    status: "DANG_THI_CONG",
    contentStatus: "DRAFT",
    publishedAt: null,
    scheduledAt: null,
    location: null,
    image: null,
    category: null,
    highlights: null,
    quickFacts: null,
    gallery: [],
    gallerySections: null,
    mapLocation: null,
    order: 0,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    items: [],
    _count: { galleryImages: 0 },
    ...overrides,
  };
}

const draftProject = makeProject({ id: "nhap", title: { vi: "Dự án nháp" } });
const pendingProject = makeProject({
  id: "cho-duyet",
  title: { vi: "Dự án chờ duyệt" },
  contentStatus: "PENDING",
});
const scheduledProject = makeProject({
  id: "len-lich",
  title: { vi: "Dự án đã lên lịch" },
  contentStatus: "PENDING",
  scheduledAt: FUTURE,
  publishedAt: FUTURE,
});
const dueProject = makeProject({
  id: "toi-gio",
  title: { vi: "Dự án tới giờ" },
  contentStatus: "PENDING",
  scheduledAt: PAST,
  publishedAt: PAST,
});
const publishedProject = makeProject({
  id: "da-dang",
  title: { vi: "Dự án đã đăng" },
  contentStatus: "PUBLISHED",
  publishedAt: PAST,
});
const historicalDraft = makeProject({
  id: "tung-dang",
  title: { vi: "Dự án từng đăng" },
  contentStatus: "DRAFT",
  publishedAt: PAST,
});

const ALL_PROJECTS = [
  draftProject,
  pendingProject,
  scheduledProject,
  dueProject,
  publishedProject,
  historicalDraft,
];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  schedulePublication.mockClear();
  cancelPublication.mockClear();
  updateStatus.mockClear();
  projectRows.current = ALL_PROJECTS;
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
        <ProjectsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return user;
}

/** Hàng của bảng chứa dự án có tiêu đề cho trước. */
function row(title: string): HTMLElement {
  const cell = screen.getByText(title).closest("tr");
  if (!cell) throw new Error(`Không tìm thấy hàng "${title}"`);
  return cell;
}

/**
 * Nhãn các nút trong một hàng. Dùng `queryAllByRole` chứ không phải
 * `getAllByRole`: với EDITOR + dự án đã lên lịch, hàng KHÔNG còn nút nào cả —
 * và đó chính là hành vi đúng cần khẳng định, không phải một lỗi tra cứu.
 */
function buttonNames(title: string): string[] {
  return within(row(title))
    .queryAllByRole("button")
    .map((button) => button.textContent?.trim() ?? "")
    .filter((label) => label !== "");
}

describe("ProjectsPage — huy hiệu trạng thái xuất bản", () => {
  it("phân biệt năm trạng thái bằng nhãn chữ", () => {
    renderPage();

    expect(within(row("Dự án nháp")).getByText("Nháp")).toBeInTheDocument();
    expect(
      within(row("Dự án chờ duyệt")).getByText("Chờ duyệt"),
    ).toBeInTheDocument();
    expect(
      within(row("Dự án đã lên lịch")).getByText("Đã lên lịch"),
    ).toBeInTheDocument();
    expect(
      within(row("Dự án tới giờ")).getByText("Đã đến giờ đăng"),
    ).toBeInTheDocument();
    expect(
      within(row("Dự án đã đăng")).getByText("Đã đăng"),
    ).toBeInTheDocument();
  });

  it("dự án đã lên lịch hiện mốc hẹn theo giờ Việt Nam", () => {
    renderPage();
    expect(
      within(row("Dự án đã lên lịch")).getByText("20/08/2026 · 08:00"),
    ).toBeInTheDocument();
  });

  it("dự án tới giờ nói đúng sự thật: đã công khai, đang chờ đồng bộ", () => {
    renderPage();
    const dueRow = row("Dự án tới giờ");

    expect(
      within(dueRow).getByText("Đã hiển thị công khai, đang chờ đồng bộ"),
    ).toBeInTheDocument();
    expect(within(dueRow).queryByText("Chờ duyệt")).toBeNull();
  });

  /**
   * Hai khái niệm, hai cột. Nhầm chúng là lỗi nghiệp vụ nghiêm trọng nhất có
   * thể xảy ra ở module này.
   */
  it("TÌNH TRẠNG THI CÔNG hiện riêng, không lẫn với trạng thái đăng", () => {
    renderPage();

    expect(
      within(row("Dự án nháp")).getByText("Đang thi công"),
    ).toBeInTheDocument();
    expect(within(row("Dự án nháp")).getByText("Nháp")).toBeInTheDocument();
  });

  it("nháp TỪNG đăng vẫn hiện là Nháp", () => {
    renderPage();
    expect(
      within(row("Dự án từng đăng")).getByText("Nháp"),
    ).toBeInTheDocument();
  });
});

describe("ProjectsPage — ma trận thao tác của ADMIN/SUPER_ADMIN", () => {
  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: nháp chưa từng đăng có Lên lịch",
    (currentRole) => {
      role.current = currentRole;
      renderPage();
      expect(buttonNames("Dự án nháp")).toContain("Lên lịch");
    },
  );

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: dự án chờ duyệt có Lên lịch (duyệt bằng cách hẹn giờ)",
    (currentRole) => {
      role.current = currentRole;
      renderPage();
      const labels = buttonNames("Dự án chờ duyệt");

      expect(labels).toContain("Lên lịch");
      expect(labels).toContain("Duyệt & đăng");
      expect(labels).toContain("Trả về nháp");
    },
  );

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: lịch tương lai có Đăng ngay / Đổi lịch / Huỷ lịch",
    (currentRole) => {
      role.current = currentRole;
      renderPage();
      const labels = buttonNames("Dự án đã lên lịch");

      expect(labels).toContain("Đăng ngay");
      expect(labels).toContain("Đổi lịch");
      expect(labels).toContain("Huỷ lịch");
      expect(labels).not.toContain("Lên lịch");
      // "Trả về nháp" bị ẩn ở trạng thái này vì "Huỷ lịch" cho ra cùng kết quả.
      expect(labels).not.toContain("Trả về nháp");
    },
  );

  it("dự án đã tới hạn: KHÔNG có Huỷ lịch, vẫn Trả về nháp được", () => {
    renderPage();
    const labels = buttonNames("Dự án tới giờ");

    expect(labels).not.toContain("Huỷ lịch");
    expect(labels).not.toContain("Lên lịch");
    expect(labels).toContain("Trả về nháp");
  });

  it("dự án đang đăng: không có thao tác lịch nào", () => {
    renderPage();
    const labels = buttonNames("Dự án đã đăng");

    expect(labels).not.toContain("Lên lịch");
    expect(labels).not.toContain("Đổi lịch");
    expect(labels).toContain("Trả về nháp");
  });

  it("nháp TỪNG đăng: không có Lên lịch (v1 không hẹn giờ đăng lại)", () => {
    renderPage();
    const labels = buttonNames("Dự án từng đăng");

    expect(labels).not.toContain("Lên lịch");
    expect(labels).toContain("Đăng ngay");
  });
});

describe("ProjectsPage — EDITOR không có quyền đặt lịch", () => {
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
    expect(buttonNames("Dự án nháp")).toContain("Gửi duyệt");
  });

  /** §46 — quyền sửa siết theo lịch. */
  it("chỉ sửa được nháp sạch và dự án chờ duyệt chưa hẹn giờ", () => {
    renderPage();

    expect(buttonNames("Dự án nháp")).toContain("Sửa");
    expect(buttonNames("Dự án chờ duyệt")).toContain("Sửa");
    for (const title of [
      "Dự án đã lên lịch",
      "Dự án tới giờ",
      "Dự án đã đăng",
      "Dự án từng đăng",
    ]) {
      expect(buttonNames(title)).not.toContain("Sửa");
    }
  });
});

describe("ProjectsPage — luồng đặt / đổi / huỷ lịch", () => {
  it("mở hộp thoại, nhập ngày giờ và gọi route lệnh với instant +07:00", async () => {
    const user = renderPage();

    await user.click(
      within(row("Dự án nháp")).getByRole("button", { name: "Lên lịch" }),
    );
    const dialog = await screen.findByRole("dialog");

    await user.type(within(dialog).getByLabelText("Ngày đăng"), "2026-08-20");
    await user.type(within(dialog).getByLabelText("Giờ đăng"), "08:00");
    await user.click(within(dialog).getByRole("button", { name: /Lên lịch/ }));

    expect(schedulePublication).toHaveBeenCalledWith({
      slug: "du-an-nhap",
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
  });

  it("Đổi lịch nạp sẵn mốc hiện tại theo giờ Việt Nam", async () => {
    const user = renderPage();

    await user.click(
      within(row("Dự án đã lên lịch")).getByRole("button", {
        name: "Đổi lịch",
      }),
    );
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByLabelText("Ngày đăng")).toHaveValue(
      "2026-08-20",
    );
    expect(within(dialog).getByLabelText("Giờ đăng")).toHaveValue("08:00");
  });

  it("Huỷ lịch gọi DELETE, không hỏi lại (thao tác đảo ngược được)", async () => {
    const user = renderPage();

    await user.click(
      within(row("Dự án đã lên lịch")).getByRole("button", {
        name: "Huỷ lịch",
      }),
    );

    expect(cancelPublication).toHaveBeenCalledWith("du-an-len-lich");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Đăng ngay từ lịch tương lai vẫn đi qua route status", async () => {
    const user = renderPage();

    await user.click(
      within(row("Dự án đã lên lịch")).getByRole("button", {
        name: "Đăng ngay",
      }),
    );

    expect(updateStatus).toHaveBeenCalledWith({
      slug: "du-an-len-lich",
      status: "PUBLISHED",
    });
    expect(schedulePublication).not.toHaveBeenCalled();
  });

  it("lỗi 409 của backend hiện NGUYÊN VĂN trong hộp thoại, không đóng", async () => {
    schedulePublication.mockRejectedValueOnce(
      new ApiRequestError(409, {
        code: "CONFLICT",
        message: "Dự án này đã từng được đăng nên không đặt lịch đăng lại được.",
      }),
    );
    const user = renderPage();

    await user.click(
      within(row("Dự án nháp")).getByRole("button", { name: "Lên lịch" }),
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

describe("ProjectsPage — bộ lọc theo trạng thái đăng", () => {
  it('"Đã lên lịch" gộp cả dự án đã tới hạn, và đếm đúng', () => {
    renderPage();

    expect(
      screen.getByRole("button", { name: "Đã lên lịch (2)" }),
    ).toBeInTheDocument();
    // Dự án tới giờ KHÔNG bị đếm vào hàng chờ duyệt.
    expect(
      screen.getByRole("button", { name: "Chờ duyệt (1)" }),
    ).toBeInTheDocument();
  });

  it("lọc rồi thì bảng chỉ còn dự án có lịch", async () => {
    const user = renderPage();

    await user.click(screen.getByRole("button", { name: "Đã lên lịch (2)" }));

    expect(screen.queryByText("Dự án nháp")).toBeNull();
    expect(screen.getByText("Dự án tới giờ")).toBeInTheDocument();
    expect(screen.getByText("Dự án đã lên lịch")).toBeInTheDocument();
  });
});
