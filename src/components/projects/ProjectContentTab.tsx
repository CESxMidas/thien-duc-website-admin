// Tab "Nội dung" của modal chi tiết dự án: sửa các khối nội dung phong phú lưu
// dạng JSON — điểm nổi bật (`highlights`), thông số nhanh (`quickFacts`) và bản
// đồ vị trí (`mapLocation`). Trước đây chỉ seed đặt được, admin không chạm tới.
//
// Một nút "Lưu nội dung" gửi cả ba khối qua PATCH /projects/:slug. Các nhãn/marker
// chi tiết của bản đồ (labels) giữ nguyên — chỉnh tọa độ từng nhãn không hợp làm
// trong form, để dành cho seed; ở đây chỉ sửa các trường chữ và ảnh nền.

import { useEffect, useState, type CSSProperties } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2, MapPin, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BilingualField } from "@/components/ui/BilingualField";
import { ImagePickerField } from "@/components/ui/ImagePickerField";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";
import { useUpdateProject } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { canEditProject } from "@/lib/content-editing";
import {
  emptyBilingual,
  toBilingualLoose,
  toBilingualPayload,
  toBilingualValue,
  type BilingualValue,
} from "@/lib/bilingual";
import type { Bilingual, ProjectDetail, ProjectMapLocation } from "@/types";

/** Quick-fact trong form: nhãn + giá trị đều song ngữ (EN-FULL-C3). */
type FactDraft = { label: BilingualValue; value: BilingualValue };

/**
 * Chuẩn hóa một field prose của bản đồ (EN-FULL-C5a) về payload song ngữ
 * `{ vi, en? }`. Rỗng cả hai ngôn ngữ → `undefined` (bỏ field thay vì lưu chuỗi
 * rỗng). Nhận cả dữ liệu cũ (chuỗi thuần) lẫn giá trị đang sửa trong form.
 */
function proseField(value?: Bilingual | string): Bilingual | undefined {
  const bl = toBilingualLoose(value);
  if (!bl.vi.trim() && !bl.en.trim()) return undefined;
  return toBilingualPayload(bl);
}

/** Đưa một phần tử trong mảng lên/xuống một bậc (trả về mảng mới). */
function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function ProjectContentTab({ project }: { project: ProjectDetail }) {
  const { user } = useAuth();
  const updateProject = useUpdateProject();
  const canEdit = canEditProject(user?.role, project);

  const [description, setDescription] = useState<BilingualValue>(emptyBilingual);
  const [highlights, setHighlights] = useState<BilingualValue[]>([]);
  const [facts, setFacts] = useState<FactDraft[]>([]);
  const [map, setMap] = useState<ProjectMapLocation | null>(null);

  // Nạp lại state mỗi khi đổi dự án (modal tái sử dụng cho nhiều dự án).
  useEffect(() => {
    setDescription(toBilingualValue(project.description));
    setHighlights((project.highlights ?? []).map(toBilingualValue));
    setFacts(
      (project.quickFacts ?? []).map((f) => ({
        label: toBilingualLoose(f.label),
        value: toBilingualLoose(f.value),
      })),
    );
    setMap(project.mapLocation ? { ...project.mapLocation } : null);
  }, [project]);

  async function onSave() {
    const payload = {
      // Chỉ gửi khi có nội dung tiếng Việt: `undefined` = không đụng tới bản
      // hiện có (không vô tình xóa). Gửi cả vi + en để không mất bản dịch.
      description: description.vi.trim()
        ? toBilingualPayload(description)
        : undefined,
      highlights: highlights
        .filter((h) => h.vi.trim())
        .map(toBilingualPayload),
      // Hàng tồn tại khi có nhãn hoặc giá trị tiếng Việt (VI là nguồn); gửi cả
      // vi + en của cả label lẫn value để không mất bản dịch đã nhập.
      quickFacts: facts
        .filter((f) => f.label.vi.trim() || f.value.vi.trim())
        .map((f) => ({
          label: toBilingualPayload(f.label),
          value: toBilingualPayload(f.value),
        })),
      // `null` xóa hẳn bản đồ. Ngược lại gửi nguyên object — labels + marker +
      // ảnh giữ nguyên — chỉ chuẩn hóa prose (heading/description/address) sang
      // song ngữ `{ vi, en? }` (EN-FULL-C5a); rỗng → bỏ hẳn field.
      mapLocation: map
        ? {
            ...map,
            heading: proseField(map.heading),
            description: proseField(map.description),
            address: proseField(map.address),
          }
        : null,
    };
    try {
      await updateProject.mutateAsync({
        slug: project.slug,
        // mapLocation có thể là null để xóa — backend nhận và ghi null.
        data: payload as Parameters<typeof updateProject.mutateAsync>[0]["data"],
      });
      toast.success("Đã lưu nội dung dự án.");
    } catch (error) {
      toast.error(resolveApiError(error, "Không lưu được nội dung. Vui lòng thử lại."));
    }
  }

  function patchMap(patch: Partial<ProjectMapLocation>) {
    setMap((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  return (
    <div className="space-y-6">
      {/* ------------------------ Mô tả tổng quan ------------------------ */}
      <section className="space-y-3">
        <div>
          <h3 className="font-display text-sm font-semibold text-ink">
            Mô tả tổng quan
          </h3>
        
        </div>
        <BilingualField
          multiline
          rows={5}
          value={description}
          onChange={setDescription}
          placeholder={{
            vi: "Giới thiệu tổng quan về quy mô, vị trí, hạ tầng và tiến độ dự án…",
            en: "An overview of the project's scale, location, infrastructure, and progress…",
          }}
        />
      </section>

      {/* -------------------------- Điểm nổi bật -------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">
              Điểm nổi bật
            </h3>
            
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHighlights([...highlights, { ...emptyBilingual }])}
          >
            <Plus className="size-4" /> Thêm dòng
          </Button>
        </div>

        {highlights.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-cream/40 py-4 text-center text-sm text-slate">
            Chưa có điểm nổi bật nào.
          </p>
        ) : (
          <ul className="space-y-2">
            {highlights.map((value, index) => (
              <li
                key={index}
                style={{ "--row-index": Math.min(index, 7) } as CSSProperties}
                className="row-in flex items-start gap-2 rounded-xl border border-line p-2"
              >
                <div className="flex-1">
                  <BilingualField
                    multiline
                    rows={2}
                    value={value}
                    onChange={(next) =>
                      setHighlights(
                        highlights.map((h, i) => (i === index ? next : h)),
                      )
                    }
                    placeholder={{
                      vi: "Mặt tiền đường lớn, sổ hồng lâu dài…",
                      en: "Main road frontage, long-term title…",
                    }}
                  />
                </div>
                <RowControls
                  onUp={() => setHighlights(move(highlights, index, -1))}
                  onDown={() => setHighlights(move(highlights, index, 1))}
                  onDelete={() =>
                    setHighlights(highlights.filter((_, i) => i !== index))
                  }
                  isFirst={index === 0}
                  isLast={index === highlights.length - 1}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------- Thông số nhanh ------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">
              Thông số nhanh
            </h3>
            
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setFacts([
                ...facts,
                { label: { ...emptyBilingual }, value: { ...emptyBilingual } },
              ])
            }
          >
            <Plus className="size-4" /> Thêm dòng
          </Button>
        </div>

        {facts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line bg-cream/40 py-4 text-center text-sm text-slate">
            Chưa có thông số nào.
          </p>
        ) : (
          <ul className="space-y-2">
            {facts.map((fact, index) => (
              <li
                key={index}
                style={{ "--row-index": Math.min(index, 7) } as CSSProperties}
                className="row-in flex items-start gap-2 rounded-xl border border-line p-2"
              >
                <div className="flex-1 space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-slate">Nhãn</Label>
                    <BilingualField
                      value={fact.label}
                      onChange={(next) =>
                        setFacts(
                          facts.map((f, i) =>
                            i === index ? { ...f, label: next } : f,
                          ),
                        )
                      }
                      placeholder={{ vi: "Tổng diện tích", en: "Total area" }}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate">Giá trị</Label>
                    <BilingualField
                      multiline
                      rows={2}
                      value={fact.value}
                      onChange={(next) =>
                        setFacts(
                          facts.map((f, i) =>
                            i === index ? { ...f, value: next } : f,
                          ),
                        )
                      }
                      placeholder={{ vi: "11,25 ha", en: "11.25 ha" }}
                    />
                  </div>
                </div>
                <RowControls
                  onUp={() => setFacts(move(facts, index, -1))}
                  onDown={() => setFacts(move(facts, index, 1))}
                  onDelete={() => setFacts(facts.filter((_, i) => i !== index))}
                  isFirst={index === 0}
                  isLast={index === facts.length - 1}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --------------------------- Bản đồ ------------------------------ */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">
              Bản đồ vị trí
            </h3>
            <p className="text-xs text-slate">
              Ảnh nền + link Google Maps hiện ở cuối trang chi tiết.
            </p>
          </div>
          {map ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setMap(null)}
            >
              <Trash2 className="size-4" /> Bỏ bản đồ
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setMap({
                  image: "",
                  googleMapsUrl: "",
                  markerLeft: 50,
                  markerTop: 50,
                  labels: [],
                })
              }
            >
              <MapPin className="size-4" /> Thêm bản đồ
            </Button>
          )}
        </div>

        {map && (
          <div className="space-y-3 rounded-xl border border-line bg-cream/40 p-4">
            <div className="space-y-1.5">
              <Label>Ảnh nền bản đồ</Label>
              <ImagePickerField
                value={map.image}
                onChange={(url) => patchMap({ image: url })}
                folder="projects"
                aspect="16/9"
                alt="Ảnh nền bản đồ"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-url">Link Google Maps</Label>
              <Input
                id="map-url"
                value={map.googleMapsUrl}
                onChange={(e) => patchMap({ googleMapsUrl: e.target.value })}
                placeholder="https://www.google.com/maps/…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-heading">Tiêu đề</Label>
              <BilingualField
                id="map-heading"
                value={toBilingualLoose(map.heading)}
                onChange={(next) => patchMap({ heading: next })}
                placeholder={{
                  vi: "Tọa lạc tại trung tâm thành phố…",
                  en: "Located in the heart of the city…",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-desc">Mô tả</Label>
              <BilingualField
                id="map-desc"
                multiline
                rows={2}
                value={toBilingualLoose(map.description)}
                onChange={(next) => patchMap({ description: next })}
                placeholder={{
                  vi: "Vài câu mô tả vị trí, tiện ích xung quanh…",
                  en: "A few sentences about the location and nearby amenities…",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-address">Địa chỉ</Label>
              <BilingualField
                id="map-address"
                value={toBilingualLoose(map.address)}
                onChange={(next) => patchMap({ address: next })}
                placeholder={{
                  vi: "Phường …, thành phố …, tỉnh …",
                  en: "… Ward, … City, … Province",
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="map-left">Vị trí marker – ngang (%)</Label>
                <Input
                  id="map-left"
                  type="number"
                  min={0}
                  max={100}
                  value={map.markerLeft}
                  onChange={(e) =>
                    patchMap({ markerLeft: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="map-top">Vị trí marker – dọc (%)</Label>
                <Input
                  id="map-top"
                  type="number"
                  min={0}
                  max={100}
                  value={map.markerTop}
                  onChange={(e) =>
                    patchMap({ markerTop: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            {map.labels && map.labels.length > 0 && (
              <p className="text-xs text-slate">
                Có {map.labels.length} nhãn chữ trên bản đồ — giữ nguyên khi lưu.
                Chỉnh chi tiết từng nhãn thực hiện qua seed.
              </p>
            )}
          </div>
        )}
      </section>

      {/* Tab này lưu qua ĐÚNG route `PATCH /projects/:slug` như nút "Sửa dự án",
          nên phải chịu cùng một chốt quyền: EDITOR không lưu được nội dung của
          dự án đã xuất bản (backend trả 403). Vẫn cho ĐỌC — chỉ khoá nút lưu và
          nói rõ vì sao, thay vì để người dùng nhập xong mới gặp lỗi. */}
      <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
        {!canEdit && (
          <p className="text-xs text-slate">
            Dự án đã xuất bản — chỉ quản trị viên sửa được nội dung.
          </p>
        )}
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={updateProject.isPending || !canEdit}
        >
          {updateProject.isPending && <Loader2 className="size-4 animate-spin" />}
          Lưu nội dung
        </Button>
      </div>
    </div>
  );
}

/** Nút lên / xuống / xóa dùng chung cho các hàng có thể sắp xếp. */
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
