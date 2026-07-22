import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * ADMIN-SPA-SECURITY-HEADERS-M1: Admin CMS (Vite static trên Vercel) phải kèm
 * các header bảo mật trình duyệt cơ bản như FE public. Test khóa cấu hình
 * `vercel.json` để không ai gỡ nhầm header hoặc mất SPA fallback.
 */
type VercelConfig = {
  headers?: { source: string; headers: { key: string; value: string }[] }[];
  rewrites?: { source: string; destination: string }[];
};

function loadVercelConfig(): VercelConfig {
  // Vitest chạy với cwd = thư mục gốc của admin repo.
  const raw = readFileSync(path.resolve(process.cwd(), "vercel.json"), "utf-8");
  return JSON.parse(raw) as VercelConfig;
}

describe("vercel.json — header bảo mật Admin SPA", () => {
  const config = loadVercelConfig();
  const rule = config.headers?.find((h) => h.source === "/(.*)");

  it("áp cho mọi route qua source /(.*)", () => {
    expect(rule).toBeDefined();
  });

  it("có đủ 5 header bảo mật với giá trị đúng", () => {
    const map = new Map(rule!.headers.map((h) => [h.key, h.value]));
    expect(map.get("X-Frame-Options")).toBe("DENY");
    expect(map.get("X-Content-Type-Options")).toBe("nosniff");
    expect(map.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(map.get("Strict-Transport-Security")).toBe(
      "max-age=31536000; includeSubDomains",
    );
    expect(map.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );
  });

  it("có SPA fallback về /index.html (deep link + header cho route ảo)", () => {
    expect(config.rewrites).toContainEqual({
      source: "/(.*)",
      destination: "/index.html",
    });
  });
});
