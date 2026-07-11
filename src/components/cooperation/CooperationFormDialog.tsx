import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BilingualField } from "@/components/ui/BilingualField";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
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
  useCreateCooperationProject,
  useUpdateCooperationProject,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import type { CooperationProject } from "@/types";

const requiredBilingual = (min: number, message: string) =>
  z.object({
    vi: z.string().trim().min(min, message),
    en: z.string().trim(),
  });

const cooperationSchema = z.object({
  name: requiredBilingual(2, "Cần tên dự án hợp tác."),
  location: requiredBilingual(1, "Cần địa điểm."),
  role: requiredBilingual(1, "Cần vai trò của Thiên Đức."),
  partner: requiredBilingual(1, "Cần tên đối tác."),
  scale: requiredBilingual(1, "Cần thông tin quy mô."),
  status: requiredBilingual(1, "Cần trạng thái dự án."),
  image: z.string().trim(),
});

type CooperationFormValues = z.infer<typeof cooperationSchema>;

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
  const [open, setOpen] = useState(false);
  const createProject = useCreateCooperationProject();
  const updateProject = useUpdateCooperationProject();

  const form = useForm<CooperationFormValues>({
    resolver: zodResolver(cooperationSchema),
    defaultValues: toFormValues(project),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(project));
  }, [open, project, form]);

  async function onSubmit(values: CooperationFormValues) {
    const payload = {
      name: toBilingualPayload(values.name),
      location: toBilingualPayload(values.location),
      role: toBilingualPayload(values.role),
      partner: toBilingualPayload(values.partner),
      scale: toBilingualPayload(values.scale),
      status: toBilingualPayload(values.status),
      image: values.image || undefined,
    };

    try {
      if (isEdit) {
        await updateProject.mutateAsync({ id: project.id, data: payload });
        toast.success("Đã lưu dự án hợp tác.");
      } else {
        await createProject.mutateAsync(payload);
        toast.success(`Đã thêm dự án hợp tác "${values.name.vi}".`);
      }
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không lưu được dự án hợp tác. Vui lòng thử lại."),
      );
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Sửa dự án hợp tác" : "Thêm dự án hợp tác"}
          </DialogTitle>
          <DialogDescription>
            Dự án đồng phát triển cùng đối tác (không có trang chi tiết). Dự án
            mới nằm cuối danh sách và ở trạng thái Nháp cho tới khi được đăng.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-4"
            noValidate
          >
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

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ảnh phối cảnh</FormLabel>
                  <FormControl>
                    <ImagePickerField
                      value={field.value}
                      onChange={field.onChange}
                      folder="cooperation"
                      aspect="3/2"
                      alt="Ảnh phối cảnh dự án hợp tác"
                    />
                  </FormControl>
                  <FormDescription>
                    Không bắt buộc — không có ảnh thì thẻ dùng nền thương hiệu.
                  </FormDescription>
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
                {isEdit ? "Lưu thay đổi" : "Thêm dự án hợp tác"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
