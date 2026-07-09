// Giải mã payload JWT phía client — CHỈ để đọc thông tin hiển thị (id, email,
// role, hạn token). KHÔNG dùng để xác thực (việc đó do backend làm khi verify
// chữ ký). Không cần thư viện ngoài.

/** Payload access token do backend phát (auth.service.ts: issueTokens). */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  /** Thời điểm hết hạn (giây kể từ epoch). */
  exp?: number;
}

/** Giải base64url → chuỗi UTF-8. */
function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    "=",
  );
  const binary = atob(padded);
  // Giải đúng ký tự có dấu (tiếng Việt) nếu payload chứa.
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Trả payload nếu token hợp lệ về cấu trúc, ngược lại `null`. */
export function decodeJwt(token: string): JwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as JwtPayload;
    if (!payload.sub || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Token đã hết hạn chưa (theo `exp`). Không có `exp` → coi như còn hạn. */
export function isTokenExpired(payload: JwtPayload): boolean {
  if (!payload.exp) return false;
  return payload.exp * 1000 <= Date.now();
}
