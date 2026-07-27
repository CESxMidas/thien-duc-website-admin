import { API_URL } from './config';

/** Bao envelope chuẩn backend: { success, data, error }. */
interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: { code: string; message: string };
}

export interface ApiResult<T> {
  status: number;
  body: Envelope<T> | null;
}

async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  let body: Envelope<T> | null = null;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Đăng nhập qua API — trả status + cặp token (nếu thành công). */
export function apiLogin(
  email: string,
  password: string,
): Promise<ApiResult<TokenPair>> {
  return api<TokenPair>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/** Gọi /auth/refresh với refresh token — dùng để kiểm phiên cũ đã bị thu hồi. */
export function apiRefresh(refreshToken: string): Promise<ApiResult<TokenPair>> {
  return api<TokenPair>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

/** POST có Bearer token — dùng kiểm phân quyền (403) ở tầng API. */
export function authedPost(
  path: string,
  token: string,
  body?: unknown,
): Promise<ApiResult<unknown>> {
  return api(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** PATCH có Bearer token. */
export function authedPatch(
  path: string,
  token: string,
  body: unknown,
): Promise<ApiResult<unknown>> {
  return api(path, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
}

/** DELETE có Bearer token. */
export function authedDelete(
  path: string,
  token: string,
): Promise<ApiResult<unknown>> {
  return api(path, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** GET có Bearer token — trả cả body để soi field nhạy cảm. */
export function authedGet(
  path: string,
  token: string,
): Promise<ApiResult<unknown>> {
  return api(path, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
}

/** GET công khai (không auth) — dùng kiểm nội dung public chỉ lộ PUBLISHED. */
export function publicGet(path: string): Promise<ApiResult<unknown>> {
  return api(path, { method: 'GET' });
}

export interface TestUserDiagnostics {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  setupCompleted: boolean;
  setupCompletedAt: string | null;
  failedLoginAttempts: number;
  locked: boolean;
  passwordHashFingerprint: string;
  invitationCount: number;
  activeInvitationCount: number;
  refreshTokenCount: number;
}

/** Chẩn đoán trạng thái một tài khoản (dùng kiểm tính toàn vẹn). */
export async function getTestUser(
  email: string,
): Promise<TestUserDiagnostics | null> {
  const res = await api<TestUserDiagnostics | null>(
    `/test/users/${encodeURIComponent(email)}`,
  );
  if (res.status !== 200) {
    throw new Error(`E2E: đọc chẩn đoán user thất bại (status ${res.status}).`);
  }
  return res.body?.data ?? null;
}

export interface OutboxEntry {
  id: string;
  type: 'contact' | 'invitation' | 'password-reset';
  to: string;
  subject: string;
  text: string;
  html: string;
  url: string | null;
  createdAt: string;
}

/** Lấy outbox email giả (lọc theo người nhận nếu truyền `to`). */
export async function getOutbox(to?: string): Promise<OutboxEntry[]> {
  const q = to ? `?to=${encodeURIComponent(to)}` : '';
  const res = await api<{ count: number; entries: OutboxEntry[] }>(
    `/test/mail/outbox${q}`,
  );
  if (res.status !== 200 || !res.body?.data) {
    throw new Error(`E2E: đọc outbox thất bại (status ${res.status}).`);
  }
  return res.body.data.entries;
}

export async function clearOutbox(): Promise<void> {
  const res = await fetch(`${API_URL}/test/mail/outbox`, { method: 'DELETE' });
  if (res.status !== 204 && res.status !== 200) {
    throw new Error(`E2E: xoá outbox thất bại (status ${res.status}).`);
  }
}

export interface UpsertTestUser {
  email: string;
  role: 'EDITOR' | 'ADMIN' | 'SUPER_ADMIN';
  isActive: boolean;
  setupCompleted: boolean;
  password?: string;
}

export interface TestUserView {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  setupCompleted: boolean;
}

export async function upsertTestUser(
  dto: UpsertTestUser,
): Promise<TestUserView> {
  const res = await api<TestUserView>('/test/users', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
  if (res.status !== 201 || !res.body?.data) {
    throw new Error(`E2E: tạo fixture user thất bại (status ${res.status}).`);
  }
  return res.body.data;
}

export interface ContactRecord {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  inquiryType: string | null;
  message: string;
  status: string;
  ipAddress: string | null;
  createdAt: string;
}

/** Lead liên hệ theo email (xác minh đã lưu DB). */
export async function getTestContacts(email: string): Promise<ContactRecord[]> {
  const res = await api<ContactRecord[]>(
    `/test/contact?email=${encodeURIComponent(email)}`,
  );
  if (res.status !== 200 || !res.body?.data) {
    throw new Error(`E2E: đọc lead thất bại (status ${res.status}).`);
  }
  return res.body.data;
}

/** Xoá mọi lead E2E (@e2e.test). */
export async function clearTestContacts(): Promise<number> {
  const res = await api<{ count: number }>('/test/contact', {
    method: 'DELETE',
  });
  if (res.status !== 200 || !res.body?.data) {
    throw new Error(`E2E: xoá lead thất bại (status ${res.status}).`);
  }
  return res.body.data.count;
}

/** Bật/tắt giả lập lỗi provider email cho luồng liên hệ. */
export async function setMailFailMode(enabled: boolean): Promise<void> {
  const res = await api('/test/mail/fail-mode', {
    method: 'POST',
    body: JSON.stringify({ enabled }),
  });
  if (res.status !== 200) {
    throw new Error(`E2E: đặt fail-mode thất bại (status ${res.status}).`);
  }
}

/** Làm già lời mời đang mở của tài khoản fixture (vượt cooldown gửi-lại 60s). */
export async function ageInvitations(email: string): Promise<number> {
  const res = await api<{ count: number }>(
    `/test/users/${encodeURIComponent(email)}/age-invitations`,
    { method: 'POST' },
  );
  if (res.status !== 200 || !res.body?.data) {
    throw new Error(`E2E: age-invitations thất bại (status ${res.status}).`);
  }
  return res.body.data.count;
}

/** Xoá mọi tài khoản fixture @e2e.test. Trả số bản ghi đã xoá. */
export async function deleteTestUsers(): Promise<number> {
  const res = await api<{ count: number }>('/test/users', {
    method: 'DELETE',
  });
  if (res.status !== 200 || !res.body?.data) {
    throw new Error(`E2E: xoá fixture users thất bại (status ${res.status}).`);
  }
  return res.body.data.count;
}
