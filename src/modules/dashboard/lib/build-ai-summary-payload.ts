/**
 * Arma el payload "summary" que la web envía a la Edge Function
 * dashboard-advanced-ai-summary. Equivalente al dashboardAiSummaryPayload del
 * móvil: datos ya formateados/preprocesados que el prompt convierte en texto.
 *
 * La Edge Function solo exige un objeto con ≥1 propiedad, así que enviamos los
 * campos que la web ya calcula (patrimonio, cierre, semana, salud, pendientes).
 */

import { formatCurrency } from "../../../lib/formatting/money";

export type DashboardAiSummaryInputs = {
  workspaceName: string;
  displayCurrencyCode: string;
  netWorth: number;
  monthEndEstimate: number;
  monthEndIncomeToDate: number;
  monthEndExpenseToDate: number;
  weekExpectedInflow: number;
  weekExpectedOutflow: number;
  weekNet: number;
  unresolvedIssues: number;
  readinessScore: number;
  savingsRate: number | null;
  uncategorizedCount: number;
  overdueObligationsCount: number;
  activeSubscriptionsCount: number;
  topFocusAction: { title: string; body?: string } | null;
};

function moneyStatus(value: number): string {
  if (value > 0) return "positivo";
  if (value < 0) return "negativo";
  return "neutro";
}

export function buildDashboardAiSummaryPayload(
  inputs: DashboardAiSummaryInputs,
): Record<string, unknown> {
  const currency = inputs.displayCurrencyCode;

  return {
    workspaceName: inputs.workspaceName,
    currency,
    visibleBalance: formatCurrency(inputs.netWorth, currency),
    monthEndReading: formatCurrency(inputs.monthEndEstimate, currency),
    monthEndIncomeToDate: formatCurrency(inputs.monthEndIncomeToDate, currency),
    monthEndExpenseToDate: formatCurrency(inputs.monthEndExpenseToDate, currency),
    monthStatus: moneyStatus(inputs.monthEndIncomeToDate - inputs.monthEndExpenseToDate),
    weekStatus: inputs.weekExpectedOutflow > inputs.weekExpectedInflow ? "presión" : "controlado",
    weekNet: formatCurrency(inputs.weekNet, currency),
    weekExpectedInflow: formatCurrency(inputs.weekExpectedInflow, currency),
    weekExpectedOutflow: formatCurrency(inputs.weekExpectedOutflow, currency),
    dataReadinessScore: inputs.readinessScore,
    unresolvedIssues: inputs.unresolvedIssues,
    savingsRatePct: inputs.savingsRate !== null ? Number((inputs.savingsRate * 100).toFixed(1)) : null,
    uncategorizedMovements: inputs.uncategorizedCount,
    overdueObligations: inputs.overdueObligationsCount,
    activeSubscriptions: inputs.activeSubscriptionsCount,
    topFocusAction: inputs.topFocusAction
      ? { title: inputs.topFocusAction.title, body: inputs.topFocusAction.body ?? "" }
      : null,
  };
}
