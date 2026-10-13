import { describe, it, expect } from "vitest";
import { legacyNewsImageFallback, resolveAssetUrl } from "@/lib/asset-url";

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

  it("maps the known legacy news replacement through the public frontend origin", () => {
    expect(
      resolveAssetUrl(
        "https://www.thienduccons.vn/img_data/images/796930583506.jpg",
      ),
    ).toBe(
      "http://localhost:3000/images/news/2021/le-khoi-cong-fancy-tower-2021-04-07.jpg",
    );
  });

  it("uses the neutral site fallback for broken legacy news URLs", () => {
    expect(
      resolveAssetUrl(
        "https://thienduccons.vn/img_data/images/353573832844.jpg",
      ),
    ).toBe(`http://localhost:3000${legacyNewsImageFallback}`);
  });

  it("returns non-rooted strings unchanged", () => {
    expect(resolveAssetUrl("images/a.jpg")).toBe("images/a.jpg");
  });
});
