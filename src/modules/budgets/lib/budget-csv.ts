import type { BudgetOverview } from "../../../types/domain";

export function buildBudgetCSV(budgets: BudgetOverview[]): string {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const headers = ["Nombre", "Ámbito", "Moneda", "Límite", "Gastado", "Restante", "Uso %", "Alerta %", "Movimientos", "Inicio", "Fin", "Rollover", "Notas"];
  const rows = budgets.map((budget) => [
    budget.name, budget.scopeLabel, budget.currencyCode, budget.limitAmount, budget.spentAmount,
    budget.remainingAmount, Math.round(budget.usedPercent), budget.alertPercent, budget.movementCount,
    budget.periodStart, budget.periodEnd, budget.rolloverEnabled ? "Sí" : "No", budget.notes ?? "",
  ].map(escape).join(","));
  return `\ufeff${[headers.join(","), ...rows].join("\n")}`;
}
