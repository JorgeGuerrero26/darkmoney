import { ArrowLeft, ChevronRight, X } from "lucide-react";
import type { ReactNode } from "react";

export const resourceEditorSurfaceClassName =
  "resource-editor !max-w-[640px] !rounded-[14px] !bg-[#1a1917] !shadow-none !backdrop-blur-none";

export function ResourceEditorHeader({
  accessory,
  disabled = false,
  onBack,
  onClose,
  title,
  titleId,
}: {
  accessory?: ReactNode;
  disabled?: boolean;
  onBack?: () => void;
  onClose: () => void;
  title: string;
  titleId?: string;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onBack ? (
          <button aria-label="Volver" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-storm transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 motion-reduce:transition-none" disabled={disabled} onClick={onBack} type="button">
            <ArrowLeft className="h-4 w-4" />
          </button>
        ) : null}
        <h2 className="truncate font-display text-xl font-semibold text-ink" id={titleId}>{title}</h2>
        {accessory}
      </div>
      <button aria-label="Cerrar formulario" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-storm transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.1] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50 motion-reduce:transition-none" disabled={disabled} onClick={onClose} type="button">
        <X className="h-4 w-4" />
      </button>
    </header>
  );
}

export function ResourceEditorDestination({
  label = "Detalles",
  onClick,
  summary,
}: {
  label?: string;
  onClick: () => void;
  summary?: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
      <button className="flex h-[54px] w-full items-center justify-between gap-4 px-4 text-left text-sm font-semibold text-ink transition-colors duration-150 hover:bg-white/[0.03] active:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/40 motion-reduce:transition-none" onClick={onClick} type="button">
        <span>{label}</span>
        <span className="flex min-w-0 items-center gap-2 font-normal text-storm">
          {summary ? <span className="truncate">{summary}</span> : null}
          <ChevronRight className="h-4 w-4 shrink-0" />
        </span>
      </button>
    </div>
  );
}
