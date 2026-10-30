import { X } from "lucide-react";
import type { ReactNode } from "react";

type FormFeedbackBannerProps = {
  title: string;
  description: string;
  tone?: "info" | "error" | "success";
  className?: string;
  badgeLabel?: string;
  onDismiss?: () => void;
  action?: ReactNode;
};

export function FormFeedbackBanner({ action, badgeLabel, className = "", description, onDismiss, title, tone = "error" }: FormFeedbackBannerProps) {
  const dot = tone === "error" ? "bg-[#ee7971]" : tone === "success" ? "bg-[#84cba0]" : "bg-[#d7be7b]";
  return <div aria-atomic="true" aria-live={tone === "error" ? "assertive" : "polite"} className={`flex items-start gap-3 rounded-2xl border border-white/10 bg-[#1a1917] p-4 ${className}`} role={tone === "error" ? "alert" : "status"}>
    <span aria-hidden="true" className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
    <div className="min-w-0 flex-1">
      {badgeLabel ? <span className="sr-only">{badgeLabel}: </span> : null}
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm leading-6 text-storm">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
    {onDismiss ? <button aria-label="Cerrar aviso" className="rounded-lg p-2 text-storm hover:bg-white/[0.06] hover:text-ink" onClick={onDismiss} type="button"><X aria-hidden="true" className="h-4 w-4" /></button> : null}
  </div>;
}
