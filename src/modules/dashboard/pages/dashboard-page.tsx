import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import {
  ArrowDownCircle,
  ArrowDownRight,
  ArrowUpCircle,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  PiggyBank,
  RefreshCw,
  Sparkles,
  WalletCards,
} from "lucide-react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { formatDate, formatDateTime } from "../../../lib/formatting/dates";
import { formatWorkspaceKindLabel, formatWorkspaceRoleLabel } from "../../../lib/formatting/labels";
import {
  formatCurrency,
  resolveCommonCurrencyCode,
} from "../../../lib/formatting/money";
import {
  getQueryErrorMessage,
  useSharedObligationsQuery,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import type {
  AccountSummary,
  ExchangeRateSummary,
  MovementRecord,
  ObligationSummary,
  SubscriptionSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";

type ComparisonPreset = "today" | "week" | "month" | "last30";

type ComparisonWindow = {
  start: Date;
  end: Date;
  label: string;
  detail: string;
};

type ComparisonDefinition = {
  preset: ComparisonPreset;
  current: ComparisonWindow;
  previous: ComparisonWindow;
  caption: string;
};

type DailySavingsPoint = {
  key: string;
  label: string;
  fullLabel: string;
  currentDate: Date;
  previousDate: Date;
  income: number;
  expense: number;
  net: number;
  cumulative: number;
  previousIncome: number;
  previousExpense: number;
  previousNet: number;
  previousCumulative: number;
};

type DailyFlowPoint = {
  key: string;
  label: string;
  fullLabel: string;
  currentDate: Date;
  previousDate: Date;
  daily: number;
  cumulative: number;
  previousDaily: number;
  previousCumulative: number;
};

type ChronologicalTrendTab = "savings" | "expense" | "income" | "transfer";

type CategoryComparisonItem = {
  key: string;
  name: string;
  current: number;
  previous: number;
  delta: number;
  currentCount: number;
  previousCount: number;
  share: number;
};

type AccountBreakdownItem = {
  account: AccountSummary;
  amount: number;
  share: number;
  periodMovementCount: number;
};

type ExposureItem = {
  key: string;
  counterpartyId: number | null;
  counterparty: string;
  amount: number;
  obligationCount: number;
  latestDate: string | null;
  titles: string[];
};

type MonthPulseItem = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  movementCount: number;
  startDate: Date;
};

type WeekdayItem = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  movementCount: number;
};

type PeriodTotals = {
  income: number;
  expense: number;
  net: number;
  movementCount: number;
};

type DashboardMode = "simple" | "advanced";

type DashboardWidgetId =
  | "overview_kpis"
  | "savings_trend"
  | "period_radar"
  | "budget_snapshot"
  | "obligation_watch"
  | "future_flow"
  | "alert_center"
  | "workspace_collaboration"
  | "data_quality"
  | "accounts_breakdown"
  | "receivable_leaders"
  | "payable_leaders"
  | "category_comparison"
  | "monthly_pulse"
  | "weekly_pattern"
  | "upcoming_recent"
  | "subscriptions_snapshot"
  | "transfer_snapshot"
  | "health_center"
  | "currency_exposure"
  | "learning_panel"
  | "activity_timeline";

type DashboardWidgetDefinition = {
  id: DashboardWidgetId;
  label: string;
  helper: string;
  modes: DashboardMode[];
};

type SubscriptionHighlightItem = {
  id: number;
  name: string;
  vendor: string;
  amount: number;
  monthlyAmount: number;
  nextDueDate: string;
  status: SubscriptionSummary["status"];
  categoryName?: string | null;
};

type TransferRouteItem = {
  key: string;
  label: string;
  source: string;
  destination: string;
  amount: number;
  count: number;
};

type CurrencyExposureItem = {
  currencyCode: string;
  amount: number;
  share: number;
  accountCount: number;
};

type FinancialHealthSnapshot = {
  tone: "success" | "warning" | "danger";
  title: string;
  description: string;
  realFreeMoney: number;
  savingsRate: number | null;
  coverageMonths: number | null;
  debtToIncomeRatio: number | null;
  overdueAmount: number;
};

type LearningInsightTone = "neutral" | "success" | "warning" | "danger" | "info";

type LearningPhaseDefinition = {
  step: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  minMovements: number;
  minHistoryDays: number;
  minCategorizedRate: number;
  minDistinctMonths: number;
  minDistinctCategories: number;
};

type LearningPhaseStatus = {
  step: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  remainingRequirements: string[];
};

type LearningInsight = {
  title: string;
  description: string;
  tone: LearningInsightTone;
};

type LearningSnapshot = {
  currentPhase: 0 | 1 | 2 | 3 | 4;
  readinessScore: number;
  totalPostedMovements: number;
  categorizedRate: number;
  historyDays: number;
  distinctMonths: number;
  distinctCategories: number;
  phases: LearningPhaseStatus[];
  insights: LearningInsight[];
  pendingActions: string[];
};

type AggregateAmountDisplayItem = {
  currencyCode: string;
  amount: number;
  amountInBaseCurrency?: number | null;
};

const comparisonOptions: Array<{
  value: ComparisonPreset;
  label: string;
  helper: string;
}> = [
  { value: "today", label: "Hoy vs ayer", helper: "corte diario" },
  { value: "week", label: "Semana vs anterior", helper: "hasta hoy" },
  { value: "month", label: "Mes vs anterior", helper: "mismo tramo" },
  { value: "last30", label: "30 dias vs 30 previos", helper: "ventana movil" },
];

const topOptions = [5, 8, 12];
const weekdayLabels = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const DASHBOARD_CURRENCY_STORAGE_KEY = "darkmoney.dashboard.displayCurrency";
const DASHBOARD_MODE_STORAGE_KEY = "darkmoney.dashboard.mode";
const DASHBOARD_HIDDEN_WIDGETS_STORAGE_KEY = "darkmoney.dashboard.hiddenWidgets";

const dashboardModeOptions: Array<{ value: DashboardMode; label: string; helper: string }> = [
  { value: "simple", label: "Vista simple", helper: "solo lo esencial" },
  { value: "advanced", label: "Vista avanzada", helper: "más análisis" },
];

const dashboardWidgetDefinitions: DashboardWidgetDefinition[] = [
  { id: "overview_kpis", label: "Resumen principal", helper: "KPIs y mini indicadores", modes: ["simple", "advanced"] },
  {
    id: "savings_trend",
    label: "Cronológicos del período",
    helper: "ahorro, gastos, ingresos y transferencias con detalle por día",
    modes: ["simple", "advanced"],
  },
  { id: "period_radar", label: "Radar del período", helper: "lecturas rápidas", modes: ["advanced"] },
  { id: "budget_snapshot", label: "Presupuestos", helper: "topes, uso y alertas", modes: ["simple", "advanced"] },
  { id: "obligation_watch", label: "Cartera", helper: "vencimientos y aging", modes: ["advanced"] },
  { id: "future_flow", label: "Flujo futuro", helper: "7, 15 y 30 días", modes: ["advanced"] },
  { id: "alert_center", label: "Alertas", helper: "anomalías y atención", modes: ["advanced"] },
  { id: "workspace_collaboration", label: "Colaboración", helper: "workspace y miembros", modes: ["advanced"] },
  { id: "data_quality", label: "Calidad del dato", helper: "limpieza del sistema", modes: ["advanced"] },
  { id: "accounts_breakdown", label: "Dinero por cuenta", helper: "saldos y actividad", modes: ["simple", "advanced"] },
  { id: "receivable_leaders", label: "Quienes te deben", helper: "cartera por cobrar", modes: ["simple", "advanced"] },
  { id: "payable_leaders", label: "A quienes debes", helper: "cartera por pagar", modes: ["simple", "advanced"] },
  { id: "category_comparison", label: "Categorías", helper: "comparativo de gasto", modes: ["simple", "advanced"] },
  { id: "monthly_pulse", label: "Pulso mensual", helper: "tendencia de meses", modes: ["advanced"] },
  { id: "weekly_pattern", label: "Ritmo semanal", helper: "hábitos por día", modes: ["advanced"] },
  { id: "upcoming_recent", label: "Vencimientos y movimientos", helper: "lo que viene y lo último", modes: ["simple", "advanced"] },
  { id: "subscriptions_snapshot", label: "Suscripciones", helper: "costo recurrente y top", modes: ["advanced"] },
  { id: "transfer_snapshot", label: "Transferencias", helper: "flujo entre cuentas", modes: ["advanced"] },
  { id: "health_center", label: "Salud financiera", helper: "riesgo, liquidez y ahorro", modes: ["advanced"] },
  { id: "currency_exposure", label: "Monedas", helper: "exposición cambiaria", modes: ["advanced"] },
  { id: "learning_panel", label: "Aprendiendo de ti", helper: "patrones y proyecciones", modes: ["advanced"] },
  { id: "activity_timeline", label: "Actividad reciente", helper: "historial del workspace", modes: ["advanced"] },
];

const learningPhaseDefinitions: LearningPhaseDefinition[] = [
  {
    step: 1,
    title: "Fase 1 - Base lista",
    description: "Detecta ritmo inicial, días fuertes y primeras categorías dominantes.",
    minMovements: 20,
    minHistoryDays: 21,
    minCategorizedRate: 0.35,
    minDistinctMonths: 1,
    minDistinctCategories: 2,
  },
  {
    step: 2,
    title: "Fase 2 - Patrones",
    description: "Empieza a reconocer rutinas por categoría, contraparte y días de gasto.",
    minMovements: 60,
    minHistoryDays: 56,
    minCategorizedRate: 0.55,
    minDistinctMonths: 2,
    minDistinctCategories: 4,
  },
  {
    step: 3,
    title: "Fase 3 - Proyecciones",
    description: "Activa proyecciones del mes y focos de gasto que vienen acelerándose.",
    minMovements: 120,
    minHistoryDays: 90,
    minCategorizedRate: 0.7,
    minDistinctMonths: 3,
    minDistinctCategories: 6,
  },
  {
    step: 4,
    title: "Fase 4 - Alertas inteligentes",
    description: "Lanza alertas tempranas y predicciones más confiables con historial suficiente.",
    minMovements: 200,
    minHistoryDays: 180,
    minCategorizedRate: 0.8,
    minDistinctMonths: 6,
    minDistinctCategories: 8,
  },
];

const shortDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
});

const fullDateFormatter = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const monthLabelFormatter = new Intl.DateTimeFormat("es-PE", {
  month: "short",
});

function normalizeCurrencyCode(currencyCode: string) {
  return currencyCode.trim().toUpperCase();
}

function buildExchangeRateKey(fromCurrencyCode: string, toCurrencyCode: string) {
  return `${normalizeCurrencyCode(fromCurrencyCode)}:${normalizeCurrencyCode(toCurrencyCode)}`;
}

function buildDashboardExchangeRateMap(exchangeRates: ExchangeRateSummary[]) {
  const exchangeRateMap = new Map<string, number>();

  for (const exchangeRate of exchangeRates) {
    const key = buildExchangeRateKey(
      exchangeRate.fromCurrencyCode,
      exchangeRate.toCurrencyCode,
    );

    if (exchangeRateMap.has(key) || exchangeRate.rate <= 0) {
      continue;
    }

    exchangeRateMap.set(key, exchangeRate.rate);
  }

  return exchangeRateMap;
}

function resolveDashboardExchangeRate(
  exchangeRateMap: Map<string, number>,
  fromCurrencyCode: string,
  toCurrencyCode: string,
) {
  const normalizedFromCurrency = normalizeCurrencyCode(fromCurrencyCode);
  const normalizedToCurrency = normalizeCurrencyCode(toCurrencyCode);

  if (normalizedFromCurrency === normalizedToCurrency) {
    return 1;
  }

  const directRate = exchangeRateMap.get(
    buildExchangeRateKey(normalizedFromCurrency, normalizedToCurrency),
  );

  if (directRate && directRate > 0) {
    return directRate;
  }

  const inverseRate = exchangeRateMap.get(
    buildExchangeRateKey(normalizedToCurrency, normalizedFromCurrency),
  );

  if (inverseRate && inverseRate > 0) {
    return 1 / inverseRate;
  }

  return null;
}

function convertDashboardAmount({
  amount,
  currencyCode,
  amountInBaseCurrency,
  baseCurrencyCode,
  targetCurrencyCode,
  exchangeRateMap,
}: {
  amount: number;
  currencyCode?: string | null;
  amountInBaseCurrency?: number | null;
  baseCurrencyCode: string;
  targetCurrencyCode: string;
  exchangeRateMap: Map<string, number>;
}) {
  const normalizedBaseCurrency = normalizeCurrencyCode(baseCurrencyCode);
  const normalizedTargetCurrency = normalizeCurrencyCode(targetCurrencyCode);
  const normalizedSourceCurrency = normalizeCurrencyCode(currencyCode ?? normalizedBaseCurrency);

  if (normalizedSourceCurrency === normalizedTargetCurrency) {
    return amount;
  }

  const directRate = resolveDashboardExchangeRate(
    exchangeRateMap,
    normalizedSourceCurrency,
    normalizedTargetCurrency,
  );

  if (directRate !== null) {
    return amount * directRate;
  }

  if (amountInBaseCurrency !== null && amountInBaseCurrency !== undefined) {
    if (normalizedTargetCurrency === normalizedBaseCurrency) {
      return amountInBaseCurrency;
    }

    const baseToTargetRate = resolveDashboardExchangeRate(
      exchangeRateMap,
      normalizedBaseCurrency,
      normalizedTargetCurrency,
    );

    if (baseToTargetRate !== null) {
      return amountInBaseCurrency * baseToTargetRate;
    }
  }

  return null;
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const currentDay = next.getDay();
  const diff = currentDay === 0 ? -6 : 1 - currentDay;
  next.setDate(next.getDate() + diff);
  return next;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDateDiffInclusive(start: Date, end: Date) {
  const normalizedStart = startOfDay(start).getTime();
  const normalizedEnd = startOfDay(end).getTime();
  return Math.max(1, Math.floor((normalizedEnd - normalizedStart) / 86_400_000) + 1);
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatShortDateRange(start: Date, end: Date) {
  if (toLocalDateKey(start) === toLocalDateKey(end)) {
    return shortDateFormatter.format(start);
  }

  return `${shortDateFormatter.format(start)} al ${shortDateFormatter.format(end)}`;
}

function buildComparisonDefinition(preset: ComparisonPreset, reference = new Date()): ComparisonDefinition {
  const today = endOfDay(reference);

  if (preset === "today") {
    const currentStart = startOfDay(reference);
    const previousStart = addDays(currentStart, -1);

    return {
      preset,
      current: {
        start: currentStart,
        end: today,
        label: "Hoy",
        detail: formatShortDateRange(currentStart, today),
      },
      previous: {
        start: previousStart,
        end: endOfDay(previousStart),
        label: "Ayer",
        detail: formatShortDateRange(previousStart, previousStart),
      },
      caption: "Hoy contra ayer para detectar cambios inmediatos.",
    };
  }

  if (preset === "week") {
    const currentStart = startOfWeek(reference);
    const daySpan = getDateDiffInclusive(currentStart, today);
    const previousStart = addDays(currentStart, -7);
    const previousEnd = addDays(previousStart, daySpan - 1);

    return {
      preset,
      current: {
        start: currentStart,
        end: today,
        label: "Esta semana",
        detail: formatShortDateRange(currentStart, today),
      },
      previous: {
        start: previousStart,
        end: endOfDay(previousEnd),
        label: "Semana anterior",
        detail: formatShortDateRange(previousStart, previousEnd),
      },
      caption: "Lectura semanal para ver si mantienes el ritmo que venias construyendo.",
    };
  }

  if (preset === "last30") {
    const currentStart = startOfDay(addDays(reference, -29));
    const previousStart = addDays(currentStart, -30);
    const previousEnd = addDays(previousStart, 29);

    return {
      preset,
      current: {
        start: currentStart,
        end: today,
        label: "Últimos 30 días",
        detail: formatShortDateRange(currentStart, today),
      },
      previous: {
        start: previousStart,
        end: endOfDay(previousEnd),
        label: "30 dias previos",
        detail: formatShortDateRange(previousStart, previousEnd),
      },
      caption: "Comparación móvil para ver tendencia real sin depender del cambio de mes.",
    };
  }

  const currentStart = startOfMonth(reference);
  const daySpan = getDateDiffInclusive(currentStart, today);
  const previousStart = new Date(currentStart.getFullYear(), currentStart.getMonth() - 1, 1);
  const previousEnd = addDays(previousStart, daySpan - 1);

  return {
    preset,
    current: {
      start: currentStart,
      end: today,
      label: "Este mes",
      detail: formatShortDateRange(currentStart, today),
    },
    previous: {
      start: previousStart,
      end: endOfDay(previousEnd),
      label: "Mismo tramo del mes anterior",
      detail: formatShortDateRange(previousStart, previousEnd),
    },
    caption: "Vista mensual para entender si mejoras o te estas saliendo del plan.",
  };
}

function isInRange(value: string, range: ComparisonWindow) {
  const timestamp = new Date(value).getTime();
  return timestamp >= range.start.getTime() && timestamp <= range.end.getTime();
}

function resolveAggregateAmountDisplay(
  items: AggregateAmountDisplayItem[],
  baseCurrencyCode: string,
) {
  const normalizedBaseCurrency = baseCurrencyCode.trim().toUpperCase();
  const currencyCode = resolveCommonCurrencyCode(
    items.map((item) => item.currencyCode),
    normalizedBaseCurrency,
  );

  const amount = items.reduce((total, item) => {
    const normalizedItemCurrency = item.currencyCode.trim().toUpperCase();

    if (currencyCode === normalizedBaseCurrency && normalizedItemCurrency !== normalizedBaseCurrency) {
      return total + (item.amountInBaseCurrency ?? item.amount);
    }

    return total + item.amount;
  }, 0);

  return {
    amount,
    currencyCode,
  };
}

function getIncomeAmount(movement: MovementRecord) {
  return Math.max(
    0,
    movement.destinationAmountInBaseCurrency ??
      movement.destinationAmount ??
      movement.sourceAmountInBaseCurrency ??
      movement.sourceAmount ??
      0,
  );
}

function getExpenseAmount(movement: MovementRecord) {
  return Math.max(
    0,
    movement.sourceAmountInBaseCurrency ??
      movement.sourceAmount ??
      movement.destinationAmountInBaseCurrency ??
      movement.destinationAmount ??
      0,
  );
}

function getTransferLineAmount(movement: MovementRecord) {
  return Math.max(
    0,
    movement.sourceAmountInBaseCurrency ??
      movement.sourceAmount ??
      movement.destinationAmountInBaseCurrency ??
      movement.destinationAmount ??
      0,
  );
}

function classifyMovement(
  movement: MovementRecord,
): { kind: "income" | "expense"; amount: number } | null {
  if (movement.status !== "posted") {
    return null;
  }

  if (movement.movementType === "income" || movement.movementType === "refund") {
    return { kind: "income", amount: getIncomeAmount(movement) };
  }

  if (
    movement.movementType === "expense" ||
    movement.movementType === "subscription_payment" ||
    movement.movementType === "obligation_payment"
  ) {
    return { kind: "expense", amount: getExpenseAmount(movement) };
  }

  if (movement.movementType === "adjustment") {
    const incoming = getIncomeAmount(movement);
    const outgoing = getExpenseAmount(movement);

    if (incoming === outgoing) {
      return null;
    }

    return incoming > outgoing
      ? { kind: "income", amount: incoming }
      : { kind: "expense", amount: outgoing };
  }

  return null;
}

function pickExpenseDailyAmount(movement: MovementRecord): number | null {
  const classified = classifyMovement(movement);

  return classified?.kind === "expense" ? classified.amount : null;
}

function pickIncomeDailyAmount(movement: MovementRecord): number | null {
  const classified = classifyMovement(movement);

  return classified?.kind === "income" ? classified.amount : null;
}

function pickTransferDailyAmount(movement: MovementRecord): number | null {
  if (movement.status !== "posted" || movement.movementType !== "transfer") {
    return null;
  }

  const amount = getTransferLineAmount(movement);

  return amount > 0 ? amount : null;
}

function classifyScheduledMovement(
  movement: MovementRecord,
): { kind: "income" | "expense"; amount: number } | null {
  if (movement.status === "voided" || movement.status === "posted") {
    return null;
  }

  if (movement.movementType === "income" || movement.movementType === "refund") {
    return { kind: "income", amount: getIncomeAmount(movement) };
  }

  if (
    movement.movementType === "expense" ||
    movement.movementType === "subscription_payment" ||
    movement.movementType === "obligation_payment"
  ) {
    return { kind: "expense", amount: getExpenseAmount(movement) };
  }

  if (movement.movementType === "adjustment") {
    const incoming = getIncomeAmount(movement);
    const outgoing = getExpenseAmount(movement);

    if (incoming === outgoing) {
      return null;
    }

    return incoming > outgoing
      ? { kind: "income", amount: incoming }
      : { kind: "expense", amount: outgoing };
  }

  return null;
}

function buildPeriodTotals(movements: MovementRecord[]) {
  return movements.reduce<PeriodTotals>(
    (totals, movement) => {
      const classified = classifyMovement(movement);

      if (!classified) {
        return totals;
      }

      totals.movementCount += 1;

      if (classified.kind === "income") {
        totals.income += classified.amount;
      } else {
        totals.expense += classified.amount;
      }

      totals.net = totals.income - totals.expense;
      return totals;
    },
    { income: 0, expense: 0, net: 0, movementCount: 0 },
  );
}

function buildSavingsSeries(
  movements: MovementRecord[],
  comparison: ComparisonDefinition,
) {
  const length = getDateDiffInclusive(comparison.current.start, comparison.current.end);
  const series = Array.from({ length }, (_, index) => {
    const currentDate = addDays(comparison.current.start, index);
    const previousDate = addDays(comparison.previous.start, index);

    return {
      key: toLocalDateKey(currentDate),
      label:
        length <= 10
          ? weekdayLabels[(currentDate.getDay() + 6) % 7]
          : shortDateFormatter.format(currentDate),
      fullLabel: fullDateFormatter.format(currentDate),
      currentDate,
      previousDate,
      income: 0,
      expense: 0,
      net: 0,
      cumulative: 0,
      previousIncome: 0,
      previousExpense: 0,
      previousNet: 0,
      previousCumulative: 0,
    } satisfies DailySavingsPoint;
  });

  const currentIndexByDate = new Map(series.map((item, index) => [toLocalDateKey(item.currentDate), index]));
  const previousIndexByDate = new Map(series.map((item, index) => [toLocalDateKey(item.previousDate), index]));

  for (const movement of movements) {
    const classified = classifyMovement(movement);

    if (!classified) {
      continue;
    }

    const movementDate = new Date(movement.occurredAt);
    const currentIndex = currentIndexByDate.get(toLocalDateKey(movementDate));

    if (currentIndex !== undefined) {
      if (classified.kind === "income") {
        series[currentIndex].income += classified.amount;
      } else {
        series[currentIndex].expense += classified.amount;
      }
    }

    const previousIndex = previousIndexByDate.get(toLocalDateKey(movementDate));

    if (previousIndex !== undefined) {
      if (classified.kind === "income") {
        series[previousIndex].previousIncome += classified.amount;
      } else {
        series[previousIndex].previousExpense += classified.amount;
      }
    }
  }

  let runningCurrent = 0;
  let runningPrevious = 0;

  return series.map((item) => {
    const net = item.income - item.expense;
    const previousNet = item.previousIncome - item.previousExpense;
    runningCurrent += net;
    runningPrevious += previousNet;

    return {
      ...item,
      net,
      cumulative: runningCurrent,
      previousNet,
      previousCumulative: runningPrevious,
    };
  });
}

function buildDailyFlowSeries(
  movements: MovementRecord[],
  comparison: ComparisonDefinition,
  pickDaily: (movement: MovementRecord) => number | null,
): DailyFlowPoint[] {
  const length = getDateDiffInclusive(comparison.current.start, comparison.current.end);
  const series = Array.from({ length }, (_, index) => {
    const currentDate = addDays(comparison.current.start, index);
    const previousDate = addDays(comparison.previous.start, index);

    return {
      key: toLocalDateKey(currentDate),
      label:
        length <= 10
          ? weekdayLabels[(currentDate.getDay() + 6) % 7]
          : shortDateFormatter.format(currentDate),
      fullLabel: fullDateFormatter.format(currentDate),
      currentDate,
      previousDate,
      daily: 0,
      cumulative: 0,
      previousDaily: 0,
      previousCumulative: 0,
    } satisfies DailyFlowPoint;
  });

  const currentIndexByDate = new Map(series.map((item, index) => [toLocalDateKey(item.currentDate), index]));
  const previousIndexByDate = new Map(series.map((item, index) => [toLocalDateKey(item.previousDate), index]));

  for (const movement of movements) {
    const amount = pickDaily(movement);

    if (amount === null || amount <= 0) {
      continue;
    }

    const movementDate = new Date(movement.occurredAt);
    const currentIndex = currentIndexByDate.get(toLocalDateKey(movementDate));

    if (currentIndex !== undefined) {
      series[currentIndex].daily += amount;
    }

    const previousIndex = previousIndexByDate.get(toLocalDateKey(movementDate));

    if (previousIndex !== undefined) {
      series[previousIndex].previousDaily += amount;
    }
  }

  let runningCurrent = 0;
  let runningPrevious = 0;

  return series.map((item) => {
    runningCurrent += item.daily;
    runningPrevious += item.previousDaily;

    return {
      ...item,
      cumulative: runningCurrent,
      previousCumulative: runningPrevious,
    };
  });
}

function DashboardLoadingSkeleton() {
  return (
    <>
      <section className="grid gap-4 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div className="shimmer-surface h-[164px]" key={`dashboard-metric-${index}`} />
        ))}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="shimmer-surface h-[440px]" />
        <div className="shimmer-surface h-[440px]" />
      </section>
      <section className="grid gap-6 xl:grid-cols-3">
        <div className="shimmer-surface h-[420px]" />
        <div className="shimmer-surface h-[420px]" />
        <div className="shimmer-surface h-[420px]" />
      </section>
    </>
  );
}

function GhostLink({ label, to }: { label: string; to: string }) {
  return (
    <Link
      className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-ink transition hover:border-pine/30 hover:bg-pine/10 hover:text-pine"
      to={to}
    >
      {label}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; helper?: string; disabled?: boolean }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = option.value === value;
        const isDisabled = Boolean(option.disabled);

        return (
          <button
            className={`rounded-[18px] border px-4 py-2 text-left transition ${
              isDisabled
                ? "cursor-not-allowed border-white/8 bg-white/[0.02] text-storm/45"
                : isActive
                ? "border-pine/30 bg-pine/12 text-ink shadow-[0_0_0_1px_rgba(56,161,105,0.12)]"
                : "border-white/10 bg-white/[0.03] text-storm hover:border-white/20 hover:bg-white/[0.06]"
            }`}
            disabled={isDisabled}
            key={String(option.value)}
            onClick={() => onChange(option.value)}
            type="button"
          >
            <div className="text-sm font-semibold">{option.label}</div>
            {option.helper ? (
              <div
                className={`mt-1 text-[11px] uppercase tracking-[0.16em] ${
                  isDisabled ? "text-storm/45" : isActive ? "text-pine" : "text-storm/75"
                }`}
              >
                {option.helper}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function OverviewCard({
  accent = "ink",
  hint,
  icon,
  label,
  trendLabel,
  trendTone = "neutral",
  value,
}: {
  accent?: "pine" | "ember" | "gold" | "ink";
  hint: string;
  icon: ReactNode;
  label: string;
  trendLabel?: string;
  trendTone?: "neutral" | "success" | "warning" | "danger" | "info";
  value: string;
}) {
  const accentStyles = {
    pine: "from-pine/18 to-pine/5 text-pine",
    ember: "from-ember/18 to-ember/5 text-ember",
    gold: "from-gold/20 to-gold/6 text-gold",
    ink: "from-white/16 to-white/6 text-ink",
  }[accent];

  return (
    <article className="glass-panel rounded-[28px] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-2 sm:gap-4">
        <div className="min-w-0">
          <p className="text-[0.65rem] uppercase tracking-[0.18em] text-storm/90 sm:text-xs sm:tracking-[0.24em]">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-ink sm:mt-3 sm:text-4xl">{value}</p>
        </div>
        <div className={`hidden rounded-[22px] bg-gradient-to-br p-3 ring-1 ring-white/8 sm:block ${accentStyles}`}>
          {icon}
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-storm">{hint}</p>
      {trendLabel ? <StatusBadge className="mt-4" status={trendLabel} tone={trendTone} /> : null}
    </article>
  );
}

function DeltaBadge({
  value,
  currencyCode,
  inverse = false,
}: {
  value: number;
  currencyCode: string;
  inverse?: boolean;
}) {
  const adjusted = inverse ? value * -1 : value;
  const tone = adjusted > 0 ? "success" : adjusted < 0 ? "danger" : "neutral";
  const prefix = value > 0 ? "+" : "";

  return <StatusBadge status={`${prefix}${formatCurrency(value, currencyCode)}`} tone={tone} />;
}

function buildCategoryComparison(
  currentMovements: MovementRecord[],
  previousMovements: MovementRecord[],
) {
  const categories = new Map<string, CategoryComparisonItem>();
  let currentExpenseTotal = 0;

  const pushExpense = (movement: MovementRecord, bucket: "current" | "previous") => {
    const classified = classifyMovement(movement);

    if (!classified || classified.kind !== "expense") {
      return;
    }

    const key = movement.category || "Sin categoria";
    const existing = categories.get(key) ?? {
      key,
      name: key,
      current: 0,
      previous: 0,
      delta: 0,
      currentCount: 0,
      previousCount: 0,
      share: 0,
    };

    if (bucket === "current") {
      existing.current += classified.amount;
      existing.currentCount += 1;
      currentExpenseTotal += classified.amount;
    } else {
      existing.previous += classified.amount;
      existing.previousCount += 1;
    }

    categories.set(key, existing);
  };

  currentMovements.forEach((movement) => pushExpense(movement, "current"));
  previousMovements.forEach((movement) => pushExpense(movement, "previous"));

  return [...categories.values()]
    .map((item) => ({
      ...item,
      delta: item.current - item.previous,
      share: currentExpenseTotal > 0 ? item.current / currentExpenseTotal : 0,
    }))
    .filter((item) => item.current > 0 || item.previous > 0)
    .sort((left, right) => Math.max(right.current, right.previous) - Math.max(left.current, left.previous));
}

function buildAccountBreakdown(
  accounts: AccountSummary[],
  periodMovements: MovementRecord[],
) {
  const movementCountByAccountId = new Map<number, number>();
  const totalBalance = accounts.reduce(
    (total, account) => total + (account.currentBalanceInBaseCurrency ?? account.currentBalance),
    0,
  );

  for (const movement of periodMovements) {
    if (movement.sourceAccountId) {
      movementCountByAccountId.set(
        movement.sourceAccountId,
        (movementCountByAccountId.get(movement.sourceAccountId) ?? 0) + 1,
      );
    }

    if (movement.destinationAccountId) {
      movementCountByAccountId.set(
        movement.destinationAccountId,
        (movementCountByAccountId.get(movement.destinationAccountId) ?? 0) + 1,
      );
    }
  }

  return [...accounts]
    .map<AccountBreakdownItem>((account) => {
      const amount = account.currentBalanceInBaseCurrency ?? account.currentBalance;

      return {
        account,
        amount,
        share: totalBalance > 0 ? amount / totalBalance : 0,
        periodMovementCount: movementCountByAccountId.get(account.id) ?? 0,
      };
    })
    .sort((left, right) => right.amount - left.amount);
}

function buildExposureLeaders(
  obligations: ObligationSummary[],
  direction: ObligationSummary["direction"],
) {
  const grouped = new Map<string, ExposureItem>();

  for (const obligation of obligations) {
    if (obligation.direction !== direction) {
      continue;
    }

    const amount = obligation.pendingAmountInBaseCurrency ?? obligation.pendingAmount;

    if (amount <= 0) {
      continue;
    }

    const key = `${obligation.counterpartyId ?? "none"}-${obligation.counterparty}`;
    const current = grouped.get(key) ?? {
      key,
      counterpartyId: obligation.counterpartyId,
      counterparty: obligation.counterparty,
      amount: 0,
      obligationCount: 0,
      latestDate: null,
      titles: [],
    };

    current.amount += amount;
    current.obligationCount += 1;
    current.latestDate =
      current.latestDate && obligation.dueDate
        ? new Date(current.latestDate).getTime() > new Date(obligation.dueDate).getTime()
          ? current.latestDate
          : obligation.dueDate
        : current.latestDate ?? obligation.dueDate ?? obligation.startDate;

    if (!current.titles.includes(obligation.title)) {
      current.titles.push(obligation.title);
    }

    grouped.set(key, current);
  }

  return [...grouped.values()].sort((left, right) => right.amount - left.amount);
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}`;
}

function getMonthLabel(date: Date) {
  return monthLabelFormatter
    .format(date)
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
}

function buildMonthlyPulse(movements: MovementRecord[]) {
  const today = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const startDate = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);

    return {
      key: getMonthKey(startDate),
      label: getMonthLabel(startDate),
      income: 0,
      expense: 0,
      net: 0,
      movementCount: 0,
      startDate,
    } satisfies MonthPulseItem;
  });

  const lookup = new Map(months.map((month) => [month.key, month]));

  for (const movement of movements) {
    const classified = classifyMovement(movement);

    if (!classified) {
      continue;
    }

    const bucket = lookup.get(getMonthKey(new Date(movement.occurredAt)));

    if (!bucket) {
      continue;
    }

    if (classified.kind === "income") {
      bucket.income += classified.amount;
    } else {
      bucket.expense += classified.amount;
    }

    bucket.net = bucket.income - bucket.expense;
    bucket.movementCount += 1;
  }

  return months;
}

function buildWeekdayPattern(movements: MovementRecord[]) {
  const weekdays = weekdayLabels.map(
    (label, index) =>
      ({
        key: `${index}`,
        label,
        income: 0,
        expense: 0,
        net: 0,
        movementCount: 0,
      }) satisfies WeekdayItem,
  );

  for (const movement of movements) {
    const classified = classifyMovement(movement);

    if (!classified) {
      continue;
    }

    const date = new Date(movement.occurredAt);
    const weekdayIndex = (date.getDay() + 6) % 7;
    const bucket = weekdays[weekdayIndex];

    if (classified.kind === "income") {
      bucket.income += classified.amount;
    } else {
      bucket.expense += classified.amount;
    }

    bucket.net = bucket.income - bucket.expense;
    bucket.movementCount += 1;
  }

  return weekdays;
}

function buildUpcomingCommitments(
  obligations: ObligationSummary[],
  subscriptions: SubscriptionSummary[],
) {
  const today = startOfDay(new Date());
  const limit = addDays(today, 30);

  const obligationItems = obligations
    .filter((obligation) => {
      if (!obligation.dueDate || obligation.pendingAmount <= 0) {
        return false;
      }

      const dueDate = new Date(obligation.dueDate);
      return dueDate >= today && dueDate <= limit;
    })
    .map((obligation) => ({
      key: `obligation-${obligation.id}`,
      kind: obligation.direction === "receivable" ? "Por cobrar" : "Por pagar",
      title: obligation.title,
      counterpart: obligation.counterparty,
      amount: obligation.pendingAmountInBaseCurrency ?? obligation.pendingAmount,
      date: obligation.dueDate as string,
    }));

  const subscriptionItems = subscriptions
    .filter((subscription) => {
      const dueDate = new Date(subscription.nextDueDate);
      return dueDate >= today && dueDate <= limit && subscription.status === "active";
    })
    .map((subscription) => ({
      key: `subscription-${subscription.id}`,
      kind: "Suscripción",
      title: subscription.name,
      counterpart: subscription.vendor,
      amount: subscription.amountInBaseCurrency ?? subscription.amount,
      date: subscription.nextDueDate,
    }));

  return [...obligationItems, ...subscriptionItems]
    .sort((left, right) => new Date(left.date).getTime() - new Date(right.date).getTime())
    .slice(0, 6);
}

function readStoredDashboardMode(): DashboardMode {
  if (typeof window === "undefined") {
    return "advanced";
  }

  const storedValue = window.localStorage.getItem(DASHBOARD_MODE_STORAGE_KEY);
  return storedValue === "simple" ? "simple" : "advanced";
}

function readStoredHiddenWidgets(): DashboardWidgetId[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(DASHBOARD_HIDDEN_WIDGETS_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue.filter((value): value is DashboardWidgetId =>
      dashboardWidgetDefinitions.some((widget) => widget.id === value),
    );
  } catch {
    return [];
  }
}

function getMonthlySubscriptionAmount(subscription: SubscriptionSummary) {
  const intervalCount = Math.max(1, subscription.intervalCount || 1);

  switch (subscription.frequency) {
    case "daily":
      return subscription.amount * (30 / intervalCount);
    case "weekly":
      return subscription.amount * (4.345 / intervalCount);
    case "monthly":
      return subscription.amount / intervalCount;
    case "quarterly":
      return subscription.amount / (3 * intervalCount);
    case "yearly":
      return subscription.amount / (12 * intervalCount);
    default:
      return subscription.amount / intervalCount;
  }
}

function buildSubscriptionHighlights(subscriptions: SubscriptionSummary[]) {
  return subscriptions
    .filter((subscription) => subscription.status === "active")
    .map<SubscriptionHighlightItem>((subscription) => ({
      id: subscription.id,
      name: subscription.name,
      vendor: subscription.vendor,
      amount: subscription.amount,
      monthlyAmount: getMonthlySubscriptionAmount(subscription),
      nextDueDate: subscription.nextDueDate,
      status: subscription.status,
      categoryName: subscription.categoryName ?? null,
    }))
    .sort((left, right) => right.monthlyAmount - left.monthlyAmount);
}

function buildTransferRoutes(movements: MovementRecord[]) {
  const groupedRoutes = new Map<string, TransferRouteItem>();

  for (const movement of movements) {
    if (movement.movementType !== "transfer" || movement.status !== "posted") {
      continue;
    }

    const source = movement.sourceAccountName ?? "Sin origen";
    const destination = movement.destinationAccountName ?? "Sin destino";
    const amount = Math.max(
      movement.sourceAmountInBaseCurrency ?? movement.sourceAmount ?? 0,
      movement.destinationAmountInBaseCurrency ?? movement.destinationAmount ?? 0,
    );

    const key = `${source}->${destination}`;
    const currentRoute = groupedRoutes.get(key) ?? {
      key,
      label: `${source} -> ${destination}`,
      source,
      destination,
      amount: 0,
      count: 0,
    };

    currentRoute.amount += amount;
    currentRoute.count += 1;
    groupedRoutes.set(key, currentRoute);
  }

  return [...groupedRoutes.values()].sort((left, right) => right.amount - left.amount);
}

function buildCurrencyExposure(
  accounts: AccountSummary[],
  displayCurrencyCode: string,
  baseCurrencyCode: string,
  exchangeRateMap: Map<string, number>,
) {
  const totalsByCurrency = new Map<string, CurrencyExposureItem>();
  let grandTotal = 0;

  for (const account of accounts.filter((item) => !item.isArchived)) {
    const convertedAmount = convertDashboardAmount({
      amount: account.currentBalance,
      currencyCode: account.currencyCode,
      amountInBaseCurrency: account.currentBalanceInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });

    const amount = convertedAmount ?? account.currentBalance;
    const currencyCode = normalizeCurrencyCode(account.currencyCode);
    const currentItem = totalsByCurrency.get(currencyCode) ?? {
      currencyCode,
      amount: 0,
      share: 0,
      accountCount: 0,
    };

    currentItem.amount += amount;
    currentItem.accountCount += 1;
    totalsByCurrency.set(currencyCode, currentItem);
    grandTotal += amount;
  }

  return [...totalsByCurrency.values()]
    .map((item) => ({
      ...item,
      share: grandTotal > 0 ? item.amount / grandTotal : 0,
    }))
    .sort((left, right) => right.amount - left.amount);
}

function buildFinancialHealthSnapshot({
  liquidMoney,
  averageMonthlyExpense,
  currentIncome,
  currentNet,
  monthlyRecurringCost,
  upcomingOutflows,
  overdueAmount,
  totalPayable,
}: {
  liquidMoney: number;
  averageMonthlyExpense: number;
  currentIncome: number;
  currentNet: number;
  monthlyRecurringCost: number;
  upcomingOutflows: number;
  overdueAmount: number;
  totalPayable: number;
}): FinancialHealthSnapshot {
  const realFreeMoney = liquidMoney - upcomingOutflows;
  const savingsRate = currentIncome > 0 ? currentNet / currentIncome : null;
  const coverageMonths = averageMonthlyExpense > 0 ? liquidMoney / averageMonthlyExpense : null;
  const debtToIncomeRatio = currentIncome > 0 ? totalPayable / currentIncome : null;

  if (overdueAmount > 0 || realFreeMoney < 0 || currentNet < 0) {
    return {
      tone: "danger",
      title: "Necesita atención",
      description: "Tienes compromisos vencidos o tu flujo actual está apretando la caja disponible.",
      realFreeMoney,
      savingsRate,
      coverageMonths,
      debtToIncomeRatio,
      overdueAmount,
    };
  }

  if (
    (savingsRate !== null && savingsRate < 0.1) ||
    (coverageMonths !== null && coverageMonths < 1) ||
    (monthlyRecurringCost > currentIncome * 0.25 && currentIncome > 0)
  ) {
    return {
      tone: "warning",
      title: "Bajo observación",
      description: "La liquidez o el ritmo de ahorro necesitan seguimiento para no perder margen.",
      realFreeMoney,
      savingsRate,
      coverageMonths,
      debtToIncomeRatio,
      overdueAmount,
    };
  }

  return {
    tone: "success",
    title: "Salud estable",
    description: "Tu liquidez y tu capacidad de ahorro van en una dirección saludable para este corte.",
    realFreeMoney,
    savingsRate,
    coverageMonths,
    debtToIncomeRatio,
    overdueAmount,
  };
}

function buildLearningSnapshot(movements: MovementRecord[], currencyCode: string): LearningSnapshot {
  if (movements.length === 0) {
    return {
      currentPhase: 0,
      readinessScore: 0,
      totalPostedMovements: 0,
      categorizedRate: 0,
      historyDays: 0,
      distinctMonths: 0,
      distinctCategories: 0,
      phases: learningPhaseDefinitions.map((phase) => ({
        step: phase.step,
        title: phase.title,
        description: phase.description,
        unlocked: false,
        progress: 0,
        remainingRequirements: [
          `Necesitas al menos ${phase.minMovements} movimientos aplicados.`,
          `Necesitas ${phase.minHistoryDays} dias de historial como minimo.`,
        ],
      })),
      insights: [],
      pendingActions: [
        "Empieza registrando ingresos, gastos y transferencias reales.",
        "Usa categorías desde el inicio para que el sistema pueda aprender más rápido.",
      ],
    };
  }

  const sortedMovements = [...movements].sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  );
  const classifiedMovements = sortedMovements
    .map((movement) => ({ movement, classified: classifyMovement(movement) }))
    .filter(
      (item): item is { movement: MovementRecord; classified: { kind: "income" | "expense"; amount: number } } =>
        item.classified !== null,
    );
  const categorizableMovements = classifiedMovements.filter(
    (item) => item.movement.movementType !== "transfer",
  );
  const categorizedMovements = categorizableMovements.filter(
    (item) => item.movement.categoryId || item.movement.category !== "Sin categoria",
  );
  const oldestMovementDate = new Date(sortedMovements[0].occurredAt);
  const newestMovementDate = new Date(sortedMovements[sortedMovements.length - 1].occurredAt);
  const historyDays = getDateDiffInclusive(oldestMovementDate, newestMovementDate);
  const distinctMonths = new Set(
    sortedMovements.map((movement) => {
      const date = new Date(movement.occurredAt);
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    }),
  ).size;
  const distinctCategories = new Set(
    categorizedMovements.map((item) => item.movement.categoryId ?? item.movement.category),
  ).size;
  const categorizedRate =
    categorizableMovements.length > 0 ? categorizedMovements.length / categorizableMovements.length : 0;

  const phases = learningPhaseDefinitions.map<LearningPhaseStatus>((phase) => {
    const requirements = [
      Math.min(1, sortedMovements.length / phase.minMovements),
      Math.min(1, historyDays / phase.minHistoryDays),
      Math.min(1, categorizedRate / phase.minCategorizedRate),
      Math.min(1, distinctMonths / phase.minDistinctMonths),
      Math.min(1, distinctCategories / phase.minDistinctCategories),
    ];
    const remainingRequirements: string[] = [];

    if (sortedMovements.length < phase.minMovements) {
      remainingRequirements.push(`Te faltan ${phase.minMovements - sortedMovements.length} movimientos aplicados.`);
    }

    if (historyDays < phase.minHistoryDays) {
      remainingRequirements.push(`Te faltan ${phase.minHistoryDays - historyDays} dias de historial.`);
    }

    if (categorizedRate < phase.minCategorizedRate) {
      remainingRequirements.push(
        `Sube tu categoría útil al ${Math.round(phase.minCategorizedRate * 100)}% para desbloquear esta fase.`,
      );
    }

    if (distinctMonths < phase.minDistinctMonths) {
      remainingRequirements.push(`Necesitamos ${phase.minDistinctMonths - distinctMonths} meses más con actividad.`);
    }

    if (distinctCategories < phase.minDistinctCategories) {
      remainingRequirements.push(`Activa ${phase.minDistinctCategories - distinctCategories} categorías adicionales.`);
    }

    return {
      step: phase.step,
      title: phase.title,
      description: phase.description,
      unlocked: remainingRequirements.length === 0,
      progress: requirements.reduce((total, value) => total + value, 0) / requirements.length,
      remainingRequirements,
    };
  });

  const currentPhase = (phases.filter((phase) => phase.unlocked).pop()?.step ?? 0) as 0 | 1 | 2 | 3 | 4;
  const readinessScore =
    phases.length > 0
      ? Math.round((phases.reduce((total, phase) => total + phase.progress, 0) / phases.length) * 100)
      : 0;

  const expenseEntries = classifiedMovements.filter((item) => item.classified.kind === "expense");
  const weekdayExpenseMap = new Map<number, number>();
  const categoryTotals = new Map<string, { amount: number; count: number }>();
  const counterpartyTotals = new Map<string, { amount: number; count: number }>();

  for (const item of expenseEntries) {
    const date = new Date(item.movement.occurredAt);
    const weekday = date.getDay();
    weekdayExpenseMap.set(weekday, (weekdayExpenseMap.get(weekday) ?? 0) + item.classified.amount);

    const categoryKey = item.movement.category || "Sin categoria";
    const currentCategory = categoryTotals.get(categoryKey) ?? { amount: 0, count: 0 };
    currentCategory.amount += item.classified.amount;
    currentCategory.count += 1;
    categoryTotals.set(categoryKey, currentCategory);

    if (item.movement.counterparty && item.movement.counterparty !== "Sin contraparte") {
      const currentCounterparty = counterpartyTotals.get(item.movement.counterparty) ?? { amount: 0, count: 0 };
      currentCounterparty.amount += item.classified.amount;
      currentCounterparty.count += 1;
      counterpartyTotals.set(item.movement.counterparty, currentCounterparty);
    }
  }

  const topWeekdayEntry = [...weekdayExpenseMap.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
  const topCategoryEntry = [...categoryTotals.entries()].sort((left, right) => right[1].amount - left[1].amount)[0] ?? null;
  const topCounterpartyEntry =
    [...counterpartyTotals.entries()].sort((left, right) => right[1].amount - left[1].amount)[0] ?? null;
  const weekendExpense =
    (weekdayExpenseMap.get(0) ?? 0) + (weekdayExpenseMap.get(6) ?? 0);
  const totalExpense = expenseEntries.reduce((total, item) => total + item.classified.amount, 0);
  const weekendShare = totalExpense > 0 ? weekendExpense / totalExpense : 0;

  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  const currentMonthExpenseEntries = expenseEntries.filter(
    (item) =>
      new Date(item.movement.occurredAt).getTime() >= currentMonthStart.getTime() &&
      new Date(item.movement.occurredAt).getTime() <= today.getTime(),
  );
  const currentMonthExpense = currentMonthExpenseEntries.reduce(
    (total, item) => total + item.classified.amount,
    0,
  );
  const daysElapsedThisMonth = getDateDiffInclusive(currentMonthStart, today);
  const daysInCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const projectedMonthExpense =
    currentMonthExpenseEntries.length > 0 ? (currentMonthExpense / daysElapsedThisMonth) * daysInCurrentMonth : null;

  const previousMonthExpenseMap = new Map<string, number>();
  for (const item of expenseEntries) {
    const date = new Date(item.movement.occurredAt);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    previousMonthExpenseMap.set(monthKey, (previousMonthExpenseMap.get(monthKey) ?? 0) + item.classified.amount);
  }
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const previousFullMonthExpenses = [...previousMonthExpenseMap.entries()]
    .filter(([monthKey]) => monthKey !== currentMonthKey)
    .sort((left, right) => right[0].localeCompare(left[0]))
    .slice(0, 3)
    .map(([, amount]) => amount);
  const trailingAverageExpense =
    previousFullMonthExpenses.length > 0
      ? previousFullMonthExpenses.reduce((total, amount) => total + amount, 0) / previousFullMonthExpenses.length
      : null;

  const last30Start = addDays(today, -29);
  const previous30Start = addDays(today, -59);
  const previous30End = addDays(today, -30);
  const recentCategoryMap = new Map<string, number>();
  const previousCategoryMap = new Map<string, number>();

  for (const item of expenseEntries) {
    const occurredAt = new Date(item.movement.occurredAt);
    const categoryKey = item.movement.category || "Sin categoria";

    if (occurredAt >= last30Start && occurredAt <= today) {
      recentCategoryMap.set(categoryKey, (recentCategoryMap.get(categoryKey) ?? 0) + item.classified.amount);
    } else if (occurredAt >= previous30Start && occurredAt <= previous30End) {
      previousCategoryMap.set(categoryKey, (previousCategoryMap.get(categoryKey) ?? 0) + item.classified.amount);
    }
  }

  const growthCategoryEntry = [...recentCategoryMap.entries()]
    .map(([category, amount]) => ({
      category,
      current: amount,
      previous: previousCategoryMap.get(category) ?? 0,
      delta: amount - (previousCategoryMap.get(category) ?? 0),
    }))
    .filter((item) => item.delta > 0)
    .sort((left, right) => right.delta - left.delta)[0] ?? null;

  const insights: LearningInsight[] = [];

  if (currentPhase >= 1 && topWeekdayEntry) {
    const weekdayLabel = weekdayLabels[(topWeekdayEntry[0] + 6) % 7];
    insights.push({
      title: `Tu día más cargado hoy parece ser ${weekdayLabel}`,
      description: `Ese día concentra ${Math.round((topWeekdayEntry[1] / Math.max(totalExpense, 1)) * 100)}% del gasto histórico aplicable.`,
      tone: "info",
    });
  }

  if (currentPhase >= 1 && topCategoryEntry) {
    insights.push({
      title: `La categoría que más pesa es ${topCategoryEntry[0]}`,
      description: `${topCategoryEntry[1].count} movimientos y ${formatCurrency(topCategoryEntry[1].amount, currencyCode)} de salida acumulada la vuelven tu foco principal.`,
      tone: "warning",
    });
  }

  if (currentPhase >= 2 && topCounterpartyEntry) {
    insights.push({
      title: `Tienes una contraparte muy repetida: ${topCounterpartyEntry[0]}`,
      description: `Ya aparece en ${topCounterpartyEntry[1].count} movimientos y absorbe ${formatCurrency(topCounterpartyEntry[1].amount, currencyCode)} del gasto relacionado.`,
      tone: "neutral",
    });
  }

  if (currentPhase >= 2 && weekendShare >= 0.4) {
    insights.push({
      title: "Tus fines de semana concentran mucho gasto",
      description: `${Math.round(weekendShare * 100)}% de tus salidas históricas cae entre sábado y domingo.`,
      tone: "warning",
    });
  }

  if (currentPhase >= 3 && projectedMonthExpense !== null) {
    const projectedDelta =
      trailingAverageExpense !== null ? projectedMonthExpense - trailingAverageExpense : null;
    insights.push({
      title: "Ya podemos proyectar tu cierre del mes",
      description:
        projectedDelta !== null
          ? `Si sigues al ritmo actual cerrarías cerca de ${formatCurrency(projectedMonthExpense, currencyCode)}, ${projectedDelta >= 0 ? "por encima" : "por debajo"} de tu promedio reciente.`
          : `Con el ritmo actual cerrarías cerca de ${formatCurrency(projectedMonthExpense, currencyCode)} este mes.`,
      tone:
        projectedDelta !== null
          ? projectedDelta > 0
            ? "warning"
            : "success"
          : "info",
    });
  }

  if (currentPhase >= 3 && growthCategoryEntry) {
    insights.push({
      title: `La categoría con más presión ahora es ${growthCategoryEntry.category}`,
      description: `En los últimos 30 días subió ${formatCurrency(growthCategoryEntry.delta, currencyCode)} frente al bloque anterior, así que es la candidata más clara a dominar tu gasto cercano.`,
      tone: "warning",
    });
  }

  if (currentPhase >= 4 && projectedMonthExpense !== null && trailingAverageExpense !== null) {
    const overAverageRatio = trailingAverageExpense > 0 ? projectedMonthExpense / trailingAverageExpense : null;

    if (overAverageRatio !== null && overAverageRatio >= 1.15) {
      insights.push({
        title: "Alerta temprana de gasto alto",
        description: `Tu proyección del mes ya va ${Math.round((overAverageRatio - 1) * 100)}% por encima de tu promedio de los últimos meses.`,
        tone: "danger",
      });
    } else {
      insights.push({
        title: "Tu proyección luce controlada",
        description: "El gasto proyectado del mes se mantiene dentro de un rango saludable frente a tu historial reciente.",
        tone: "success",
      });
    }
  }

  const nextLockedPhase = phases.find((phase) => !phase.unlocked);
  const pendingActions =
    nextLockedPhase?.remainingRequirements.length
      ? nextLockedPhase.remainingRequirements
      : [
          "Sigue registrando con disciplina para reforzar las predicciones.",
          "Mantener categorías consistentes mejora la precisión del panel.",
        ];

  return {
    currentPhase,
    readinessScore,
    totalPostedMovements: sortedMovements.length,
    categorizedRate,
    historyDays,
    distinctMonths,
    distinctCategories,
    phases,
    insights: insights.slice(0, 6),
    pendingActions,
  };
}

function formatPercentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDeltaCurrency(amount: number, currencyCode: string) {
  const prefix = amount > 0 ? "+" : "";
  return `${prefix}${formatCurrency(amount, currencyCode)}`;
}

function formatSignedPercentage(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? "Sin cambio" : "Nuevo movimiento";
  }

  const delta = ((current - previous) / previous) * 100;
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${Math.round(delta)}%`;
}

function getChangeTone(value: number) {
  if (value > 0) {
    return "success";
  }

  if (value < 0) {
    return "danger";
  }

  return "neutral";
}

const FLOW_CHART_THEME = {
  expense: {
    line: "rgba(225, 112, 85, 0.95)",
    fillTop: "rgba(225, 112, 85, 0.26)",
    fillBottom: "rgba(225, 112, 85, 0.02)",
    gradientId: "dashboard-flow-expense-fill",
    accentClass: "text-ember",
    panelClass: "border-ember/18 bg-ember/10",
  },
  income: {
    line: "rgba(56, 161, 105, 0.95)",
    fillTop: "rgba(56, 161, 105, 0.28)",
    fillBottom: "rgba(56, 161, 105, 0.02)",
    gradientId: "dashboard-flow-income-fill",
    accentClass: "text-pine",
    panelClass: "border-pine/18 bg-pine/10",
  },
  transfer: {
    line: "rgba(212, 175, 55, 0.95)",
    fillTop: "rgba(212, 175, 55, 0.24)",
    fillBottom: "rgba(212, 175, 55, 0.02)",
    gradientId: "dashboard-flow-transfer-fill",
    accentClass: "text-gold",
    panelClass: "border-gold/18 bg-gold/10",
  },
} as const;

function ChronologicalMovementList({
  title,
  emptyHint,
  movements,
  currencyCode,
  resolveAmount,
}: {
  title: string;
  emptyHint: string;
  movements: MovementRecord[];
  currencyCode: string;
  resolveAmount: (movement: MovementRecord) => number;
}) {
  if (!movements.length) {
    return (
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-storm">{title}</p>
        <p className="mt-2 text-sm text-storm">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-storm">{title}</p>
      <ul className="mt-3 max-h-52 space-y-2 overflow-y-auto pr-1">
        {movements.map((movement) => (
          <li
            className="flex items-start justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-3 py-2"
            key={movement.id}
          >
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">
                {movement.description || movement.counterparty || "Sin descripción"}
              </p>
              <p className="mt-0.5 text-xs text-storm">
                {[movement.category, movement.counterparty].filter(Boolean).join(" · ") ||
                  movement.movementType}
              </p>
            </div>
            <p className="shrink-0 font-display text-sm font-semibold text-ink">
              {formatCurrency(resolveAmount(movement), currencyCode)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayMovementsBreakdown({
  movements,
  currencyCode,
  withTopDivider = true,
}: {
  movements: MovementRecord[];
  currencyCode: string;
  withTopDivider?: boolean;
}) {
  const income: MovementRecord[] = [];
  const expense: MovementRecord[] = [];
  const transfers: MovementRecord[] = [];

  for (const movement of movements) {
    if (movement.movementType === "transfer") {
      transfers.push(movement);
      continue;
    }

    const classified = classifyMovement(movement);

    if (classified?.kind === "income") {
      income.push(movement);
    } else if (classified?.kind === "expense") {
      expense.push(movement);
    }
  }

  return (
    <div
      className={
        withTopDivider ? "space-y-5 border-t border-white/8 pt-5" : "space-y-5"
      }
    >
      <p className="text-sm font-semibold text-ink">Movimientos del día seleccionado</p>
      <div className="grid gap-5 md:grid-cols-3">
        <ChronologicalMovementList
          currencyCode={currencyCode}
          emptyHint="Sin ingresos este día."
          movements={income}
          resolveAmount={getIncomeAmount}
          title="Ingresos"
        />
        <ChronologicalMovementList
          currencyCode={currencyCode}
          emptyHint="Sin gastos este día."
          movements={expense}
          resolveAmount={getExpenseAmount}
          title="Gastos"
        />
        <ChronologicalMovementList
          currencyCode={currencyCode}
          emptyHint="Sin transferencias este día."
          movements={transfers}
          resolveAmount={getTransferLineAmount}
          title="Transferencias"
        />
      </div>
    </div>
  );
}

function FlowLineChart({
  variant,
  points,
  selectedIndex,
  onSelect,
  currencyCode,
  movementsForDay,
  chartTitle,
  dailyLabel,
  comparisonDailyLabel,
}: {
  variant: keyof typeof FLOW_CHART_THEME;
  points: DailyFlowPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  currencyCode: string;
  movementsForDay: MovementRecord[];
  chartTitle: string;
  dailyLabel: string;
  comparisonDailyLabel: string;
}) {
  const theme = FLOW_CHART_THEME[variant];

  if (!points.length) {
    return (
      <DataState
        description="Necesitamos movimientos aplicados dentro del período para dibujar la evolución diaria."
        title="Aún no hay trazo para este período"
      />
    );
  }

  const width = 760;
  const height = 260;
  const paddingX = 22;
  const paddingY = 24;
  const values = points.flatMap((point) => [point.cumulative, point.previousCumulative, 0]);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = Math.max(1, maxValue - minValue);
  const stepX = points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0;
  const getY = (value: number) => paddingY + ((maxValue - value) / range) * (height - paddingY * 2);
  const currentPath = points
    .map((point, index) => `${paddingX + stepX * index},${getY(point.cumulative)}`)
    .join(" ");
  const previousPath = points
    .map((point, index) => `${paddingX + stepX * index},${getY(point.previousCumulative)}`)
    .join(" ");
  const areaPath = `${paddingX},${height - paddingY} ${currentPath} ${
    paddingX + stepX * (points.length - 1)
  },${height - paddingY}`;
  const axisSteps = [maxValue, (maxValue + minValue) / 2, minValue];
  const selected = points[selectedIndex];

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-panel-soft rounded-[28px] p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-storm">{chartTitle}</p>
              <p className="mt-2 text-sm text-storm">
                Toca un punto para ver el detalle de ese día frente al período anterior.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-storm">
              <span className="inline-flex items-center gap-2 rounded-full border border-pine/20 bg-pine/10 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-pine" style={{ backgroundColor: theme.line }} />
                Periodo actual
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-white/60" />
                Comparación
              </span>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
            <div className="hidden gap-2 lg:flex lg:flex-col lg:justify-between">
              {axisSteps.map((value, index) => (
                <span className="text-xs text-storm" key={`flow-axis-${index}`}>
                  {formatCurrency(value, currencyCode)}
                </span>
              ))}
            </div>
            <div className="overflow-x-auto">
              <svg className="min-w-[680px]" height={height} viewBox={`0 0 ${width} ${height}`}>
                <defs>
                  <linearGradient id={theme.gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={theme.fillTop} />
                    <stop offset="100%" stopColor={theme.fillBottom} />
                  </linearGradient>
                </defs>
                {[0, 0.5, 1].map((step) => (
                  <line
                    key={`flow-grid-${step}`}
                    stroke="rgba(255,255,255,0.08)"
                    strokeDasharray="4 6"
                    x1={paddingX}
                    x2={width - paddingX}
                    y1={paddingY + (height - paddingY * 2) * step}
                    y2={paddingY + (height - paddingY * 2) * step}
                  />
                ))}
                <polygon fill={`url(#${theme.gradientId})`} points={areaPath} />
                <polyline
                  fill="none"
                  points={previousPath}
                  stroke="rgba(255,255,255,0.48)"
                  strokeDasharray="7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                />
                <polyline
                  fill="none"
                  points={currentPath}
                  stroke={theme.line}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                />
                {points.map((point, index) => {
                  const x = paddingX + stepX * index;
                  const isSelected = index === selectedIndex;

                  return (
                    <g key={point.key}>
                      <circle
                        cx={x}
                        cy={getY(point.previousCumulative)}
                        fill="rgba(255,255,255,0.3)"
                        r="4"
                      />
                      <circle
                        className="cursor-pointer"
                        cx={x}
                        cy={getY(point.cumulative)}
                        fill={isSelected ? "rgba(255,255,255,1)" : theme.line}
                        onClick={() => onSelect(index)}
                        r={isSelected ? 7 : 5}
                        stroke={isSelected ? theme.line : "rgba(255,255,255,0.12)"}
                        strokeWidth="2"
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-white/8 pt-4 text-xs text-storm">
            {points
              .filter((_, index) => {
                if (points.length <= 5) {
                  return true;
                }

                const step = Math.max(1, Math.floor((points.length - 1) / 4));
                return index === 0 || index === points.length - 1 || index % step === 0;
              })
              .map((point) => (
                <span key={`flow-tick-${point.key}`}>{point.label}</span>
              ))}
          </div>
        </div>

        <div className="glass-panel-soft rounded-[28px] p-5">
          {selected ? (
            <>
              <p className="text-xs uppercase tracking-[0.22em] text-storm">Detalle del día</p>
              <h4 className="mt-3 font-display text-3xl font-semibold text-ink">{selected.fullLabel}</h4>
              <p className="mt-2 text-sm text-storm">
                Frente a {fullDateFormatter.format(selected.previousDate)}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className={`rounded-[22px] border p-4 ${theme.panelClass}`}>
                  <p className={`text-xs uppercase tracking-[0.18em] ${theme.accentClass}`}>{dailyLabel}</p>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink">
                    {formatCurrency(selected.daily, currencyCode)}
                  </p>
                  <p className="mt-2 text-sm text-storm">
                    Acumulado en el período {formatCurrency(selected.cumulative, currencyCode)}.
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">{comparisonDailyLabel}</p>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink">
                    {formatCurrency(selected.previousDaily, currencyCode)}
                  </p>
                  <p className="mt-2 text-sm text-storm">
                    Acumulado comparativo {formatCurrency(selected.previousCumulative, currencyCode)}.
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-ink">Cambio frente al comparativo (día)</p>
                  <DeltaBadge currencyCode={currencyCode} inverse={false} value={selected.daily - selected.previousDaily} />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {selected ? (
        <div className="glass-panel-soft mt-6 rounded-[28px] p-5">
          <ChronologicalMovementList
            currencyCode={currencyCode}
            emptyHint="No hubo movimientos de este tipo ese día."
            movements={movementsForDay}
            resolveAmount={
              variant === "income"
                ? getIncomeAmount
                : variant === "expense"
                  ? getExpenseAmount
                  : getTransferLineAmount
            }
            title="Movimientos ese día"
          />
        </div>
      ) : null}
    </>
  );
}

function SavingsLineChart({
  points,
  selectedIndex,
  onSelect,
  currencyCode,
  dayMovements,
}: {
  points: DailySavingsPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  currencyCode: string;
  dayMovements: MovementRecord[];
}) {
  if (!points.length) {
    return (
      <DataState
        description="Necesitamos movimientos aplicados dentro del período para dibujar la evolución diaria."
        title="Aún no hay trazo para este período"
      />
    );
  }

  const width = 760;
  const height = 260;
  const paddingX = 22;
  const paddingY = 24;
  const values = points.flatMap((point) => [point.cumulative, point.previousCumulative, 0]);
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = Math.max(1, maxValue - minValue);
  const stepX = points.length > 1 ? (width - paddingX * 2) / (points.length - 1) : 0;
  const getY = (value: number) => paddingY + ((maxValue - value) / range) * (height - paddingY * 2);
  const currentPath = points
    .map((point, index) => `${paddingX + stepX * index},${getY(point.cumulative)}`)
    .join(" ");
  const previousPath = points
    .map((point, index) => `${paddingX + stepX * index},${getY(point.previousCumulative)}`)
    .join(" ");
  const areaPath = `${paddingX},${height - paddingY} ${currentPath} ${
    paddingX + stepX * (points.length - 1)
  },${height - paddingY}`;
  const axisSteps = [maxValue, (maxValue + minValue) / 2, minValue];

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="glass-panel-soft rounded-[28px] p-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-storm">Ahorro acumulado</p>
            <p className="mt-2 text-sm text-storm">
              Toca un punto para ver el detalle de ese día frente al período anterior.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-storm">
            <span className="inline-flex items-center gap-2 rounded-full border border-pine/20 bg-pine/10 px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-pine" />
              Periodo actual
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
              <span className="h-2 w-2 rounded-full bg-white/60" />
              Comparación
            </span>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[auto_1fr]">
          <div className="hidden gap-2 lg:flex lg:flex-col lg:justify-between">
            {axisSteps.map((value, index) => (
              <span className="text-xs text-storm" key={`axis-${index}`}>
                {formatCurrency(value, currencyCode)}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <svg className="min-w-[680px]" height={height} viewBox={`0 0 ${width} ${height}`}>
              <defs>
                <linearGradient id="dashboard-savings-fill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgba(56, 161, 105, 0.28)" />
                  <stop offset="100%" stopColor="rgba(56, 161, 105, 0.02)" />
                </linearGradient>
              </defs>
              {[0, 0.5, 1].map((step) => (
                <line
                  key={`grid-${step}`}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 6"
                  x1={paddingX}
                  x2={width - paddingX}
                  y1={paddingY + (height - paddingY * 2) * step}
                  y2={paddingY + (height - paddingY * 2) * step}
                />
              ))}
              <polygon fill="url(#dashboard-savings-fill)" points={areaPath} />
              <polyline
                fill="none"
                points={previousPath}
                stroke="rgba(255,255,255,0.48)"
                strokeDasharray="7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
              <polyline
                fill="none"
                points={currentPath}
                stroke="rgba(56, 161, 105, 0.95)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4"
              />
              {points.map((point, index) => {
                const x = paddingX + stepX * index;
                const isSelected = index === selectedIndex;

                return (
                  <g key={point.key}>
                    <circle
                      cx={x}
                      cy={getY(point.previousCumulative)}
                      fill="rgba(255,255,255,0.3)"
                      r="4"
                    />
                    <circle
                      className="cursor-pointer"
                      cx={x}
                      cy={getY(point.cumulative)}
                      fill={isSelected ? "rgba(255,255,255,1)" : "rgba(56, 161, 105, 1)"}
                      onClick={() => onSelect(index)}
                      r={isSelected ? 7 : 5}
                      stroke={isSelected ? "rgba(56, 161, 105, 1)" : "rgba(255,255,255,0.12)"}
                      strokeWidth="2"
                    />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-between gap-3 border-t border-white/8 pt-4 text-xs text-storm">
          {points
            .filter((_, index) => {
              if (points.length <= 5) {
                return true;
              }

              const step = Math.max(1, Math.floor((points.length - 1) / 4));
              return index === 0 || index === points.length - 1 || index % step === 0;
            })
            .map((point) => (
              <span key={`tick-${point.key}`}>{point.label}</span>
            ))}
        </div>
      </div>

      <div className="glass-panel-soft rounded-[28px] p-5">
        {points[selectedIndex] ? (
          <>
            <p className="text-xs uppercase tracking-[0.22em] text-storm">Detalle del ritmo</p>
            <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
              {points[selectedIndex].fullLabel}
            </h4>
            <p className="mt-2 text-sm text-storm">
              Frente a {fullDateFormatter.format(points[selectedIndex].previousDate)}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-pine">Ahorro del dia</p>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">
                  {formatCurrency(points[selectedIndex].net, currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  Ingresos {formatCurrency(points[selectedIndex].income, currencyCode)} y gastos{" "}
                  {formatCurrency(points[selectedIndex].expense, currencyCode)}.
                </p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Comparación</p>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">
                  {formatCurrency(points[selectedIndex].previousNet, currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  Acumulado actual {formatCurrency(points[selectedIndex].cumulative, currencyCode)}.
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-ink">Cambio frente al comparativo</p>
                <DeltaBadge
                  currencyCode={currencyCode}
                  inverse={false}
                  value={points[selectedIndex].net - points[selectedIndex].previousNet}
                />
              </div>
              <p className="mt-3 text-sm leading-7 text-storm">
                Si mantienes este ritmo, el acumulado del período seguiría en{" "}
                <span className="font-semibold text-ink">
                  {formatCurrency(points[selectedIndex].cumulative, currencyCode)}
                </span>
                .
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
      {points[selectedIndex] ? (
        <div className="glass-panel-soft mt-6 rounded-[28px] p-5">
          <DayMovementsBreakdown
            currencyCode={currencyCode}
            movements={dayMovements}
            withTopDivider={false}
          />
        </div>
      ) : null}
    </>
  );
}

export function DashboardPage() {
  const { profile, user } = useAuth();
  const { canAccessProFeatures, isAdminOverride, isLoadingEntitlement } = useProFeatureAccess();
  const {
    activeWorkspace,
    error: workspaceError,
    isLoading: isWorkspacesLoading,
    workspaces,
  } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const sharedObligationsQuery = useSharedObligationsQuery(user?.id);
  const snapshot = snapshotQuery.data;
  const sharedObligations = sharedObligationsQuery.data ?? [];

  const [comparisonPreset, setComparisonPreset] = useState<ComparisonPreset>("month");
  const [topCount, setTopCount] = useState<number>(8);
  const [selectedTrendIndex, setSelectedTrendIndex] = useState<number | null>(null);
  const [chronologicalTrendTab, setChronologicalTrendTab] = useState<ChronologicalTrendTab>("savings");
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedReceivableKey, setSelectedReceivableKey] = useState<string | null>(null);
  const [selectedPayableKey, setSelectedPayableKey] = useState<string | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [selectedWeekdayKey, setSelectedWeekdayKey] = useState<string | null>(null);
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>(readStoredDashboardMode);
  const [hiddenWidgets, setHiddenWidgets] = useState<DashboardWidgetId[]>(readStoredHiddenWidgets);
  const [isCustomizerOpen, setIsCustomizerOpen] = useState(false);
  const [displayCurrencyCode, setDisplayCurrencyCode] = useState<string>(() => {
    if (typeof window === "undefined") {
      return "PEN";
    }

    const storedCurrencyCode = window.localStorage.getItem(DASHBOARD_CURRENCY_STORAGE_KEY);
    return storedCurrencyCode ? normalizeCurrencyCode(storedCurrencyCode) : "PEN";
  });
  const baseCurrencyCode = snapshot?.workspace.baseCurrencyCode ?? activeWorkspace?.baseCurrencyCode ?? "PEN";
  const exchangeRateMap = useMemo(
    () => buildDashboardExchangeRateMap(snapshot?.exchangeRates ?? []),
    [snapshot?.exchangeRates],
  );
  const dashboardCurrencyOptions = useMemo(() => {
    const candidateCurrencyCodes = Array.from(
      new Set(
        [
          "PEN",
          "USD",
          baseCurrencyCode,
          ...(snapshot?.accounts ?? []).map((account) => account.currencyCode),
          ...(snapshot?.obligations ?? []).map((obligation) => obligation.currencyCode),
          ...sharedObligations.map((obligation) => obligation.currencyCode),
          ...(snapshot?.subscriptions ?? []).map((subscription) => subscription.currencyCode),
        ].map((currencyCode) => normalizeCurrencyCode(currencyCode)),
      ),
    )
      .filter(
        (currencyCode) =>
          currencyCode === normalizeCurrencyCode(baseCurrencyCode) ||
          resolveDashboardExchangeRate(exchangeRateMap, baseCurrencyCode, currencyCode) !== null ||
          resolveDashboardExchangeRate(exchangeRateMap, currencyCode, baseCurrencyCode) !== null,
      )
      .sort((left, right) => {
        const priority = (currencyCode: string) => {
          if (currencyCode === "PEN") {
            return 0;
          }

          if (currencyCode === "USD") {
            return 1;
          }

          if (currencyCode === normalizeCurrencyCode(baseCurrencyCode)) {
            return 2;
          }

          return 3;
        };

        const difference = priority(left) - priority(right);
        return difference !== 0 ? difference : left.localeCompare(right);
      });

    return candidateCurrencyCodes.map((currencyCode) => ({
      value: currencyCode,
      label: currencyCode,
      helper:
        currencyCode === "PEN"
          ? "vista por defecto"
          : currencyCode === normalizeCurrencyCode(baseCurrencyCode)
            ? "base del workspace"
            : "conversion global",
    }));
  }, [baseCurrencyCode, exchangeRateMap, sharedObligations, snapshot?.accounts, snapshot?.obligations, snapshot?.subscriptions]);
  const defaultDashboardCurrencyCode =
    dashboardCurrencyOptions.find((option) => option.value === "PEN")?.value ??
    dashboardCurrencyOptions[0]?.value ??
    normalizeCurrencyCode(baseCurrencyCode);
  const isCheckingAdvancedDashboardAccess = isLoadingEntitlement && !isAdminOverride;
  const canUseAdvancedDashboard = !isCheckingAdvancedDashboardAccess && canAccessProFeatures;
  const effectiveDashboardMode: DashboardMode =
    canUseAdvancedDashboard && dashboardMode === "advanced" ? "advanced" : "simple";
  const dashboardModeSelectorOptions = dashboardModeOptions.map((option) =>
    option.value === "advanced" && !canUseAdvancedDashboard
      ? {
          ...option,
          helper: isCheckingAdvancedDashboardAccess ? "validando acceso" : "solo usuarios Pro",
          disabled: true,
        }
      : option,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(DASHBOARD_CURRENCY_STORAGE_KEY, displayCurrencyCode);
  }, [displayCurrencyCode]);

  useEffect(() => {
    if (typeof window === "undefined" || isCheckingAdvancedDashboardAccess) {
      return;
    }

    window.localStorage.setItem(DASHBOARD_MODE_STORAGE_KEY, effectiveDashboardMode);
  }, [effectiveDashboardMode, isCheckingAdvancedDashboardAccess]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      DASHBOARD_HIDDEN_WIDGETS_STORAGE_KEY,
      JSON.stringify(hiddenWidgets),
    );
  }, [hiddenWidgets]);

  useEffect(() => {
    if (!dashboardCurrencyOptions.some((option) => option.value === displayCurrencyCode)) {
      setDisplayCurrencyCode(defaultDashboardCurrencyCode);
    }
  }, [dashboardCurrencyOptions, defaultDashboardCurrencyCode, displayCurrencyCode]);

  useEffect(() => {
    if (!isCheckingAdvancedDashboardAccess && !canAccessProFeatures && dashboardMode !== "simple") {
      setDashboardMode("simple");
    }
  }, [canAccessProFeatures, dashboardMode, isCheckingAdvancedDashboardAccess]);

  const availableWidgets = dashboardWidgetDefinitions.filter((widget) =>
    widget.modes.includes(effectiveDashboardMode),
  );

  function isWidgetVisible(widgetId: DashboardWidgetId) {
    const widget = dashboardWidgetDefinitions.find((item) => item.id === widgetId);
    return Boolean(widget && widget.modes.includes(effectiveDashboardMode) && !hiddenWidgets.includes(widgetId));
  }

  function toggleWidgetVisibility(widgetId: DashboardWidgetId) {
    setHiddenWidgets((currentValue) =>
      currentValue.includes(widgetId)
        ? currentValue.filter((value) => value !== widgetId)
        : [...currentValue, widgetId],
    );
  }

  function handleDashboardModeChange(nextMode: DashboardMode) {
    if (nextMode === "advanced" && !canUseAdvancedDashboard) {
      setDashboardMode("simple");
      setIsCustomizerOpen(true);
      return;
    }

    setDashboardMode(nextMode);
  }

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Tu centro de control va a aparecer aquí apenas termine la conexión inicial."
          eyebrow="resumen"
          title="Dashboard"
        />
        <DashboardLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="El dashboard necesita el workspace activo y permisos para leer su información."
          eyebrow="resumen"
          title="Dashboard no disponible"
        />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos cargar tus workspaces.")}
          title="Acceso bloqueado al workspace"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Seleccioná o creá un workspace para ver balances, comparativos y tendencias."
          eyebrow="resumen"
          title="Aún no hay un workspace activo"
        />
        <DataState
          description="Cuando tu workspace esté listo, aquí verás tu dinero, tus compromisos y tus patrones de gasto en una sola vista."
          title="Todavía no encontramos datos financieros"
        />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos armando una vista más inteligente a partir de tus cuentas, movimientos y compromisos."
          eyebrow="resumen"
          title={`${activeWorkspace.name}, en una sola mirada`}
        />
        <DashboardLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Intentamos leer cuentas, movimientos, créditos, deudas y suscripciones de este workspace."
          eyebrow="resumen"
          title={`${activeWorkspace.name}, con problemas de lectura`}
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la información del dashboard.")}
          title="No fue posible cargar el panel principal"
          tone="error"
        />
      </div>
    );
  }

  const comparison = buildComparisonDefinition(comparisonPreset);
  const displayAccounts = snapshot.accounts.map((account) => {
    const convertedBalance = convertDashboardAmount({
      amount: account.currentBalance,
      currencyCode: account.currencyCode,
      amountInBaseCurrency: account.currentBalanceInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });

    return {
      ...account,
      currencyCode: displayCurrencyCode,
      currentBalance: convertedBalance ?? account.currentBalance,
      currentBalanceInBaseCurrency: convertedBalance ?? null,
    };
  });
  const displayMovements = snapshot.movements.map((movement) => {
    const convertedSourceAmount =
      movement.sourceAmount === null
        ? null
        : convertDashboardAmount({
            amount: movement.sourceAmount,
            currencyCode: movement.sourceCurrencyCode,
            amountInBaseCurrency: movement.sourceAmountInBaseCurrency,
            baseCurrencyCode,
            targetCurrencyCode: displayCurrencyCode,
            exchangeRateMap,
          });
    const convertedDestinationAmount =
      movement.destinationAmount === null
        ? null
        : convertDashboardAmount({
            amount: movement.destinationAmount,
            currencyCode: movement.destinationCurrencyCode,
            amountInBaseCurrency: movement.destinationAmountInBaseCurrency,
            baseCurrencyCode,
            targetCurrencyCode: displayCurrencyCode,
            exchangeRateMap,
          });

    return {
      ...movement,
      sourceCurrencyCode: convertedSourceAmount === null ? movement.sourceCurrencyCode : displayCurrencyCode,
      sourceAmount: convertedSourceAmount ?? movement.sourceAmount,
      sourceAmountInBaseCurrency: convertedSourceAmount,
      destinationCurrencyCode:
        convertedDestinationAmount === null ? movement.destinationCurrencyCode : displayCurrencyCode,
      destinationAmount: convertedDestinationAmount ?? movement.destinationAmount,
      destinationAmountInBaseCurrency: convertedDestinationAmount,
    };
  });
  const displayObligations = snapshot.obligations.map((obligation) => {
    const convertedPrincipalAmount = convertDashboardAmount({
      amount: obligation.principalAmount,
      currencyCode: obligation.currencyCode,
      amountInBaseCurrency: obligation.principalAmountInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });
    const convertedCurrentPrincipalAmount = convertDashboardAmount({
      amount: obligation.currentPrincipalAmount ?? obligation.principalAmount,
      currencyCode: obligation.currencyCode,
      amountInBaseCurrency:
        obligation.currentPrincipalAmountInBaseCurrency ?? obligation.principalAmountInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });
    const convertedPendingAmount = convertDashboardAmount({
      amount: obligation.pendingAmount,
      currencyCode: obligation.currencyCode,
      amountInBaseCurrency: obligation.pendingAmountInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });

    return {
      ...obligation,
      currencyCode: displayCurrencyCode,
      principalAmount: convertedPrincipalAmount ?? obligation.principalAmount,
      principalAmountInBaseCurrency: convertedPrincipalAmount ?? null,
      currentPrincipalAmount:
        convertedCurrentPrincipalAmount ?? obligation.currentPrincipalAmount ?? obligation.principalAmount,
      currentPrincipalAmountInBaseCurrency: convertedCurrentPrincipalAmount ?? null,
      pendingAmount: convertedPendingAmount ?? obligation.pendingAmount,
      pendingAmountInBaseCurrency: convertedPendingAmount ?? null,
    };
  });
  const displaySharedObligations = sharedObligations.map((obligation) => {
    const convertedPrincipalAmount = convertDashboardAmount({
      amount: obligation.principalAmount,
      currencyCode: obligation.currencyCode,
      amountInBaseCurrency: obligation.principalAmountInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });
    const convertedCurrentPrincipalAmount = convertDashboardAmount({
      amount: obligation.currentPrincipalAmount ?? obligation.principalAmount,
      currencyCode: obligation.currencyCode,
      amountInBaseCurrency:
        obligation.currentPrincipalAmountInBaseCurrency ?? obligation.principalAmountInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });
    const convertedPendingAmount = convertDashboardAmount({
      amount: obligation.pendingAmount,
      currencyCode: obligation.currencyCode,
      amountInBaseCurrency: obligation.pendingAmountInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });

    return {
      ...obligation,
      currencyCode: displayCurrencyCode,
      principalAmount: convertedPrincipalAmount ?? obligation.principalAmount,
      principalAmountInBaseCurrency: convertedPrincipalAmount ?? null,
      currentPrincipalAmount:
        convertedCurrentPrincipalAmount ?? obligation.currentPrincipalAmount ?? obligation.principalAmount,
      currentPrincipalAmountInBaseCurrency: convertedCurrentPrincipalAmount ?? null,
      pendingAmount: convertedPendingAmount ?? obligation.pendingAmount,
      pendingAmountInBaseCurrency: convertedPendingAmount ?? null,
    };
  });
  const displaySubscriptions = snapshot.subscriptions.map((subscription) => {
    const convertedAmount = convertDashboardAmount({
      amount: subscription.amount,
      currencyCode: subscription.currencyCode,
      amountInBaseCurrency: subscription.amountInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });

    return {
      ...subscription,
      currencyCode: displayCurrencyCode,
      amount: convertedAmount ?? subscription.amount,
      amountInBaseCurrency: convertedAmount ?? null,
    };
  });
  const displayBudgets = snapshot.budgets.map((budget) => {
    const convertedLimitAmount = convertDashboardAmount({
      amount: budget.limitAmount,
      currencyCode: budget.currencyCode,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });
    const convertedSpentAmount = convertDashboardAmount({
      amount: budget.spentAmount,
      currencyCode: budget.currencyCode,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });
    const convertedRemainingAmount = convertDashboardAmount({
      amount: budget.remainingAmount,
      currencyCode: budget.currencyCode,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });

    return {
      ...budget,
      currencyCode: displayCurrencyCode,
      limitAmount: convertedLimitAmount ?? budget.limitAmount,
      spentAmount: convertedSpentAmount ?? budget.spentAmount,
      remainingAmount: convertedRemainingAmount ?? budget.remainingAmount,
    };
  });
  const visibleAccounts = displayAccounts.filter((account) => !account.isArchived);
  const postedMovements = displayMovements.filter((movement) => movement.status === "posted");
  const currentPeriodMovements = postedMovements.filter((movement) => isInRange(movement.occurredAt, comparison.current));
  const previousPeriodMovements = postedMovements.filter((movement) =>
    isInRange(movement.occurredAt, comparison.previous),
  );
  const currentTotals = buildPeriodTotals(currentPeriodMovements);
  const previousTotals = buildPeriodTotals(previousPeriodMovements);
  const savingsSeries = buildSavingsSeries(postedMovements, comparison);
  const expenseFlowSeries = buildDailyFlowSeries(postedMovements, comparison, pickExpenseDailyAmount);
  const incomeFlowSeries = buildDailyFlowSeries(postedMovements, comparison, pickIncomeDailyAmount);
  const transferFlowSeries = buildDailyFlowSeries(postedMovements, comparison, pickTransferDailyAmount);
  const allCategoryComparison = buildCategoryComparison(currentPeriodMovements, previousPeriodMovements);
  const visibleCategories = allCategoryComparison.slice(0, topCount);
  const accountsBreakdown = buildAccountBreakdown(visibleAccounts, currentPeriodMovements);
  const visibleAccountsBreakdown = accountsBreakdown.slice(0, topCount);
  const receivableLeaders = buildExposureLeaders(displayObligations, "receivable");
  const payableLeaders = buildExposureLeaders(displayObligations, "payable");
  const visibleReceivableLeaders = receivableLeaders.slice(0, topCount);
  const visiblePayableLeaders = payableLeaders.slice(0, topCount);
  const monthlyPulse = buildMonthlyPulse(postedMovements);
  const weekdayPattern = buildWeekdayPattern(currentPeriodMovements);
  const upcomingCommitments = buildUpcomingCommitments(displayObligations, displaySubscriptions);

  const totalMoneyDisplay = resolveAggregateAmountDisplay(
    visibleAccounts.map((account) => ({
      currencyCode: account.currencyCode,
      amount: account.currentBalance,
      amountInBaseCurrency: account.currentBalanceInBaseCurrency,
    })),
    displayCurrencyCode,
  );
  const receivableDisplay = resolveAggregateAmountDisplay(
    displayObligations
      .filter((obligation) => obligation.direction === "receivable")
      .map((obligation) => ({
        currencyCode: obligation.currencyCode,
        amount: obligation.pendingAmount,
        amountInBaseCurrency: obligation.pendingAmountInBaseCurrency,
      })),
    displayCurrencyCode,
  );
  const payableDisplay = resolveAggregateAmountDisplay(
    displayObligations
      .filter((obligation) => obligation.direction === "payable")
      .map((obligation) => ({
        currencyCode: obligation.currencyCode,
        amount: obligation.pendingAmount,
        amountInBaseCurrency: obligation.pendingAmountInBaseCurrency,
      })),
    displayCurrencyCode,
  );
  const sharedPrincipalDisplay = resolveAggregateAmountDisplay(
    displaySharedObligations.map((obligation) => ({
      currencyCode: obligation.currencyCode,
      amount: obligation.currentPrincipalAmount ?? obligation.principalAmount,
      amountInBaseCurrency:
        obligation.currentPrincipalAmountInBaseCurrency ?? obligation.principalAmountInBaseCurrency,
    })),
    displayCurrencyCode,
  );
  const sharedPendingDisplay = resolveAggregateAmountDisplay(
    displaySharedObligations.map((obligation) => ({
      currencyCode: obligation.currencyCode,
      amount: obligation.pendingAmount,
      amountInBaseCurrency: obligation.pendingAmountInBaseCurrency,
    })),
    displayCurrencyCode,
  );
  const sharedReceivableObligations = displaySharedObligations.filter(
    (obligation) => obligation.direction === "receivable",
  );
  const sharedPayableObligations = displaySharedObligations.filter(
    (obligation) => obligation.direction === "payable",
  );
  const sharedReceivableDisplay = resolveAggregateAmountDisplay(
    sharedReceivableObligations.map((obligation) => ({
      currencyCode: obligation.currencyCode,
      amount: obligation.pendingAmount,
      amountInBaseCurrency: obligation.pendingAmountInBaseCurrency,
    })),
    displayCurrencyCode,
  );
  const sharedPayableDisplay = resolveAggregateAmountDisplay(
    sharedPayableObligations.map((obligation) => ({
      currencyCode: obligation.currencyCode,
      amount: obligation.pendingAmount,
      amountInBaseCurrency: obligation.pendingAmountInBaseCurrency,
    })),
    displayCurrencyCode,
  );

  const topCategoryThisPeriod = allCategoryComparison[0] ?? null;
  const topCategoryPreviousPeriod =
    [...allCategoryComparison].sort((left, right) => right.previous - left.previous)[0] ?? null;
  const opportunityCategory =
    [...allCategoryComparison]
      .filter((item) => item.delta > 0)
      .sort((left, right) => right.delta - left.delta)[0] ?? topCategoryThisPeriod;
  const bestSavingsDay = [...savingsSeries].sort((left, right) => right.net - left.net)[0] ?? null;
  const hardestDay = [...savingsSeries].sort((left, right) => left.net - right.net)[0] ?? null;
  const positiveDays = savingsSeries.filter((point) => point.net > 0).length;
  const selectedTrendSafeIndex =
    selectedTrendIndex !== null && selectedTrendIndex < savingsSeries.length
      ? selectedTrendIndex
      : Math.max(savingsSeries.length - 1, 0);
  const selectedChronologicalDayKey = savingsSeries[selectedTrendSafeIndex]?.key ?? "";
  const movementsForSelectedChronologicalDay = !selectedChronologicalDayKey
    ? []
    : postedMovements.filter(
        (movement) => toLocalDateKey(new Date(movement.occurredAt)) === selectedChronologicalDayKey,
      );
  const expenseMovementsSelectedDay = movementsForSelectedChronologicalDay.filter(
    (movement) => pickExpenseDailyAmount(movement) !== null,
  );
  const incomeMovementsSelectedDay = movementsForSelectedChronologicalDay.filter(
    (movement) => pickIncomeDailyAmount(movement) !== null,
  );
  const transferMovementsSelectedDay = movementsForSelectedChronologicalDay.filter(
    (movement) => movement.status === "posted" && movement.movementType === "transfer",
  );
  const selectedCategory =
    visibleCategories.find((item) => item.key === selectedCategoryKey) ?? visibleCategories[0] ?? null;
  const selectedAccount =
    visibleAccountsBreakdown.find((item) => item.account.id === selectedAccountId) ?? visibleAccountsBreakdown[0] ?? null;
  const selectedReceivable =
    visibleReceivableLeaders.find((item) => item.key === selectedReceivableKey) ?? visibleReceivableLeaders[0] ?? null;
  const selectedPayable =
    visiblePayableLeaders.find((item) => item.key === selectedPayableKey) ?? visiblePayableLeaders[0] ?? null;
  const selectedMonth =
    monthlyPulse.find((item) => item.key === selectedMonthKey) ?? monthlyPulse[monthlyPulse.length - 1] ?? null;
  const selectedWeekday =
    weekdayPattern.find((item) => item.key === selectedWeekdayKey) ?? weekdayPattern[0] ?? null;
  const totalCurrentExpenses = allCategoryComparison.reduce((total, item) => total + item.current, 0);
  const totalCurrentSavingsDelta = currentTotals.net - previousTotals.net;
  const comparisonDaySpan = getDateDiffInclusive(comparison.current.start, comparison.current.end);
  const currentPeriodTransfers = currentPeriodMovements.filter((movement) => movement.movementType === "transfer");
  const transferRoutes = buildTransferRoutes(currentPeriodTransfers);
  const visibleTransferRoutes = transferRoutes.slice(0, topCount);
  const totalTransferredThisPeriod = currentPeriodTransfers.reduce((total, movement) => {
    const amount = Math.max(
      movement.sourceAmountInBaseCurrency ?? movement.sourceAmount ?? 0,
      movement.destinationAmountInBaseCurrency ?? movement.destinationAmount ?? 0,
    );

    return total + amount;
  }, 0);
  const activeSubscriptions = displaySubscriptions.filter((subscription) => subscription.status === "active");
  const pausedSubscriptions = displaySubscriptions.filter((subscription) => subscription.status === "paused");
  const subscriptionHighlights = buildSubscriptionHighlights(displaySubscriptions);
  const visibleSubscriptionHighlights = subscriptionHighlights.slice(0, topCount);
  const monthlyRecurringCost = subscriptionHighlights.reduce(
    (total, subscription) => total + subscription.monthlyAmount,
    0,
  );
  const todayKey = toDateKey(new Date());
  const currentBudgets = displayBudgets.filter(
    (budget) => budget.periodStart <= todayKey && budget.periodEnd >= todayKey,
  );
  const activeCurrentBudgets = currentBudgets.filter((budget) => budget.isActive);
  const criticalCurrentBudgets = activeCurrentBudgets.filter(
    (budget) => budget.isNearLimit || budget.isOverLimit,
  );
  const overLimitCurrentBudgets = activeCurrentBudgets.filter((budget) => budget.isOverLimit);
  const currentBudgetLimitTotal = activeCurrentBudgets.reduce(
    (total, budget) => total + budget.limitAmount,
    0,
  );
  const currentBudgetSpentTotal = activeCurrentBudgets.reduce(
    (total, budget) => total + budget.spentAmount,
    0,
  );
  const currentBudgetRemainingTotal = activeCurrentBudgets.reduce(
    (total, budget) => total + budget.remainingAmount,
    0,
  );
  const budgetLeaders = [...activeCurrentBudgets]
    .map((budget) => {
      const periodStart = startOfDay(new Date(budget.periodStart));
      const periodEnd = endOfDay(new Date(budget.periodEnd));
      const elapsedDays = Math.max(1, getDateDiffInclusive(periodStart, new Date()));
      const totalDays = Math.max(1, getDateDiffInclusive(periodStart, periodEnd));
      const projectedSpend = (budget.spentAmount / elapsedDays) * totalDays;

      return {
        ...budget,
        projectedSpend,
        projectedDelta: projectedSpend - budget.limitAmount,
      };
    })
    .sort((left, right) => right.usedPercent - left.usedPercent)
    .slice(0, topCount);
  const upcomingOutflows = upcomingCommitments
    .filter((item) => item.kind !== "Por cobrar")
    .reduce((total, item) => total + item.amount, 0);
  const upcomingInflows = upcomingCommitments
    .filter((item) => item.kind === "Por cobrar")
    .reduce((total, item) => total + item.amount, 0);
  const overdueObligations = displayObligations.filter((obligation) => {
    if (!obligation.dueDate || obligation.pendingAmount <= 0) {
      return false;
    }

    return new Date(obligation.dueDate).getTime() < startOfDay(new Date()).getTime();
  });
  const overdueAmount = overdueObligations.reduce((total, obligation) => total + obligation.pendingAmount, 0);
  const dueSoonObligations = displayObligations.filter((obligation) => {
    if (!obligation.dueDate || obligation.pendingAmount <= 0 || obligation.status === "paid") {
      return false;
    }

    const dueTimestamp = startOfDay(new Date(obligation.dueDate)).getTime();
    const todayTimestamp = startOfDay(new Date()).getTime();
    const diffDays = Math.round((dueTimestamp - todayTimestamp) / 86400000);

    return diffDays >= 0 && diffDays <= 30;
  });
  const onTrackObligations = displayObligations.filter((obligation) => {
    if (obligation.pendingAmount <= 0 || obligation.status === "paid") {
      return false;
    }

    if (!obligation.dueDate) {
      return true;
    }

    const dueTimestamp = startOfDay(new Date(obligation.dueDate)).getTime();
    return dueTimestamp > endOfDay(addDays(new Date(), 30)).getTime();
  });
  const obligationAgingBuckets = [
    {
      key: "due_soon",
      label: "Por vencer",
      amount: dueSoonObligations.reduce((total, obligation) => total + obligation.pendingAmount, 0),
      count: dueSoonObligations.length,
      tone: "warning" as const,
    },
    {
      key: "overdue_1_30",
      label: "Vencido 1-30",
      amount: overdueObligations
        .filter((obligation) => {
          if (!obligation.dueDate) {
            return false;
          }
          const diffDays = Math.round(
            (startOfDay(new Date()).getTime() - startOfDay(new Date(obligation.dueDate)).getTime()) / 86400000,
          );
          return diffDays >= 1 && diffDays <= 30;
        })
        .reduce((total, obligation) => total + obligation.pendingAmount, 0),
      count: overdueObligations.filter((obligation) => {
        if (!obligation.dueDate) {
          return false;
        }
        const diffDays = Math.round(
          (startOfDay(new Date()).getTime() - startOfDay(new Date(obligation.dueDate)).getTime()) / 86400000,
        );
        return diffDays >= 1 && diffDays <= 30;
      }).length,
      tone: "danger" as const,
    },
    {
      key: "overdue_31_60",
      label: "Vencido 31-60",
      amount: overdueObligations
        .filter((obligation) => {
          if (!obligation.dueDate) {
            return false;
          }
          const diffDays = Math.round(
            (startOfDay(new Date()).getTime() - startOfDay(new Date(obligation.dueDate)).getTime()) / 86400000,
          );
          return diffDays >= 31 && diffDays <= 60;
        })
        .reduce((total, obligation) => total + obligation.pendingAmount, 0),
      count: overdueObligations.filter((obligation) => {
        if (!obligation.dueDate) {
          return false;
        }
        const diffDays = Math.round(
          (startOfDay(new Date()).getTime() - startOfDay(new Date(obligation.dueDate)).getTime()) / 86400000,
        );
        return diffDays >= 31 && diffDays <= 60;
      }).length,
      tone: "danger" as const,
    },
    {
      key: "overdue_61_plus",
      label: "Vencido 61+",
      amount: overdueObligations
        .filter((obligation) => {
          if (!obligation.dueDate) {
            return false;
          }
          const diffDays = Math.round(
            (startOfDay(new Date()).getTime() - startOfDay(new Date(obligation.dueDate)).getTime()) / 86400000,
          );
          return diffDays >= 61;
        })
        .reduce((total, obligation) => total + obligation.pendingAmount, 0),
      count: overdueObligations.filter((obligation) => {
        if (!obligation.dueDate) {
          return false;
        }
        const diffDays = Math.round(
          (startOfDay(new Date()).getTime() - startOfDay(new Date(obligation.dueDate)).getTime()) / 86400000,
        );
        return diffDays >= 61;
      }).length,
      tone: "danger" as const,
    },
    {
      key: "on_track",
      label: "Al dia",
      amount: onTrackObligations.reduce((total, obligation) => total + obligation.pendingAmount, 0),
      count: onTrackObligations.length,
      tone: "success" as const,
    },
  ];
  const collectedThisPeriod = currentPeriodMovements
    .filter((movement) => movement.movementType === "obligation_payment")
    .filter((movement) => classifyMovement(movement)?.kind === "income")
    .reduce((total, movement) => total + getIncomeAmount(movement), 0);
  const paidThisPeriod = currentPeriodMovements
    .filter((movement) => movement.movementType === "obligation_payment")
    .filter((movement) => classifyMovement(movement)?.kind === "expense")
    .reduce((total, movement) => total + getExpenseAmount(movement), 0);
  const scheduledMovements = displayMovements.filter((movement) => {
    if (movement.status === "voided" || movement.status === "posted") {
      return false;
    }

    const occurredAt = new Date(movement.occurredAt).getTime();
    return occurredAt >= startOfDay(new Date()).getTime();
  });
  const liquidAccountTypes = new Set(["cash", "bank", "savings"]);
  const liquidMoneyTotal = visibleAccounts
    .filter((account) => liquidAccountTypes.has(account.type))
    .reduce((total, account) => total + account.currentBalance, 0);
  const totalCash = visibleAccounts
    .filter((account) => account.type === "cash")
    .reduce((total, account) => total + account.currentBalance, 0);
  const totalBank = visibleAccounts
    .filter((account) => account.type === "bank")
    .reduce((total, account) => total + account.currentBalance, 0);
  const totalSavings = visibleAccounts
    .filter((account) => account.type === "savings")
    .reduce((total, account) => total + account.currentBalance, 0);
  const futureFlowWindows = [7, 15, 30].map((days) => {
    const limitDate = endOfDay(addDays(new Date(), days));
    const scheduledWindow = scheduledMovements.filter(
      (movement) => new Date(movement.occurredAt).getTime() <= limitDate.getTime(),
    );
    const scheduledIncome = scheduledWindow.reduce((total, movement) => {
      const classified = classifyScheduledMovement(movement);
      return classified?.kind === "income" ? total + classified.amount : total;
    }, 0);
    const scheduledExpense = scheduledWindow.reduce((total, movement) => {
      const classified = classifyScheduledMovement(movement);
      return classified?.kind === "expense" ? total + classified.amount : total;
    }, 0);
    const commitmentsWindow = upcomingCommitments.filter(
      (item) => new Date(item.date).getTime() <= limitDate.getTime(),
    );
    const expectedInflow = commitmentsWindow
      .filter((item) => item.kind === "Por cobrar")
      .reduce((total, item) => total + item.amount, 0) + scheduledIncome;
    const expectedOutflow = commitmentsWindow
      .filter((item) => item.kind !== "Por cobrar")
      .reduce((total, item) => total + item.amount, 0) + scheduledExpense;

    return {
      days,
      expectedInflow,
      expectedOutflow,
      receivableCount: commitmentsWindow.filter((item) => item.kind === "Por cobrar").length,
      payableCount: commitmentsWindow.filter((item) => item.kind !== "Por cobrar").length,
      scheduledCount: scheduledWindow.length,
      estimatedBalance: liquidMoneyTotal + expectedInflow - expectedOutflow,
    };
  });
  const averageDailySpend = currentTotals.expense / Math.max(1, comparisonDaySpan);
  const averageWeeklySpend = currentTotals.expense / Math.max(1, comparisonDaySpan / 7);
  const averageMonthlySavings =
    monthlyPulse.length > 0
      ? monthlyPulse.reduce((total, item) => total + item.net, 0) / monthlyPulse.length
      : 0;
  const savingsCapacity = currentTotals.income > 0 ? currentTotals.net / currentTotals.income : 0;
  const expandedNetWorth = totalMoneyDisplay.amount + receivableDisplay.amount - payableDisplay.amount;
  const projectedLiquidMoney = liquidMoneyTotal + upcomingInflows - upcomingOutflows;
  const topBalanceAccount = [...visibleAccountsBreakdown].sort((left, right) => right.amount - left.amount)[0] ?? null;
  const bottomBalanceAccount = [...visibleAccountsBreakdown].sort((left, right) => left.amount - right.amount)[0] ?? null;
  const topTransferRoute = visibleTransferRoutes[0] ?? null;
  const latestMovement = [...postedMovements].sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  )[0] ?? null;
  const latestIncome = [...postedMovements]
    .filter((movement) => movement.movementType === "income" || movement.movementType === "refund")
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())[0] ?? null;
  const latestMovementAmount = latestMovement
    ? Math.max(
        latestMovement.destinationAmount ?? 0,
        latestMovement.sourceAmount ?? 0,
      )
    : null;
  const latestMovementTone =
    latestMovement?.movementType === "income" || latestMovement?.movementType === "refund"
      ? "success"
      : latestMovement?.movementType === "transfer"
        ? "info"
        : "warning";
  const latestMovementLabel =
    latestMovement?.movementType === "income" || latestMovement?.movementType === "refund"
      ? "Ingreso"
      : latestMovement?.movementType === "transfer"
        ? "Transferencia"
        : latestMovement
          ? "Salida"
          : null;
  const latestIncomeAmount = latestIncome ? getIncomeAmount(latestIncome) : null;
  const nextSubscriptionDue = [...activeSubscriptions].sort(
    (left, right) => new Date(left.nextDueDate).getTime() - new Date(right.nextDueDate).getTime(),
  )[0] ?? null;
  const nextReceivableDue = [...displayObligations]
    .filter((obligation) => obligation.direction === "receivable" && obligation.pendingAmount > 0 && obligation.dueDate)
    .sort((left, right) => new Date(left.dueDate as string).getTime() - new Date(right.dueDate as string).getTime())[0] ?? null;
  const nextPayableDue = [...displayObligations]
    .filter((obligation) => obligation.direction === "payable" && obligation.pendingAmount > 0 && obligation.dueDate)
    .sort((left, right) => new Date(left.dueDate as string).getTime() - new Date(right.dueDate as string).getTime())[0] ?? null;
  const currencyExposure = buildCurrencyExposure(
    snapshot.accounts,
    displayCurrencyCode,
    baseCurrencyCode,
    exchangeRateMap,
  );
  const healthSnapshot = buildFinancialHealthSnapshot({
    liquidMoney: liquidMoneyTotal,
    averageMonthlyExpense:
      monthlyPulse.length > 0
        ? monthlyPulse.reduce((total, item) => total + item.expense, 0) / monthlyPulse.length
        : 0,
    currentIncome: currentTotals.income,
    currentNet: currentTotals.net,
    monthlyRecurringCost,
    upcomingOutflows,
    overdueAmount,
    totalPayable: payableDisplay.amount,
  });
  const learningSnapshot = buildLearningSnapshot(postedMovements, displayCurrencyCode);
  const uncategorizedMovements = displayMovements.filter((movement) => {
    if (movement.movementType === "transfer" || movement.status === "voided") {
      return false;
    }

    return !movement.categoryId || movement.category === "Sin categoria";
  });
  const movementsWithoutCounterparty = displayMovements.filter((movement) => {
    if (movement.status === "voided" || movement.movementType === "transfer") {
      return false;
    }

    return !movement.counterpartyId || movement.counterparty === "Sin contraparte";
  });
  const subscriptionsWithoutAccount = displaySubscriptions.filter(
    (subscription) => subscription.status === "active" && !subscription.accountId,
  );
  const obligationsWithoutPlan = displayObligations.filter(
    (obligation) =>
      obligation.pendingAmount > 0 &&
      obligation.status !== "paid" &&
      !obligation.dueDate &&
      !obligation.installmentAmount &&
      !obligation.installmentCount,
  );
  const lowBalanceAccounts = visibleAccounts.filter(
    (account) =>
      ["cash", "bank", "savings"].includes(account.type) &&
      account.currentBalance <= Math.max(averageWeeklySpend * 0.35, 50),
  );
  const duplicateSubscriptionGroups = new Map<string, number>();

  for (const subscription of activeSubscriptions) {
    const duplicateKey = `${subscription.vendor.toLowerCase()}::${subscription.categoryName ?? "sin-categoria"}::${subscription.amount.toFixed(2)}`;
    duplicateSubscriptionGroups.set(
      duplicateKey,
      (duplicateSubscriptionGroups.get(duplicateKey) ?? 0) + 1,
    );
  }

  const duplicateSubscriptions = [...duplicateSubscriptionGroups.values()].filter((count) => count > 1).length;
  const anomalyAlerts = [
    ...(criticalCurrentBudgets.length > 0
      ? [
          {
            key: "critical-budgets",
            title: "Presupuestos al limite",
            description: `${criticalCurrentBudgets.length} presupuesto${criticalCurrentBudgets.length === 1 ? "" : "s"} ya esta${criticalCurrentBudgets.length === 1 ? "" : "n"} en alerta o excedido${criticalCurrentBudgets.length === 1 ? "" : "s"}.`,
            tone: overLimitCurrentBudgets.length > 0 ? "danger" : "warning",
          },
        ]
      : []),
    ...(overdueAmount > 0
      ? [
          {
            key: "overdue-obligations",
            title: "Cartera vencida",
            description: `${formatCurrency(overdueAmount, displayCurrencyCode)} ya paso la fecha esperada de cobro o pago.`,
            tone: "danger",
          },
        ]
      : []),
    ...(previousTotals.expense > 0 && currentTotals.expense > previousTotals.expense * 1.25
      ? [
          {
            key: "expense-spike",
            title: "Gasto inusualmente alto",
            description: `Tus salidas van ${formatPercentage((currentTotals.expense - previousTotals.expense) / previousTotals.expense)} por encima del comparativo anterior.`,
            tone: "warning",
          },
        ]
      : []),
    ...(lowBalanceAccounts.length > 0
      ? [
          {
            key: "low-balance",
            title: "Cuenta con saldo bajo",
            description: `${lowBalanceAccounts[0].name} ya se ve apretada para el ritmo reciente del período.`,
            tone: "warning",
          },
        ]
      : []),
    ...(nextSubscriptionDue &&
    new Date(nextSubscriptionDue.nextDueDate).getTime() <= endOfDay(addDays(new Date(), 3)).getTime()
      ? [
          {
            key: "subscription-close",
            title: "Suscripción muy próxima",
            description: `${nextSubscriptionDue.name} cae el ${formatDate(nextSubscriptionDue.nextDueDate)}.`,
            tone: "info",
          },
        ]
      : []),
    ...(duplicateSubscriptions > 0
      ? [
          {
            key: "duplicate-subscriptions",
            title: "Posible duplicidad recurrente",
            description: `Detectamos ${duplicateSubscriptions} grupo${duplicateSubscriptions === 1 ? "" : "s"} de suscripciones con proveedor y monto repetido.`,
            tone: "warning",
          },
        ]
      : []),
  ];
  const qualityItems = [
    {
      key: "pending-movements",
      label: "Movimientos pendientes",
      value: displayMovements.filter((movement) => movement.status === "pending").length,
      helper: "Siguen sin aplicarse al balance real.",
      tone: "warning" as const,
    },
    {
      key: "uncategorized",
      label: "Sin categoría",
      value: uncategorizedMovements.length,
      helper: "Restan precisión a comparativos e insights.",
      tone: "warning" as const,
    },
    {
      key: "subscriptions-without-account",
      label: "Suscripciones sin cuenta",
      value: subscriptionsWithoutAccount.length,
      helper: "Conviene ligarlas a una cuenta para proyectar mejor la caja.",
      tone: "info" as const,
    },
    {
      key: "obligations-without-plan",
      label: "Creditos/deudas sin plan",
      value: obligationsWithoutPlan.length,
      helper: "No tienen fecha o referencia clara de seguimiento.",
      tone: "warning" as const,
    },
    {
      key: "without-counterparty",
      label: "Registros sin contraparte",
      value: movementsWithoutCounterparty.length,
      helper: "Pierdes trazabilidad de con quién se movió el dinero.",
      tone: "info" as const,
    },
  ];
  const qualityIssuesTotal = qualityItems.reduce((total, item) => total + item.value, 0);
  const collaborationActivity = snapshot.activity.filter((item) =>
    isInRange(item.createdAt, comparison.current),
  );
  const actorActivity = [...collaborationActivity.reduce((map, item) => {
    map.set(item.actor, (map.get(item.actor) ?? 0) + 1);
    return map;
  }, new Map<string, number>()).entries()]
    .map(([actor, count]) => ({ actor, count }))
    .sort((left, right) => right.count - left.count)
    .slice(0, topCount);
  const personalWorkspaceCount = workspaces.filter((workspace) => workspace.kind === "personal").length;
  const sharedWorkspaceCount = workspaces.filter((workspace) => workspace.kind === "shared").length;
  const maxMonthlyAmount = Math.max(1, ...monthlyPulse.map((item) => Math.max(item.income, item.expense)));
  const maxCategoryAmount = Math.max(1, ...visibleCategories.map((item) => Math.max(item.current, item.previous)));
  const maxAccountShare = Math.max(0.0001, ...visibleAccountsBreakdown.map((item) => item.share));
  const maxReceivable = Math.max(1, ...visibleReceivableLeaders.map((item) => item.amount));
  const maxPayable = Math.max(1, ...visiblePayableLeaders.map((item) => item.amount));
  const maxWeekdayAmount = Math.max(1, ...weekdayPattern.map((item) => Math.max(item.income, item.expense)));
  const maxCurrencyExposure = Math.max(1, ...currencyExposure.map((item) => item.amount));
  const showSavingsSection = isWidgetVisible("savings_trend") || isWidgetVisible("period_radar");
  const showBudgetSection = isWidgetVisible("budget_snapshot");
  const showPortfolioSection =
    isWidgetVisible("accounts_breakdown") ||
    isWidgetVisible("receivable_leaders") ||
    isWidgetVisible("payable_leaders");
  const showSpendingSection =
    isWidgetVisible("category_comparison") || isWidgetVisible("monthly_pulse");
  const showTimingSection =
    isWidgetVisible("weekly_pattern") || isWidgetVisible("upcoming_recent");
  const showAdvancedOpsSection =
    isWidgetVisible("obligation_watch") ||
    isWidgetVisible("future_flow") ||
    isWidgetVisible("alert_center") ||
    isWidgetVisible("workspace_collaboration") ||
    isWidgetVisible("data_quality") ||
    isWidgetVisible("subscriptions_snapshot") ||
    isWidgetVisible("transfer_snapshot") ||
    isWidgetVisible("health_center") ||
    isWidgetVisible("currency_exposure") ||
    isWidgetVisible("learning_panel") ||
    isWidgetVisible("activity_timeline");

  return (
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        actions={
          <>
            <Button
              disabled={snapshotQuery.isFetching}
              onClick={() => snapshotQuery.refetch()}
              variant="ghost"
            >
              <RefreshCw className={`mr-2 h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
              Actualizar
            </Button>
            <div className="flex flex-col gap-3">
            <SegmentedControl
              onChange={setComparisonPreset}
              options={comparisonOptions}
              value={comparisonPreset}
            />
            <SegmentedControl
              onChange={setDisplayCurrencyCode}
              options={dashboardCurrencyOptions}
              value={displayCurrencyCode}
            />
            <SegmentedControl
              onChange={setTopCount}
              options={topOptions.map((option) => ({
                value: option,
                label: `Top ${option}`,
                helper: "detalle visible",
              }))}
              value={topCount}
            />
            </div>
          </>
        }
        description="Tu dinero ya tiene suficiente contexto. Aquí lo convertimos en decisiones: cuánto tienes, quién te debe, en qué se te va más, y si realmente estás ahorrando mejor que antes."
        eyebrow="resumen"
        title={`${snapshot.workspace.name}, con foco en decisiones`}
      >
        <div className="flex flex-wrap gap-3">
          <StatusBadge status={`${comparison.current.label}: ${comparison.current.detail}`} tone="info" />
          <StatusBadge status={`${comparison.previous.label}: ${comparison.previous.detail}`} tone="neutral" />
          <StatusBadge status={`Vista global ${displayCurrencyCode}`} tone="success" />
          <StatusBadge status={`Base del workspace ${baseCurrencyCode}`} tone="neutral" />
        </div>
        <p className="mt-4 text-sm leading-7 text-storm">
          {comparison.caption} Todos los montos se convierten a {displayCurrencyCode} con el ultimo tipo de cambio disponible.
        </p>
      </PageHeader>

      <SurfaceCard
        action={
          <Button onClick={() => setIsCustomizerOpen((currentValue) => !currentValue)} variant="ghost">
            {isCustomizerOpen ? "Ocultar opciones" : "Personalizar dashboard"}
          </Button>
        }
        description="Elige una vista simple o avanzada, y decide que widgets quieres tener a la mano cada vez que entres."
        title="Panel de control del dashboard"
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">Modo general</p>
            <div className="mt-4">
              <SegmentedControl
                onChange={handleDashboardModeChange}
                options={dashboardModeSelectorOptions}
                value={effectiveDashboardMode}
              />
            </div>
            {!canUseAdvancedDashboard ? (
              <FormFeedbackBanner
                badgeLabel="DarkMoney Pro"
                className="mt-4"
                description={
                  isCheckingAdvancedDashboardAccess
                    ? "Estamos validando si tu cuenta puede entrar a la vista avanzada. Mientras tanto, dejamos activo el dashboard simple."
                    : "La vista avanzada, los widgets profundos y el panel Aprendiendo de ti se desbloquean con DarkMoney Pro. Por ahora te dejamos la lectura esencial activa."
                }
                title={
                  isCheckingAdvancedDashboardAccess
                    ? "Validando acceso a la vista avanzada"
                    : "La vista avanzada esta reservada para usuarios Pro"
                }
                tone="info"
              />
            ) : null}
            <p className="mt-4 text-sm leading-7 text-storm">
              {effectiveDashboardMode === "simple"
                ? "Muestra solo los bloques esenciales para leer dinero, categorías, cuentas y vencimientos."
                : "Activa widgets extra para profundizar en riesgo, monedas, suscripciones, transferencias y actividad."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatusBadge
                status={`${availableWidgets.length - hiddenWidgets.filter((item) => availableWidgets.some((widget) => widget.id === item)).length} widgets visibles`}
                tone="success"
              />
              <StatusBadge
                status={effectiveDashboardMode === "simple" ? "Vista simple" : "Vista avanzada"}
                tone="neutral"
              />
              {!canUseAdvancedDashboard && !isCheckingAdvancedDashboardAccess ? (
                <StatusBadge status="Vista avanzada solo en Pro" tone="warning" />
              ) : null}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">Widgets</p>
                <p className="mt-2 text-sm leading-7 text-storm">
                  Puedes ocultar los que no usas y volver a mostrarlos cuando quieras. Todo queda guardado en este navegador.
                </p>
              </div>
              <Button onClick={() => setHiddenWidgets([])} variant="ghost">
                Restaurar todo
              </Button>
            </div>

            {isCustomizerOpen ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {availableWidgets.map((widget) => {
                  const visible = isWidgetVisible(widget.id);

                  return (
                    <Button
                      className="justify-start"
                      key={widget.id}
                      onClick={() => toggleWidgetVisibility(widget.id)}
                      variant={visible ? "primary" : "ghost"}
                    >
                      {visible ? "Ocultar" : "Mostrar"} {widget.label}
                    </Button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 flex flex-wrap gap-2">
                {availableWidgets.map((widget) => (
                  <StatusBadge
                    key={widget.id}
                    status={`${isWidgetVisible(widget.id) ? "Visible" : "Oculto"} · ${widget.label}`}
                    tone={isWidgetVisible(widget.id) ? "success" : "neutral"}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </SurfaceCard>

      {isWidgetVisible("overview_kpis") ? (
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <OverviewCard
          accent="pine"
          hint="Saldo combinado de tus cuentas activas, convertido a una sola lectura cuando hace falta."
          icon={<WalletCards className="h-5 w-5" />}
          label="Dinero total"
          trendLabel={`${visibleAccounts.length} cuentas activas`}
          trendTone="success"
          value={formatCurrency(totalMoneyDisplay.amount, totalMoneyDisplay.currencyCode)}
        />
        <OverviewCard
          accent="ink"
          hint="Plata pendiente de cobro en creditos, ventas a cuotas y otras cuentas por cobrar."
          icon={<ArrowDownCircle className="h-5 w-5" />}
          label="Te deben"
          trendLabel={`${receivableLeaders.length} contactos con saldo`}
          trendTone="info"
          value={formatCurrency(receivableDisplay.amount, receivableDisplay.currencyCode)}
        />
        <OverviewCard
          accent="ember"
          hint="Lo que todavía tienes por pagar considerando deudas, compras a cuotas y compromisos vivos."
          icon={<ArrowUpCircle className="h-5 w-5" />}
          label="Debes"
          trendLabel={`${payableLeaders.length} contactos con saldo`}
          trendTone="warning"
          value={formatCurrency(payableDisplay.amount, payableDisplay.currencyCode)}
        />
        <OverviewCard
          accent="gold"
          hint={`Resultado neto de ${comparison.current.label.toLowerCase()} restando gastos a ingresos.`}
          icon={<PiggyBank className="h-5 w-5" />}
          label="Ahorro del período"
          trendLabel={formatSignedPercentage(currentTotals.net, previousTotals.net)}
          trendTone={getChangeTone(totalCurrentSavingsDelta)}
          value={formatCurrency(currentTotals.net, displayCurrencyCode)}
        />
        <OverviewCard
          accent="pine"
          hint="Entradas aplicadas dentro del período seleccionado. No cuenta transferencias internas."
          icon={<ArrowUpRight className="h-5 w-5" />}
          label="Ingresos"
          trendLabel={formatSignedPercentage(currentTotals.income, previousTotals.income)}
          trendTone={getChangeTone(currentTotals.income - previousTotals.income)}
          value={formatCurrency(currentTotals.income, displayCurrencyCode)}
        />
        <OverviewCard
          accent="ember"
          hint="Salidas aplicadas dentro del período seleccionado, incluyendo pagos recurrentes y obligaciones."
          icon={<ArrowDownRight className="h-5 w-5" />}
          label="Gastos"
          trendLabel={formatSignedPercentage(currentTotals.expense, previousTotals.expense)}
          trendTone={getChangeTone((currentTotals.expense - previousTotals.expense) * -1)}
          value={formatCurrency(currentTotals.expense, displayCurrencyCode)}
        />
      </section>
      ) : null}

      {isWidgetVisible("overview_kpis") ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <div className="glass-panel-soft rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Dinero libre real</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(healthSnapshot.realFreeMoney, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Liquidez menos pagos cercanos en 30 dias.</p>
          </div>
          <div className="glass-panel-soft rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Promedio diario</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(averageDailySpend, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Salida media dentro del corte actual.</p>
          </div>
          <div className="glass-panel-soft rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Suscripciones activas</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">{activeSubscriptions.length}</p>
            <p className="mt-2 text-sm text-storm">
              Costo mensual aprox. {formatCurrency(monthlyRecurringCost, displayCurrencyCode)}.
            </p>
          </div>
          <div className="glass-panel-soft rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Pagos próximos</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(upcomingOutflows, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">{upcomingCommitments.filter((item) => item.kind !== "Por cobrar").length} compromisos cercanos.</p>
          </div>
          <div className="glass-panel-soft rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Vencido</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(overdueAmount, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">{overdueObligations.length} registros necesitan revision.</p>
          </div>
          <div className="glass-panel-soft rounded-[24px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Transferido</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(totalTransferredThisPeriod, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">{currentPeriodTransfers.length} transferencias en el corte.</p>
          </div>
        </section>
      ) : null}

      {isWidgetVisible("overview_kpis") && effectiveDashboardMode === "advanced" ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-[24px] border border-pine/18 bg-pine/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-pine">Patrimonio neto ampliado</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(expandedNetWorth, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">
              Caja actual más lo que te deben, menos lo que aún debes.
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Liquidez disponible</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(liquidMoneyTotal, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Efectivo, bancos y ahorros listos para moverse.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Efectivo</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(totalCash, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Fondos de caja y billeteras visibles.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Bancos</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(totalBank, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Saldo disponible en cuentas bancarias activas.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Ahorros</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(totalSavings, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Reservas en cuentas marcadas para ahorrar.</p>
          </div>
          <div className="rounded-[24px] border border-gold/18 bg-gold/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-gold">Caja proyectada 30 dias</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(projectedLiquidMoney, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">
              Considera {formatCurrency(upcomingInflows, displayCurrencyCode)} por entrar y{" "}
              {formatCurrency(upcomingOutflows, displayCurrencyCode)} por salir.
            </p>
          </div>
        </section>
      ) : null}

      {isWidgetVisible("overview_kpis") &&
      effectiveDashboardMode === "advanced" &&
      (sharedObligationsQuery.isLoading ||
        sharedObligationsQuery.error ||
        displaySharedObligations.length > 0) ? (
        <SurfaceCard
          action={
            <StatusBadge
              status={
                sharedObligationsQuery.isLoading
                  ? "Cargando..."
                  : sharedObligationsQuery.error
                    ? "Con incidencia"
                    : `${displaySharedObligations.length} compartidos`
              }
              tone="info"
            />
          }
          description="Lectura separada de los creditos y deudas compartidos contigo en modo solo lectura. No se mezclan con los KPIs del workspace."
          title="Cartera compartida contigo"
        >
          {sharedObligationsQuery.isLoading ? (
            <DataState
              description="Estamos trayendo los registros que otros usuarios compartieron contigo."
              title="Cargando cartera compartida"
            />
          ) : sharedObligationsQuery.error ? (
            <DataState
              description={getQueryErrorMessage(
                sharedObligationsQuery.error,
                "No pudimos cargar la cartera compartida contigo.",
              )}
              title="No pudimos abrir los compartidos"
              tone="error"
            />
          ) : (
            <div className="grid gap-4 xl:grid-cols-4">
              <div className="glass-panel-soft rounded-[24px] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Principal compartido</p>
                <p className="mt-3 font-display text-2xl font-semibold text-ink">
                  {formatCurrency(sharedPrincipalDisplay.amount, sharedPrincipalDisplay.currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  Base actual de {displaySharedObligations.length} registros en seguimiento.
                </p>
              </div>
              <div className="glass-panel-soft rounded-[24px] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendiente compartido</p>
                <p className="mt-3 font-display text-2xl font-semibold text-ink">
                  {formatCurrency(sharedPendingDisplay.amount, sharedPendingDisplay.currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  Exposición viva que ves aparte de tu cartera propia.
                </p>
              </div>
              <div className="rounded-[24px] border border-pine/18 bg-pine/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-pine">Créditos compartidos</p>
                <p className="mt-3 font-display text-2xl font-semibold text-ink">
                  {formatCurrency(sharedReceivableDisplay.amount, sharedReceivableDisplay.currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  {sharedReceivableObligations.length}{" "}
                  {sharedReceivableObligations.length === 1 ? "crédito" : "créditos"} en solo lectura.
                </p>
                <p className="mt-2 text-sm text-storm/85">
                  Al propietario de estos registros aún le deben pagar.
                </p>
              </div>
              <div className="rounded-[24px] border border-rosewood/18 bg-rosewood/10 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-rosewood">
                  Deudas compartidas
                </p>
                <p className="mt-3 font-display text-2xl font-semibold text-ink">
                  {formatCurrency(sharedPayableDisplay.amount, sharedPayableDisplay.currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  {sharedPayableObligations.length}{" "}
                  {sharedPayableObligations.length === 1 ? "deuda" : "deudas"} en solo lectura.
                </p>
                <p className="mt-2 text-sm text-storm/85">
                  El propietario de estos registros aún debe pagar.
                </p>
              </div>
            </div>
          )}
        </SurfaceCard>
      ) : null}

      {isWidgetVisible("overview_kpis") && effectiveDashboardMode === "advanced" ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Gasto semanal medio</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(averageWeeklySpend, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Referencia rápida para medir tu ritmo de consumo.</p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Ahorro mensual medio</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(averageMonthlySavings, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">
              Promedio de tu pulso mensual reciente. Capacidad actual {formatPercentage(Math.max(0, savingsCapacity))}.
            </p>
          </div>
          <div className="rounded-[24px] border border-pine/18 bg-pine/10 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-pine">Cuenta con mayor saldo</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {topBalanceAccount ? formatCurrency(topBalanceAccount.amount, displayCurrencyCode) : "Sin cuentas"}
            </p>
            <p className="mt-2 text-sm text-storm">
              {topBalanceAccount
                ? `${topBalanceAccount.account.name} concentra ${formatPercentage(topBalanceAccount.share)} del dinero visible.`
                : "Crea o activa una cuenta para empezar a ver concentración de saldo."}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Cuenta con menor saldo</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {bottomBalanceAccount ? formatCurrency(bottomBalanceAccount.amount, displayCurrencyCode) : "Sin cuentas"}
            </p>
            <p className="mt-2 text-sm text-storm">
              {bottomBalanceAccount
                ? `${bottomBalanceAccount.account.name} hoy tiene el menor peso dentro del dinero activo.`
                : "Aún no hay suficientes cuentas para comparar extremos."}
            </p>
          </div>
          <div className="rounded-[24px] border border-pine/18 bg-pine/10 p-4">
            <div className="flex flex-wrap items-start gap-2">
              <p className="min-w-0 flex-1 text-xs uppercase tracking-[0.18em] text-pine">Ultimo ingreso</p>
              {latestIncomeAmount !== null ? (
                <StatusBadge status={formatCurrency(latestIncomeAmount, displayCurrencyCode)} tone="success" />
              ) : null}
            </div>
            <p className="mt-3 font-semibold text-ink">
              {latestIncome?.description || latestIncome?.counterparty || "Sin ingresos recientes"}
            </p>
            <p className="mt-2 text-sm text-storm">
              {latestIncome ? formatDateTime(latestIncome.occurredAt) : "Cuando registres cobros o ingresos, apareceran aqui."}
            </p>
          </div>
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-start gap-2">
              <p className="min-w-0 flex-1 text-xs uppercase tracking-[0.18em] text-storm">Ultimo movimiento</p>
              {latestMovementLabel && latestMovementAmount !== null ? (
                <div className="flex flex-wrap gap-1">
                  <StatusBadge status={latestMovementLabel} tone={latestMovementTone} />
                  <StatusBadge status={formatCurrency(latestMovementAmount, displayCurrencyCode)} tone={latestMovementTone} />
                </div>
              ) : null}
            </div>
            <p className="mt-3 font-semibold text-ink">
              {latestMovement?.description || latestMovement?.counterparty || "Sin actividad reciente"}
            </p>
            <p className="mt-2 text-sm text-storm">
              {latestMovement ? formatDateTime(latestMovement.occurredAt) : "Todavía no hay movimientos aplicados para resumir."}
            </p>
          </div>
        </section>
      ) : null}

      {showSavingsSection ? (
      <section
        className={`grid gap-6 ${
          isWidgetVisible("savings_trend") && isWidgetVisible("period_radar")
            ? "xl:grid-cols-[1.35fr_0.65fr]"
            : "xl:grid-cols-1"
        }`}
      >
        {isWidgetVisible("savings_trend") ? (
        <SurfaceCard
          action={<GhostLink label="Ver movimientos" to="/app/movements" />}
          description="Ahorro neto, gastos, ingresos y transferencias día a día. Toca un día para ver los movimientos que lo componen."
          title="Cronológicos del período"
        >
          <div className="mb-6 flex flex-wrap gap-2">
            {(
              [
                { id: "savings" as const, label: "Ahorro neto" },
                { id: "expense" as const, label: "Gastos" },
                { id: "income" as const, label: "Ingresos" },
                { id: "transfer" as const, label: "Transferencias" },
              ] as const
            ).map((tab) => (
              <Button
                className="rounded-full px-4 py-2 text-xs uppercase tracking-[0.14em]"
                key={tab.id}
                onClick={() => setChronologicalTrendTab(tab.id)}
                type="button"
                variant={chronologicalTrendTab === tab.id ? "primary" : "ghost"}
              >
                {tab.label}
              </Button>
            ))}
          </div>
          {chronologicalTrendTab === "savings" ? (
            <SavingsLineChart
              currencyCode={displayCurrencyCode}
              dayMovements={movementsForSelectedChronologicalDay}
              onSelect={setSelectedTrendIndex}
              points={savingsSeries}
              selectedIndex={selectedTrendSafeIndex}
            />
          ) : null}
          {chronologicalTrendTab === "expense" ? (
            <FlowLineChart
              chartTitle="Gastos acumulados"
              comparisonDailyLabel="Comparación (día homólogo)"
              currencyCode={displayCurrencyCode}
              dailyLabel="Gasto del día"
              movementsForDay={expenseMovementsSelectedDay}
              onSelect={setSelectedTrendIndex}
              points={expenseFlowSeries}
              selectedIndex={selectedTrendSafeIndex}
              variant="expense"
            />
          ) : null}
          {chronologicalTrendTab === "income" ? (
            <FlowLineChart
              chartTitle="Ingresos acumulados"
              comparisonDailyLabel="Comparación (día homólogo)"
              currencyCode={displayCurrencyCode}
              dailyLabel="Ingreso del día"
              movementsForDay={incomeMovementsSelectedDay}
              onSelect={setSelectedTrendIndex}
              points={incomeFlowSeries}
              selectedIndex={selectedTrendSafeIndex}
              variant="income"
            />
          ) : null}
          {chronologicalTrendTab === "transfer" ? (
            <FlowLineChart
              chartTitle="Transferencias acumuladas"
              comparisonDailyLabel="Comparación (día homólogo)"
              currencyCode={displayCurrencyCode}
              dailyLabel="Transferido este día"
              movementsForDay={transferMovementsSelectedDay}
              onSelect={setSelectedTrendIndex}
              points={transferFlowSeries}
              selectedIndex={selectedTrendSafeIndex}
              variant="transfer"
            />
          ) : null}
        </SurfaceCard>
        ) : null}

        {isWidgetVisible("period_radar") ? (
        <SurfaceCard
          action={<Sparkles className="h-5 w-5 text-gold" />}
          description="Lecturas rápidas para saber dónde poner atención antes de abrir cada módulo."
          title="Radar del período"
        >
          <div className="grid gap-3">
            <article className="rounded-[24px] border border-pine/18 bg-pine/10 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-pine">Categoría más pesada ahora</p>
              <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
                {topCategoryThisPeriod?.name ?? "Aún sin categoría dominante"}
              </h4>
              <p className="mt-2 text-sm leading-7 text-storm">
                {topCategoryThisPeriod
                  ? `${formatCurrency(topCategoryThisPeriod.current, displayCurrencyCode)} y ${formatPercentage(
                      topCategoryThisPeriod.share,
                    )} de tu gasto del período.`
                  : "Todavía no hay gasto suficiente para detectar una categoría dominante."}
              </p>
            </article>

            <article className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">La que más pesaba antes</p>
              <h4 className="mt-3 font-display text-2xl font-semibold text-ink">
                {topCategoryPreviousPeriod?.name ?? "Sin historial comparable"}
              </h4>
              <p className="mt-2 text-sm leading-7 text-storm">
                {topCategoryPreviousPeriod
                  ? `${formatCurrency(topCategoryPreviousPeriod.previous, displayCurrencyCode)} durante ${comparison.previous.label.toLowerCase()}.`
                  : "Todavía no hay registros suficientes en el período anterior."}
              </p>
            </article>

            <article className="rounded-[24px] border border-ember/18 bg-ember/10 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-ember">Oportunidad más clara</p>
              <h4 className="mt-3 font-display text-2xl font-semibold text-ink">
                {opportunityCategory?.name ?? "Sin fuga clara todavía"}
              </h4>
              <p className="mt-2 text-sm leading-7 text-storm">
                {opportunityCategory
                  ? `Subió ${formatDeltaCurrency(opportunityCategory.delta, displayCurrencyCode)} frente a ${comparison.previous.label.toLowerCase()}. Si recortas aquí, el ahorro mejora más rápido.`
                  : "Todavía no hay diferencia clara para recomendarte un recorte específico."}
              </p>
            </article>

            <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Mejor día de ahorro</p>
                  <h4 className="mt-3 font-display text-2xl font-semibold text-ink">
                    {bestSavingsDay ? formatCurrency(bestSavingsDay.net, displayCurrencyCode) : "Sin datos"}
                  </h4>
                </div>
                {bestSavingsDay ? <StatusBadge status={bestSavingsDay.fullLabel} tone="success" /> : null}
              </div>
              <p className="mt-2 text-sm leading-7 text-storm">
                {bestSavingsDay
                  ? `Tuviste ${positiveDays} días positivos dentro del período. El más duro fue ${
                      hardestDay ? hardestDay.fullLabel.toLowerCase() : "sin suficiente historial"
                    }.`
                  : "Cuando registres ingresos y gastos aplicados, aquí verás el día que mejor defendiste tu caja."}
              </p>
            </article>
          </div>
        </SurfaceCard>
        ) : null}
      </section>
      ) : null}

      {showPortfolioSection ? (
      <section className="grid gap-6 xl:grid-cols-3">
        {isWidgetVisible("accounts_breakdown") ? (
        <SurfaceCard
          action={<GhostLink label="Ver cuentas" to="/app/accounts" />}
          description="Cuánto dinero sostiene hoy cada cuenta y cuánta actividad tuvo dentro del período."
          title="Dinero por cuenta"
        >
          {visibleAccountsBreakdown.length === 0 ? (
            <DataState
              action={<GhostLink label="Crear cuenta" to="/app/accounts" />}
              description="Tu primera cuenta abrirá automáticamente esta lectura por balance, participación y actividad."
              title="Aún no hay cuentas activas"
            />
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-3">
                {visibleAccountsBreakdown.map((item) => {
                  const isActive = selectedAccount?.account.id === item.account.id;

                  return (
                    <button
                      className={`rounded-[24px] border p-4 text-left transition ${
                        isActive
                          ? "border-pine/30 bg-pine/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={item.account.id}
                      onClick={() => setSelectedAccountId(item.account.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{item.account.name}</p>
                          <p className="mt-1 text-sm text-storm">
                            {item.account.type} · Vista {displayCurrencyCode}
                          </p>
                        </div>
                        {item.account.includeInNetWorth ? (
                          <StatusBadge status="Incluida" tone="success" />
                        ) : (
                          <StatusBadge status="Fuera de patrimonio" tone="warning" />
                        )}
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-pine to-emerald-300"
                          style={{ width: `${(item.share / maxAccountShare) * 100}%` }}
                        />
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3">
                        <p className="font-display text-2xl font-semibold text-ink">
                          {formatCurrency(item.account.currentBalance, item.account.currencyCode)}
                        </p>
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">
                          {formatPercentage(item.share)}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedAccount ? (
                <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Detalle activo</p>
                  <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
                    {selectedAccount.account.name}
                  </h4>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Saldo actual</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(
                          selectedAccount.account.currentBalance,
                          selectedAccount.account.currencyCode,
                        )}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">
                        Actividad del período
</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {selectedAccount.periodMovementCount}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-storm">
                    Ultima actividad {formatDateTime(selectedAccount.account.lastActivity)}. Esta cuenta hoy representa{" "}
                    <span className="font-semibold text-ink">
                      {formatPercentage(selectedAccount.share)}
                    </span>{" "}
                    de tu caja total visible.
                  </p>
                </article>
              ) : null}
            </div>
          )}
        </SurfaceCard>
        ) : null}

        {isWidgetVisible("receivable_leaders") ? (
        <SurfaceCard
          action={<GhostLink label="Ver créditos y deudas" to="/app/obligations" />}
          description="Quiénes concentran hoy la mayor parte de lo que te deben."
          title="Quiénes más te deben"
        >
          {visibleReceivableLeaders.length === 0 ? (
            <DataState
              action={<GhostLink label="Crear crédito" to="/app/obligations" />}
              description="Cuando registres ventas a cuotas o préstamos hechos por ti, aparecerán aquí ordenados por impacto."
              title="Todavía no tienes cuentas por cobrar"
            />
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-3">
                {visibleReceivableLeaders.map((item) => {
                  const isActive = selectedReceivable?.key === item.key;

                  return (
                    <button
                      className={`rounded-[24px] border p-4 text-left transition ${
                        isActive
                          ? "border-pine/30 bg-pine/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={item.key}
                      onClick={() => setSelectedReceivableKey(item.key)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{item.counterparty}</p>
                          <p className="mt-1 text-sm text-storm">
                            {item.obligationCount} registro{item.obligationCount === 1 ? "" : "s"} activo
                            {item.obligationCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <StatusBadge status={formatCurrency(item.amount, displayCurrencyCode)} tone="success" />
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-pine to-emerald-300"
                          style={{ width: `${(item.amount / maxReceivable) * 100}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedReceivable ? (
                <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Contacto más relevante</p>
                  <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
                    {selectedReceivable.counterparty}
                  </h4>
                  <p className="mt-3 text-sm leading-7 text-storm">
                    Te debe {formatCurrency(selectedReceivable.amount, displayCurrencyCode)} repartido en{" "}
                    {selectedReceivable.obligationCount} registro
                    {selectedReceivable.obligationCount === 1 ? "" : "s"}.
                  </p>
                  <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Que lo explica</p>
                    <ul className="mt-3 space-y-2 text-sm text-storm">
                      {selectedReceivable.titles.slice(0, 3).map((title) => (
                        <li key={title} className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2">
                          {title}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ) : null}
            </div>
          )}
        </SurfaceCard>
        ) : null}

        {isWidgetVisible("payable_leaders") ? (
        <SurfaceCard
          action={<GhostLink label="Ver créditos y deudas" to="/app/obligations" />}
          description="Quiénes concentran la mayor parte de lo que hoy tienes pendiente por pagar."
          title="A quiénes más debes"
        >
          {visiblePayableLeaders.length === 0 ? (
            <DataState
              action={<GhostLink label="Crear deuda" to="/app/obligations" />}
              description="Cuando registres compras a cuotas o préstamos recibidos, aquí verás quién pesa más sobre tu flujo."
              title="Todavía no tienes saldos por pagar"
            />
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-3">
                {visiblePayableLeaders.map((item) => {
                  const isActive = selectedPayable?.key === item.key;

                  return (
                    <button
                      className={`rounded-[24px] border p-4 text-left transition ${
                        isActive
                          ? "border-ember/28 bg-ember/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={item.key}
                      onClick={() => setSelectedPayableKey(item.key)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{item.counterparty}</p>
                          <p className="mt-1 text-sm text-storm">
                            {item.obligationCount} registro{item.obligationCount === 1 ? "" : "s"} activo
                            {item.obligationCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <StatusBadge status={formatCurrency(item.amount, displayCurrencyCode)} tone="danger" />
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-rosewood via-ember to-gold"
                          style={{ width: `${(item.amount / maxPayable) * 100}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedPayable ? (
                <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Compromiso más pesado</p>
                  <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
                    {selectedPayable.counterparty}
                  </h4>
                  <p className="mt-3 text-sm leading-7 text-storm">
                    Concentras {formatCurrency(selectedPayable.amount, displayCurrencyCode)} con este contacto.
                  </p>
                  <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Que lo compone</p>
                    <ul className="mt-3 space-y-2 text-sm text-storm">
                      {selectedPayable.titles.slice(0, 3).map((title) => (
                        <li key={title} className="rounded-[16px] border border-white/8 bg-white/[0.03] px-3 py-2">
                          {title}
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ) : null}
            </div>
          )}
        </SurfaceCard>
        ) : null}
      </section>
      ) : null}

      {showSpendingSection ? (
      <section
        className={`grid gap-6 ${
          isWidgetVisible("category_comparison") && isWidgetVisible("monthly_pulse")
            ? "xl:grid-cols-[1.1fr_0.9fr]"
            : "xl:grid-cols-1"
        }`}
      >
        {isWidgetVisible("category_comparison") ? (
        <SurfaceCard
          action={<GhostLink label="Ver categorías" to="/app/categories" />}
          description="Comparativo por categoría del período actual contra su referencia anterior. Toca una fila para abrir el detalle."
          title="Comparativo por categorías"
        >
          {visibleCategories.length === 0 ? (
            <DataState
              action={<GhostLink label="Registrar gasto" to="/app/movements" />}
              description="Cuando tengas gastos aplicados, aquí verás dónde más se fue el dinero y cómo cambia frente al comparativo."
              title="Aún no hay categorías con gasto"
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="grid gap-3">
                {visibleCategories.map((item) => {
                  const isActive = selectedCategory?.key === item.key;

                  return (
                    <button
                      className={`rounded-[24px] border p-4 text-left transition ${
                        isActive
                          ? "border-ember/30 bg-ember/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={item.key}
                      onClick={() => setSelectedCategoryKey(item.key)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{item.name}</p>
                          <p className="mt-1 text-sm text-storm">
                            {item.currentCount} movimiento{item.currentCount === 1 ? "" : "s"} este
                            período
                          </p>
                        </div>
                        <DeltaBadge currencyCode={displayCurrencyCode} inverse value={item.delta} />
                      </div>
                      <div className="mt-4 grid gap-2">
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-storm">
                          <span>{comparison.current.label}</span>
                          <span>{formatCurrency(item.current, displayCurrencyCode)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-ember to-gold"
                            style={{ width: `${(item.current / maxCategoryAmount) * 100}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.16em] text-storm">
                          <span>{comparison.previous.label}</span>
                          <span>{formatCurrency(item.previous, displayCurrencyCode)}</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-white/35"
                            style={{ width: `${(item.previous / maxCategoryAmount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedCategory ? (
                <article className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Categoría activa</p>
                  <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
                    {selectedCategory.name}
                  </h4>
                  <div className="mt-5 grid gap-3">
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">
                        Gasto del período
</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(selectedCategory.current, displayCurrencyCode)}
                      </p>
                      <p className="mt-2 text-sm text-storm">
                        {totalCurrentExpenses > 0
                          ? `${formatPercentage(selectedCategory.share)} de todo tu gasto actual.`
                          : "Todavía no representa gasto real en este período."}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Comparación</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(selectedCategory.previous, displayCurrencyCode)}
                      </p>
                      <p className="mt-2 text-sm text-storm">
                        Diferencia de {formatDeltaCurrency(selectedCategory.delta, displayCurrencyCode)} frente a{" "}
                        {comparison.previous.label.toLowerCase()}.
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-storm">
                    {selectedCategory.delta > 0
                      ? "Aquí tienes la mejor oportunidad para ahorrar más si no era un gasto intencional."
                      : selectedCategory.delta < 0
                        ? "Ya lograste bajar esta categoría frente al comparativo anterior."
                        : "Esta categoría viene prácticamente igual que en el período de referencia."}
                  </p>
                </article>
              ) : null}
            </div>
          )}
        </SurfaceCard>
        ) : null}

        {isWidgetVisible("monthly_pulse") ? (
        <SurfaceCard
          action={<CalendarDays className="h-5 w-5 text-gold" />}
          description="Pulso mensual de los ultimos seis meses para ver si tu caja viene expandiendose o comprimiendose."
          title="Pulso mensual"
        >
          {monthlyPulse.length === 0 ? (
            <DataState
              description="Aún no hay movimientos aplicados para construir tu evolución mensual."
              title="Sin historia mensual"
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-3">
                {monthlyPulse.map((item) => {
                  const isActive = selectedMonth?.key === item.key;

                  return (
                    <button
                      className={`rounded-[24px] border p-4 text-left transition ${
                        isActive
                          ? "border-gold/30 bg-gold/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={item.key}
                      onClick={() => setSelectedMonthKey(item.key)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{item.label}</p>
                          <p className="mt-1 text-sm text-storm">
                            {item.movementCount} movimiento{item.movementCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <StatusBadge
                          status={formatCurrency(item.net, displayCurrencyCode)}
                          tone={item.net >= 0 ? "success" : "danger"}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-storm">
                            <span>Entradas</span>
                            <span>{formatCurrency(item.income, displayCurrencyCode)}</span>
                          </div>
                          <div className="flex h-20 items-end rounded-[18px] bg-pine/8 p-2">
                            <div
                              className="w-full rounded-[14px] bg-pine"
                              style={{ height: `${(item.income / maxMonthlyAmount) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.16em] text-storm">
                            <span>Salidas</span>
                            <span>{formatCurrency(item.expense, displayCurrencyCode)}</span>
                          </div>
                          <div className="flex h-20 items-end rounded-[18px] bg-ember/8 p-2">
                            <div
                              className="w-full rounded-[14px] bg-ember"
                              style={{ height: `${(item.expense / maxMonthlyAmount) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedMonth ? (
                <article className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Mes seleccionado</p>
                  <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
                    {selectedMonth.label}
                  </h4>
                  <div className="mt-5 grid gap-3">
                    <div className="rounded-[20px] border border-pine/18 bg-pine/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-pine">Entradas</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(selectedMonth.income, displayCurrencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-ember/18 bg-ember/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-ember">Salidas</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(selectedMonth.expense, displayCurrencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Resultado</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(selectedMonth.net, displayCurrencyCode)}
                      </p>
                      <p className="mt-2 text-sm text-storm">
                        {selectedMonth.movementCount} movimiento
                        {selectedMonth.movementCount === 1 ? "" : "s"} aplicado
                        {selectedMonth.movementCount === 1 ? "" : "s"} en ese mes.
                      </p>
                    </div>
                  </div>
                </article>
              ) : null}
            </div>
          )}
        </SurfaceCard>
        ) : null}
      </section>
      ) : null}

      {showBudgetSection ? (
      <section className="grid gap-6 xl:grid-cols-1">
        <SurfaceCard
          action={<GhostLink label="Ver presupuestos" to="/app/budgets" />}
          description="Topes activos del período actual para ver rápido cuánto espacio te queda y dónde ya se está tensando el gasto."
          title="Presupuestos del período"
        >
          {activeCurrentBudgets.length === 0 ? (
            <DataState
              action={<GhostLink label="Crear presupuesto" to="/app/budgets" />}
              description="Puedes fijar límites generales, por categoría, por cuenta o cruzando ambas para que el dashboard te avise cuando se acerquen al borde."
              title="Aún no hay presupuestos vigentes"
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Techo activo</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {formatCurrency(currentBudgetLimitTotal, displayCurrencyCode)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-ember/18 bg-ember/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-ember">Consumido</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {formatCurrency(currentBudgetSpentTotal, displayCurrencyCode)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-pine">Restante</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {formatCurrency(currentBudgetRemainingTotal, displayCurrencyCode)}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-gold/18 bg-gold/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gold">En riesgo</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {criticalCurrentBudgets.length}
                    </p>
                    <p className="mt-2 text-sm text-storm">
                      {overLimitCurrentBudgets.length} excedidos ahora.
                    </p>
                  </div>
                </div>

                <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Lectura rápida</p>
                  <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
                    {criticalCurrentBudgets.length > 0
                      ? `${criticalCurrentBudgets.length} presupuesto${criticalCurrentBudgets.length === 1 ? "" : "s"} pide${criticalCurrentBudgets.length === 1 ? "" : "n"} atención`
                      : "Tus topes vienen sanos por ahora"}
                  </h4>
                  <p className="mt-3 text-sm leading-7 text-storm">
                    {criticalCurrentBudgets.length > 0
                      ? `Ya tienes ${overLimitCurrentBudgets.length} por encima del límite y ${criticalCurrentBudgets.length - overLimitCurrentBudgets.length} entrando en zona de alerta.`
                      : "Todavía tienes aire dentro del plan de gasto activo del período."}
                  </p>
                </article>
              </div>

              <div className="grid gap-3">
                {budgetLeaders.map((budget) => (
                  <article
                    className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4"
                    key={budget.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-ink">{budget.name}</p>
                        <p className="mt-1 text-sm text-storm">{budget.scopeLabel}</p>
                      </div>
                      <StatusBadge
                        status={
                          budget.isOverLimit
                            ? "Excedido"
                            : budget.isNearLimit
                              ? "En alerta"
                              : "Saludable"
                        }
                        tone={
                          budget.isOverLimit
                            ? "danger"
                            : budget.isNearLimit
                              ? "warning"
                              : "success"
                        }
                      />
                    </div>
                    <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
                      <div
                        className={`h-full rounded-full ${
                          budget.isOverLimit
                            ? "bg-gradient-to-r from-ember to-[#ff9e6a]"
                            : budget.isNearLimit
                              ? "bg-gradient-to-r from-gold to-[#ffd18b]"
                              : "bg-gradient-to-r from-pine to-emerald-300"
                        }`}
                        style={{ width: `${Math.min(Math.max(budget.usedPercent, 4), 100)}%` }}
                      />
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Limite</p>
                        <p className="mt-2 font-semibold text-ink">
                          {formatCurrency(budget.limitAmount, displayCurrencyCode)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Consumido</p>
                        <p className="mt-2 font-semibold text-ink">
                          {formatCurrency(budget.spentAmount, displayCurrencyCode)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Restante</p>
                        <p className="mt-2 font-semibold text-ink">
                          {formatCurrency(budget.remainingAmount, displayCurrencyCode)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Cierre proyectado</p>
                          <p className="mt-2 font-semibold text-ink">
                            {formatCurrency(budget.projectedSpend, displayCurrencyCode)}
                          </p>
                        </div>
                        <StatusBadge
                          status={
                            budget.projectedDelta > 0
                              ? `+${formatCurrency(budget.projectedDelta, displayCurrencyCode)}`
                              : "Dentro del techo"
                          }
                          tone={budget.projectedDelta > 0 ? "warning" : "success"}
                        />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </SurfaceCard>
      </section>
      ) : null}

      {showTimingSection ? (
      <section
        className={`grid gap-6 ${
          isWidgetVisible("weekly_pattern") && isWidgetVisible("upcoming_recent")
            ? "xl:grid-cols-[0.9fr_1.1fr]"
            : "xl:grid-cols-1"
        }`}
      >
        {isWidgetVisible("weekly_pattern") ? (
        <SurfaceCard
          action={<GhostLink label="Ver movimientos" to="/app/movements" />}
          description="Qué días de la semana suelen darte aire y cuáles suelen presionarte más."
          title="Ritmo semanal"
        >
          {weekdayPattern.every((item) => item.movementCount === 0) ? (
            <DataState
              description="Con algunos movimientos aplicados ya se puede detectar qué días concentran ingresos o gasto."
              title="Sin patrón semanal todavía"
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-3">
                {weekdayPattern.map((item) => {
                  const isActive = selectedWeekday?.key === item.key;

                  return (
                    <button
                      className={`rounded-[22px] border p-4 text-left transition ${
                        isActive
                          ? "border-pine/30 bg-pine/10"
                          : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={item.key}
                      onClick={() => setSelectedWeekdayKey(item.key)}
                      type="button"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{item.label}</p>
                          <p className="mt-1 text-sm text-storm">
                            {item.movementCount} movimiento{item.movementCount === 1 ? "" : "s"}
                          </p>
                        </div>
                        <StatusBadge
                          status={formatCurrency(item.net, displayCurrencyCode)}
                          tone={item.net >= 0 ? "success" : "danger"}
                        />
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="h-2 rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-pine"
                            style={{ width: `${(item.income / maxWeekdayAmount) * 100}%` }}
                          />
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-ember"
                            style={{ width: `${(item.expense / maxWeekdayAmount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedWeekday ? (
                <article className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Dia activo</p>
                  <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
                    {selectedWeekday.label}
                  </h4>
                  <div className="mt-5 grid gap-3">
                    <div className="rounded-[20px] border border-pine/18 bg-pine/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-pine">Entradas</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(selectedWeekday.income, displayCurrencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-ember/18 bg-ember/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-ember">Salidas</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(selectedWeekday.expense, displayCurrencyCode)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-storm">
                    {selectedWeekday.net >= 0
                      ? "Suele ser un dia que te deja aire positivo."
                      : "Suele ser un dia que aprieta tu caja. Si quieres ahorrar mas, revisa que pasa aqui."}
                  </p>
                </article>
              ) : null}
            </div>
          )}
        </SurfaceCard>
        ) : null}

        {isWidgetVisible("upcoming_recent") ? (
        <SurfaceCard
          action={<GhostLink label="Ver suscripciones" to="/app/subscriptions" />}
          description="Compromisos cercanos y movimientos recientes que explican por dónde viene el flujo."
          title="Lo que viene y lo que movió tu período"
        >
          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-storm">Próximos 30 días</p>
              {upcomingCommitments.length === 0 ? (
                <DataState
                  description="No hay cuotas ni suscripciones venciendo en las próximas cuatro semanas."
                  title="Sin compromisos inmediatos"
                  tone="success"
                />
              ) : (
                <div className="mt-4 grid gap-3">
                  {upcomingCommitments.map((item) => (
                    <article
                      className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                      key={item.key}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{item.title}</p>
                          <p className="mt-1 text-sm text-storm">
                            {item.kind} - {item.counterpart}
                          </p>
                        </div>
                        <StatusBadge
                          status={formatDate(item.date)}
                          tone={item.kind === "Por cobrar" ? "success" : "warning"}
                        />
                      </div>
                      <p className="mt-4 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(item.amount, displayCurrencyCode)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-storm">Últimos movimientos aplicados</p>
              {currentPeriodMovements.length === 0 ? (
                <DataState
                  description="Aún no tienes movimientos aplicados en el período seleccionado."
                  title="Nada explica este corte todavía"
                />
              ) : (
                <div className="mt-4 grid gap-3">
                  {currentPeriodMovements.slice(0, 6).map((movement) => {
                    const classified = classifyMovement(movement);
                    const amount =
                      classified?.kind === "income"
                        ? getIncomeAmount(movement)
                        : classified?.kind === "expense"
                          ? getExpenseAmount(movement)
                          : 0;

                    return (
                      <article
                        className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                        key={movement.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{movement.description}</p>
                            <p className="mt-1 text-sm text-storm">
                              {movement.category} - {movement.counterparty}
                            </p>
                          </div>
                          <StatusBadge
                            status={
                              movement.movementType === "income" || movement.movementType === "refund"
                                ? "Ingreso"
                                : movement.movementType === "transfer"
                                  ? "Transferencia"
                                  : "Salida"
                            }
                            tone={
                              movement.movementType === "income" || movement.movementType === "refund"
                                ? "success"
                                : "warning"
                            }
                          />
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <p className="font-display text-2xl font-semibold text-ink">
                            {formatCurrency(amount, displayCurrencyCode)}
                          </p>
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">
                            {formatDateTime(movement.occurredAt)}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </SurfaceCard>
        ) : null}
      </section>
      ) : null}

      {showAdvancedOpsSection ? (
        <>
          {(isWidgetVisible("obligation_watch") || isWidgetVisible("future_flow")) ? (
            <section
              className={`grid gap-6 ${
                isWidgetVisible("obligation_watch") && isWidgetVisible("future_flow")
                  ? "xl:grid-cols-[1.05fr_0.95fr]"
                  : "xl:grid-cols-1"
              }`}
            >
              {isWidgetVisible("obligation_watch") ? (
                <SurfaceCard
                  action={<GhostLink label="Ver creditos y deudas" to="/app/obligations" />}
                  description="Vista operativa de tu cartera para distinguir lo que esta al dia, por vencer o ya vencido."
                  title="Estado de creditos y deudas"
                >
                  {displayObligations.length === 0 ? (
                    <DataState
                      action={<GhostLink label="Crear registro" to="/app/obligations" />}
                      description="Cuando registres créditos o deudas, aquí verás envejecimiento, pagos del período y presión por vencimiento."
                      title="Sin cartera todavía"
                    />
                  ) : (
                    <div className="grid gap-5">
                      <div className="grid gap-3 sm:grid-cols-4">
                        <div className="rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-pine">Por vencer</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(
                              obligationAgingBuckets.find((item) => item.key === "due_soon")?.amount ?? 0,
                              displayCurrencyCode,
                            )}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-ember/18 bg-ember/10 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-ember">Vencido</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(overdueAmount, displayCurrencyCode)}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Cobrado este corte</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(collectedThisPeriod, displayCurrencyCode)}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Pagado este corte</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(paidThisPeriod, displayCurrencyCode)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {obligationAgingBuckets.map((bucket) => (
                          <article
                            className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                            key={bucket.key}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-sm font-semibold text-ink">{bucket.label}</p>
                              <StatusBadge status={`${bucket.count}`} tone={bucket.tone} />
                            </div>
                            <p className="mt-3 font-display text-2xl font-semibold text-ink">
                              {formatCurrency(bucket.amount, displayCurrencyCode)}
                            </p>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </SurfaceCard>
              ) : null}

              {isWidgetVisible("future_flow") ? (
                <SurfaceCard
                  action={<StatusBadge status="7, 15 y 30 días" tone="info" />}
                  description="Una mirada más explícita al dinero que probablemente entrará o saldrá según compromisos y registros programados."
                  title="Proyección de flujo futuro"
                >
                  <div className="grid gap-4">
                    {futureFlowWindows.map((window) => (
                      <article
                        className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
                        key={window.days}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase tracking-[0.18em] text-storm">
                              Próximos {window.days} días
                            </p>
                            <p className="mt-3 font-display text-3xl font-semibold text-ink">
                              {formatCurrency(window.estimatedBalance, displayCurrencyCode)}
                            </p>
                            <p className="mt-2 text-sm text-storm">Saldo estimado despues de compromisos.</p>
                          </div>
                          <StatusBadge
                            status={`${window.receivableCount} por cobrar / ${window.payableCount} por pagar`}
                            tone={window.expectedOutflow > window.expectedInflow ? "warning" : "success"}
                          />
                        </div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-[20px] border border-pine/18 bg-pine/10 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-pine">Ingresos esperados</p>
                            <p className="mt-3 font-display text-2xl font-semibold text-ink">
                              {formatCurrency(window.expectedInflow, displayCurrencyCode)}
                            </p>
                          </div>
                          <div className="rounded-[20px] border border-ember/18 bg-ember/10 p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-ember">Pagos esperados</p>
                            <p className="mt-3 font-display text-2xl font-semibold text-ink">
                              {formatCurrency(window.expectedOutflow, displayCurrencyCode)}
                            </p>
                          </div>
                          <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                            <p className="text-xs uppercase tracking-[0.18em] text-storm">Programados</p>
                            <p className="mt-3 font-display text-2xl font-semibold text-ink">
                              {window.scheduledCount}
                            </p>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </SurfaceCard>
              ) : null}
            </section>
          ) : null}

          {(isWidgetVisible("alert_center") || isWidgetVisible("data_quality")) ? (
            <section
              className={`grid gap-6 ${
                isWidgetVisible("alert_center") && isWidgetVisible("data_quality")
                  ? "xl:grid-cols-[1.05fr_0.95fr]"
                  : "xl:grid-cols-1"
              }`}
            >
              {isWidgetVisible("alert_center") ? (
                <SurfaceCard
                  action={<StatusBadge status={`${anomalyAlerts.length} alertas`} tone={anomalyAlerts.length > 0 ? "warning" : "success"} />}
                  description="Alertas concretas para que el dashboard te diga donde mirar primero sin tener que interpretar todo el panel."
                  title="Alertas y anomalías"
                >
                  {anomalyAlerts.length === 0 ? (
                    <DataState
                      description="Por ahora no detectamos señales llamativas fuera de presupuesto, vencimientos o ritmo reciente."
                      title="Sin alertas fuertes"
                      tone="success"
                    />
                  ) : (
                    <div className="grid gap-3">
                      {anomalyAlerts.map((alert) => (
                        <article
                          className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                          key={alert.key}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-ink">{alert.title}</p>
                              <p className="mt-2 text-sm leading-7 text-storm">{alert.description}</p>
                            </div>
                            <StatusBadge
                              status={
                                alert.tone === "danger"
                                  ? "Alerta"
                                  : alert.tone === "warning"
                                    ? "Atención"
                                    : "Info"
                              }
                              tone={alert.tone as "danger" | "warning" | "info"}
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </SurfaceCard>
              ) : null}

              {isWidgetVisible("data_quality") ? (
                <SurfaceCard
                  action={<StatusBadge status={`${qualityIssuesTotal} pendientes`} tone={qualityIssuesTotal > 0 ? "warning" : "success"} />}
                  description="Revisá qué tan completos están tus datos para que comparativos, proyecciones y reportes sean confiables."
                  title="Calidad de datos"
                >
                  <div className="grid gap-3">
                    {qualityItems.map((item) => (
                      <article
                        className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                        key={item.key}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{item.label}</p>
                            <p className="mt-2 text-sm leading-7 text-storm">{item.helper}</p>
                          </div>
                          <StatusBadge status={`${item.value}`} tone={item.value > 0 ? item.tone : "success"} />
                        </div>
                      </article>
                    ))}
                  </div>
                </SurfaceCard>
              ) : null}
            </section>
          ) : null}

          {(isWidgetVisible("subscriptions_snapshot") ||
            isWidgetVisible("transfer_snapshot") ||
            isWidgetVisible("currency_exposure")) ? (
            <section className="grid gap-6 xl:grid-cols-3">
              {isWidgetVisible("subscriptions_snapshot") ? (
                <SurfaceCard
                  action={<GhostLink label="Ver suscripciones" to="/app/subscriptions" />}
                  description="Lectura recurrente para saber cuánto pesan tus cargos fijos y cuál es el siguiente en caer."
                  title="Pulso de suscripciones"
                >
                  {visibleSubscriptionHighlights.length === 0 ? (
                    <DataState
                      action={<GhostLink label="Crear suscripción" to="/app/subscriptions" />}
                      description="Cuando registres cargos recurrentes, aquí verás costo mensual, próximos cobros y las más caras."
                      title="Sin suscripciones activas"
                    />
                  ) : (
                    <div className="grid gap-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-pine">Costo mensual</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(monthlyRecurringCost, displayCurrencyCode)}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Activas / pausadas</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {activeSubscriptions.length} / {pausedSubscriptions.length}
                          </p>
                        </div>
                      </div>

                      {nextSubscriptionDue ? (
                        <article className="rounded-[22px] border border-gold/18 bg-gold/10 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-gold">Próxima suscripción</p>
                          <p className="mt-3 font-semibold text-ink">{nextSubscriptionDue.name}</p>
                          <p className="mt-1 text-sm text-storm">
                            {nextSubscriptionDue.vendor} · {formatDate(nextSubscriptionDue.nextDueDate)}
                          </p>
                        </article>
                      ) : null}

                      <div className="grid gap-3">
                        {visibleSubscriptionHighlights.map((item) => (
                          <article
                            className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4"
                            key={item.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-ink">{item.name}</p>
                                <p className="mt-1 text-sm text-storm">
                                  {item.vendor} · {item.categoryName ?? "Sin categoría"}
                                </p>
                              </div>
                              <StatusBadge status={formatCurrency(item.monthlyAmount, displayCurrencyCode)} tone="warning" />
                            </div>
                          </article>
                        ))}
                      </div>
                    </div>
                  )}
                </SurfaceCard>
              ) : null}

              {isWidgetVisible("transfer_snapshot") ? (
                <SurfaceCard
                  action={<GhostLink label="Ver movimientos" to="/app/movements" />}
                  description="Muestra como se esta moviendo el dinero entre tus cuentas dentro del corte actual."
                  title="Transferencias internas"
                >
                  {visibleTransferRoutes.length === 0 ? (
                    <DataState
                      description="Todavía no hay transferencias aplicadas en el período seleccionado."
                      title="Sin flujo interno"
                    />
                  ) : (
                    <div className="grid gap-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Transferido</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(totalTransferredThisPeriod, displayCurrencyCode)}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Cantidad</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {currentPeriodTransfers.length}
                          </p>
                        </div>
                      </div>

                      {topTransferRoute ? (
                        <article className="rounded-[22px] border border-ember/18 bg-ember/10 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-ember">Ruta dominante</p>
                          <p className="mt-3 font-semibold text-ink">{topTransferRoute.label}</p>
                          <p className="mt-1 text-sm text-storm">
                            {topTransferRoute.count} transferencia{topTransferRoute.count === 1 ? "" : "s"} por {formatCurrency(topTransferRoute.amount, displayCurrencyCode)}.
                          </p>
                        </article>
                      ) : null}

                      <div className="grid gap-3">
                        {visibleTransferRoutes.map((route) => (
                          <button
                            className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-white/16 hover:bg-white/[0.05]"
                            key={route.key}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-semibold text-ink">{route.label}</p>
                                <p className="mt-1 text-sm text-storm">{route.count} movimientos internos</p>
                              </div>
                              <StatusBadge status={formatCurrency(route.amount, displayCurrencyCode)} tone="info" />
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </SurfaceCard>
              ) : null}

              {isWidgetVisible("currency_exposure") ? (
                <SurfaceCard
                  action={<StatusBadge status={`Vista ${displayCurrencyCode}`} tone="neutral" />}
                  description="Cuánto de tu dinero en cuentas queda expuesto a cada moneda antes de consolidarlo en la vista global."
                  title="Exposición por moneda"
                >
                  {currencyExposure.length === 0 ? (
                    <DataState
                      description="Aún no hay cuentas activas para calcular la exposición cambiaria."
                      title="Sin exposición visible"
                    />
                  ) : (
                    <div className="grid gap-4">
                      {currencyExposure.map((item) => (
                        <article
                          className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                          key={item.currencyCode}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-ink">{item.currencyCode}</p>
                              <p className="mt-1 text-sm text-storm">
                                {item.accountCount} cuenta{item.accountCount === 1 ? "" : "s"} asociada{item.accountCount === 1 ? "" : "s"}
                              </p>
                            </div>
                            <StatusBadge status={formatCurrency(item.amount, displayCurrencyCode)} tone="success" />
                          </div>
                          <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-pine to-emerald-300"
                              style={{ width: `${(item.amount / maxCurrencyExposure) * 100}%` }}
                            />
                          </div>
                          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-storm">
                            {formatPercentage(item.share)} del total visible
                          </p>
                        </article>
                      ))}
                    </div>
                  )}
                </SurfaceCard>
              ) : null}
            </section>
          ) : null}

          {isWidgetVisible("learning_panel") ? (
            <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <SurfaceCard
                action={
                  <StatusBadge
                    status={
                      learningSnapshot.currentPhase > 0
                        ? `Fase ${learningSnapshot.currentPhase} activa`
                        : "Aún aprendiendo"
                    }
                    tone={
                      learningSnapshot.currentPhase >= 4
                        ? "success"
                        : learningSnapshot.currentPhase >= 2
                          ? "info"
                          : "warning"
                    }
                  />
                }
                description="DarkMoney analiza tu historial para ir de lecturas básicas a patrones, proyecciones y alertas inteligentes."
                title="Aprendiendo de ti"
              >
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Movimientos utiles</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {learningSnapshot.totalPostedMovements}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Historial</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {learningSnapshot.historyDays} dias
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Calidad de categorias</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatPercentage(learningSnapshot.categorizedRate)}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-pine">Confianza actual</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {learningSnapshot.readinessScore}%
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 xl:grid-cols-2">
                    {learningSnapshot.phases.map((phase) => (
                      <article
                        className={`rounded-[22px] border p-4 ${
                          phase.unlocked
                            ? "border-pine/18 bg-pine/10"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                        key={phase.step}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{phase.title}</p>
                            <p className="mt-2 text-sm leading-7 text-storm">{phase.description}</p>
                          </div>
                          <StatusBadge
                            status={phase.unlocked ? "Activa" : `${Math.round(phase.progress * 100)}%`}
                            tone={phase.unlocked ? "success" : "neutral"}
                          />
                        </div>
                        <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
                          <div
                            className={`h-full rounded-full ${
                              phase.unlocked ? "bg-gradient-to-r from-pine to-emerald-300" : "bg-white/20"
                            }`}
                            style={{ width: `${Math.max(6, phase.progress * 100)}%` }}
                          />
                        </div>
                        <div className="mt-4 grid gap-2">
                          {phase.remainingRequirements.length === 0 ? (
                            <p className="text-sm text-storm">Lista para generar señales de este nivel.</p>
                          ) : (
                            phase.remainingRequirements.slice(0, 2).map((item) => (
                              <p className="text-sm text-storm" key={item}>
                                - {item}
                              </p>
                            ))
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </SurfaceCard>

              <SurfaceCard
                action={
                  <StatusBadge
                    status={
                      learningSnapshot.currentPhase >= 3
                        ? "Proyecciones activas"
                        : learningSnapshot.currentPhase >= 1
                          ? "Patrones activos"
                          : "Esperando data"
                    }
                    tone={
                      learningSnapshot.currentPhase >= 3
                        ? "success"
                        : learningSnapshot.currentPhase >= 1
                          ? "info"
                          : "warning"
                    }
                  />
                }
                description="Lo que DarkMoney ya puede inferir sobre tus hábitos y lo que falta para detectar patrones más precisos."
                title="Señales activas"
              >
                <div className="grid gap-4">
                  {learningSnapshot.insights.length === 0 ? (
                    <DataState
                      description="Todavía no hay suficiente historial aplicado para detectar patrones con criterio."
                      title="Aún no hay insights"
                    />
                  ) : (
                    <div className="grid gap-3">
                      {learningSnapshot.insights.map((insight) => (
                        <article
                          className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                          key={`${insight.title}-${insight.description}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-ink">{insight.title}</p>
                              <p className="mt-2 text-sm leading-7 text-storm">{insight.description}</p>
                            </div>
                            <StatusBadge
                              status={
                                insight.tone === "success"
                                  ? "Buena señal"
                                  : insight.tone === "danger"
                                    ? "Alerta"
                                    : insight.tone === "warning"
                                      ? "Atención"
                                      : "Insight"
                              }
                              tone={insight.tone}
                            />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}

                  <article className="rounded-[22px] border border-gold/18 bg-gold/10 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-gold">Para subir de fase</p>
                    <div className="mt-3 grid gap-2">
                      {learningSnapshot.pendingActions.map((item) => (
                        <p className="text-sm leading-7 text-storm" key={item}>
                          - {item}
                        </p>
                      ))}
                    </div>
                  </article>
                </div>
              </SurfaceCard>
            </section>
          ) : null}

          {isWidgetVisible("workspace_collaboration") ? (
            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <SurfaceCard
                action={<StatusBadge status={`Workspace ${formatWorkspaceKindLabel(activeWorkspace.kind)}`} tone="info" />}
                description="Lectura del workspace activo y de la colaboración reciente para saber cuánto movimiento humano hubo en este entorno."
                title="Colaboración del workspace"
              >
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Tu rol</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatWorkspaceRoleLabel(activeWorkspace.role)}
                      </p>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Personales</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{personalWorkspaceCount}</p>
                    </div>
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Compartidos</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{sharedWorkspaceCount}</p>
                    </div>
                    <div className="rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-pine">Actividad del corte</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{collaborationActivity.length}</p>
                    </div>
                  </div>

                  <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Lectura rápida</p>
                    <p className="mt-3 text-sm leading-7 text-storm">
                      {activeWorkspace.kind === "shared"
                        ? "Este panel ya está leyendo un workspace compartido. Aquí conviene vigilar más la actividad y los cambios recientes del equipo."
                        : "Estás viendo un workspace personal. Si luego cambias a uno compartido, aquí verás más foco en colaboración y actividad por actor."}
                    </p>
                  </article>
                </div>
              </SurfaceCard>

              <SurfaceCard
                action={<StatusBadge status={`${actorActivity.length} actores visibles`} tone="neutral" />}
                description="Quiénes movieron más actividad en el período actual dentro del workspace activo."
                title="Actividad por actor"
              >
                {actorActivity.length === 0 ? (
                  <DataState
                    description="Todavía no hay suficiente actividad registrada en este corte para construir un ranking."
                    title="Sin huella colaborativa reciente"
                  />
                ) : (
                  <div className="grid gap-3">
                    {actorActivity.map((item) => (
                      <article
                        className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                        key={item.actor}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-semibold text-ink">{item.actor}</p>
                            <p className="mt-2 text-sm text-storm">Interacciones registradas en el período actual.</p>
                          </div>
                          <StatusBadge status={`${item.count}`} tone="info" />
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </SurfaceCard>
            </section>
          ) : null}

          {(isWidgetVisible("health_center") || isWidgetVisible("activity_timeline")) ? (
            <section
              className={`grid gap-6 ${
                isWidgetVisible("health_center") && isWidgetVisible("activity_timeline")
                  ? "xl:grid-cols-[0.95fr_1.05fr]"
                  : "xl:grid-cols-1"
              }`}
            >
              {isWidgetVisible("health_center") ? (
                <SurfaceCard
                  action={<StatusBadge status={healthSnapshot.title} tone={healthSnapshot.tone} />}
                  description="Lectura rápida de liquidez, ahorro y presión financiera usando lo que ya pasó y lo que viene."
                  title="Centro de salud financiera"
                >
                  <div className="grid gap-4">
                    <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-sm leading-7 text-storm">{healthSnapshot.description}</p>
                    </article>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Liquidez real</p>
                        <p className="mt-3 font-display text-2xl font-semibold text-ink">
                          {formatCurrency(healthSnapshot.realFreeMoney, displayCurrencyCode)}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Capacidad de ahorro</p>
                        <p className="mt-3 font-display text-2xl font-semibold text-ink">
                          {formatPercentage(Math.max(0, savingsCapacity))}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Cobertura mensual</p>
                        <p className="mt-3 font-display text-2xl font-semibold text-ink">
                          {healthSnapshot.coverageMonths !== null ? `${healthSnapshot.coverageMonths.toFixed(1)} meses` : "Sin dato"}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Deuda / ingreso</p>
                        <p className="mt-3 font-display text-2xl font-semibold text-ink">
                          {healthSnapshot.debtToIncomeRatio !== null ? `${(healthSnapshot.debtToIncomeRatio * 100).toFixed(0)}%` : "Sin dato"}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <article className="rounded-[22px] border border-gold/18 bg-gold/10 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-gold">Lo próximo a pagar</p>
                        <p className="mt-3 font-semibold text-ink">
                          {nextPayableDue ? nextPayableDue.title : "Sin deuda próxima"}
                        </p>
                        <p className="mt-1 text-sm text-storm">
                          {nextPayableDue
                            ? `${formatCurrency(nextPayableDue.pendingAmount, displayCurrencyCode)} · ${formatDate(nextPayableDue.dueDate as string)}`
                            : "No hay compromisos por pagar cercanos."}
                        </p>
                      </article>
                      <article className="rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-pine">Lo próximo a cobrar</p>
                        <p className="mt-3 font-semibold text-ink">
                          {nextReceivableDue ? nextReceivableDue.title : "Sin cobro próximo"}
                        </p>
                        <p className="mt-1 text-sm text-storm">
                          {nextReceivableDue
                            ? `${formatCurrency(nextReceivableDue.pendingAmount, displayCurrencyCode)} · ${formatDate(nextReceivableDue.dueDate as string)}`
                            : "No hay cuentas por cobrar con fecha cercana."}
                        </p>
                      </article>
                    </div>
                  </div>
                </SurfaceCard>
              ) : null}

              {isWidgetVisible("activity_timeline") ? (
                <SurfaceCard
                  action={<GhostLink label="Ver notificaciones" to="/app/notifications" />}
                  description="Historial del workspace para ver que se movio recientemente en cuentas, movimientos y compromisos."
                  title="Actividad reciente"
                >
                  {snapshot.activity.length === 0 ? (
                    <DataState
                      description="Cuando registres movimientos o hagas cambios en el workspace, aquí verás las acciones más recientes."
                      title="Sin actividad todavía"
                    />
                  ) : (
                    <div className="grid gap-3">
                      {snapshot.activity.slice(0, 8).map((item) => (
                        <article
                          className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                          key={item.id}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-ink">{item.description}</p>
                              <p className="mt-1 text-sm text-storm">
                                {item.actor} · {item.entity} · {item.action}
                              </p>
                            </div>
                            <StatusBadge status={formatDateTime(item.createdAt)} tone="neutral" />
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </SurfaceCard>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
