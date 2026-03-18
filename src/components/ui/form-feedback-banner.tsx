import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
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

const toneStyles = {
  info: {
    badge: "border-white/12 bg-white/[0.05] text-storm/90",
    container:
      "border-white/10 bg-[linear-gradient(135deg,rgba(18,28,40,0.94),rgba(8,12,20,0.92))]",
    glow: "bg-[#4566d6]/16",
    icon: Info,
    iconContainer: "border-[#4566d6]/26 bg-[#4566d6]/14 text-[#b7c8ff]",
  },
  error: {
    badge: "border-[#f27a86]/22 bg-[#f27a86]/10 text-[#ffb4bc]",
    container:
      "border-[#f27a86]/18 bg-[linear-gradient(135deg,rgba(47,18,24,0.92),rgba(16,12,22,0.94))]",
    glow: "bg-[#f27a86]/18",
    icon: AlertTriangle,
    iconContainer: "border-[#f27a86]/24 bg-[#f27a86]/12 text-[#ffb4bc]",
  },
  success: {
    badge: "border-[#6be4c5]/24 bg-[#6be4c5]/10 text-[#8ef0d6]",
    container:
      "border-[#6be4c5]/16 bg-[linear-gradient(135deg,rgba(14,39,36,0.92),rgba(9,14,22,0.94))]",
    glow: "bg-[#6be4c5]/18",
    icon: CheckCircle2,
    iconContainer: "border-[#6be4c5]/24 bg-[#6be4c5]/12 text-[#8ef0d6]",
  },
} as const;

export function FormFeedbackBanner({
  action,
  badgeLabel,
  className = "",
  description,
  onDismiss,
  title,
  tone = "error",
}: FormFeedbackBannerProps) {
  const toneStyle = toneStyles[tone];
  const Icon = toneStyle.icon;
  const resolvedBadgeLabel =
    badgeLabel ?? (tone === "error" ? "Revisa esto" : tone === "success" ? "Todo listo" : "Aviso");

  return (
    <div
      aria-atomic="true"
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`relative overflow-hidden rounded-[30px] border px-4 py-4 shadow-[0_22px_60px_rgba(0,0,0,0.28)] sm:px-5 sm:py-5 ${toneStyle.container} ${className}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className={`absolute -left-10 top-0 h-24 w-24 rounded-full blur-3xl ${toneStyle.glow}`} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),transparent_55%)]" />
      </div>

      <div className="relative flex items-start gap-4">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border ${toneStyle.iconContainer}`}>
          <Icon className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] ${toneStyle.badge}`}>
              {resolvedBadgeLabel}
            </span>
          </div>
          <p className="mt-3 font-display text-2xl font-semibold text-ink">{title}</p>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-storm">{description}</p>
          {action ? <div className="mt-4">{action}</div> : null}
        </div>

        {onDismiss ? (
          <button
            aria-label="Cerrar aviso"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
            onClick={onDismiss}
            type="button"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
