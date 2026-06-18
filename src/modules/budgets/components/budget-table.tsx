import { BarChart3, PencilLine, Power } from "lucide-react";

import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { RowActionButton, RowActions } from "../../../components/ui/row-action-button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TableColumnFilterMenu, TableFilterOptionButton } from "../../../components/ui/table-column-filter-menu";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  isBudgetTableFilterActive,
  type BudgetTableFilterField,
  type BudgetTableFilters,
} from "../lib/budgets-filters";
import {
  getBudgetStatusLabel,
  getBudgetTone,
  scopeFilterOptions,
  statusOptions,
  type DisplayBudgetOverview,
} from "../lib/budgets-presenters";

const filterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const headerCellClassName =
  "relative px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55";

type ColumnVisibilityFn = (key: string, hiddenClassName?: string) => string;

type BudgetTableProps = {
  budgets: DisplayBudgetOverview[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  isToggling: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onEdit: (budget: DisplayBudgetOverview) => void;
  onAnalytics: (id: number) => void;
  onToggleBudget: (budget: DisplayBudgetOverview) => void;
  cv: ColumnVisibilityFn;
  filters: BudgetTableFilters;
  openFilter: BudgetTableFilterField | null;
  onUpdateFilter: <Field extends keyof BudgetTableFilters>(field: Field, value: BudgetTableFilters[Field]) => void;
  onClearSingleFilter: (field: BudgetTableFilterField) => void;
  onToggleFilterMenu: (field: BudgetTableFilterField) => void;
  onCloseFilterMenu: () => void;
  onApplyFilterAndClose: <Field extends BudgetTableFilterField>(field: Field, value: BudgetTableFilters[Field]) => void;
};

export function BudgetTable({
  budgets,
  selectedIds,
  allSelected,
  someSelected,
  isToggling,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onEdit,
  onAnalytics,
  onToggleBudget,
  cv,
  filters,
  openFilter,
  onUpdateFilter,
  onClearSingleFilter,
  onToggleFilterMenu,
  onCloseFilterMenu,
  onApplyFilterAndClose,
}: BudgetTableProps) {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02]">
            <th className="w-10 px-4 py-3.5">
              <SelectionCheckbox
                ariaLabel="Seleccionar todos"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={() => (allSelected ? onClearAll() : onSelectAll())}
              />
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isBudgetTableFilterActive(filters, "name")}
                isOpen={openFilter === "name"}
                label="Presupuesto"
                onClear={() => onClearSingleFilter("name")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("name")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("name", event.target.value)}
                    placeholder="Buscar presupuesto"
                    type="text"
                    value={filters.name}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("alcance", "hidden sm:table-cell")}`}>
              <TableColumnFilterMenu
                active={isBudgetTableFilterActive(filters, "scope")}
                isOpen={openFilter === "scope"}
                label="Alcance"
                onClear={() => onClearSingleFilter("scope")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("scope")}
              >
                <div className="space-y-1">
                  {scopeFilterOptions.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("scope", option.value)} selected={filters.scope === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("periodo", "hidden lg:table-cell")}`}>
              <TableColumnFilterMenu
                active={isBudgetTableFilterActive(filters, "period")}
                isOpen={openFilter === "period"}
                label="Período"
                onClear={() => onClearSingleFilter("period")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("period")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("period", event.target.value)}
                    placeholder="Filtrar periodo"
                    type="text"
                    value={filters.period}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("limite")}`}>
              <TableColumnFilterMenu
                active={isBudgetTableFilterActive(filters, "limit")}
                align="right"
                isOpen={openFilter === "limit"}
                label="Límite"
                onClear={() => onClearSingleFilter("limit")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("limit")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("limit", event.target.value)}
                    placeholder="Límite"
                    type="text"
                    value={filters.limit}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("consumido")}`}>
              <TableColumnFilterMenu
                active={isBudgetTableFilterActive(filters, "spent")}
                align="right"
                isOpen={openFilter === "spent"}
                label="Consumido"
                onClear={() => onClearSingleFilter("spent")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("spent")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("spent", event.target.value)}
                    placeholder="Consumido"
                    type="text"
                    value={filters.spent}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("restante")}`}>
              <TableColumnFilterMenu
                active={isBudgetTableFilterActive(filters, "remaining")}
                align="right"
                isOpen={openFilter === "remaining"}
                label="Restante"
                onClear={() => onClearSingleFilter("remaining")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("remaining")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("remaining", event.target.value)}
                    placeholder="Restante"
                    type="text"
                    value={filters.remaining}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isBudgetTableFilterActive(filters, "status")}
                isOpen={openFilter === "status"}
                label="Estado"
                onClear={() => onClearSingleFilter("status")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("status")}
              >
                <div className="space-y-1">
                  {statusOptions.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("status", option.value)} selected={filters.status === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {budgets.map((budget, index) => (
            <tr
              className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === budgets.length - 1 ? "border-b-0" : ""}`}
              key={budget.id}
            >
              <td className="w-10 px-4 py-4">
                <SelectionCheckbox
                  ariaLabel={`Seleccionar ${budget.name}`}
                  checked={selectedIds.has(budget.id)}
                  onChange={() => onToggleSelect(budget.id)}
                />
              </td>
              <td className="px-5 py-3.5">
                <p className="font-medium text-ink">{budget.name}</p>
                <p className="text-xs text-storm">{budget.categoryName ?? budget.accountName ?? "Sin detalle fijo"}</p>
              </td>
              <td className={`px-5 py-3.5 text-storm ${cv("alcance", "hidden sm:table-cell")}`}>{budget.scopeLabel}</td>
              <td className={`px-5 py-3.5 text-storm ${cv("periodo", "hidden lg:table-cell")}`}>
                {formatDate(budget.periodStart)} – {formatDate(budget.periodEnd)}
              </td>
              <td className={`px-5 py-3.5 text-right font-semibold text-ink ${cv("limite")}`}>
                {formatCurrency(budget.displayLimitAmount, budget.displayCurrencyCode)}
              </td>
              <td className={`px-5 py-3.5 text-right text-ink ${cv("consumido")}`}>
                {formatCurrency(budget.displaySpentAmount, budget.displayCurrencyCode)}
              </td>
              <td className={`px-5 py-3.5 text-right font-semibold ${budget.displayRemainingAmount < 0 ? "text-ember" : "text-pine"} ${cv("restante")}`}>
                {formatCurrency(budget.displayRemainingAmount, budget.displayCurrencyCode)}
              </td>
              <td className="px-5 py-3.5">
                <StatusBadge status={getBudgetStatusLabel(budget)} tone={getBudgetTone(budget)} />
              </td>
              <td className="px-5 py-3.5 text-right">
                <RowActions>
                  <RowActionButton icon={BarChart3} label="Análisis" onClick={() => onAnalytics(budget.id)} />
                  <RowActionButton icon={PencilLine} label="Editar" onClick={() => onEdit(budget)} />
                  <RowActionButton
                    disabled={isToggling}
                    icon={Power}
                    label={budget.isActive ? "Desactivar" : "Activar"}
                    onClick={() => onToggleBudget(budget)}
                  />
                </RowActions>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
