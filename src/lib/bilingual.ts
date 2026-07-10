import type { Bilingual } from "@/types";

/**
 * Dạng dùng trong form: `en` luôn là chuỗi (có thể rỗng) để React Hook Form
 * không phải xử lý `undefined`. Payload gửi backend thì bỏ hẳn `en` khi trống —
 * frontend công khai coi `en` rỗng là "chưa dịch" và tự lùi về `vi`.
 */
export interface BilingualValue {
  vi: string;
  en: string;
}

export const emptyBilingual: BilingualValue = { vi: "", en: "" };

export function toBilingualValue(value?: Bilingual | null): BilingualValue {
  return { vi: value?.vi ?? "", en: value?.en ?? "" };
}

export function toBilingualPayload(value: BilingualValue): Bilingual {
  const en = value.en.trim();
  return { vi: value.vi.trim(), ...(en && { en }) };
}

/** Có bản dịch tiếng Anh chưa — dùng để cảnh báo trước khi go-live (câu 19). */
export function hasEnglish(value?: Bilingual | null): boolean {
  return Boolean(value?.en?.trim());
}
