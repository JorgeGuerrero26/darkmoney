import type { ReactNode } from "react";

type MetricCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  accent?: "pine" | "ember" | "gold" | "ink";
};

const accents = {
  pine: "from-pine/22 to-pine/5 text-pine",
  ember: "from-ember/20 to-ember/5 text-ember",
  gold: "from-gold/20 to-gold/5 text-gold",
  ink: "from-white/16 to-white/5 text-ink",
};

export function MetricCard({
  accent = "ink",
  hint,
  icon,
  label,
  value,
}: MetricCardProps) {
  return (
    <article className="glass-panel rounded-[28px] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-storm/90">{label}</p>
          <p className="mt-3 font-display text-4xl font-semibold text-ink">{value}</p>
        </div>
        <div className={`rounded-3xl bg-gradient-to-br p-3 ring-1 ring-white/8 ${accents[accent]}`}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-storm">{hint}</p>
    </article>
  );
}
