/**
 * Cổng quyết định CÓ upload source map lên Sentry hay không, tách riêng khỏi
 * `vite.config.ts` để test được mà **không cần build và không gọi mạng**.
 *
 * Đây là bản song sinh của `sentry-build.ts` bên frontend (Next.js) — cố ý giữ
 * NGUYÊN quy tắc: chỉ bật khi có ĐỦ ba biến `SENTRY_AUTH_TOKEN` + `SENTRY_ORG`
 * + `SENTRY_PROJECT`. Thiếu bất kỳ cái nào → tắt, build vẫn xanh. Không có giá
 * trị mặc định, không đoán tên org/project: đoán sai nghĩa là bắn source map
 * sang nhầm project của người khác.
 *
 * Vì sao Admin cần riêng một bản: Admin là SPA Vite thuần, không dùng
 * `@sentry/nextjs`, nên không tái sử dụng được cấu hình của frontend. Logic thì
 * giống hệt để hai app hành xử như nhau khi vận hành.
 */
export type BuildEnv = Record<string, string | undefined>;

/** Ba biến bắt buộc phải có ĐỦ thì mới upload. */
export const REQUIRED_SENTRY_UPLOAD_VARS = [
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
] as const;

/** Chuỗi rỗng / chỉ khoảng trắng bị coi như KHÔNG đặt (CI hay export biến rỗng). */
function isSet(value: string | undefined): boolean {
  return typeof value === "string" && value.trim() !== "";
}

export function isSentryUploadEnabled(env: BuildEnv): boolean {
  return REQUIRED_SENTRY_UPLOAD_VARS.every((name) => isSet(env[name]));
}

/**
 * Định danh release — ưu tiên biến đặt tay, sau đó SHA commit của Vercel, rồi
 * của GitHub Actions. Trả `undefined` nếu không suy được (để Sentry tự quyết),
 * KHÔNG bịa ra một chuỗi ngẫu nhiên: release sai còn tệ hơn không có release.
 *
 * Thứ tự nguồn giữ ĐÚNG như frontend để hai app gắn cùng một release cho cùng
 * một commit.
 */
export function resolveSentryRelease(env: BuildEnv): string | undefined {
  for (const name of ["SENTRY_RELEASE", "VERCEL_GIT_COMMIT_SHA", "GITHUB_SHA"]) {
    if (isSet(env[name])) return env[name]!.trim();
  }
  return undefined;
}

/**
 * Có sinh source map hay không.
 *
 * CHỈ sinh khi upload được bật. Lý do: Vite ghi source map thẳng vào `dist/`, mà
 * `dist/` là thứ được deploy — sinh source map khi KHÔNG upload đồng nghĩa với
 * phát công khai toàn bộ mã nguồn Admin. Khi upload bật thì plugin sẽ xoá lại
 * sau khi đẩy lên Sentry (`sourcemaps.filesToDeleteAfterUpload`).
 *
 * Trả `"hidden"` chứ không phải `true`: vẫn sinh file `.map` cho Sentry nhưng
 * KHÔNG gắn comment `//# sourceMappingURL=` vào bundle, nên trình duyệt của
 * người dùng cuối không tự đi tải map kể cả trong khoảnh khắc file còn tồn tại.
 */
export function resolveSourcemapSetting(env: BuildEnv): "hidden" | false {
  return isSentryUploadEnabled(env) ? "hidden" : false;
}

/** Tham số truyền cho `sentryVitePlugin`, hoặc `null` nếu KHÔNG được thêm plugin. */
export type SentryPluginOptions = {
  org: string;
  project: string;
  authToken: string;
  telemetry: false;
  release?: { name: string };
  sourcemaps: { filesToDeleteAfterUpload: string[] };
};

/**
 * Trả tham số plugin khi cổng bật, `null` khi tắt.
 *
 * `vite.config.ts` chỉ việc `opts ? [sentryVitePlugin(opts)] : []` — nhờ vậy
 * "plugin có mặt đúng một lần / vắng mặt hoàn toàn" kiểm được ở unit test mà
 * không phải nạp chính plugin.
 *
 * `filesToDeleteAfterUpload` xoá `.map` khỏi `dist/` SAU khi upload xong, nên
 * artifact deploy không bao giờ kèm source map.
 */
export function resolveSentryPluginOptions(env: BuildEnv): SentryPluginOptions | null {
  if (!isSentryUploadEnabled(env)) return null;
  const release = resolveSentryRelease(env);
  return {
    org: env.SENTRY_ORG!.trim(),
    project: env.SENTRY_PROJECT!.trim(),
    authToken: env.SENTRY_AUTH_TOKEN!.trim(),
    // Không gửi telemetry sử dụng về Sentry.
    telemetry: false,
    ...(release ? { release: { name: release } } : {}),
    sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
  };
}
