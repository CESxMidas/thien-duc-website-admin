import { useEffect, useRef, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { BilingualField } from "@/components/ui/BilingualField";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SplitModal } from "@/components/ui/SplitModal";
import {
  useCreateRecruitmentPosition,
  useRecruitmentPosition,
  useUpdateRecruitmentPosition,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { toBilingualPayload, toBilingualValue } from "@/lib/bilingual";
import { slugify } from "@/lib/slugify";
import type { BilingualList, RecruitmentPosition } from "@/types";
import {
  recruitmentPositionSchema,
  type RecruitmentPositionFormValues,
} from "./recruitment-position-schema";

interface RecruitmentPositionFormDialogProps {
  trigger: ReactNode;
  position?: RecruitmentPosition;
}

const EMPTY_VALUES: RecruitmentPositionFormValues = {
  title: { vi: "", en: "" },
  department: { vi: "", en: "" },
  location: { vi: "", en: "" },
  type: { vi: "", en: "" },
  summary: { vi: "", en: "" },
  responsibilities: { vi: "", en: "" },
  requirements: { vi: "", en: "" },
  benefits: { vi: "", en: "" },
  deadline: "",
  order: 0,
};

function joinLines(values: BilingualList | undefined): {
  vi: string;
  en: string;
} {
  return {
    vi: (values?.vi ?? []).join("\n"),
    en: (values?.en ?? []).join("\n"),
  };
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim());
}

function bilingualLinesPayload(value: {
  vi: string;
  en: string;
}): BilingualList {
  const viLines = splitLines(value.vi);
  const enLines = splitLines(value.en);
  return {
    vi: viLines,
    ...(enLines.some(Boolean) ? { en: enLines } : {}),
  };
}

function toFormValues(
  position?: RecruitmentPosition,
): RecruitmentPositionFormValues {
  if (!position) return EMPTY_VALUES;
  return {
    title: toBilingualValue(position.title),
    department: toBilingualValue(position.department),
    location: toBilingualValue(position.location),
    type: toBilingualValue(position.type),
    summary: toBilingualValue(position.summary),
    responsibilities: joinLines(position.responsibilities),
    requirements: joinLines(position.requirements),
    benefits: joinLines(position.benefits),
    deadline: position.deadline?.slice(0, 10) ?? "",
    order: position.order,
  };
}

export function RecruitmentPositionFormDialog({
  trigger,
  position,
}: RecruitmentPositionFormDialogProps) {
  const isEdit = position !== undefined;
  const [open, setOpen] = useState(false);
  const detailQuery = useRecruitmentPosition(position?.id, open);
  const detailApplied = useRef(false);
  const createPosition = useCreateRecruitmentPosition();
  const updatePosition = useUpdateRecruitmentPosition();
  const form = useForm<RecruitmentPositionFormValues>({
    resolver: zodResolver(recruitmentPositionSchema),
    defaultValues: toFormValues(position),
  });
  const title = form.watch("title");
  const generatedSlug = slugify(title.vi);
  const detail = detailQuery.data ?? position;
  const detailLoading = isEdit && detailQuery.isLoading;

  useEffect(() => {
    if (!open) {
      detailApplied.current = false;
      return;
    }
    form.reset(toFormValues(position));
    detailApplied.current = !isEdit;
  }, [form, isEdit, open, position]);

  useEffect(() => {
    if (open && detailQuery.data && !detailApplied.current) {
      form.reset(toFormValues(detailQuery.data));
      detailApplied.current = true;
    }
  }, [detailQuery.data, form, open]);

  async function onSubmit(values: RecruitmentPositionFormValues) {
    const slug = isEdit ? position.slug : slugify(values.title.vi);
    if (!isEdit && slug.length < 3) {
      form.setError("title", {
        message: "Chức danh cần tạo được slug tối thiểu 3 ký tự.",
      });
      return;
    }

    const fields = {
      title: toBilingualPayload(values.title),
      department: toBilingualPayload(values.department),
      location: toBilingualPayload(values.location),
      type: toBilingualPayload(values.type),
      summary: toBilingualPayload(values.summary),
      responsibilities: bilingualLinesPayload(values.responsibilities),
      requirements: bilingualLinesPayload(values.requirements),
      benefits: bilingualLinesPayload(values.benefits),
      deadline: values.deadline || null,
      order: values.order,
    };

    try {
      if (isEdit) {
        await updatePosition.mutateAsync({ id: position.id, data: fields });
        toast.success("Đã lưu vị trí tuyển dụng.");
      } else {
        await createPosition.mutateAsync({
          ...fields,
          slug,
          status: "DRAFT",
        });
        toast.success("Đã thêm vị trí tuyển dụng.");
      }
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(
          error,
          "Không lưu được vị trí tuyển dụng. Vui lòng thử lại.",
        ),
      );
    }
  }

  const submitting = form.formState.isSubmitting;
  const formId = `recruitment-position-form-${position?.id ?? "new"}`;

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        title={isEdit ? "Sửa vị trí tuyển dụng" : "Thêm vị trí tuyển dụng"}
        description="Nhập nội dung tiếng Việt và bổ sung tiếng Anh khi có. Slug được tạo từ chức danh tiếng Việt và không đổi sau khi tạo."
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
            <Button
              type="submit"
              form={formId}
              disabled={submitting || detailLoading}
            >
              {(submitting || detailLoading) && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {isEdit ? "Lưu thay đổi" : "Thêm vị trí"}
            </Button>
          </>
        }
      >
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid gap-5"
          noValidate
        >
          {detailLoading ? (
            <p role="status" className="text-sm text-slate">
              Đang tải thông tin vị trí tuyển dụng…
            </p>
          ) : null}
          {isEdit && detail ? (
            <div className="rounded-lg border border-line bg-cream/40 px-3 py-2">
              <p className="text-xs font-medium text-slate">Slug không thể sửa</p>
              <p className="break-all text-sm text-ink">{detail.slug}</p>
            </div>
          ) : (
            <p className="break-all text-xs text-slate">
              Slug dự kiến: {generatedSlug || "nhập chức danh để tạo slug"}
            </p>
          )}

          <fieldset
            disabled={detailLoading}
            className="grid gap-5 disabled:opacity-60"
          >
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <BilingualField
                      label={<FormLabel>Chức danh</FormLabel>}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{ vi: "Kỹ sư xây dựng", en: "Engineer" }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              {(
                [
                  ["department", "Phòng ban", "Phòng Kỹ thuật"],
                  ["location", "Địa điểm", "Bến Tre"],
                  ["type", "Hình thức làm việc", "Toàn thời gian"],
                ] as const
              ).map(([name, label, placeholder]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <BilingualField
                          label={<FormLabel>{label}</FormLabel>}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder={{ vi: placeholder }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <FormField
              control={form.control}
              name="summary"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <BilingualField
                      label={<FormLabel>Mô tả ngắn</FormLabel>}
                      multiline
                      rows={3}
                      value={field.value}
                      onChange={field.onChange}
                      placeholder={{
                        vi: "Tóm tắt vai trò và cơ hội.",
                        en: "Summarize the role and opportunity.",
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(
              [
                ["responsibilities", "Trách nhiệm", "Mỗi dòng là một trách nhiệm."],
                ["requirements", "Yêu cầu", "Mỗi dòng là một yêu cầu."],
                ["benefits", "Quyền lợi", "Mỗi dòng là một quyền lợi."],
              ] as const
            ).map(([name, label, description]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <BilingualField
                        label={<FormLabel>{label}</FormLabel>}
                        multiline
                        rows={4}
                        value={field.value}
                        onChange={field.onChange}
                        placeholder={{
                          vi: `${description}\nNhập các dòng theo cùng thứ tự ở hai ngôn ngữ.`,
                          en: "Enter one item per line, in the same order as Vietnamese.",
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Từng dòng tiếng Việt và tiếng Anh ghép theo cùng số thứ tự.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="deadline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hạn nhận hồ sơ</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      Để trống nếu chưa có hạn chót.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Thứ tự hiển thị</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="1"
                        value={field.value}
                        onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      />
                    </FormControl>
                    <FormDescription>
                      Số nhỏ hơn hiển thị trước.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </fieldset>
        </form>
      </SplitModal>
    </Form>
  );
}
