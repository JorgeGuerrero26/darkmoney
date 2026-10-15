import { useEffect, useState, type ReactNode } from "react";
import { SegmentedControl } from "../../../components/ui/segmented-control";

export function DashboardAnalysisSections({ enabled, summary, patterns, flow, history, health }: {
  enabled: boolean; summary: ReactNode; patterns: () => ReactNode; flow: () => ReactNode; history: () => ReactNode; health: () => ReactNode;
}) {
  const [section, setSection] = useState("summary");
  useEffect(() => { if (!enabled) setSection("summary"); }, [enabled]);
  const selected = enabled ? section : "summary";
  const content = selected === "patterns" ? patterns() : selected === "flow" ? flow() : selected === "history" ? history() : selected === "health" ? health() : summary;
  return <>
    {enabled ? <div className="overflow-x-auto pb-1"><SegmentedControl className="[&_button]:min-h-10" ariaLabel="Sección del dashboard" onChange={setSection} value={selected} options={[{ value: "summary", label: "Resumen" }, { value: "patterns", label: "Patrones" }, { value: "flow", label: "Flujo" }, { value: "history", label: "Historial" }, { value: "health", label: "Salud" }]} /></div> : null}
    <div aria-label={`Contenido de ${selected}`} className="flex flex-col gap-7">{content}</div>
  </>;
}
