import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-void hover:-translate-y-0.5 hover:brightness-105 focus-visible:outline-ink disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "bg-white/[0.06] text-ink ring-1 ring-white/10 hover:-translate-y-0.5 hover:bg-white/[0.1] focus-visible:outline-ember disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "bg-white/[0.03] text-storm ring-1 ring-white/8 hover:-translate-y-0.5 hover:bg-white/[0.07] hover:text-ink focus-visible:outline-gold disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60",
};

export function Button({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${variants[variant]} ${className}`}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
