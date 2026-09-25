import type { BudgetOverview } from "../../../types/domain";

export type BudgetRecurrence = NonNullable<BudgetOverview["recurrence"]>;
export type BudgetPeriod = Pick<BudgetOverview, "periodStart" | "periodEnd">;

export const recurrenceOptions: { value: BudgetRecurrence; label: string }[] = [
  { value: "weekly", label: "Cada semana" },
  { value: "biweekly", label: "Cada quincena" },
  { value: "monthly", label: "Cada mes" },
  { value: "quarterly", label: "Cada 3 meses" },
  { value: "yearly", label: "Cada año" },
  { value: "none", label: "Entre dos fechas" },
];

export function recurrenceLabel(value: BudgetRecurrence) {
  return recurrenceOptions.find((option) => option.value === value)?.label ?? "Entre dos fechas";
}

function utc(ymd: string) {
  return new Date(`${ymd}T12:00:00Z`);
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number) {
  const date = utc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return ymd(date);
}

function endOfMonth(value: string) {
  const date = utc(value);
  return ymd(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)));
}

function endOfQuarter(value: string) {
  const date = utc(value);
  return ymd(new Date(Date.UTC(date.getUTCFullYear(), Math.floor(date.getUTCMonth() / 3) * 3 + 3, 0)));
}

export function firstBudgetPeriod(today: string, recurrence: BudgetRecurrence): BudgetPeriod {
  switch (recurrence) {
    case "weekly": return { periodStart: today, periodEnd: addDays(today, 6) };
    case "biweekly": return { periodStart: today, periodEnd: addDays(today, 13) };
    case "monthly": return { periodStart: today, periodEnd: endOfMonth(today) };
    case "quarterly": return { periodStart: today, periodEnd: endOfQuarter(today) };
    case "yearly": return { periodStart: today, periodEnd: `${utc(today).getUTCFullYear()}-12-31` };
    case "none": return { periodStart: today, periodEnd: today };
  }
}

export function nextBudgetPeriod(previous: BudgetPeriod, recurrence: BudgetRecurrence): BudgetPeriod | null {
  if (recurrence === "none") return null;
  const periodStart = addDays(previous.periodEnd, 1);
  return { periodStart, periodEnd: firstBudgetPeriod(periodStart, recurrence).periodEnd };
}

export function duplicateBudgetPeriod(previous: BudgetPeriod): BudgetPeriod {
  const duration = Math.round((utc(previous.periodEnd).getTime() - utc(previous.periodStart).getTime()) / 86_400_000);
  const periodStart = addDays(previous.periodEnd, 1);
  return { periodStart, periodEnd: addDays(periodStart, duration) };
}

export function budgetRuleKey(budget: BudgetOverview) {
  const name = budget.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  return `${budget.categoryId ?? "-"}|${budget.accountId ?? "-"}|${budget.spendTypeId ?? "-"}|${name}`;
}

export type BudgetRule = {
  key: string;
  current: BudgetOverview | null;
  closed: BudgetOverview[];
};

export function groupBudgetRules(budgets: BudgetOverview[], today: string): BudgetRule[] {
  const byKey = new Map<string, BudgetOverview[]>();
  for (const budget of budgets) {
    const key = budgetRuleKey(budget);
    byKey.set(key, [...(byKey.get(key) ?? []), budget]);
  }
  return Array.from(byKey, ([key, rows]) => {
    const ordered = [...rows].sort((left, right) => right.periodStart.localeCompare(left.periodStart));
    return {
      key,
      current: ordered.find((row) => row.periodStart <= today && row.periodEnd >= today) ?? null,
      closed: ordered.filter((row) => row.periodEnd < today),
    };
  });
}

export function budgetRowNote(budget: BudgetOverview, today: string, formatAmount: (amount: number) => string) {
  const daysLeft = Math.max(0, Math.round((utc(budget.periodEnd).getTime() - utc(today).getTime()) / 86_400_000));
  const suffix = daysLeft === 1 ? "queda 1 día" : `quedan ${daysLeft} días`;
  if (budget.spentAmount > budget.limitAmount) {
    return `Te pasaste ${formatAmount(budget.spentAmount - budget.limitAmount)}, y ${suffix}.`;
  }
  const totalDays = Math.max(1, Math.round((utc(budget.periodEnd).getTime() - utc(budget.periodStart).getTime()) / 86_400_000) + 1);
  const elapsed = Math.max(0, Math.min(totalDays, Math.round((utc(today).getTime() - utc(budget.periodStart).getTime()) / 86_400_000) + 1));
  const abovePace = budget.spentAmount - budget.limitAmount * elapsed / totalDays;
  return daysLeft > 0 && abovePace >= 1 ? `Vas ${formatAmount(abovePace)} por encima del ritmo del período.` : "";
}
