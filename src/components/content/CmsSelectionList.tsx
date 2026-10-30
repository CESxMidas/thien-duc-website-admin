import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { DeleteContentButton } from "./DeleteContentButton";
import { canDeleteContent } from "@/lib/delete-permissions";
import {
  CmsSelectionContext,
  cmsRecordTitle,
  useCmsSelection,
} from "@/lib/cms-selection";
import type { CmsRecordKind } from "@/lib/api/cms-trash";

export function CmsSelectionList<T extends { id: string }>({
  kind,
  records,
  children,
  loading = false,
  scope = "",
  permanentOnly = false,
}: {
  kind: CmsRecordKind;
  records: T[];
  children: ReactNode;
  loading?: boolean;
  scope?: string;
  permanentOnly?: boolean;
}) {
  const { user } = useAuth();
  const available = canDeleteContent(user);
  const [busy, setBusy] = useState(false);
  const currentScope = `${kind}:${scope}:${user?.id ?? ""}`;
  const eligible =
    loading || !available
      ? []
      : records.filter((record) => {
          if (kind !== "users") return true;
          const role = "role" in record ? record.role : undefined;
          return (
            record.id !== user?.id &&
            (role !== "SUPER_ADMIN" || user?.role === "SUPER_ADMIN")
          );
        });
  const choices = eligible.map((record) => ({
    id: record.id,
    title: cmsRecordTitle(record),
  }));
  const allowedIds = new Set(choices.map((record) => record.id));
  const [selection, setSelection] = useState({
    scope: currentScope,
    ids: [] as string[],
  });
  const selectedIds =
    selection.scope === currentScope
      ? selection.ids.filter((id) => allowedIds.has(id))
      : [];
  // Điều chỉnh theo dữ liệu ngay khi đổi bộ lọc/trang/quyền, không để lựa chọn ẩn quay lại.
  if (
    selection.scope !== currentScope ||
    selectedIds.length !== selection.ids.length
  ) {
    setSelection({ scope: currentScope, ids: selectedIds });
  }
  function toggle(id?: string) {
    if (busy) return;
    setSelection({
      scope: currentScope,
      ids: id
        ? selectedIds.includes(id)
          ? selectedIds.filter((value) => value !== id)
          : allowedIds.has(id)
            ? [...selectedIds, id]
            : selectedIds
        : selectedIds.length === choices.length
          ? []
          : choices.map((record) => record.id),
    });
  }
  return (
    <CmsSelectionContext.Provider
      value={{ available, busy, records: choices, selectedIds, toggle }}
    >
      {available && choices.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-cream/60 px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <CmsSelectionCheckbox label="Chọn tất cả đang hiển thị" showLabel />
            <span
              role="status"
              aria-live="polite"
              className="text-sm text-slate"
            >
              Đã chọn {selectedIds.length}/{choices.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11"
              disabled={!selectedIds.length || busy}
              onClick={() => setSelection({ scope: currentScope, ids: [] })}
            >
              Bỏ chọn
            </Button>
            <DeleteContentButton
              kind={kind}
              id={selectedIds[0] ?? ""}
              title={`${selectedIds.length} mục đã chọn`}
              label="Xóa đã chọn"
              disabled={!selectedIds.length || busy}
              records={choices.filter((record) =>
                selectedIds.includes(record.id),
              )}
              permanentOnly={permanentOnly}
              onPendingChange={setBusy}
              onDeleted={(deletedIds) =>
                setSelection((current) => ({
                  ...current,
                  ids: current.ids.filter((id) => !deletedIds.includes(id)),
                }))
              }
            />
          </div>
        </div>
      )}
      {children}
    </CmsSelectionContext.Provider>
  );
}

export function CmsSelectionCheckbox({
  id,
  label,
  showLabel = false,
}: {
  id?: string;
  label?: string;
  showLabel?: boolean;
}) {
  const selection = useCmsSelection();
  const ref = useRef<HTMLInputElement>(null);
  const record = selection?.records.find((item) => item.id === id);
  const checked = id
    ? selection?.selectedIds.includes(id)
    : !!selection?.records.length &&
      selection.selectedIds.length === selection.records.length;
  const mixed = !id && !!selection?.selectedIds.length && !checked;
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  if (!selection?.available) return null;
  return (
    <label
      className="inline-flex min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md px-2 focus-within:ring-2 focus-within:ring-brand"
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={!!checked}
        aria-checked={mixed ? "mixed" : !!checked}
        disabled={selection.busy || (id ? !record : !selection.records.length)}
        aria-label={
          label ??
          (id ? `Chọn ${record?.title ?? "nội dung"}` : "Chọn tất cả các hàng")
        }
        onChange={() => selection.toggle(id)}
        className="size-4 shrink-0 accent-brand"
      />
      {showLabel && (
        <span className="text-sm font-medium text-ink">{label}</span>
      )}
    </label>
  );
}
