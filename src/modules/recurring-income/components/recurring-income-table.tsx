import { CheckCircle2, History, PencilLine } from "lucide-react";

import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { RowActionButton, RowActions } from "../../../components/ui/row-action-button";
import { InlineDateRangePicker } from "../../../components/ui/inline-date-range-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TableColumnFilterMenu, TableFilterOptionButton } from "../../../components/ui/table-column-filter-menu";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { RecurringIncomeSummary } from "../../../types/domain";
import {
  isRecurringIncomeTableFilterActive,
  type RecurringIncomeTableFilterField,
  type RecurringIncomeTableFilters,
} from "../lib/recurring-income-filters";
import {
  frequencyOptions,
  getStatusOption,
  getStatusTone,
  statusOptions,
} from "../lib/recurring-income-presenters";

const filterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const headerCellClassName =
  "relative px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55";

type ColumnVisibilityFn = (key: string, hiddenClassName: string) => string;

type RecurringIncomeTableProps = {
  income: RecurringIncomeSummary[];
  payers: string[];
  categories: string[];
  accounts: string[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onEdit: (income: RecurringIncomeSummary) => void;
  onConfirm: (id: number) => void;
  onHistory: (id: number) => void;
  cv: ColumnVisibilityFn;
  filters: RecurringIncomeTableFilters;
  openFilter: RecurringIncomeTableFilterField | null;
  onUpdateFilter: <Field extends keyof RecurringIncomeTableFilters>(field: Field, value: RecurringIncomeTableFilters[Field]) => void;
  onClearSingleFilter: (field: RecurringIncomeTableFilterField) => void;
  onToggleFilterMenu: (field: RecurringIncomeTableFilterField) => void;
  onCloseFilterMenu: () => void;
  onApplyFilterAndClose: <Field extends RecurringIncomeTableFilterField>(field: Field, value: RecurringIncomeTableFilters[Field]) => void;
};

export function RecurringIncomeTable({
  income,
  payers,
  categories,
  accounts,
  selectedIds,
  allSelected,
  someSelected,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onEdit,
  onConfirm,
  onHistory,
  cv,
  filters,
  openFilter,
  onUpdateFilter,
  onClearSingleFilter,
  onToggleFilterMenu,
  onCloseFilterMenu,
  onApplyFilterAndClose,
}: RecurringIncomeTableProps) {
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
                active={isRecurringIncomeTableFilterActive(filters, "name")}
                isOpen={openFilter === "name"}
                label="Nombre"
                onClear={() => onClearSingleFilter("name")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("name")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("name", event.target.value)}
                    placeholder="Buscar por nombre"
                    type="text"
                    value={filters.name}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("pagador", "hidden sm:table-cell")}`}>
              <TableColumnFilterMenu
                active={isRecurringIncomeTableFilterActive(filters, "payer")}
                isOpen={openFilter === "payer"}
                label="Pagador"
                onClear={() => onClearSingleFilter("payer")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("payer")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("payer", "")} selected={!filters.payer}>
                    Todos
                  </TableFilterOptionButton>
                  {payers.map((payer) => (
                    <TableFilterOptionButton key={payer} onClick={() => onApplyFilterAndClose("payer", payer)} selected={filters.payer === payer}>
                      {payer}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("frecuencia", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isRecurringIncomeTableFilterActive(filters, "frequency")}
                isOpen={openFilter === "frequency"}
                label="Frecuencia"
                onClear={() => onClearSingleFilter("frequency")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("frequency")}
              >
                <div className="space-y-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("frequency", "all")} selected={filters.frequency === "all"}>
                    Todas
                  </TableFilterOptionButton>
                  {frequencyOptions.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("frequency", option.value)} selected={filters.frequency === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("categoria", "hidden lg:table-cell")}`}>
              <TableColumnFilterMenu
                active={isRecurringIncomeTableFilterActive(filters, "category")}
                isOpen={openFilter === "category"}
                label="Categoria"
                onClear={() => onClearSingleFilter("category")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("category")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("category", "")} selected={!filters.category}>
                    Todas
                  </TableFilterOptionButton>
                  {categories.map((category) => (
                    <TableFilterOptionButton key={category} onClick={() => onApplyFilterAndClose("category", category)} selected={filters.category === category}>
                      {category}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("cuenta", "hidden xl:table-cell")}`}>
              <TableColumnFilterMenu
                active={isRecurringIncomeTableFilterActive(filters, "account")}
                isOpen={openFilter === "account"}
                label="Cuenta"
                onClear={() => onClearSingleFilter("account")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("account")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("account", "")} selected={!filters.account}>
                    Todas
                  </TableFilterOptionButton>
                  {accounts.map((accountName) => (
                    <TableFilterOptionButton key={accountName} onClick={() => onApplyFilterAndClose("account", accountName)} selected={filters.account === accountName}>
                      {accountName}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right`}>
              <TableColumnFilterMenu
                active={isRecurringIncomeTableFilterActive(filters, "amount")}
                align="right"
                isOpen={openFilter === "amount"}
                label="Monto"
                onClear={() => onClearSingleFilter("amount")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("amount")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("amount", event.target.value)}
                    placeholder="Ej. 250"
                    type="text"
                    value={filters.amount}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("proxima_llegada", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={
                  isRecurringIncomeTableFilterActive(filters, "nextExpectedDateFrom") ||
                  isRecurringIncomeTableFilterActive(filters, "nextExpectedDateTo")
                }
                align="right"
                isOpen={openFilter === "nextExpectedDateFrom" || openFilter === "nextExpectedDateTo"}
                label="Proxima llegada"
                minWidthClassName="min-w-[320px]"
                onClear={() => {
                  onClearSingleFilter("nextExpectedDateFrom");
                  onClearSingleFilter("nextExpectedDateTo");
                }}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("nextExpectedDateFrom")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <InlineDateRangePicker
                    endDate={filters.nextExpectedDateTo}
                    onEndDateChange={(value) => onUpdateFilter("nextExpectedDateTo", value)}
                    onStartDateChange={(value) => onUpdateFilter("nextExpectedDateFrom", value)}
                    startDate={filters.nextExpectedDateFrom}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isRecurringIncomeTableFilterActive(filters, "status")}
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
          {income.map((item, index) => {
            const statusOption = getStatusOption(item.status);

            return (
              <tr
                className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === income.length - 1 ? "border-b-0" : ""}`}
                key={item.id}
              >
                <td className="w-10 px-4 py-4">
                  <SelectionCheckbox
                    ariaLabel={`Seleccionar ${item.name}`}
                    checked={selectedIds.has(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                  />
                </td>
                <td className="px-5 py-3.5 font-medium text-ink">{item.name}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("pagador", "hidden sm:table-cell")}`}>{item.payer}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("frecuencia", "hidden md:table-cell")}`}>{item.frequencyLabel}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("categoria", "hidden lg:table-cell")}`}>{item.categoryName ?? "-"}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("cuenta", "hidden xl:table-cell")}`}>{item.accountName ?? "-"}</td>
                <td className="px-5 py-3.5 text-right font-medium text-ink">{formatCurrency(item.amount, item.currencyCode)}</td>
                <td className={`px-5 py-3.5 text-right text-storm ${cv("proxima_llegada", "hidden md:table-cell")}`}>{formatDate(item.nextExpectedDate)}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={statusOption.label} tone={getStatusTone(item.status)} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <RowActions>
                    {item.status === "active" ? (
                      <RowActionButton icon={CheckCircle2} label="Confirmar" onClick={() => onConfirm(item.id)} />
                    ) : null}
                    <RowActionButton icon={History} label="Historial" onClick={() => onHistory(item.id)} />
                    <RowActionButton icon={PencilLine} label="Editar" onClick={() => onEdit(item)} />
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
