import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useCreateProject, useUpdateProject } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { projectStatusLabel } from "@/lib/labels";
import type { Project, ProjectStatus } from "@/types";

// Schema kiểm tra dữ liệu bằng Zod (mục 2.5 — "Form: React Hook Form + Zod").
const projectSchema = z.object({
  title: z.string().trim().min(3, "Tên dự án tối thiểu 3 ký tự."),
  slug: z
    .string()
    .trim()
    .min(3, "Slug tối thiểu 3 ký tự.")
    .regex(/^[a-z0-9-]+$/, "Chỉ gồm chữ thường, số và dấu gạch ngang."),
  summary: z.string().trim().min(10, "Mô tả ngắn tối thiểu 10 ký tự."),
  location: z.string().trim(),
  category: z.string().trim(),
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
    title: project?.title.vi ?? "",
    slug: project?.slug ?? "",
    summary: project?.summary.vi ?? "",
    location: project?.location ?? "",
    category: project?.category ?? "",
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
    // Form chỉ nhập tiếng Việt — giữ nguyên bản dịch tiếng Anh đã có (nếu có).
    const payload = {
      slug: values.slug,
      title: { vi: values.title, ...(project?.title.en && { en: project.title.en }) },
      summary: {
        vi: values.summary,
        ...(project?.summary.en && { en: project.summary.en }),
      },
      status: values.status,
      // Chuỗi rỗng = không nhập; backend nhận `undefined` thay vì "".
      location: values.location || undefined,
      category: values.category || undefined,
    };

    try {
      if (isEdit) {
        await updateProject.mutateAsync({ slug: project.slug, data: payload });
        toast.success("Đã lưu thay đổi.");
      } else {
        await createProject.mutateAsync(payload);
        toast.success(`Đã tạo dự án "${values.title}".`);
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa dự án" : "Tạo dự án mới"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cập nhật thông tin cơ bản. Ảnh và hạng mục sửa ở modal chi tiết."
              : "Điền thông tin cơ bản. Có thể bổ sung hạng mục và ảnh sau khi tạo."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
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
                    <Input placeholder="Khu đô thị Hưng Phú" {...field} />
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
                    <Textarea
                      rows={3}
                      placeholder="Một hai câu giới thiệu dự án, hiện ở thẻ danh sách ngoài trang chủ."
                      {...field}
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
                  <FormLabel>Vị trí</FormLabel>
                  <FormControl>
                    <Input placeholder="TP. Thủ Đức, TP.HCM" {...field} />
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
                    <Input placeholder="Khu đô thị / Chung cư / Nhà phố" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitting}
              >
                Hủy
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {isEdit ? "Lưu thay đổi" : "Tạo dự án"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
