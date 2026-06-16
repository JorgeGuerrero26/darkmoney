import { BarChart3, PencilLine, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { SubscriptionSummary } from "../../../types/domain";
import { getStatusOption, getStatusTone } from "../lib/subscriptions-presenters";

type SubscriptionGridProps = {
  subscriptions: SubscriptionSummary[];
  selectedIds: Set<number>;
  selectedCount: number;
  onToggleSelect: (id: number) => void;
  onEdit: (subscription: SubscriptionSummary) => void;
  onAnalytics: (id: number) => void;
  onDelete: (id: number) => void;
};

export function SubscriptionGrid({
  subscriptions,
  selectedIds,
  selectedCount,
  onToggleSelect,
  onEdit,
  onAnalytics,
  onDelete,
}: SubscriptionGridProps) {
  return (
    <div className="space-y-4">
      {subscriptions.map((subscription) => {
        const statusOption = getStatusOption(subscription.status);
        const isSelected = selectedIds.has(subscription.id);
        const longPressHandlers = createLongPressHandlers(() => onToggleSelect(subscription.id));

        return (
          <article
            className={`glass-panel-soft relative rounded-[24px] p-5 transition duration-200 hover:border-white/16 ${isSelected ? "border-pine/25 ring-2 ring-pine/30" : ""}`}
            key={subscription.id}
            onClick={(e) => {
              if (wasRecentLongPress()) return;
              if (selectedCount === 0) return;
              if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
              onToggleSelect(subscription.id);
            }}
            {...longPressHandlers}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-storm/85">
                    {subscription.frequencyLabel}
                  </span>
                  <StatusBadge status={statusOption.label} tone={getStatusTone(subscription.status)} />
                </div>
                <p className="mt-4 font-display text-2xl font-semibold text-ink">{subscription.name}</p>
                <p className="mt-2 text-sm text-storm">
                  {subscription.vendor}
                  {subscription.accountName ? ` - ${subscription.accountName}` : ""}
                  {subscription.categoryName ? ` - ${subscription.categoryName}` : ""}
                </p>
                {subscription.description ? <p className="mt-3 text-sm leading-7 text-storm">{subscription.description}</p> : null}
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-4 text-right">
                <p className="text-xs uppercase tracking-[0.22em] text-storm/75">Monto</p>
                <p className="mt-2 font-display text-2xl font-semibold text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-storm">Proximo cobro</p>
                <p className="mt-2 text-sm font-medium text-ink">{formatDate(subscription.nextDueDate)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-storm">Recordatorio</p>
                <p className="mt-2 text-sm font-medium text-ink">{subscription.remindDaysBefore} dias antes</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-storm">Auto movimiento</p>
                <p className="mt-2 text-sm font-medium text-ink">{subscription.autoCreateMovement ? "Activo" : "Desactivado"}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
              <Button onClick={() => onAnalytics(subscription.id)} variant="ghost">
                <BarChart3 className="mr-2 h-4 w-4" />
                Ver análisis
              </Button>
              <Button onClick={() => onEdit(subscription)} variant="secondary">
                <PencilLine className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button className="text-[#ffb4bc] hover:text-white" onClick={() => onDelete(subscription.id)} variant="ghost">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
