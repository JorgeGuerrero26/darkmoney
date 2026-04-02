import { Check, ChevronDown, X } from "lucide-react";
import type { ReactNode } from "react";

import { useOutsidePointerClose } from "../../hooks/use-outside-pointer-close";

export const tableColumnFilterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a]";

type TableColumnFilterMenuProps = {
  label: string;
  active: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onClear: () => void;
  align?: "left" | "right";
  minWidthClassName?: string;
  triggerClassName?: string;
  children: ReactNode;
};

export function TableFilterOptionButton({
  children,
  onClick,
  selected,
}: {
  children: ReactNode;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center justify-between gap-3 rounded-[16px] border px-3 py-2.5 text-left text-sm transition ${
        selected
          ? "border-pine/30 bg-pine/10 text-ink"
          : "border-white/10 bg-white/[0.03] text-storm hover:border-white/16 hover:text-ink"
      }`}
      onClick={onClick}
      type="button"
    >
      <span>{children}</span>
      {selected ? <Check className="h-4 w-4 shrink-0 text-pine" /> : null}
    </button>
  );
}

export function TableColumnFilterMenu({
  active,
  align = "left",
  children,
  isOpen,
  label,
  minWidthClassName = "min-w-[240px]",
  onClear,
  onClose,
  onToggle,
  triggerClassName = "",
}: TableColumnFilterMenuProps) {
  const containerRef = useOutsidePointerClose(isOpen, onClose, true);

  return (
    <div className={`relative ${isOpen ? "z-30" : ""}`} ref={containerRef}>
      <button
        className={`group inline-flex w-full items-center gap-2 rounded-xl px-2 py-1.5 transition ${
          active || isOpen ? "text-ink" : "text-storm/80 hover:text-ink"
        } ${triggerClassName || "justify-between text-left"}`}
        onClick={onToggle}
        type="button"
      >
        <span className="truncate">{label}</span>
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${
            active || isOpen
              ? "border-pine/30 bg-pine/10 text-pine"
              : "border-white/10 bg-white/[0.04] text-storm/80 group-hover:border-white/16 group-hover:text-ink"
          }`}
        >
          <ChevronDown className={`h-3 w-3 transition ${isOpen ? "rotate-180" : ""}`} />
        </span>
      </button>

      {isOpen ? (
        <div
          className={`absolute top-full mt-2 isolate ${minWidthClassName} overflow-hidden rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(9,14,24,0.96),rgba(6,10,18,0.985))] p-3 shadow-[0_28px_90px_rgba(0,0,0,0.58),inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(9,14,24,0.9),rgba(6,10,18,0.95))] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="mb-3 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
            <div className="min-w-0">
              <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-storm/80">
                Filtrar
              </p>
              <p className="mt-1 text-sm font-medium text-ink">{label}</p>
            </div>
            {active ? (
              <button
                className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[0.68rem] font-medium text-storm transition hover:border-white/16 hover:text-ink"
                onClick={onClear}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
                Limpiar
              </button>
            ) : null}
          </div>
          {children}
        </div>
      ) : null}
    </div>
  );
}
