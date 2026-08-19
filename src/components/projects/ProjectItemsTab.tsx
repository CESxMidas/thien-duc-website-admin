// Tab "Hạng mục" của modal chi tiết dự án: các hạng mục con (`project_items`)
// như Fancy Tower, Hưng Phú Mall nằm trong Khu đô thị Hưng Phú.
//
// Form thêm/sửa hiện ngay trong tab thay vì mở thêm một dialog lồng — modal chi
// tiết đã là một lớp rồi, chồng thêm lớp nữa khiến người dùng mất dấu.

import { useState, type CSSProperties } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BilingualField } from "@/components/ui/BilingualField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import {
  useCreateProjectItem,
  useDeleteProjectItem,
  useUpdateProjectItem,
} from "@/lib/api/queries";
import type { CreateProjectItemInput } from "@/lib/api/projects";
import { resolveApiError } from "@/lib/api-error-message";
import {
  emptyBilingual,
  toBilingualLoose,
  toBilingualPayload,
  toBilingualValue,
  type BilingualValue,
} from "@/lib/bilingual";
import { canEditPublishableContent } from "@/lib/content-editing";
import { projectStatusLabel } from "@/lib/labels";
import type { ProjectDetail, ProjectItem, ProjectStatus } from "@/types";

/** Hạng mục có thể không đặt tình trạng riêng — khi đó lấy theo dự án cha. */
const INHERIT_STATUS = "__inherit__";

const statusOptions = Object.keys(projectStatusLabel) as ProjectStatus[];

interface HighlightDraft {
  id: string;
  value: BilingualValue;
}

interface FactDraft {
  id: string;
  label: BilingualValue;
  value: BilingualValue;
}

interface ItemFormState {
  slug: string;
  title: BilingualValue;
  summary: BilingualValue;
  description: BilingualValue;
  highlights: HighlightDraft[];
  quickFacts: FactDraft[];
  status: string;
  image: string;
}

interface ContentDirtyState {
  description: boolean;
  highlights: boolean;
  quickFacts: boolean;
}

const CLEAN_CONTENT: ContentDirtyState = {
  description: false,
  highlights: false,
  quickFacts: false,
};

let draftId = 0;

function nextDraftId(prefix: "highlight" | "fact"): string {
  draftId += 1;
  return `${prefix}-${draftId}`;
}

function emptyForm(): ItemFormState {
  return {
    slug: "",
    title: { ...emptyBilingual },
    summary: { ...emptyBilingual },
    description: { ...emptyBilingual },
    highlights: [],
    quickFacts: [],
    status: INHERIT_STATUS,
    image: "",
  };
}

function toFormState(item: ProjectItem): ItemFormState {
  return {
    slug: item.slug,
    title: toBilingualValue(item.title),
    summary: toBilingualValue(item.summary),
    description: toBilingualLoose(item.description),
    highlights: (item.highlights ?? []).map((value) => ({
      id: nextDraftId("highlight"),
      value: toBilingualLoose(value),
    })),
    quickFacts: (item.quickFacts ?? []).map((fact) => ({
      id: nextDraftId("fact"),
      label: toBilingualLoose(fact.label),
      value: toBilingualLoose(fact.value),
    })),
    status: item.status ?? INHERIT_STATUS,
    image: item.image ?? "",
  };
}

/** Đưa một phần tử trong mảng lên/xuống một bậc mà không sửa mảng gốc. */
function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function hasBilingualContent(value: BilingualValue): boolean {
  return Boolean(value.vi.trim() || value.en.trim());
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;

export function ProjectItemsTab({ project }: { project: ProjectDetail }) {
  const { user } = useAuth();
  const createItem = useCreateProjectItem();
  const updateItem = useUpdateProjectItem();
  const deleteItem = useDeleteProjectItem();

  // Chỉ ADMIN trở lên xóa được hạng mục (backend cũng chặn) — ẩn nút cho EDITOR.
  const canDelete = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  // Hạng mục hiển thị công khai VÌ dự án cha hiển thị công khai, nên quyền sửa
  // nó thừa hưởng luật của cha: EDITOR mất quyền khi dự án đã xuất bản (backend
  // trả 403 trên mọi route hạng mục). Vẫn cho ĐỌC danh sách.
  const canEdit = canEditPublishableContent(user?.role, project.contentStatus);

  /** null = đóng form; "" = đang thêm mới; slug = đang sửa hạng mục đó. */
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState<ItemFormState>(emptyForm);
  const [contentDirty, setContentDirty] =
    useState<ContentDirtyState>(CLEAN_CONTENT);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ProjectItem | null>(null);

  const isEdit = editingSlug !== null && editingSlug !== "";
  const saving = createItem.isPending || updateItem.isPending;

  function openCreate() {
    setForm(emptyForm());
    setContentDirty(CLEAN_CONTENT);
    setError(null);
    setEditingSlug("");
  }

  function openEdit(item: ProjectItem) {
    setForm(toFormState(item));
    setContentDirty(CLEAN_CONTENT);
    setError(null);
    setEditingSlug(item.slug);
  }

  function closeForm() {
    setEditingSlug(null);
    setContentDirty(CLEAN_CONTENT);
    setError(null);
  }

  function editDescription(description: BilingualValue) {
    setForm((current) => ({ ...current, description }));
    setContentDirty((current) => ({ ...current, description: true }));
  }

  function editHighlights(
    updater: (current: HighlightDraft[]) => HighlightDraft[],
  ) {
    setForm((current) => ({
      ...current,
      highlights: updater(current.highlights),
    }));
    setContentDirty((current) => ({ ...current, highlights: true }));
  }

  function editQuickFacts(updater: (current: FactDraft[]) => FactDraft[]) {
    setForm((current) => ({
      ...current,
      quickFacts: updater(current.quickFacts),
    }));
    setContentDirty((current) => ({ ...current, quickFacts: true }));
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    if (form.title.vi.trim().length < 3) {
      setError("Tên hạng mục tối thiểu 3 ký tự.");
      return;
    }
    if (!SLUG_PATTERN.test(form.slug)) {
      setError("Slug chỉ gồm chữ thường, số và dấu gạch ngang.");
      return;
    }
    setError(null);

    // `PATCH` ghi đè nguyên field JSON, nên phải gửi lại **cả hai** ngôn ngữ —
    // trước đây chỉ gửi `{ vi }` nên mỗi lần sửa là bản dịch tiếng Anh biến mất.
    const summary = toBilingualPayload(form.summary);
    const payload: CreateProjectItemInput = {
      slug: form.slug,
      title: toBilingualPayload(form.title),
      ...(summary.vi && { summary }),
      ...(form.status !== INHERIT_STATUS && {
        status: form.status as ProjectStatus,
      }),
      ...(form.image.trim() && { image: form.image.trim() }),
    };

    if (contentDirty.description) {
      payload.description = toBilingualPayload(form.description);
    }
    if (contentDirty.highlights) {
      payload.highlights = form.highlights
        .filter((highlight) => hasBilingualContent(highlight.value))
        .map((highlight) => toBilingualPayload(highlight.value));
    }
    if (contentDirty.quickFacts) {
      payload.quickFacts = form.quickFacts
        .filter(
          (fact) =>
            hasBilingualContent(fact.label) || hasBilingualContent(fact.value),
        )
        .map((fact) => ({
          label: toBilingualPayload(fact.label),
          value: toBilingualPayload(fact.value),
        }));
    }

    try {
      if (isEdit) {
        await updateItem.mutateAsync({
          slug: project.slug,
          itemSlug: editingSlug,
          data: payload,
        });
        toast.success("Đã lưu hạng mục.");
      } else {
        await createItem.mutateAsync({ slug: project.slug, data: payload });
        toast.success(`Đã thêm hạng mục "${form.title.vi.trim()}".`);
      }
      closeForm();
    } catch (err) {
      toast.error(
        resolveApiError(err, "Không lưu được hạng mục. Vui lòng thử lại."),
      );
    }
  }

  async function onConfirmDelete() {
    if (!toDelete) return;
    try {
      await deleteItem.mutateAsync({
        slug: project.slug,
        itemSlug: toDelete.slug,
      });
      toast.success("Đã xóa hạng mục.");
      setToDelete(null);
    } catch (err) {
      toast.error(
        resolveApiError(err, "Không xóa được hạng mục. Vui lòng thử lại."),
      );
    }
  }

  return (
    <div className="space-y-4">
      {!canEdit && (
        <p className="rounded-lg border border-line bg-cream/40 px-3 py-2 text-xs text-slate">
          Dự án đã xuất bản — chỉ quản trị viên sửa được hạng mục.
        </p>
      )}

      {editingSlug === null ? (
        canEdit && (
          <Button variant="outline" onClick={openCreate}>
            <Plus className="size-4" /> Thêm hạng mục
          </Button>
        )
      ) : (
        <form
          onSubmit={onSave}
          className="rise-in space-y-3 rounded-xl border border-line bg-cream/40 p-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-ink">
              {isEdit ? "Sửa hạng mục" : "Hạng mục mới"}
            </h3>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Đóng form"
              onClick={closeForm}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="item-title">Tên hạng mục</Label>
              <BilingualField
                id="item-title"
                value={form.title}
                onChange={(title) => setForm({ ...form, title })}
                placeholder={{
                  vi: "Chung cư Fancy Tower",
                  en: "Fancy Tower apartments",
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-slug">Slug</Label>
              <Input
                id="item-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="fancy-tower"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-summary">Mô tả ngắn</Label>
            <BilingualField
              id="item-summary"
              multiline
              rows={2}
              value={form.summary}
              onChange={(summary) => setForm({ ...form, summary })}
            />
          </div>

          <section className="space-y-2 border-t border-line pt-4">
            <div>
              <h4 className="font-display text-sm font-semibold text-ink">
                Mô tả chi tiết
              </h4>
              <p className="text-xs text-slate">
                Nội dung tổng quan trên trang chi tiết hạng mục.
              </p>
            </div>
            <BilingualField
              multiline
              rows={5}
              value={form.description}
              onChange={editDescription}
              placeholder={{
                vi: "Giới thiệu quy mô, tiện ích và tiến độ của hạng mục…",
                en: "An overview of the item's scale, amenities, and progress…",
              }}
            />
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-sm font-semibold text-ink">
                  Điểm nổi bật
                </h4>
                <p className="text-xs text-slate">
                  Các gạch đầu dòng trên trang chi tiết hạng mục.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  editHighlights((current) => [
                    ...current,
                    {
                      id: nextDraftId("highlight"),
                      value: { ...emptyBilingual },
                    },
                  ])
                }
              >
                <Plus className="size-4" /> Thêm dòng
              </Button>
            </div>

            {form.highlights.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-cream/40 py-4 text-center text-sm text-slate">
                Chưa có điểm nổi bật nào.
              </p>
            ) : (
              <ul className="space-y-2">
                {form.highlights.map((highlight, index) => (
                  <li
                    key={highlight.id}
                    style={
                      { "--row-index": Math.min(index, 7) } as CSSProperties
                    }
                    className="row-in flex items-start gap-2 rounded-lg border border-line p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <BilingualField
                        multiline
                        rows={2}
                        value={highlight.value}
                        onChange={(value) =>
                          editHighlights((current) =>
                            current.map((row) =>
                              row.id === highlight.id ? { ...row, value } : row,
                            ),
                          )
                        }
                        placeholder={{
                          vi: "Tiện ích nội khu đã vận hành…",
                          en: "On-site amenities are in operation…",
                        }}
                      />
                    </div>
                    <RowControls
                      onUp={() =>
                        editHighlights((current) => move(current, index, -1))
                      }
                      onDown={() =>
                        editHighlights((current) => move(current, index, 1))
                      }
                      onDelete={() =>
                        editHighlights((current) =>
                          current.filter((row) => row.id !== highlight.id),
                        )
                      }
                      isFirst={index === 0}
                      isLast={index === form.highlights.length - 1}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 border-t border-line pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-display text-sm font-semibold text-ink">
                  Thông số nhanh
                </h4>
                <p className="text-xs text-slate">
                  Cặp nhãn và giá trị song ngữ, ví dụ “Quy mô – 5 tầng”.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  editQuickFacts((current) => [
                    ...current,
                    {
                      id: nextDraftId("fact"),
                      label: { ...emptyBilingual },
                      value: { ...emptyBilingual },
                    },
                  ])
                }
              >
                <Plus className="size-4" /> Thêm dòng
              </Button>
            </div>

            {form.quickFacts.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line bg-cream/40 py-4 text-center text-sm text-slate">
                Chưa có thông số nào.
              </p>
            ) : (
              <ul className="space-y-2">
                {form.quickFacts.map((fact, index) => (
                  <li
                    key={fact.id}
                    style={
                      { "--row-index": Math.min(index, 7) } as CSSProperties
                    }
                    className="row-in flex items-start gap-2 rounded-lg border border-line p-2"
                  >
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate">Nhãn</Label>
                        <BilingualField
                          value={fact.label}
                          onChange={(label) =>
                            editQuickFacts((current) =>
                              current.map((row) =>
                                row.id === fact.id ? { ...row, label } : row,
                              ),
                            )
                          }
                          placeholder={{ vi: "Quy mô", en: "Scale" }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate">Giá trị</Label>
                        <BilingualField
                          multiline
                          rows={2}
                          value={fact.value}
                          onChange={(value) =>
                            editQuickFacts((current) =>
                              current.map((row) =>
                                row.id === fact.id ? { ...row, value } : row,
                              ),
                            )
                          }
                          placeholder={{ vi: "5 tầng", en: "5 floors" }}
                        />
                      </div>
                    </div>
                    <RowControls
                      onUp={() =>
                        editQuickFacts((current) => move(current, index, -1))
                      }
                      onDown={() =>
                        editQuickFacts((current) => move(current, index, 1))
                      }
                      onDelete={() =>
                        editQuickFacts((current) =>
                          current.filter((row) => row.id !== fact.id),
                        )
                      }
                      isFirst={index === 0}
                      isLast={index === form.quickFacts.length - 1}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Tình trạng</Label>
              <Select
                value={form.status}
                onValueChange={(status) => setForm({ ...form, status })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={INHERIT_STATUS}>
                    Theo dự án ({projectStatusLabel[project.status]})
                  </SelectItem>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {projectStatusLabel[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ảnh chính của hạng mục</Label>
              <ImagePickerField
                value={form.image}
                onChange={(image) => setForm({ ...form, image })}
                folder="projects"
                aspect="3/2"
                alt="Ảnh chính hạng mục"
              />
              <p className="text-xs text-slate/80">
                Ảnh con của hạng mục: thêm ở cột ảnh, chọn “Thuộc hạng mục”.
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
              disabled={saving}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Lưu hạng mục" : "Thêm hạng mục"}
            </Button>
          </div>
        </form>
      )}

      {project.items.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate">
          Dự án chưa có hạng mục con nào.
        </p>
      ) : (
        <ul className="space-y-2">
          {project.items.map((item, index) => (
            <li
              key={item.id}
              style={{ "--row-index": Math.min(index, 7) } as CSSProperties}
              className="row-in flex items-center gap-3 rounded-xl border border-line p-3 transition-colors duration-150 hover:border-line-strong"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {item.title.vi}
                </p>
                <p className="truncate text-xs text-slate">
                  /{item.slug}
                  {" · "}
                  {item.status
                    ? projectStatusLabel[item.status]
                    : `Theo dự án (${projectStatusLabel[project.status]})`}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(item)}
                  >
                    <Pencil className="size-4" /> Sửa
                  </Button>
                )}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Xóa hạng mục"
                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setToDelete(item)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Xóa hạng mục "${toDelete?.title.vi ?? ""}"?`}
        description="Ảnh đang gắn với hạng mục này sẽ trở về cấp dự án. Thao tác không hoàn tác được."
        confirmLabel="Xóa hạng mục"
        submitting={deleteItem.isPending}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
}

/** Nút lên / xuống / xóa cho các hàng nội dung có thể sắp xếp. */
function RowControls({
  onUp,
  onDown,
  onDelete,
  isFirst,
  isLast,
}: {
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Đưa lên trước"
        disabled={isFirst}
        onClick={onUp}
      >
        <ChevronUp className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Đưa xuống sau"
        disabled={isLast}
        onClick={onDown}
      >
        <ChevronDown className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="Xóa dòng"
        className="text-red-600 hover:bg-red-50 hover:text-red-700"
        onClick={onDelete}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
