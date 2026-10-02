import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

/** A reading row; optional navigation opens a destination instead of an accordion. */
export function DetailFieldRow({ label, value, onClick, disabled = false }: {
  label: string;
  value: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className = "flex min-h-[54px] w-full items-center justify-between gap-5 border-b border-white/[0.08] py-3 text-left text-sm last:border-b-0";
  const content = <><span className="shrink-0 text-storm">{label}</span><span className="flex min-w-0 items-center justify-end gap-2 text-right text-ink"><span className="min-w-0 whitespace-pre-wrap break-words">{value}</span>{onClick ? <ChevronRight className="h-4 w-4 shrink-0 text-storm" /> : null}</span></>;
  return onClick ? <button className={`${className} transition-colors duration-150 hover:bg-white/[0.03] disabled:opacity-40 motion-reduce:transition-none`} disabled={disabled} onClick={onClick} type="button">{content}</button> : <div className={className}>{content}</div>;
}
