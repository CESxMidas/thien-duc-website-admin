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
import { useCreatePage, useUpdatePage } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { toBilingualValue, type BilingualValue } from "@/lib/bilingual";
import type { StaticPage } from "@/types";

const pageSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(3, "Slug tối thiểu 3 ký tự.")
    .regex(/^[a-z0-9-]+$/, "Chỉ gồm chữ thường, số và dấu gạch ngang."),
  title: z.object({
    vi: z.string().trim().min(3, "Tiêu đề tối thiểu 3 ký tự."),
    en: z.string().trim(),
  }),
  content: z.object({
    vi: z.string().trim().min(1, "Cần ít nhất một đoạn nội dung."),
    en: z.string().trim(),
  }),
});

type PageFormValues = z.infer<typeof pageSchema>;

interface PageFormDialogProps {
  trigger: ReactNode;
  /** Có `page` = chế độ sửa; không có = tạo mới. */
  page?: StaticPage;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function paragraphsToText(page: StaticPage | undefined, lang: "vi" | "en") {
  return (page?.content ?? [])
    .map((item) => item[lang] ?? "")
    .join("\n\n")
    .trim();
}

/** Ghép đoạn VI–EN theo vị trí; lệch số đoạn thì để trống chứ không cắt bớt. */
function toParagraphPayload(content: BilingualValue) {
  const vi = splitParagraphs(content.vi);
  const en = splitParagraphs(content.en);
  const length = Math.max(vi.length, en.length);

  return Array.from({ length }, (_, index) => ({
    vi: vi[index] ?? "",
    ...(en[index] && { en: en[index] }),
  }));
}

function toFormValues(page?: StaticPage): PageFormValues {
  return {
    slug: page?.slug ?? "",
    title: toBilingualValue(page?.title),
    content: {
      vi: paragraphsToText(page, "vi"),
      en: paragraphsToText(page, "en"),
    },
  };
}

export function PageFormDialog({ trigger, page }: PageFormDialogProps) {
  const isEdit = page !== undefined;
  const [open, setOpen] = useState(false);
  const createPage = useCreatePage();
  const updatePage = useUpdatePage();

  const form = useForm<PageFormValues>({
    resolver: zodResolver(pageSchema),
    defaultValues: toFormValues(page),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(page));
  }, [open, page, form]);

  async function onSubmit(values: PageFormValues) {
    const payload = {
      slug: values.slug,
      title: {
        vi: values.title.vi,
        ...(values.title.en && { en: values.title.en }),
      },
      content: toParagraphPayload(values.content),
    };

    try {
      if (isEdit) {
        await updatePage.mutateAsync({ slug: page.slug, data: payload });
        toast.success("Đã lưu trang.");
      } else {
        await createPage.mutateAsync(payload);
        toast.success(`Đã tạo trang "${values.title.vi}".`);
      }
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không lưu được trang. Vui lòng thử lại."),
      );
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa trang" : "Tạo trang nội dung"}</DialogTitle>
          <DialogDescription>
            Trang mới lưu ở trạng thái nháp — website công khai chỉ hiển thị
            trang đã đăng.
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
                {isEdit ? "Lưu thay đổi" : "Tạo trang"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
