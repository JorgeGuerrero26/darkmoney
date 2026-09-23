import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = PropsWithChildren<ButtonHTMLAttributes<HTMLButtonElement>> & {
  variant?: ButtonVariant;
};

type ButtonClassNameOptions = {
  className?: string;
  variant?: ButtonVariant;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-ink text-void hover:bg-white active:bg-[#ded9d1] focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "bg-white/[0.04] text-ink ring-1 ring-white/10 hover:bg-white/[0.08] active:bg-white/[0.12] focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60",
  ghost:
    "bg-transparent text-storm hover:bg-white/[0.05] hover:text-ink active:bg-white/[0.08] focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-60",
};

export function getButtonClassName({
  className = "",
  variant = "primary",
}: ButtonClassNameOptions = {}) {
  return `inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 py-2.5 text-sm font-semibold transition-colors duration-150 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${variants[variant]} ${className}`;
}

export function Button({
  children,
  className = "",
  type = "button",
  variant = "primary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={getButtonClassName({ className, variant })}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
}
