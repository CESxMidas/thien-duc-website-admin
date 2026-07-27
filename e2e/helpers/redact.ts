/**
 * Che token trong chuỗi khi cần in chẩn đoán. KHÔNG bao giờ in token bản rõ ra
 * output test / log / annotation. Dùng cho mọi thông điệp lỗi có thể chứa URL.
 */
export function redact(value: string): string {
  return value
    .replace(/([?&]token=)[^&\s"']+/gi, '$1<redacted>')
    .replace(/(token"?\s*[:=]\s*"?)[^&\s"']+/gi, '$1<redacted>');
}

/** Trích token khỏi URL — trả về GIÁ TRỊ token, KHÔNG in ra. */
export function tokenFromUrl(url: string): string {
  const t = new URL(url).searchParams.get('token');
  if (!t) throw new Error(`Không tìm thấy token trong URL: ${redact(url)}`);
  return t;
}

/** Xác nhận một chuỗi KHÔNG chứa token bản rõ (dùng trong assertion an toàn). */
export function containsToken(haystack: string, token: string): boolean {
  return token.length > 0 && haystack.includes(token);
}
