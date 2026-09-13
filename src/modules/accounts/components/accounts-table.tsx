import { Archive, BarChart3, MoreHorizontal, PencilLine } from "lucide-react";
import { useState } from "react";

import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
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
  const [openActionsId, setOpenActionsId] = useState<number | null>(null);

  return (
    <div className="border-t border-white/[0.08]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-2 py-2.5 text-xs text-storm sm:px-0">
        <label className="flex items-center gap-2">
          <SelectionCheckbox ariaLabel="Seleccionar todas las cuentas" checked={allSelected} indeterminate={someSelected} onChange={onSelectAll} />
          Seleccionar todas
        </label>
        <span>{accounts.length} cuentas</span>
      </div>

      {accounts.map((account) => {
        const AccountIcon = getAccountIcon(account.icon, account.type);
        const context = [
          visibleColumns.type === false ? null : getTypePreset(account.type).label,
          visibleColumns.currency === false ? null : account.currencyCode,
          visibleColumns.status === false ? null : account.isArchived ? "Archivada" : account.includeInNetWorth ? "En patrimonio" : "Fuera de patrimonio",
          visibleColumns.activity ? formatDateTime(account.lastActivity) : null,
        ].filter(Boolean).join(" · ");

        return (
          <div
            className="grid min-h-[60px] cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-white/[0.06] px-2 py-2 transition hover:bg-white/[0.025] sm:px-0"
            key={account.id}
            onClick={() => onEdit(account)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onEdit(account);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span onClick={(event) => event.stopPropagation()}>
              <SelectionCheckbox ariaLabel={`Seleccionar ${account.name}`} checked={selectedIds.has(account.id)} onChange={() => onToggleSelect(account.id)} />
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-[8px] border border-white/10 text-white" style={{ backgroundColor: account.color }}>
              <AccountIcon className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{account.name}</p>
              <p className="mt-0.5 truncate text-xs text-storm">{context}</p>
            </div>
            {visibleColumns.balance === false ? null : (
              <p className="text-right text-sm font-semibold text-ink">{formatCurrency(account.currentBalance, account.currencyCode)}</p>
            )}
            <div className="relative" onClick={(event) => event.stopPropagation()}>
              <button aria-expanded={openActionsId === account.id} aria-label={`Más opciones de ${account.name}`} className="grid h-8 w-8 place-items-center rounded-[7px] text-storm transition hover:bg-white/[0.05] hover:text-ink" onClick={() => setOpenActionsId((current) => current === account.id ? null : account.id)} type="button">
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {openActionsId === account.id ? (
                <>
                  <button aria-label="Cerrar opciones" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpenActionsId(null)} type="button" />
                  <div className="absolute right-0 top-9 z-50 w-48 overflow-hidden rounded-[9px] border border-white/[0.1] bg-[#1a1917]">
                    <button className="flex h-10 w-full items-center gap-3 px-4 text-left text-sm text-ink hover:bg-white/[0.04]" onClick={() => { setOpenActionsId(null); onOpenAnalytics(account); }} type="button"><BarChart3 className="h-4 w-4" />Analizar</button>
                    <button className="flex h-10 w-full items-center gap-3 px-4 text-left text-sm text-ink hover:bg-white/[0.04]" onClick={() => { setOpenActionsId(null); onEdit(account); }} type="button"><PencilLine className="h-4 w-4" />Editar</button>
                    <button className="flex h-10 w-full items-center gap-3 border-t border-white/[0.08] px-4 text-left text-sm text-storm hover:bg-white/[0.04] hover:text-ink" onClick={() => { setOpenActionsId(null); onArchive(account); }} type="button"><Archive className="h-4 w-4" />{account.isArchived ? "Reactivar" : "Archivar"}</button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
