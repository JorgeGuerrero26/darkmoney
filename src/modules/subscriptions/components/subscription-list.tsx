import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { SubscriptionSummary } from "../../../types/domain";
import { getStatusOption, getStatusTone } from "../lib/subscriptions-presenters";

type SubscriptionListProps = {
  subscriptions: SubscriptionSummary[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onEdit: (subscription: SubscriptionSummary) => void;
  onAnalytics: (id: number) => void;
};

export function SubscriptionList({
  subscriptions,
  selectedIds,
  onToggleSelect,
  onEdit,
  onAnalytics,
}: SubscriptionListProps) {
  return (
    <div className="space-y-3">
      {subscriptions.map((subscription) => {
        const statusOption = getStatusOption(subscription.status);

        return (
          <article
            className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16"
            key={subscription.id}
          >
            <SelectionCheckbox checked={selectedIds.has(subscription.id)} onChange={() => onToggleSelect(subscription.id)} />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{subscription.name}</p>
              <p className="text-xs text-storm">
                {subscription.vendor}
                {subscription.categoryName ? ` · ${subscription.categoryName}` : ""} · {subscription.frequencyLabel}
              </p>
            </div>
            <div className="hidden shrink-0 flex-col text-right sm:flex">
              <p className="text-sm font-semibold text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</p>
              <p className="text-xs text-storm">{formatDate(subscription.nextDueDate)}</p>
            </div>
            <StatusBadge status={statusOption.label} tone={getStatusTone(subscription.status)} />
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onAnalytics(subscription.id)} variant="ghost">
              Análisis
            </Button>
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onEdit(subscription)} variant="ghost">
              Editar
            </Button>
          </article>
        );
      })}
    </div>
  );
}
