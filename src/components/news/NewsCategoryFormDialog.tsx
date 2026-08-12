import { useEffect, useRef, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";

import { categorySchema, type CategoryFormValues } from "./category-schema";
import { Button } from "@/components/ui/button";
import { BilingualField } from "@/components/ui/BilingualField";
import { Input } from "@/components/ui/input";
import { SplitModal } from "@/components/ui/SplitModal";
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
  useCreateNewsCategory,
  useUpdateNewsCategory,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import { slugify } from "@/lib/slugify";
import type { NewsCategory } from "@/types";

interface NewsCategoryFormDialogProps {
  trigger: ReactNode;
  /** Có `category` = chế độ sửa; không có = tạo mới. */
  category?: NewsCategory;
  /** Thứ tự gán cho chuyên mục mới — luôn nối vào cuối danh sách. */
  nextOrder?: number;
}

function toFormValues(category?: NewsCategory): CategoryFormValues {
  return {
    name: toBilingualValue(category?.name),
    slug: category?.slug ?? "",
  };
}

export function NewsCategoryFormDialog({
  trigger,
  category,
  nextOrder = 0,
}: NewsCategoryFormDialogProps) {
  const isEdit = category !== undefined;
  const [open, setOpen] = useState(false);
  const createCategory = useCreateNewsCategory();
  const updateCategory = useUpdateNewsCategory();

  /**
   * Người dùng đã tự gõ slug hay chưa.
   *
   * Trước khi chạm vào ô slug, slug bám theo tên tiếng Việt để biên tập viên
   * không phải tự chuyển "Tin dự án" → `tin-du-an`. Ngay khi họ sửa tay, việc
   * đồng bộ DỪNG hẳn — nếu không, gõ tiếp một chữ vào ô tên sẽ xoá mất slug họ
   * vừa soạn, mà slug thì khoá vĩnh viễn sau khi tạo.
   */
  const slugTouched = useRef(false);

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: toFormValues(category),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(category));
      // Chế độ sửa: slug đã cố định, không có gì để tự sinh.
      slugTouched.current = isEdit;
    }
  }, [open, category, isEdit, form]);

  async function onSubmit(values: CategoryFormValues) {
    try {
      if (isEdit) {
        // Cố ý KHÔNG gửi `slug`: backend từ chối 400 nếu có, vì slug là URL
        // công khai đã lập chỉ mục và bị khoá sau khi tạo.
        await updateCategory.mutateAsync({
          slug: category.slug,
          data: { name: toBilingualPayload(values.name) },
        });
        toast.success(`Đã lưu chuyên mục "${values.name.vi}".`);
      } else {
        await createCategory.mutateAsync({
          slug: values.slug,
          name: toBilingualPayload(values.name),
          order: nextOrder,
        });
        toast.success(`Đã thêm chuyên mục "${values.name.vi}".`);
      }
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không lưu được chuyên mục. Vui lòng thử lại."),
      );
    }
  }

  const submitting = form.formState.isSubmitting;
  const formId = "news-category-form";

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        size="default"
        title={isEdit ? "Sửa chuyên mục" : "Thêm chuyên mục"}
        description={
          isEdit
            ? "Đổi tên hiển thị. Slug (đường dẫn công khai) không đổi được."
            : "Chuyên mục mới nằm cuối danh sách. Slug sinh tự động từ tên tiếng Việt."
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
              {isEdit ? "Lưu" : "Thêm chuyên mục"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-5"
        >
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tên chuyên mục</FormLabel>
                <FormControl>
                  <BilingualField
                    value={field.value}
                    onChange={(value) => {
                      field.onChange(value);
                      if (!slugTouched.current) {
                        form.setValue("slug", slugify(value.vi), {
                          shouldValidate: form.formState.isSubmitted,
                        });
                      }
                    }}
                    placeholder={{ vi: "Tin dự án", en: "Project news" }}
                  />
                </FormControl>
                <FormDescription>
                  Tiếng Anh không bắt buộc — bỏ trống thì bản tiếng Anh của
                  website dùng lại tên tiếng Việt.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="slug"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Đường dẫn (slug)
                  {isEdit && (
                    <Lock className="ml-1.5 inline size-3.5 text-slate" />
                  )}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    readOnly={isEdit}
                    disabled={isEdit}
                    placeholder="tin-du-an"
                    onChange={(event) => {
                      slugTouched.current = true;
                      field.onChange(event);
                    }}
                  />
                </FormControl>
                <FormDescription>
                  {isEdit
                    ? "Slug quyết định URL công khai của chuyên mục và không đổi được sau khi tạo — đổi sẽ làm hỏng các liên kết đã chia sẻ và đã được Google lập chỉ mục."
                    : "Chỉ gồm chữ thường không dấu, số và dấu gạch ngang. Sau khi tạo sẽ KHÔNG đổi được, vì đây là URL công khai."}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </SplitModal>
    </Form>
  );
}
