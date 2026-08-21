/**
 * Schema Zod cho form — tách khỏi file component CÓ CHỦ Ý:
 *  1. `react-refresh/only-export-components`: file component chỉ nên export
 *     component, export thêm thứ khác làm hỏng Fast Refresh.
 *  2. Test schema trực tiếp mà KHÔNG kéo cả component (và hàng chục hàm chưa
 *     có test của nó) vào mẫu số coverage.
 * Ràng buộc soi gương DTO tương ứng ở backend.
 */
import { z } from "zod";

import { validateDisplayWindowFields } from "@/lib/banner-display-window";
import {
  MAX_OBJECT_POSITION_LENGTH,
  bilingualText,
  internalHrefField,
  optionalBilingualText,
  requiredImageField,
} from "@/lib/form-validation";

/** Đối ứng `CreateBannerDto`. */
export const bannerSchema = z
  .object({
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
    // CỬA SỔ HIỂN THỊ — bốn ô native (ngày + giờ) × (từ, đến), tất cả tùy chọn.
    //
    // Tên field trùng khít `DisplayWindowFields` của `banner-display-window.ts`
    // để không phải có một lớp dịch tên ở giữa: chỗ nào lệch tên là chỗ đó sinh
    // ra bug im lặng khi thêm/bớt field.
    fromDate: z.string(),
    fromTime: z.string(),
    untilDate: z.string(),
    untilTime: z.string(),
  })
  /**
   * Luật liên-field nằm ở `superRefine` chứ không ở từng field: "từ < đến" và
   * "có ngày thì phải có giờ" đều cần nhìn nhiều ô cùng lúc.
   *
   * Dùng lại đúng `validateDisplayWindowFields` mà form sẽ dùng — MỘT nguồn
   * luật cho cả kiểm tại chỗ lẫn dựng payload, nên không có kịch bản schema báo
   * hợp lệ rồi payload lại dựng ra thứ backend từ chối.
   */
  .superRefine((values, ctx) => {
    const result = validateDisplayWindowFields(values);
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [result.field],
        message: result.message,
      });
    }
  });

export type BannerFormValues = z.infer<typeof bannerSchema>;
