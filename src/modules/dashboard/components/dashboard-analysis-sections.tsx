import { useEffect, useState, type ReactNode } from "react";

const SECTIONS = [
  { value: "summary", label: "Resumen" },
  { value: "patterns", label: "Patrones" },
  { value: "flow", label: "Flujo" },
  { value: "history", label: "Historial" },
  { value: "health", label: "Salud" },
] as const;

export function DashboardAnalysisSections({ enabled, summary, patterns, flow, history, health }: {
  enabled: boolean; summary: ReactNode; patterns: () => ReactNode; flow: () => ReactNode; history: () => ReactNode; health: () => ReactNode;
}) {
  const [section, setSection] = useState("summary");
  useEffect(() => { if (!enabled) setSection("summary"); }, [enabled]);
  const selected = enabled ? section : "summary";
  const content = selected === "patterns" ? patterns() : selected === "flow" ? flow() : selected === "history" ? history() : selected === "health" ? health() : summary;
  return <>
    {enabled ? <div className="overflow-x-auto">
      <nav aria-label="Sección del dashboard" className="flex min-w-max gap-7 border-b border-white/[0.08]">
        {SECTIONS.map((item) => <button key={item.value} type="button" aria-pressed={selected === item.value}
          onClick={() => setSection(item.value)}
          className={`-mb-px min-h-11 border-b-2 px-0 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${selected === item.value ? "border-ink font-semibold text-ink" : "border-transparent font-medium text-storm hover:text-ink"}`}>
          {item.label}
        </button>)}
      </nav>
    </div> : null}
    <div aria-label={`Contenido de ${selected}`} className="flex flex-col gap-7">{content}</div>
  </>;
}
