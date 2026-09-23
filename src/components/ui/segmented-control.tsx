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
  className?: string;
};

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  variant = "pill",
  className = "",
}: SegmentedControlProps<T>) {
  if (variant === "pill") {
    return (
      <div
        aria-label={ariaLabel}
        className={`inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-white/[0.08] bg-[#1a1917] p-1 ${className}`}
        role="group"
      >
        {options.map((option) => {
          const isActive = option.value === value;
          const isDisabled = Boolean(option.disabled);

          return (
            <button
              aria-pressed={isActive}
              className={`min-h-8 whitespace-nowrap rounded-[6px] px-3.5 py-1.5 text-[13px] font-medium transition-colors duration-150 motion-reduce:transition-none ${
                isDisabled
                  ? "cursor-not-allowed text-storm/45"
                  : isActive
                    ? "bg-ink text-void"
                    : "text-storm hover:bg-white/[0.04] hover:text-ink"
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
            className={`rounded-[10px] border px-4 py-3 text-left transition-colors duration-150 motion-reduce:transition-none ${
              isDisabled
                ? "cursor-not-allowed border-white/8 bg-white/[0.02] text-storm/45"
                : isActive
                  ? "border-white/30 bg-white/[0.07] text-ink"
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
                className={`mt-1 text-xs leading-5 ${
                  isDisabled ? "text-storm/45" : "text-storm"
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
