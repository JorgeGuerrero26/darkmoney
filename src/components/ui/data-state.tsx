import type { ReactNode } from "react";

type DataStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "neutral" | "error" | "success";
};

const tones = {
  neutral: "border-white/10 bg-white/[0.04]",
  error: "border-rosewood/20 bg-rosewood/10",
  success: "border-pine/20 bg-pine/10",
};

export function DataState({
  action,
  description,
  title,
  tone = "neutral",
}: DataStateProps) {
  return (
    <div className={`rounded-[28px] border p-5 ${tones[tone]}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-2xl font-semibold text-ink">{title}</p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-storm">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}
