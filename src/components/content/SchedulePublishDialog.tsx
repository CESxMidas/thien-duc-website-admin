// Hộp thoại đặt / đổi lịch đăng nội dung.
//
// Nhận dữ liệu qua props (tiêu đề, mốc hiện tại, trạng thái gửi, lỗi API) chứ
// không tự gọi hook của tin tức — hiện chỉ Tin tức dùng, nhưng phần "chọn một
// mốc giờ Việt Nam" không có gì riêng của tin tức cả.
//
// Hai ô NATIVE `date` + `time` thay cho một ô `datetime-local`: giá trị của
// `datetime-local` là chuỗi trần không mang múi giờ, và mọi cách quy đổi tại
// chỗ đều đi qua múi giờ MÁY. Tách hai ô rồi tự ghép bằng
// `composeVietnamInstant` thì chuỗi gửi đi luôn là `...+07:00`, đúng thứ biên
// tập viên nhìn thấy, bất kể máy đặt múi giờ nào. Không thêm thư viện lịch —
// ô native đã có bàn phím, đọc màn hình và định dạng theo locale sẵn.

import { useEffect, useId, useState } from "react";
import { AlertTriangle, CalendarClock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SplitModal } from "@/components/ui/SplitModal";
import {
  NEAR_SCHEDULE_WARNING_MS,
  validateScheduleFields,
  type ScheduleField,
} from "@/lib/news-schedule";
import {
  VIETNAM_TIMEZONE_LABEL,
  formatVietnamSentence,
  toVietnamFields,
} from "@/lib/vietnam-time";

export interface SchedulePublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Tiêu đề nội dung đang đặt lịch — để người dùng chắc chắn đúng bài. */
  contentTitle: string;
  /** Lịch đang có (ISO). Có giá trị ⇒ chế độ ĐỔI lịch, ô nhập được nạp sẵn. */
  currentScheduledAt?: string | null;
  submitting?: boolean;
  /** Lỗi trả về từ API — hiện ngay trong hộp thoại, không chỉ toast rồi mất. */
  errorMessage?: string | null;
  /** Gọi với instant đã kèm offset `+07:00`. Hộp thoại không tự đóng. */
  onSubmit: (scheduledAt: string) => void;
}

/** Ô nhập rỗng khi đặt lịch lần đầu; nạp theo giờ VN khi đổi lịch. */
function initialFields(currentScheduledAt?: string | null) {
  const fields = currentScheduledAt ? toVietnamFields(currentScheduledAt) : null;
  return fields ?? { date: "", time: "" };
}

export function SchedulePublishDialog({
  open,
  onOpenChange,
  contentTitle,
  currentScheduledAt = null,
  submitting = false,
  errorMessage = null,
  onSubmit,
}: SchedulePublishDialogProps) {
  const isReschedule = currentScheduledAt !== null;
  const dateId = useId();
  const timeId = useId();
  const zoneId = useId();
  const errorId = useId();

  const [fields, setFields] = useState(() => initialFields(currentScheduledAt));
  const [invalidField, setInvalidField] = useState<ScheduleField | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Mỗi lần mở lại: nạp đúng lịch của bài đang chọn và xoá lỗi của lượt trước.
  useEffect(() => {
    if (open) {
      setFields(initialFields(currentScheduledAt));
      setInvalidField(null);
      setLocalError(null);
    }
  }, [open, currentScheduledAt]);

  // Xem trước theo đúng giá trị đang gõ. Dùng `now` của lần render này: câu tóm
  // tắt và cảnh báo "rất gần" chỉ để đọc, không phải thứ quyết định hợp lệ.
  const preview = validateScheduleFields(fields.date, fields.time, new Date());
  const summary = preview.ok ? formatVietnamSentence(preview.scheduledAt) : null;
  const isNearTime = preview.ok && preview.leadMs < NEAR_SCHEDULE_WARNING_MS;

  // Lỗi hiển thị: ưu tiên lỗi vừa validate tại chỗ, sau đó tới lỗi từ API.
  const shownError = localError ?? errorMessage;
  const describedBy = shownError ? `${zoneId} ${errorId}` : zoneId;

  function handleSubmit() {
    const result = validateScheduleFields(fields.date, fields.time, new Date());
    if (!result.ok) {
      setInvalidField(result.field);
      setLocalError(result.message);
      return;
    }
    setInvalidField(null);
    setLocalError(null);
    onSubmit(result.scheduledAt);
  }

  function update(patch: Partial<typeof fields>) {
    setFields((previous) => ({ ...previous, ...patch }));
    // Người dùng đang sửa: bỏ lỗi cũ để không còn báo đỏ trên giá trị mới.
    setInvalidField(null);
    setLocalError(null);
  }

  return (
    <SplitModal
      open={open}
      onOpenChange={onOpenChange}
      size="default"
      title={isReschedule ? "Đổi lịch đăng bài" : "Lên lịch đăng bài"}
      description={contentTitle}
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarClock className="size-4" />
            )}
            {isReschedule ? "Đổi lịch" : "Lên lịch"}
          </Button>
        </>
      }
    >
      <form
        // Enter trong ô nhập cũng gửi được, giống mọi form khác của CMS.
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
        className="space-y-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor={dateId}>Ngày đăng</Label>
            <Input
              id={dateId}
              type="date"
              value={fields.date}
              onChange={(event) => update({ date: event.target.value })}
              aria-invalid={invalidField === "date"}
              aria-describedby={describedBy}
              disabled={submitting}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={timeId}>Giờ đăng</Label>
            <Input
              id={timeId}
              type="time"
              value={fields.time}
              onChange={(event) => update({ time: event.target.value })}
              aria-invalid={invalidField === "time"}
              aria-describedby={describedBy}
              disabled={submitting}
            />
          </div>
        </div>

        {/* Múi giờ luôn hiện thành chữ, không giấu trong tooltip: người nhập
            phải biết 08:00 này là 08:00 ở đâu trước khi bấm lưu. */}
        <p id={zoneId} className="text-xs text-slate">
          Múi giờ: {VIETNAM_TIMEZONE_LABEL}
        </p>

        {summary ? (
          <p className="rounded-md border border-line bg-cream/50 px-3 py-2 text-sm text-ink">
            Bài sẽ tự hiển thị trên website vào {summary}.
          </p>
        ) : null}

        {isNearTime ? (
          // Cảnh báo MỀM: backend vẫn nhận nếu còn cách hiện tại trên 1 phút,
          // nên không chặn gửi — chỉ gợi ý lối đi đúng hơn.
          <p className="flex items-start gap-2 text-sm text-status-warning-fg">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Lịch này rất gần. Cân nhắc dùng Đăng ngay.
          </p>
        ) : null}

        {shownError ? (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {shownError}
          </p>
        ) : null}
      </form>
    </SplitModal>
  );
}
