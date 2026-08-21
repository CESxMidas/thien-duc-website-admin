import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bannerSchema, type BannerFormValues } from "./banner-schema";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BilingualField } from "@/components/ui/BilingualField";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
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
import { useCreateBanner, useUpdateBanner } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import {
  toDisplayWindowFields,
  validateDisplayWindowFields,
} from "@/lib/banner-display-window";
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import { VIETNAM_TIMEZONE_LABEL } from "@/lib/vietnam-time";
import type { Banner } from "@/types";

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
    // Cửa sổ đang lưu (UTC) nạp lên thành GIỜ VIỆT NAM. Banner mới thì bốn ô
    // rỗng — nghĩa là "hiện ngay, không hạn", đúng hành vi trước Batch 12.
    ...toDisplayWindowFields({
      displayFrom: banner?.displayFrom ?? null,
      displayUntil: banner?.displayUntil ?? null,
    }),
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
    // Schema đã chạy đúng hàm này nên nhánh lỗi ở đây trên thực tế không tới —
    // nhưng nó là thứ thu hẹp kiểu, và là lưới an toàn nếu ai đó tháo
    // `superRefine` ra khỏi schema.
    const window = validateDisplayWindowFields(values);
    if (!window.ok) {
      form.setError(window.field, { message: window.message });
      return;
    }

    const payload = {
      image: values.image,
      href: values.href,
      title: toBilingualPayload(values.title),
      eyebrow: optionalPayload(values.eyebrow),
      subtitle: optionalPayload(values.subtitle),
      ctaLabel: optionalPayload(values.ctaLabel),
      objectPosition: values.objectPosition || undefined,
      // GỬI `null` TƯỜNG MINH, không phải `undefined`: đó là cách duy nhất nói
      // với backend "xoá biên này". Bỏ field đi có nghĩa "giữ nguyên", nên xoá
      // cửa sổ ở form sẽ im lặng không có tác dụng.
      displayFrom: window.window.displayFrom,
      displayUntil: window.window.displayUntil,
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

  const formId = "banner-form";

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        title={isEdit ? "Sửa banner" : "Thêm banner"}
        description="Banner mới nằm cuối danh sách. Thứ tự và bật/tắt chỉnh ở bảng."
        media={
          <MediaSection
            label="Ảnh chính"
            hint="Ảnh nền banner — tự tối ưu WebP, tối đa 1200px."
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
                      folder="banners"
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
              {isEdit ? "Lưu thay đổi" : "Thêm banner"}
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

            {/*
              THỜI GIAN HIỂN THỊ — cố ý KHÔNG gọi là "Lên lịch xuất bản".
              Banner không có luồng duyệt và không có trạng thái xuất bản; đây
              chỉ là khoảng thời gian banner được phép xuất hiện. Dùng từ vựng
              của luồng đăng bài sẽ khiến biên tập viên đi tìm nút "Đăng ngay"
              không tồn tại.

              Bốn ô native `date`/`time` thay cho `datetime-local`: giá trị của
              `datetime-local` không mang múi giờ nên mọi phép quy đổi tại chỗ
              đều đi qua múi giờ MÁY. Tự ghép thì chuỗi gửi đi luôn `...+07:00`.

              Nhãn dùng <FormLabel> của shadcn — nó tự nối `htmlFor` với `id`
              của ô nhập, nên KHÔNG thêm `aria-label` (thêm vào sẽ ghi đè mất
              chính cái tên vừa gắn đúng).
            */}
            <fieldset className="grid gap-3 rounded-lg border border-line p-4">
              <legend className="px-1 text-sm font-medium text-ink">
                Thời gian hiển thị
              </legend>
              <p className="text-xs text-slate">
                Quyết định banner được phép xuất hiện trong khoảng nào. Khác với
                công tắc “Đang bật/tắt” ở bảng: banner phải VỪA đang bật VỪA nằm
                trong khoảng này thì mới ra trang chủ. Giờ nhập theo{" "}
                {VIETNAM_TIMEZONE_LABEL}.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fromDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hiển thị từ — ngày</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fromTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hiển thị từ — giờ</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-slate">
                Bỏ trống: banner có hiệu lực ngay.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="untilDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hiển thị đến — ngày</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="untilTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hiển thị đến — giờ</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-slate">
                Bỏ trống: không giới hạn ngày kết thúc. Đúng vào mốc này banner
                ngừng hiển thị.
              </p>
            </fieldset>

        </form>
      </SplitModal>
    </Form>
  );
}
