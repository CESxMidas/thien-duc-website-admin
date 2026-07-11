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
import { Textarea } from "@/components/ui/textarea";
import { useUpdateProject } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import {
  emptyBilingual,
  toBilingualPayload,
  toBilingualValue,
  type BilingualValue,
} from "@/lib/bilingual";
import type {
  ProjectDetail,
  ProjectFact,
  ProjectMapLocation,
} from "@/types";

/** Đưa một phần tử trong mảng lên/xuống một bậc (trả về mảng mới). */
function move<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function ProjectContentTab({ project }: { project: ProjectDetail }) {
  const updateProject = useUpdateProject();

  const [highlights, setHighlights] = useState<BilingualValue[]>([]);
  const [facts, setFacts] = useState<ProjectFact[]>([]);
  const [map, setMap] = useState<ProjectMapLocation | null>(null);

  // Nạp lại state mỗi khi đổi dự án (modal tái sử dụng cho nhiều dự án).
  useEffect(() => {
    setHighlights((project.highlights ?? []).map(toBilingualValue));
    setFacts((project.quickFacts ?? []).map((f) => ({ ...f })));
    setMap(project.mapLocation ? { ...project.mapLocation } : null);
  }, [project]);

  async function onSave() {
    const payload = {
      highlights: highlights
        .filter((h) => h.vi.trim())
        .map(toBilingualPayload),
      quickFacts: facts
        .filter((f) => f.label.trim() || f.value.trim())
        .map((f) => ({ label: f.label.trim(), value: f.value.trim() })),
      // `null` xóa hẳn bản đồ; object thì gửi nguyên (kể cả labels giữ nguyên).
      mapLocation: map,
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
      {/* -------------------------- Điểm nổi bật -------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-display text-sm font-semibold text-ink">
              Điểm nổi bật
            </h3>
            <p className="text-xs text-slate">
              Gạch đầu dòng hiện ở trang chi tiết dự án.
            </p>
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
            <p className="text-xs text-slate">
              Cặp nhãn – giá trị, ví dụ “Tổng diện tích – 11,25 ha”.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setFacts([...facts, { label: "", value: "" }])}
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
                className="row-in flex items-center gap-2 rounded-xl border border-line p-2"
              >
                <Input
                  className="w-40 shrink-0"
                  value={fact.label}
                  onChange={(e) =>
                    setFacts(
                      facts.map((f, i) =>
                        i === index ? { ...f, label: e.target.value } : f,
                      ),
                    )
                  }
                  placeholder="Nhãn"
                />
                <Input
                  className="flex-1"
                  value={fact.value}
                  onChange={(e) =>
                    setFacts(
                      facts.map((f, i) =>
                        i === index ? { ...f, value: e.target.value } : f,
                      ),
                    )
                  }
                  placeholder="Giá trị"
                />
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
              <Input
                id="map-heading"
                value={map.heading ?? ""}
                onChange={(e) => patchMap({ heading: e.target.value })}
                placeholder="Tọa lạc tại trung tâm thành phố…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-desc">Mô tả</Label>
              <Textarea
                id="map-desc"
                rows={2}
                value={map.description ?? ""}
                onChange={(e) => patchMap({ description: e.target.value })}
                placeholder="Vài câu mô tả vị trí, tiện ích xung quanh…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="map-address">Địa chỉ</Label>
              <Input
                id="map-address"
                value={map.address ?? ""}
                onChange={(e) => patchMap({ address: e.target.value })}
                placeholder="Phường …, thành phố …, tỉnh …"
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

      <div className="flex justify-end border-t border-line pt-4">
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={updateProject.isPending}
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
