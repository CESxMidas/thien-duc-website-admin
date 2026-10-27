import { afterEach, expect, it, vi } from "vitest";
import { apiFetch, ApiRequestError } from "./client";
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
  localStorage.clear();
});
it("tải CV qua client chung có Bearer token và đọc dữ liệu nhị phân", async () => {
  const blob = new Blob(["%PDF-1.7"], { type: "application/pdf" });
  const json = vi.fn();
  sessionStorage.setItem("td_admin_access_token", "test-access");
  const request = vi
    .fn()
    .mockResolvedValue({ ok: true, blob: async () => blob, json });
  vi.stubGlobal("fetch", request);
  expect(
    await apiFetch<Blob>("/contact/lead/cv", {}, { responseType: "blob" }),
  ).toBe(blob);
  expect(
    (request.mock.calls[0][1].headers as Headers).get("Authorization"),
  ).toBe("Bearer test-access");
  expect(json).not.toHaveBeenCalled();
});
it("lỗi tải file vẫn bóc envelope và xử lý như API thường", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          success: false,
          error: { code: "NOT_FOUND", message: "Không có CV" },
        }),
      }),
  );
  await expect(
    apiFetch("/contact/missing/cv", {}, { responseType: "blob" }),
  ).rejects.toBeInstanceOf(ApiRequestError);
});
