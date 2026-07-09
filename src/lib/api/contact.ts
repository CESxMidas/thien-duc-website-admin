// Service form liên hệ (lead) — nối module `contact` của backend:
//   GET   /contact      -> Lead[]   (mới nhất trước; ADMIN/SUPER_ADMIN)
//   GET   /contact/:id  -> Lead
//   PATCH /contact/:id  -> Lead     (đổi trạng thái và/hoặc ghi chú nội bộ)
//
// `POST /contact` là của website công khai (rate-limit 5 request/IP/giờ), Admin
// CMS không dùng.

import { apiFetch } from "./client";
import type { Lead, LeadStatus } from "@/types";

export interface UpdateLeadInput {
  status?: LeadStatus;
  internalNote?: string;
}

export function listLeads(): Promise<Lead[]> {
  return apiFetch<Lead[]>("/contact");
}

export function getLead(id: string): Promise<Lead> {
  return apiFetch<Lead>(`/contact/${id}`);
}

export function updateLead(id: string, input: UpdateLeadInput): Promise<Lead> {
  return apiFetch<Lead>(`/contact/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}
