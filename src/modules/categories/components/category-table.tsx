import { BarChart3, PencilLine, Power } from "lucide-react";

import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { RowActionButton, RowActions } from "../../../components/ui/row-action-button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TableColumnFilterMenu, TableFilterOptionButton } from "../../../components/ui/table-column-filter-menu";
import type { CategoryOverview } from "../../../types/domain";
import {
  isCategoryTableFilterActive,
  type CategoryTableFilterField,
  type CategoryTableFilters,
} from "../lib/categories-filters";
import { getIconDefinition, getKindDefinition, kindOptions } from "../lib/categories-presenters";

const filterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const headerCellClassName =
  "relative px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55";

const statusFilterValues = [
  { value: "active" as const, label: "Activas" },
  { value: "all" as const, label: "Todas" },
  { value: "inactive" as const, label: "Inactivas" },
];

type ColumnVisibilityFn = (key: string, hiddenClassName?: string) => string;

type CategoryTableProps = {
  categories: CategoryOverview[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  isToggling: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onEdit: (category: CategoryOverview) => void;
  onAnalytics: (id: number) => void;
  onToggleCategory: (category: CategoryOverview) => void;
  cv: ColumnVisibilityFn;
  filters: CategoryTableFilters;
  openFilter: CategoryTableFilterField | null;
  onUpdateFilter: <Field extends keyof CategoryTableFilters>(field: Field, value: CategoryTableFilters[Field]) => void;
  onClearSingleFilter: (field: CategoryTableFilterField) => void;
  onToggleFilterMenu: (field: CategoryTableFilterField) => void;
  onCloseFilterMenu: () => void;
  onApplyFilterAndClose: <Field extends CategoryTableFilterField>(field: Field, value: CategoryTableFilters[Field]) => void;
};

export function CategoryTable({
  categories,
  selectedIds,
  allSelected,
  someSelected,
  isToggling,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onEdit,
  onAnalytics,
  onToggleCategory,
  cv,
  filters,
  openFilter,
  onUpdateFilter,
  onClearSingleFilter,
  onToggleFilterMenu,
  onCloseFilterMenu,
  onApplyFilterAndClose,
}: CategoryTableProps) {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02]">
            <th className="w-10 px-4 py-3.5">
              <SelectionCheckbox
                ariaLabel="Seleccionar todas"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={() => (allSelected ? onClearAll() : onSelectAll())}
              />
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isCategoryTableFilterActive(filters, "name")}
                isOpen={openFilter === "name"}
                label="Categoria"
                onClear={() => onClearSingleFilter("name")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("name")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("name", event.target.value)}
                    placeholder="Filtrar categoria"
                    type="text"
                    value={filters.name}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("tipo", "hidden sm:table-cell")}`}>
              <TableColumnFilterMenu
                active={isCategoryTableFilterActive(filters, "kind")}
                isOpen={openFilter === "kind"}
                label="Tipo"
                onClear={() => onClearSingleFilter("kind")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("kind")}
              >
                <div className="space-y-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("kind", "all")} selected={filters.kind === "all"}>
                    Todos
                  </TableFilterOptionButton>
                  {kindOptions.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("kind", option.value)} selected={filters.kind === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isCategoryTableFilterActive(filters, "status")}
                isOpen={openFilter === "status"}
                label="Estado"
                onClear={() => onClearSingleFilter("status")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("status")}
              >
                <div className="space-y-1">
                  {statusFilterValues.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("status", option.value)} selected={filters.status === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("padre", "hidden lg:table-cell")}`}>
              <TableColumnFilterMenu
                active={isCategoryTableFilterActive(filters, "parent")}
                isOpen={openFilter === "parent"}
                label="Padre"
                onClear={() => onClearSingleFilter("parent")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("parent")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("parent", event.target.value)}
                    placeholder="Filtrar padre"
                    type="text"
                    value={filters.parent}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("movimientos", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isCategoryTableFilterActive(filters, "movements")}
                align="right"
                isOpen={openFilter === "movements"}
                label="Movimientos"
                onClear={() => onClearSingleFilter("movements")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("movements")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("movements", event.target.value)}
                    placeholder="Mov."
                    type="text"
                    value={filters.movements}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("suscripciones", "hidden xl:table-cell")}`}>
              <TableColumnFilterMenu
                active={isCategoryTableFilterActive(filters, "subscriptions")}
                align="right"
                isOpen={openFilter === "subscriptions"}
                label="Suscripciones"
                onClear={() => onClearSingleFilter("subscriptions")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("subscriptions")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("subscriptions", event.target.value)}
                    placeholder="Subs."
                    type="text"
                    value={filters.subscriptions}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((category, index) => {
            const kindDefinition = getKindDefinition(category.kind);
            const iconDefinition = getIconDefinition(category.icon);
            const CategoryIcon = iconDefinition.icon;

            return (
              <tr
                className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === categories.length - 1 ? "border-b-0" : ""}`}
                key={category.id}
              >
                <td className="w-10 px-4 py-4">
                  <SelectionCheckbox
                    ariaLabel={`Seleccionar ${category.name}`}
                    checked={selectedIds.has(category.id)}
                    onChange={() => onToggleSelect(category.id)}
                  />
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-white"
                      style={{ background: `linear-gradient(160deg, ${category.color ?? "#64748B"}, rgba(8,13,20,0.72))` }}
                    >
                      <CategoryIcon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-medium text-ink">{category.name}</p>
                      {category.parentName ? <p className="text-xs text-storm">{category.parentName}</p> : null}
                    </div>
                  </div>
                </td>
                <td className={`px-5 py-3.5 ${cv("tipo", "hidden sm:table-cell")}`}>
                  <StatusBadge status={kindDefinition.label} tone={kindDefinition.tone} />
                </td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={category.isActive ? "Activa" : "Inactiva"} tone={category.isActive ? "success" : "neutral"} />
                </td>
                <td className={`px-5 py-3.5 text-storm ${cv("padre", "hidden lg:table-cell")}`}>{category.parentName ?? "-"}</td>
                <td className={`px-5 py-3.5 text-right text-storm ${cv("movimientos", "hidden md:table-cell")}`}>{category.movementCount}</td>
                <td className={`px-5 py-3.5 text-right text-storm ${cv("suscripciones", "hidden xl:table-cell")}`}>{category.subscriptionCount}</td>
                <td className="px-5 py-3.5 text-right">
                  <RowActions>
                    <RowActionButton icon={BarChart3} label="Análisis" onClick={() => onAnalytics(category.id)} />
                    <RowActionButton icon={PencilLine} label="Editar" onClick={() => onEdit(category)} />
                    <RowActionButton
                      disabled={isToggling}
                      icon={Power}
                      label={category.isActive ? "Desactivar" : "Reactivar"}
                      onClick={() => onToggleCategory(category)}
                    />
                  </RowActions>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
