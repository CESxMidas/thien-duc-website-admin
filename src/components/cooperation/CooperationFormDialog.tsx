import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { cooperationSchema, type CooperationFormValues } from "./cooperation-schema";
import { toast } from "sonner";
import { CalendarClock, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BilingualField } from "@/components/ui/BilingualField";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { MediaSection, SplitModal } from "@/components/ui/SplitModal";
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
  useCreateCooperationProject,
  useScheduleCooperationPublication,
  useUpdateCooperationProject,
  useUpdateCooperationStatus,
} from "@/lib/api/queries";
import { contentStatusActions } from "@/lib/content-status-actions";
import { canScheduleRole } from "@/lib/news-schedule";
import { formatVietnamSentence } from "@/lib/vietnam-time";
import { resolveApiError } from "@/lib/api-error-message";
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import type { CooperationProject } from "@/types";

interface CooperationFormDialogProps {
  trigger: ReactNode;
  /** Có `project` = chế độ sửa; không có = tạo mới. */
  project?: CooperationProject;
}

function toFormValues(project?: CooperationProject): CooperationFormValues {
  return {
    name: toBilingualValue(project?.name),
    location: toBilingualValue(project?.location),
    role: toBilingualValue(project?.role),
    partner: toBilingualValue(project?.partner),
    scale: toBilingualValue(project?.scale),
    status: toBilingualValue(project?.status),
    image: project?.image ?? "",
  };
}

export function CooperationFormDialog({
  trigger,
  project,
}: CooperationFormDialogProps) {
  const isEdit = project !== undefined;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const createProject = useCreateCooperationProject();
  const updateProject = useUpdateCooperationProject();
  const updateStatus = useUpdateCooperationStatus();
  const schedulePublication = useScheduleCooperationPublication();

  // Dự án hợp tác mới có thể kết thúc ở nhiều đích khác nhau. Nội dung form
  // giống hệt nhau, chỉ khác **lệnh chạy sau khi tạo** — xem `runCreate`. Bản
  // mới của MỌI vai trò đều sinh ra ở `DRAFT` sạch (Batch 7), nên ADMIN và
  // SUPER_ADMIN có cùng bộ thao tác.
  const showSchedule = !isEdit && canScheduleRole(user?.role);
  // Lệnh trạng thái đi kèm nút phụ: ADMIN/SUPER_ADMIN "Đăng ngay" (→ PUBLISHED),
  // EDITOR "Gửi duyệt" (→ PENDING). Lấy từ ma trận dùng chung để nhãn và quyền
  // không bị chép lại lần nữa.
  const followUpAction = isEdit
    ? null
    : (contentStatusActions(user?.role, "DRAFT")[0] ?? null);

  // Giá trị form đã qua validate, chờ người dùng chọn mốc giờ ở hộp thoại lịch.
  // Có giá trị KHÔNG có nghĩa là đã tạo bản ghi — mới chỉ là "sẵn sàng tạo".
  const [pendingSchedule, setPendingSchedule] =
    useState<CooperationFormValues | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Cờ chạy chuỗi lệnh. `useState` để vẽ lại nút, `useRef` để chặn ngay trong
  // cùng một tick — hai cú click liên tiếp xảy ra trước khi React kịp render
  // lại, nút `disabled` một mình không cứu được.
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const form = useForm<CooperationFormValues>({
    resolver: zodResolver(cooperationSchema),
    defaultValues: toFormValues(project),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(project));
      setPendingSchedule(null);
      setScheduleError(null);
    }
  }, [open, project, form]);

  function toPayload(values: CooperationFormValues) {
    return {
      name: toBilingualPayload(values.name),
      location: toBilingualPayload(values.location),
      role: toBilingualPayload(values.role),
      partner: toBilingualPayload(values.partner),
      scale: toBilingualPayload(values.scale),
      // TIẾN ĐỘ dự án bằng chữ — không phải trạng thái xuất bản.
      status: toBilingualPayload(values.status),
      image: values.image || undefined,
      // KHÔNG có `contentStatus`, `scheduledAt`, `publishedAt` ở đây. Đăng/hẹn
      // giờ là lệnh xuất bản riêng, có phân quyền riêng — xem `runCreate`.
    };
  }

  function closeAll() {
    setPendingSchedule(null);
    setScheduleError(null);
    setOpen(false);
  }

  /**
   * Tạo bản ghi mới, rồi (tuỳ đích) chạy **một lệnh thứ hai** trên bản vừa tạo.
   *
   * Hai lệnh, không phải một: backend cố tình không nhận `scheduledAt` hay
   * `contentStatus` trong DTO nội dung.
   *
   * Định danh cho lệnh thứ hai LUÔN lấy từ response của bước tạo (`id` do
   * backend sinh) — không dựng lại, không đoán.
   *
   * Nếu bước hai hỏng: **bản ghi đã tồn tại rồi**. Không xoá, không tạo lại,
   * không giả vờ là tạo hỏng — đóng form (để không ai bấm tạo lần nữa thành
   * bản trùng) và nói thẳng rằng dự án đã lưu, việc còn thiếu làm lại được từ
   * danh sách.
   */
  async function runCreate(
    values: CooperationFormValues,
    outcome: "draft" | "status" | "schedule",
    scheduledAt?: string,
  ) {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    const title = values.name.vi;
    try {
      let created;
      try {
        created = await createProject.mutateAsync(toPayload(values));
      } catch (error) {
        // Tạo hỏng: KHÔNG chạy lệnh thứ hai, giữ nguyên dữ liệu đang gõ để sửa
        // rồi thử lại. Đóng hộp thoại lịch vì mốc giờ đã chọn không còn ngữ cảnh.
        setPendingSchedule(null);
        toast.error(
          resolveApiError(
            error,
            "Không tạo được dự án hợp tác. Vui lòng thử lại.",
          ),
        );
        return;
      }

      if (outcome === "schedule" && scheduledAt !== undefined) {
        try {
          await schedulePublication.mutateAsync({
            id: created.id,
            scheduledAt,
          });
          const when = formatVietnamSentence(scheduledAt);
          toast.success(
            when
              ? `Đã tạo dự án hợp tác "${title}" và hẹn đăng vào ${when}.`
              : `Đã tạo dự án hợp tác "${title}" và lên lịch đăng.`,
          );
        } catch (error) {
          toast.error(
            `Đã lưu dự án hợp tác "${title}" ở dạng nháp nhưng chưa đặt được lịch: ${resolveApiError(
              error,
              "không đặt được lịch đăng.",
            )} Hãy dùng nút "Lên lịch" ở danh sách Dự án hợp tác để đặt lại.`,
          );
        }
        closeAll();
        return;
      }

      if (outcome !== "status" || followUpAction === null) {
        toast.success(`Đã thêm dự án hợp tác "${title}".`);
        closeAll();
        return;
      }

      try {
        await updateStatus.mutateAsync({
          id: created.id,
          status: followUpAction.to,
        });
        toast.success(
          followUpAction.intent === "publish"
            ? `Đã tạo và đăng dự án hợp tác "${title}".`
            : `Đã tạo dự án hợp tác "${title}" và gửi duyệt.`,
        );
      } catch (error) {
        toast.error(
          `Đã lưu dự án hợp tác "${title}" ở dạng nháp nhưng chưa ${
            followUpAction.intent === "publish" ? "đăng" : "gửi duyệt"
          } được: ${resolveApiError(
            error,
            "không đổi được trạng thái.",
          )} Hãy thử lại từ danh sách Dự án hợp tác.`,
        );
      }
      closeAll();
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  async function onSubmit(values: CooperationFormValues) {
    if (!isEdit) {
      await runCreate(values, "draft");
      return;
    }
    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: toPayload(values),
      });
      toast.success("Đã lưu dự án hợp tác.");
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không lưu được dự án hợp tác. Vui lòng thử lại."),
      );
    }
  }

  const submitting = form.formState.isSubmitting || running;

  const formId = "cooperation-form";

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        // Đang chạy chuỗi tạo → không cho đóng: đóng giữa chừng thì người dùng
        // mất dấu bản vừa tạo và không biết lệnh thứ hai đã chạy hay chưa.
        onOpenChange={(next) => {
          if (running) return;
          setOpen(next);
        }}
        trigger={trigger}
        title={isEdit ? "Sửa dự án hợp tác" : "Thêm dự án hợp tác"}
        description={
          isEdit
            ? "Dự án đồng phát triển cùng đối tác (không có trang chi tiết)."
            : showSchedule
              ? "Dự án hợp tác mới luôn được lưu ở trạng thái Nháp và nằm cuối danh sách. Chọn Đăng ngay hoặc Đặt lịch nếu muốn đưa nó ra trang chủ."
              : "Dự án hợp tác mới nằm cuối danh sách và ở trạng thái Nháp, gửi duyệt sau khi hoàn thiện."
        }
        media={
          <MediaSection
            label="Ảnh chính"
            hint="Ảnh phối cảnh — không bắt buộc; không có thì thẻ dùng nền thương hiệu."
          >
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImagePickerField
                      value={field.value}
                      onChange={field.onChange}
                      folder="cooperation"
                      aspect="3/2"
                      alt="Ảnh phối cảnh dự án hợp tác"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </MediaSection>
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
                onClick={() => void form.handleSubmit((values) => runCreate(values, "status"))()}
              >
                <Send className="size-4" />
                {followUpAction.label}
              </Button>
            )}

            {/* Đặt lịch: validate form TRƯỚC rồi mới mở hộp thoại giờ — mở
                trước sẽ để người dùng chọn xong mốc giờ rồi mới báo thiếu tên. */}
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tên dự án</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{ vi: "Vista Verde", en: "Vista Verde" }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Địa điểm</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{ vi: "Quận 2, TP.HCM", en: "District 2, HCMC" }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="partner"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Đối tác</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{
                        vi: "CapitaLand (Singapore)",
                        en: "CapitaLand (Singapore)",
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vai trò của Thiên Đức</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{
                        vi: "Đồng chủ đầu tư",
                        en: "Co-investor",
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="scale"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Quy mô</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{
                        vi: "25.295 m² · 4 tòa tháp · 1.152 căn hộ",
                        en: "25,295 m² · 4 towers · 1,152 apartments",
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Diện tích, số tháp, số căn… ngăn cách bằng dấu “·”.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Trạng thái dự án</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{ vi: "Đã bàn giao", en: "Handed over" }}
                    />
                  </FormControl>
                  <FormDescription>
                    Mô tả tiến độ hiển thị trên thẻ, ví dụ “Đã bàn giao”.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

        </form>
      </SplitModal>

      {/* Dùng lại đúng hộp thoại của Tin tức/Dự án — cùng ràng buộc giờ Việt
          Nam, cùng hai ngưỡng 1 phút / 2 năm. Không dựng UI ngày giờ thứ hai. */}
      <SchedulePublishDialog
        open={pendingSchedule !== null}
        onOpenChange={(next) => {
          if (!next) {
            setPendingSchedule(null);
            setScheduleError(null);
          }
        }}
        contentTitle={pendingSchedule?.name.vi ?? ""}
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
