import type { ComponentType, ReactNode } from "react";

type RowActionButtonProps = {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
};

/**
 * Acción de fila en formato ícono compacto (gráfico, lápiz, archivar...), con
 * tooltip y aria-label para conservar el significado. Estilo unificado en todas
 * las tablas de los módulos.
 */
export function RowActionButton({ icon: Icon, label, onClick, disabled = false, tone = "default" }: RowActionButtonProps) {
  return (
    <button
      aria-label={label}
      className={`flex h-9 w-9 items-center justify-center rounded-xl text-storm transition hover:bg-white/[0.06] hover:text-ink focus-visible:bg-white/[0.06] focus-visible:text-ink focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
        tone === "danger" ? "hover:text-[#ffb4bc]" : ""
      }`}
      disabled={disabled}
      onClick={onClick}
      title={label}
      type="button"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function RowActions({ children }: { children: ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}
