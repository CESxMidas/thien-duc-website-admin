import { apiFetch } from "./client";
import type {
  Bilingual,
  BilingualList,
  ContentStatus,
  RecruitmentPosition,
} from "@/types";

export interface CreateRecruitmentPositionInput {
  slug: string;
  title: Bilingual;
  department: Bilingual;
  location: Bilingual;
  type: Bilingual;
  summary: Bilingual;
  responsibilities: BilingualList;
  requirements: BilingualList;
  benefits: BilingualList;
  deadline: string | null;
  status: ContentStatus;
  order: number;
}

export type UpdateRecruitmentPositionInput =
  Partial<CreateRecruitmentPositionInput>;

export function listRecruitmentPositions(): Promise<RecruitmentPosition[]> {
  return apiFetch<RecruitmentPosition[]>("/recruitment-positions/admin");
}

export function getRecruitmentPosition(
  id: string,
): Promise<RecruitmentPosition> {
  return apiFetch<RecruitmentPosition>(
    `/recruitment-positions/admin/${encodeURIComponent(id)}`,
  );
}

export function createRecruitmentPosition(
  input: CreateRecruitmentPositionInput,
): Promise<RecruitmentPosition> {
  return apiFetch<RecruitmentPosition>("/recruitment-positions", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateRecruitmentPosition(
  id: string,
  input: UpdateRecruitmentPositionInput,
): Promise<RecruitmentPosition> {
  return apiFetch<RecruitmentPosition>(
    `/recruitment-positions/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
}

export function deleteRecruitmentPosition(
  id: string,
): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>(
    `/recruitment-positions/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
