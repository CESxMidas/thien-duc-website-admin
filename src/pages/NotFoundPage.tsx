import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <p className="text-5xl font-bold text-brand">404</p>
        <p className="mt-2 text-slate">Không tìm thấy trang.</p>
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
