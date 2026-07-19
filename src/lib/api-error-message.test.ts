import { describe, it, expect } from "vitest";
import { resolveApiError } from "@/lib/api-error-message";
import { ApiRequestError } from "@/lib/api/client";

const FALLBACK = "Có lỗi xảy ra.";

function apiError(status: number, message = "msg"): ApiRequestError {
  return new ApiRequestError(status, { code: "X", message });
}

describe("resolveApiError", () => {
  it("returns a network message for status 0", () => {
    expect(resolveApiError(apiError(0), FALLBACK)).toMatch(/kết nối máy chủ/);
  });

  it("shows the backend message for safe business statuses", () => {
    for (const status of [400, 404, 409, 422]) {
      expect(resolveApiError(apiError(status, "Trùng slug"), FALLBACK)).toBe(
        "Trùng slug",
      );
    }
  });

  it("returns a permission message for 403", () => {
    expect(resolveApiError(apiError(403), FALLBACK)).toMatch(/không có quyền/);
  });

  it("uses the fallback for 5xx / unexpected statuses", () => {
    expect(resolveApiError(apiError(500, "SQL exploded"), FALLBACK)).toBe(
      FALLBACK,
    );
  });

  it("uses the fallback for non-ApiRequestError values", () => {
    expect(resolveApiError(new Error("boom"), FALLBACK)).toBe(FALLBACK);
    expect(resolveApiError("weird", FALLBACK)).toBe(FALLBACK);
  });
});
