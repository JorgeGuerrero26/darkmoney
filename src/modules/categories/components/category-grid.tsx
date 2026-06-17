import { BarChart3, PencilLine, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import type { CategoryOverview } from "../../../types/domain";
import {
  buildCategoryMonogram,
  getIconDefinition,
  getKindDefinition,
  getLastActivityLabel,
} from "../lib/categories-presenters";

type CategoryGridProps = {
  categories: CategoryOverview[];
  selectedIds: Set<number>;
  selectedCount: number;
  isToggling: boolean;
  onToggleSelect: (id: number) => void;
  onEdit: (category: CategoryOverview) => void;
  onAnalytics: (id: number) => void;
  onToggleCategory: (category: CategoryOverview) => void;
  onDelete: (id: number) => void;
};

export function CategoryGrid({
  categories,
  selectedIds,
  selectedCount,
  isToggling,
  onToggleSelect,
  onEdit,
  onAnalytics,
  onToggleCategory,
  onDelete,
}: CategoryGridProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {categories.map((category) => {
        const kindDefinition = getKindDefinition(category.kind);
        const iconDefinition = getIconDefinition(category.icon);
        const CategoryIcon = iconDefinition.icon;
        const isSelected = selectedIds.has(category.id);
        const longPressHandlers = createLongPressHandlers(() => onToggleSelect(category.id));

        return (
          <article
            className={`glass-panel-soft relative rounded-[24px] p-5 transition duration-200 hover:border-white/16 ${isSelected ? "border-pine/25 ring-2 ring-pine/30" : ""}`}
            key={category.id}
            onClick={(e) => {
              if (wasRecentLongPress()) return;
              if (selectedCount === 0) return;
              if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
              onToggleSelect(category.id);
            }}
            {...longPressHandlers}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 text-white"
                  style={{ background: `linear-gradient(160deg, ${category.color ?? "#64748B"}, rgba(8,13,20,0.72))` }}
                >
                  <CategoryIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-semibold text-ink">{category.name}</h3>
                  <p className="mt-1 text-sm text-storm">
                    {category.parentName ? `Depende de ${category.parentName}` : "Categoria principal"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <StatusBadge status={kindDefinition.label} tone={kindDefinition.tone} />
                <StatusBadge status={category.isActive ? "Activa" : "Inactiva"} tone={category.isActive ? "success" : "neutral"} />
                {category.isSystem ? <StatusBadge status="Base" tone="warning" /> : null}
              </div>
            </div>

            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Orden</p>
                <p className="mt-2 font-medium text-ink">{category.sortOrder}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Nombre corto</p>
                <p className="mt-2 font-medium text-ink">{buildCategoryMonogram(category.name)}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Ultima actividad</p>
                <p className="mt-2 font-medium text-ink">{getLastActivityLabel(category.lastActivityAt)}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Movimientos</p>
                <p className="mt-2 font-display text-3xl font-semibold text-ink">{category.movementCount}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Suscripciones</p>
                <p className="mt-2 font-display text-3xl font-semibold text-ink">{category.subscriptionCount}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
              <Button onClick={() => onAnalytics(category.id)} variant="ghost">
                <BarChart3 className="mr-2 h-4 w-4" />
                Ver análisis
              </Button>
              <Button onClick={() => onEdit(category)} variant="secondary">
                <PencilLine className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button disabled={isToggling} onClick={() => onToggleCategory(category)} variant="ghost">
                {category.isActive ? "Desactivar" : "Reactivar"}
              </Button>
              <Button className="text-[#ffb4bc] hover:text-white" onClick={() => onDelete(category.id)} variant="ghost">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
