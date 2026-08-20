/**
 * **Batch 11 — tạo trang kèm lệnh xuất bản.**
 *
 * Backend cố tình KHÔNG nhận `status` / `scheduledAt` / `publishedAt` trong DTO
 * nội dung, nên "tạo rồi hẹn giờ" là **hai lệnh**. Người dùng chỉ thấy một thao
 * tác, nhưng thứ tự và cách xử lý hỏng giữa chừng là hợp đồng phải khoá:
 *
 *  1. `POST /pages` — luôn ra bản nháp sạch.
 *  2. `PATCH /pages/<slug BACKEND TRẢ VỀ>/schedule` (hoặc `.../status`).
 *
 * Slug ở bước hai phải lấy từ response, không phải từ ô nhập: backend có thể
 * chuẩn hoá slug, và đoán sai nghĩa là hẹn giờ nhầm trang khác.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { PageFormDialog } from "@/components/pages/PageFormDialog";
import { Button } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api/client";
import type { Role } from "@/types";

const { createPage, schedulePublication, updateStatus, role } = vi.hoisted(
  () => ({
    // Backend CHUẨN HOÁ slug: form gõ "chinh-sach", backend trả
    // "chinh-sach-x". Lệnh thứ hai phải dùng chuỗi backend trả về.
    createPage: vi.fn(async (_payload: unknown) => ({ slug: "chinh-sach-x" })),
    schedulePublication: vi.fn(async (_args: unknown) => ({})),
    updateStatus: vi.fn(async (_args: unknown) => ({})),
    role: { current: "ADMIN" as Role },
  }),
);

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  const empty = () => ({ data: [], isLoading: false, isError: false });
  return {
    queryKeys: {},
    useCreatePage: mutation(createPage),
    useUpdatePage: mutation(async () => ({})),
    useUpdatePageStatus: mutation(updateStatus),
    useSchedulePagePublication: mutation(schedulePublication),
    useMedia: empty,
    useUploadMedia: mutation(async () => ({})),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "A", email: "a@b.c", role: role.current },
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const NOW = new Date("2026-08-13T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  createPage.mockClear();
  createPage.mockResolvedValue({ slug: "chinh-sach-x" });
  schedulePublication.mockClear();
  schedulePublication.mockResolvedValue({});
  updateStatus.mockClear();
  updateStatus.mockResolvedValue({});
  toastSuccess.mockClear();
  toastError.mockClear();
  role.current = "ADMIN";
});

afterEach(() => {
  vi.useRealTimers();
});

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <QueryClientProvider client={client}>
      <PageFormDialog trigger={<Button>Tạo trang</Button>} />
    </QueryClientProvider>,
  );
  return user;
}

/** Mở form và điền các trường bắt buộc tối thiểu. */
async function openAndFill(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Tạo trang" }));
  const dialog = await screen.findByRole("dialog");

  await user.type(within(dialog).getByLabelText(/Đường dẫn|Slug/), "chinh-sach");
  // BilingualField đặt aria-label ngôn ngữ lên chính ô nhập (vấn đề a11y có sẵn,
  // ngoài phạm vi batch này), nên định vị theo placeholder cho ổn định.
  const textboxes = within(dialog).getAllByRole("textbox");
  await user.type(textboxes[1], "Chính sách bảo mật");
  await user.type(textboxes[textboxes.length - 1], "Nội dung trang.");
  return dialog;
}

describe("payload tạo — §40, §48", () => {
  it("KHÔNG mang status / scheduledAt / publishedAt", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Lưu nháp" }));

    expect(createPage).toHaveBeenCalledTimes(1);
    const [payload] = createPage.mock.calls[0] as [Record<string, unknown>];
    expect(payload).not.toHaveProperty("status");
    expect(payload).not.toHaveProperty("scheduledAt");
    expect(payload).not.toHaveProperty("publishedAt");
  });

  it("chỉ một lệnh khi bấm Lưu nháp — không kèm lệnh xuất bản nào", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Lưu nháp" }));

    expect(createPage).toHaveBeenCalledTimes(1);
    expect(schedulePublication).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("tạo + đặt lịch — §40, §51", () => {
  it("chạy hai lệnh, lệnh hai dùng slug BACKEND TRẢ VỀ", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    const scheduleDialog = await screen.findByRole("dialog", {
      name: /lịch đăng bài/i,
    });
    await user.type(
      within(scheduleDialog).getByLabelText("Ngày đăng"),
      "2026-08-20",
    );
    await user.type(within(scheduleDialog).getByLabelText("Giờ đăng"), "08:00");
    await user.click(
      within(scheduleDialog).getByRole("button", { name: /Lên lịch/ }),
    );

    expect(createPage).toHaveBeenCalledTimes(1);
    expect(schedulePublication).toHaveBeenCalledWith({
      slug: "chinh-sach-x",
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
  });

  /** §57 — đóng hộp thoại lịch trước khi xác nhận thì KHÔNG được tạo gì. */
  it("huỷ hộp thoại lịch trước khi xác nhận → không POST, không đặt lịch", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    const scheduleDialog = await screen.findByRole("dialog", {
      name: /lịch đăng bài/i,
    });
    await user.click(
      within(scheduleDialog).getByRole("button", { name: /Hủy|Huỷ/ }),
    );

    expect(createPage).not.toHaveBeenCalled();
    expect(schedulePublication).not.toHaveBeenCalled();
  });
});

describe("tạo + Đăng ngay / Gửi duyệt — §41", () => {
  it("ADMIN: tạo rồi gọi lệnh trạng thái PUBLISHED", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: /Đăng ngay/ }));

    expect(createPage).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledWith({
      slug: "chinh-sach-x",
      status: "PUBLISHED",
    });
  });

  it("EDITOR: chỉ có Lưu nháp và Gửi duyệt — không có Đặt lịch", async () => {
    role.current = "EDITOR";
    const user = renderDialog();
    const dialog = await openAndFill(user);

    expect(
      within(dialog).getByRole("button", { name: "Lưu nháp" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /Gửi duyệt/ }),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByRole("button", { name: "Đặt lịch" }),
    ).toBeNull();
  });

  it("EDITOR: Gửi duyệt gọi lệnh trạng thái PENDING", async () => {
    role.current = "EDITOR";
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: /Gửi duyệt/ }));

    expect(updateStatus).toHaveBeenCalledWith({
      slug: "chinh-sach-x",
      status: "PENDING",
    });
  });
});

describe("hỏng giữa chừng — §42, §56", () => {
  /**
   * Ca quan trọng nhất. Trang ĐÃ được tạo; lệnh hai hỏng. Tạo lại sẽ sinh trang
   * trùng slug, tự xoá sẽ mất công biên tập. Đúng việc phải làm: giữ trang, nói
   * thật, chỉ chỗ làm lại.
   */
  it("tạo xong nhưng đặt lịch hỏng → giữ trang, KHÔNG tạo lại, báo thành công một phần", async () => {
    schedulePublication.mockRejectedValueOnce(
      new ApiRequestError(409, {
        code: "CONFLICT",
        message: "Trang này đã từng được đăng.",
      }),
    );
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    const scheduleDialog = await screen.findByRole("dialog", {
      name: /lịch đăng bài/i,
    });
    await user.type(
      within(scheduleDialog).getByLabelText("Ngày đăng"),
      "2026-08-20",
    );
    await user.type(within(scheduleDialog).getByLabelText("Giờ đăng"), "08:00");
    await user.click(
      within(scheduleDialog).getByRole("button", { name: /Lên lịch/ }),
    );

    // Đúng MỘT lệnh tạo và MỘT lệnh lịch — không thử lại vòng nào.
    expect(createPage).toHaveBeenCalledTimes(1);
    expect(schedulePublication).toHaveBeenCalledTimes(1);

    const message = String(toastError.mock.calls.at(-1)?.[0] ?? "");
    expect(message).toContain("Đã lưu");
    expect(message).toContain("nháp");
    expect(message).toContain("Lên lịch");
  });

  it("tạo hỏng → KHÔNG chạy lệnh thứ hai", async () => {
    createPage.mockRejectedValueOnce(
      new ApiRequestError(409, {
        code: "CONFLICT",
        message: "Slug trang đã tồn tại",
      }),
    );
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: /Đăng ngay/ }));

    expect(createPage).toHaveBeenCalledTimes(1);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("tạo xong nhưng đổi trạng thái hỏng → giữ bản nháp, báo rõ", async () => {
    updateStatus.mockRejectedValueOnce(
      new ApiRequestError(403, { code: "FORBIDDEN", message: "Không có quyền." }),
    );
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: /Đăng ngay/ }));

    expect(createPage).toHaveBeenCalledTimes(1);
    const message = String(toastError.mock.calls.at(-1)?.[0] ?? "");
    expect(message).toContain("Đã lưu");
    expect(message).toContain("nháp");
  });
});

describe("chống bấm hai lần — §43", () => {
  it("hai cú click liên tiếp chỉ tạo một trang", async () => {
    let release!: (value: { slug: string }) => void;
    createPage.mockImplementationOnce(
      () =>
        new Promise<{ slug: string }>((resolve) => {
          release = resolve;
        }),
    );

    const user = renderDialog();
    const dialog = await openAndFill(user);
    const save = within(dialog).getByRole("button", { name: "Lưu nháp" });

    await user.click(save);
    await user.click(save);

    expect(createPage).toHaveBeenCalledTimes(1);
    release({ slug: "chinh-sach-x" });
  });
});
