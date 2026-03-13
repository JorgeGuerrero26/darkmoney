import type { PropsWithChildren, ReactNode } from "react";

type PageHeaderProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}>;

export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
  children,
}: PageHeaderProps) {
  return (
    <section className="glass-panel-strong rounded-[30px] p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.28em] text-storm/90">{eyebrow}</p>
          <h2 className="font-display text-4xl font-semibold text-ink">{title}</h2>
          <p className="max-w-3xl text-sm leading-7 text-storm">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </section>
  );
}
