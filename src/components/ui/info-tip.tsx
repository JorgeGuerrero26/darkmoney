import { Info } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";

import { useOutsidePointerClose } from "../../hooks/use-outside-pointer-close";

type InfoTipProps = {
  /** Texto o contenido del popover. */
  children: ReactNode;
  title?: string;
  /** Si se pasa, muestra un enlace "Ver explicación completa" que dispara este callback. */
  onOpenDetail?: () => void;
  ariaLabel?: string;
  className?: string;
};

const POPOVER_WIDTH = 288;
const POPOVER_MARGIN = 10;

export function InfoTip({
  children,
  title,
  onOpenDetail,
  ariaLabel = "Más información",
  className = "",
}: InfoTipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState<CSSProperties>({});
  const containerRef = useOutsidePointerClose(isOpen, () => setIsOpen(false), true);

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const left = Math.min(
      Math.max(POPOVER_MARGIN, rect.left + rect.width / 2 - POPOVER_WIDTH / 2),
      viewportWidth - POPOVER_WIDTH - POPOVER_MARGIN,
    );

    const spaceBelow = viewportHeight - rect.bottom;
    const openUp = spaceBelow < 200 && rect.top > 200;

    setPosition(
      openUp
        ? { left, bottom: viewportHeight - rect.top + POPOVER_MARGIN }
        : { left, top: rect.bottom + POPOVER_MARGIN },
    );
  }, [isOpen]);

  return (
    <span
      className={`relative inline-flex ${className}`}
      ref={containerRef}
    >
      <button
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full transition duration-200 ${
          isOpen ? "text-pine" : "text-storm/60 hover:text-pine"
        }`}
        onClick={() => setIsOpen((open) => !open)}
        ref={triggerRef}
        type="button"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {isOpen ? (
        <div
          className="glass-panel-strong animate-rise-in fixed z-[80] w-72 rounded-2xl bg-shell/95 p-4"
          role="tooltip"
          style={position}
        >
          {title ? (
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
              {title}
            </p>
          ) : null}
          <div className="text-xs leading-5 text-storm">{children}</div>
          {onOpenDetail ? (
            <button
              className="mt-3 text-xs font-semibold text-pine transition hover:text-ink"
              onClick={() => {
                setIsOpen(false);
                onOpenDetail();
              }}
              type="button"
            >
              Ver explicación completa →
            </button>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
