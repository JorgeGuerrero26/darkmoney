import { SegmentedControl } from "../../../components/ui/segmented-control";
import type { DashboardMode } from "../lib/dashboard-types";

type Props = {
  name: string;
  mode: DashboardMode;
  canUseAdvanced: boolean;
  checkingAccess: boolean;
  onChange: (mode: DashboardMode) => void;
};

/** Encabezado estable mientras se navega entre las secciones del dashboard. */
export function DashboardViewHeader({ name, mode, canUseAdvanced, checkingAccess, onChange }: Props) {
  const firstName = name.trim().split(/\s+/)[0] || "usuario";
  return <header className="flex flex-wrap items-center justify-between gap-4">
    <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Hola, {firstName}</h1>
    <div>
      <SegmentedControl ariaLabel="Vista del inicio" onChange={onChange} value={mode} options={[
        { value: "simple", label: "Simple" },
        { value: "advanced", label: "Avanzado", disabled: !canUseAdvanced },
      ]} />
      {!canUseAdvanced ? <p className="mt-1 text-xs text-storm">{checkingAccess ? "Comprobando acceso" : "La vista avanzada requiere Pro"}</p> : null}
    </div>
  </header>;
}
