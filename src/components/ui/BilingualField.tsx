import { useId, useState } from "react";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { BilingualValue } from "@/lib/bilingual";

type Lang = "vi" | "en";

const langLabel: Record<Lang, string> = { vi: "Tiếng Việt", en: "English" };

interface BilingualFieldProps {
  value: BilingualValue;
  onChange: (value: BilingualValue) => void;
  multiline?: boolean;
  rows?: number;
  placeholder?: Partial<Record<Lang, string>>;
  disabled?: boolean;
  /** Gắn `aria-describedby` / `id` cho ô đang hiển thị. */
  id?: string;
  /**
   * `FormControl` của shadcn truyền ba thuộc tính này xuống qua `Slot`. Phải
   * NHẬN và chuyển tiếp: trước đây chúng bị nuốt mất, nên thông báo lỗi
   * (`FormMessage`) và phần mô tả (`FormDescription`) không hề được nối vào ô
   * nhập, và trạng thái không hợp lệ cũng không tới được trình đọc màn hình.
   */
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * Một field, hai ngôn ngữ, chuyển qua lại bằng nút VI/EN.
 *
 * Chỉ render **một** ô nhập tại một thời điểm thay vì hai ô cạnh nhau: các form
 * hiện có đã dài, nhân đôi số ô sẽ đẩy phần lớn dialog xuống dưới vùng cuộn.
 * Chấm vàng trên nút EN báo hiệu chưa có bản dịch — song ngữ là điều kiện
 * go-live (câu 19), nên trạng thái thiếu phải nhìn thấy ngay chứ không im lặng.
 *
 * ## Tên truy cập (accessible name) — vì sao KHÔNG dùng `aria-label`
 *
 * Trước đây ô nhập mang `aria-label={langLabel[lang]}`. Theo thuật toán tính
 * tên truy cập, `aria-label` THẮNG phần tử `<label for>`, nên mọi field song
 * ngữ trong CMS đều tự giới thiệu là "Tiếng Việt" — kể cả Tiêu đề, Mô tả, Nhãn
 * nút. Đo được bằng `computeAccessibleName`: nhãn hiển thị "Tiêu đề" nhưng tên
 * truy cập trả về "Tiếng Việt". Một người dùng trình đọc màn hình đi qua form
 * Dự án sẽ nghe bảy ô liên tiếp cùng tên, không cách nào phân biệt.
 *
 * Cách sửa: **bỏ hẳn `aria-label`** để `<label for>` do `FormLabel` dựng lên
 * giành lại quyền đặt tên, rồi đưa ngôn ngữ vào phần MÔ TẢ qua
 * `aria-describedby`. Trình đọc màn hình đọc "Tiêu đề, ô nhập, Tiếng Việt" —
 * giữ nguyên thông tin ngôn ngữ, nhưng không còn giẫm lên danh tính của field.
 *
 * `aria-describedby` từ `FormControl` được NỐI THÊM chứ không ghi đè, nếu không
 * thông báo lỗi validate sẽ bị mất.
 */
export function BilingualField({
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  disabled,
  id,
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
}: BilingualFieldProps) {
  const [lang, setLang] = useState<Lang>("vi");
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const langNoteId = `${fieldId}-lang`;

  const Control = multiline ? Textarea : Input;
  const missingEnglish = value.vi.trim() !== "" && value.en.trim() === "";

  return (
    <div className="space-y-2">
      <div className="flex gap-1" role="group" aria-label="Chọn ngôn ngữ">
        {(["vi", "en"] as const).map((item) => {
          const active = item === lang;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setLang(item)}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors duration-150",
                "focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none",
                active
                  ? "bg-brand/12 text-brand"
                  : "text-slate hover:bg-cream hover:text-ink",
              )}
            >
              {item}
              {item === "en" && missingEnglish && (
                <span
                  className="size-1.5 rounded-full bg-gold"
                  title="Chưa có bản dịch tiếng Anh"
                  aria-label="Chưa có bản dịch tiếng Anh"
                />
              )}
            </button>
          );
        })}
      </div>

      {/*
        Ngôn ngữ đang chỉnh, dành riêng cho trình đọc màn hình. Nút VI/EN phía
        trên đã nói điều này bằng thị giác, nhưng tiêu điểm có thể nhảy thẳng
        vào ô nhập mà không đi qua chúng.
      */}
      <span id={langNoteId} className="sr-only">
        {langLabel[lang]}
      </span>

      <Control
        id={fieldId}
        // Ô EN và ô VI là hai control khác nhau: không đặt `key` thì React tái
        // dùng DOM node và con trỏ nhảy về cuối khi đổi ngôn ngữ.
        key={lang}
        {...(multiline ? { rows } : {})}
        disabled={disabled}
        // KHÔNG có `aria-label` ở đây — xem chú thích đầu component. Tên truy
        // cập đến từ `<label for>` của `FormLabel`.
        aria-describedby={[describedBy, langNoteId].filter(Boolean).join(" ")}
        aria-invalid={invalid}
        placeholder={placeholder?.[lang]}
        value={value[lang]}
        onChange={(event) => onChange({ ...value, [lang]: event.target.value })}
      />
    </div>
  );
}
