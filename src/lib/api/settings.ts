import { apiFetch } from "./client";

export interface CompanyContact {
  phone: string;
  email: string;
  taxCode: string;
  address: { vi: string; en?: string };
}

export function getCompanyContact(): Promise<CompanyContact> {
  return apiFetch<CompanyContact>("/settings/company-contact");
}

export function updateCompanyContact(
  input: CompanyContact,
): Promise<CompanyContact> {
  return apiFetch<CompanyContact>("/settings/company-contact", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

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
