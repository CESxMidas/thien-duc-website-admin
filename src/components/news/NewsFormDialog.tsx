import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { newsSchema, type NewsFormValues } from "./news-schema";
import { toast } from "sonner";
import { CalendarClock, Loader2, Star, Trash2, Send } from "lucide-react";

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
  useScheduleNewsPublication,
  useUpdateNews,
  useUpdateNewsStatus,
} from "@/lib/api/queries";
import { SchedulePublishDialog } from "@/components/content/SchedulePublishDialog";
import { canScheduleRole } from "@/lib/news-schedule";
import { formatVietnamSentence } from "@/lib/vietnam-time";
import { contentStatusActions } from "@/lib/content-status-actions";
import { BilingualField } from "@/components/ui/BilingualField";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { useAuth } from "@/context/AuthContext";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import { paragraphsToText, toParagraphPayload } from "@/lib/long-form-content";
import type { NewsPost } from "@/types";

/** Giá trị Select không nhận chuỗi rỗng, nên "không chuyên mục" cần một token. */

interface NewsFormDialogProps {
  trigger: ReactNode;
  /** Có `post` = chế độ sửa; không có = viết bài mới. */
  post?: NewsPost;
}

function uniqueImageList(images: Array<string | null | undefined>) {
  return Array.from(
    new Set(images.filter((image): image is string => Boolean(image))),
  );
}

function NewsImagesPreview({
  images,
  cover,
  onSetCover,
  onRemove,
}: {
  images: string[];
  cover: string;
  onSetCover: (url: string) => void;
  onRemove: (url: string) => void;
}) {
  if (images.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-slate">
        Chưa có ảnh nào khác. Dùng nút phía trên để tải hoặc chọn nhiều ảnh.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate">
        Đã chọn {images.length} ảnh
      </p>
      <ul className="grid grid-cols-3 gap-2">
        {images.map((url) => {
          const active = url === cover;
          return (
            <li
              key={url}
              className={`group relative overflow-hidden rounded-md border bg-white ${
                active ? "border-brand ring-2 ring-gold/45" : "border-line"
              }`}
            >
              <button
                type="button"
                className="block w-full"
                onClick={() => onSetCover(url)}
                title={active ? "Ảnh đại diện" : "Chọn làm ảnh đại diện"}
              >
                <img
                  src={resolveAssetUrl(url)}
                  alt=""
                  className="aspect-4/3 w-full object-cover"
                  loading="lazy"
                />
              </button>
              <div className="absolute inset-x-1.5 top-1.5 flex items-start justify-between gap-1">
                {active ? (
                  <span className="inline-flex size-7 items-center justify-center rounded-md bg-brand text-white shadow-sm">
                    <Star className="size-3.5 fill-current" aria-hidden />
                    <span className="sr-only">Ảnh đại diện</span>
                  </span>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-md bg-white/92 text-slate opacity-0 shadow-sm transition hover:text-red-600 group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => onRemove(url)}
                  aria-label="Bỏ ảnh"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
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
    referenceUrl: post?.referenceUrl ?? "",
    image: post?.image ?? "",
    gallery: uniqueImageList([post?.image, ...(post?.gallery ?? [])]),
    // `<input type="date">` chỉ nhận `YYYY-MM-DD`, backend trả ISO đầy đủ.
    eventDate: post?.eventDate?.slice(0, 10) ?? "",
  };
}

export function NewsFormDialog({ trigger, post }: NewsFormDialogProps) {
  const isEdit = post !== undefined;
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const createNews = useCreateNews();
  const updateNews = useUpdateNews();
  const updateStatus = useUpdateNewsStatus();
  const schedulePublication = useScheduleNewsPublication();
  const { data: categories = [] } = useNewsCategories();
  const hasCategories = categories.length > 0;

  // Bài mới có thể kết thúc ở nhiều đích khác nhau. Nội dung form giống hệt
  // nhau, chỉ khác **lệnh chạy sau khi tạo** — xem `runCreate`.
  //
  // Bài mới của MỌI vai trò đều sinh ra ở `DRAFT` sạch (backend không còn tự
  // đăng bài của SUPER_ADMIN), nên ADMIN và SUPER_ADMIN có cùng bộ thao tác.
  const showSchedule = !isEdit && canScheduleRole(user?.role);
  // Lệnh trạng thái đi kèm nút phụ: ADMIN/SUPER_ADMIN "Đăng ngay" (→ PUBLISHED),
  // EDITOR "Gửi duyệt" (→ PENDING). Lấy từ ma trận dùng chung để nhãn và quyền
  // không bị chép lại lần nữa.
  const followUpAction = isEdit
    ? null
    : (contentStatusActions(user?.role, "DRAFT")[0] ?? null);

  // Giá trị form đã qua validate, chờ người dùng chọn mốc giờ ở hộp thoại lịch.
  // Có giá trị KHÔNG có nghĩa là đã tạo bài — mới chỉ là "sẵn sàng tạo".
  const [pendingSchedule, setPendingSchedule] = useState<NewsFormValues | null>(
    null,
  );

  // Cờ chạy chuỗi lệnh. `useState` để vẽ lại nút, `useRef` để chặn ngay trong
  // cùng một tick — hai cú click liên tiếp xảy ra trước khi React kịp render
  // lại, nút `disabled` một mình không cứu được.
  const [running, setRunning] = useState(false);
  const runningRef = useRef(false);

  const form = useForm<NewsFormValues>({
    resolver: zodResolver(newsSchema),
    defaultValues: toFormValues(post),
  });

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(post));
      setPendingSchedule(null);
    }
  }, [open, post, form]);

  function toPayload(values: NewsFormValues) {
    return {
      slug: values.slug,
      title: toBilingualPayload(values.title),
      summary: toBilingualPayload(values.summary),
      content: toParagraphPayload(values.content),
      categoryId: values.categoryId,
      author: values.author || undefined,
      referenceUrl: values.referenceUrl || null,
      image: values.image || undefined,
      gallery: uniqueImageList([values.image, ...values.gallery]),
      eventDate: values.eventDate || undefined,
      // KHÔNG có `scheduledAt` ở đây — xem `CreateNewsPostInput`. Lịch đăng đi
      // qua lệnh riêng bên dưới.
    };
  }

  function closeAll() {
    setPendingSchedule(null);
    setOpen(false);
  }

  /**
   * Tạo bài mới, rồi (tuỳ đích) chạy **một lệnh thứ hai** trên bài vừa tạo.
   *
   * Hai lệnh, không phải một: backend cố tình không nhận `scheduledAt` hay
   * `status` trong DTO nội dung — đăng/hẹn giờ là lệnh xuất bản có phân quyền
   * riêng. Người dùng chỉ thấy một thao tác, nhưng thứ tự dưới đây là bắt buộc.
   *
   * Slug dùng cho lệnh thứ hai LUÔN lấy từ response của bước tạo: backend có
   * thể chuẩn hoá slug, nên slug trong form chỉ là đề nghị.
   *
   * Nếu bước hai hỏng: **bài đã tồn tại rồi**. Không xoá, không tạo lại, không
   * giả vờ là tạo hỏng — đóng form (để không ai bấm tạo lần nữa thành bài trùng)
   * và nói thẳng ra rằng bài đã lưu, việc còn thiếu làm lại được từ danh sách.
   */
  async function runCreate(
    values: NewsFormValues,
    outcome: "draft" | "status" | "schedule",
    scheduledAt?: string,
  ) {
    if (runningRef.current) return;
    runningRef.current = true;
    setRunning(true);
    const title = values.title.vi;
    try {
      let created;
      try {
        created = await createNews.mutateAsync(toPayload(values));
      } catch (error) {
        // Tạo hỏng: KHÔNG chạy lệnh thứ hai, giữ nguyên dữ liệu đang gõ để sửa
        // rồi thử lại. Đóng hộp thoại lịch vì mốc giờ đã chọn không còn ngữ cảnh.
        setPendingSchedule(null);
        toast.error(
          resolveApiError(error, "Không tạo được bài viết. Vui lòng thử lại."),
        );
        return;
      }

      if (outcome === "schedule" && scheduledAt !== undefined) {
        try {
          await schedulePublication.mutateAsync({
            slug: created.slug,
            scheduledAt,
          });
          const when = formatVietnamSentence(scheduledAt);
          toast.success(
            when
              ? `Đã tạo bài "${title}" và hẹn đăng vào ${when}.`
              : `Đã tạo bài "${title}" và lên lịch đăng.`,
          );
        } catch (error) {
          toast.error(
            `Đã lưu bài "${title}" ở dạng nháp nhưng chưa đặt được lịch: ${resolveApiError(
              error,
              "không đặt được lịch đăng.",
            )} Hãy dùng nút "Lên lịch" ở danh sách Tin tức để đặt lại.`,
          );
        }
        closeAll();
        return;
      }

      if (outcome !== "status" || followUpAction === null) {
        toast.success(`Đã tạo bài "${title}".`);
        closeAll();
        return;
      }

      try {
        await updateStatus.mutateAsync({
          slug: created.slug,
          status: followUpAction.to,
        });
        toast.success(
          followUpAction.intent === "publish"
            ? `Đã tạo và đăng bài "${title}".`
            : `Đã tạo bài "${title}" và gửi duyệt.`,
        );
      } catch (error) {
        toast.error(
          `Đã lưu bài "${title}" ở dạng nháp nhưng chưa ${
            followUpAction.intent === "publish" ? "đăng" : "gửi duyệt"
          } được: ${resolveApiError(
            error,
            "không đổi được trạng thái.",
          )} Hãy thử lại từ danh sách Tin tức.`,
        );
      }
      closeAll();
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  }

  async function onSubmit(values: NewsFormValues) {
    if (!isEdit) {
      await runCreate(values, "draft");
      return;
    }
    try {
      await updateNews.mutateAsync({
        slug: post.slug,
        data: toPayload(values),
      });
      toast.success("Đã lưu thay đổi.");
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không lưu được thay đổi. Vui lòng thử lại."),
      );
    }
  }

  const submitting = form.formState.isSubmitting || running;

  const formId = "news-form";

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        // Đang chạy chuỗi tạo → không cho đóng: đóng giữa chừng thì người dùng
        // mất dấu bài vừa tạo và không biết lệnh thứ hai đã chạy hay chưa.
        onOpenChange={(next) => {
          if (running) return;
          // Hộp thoại đặt lịch đang mở CHỒNG LÊN form này. Radix dựng hai modal
          // thành anh em trong DOM, nên khi lớp trên đóng lại, sự kiện dismiss
          // của nó có thể rơi xuống lớp dưới và bị hiểu là "người dùng muốn
          // đóng form". Đó là một cuộc đua thật: đo được trên bộ test chạy song
          // song, nút mở form quay về `aria-expanded="false"` — tức form tạo đã
          // ĐÓNG HẲN, kéo theo toàn bộ nội dung biên tập viên vừa gõ.
          //
          // Trong khi còn một modal nằm trên, form nền không có lý do chính
          // đáng nào để tự đóng: mọi yêu cầu đóng lúc này là rò rỉ sự kiện, chứ
          // không phải ý người dùng. Người dùng vẫn đóng form bình thường được
          // sau khi hộp thoại lịch đã tắt.
          if (!next && pendingSchedule !== null) return;
          setOpen(next);
        }}
        trigger={trigger}
        size="split-lg"
        title={isEdit ? "Sửa bài viết" : "Viết tin mới"}
        description={
          isEdit
            ? "Cập nhật nội dung bài. Trạng thái đăng đổi ở bảng danh sách."
            : showSchedule
              ? // Tạo bài KHÔNG còn ngầm là đăng bài, kể cả với SUPER_ADMIN —
                // nên phải nói ra bài sẽ nằm ở đâu và đường nào đưa nó ra ngoài.
                "Bài mới luôn được lưu ở dạng nháp. Chọn Đăng ngay hoặc Đặt lịch nếu muốn đưa bài ra website."
              : "Bài mới được lưu ở trạng thái nháp, gửi duyệt sau khi hoàn thiện."
        }
        media={
          <MediaSection
            label="Ảnh bài viết"
            hint="Chọn ảnh đại diện và quản lý toàn bộ ảnh hiển thị trong bài."
          >
            <FormField
              control={form.control}
              name="image"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <ImagePickerField
                      value={field.value ?? ""}
                      onChange={(url) => {
                        field.onChange(url);
                        if (!url) return;
                        const current = form.getValues("gallery") ?? [];
                        form.setValue(
                          "gallery",
                          uniqueImageList([url, ...current]),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        );
                      }}
                      folder="news"
                      aspect="16/9"
                      alt="Ảnh chính bài viết"
                      onBatchUploaded={(urls) => {
                        const current = form.getValues("gallery") ?? [];
                        form.setValue(
                          "gallery",
                          uniqueImageList([...current, ...urls]),
                          {
                            shouldDirty: true,
                            shouldValidate: true,
                          },
                        );
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="gallery"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <NewsImagesPreview
                      images={field.value ?? []}
                      cover={form.watch("image")}
                      onSetCover={(url) => {
                        form.setValue("image", url, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                      }}
                      onRemove={(url) => {
                        const next = (field.value ?? []).filter(
                          (item) => item !== url,
                        );
                        field.onChange(next);
                        if (form.getValues("image") === url) {
                          form.setValue("image", next[0] ?? "", {
                            shouldDirty: true,
                            shouldValidate: true,
                          });
                        }
                      }}
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
            {/* Đặt lịch KHÔNG tạo bài ngay: nó chỉ validate nội dung rồi mở hộp
                thoại chọn giờ. Bài chỉ ra đời khi người dùng bấm xác nhận ở đó. */}
            {showSchedule && (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={form.handleSubmit((values) => {
                  setPendingSchedule(values);
                })}
              >
                <CalendarClock className="size-4" />
                Đặt lịch
              </Button>
            )}
            {followUpAction && (
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={form.handleSubmit((values) =>
                  runCreate(values, "status"),
                )}
              >
                <Send className="size-4" />
                {followUpAction.label}
              </Button>
            )}
            <Button type="submit" form={formId} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {/* Đứng cạnh "Đăng ngay" / "Đặt lịch", nút chính phải nói rõ nó
                  khác gì: "Tạo bài viết" không cho biết bài sẽ nằm ở trạng thái
                  nào, "Lưu nháp" thì có. */}
              {isEdit ? "Lưu thay đổi" : "Lưu nháp"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid min-w-0 gap-4 overflow-x-hidden"
          noValidate
        >
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
                    <SelectTrigger className="h-10 w-full">
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
                    <Input
                      className="h-10 w-full"
                      placeholder="Thiên Đức"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="referenceUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Link tham khảo</FormLabel>
                  <FormControl>
                    <Input
                      className="h-10 w-full"
                      placeholder="https://example.com/bai-viet"
                      {...field}
                    />
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
                    <Input className="h-10 w-full" type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </form>
      </SplitModal>

      {/* Hộp thoại chọn giờ dùng LẠI nguyên bản của luồng đặt lịch trên bảng
          danh sách (cùng nhãn múi giờ, cùng ràng buộc 1 phút / 2 năm, cùng cảnh
          báo "rất gần"). Nó nằm NGOÀI `SplitModal` nên hai modal là anh em
          trong DOM, không lồng nhau: ESC đóng đúng lớp trên cùng và trả tiêu
          điểm về form tạo, nội dung đang gõ còn nguyên. */}
      {showSchedule && (
        <SchedulePublishDialog
          open={pendingSchedule !== null}
          onOpenChange={(next) => {
            if (running || next) return;
            // Huỷ / ESC trước khi xác nhận: KHÔNG có lời gọi API nào cả, bài
            // chưa từng được tạo. Chỉ quay lại form với dữ liệu còn nguyên.
            setPendingSchedule(null);
          }}
          contentTitle={pendingSchedule?.title.vi ?? ""}
          submitting={running}
          onSubmit={(scheduledAt) => {
            if (pendingSchedule === null) return;
            void runCreate(pendingSchedule, "schedule", scheduledAt);
          }}
        />
      )}
    </Form>
  );
}
