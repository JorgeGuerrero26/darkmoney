import { ChevronLeft, ChevronRight } from "lucide-react";

type PaginationProps = {
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  className?: string;
};

const numberFormatter = new Intl.NumberFormat("es-PE");

export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  className = "",
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const firstItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem = Math.min(safePage * pageSize, totalItems);

  if (totalItems <= pageSize) {
    return null;
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <p className="text-xs text-storm">
        Mostrando {numberFormatter.format(firstItem)}–{numberFormatter.format(lastItem)} de{" "}
        {numberFormatter.format(totalItems)}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          aria-label="Página anterior"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-storm transition duration-200 hover:border-white/16 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}
          type="button"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[5.5rem] text-center text-xs font-semibold text-ink">
          {safePage} / {totalPages}
        </span>
        <button
          aria-label="Página siguiente"
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-storm transition duration-200 hover:border-white/16 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}
          type="button"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
