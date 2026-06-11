import { X } from "lucide-react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useEffect, useRef } from "react";

import { useFocusTrap } from "./use-focus-trap";

type ModalSize = "sm" | "md" | "lg" | "xl";

const sizeClassNames: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

type ModalProps = {
  onClose: () => void;
  children: ReactNode;
  size?: ModalSize;
  ariaLabel?: string;
  labelledBy?: string;
  disableOutsideClose?: boolean;
  align?: "center" | "top";
  className?: string;
};

export function Modal({
  onClose,
  children,
  size = "md",
  ariaLabel,
  labelledBy,
  disableOutsideClose = false,
  align = "center",
  className = "",
}: ModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useFocusTrap(cardRef);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  function handleOverlayPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disableOutsideClose) {
      return;
    }

    if (event.target === event.currentTarget) {
      onCloseRef.current();
    }
  }

  return (
    <div className="animate-fade-in fixed inset-0 z-[90] overflow-y-auto bg-void/60 backdrop-blur-sm">
      <div
        className={`flex min-h-full justify-center p-4 sm:p-6 ${
          align === "top" ? "items-start pt-[14vh] sm:pt-[18vh]" : "items-center"
        }`}
        onPointerDown={handleOverlayPointerDown}
      >
        <div
          aria-label={ariaLabel}
          aria-labelledby={labelledBy}
          aria-modal="true"
          className={`animate-rise-in w-full rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl ${sizeClassNames[size]} ${className}`}
          ref={cardRef}
          role="dialog"
        >
          {children}
        </div>
      </div>
    </div>
  );
}

type ModalHeaderProps = {
  title: string;
  description?: string;
  onClose?: () => void;
  titleId?: string;
  accessory?: ReactNode;
};

export function ModalHeader({ title, description, onClose, titleId, accessory }: ModalHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-6 py-5">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <h2
            className="font-display text-xl font-semibold tracking-[-0.02em] text-ink"
            id={titleId}
          >
            {title}
          </h2>
          {accessory}
        </div>
        {description ? <p className="mt-1 text-sm leading-6 text-storm">{description}</p> : null}
      </div>
      {onClose ? (
        <button
          aria-label="Cerrar"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
          onClick={onClose}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

type ModalFooterProps = {
  children: ReactNode;
  className?: string;
};

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] px-6 py-4 ${className}`}
    >
      {children}
    </div>
  );
}
