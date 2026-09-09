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
    <section className="min-w-0">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-public-mono text-[10px] uppercase tracking-[0.2em] text-storm">{eyebrow}</p>
          <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em] text-ink">{title}</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-storm">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
