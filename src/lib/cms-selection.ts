import { createContext, useContext } from "react";
import type { CmsDeleteTarget } from "./api/cms-trash";

export type CmsSelectionValue = {
  available: boolean;
  busy: boolean;
  records: CmsDeleteTarget[];
  selectedIds: string[];
  toggle: (id?: string) => void;
};

export const CmsSelectionContext = createContext<CmsSelectionValue | null>(
  null,
);
export const useCmsSelection = () => useContext(CmsSelectionContext);

export function cmsRecordTitle(record: object): string {
  const row = record as Record<string, unknown>;
  for (const field of ["title", "name", "caption", "publicId", "slug"]) {
    const value = row[field];
    if (typeof value === "string" && value.trim()) return value;
    if (
      value &&
      typeof value === "object" &&
      "vi" in value &&
      typeof value.vi === "string" &&
      value.vi.trim()
    )
      return value.vi;
  }
  if (row.user && typeof row.user === "object" && "name" in row.user)
    return `Yêu cầu của ${String(row.user.name)}`;
  if (typeof row.url === "string")
    return row.url.split("/").pop() || "Ảnh dự án";
  return "Nội dung chưa đặt tên";
}
