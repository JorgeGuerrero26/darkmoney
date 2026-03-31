import type { PropsWithChildren, ReactNode } from "react";

type SurfaceCardProps = PropsWithChildren<{
  title: string;
  description?: string;
  action?: ReactNode;
  /** Botón de ayuda u otro control junto al título (p. ej. icono “i” del dashboard). */
  titleAccessory?: ReactNode;
  className?: string;
}>;

export function SurfaceCard({
  action,
  className = "",
  children,
  description,
  title,
  titleAccessory,
}: SurfaceCardProps) {
  return (
    <section className={`glass-panel rounded-[30px] p-6 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-2xl font-semibold text-ink">{title}</h3>
            {titleAccessory}
          </div>
          {description ? <p className="mt-2 text-sm leading-7 text-storm">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}
