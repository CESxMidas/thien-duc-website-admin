import { Link } from "react-router-dom";

export function ForbiddenPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="text-5xl font-bold text-brand">403</p>
        <p className="mt-2 text-slate">
          Bạn không có quyền truy cập trang này.
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Về Tổng quan
        </Link>
      </div>
    </div>
  );
}
