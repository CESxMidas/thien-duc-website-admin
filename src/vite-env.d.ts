/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Release Sentry do `vite.config.ts` chèn lúc build qua `define`
 * (backlog §6 "Sentry source map upload").
 *
 * `null` khi không suy được commit SHA — khi đó `Sentry.init` bỏ hẳn field
 * `release` thay vì gắn một chuỗi bịa. Giá trị này PHẢI khớp release mà
 * `@sentry/vite-plugin` dùng lúc upload source map.
 */
declare const __SENTRY_RELEASE__: string | null;
