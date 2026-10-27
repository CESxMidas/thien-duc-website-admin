import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FileText, Loader2, Mail, MapPin, Phone, Save } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyContact, useUpdateCompanyContact } from "@/lib/api/queries";
import type { CompanyContact } from "@/lib/api/settings";
import { resolveApiError } from "@/lib/api-error-message";

const schema = z.object({
  phone: z
    .string()
    .trim()
    .max(30, "Tối đa 30 ký tự.")
    .regex(/^\+?[\d\s().-]+$/, "Số điện thoại không hợp lệ.")
    .refine((value) => {
      const count = value.replace(/\D/g, "").length;
      return count >= 9 && count <= 15;
    }, "Số điện thoại cần từ 9 đến 15 chữ số."),
  email: z
    .string()
    .trim()
    .email("Email không hợp lệ.")
    .max(254, "Tối đa 254 ký tự."),
  taxCode: z
    .string()
    .trim()
    .regex(
      /^\d{10}(?:-?\d{3})?$/,
      "Mã số thuế gồm 10 hoặc 13 chữ số; có thể có dấu gạch trước 3 số cuối.",
    ),
  address: z.object({
    vi: z
      .string()
      .trim()
      .min(1, "Vui lòng nhập địa chỉ tiếng Việt.")
      .max(500, "Tối đa 500 ký tự."),
    en: z.string().trim().max(500, "Tối đa 500 ký tự."),
  }),
});
type Values = z.infer<typeof schema>;
const toValues = (data: CompanyContact): Values => ({
  ...data,
  address: { vi: data.address.vi, en: data.address.en ?? "" },
});

export function CompanyContactPage() {
  const query = useCompanyContact();
  return (
    <div>
      <PageHeader
        title="Thông tin liên hệ công ty"
        description="Cập nhật thông tin hiển thị trên website để khách hàng liên hệ đúng bộ phận."
      />
      {query.isPending ? (
        <p role="status" className="py-8 text-sm text-slate">
          Đang tải thông tin liên hệ...
        </p>
      ) : !query.data ? (
        <Card>
          <CardContent className="space-y-4 pt-6">
            <p role="alert">
              Không tải được thông tin liên hệ. Vui lòng thử lại.
            </p>
            <Button variant="outline" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {query.isError && (
            <p role="status" className="mb-4 text-sm text-slate">
              Chưa cập nhật được dữ liệu mới nhất. Nội dung đang nhập vẫn được
              giữ lại.
            </p>
          )}
          <CompanyContactEditor data={query.data} />
        </>
      )}
    </div>
  );
}

function CompanyContactEditor({ data }: { data: CompanyContact }) {
  const mutation = useUpdateCompanyContact();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: toValues(data),
    mode: "onBlur",
  });
  const preview = useWatch({ control: form.control });
  const busy = mutation.isPending;
  async function save(values: Values) {
    try {
      const saved = await mutation.mutateAsync(values);
      form.reset(toValues(saved));
      toast.success("Đã lưu thông tin liên hệ công ty.");
    } catch (error) {
      toast.error(
        resolveApiError(
          error,
          "Không lưu được thông tin liên hệ. Vui lòng thử lại.",
        ),
      );
    }
  }
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
      <Card>
        <CardHeader>
          <CardTitle>Thông tin hiển thị</CardTitle>
          <CardDescription>
            Các trường có dấu * là bắt buộc. Địa chỉ tiếng Anh để trống sẽ dùng
            bản tiếng Việt.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(save)}
              noValidate
              className="space-y-5"
            >
              <fieldset
                disabled={busy}
                className="grid min-w-0 gap-5 sm:grid-cols-2"
              >
                <legend className="sr-only">Thông tin liên hệ công ty</legend>
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Số điện thoại *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="tel"
                          autoComplete="tel"
                          maxLength={30}
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="taxCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mã số thuế *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="text"
                          maxLength={14}
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Email liên hệ *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          autoComplete="email"
                          maxLength={254}
                          className="h-11"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.vi"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Địa chỉ tiếng Việt *</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          autoComplete="street-address"
                          rows={3}
                          maxLength={500}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address.en"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Địa chỉ tiếng Anh</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          lang="en"
                          rows={3}
                          maxLength={500}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </fieldset>
              <p className="text-sm leading-6 text-slate">
                Thông tin được dùng chung cho footer, trang Liên hệ và các liên
                kết liên hệ trên website. Website có thể cần khoảng một phút để
                cập nhật.
              </p>
              <div className="flex flex-wrap gap-3 border-t border-line pt-5">
                <Button
                  type="submit"
                  disabled={busy || !form.formState.isDirty}
                  className="min-h-11"
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {busy ? "Đang lưu..." : "Lưu thông tin"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || !form.formState.isDirty}
                  onClick={() => form.reset(toValues(data))}
                  className="min-h-11"
                >
                  Bỏ thay đổi
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Xem trước</CardTitle>
          <CardDescription>Nội dung tiếng Việt sau khi lưu.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="space-y-5 text-sm">
            {[
              { label: "Số điện thoại", value: preview.phone, icon: Phone },
              { label: "Email", value: preview.email, icon: Mail },
              { label: "Mã số thuế", value: preview.taxCode, icon: FileText },
              { label: "Địa chỉ", value: preview.address?.vi, icon: MapPin },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex min-w-0 gap-3">
                <Icon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-brand"
                />
                <div className="min-w-0">
                  <dt className="text-xs text-slate">{label}</dt>
                  <dd className="mt-1 whitespace-pre-line break-words leading-6 text-ink [overflow-wrap:anywhere]">
                    {value?.trim() || "Chưa nhập"}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
