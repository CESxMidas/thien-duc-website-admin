/**
 * Hộp thoại đặt lịch — thứ dễ hỏng nhất là múi giờ: mốc backend trả về ở UTC
 * phải hiện ra thành giờ Việt Nam, và chuỗi gửi đi phải mang đúng instant đó
 * kèm offset `+07:00`. Bộ test này khoá cả round-trip lẫn phần trợ năng (nhãn
 * gắn với ô nhập, lỗi đọc được, aria-invalid đúng ô).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SchedulePublishDialog } from "@/components/content/SchedulePublishDialog";

const onSubmit = vi.fn();
const onOpenChange = vi.fn();

/** "Bây giờ" cố định để ngưỡng 1 phút / 15 phút / 2 năm là tất định. */
const NOW = new Date("2026-08-13T10:00:00.000Z"); // 17:00 giờ VN

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  onSubmit.mockClear();
  onOpenChange.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

function renderDialog(props: Partial<Parameters<typeof SchedulePublishDialog>[0]> = {}) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <SchedulePublishDialog
      open
      onOpenChange={onOpenChange}
      contentTitle="Lễ khởi công khu đô thị Hưng Phú"
      onSubmit={onSubmit}
      {...props}
    />,
  );
  return { user };
}

/** Ô date/time không có role riêng trong jsdom — lấy theo nhãn. */
function fields() {
  return {
    date: screen.getByLabelText("Ngày đăng"),
    time: screen.getByLabelText("Giờ đăng"),
  };
}

describe("SchedulePublishDialog — mở và nhãn", () => {
  it("mở ra dưới dạng dialog, kèm tiêu đề bài viết", async () => {
    renderDialog();
    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByText("Lên lịch đăng bài"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Lễ khởi công khu đô thị Hưng Phú"),
    ).toBeInTheDocument();
  });

  it("hiện múi giờ thành CHỮ, không giấu trong tooltip", async () => {
    renderDialog();
    expect(
      await screen.findByText("Múi giờ: GMT+7 — Việt Nam"),
    ).toBeInTheDocument();
  });

  it("nhãn gắn thật với ô nhập (getByLabelText tìm ra input đúng kiểu)", async () => {
    renderDialog();
    await screen.findByRole("dialog");

    expect(fields().date).toHaveAttribute("type", "date");
    expect(fields().time).toHaveAttribute("type", "time");
  });

  it("ô nhập trỏ tới dòng múi giờ qua aria-describedby", async () => {
    renderDialog();
    await screen.findByRole("dialog");

    const describedBy = fields().date.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      "Múi giờ: GMT+7 — Việt Nam",
    );
  });
});

describe("SchedulePublishDialog — nạp lịch đang có", () => {
  it("mốc UTC của backend hiện thành giờ Việt Nam", async () => {
    renderDialog({ currentScheduledAt: "2026-08-20T01:00:00.000Z" });
    await screen.findByRole("dialog");

    expect(fields().date).toHaveValue("2026-08-20");
    expect(fields().time).toHaveValue("08:00");
    expect(screen.getByText("Đổi lịch đăng bài")).toBeInTheDocument();
  });

  it("lưu mà không sửa gì thì gửi lại ĐÚNG instant cũ", async () => {
    const { user } = renderDialog({
      currentScheduledAt: "2026-08-20T01:00:00.000Z",
    });
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: /Đổi lịch/ }));

    expect(onSubmit).toHaveBeenCalledWith("2026-08-20T08:00:00+07:00");
    expect(Date.parse(onSubmit.mock.calls[0][0] as string)).toBe(
      Date.parse("2026-08-20T01:00:00.000Z"),
    );
  });
});

describe("SchedulePublishDialog — nhập và gửi", () => {
  it("gửi lịch hợp lệ kèm offset +07:00", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    await user.type(fields().date, "2026-08-20");
    await user.type(fields().time, "08:00");
    await user.click(screen.getByRole("button", { name: /Lên lịch/ }));

    expect(onSubmit).toHaveBeenCalledWith("2026-08-20T08:00:00+07:00");
  });

  it("câu tóm tắt nói rõ bài sẽ lên lúc nào", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    await user.type(fields().date, "2026-08-20");
    await user.type(fields().time, "08:00");

    expect(
      screen.getByText(
        "Bài sẽ tự hiển thị trên website vào 08:00, 20/08/2026.",
      ),
    ).toBeInTheDocument();
  });

  it("thiếu ngày: không gọi API, báo lỗi và đánh dấu ô ngày", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    await user.type(fields().time, "08:00");
    await user.click(screen.getByRole("button", { name: /Lên lịch/ }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hãy chọn ngày đăng.",
    );
    expect(fields().date).toHaveAttribute("aria-invalid", "true");
  });

  it("thiếu giờ: báo lỗi ở ô giờ", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    await user.type(fields().date, "2026-08-20");
    await user.click(screen.getByRole("button", { name: /Lên lịch/ }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Hãy chọn giờ đăng.",
    );
    expect(fields().time).toHaveAttribute("aria-invalid", "true");
  });

  it("mốc quá gần (dưới 1 phút) bị chặn tại chỗ", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    // 17:00 giờ VN đúng bằng "bây giờ".
    await user.type(fields().date, "2026-08-13");
    await user.type(fields().time, "17:00");
    await user.click(screen.getByRole("button", { name: /Lên lịch/ }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "cách hiện tại ít nhất 1 phút",
    );
  });

  it("lỗi bám ô nhập được xoá ngay khi người dùng sửa", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: /Lên lịch/ }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.type(fields().date, "2026-08-20");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(fields().date).toHaveAttribute("aria-invalid", "false");
  });
});

describe("SchedulePublishDialog — cảnh báo mốc rất gần", () => {
  it("dưới 15 phút: cảnh báo mềm, vẫn gửi được", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    await user.type(fields().date, "2026-08-13");
    await user.type(fields().time, "17:10"); // +10 phút

    expect(
      screen.getByText("Lịch này rất gần. Cân nhắc dùng Đăng ngay."),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Lên lịch/ }));
    expect(onSubmit).toHaveBeenCalledWith("2026-08-13T17:10:00+07:00");
  });

  it("xa hơn 15 phút: không cảnh báo", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    await user.type(fields().date, "2026-08-13");
    await user.type(fields().time, "18:00");

    expect(
      screen.queryByText("Lịch này rất gần. Cân nhắc dùng Đăng ngay."),
    ).toBeNull();
  });
});

describe("SchedulePublishDialog — lỗi API và trạng thái gửi", () => {
  it("thông báo lỗi từ backend hiện trong hộp thoại", async () => {
    renderDialog({
      errorMessage: "Bài viết này đã từng được đăng nên không đặt lịch đăng lại được.",
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "đã từng được đăng",
    );
  });

  it("đang gửi: khoá cả hai nút và ô nhập", async () => {
    renderDialog({ submitting: true });
    await screen.findByRole("dialog");

    expect(screen.getByRole("button", { name: /Lên lịch/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(fields().date).toBeDisabled();
  });

  it("bấm Hủy yêu cầu đóng hộp thoại", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    await user.click(screen.getByRole("button", { name: "Hủy" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("phím Esc đóng hộp thoại (giữ nguyên cơ chế của Radix)", async () => {
    const { user } = renderDialog();
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
