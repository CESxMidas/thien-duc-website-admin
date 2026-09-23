import { apiFetch } from "./client";

export interface BrandingSettings {
  logoUrl: string | null;
  logoAlt: string | null;
  faviconUrl: string | null;
}

export type UpdateBrandingSettingsInput = Partial<BrandingSettings>;

export function getBrandingSettings(): Promise<BrandingSettings> {
  return apiFetch<BrandingSettings>("/settings/branding");
}

export function updateBrandingSettings(
  input: UpdateBrandingSettingsInput,
): Promise<BrandingSettings> {
  return apiFetch<BrandingSettings>("/settings/branding", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
