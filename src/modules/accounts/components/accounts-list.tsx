import { Archive, BarChart3, Pencil } from "lucide-react";

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

type AccountsListProps = {
  accounts: AccountSummary[];
  onArchive: (account: AccountSummary) => void;
  onEdit: (account: AccountSummary) => void;
  onOpenAnalytics: (account: AccountSummary) => void;
  onToggleSelect: (id: number) => void;
  selectedCount: number;
  selectedIds: Set<number>;
};

export function AccountsList({
  accounts,
  onArchive,
  onEdit,
  onOpenAnalytics,
  onToggleSelect,
  selectedCount,
  selectedIds,
}: AccountsListProps) {
  return (
    <section className="space-y-3">
      {accounts.map((account) => {
        const AccountIcon = getAccountIcon(account.icon, account.type);
        const typeLabel = getTypePreset(account.type).label;
        const isSelected = selectedIds.has(account.id);
        const longPressHandlers = createLongPressHandlers(() => onToggleSelect(account.id));

        return (
          <article
            className={`rounded-[24px] border bg-[#090f18]/95 p-4 transition hover:border-white/16 ${
              isSelected ? "border-pine/30 ring-2 ring-pine/20" : "border-white/10"
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <SelectionCheckbox
                  ariaLabel={`Seleccionar ${account.name}`}
                  checked={isSelected}
                  onChange={() => onToggleSelect(account.id)}
                />
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] border border-white/10 text-white"
                  style={{ backgroundColor: account.color }}
                >
                  <AccountIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words font-semibold text-ink">{account.name}</p>
                    <StatusBadge
                      status={account.includeInNetWorth ? "Patrimonio" : "Fuera"}
                      tone={account.includeInNetWorth ? "success" : "warning"}
                    />
                    {account.isArchived ? <StatusBadge status="Archivada" tone="neutral" /> : null}
                  </div>
                  <p className="mt-1 text-sm text-storm">
                    {typeLabel} - {account.currencyCode} - {formatDateTime(account.lastActivity)}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[minmax(160px,1fr)_auto] sm:items-center md:w-auto">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left md:text-right">
                  <p className="text-[0.65rem] uppercase tracking-[0.18em] text-storm">Saldo</p>
                  <p className="mt-1 break-words font-display text-xl font-semibold text-ink">
                    {formatCurrency(account.currentBalance, account.currencyCode)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 md:justify-end">
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
                    variant="ghost"
                  >
                    <Pencil className="h-4 w-4" />
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
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
