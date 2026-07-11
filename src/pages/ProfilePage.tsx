import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Clock, Loader2, Mail, ShieldCheck } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMyProfile, useUpdateMyProfile } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import {
  formatDateTime,
  profileFieldLabel,
  roleLabel,
} from "@/lib/labels";
import type { BadgeTone } from "@/lib/labels";
import type { MyProfile, ProfilePayload, Role } from "@/types";

const roleTone: Record<Role, BadgeTone> = {
  EDITOR: "blue",
  ADMIN: "amber",
  SUPER_ADMIN: "red",
};

const profileSchema = z.object({
  name: z.string().trim().min(1, "Tên hiển thị không được để trống").max(120),
  phone: z.string().trim().max(30).optional(),
  position: z.string().trim().max(120).optional(),
  department: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  avatarUrl: z.string().trim().max(500).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfilePage() {
  const { data: profile, isLoading } = useMyProfile();

  if (isLoading || !profile) {
    return (
      <div>
        <PageHeader
          title="Thông tin cá nhân"
          description="Xem và cập nhật hồ sơ của bạn."
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-xl bg-cream" />
          <div className="h-96 animate-pulse rounded-xl bg-cream lg:col-span-2" />
        </div>
      </div>
    );
  }

  return <ProfileContent profile={profile} />;
}

function ProfileContent({ profile }: { profile: MyProfile }) {
  const update = useUpdateMyProfile();
  const isEditor = profile.role === "EDITOR";

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile.name,
      phone: profile.phone ?? "",
      position: profile.position ?? "",
      department: profile.department ?? "",
      bio: profile.bio ?? "",
      avatarUrl: profile.avatarUrl ?? "",
    },
  });

  // Đồng bộ lại form khi hồ sơ được duyệt/đổi ở nơi khác.
  useEffect(() => {
    form.reset({
      name: profile.name,
      phone: profile.phone ?? "",
      position: profile.position ?? "",
      department: profile.department ?? "",
      bio: profile.bio ?? "",
      avatarUrl: profile.avatarUrl ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  async function onSubmit(values: ProfileFormValues) {
    const payload: ProfilePayload = {
      name: values.name,
      phone: values.phone ?? "",
      position: values.position ?? "",
      department: values.department ?? "",
      bio: values.bio ?? "",
      avatarUrl: values.avatarUrl ?? "",
    };
    try {
      await update.mutateAsync(payload);
      toast.success(
        isEditor
          ? "Đã gửi yêu cầu cập nhật. Vui lòng chờ quản trị viên duyệt."
          : "Đã cập nhật hồ sơ.",
      );
    } catch (error) {
      toast.error(resolveApiError(error, "Không cập nhật được hồ sơ."));
    }
  }

  const pending = profile.pendingRequest;

  return (
    <div>
      <PageHeader
        title="Thông tin cá nhân"
        description={
          isEditor
            ? "Cập nhật hồ sơ của bạn. "
            : "Xem và cập nhật hồ sơ của bạn."
        }
      />

      {/* Yêu cầu đang chờ duyệt */}
      {pending && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50/70 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
            <Clock className="size-4" />
            Bạn có một yêu cầu cập nhật đang chờ duyệt
          </div>
          <ul className="mt-2 space-y-1 text-sm text-amber-900/90">
            {Object.entries(pending.payload).map(([key, value]) => (
              <li key={key}>
                <span className="font-medium">
                  {profileFieldLabel[key] ?? key}:
                </span>{" "}
                {key === "avatarUrl" ? "(ảnh mới)" : String(value) || "(để trống)"}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-amber-800/80">
            Gửi lại sẽ thay thế nội dung yêu cầu đang chờ.
          </p>
        </div>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="grid items-start gap-6 lg:grid-cols-3"
        >
        {/* Thẻ danh tính + ảnh đại diện */}
        <Card className="h-fit">
          <CardContent className="flex flex-col items-center pt-6 text-center">
            <FormField
              control={form.control}
              name="avatarUrl"
              render={({ field }) => (
                <FormItem className="w-36">
                  <FormControl>
                    <ImagePickerField
                      value={field.value ?? ""}
                      onChange={field.onChange}
                      folder="misc"
                      aspect="1/1"
                      alt="Ảnh đại diện"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <h2 className="mt-4 text-lg font-semibold text-ink">
              {profile.name}
            </h2>
            {profile.position && (
              <p className="text-sm text-slate">{profile.position}</p>
            )}
            <Badge variant={roleTone[profile.role]} className="mt-3">
              <ShieldCheck className="size-3.5" /> {roleLabel[profile.role]}
            </Badge>

            <dl className="mt-6 w-full space-y-2 border-t border-line pt-4 text-left text-sm">
              <div className="flex items-center gap-2 text-slate">
                <Mail className="size-4 shrink-0" />
                <span className="truncate" title={profile.email}>
                  {profile.email}
                </span>
              </div>
              {profile.department && (
                <div className="flex items-center gap-2 text-slate">
                  <span className="shrink-0 text-xs uppercase tracking-wide">
                    Phòng ban
                  </span>
                  <span className="truncate text-ink">{profile.department}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-slate">
                <Clock className="size-4 shrink-0" />
                <span>Tham gia {formatDateTime(profile.createdAt)}</span>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Biểu mẫu chỉnh sửa */}
        <Card className="lg:col-span-2">
          <CardHeader className="border-b">
            <CardTitle className="text-base">Chỉnh sửa hồ sơ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tên hiển thị *</FormLabel>
                        <FormControl>
                          <Input placeholder="Nguyễn Văn A" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Số điện thoại</FormLabel>
                        <FormControl>
                          <Input
                            type="tel"
                            placeholder="09xx xxx xxx"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chức vụ</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Biên tập viên nội dung"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phòng ban</FormLabel>
                        <FormControl>
                          <Input placeholder="Marketing" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="bio"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Giới thiệu</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="Vài dòng giới thiệu về bạn."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Email và vai trò do quản trị viên quản lý, không sửa ở
                        đây.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={update.isPending || !form.formState.isDirty}
                  >
                    {update.isPending && (
                      <Loader2 className="size-4 animate-spin" />
                    )}
                    {isEditor ? "Gửi yêu cầu duyệt" : "Lưu thay đổi"}
                  </Button>
                </div>
          </CardContent>
        </Card>
        </form>
      </Form>
    </div>
  );
}
