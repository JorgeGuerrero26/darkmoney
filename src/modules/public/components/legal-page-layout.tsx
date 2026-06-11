import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { StatusBadge } from "../../../components/ui/status-badge";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

type LegalPageLayoutProps = {
  icon: LucideIcon;
  iconClassName?: string;
  badge: string;
  badgeTone?: "neutral" | "success" | "warning" | "danger" | "info";
  title: string;
  intro: string;
  updatedAt: string;
  sections: LegalSection[];
};

export function LegalPageLayout({
  icon: Icon,
  iconClassName = "text-pine",
  badge,
  badgeTone = "info",
  title,
  intro,
  updatedAt,
  sections,
}: LegalPageLayoutProps) {
  return (
    <div className="animate-rise-in">
      <header className="flex max-w-2xl flex-col gap-5 pb-12 pt-4">
        <div className="flex items-center gap-3">
          <div className="rounded-[16px] border border-white/10 bg-white/[0.04] p-3">
            <Icon className={`h-5 w-5 ${iconClassName}`} />
          </div>
          <StatusBadge
            status={badge}
            tone={badgeTone}
          />
        </div>
        <h1 className="text-balance font-display text-4xl font-semibold tracking-[-0.035em] text-ink sm:text-5xl">
          {title}
        </h1>
        <p className="text-base leading-8 text-storm">{intro}</p>
        <p className="text-xs uppercase tracking-[0.18em] text-storm/60">
          Ultima actualizacion: {updatedAt}
        </p>
      </header>

      <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
        <nav
          aria-label="Tabla de contenido"
          className="hidden lg:block"
        >
          <div className="sticky top-24 flex flex-col gap-1 border-l border-white/[0.08] pl-1">
            <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-storm/60">
              Contenido
            </p>
            {sections.map((section, index) => (
              <a
                className="rounded-lg px-3 py-1.5 text-sm text-storm transition hover:bg-white/[0.04] hover:text-ink"
                href={`#${section.id}`}
                key={section.id}
              >
                {index + 1}. {section.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="flex max-w-3xl flex-col gap-10">
          {sections.map((section, index) => (
            <section
              className="scroll-mt-24"
              id={section.id}
              key={section.id}
            >
              <div className="flex items-baseline gap-4">
                <span className="font-display text-2xl font-semibold text-pine/50">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-ink">
                  {section.title}
                </h2>
              </div>
              <div className="mt-3 border-l border-white/[0.06] pl-[2.55rem] text-sm leading-7 text-storm">
                {section.body}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
