export type SegmentedControlOption<T extends string | number> = {
  value: T;
  label: string;
  helper?: string;
  disabled?: boolean;
};

type SegmentedControlProps<T extends string | number> = {
  options: Array<SegmentedControlOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  /** "pill" = pista compacta de una línea; "card" = botones con helper (estilo dashboard actual). */
  variant?: "pill" | "card";
};

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = "pill",
}: SegmentedControlProps<T>) {
  if (variant === "pill") {
    return (
      <div
        aria-label={ariaLabel}
        className="inline-flex flex-wrap items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.04] p-1"
        role="group"
      >
        {options.map((option) => {
          const isActive = option.value === value;
          const isDisabled = Boolean(option.disabled);

          return (
            <button
              aria-pressed={isActive}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition duration-200 ${
                isDisabled
                  ? "cursor-not-allowed text-storm/45"
                  : isActive
                    ? "bg-white/[0.1] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/12"
                    : "text-storm hover:text-ink"
              }`}
              disabled={isDisabled}
              key={String(option.value)}
              onClick={() => onChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      aria-label={ariaLabel}
      className="flex flex-wrap gap-2"
      role="group"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        const isDisabled = Boolean(option.disabled);

        return (
          <button
            aria-pressed={isActive}
            className={`rounded-[18px] border px-4 py-2 text-left transition duration-200 ${
              isDisabled
                ? "cursor-not-allowed border-white/8 bg-white/[0.02] text-storm/45"
                : isActive
                  ? "border-pine/30 bg-pine/12 text-ink shadow-[0_0_0_1px_rgba(107,228,197,0.12)]"
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
