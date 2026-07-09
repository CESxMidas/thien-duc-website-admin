import type { CSSProperties, ReactNode } from "react";
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
   * Lớp thêm cho ô của cột. Ô mặc định `whitespace-nowrap`; cột chứa văn bản
   * dài (địa chỉ dự án) phải tự mở `whitespace-normal` kèm giới hạn bề rộng,
   * nếu không bảng bị đẩy rộng ra và sinh thanh cuộn ngang.
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
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  emptyText?: string;
  /** Có truyền thì hàng bấm được (mở chi tiết) — thêm cursor + hover ấm. */
  onRowClick?: (row: T) => void;
}) {
  return (
    // Không đặt `min-w-*` cho bảng: sàn bề rộng cứng khiến bảng luôn tràn ở
    // màn hình hẹp. Bảng co theo khung, cột dài tự xuống dòng; `overflow-x-auto`
    // của <Table> chỉ còn là lưới an toàn cho màn hình rất nhỏ.
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <Table>
        <TableHeader>
          <TableRow className="border-line bg-cream/60 hover:bg-cream/60">
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
            rows.map((row, index) => (
              <TableRow
                key={row.id}
                // Vào so le theo thứ tự hàng; giới hạn ở hàng thứ 8 để bảng dài
                // không bắt người dùng ngồi đợi hàng cuối xuất hiện.
                style={{ "--row-index": Math.min(index, 7) } as CSSProperties}
                className={`row-in border-line transition-colors duration-150 ${
                  onRowClick ? "cursor-pointer hover:bg-cream/50" : ""
                }`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
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
