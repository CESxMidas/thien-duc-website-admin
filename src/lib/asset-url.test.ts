import { describe, it, expect } from "vitest";
import { resolveAssetUrl } from "@/lib/asset-url";

// NOTE: the SITE_URL-prefix branch depends on VITE_SITE_URL being set at module
// load; it is captured once at import time so it can't be toggled per-test here.
// These cases cover the deterministic branches when VITE_SITE_URL is unset (the
// default test env). The prefixing branch is left for a future env-scoped test.
describe("resolveAssetUrl (VITE_SITE_URL unset)", () => {
  it("returns absolute http(s) URLs unchanged", () => {
    expect(resolveAssetUrl("https://res.cloudinary.com/x/a.jpg")).toBe(
      "https://res.cloudinary.com/x/a.jpg",
    );
    expect(resolveAssetUrl("http://cdn.example/a.png")).toBe(
      "http://cdn.example/a.png",
    );
  });

  it("returns a relative path unchanged when no site URL is configured", () => {
    expect(resolveAssetUrl("/images/projects/a.jpg")).toBe(
      "/images/projects/a.jpg",
    );
  });

  it("returns non-rooted strings unchanged", () => {
    expect(resolveAssetUrl("images/a.jpg")).toBe("images/a.jpg");
  });
});
