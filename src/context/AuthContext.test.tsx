import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import * as authService from "@/lib/api/auth";
import type { AuthUser } from "@/types";

vi.mock("@/lib/api/auth", () => ({
  restoreUser: vi.fn(() => null),
  canRestoreSession: vi.fn(() => false),
  restoreSession: vi.fn(async () => null),
  fetchMe: vi.fn(async () => null),
  login: vi.fn(),
  logout: vi.fn(async () => {}),
}));

const mocked = vi.mocked(authService);

const user: AuthUser = {
  id: "1",
  email: "admin@thienduc.vn",
  role: "ADMIN",
  name: "Quản trị",
} as AuthUser;

function Consumer() {
  const { user, isAuthenticated, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="state">
        {isAuthenticated ? `in:${user?.email}` : "out"}
      </span>
      <button onClick={() => login("admin@thienduc.vn", "pw", true)}>login</button>
      <button onClick={() => logout()}>logout</button>
    </div>
  );
}

function renderWithProvider() {
  return render(
    <AuthProvider>
      <Consumer />
    </AuthProvider>,
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.restoreUser.mockReturnValue(null);
    mocked.canRestoreSession.mockReturnValue(false);
  });

  it("throws when useAuth is used outside a provider", () => {
    // Silence the expected React error log for this assertion.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(/AuthProvider/);
    spy.mockRestore();
  });

  it("starts logged out when there is no restorable session", () => {
    renderWithProvider();
    expect(screen.getByTestId("state")).toHaveTextContent("out");
  });

  it("logs in via the auth service and exposes the user", async () => {
    mocked.login.mockResolvedValueOnce(user);
    const u = userEvent.setup();
    renderWithProvider();

    await u.click(screen.getByRole("button", { name: "login" }));

    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent(
        "in:admin@thienduc.vn",
      ),
    );
    expect(mocked.login).toHaveBeenCalledWith("admin@thienduc.vn", "pw", true);
  });

  it("logs out and clears the user", async () => {
    mocked.login.mockResolvedValueOnce(user);
    const u = userEvent.setup();
    renderWithProvider();

    await u.click(screen.getByRole("button", { name: "login" }));
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("in:"),
    );

    await u.click(screen.getByRole("button", { name: "logout" }));
    await waitFor(() =>
      expect(screen.getByTestId("state")).toHaveTextContent("out"),
    );
    expect(mocked.logout).toHaveBeenCalled();
  });
});
