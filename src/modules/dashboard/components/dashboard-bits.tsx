import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

import { StatusBadge } from "../../../components/ui/status-badge";
import { formatCurrency } from "../../../lib/formatting/money";

export function DashboardLoadingSkeleton() {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="shimmer-surface h-[164px]" key={`dashboard-metric-${index}`} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="shimmer-surface h-[440px]" />
        <div className="shimmer-surface h-[440px]" />
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
        <div className="shimmer-surface h-[420px]" />
        <div className="shimmer-surface h-[420px]" />
        <div className="shimmer-surface h-[420px]" />
      </section>
    </>
  );
}

export function GhostLink({ label, to }: { label: string; to: string }) {
  return (
    <Link
      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:border-pine/30 hover:bg-pine/10 hover:text-pine"
      to={to}
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; helper?: string; disabled?: boolean }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.value === value;
        const isDisabled = Boolean(option.disabled);

        return (
          <button
            className={`rounded-[18px] border px-4 py-2 text-left transition ${
              isDisabled
                ? "cursor-not-allowed border-white/8 bg-white/[0.02] text-storm/45"
                : isActive
                ? "border-pine/30 bg-pine/12 text-ink shadow-[0_0_0_1px_rgba(56,161,105,0.12)]"
                : "border-white/10 bg-white/[0.03] text-storm hover:border-white/20 hover:bg-white/[0.06]"
            }`}
            disabled={isDisabled}
            key={String(option.value)}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <div className="text-sm font-semibold">{option.label}</div>
            {option.helper ? (
              <div
                className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${
                  isDisabled ? "text-storm/45" : isActive ? "text-pine" : "text-storm/75"
                }`}
              >
                {option.helper}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}


export function DeltaBadge({
  value,
  currencyCode,
  inverse = false,
}: {
  value: number;
  currencyCode: string;
  inverse?: boolean;
}) {
  const adjusted = inverse ? value * -1 : value;
  const tone = adjusted > 0 ? "success" : adjusted < 0 ? "danger" : "neutral";
  const prefix = value > 0 ? "+" : "";

  return <StatusBadge status={`${prefix}${formatCurrency(value, currencyCode)}`} tone={tone} />;
}
