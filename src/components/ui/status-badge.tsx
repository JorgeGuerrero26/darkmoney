type StatusBadgeProps = {
  status: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  className?: string;
};

const tones = {
  neutral: "bg-white/[0.06] text-ink ring-1 ring-white/8",
  success: "bg-pine/12 text-pine ring-1 ring-pine/20",
  warning: "bg-gold/12 text-gold ring-1 ring-gold/20",
  danger: "bg-rosewood/12 text-rosewood ring-1 ring-rosewood/20",
  info: "bg-ember/12 text-ember ring-1 ring-ember/20",
};

export function StatusBadge({ className = "", status, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${tones[tone]} ${className}`}
    >
      {status}
    </span>
  );
}
