type ProgressBarProps = {
  value: number;
  label?: string;
};

export function ProgressBar({ label, value }: ProgressBarProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={safeValue}
      className="h-3 overflow-hidden rounded-full bg-white/[0.08]"
      role="progressbar"
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-pine via-ember to-gold transition-all duration-300"
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}
