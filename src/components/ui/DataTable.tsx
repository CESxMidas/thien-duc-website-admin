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
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <Table className="min-w-160">
        <TableHeader>
          <TableRow className="bg-gray-50/80 hover:bg-gray-50/80">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={col.hideOnMobile ? "hidden md:table-cell" : ""}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                {columns.map((col) => (
                  <TableCell
                    key={col.key}
                    className={col.hideOnMobile ? "hidden md:table-cell" : ""}
                  >
                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
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
              <TableRow key={row.id}>
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
