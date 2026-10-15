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
  visibleBalance?: number;
  unconvertedAccounts?: number;
  unconvertedProjection?: number;
  activeAccountsCount?: number;
  upcomingSubscriptions?: number;
  visibleAccounts?: string;
  monthEndEstimate: number;
  monthEndIncomeToDate: number | null;
  monthEndExpenseToDate: number | null;
  weekExpectedInflow: number;
  weekExpectedOutflow: number;
  weekNet: number;
  unresolvedIssues: number;
  readinessScore: number;
  savingsRate: number | null;
  savingsAveragePct?: number | null;
  cashCushionDays?: number | null;
  cashCushionLabel?: string | null;
  collectionEfficiencyPct?: number | null;
  incomeStabilityScore?: number | null;
  unconvertedHealthHistory?: number;
  unconvertedHealthPayables?: number;
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
    visibleBalance: formatCurrency(inputs.visibleBalance ?? inputs.netWorth, currency),
    projectionBasis: "liquid_cash",
    projectionStartingBalance: formatCurrency(inputs.visibleBalance ?? inputs.netWorth, currency),
    monthEndReading: formatCurrency(inputs.monthEndEstimate, currency),
    monthEndDelta: formatCurrency(inputs.monthEndEstimate-(inputs.visibleBalance ?? inputs.netWorth),currency),
    monthEndIncomeToDate: inputs.monthEndIncomeToDate === null ? null : formatCurrency(inputs.monthEndIncomeToDate, currency),
    monthEndExpenseToDate: inputs.monthEndExpenseToDate === null ? null : formatCurrency(inputs.monthEndExpenseToDate, currency),
    monthStatus: inputs.monthEndIncomeToDate === null || inputs.monthEndExpenseToDate === null ? null : moneyStatus(inputs.monthEndIncomeToDate - inputs.monthEndExpenseToDate),
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
    upcomingSubscriptions: inputs.upcomingSubscriptions ?? null,
    activeAccountsCount: inputs.activeAccountsCount ?? null,
    visibleAccounts: inputs.visibleAccounts ?? null,
    cashCushionDays: inputs.cashCushionDays ?? null,
    cashCushionLabel: inputs.cashCushionLabel ?? null,
    collectionEfficiencyPct: inputs.collectionEfficiencyPct ?? null,
    savingsAveragePct: inputs.savingsAveragePct ?? null,
    incomeStabilityScore: inputs.incomeStabilityScore ?? null,
    dataCoverage: {
      unconvertedAccounts: inputs.unconvertedAccounts ?? 0,
      unconvertedProjection: inputs.unconvertedProjection ?? 0,
      unconvertedHealthHistory: inputs.unconvertedHealthHistory ?? 0,
      unconvertedHealthPayables: inputs.unconvertedHealthPayables ?? 0,
      unavailableIndicators: [
        inputs.cashCushionDays == null ? "cashCushionDays" : null,
        inputs.collectionEfficiencyPct == null ? "collectionEfficiencyPct" : null,
        inputs.savingsRate === null ? "savingsRatePct" : null,
        inputs.savingsAveragePct == null ? "savingsAveragePct" : null,
        inputs.incomeStabilityScore == null ? "incomeStabilityScore" : null,
        inputs.monthEndIncomeToDate === null || inputs.monthEndExpenseToDate === null ? "monthStatus" : null,
      ].filter((item): item is string => item !== null),
    },
    topFocusAction: inputs.topFocusAction
      ? { title: inputs.topFocusAction.title, body: inputs.topFocusAction.body ?? "" }
      : null,
  };
}
