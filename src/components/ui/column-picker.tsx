import { SlidersHorizontal } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useUserPreferences } from "../../modules/notifications/user-preferences-context";
import { Button } from "./button";

export type ColumnDef = {
  key: string;
  label: string;
  defaultVisible?: boolean;
};

export function useColumnVisibility(storageKey: string, columns: ColumnDef[]) {
  const { columnVisibility, setColumnVisibility } = useUserPreferences();

  const storedForKey = columnVisibility[storageKey];
  const visible: Record<string, boolean> = Object.fromEntries(
    columns.map((c) => [c.key, storedForKey?.[c.key] ?? (c.defaultVisible !== false)]),
  );

  function toggle(colKey: string) {
    const next = { ...visible, [colKey]: !visible[colKey] };
    setColumnVisibility(storageKey, next);
  }

  function cv(key: string, responsiveClass = "") {
    return visible[key] ? responsiveClass : "hidden";
  }

  return { visible, toggle, cv };
}

export function ColumnPicker({
  columns,
  visible,
  onToggle,
  appearance = "default",
}: {
  columns: ColumnDef[];
  visible: Record<string, boolean>;
  onToggle: (key: string) => void;
  appearance?: "default" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const isCompact = appearance === "compact";

  function handleOpen() {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      const dropdownWidth = 208; // w-52
      const rawRight = window.innerWidth - rect.right;
      const clampedRight = Math.max(8, Math.min(rawRight, window.innerWidth - dropdownWidth - 8));
      setPos({ top: rect.bottom + 8, right: clampedRight });
    }
    setOpen((v) => !v);
  }

  useEffect(() => {
    if (!open) return;
    function onScroll() { setOpen(false); }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open]);

  return (
    <div className="relative" ref={wrapperRef}>
      {isCompact ? (
        <button
          aria-expanded={open}
          aria-label="Configurar columnas visibles"
          className="flex h-11 w-11 items-center justify-center rounded-[7px] border border-white/[0.08] bg-[#1a1917] text-storm transition hover:border-white/[0.14] hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/30"
          onClick={handleOpen}
          type="button"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      ) : (
        <Button
          aria-expanded={open}
          aria-label="Configurar columnas visibles"
          onClick={handleOpen}
          variant="ghost"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      )}
      {open ? createPortal(
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[200]"
            onClick={() => setOpen(false)}
          />
          <div
            className={
              isCompact
                ? "fixed z-[201] w-52 rounded-[7px] border border-white/[0.1] bg-[#171614] p-2 shadow-[0_18px_50px_rgba(0,0,0,0.5)]"
                : "fixed z-[201] w-52 rounded-[18px] border border-white/10 bg-[#0d1520] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            }
            role="menu"
            style={{ top: pos.top, right: pos.right }}
          >
            <p className={`mb-2 px-1 uppercase tracking-[0.2em] text-storm/75 ${isCompact ? "font-public-mono text-[10px]" : "text-[0.65rem]"}`}>
              Columnas visibles
            </p>
            {columns.map((column) => (
              <button
                aria-checked={visible[column.key]}
                className={`flex w-full items-center gap-3 px-2 py-2 text-left text-sm transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 ${isCompact ? "rounded-[4px] focus-visible:outline-white/30" : "rounded-[12px] focus-visible:outline-pine/50"}`}
                key={column.key}
                onClick={() => onToggle(column.key)}
                role="menuitemcheckbox"
                type="button"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center border transition ${isCompact ? "rounded-[3px]" : "rounded-[5px]"} ${
                    visible[column.key]
                      ? isCompact
                        ? "border-[#f4f1ec] bg-[#f4f1ec] text-[#141312]"
                        : "border-pine/40 bg-pine/20 text-pine"
                      : "border-white/20 bg-transparent"
                  }`}
                >
                  {visible[column.key] ? (
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 12 10">
                      <path d="M1 5l3 3L11 1" />
                    </svg>
                  ) : null}
                </span>
                <span className="text-ink">{column.label}</span>
              </button>
            ))}
          </div>
        </>,
        document.body,
      ) : null}
    </div>
  );
}
