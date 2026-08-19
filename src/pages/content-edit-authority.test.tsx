/**
 * **Batch 8 — nút "Sửa" phải khớp với chốt quyền của backend.**
 *
 * Bốn màn nội dung (Tin tức, Dự án, Dự án hợp tác, Trang) dùng chung một luật:
 * EDITOR sửa được nội dung còn trong khâu biên tập, hết quyền khi nội dung đã
 * qua ranh giới duyệt/xuất bản. Backend là nơi chốt (403 kể cả khi gọi API trực
 * tiếp); test ở đây khoá phần UI: không hiện một nút chắc chắn nổ 403, và không
 * ẩn oan thao tác của ADMIN trở lên.
 *
 * Với Tin tức, ranh giới sớm hơn ba màn còn lại — bài đã HẸN GIỜ cũng bị chặn,
 * vì đó chính là lỗ hổng 07:59 mà batch này đóng.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { NewsPage } from "@/pages/NewsPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { CooperationPage } from "@/pages/CooperationPage";
import { PagesPage } from "@/pages/PagesPage";
import type {
  ContentStatus,
  CooperationProject,
  NewsPost,
  Project,
  Role,
  StaticPage,
} from "@/types";

const { rows, role } = vi.hoisted(() => ({
  rows: {
    news: [] as NewsPost[],
    projects: [] as Project[],
    cooperation: [] as CooperationProject[],
    pages: [] as StaticPage[],
  },
  role: { current: "EDITOR" as Role },
}));

vi.mock("@/lib/api/queries", () => {
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => {}),
    isPending: false,
  });
  const empty = () => ({ data: undefined, isLoading: false, isError: false });
  const list = <T,>(get: () => T[]) => () => ({
    data: get(),
    isLoading: false,
    isError: false,
  });
  const names = [
    "useNewsCategories",
    "useNewsCategoriesForAdmin",
    "useProject",
    "useMedia",
  ];
  const mutations = [
    "useCreateNews",
    "useUpdateNews",
    "useUpdateNewsStatus",
    "useDeleteNews",
    "useUpdateNewsCategory",
    "useScheduleNewsPublication",
    "useCancelNewsPublication",
    "useCreatePage",
    "useUpdatePage",
    "useUpdatePageStatus",
    "useCreateProject",
    "useUpdateProject",
    "useUpdateProjectStatus",
    "useDeleteProject",
    // Batch 9 — màn Dự án nay dùng thêm hai lệnh lịch.
    "useScheduleProjectPublication",
    "useCancelProjectPublication",
    "useCreateCooperationProject",
    "useUpdateCooperationProject",
    "useUpdateCooperationStatus",
    "useReorderCooperationProjects",
    "useDeleteCooperationProject",
    "useUploadMedia",
  ];
  const mod: Record<string, unknown> = {
    queryKeys: {},
    useNews: list(() => rows.news),
    useProjects: list(() => rows.projects),
    useCooperationProjects: list(() => rows.cooperation),
    usePages: list(() => rows.pages),
  };
  for (const name of names) mod[name] = empty;
  for (const name of mutations) mod[name] = mutation;
  return mod;
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "A", email: "a@b.c", role: role.current },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const PAST = "2026-08-01T01:00:00.000Z";
const FUTURE = "2099-08-20T01:00:00.000Z";

/* ------------------------------- Dữ liệu mẫu ------------------------------ */

function makePost(
  title: string,
  overrides: Partial<NewsPost> = {},
): NewsPost {
  return {
    id: title,
    slug: `bai-${title}`,
    title: { vi: title },
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
    createdAt: PAST,
    updatedAt: PAST,
    ...overrides,
  };
}

const NEWS_ROWS: NewsPost[] = [
  makePost("Bài nháp"),
  makePost("Bài chờ duyệt", { status: "PENDING" }),
  makePost("Bài đã lên lịch", {
    status: "PENDING",
    scheduledAt: FUTURE,
    publishedAt: FUTURE,
  }),
  makePost("Bài tới giờ", {
    status: "PENDING",
    scheduledAt: PAST,
    publishedAt: PAST,
  }),
  makePost("Bài đã đăng", { status: "PUBLISHED", publishedAt: PAST }),
  makePost("Bài từng đăng", { status: "DRAFT", publishedAt: PAST }),
];

function makeProject(title: string, contentStatus: ContentStatus): Project {
  return {
    id: title,
    slug: `du-an-${title}`,
    title: { vi: title },
    summary: { vi: "Tóm tắt." },
    // TÌNH TRẠNG THI CÔNG — khác hẳn `contentStatus`.
    status: "DANG_THI_CONG",
    contentStatus,
    // Batch 9: dự án mang thêm hai mốc xuất bản. Ở bộ test này mọi hàng đều là
    // nội dung CHƯA từng công khai và chưa hẹn giờ, nên luật sửa quy về đúng
    // `contentStatus` — giữ nguyên ý định ban đầu của các ca kiểm.
    publishedAt: contentStatus === "PUBLISHED" ? PAST : null,
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
    createdAt: PAST,
    updatedAt: PAST,
    items: [],
    _count: { galleryImages: 0 },
  };
}

const PROJECT_ROWS = [
  makeProject("Dự án nháp", "DRAFT"),
  makeProject("Dự án chờ duyệt", "PENDING"),
  makeProject("Dự án đã đăng", "PUBLISHED"),
];

function makeCooperation(
  name: string,
  contentStatus: ContentStatus,
): CooperationProject {
  const bilingual = { vi: "—" };
  return {
    id: name,
    name: { vi: name },
    location: bilingual,
    role: bilingual,
    partner: bilingual,
    scale: bilingual,
    status: bilingual,
    image: null,
    contentStatus,
    order: 0,
    createdAt: PAST,
    updatedAt: PAST,
  };
}

const COOPERATION_ROWS = [
  makeCooperation("Hợp tác nháp", "DRAFT"),
  makeCooperation("Hợp tác chờ duyệt", "PENDING"),
  makeCooperation("Hợp tác đã đăng", "PUBLISHED"),
];

function makeStaticPage(title: string, status: ContentStatus): StaticPage {
  return {
    id: title,
    slug: `trang-${title}`,
    title: { vi: title },
    content: [{ vi: "Nội dung." }],
    status,
    createdAt: PAST,
    updatedAt: PAST,
  };
}

const PAGE_ROWS = [
  makeStaticPage("Trang nháp", "DRAFT"),
  makeStaticPage("Trang chờ duyệt", "PENDING"),
  makeStaticPage("Trang đã đăng", "PUBLISHED"),
];

/* --------------------------------- Harness -------------------------------- */

beforeEach(() => {
  role.current = "EDITOR";
  rows.news = NEWS_ROWS;
  rows.projects = PROJECT_ROWS;
  rows.cooperation = COOPERATION_ROWS;
  rows.pages = PAGE_ROWS;
});

function renderPage(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Hàng của bảng chứa nội dung có tên cho trước. */
function row(title: string): HTMLElement {
  const found = screen.getByText(title).closest("tr");
  if (!found) throw new Error(`Không tìm thấy hàng "${title}"`);
  return found;
}

/** Nút "Sửa" của một hàng có xuất hiện không (tra theo nhãn trợ năng). */
function hasEditAction(title: string, label: string | RegExp): boolean {
  return within(row(title)).queryByRole("button", { name: label }) !== null;
}

/* ------------------------------- Tin tức ---------------------------------- */

describe("NewsPage — EDITOR thấy nút Sửa ở đúng hai trạng thái", () => {
  it.each(["Bài nháp", "Bài chờ duyệt"])("%s → có nút Sửa", (title) => {
    renderPage(<NewsPage />);
    expect(hasEditAction(title, "Sửa bài viết")).toBe(true);
  });

  /** Ba ca dưới đây chính là bất biến của Batch 8. */
  it.each([
    "Bài đã lên lịch",
    "Bài tới giờ",
    "Bài đã đăng",
    "Bài từng đăng",
  ])("%s → KHÔNG có nút Sửa", (title) => {
    renderPage(<NewsPage />);
    expect(hasEditAction(title, "Sửa bài viết")).toBe(false);
  });
});

describe("NewsPage — ADMIN/SUPER_ADMIN giữ nguyên nút Sửa", () => {
  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s thấy nút Sửa ở cả sáu trạng thái",
    (currentRole) => {
      role.current = currentRole;
      renderPage(<NewsPage />);

      for (const post of NEWS_ROWS) {
        expect(hasEditAction(post.title.vi, "Sửa bài viết")).toBe(true);
      }
    },
  );
});

/* --------------------------------- Dự án ---------------------------------- */

describe("ProjectsPage — nút Sửa theo vai trò × trạng thái", () => {
  it.each(["Dự án nháp", "Dự án chờ duyệt"])(
    "EDITOR: %s → có nút Sửa",
    (title) => {
      renderPage(<ProjectsPage />);
      expect(hasEditAction(title, /Sửa/)).toBe(true);
    },
  );

  it("EDITOR: dự án đã đăng → KHÔNG có nút Sửa", () => {
    renderPage(<ProjectsPage />);
    expect(hasEditAction("Dự án đã đăng", /Sửa/)).toBe(false);
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: dự án đã đăng vẫn có nút Sửa",
    (currentRole) => {
      role.current = currentRole;
      renderPage(<ProjectsPage />);
      expect(hasEditAction("Dự án đã đăng", /Sửa/)).toBe(true);
    },
  );
});

/* ---------------------------- Dự án hợp tác ------------------------------- */

describe("CooperationPage — nút Sửa theo vai trò × trạng thái", () => {
  it.each(["Hợp tác nháp", "Hợp tác chờ duyệt"])(
    "EDITOR: %s → có nút Sửa",
    (title) => {
      renderPage(<CooperationPage />);
      expect(hasEditAction(title, "Sửa dự án hợp tác")).toBe(true);
    },
  );

  it("EDITOR: dự án hợp tác đã đăng → KHÔNG có nút Sửa", () => {
    renderPage(<CooperationPage />);
    expect(hasEditAction("Hợp tác đã đăng", "Sửa dự án hợp tác")).toBe(false);
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: dự án hợp tác đã đăng vẫn có nút Sửa",
    (currentRole) => {
      role.current = currentRole;
      renderPage(<CooperationPage />);
      expect(hasEditAction("Hợp tác đã đăng", "Sửa dự án hợp tác")).toBe(true);
    },
  );
});

/* -------------------------------- Trang ----------------------------------- */

describe("PagesPage — nút Sửa theo vai trò × trạng thái", () => {
  it.each(["Trang nháp", "Trang chờ duyệt"])(
    "EDITOR: %s → có nút Sửa",
    (title) => {
      renderPage(<PagesPage />);
      expect(hasEditAction(title, "Sửa trang")).toBe(true);
    },
  );

  it("EDITOR: trang đã đăng → KHÔNG có nút Sửa", () => {
    renderPage(<PagesPage />);
    expect(hasEditAction("Trang đã đăng", "Sửa trang")).toBe(false);
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: trang đã đăng vẫn có nút Sửa",
    (currentRole) => {
      role.current = currentRole;
      renderPage(<PagesPage />);
      expect(hasEditAction("Trang đã đăng", "Sửa trang")).toBe(true);
    },
  );
});
