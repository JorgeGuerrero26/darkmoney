import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent?: "pine" | "ember" | "gold" | "ink";
};

const accents = {
  pine: "border-pine/20 bg-pine/10 text-pine",
  ember: "border-ember/20 bg-ember/10 text-ember",
  gold: "border-gold/20 bg-gold/10 text-gold",
  ink: "border-white/10 bg-white/[0.04] text-ink",
};

export function MetricCard({
  accent = "ink",
  hint,
  icon,
  label,
  value,
}: MetricCardProps) {
  return (
    <article className="glass-panel-soft rounded-[24px] p-5 transition duration-300 hover:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.22em] text-storm/80">{label}</p>
          <p className="mt-3 min-w-0 break-words font-display text-3xl font-semibold leading-tight text-ink">
            {value}
          </p>
        </div>
        <div className={`inline-flex shrink-0 rounded-[14px] border p-2.5 ${accents[accent]}`}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-storm">{hint}</p>
    </article>
  );
}
