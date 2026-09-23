import { useEffect, useState } from "react";
import { ImageOff, Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useBrandingSettings,
  useUpdateBrandingSettings,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";

const DEFAULT_LOGO = "/images/brand/logo-thien-duc.png";

export function BrandingSettingsPage() {
  const { data, isLoading } = useBrandingSettings();
  const updateBranding = useUpdateBrandingSettings();
  const [logoUrl, setLogoUrl] = useState("");
  const [logoAlt, setLogoAlt] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");

  useEffect(() => {
    if (!data) return;
    setLogoUrl(data.logoUrl ?? "");
    setLogoAlt(data.logoAlt ?? "");
    setFaviconUrl(data.faviconUrl ?? "");
  }, [data]);

  async function save() {
    try {
      await updateBranding.mutateAsync({
        logoUrl,
        logoAlt,
        faviconUrl,
      });
      toast.success("Đã lưu nhận diện thương hiệu.");
    } catch (error) {
      toast.error(resolveApiError(error, "Không lưu được cài đặt thương hiệu."));
    }
  }

  async function resetLogo() {
    try {
      await updateBranding.mutateAsync({
        logoUrl: "",
        logoAlt: "",
        faviconUrl: "",
      });
      setLogoUrl("");
      setLogoAlt("");
      setFaviconUrl("");
      toast.success("Đã đưa logo về mặc định.");
    } catch (error) {
      toast.error(resolveApiError(error, "Không reset được logo."));
    }
  }

  const effectiveLogo = logoUrl || DEFAULT_LOGO;

  return (
    <div>
      <PageHeader
        title="Cài đặt thương hiệu"
        description="Thay logo và thông tin nhận diện dùng chung cho website công khai và CMS."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Logo website</CardTitle>
            <CardDescription>
              Tải logo mới hoặc chọn từ thư viện. Nếu bỏ trống, website sẽ dùng logo mặc định trong mã nguồn.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <ImagePickerField
              value={logoUrl}
              onChange={setLogoUrl}
              folder="branding"
              aspect="3/1"
              previewFit="contain"
              previewClassName="max-w-xl bg-white p-4"
              alt="Logo thương hiệu"
            />

            <div className="grid gap-2">
              <label
                htmlFor="branding-logo-alt"
                className="text-sm font-medium text-ink"
              >
                Mô tả ảnh logo
              </label>
              <Input
                id="branding-logo-alt"
                value={logoAlt}
                onChange={(event) => setLogoAlt(event.target.value)}
                placeholder="Logo công ty"
              />
            </div>

            <div className="grid gap-2">
              <label
                htmlFor="branding-favicon"
                className="text-sm font-medium text-ink"
              >
                Favicon URL
              </label>
              <Input
                id="branding-favicon"
                value={faviconUrl}
                onChange={(event) => setFaviconUrl(event.target.value)}
                placeholder="https://..."
              />
              <p className="text-xs leading-5 text-slate">
                Có thể để trống nếu dự án chưa cần thay favicon.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={isLoading || updateBranding.isPending}
                onClick={() => void save()}
              >
                {updateBranding.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                Lưu cài đặt
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isLoading || updateBranding.isPending}
                onClick={() => void resetLogo()}
              >
                <RotateCcw className="size-4" />
                Về mặc định
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Xem trước</CardTitle>
            <CardDescription>
              Logo đang được áp dụng sau khi lưu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid min-h-44 place-items-center rounded-lg border border-line bg-cream/55 p-6">
              {effectiveLogo ? (
                <img
                  src={resolveAssetUrl(effectiveLogo)}
                  alt={logoAlt || "Logo thương hiệu"}
                  className="max-h-28 w-auto max-w-full object-contain"
                />
              ) : (
                <ImageOff className="size-10 text-slate/40" />
              )}
            </div>
            <p
              className="mt-3 truncate text-xs leading-5 text-slate"
              title={logoUrl || DEFAULT_LOGO}
            >
              {logoUrl || DEFAULT_LOGO}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
