import { Archive, BarChart3, Pencil } from "lucide-react";

import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { RowActionButton, RowActions } from "../../../components/ui/row-action-button";
import { StatusBadge } from "../../../components/ui/status-badge";
import {
  TableColumnFilterMenu,
  TableFilterOptionButton,
  tableColumnFilterInputClassName,
} from "../../../components/ui/table-column-filter-menu";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary } from "../../../types/domain";
import { accountStatusOptions, type AccountFilters, type AccountStatusFilter } from "../lib/account-filters";
import { getAccountIcon, getTypePreset } from "../lib/account-options";

type AccountColumnFilterField = "q" | "type" | "currency" | "status";

type AccountsTableProps = {
  accounts: AccountSummary[];
  allSelected: boolean;
  availableTypes: string[];
  availableCurrencyCodes: string[];
  filters: AccountFilters;
  openFilter: AccountColumnFilterField | null;
  onArchive: (account: AccountSummary) => void;
  onEdit: (account: AccountSummary) => void;
  onOpenAnalytics: (account: AccountSummary) => void;
  onSelectAll: () => void;
  onToggleSelect: (id: number) => void;
  onUpdateFilters: (filters: Partial<AccountFilters>, options?: { resetPage?: boolean }) => void;
  onToggleFilterMenu: (field: AccountColumnFilterField) => void;
  onCloseFilterMenu: () => void;
  selectedIds: Set<number>;
  someSelected: boolean;
  visibleColumns: Record<string, boolean>;
};

function columnClass(visibleColumns: Record<string, boolean>, key: string) {
  return visibleColumns[key] === false ? "hidden" : "";
}

export function AccountsTable({
  accounts,
  allSelected,
  availableTypes,
  availableCurrencyCodes,
  filters,
  openFilter,
  onArchive,
  onEdit,
  onOpenAnalytics,
  onSelectAll,
  onToggleSelect,
  onUpdateFilters,
  onToggleFilterMenu,
  onCloseFilterMenu,
  selectedIds,
  someSelected,
  visibleColumns,
}: AccountsTableProps) {
  function applyAndClose(next: Partial<AccountFilters>) {
    onUpdateFilters(next, { resetPage: true });
    onCloseFilterMenu();
  }

  return (
    <div className="glass-panel-soft overflow-hidden rounded-[24px]">
      <div className="overflow-x-auto">
        <table className="min-w-[960px] w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02]">
              <th className="w-12 px-4 py-4">
                <SelectionCheckbox
                  ariaLabel="Seleccionar todas las cuentas visibles"
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={onSelectAll}
                />
              </th>
              <th className="px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55">
                <TableColumnFilterMenu
                  active={filters.q.trim() !== ""}
                  isOpen={openFilter === "q"}
                  label="Cuenta"
                  onClear={() => onUpdateFilters({ q: "" }, { resetPage: true })}
                  onClose={onCloseFilterMenu}
                  onToggle={() => onToggleFilterMenu("q")}
                >
                  <div className="space-y-3">
                    <input
                      className={tableColumnFilterInputClassName}
                      onChange={(event) => onUpdateFilters({ q: event.target.value }, { resetPage: true })}
                      placeholder="Filtrar cuenta, tipo o moneda"
                      type="text"
                      value={filters.q}
                    />
                  </div>
                </TableColumnFilterMenu>
              </th>
              <th className={`px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55 ${columnClass(visibleColumns, "type")}`}>
                <TableColumnFilterMenu
                  active={filters.type !== ""}
                  isOpen={openFilter === "type"}
                  label="Tipo"
                  onClear={() => onUpdateFilters({ type: "" }, { resetPage: true })}
                  onClose={onCloseFilterMenu}
                  onToggle={() => onToggleFilterMenu("type")}
                >
                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    <TableFilterOptionButton onClick={() => applyAndClose({ type: "" })} selected={filters.type === ""}>
                      Todos
                    </TableFilterOptionButton>
                    {availableTypes.map((type) => (
                      <TableFilterOptionButton key={type} onClick={() => applyAndClose({ type })} selected={filters.type === type}>
                        {getTypePreset(type).label}
                      </TableFilterOptionButton>
                    ))}
                  </div>
                </TableColumnFilterMenu>
              </th>
              <th className={`px-5 py-3 text-right text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55 ${columnClass(visibleColumns, "balance")}`}>
                Saldo
              </th>
              <th className={`px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55 ${columnClass(visibleColumns, "currency")}`}>
                <TableColumnFilterMenu
                  active={filters.currency !== ""}
                  isOpen={openFilter === "currency"}
                  label="Moneda"
                  onClear={() => onUpdateFilters({ currency: "" }, { resetPage: true })}
                  onClose={onCloseFilterMenu}
                  onToggle={() => onToggleFilterMenu("currency")}
                >
                  <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    <TableFilterOptionButton onClick={() => applyAndClose({ currency: "" })} selected={filters.currency === ""}>
                      Todas
                    </TableFilterOptionButton>
                    {availableCurrencyCodes.map((currencyCode) => (
                      <TableFilterOptionButton key={currencyCode} onClick={() => applyAndClose({ currency: currencyCode })} selected={filters.currency === currencyCode}>
                        {currencyCode}
                      </TableFilterOptionButton>
                    ))}
                  </div>
                </TableColumnFilterMenu>
              </th>
              <th className={`px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55 ${columnClass(visibleColumns, "status")}`}>
                <TableColumnFilterMenu
                  active={filters.status !== "active"}
                  isOpen={openFilter === "status"}
                  label="Estado"
                  onClear={() => onUpdateFilters({ status: "active" }, { resetPage: true })}
                  onClose={onCloseFilterMenu}
                  onToggle={() => onToggleFilterMenu("status")}
                >
                  <div className="space-y-1">
                    {accountStatusOptions.map((option) => (
                      <TableFilterOptionButton
                        key={option.value}
                        onClick={() => applyAndClose({ status: option.value as AccountStatusFilter })}
                        selected={filters.status === option.value}
                      >
                        {option.label}
                      </TableFilterOptionButton>
                    ))}
                  </div>
                </TableColumnFilterMenu>
              </th>
              <th className={`px-5 py-4 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55 ${columnClass(visibleColumns, "activity")}`}>
                Ultima actividad
              </th>
              <th className="px-5 py-4 text-right text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => {
              const AccountIcon = getAccountIcon(account.icon, account.type);
              const typePreset = getTypePreset(account.type);

              return (
                <tr
                  className="group border-b border-white/[0.06] transition last:border-0 hover:bg-white/[0.025]"
                  key={account.id}
                >
                  <td className="w-12 px-4 py-4">
                    <SelectionCheckbox
                      ariaLabel={`Seleccionar ${account.name}`}
                      checked={selectedIds.has(account.id)}
                      onChange={() => onToggleSelect(account.id)}
                    />
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex min-w-[220px] items-center gap-3">
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white"
                        style={{ backgroundColor: account.color }}
                      >
                        <AccountIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{account.name}</p>
                        <p className="mt-0.5 truncate text-xs text-storm/55">
                          Saldo inicial {formatCurrency(account.openingBalance, account.currencyCode)}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className={`px-5 py-4 text-storm ${columnClass(visibleColumns, "type")}`}>
                    {typePreset.label}
                  </td>
                  <td className={`px-5 py-4 text-right font-semibold text-ink ${columnClass(visibleColumns, "balance")}`}>
                    {formatCurrency(account.currentBalance, account.currencyCode)}
                  </td>
                  <td className={`px-5 py-4 text-storm ${columnClass(visibleColumns, "currency")}`}>
                    {account.currencyCode}
                  </td>
                  <td className={`px-5 py-4 ${columnClass(visibleColumns, "status")}`}>
                    <div className="flex max-w-[220px] flex-wrap gap-1.5">
                      <StatusBadge
                        status={account.includeInNetWorth ? "Patrimonio" : "Fuera"}
                        tone={account.includeInNetWorth ? "success" : "warning"}
                      />
                      {account.isArchived ? <StatusBadge status="Archivada" tone="neutral" /> : null}
                    </div>
                  </td>
                  <td className={`px-5 py-4 text-storm ${columnClass(visibleColumns, "activity")}`}>
                    {formatDateTime(account.lastActivity)}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <RowActions>
                      <RowActionButton icon={BarChart3} label={`Analizar ${account.name}`} onClick={() => onOpenAnalytics(account)} />
                      <RowActionButton icon={Pencil} label={`Editar ${account.name}`} onClick={() => onEdit(account)} />
                      <RowActionButton
                        icon={Archive}
                        label={account.isArchived ? `Reactivar ${account.name}` : `Archivar ${account.name}`}
                        onClick={() => onArchive(account)}
                      />
                    </RowActions>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
