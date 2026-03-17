import { LayoutGrid, List, Table2 } from "lucide-react";
import { useEffect, useState } from "react";

export type ViewMode = "grid" | "list" | "table";

const VIEW_MODES: Array<{ value: ViewMode; icon: typeof LayoutGrid; label: string }> = [
  { value: "grid", icon: LayoutGrid, label: "Bloques" },
  { value: "list", icon: List, label: "Lista" },
  { value: "table", icon: Table2, label: "Tabla" },
];

function getStorageKey(module: string) {
  return `dm_view_${module}`;
}

export function useViewMode(module: string, defaultMode: ViewMode = "grid") {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const stored = localStorage.getItem(getStorageKey(module));
      if (stored === "grid" || stored === "list" || stored === "table") {
        return stored;
      }
    } catch {
      // ignore
    }
    return defaultMode;
  });

  useEffect(() => {
    try {
      localStorage.setItem(getStorageKey(module), viewMode);
    } catch {
      // ignore
    }
  }, [module, viewMode]);

  return [viewMode, setViewMode] as const;
}

type ViewSelectorProps = {
  available?: ViewMode[];
  onChange: (mode: ViewMode) => void;
  value: ViewMode;
};

export function ViewSelector({
  available = ["grid", "list", "table"],
  onChange,
  value,
}: ViewSelectorProps) {
  const modes = VIEW_MODES.filter((m) => available.includes(m.value));

  return (
    <div
      aria-label="Modo de visualización"
      className="flex rounded-[18px] border border-white/10 bg-white/[0.03] p-1"
      role="group"
    >
      {modes.map(({ icon: Icon, label, value: mode }) => {
        const isActive = value === mode;

        return (
          <button
            aria-label={label}
            aria-pressed={isActive}
            className={`flex h-8 w-8 items-center justify-center rounded-[14px] transition duration-200 ${
              isActive
                ? "bg-white/[0.1] text-ink shadow-[0_2px_8px_rgba(0,0,0,0.18)]"
                : "text-storm hover:text-ink"
            }`}
            key={mode}
            onClick={() => onChange(mode)}
            title={label}
            type="button"
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
