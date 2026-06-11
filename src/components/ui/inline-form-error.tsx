import { AlertCircle } from "lucide-react";

type InlineFormErrorProps = {
  message: string;
  className?: string;
};

export function InlineFormError({ message, className = "" }: InlineFormErrorProps) {
  return (
    <div
      aria-atomic="true"
      aria-live="assertive"
      className={`animate-fade-in flex items-start gap-2.5 rounded-2xl border border-rosewood/20 bg-rosewood/[0.07] px-4 py-3 ${className}`}
      role="alert"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rosewood" />
      <p className="text-sm leading-6 text-rosewood">{message}</p>
    </div>
  );
}
