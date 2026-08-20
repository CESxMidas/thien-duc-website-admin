import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { pageSchema, type PageFormValues } from "./page-schema";
import { toast } from "sonner";
import { CalendarClock, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BilingualField } from "@/components/ui/BilingualField";
import { Input } from "@/components/ui/input";
import { SplitModal } from "@/components/ui/SplitModal";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { SchedulePublishDialog } from "@/components/content/SchedulePublishDialog";
import { useAuth } from "@/context/AuthContext";
import {
  useCreatePage,
  useSchedulePagePublication,
  useUpdatePage,
  useUpdatePageStatus,
} from "@/lib/api/queries";
import { contentStatusActions } from "@/lib/content-status-actions";
import { canScheduleRole } from "@/lib/news-schedule";
import { formatVietnamSentence } from "@/lib/vietnam-time";
import { resolveApiError } from "@/lib/api-error-message";
import { toBilingualValue } from "@/lib/bilingual";
import {
  paragraphsToText,
  toParagraphPayload,
} from "@/lib/long-form-content";
import type { StaticPage } from "@/types";

interface PageFormDialogProps {
  trigger: ReactNode;
  /** Có `page` = chế độ sửa; không có = tạo mới. */
  page?: StaticPage;
}

function toFormValues(page?: StaticPage): PageFormValues {
  return {
    slug: page?.slug ?? "",
    title: toBilingualValue(page?.title),
    content: {
      vi: paragraphsToText(page?.content, "vi"),
      en: paragraphsToText(page?.content, "en"),
    },
  };
}

export function PageFormDialog({ trigger, page }: PageFormDialogProps) {
  const isEdit = page !== undefined;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();
  const updateStatus = useUpdatePageStatus();
  const schedulePublication = useSchedulePagePublication();

  // Trang mới có thể kết thúc ở nhiều đích khác nhau. Nội dung form giống hệt
  // nhau, chỉ khác **lệnh chạy sau khi tạo** — xem `runCreate`. Trang mới của
  // MỌI vai trò đều sinh ra ở `DRAFT` sạch, nên ADMIN và SUPER_ADMIN có cùng bộ
  // thao tác.
  const showSchedule = !isEdit && canScheduleRole(user?.role);
  // Lệnh trạng thái đi kèm nút phụ: ADMIN/SUPER_ADMIN "Đăng ngay" (→ PUBLISHED),
  // EDITOR "Gửi duyệt" (→ PENDING). Lấy từ ma trận dùng chung để nhãn và quyền
  // không bị chép lại lần nữa.
  const followUpAction = isEdit
    ? null
    : (contentStatusActions(user?.role, "DRAFT")[0] ?? null);

  // Giá trị form đã qua validate, chờ người dùng chọn mốc giờ ở hộp thoại lịch.
  // Có giá trị KHÔNG có nghĩa là đã tạo trang — mới chỉ là "sẵn sàng tạo".
  const [pendingSchedule, setPendingSchedule] = useState<PageFormValues | null>(
    null,
  );
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Cờ chạy chuỗi lệnh. `useState` để vẽ lại nút, `useRef` để chặn ngay trong
  // cùng một tick — hai cú click liên tiếp xảy ra trước khi React kịp render
  // lại, nút `disabled` một mình không cứu được.
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const form = useForm<PageFormValues>({
    resolver: zodResolver(pageSchema),
    defaultValues: toFormValues(page),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(page));
      setPendingSchedule(null);
      setScheduleError(null);
    }
  }, [open, page, form]);

  function toPayload(values: PageFormValues) {
    return {
      slug: values.slug,
      title: {
        vi: values.title.vi,
        ...(values.title.en && { en: values.title.en }),
      },
      content: toParagraphPayload(values.content),
      // KHÔNG có `status`, `scheduledAt`, `publishedAt` ở đây. Đăng/hẹn giờ là
      // lệnh xuất bản riêng, có phân quyền riêng — xem `runCreate`.
    };
  }

  function closeAll() {
    setPendingSchedule(null);
    setScheduleError(null);
    setOpen(false);
  }

  /**
   * Tạo trang mới, rồi (tuỳ đích) chạy **một lệnh thứ hai** trên trang vừa tạo.
   *
   * Hai lệnh, không phải một: backend cố tình không nhận `scheduledAt` hay
   * `status` trong DTO nội dung.
   *
   * Slug dùng cho lệnh thứ hai LUÔN lấy từ response của bước tạo: backend có
   * thể chuẩn hoá slug, nên slug trong form chỉ là đề nghị.
   *
   * Nếu bước hai hỏng: **trang đã tồn tại rồi**. Không xoá, không tạo lại,
   * không giả vờ là tạo hỏng — đóng form (để không ai bấm tạo lần nữa thành
   * trang trùng) và nói thẳng rằng trang đã lưu, việc còn thiếu làm lại được từ
   * danh sách.
   */
  async function runCreate(
    values: PageFormValues,
    outcome: "draft" | "status" | "schedule",
    scheduledAt?: string,
  ) {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    const title = values.title.vi;
    try {
      let created;
      try {
        created = await createPage.mutateAsync(toPayload(values));
      } catch (error) {
        // Tạo hỏng: KHÔNG chạy lệnh thứ hai, giữ nguyên dữ liệu đang gõ để sửa
        // rồi thử lại. Đóng hộp thoại lịch vì mốc giờ đã chọn không còn ngữ cảnh.
        setPendingSchedule(null);
        toast.error(
          resolveApiError(error, "Không tạo được trang. Vui lòng thử lại."),
        );
        return;
      }

      if (outcome === "schedule" && scheduledAt !== undefined) {
        try {
          await schedulePublication.mutateAsync({
            slug: created.slug,
            scheduledAt,
          });
          const when = formatVietnamSentence(scheduledAt);
          toast.success(
            when
              ? `Đã tạo trang "${title}" và hẹn đăng vào ${when}.`
              : `Đã tạo trang "${title}" và lên lịch đăng.`,
          );
        } catch (error) {
          toast.error(
            `Đã lưu trang "${title}" ở dạng nháp nhưng chưa đặt được lịch: ${resolveApiError(
              error,
              "không đặt được lịch đăng.",
            )} Hãy dùng nút "Lên lịch" ở danh sách Trang nội dung để đặt lại.`,
          );
        }
        closeAll();
        return;
      }

      if (outcome !== "status" || followUpAction === null) {
        toast.success(`Đã tạo trang "${title}".`);
        closeAll();
        return;
      }

      try {
        await updateStatus.mutateAsync({
          slug: created.slug,
          status: followUpAction.to,
        });
        toast.success(
          followUpAction.intent === "publish"
            ? `Đã tạo và đăng trang "${title}".`
            : `Đã tạo trang "${title}" và gửi duyệt.`,
        );
      } catch (error) {
        toast.error(
          `Đã lưu trang "${title}" ở dạng nháp nhưng chưa ${
            followUpAction.intent === "publish" ? "đăng" : "gửi duyệt"
          } được: ${resolveApiError(
            error,
            "không đổi được trạng thái.",
          )} Hãy thử lại từ danh sách Trang nội dung.`,
        );
      }
      closeAll();
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  async function onSubmit(values: PageFormValues) {
    if (!isEdit) {
      await runCreate(values, "draft");
      return;
    }
    try {
      await updatePage.mutateAsync({
        slug: page.slug,
        data: toPayload(values),
      });
      toast.success("Đã lưu trang.");
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không lưu được trang. Vui lòng thử lại."),
      );
    }
  }

  const submitting = form.formState.isSubmitting || running;

  const formId = "page-form";

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        // Đang chạy chuỗi tạo → không cho đóng: đóng giữa chừng thì người dùng
        // mất dấu trang vừa tạo và không biết lệnh thứ hai đã chạy hay chưa.
        onOpenChange={(next) => {
          if (running) return;
          setOpen(next);
        }}
        trigger={trigger}
        size="wide"
        title={isEdit ? "Sửa trang" : "Tạo trang nội dung"}
        description={
          isEdit
            ? "Nội dung trang tĩnh. Website công khai chỉ hiển thị trang đã đăng."
            : showSchedule
              ? "Trang mới luôn lưu ở trạng thái nháp. Chọn Đăng ngay hoặc Đặt lịch nếu muốn đưa trang ra website."
              : "Trang mới lưu ở trạng thái nháp — website công khai chỉ hiển thị trang đã đăng."
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            {/* Nút CHÍNH của form: luôn chỉ tạo/lưu bản nháp. Mọi đích khác là
                lệnh thứ hai chạy sau khi tạo — không đích nào nằm trong payload. */}
            <Button
              type="submit"
              form={formId}
              variant={isEdit || !followUpAction ? undefined : "outline"}
              disabled={submitting}
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Lưu thay đổi" : "Lưu nháp"}
            </Button>

            {/* EDITOR: "Gửi duyệt". ADMIN/SUPER_ADMIN: "Đăng ngay". Nhãn và
                trạng thái đích lấy từ ma trận dùng chung. */}
            {!isEdit && followUpAction && (
              <Button
                type="button"
                variant={showSchedule ? "outline" : undefined}
                disabled={submitting}
                onClick={() =>
                  void form.handleSubmit((values) =>
                    runCreate(values, "status"),
                  )()
                }
              >
                <Send className="size-4" />
                {followUpAction.label}
              </Button>
            )}

            {/* Đặt lịch: validate form TRƯỚC rồi mới mở hộp thoại giờ — mở
                trước sẽ để người dùng chọn xong mốc giờ rồi mới báo thiếu tiêu đề. */}
            {showSchedule && (
              <Button
                type="button"
                disabled={submitting}
                onClick={() =>
                  void form.handleSubmit((values) => {
                    setScheduleError(null);
                    setPendingSchedule(values);
                  })()
                }
              >
                <CalendarClock className="size-4" />
                Đặt lịch
              </Button>
            )}
          </>
        }
      >
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Slug (đường dẫn)</FormLabel>
                  <FormControl>
                    <Input placeholder="gioi-thieu" {...field} disabled={isEdit} />
                  </FormControl>
                  <FormDescription>
                    Website đọc trang theo slug: <code>gioi-thieu</code> và{" "}
                    <code>lien-he</code> là hai slug đang được dùng.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tiêu đề</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{
                        vi: "Tổng quan về Công ty Thiên Đức",
                        en: "About Thien Duc",
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nội dung</FormLabel>
                  <FormControl>
                    <BilingualField
                      multiline
                      rows={8}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Cách nhau một dòng trống để tách đoạn. Đoạn đầu tiên hiển thị
                    làm mô tả dưới tiêu đề trang, các đoạn sau nằm trong phần nội
                    dung. Bản tiếng Anh nên giữ đúng số đoạn như tiếng Việt.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

        </form>
      </SplitModal>

      {/* Dùng lại đúng hộp thoại của Tin tức/Dự án/Hợp tác — cùng ràng buộc giờ
          Việt Nam, cùng hai ngưỡng 1 phút / 2 năm. */}
      <SchedulePublishDialog
        open={pendingSchedule !== null}
        onOpenChange={(next) => {
          if (!next) {
            setPendingSchedule(null);
            setScheduleError(null);
          }
        }}
        contentTitle={pendingSchedule?.title.vi ?? ""}
        currentScheduledAt={null}
        submitting={running}
        errorMessage={scheduleError}
        onSubmit={(scheduledAt) => {
          if (pendingSchedule) {
            void runCreate(pendingSchedule, "schedule", scheduledAt);
          }
        }}
      />
    </Form>
  );
}
