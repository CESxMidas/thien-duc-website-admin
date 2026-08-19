import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { ContactPage } from "@/pages/ContactPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { NewsPage } from "@/pages/NewsPage";
import { PagesPage } from "@/pages/PagesPage";

// Every data hook lives in this one module. Each is mocked with a benign,
// dual-shape result (query + mutation fields) so the smoke render never hits the
// network. Data is empty → each page renders its empty-table state. Closed
// dialogs still execute their hook bodies, so ALL exports are stubbed.
vi.mock("@/lib/api/queries", () => {
  // data:undefined — list pages destructure with `= []` defaults, and
  // single-entity hooks (useProject/useUser…) expect undefined until loaded so
  // their `project?.title` guards short-circuit instead of reading [].title.
  const hook = () => ({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    isPending: false,
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => {}),
    refetch: vi.fn(),
  });
  const names = [
    "useLeads", "useUpdateLead",
    "useNews", "useNewsCategories", "useNewsCategoriesForAdmin",
    "useCreateNews", "useUpdateNews",
    "useUpdateNewsStatus", "useDeleteNews", "useUpdateNewsCategory",
    "useScheduleNewsPublication", "useCancelNewsPublication",
    "useScheduleProjectPublication", "useCancelProjectPublication",
    "usePages", "useCreatePage", "useUpdatePage", "useUpdatePageStatus",
    "useBanners", "useCreateBanner", "useUpdateBanner", "useReorderBanners",
    "useCooperationProjects", "useCreateCooperationProject",
    "useUpdateCooperationProject", "useUpdateCooperationStatus",
    "useReorderCooperationProjects", "useDeleteCooperationProject",
    "useMedia", "useUploadMedia", "useDeleteMedia",
    "useProjects", "useProject", "useCreateProject", "useUpdateProject",
    "useUpdateProjectStatus", "useDeleteProject", "useCreateProjectItem",
    "useUpdateProjectItem", "useDeleteProjectItem", "useAddGalleryImage",
    "useDeleteGalleryImage", "useReorderGallery",
    "useUsers", "useUser", "useCreateUserInvitation", "useUpdateUser",
    "useDeactivateUser", "useReactivateUser",
    "useMyProfile", "useUpdateMyProfile", "useProfileRequests",
    "useReviewProfileRequest",
  ];
  const mod: Record<string, unknown> = { queryKeys: {} };
  for (const name of names) mod[name] = hook;
  return mod;
});

// Pages that gate actions on role expect an authenticated ADMIN.
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "1", email: "a@thienduc.vn", role: "ADMIN", name: "Admin" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
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

describe("authenticated page smoke renders", () => {
  // Target the <h1> from PageHeader so the assertion isn't ambiguous with table
  // column headers that reuse the same word.
  it("renders ContactPage header", () => {
    renderPage(<ContactPage />);
    expect(
      screen.getByRole("heading", { name: "Liên hệ" }),
    ).toBeInTheDocument();
  });

  it("renders ProjectsPage header", () => {
    renderPage(<ProjectsPage />);
    expect(screen.getByRole("heading", { name: "Dự án" })).toBeInTheDocument();
  });

  it("renders NewsPage header", () => {
    renderPage(<NewsPage />);
    expect(screen.getByRole("heading", { name: "Tin tức" })).toBeInTheDocument();
  });

  it("renders PagesPage header", () => {
    renderPage(<PagesPage />);
    expect(
      screen.getByRole("heading", { name: "Trang nội dung" }),
    ).toBeInTheDocument();
  });
});
