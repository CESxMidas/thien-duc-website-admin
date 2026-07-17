import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
import { useCreateProject, useUpdateProject } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import { projectStatusLabel } from "@/lib/labels";
import type { Project, ProjectStatus } from "@/types";

/**
 * Bản dịch tiếng Anh **không bắt buộc ở form**: biên tập viên thường nhập tiếng
 * Việt trước rồi bổ sung sau. Song ngữ là điều kiện go-live (câu 19) nên chỗ
 * thiếu được đánh dấu bằng chấm vàng trong `BilingualField`, không chặn lưu.
 */
const bilingual = (minVi: number, message: string) =>
  z.object({
    vi: z.string().trim().min(minVi, message),
    en: z.string().trim(),
  });

/** Song ngữ không bắt buộc (location/category) — VI có thể để trống. */
const optionalBilingual = z.object({
  vi: z.string().trim(),
  en: z.string().trim(),
});

// Schema kiểm tra dữ liệu bằng Zod (mục 2.5 — "Form: React Hook Form + Zod").
const projectSchema = z.object({
  title: bilingual(3, "Tên dự án tối thiểu 3 ký tự."),
  slug: z
    .string()
    .trim()
    .min(3, "Slug tối thiểu 3 ký tự.")
    .regex(/^[a-z0-9-]+$/, "Chỉ gồm chữ thường, số và dấu gạch ngang."),
  summary: bilingual(10, "Mô tả ngắn tối thiểu 10 ký tự."),
  location: optionalBilingual,
  category: optionalBilingual,
  // Ảnh đại diện (thẻ danh sách + hero trang chi tiết). Không bắt buộc nhưng
  // thiếu thì trang công khai hiện ô trống — nên khuyến khích nhập.
  image: z.string().trim(),
  status: z.enum(["DA_BAN_GIAO", "DANG_THI_CONG", "CHUAN_BI_KHOI_CONG"]),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

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
  const [open, setOpen] = useState(false);
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: toFormValues(project),
  });

  // Mở lại dialog phải thấy dữ liệu mới nhất của dự án đang sửa.
  useEffect(() => {
    if (open) form.reset(toFormValues(project));
  }, [open, project, form]);

  async function onSubmit(values: ProjectFormValues) {
    const payload = {
      slug: values.slug,
      title: toBilingualPayload(values.title),
      summary: toBilingualPayload(values.summary),
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
    };

    try {
      if (isEdit) {
        await updateProject.mutateAsync({ slug: project.slug, data: payload });
        toast.success("Đã lưu thay đổi.");
      } else {
        await createProject.mutateAsync(payload);
        toast.success(`Đã tạo dự án "${values.title.vi}".`);
      }
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(
          error,
          isEdit
            ? "Không lưu được thay đổi. Vui lòng thử lại."
            : "Không tạo được dự án. Vui lòng thử lại.",
        ),
      );
    }
  }

  const submitting = form.formState.isSubmitting;

  const formId = "project-basic-form";

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        title={isEdit ? "Sửa dự án" : "Tạo dự án mới"}
        description={
          isEdit
            ? "Thông tin cơ bản và ảnh chính. Thư viện ảnh con, hạng mục và nội dung chi tiết sửa ở modal chi tiết."
            : "Điền thông tin cơ bản và chọn ảnh chính. Ảnh con, hạng mục và nội dung bổ sung sau khi tạo."
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
            <Button type="submit" form={formId} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Lưu thay đổi" : "Tạo dự án"}
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
    </Form>
  );
}
