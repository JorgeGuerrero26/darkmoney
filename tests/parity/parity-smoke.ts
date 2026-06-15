/**
 * Smoke de paridad WEB. Ejecuta la capa src/modules/dashboard/lib/parity/ sobre
 * el fixture compartido y compara contra parity-expected.json (generado por el
 * movil, que es la referencia). Tolerancia 1e-6.
 *
 * Uso: npm run test:parity
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  expenseAmt,
  getPeriodBounds,
  incomeAmt,
  inRange,
  isExpense,
  isIncome,
} from "@darkmoney/shared/aggregations";
import { convertParityAmount } from "@darkmoney/shared/currency";
import {
  buildAccountCurrencyMap,
  buildParityExchangeRateMap,
} from "@darkmoney/shared/exchange-map";
import { buildFutureFlowWindows } from "@darkmoney/shared/future-flow";
import { buildMonthProjection } from "@darkmoney/shared/month-projection";
import { buildParityNetWorth } from "@darkmoney/shared/net-worth";
import { buildReadiness } from "@darkmoney/shared/readiness";
import { buildReviewInboxSnapshot } from "@darkmoney/shared/review-inbox";
import { buildHealthScore } from "@darkmoney/shared/health";
import type {
  ParityConversionCtx,
  ParityMovement,
  ParityObligation,
  ParityRecurringIncome,
  ParitySubscription,
  Period,
} from "@darkmoney/shared/types";

type Fixture = {
  now: string;
  baseCurrency: string;
  displayCurrency: string;
  exchangeRates: Array<{ fromCurrencyCode: string; toCurrencyCode: string; rate: number; effectiveAt: string }>;
  accounts: Array<{
    id: number;
    type: string;
    currencyCode: string;
    currentBalance: number;
    currentBalanceInBaseCurrency?: number | null;
    isArchived: boolean;
    includeInNetWorth: boolean;
  }>;
  movements: ParityMovement[];
  obligations: ParityObligation[];
  subscriptions: ParitySubscription[];
  recurringIncome: ParityRecurringIncome[];
  healthInputs: { averageMonthlyExpense: number; totalPayable: number };
};

const DIR = join(process.cwd(), "tests", "parity");
const fixture: Fixture = JSON.parse(readFileSync(join(DIR, "parity-fixture.json"), "utf8"));
const expected = JSON.parse(readFileSync(join(DIR, "parity-expected.json"), "utf8"));
const now = new Date(fixture.now);

// El adaptador real (buildParityInputs) entrega los movimientos ordenados
// reciente-primero, como la query del movil. readiness depende de ese orden.
fixture.movements = [...fixture.movements].sort(
  (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime() || b.id - a.id,
);

const ctx: ParityConversionCtx = {
  accountCurrencyMap: buildAccountCurrencyMap(fixture.accounts as never),
  exchangeRateMap: buildParityExchangeRateMap(fixture.exchangeRates),
  displayCurrency: fixture.displayCurrency,
  baseCurrency: fixture.baseCurrency,
};

function round(value: number) {
  return Math.round(value * 1e6) / 1e6;
}

function periodTotals(period: Period) {
  const { curStart, curEnd } = getPeriodBounds(period, now);
  let income = 0;
  let expense = 0;
  for (const m of fixture.movements) {
    if (!inRange(m, curStart, curEnd)) continue;
    if (isIncome(m)) income += incomeAmt(m, ctx);
    else if (isExpense(m)) expense += expenseAmt(m, ctx);
  }
  return { income: round(income), expense: round(expense), net: round(income - expense) };
}

const netWorth = buildParityNetWorth(fixture.accounts as never, ctx);

const futureWindows = buildFutureFlowWindows(
  fixture.obligations,
  fixture.subscriptions,
  fixture.recurringIncome,
  fixture.displayCurrency,
  ctx.exchangeRateMap,
  netWorth.amount,
  fixture.baseCurrency,
  now,
).map((w) => ({
  days: w.days,
  expectedInflow: round(w.expectedInflow),
  expectedOutflow: round(w.expectedOutflow),
  estimatedBalance: round(w.estimatedBalance),
  scheduledCount: w.scheduledCount,
  receivableCount: w.receivableCount,
  payableCount: w.payableCount,
  unconvertedCount: w.unconvertedCount,
}));

const projection = buildMonthProjection(
  fixture.movements,
  fixture.obligations,
  fixture.subscriptions,
  fixture.recurringIncome,
  netWorth.amount,
  ctx,
  now,
);

const reviewInbox = buildReviewInboxSnapshot(
  fixture.movements,
  fixture.subscriptions,
  fixture.obligations,
  now,
);

const readiness = buildReadiness(fixture.movements, now);

// Salud: liquidMoney se DERIVA de las cuentas (regla cash/bank/savings, no archivadas)
// para que el smoke pruebe la misma regla que el call-site real, no un valor fijo.
const liquidAccountTypes = new Set(["cash", "bank", "savings"]);
const liquidMoney = fixture.accounts
  .filter((a) => liquidAccountTypes.has(a.type) && !a.isArchived)
  .reduce((sum, a) => {
    const raw = a.currentBalanceInBaseCurrency ?? a.currentBalance;
    return sum +
      (convertParityAmount({
        amount: raw,
        currencyCode: fixture.baseCurrency,
        baseCurrencyCode: fixture.baseCurrency,
        targetCurrencyCode: fixture.displayCurrency,
        exchangeRateMap: ctx.exchangeRateMap,
      }) ?? 0);
  }, 0);

// Salud: usa el período "month" (mismo en web y móvil).
const monthTotals = periodTotals("month");
const health = buildHealthScore({
  liquidMoney,
  averageMonthlyExpense: fixture.healthInputs.averageMonthlyExpense,
  periodIncome: monthTotals.income,
  periodNet: monthTotals.net,
  totalPayable: fixture.healthInputs.totalPayable,
  overdueCount: reviewInbox.overdueObligationsCount,
});

const actual = {
  netWorth: round(netWorth.amount),
  periods: {
    today: periodTotals("today"),
    week: periodTotals("week"),
    month: periodTotals("month"),
    last_30: periodTotals("last_30"),
  },
  futureWindows,
  monthProjection: {
    expectedBalance: round(projection.expectedBalance),
    committedInflow: round(projection.committedInflow),
    committedOutflow: round(projection.committedOutflow),
    variableIncomeProjection: round(projection.variableIncomeProjection),
    variableExpenseProjection: round(projection.variableExpenseProjection),
    remainingDays: projection.remainingDays,
  },
  reviewInbox: {
    uncategorizedCount: reviewInbox.uncategorizedCount,
    pendingMovementsCount: reviewInbox.pendingMovementsCount,
    duplicateExpenseGroups: reviewInbox.duplicateExpenseGroups,
    subscriptionsAttentionCount: reviewInbox.subscriptionsAttentionCount,
    obligationsWithoutPlanCount: reviewInbox.obligationsWithoutPlanCount,
    staleObligationsCount: reviewInbox.staleObligationsCount,
    overdueObligationsCount: reviewInbox.overdueObligationsCount,
    totalIssues: reviewInbox.totalIssues,
  },
  readiness: {
    readinessScore: readiness.readinessScore,
    historyDays: readiness.historyDays,
    usefulCount: readiness.usefulCount,
    categorizedRate: round(readiness.categorizedRate),
  },
  health: {
    score: health.score,
    tone: health.tone,
    savingsRate: health.savingsRate === null ? null : round(health.savingsRate),
    coverageMonths: health.coverageMonths === null ? null : round(health.coverageMonths),
    debtToIncomeRatio: health.debtToIncomeRatio === null ? null : round(health.debtToIncomeRatio),
    indicatorScores: health.indicators.map((indicator) => indicator.score),
  },
};

const TOLERANCE = 1e-6;
const mismatches: string[] = [];

function compare(path: string, a: unknown, e: unknown) {
  if (typeof a === "number" && typeof e === "number") {
    if (Math.abs(a - e) > TOLERANCE) mismatches.push(`${path}: web=${a} vs movil=${e}`);
    return;
  }
  if (Array.isArray(a) && Array.isArray(e)) {
    if (a.length !== e.length) {
      mismatches.push(`${path}: longitudes ${a.length} vs ${e.length}`);
      return;
    }
    a.forEach((item, index) => compare(`${path}[${index}]`, item, e[index]));
    return;
  }
  if (a && e && typeof a === "object" && typeof e === "object") {
    const keys = new Set([...Object.keys(a), ...Object.keys(e)]);
    for (const key of keys) {
      compare(`${path}.${key}`, (a as Record<string, unknown>)[key], (e as Record<string, unknown>)[key]);
    }
    return;
  }
  if (a !== e) mismatches.push(`${path}: web=${JSON.stringify(a)} vs movil=${JSON.stringify(e)}`);
}

compare("root", actual, expected);

if (mismatches.length > 0) {
  console.error("PARITY MISMATCH (web vs movil):");
  for (const line of mismatches) console.error(`  - ${line}`);
  process.exit(1);
}

console.log("parity-smoke (web): OK — coincide con la referencia movil.");
