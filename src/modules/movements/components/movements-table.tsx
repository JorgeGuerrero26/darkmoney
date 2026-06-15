import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { InlineDateRangePicker } from "../../../components/ui/inline-date-range-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TableColumnFilterMenu, TableFilterOptionButton } from "../../../components/ui/table-column-filter-menu";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatMovementStatusLabel } from "../../../lib/formatting/labels";
import { formatCurrency } from "../../../lib/formatting/money";
import type { MovementRecord, MovementStatus, MovementType } from "../../../types/domain";
import {
  getMovementDisplayInfo,
  getMovementStatusTone,
  getMovementTypeOption,
  getMovementTypeTone,
  isMovementTableFilterActive,
  movementStatusOptions,
  movementTypeOptions,
} from "../lib/movement-form";
import type { MovementTableFilterField, MovementTableFilters } from "../lib/movement-form";

const filterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const headerCellClassName =
  "relative px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55";

type ColumnVisibilityFn = (key: string, hiddenClassName: string) => string;

type MovementsTableProps = {
  movements: MovementRecord[];
  baseCurrencyCode: string;
  categories: string[];
  counterparties: string[];
  sourceAccounts: string[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onOpen: (movement: MovementRecord) => void;
  cv: ColumnVisibilityFn;
  filters: MovementTableFilters;
  openFilter: MovementTableFilterField | null;
  onUpdateFilter: <Field extends keyof MovementTableFilters>(field: Field, value: MovementTableFilters[Field]) => void;
  onClearSingleFilter: (field: MovementTableFilterField) => void;
  onToggleFilterMenu: (field: MovementTableFilterField) => void;
  onCloseFilterMenu: () => void;
  onApplyFilterAndClose: <Field extends MovementTableFilterField>(field: Field, value: MovementTableFilters[Field]) => void;
};

export function MovementsTable({
  movements,
  baseCurrencyCode,
  categories,
  counterparties,
  sourceAccounts,
  selectedIds,
  allSelected,
  someSelected,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onOpen,
  cv,
  filters,
  openFilter,
  onUpdateFilter,
  onClearSingleFilter,
  onToggleFilterMenu,
  onCloseFilterMenu,
  onApplyFilterAndClose,
}: MovementsTableProps) {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02]">
            <th className="w-10 px-4 py-3">
              <SelectionCheckbox
                ariaLabel="Seleccionar todos"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={() => (allSelected ? onClearAll() : onSelectAll())}
              />
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isMovementTableFilterActive(filters, "description")}
                isOpen={openFilter === "description"}
                label="Descripcion"
                onClear={() => onClearSingleFilter("description")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("description")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("description", event.target.value)}
                    placeholder="Buscar descripcion"
                    type="text"
                    value={filters.description}
                  />
                  <p className="text-xs leading-6 text-storm">
                    Busca por texto parcial en la descripcion del movimiento.
                  </p>
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("tipo", "hidden sm:table-cell")}`}>
              <TableColumnFilterMenu
                active={isMovementTableFilterActive(filters, "type")}
                isOpen={openFilter === "type"}
                label="Tipo"
                onClear={() => onClearSingleFilter("type")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("type")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton
                    onClick={() => onApplyFilterAndClose("type", "all")}
                    selected={filters.type === "all"}
                  >
                    Todos
                  </TableFilterOptionButton>
                  {movementTypeOptions.map((option) => (
                    <TableFilterOptionButton
                      key={option.value}
                      onClick={() => onApplyFilterAndClose("type", option.value as MovementType)}
                      selected={filters.type === option.value}
                    >
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("estado", "hidden sm:table-cell")}`}>
              <TableColumnFilterMenu
                active={isMovementTableFilterActive(filters, "status")}
                isOpen={openFilter === "status"}
                label="Estado"
                onClear={() => onClearSingleFilter("status")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("status")}
              >
                <div className="space-y-1">
                  <TableFilterOptionButton
                    onClick={() => onApplyFilterAndClose("status", "all")}
                    selected={filters.status === "all"}
                  >
                    Todos
                  </TableFilterOptionButton>
                  {movementStatusOptions.map((option) => (
                    <TableFilterOptionButton
                      key={option.value}
                      onClick={() => onApplyFilterAndClose("status", option.value as MovementStatus)}
                      selected={filters.status === option.value}
                    >
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("categoria", "hidden lg:table-cell")}`}>
              <TableColumnFilterMenu
                active={isMovementTableFilterActive(filters, "category")}
                isOpen={openFilter === "category"}
                label="Categoria"
                onClear={() => onClearSingleFilter("category")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("category")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton
                    onClick={() => onApplyFilterAndClose("category", "")}
                    selected={!filters.category}
                  >
                    Todas
                  </TableFilterOptionButton>
                  {categories.map((category) => (
                    <TableFilterOptionButton
                      key={category}
                      onClick={() => onApplyFilterAndClose("category", category)}
                      selected={filters.category === category}
                    >
                      {category}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("contraparte", "hidden xl:table-cell")}`}>
              <TableColumnFilterMenu
                active={isMovementTableFilterActive(filters, "counterparty")}
                isOpen={openFilter === "counterparty"}
                label="Contraparte"
                onClear={() => onClearSingleFilter("counterparty")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("counterparty")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton
                    onClick={() => onApplyFilterAndClose("counterparty", "")}
                    selected={!filters.counterparty}
                  >
                    Todas
                  </TableFilterOptionButton>
                  {counterparties.map((counterparty) => (
                    <TableFilterOptionButton
                      key={counterparty}
                      onClick={() => onApplyFilterAndClose("counterparty", counterparty)}
                      selected={filters.counterparty === counterparty}
                    >
                      {counterparty}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("cuenta_origen", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isMovementTableFilterActive(filters, "sourceAccount")}
                isOpen={openFilter === "sourceAccount"}
                label="Cuenta"
                onClear={() => onClearSingleFilter("sourceAccount")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("sourceAccount")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton
                    onClick={() => onApplyFilterAndClose("sourceAccount", "")}
                    selected={!filters.sourceAccount}
                  >
                    Todas
                  </TableFilterOptionButton>
                  {sourceAccounts.map((accountName) => (
                    <TableFilterOptionButton
                      key={accountName}
                      onClick={() => onApplyFilterAndClose("sourceAccount", accountName)}
                      selected={filters.sourceAccount === accountName}
                    >
                      {accountName}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right`}>
              <TableColumnFilterMenu
                active={isMovementTableFilterActive(filters, "amount")}
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
                    placeholder="Ej. 120 o 120.50"
                    type="text"
                    value={filters.amount}
                  />
                  <p className="text-xs leading-6 text-storm">
                    Filtra por coincidencia en el monto visible de la tabla.
                  </p>
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("fecha", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={
                  isMovementTableFilterActive(filters, "dateFrom") ||
                  isMovementTableFilterActive(filters, "dateTo")
                }
                align="right"
                isOpen={openFilter === "dateFrom" || openFilter === "dateTo"}
                label="Fecha"
                minWidthClassName="min-w-[320px]"
                onClear={() => {
                  onClearSingleFilter("dateFrom");
                  onClearSingleFilter("dateTo");
                }}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("dateFrom")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <InlineDateRangePicker
                    endDate={filters.dateTo}
                    onEndDateChange={(value) => onUpdateFilter("dateTo", value)}
                    onStartDateChange={(value) => onUpdateFilter("dateFrom", value)}
                    startDate={filters.dateFrom}
                  />
                  <p className="text-xs leading-6 text-storm">
                    Filtra por rango cronologico para trabajar como una hoja de calculo.
                  </p>
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {movements.map((movement, index) => {
            const movementTypeOption = getMovementTypeOption(movement.movementType);
            const displayInfo = getMovementDisplayInfo(movement, baseCurrencyCode);

            return (
              <tr
                className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === movements.length - 1 ? "border-b-0" : ""}`}
                key={movement.id}
              >
                <td className="w-10 px-4 py-3.5">
                  <SelectionCheckbox
                    ariaLabel={`Seleccionar ${movement.description}`}
                    checked={selectedIds.has(movement.id)}
                    onChange={() => onToggleSelect(movement.id)}
                  />
                </td>
                <td className="px-5 py-3.5 font-medium text-ink">{movement.description}</td>
                <td className={`px-5 py-3.5 ${cv("tipo", "hidden sm:table-cell")}`}>
                  <StatusBadge status={movementTypeOption.label} tone={getMovementTypeTone(movement.movementType)} />
                </td>
                <td className={`px-5 py-3.5 ${cv("estado", "hidden sm:table-cell")}`}>
                  <StatusBadge status={formatMovementStatusLabel(movement.status)} tone={getMovementStatusTone(movement.status)} />
                </td>
                <td className={`px-5 py-3.5 text-storm ${cv("categoria", "hidden lg:table-cell")}`}>{movement.category}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("contraparte", "hidden xl:table-cell")}`}>{movement.counterparty}</td>
                <td className={`px-5 py-3.5 text-storm ${cv("cuenta_origen", "hidden md:table-cell")}`}>{displayInfo.accountLabel}</td>
                <td className="px-5 py-3.5 text-right font-medium text-ink">
                  {displayInfo.amount !== null ? formatCurrency(displayInfo.amount, displayInfo.currencyCode) : "-"}
                </td>
                <td className={`px-5 py-3.5 text-right text-storm ${cv("fecha", "hidden md:table-cell")}`}>
                  {formatDateTime(movement.occurredAt)}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <Button className="py-1.5 text-xs" onClick={() => onOpen(movement)} variant="ghost">
                    Ver
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
