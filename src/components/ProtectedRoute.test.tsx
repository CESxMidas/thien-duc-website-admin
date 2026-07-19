import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import type { Role } from "@/types";

vi.mock("@/context/AuthContext", () => ({ useAuth: vi.fn() }));

const mockUseAuth = vi.mocked(useAuth);

type AuthState = ReturnType<typeof useAuth>;

function setAuth(partial: Partial<AuthState>) {
  mockUseAuth.mockReturnValue({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...partial,
  } as AuthState);
}

function renderGuarded(roles?: Role[]) {
  return render(
    <MemoryRouter initialEntries={["/secret"]}>
      <Routes>
        <Route
          path="/secret"
          element={
            <ProtectedRoute roles={roles}>
              <div>SECRET</div>
            </ProtectedRoute>
          }
        />
        <Route path="/dang-nhap" element={<div>LOGIN</div>} />
        <Route path="/403" element={<div>FORBIDDEN</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const adminUser = {
  id: "1",
  email: "a@thienduc.vn",
  role: "ADMIN" as Role,
  name: "Admin",
};

describe("ProtectedRoute", () => {
  beforeEach(() => mockUseAuth.mockReset());

  it("renders nothing while auth is loading", () => {
    setAuth({ isLoading: true });
    const { container } = renderGuarded(["ADMIN"]);
    expect(container).toBeEmptyDOMElement();
  });

  it("redirects to login when unauthenticated", () => {
    setAuth({ user: null });
    renderGuarded();
    expect(screen.getByText("LOGIN")).toBeInTheDocument();
  });

  it("redirects to /403 when the role is not allowed", () => {
    setAuth({ user: { ...adminUser, role: "EDITOR" }, isAuthenticated: true });
    renderGuarded(["ADMIN"]);
    expect(screen.getByText("FORBIDDEN")).toBeInTheDocument();
  });

  it("renders children when the role is allowed", () => {
    setAuth({ user: adminUser, isAuthenticated: true });
    renderGuarded(["ADMIN"]);
    expect(screen.getByText("SECRET")).toBeInTheDocument();
  });

  it("renders children for any authenticated user when no roles are required", () => {
    setAuth({ user: { ...adminUser, role: "EDITOR" }, isAuthenticated: true });
    renderGuarded();
    expect(screen.getByText("SECRET")).toBeInTheDocument();
  });
});
