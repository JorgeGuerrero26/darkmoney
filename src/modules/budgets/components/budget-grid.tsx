import { BarChart3, PencilLine, PiggyBank, Trash2, Wallet } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { getBudgetStatusLabel, getBudgetTone, type DisplayBudgetOverview } from "../lib/budgets-presenters";

type BudgetGridProps = {
  budgets: DisplayBudgetOverview[];
  selectedIds: Set<number>;
  selectedCount: number;
  isToggling: boolean;
  onToggleSelect: (id: number) => void;
  onEdit: (budget: DisplayBudgetOverview) => void;
  onAnalytics: (id: number) => void;
  onToggleBudget: (budget: DisplayBudgetOverview) => void;
  onDelete: (id: number) => void;
};

export function BudgetGrid({
  budgets,
  selectedIds,
  selectedCount,
  isToggling,
  onToggleSelect,
  onEdit,
  onAnalytics,
  onToggleBudget,
  onDelete,
}: BudgetGridProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {budgets.map((budget) => {
        const progressWidth = Math.min(Math.max(budget.usedPercent, 2), 100);
        const remainingTone = budget.displayRemainingAmount < 0 ? "text-ember" : "text-pine";
        const isSelected = selectedIds.has(budget.id);
        const longPressHandlers = createLongPressHandlers(() => onToggleSelect(budget.id));

        return (
          <article
            className={`glass-panel-soft relative rounded-[24px] p-5 transition duration-200 hover:border-white/16 ${isSelected ? "border-pine/25 ring-2 ring-pine/30" : ""}`}
            key={budget.id}
            onClick={(e) => {
              if (wasRecentLongPress()) return;
              if (selectedCount === 0) return;
              if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
              onToggleSelect(budget.id);
            }}
            {...longPressHandlers}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={budget.scopeLabel} tone="info" />
                  <StatusBadge status={`Vista ${budget.displayCurrencyCode}`} tone="success" />
                  {budget.isConvertedDisplay ? <StatusBadge status={`Regla ${budget.currencyCode}`} tone="neutral" /> : null}
                  <StatusBadge status={getBudgetStatusLabel(budget)} tone={getBudgetTone(budget)} />
                  {!budget.isActive ? <StatusBadge status="Inactivo" tone="neutral" /> : null}
                </div>
                <h3 className="mt-4 font-display text-2xl font-semibold text-ink">{budget.name}</h3>
                <p className="mt-2 text-sm leading-7 text-storm">
                  {formatDate(budget.periodStart)} al {formatDate(budget.periodEnd)}
                </p>
              </div>

              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] text-pine">
                {budget.scopeKind === "account" || budget.scopeKind === "category_account" ? (
                  <Wallet className="h-6 w-6" />
                ) : (
                  <PiggyBank className="h-6 w-6" />
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Límite</p>
                <p className="mt-3 font-display text-2xl font-semibold text-ink">
                  {formatCurrency(budget.displayLimitAmount, budget.displayCurrencyCode)}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Consumido</p>
                <p className="mt-3 font-display text-2xl font-semibold text-ink">
                  {formatCurrency(budget.displaySpentAmount, budget.displayCurrencyCode)}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Restante</p>
                <p className={`mt-3 font-display text-2xl font-semibold ${remainingTone}`}>
                  {formatCurrency(budget.displayRemainingAmount, budget.displayCurrencyCode)}
                </p>
              </div>
            </div>

            <div className="mt-5">
              {budget.isConvertedDisplay ? (
                <p className="mb-3 text-xs uppercase tracking-[0.18em] text-storm/75">
                  Regla configurada en {budget.currencyCode}. Esta lectura se muestra en {budget.displayCurrencyCode}.
                </p>
              ) : null}
              <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-storm">
                <span>Uso del presupuesto</span>
                <span>{Math.round(budget.usedPercent)}%</span>
              </div>
              <div className="mt-3 h-3 rounded-full bg-white/[0.08]">
                <div
                  className={`h-full rounded-full ${
                    budget.isOverLimit
                      ? "bg-gradient-to-r from-ember to-[#ff9e6a]"
                      : budget.isNearLimit
                        ? "bg-gradient-to-r from-gold to-[#ffd18b]"
                        : "bg-gradient-to-r from-pine to-emerald-300"
                  }`}
                  style={{ width: `${progressWidth}%` }}
                />
              </div>
              <p className="mt-3 text-sm leading-7 text-storm">
                {budget.isOverLimit
                  ? `Ya sobrepasaste este techo por ${formatCurrency(Math.abs(budget.displayRemainingAmount), budget.displayCurrencyCode)}.`
                  : budget.isNearLimit
                    ? `Estas entrando en zona de alerta desde el ${Math.round(budget.alertPercent)}% configurado.`
                    : "Todavía tienes aire para seguir dentro del plan."}
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Categoría</p>
                <p className="mt-3 text-sm font-semibold text-ink">{budget.categoryName ?? "Sin categoría fija"}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Cuenta</p>
                <p className="mt-3 text-sm font-semibold text-ink">{budget.accountName ?? "Sin cuenta fija"}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-storm">
              <span>{budget.movementCount} movimientos dentro del periodo.</span>
              <span>Actualizado {formatDate(budget.updatedAt)}</span>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-5">
              <Button onClick={() => onAnalytics(budget.id)} variant="ghost">
                <BarChart3 className="mr-2 h-4 w-4" />
                Ver análisis
              </Button>
              <Button onClick={() => onEdit(budget)} variant="secondary">
                <PencilLine className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button disabled={isToggling} onClick={() => onToggleBudget(budget)} variant="ghost">
                {budget.isActive ? "Desactivar" : "Reactivar"}
              </Button>
              <Button className="text-[#ffb4bc] hover:text-white" onClick={() => onDelete(budget.id)} variant="ghost">
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
