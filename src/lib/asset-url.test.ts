import { describe, it, expect } from "vitest";
import { resolveAssetUrl } from "@/lib/asset-url";

describe("resolveAssetUrl", () => {
  it("returns absolute http(s) URLs unchanged", () => {
    expect(resolveAssetUrl("https://res.cloudinary.com/x/a.jpg")).toBe(
      "https://res.cloudinary.com/x/a.jpg",
    );
    expect(resolveAssetUrl("http://cdn.example/a.png")).toBe(
      "http://cdn.example/a.png",
    );
  });

  it("prefixes public-site assets with the dev frontend origin by default", () => {
    expect(resolveAssetUrl("/images/projects/a.jpg")).toBe(
      "http://localhost:3000/images/projects/a.jpg",
    );
  });

  it("returns non-rooted strings unchanged", () => {
    expect(resolveAssetUrl("images/a.jpg")).toBe("images/a.jpg");
  });
});
