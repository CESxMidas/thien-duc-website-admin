import type { ReactNode } from "react";
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
  render: (row: T) => ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  loading = false,
  emptyText = "Chưa có dữ liệu.",
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  /** Có truyền thì hàng bấm được (mở chi tiết) — thêm cursor + hover ấm. */
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <Table className="min-w-160">
        <TableHeader>
          <TableRow className="border-line bg-cream/60 hover:bg-cream/60">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={`text-[11px] font-semibold tracking-widest text-slate uppercase ${
                  col.hideOnMobile ? "hidden md:table-cell" : ""
                }`}
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
                colSpan={columns.length}
                className="py-10 text-center text-slate"
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                className={`border-line ${
                  onRowClick ? "cursor-pointer hover:bg-cream/50" : ""
                }`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={`text-ink ${
                      col.hideOnMobile ? "hidden md:table-cell" : ""
                    }`}
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
