import type { BudgetOverview } from "../../../types/domain";
import type { BudgetContribution } from "./budget-metrics";
import { budgetLimaDate } from "./budget-date.ts";

const day = (value: string) => Date.parse(`${value}T00:00:00Z`);

export function budgetHeadState(budget: BudgetOverview, today: string, periodLabel: string, money: (amount: number) => string) {
  if (budget.periodEnd < today && budget.movementCount === 0) {
    return { kind: "no-data" as const, sentence: `${periodLabel} cerró sin movimientos. No se anotó ningún gasto en este período; un cero no indica si cumpliste el límite.` };
  }
  if (budget.periodEnd < today) {
    const difference = budget.spentAmount - budget.limitAmount;
    return { kind: "verdict" as const, sentence: difference > 0
      ? `${periodLabel} cerró ${money(difference)} por encima del límite.`
      : `${periodLabel} cerró dentro del límite, con ${money(-difference)} sin gastar.` };
  }
  const remainingDays = Math.max(0, Math.round((day(budget.periodEnd) - day(today)) / 86_400_000));
  const totalDays = Math.max(1, Math.round((day(budget.periodEnd) - day(budget.periodStart)) / 86_400_000) + 1);
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.round((day(today) - day(budget.periodStart)) / 86_400_000) + 1));
  const expected = budget.limitAmount * elapsedDays / totalDays;
  const ahead = budget.spentAmount - expected;
  const daysText = remainingDays === 1 ? "queda 1 día" : `quedan ${remainingDays} días`;
  const sentence = budget.spentAmount > budget.limitAmount
    ? `${periodLabel}, ${daysText}. Te pasaste ${money(budget.spentAmount - budget.limitAmount)} del límite.`
    : ahead >= 1
      ? `${periodLabel}, ${daysText}. A estas alturas se esperaría ${money(expected)}: vas ${money(ahead)} por delante del ritmo.`
      : `${periodLabel}, ${daysText}. Te quedan ${money(budget.limitAmount - budget.spentAmount)}, unos ${money((budget.limitAmount - budget.spentAmount) / Math.max(1, remainingDays))} al día.`;
  return { kind: "progress" as const, sentence, pacePercent: elapsedDays / totalDays * 100 };
}

export function budgetSeriesReading(closed: BudgetOverview[], money: (amount: number) => string) {
  const withData = closed.filter((budget) => budget.movementCount > 0);
  if (!withData.length) return "";
  const over = withData.filter((budget) => budget.spentAmount > budget.limitAmount).length;
  if (!over) return withData.length === 1 ? "El último mes cerró dentro del límite." : `Dentro del límite los ${withData.length} últimos meses.`;
  if (over === withData.length && withData.length >= 2) return `Te pasaste los ${withData.length} meses. El límite de ${money(withData[0].limitAmount)} puede estar corto.`;
  return `Te pasaste en ${over} de ${withData.length === 1 ? "el último mes" : `los ${withData.length} últimos meses`}.${over >= 2 ? ` El límite de ${money(withData[0].limitAmount)} puede estar corto.` : ""}`;
}

export function budgetMovementDays(contributions: BudgetContribution[], visibleCount: number) {
  const ordered = [...contributions].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  const days = new Map<string, { date: string; subtotal: number; movements: BudgetContribution[] }>();
  for (const item of ordered.slice(0, visibleCount)) {
    const date = budgetLimaDate(item.occurredAt);
    const group = days.get(date);
    if (group) { group.subtotal += item.amountInBudgetCurrency; group.movements.push(item); }
    else days.set(date, { date, subtotal: item.amountInBudgetCurrency, movements: [item] });
  }
  const hidden = ordered.slice(visibleCount);
  return { days: [...days.values()], rest: { count: hidden.length, amount: hidden.reduce((sum, item) => sum + item.amountInBudgetCurrency, 0) } };
}
