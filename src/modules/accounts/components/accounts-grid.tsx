import { Archive, BarChart3, PencilLine } from "lucide-react";

import { Button } from "../../../components/ui/button";
import {
  createLongPressHandlers,
  SelectionCheckbox,
  wasRecentLongPress,
} from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary } from "../../../types/domain";
import { getAccountIcon, getTypePreset } from "../lib/account-options";

type AccountsGridProps = {
  accounts: AccountSummary[];
  onArchive: (account: AccountSummary) => void;
  onEdit: (account: AccountSummary) => void;
  onOpenAnalytics: (account: AccountSummary) => void;
  onToggleSelect: (id: number) => void;
  selectedCount: number;
  selectedIds: Set<number>;
};

export function AccountsGrid({
  accounts,
  onArchive,
  onEdit,
  onOpenAnalytics,
  onToggleSelect,
  selectedCount,
  selectedIds,
}: AccountsGridProps) {
  return (
    <section className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
      {accounts.map((account) => {
        const AccountIcon = getAccountIcon(account.icon, account.type);
        const isSelected = selectedIds.has(account.id);
        const typeLabel = getTypePreset(account.type).label;
        const longPressHandlers = createLongPressHandlers(() => onToggleSelect(account.id));

        return (
          <article
            className={`glass-panel-soft rounded-[24px] p-5 transition duration-300 hover:-translate-y-0.5 hover:border-white/15 ${
              isSelected ? "border-pine/30 ring-2 ring-pine/20" : ""
            }`}
            key={account.id}
            onClick={(event) => {
              if (wasRecentLongPress()) return;
              if (selectedCount === 0) return;
              if (
                event.target instanceof HTMLElement &&
                event.target.closest("button, a, input, label, [role='button']")
              ) {
                return;
              }
              onToggleSelect(account.id);
            }}
            {...longPressHandlers}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 text-white"
                style={{ backgroundColor: account.color }}
              >
                <AccountIcon className="h-5 w-5" />
              </div>
              <SelectionCheckbox
                ariaLabel={`Seleccionar ${account.name}`}
                checked={isSelected}
                onChange={() => onToggleSelect(account.id)}
              />
            </div>

            <div className="mt-4 min-w-0">
              <p className="break-words font-display text-2xl font-semibold leading-tight text-ink">
                {account.name}
              </p>
              <p className="mt-1 text-sm text-storm">
                {typeLabel} - {account.currencyCode}
              </p>
            </div>

            <div className="mt-5 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-storm">Saldo actual</p>
              <p className="mt-2 break-words font-display text-3xl font-semibold leading-tight text-ink">
                {formatCurrency(account.currentBalance, account.currencyCode)}
              </p>
              <p className="mt-2 text-xs leading-5 text-storm">
                Inicial {formatCurrency(account.openingBalance, account.currencyCode)}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-1.5">
              <StatusBadge
                status={account.includeInNetWorth ? "Patrimonio" : "Fuera"}
                tone={account.includeInNetWorth ? "success" : "warning"}
              />
              {account.isArchived ? <StatusBadge status="Archivada" tone="neutral" /> : null}
            </div>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-[0.65rem] uppercase tracking-[0.18em] text-storm">
                Ultima actividad
              </p>
              <p className="mt-1 text-sm font-medium text-ink">{formatDateTime(account.lastActivity)}</p>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Button
                aria-label={`Analizar ${account.name}`}
                className="min-h-11 px-3 py-2"
                onClick={() => onOpenAnalytics(account)}
                variant="ghost"
              >
                <BarChart3 className="h-4 w-4" />
              </Button>
              <Button
                aria-label={`Editar ${account.name}`}
                className="min-h-11 px-3 py-2"
                onClick={() => onEdit(account)}
                variant="secondary"
              >
                <PencilLine className="h-4 w-4" />
              </Button>
              <Button
                aria-label={account.isArchived ? `Reactivar ${account.name}` : `Archivar ${account.name}`}
                className="min-h-11 px-3 py-2"
                onClick={() => onArchive(account)}
                variant="ghost"
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
