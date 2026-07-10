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
}

/**
 * Một field, hai ngôn ngữ, chuyển qua lại bằng nút VI/EN.
 *
 * Chỉ render **một** ô nhập tại một thời điểm thay vì hai ô cạnh nhau: các form
 * hiện có đã dài, nhân đôi số ô sẽ đẩy phần lớn dialog xuống dưới vùng cuộn.
 * Chấm vàng trên nút EN báo hiệu chưa có bản dịch — song ngữ là điều kiện
 * go-live (câu 19), nên trạng thái thiếu phải nhìn thấy ngay chứ không im lặng.
 */
export function BilingualField({
  value,
  onChange,
  multiline = false,
  rows = 3,
  placeholder,
  disabled,
  id,
}: BilingualFieldProps) {
  const [lang, setLang] = useState<Lang>("vi");
  const generatedId = useId();
  const fieldId = id ?? generatedId;

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

      <Control
        id={fieldId}
        // Ô EN và ô VI là hai control khác nhau: không đặt `key` thì React tái
        // dùng DOM node và con trỏ nhảy về cuối khi đổi ngôn ngữ.
        key={lang}
        {...(multiline ? { rows } : {})}
        disabled={disabled}
        aria-label={langLabel[lang]}
        placeholder={placeholder?.[lang]}
        value={value[lang]}
        onChange={(event) => onChange({ ...value, [lang]: event.target.value })}
      />
    </div>
  );
}
