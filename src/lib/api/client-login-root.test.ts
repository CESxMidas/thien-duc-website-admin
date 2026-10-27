import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiRequestError } from "./client";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const assign = vi.fn();
const originalLocation = window.location;
const unauthorized = () =>
  ({
    ok: false,
    status: 401,
    json: async () => ({
      success: false,
      error: { code: "UNAUTHORIZED", message: "expired" },
    }),
  }) as Response;
beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, pathname: "/", assign },
  });
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () => unauthorized()),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  });
});
describe("Hết phiên khi đăng nhập và Tổng quan dùng chung đường dẫn", () => {
  it("đang ở Tổng quan gốc vẫn tải lại về form khi token hết hạn", async () => {
    localStorage.setItem("td_admin_access_token", "expired-token");
    await expect(apiFetch("/projects/admin")).rejects.toBeInstanceOf(
      ApiRequestError,
    );
    expect(assign).toHaveBeenCalledWith("/");
    expect(localStorage.getItem("td_admin_access_token")).toBeNull();
  });
  it("không lặp tải lại khi đã ở form gốc và không có phiên", async () => {
    await expect(apiFetch("/auth/me")).rejects.toBeInstanceOf(ApiRequestError);
    expect(assign).not.toHaveBeenCalled();
  });
  it("đăng nhập sai không điều hướng hoặc xóa phiên qua handler toàn cục", async () => {
    await expect(
      apiFetch("/auth/login", {}, { skipAuthHandler: true }),
    ).rejects.toBeInstanceOf(ApiRequestError);
    expect(assign).not.toHaveBeenCalled();
  });
});
