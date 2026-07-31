/**
 * Schema Zod cho form — tách khỏi file component CÓ CHỦ Ý:
 *  1. `react-refresh/only-export-components`: file component chỉ nên export
 *     component, export thêm thứ khác làm hỏng Fast Refresh.
 *  2. Test schema trực tiếp mà KHÔNG kéo cả component (và hàng chục hàm chưa
 *     có test của nó) vào mẫu số coverage.
 * Ràng buộc soi gương DTO tương ứng ở backend.
 */
import { z } from "zod";

import {
  MAX_OBJECT_POSITION_LENGTH,
  bilingualText,
  internalHrefField,
  optionalBilingualText,
  requiredImageField,
} from "@/lib/form-validation";

/** Đối ứng `CreateBannerDto`. */
export const bannerSchema = z.object({
  image: requiredImageField("Cần URL ảnh banner."),
  href: internalHrefField(),
  title: bilingualText(3, "Tiêu đề tối thiểu 3 ký tự."),
  eyebrow: optionalBilingualText(),
  subtitle: optionalBilingualText(),
  ctaLabel: optionalBilingualText(),
  objectPosition: z
    .string()
    .trim()
    .max(
      MAX_OBJECT_POSITION_LENGTH,
      `Tối đa ${MAX_OBJECT_POSITION_LENGTH} ký tự.`,
    ),
});

export type BannerFormValues = z.infer<typeof bannerSchema>;
