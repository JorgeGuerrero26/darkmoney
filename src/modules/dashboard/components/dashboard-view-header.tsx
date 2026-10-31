import { useEffect, useState } from "react";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import type { DashboardMode } from "../lib/dashboard-types";

type Props = {
  name: string;
  mode: DashboardMode;
  canUseAdvanced: boolean;
  checkingAccess: boolean;
  updatedAt?: number;
  refreshing?: boolean;
  onChange: (mode: DashboardMode) => void;
};

/** Encabezado estable mientras se navega entre las secciones del dashboard. */
export function DashboardViewHeader({ name, mode, canUseAdvanced, checkingAccess, updatedAt, refreshing = false, onChange }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!updatedAt || refreshing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 10000);
    return () => window.clearInterval(timer);
  }, [updatedAt, refreshing]);
  const seconds = updatedAt ? Math.max(0, Math.floor((now - updatedAt) / 1000)) : 0;
  const elapsed = seconds < 60 ? `${seconds} s` : seconds < 3600 ? `${Math.floor(seconds / 60)} min` : seconds < 86400 ? `${Math.floor(seconds / 3600)} h` : `${Math.floor(seconds / 86400)} d`;
  const firstName = name.trim().split(/\s+/)[0] || "usuario";
  return <header className="flex flex-wrap items-center justify-between gap-4">
    <div><h1 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Hola, {firstName}</h1>
      {refreshing || updatedAt ? <p role="status" className="mt-2 text-sm text-storm">{refreshing ? "Actualizando datos…" : `Actualizado hace ${elapsed}`}</p> : null}
    </div>
    <div>
      <SegmentedControl ariaLabel="Vista del inicio" onChange={onChange} value={mode} options={[
        { value: "simple", label: "Simple" },
        { value: "advanced", label: "Avanzado", disabled: !canUseAdvanced },
      ]} />
      {!canUseAdvanced ? <p className="mt-1 text-xs text-storm">{checkingAccess ? "Comprobando acceso" : "La vista avanzada requiere Pro"}</p> : null}
    </div>
  </header>;
}
