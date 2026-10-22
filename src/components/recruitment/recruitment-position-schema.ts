import { z } from "zod";

import { bilingualText, optionalDateField } from "@/lib/form-validation";

export const recruitmentPositionSchema = z.object({
  title: bilingualText(1, "Cần nhập chức danh."),
  department: bilingualText(1, "Cần nhập phòng ban."),
  location: bilingualText(1, "Cần nhập địa điểm."),
  type: bilingualText(1, "Cần nhập hình thức làm việc."),
  summary: bilingualText(1, "Cần nhập mô tả ngắn."),
  responsibilities: bilingualText(0, ""),
  requirements: bilingualText(0, ""),
  benefits: bilingualText(0, ""),
  deadline: optionalDateField(),
  order: z.number().int("Thứ tự phải là số nguyên."),
});

export type RecruitmentPositionFormValues = z.infer<
  typeof recruitmentPositionSchema
>;
