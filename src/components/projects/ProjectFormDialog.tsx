import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { projectSchema, type ProjectFormValues } from "./project-schema";
import { toast } from "sonner";
import { CalendarClock, Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BilingualField } from "@/components/ui/BilingualField";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import {
  useCreateProject,
  useScheduleProjectPublication,
  useUpdateProject,
  useUpdateProjectStatus,
} from "@/lib/api/queries";
import { SchedulePublishDialog } from "@/components/content/SchedulePublishDialog";
import { useAuth } from "@/context/AuthContext";
import { resolveApiError } from "@/lib/api-error-message";
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import { contentStatusActions } from "@/lib/content-status-actions";
import { projectStatusLabel } from "@/lib/labels";
import { canScheduleRole } from "@/lib/news-schedule";
import { formatVietnamSentence } from "@/lib/vietnam-time";
import type { Project, ProjectStatus } from "@/types";

/**
 * Bản dịch tiếng Anh **không bắt buộc ở form**: biên tập viên thường nhập tiếng
 * Việt trước rồi bổ sung sau. Song ngữ là điều kiện go-live (câu 19) nên chỗ
 * thiếu được đánh dấu bằng chấm vàng trong `BilingualField`, không chặn lưu.
 */
// Schema kiểm tra dữ liệu bằng Zod (mục 2.5 — "Form: React Hook Form + Zod").

const statusOptions = Object.keys(projectStatusLabel) as ProjectStatus[];

interface ProjectFormDialogProps {
  trigger: ReactNode;
  /** Có `project` = chế độ sửa; không có = tạo mới. */
  project?: Project;
}

function toFormValues(project?: Project): ProjectFormValues {
  return {
    title: toBilingualValue(project?.title),
    slug: project?.slug ?? "",
    summary: toBilingualValue(project?.summary),
    location: toBilingualValue(project?.location),
    category: toBilingualValue(project?.category),
    image: project?.image ?? "",
    status: project?.status ?? "CHUAN_BI_KHOI_CONG",
  };
}

export function ProjectFormDialog({ trigger, project }: ProjectFormDialogProps) {
  const isEdit = project !== undefined;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const updateStatus = useUpdateProjectStatus();
  const schedulePublication = useScheduleProjectPublication();

  // Dự án mới có thể kết thúc ở nhiều đích khác nhau. Nội dung form giống hệt
  // nhau, chỉ khác **lệnh chạy sau khi tạo** — xem `runCreate`. Dự án mới của
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
  // Có giá trị KHÔNG có nghĩa là đã tạo dự án — mới chỉ là "sẵn sàng tạo".
  const [pendingSchedule, setPendingSchedule] =
    useState<ProjectFormValues | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Cờ chạy chuỗi lệnh. `useState` để vẽ lại nút, `useRef` để chặn ngay trong
  // cùng một tick — hai cú click liên tiếp xảy ra trước khi React kịp render
  // lại, nút `disabled` một mình không cứu được.
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: toFormValues(project),
  });

  // Mở lại dialog phải thấy dữ liệu mới nhất của dự án đang sửa.
  useEffect(() => {
    if (open) {
      form.reset(toFormValues(project));
      setPendingSchedule(null);
      setScheduleError(null);
    }
  }, [open, project, form]);

  function toPayload(values: ProjectFormValues) {
    return {
      slug: values.slug,
      title: toBilingualPayload(values.title),
      summary: toBilingualPayload(values.summary),
      // TÌNH TRẠNG THI CÔNG — không phải trạng thái xuất bản.
      status: values.status,
      // Trống (VI rỗng) = không nhập; gửi `undefined` thay vì object rỗng. Gửi
      // cả vi + en để giữ nguyên bản tiếng Việt khi biên tập viên thêm EN.
      location: values.location.vi.trim()
        ? toBilingualPayload(values.location)
        : undefined,
      category: values.category.vi.trim()
        ? toBilingualPayload(values.category)
        : undefined,
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
   * Tạo dự án mới, rồi (tuỳ đích) chạy **một lệnh thứ hai** trên dự án vừa tạo.
   *
   * Hai lệnh, không phải một: backend cố tình không nhận `scheduledAt` hay
   * `contentStatus` trong DTO nội dung.
   *
   * Slug dùng cho lệnh thứ hai LUÔN lấy từ response của bước tạo: backend có
   * thể chuẩn hoá slug, nên slug trong form chỉ là đề nghị.
   *
   * Nếu bước hai hỏng: **dự án đã tồn tại rồi**. Không xoá, không tạo lại,
   * không giả vờ là tạo hỏng — đóng form (để không ai bấm tạo lần nữa thành dự
   * án trùng) và nói thẳng ra rằng dự án đã lưu, việc còn thiếu làm lại được từ
   * danh sách.
   */
  async function runCreate(
    values: ProjectFormValues,
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
        created = await createProject.mutateAsync(toPayload(values));
      } catch (error) {
        // Tạo hỏng: KHÔNG chạy lệnh thứ hai, giữ nguyên dữ liệu đang gõ để sửa
        // rồi thử lại. Đóng hộp thoại lịch vì mốc giờ đã chọn không còn ngữ cảnh.
        setPendingSchedule(null);
        toast.error(
          resolveApiError(error, "Không tạo được dự án. Vui lòng thử lại."),
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
              ? `Đã tạo dự án "${title}" và hẹn đăng vào ${when}.`
              : `Đã tạo dự án "${title}" và lên lịch đăng.`,
          );
        } catch (error) {
          toast.error(
            `Đã lưu dự án "${title}" ở dạng nháp nhưng chưa đặt được lịch: ${resolveApiError(
              error,
              "không đặt được lịch đăng.",
            )} Hãy dùng nút "Lên lịch" ở danh sách Dự án để đặt lại.`,
          );
        }
        closeAll();
        return;
      }

      if (outcome !== "status" || followUpAction === null) {
        toast.success(`Đã tạo dự án "${title}".`);
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
            ? `Đã tạo và đăng dự án "${title}".`
            : `Đã tạo dự án "${title}" và gửi duyệt.`,
        );
      } catch (error) {
        toast.error(
          `Đã lưu dự án "${title}" ở dạng nháp nhưng chưa ${
            followUpAction.intent === "publish" ? "đăng" : "gửi duyệt"
          } được: ${resolveApiError(
            error,
            "không đổi được trạng thái.",
          )} Hãy thử lại từ danh sách Dự án.`,
        );
      }
      closeAll();
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  async function onSubmit(values: ProjectFormValues) {
    if (!isEdit) {
      await runCreate(values, "draft");
      return;
    }
    try {
      await updateProject.mutateAsync({
        slug: project.slug,
        data: toPayload(values),
      });
      toast.success("Đã lưu thay đổi.");
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không lưu được thay đổi. Vui lòng thử lại."),
      );
    }
  }

  const submitting = form.formState.isSubmitting || running;

  const formId = "project-basic-form";

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        // Đang chạy chuỗi tạo → không cho đóng: đóng giữa chừng thì người dùng
        // mất dấu dự án vừa tạo và không biết lệnh thứ hai đã chạy hay chưa.
        onOpenChange={(next) => {
          if (running) return;
          setOpen(next);
        }}
        trigger={trigger}
        title={isEdit ? "Sửa dự án" : "Tạo dự án mới"}
        description={
          isEdit
            ? "Thông tin cơ bản và ảnh chính. Thư viện ảnh con, hạng mục và nội dung chi tiết sửa ở modal chi tiết."
            : showSchedule
              ? "Dự án mới luôn được lưu ở dạng nháp. Chọn Đăng ngay hoặc Đặt lịch nếu muốn đưa dự án ra website. Ảnh con, hạng mục và nội dung bổ sung sau khi tạo."
              : "Dự án mới được lưu ở trạng thái nháp, gửi duyệt sau khi hoàn thiện. Ảnh con, hạng mục và nội dung bổ sung sau khi tạo."
        }
        media={
          <MediaSection
            label="Ảnh chính"
            hint="Ảnh đại diện dự án — hiện ở thẻ danh sách và đầu trang chi tiết."
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
                      folder="projects"
                      aspect="3/2"
                      alt="Ảnh chính dự án"
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
            {/* Đặt lịch KHÔNG tạo dự án ngay: nó chỉ validate nội dung rồi mở
                hộp thoại chọn giờ. Dự án chỉ ra đời khi bấm xác nhận ở đó. */}
            {showSchedule && (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={form.handleSubmit((values) => {
                  setScheduleError(null);
                  setPendingSchedule(values);
                })}
              >
                <CalendarClock className="size-4" />
                Đặt lịch
              </Button>
            )}
            {followUpAction && (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={form.handleSubmit((values) =>
                  runCreate(values, "status"),
                )}
              >
                <Send className="size-4" />
                {followUpAction.label}
              </Button>
            )}
            <Button type="submit" form={formId} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {/* Đứng cạnh "Đăng ngay" / "Đặt lịch", nút chính phải nói rõ nó
                  khác gì: "Tạo dự án" không cho biết dự án sẽ nằm ở trạng thái
                  nào, "Lưu nháp" thì có. */}
              {isEdit ? "Lưu thay đổi" : "Lưu nháp"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên dự án</FormLabel>
                <FormControl>
                  <BilingualField
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={{
                      vi: "Khu đô thị Hưng Phú",
                      en: "Hung Phu Urban Area",
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Slug (đường dẫn)</FormLabel>
                <FormControl>
                  <Input placeholder="khu-do-thi-hung-phu" {...field} />
                </FormControl>
                {isEdit && (
                  <FormDescription>
                    Đổi slug sẽ làm hỏng các liên kết cũ tới dự án này.
                  </FormDescription>
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
                    rows={3}
                    value={field.value}
                    onChange={field.onChange}
                    placeholder={{
                      vi: "Một hai câu giới thiệu dự án, hiện ở thẻ danh sách ngoài trang chủ.",
                      en: "One or two sentences shown on the project card.",
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vị trí</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{ vi: "Bến Tre", en: "Ben Tre" }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phân loại</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{ vi: "Khu đô thị", en: "Urban Area" }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tình trạng</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {projectStatusLabel[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </SplitModal>

      {/* Dùng lại đúng hộp thoại của Tin tức — cùng ràng buộc giờ Việt Nam, cùng
          hai ngưỡng 1 phút / 2 năm. Không dựng UI ngày giờ thứ hai. */}
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
