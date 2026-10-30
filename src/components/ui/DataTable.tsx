import type { CSSProperties, ReactNode } from "react";
import {
  CmsSelectionList,
  CmsSelectionCheckbox,
} from "@/components/content/CmsSelectionList";
import { cmsRecordTitle, useCmsSelection } from "@/lib/cms-selection";
import type { CmsRecordKind } from "@/lib/api/cms-trash";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface Column<T> {
  key: string;
  header: string;
  /** Ẩn cột trên màn hình hẹp. */
  hideOnMobile?: boolean;
  /**
   * Lớp thêm cho ô của cột khi cần canh phải, ẩn mobile, hoặc giới hạn dòng.
   */
  cellClassName?: string;
  /** Lớp thêm cho ô tiêu đề — dùng khi cần canh phải cho khớp nội dung ô. */
  headerClassName?: string;
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading = false,
  emptyText = "Chưa có dữ liệu.",
  onRowClick,
  minWidth,
  layout = "fixed",
  deletionKind,
  deletionScope,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  /** Có truyền thì hàng bấm được (mở chi tiết) — thêm cursor + hover ấm. */
  onRowClick?: (row: T) => void;
  /** Bảng nhiều thao tác được cuộn ngang trong khung, giữ nút trên một hàng. */
  minWidth?: number;
  /** Tự cân đối cột theo nội dung, dùng cho bảng có nhóm nút không xuống hàng. */
  layout?: "fixed" | "auto";
  deletionKind?: CmsRecordKind;
  deletionScope?: string;
}) {
  const selection = useCmsSelection();
  if (deletionKind)
    return (
      <CmsSelectionList
        kind={deletionKind}
        records={rows}
        loading={loading}
        scope={deletionScope}
      >
        <DataTable
          columns={columns}
          rows={rows}
          loading={loading}
          emptyText={emptyText}
          onRowClick={onRowClick}
          minWidth={minWidth}
          layout={layout}
        />
      </CmsSelectionList>
    );
  const selectable = selection?.available === true;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <Table
        className={layout === "auto" ? "table-auto" : undefined}
        style={minWidth ? { minWidth } : undefined}
      >
        <TableHeader>
          <TableRow className="border-line bg-cream/60 hover:bg-cream/60">
            {selectable && (
              <TableHead className="w-14 px-1">
                <CmsSelectionCheckbox />
              </TableHead>
            )}
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`text-[11px] font-semibold tracking-widest text-slate uppercase ${
                  col.hideOnMobile ? "hidden md:table-cell" : ""
                } ${col.headerClassName ?? ""}`}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i} className="border-line">
                {selectable && <TableCell className="w-14" />}
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={col.hideOnMobile ? "hidden md:table-cell" : ""}
                  >
                    <div className="h-4 w-3/4 animate-pulse rounded bg-cream" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={columns.length + (selectable ? 1 : 0)}
                className="py-10 text-center text-slate"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, index) => (
              <TableRow
                key={row.id}
                // Vào so le theo thứ tự hàng; giới hạn ở hàng thứ 8 để bảng dài
                // không bắt người dùng ngồi đợi hàng cuối xuất hiện.
                style={{ "--row-index": Math.min(index, 7) } as CSSProperties}
                className={`row-in border-line transition-colors duration-150 ${selection?.selectedIds.includes(row.id) ? "bg-cream/70" : ""} ${
                  onRowClick ? "cursor-pointer hover:bg-cream/50" : ""
                }`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {selectable && (
                  <TableCell className="w-14 px-1">
                    <CmsSelectionCheckbox id={row.id} label={`Chọn ${cmsRecordTitle(row)}`} />
                  </TableCell>
                )}
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={`text-ink ${
                      col.hideOnMobile ? "hidden md:table-cell" : ""
                    } ${col.cellClassName ?? ""}`}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
