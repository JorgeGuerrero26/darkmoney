import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TableColumnFilterMenu, TableFilterOptionButton } from "../../../components/ui/table-column-filter-menu";
import { formatCurrency } from "../../../lib/formatting/money";
import type { ObligationSummary } from "../../../types/domain";
import {
  isObligationTableFilterActive,
  type ObligationTableFilterField,
  type ObligationTableFilters,
} from "../lib/obligations-filters";
import {
  getDirectionLabel,
  getDirectionTone,
  getDirectionVisual,
  getStatusOption,
  getStatusTone,
  statusOptions,
} from "../lib/obligations-presenters";

const filterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const headerCellClassName =
  "relative px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55";

const directionFilterValues = [
  { value: "all" as const, label: "Todas" },
  { value: "receivable" as const, label: "Me deben" },
  { value: "payable" as const, label: "Yo debo" },
];

type ColumnVisibilityFn = (key: string, hiddenClassName?: string) => string;

type ObligationTableProps = {
  obligations: ObligationSummary[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onEdit: (obligation: ObligationSummary) => void;
  onAnalytics: (id: number) => void;
  cv: ColumnVisibilityFn;
  filters: ObligationTableFilters;
  openFilter: ObligationTableFilterField | null;
  onUpdateFilter: <Field extends keyof ObligationTableFilters>(field: Field, value: ObligationTableFilters[Field]) => void;
  onClearSingleFilter: (field: ObligationTableFilterField) => void;
  onToggleFilterMenu: (field: ObligationTableFilterField) => void;
  onCloseFilterMenu: () => void;
  onApplyFilterAndClose: <Field extends ObligationTableFilterField>(field: Field, value: ObligationTableFilters[Field]) => void;
};

export function ObligationTable({
  obligations,
  selectedIds,
  allSelected,
  someSelected,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onEdit,
  onAnalytics,
  cv,
  filters,
  openFilter,
  onUpdateFilter,
  onClearSingleFilter,
  onToggleFilterMenu,
  onCloseFilterMenu,
  onApplyFilterAndClose,
}: ObligationTableProps) {
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
                active={isObligationTableFilterActive(filters, "title")}
                isOpen={openFilter === "title"}
                label="Registro"
                onClear={() => onClearSingleFilter("title")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("title")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("title", event.target.value)}
                    placeholder="Filtrar registro"
                    type="text"
                    value={filters.title}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("contraparte", "hidden sm:table-cell")}`}>
              <TableColumnFilterMenu
                active={isObligationTableFilterActive(filters, "counterparty")}
                isOpen={openFilter === "counterparty"}
                label="Contraparte"
                onClear={() => onClearSingleFilter("counterparty")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("counterparty")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("counterparty", event.target.value)}
                    placeholder="Filtrar contraparte"
                    type="text"
                    value={filters.counterparty}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("direccion", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isObligationTableFilterActive(filters, "direction")}
                isOpen={openFilter === "direction"}
                label="Direccion"
                onClear={() => onClearSingleFilter("direction")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("direction")}
              >
                <div className="space-y-1">
                  {directionFilterValues.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("direction", option.value)} selected={filters.direction === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("principal", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isObligationTableFilterActive(filters, "principal")}
                align="right"
                isOpen={openFilter === "principal"}
                label="Principal"
                onClear={() => onClearSingleFilter("principal")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("principal")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("principal", event.target.value)}
                    placeholder="Principal"
                    type="text"
                    value={filters.principal}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right`}>
              <TableColumnFilterMenu
                active={isObligationTableFilterActive(filters, "pending")}
                align="right"
                isOpen={openFilter === "pending"}
                label="Pendiente"
                onClear={() => onClearSingleFilter("pending")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("pending")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("pending", event.target.value)}
                    placeholder="Pendiente"
                    type="text"
                    value={filters.pending}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isObligationTableFilterActive(filters, "status")}
                isOpen={openFilter === "status"}
                label="Estado"
                onClear={() => onClearSingleFilter("status")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("status")}
              >
                <div className="space-y-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("status", "all")} selected={filters.status === "all"}>
                    Todos
                  </TableFilterOptionButton>
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
          {obligations.map((obligation, index) => {
            const directionVisual = getDirectionVisual(obligation.direction);
            const DirectionIcon = directionVisual.icon;
            const statusOption = getStatusOption(obligation.status);

            return (
              <tr
                className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === obligations.length - 1 ? "border-b-0" : ""}`}
                key={obligation.id}
              >
                <td className="w-10 px-4 py-3.5">
                  <SelectionCheckbox
                    ariaLabel={`Seleccionar ${obligation.title}`}
                    checked={selectedIds.has(obligation.id)}
                    onChange={() => onToggleSelect(obligation.id)}
                  />
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-white"
                      style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}
                    >
                      <DirectionIcon className="h-3.5 w-3.5" />
                    </div>
                    <p className="font-medium text-ink">{obligation.title}</p>
                  </div>
                </td>
                <td className={`px-5 py-3.5 text-storm ${cv("contraparte", "hidden sm:table-cell")}`}>{obligation.counterparty}</td>
                <td className={`px-5 py-3.5 ${cv("direccion", "hidden md:table-cell")}`}>
                  <StatusBadge status={getDirectionLabel(obligation.direction)} tone={getDirectionTone(obligation.direction)} />
                </td>
                <td className={`px-5 py-3.5 text-right text-storm ${cv("principal", "hidden md:table-cell")}`}>
                  {formatCurrency(obligation.currentPrincipalAmount ?? obligation.principalAmount, obligation.currencyCode)}
                </td>
                <td className="px-5 py-3.5 text-right font-medium text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex justify-end gap-2">
                    <Button className="py-1.5 text-xs" onClick={() => onAnalytics(obligation.id)} variant="ghost">
                      Análisis
                    </Button>
                    <Button className="py-1.5 text-xs" onClick={() => onEdit(obligation)} variant="ghost">
                      Ver
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
