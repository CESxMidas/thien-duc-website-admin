import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import type { Lead, NewsPost, Project, Role } from "@/types";

const state = vi.hoisted(() => ({
  role: "ADMIN" as Role,
  leads: [] as Lead[],
  news: [] as (Pick<NewsPost, "id" | "title" | "status"> &
    Partial<Pick<NewsPost, "scheduledAt" | "publishedAt">>)[],
  projects: [] as (Pick<Project, "id" | "title" | "contentStatus"> &
    Partial<Pick<Project, "scheduledAt" | "publishedAt">>)[],
  useLeads: vi.fn(),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { role: state.role } }),
}));
vi.mock("@/lib/api/queries", () => ({
  useLeads: (enabled: boolean) => {
    state.useLeads(enabled);
    return { data: enabled ? state.leads : [] };
  },
  useNews: () => ({ data: state.news }),
  useProjects: () => ({ data: state.projects }),
}));

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );
}

function statLabels() {
  return screen
    .getAllByRole("link")
    .map((link) => link.querySelector("p")?.textContent)
    .filter(Boolean);
}

beforeEach(() => {
  state.role = "ADMIN";
  state.leads = [];
  state.news = [];
  state.projects = [];
  state.useLeads.mockClear();
});

describe("Tổng quan ưu tiên mục có dữ liệu", () => {
  afterEach(() => vi.useRealTimers());

  it("hàng chờ duyệt không tính bài hoặc dự án đã lên lịch/đã tới hạn", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-26T00:00:00Z"));
    const future = "2026-10-27T00:00:00Z";
    const past = "2026-10-25T00:00:00Z";
    state.news = [
      {
        id: "pending",
        title: { vi: "Tin cần duyệt thật" },
        status: "PENDING",
        scheduledAt: null,
        publishedAt: null,
      },
      {
        id: "scheduled",
        title: { vi: "Tin sẽ đăng" },
        status: "PENDING",
        scheduledAt: future,
        publishedAt: future,
      },
      {
        id: "due",
        title: { vi: "Tin đã đăng theo lịch" },
        status: "PENDING",
        scheduledAt: past,
        publishedAt: past,
      },
    ];
    state.projects = [
      {
        id: "p1",
        title: { vi: "Dự án đã đăng theo lịch" },
        contentStatus: "PENDING",
        scheduledAt: past,
        publishedAt: past,
      },
    ];
    renderDashboard();
    expect(
      screen.getByRole("link", { name: /Nội dung chờ duyệt 1 Tin tức/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Tin cần duyệt thật")).toBeInTheDocument();
    expect(screen.queryByText("Tin sẽ đăng")).not.toBeInTheDocument();
    expect(screen.queryByText("Tin đã đăng theo lịch")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Dự án đã đăng theo lịch"),
    ).not.toBeInTheDocument();
  });
  it("đưa dự án và bài viết lên trước các số liệu bằng 0 như ảnh phản hồi", () => {
    state.projects = [
      { id: "p1", title: { vi: "Dự án thật" }, contentStatus: "PUBLISHED" },
    ];
    state.news = Array.from({ length: 3 }, (_, i) => ({
      id: `n${i}`,
      title: { vi: "Tin đã đăng" },
      status: "PUBLISHED",
    }));
    renderDashboard();
    expect(statLabels()).toEqual([
      "Dự án",
      "Bài viết",
      "Form liên hệ mới",
      "Nội dung chờ duyệt",
    ]);
    expect(
      screen.getByRole("link", { name: /Dự án 1 Tổng số dự án/ }),
    ).toHaveAttribute("href", "/du-an");
    expect(
      screen.getByRole("link", { name: /Bài viết 3 Tổng số bài/ }),
    ).toHaveAttribute("href", "/tin-tuc");
  });

  it("giữ thứ tự ban đầu khi tất cả đều rỗng", () => {
    renderDashboard();
    expect(statLabels()).toEqual([
      "Form liên hệ mới",
      "Nội dung chờ duyệt",
      "Dự án",
      "Bài viết",
    ]);
  });

  it("đưa khối chờ duyệt có dữ liệu lên trước khối liên hệ rỗng", () => {
    state.news = [
      { id: "n1", title: { vi: "Tin cần duyệt" }, status: "PENDING" },
    ];
    const { container } = renderDashboard();
    expect(statLabels()).toEqual([
      "Nội dung chờ duyệt",
      "Bài viết",
      "Form liên hệ mới",
      "Dự án",
    ]);
    expect(
      [...container.querySelectorAll('[data-slot="card-title"]')].map(
        (node) => node.textContent,
      ),
    ).toEqual(["Chờ duyệt", "Liên hệ mới nhất"]);
    expect(screen.getByText("Tin cần duyệt")).toBeInTheDocument();
  });

  it("đổi thứ tự khi API cập nhật từ rỗng sang có dữ liệu", () => {
    const { rerender } = renderDashboard();
    state.projects = [
      { id: "p1", title: { vi: "Dự án mới" }, contentStatus: "DRAFT" },
    ];
    rerender(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );
    expect(statLabels()).toEqual([
      "Dự án",
      "Form liên hệ mới",
      "Nội dung chờ duyệt",
      "Bài viết",
    ]);
  });

  it("EDITOR vẫn không tải hoặc nhìn thấy dữ liệu liên hệ", () => {
    state.role = "EDITOR";
    state.projects = [
      { id: "p1", title: { vi: "Dự án" }, contentStatus: "DRAFT" },
    ];
    renderDashboard();
    expect(statLabels()).toEqual(["Dự án", "Nội dung chờ duyệt", "Bài viết"]);
    expect(state.useLeads).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Liên hệ mới nhất")).not.toBeInTheDocument();
  });
});
