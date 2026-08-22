/**
 * `FormMessage` — thông báo lỗi cho field có giá trị LỒNG NHAU.
 *
 * ## Lỗi được sửa
 *
 * `bilingualText()` dựng `z.object({ vi, en })`, nên Zod gắn lỗi vào đường dẫn
 * `title.vi`. Form lại khai báo `<FormField name="title">`, và `FormMessage` chỉ
 * đọc `error.message` ở gốc. Hình dạng lỗi thật đo được từ react-hook-form:
 *
 * ```
 * fieldState.error = {
 *   vi: { message: "Tiêu đề tối thiểu 3 ký tự.", type: "too_small", ref: … }
 * }
 * ```
 *
 * `error.message` là `undefined` ⇒ `String(undefined ?? "")` ⇒ `""` ⇒
 * `FormMessage` trả `null`. Người dùng thấy ô viền đỏ nhưng **không có chữ nào**
 * giải thích, và `aria-describedby` trỏ tới một id không tồn tại.
 *
 * Ảnh hưởng toàn bộ 6 nhóm form dùng `bilingualText`: Banner, Cooperation,
 * NewsCategory, News, Page, Project.
 *
 * ## Ranh giới của bộ test này
 *
 * Đây là hợp đồng CHUNG của `FormMessage`, không phải của riêng field song ngữ:
 * nhóm cuối khoá lại rằng field vô hướng (chuỗi thường) vẫn hiện lỗi **y hệt
 * như trước**, để bản sửa không âm thầm đổi hành vi của form đăng nhập, đặt lại
 * mật khẩu hay bất kỳ field phẳng nào.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { BilingualField } from "@/components/ui/BilingualField";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { bilingualText } from "@/lib/form-validation";

/** Dùng CHÍNH builder production, không dựng schema giả. */
const schema = z.object({
  title: bilingualText(3, "Tiêu đề tối thiểu 3 ký tự."),
  summary: bilingualText(10, "Tóm tắt tối thiểu 10 ký tự."),
  slug: z.string().trim().min(3, "Slug tối thiểu 3 ký tự."),
});

type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  title: { vi: "", en: "" },
  summary: { vi: "", en: "" },
  slug: "",
};

function Harness({
  defaultValues = EMPTY,
  withDescription = false,
  onValid,
}: {
  defaultValues?: Values;
  withDescription?: boolean;
  onValid?: (values: Values) => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit((v) => onValid?.(v))} noValidate>
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
              <FormLabel>Tóm tắt</FormLabel>
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
        {/* Field VÔ HƯỚNG — chứng minh hành vi cũ không đổi. */}
        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Đường dẫn</FormLabel>
              <FormControl>
                <Input {...field} />
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

/** Ô nhập của field mang nhãn đã cho (qua `<label for>`). */
function controlOf(labelText: string): HTMLElement {
  const label = screen.getByText(labelText).closest("label") as HTMLLabelElement;
  return document.getElementById(label.getAttribute("for")!) as HTMLElement;
}

/** Nội dung mọi phần tử mà `aria-describedby` của ô trỏ tới. */
function describedTextOf(control: HTMLElement): string {
  return (control.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
}

const submit = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole("button", { name: "Lưu" }));

describe("FormMessage — lỗi lồng của field song ngữ (B)", () => {
  it("hiện ĐÚNG thông báo của schema, không phải chuỗi rỗng", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await submit(user);

    expect(
      await screen.findByText("Tiêu đề tối thiểu 3 ký tự."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Tóm tắt tối thiểu 10 ký tự."),
    ).toBeInTheDocument();
  });

  it("KHÔNG thay thông báo riêng bằng chữ chung chung", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await submit(user);

    await screen.findByText("Tiêu đề tối thiểu 3 ký tự.");
    expect(screen.queryByText(/không hợp lệ/i)).toBeNull();
  });

  /** §12C — object lỗi rỗng/dị dạng không được đẩy "[object Object]" ra màn hình. */
  it("không bao giờ render dạng [object Object]", async () => {
    const user = userEvent.setup();
    const { container } = render(<Harness />);
    await submit(user);

    await screen.findByText("Tiêu đề tối thiểu 3 ký tự.");
    expect(container.textContent).not.toContain("[object");
    expect(container.textContent).not.toContain("undefined");
  });
});

describe("FormMessage — field VÔ HƯỚNG giữ nguyên hành vi cũ (A)", () => {
  it("lỗi phẳng `error.message` vẫn hiện y như trước", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await submit(user);

    expect(
      await screen.findByText("Slug tối thiểu 3 ký tự."),
    ).toBeInTheDocument();
  });

  it("field vô hướng hợp lệ thì KHÔNG hiện thông báo nào", async () => {
    const user = userEvent.setup();
    render(
      <Harness defaultValues={{ ...EMPTY, slug: "duong-dan-hop-le" }} />,
    );
    await submit(user);

    await screen.findByText("Tiêu đề tối thiểu 3 ký tự.");
    expect(screen.queryByText("Slug tối thiểu 3 ký tự.")).toBeNull();
  });
});

describe("FormMessage — liên kết trợ năng (F, G, H)", () => {
  it("aria-invalid bật cho field song ngữ không hợp lệ", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await submit(user);

    await waitFor(() =>
      expect(controlOf("Tiêu đề")).toHaveAttribute("aria-invalid", "true"),
    );
  });

  /** §12G — id của thông báo phải NẰM TRONG aria-describedby và trỏ tới phần tử THẬT. */
  it("id thông báo nằm trong aria-describedby và trỏ tới phần tử có thật", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await submit(user);
    await screen.findByText("Tiêu đề tối thiểu 3 ký tự.");

    const control = controlOf("Tiêu đề");
    const ids = (control.getAttribute("aria-describedby") ?? "").split(/\s+/);
    const messageId = ids.find((id) => id.endsWith("-form-item-message"))!;

    expect(messageId).toBeTruthy();
    // Trước bản sửa id này trỏ vào hư vô vì FormMessage trả null.
    expect(document.getElementById(messageId)).not.toBeNull();
    expect(document.getElementById(messageId)!.textContent).toBe(
      "Tiêu đề tối thiểu 3 ký tự.",
    );
  });

  it("thông báo lỗi thật sự tới được phần MÔ TẢ của ô nhập", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await submit(user);
    await screen.findByText("Tiêu đề tối thiểu 3 ký tự.");

    expect(describedTextOf(controlOf("Tiêu đề"))).toContain(
      "Tiêu đề tối thiểu 3 ký tự.",
    );
  });

  /** §12E — mô tả sẵn có phải được GHÉP THÊM, không bị lỗi ghi đè. */
  it("FormDescription sẵn có vẫn còn bên cạnh thông báo lỗi", async () => {
    const user = userEvent.setup();
    render(<Harness withDescription />);
    await submit(user);
    await screen.findByText("Tiêu đề tối thiểu 3 ký tự.");

    const described = describedTextOf(controlOf("Tiêu đề"));
    expect(described).toContain("Hiện trên thẻ tin tức.");
    expect(described).toContain("Tiêu đề tối thiểu 3 ký tự.");
    // Ngữ cảnh ngôn ngữ của Batch 13A không bị mất.
    expect(described).toContain("Tiếng Việt");
  });

  /** §12H — không tái phát aria-label đè lên danh tính field. */
  it("không có aria-label nào quay lại trên ô nhập", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await submit(user);
    await screen.findByText("Tiêu đề tối thiểu 3 ký tự.");

    for (const label of ["Tiêu đề", "Tóm tắt"]) {
      expect(controlOf(label)).not.toHaveAttribute("aria-label");
      expect(screen.getByRole("textbox", { name: label })).toBe(
        controlOf(label),
      );
    }
  });
});

describe("FormMessage — lỗi biến mất khi sửa đúng (§14)", () => {
  it("gõ đủ ký tự thì thông báo tự mất, giá trị đang gõ còn nguyên", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await submit(user);
    await screen.findByText("Tiêu đề tối thiểu 3 ký tự.");

    await user.type(controlOf("Tiêu đề"), "Khu đô thị Hưng Phú");

    await waitFor(() =>
      expect(screen.queryByText("Tiêu đề tối thiểu 3 ký tự.")).toBeNull(),
    );
    expect(controlOf("Tiêu đề")).toHaveValue("Khu đô thị Hưng Phú");
    // Field khác vẫn giữ lỗi của nó — xoá lỗi không lan sang field lành.
    expect(screen.getByText("Tóm tắt tối thiểu 10 ký tự.")).toBeInTheDocument();
  });

  it("form hợp lệ: submit chạy đúng MỘT lần, không còn thông báo nào", async () => {
    const user = userEvent.setup();
    const onValid = vi.fn();
    render(
      <Harness
        defaultValues={{
          title: { vi: "Khu đô thị", en: "" },
          summary: { vi: "Tóm tắt đủ dài cho schema.", en: "" },
          slug: "khu-do-thi",
        }}
        onValid={onValid}
      />,
    );
    await submit(user);

    await waitFor(() => expect(onValid).toHaveBeenCalledTimes(1));
    expect(document.querySelectorAll("[data-slot='form-message']")).toHaveLength(
      0,
    );
  });
});

describe("FormMessage — chuyển VI/EN (§15)", () => {
  it("đổi ngôn ngữ: lỗi VI còn nguyên, nội dung không mất, tên field không đổi", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(controlOf("Tiêu đề"), "Ab"); // vẫn dưới 3 ký tự
    await submit(user);
    await screen.findByText("Tiêu đề tối thiểu 3 ký tự.");

    const item = screen
      .getByText("Tiêu đề")
      .closest("[data-slot='form-item']") as HTMLElement;
    const enButton = item.querySelectorAll("button[aria-pressed]")[1];
    await user.click(enButton);

    // Lỗi của VI vẫn hiện đúng một lần, không nhân đôi.
    expect(screen.getAllByText("Tiêu đề tối thiểu 3 ký tự.")).toHaveLength(1);
    // EN là TÙY CHỌN: chuyển tab không được sinh thêm thông báo lỗi nào.
    // (Chữ "English" có xuất hiện trong DOM, nhưng đó là nhãn ngôn ngữ dành cho
    // trình đọc màn hình của Batch 13A — không phải thông báo lỗi.)
    const messagesOnTitle = item.querySelectorAll(
      "[data-slot='form-message']",
    );
    expect(messagesOnTitle).toHaveLength(1);
    expect(messagesOnTitle[0].textContent).toBe("Tiêu đề tối thiểu 3 ký tự.");

    const control = controlOf("Tiêu đề");
    expect(control).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Tiêu đề" })).toBe(control);
    expect(describedTextOf(control)).toContain("Tiêu đề tối thiểu 3 ký tự.");

    // Quay lại VI: nội dung đã gõ còn nguyên.
    await user.click(item.querySelectorAll("button[aria-pressed]")[0]);
    expect(controlOf("Tiêu đề")).toHaveValue("Ab");
  });
});
