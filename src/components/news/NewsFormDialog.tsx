import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newsSchema, type NewsFormValues } from "./news-schema";
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
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import {
  paragraphsToText,
  toParagraphPayload,
} from "@/lib/long-form-content";
import type { NewsPost } from "@/types";

/** Giá trị Select không nhận chuỗi rỗng, nên "không chuyên mục" cần một token. */

interface NewsFormDialogProps {
  trigger: ReactNode;
  /** Có `post` = chế độ sửa; không có = viết bài mới. */
  post?: NewsPost;
}

function toFormValues(post?: NewsPost): NewsFormValues {
  return {
    title: toBilingualValue(post?.title),
    slug: post?.slug ?? "",
    summary: toBilingualValue(post?.summary),
    content: {
      vi: paragraphsToText(post?.content, "vi"),
      en: paragraphsToText(post?.content, "en"),
    },
    // Bài cũ chưa phân loại nạp vào là chuỗi rỗng: form mở bình thường,
    // nhưng schema buộc chọn chuyên mục trước khi lưu.
    categoryId: post?.categoryId ?? "",
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
  const hasCategories = categories.length > 0;

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
      categoryId: values.categoryId,
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
                  {/* Cố ý KHÔNG có mục "Chưa phân loại": bài không chuyên mục
                      không xuất hiện ở trang danh mục nào cả. Cũng KHÔNG cho
                      tạo chuyên mục ngay tại đây — việc đó vượt qua phân quyền
                      (EDITOR sẽ tạo được chuyên mục mà không nhìn thấy toàn
                      cảnh) và tạo đồng bộ trạng thái giữa hai form. */}
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!hasCategories}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn chuyên mục" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name.vi}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasCategories ? null : (
                    <FormDescription>
                      Chưa có chuyên mục nào.{" "}
                      <Link
                        to="/tin-tuc/chuyen-muc"
                        className="font-medium text-brand underline underline-offset-2"
                      >
                        Tạo chuyên mục
                      </Link>{" "}
                      trước khi viết bài.
                    </FormDescription>
                  )}
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
