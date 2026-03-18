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
}: {
  columns: ColumnDef[];
  visible: Record<string, boolean>;
  onToggle: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

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
      <Button
        aria-expanded={open}
        aria-label="Configurar columnas visibles"
        onClick={handleOpen}
        variant="ghost"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </Button>
      {open ? createPortal(
        <>
          <div
            aria-hidden="true"
            className="fixed inset-0 z-[200]"
            onClick={() => setOpen(false)}
          />
          <div
            className="fixed z-[201] w-52 rounded-[18px] border border-white/10 bg-[#0d1520] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            role="menu"
            style={{ top: pos.top, right: pos.right }}
          >
            <p className="mb-2 px-1 text-[0.65rem] uppercase tracking-[0.2em] text-storm/75">
              Columnas visibles
            </p>
            {columns.map((column) => (
              <button
                aria-checked={visible[column.key]}
                className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left text-sm transition hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pine/50"
                key={column.key}
                onClick={() => onToggle(column.key)}
                role="menuitemcheckbox"
                type="button"
              >
                <span
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border transition ${
                    visible[column.key]
                      ? "border-pine/40 bg-pine/20 text-pine"
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
