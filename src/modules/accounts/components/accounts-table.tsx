import { Archive, BarChart3, Pencil } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary } from "../../../types/domain";
import { getAccountIcon, getTypePreset } from "../lib/account-options";

type AccountsTableProps = {
  accounts: AccountSummary[];
  allSelected: boolean;
  onArchive: (account: AccountSummary) => void;
  onEdit: (account: AccountSummary) => void;
  onOpenAnalytics: (account: AccountSummary) => void;
  onSelectAll: () => void;
  onToggleSelect: (id: number) => void;
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
  onArchive,
  onEdit,
  onOpenAnalytics,
  onSelectAll,
  onToggleSelect,
  selectedIds,
  someSelected,
  visibleColumns,
}: AccountsTableProps) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[#090f18]/95">
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
              <th className="px-5 py-4 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm">
                Cuenta
              </th>
              <th className={`px-5 py-4 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm ${columnClass(visibleColumns, "type")}`}>
                Tipo
              </th>
              <th className={`px-5 py-4 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm ${columnClass(visibleColumns, "balance")}`}>
                Saldo
              </th>
              <th className={`px-5 py-4 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm ${columnClass(visibleColumns, "currency")}`}>
                Moneda
              </th>
              <th className={`px-5 py-4 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm ${columnClass(visibleColumns, "status")}`}>
                Estado
              </th>
              <th className={`px-5 py-4 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm ${columnClass(visibleColumns, "activity")}`}>
                Ultima actividad
              </th>
              <th className="px-5 py-4 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm">
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
                  className="border-b border-white/[0.06] transition last:border-0 hover:bg-white/[0.025]"
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
                        <p className="mt-0.5 truncate text-xs text-storm">
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
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        aria-label={`Analizar ${account.name}`}
                        className="min-h-10 px-3 py-2"
                        onClick={() => onOpenAnalytics(account)}
                        variant="ghost"
                      >
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={`Editar ${account.name}`}
                        className="min-h-10 px-3 py-2"
                        onClick={() => onEdit(account)}
                        variant="ghost"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        aria-label={account.isArchived ? `Reactivar ${account.name}` : `Archivar ${account.name}`}
                        className="min-h-10 px-3 py-2"
                        onClick={() => onArchive(account)}
                        variant="ghost"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
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
