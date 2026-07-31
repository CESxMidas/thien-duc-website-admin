/**
 * CMS-RETIRE-DIRECT-USER-CREATE-M1 — hồi quy phía Admin.
 *
 * Backend đã gỡ hẳn `POST /users` (tạo tài khoản kèm mật khẩu do quản trị viên
 * đặt). Admin phải không còn bất kỳ lối gọi nào tới route đó: không hàm client,
 * không hook TanStack Query, không chuỗi URL. Cấp tài khoản chỉ qua lời mời.
 *
 * CỐ Ý kiểm ở mức **mã nguồn** thay vì `import` module: `queries.ts` và
 * `users.ts` bị mock ở mọi test khác nên chưa từng được nạp thật; nạp chúng chỉ
 * để đọc danh sách export sẽ kéo hàng chục hàm chưa có test vào mẫu số coverage
 * và làm rơi ngưỡng global — trong khi thứ cần khẳng định (route đã biến mất)
 * chứng minh được trực tiếp trên nguồn.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.resolve(__dirname, "../..");

function read(relative: string): string {
  return readFileSync(path.join(SRC_DIR, relative), "utf8");
}

const usersApiSource = read("lib/api/users.ts");
const queriesSource = read("lib/api/queries.ts");

describe("Admin không còn đường tạo tài khoản trực tiếp", () => {
  it("client users API KHÔNG export createUser / CreateUserInput", () => {
    expect(usersApiSource).not.toMatch(/export\s+function\s+createUser\s*\(/);
    expect(usersApiSource).not.toMatch(
      /export\s+interface\s+CreateUserInput\b/,
    );
  });

  it("queries KHÔNG export hook useCreateUser", () => {
    expect(queriesSource).not.toMatch(/export\s+function\s+useCreateUser\s*\(/);
    expect(queriesSource).not.toMatch(/usersApi\.createUser\b(?!Invitation)/);
  });

  it("lối cấp tài khoản duy nhất còn lại là lời mời", () => {
    expect(usersApiSource).toMatch(
      /export\s+function\s+createUserInvitation\s*\(/,
    );
    expect(queriesSource).toMatch(
      /export\s+function\s+useCreateUserInvitation\s*\(/,
    );
  });

  it("không chỗ nào gọi POST tới đúng đường dẫn '/users'", () => {
    // Chỉ các route con (`/users/invitations`, `/users/:id/...`) được phép.
    expect(usersApiSource).not.toMatch(
      /"\/users"\s*,\s*\{[^}]*method:\s*"POST"/s,
    );
  });

  it("form tài khoản không khai báo field mật khẩu", () => {
    const form = read("components/users/UserFormDialog.tsx");
    expect(form).not.toMatch(/type="password"/);
    expect(form).not.toMatch(/\bpassword\s*:/);
  });
});
