import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { InlineDateRangePicker } from "../../../components/ui/inline-date-range-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TableColumnFilterMenu, TableFilterOptionButton } from "../../../components/ui/table-column-filter-menu";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { SubscriptionSummary } from "../../../types/domain";
import {
  isSubscriptionTableFilterActive,
  type SubscriptionTableFilterField,
  type SubscriptionTableFilters,
} from "../lib/subscriptions-filters";
import {
  frequencyOptions,
  getStatusOption,
  getStatusTone,
  statusOptions,
} from "../lib/subscriptions-presenters";

const filterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const headerCellClassName =
  "relative px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55";

type ColumnVisibilityFn = (key: string, hiddenClassName: string) => string;

type SubscriptionTableProps = {
  subscriptions: SubscriptionSummary[];
  vendors: string[];
  categories: string[];
  accounts: string[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onEdit: (subscription: SubscriptionSummary) => void;
  onAnalytics: (id: number) => void;
  cv: ColumnVisibilityFn;
  filters: SubscriptionTableFilters;
  openFilter: SubscriptionTableFilterField | null;
  onUpdateFilter: <Field extends keyof SubscriptionTableFilters>(field: Field, value: SubscriptionTableFilters[Field]) => void;
  onClearSingleFilter: (field: SubscriptionTableFilterField) => void;
  onToggleFilterMenu: (field: SubscriptionTableFilterField) => void;
  onCloseFilterMenu: () => void;
  onApplyFilterAndClose: <Field extends SubscriptionTableFilterField>(field: Field, value: SubscriptionTableFilters[Field]) => void;
};

export function SubscriptionTable({
  subscriptions,
  vendors,
  categories,
  accounts,
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
}: SubscriptionTableProps) {
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
                active={isSubscriptionTableFilterActive(filters, "name")}
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
            <th className={`${headerCellClassName} ${cv("proveedor", "hidden sm:table-cell")}`}>
              <TableColumnFilterMenu
                active={isSubscriptionTableFilterActive(filters, "vendor")}
                isOpen={openFilter === "vendor"}
                label="Proveedor"
                onClear={() => onClearSingleFilter("vendor")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("vendor")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("vendor", "")} selected={!filters.vendor}>
                    Todos
                  </TableFilterOptionButton>
                  {vendors.map((vendor) => (
                    <TableFilterOptionButton key={vendor} onClick={() => onApplyFilterAndClose("vendor", vendor)} selected={filters.vendor === vendor}>
                      {vendor}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("frecuencia", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isSubscriptionTableFilterActive(filters, "frequency")}
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
                active={isSubscriptionTableFilterActive(filters, "category")}
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
                active={isSubscriptionTableFilterActive(filters, "account")}
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
                active={isSubscriptionTableFilterActive(filters, "amount")}
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
                    placeholder="Ej. 19.9"
                    type="text"
                    value={filters.amount}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("proximo_cobro", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={
                  isSubscriptionTableFilterActive(filters, "nextDueDateFrom") ||
                  isSubscriptionTableFilterActive(filters, "nextDueDateTo")
                }
                align="right"
                isOpen={openFilter === "nextDueDateFrom" || openFilter === "nextDueDateTo"}
                label="Próximo cobro"
                minWidthClassName="min-w-[320px]"
                onClear={() => {
                  onClearSingleFilter("nextDueDateFrom");
                  onClearSingleFilter("nextDueDateTo");
                }}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("nextDueDateFrom")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <InlineDateRangePicker
                    endDate={filters.nextDueDateTo}
                    onEndDateChange={(value) => onUpdateFilter("nextDueDateTo", value)}
                    onStartDateChange={(value) => onUpdateFilter("nextDueDateFrom", value)}
                    startDate={filters.nextDueDateFrom}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isSubscriptionTableFilterActive(filters, "status")}
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
          {subscriptions.map((subscription, index) => {
            const statusOption = getStatusOption(subscription.status);

            return (
              <tr
                className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === subscriptions.length - 1 ? "border-b-0" : ""}`}
                key={subscription.id}
              >
                <td className="w-10 px-4 py-4">
                  <SelectionCheckbox
                    ariaLabel={`Seleccionar ${subscription.name}`}
                    checked={selectedIds.has(subscription.id)}
                    onChange={() => onToggleSelect(subscription.id)}
                  />
                </td>
                <td className="px-5 py-3.5 font-medium text-ink">{subscription.name}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("proveedor", "hidden sm:table-cell")}`}>{subscription.vendor}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("frecuencia", "hidden md:table-cell")}`}>{subscription.frequencyLabel}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("categoria", "hidden lg:table-cell")}`}>{subscription.categoryName ?? "-"}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("cuenta", "hidden xl:table-cell")}`}>{subscription.accountName ?? "-"}</td>
                <td className="px-5 py-3.5 text-right font-medium text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</td>
                <td className={`px-5 py-3.5 text-right text-storm ${cv("proximo_cobro", "hidden md:table-cell")}`}>{formatDate(subscription.nextDueDate)}</td>
                <td className="px-5 py-3.5">
                  <StatusBadge status={statusOption.label} tone={getStatusTone(subscription.status)} />
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex justify-end gap-2">
                    <Button className="py-1.5 text-xs" onClick={() => onAnalytics(subscription.id)} variant="ghost">
                      Análisis
                    </Button>
                    <Button className="py-1.5 text-xs" onClick={() => onEdit(subscription)} variant="ghost">
                      Editar
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
