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
import {
  useCreateNews,
  useNewsCategories,
  useUpdateNews,
} from "@/lib/api/queries";
import { BilingualField } from "@/components/ui/BilingualField";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { useAuth } from "@/context/AuthContext";
import { canBypassApproval } from "@/lib/roles";
import { resolveApiError } from "@/lib/api-error-message";
import {
  toBilingualPayload,
  toBilingualValue,
  type BilingualValue,
} from "@/lib/bilingual";
import type { NewsPost } from "@/types";

/** Giá trị Select không nhận chuỗi rỗng, nên "không chuyên mục" cần một token. */
const NO_CATEGORY = "none";

/** Bản dịch tiếng Anh không bắt buộc ở form — xem `BilingualField`. */
const bilingual = (minVi: number, message: string) =>
  z.object({
    vi: z.string().trim().min(minVi, message),
    en: z.string().trim(),
  });

const newsSchema = z.object({
  title: bilingual(3, "Tiêu đề tối thiểu 3 ký tự."),
  slug: z
    .string()
    .trim()
    .min(3, "Slug tối thiểu 3 ký tự.")
    .regex(/^[a-z0-9-]+$/, "Chỉ gồm chữ thường, số và dấu gạch ngang."),
  summary: bilingual(10, "Tóm tắt tối thiểu 10 ký tự."),
  content: z.object({ vi: z.string(), en: z.string() }),
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
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function paragraphsToText(post: NewsPost | undefined, lang: "vi" | "en") {
  return (post?.content ?? [])
    .map((item) => item[lang] ?? "")
    .join("\n\n")
    .trim();
}

/**
 * Ghép đoạn VI với đoạn EN **theo vị trí**: đoạn 1 tiếng Việt đi với đoạn 1
 * tiếng Anh. Nếu hai bên lệch số đoạn, phần thiếu để trống thay vì bị cắt mất —
 * mất chữ âm thầm còn tệ hơn một đoạn trống nhìn thấy được.
 */
function toParagraphPayload(content: BilingualValue) {
  const vi = splitParagraphs(content.vi);
  const en = splitParagraphs(content.en);
  const length = Math.max(vi.length, en.length);

  return Array.from({ length }, (_, index) => ({
    vi: vi[index] ?? "",
    ...(en[index] && { en: en[index] }),
  }));
}

function toFormValues(post?: NewsPost): NewsFormValues {
  return {
    title: toBilingualValue(post?.title),
    slug: post?.slug ?? "",
    summary: toBilingualValue(post?.summary),
    content: {
      vi: paragraphsToText(post, "vi"),
      en: paragraphsToText(post, "en"),
    },
    categoryId: post?.categoryId ?? NO_CATEGORY,
    author: post?.author ?? "",
    image: post?.image ?? "",
    // `<input type="date">` chỉ nhận `YYYY-MM-DD`, backend trả ISO đầy đủ.
    eventDate: post?.eventDate?.slice(0, 10) ?? "",
  };
}

export function NewsFormDialog({ trigger, post }: NewsFormDialogProps) {
  const isEdit = post !== undefined;
  const { user } = useAuth();
  // SUPER_ADMIN bỏ qua luồng duyệt: backend đăng bài ngay khi tạo, nên đừng hứa
  // "lưu ở trạng thái nháp" gây hiểu là còn phải bấm duyệt.
  const bypassesApproval = canBypassApproval(user);
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
    const payload = {
      slug: values.slug,
      title: toBilingualPayload(values.title),
      summary: toBilingualPayload(values.summary),
      content: toParagraphPayload(values.content),
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
        toast.success(`Đã tạo bài "${values.title.vi}".`);
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

  const formId = "news-form";

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        size="split-lg"
        title={isEdit ? "Sửa bài viết" : "Viết tin mới"}
        description={
          isEdit
            ? "Cập nhật nội dung bài. Trạng thái đăng đổi ở bảng danh sách."
            : bypassesApproval
              ? "Bài mới được đăng ngay khi tạo — không cần chờ duyệt."
              : "Bài mới được lưu ở trạng thái nháp, gửi duyệt sau khi hoàn thiện."
        }
        media={
          <MediaSection
            label="Ảnh chính"
            hint="Ảnh đại diện bài viết — hiện ở thẻ tin và đầu bài."
          >
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImagePickerField
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      folder="news"
                      aspect="16/9"
                      alt="Ảnh chính bài viết"
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
              {isEdit ? "Lưu thay đổi" : "Tạo bài viết"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
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
                        vi: "Lễ khởi công Fancy Tower",
                        en: "Fancy Tower groundbreaking ceremony",
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
                    <BilingualField
                      multiline
                      rows={2}
                      value={field.value}
                      onChange={field.onChange}
                    />
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
                    <BilingualField
                      multiline
                      rows={8}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Cách nhau một dòng trống để tách đoạn. Bản tiếng Anh nên giữ
                    đúng số đoạn như tiếng Việt — hai bản ghép theo thứ tự đoạn.
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

        </form>
      </SplitModal>
    </Form>
  );
}
