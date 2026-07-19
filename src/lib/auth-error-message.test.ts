import { describe, it, expect } from "vitest";
import {
  getLoginErrorMessage,
  resolveLoginError,
} from "@/lib/auth-error-message";
import { ApiRequestError } from "@/lib/api/client";

describe("getLoginErrorMessage", () => {
  it("maps each known status to its message", () => {
    expect(getLoginErrorMessage(400)).toMatch(/không hợp lệ/);
    expect(getLoginErrorMessage(401)).toMatch(/Email hoặc mật khẩu/);
    expect(getLoginErrorMessage(403)).toMatch(/không có quyền/);
    expect(getLoginErrorMessage(423)).toMatch(/bị khóa/);
    expect(getLoginErrorMessage(429)).toMatch(/quá nhiều lần/);
    expect(getLoginErrorMessage(500)).toMatch(/gặp lỗi/);
    expect(getLoginErrorMessage(0)).toMatch(/kết nối máy chủ/);
  });

  it("does not distinguish unknown-email from wrong-password (401 is generic)", () => {
    expect(getLoginErrorMessage(401)).toBe("Email hoặc mật khẩu không đúng.");
  });

  it("falls back for unknown/undefined status", () => {
    expect(getLoginErrorMessage(418)).toMatch(/Có lỗi xảy ra/);
    expect(getLoginErrorMessage()).toMatch(/Có lỗi xảy ra/);
  });
});

describe("resolveLoginError", () => {
  it("pulls the status out of an ApiRequestError", () => {
    const err = new ApiRequestError(423, { code: "LOCKED", message: "x" });
    expect(resolveLoginError(err)).toMatch(/bị khóa/);
  });

  it("uses the generic message for non-ApiRequestError values", () => {
    expect(resolveLoginError(new Error("boom"))).toMatch(/Có lỗi xảy ra/);
  });
});
