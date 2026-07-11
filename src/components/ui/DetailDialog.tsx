// Modal xem chi tiết dùng chung cho các trang danh sách: bấm vào một hàng
// trong bảng để mở. Hiển thị dạng "nhãn — giá trị" xếp dọc, nhãn chữ hoa nhỏ
// theo phong cách hồ sơ, tách nhau bằng đường kẻ ấm.

import type { ReactNode } from "react";
import { SplitModal } from "@/components/ui/SplitModal";

export interface DetailField {
  label: string;
  value: ReactNode;
  /** Giá trị dài (đoạn văn) chiếm cả hàng thay vì nằm cạnh nhãn. */
  block?: boolean;
}

export function DetailList({ fields }: { fields: DetailField[] }) {
  return (
    <dl className="divide-y divide-line">
      {fields.map((f) =>
        f.block ? (
          <div key={f.label} className="py-3">
            <dt className="text-[11px] font-medium tracking-[0.12em] text-slate uppercase">
              {f.label}
            </dt>
            <dd className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-ink">
              {f.value}
            </dd>
          </div>
        ) : (
          <div
            key={f.label}
            className="flex items-center justify-between gap-4 py-2.5"
          >
            <dt className="shrink-0 text-[11px] font-medium tracking-[0.12em] text-slate uppercase">
              {f.label}
            </dt>
            <dd className="min-w-0 text-right text-sm text-ink">{f.value}</dd>
          </div>
        ),
      )}
    </dl>
  );
}

export function DetailDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  fields: DetailField[];
  footer?: ReactNode;
}) {
  return (
    <SplitModal
      open={open}
      onOpenChange={onOpenChange}
      size="default"
      title={title}
      description={description}
      footer={footer}
    >
      <DetailList fields={fields} />
    </SplitModal>
  );
}
