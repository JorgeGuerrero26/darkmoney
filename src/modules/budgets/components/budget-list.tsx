import { PiggyBank, Wallet } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { getBudgetStatusLabel, getBudgetTone, type DisplayBudgetOverview } from "../lib/budgets-presenters";

type BudgetListProps = {
  budgets: DisplayBudgetOverview[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onEdit: (budget: DisplayBudgetOverview) => void;
  onAnalytics: (id: number) => void;
};

export function BudgetList({ budgets, selectedIds, onToggleSelect, onEdit, onAnalytics }: BudgetListProps) {
  return (
    <div className="space-y-3">
      {budgets.map((budget) => (
        <article
          className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16"
          key={budget.id}
        >
          <SelectionCheckbox
            ariaLabel={`Seleccionar ${budget.name}`}
            checked={selectedIds.has(budget.id)}
            onChange={() => onToggleSelect(budget.id)}
          />
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-pine">
            {budget.scopeKind === "account" || budget.scopeKind === "category_account" ? (
              <Wallet className="h-4 w-4" />
            ) : (
              <PiggyBank className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-ink">{budget.name}</p>
            <p className="text-xs text-storm">
              {budget.scopeLabel} · {formatDate(budget.periodStart)} – {formatDate(budget.periodEnd)}
            </p>
          </div>
          <div className="hidden items-center gap-3 sm:flex">
            <div className="h-2 w-24 rounded-full bg-white/[0.08]">
              <div
                className={`h-full rounded-full ${budget.isOverLimit ? "bg-ember" : budget.isNearLimit ? "bg-gold" : "bg-pine"}`}
                style={{ width: `${Math.min(budget.usedPercent, 100)}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs text-storm">{Math.round(budget.usedPercent)}%</span>
          </div>
          <div className="shrink-0 text-right">
            <p className={`font-display text-xl font-semibold ${budget.displayRemainingAmount < 0 ? "text-ember" : "text-pine"}`}>
              {formatCurrency(budget.displayRemainingAmount, budget.displayCurrencyCode)}
            </p>
            <p className="text-xs text-storm">de {formatCurrency(budget.displayLimitAmount, budget.displayCurrencyCode)}</p>
          </div>
          <StatusBadge status={getBudgetStatusLabel(budget)} tone={getBudgetTone(budget)} />
          <div className="flex shrink-0 gap-2">
            <Button className="py-1.5 text-xs" onClick={() => onAnalytics(budget.id)} variant="ghost">
              Análisis
            </Button>
            <Button className="py-1.5 text-xs" onClick={() => onEdit(budget)} variant="ghost">
              Editar
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
