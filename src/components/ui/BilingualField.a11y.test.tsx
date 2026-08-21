/**
 * BilingualField — TÊN TRUY CẬP (accessible name).
 *
 * Hồi quy đã sửa: ô nhập mang `aria-label={langLabel[lang]}`. Theo thuật toán
 * tính tên truy cập, `aria-label` THẮNG `<label for>`, nên mọi field song ngữ
 * trong CMS đều tự giới thiệu là "Tiếng Việt" — Tiêu đề, Mô tả, Nhãn nút, tất
 * cả cùng một tên. Người dùng trình đọc màn hình đi qua form Dự án nghe bảy ô
 * liên tiếp giống hệt nhau.
 *
 * Vì sao KHÔNG dùng `getByLabelText` để khoá hành vi này: nó khớp `aria-label`
 * HOẶC `<label for>` một cách rời rạc, nên tìm thấy CẢ HAI chuỗi — bộ test cũ
 * vẫn xanh trong khi trình đọc màn hình đã đọc sai. Ở đây dùng
 * `getByRole(role, { name })`, thứ chạy đúng thuật toán tính tên truy cập của
 * trình duyệt. Bằng chứng nó nghiêm: khi bỏ `aria-label`, 19 test đang chọn ô
 * bằng `getByRole("textbox", { name: "Tiếng Việt" })` lập tức đỏ.
 *
 * Phần MÔ TẢ không có truy vấn tương ứng nên đọc thẳng `aria-describedby` rồi
 * ghép nội dung các phần tử được trỏ tới — đúng cách trình đọc màn hình làm.
 */
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { BilingualField } from "@/components/ui/BilingualField";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  title: z.object({
    vi: z.string().min(3, "Tiêu đề tối thiểu 3 ký tự."),
    en: z.string(),
  }),
  summary: z.object({ vi: z.string(), en: z.string() }),
});

/**
 * Dựng đúng khuôn mà mọi form CMS đang dùng: FormItem → FormLabel → FormControl
 * → BilingualField. Hai field để chứng minh chúng phân biệt được với nhau.
 */
function Harness({ withDescription = false }: { withDescription?: boolean }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { title: { vi: "", en: "" }, summary: { vi: "", en: "" } },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(() => {})} noValidate>
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Tiêu đề</FormLabel>
              <FormControl>
                <BilingualField value={field.value} onChange={field.onChange} />
              </FormControl>
              {withDescription && (
                <FormDescription>Hiện trên thẻ tin tức.</FormDescription>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="summary"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mô tả ngắn</FormLabel>
              <FormControl>
                <BilingualField
                  multiline
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <button type="submit">Lưu</button>
      </form>
    </Form>
  );
}

/** Ô nhập đang hiển thị của field mang nhãn đã cho (qua `<label for>`). */
function controlOf(labelText: string): HTMLElement {
  const label = screen.getByText(labelText).closest("label") as HTMLLabelElement;
  const id = label.getAttribute("for")!;
  return document.getElementById(id) as HTMLElement;
}

/** Mô tả truy cập: nối nội dung mọi phần tử mà `aria-describedby` trỏ tới. */
function describedTextOf(control: HTMLElement): string {
  return (control.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
}

describe("BilingualField — tên truy cập", () => {
  it("tên truy cập là NHÃN CỦA FIELD, không phải tên ngôn ngữ", () => {
    render(<Harness />);
    // `getByRole(name:)` chạy thuật toán tính tên truy cập thật — nếu
    // `aria-label` ngôn ngữ quay lại, hai dòng này đỏ ngay.
    expect(screen.getByRole("textbox", { name: "Tiêu đề" })).toBe(
      controlOf("Tiêu đề"),
    );
    expect(screen.getByRole("textbox", { name: "Mô tả ngắn" })).toBe(
      controlOf("Mô tả ngắn"),
    );
  });

  it("KHÔNG ô nào còn mang tên là ngôn ngữ", () => {
    render(<Harness />);
    for (const name of ["Tiếng Việt", "English"]) {
      expect(screen.queryAllByRole("textbox", { name })).toHaveLength(0);
    }
  });

  it("hai field song ngữ trong cùng form KHÔNG trùng tên", () => {
    render(<Harness />);
    expect(controlOf("Tiêu đề")).not.toBe(controlOf("Mô tả ngắn"));
    expect(screen.getAllByRole("textbox")).toHaveLength(2);
  });

  it("KHÔNG còn aria-label đè lên danh tính field", () => {
    render(<Harness />);
    for (const label of ["Tiêu đề", "Mô tả ngắn"]) {
      expect(controlOf(label)).not.toHaveAttribute("aria-label");
    }
  });

  it("ngôn ngữ đang chỉnh vẫn được thông báo — qua MÔ TẢ, không phải tên", () => {
    render(<Harness />);
    expect(describedTextOf(controlOf("Tiêu đề"))).toContain("Tiếng Việt");
  });

  it("đổi sang EN: tên giữ nguyên, phần mô tả đổi theo ngôn ngữ", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const titleItem = screen
      .getByText("Tiêu đề")
      .closest("[data-slot='form-item']") as HTMLElement;
    const enButton = titleItem.querySelector(
      "button[aria-pressed]:nth-of-type(2)",
    ) as HTMLElement;
    await user.click(enButton);

    const control = controlOf("Tiêu đề");
    expect(screen.getByRole("textbox", { name: "Tiêu đề" })).toBe(control);
    expect(describedTextOf(control)).toContain("English");
    expect(describedTextOf(control)).not.toContain("Tiếng Việt");
  });

  it("giữ nguyên hành vi form: gõ vào ô VI cập nhật đúng giá trị", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const control = controlOf("Tiêu đề");
    await user.type(control, "Khu đô thị");
    expect(control).toHaveValue("Khu đô thị");
  });
});

/**
 * Hồi quy thứ hai, phát hiện cùng lúc: `FormControl` truyền `aria-describedby`
 * và `aria-invalid` xuống qua `Slot`, nhưng `BilingualField` không nhận nên
 * NUỐT MẤT cả hai. Hệ quả: thông báo lỗi validate không hề được nối vào ô nhập
 * — trình đọc màn hình báo field hợp lệ trong khi màn hình đang hiện lỗi đỏ.
 */
describe("BilingualField — nối mô tả và trạng thái lỗi từ FormControl", () => {
  it("nhận FormDescription của FormControl, KHÔNG ghi đè bằng phần ngôn ngữ", () => {
    render(<Harness withDescription />);
    const description = describedTextOf(controlOf("Tiêu đề"));
    expect(description).toContain("Hiện trên thẻ tin tức.");
    expect(description).toContain("Tiếng Việt");
  });

  /**
   * Trước bản sửa, `aria-invalid` bị nuốt hoàn toàn: trình đọc màn hình báo
   * field hợp lệ, và vòng viền đỏ (do `aria-invalid` điều khiển) cũng không
   * hiện. Sau bản sửa nó tới được ô nhập.
   *
   * CHÚ Ý — khiếm khuyết RIÊNG, chưa sửa trong batch này: `bilingualText()` gắn
   * lỗi vào đường dẫn `title.vi`, trong khi form khai báo `name="title"`. Do đó
   * `FormMessage` đọc `error.message` trên một object lồng không có `.message`
   * và render ra RỖNG — chữ "Tiêu đề tối thiểu 3 ký tự." không bao giờ hiện.
   * Đó là lỗi của cặp `bilingualText` + `FormMessage`, KHÔNG phải của
   * `BilingualField`, và sửa nó là một quyết định thiết kế đụng mọi form nên
   * thuộc về một batch riêng. Test dưới đây chỉ khoá phần ĐÃ đúng, và cố ý
   * không khẳng định hành vi sai kia là đúng.
   */
  it("khi validate hỏng: aria-invalid tới được ô nhập", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const control = controlOf("Tiêu đề");
    expect(control).not.toHaveAttribute("aria-invalid", "true");

    await user.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() =>
      expect(controlOf("Tiêu đề")).toHaveAttribute("aria-invalid", "true"),
    );
    // Danh tính field không bị lỗi validate làm mất.
    expect(screen.getByRole("textbox", { name: "Tiêu đề" })).toBe(
      controlOf("Tiêu đề"),
    );
  });
});
