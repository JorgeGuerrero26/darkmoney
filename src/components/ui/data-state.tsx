import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

type DataStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  tone?: "neutral" | "error" | "success";
};

const configs = {
  neutral: {
    container: "border-white/10 bg-white/[0.04]",
    icon: <Info className="mt-0.5 h-5 w-5 shrink-0 text-storm/70" />,
  },
  error: {
    container: "border-rosewood/20 bg-rosewood/10",
    icon: <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rosewood" />,
  },
  success: {
    container: "border-pine/20 bg-pine/10",
    icon: <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-pine" />,
  },
};

export function DataState({
  action,
  description,
  title,
  tone = "neutral",
}: DataStateProps) {
  const { container, icon } = configs[tone];

  return (
    <div className={`rounded-[28px] border p-5 ${container}`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {icon}
          <div>
            <p className="font-display text-xl font-semibold text-ink">{title}</p>
            <p className="mt-1.5 max-w-2xl text-sm leading-7 text-storm">{description}</p>
          </div>
        </div>
        {action}
      </div>
    </div>
  );
}
