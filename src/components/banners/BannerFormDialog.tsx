import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BilingualField } from "@/components/ui/BilingualField";
import { Input } from "@/components/ui/input";
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
import { useCreateBanner, useUpdateBanner } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import type { Banner } from "@/types";

const optionalBilingual = z.object({
  vi: z.string().trim(),
  en: z.string().trim(),
});

const bannerSchema = z.object({
  image: z.string().trim().min(1, "Cần URL ảnh banner."),
  href: z
    .string()
    .trim()
    .min(1, "Cần đường dẫn đích.")
    .startsWith("/", "Đường dẫn nội bộ, bắt đầu bằng “/”."),
  title: z.object({
    vi: z.string().trim().min(3, "Tiêu đề tối thiểu 3 ký tự."),
    en: z.string().trim(),
  }),
  eyebrow: optionalBilingual,
  subtitle: optionalBilingual,
  ctaLabel: optionalBilingual,
  objectPosition: z.string().trim(),
});

type BannerFormValues = z.infer<typeof bannerSchema>;

interface BannerFormDialogProps {
  trigger: ReactNode;
  /** Có `banner` = chế độ sửa; không có = tạo mới. */
  banner?: Banner;
}

function toFormValues(banner?: Banner): BannerFormValues {
  return {
    image: banner?.image ?? "",
    href: banner?.href ?? "/du-an",
    title: toBilingualValue(banner?.title),
    eyebrow: toBilingualValue(banner?.eyebrow),
    subtitle: toBilingualValue(banner?.subtitle),
    ctaLabel: toBilingualValue(banner?.ctaLabel),
    objectPosition: banner?.objectPosition ?? "",
  };
}

/** Field tùy chọn: bỏ hẳn khỏi payload khi tiếng Việt trống. */
function optionalPayload(value: BannerFormValues["eyebrow"]) {
  const payload = toBilingualPayload(value);
  return payload.vi ? payload : undefined;
}

export function BannerFormDialog({ trigger, banner }: BannerFormDialogProps) {
  const isEdit = banner !== undefined;
  const [open, setOpen] = useState(false);
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();

  const form = useForm<BannerFormValues>({
    resolver: zodResolver(bannerSchema),
    defaultValues: toFormValues(banner),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(banner));
  }, [open, banner, form]);

  async function onSubmit(values: BannerFormValues) {
    const payload = {
      image: values.image,
      href: values.href,
      title: toBilingualPayload(values.title),
      eyebrow: optionalPayload(values.eyebrow),
      subtitle: optionalPayload(values.subtitle),
      ctaLabel: optionalPayload(values.ctaLabel),
      objectPosition: values.objectPosition || undefined,
    };

    try {
      if (isEdit) {
        await updateBanner.mutateAsync({ id: banner.id, data: payload });
        toast.success("Đã lưu banner.");
      } else {
        await createBanner.mutateAsync(payload);
        toast.success(`Đã thêm banner "${values.title.vi}".`);
      }
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không lưu được banner. Vui lòng thử lại."),
      );
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa banner" : "Thêm banner"}</DialogTitle>
          <DialogDescription>
            Banner mới nằm cuối danh sách. Thứ tự và bật/tắt chỉnh ở bảng.
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
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ảnh banner (URL)</FormLabel>
                  <FormControl>
                    <Input placeholder="https://res.cloudinary.com/..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Tải ảnh ở trang Thư viện ảnh rồi dán URL vào đây.
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
              name="eyebrow"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nhãn nhỏ phía trên</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{
                        vi: "Dự án tiêu biểu",
                        en: "Featured project",
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subtitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mô tả</FormLabel>
                  <FormControl>
                    <BilingualField
                      multiline
                      rows={2}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="ctaLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nhãn nút</FormLabel>
                  <FormControl>
                    <BilingualField
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{ vi: "Xem dự án", en: "View project" }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="href"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nút dẫn tới</FormLabel>
                  <FormControl>
                    <Input placeholder="/du-an/khu-do-thi-hung-phu" {...field} />
                  </FormControl>
                  <FormDescription>
                    Đường dẫn tiếng Việt, không kèm “/vi”. Trang tiếng Anh tự
                    thêm tiền tố “/en”.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="objectPosition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Canh khung ảnh</FormLabel>
                  <FormControl>
                    <Input placeholder="center center" {...field} />
                  </FormControl>
                  <FormDescription>
                    Giá trị CSS `object-position`, ví dụ “center 55%”. Để trống
                    là canh giữa.
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
                {isEdit ? "Lưu thay đổi" : "Thêm banner"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
