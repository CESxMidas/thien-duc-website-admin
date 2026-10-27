import { render, screen } from "@testing-library/react";
import {
  MemoryRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminEntry, LegacyLoginRedirect } from "./AdminEntry";
import { ProtectedRoute } from "./ProtectedRoute";
import type { AuthUser } from "@/types";

const state = vi.hoisted(() => ({
  user: null as AuthUser | null,
  isLoading: false,
}));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => state }));
vi.mock("@/components/layout/AdminLayout", () => ({
  AdminLayout: () => (
    <section data-testid="admin-layout">
      <Outlet />
    </section>
  ),
}));
vi.mock("@/pages/LoginPage", () => ({
  LoginPage: () => {
    const location = useLocation();
    return <p>LOGIN {JSON.stringify(location.state)}</p>;
  },
}));
function Location() {
  return <output data-testid="path">{useLocation().pathname}</output>;
}
function Tree({ path = "/admin" }: { path?: string }) {
  return (
    <MemoryRouter basename="/admin" initialEntries={[path]}>
      <Location />
      <Routes>
        <Route path="/" element={<AdminEntry />}>
          <Route index element={<p>DASHBOARD</p>} />
        </Route>
        <Route path="/dang-nhap" element={<LegacyLoginRedirect />} />
        <Route
          path="/du-an"
          element={
            <ProtectedRoute>
              <p>PROJECTS</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>
  );
}
beforeEach(() => {
  state.user = null;
  state.isLoading = false;
});
describe("Điểm vào /admin", () => {
  it("chưa đăng nhập: form ở gốc, không dựng bố cục quản trị", () => {
    render(<Tree />);
    expect(screen.getByText(/LOGIN/)).toBeInTheDocument();
    expect(screen.queryByTestId("admin-layout")).toBeNull();
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/$/);
  });
  it("có phiên: Tổng quan cùng địa chỉ gốc, không lặp về form", () => {
    state.user = {
      id: "member",
      email: "member@thienduc.vn",
      name: "Member",
      role: "ADMIN",
    };
    render(<Tree />);
    expect(screen.getByText("DASHBOARD")).toBeInTheDocument();
    expect(screen.queryByText(/LOGIN/)).toBeNull();
  });
  it("khôi phục phiên xong mới chọn form hoặc Tổng quan", () => {
    state.isLoading = true;
    const view = render(<Tree />);
    expect(screen.queryByText(/LOGIN/)).toBeNull();
    state.isLoading = false;
    view.rerender(<Tree />);
    expect(screen.getByText(/LOGIN/)).toBeInTheDocument();
  });
  it("đường dẫn cũ chuyển về gốc", () => {
    render(<Tree path="/admin/dang-nhap" />);
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/$/);
    expect(screen.getByText(/LOGIN/)).toBeInTheDocument();
  });
  it("route riêng tư về gốc và giữ địa chỉ dự định cùng query/hash", () => {
    render(<Tree path="/admin/du-an?status=DRAFT#list" />);
    expect(screen.getByTestId("path")).toHaveTextContent(/^\/$/);
    const login = screen.getByText(/LOGIN/);
    expect(login).toHaveTextContent('"pathname":"/du-an"');
    expect(login).toHaveTextContent('"search":"?status=DRAFT"');
    expect(login).toHaveTextContent('"hash":"#list"');
  });
});
