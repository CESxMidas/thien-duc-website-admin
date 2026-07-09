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
import {
  useCreateNews,
  useNewsCategories,
  useUpdateNews,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import type { NewsPost } from "@/types";

/** Giá trị Select không nhận chuỗi rỗng, nên "không chuyên mục" cần một token. */
const NO_CATEGORY = "none";

const newsSchema = z.object({
  title: z.string().trim().min(3, "Tiêu đề tối thiểu 3 ký tự."),
  slug: z
    .string()
    .trim()
    .min(3, "Slug tối thiểu 3 ký tự.")
    .regex(/^[a-z0-9-]+$/, "Chỉ gồm chữ thường, số và dấu gạch ngang."),
  summary: z.string().trim().min(10, "Tóm tắt tối thiểu 10 ký tự."),
  content: z.string().trim(),
  categoryId: z.string(),
  author: z.string().trim(),
  image: z.string().trim(),
  eventDate: z.string().trim(),
});

type NewsFormValues = z.infer<typeof newsSchema>;

interface NewsFormDialogProps {
  trigger: ReactNode;
  /** Có `post` = chế độ sửa; không có = viết bài mới. */
  post?: NewsPost;
}

/** Mảng đoạn văn ↔ textarea: mỗi đoạn cách nhau một dòng trống. */
function paragraphsToText(post?: NewsPost): string {
  return (post?.content ?? []).map((item) => item.vi).join("\n\n");
}

function textToParagraphs(text: string) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => ({ vi: paragraph }));
}

function toFormValues(post?: NewsPost): NewsFormValues {
  return {
    title: post?.title.vi ?? "",
    slug: post?.slug ?? "",
    summary: post?.summary.vi ?? "",
    content: paragraphsToText(post),
    categoryId: post?.categoryId ?? NO_CATEGORY,
    author: post?.author ?? "",
    image: post?.image ?? "",
    // `<input type="date">` chỉ nhận `YYYY-MM-DD`, backend trả ISO đầy đủ.
    eventDate: post?.eventDate?.slice(0, 10) ?? "",
  };
}

export function NewsFormDialog({ trigger, post }: NewsFormDialogProps) {
  const isEdit = post !== undefined;
  const [open, setOpen] = useState(false);
  const createNews = useCreateNews();
  const updateNews = useUpdateNews();
  const { data: categories = [] } = useNewsCategories();

  const form = useForm<NewsFormValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: toFormValues(post),
  });

  useEffect(() => {
    if (open) form.reset(toFormValues(post));
  }, [open, post, form]);

  async function onSubmit(values: NewsFormValues) {
    // Form chỉ nhập tiếng Việt — giữ nguyên bản dịch tiếng Anh đã có (nếu có).
    const payload = {
      slug: values.slug,
      title: { vi: values.title, ...(post?.title.en && { en: post.title.en }) },
      summary: {
        vi: values.summary,
        ...(post?.summary.en && { en: post.summary.en }),
      },
      content: textToParagraphs(values.content),
      // Chuỗi rỗng = không nhập; backend nhận `undefined` thay vì "".
      categoryId:
        values.categoryId === NO_CATEGORY ? undefined : values.categoryId,
      author: values.author || undefined,
      image: values.image || undefined,
      eventDate: values.eventDate || undefined,
    };

    try {
      if (isEdit) {
        await updateNews.mutateAsync({ slug: post.slug, data: payload });
        toast.success("Đã lưu thay đổi.");
      } else {
        await createNews.mutateAsync(payload);
        toast.success(`Đã tạo bài "${values.title}".`);
      }
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(
          error,
          isEdit
            ? "Không lưu được thay đổi. Vui lòng thử lại."
            : "Không tạo được bài viết. Vui lòng thử lại.",
        ),
      );
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Sửa bài viết" : "Viết tin mới"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Cập nhật nội dung bài. Trạng thái đăng đổi ở bảng danh sách."
              : "Bài mới được lưu ở trạng thái nháp, gửi duyệt sau khi hoàn thiện."}
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
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tiêu đề</FormLabel>
                  <FormControl>
                    <Input placeholder="Lễ khởi công Fancy Tower" {...field} />
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
                  <FormLabel>Đường dẫn</FormLabel>
                  <FormControl>
                    <Input placeholder="le-khoi-cong-fancy-tower" {...field} />
                  </FormControl>
                  <FormDescription>
                    Bài đã đăng thì đổi đường dẫn sẽ làm hỏng link cũ.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tóm tắt</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormDescription>
                    Hiển thị ở thẻ tin ngoài trang danh sách.
                  </FormDescription>
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
                    <Textarea rows={8} {...field} />
                  </FormControl>
                  <FormDescription>
                    Cách nhau một dòng trống để tách đoạn.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chuyên mục</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_CATEGORY}>Chưa phân loại</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name.vi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ảnh đại diện</FormLabel>
                  <FormControl>
                    <Input placeholder="https://res.cloudinary.com/..." {...field} />
                  </FormControl>
                  <FormDescription>
                    Dán đường dẫn ảnh từ Thư viện ảnh.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="author"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nguồn</FormLabel>
                    <FormControl>
                      <Input placeholder="Thiên Đức" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ngày sự kiện</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                {isEdit ? "Lưu thay đổi" : "Tạo bài viết"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
