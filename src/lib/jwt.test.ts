import { describe, it, expect } from "vitest";
import { decodeJwt, isTokenExpired, type JwtPayload } from "@/lib/jwt";

/** Ghép một JWT giả (header.payload.signature) từ payload cho trước. */
function makeToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" }))
    .toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

describe("decodeJwt", () => {
  it("decodes a well-formed token payload", () => {
    const token = makeToken({
      sub: "u1",
      email: "admin@thienduc.vn",
      role: "ADMIN",
      exp: 9999999999,
    });
    const payload = decodeJwt(token);
    expect(payload).toMatchObject({
      sub: "u1",
      email: "admin@thienduc.vn",
      role: "ADMIN",
    });
  });

  it("decodes Vietnamese diacritics correctly", () => {
    const token = makeToken({ sub: "u1", email: "a@b.vn", role: "Quản trị" });
    expect(decodeJwt(token)?.role).toBe("Quản trị");
  });

  it("returns null when the structure is wrong", () => {
    expect(decodeJwt("not-a-jwt")).toBeNull();
    expect(decodeJwt("only.two")).toBeNull();
  });

  it("returns null when required claims are missing", () => {
    expect(decodeJwt(makeToken({ role: "ADMIN" }))).toBeNull();
    expect(decodeJwt(makeToken({ sub: "u1" }))).toBeNull();
  });

  it("returns null on non-JSON payload", () => {
    const bad = `${Buffer.from("h").toString("base64url")}.@@@.sig`;
    expect(decodeJwt(bad)).toBeNull();
  });
});

describe("isTokenExpired", () => {
  it("treats a past exp as expired", () => {
    const payload: JwtPayload = {
      sub: "u1",
      email: "a@b.vn",
      role: "ADMIN",
      exp: Math.floor(Date.now() / 1000) - 60,
    };
    expect(isTokenExpired(payload)).toBe(true);
  });

  it("treats a future exp as valid", () => {
    const payload: JwtPayload = {
      sub: "u1",
      email: "a@b.vn",
      role: "ADMIN",
      exp: Math.floor(Date.now() / 1000) + 600,
    };
    expect(isTokenExpired(payload)).toBe(false);
  });

  it("treats a missing exp as not expired", () => {
    expect(isTokenExpired({ sub: "u1", email: "a@b.vn", role: "ADMIN" })).toBe(
      false,
    );
  });
});
