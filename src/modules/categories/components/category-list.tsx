import { BarChart3 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import type { CategoryOverview } from "../../../types/domain";
import { getIconDefinition, getKindDefinition } from "../lib/categories-presenters";

type CategoryListProps = {
  categories: CategoryOverview[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onEdit: (category: CategoryOverview) => void;
  onAnalytics: (id: number) => void;
};

export function CategoryList({ categories, selectedIds, onToggleSelect, onEdit, onAnalytics }: CategoryListProps) {
  return (
    <div className="space-y-3">
      {categories.map((category) => {
        const kindDefinition = getKindDefinition(category.kind);
        const iconDefinition = getIconDefinition(category.icon);
        const CategoryIcon = iconDefinition.icon;

        return (
          <article
            className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16"
            key={category.id}
          >
            <SelectionCheckbox
              ariaLabel={`Seleccionar ${category.name}`}
              checked={selectedIds.has(category.id)}
              onChange={() => onToggleSelect(category.id)}
            />
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white"
              style={{ background: `linear-gradient(160deg, ${category.color ?? "#64748B"}, rgba(8,13,20,0.72))` }}
            >
              <CategoryIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{category.name}</p>
              <p className="text-xs text-storm">
                {kindDefinition.label} · {category.movementCount} movimientos · {category.subscriptionCount} suscripciones
              </p>
            </div>
            <div className="hidden flex-wrap gap-2 sm:flex">
              <StatusBadge status={category.isActive ? "Activa" : "Inactiva"} tone={category.isActive ? "success" : "neutral"} />
            </div>
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onAnalytics(category.id)} variant="ghost">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
              Análisis
            </Button>
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onEdit(category)} variant="ghost">
              Editar
            </Button>
          </article>
        );
      })}
    </div>
  );
}
