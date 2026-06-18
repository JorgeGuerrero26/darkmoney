import { Check, ChevronDown, X } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    visibility: "hidden",
    zIndex: 9999,
  });

  // El panel se renderiza en un portal al <body> con posición fixed para
  // escapar del recorte del contenedor de la tabla (overflow-x-auto fuerza el
  // recorte vertical). Se mide tras montar y se reposiciona con flip arriba/abajo.
  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }

    function place() {
      const trigger = triggerRef.current;
      const panel = panelRef.current;
      if (!trigger || !panel) {
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const gap = 8;
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;

      let left = align === "right" ? rect.right - panelWidth : rect.left;
      left = Math.min(Math.max(viewportPadding, left), window.innerWidth - panelWidth - viewportPadding);

      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
      const spaceAbove = rect.top - viewportPadding;
      const openBelow = spaceBelow >= panelHeight + gap || spaceBelow >= spaceAbove;
      const maxHeight = Math.max(160, Math.min(panelHeight, (openBelow ? spaceBelow : spaceAbove) - gap));

      const next: CSSProperties = {
        position: "fixed",
        left,
        width: panelWidth,
        maxHeight,
        overflowY: "auto",
        overscrollBehavior: "contain",
        zIndex: 9999,
        visibility: "visible",
      };

      if (openBelow) {
        next.top = rect.bottom + gap;
      } else {
        next.bottom = window.innerHeight - rect.top + gap;
      }

      setStyle(next);
    }

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [isOpen, align]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || panelRef.current?.contains(target))) {
        return;
      }
      onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, onClose]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
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

      {isOpen
        ? createPortal(
            <div
              ref={panelRef}
              className={`animate-rise-in isolate ${minWidthClassName} overflow-hidden rounded-[22px] border border-white/12 bg-shell/95 p-3 shadow-haze backdrop-blur-2xl`}
              style={style}
            >
              <div className="mb-3 flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div className="min-w-0">
                  <p className="text-[0.62rem] font-semibold uppercase tracking-[0.22em] text-storm/80">Filtrar</p>
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
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
