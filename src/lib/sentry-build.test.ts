/**
 * THIEN-DUC-OPTIONAL-BACKLOG-CODING-COMPLETION-M2 — test cổng upload source map
 * của Admin (backlog §6 "Sentry source map upload").
 *
 * Test Ở ĐÂY chứ không import `vite.config.ts`: config kéo theo plugin React,
 * Tailwind và `@sentry/vite-plugin` — nạp chúng trong unit test là chậm, cần
 * môi trường build thật và chẳng khẳng định thêm được gì. Logic cần khẳng định
 * là logic THUẦN, nên nó nằm ở `sentry-build.ts` và được kiểm trực tiếp.
 *
 * KHÔNG dùng credential thật ở bất kỳ đâu — mọi giá trị dưới đây là chuỗi giả.
 */
import { describe, expect, it } from "vitest";

import {
  REQUIRED_SENTRY_UPLOAD_VARS,
  isSentryUploadEnabled,
  resolveSentryPluginOptions,
  resolveSentryRelease,
  resolveSourcemapSetting,
  type BuildEnv,
} from "@/lib/sentry-build";

/** Giá trị giả — KHÔNG phải token thật, không gọi mạng. */
const FAKE = {
  SENTRY_AUTH_TOKEN: "fake-token-khong-phai-that",
  SENTRY_ORG: "fake-org",
  SENTRY_PROJECT: "fake-project",
} as const;

const ALL_THREE: BuildEnv = { ...FAKE };

describe("isSentryUploadEnabled — cổng ba biến", () => {
  it("không có biến nào → TẮT (máy dev, build cục bộ vẫn xanh)", () => {
    expect(isSentryUploadEnabled({})).toBe(false);
  });

  it("đủ cả ba biến → BẬT", () => {
    expect(isSentryUploadEnabled(ALL_THREE)).toBe(true);
  });

  // Từng biến đơn lẻ: 3 trường hợp "chỉ có một biến".
  it.each(REQUIRED_SENTRY_UPLOAD_VARS)("chỉ có %s → TẮT", (only) => {
    expect(isSentryUploadEnabled({ [only]: FAKE[only] })).toBe(false);
  });

  // Mọi tổ hợp HAI biến: thiếu đúng một cái thì vẫn phải tắt.
  it.each(REQUIRED_SENTRY_UPLOAD_VARS)("thiếu đúng %s → TẮT", (missing) => {
    const env: BuildEnv = { ...ALL_THREE };
    delete env[missing];
    expect(isSentryUploadEnabled(env)).toBe(false);
  });

  it.each(REQUIRED_SENTRY_UPLOAD_VARS)("%s rỗng/khoảng trắng cũng coi như thiếu", (name) => {
    expect(isSentryUploadEnabled({ ...ALL_THREE, [name]: "" })).toBe(false);
    expect(isSentryUploadEnabled({ ...ALL_THREE, [name]: "   " })).toBe(false);
  });

  it("có token nhưng thiếu org/project → TẮT (không đoán, tránh bắn nhầm project)", () => {
    expect(isSentryUploadEnabled({ SENTRY_AUTH_TOKEN: FAKE.SENTRY_AUTH_TOKEN })).toBe(false);
  });
});

describe("resolveSentryRelease — định danh theo commit SHA", () => {
  it("có commit SHA (GITHUB_SHA) → dùng đúng SHA đó", () => {
    expect(resolveSentryRelease({ GITHUB_SHA: "abc123def456" })).toBe("abc123def456");
  });

  it("KHÔNG có commit SHA → undefined, KHÔNG bịa chuỗi", () => {
    expect(resolveSentryRelease({})).toBeUndefined();
  });

  it("ưu tiên SENTRY_RELEASE đặt tay hơn mọi SHA", () => {
    expect(
      resolveSentryRelease({
        SENTRY_RELEASE: "dat-tay",
        VERCEL_GIT_COMMIT_SHA: "vercel-sha",
        GITHUB_SHA: "github-sha",
      }),
    ).toBe("dat-tay");
  });

  it("không có SENTRY_RELEASE thì dùng SHA của Vercel trước GitHub", () => {
    expect(
      resolveSentryRelease({ VERCEL_GIT_COMMIT_SHA: "vercel-sha", GITHUB_SHA: "github-sha" }),
    ).toBe("vercel-sha");
  });

  it("bỏ khoảng trắng thừa quanh SHA", () => {
    expect(resolveSentryRelease({ GITHUB_SHA: "  abc123  " })).toBe("abc123");
  });

  it("biến rỗng bị bỏ qua, rơi xuống nguồn kế tiếp", () => {
    expect(resolveSentryRelease({ SENTRY_RELEASE: "   ", GITHUB_SHA: "github-sha" })).toBe(
      "github-sha",
    );
  });
});

describe("resolveSourcemapSetting — không phát source map công khai", () => {
  it("cổng TẮT → KHÔNG sinh source map (dist/ được deploy, không lộ mã nguồn)", () => {
    expect(resolveSourcemapSetting({})).toBe(false);
  });

  it("cổng BẬT → sinh dạng 'hidden' (có .map cho Sentry, không gắn sourceMappingURL)", () => {
    expect(resolveSourcemapSetting(ALL_THREE)).toBe("hidden");
  });

  it("thiếu một biến → vẫn KHÔNG sinh source map", () => {
    const env: BuildEnv = { ...ALL_THREE };
    delete env.SENTRY_PROJECT;
    expect(resolveSourcemapSetting(env)).toBe(false);
  });
});

describe("resolveSentryPluginOptions — plugin có/không có trong config", () => {
  it("cổng TẮT → null, tức plugin VẮNG MẶT hoàn toàn khỏi config", () => {
    expect(resolveSentryPluginOptions({})).toBeNull();
  });

  it("cổng BẬT → đúng MỘT bộ tham số (config thêm plugin đúng một lần)", () => {
    const opts = resolveSentryPluginOptions(ALL_THREE);
    expect(opts).not.toBeNull();
    // Mô phỏng đúng cách vite.config.ts dựng mảng plugin.
    const plugins = opts ? [opts] : [];
    expect(plugins).toHaveLength(1);
  });

  it("truyền đúng org/project/token đã trim", () => {
    const opts = resolveSentryPluginOptions({
      SENTRY_AUTH_TOKEN: "  tok  ",
      SENTRY_ORG: "  org  ",
      SENTRY_PROJECT: "  proj  ",
    });
    expect(opts).toMatchObject({ org: "org", project: "proj", authToken: "tok" });
  });

  it("luôn xoá source map sau khi upload + không gửi telemetry", () => {
    const opts = resolveSentryPluginOptions(ALL_THREE);
    expect(opts?.sourcemaps.filesToDeleteAfterUpload).toEqual(["./dist/**/*.map"]);
    expect(opts?.telemetry).toBe(false);
  });

  it("có SHA → release gắn theo SHA; không có SHA → KHÔNG có field release", () => {
    expect(resolveSentryPluginOptions({ ...ALL_THREE, GITHUB_SHA: "sha-1" })?.release).toEqual({
      name: "sha-1",
    });
    expect(resolveSentryPluginOptions(ALL_THREE)?.release).toBeUndefined();
  });

  it("release của plugin (upload) KHỚP release mà runtime dùng", () => {
    // Cùng một hàm nguồn ⇒ không thể lệch. Đây là bất biến quan trọng nhất:
    // lệch release thì source map đã upload không map được lỗi runtime nào.
    const env = { ...ALL_THREE, GITHUB_SHA: "sha-khop" };
    expect(resolveSentryPluginOptions(env)?.release?.name).toBe(resolveSentryRelease(env));
  });
});

describe("Bí mật không bao giờ bị in ra", () => {
  it("không hàm nào trả về hoặc lộ giá trị token", () => {
    const results = [
      String(isSentryUploadEnabled(ALL_THREE)),
      String(resolveSentryRelease(ALL_THREE)),
      String(resolveSourcemapSetting(ALL_THREE)),
    ].join("|");
    expect(results).not.toContain(FAKE.SENTRY_AUTH_TOKEN);
  });

  it("release KHÔNG bao giờ lấy giá trị từ SENTRY_AUTH_TOKEN", () => {
    // Nếu ai đó vô ý thêm SENTRY_AUTH_TOKEN vào chuỗi nguồn release thì token
    // sẽ bị gắn làm tên release và hiện công khai trên Sentry UI.
    expect(resolveSentryRelease({ SENTRY_AUTH_TOKEN: FAKE.SENTRY_AUTH_TOKEN })).toBeUndefined();
  });
});
