/**
 * **Batch 9 — tạo dự án kèm lệnh xuất bản.**
 *
 * Backend cố tình KHÔNG nhận `contentStatus` / `scheduledAt` / `publishedAt`
 * trong DTO nội dung, nên "tạo rồi hẹn giờ" là **hai lệnh**. Người dùng chỉ thấy
 * một thao tác, nhưng thứ tự và cách xử lý hỏng giữa chừng là hợp đồng phải khoá:
 *
 *  1. `POST /projects` — luôn ra bản nháp sạch.
 *  2. `PATCH /projects/<slug BACKEND TRẢ VỀ>/schedule` (hoặc `.../status`).
 *
 * Slug ở bước hai phải lấy từ response, không phải từ ô nhập: backend có thể
 * chuẩn hoá slug, và đoán sai nghĩa là hẹn giờ nhầm dự án khác.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { Button } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api/client";
import type { Role } from "@/types";

const { createProject, schedulePublication, updateStatus, role } = vi.hoisted(
  () => ({
    // Backend CHUẨN HOÁ slug: form gõ "du-an-moi-2026", backend trả
    // "du-an-moi-2026-x". Lệnh thứ hai phải dùng chuỗi backend trả về.
    //
    // Khai báo tham số tường minh để `mock.calls[0][0]` có kiểu — bộ test này
    // soi chính PAYLOAD gửi đi, không chỉ đếm số lần gọi.
    createProject: vi.fn(async (_payload: unknown) => ({
      slug: "du-an-moi-2026-x",
    })),
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
    useCreateProject: mutation(createProject),
    useUpdateProject: mutation(async () => ({})),
    useUpdateProjectStatus: mutation(updateStatus),
    useScheduleProjectPublication: mutation(schedulePublication),
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
  createProject.mockClear();
  createProject.mockResolvedValue({ slug: "du-an-moi-2026-x" });
  schedulePublication.mockClear();
  schedulePublication.mockResolvedValue({});
  updateStatus.mockClear();
  toastSuccess.mockClear();
  toastError.mockClear();
  role.current = "ADMIN";
});

afterEach(() => {
  vi.useRealTimers();
});

function renderForm() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ProjectFormDialog trigger={<Button>Tạo dự án</Button>} />
    </QueryClientProvider>,
  );
  return user;
}

/** Mở form và điền các trường bắt buộc. */
async function openAndFill(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Tạo dự án" }));
  await screen.findByRole("dialog");

  await user.type(screen.getByLabelText("Tên dự án"), "Khu đô thị Hưng Phú");
  await user.clear(screen.getByLabelText(/Slug/));
  await user.type(screen.getByLabelText(/Slug/), "du-an-moi-2026");
  await user.type(
    screen.getByLabelText(/Mô tả ngắn/),
    "Tóm tắt dự án đủ dài để qua kiểm tra.",
  );
}

/**
 * Hộp thoại lịch, tra theo TÊN TRỢ NĂNG. Không lấy "dialog cuối cùng trong DOM":
 * form tạo cũng là một dialog và thứ tự DOM không phải hợp đồng nào cả.
 */
function scheduleDialog(): Promise<HTMLElement> {
  return screen.findByRole("dialog", { name: "Lên lịch đăng bài" });
}

/** Chọn ngày giờ trong hộp thoại lịch rồi xác nhận. */
async function confirmSchedule(user: ReturnType<typeof userEvent.setup>) {
  const dialog = await scheduleDialog();
  await user.type(within(dialog).getByLabelText("Ngày đăng"), "2026-08-20");
  await user.type(within(dialog).getByLabelText("Giờ đăng"), "08:00");
  await user.click(within(dialog).getByRole("button", { name: "Lên lịch" }));
}

describe("form tạo dự án — thao tác theo vai trò", () => {
  it('ADMIN thấy "Đặt lịch" và "Đăng ngay" bên cạnh "Lưu nháp"', async () => {
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "Tạo dự án" }));
    await screen.findByRole("dialog");

    expect(
      screen.getByRole("button", { name: /Đặt lịch/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Đăng ngay/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lưu nháp" })).toBeInTheDocument();
  });

  it("SUPER_ADMIN có cùng bộ thao tác với ADMIN", async () => {
    role.current = "SUPER_ADMIN";
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "Tạo dự án" }));
    await screen.findByRole("dialog");

    expect(
      screen.getByRole("button", { name: /Đặt lịch/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Đăng ngay/ }),
    ).toBeInTheDocument();
  });

  it("EDITOR chỉ có lưu nháp và gửi duyệt, KHÔNG có đặt lịch", async () => {
    role.current = "EDITOR";
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "Tạo dự án" }));
    await screen.findByRole("dialog");

    expect(screen.queryByRole("button", { name: /Đặt lịch/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Đăng ngay/ })).toBeNull();
    expect(
      screen.getByRole("button", { name: /Gửi duyệt/ }),
    ).toBeInTheDocument();
  });
});

describe("tạo + đặt lịch — đường hạnh phúc", () => {
  it("chạy đúng hai lệnh, đúng thứ tự, với instant giờ VN", async () => {
    const user = renderForm();
    await openAndFill(user);

    await user.click(screen.getByRole("button", { name: /Đặt lịch/ }));
    // Bấm "Đặt lịch" mới chỉ mở hộp thoại — CHƯA tạo dự án.
    expect(createProject).not.toHaveBeenCalled();

    await confirmSchedule(user);

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(schedulePublication).toHaveBeenCalledTimes(1);
    expect(schedulePublication).toHaveBeenCalledWith({
      slug: "du-an-moi-2026-x",
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
  });

  /** §55 — payload tạo TUYỆT ĐỐI không mang field xuất bản nào. */
  it("payload tạo KHÔNG mang contentStatus / scheduledAt / publishedAt", async () => {
    const user = renderForm();
    await openAndFill(user);
    await user.click(screen.getByRole("button", { name: /Đặt lịch/ }));
    await confirmSchedule(user);

    const payload = createProject.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).not.toHaveProperty("contentStatus");
    expect(payload).not.toHaveProperty("scheduledAt");
    expect(payload).not.toHaveProperty("publishedAt");
    // TÌNH TRẠNG THI CÔNG thì vẫn phải gửi bình thường.
    expect(payload.status).toBeDefined();
  });

  /** §56 — hồi quy bắt buộc: dùng slug BACKEND trả về, không phải slug trong form. */
  it("dùng slug BACKEND trả về, không dùng slug gõ trong form", async () => {
    const user = renderForm();
    await openAndFill(user);
    await user.click(screen.getByRole("button", { name: /Đặt lịch/ }));
    await confirmSchedule(user);

    const { slug } = schedulePublication.mock.calls[0][0] as { slug: string };
    expect(slug).toBe("du-an-moi-2026-x");
    expect(slug).not.toBe("du-an-moi-2026");
  });
});

describe("tạo + Đăng ngay / Gửi duyệt", () => {
  it("ADMIN đăng ngay: POST rồi PATCH status với slug backend trả về", async () => {
    const user = renderForm();
    await openAndFill(user);

    await user.click(screen.getByRole("button", { name: /Đăng ngay/ }));

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledWith({
      slug: "du-an-moi-2026-x",
      status: "PUBLISHED",
    });
  });

  it("EDITOR gửi duyệt: dự án mới chuyển sang PENDING", async () => {
    role.current = "EDITOR";
    const user = renderForm();
    await openAndFill(user);

    await user.click(screen.getByRole("button", { name: /Gửi duyệt/ }));

    expect(updateStatus).toHaveBeenCalledWith({
      slug: "du-an-moi-2026-x",
      status: "PENDING",
    });
  });

  it('"Lưu nháp" chỉ chạy đúng một lệnh tạo, không lệnh xuất bản nào', async () => {
    const user = renderForm();
    await openAndFill(user);

    await user.click(screen.getByRole("button", { name: "Lưu nháp" }));

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(updateStatus).not.toHaveBeenCalled();
    expect(schedulePublication).not.toHaveBeenCalled();
  });
});

describe("tạo + đặt lịch — các lối hỏng", () => {
  /** §57 — hỏng giữa chừng: dự án ĐÃ tồn tại, tuyệt đối không tạo lại. */
  it("đặt lịch hỏng sau khi tạo: báo rõ dự án đã lưu, đúng MỘT POST", async () => {
    schedulePublication.mockRejectedValueOnce(
      new ApiRequestError(409, {
        code: "CONFLICT",
        message: "Dự án này đã từng được đăng nên không đặt lịch đăng lại được.",
      }),
    );
    const user = renderForm();
    await openAndFill(user);
    await user.click(screen.getByRole("button", { name: /Đặt lịch/ }));
    await confirmSchedule(user);

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(schedulePublication).toHaveBeenCalledTimes(1);
    // Thông báo phải nói rõ dự án ĐÃ lưu, kèm đường sửa lại — nếu không người
    // dùng sẽ bấm tạo lần nữa và sinh ra dự án trùng.
    const message = String(toastError.mock.calls[0][0]);
    expect(message).toContain("Đã lưu dự án");
    expect(message).toContain("Lên lịch");
  });

  it("tạo hỏng: KHÔNG gọi lệnh lịch, form giữ nguyên dữ liệu để thử lại", async () => {
    createProject.mockRejectedValueOnce(
      new ApiRequestError(409, {
        code: "CONFLICT",
        message: "Slug đã được dùng",
      }),
    );
    const user = renderForm();
    await openAndFill(user);
    await user.click(screen.getByRole("button", { name: /Đặt lịch/ }));
    await confirmSchedule(user);

    expect(schedulePublication).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Tạo dự án mới" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Slug/)).toHaveValue("du-an-moi-2026");
  });

  /** §58 — bấm xác nhận hai lần liên tiếp chỉ tạo MỘT dự án. */
  it("bấm xác nhận hai lần liên tiếp chỉ tạo MỘT dự án", async () => {
    const user = renderForm();
    await openAndFill(user);
    await user.click(screen.getByRole("button", { name: /Đặt lịch/ }));

    const dialog = await scheduleDialog();
    await user.type(within(dialog).getByLabelText("Ngày đăng"), "2026-08-20");
    await user.type(within(dialog).getByLabelText("Giờ đăng"), "08:00");
    const confirm = within(dialog).getByRole("button", { name: "Lên lịch" });
    await Promise.all([user.click(confirm), user.click(confirm)]);

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(schedulePublication).toHaveBeenCalledTimes(1);
  });

  /** §59 — huỷ hộp thoại lịch: không lệnh nào chạy, nội dung còn nguyên. */
  it("huỷ hộp thoại lịch: không lệnh nào chạy, nội dung còn nguyên", async () => {
    const user = renderForm();
    await openAndFill(user);
    await user.click(screen.getByRole("button", { name: /Đặt lịch/ }));

    const dialog = await scheduleDialog();
    await user.click(within(dialog).getByRole("button", { name: /Hủy|Huỷ/ }));

    // Chờ ĐÚNG điều kiện ngữ nghĩa: lớp lịch đã rời khỏi cây a11y. Trước đây
    // test hỏi form nền ngay lập tức, nên nó vừa đọc trúng khoảnh khắc chuyển
    // tiếp, vừa che mất một lỗi thật (xem khẳng định ngay dưới).
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Lên lịch đăng bài" }),
      ).toBeNull(),
    );

    expect(createProject).not.toHaveBeenCalled();
    expect(schedulePublication).not.toHaveBeenCalled();

    // Form tạo phải CÒN MỞ. Đây mới là điều then chốt: sự kiện dismiss của hộp
    // thoại lịch từng rơi xuống lớp dưới và đóng luôn form, cuốn theo mọi thứ
    // biên tập viên vừa gõ.
    expect(screen.getByRole("dialog", { name: "Tạo dự án mới" })).toBeInTheDocument();
    expect(screen.getByLabelText(/Slug/)).toHaveValue("du-an-moi-2026");
    expect(screen.getByLabelText("Tên dự án")).toHaveValue("Khu đô thị Hưng Phú");

    // Và vẫn gõ tiếp được — lớp vừa đóng không để lại bẫy tiêu điểm.
    await user.type(screen.getByLabelText(/Slug/), "-2");
    expect(screen.getByLabelText(/Slug/)).toHaveValue("du-an-moi-2026-2");
  });

  it("ESC trong hộp thoại lịch cũng không tạo dự án", async () => {
    const user = renderForm();
    await openAndFill(user);
    await user.click(screen.getByRole("button", { name: /Đặt lịch/ }));
    await user.keyboard("{Escape}");

    expect(createProject).not.toHaveBeenCalled();
    expect(schedulePublication).not.toHaveBeenCalled();
  });

  it("nội dung chưa hợp lệ thì không mở được hộp thoại lịch", async () => {
    const user = renderForm();
    await user.click(screen.getByRole("button", { name: "Tạo dự án" }));
    await screen.findByRole("dialog");

    // Bỏ trống mọi trường bắt buộc.
    await user.click(screen.getByRole("button", { name: /Đặt lịch/ }));

    expect(screen.queryByLabelText("Ngày đăng")).toBeNull();
    expect(createProject).not.toHaveBeenCalled();
  });
});
