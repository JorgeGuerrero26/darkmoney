import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronRight,
  RefreshCw,
  Sparkles,
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
  useUpsertWorkspaceFinancialGoalMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import type {
  AccountSummary,
  ExchangeRateSummary,
  MovementRecord,
  ObligationSummary,
  RecurringIncomeSummary,
  SubscriptionSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import {
  DashboardHelpProvider,
  DashboardHelpTrigger,
  DashboardKpiHelpWrap,
} from "../components/dashboard-metric-help";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  buildMonthEndEstimate,
  buildPrimaryRecommendation,
  buildSuggestedProActions,
  buildUnusualSpendingLines,
  countDistinctPostingDaysThisMonth,
  countDuplicateMovementGroups,
  countObligationsWithoutRecentActivity,
  countSubscriptionsNeedingAttention,
  findIdleSubscriptionName,
  movementNeedsReviewMetadata,
} from "../lib/pro-dashboard-features";
import { readMonthlySavingsTarget, writeMonthlySavingsTarget } from "../lib/pro-goal-storage";

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
  | "activity_timeline"
  | "pro_command_center"
  | "pro_intelligence_digest"
  | "pro_goals_strip"
  | "review_inbox";

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
/** Lunes–domingo; índice = (date.getDay() + 6) % 7 (lunes = 0). */
const weekdayLabelsFull = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
/** Abreviaturas para ejes de gráficos con pocos puntos. */
const weekdayLabelsShort = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
const DASHBOARD_CURRENCY_STORAGE_KEY = "darkmoney.dashboard.displayCurrency";
const DASHBOARD_MODE_STORAGE_KEY = "darkmoney.dashboard.mode";
const DASHBOARD_HIDDEN_WIDGETS_STORAGE_KEY = "darkmoney.dashboard.hiddenWidgets";
/** Ancla para scroll desde el resumen (meta vacía / editar meta) al widget Meta y disciplina. */
const DASHBOARD_META_DISCIPLINA_ANCHOR_ID = "dashboard-widget-meta-disciplina";

const dashboardModeOptions: Array<{ value: DashboardMode; label: string; helper: string }> = [
  { value: "simple", label: "Vista simple", helper: "solo lo esencial" },
  { value: "advanced", label: "Vista avanzada", helper: "más análisis" },
];

const dashboardWidgetDefinitions: DashboardWidgetDefinition[] = [
  {
    id: "review_inbox",
    label: "Por revisar",
    helper: "cola de mantenimiento: categorías, duplicados, suscripciones y cartera",
    modes: ["simple", "advanced"],
  },
  { id: "overview_kpis", label: "Resumen principal", helper: "KPIs, cierre estimado del mes y meta visible", modes: ["simple", "advanced"] },
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
  {
    id: "data_quality",
    label: "Calidad del dato",
    helper: "métricas de limpieza; la bandeja “Por revisar” concentra acciones",
    modes: ["advanced"],
  },
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
  {
    id: "pro_command_center",
    label: "Acciones y foco",
    helper: "qué hacer hoy, presión 7 días, cierre de mes y una recomendación",
    modes: ["advanced"],
  },
  {
    id: "pro_intelligence_digest",
    label: "Insights del período",
    helper: "señales, gasto fuera de patrón y cola de revisión",
    modes: ["advanced"],
  },
  {
    id: "pro_goals_strip",
    label: "Meta mensual y disciplina",
    helper: "editar meta de ahorro (sync) y racha de registro",
    modes: ["advanced"],
  },
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
          ? weekdayLabelsShort[(currentDate.getDay() + 6) % 7]
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
          ? weekdayLabelsShort[(currentDate.getDay() + 6) % 7]
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
  const weekdays = weekdayLabelsFull.map(
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
  recurringIncome: RecurringIncomeSummary[],
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

  const recurringIncomeItems = recurringIncome
    .filter((income) => {
      const expectedDate = new Date(income.nextExpectedDate);
      return expectedDate >= today && expectedDate <= limit && income.status === "active";
    })
    .map((income) => ({
      key: `recurring-income-${income.id}`,
      kind: "Ingreso fijo",
      title: income.name,
      counterpart: income.payer,
      amount: income.amountInBaseCurrency ?? income.amount,
      date: income.nextExpectedDate,
    }));

  return [...obligationItems, ...subscriptionItems, ...recurringIncomeItems].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
  );
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
    const weekdayLabel = weekdayLabelsFull[(topWeekdayEntry[0] + 6) % 7];
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

function formatVsPreviousPeriodLabel(current: number, previous: number, previousPeriodLabel: string) {
  if (previous === 0) {
    return current === 0 ? `Sin cambio vs ${previousPeriodLabel}` : `Sin referencia en ${previousPeriodLabel}`;
  }

  const deltaPct = ((current - previous) / previous) * 100;
  const arrow = deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "→";
  const prefix = deltaPct > 0 ? "+" : deltaPct < 0 ? "−" : "";
  const abs = Math.round(Math.abs(deltaPct));
  return `${arrow} ${prefix}${abs}% vs ${previousPeriodLabel}`;
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
  const upsertFinancialGoalMutation = useUpsertWorkspaceFinancialGoalMutation();
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
  const [proMonthlyGoal, setProMonthlyGoal] = useState<number | null>(null);
  const [proGoalDraft, setProGoalDraft] = useState("");
  const [proGoalSaveError, setProGoalSaveError] = useState<string | null>(null);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [activeAccountTypeFilter, setActiveAccountTypeFilter] = useState<string | null>(null);
  const [activeAccountIdFilter, setActiveAccountIdFilter] = useState<number | null>(null);
  const [activeObligationStatusFilter, setActiveObligationStatusFilter] = useState<string | null>(null);
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

  useEffect(() => {
    const snap = snapshotQuery.data;
    if (!snap?.workspace?.id) {
      return;
    }

    const workspaceId = snap.workspace.id;
    const fromServer = snap.financialGoal?.monthlySavingsTarget ?? null;
    const stored = readMonthlySavingsTarget(workspaceId);
    const resolved = fromServer ?? stored;
    setProMonthlyGoal(resolved);
    setProGoalDraft(resolved !== null ? String(resolved) : "");
  }, [snapshotQuery.data?.workspace?.id, snapshotQuery.data?.financialGoal?.monthlySavingsTarget]);

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

  const scrollToMetaDisciplinaWidget = useCallback(() => {
    if (!canUseAdvancedDashboard) {
      return;
    }
    const run = () => {
      document.getElementById(DASHBOARD_META_DISCIPLINA_ANCHOR_ID)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };
    if (effectiveDashboardMode !== "advanced") {
      setDashboardMode("advanced");
      window.setTimeout(run, 180);
    } else {
      run();
    }
  }, [canUseAdvancedDashboard, effectiveDashboardMode]);

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
  const displayRecurringIncome = (snapshot.recurringIncome ?? []).map((income) => {
    const convertedAmount = convertDashboardAmount({
      amount: income.amount,
      currencyCode: income.currencyCode,
      amountInBaseCurrency: income.amountInBaseCurrency,
      baseCurrencyCode,
      targetCurrencyCode: displayCurrencyCode,
      exchangeRateMap,
    });

    return {
      ...income,
      currencyCode: displayCurrencyCode,
      amount: convertedAmount ?? income.amount,
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
  const categoryWithLargestExpenseIncrease =
    [...visibleCategories].sort((a, b) => b.delta - a.delta).find((item) => item.delta > 0) ?? null;
  const accountsBreakdown = buildAccountBreakdown(visibleAccounts, currentPeriodMovements);
  const visibleAccountsBreakdown = accountsBreakdown.slice(0, topCount);
  const receivableLeaders = buildExposureLeaders(displayObligations, "receivable");
  const payableLeaders = buildExposureLeaders(displayObligations, "payable");
  const visibleReceivableLeaders = receivableLeaders.slice(0, topCount);
  const visiblePayableLeaders = payableLeaders.slice(0, topCount);
  const monthlyPulse = buildMonthlyPulse(postedMovements);
  const weekdayPattern = buildWeekdayPattern(currentPeriodMovements);
  const upcomingCommitments = buildUpcomingCommitments(displayObligations, displaySubscriptions, displayRecurringIncome);

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
  const totalCurrentExpenses = allCategoryComparison.reduce((total, item) => total + item.current, 0);
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
  const monthlyRecurringIncome = displayRecurringIncome
    .filter((income) => income.status === "active")
    .reduce((total, income) => total + getMonthlySubscriptionAmount({ ...income, nextDueDate: income.nextExpectedDate }), 0);
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
      .filter((item) => item.kind === "Por cobrar" || item.kind === "Ingreso fijo")
      .reduce((total, item) => total + item.amount, 0) + scheduledIncome;
    const expectedOutflow = commitmentsWindow
      .filter((item) => item.kind !== "Por cobrar" && item.kind !== "Ingreso fijo")
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
  const projectedLiquidBalance30Days =
    futureFlowWindows.find((window) => window.days === 30)?.estimatedBalance ?? liquidMoneyTotal;
  const averageDailySpend = currentTotals.expense / Math.max(1, comparisonDaySpan);
  const averageWeeklySpend = currentTotals.expense / Math.max(1, comparisonDaySpan / 7);
  const averageMonthlySavings =
    monthlyPulse.length > 0
      ? monthlyPulse.reduce((total, item) => total + item.net, 0) / monthlyPulse.length
      : 0;
  const savingsCapacity = currentTotals.income > 0 ? currentTotals.net / currentTotals.income : 0;
  const expandedNetWorth = totalMoneyDisplay.amount + receivableDisplay.amount - payableDisplay.amount;
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

  const duplicateExpenseMovementGroups = countDuplicateMovementGroups(postedMovements, classifyMovement);
  const pendingMovementsForReviewCount = displayMovements.filter((movement) => movement.status === "pending").length;
  const movementsNeedingMetadataReviewCount = displayMovements.filter((movement) =>
    movementNeedsReviewMetadata(movement),
  ).length;
  const subscriptionsNeedingAttentionCount = countSubscriptionsNeedingAttention(activeSubscriptions);
  const obligationsStaleActivityCount = countObligationsWithoutRecentActivity(displayObligations);
  const reviewInboxTotalIssues =
    uncategorizedMovements.length +
    pendingMovementsForReviewCount +
    duplicateExpenseMovementGroups +
    movementsNeedingMetadataReviewCount +
    subscriptionsNeedingAttentionCount +
    obligationsWithoutPlan.length +
    obligationsStaleActivityCount +
    overdueObligations.length;

  const idleSubscriptionForHint = findIdleSubscriptionName(
    new Date(),
    postedMovements,
    activeSubscriptions,
  );

  const monthEndEstimate = buildMonthEndEstimate(
    new Date(),
    liquidMoneyTotal,
    postedMovements,
    classifyMovement,
    getIncomeAmount,
    getExpenseAmount,
  );

  const suggestedProActions = buildSuggestedProActions({
    overdueAmount,
    receivableTotal: receivableDisplay.amount,
    payableTotal: payableDisplay.amount,
    uncategorizedCount: uncategorizedMovements.length,
    pendingMovementsCount: displayMovements.filter((movement) => movement.status === "pending").length,
    criticalBudgetCount: criticalCurrentBudgets.length,
    duplicateMovementGroups: duplicateExpenseMovementGroups,
    idleSubscriptionName: idleSubscriptionForHint,
  });

  const unusualSpendingLines = buildUnusualSpendingLines(
    currentPeriodMovements,
    previousPeriodMovements,
    classifyMovement,
    getExpenseAmount,
    opportunityCategory?.name ?? null,
    opportunityCategory?.delta ?? 0,
    displayCurrencyCode,
    formatCurrency,
  );

  const proWeekPressure = futureFlowWindows[0];

  const savingsBalanceTotal = visibleAccounts
    .filter((account) => account.type === "savings")
    .reduce((total, account) => total + account.currentBalance, 0);

  const distinctPostingDaysThisMonth = countDistinctPostingDaysThisMonth(new Date(), postedMovements);

  const currentCalendarMonthNet =
    monthEndEstimate.incomeMonthToDate - monthEndEstimate.expenseMonthToDate;

  const primaryProRecommendation = buildPrimaryRecommendation({
    monthlySavingsTarget: proMonthlyGoal,
    currentMonthNet: currentCalendarMonthNet,
    opportunityCategoryName: opportunityCategory?.name ?? null,
    uncategorizedCount: uncategorizedMovements.length,
    overdueAmount,
    lowBalanceAccountName: lowBalanceAccounts[0]?.name ?? null,
    savingsAccountBalance: savingsBalanceTotal,
    averageWeeklySpend,
    learningInsightLine: learningSnapshot.insights[0]?.title ?? null,
    formatCurrency,
    currencyCode: displayCurrencyCode,
  });

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
  const maxCurrencyExposure = Math.max(1, ...currencyExposure.map((item) => item.amount));
  const showReviewInboxSection = isWidgetVisible("review_inbox");
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
  const showProFocusSection =
    canUseAdvancedDashboard &&
    effectiveDashboardMode === "advanced" &&
    (isWidgetVisible("pro_command_center") ||
      isWidgetVisible("pro_intelligence_digest") ||
      isWidgetVisible("pro_goals_strip"));

  // ── Phase 2 & 3: Cross-widget filter derivations ──────────────────────────
  const distinctCategoryNames = Array.from(
    new Set(allCategoryComparison.map((item) => item.name)),
  ).sort();

  const accountTypeFilterOptions: Array<{ value: string; label: string }> = [
    { value: "cash", label: "Efectivo" },
    { value: "bank", label: "Banco" },
    { value: "savings", label: "Ahorros" },
    { value: "investment", label: "Inversión" },
    { value: "other", label: "Otro" },
  ].filter((opt) => visibleAccounts.some((account) => account.type === opt.value));

  // Active account display name for filter badge
  const activeAccountFilterName =
    activeAccountIdFilter !== null
      ? (visibleAccountsBreakdown.find((item) => item.account.id === activeAccountIdFilter)?.account.name ??
        `Cuenta #${activeAccountIdFilter}`)
      : null;

  const hasActiveFilters =
    activeCategoryFilter !== null ||
    activeAccountTypeFilter !== null ||
    activeAccountIdFilter !== null ||
    activeObligationStatusFilter !== null;

  // Combined cross-filter: category + account ID
  const hasCrossMovementFilter = activeCategoryFilter !== null || activeAccountIdFilter !== null;

  function movementMatchesAccountFilter(movement: MovementRecord, accountId: number): boolean {
    return (
      movement.sourceAccountId === accountId ||
      movement.destinationAccountId === accountId
    );
  }

  const crossFilteredPostedMovements = hasCrossMovementFilter
    ? postedMovements.filter((m) => {
        if (activeCategoryFilter !== null && m.category !== activeCategoryFilter) return false;
        if (
          activeAccountIdFilter !== null &&
          !movementMatchesAccountFilter(m, activeAccountIdFilter)
        ) {
          return false;
        }
        return true;
      })
    : postedMovements;

  const crossFilteredCurrentPeriodMovements = hasCrossMovementFilter
    ? currentPeriodMovements.filter((m) => {
        if (activeCategoryFilter !== null && m.category !== activeCategoryFilter) return false;
        if (
          activeAccountIdFilter !== null &&
          !movementMatchesAccountFilter(m, activeAccountIdFilter)
        ) {
          return false;
        }
        return true;
      })
    : currentPeriodMovements;

  // Savings trend uses combined cross-filter (crossFilteredPostedMovements)
  const trendFilteredSavingsSeries = hasCrossMovementFilter
    ? buildSavingsSeries(crossFilteredPostedMovements, comparison)
    : savingsSeries;

  const trendFilteredExpenseFlowSeries = hasCrossMovementFilter
    ? buildDailyFlowSeries(crossFilteredPostedMovements, comparison, pickExpenseDailyAmount)
    : expenseFlowSeries;

  const trendFilteredIncomeFlowSeries = hasCrossMovementFilter
    ? buildDailyFlowSeries(crossFilteredPostedMovements, comparison, pickIncomeDailyAmount)
    : incomeFlowSeries;

  // Weekly pattern cross-filtered
  const crossFilteredWeekdayPattern = hasCrossMovementFilter
    ? buildWeekdayPattern(crossFilteredCurrentPeriodMovements)
    : weekdayPattern;

  const crossFilteredSelectedWeekday =
    crossFilteredWeekdayPattern.find((item) => item.key === selectedWeekdayKey) ??
    crossFilteredWeekdayPattern[0] ??
    null;

  const maxCrossFilteredWeekdayAmount = Math.max(
    ...crossFilteredWeekdayPattern.map((item) => Math.max(item.income, item.expense)),
    1,
  );

  // Account type filter applied to accounts breakdown
  const typeFilteredAccountsBreakdown = activeAccountTypeFilter
    ? accountsBreakdown.filter((item) => item.account.type === activeAccountTypeFilter).slice(0, topCount)
    : visibleAccountsBreakdown;

  // Obligation status filter for cartera section
  const carteraFilteredObligations = (() => {
    if (activeObligationStatusFilter === null) return null;
    const todayMs = startOfDay(new Date()).getTime();
    switch (activeObligationStatusFilter) {
      case "due_soon":
        return dueSoonObligations;
      case "on_track":
        return onTrackObligations;
      case "overdue_1_30":
        return overdueObligations.filter((o) => {
          if (!o.dueDate) return false;
          const diff = Math.round((todayMs - startOfDay(new Date(o.dueDate)).getTime()) / 86400000);
          return diff >= 1 && diff <= 30;
        });
      case "overdue_31_60":
        return overdueObligations.filter((o) => {
          if (!o.dueDate) return false;
          const diff = Math.round((todayMs - startOfDay(new Date(o.dueDate)).getTime()) / 86400000);
          return diff >= 31 && diff <= 60;
        });
      case "overdue_61_plus":
        return overdueObligations.filter((o) => {
          if (!o.dueDate) return false;
          const diff = Math.round((todayMs - startOfDay(new Date(o.dueDate)).getTime()) / 86400000);
          return diff >= 61;
        });
      default:
        return null;
    }
  })();

  const carteraReceivableLeaders =
    carteraFilteredObligations !== null
      ? buildExposureLeaders(carteraFilteredObligations, "receivable").slice(0, topCount)
      : visibleReceivableLeaders;

  const carteraPayableLeaders =
    carteraFilteredObligations !== null
      ? buildExposureLeaders(carteraFilteredObligations, "payable").slice(0, topCount)
      : visiblePayableLeaders;

  return (
    <DashboardHelpProvider>
    <div className="flex flex-col gap-6 pb-8">
      <PageHeader
        actions={
          <div className="flex flex-wrap items-start gap-3">
            <Button
              aria-label={snapshotQuery.isFetching ? "Actualizando dashboard" : "Actualizar dashboard"}
              className="h-12 w-12 shrink-0 rounded-[18px] px-0"
              disabled={snapshotQuery.isFetching}
              onClick={() => snapshotQuery.refetch()}
              title={snapshotQuery.isFetching ? "Actualizando dashboard" : "Actualizar dashboard"}
              variant="ghost"
            >
              <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
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
            <div className="max-w-md rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-2.5">
              <p className="text-[0.58rem] font-semibold uppercase tracking-[0.18em] text-storm/55">
                Qué hacen los filtros
              </p>
              <p className="mt-1.5 text-[0.65rem] leading-relaxed text-storm/75">
                <span className="font-medium text-ink/85">Categoría</span> y{" "}
                <span className="font-medium text-ink/85">cuenta</span> dejan solo los movimientos que coinciden y
                recalculan las gráficas de <span className="text-storm/90">tendencia de ahorro</span>,{" "}
                <span className="text-storm/90">flujo por día</span> y <span className="text-storm/90">ritmo semanal</span>{" "}
                (siempre dentro del período que elegiste arriba). La cuenta se activa tocando una fila en{" "}
                <span className="font-medium text-ink/85">Dinero por cuenta</span>, no desde aquí.
              </p>
              <p className="mt-2 text-[0.65rem] leading-relaxed text-storm/75">
                <span className="font-medium text-ink/85">Tipo de cuenta</span> solo acorta la lista del desglose de
                cuentas; <span className="font-medium text-storm/90">no cambia</span> esas gráficas de tendencia.
              </p>
            </div>
            {distinctCategoryNames.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[0.6rem] uppercase tracking-[0.2em] text-storm/60">
                  Categoría → tendencia y ritmo semanal
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {distinctCategoryNames.slice(0, 12).map((name) => (
                    <button
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        activeCategoryFilter === name
                          ? "border-gold/40 bg-gold/20 text-ink"
                          : "border-white/10 bg-white/[0.03] text-storm hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={name}
                      onClick={() => setActiveCategoryFilter(activeCategoryFilter === name ? null : name)}
                      title={
                        activeCategoryFilter === name
                          ? "Quitar filtro de tendencia"
                          : `Filtrar tendencia y ritmo semanal por «${name}»`
                      }
                      type="button"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {accountTypeFilterOptions.length > 1 ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[0.6rem] uppercase tracking-[0.2em] text-storm/60">
                  Tipo de cuenta → solo lista en Dinero por cuenta
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {accountTypeFilterOptions.map((opt) => (
                    <button
                      className={`rounded-full border px-3 py-1 text-xs transition ${
                        activeAccountTypeFilter === opt.value
                          ? "border-pine/40 bg-pine/20 text-ink"
                          : "border-white/10 bg-white/[0.03] text-storm hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={opt.value}
                      onClick={() => setActiveAccountTypeFilter(activeAccountTypeFilter === opt.value ? null : opt.value)}
                      type="button"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {hasActiveFilters ? (
              <div className="flex flex-col gap-2 rounded-[16px] border border-gold/20 bg-gold/8 px-3 py-2">
                {(activeCategoryFilter !== null || activeAccountIdFilter !== null) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-storm/65">
                      Tendencia / ritmo
                    </span>
                    {activeCategoryFilter ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2.5 py-0.5 text-xs font-medium text-ink hover:bg-gold/35"
                        onClick={() => setActiveCategoryFilter(null)}
                        type="button"
                      >
                        Categoría: {activeCategoryFilter} ×
                      </button>
                    ) : null}
                    {activeAccountIdFilter !== null ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-full bg-gold/25 px-2.5 py-0.5 text-xs font-medium text-ink hover:bg-gold/35"
                        onClick={() => setActiveAccountIdFilter(null)}
                        type="button"
                      >
                        Cuenta: {activeAccountFilterName} ×
                      </button>
                    ) : null}
                  </div>
                )}
                {(activeAccountTypeFilter !== null || activeObligationStatusFilter !== null) && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[0.65rem] font-medium uppercase tracking-[0.12em] text-storm/65">
                      Otras vistas
                    </span>
                    {activeAccountTypeFilter ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-full bg-pine/25 px-2.5 py-0.5 text-xs font-medium text-ink hover:bg-pine/35"
                        onClick={() => setActiveAccountTypeFilter(null)}
                        type="button"
                      >
                        Tipo cuenta:{" "}
                        {accountTypeFilterOptions.find((o) => o.value === activeAccountTypeFilter)?.label ??
                          activeAccountTypeFilter}{" "}
                        ×
                      </button>
                    ) : null}
                    {activeObligationStatusFilter !== null ? (
                      <button
                        className="inline-flex items-center gap-1 rounded-full bg-ember/25 px-2.5 py-0.5 text-xs font-medium text-ink hover:bg-ember/35"
                        onClick={() => setActiveObligationStatusFilter(null)}
                        type="button"
                      >
                        Cartera:{" "}
                        {obligationAgingBuckets.find((b) => b.key === activeObligationStatusFilter)?.label ??
                          activeObligationStatusFilter}{" "}
                        ×
                      </button>
                    ) : null}
                  </div>
                )}
                <button
                  className="self-start text-xs text-storm/60 underline hover:text-storm"
                  onClick={() => {
                    setActiveCategoryFilter(null);
                    setActiveAccountTypeFilter(null);
                    setActiveAccountIdFilter(null);
                    setActiveObligationStatusFilter(null);
                  }}
                  type="button"
                >
                  Limpiar todos
                </button>
              </div>
            ) : null}
            </div>
          </div>
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
        titleAccessory={<DashboardHelpTrigger metricId="panel_control" />}
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

      <div className="mb-2 mt-4 flex items-start gap-3 border-t border-white/8 pt-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.6rem] font-bold text-storm">
          01
        </div>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink/70">Atención inmediata</p>
          <p className="mt-1 text-xs leading-5 text-storm/50">Tareas pendientes, alertas y señales que requieren acción antes de analizar el resto.</p>
        </div>
      </div>
      {showReviewInboxSection ? (
        <SurfaceCard
          action={
            <StatusBadge
              status={reviewInboxTotalIssues > 0 ? `${reviewInboxTotalIssues} pendientes` : "Al día"}
              tone={reviewInboxTotalIssues > 0 ? "warning" : "success"}
            />
          }
          description="Cola única para limpiar datos: categorías, duplicados, señales de baja confianza, suscripciones y cartera que piden seguimiento."
          title="Por revisar"
          titleAccessory={<DashboardHelpTrigger metricId="widget_review_inbox" />}
        >
          {reviewInboxTotalIssues === 0 ? (
            <DataState
              description="No detectamos pendientes en estas categorías. Sigue registrando movimientos para mantener el tablero fiable."
              title="Bandeja vacía"
              tone="success"
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {uncategorizedMovements.length > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Sin categoría</p>
                    <p className="mt-1 text-sm text-storm">Movimientos aplicados que aún no clasificás.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={`${uncategorizedMovements.length}`} tone="warning" />
                    <GhostLink label="Ir a movimientos" to="/app/movements" />
                  </div>
                </li>
              ) : null}
              {pendingMovementsForReviewCount > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Pendientes de aplicar</p>
                    <p className="mt-1 text-sm text-storm">Aún no impactan el saldo real.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={`${pendingMovementsForReviewCount}`} tone="warning" />
                    <GhostLink label="Revisar cola" to="/app/movements" />
                  </div>
                </li>
              ) : null}
              {duplicateExpenseMovementGroups > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Posibles duplicados</p>
                    <p className="mt-1 text-sm text-storm">Mismo día, monto y contraparte en gastos.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={`${duplicateExpenseMovementGroups} grupo(s)`} tone="warning" />
                    <GhostLink label="Abrir movimientos" to="/app/movements" />
                  </div>
                </li>
              ) : null}
              {movementsNeedingMetadataReviewCount > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Baja confianza / revisar</p>
                    <p className="mt-1 text-sm text-storm">Metadata que marca revisión o confianza baja.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={`${movementsNeedingMetadataReviewCount}`} tone="info" />
                    <GhostLink label="Ver movimientos" to="/app/movements" />
                  </div>
                </li>
              ) : null}
              {subscriptionsNeedingAttentionCount > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Suscripciones por confirmar</p>
                    <p className="mt-1 text-sm text-storm">Sin cuenta ligada o vencimiento ya pasado.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={`${subscriptionsNeedingAttentionCount}`} tone="warning" />
                    <GhostLink label="Suscripciones" to="/app/subscriptions" />
                  </div>
                </li>
              ) : null}
              {obligationsWithoutPlan.length > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Cartera sin plan claro</p>
                    <p className="mt-1 text-sm text-storm">Saldo vivo sin cuota ni fecha de seguimiento.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={`${obligationsWithoutPlan.length}`} tone="warning" />
                    <GhostLink label="Cartera" to="/app/obligations" />
                  </div>
                </li>
              ) : null}
              {obligationsStaleActivityCount > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/10 bg-white/[0.03] px-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Cartera sin movimiento reciente</p>
                    <p className="mt-1 text-sm text-storm">Más de 50 días sin pagos ni eventos registrados.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={`${obligationsStaleActivityCount}`} tone="neutral" />
                    <GhostLink label="Actualizar cartera" to="/app/obligations" />
                  </div>
                </li>
              ) : null}
              {overdueObligations.length > 0 ? (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-ember/20 bg-ember/8 px-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">Cobros o pagos vencidos</p>
                    <p className="mt-1 text-sm text-storm">Compromisos con fecha pasada y saldo pendiente.</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={`${overdueObligations.length}`} tone="danger" />
                    <GhostLink label="Resolver" to="/app/obligations" />
                  </div>
                </li>
              ) : null}
            </ul>
          )}
        </SurfaceCard>
      ) : null}

      <div className="mb-2 mt-4 flex items-start gap-3 border-t border-white/8 pt-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.6rem] font-bold text-storm">
          02
        </div>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink/70">Tu posición financiera</p>
          <p className="mt-1 text-xs leading-5 text-storm/50">Balances, flujo del período y salud global. El punto de partida para entender cómo estás parado hoy.</p>
        </div>
      </div>
      {isWidgetVisible("overview_kpis") ? (
      <section className="grid gap-4">
        {/* ── Health semaphore banner ─────────────────────────────── */}
        <div
          className={`flex flex-wrap items-center gap-4 rounded-[24px] border p-4 ${
            healthSnapshot.tone === "success"
              ? "border-pine/25 bg-pine/8"
              : healthSnapshot.tone === "warning"
                ? "border-gold/25 bg-gold/8"
                : "border-ember/25 bg-ember/8"
          }`}
        >
          <span className="text-2xl" role="img" aria-label={healthSnapshot.title}>
            {healthSnapshot.tone === "success" ? "🟢" : healthSnapshot.tone === "warning" ? "🟡" : "🔴"}
          </span>
          <div className="flex-1">
            <p
              className={`text-[0.65rem] font-semibold uppercase tracking-[0.22em] ${
                healthSnapshot.tone === "success"
                  ? "text-pine"
                  : healthSnapshot.tone === "warning"
                    ? "text-gold"
                    : "text-ember"
              }`}
            >
              Salud financiera — {healthSnapshot.title}
            </p>
            <p className="mt-1 text-sm text-storm">{healthSnapshot.description}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="relative text-right pr-7">
              <div className="absolute right-0 top-0 z-[1]">
                <DashboardHelpTrigger className="h-6 w-6" metricId="kpi_savings_rate" />
              </div>
              <p className="text-[0.6rem] uppercase tracking-[0.18em] text-storm/60">Ahorro %</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">
                {healthSnapshot.savingsRate !== null
                  ? `${(healthSnapshot.savingsRate * 100).toFixed(0)}%`
                  : "—"}
              </p>
              <p className="text-[0.58rem] text-storm/50">Sano: &gt;10%</p>
            </div>
            <div className="text-right">
              <p className="text-[0.6rem] uppercase tracking-[0.18em] text-storm/60">Cobertura</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">
                {healthSnapshot.coverageMonths !== null
                  ? `${healthSnapshot.coverageMonths.toFixed(1)} m`
                  : "—"}
              </p>
              <p className="text-[0.58rem] text-storm/50">Sano: &gt;3 m</p>
            </div>
            <div className="text-right">
              <p className="text-[0.6rem] uppercase tracking-[0.18em] text-storm/60">Deuda/Ing</p>
              <p className="mt-0.5 text-sm font-semibold text-ink">
                {healthSnapshot.debtToIncomeRatio !== null
                  ? `${(healthSnapshot.debtToIncomeRatio * 100).toFixed(0)}%`
                  : "—"}
              </p>
              <p className="text-[0.58rem] text-storm/50">Sano: &lt;40%</p>
            </div>
          </div>
        </div>

        {/* ── Sub-panel grid ──────────────────────────────────────── */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          {/* LIQUIDEZ */}
          <div className="relative rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <div className="absolute right-4 top-4 z-[1]">
              <DashboardHelpTrigger metricId="adv_liquidity" />
            </div>
            <p className="pr-10 text-[0.6rem] font-bold uppercase tracking-[0.24em] text-pine">Liquidez</p>
            <p className="mt-1 text-[0.65rem] text-storm/50">
              Totales al día, desglose por tipo de cuenta y una estimación de cómo podría quedar la caja en ~30 días.
            </p>
            <div className="mt-4 grid gap-3">
              <DashboardKpiHelpWrap className="rounded-[20px] border border-pine/18 bg-pine/10 p-3" metricId="kpi_total_money">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-pine">Dinero total</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {formatCurrency(totalMoneyDisplay.amount, totalMoneyDisplay.currencyCode)}
                </p>
                <p className="mt-1 text-xs text-storm">{visibleAccounts.length} cuentas activas</p>
              </DashboardKpiHelpWrap>
              <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="kpi_real_free_money">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-storm">Dinero libre real</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {formatCurrency(healthSnapshot.realFreeMoney, displayCurrencyCode)}
                </p>
                <p className="mt-1 text-xs text-storm">Liquidez hoy menos salidas previstas en los próximos ~30 días.</p>
              </DashboardKpiHelpWrap>
              <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-3">
                <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="adv_cash">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-storm">Efectivo</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">
                    {formatCurrency(totalCash, displayCurrencyCode)}
                  </p>
                </DashboardKpiHelpWrap>
                <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="adv_bank">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-storm">Bancos</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">
                    {formatCurrency(totalBank, displayCurrencyCode)}
                  </p>
                </DashboardKpiHelpWrap>
                <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="adv_savings">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-storm">Ahorros</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">
                    {formatCurrency(totalSavings, displayCurrencyCode)}
                  </p>
                </DashboardKpiHelpWrap>
              </div>
              <DashboardKpiHelpWrap className="rounded-[20px] border border-pine/18 bg-pine/10 p-3" metricId="adv_projected_cash_30">
                <p className="text-[0.58rem] uppercase tracking-[0.16em] text-pine">Caja estimada a 30 días</p>
                <p className="mt-1.5 font-display text-base font-semibold text-ink">
                  {formatCurrency(projectedLiquidBalance30Days, displayCurrencyCode)}
                </p>
                <p className="mt-1 text-[0.65rem] leading-relaxed text-storm/85">
                  Toma tu liquidez actual y suma o resta cobros, pagos y movimientos programados que la app ya conoce para ese plazo. Cifra orientativa.
                </p>
              </DashboardKpiHelpWrap>
            </div>
          </div>

          {/* FLUJO DEL PERÍODO */}
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-gold">Flujo del período</p>
            <p className="mt-1 text-[0.65rem] text-storm/50">
              Ingresos, gastos y ahorro neto del corte; abajo, transferencias internas, cartera y recurrentes en resumen.
            </p>
            <div className="mt-4 grid gap-3">
              <DashboardKpiHelpWrap className="rounded-[20px] border border-pine/18 bg-pine/10 p-3" metricId="kpi_income">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-pine">Ingresos</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {formatCurrency(currentTotals.income, displayCurrencyCode)}
                </p>
                <p className="mt-1 text-xs text-storm">
                  {formatVsPreviousPeriodLabel(currentTotals.income, previousTotals.income, comparison.previous.label)}
                </p>
              </DashboardKpiHelpWrap>
              <DashboardKpiHelpWrap className="rounded-[20px] border border-ember/18 bg-ember/10 p-3" metricId="kpi_expense">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-ember">Gastos</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {formatCurrency(currentTotals.expense, displayCurrencyCode)}
                </p>
                <p className="mt-1 text-xs text-storm">
                  {formatVsPreviousPeriodLabel(currentTotals.expense, previousTotals.expense, comparison.previous.label)}
                </p>
              </DashboardKpiHelpWrap>
              <div className="grid grid-cols-2 gap-2">
                <DashboardKpiHelpWrap className="rounded-[20px] border border-gold/18 bg-gold/10 p-3" metricId="kpi_period_savings">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-gold">Ahorro neto</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">
                    {formatCurrency(currentTotals.net, displayCurrencyCode)}
                  </p>
                </DashboardKpiHelpWrap>
                <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="kpi_avg_daily_spend">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-storm">Promedio/día</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">
                    {formatCurrency(averageDailySpend, displayCurrencyCode)}
                  </p>
                </DashboardKpiHelpWrap>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="kpi_transferred">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-storm">Transferido</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">
                    {formatCurrency(totalTransferredThisPeriod, displayCurrencyCode)}
                  </p>
                  <p className="mt-1 text-[0.65rem] text-storm/80">
                    {currentPeriodTransfers.length}{" "}
                    {currentPeriodTransfers.length === 1 ? "transferencia" : "transferencias"} en el período
                  </p>
                </DashboardKpiHelpWrap>
                <DashboardKpiHelpWrap className="rounded-[20px] border border-ember/18 bg-ember/8 p-3" metricId="kpi_overdue">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-ember">Vencido</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">
                    {formatCurrency(overdueAmount, displayCurrencyCode)}
                  </p>
                  <p className="mt-1 text-[0.65rem] text-storm/80">
                    {overdueObligations.length}{" "}
                    {overdueObligations.length === 1 ? "obligación vencida" : "obligaciones vencidas"} con saldo pendiente
                  </p>
                </DashboardKpiHelpWrap>
                <DashboardKpiHelpWrap className="rounded-[20px] border border-gold/18 bg-gold/8 p-3" metricId="kpi_upcoming_payments">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-gold">Pagos próximos</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">
                    {formatCurrency(upcomingOutflows, displayCurrencyCode)}
                  </p>
                  <p className="mt-1 text-[0.65rem] text-storm/80">
                    Pagos y cuotas esperados en ~30 días (no suma ítems marcados como por cobrar).
                  </p>
                </DashboardKpiHelpWrap>
                <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="kpi_active_subscriptions">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-storm">Suscripciones</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">{activeSubscriptions.length} activas</p>
                  <p className="mt-1 text-[0.65rem] text-storm/80">
                    Costo mensual recurrente aproximado: {formatCurrency(monthlyRecurringCost, displayCurrencyCode)}
                  </p>
                </DashboardKpiHelpWrap>
                <DashboardKpiHelpWrap className="rounded-[20px] border border-pine/18 bg-pine/8 p-3" metricId="kpi_recurring_income">
                  <p className="text-[0.58rem] uppercase tracking-[0.16em] text-pine">Ingresos fijos</p>
                  <p className="mt-1.5 font-display text-base font-semibold text-ink">{displayRecurringIncome.filter((r) => r.status === "active").length} activos</p>
                  <p className="mt-1 text-[0.65rem] text-storm/80">
                    Entrada mensual recurrente estimada: {formatCurrency(monthlyRecurringIncome, displayCurrencyCode)}
                  </p>
                </DashboardKpiHelpWrap>
              </div>
            </div>
          </div>

          {/* PATRIMONIO */}
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-ink/70">Patrimonio</p>
            <p className="mt-1 text-[0.65rem] text-storm/50">Valor neto ampliado incluyendo lo que te deben y debes.</p>
            <div className="mt-4 grid gap-3">
              <DashboardKpiHelpWrap className="rounded-[20px] border border-pine/18 bg-pine/10 p-3" metricId="adv_net_worth">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-pine">Patrimonio neto</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {formatCurrency(expandedNetWorth, displayCurrencyCode)}
                </p>
                <p className="mt-1 text-xs text-storm">Caja + cobros pendientes − deudas.</p>
              </DashboardKpiHelpWrap>
              <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="kpi_receivable">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-storm">Te deben</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {formatCurrency(receivableDisplay.amount, receivableDisplay.currencyCode)}
                </p>
                <p className="mt-1 text-xs text-storm">{receivableLeaders.length} contactos con saldo pendiente.</p>
              </DashboardKpiHelpWrap>
              <DashboardKpiHelpWrap className="rounded-[20px] border border-ember/18 bg-ember/10 p-3" metricId="kpi_payable">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-ember">Debes</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {formatCurrency(payableDisplay.amount, payableDisplay.currencyCode)}
                </p>
                <p className="mt-1 text-xs text-storm">{payableLeaders.length} contactos con saldo pendiente.</p>
              </DashboardKpiHelpWrap>
            </div>
          </div>

          {/* SALUD */}
          <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-[0.6rem] font-bold uppercase tracking-[0.24em] text-storm">Salud</p>
            <p className="mt-1 text-[0.65rem] text-storm/50">Métricas de sostenibilidad y riesgo financiero personal.</p>
            <div className="mt-4 grid gap-3">
              <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="adv_savings_capacity">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-storm">Cap. ahorro %</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {healthSnapshot.savingsRate !== null
                    ? `${(healthSnapshot.savingsRate * 100).toFixed(1)}%`
                    : "Sin dato"}
                </p>
                <p className="mt-1 text-xs text-storm">Sano cuando supera el 10% de ingresos.</p>
              </DashboardKpiHelpWrap>
              <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="kpi_coverage_months">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-storm">Cobertura meses</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {healthSnapshot.coverageMonths !== null
                    ? `${healthSnapshot.coverageMonths.toFixed(1)} m`
                    : "Sin dato"}
                </p>
                <p className="mt-1 text-xs text-storm">Sano con 3+ meses de gastos en liquidez.</p>
              </DashboardKpiHelpWrap>
              <DashboardKpiHelpWrap className="rounded-[20px] border border-white/10 bg-white/[0.03] p-3" metricId="kpi_debt_income">
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-storm">Ratio deuda/ing</p>
                <p className="mt-2 font-display text-xl font-semibold text-ink">
                  {healthSnapshot.debtToIncomeRatio !== null
                    ? `${(healthSnapshot.debtToIncomeRatio * 100).toFixed(0)}%`
                    : "Sin dato"}
                </p>
                <p className="mt-1 text-xs text-storm">Sano por debajo del 40%.</p>
              </DashboardKpiHelpWrap>
            </div>
          </div>
        </div>

        {/* ── Cierre estimado + meta + categoría que subió ────────── */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="relative rounded-[24px] border border-gold/22 bg-gold/10 p-5">
            <div className="absolute right-4 top-4 z-[1]">
              <DashboardHelpTrigger metricId="dashboard_period_close" />
            </div>
            <p className="pr-10 text-[0.65rem] uppercase tracking-[0.2em] text-storm">Cierre estimado (mes calendario)</p>
            <p className="mt-3 font-display text-xl font-semibold leading-snug text-ink sm:text-2xl">
              Si seguís el ritmo de ingresos y gastos de este mes, tu caja líquida rondaría{" "}
              {formatCurrency(monthEndEstimate.estimatedLiquidAtMonthEnd, displayCurrencyCode)} al cierre.
            </p>
            <p className="mt-3 text-sm leading-6 text-storm">
              Proyección a partir del neto diario del mes en curso y saldos de efectivo, banco y ahorros (no incluye
              cuentas fuera de liquidez inmediata).
            </p>
          </div>
          {proMonthlyGoal !== null && proMonthlyGoal > 0 ? (
            <div className="relative rounded-[24px] border border-pine/22 bg-pine/10 p-5">
              <div className="absolute right-4 top-4 z-[1]">
                <DashboardHelpTrigger metricId="dashboard_goal_simple" />
              </div>
              <p className="pr-10 text-[0.65rem] uppercase tracking-[0.2em] text-pine">Meta de ahorro del mes</p>
              <p className="mt-3 font-display text-2xl font-semibold text-ink">
                {Math.min(100, Math.max(0, Math.round((currentCalendarMonthNet / proMonthlyGoal) * 100)))}% completada
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-pine to-emerald-300"
                  style={{
                    width: `${Math.min(100, Math.max(4, (currentCalendarMonthNet / proMonthlyGoal) * 100))}%`,
                  }}
                />
              </div>
              <p className="mt-3 text-sm text-storm">
                {currentCalendarMonthNet < proMonthlyGoal
                  ? `Te faltan ${formatCurrency(Math.max(0, proMonthlyGoal - currentCalendarMonthNet), displayCurrencyCode)} para el objetivo (${formatCurrency(currentCalendarMonthNet, displayCurrencyCode)} de ${formatCurrency(proMonthlyGoal, displayCurrencyCode)}).`
                  : "Objetivo alcanzado o superado en el mes en curso."}
              </p>
              {canUseAdvancedDashboard ? (
                <p className="mt-2 text-xs text-storm/80">
                  Editá el monto en el widget{" "}
                  <button
                    className="font-medium text-gold underline decoration-gold/35 underline-offset-2 hover:text-gold/90"
                    onClick={scrollToMetaDisciplinaWidget}
                    type="button"
                  >
                    Meta y disciplina
                  </button>
                  .
                </p>
              ) : null}
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Meta de ahorro del mes</p>
              <p className="mt-3 text-sm leading-6 text-storm">
                Todavía no hay meta guardada.{" "}
                {canUseAdvancedDashboard ? (
                  <>
                    Podés definirla en el widget{" "}
                    <button
                      className="font-medium text-gold underline decoration-gold/35 underline-offset-2 hover:text-gold/90"
                      onClick={scrollToMetaDisciplinaWidget}
                      type="button"
                    >
                      Meta y disciplina
                    </button>{" "}
                    (vista avanzada; te llevamos ahí con un toque).
                  </>
                ) : (
                  <>
                    Podés definirla en el widget{" "}
                    <span className="font-medium text-ink">Meta y disciplina</span> (vista avanzada).
                  </>
                )}
              </p>
            </div>
          )}
          {categoryWithLargestExpenseIncrease ? (
            <div className="rounded-[24px] border border-ember/18 bg-ember/8 p-5">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-ember">Categoría que más subió</p>
              <p className="mt-3 font-display text-xl font-semibold text-ink">{categoryWithLargestExpenseIncrease.name}</p>
              <p className="mt-2 text-sm text-storm">
                +{formatCurrency(categoryWithLargestExpenseIncrease.delta, displayCurrencyCode)} vs{" "}
                {comparison.previous.label}: gastaste {formatCurrency(categoryWithLargestExpenseIncrease.current, displayCurrencyCode)}{" "}
                frente a {formatCurrency(categoryWithLargestExpenseIncrease.previous, displayCurrencyCode)}.
              </p>
              <div className="mt-3">
                <GhostLink label="Ver comparativo" to="/app/categories" />
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Categoría que más subió</p>
              <p className="mt-3 text-sm text-storm">No hay alzas de gasto vs el período anterior en el top visible.</p>
            </div>
          )}
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
          titleAccessory={<DashboardHelpTrigger metricId="shared_portfolio" />}
        >
          {sharedObligationsQuery.isLoading ? (
            <p className="text-sm text-storm">Cargando cartera compartida...</p>
          ) : sharedObligationsQuery.error ? (
            <p className="text-sm text-ember">No se pudo cargar la cartera compartida.</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <DashboardKpiHelpWrap className="rounded-[24px] border border-pine/18 bg-pine/10 p-4" metricId="shared_receivable">
                <p className="text-xs uppercase tracking-[0.18em] text-pine">
                  Créditos compartidos
                </p>
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
              </DashboardKpiHelpWrap>
              <DashboardKpiHelpWrap className="rounded-[24px] border border-rosewood/18 bg-rosewood/10 p-4" metricId="shared_payable">
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
              </DashboardKpiHelpWrap>
              <DashboardKpiHelpWrap className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:col-span-2" metricId="shared_principal">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Principal compartido</p>
                <p className="mt-3 font-display text-2xl font-semibold text-ink">
                  {formatCurrency(sharedPrincipalDisplay.amount, sharedPrincipalDisplay.currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  Suma del capital registrado en la cartera que otro usuario te mostró en solo lectura. No es un saldo tuyo: sirve como contexto del tamaño del crédito o préstamo original.
                </p>
              </DashboardKpiHelpWrap>
              <DashboardKpiHelpWrap className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:col-span-2" metricId="shared_pending">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendiente compartido</p>
                <p className="mt-3 font-display text-2xl font-semibold text-ink">
                  {formatCurrency(sharedPendingDisplay.amount, sharedPendingDisplay.currencyCode)}
                </p>
                <p className="mt-2 text-sm text-storm">
                  Todo lo que en esos mismos registros sigue sin pagarse ni cobrarse por completo. Solo lectura; no se mezcla con tus KPI del workspace.
                </p>
              </DashboardKpiHelpWrap>
            </div>
          )}
        </SurfaceCard>
      ) : null}

      {isWidgetVisible("overview_kpis") && effectiveDashboardMode === "advanced" ? (
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
          <DashboardKpiHelpWrap className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4" metricId="adv_avg_weekly_spend">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Gasto semanal medio</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(averageWeeklySpend, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">Referencia rápida para medir tu ritmo de consumo.</p>
          </DashboardKpiHelpWrap>
          <DashboardKpiHelpWrap className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4" metricId="adv_avg_monthly_savings">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Ahorro mensual medio</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {formatCurrency(averageMonthlySavings, displayCurrencyCode)}
            </p>
            <p className="mt-2 text-sm text-storm">
              Promedio de tu pulso mensual reciente. Capacidad actual {formatPercentage(Math.max(0, savingsCapacity))}.
            </p>
          </DashboardKpiHelpWrap>
          <DashboardKpiHelpWrap className="rounded-[24px] border border-pine/18 bg-pine/10 p-4" metricId="adv_top_account">
            <p className="text-xs uppercase tracking-[0.18em] text-pine">Cuenta con mayor saldo</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {topBalanceAccount ? formatCurrency(topBalanceAccount.amount, displayCurrencyCode) : "Sin cuentas"}
            </p>
            <p className="mt-2 text-sm text-storm">
              {topBalanceAccount
                ? `${topBalanceAccount.account.name} concentra ${formatPercentage(topBalanceAccount.share)} del dinero visible.`
                : "Crea o activa una cuenta para empezar a ver concentración de saldo."}
            </p>
          </DashboardKpiHelpWrap>
          <DashboardKpiHelpWrap className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4" metricId="adv_bottom_account">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Cuenta con menor saldo</p>
            <p className="mt-3 font-display text-2xl font-semibold text-ink">
              {bottomBalanceAccount ? formatCurrency(bottomBalanceAccount.amount, displayCurrencyCode) : "Sin cuentas"}
            </p>
            <p className="mt-2 text-sm text-storm">
              {bottomBalanceAccount
                ? `${bottomBalanceAccount.account.name} hoy tiene el menor peso dentro del dinero activo.`
                : "Aún no hay suficientes cuentas para comparar extremos."}
            </p>
          </DashboardKpiHelpWrap>
          <DashboardKpiHelpWrap className="rounded-[24px] border border-pine/18 bg-pine/10 p-4" metricId="adv_latest_income">
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
              {latestIncome ? formatDateTime(latestIncome.occurredAt) : "Todavía no hay ingresos aplicados."}
            </p>
          </DashboardKpiHelpWrap>
          <DashboardKpiHelpWrap className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4" metricId="adv_latest_movement">
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
          </DashboardKpiHelpWrap>
        </section>
      ) : null}

      <div className="mb-2 mt-4 flex items-start gap-3 border-t border-white/8 pt-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.6rem] font-bold text-storm">
          03
        </div>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink/70">Flujo de dinero</p>
          <p className="mt-1 text-xs leading-5 text-storm/50">Cómo entró y salió el dinero en el período. Gráficos diarios y proyección hacia el cierre del mes.</p>
        </div>
      </div>
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
          description="Ahorro neto, gastos, ingresos y transferencias día a día. Si activaste filtro de categoría o cuenta, estas curvas solo usan movimientos que coinciden. Tocá un día para ver el detalle."
          title="Cronológicos del período"
          titleAccessory={<DashboardHelpTrigger metricId="widget_savings_trend" />}
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
          {hasCrossMovementFilter ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-gold/20 bg-gold/8 px-3 py-2 text-xs text-storm">
              <span className="font-medium text-storm/80">Filtro tendencia:</span>
              {activeCategoryFilter ? (
                <span className="font-semibold text-ink">categoría &quot;{activeCategoryFilter}&quot;</span>
              ) : null}
              {activeCategoryFilter && activeAccountIdFilter !== null ? <span>+</span> : null}
              {activeAccountIdFilter !== null ? (
                <span className="font-semibold text-ink">cuenta &quot;{activeAccountFilterName}&quot;</span>
              ) : null}
              <button
                className="ml-auto text-storm/60 hover:text-storm"
                onClick={() => { setActiveCategoryFilter(null); setActiveAccountIdFilter(null); }}
                type="button"
              >
                Limpiar ×
              </button>
            </div>
          ) : null}
          {chronologicalTrendTab === "savings" ? (
            <SavingsLineChart
              currencyCode={displayCurrencyCode}
              dayMovements={movementsForSelectedChronologicalDay}
              onSelect={setSelectedTrendIndex}
              points={trendFilteredSavingsSeries}
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
              points={trendFilteredExpenseFlowSeries}
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
              points={trendFilteredIncomeFlowSeries}
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
          titleAccessory={<DashboardHelpTrigger metricId="widget_period_radar" />}
        >
          <div className="grid gap-3">
            <article className="relative rounded-[24px] border border-pine/18 bg-pine/10 p-5">
              <div className="absolute right-4 top-4 z-[1]">
                <DashboardHelpTrigger metricId="radar_top_category" />
              </div>
              <p className="pr-10 text-xs uppercase tracking-[0.18em] text-pine">Categoría más pesada ahora</p>
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

            <article className="relative rounded-[24px] border border-white/10 bg-white/[0.04] p-5">
              <div className="absolute right-4 top-4 z-[1]">
                <DashboardHelpTrigger metricId="radar_prev_category" />
              </div>
              <p className="pr-10 text-xs uppercase tracking-[0.18em] text-storm">La que más pesaba antes</p>
              <h4 className="mt-3 font-display text-2xl font-semibold text-ink">
                {topCategoryPreviousPeriod?.name ?? "Sin historial comparable"}
              </h4>
              <p className="mt-2 text-sm leading-7 text-storm">
                {topCategoryPreviousPeriod
                  ? `${formatCurrency(topCategoryPreviousPeriod.previous, displayCurrencyCode)} durante ${comparison.previous.label.toLowerCase()}.`
                  : "Todavía no hay registros suficientes en el período anterior."}
              </p>
            </article>

            <article className="relative rounded-[24px] border border-ember/18 bg-ember/10 p-5">
              <div className="absolute right-4 top-4 z-[1]">
                <DashboardHelpTrigger metricId="radar_opportunity" />
              </div>
              <p className="pr-10 text-xs uppercase tracking-[0.18em] text-ember">Oportunidad más clara</p>
              <h4 className="mt-3 font-display text-2xl font-semibold text-ink">
                {opportunityCategory?.name ?? "Sin fuga clara todavía"}
              </h4>
              <p className="mt-2 text-sm leading-7 text-storm">
                {opportunityCategory
                  ? `Subió ${formatDeltaCurrency(opportunityCategory.delta, displayCurrencyCode)} frente a ${comparison.previous.label.toLowerCase()}. Si recortas aquí, el ahorro mejora más rápido.`
                  : "Todavía no hay diferencia clara para recomendarte un recorte específico."}
              </p>
            </article>

            <article className="relative rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
              <div className="absolute right-4 top-4 z-[1]">
                <DashboardHelpTrigger metricId="radar_best_day" />
              </div>
              <div className="flex items-start justify-between gap-4 pr-8">
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

      <div className="mb-2 mt-4 flex items-start gap-3 border-t border-white/8 pt-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.6rem] font-bold text-storm">
          04
        </div>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink/70">Cuentas y cartera</p>
          <p className="mt-1 text-xs leading-5 text-storm/50">Dónde está el dinero ahora y a quiénes estás expuesto por cobrar o pagar.</p>
        </div>
      </div>
      {showPortfolioSection ? (
      <section className="grid gap-6 xl:grid-cols-3">
        {isWidgetVisible("accounts_breakdown") ? (
        <SurfaceCard
          action={<GhostLink label="Ver cuentas" to="/app/accounts" />}
          description="Cuánto dinero sostiene hoy cada cuenta y cuánta actividad tuvo en el período. Tocá una cuenta para filtrar por ella las gráficas de tendencia y el ritmo semanal (movimientos que salen o entran por esa cuenta)."
          title="Dinero por cuenta"
          titleAccessory={<DashboardHelpTrigger metricId="widget_accounts_breakdown" />}
        >
          {activeAccountTypeFilter ? (
            <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-pine/20 bg-pine/8 px-3 py-2 text-xs text-storm">
              Mostrando solo cuentas de tipo <span className="font-semibold text-ink">{accountTypeFilterOptions.find((o) => o.value === activeAccountTypeFilter)?.label ?? activeAccountTypeFilter}</span>
              <button className="ml-auto text-storm/60 hover:text-storm" onClick={() => setActiveAccountTypeFilter(null)} type="button">Limpiar ×</button>
            </div>
          ) : null}
          {typeFilteredAccountsBreakdown.length === 0 ? (
            <DataState
              action={<GhostLink label="Crear cuenta" to="/app/accounts" />}
              description="Tu primera cuenta abrirá automáticamente esta lectura por balance, participación y actividad."
              title="Aún no hay cuentas activas"
            />
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-3">
                {typeFilteredAccountsBreakdown.map((item) => {
                  const isActive = selectedAccount?.account.id === item.account.id;
                  const isCrossFiltered = activeAccountIdFilter === item.account.id;

                  return (
                    <button
                      className={`rounded-[24px] border p-4 text-left transition ${
                        isCrossFiltered
                          ? "border-gold/40 bg-gold/10"
                          : isActive
                            ? "border-pine/30 bg-pine/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={item.account.id}
                      onClick={() => {
                        setSelectedAccountId(item.account.id);
                        setActiveAccountIdFilter(activeAccountIdFilter === item.account.id ? null : item.account.id);
                      }}
                      title={
                        isCrossFiltered
                          ? "Quitar filtro de tendencia por esta cuenta"
                          : "Filtrar tendencia y ritmo semanal por movimientos que pasan por esta cuenta"
                      }
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
          titleAccessory={<DashboardHelpTrigger metricId="widget_receivable_leaders" />}
        >
          {activeObligationStatusFilter ? (
            <div className="mb-4 flex items-center gap-2 rounded-[14px] border border-gold/20 bg-gold/8 px-3 py-2 text-xs text-storm">
              Filtrando por estado:{" "}
              <span className="font-semibold text-ink">
                {obligationAgingBuckets.find((b) => b.key === activeObligationStatusFilter)?.label ?? activeObligationStatusFilter}
              </span>
              <button
                className="ml-auto text-storm/60 hover:text-storm"
                onClick={() => setActiveObligationStatusFilter(null)}
                type="button"
              >
                Limpiar ×
              </button>
            </div>
          ) : null}
          {carteraReceivableLeaders.length === 0 ? (
            <DataState
              action={<GhostLink label="Crear crédito" to="/app/obligations" />}
              description="Cuando registres ventas a cuotas o préstamos hechos por ti, aparecerán aquí ordenados por impacto."
              title="Todavía no tienes cuentas por cobrar"
            />
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-3">
                {carteraReceivableLeaders.map((item) => {
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
          titleAccessory={<DashboardHelpTrigger metricId="widget_payable_leaders" />}
        >
          {carteraPayableLeaders.length === 0 ? (
            <DataState
              action={<GhostLink label="Crear deuda" to="/app/obligations" />}
              description="Cuando registres compras a cuotas o préstamos recibidos, aquí verás quién pesa más sobre tu flujo."
              title="Todavía no tienes saldos por pagar"
            />
          ) : (
            <div className="grid gap-5">
              <div className="grid gap-3">
                {carteraPayableLeaders.map((item) => {
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

      <div className="mb-2 mt-4 flex items-start gap-3 border-t border-white/8 pt-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.6rem] font-bold text-storm">
          05
        </div>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink/70">Presupuestos activos</p>
          <p className="mt-1 text-xs leading-5 text-storm/50">Tus límites de gasto vigentes. Mirá cuánto espacio te queda antes de ver el detalle por categoría.</p>
        </div>
      </div>
      {showBudgetSection ? (
      <section className="grid gap-6 xl:grid-cols-1">
        <SurfaceCard
          action={<GhostLink label="Ver presupuestos" to="/app/budgets" />}
          description="Topes activos del período actual para ver rápido cuánto espacio te queda y dónde ya se está tensando el gasto."
          title="Presupuestos del período"
          titleAccessory={<DashboardHelpTrigger metricId="widget_budgets" />}
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
                  <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="budget_ceiling">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Techo activo</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {formatCurrency(currentBudgetLimitTotal, displayCurrencyCode)}
                    </p>
                  </DashboardKpiHelpWrap>
                  <DashboardKpiHelpWrap className="rounded-[22px] border border-ember/18 bg-ember/10 p-4" metricId="budget_consumed">
                    <p className="text-xs uppercase tracking-[0.18em] text-ember">Consumido</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {formatCurrency(currentBudgetSpentTotal, displayCurrencyCode)}
                    </p>
                  </DashboardKpiHelpWrap>
                  <DashboardKpiHelpWrap className="rounded-[22px] border border-pine/18 bg-pine/10 p-4" metricId="budget_remaining">
                    <p className="text-xs uppercase tracking-[0.18em] text-pine">Restante</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {formatCurrency(currentBudgetRemainingTotal, displayCurrencyCode)}
                    </p>
                  </DashboardKpiHelpWrap>
                  <DashboardKpiHelpWrap className="rounded-[22px] border border-gold/18 bg-gold/10 p-4" metricId="budget_at_risk">
                    <p className="text-xs uppercase tracking-[0.18em] text-gold">En riesgo</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {criticalCurrentBudgets.length}
                    </p>
                    <p className="mt-2 text-sm text-storm">
                      {overLimitCurrentBudgets.length} excedidos ahora.
                    </p>
                  </DashboardKpiHelpWrap>
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

      <div className="mb-2 mt-4 flex items-start gap-3 border-t border-white/8 pt-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.6rem] font-bold text-storm">
          06
        </div>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink/70">Categorías de gasto</p>
          <p className="mt-1 text-xs leading-5 text-storm/50">Comparativo de en qué gastaste este período vs el anterior. Identificá dónde está la oportunidad de mejora.</p>
        </div>
      </div>
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
          description="Comparativo del período actual vs la referencia anterior. Tocá una fila (o las pastillas de categoría arriba) para aplicar el mismo filtro de tendencia: recalcula ahorro día a día, flujos y ritmo semanal con solo esos movimientos."
          title="Comparativo por categorías"
          titleAccessory={<DashboardHelpTrigger metricId="widget_category_comparison" />}
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
                  const isCrossFiltered = activeCategoryFilter === item.name;

                  return (
                    <button
                      className={`rounded-[24px] border p-4 text-left transition ${
                        isCrossFiltered
                          ? "border-gold/35 bg-gold/12"
                          : isActive
                            ? "border-ember/30 bg-ember/10"
                            : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                      }`}
                      key={item.key}
                      onClick={() => {
                        setSelectedCategoryKey(item.key);
                        setActiveCategoryFilter(activeCategoryFilter === item.name ? null : item.name);
                      }}
                      title={
                        isCrossFiltered
                          ? "Quitar filtro de tendencia"
                          : "Filtrar tendencia y ritmo semanal por esta categoría"
                      }
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-ink">{item.name}</p>
                          <p className="mt-1 text-sm text-storm">
                            {item.currentCount} movimiento{item.currentCount === 1 ? "" : "s"} este
                            período
                          </p>
                          <p className="mt-1 text-xs font-medium text-storm/90">
                            Gasto {formatVsPreviousPeriodLabel(item.current, item.previous, comparison.previous.label)}
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
          titleAccessory={<DashboardHelpTrigger metricId="widget_monthly_pulse" />}
        >
          {monthlyPulse.length === 0 ? (
            <DataState
              description="Aún no hay movimientos aplicados para construir tu evolución mensual."
              title="Sin historia mensual"
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <div className="grid gap-3">
                {monthlyPulse.map((item, monthIndex) => {
                  const isActive = selectedMonth?.key === item.key;
                  const prevMonth = monthIndex > 0 ? monthlyPulse[monthIndex - 1] : null;
                  const netDeltaVsPrev = prevMonth ? item.net - prevMonth.net : null;

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
                          {netDeltaVsPrev !== null ? (
                            <p className="mt-1 text-xs text-storm/90">
                              Neto vs mes anterior:{" "}
                              <span className={netDeltaVsPrev >= 0 ? "text-pine" : "text-ember"}>
                                {formatDeltaCurrency(netDeltaVsPrev, displayCurrencyCode)}
                              </span>
                            </p>
                          ) : null}
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

      <div className="mb-2 mt-4 flex items-start gap-3 border-t border-white/8 pt-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.6rem] font-bold text-storm">
          07
        </div>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink/70">Hábitos y próximos compromisos</p>
          <p className="mt-1 text-xs leading-5 text-storm/50">Qué días concentrás más gasto, qué vence pronto y los últimos movimientos registrados.</p>
        </div>
      </div>
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
          description="Qué días de la semana suelen darte aire y cuáles presionan más. Respeta el mismo filtro de categoría o cuenta que las gráficas de tendencia."
          title="Ritmo semanal"
          titleAccessory={<DashboardHelpTrigger metricId="widget_weekly_pattern" />}
        >
          {hasCrossMovementFilter ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-gold/20 bg-gold/8 px-3 py-2 text-xs text-storm">
              <span className="font-medium text-storm/80">Filtro tendencia:</span>
              {activeCategoryFilter ? (
                <span className="font-semibold text-ink">categoría &quot;{activeCategoryFilter}&quot;</span>
              ) : null}
              {activeCategoryFilter && activeAccountIdFilter !== null ? <span>+</span> : null}
              {activeAccountIdFilter !== null ? (
                <span className="font-semibold text-ink">cuenta &quot;{activeAccountFilterName}&quot;</span>
              ) : null}
              <button
                className="ml-auto text-storm/60 hover:text-storm"
                onClick={() => { setActiveCategoryFilter(null); setActiveAccountIdFilter(null); }}
                type="button"
              >
                Limpiar ×
              </button>
            </div>
          ) : null}
          {crossFilteredWeekdayPattern.every((item) => item.movementCount === 0) ? (
            <DataState
              description="Con algunos movimientos aplicados ya se puede detectar qué días concentran ingresos o gasto."
              title="Sin patrón semanal todavía"
            />
          ) : (
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="grid gap-3">
                {crossFilteredWeekdayPattern.map((item) => {
                  const isActive = crossFilteredSelectedWeekday?.key === item.key;

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
                            style={{ width: `${(item.income / maxCrossFilteredWeekdayAmount) * 100}%` }}
                          />
                        </div>
                        <div className="h-2 rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-ember"
                            style={{ width: `${(item.expense / maxCrossFilteredWeekdayAmount) * 100}%` }}
                          />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {crossFilteredSelectedWeekday ? (
                <article className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Día activo</p>
                  <h4 className="mt-3 font-display text-3xl font-semibold text-ink">
                    {crossFilteredSelectedWeekday.label}
                  </h4>
                  <div className="mt-5 grid gap-3">
                    <div className="rounded-[20px] border border-pine/18 bg-pine/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-pine">Entradas</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(crossFilteredSelectedWeekday.income, displayCurrencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-ember/18 bg-ember/10 p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-ember">Salidas</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(crossFilteredSelectedWeekday.expense, displayCurrencyCode)}
                      </p>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-storm">
                    {crossFilteredSelectedWeekday.net >= 0
                      ? "Suele ser un día que te deja aire positivo."
                      : "Suele ser un día que aprieta tu caja. Si quieres ahorrar más, revisa qué pasa aquí."}
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
          titleAccessory={<DashboardHelpTrigger metricId="widget_upcoming_recent" />}
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
                  {upcomingCommitments.slice(0, 6).map((item) => (
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
                          tone={item.kind === "Por cobrar" || item.kind === "Ingreso fijo" ? "success" : "warning"}
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

      <div className="mb-2 mt-4 flex items-start gap-3 border-t border-white/8 pt-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.6rem] font-bold text-storm">
          08
        </div>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink/70">Centro de mando</p>
          <p className="mt-1 text-xs leading-5 text-storm/50">Acciones sugeridas, meta de ahorro del mes, presión de la semana y señales del período (Pro).</p>
        </div>
      </div>
      {showProFocusSection ? (
        <section
          className={`grid gap-6 ${
            isWidgetVisible("pro_command_center") &&
            isWidgetVisible("pro_intelligence_digest") &&
            isWidgetVisible("pro_goals_strip")
              ? "xl:grid-cols-[1.1fr_1fr_0.9fr]"
              : "xl:grid-cols-1"
          }`}
        >
          {isWidgetVisible("pro_command_center") ? (
            <SurfaceCard
              description="Prioridades con enlace directo, presión de la semana, proyección simple a fin de mes y una recomendación. La bandeja Por revisar concentra la cola de mantenimiento del workspace."
              title="Acciones y foco"
              titleAccessory={<DashboardHelpTrigger metricId="widget_pro_command_center" />}
            >
              <div className="grid gap-6">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Acciones sugeridas</p>
                  {suggestedProActions.length === 0 ? (
                    <p className="mt-3 text-sm text-storm">No hay acciones urgentes detectadas. Buen momento para revisar metas o categorías.</p>
                  ) : (
                    <ul className="mt-3 grid gap-2">
                      {suggestedProActions.map((action) => (
                        <li key={action.key}>
                          <Link
                            className="flex items-start justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-4 transition hover:border-gold/25 hover:bg-white/[0.05]"
                            to={action.href}
                          >
                            <div className="min-w-0">
                              <p className="font-semibold text-ink">{action.title}</p>
                              <p className="mt-1 text-sm leading-6 text-storm">{action.detail}</p>
                            </div>
                            <ChevronRight className="mt-0.5 h-5 w-5 shrink-0 text-storm" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Próxima presión financiera (7 días)</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[18px] border border-pine/18 bg-pine/10 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-pine">Entra</p>
                      <p className="mt-2 font-display text-lg font-semibold text-ink">
                        {formatCurrency(proWeekPressure.expectedInflow, displayCurrencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-ember/18 bg-ember/10 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-ember">Sale</p>
                      <p className="mt-2 font-display text-lg font-semibold text-ink">
                        {formatCurrency(proWeekPressure.expectedOutflow, displayCurrencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-storm">Balance neto</p>
                      <p className="mt-2 font-display text-lg font-semibold text-ink">
                        {formatCurrency(
                          proWeekPressure.expectedInflow - proWeekPressure.expectedOutflow,
                          displayCurrencyCode,
                        )}
                      </p>
                      <p className="mt-1 text-xs text-storm">
                        Caja estimada después: {formatCurrency(proWeekPressure.estimatedBalance, displayCurrencyCode)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-gold/20 bg-gold/10 p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-gold">Caja estimada a fin de mes</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {formatCurrency(monthEndEstimate.estimatedLiquidAtMonthEnd, displayCurrencyCode)}
                    </p>
                    <p className="mt-2 text-xs leading-5 text-storm">
                      Extrapolación desde tu neto del mes (día {monthEndEstimate.daysElapsedInMonth}): ingresos{" "}
                      {formatCurrency(monthEndEstimate.incomeMonthToDate, displayCurrencyCode)} · gastos{" "}
                      {formatCurrency(monthEndEstimate.expenseMonthToDate, displayCurrencyCode)}. No incluye todo lo
                      impredecible.
                    </p>
                  </div>
                  <div
                    className={`rounded-[22px] border p-4 ${
                      primaryProRecommendation.tone === "danger"
                        ? "border-ember/25 bg-ember/10"
                        : primaryProRecommendation.tone === "warning"
                          ? "border-gold/25 bg-gold/10"
                          : primaryProRecommendation.tone === "success"
                            ? "border-pine/25 bg-pine/10"
                            : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Recomendación prioritaria</p>
                    <p className="mt-3 text-sm leading-7 text-ink">{primaryProRecommendation.text}</p>
                  </div>
                </div>
              </div>
            </SurfaceCard>
          ) : null}

          {isWidgetVisible("pro_intelligence_digest") ? (
            <SurfaceCard
              description="Resume patrones del período, desvíos y la cola de limpieza sin repetir todo el panel de alertas."
              title="Insights del período"
              titleAccessory={<DashboardHelpTrigger metricId="widget_pro_intelligence_digest" />}
            >
              <div className="grid gap-5">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Señales automáticas</p>
                  <div className="mt-3 grid gap-2">
                    {learningSnapshot.insights.slice(0, 3).map((insight, insightIndex) => (
                      <article
                        className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3"
                        key={`${insight.title}-${insightIndex}`}
                      >
                        <p className="font-semibold text-ink">{insight.title}</p>
                        <p className="mt-1 text-sm leading-6 text-storm">{insight.description}</p>
                      </article>
                    ))}
                    {topBalanceAccount && topBalanceAccount.share >= 0.52 ? (
                      <article className="rounded-[18px] border border-white/10 bg-white/[0.03] p-3">
                        <p className="font-semibold text-ink">Concentración en una cuenta</p>
                        <p className="mt-1 text-sm leading-6 text-storm">
                          {topBalanceAccount.account.name} concentra {formatPercentage(topBalanceAccount.share)} del
                          dinero visible: casi todo el gasto operativo pasa por ahí.
                        </p>
                      </article>
                    ) : null}
                    {healthSnapshot.coverageMonths !== null && healthSnapshot.coverageMonths * 30 >= 14 ? (
                      <article className="rounded-[18px] border border-pine/18 bg-pine/10 p-3">
                        <p className="font-semibold text-ink">Colchón reciente</p>
                        <p className="mt-1 text-sm leading-6 text-storm">
                          Con el ritmo de gasto que miramos, tu liquidez cubre alrededor de{" "}
                          {(healthSnapshot.coverageMonths * 30).toFixed(0)} días (orden de magnitud).
                        </p>
                      </article>
                    ) : null}
                    {learningSnapshot.insights.length === 0 &&
                    !(topBalanceAccount && topBalanceAccount.share >= 0.52) &&
                    !(healthSnapshot.coverageMonths !== null && healthSnapshot.coverageMonths * 30 >= 14) ? (
                      <p className="text-sm text-storm">Aún no hay suficiente historia para insights automáticos.</p>
                    ) : null}
                  </div>
                </div>

                <div>
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Gasto fuera de patrón</p>
                  {unusualSpendingLines.length === 0 ? (
                    <p className="mt-3 text-sm text-storm">No detectamos categorías ni movimientos claramente fuera de tono.</p>
                  ) : (
                    <ul className="mt-3 grid gap-2">
                      {unusualSpendingLines.map((line) => (
                        <li
                          className="rounded-[18px] border border-ember/18 bg-ember/8 px-3 py-2 text-sm text-storm"
                          key={line.key}
                        >
                          <span className="font-semibold text-ink">{line.label}</span> — {line.detail}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                  <div>
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Movimientos por revisar</p>
                    <p className="mt-2 text-sm text-storm">
                      {uncategorizedMovements.length} sin categoría ·{" "}
                      {displayMovements.filter((m) => m.status === "pending").length} pendientes de aplicar.
                    </p>
                  </div>
                  <GhostLink label="Ir a movimientos" to="/app/movements" />
                </div>
              </div>
            </SurfaceCard>
          ) : null}

          {isWidgetVisible("pro_goals_strip") ? (
            <div className="scroll-mt-24 md:scroll-mt-28" id={DASHBOARD_META_DISCIPLINA_ANCHOR_ID}>
            <SurfaceCard
              description="Meta de ahorro neto del mes guardada en tu cuenta (por usuario y workspace), a partir de los movimientos aplicados del mes calendario."
              title="Meta y disciplina"
              titleAccessory={<DashboardHelpTrigger metricId="widget_pro_goals_strip" />}
            >
              <div className="grid gap-5">
                <div>
                  <label className="text-[0.65rem] uppercase tracking-[0.2em] text-storm" htmlFor="pro-monthly-goal">
                    Meta de ahorro neto del mes ({displayCurrencyCode})
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <input
                      className="min-w-[8rem] flex-1 rounded-[16px] border border-white/12 bg-white/[0.05] px-4 py-2.5 text-ink outline-none focus:border-gold/40"
                      id="pro-monthly-goal"
                      inputMode="decimal"
                      onChange={(event) => {
                        setProGoalSaveError(null);
                        setProGoalDraft(event.target.value);
                      }}
                      placeholder="Ej. 800"
                      value={proGoalDraft}
                    />
                    <Button
                      disabled={!user?.id || upsertFinancialGoalMutation.isPending}
                      onClick={async () => {
                        if (!user?.id) {
                          return;
                        }

                        const normalized = proGoalDraft.replace(",", ".").trim();
                        const value = Number.parseFloat(normalized);
                        const workspaceId = snapshot.workspace.id;

                        try {
                          if (Number.isFinite(value) && value > 0) {
                            await upsertFinancialGoalMutation.mutateAsync({
                              workspaceId,
                              userId: user.id,
                              monthlySavingsTarget: value,
                            });
                            writeMonthlySavingsTarget(workspaceId, null);
                            setProMonthlyGoal(value);
                          } else {
                            await upsertFinancialGoalMutation.mutateAsync({
                              workspaceId,
                              userId: user.id,
                              monthlySavingsTarget: null,
                            });
                            writeMonthlySavingsTarget(workspaceId, null);
                            setProMonthlyGoal(null);
                            setProGoalDraft("");
                          }

                          setProGoalSaveError(null);
                        } catch (error) {
                          const message = error instanceof Error ? error.message : "";
                          if (message.includes("workspace_financial_goals")) {
                            if (Number.isFinite(value) && value > 0) {
                              writeMonthlySavingsTarget(workspaceId, value);
                              setProMonthlyGoal(value);
                            } else {
                              writeMonthlySavingsTarget(workspaceId, null);
                              setProMonthlyGoal(null);
                              setProGoalDraft("");
                            }
                            setProGoalSaveError(null);
                            return;
                          }

                          setProGoalSaveError(getQueryErrorMessage(error, "No se pudo guardar la meta."));
                        }
                      }}
                      type="button"
                      variant="primary"
                    >
                      {upsertFinancialGoalMutation.isPending ? "Guardando…" : "Guardar"}
                    </Button>
                  </div>
                  {proGoalSaveError ? (
                    <p className="mt-2 text-sm text-ember" role="alert">
                      {proGoalSaveError}
                    </p>
                  ) : null}
                </div>

                {proMonthlyGoal !== null && proMonthlyGoal > 0 ? (
                  <div className="rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-pine">Progreso del mes</p>
                    <p className="mt-3 font-display text-2xl font-semibold text-ink">
                      {formatCurrency(Math.max(0, currentCalendarMonthNet), displayCurrencyCode)}
                      <span className="text-base font-normal text-storm">
                        {" "}
                        / {formatCurrency(proMonthlyGoal, displayCurrencyCode)}
                      </span>
                    </p>
                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-pine to-emerald-300"
                        style={{
                          width: `${Math.min(100, Math.max(6, (currentCalendarMonthNet / proMonthlyGoal) * 100))}%`,
                        }}
                      />
                    </div>
                    {currentCalendarMonthNet < proMonthlyGoal ? (
                      <p className="mt-3 text-sm text-storm">
                        Te faltan{" "}
                        {formatCurrency(Math.max(0, proMonthlyGoal - currentCalendarMonthNet), displayCurrencyCode)} para
                        cerrar la meta este mes.
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-pine">Meta alcanzada o superada en el mes en curso.</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-storm">
                    Define un monto de ahorro neto mensual para ver aquí cuánto llevas según los movimientos aplicados
                    del mes calendario.
                  </p>
                )}

                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Racha de registro</p>
                  <p className="mt-3 font-display text-2xl font-semibold text-ink">{distinctPostingDaysThisMonth}</p>
                  <p className="mt-1 text-sm text-storm">
                    Días distintos con al menos un movimiento aplicado en el mes actual.
                  </p>
                </div>
              </div>
            </SurfaceCard>
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="mb-2 mt-4 flex items-start gap-3 border-t border-white/8 pt-6">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-[0.6rem] font-bold text-storm">
          09
        </div>
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-ink/70">Análisis avanzado</p>
          <p className="mt-1 text-xs leading-5 text-storm/50">Riesgo de cartera, flujo futuro, recurrentes, aprendizaje automático y contexto del equipo.</p>
        </div>
      </div>
      {showAdvancedOpsSection ? (
        <>
          <div className="mb-1 flex items-center gap-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-storm/60">Cartera y vencimientos</p>
            <div className="h-px flex-1 bg-white/6" />
          </div>
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
                  titleAccessory={<DashboardHelpTrigger metricId="widget_obligation_watch" />}
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
                        <DashboardKpiHelpWrap className="rounded-[22px] border border-pine/18 bg-pine/10 p-4" metricId="obligation_due_soon">
                          <p className="text-xs uppercase tracking-[0.18em] text-pine">Por vencer</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(
                              obligationAgingBuckets.find((item) => item.key === "due_soon")?.amount ?? 0,
                              displayCurrencyCode,
                            )}
                          </p>
                        </DashboardKpiHelpWrap>
                        <DashboardKpiHelpWrap className="rounded-[22px] border border-ember/18 bg-ember/10 p-4" metricId="obligation_overdue_block">
                          <p className="text-xs uppercase tracking-[0.18em] text-ember">Vencido</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(overdueAmount, displayCurrencyCode)}
                          </p>
                        </DashboardKpiHelpWrap>
                        <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="obligation_collected_period">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Cobrado este corte</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(collectedThisPeriod, displayCurrencyCode)}
                          </p>
                        </DashboardKpiHelpWrap>
                        <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="obligation_paid_period">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Pagado este corte</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(paidThisPeriod, displayCurrencyCode)}
                          </p>
                        </DashboardKpiHelpWrap>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                        {obligationAgingBuckets.map((bucket) => {
                          const isBucketActive = activeObligationStatusFilter === bucket.key;
                          return (
                          <button
                            className={`relative rounded-[22px] border p-4 text-left transition ${
                              isBucketActive
                                ? "border-gold/40 bg-gold/10"
                                : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                            }`}
                            key={bucket.key}
                            onClick={() =>
                              setActiveObligationStatusFilter(
                                activeObligationStatusFilter === bucket.key ? null : bucket.key,
                              )
                            }
                            type="button"
                          >
                            <div className="absolute right-3 top-3 z-[1]">
                              <DashboardHelpTrigger metricId={`obligation_bucket_${bucket.key}`} />
                            </div>
                            <div className="flex items-start justify-between gap-3 pr-10">
                              <p className="text-sm font-semibold text-ink">{bucket.label}</p>
                              <StatusBadge status={`${bucket.count}`} tone={bucket.tone} />
                            </div>
                            <p className="mt-3 font-display text-2xl font-semibold text-ink">
                              {formatCurrency(bucket.amount, displayCurrencyCode)}
                            </p>
                          </button>
                        );
                        })}
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
                  titleAccessory={<DashboardHelpTrigger metricId="widget_future_flow" />}
                >
                  <div className="mb-4 rounded-[22px] border border-gold/20 bg-gold/8 p-4">
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-storm">Lectura rápida (mes calendario)</p>
                    <p className="mt-2 font-display text-lg font-semibold text-ink sm:text-xl">
                      Si mantenés el ritmo de este mes, al cierre tu caja líquida rondaría{" "}
                      {formatCurrency(monthEndEstimate.estimatedLiquidAtMonthEnd, displayCurrencyCode)}.
                    </p>
                    <p className="mt-2 text-xs text-storm">
                      Misma estimación que en Resumen principal; aquí abajo el detalle por ventana de días.
                    </p>
                  </div>
                  <div className="grid gap-4">
                    {futureFlowWindows.map((window) => (
                      <article
                        className="relative rounded-[24px] border border-white/10 bg-white/[0.03] p-5"
                        key={window.days}
                      >
                        <div className="absolute right-4 top-4 z-[1]">
                          <DashboardHelpTrigger metricId="future_flow_window" />
                        </div>
                        <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
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

          <div className="mb-1 mt-4 flex items-center gap-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-storm/60">Alertas y calidad del dato</p>
            <div className="h-px flex-1 bg-white/6" />
          </div>
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
                  titleAccessory={<DashboardHelpTrigger metricId="widget_alert_center" />}
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
                  description="Contadores de completitud para comparativos y reportes. Para una cola accionable (categorías, duplicados, cartera, etc.) usá el widget Por revisar si lo tenés visible."
                  title="Calidad de datos"
                  titleAccessory={<DashboardHelpTrigger metricId="widget_data_quality" />}
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

          <div className="mb-1 mt-4 flex items-center gap-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-storm/60">Recurrentes y exposición cambiaria</p>
            <div className="h-px flex-1 bg-white/6" />
          </div>
          {(isWidgetVisible("subscriptions_snapshot") ||
            isWidgetVisible("transfer_snapshot") ||
            isWidgetVisible("currency_exposure")) ? (
            <section className="grid gap-6 xl:grid-cols-3">
              {isWidgetVisible("subscriptions_snapshot") ? (
                <SurfaceCard
                  action={<GhostLink label="Ver suscripciones" to="/app/subscriptions" />}
                  description="Lectura recurrente para saber cuánto pesan tus cargos fijos y cuál es el siguiente en caer."
                  title="Pulso de suscripciones"
                  titleAccessory={<DashboardHelpTrigger metricId="widget_subscriptions_snapshot" />}
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
                        <DashboardKpiHelpWrap className="rounded-[22px] border border-pine/18 bg-pine/10 p-4" metricId="sub_monthly_cost">
                          <p className="text-xs uppercase tracking-[0.18em] text-pine">Costo mensual</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(monthlyRecurringCost, displayCurrencyCode)}
                          </p>
                        </DashboardKpiHelpWrap>
                        <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="sub_active_paused">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Activas / pausadas</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {activeSubscriptions.length} / {pausedSubscriptions.length}
                          </p>
                        </DashboardKpiHelpWrap>
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
                  titleAccessory={<DashboardHelpTrigger metricId="widget_transfer_snapshot" />}
                >
                  {visibleTransferRoutes.length === 0 ? (
                    <DataState
                      description="Todavía no hay transferencias aplicadas en el período seleccionado."
                      title="Sin flujo interno"
                    />
                  ) : (
                    <div className="grid gap-5">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="transfer_total_snapshot">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Transferido</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {formatCurrency(totalTransferredThisPeriod, displayCurrencyCode)}
                          </p>
                        </DashboardKpiHelpWrap>
                        <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="transfer_count_snapshot">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Cantidad</p>
                          <p className="mt-3 font-display text-2xl font-semibold text-ink">
                            {currentPeriodTransfers.length}
                          </p>
                        </DashboardKpiHelpWrap>
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
                  titleAccessory={<DashboardHelpTrigger metricId="widget_currency_exposure" />}
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
                          className="relative rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
                          key={item.currencyCode}
                        >
                          <div className="absolute right-3 top-3 z-[1]">
                            <DashboardHelpTrigger metricId="widget_currency_exposure" />
                          </div>
                          <div className="flex items-start justify-between gap-3 pr-10">
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

          <div className="mb-1 mt-4 flex items-center gap-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-storm/60">Aprendizaje y señales</p>
            <div className="h-px flex-1 bg-white/6" />
          </div>
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
                titleAccessory={<DashboardHelpTrigger metricId="widget_learning_panel" />}
              >
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="learn_movements_useful">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Movimientos utiles</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {learningSnapshot.totalPostedMovements}
                      </p>
                    </DashboardKpiHelpWrap>
                    <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="learn_history_days">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Historial</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {learningSnapshot.historyDays} dias
                      </p>
                    </DashboardKpiHelpWrap>
                    <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="learn_category_quality">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Calidad de categorias</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatPercentage(learningSnapshot.categorizedRate)}
                      </p>
                    </DashboardKpiHelpWrap>
                    <DashboardKpiHelpWrap className="rounded-[22px] border border-pine/18 bg-pine/10 p-4" metricId="learn_confidence">
                      <p className="text-xs uppercase tracking-[0.18em] text-pine">Confianza actual</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {learningSnapshot.readinessScore}%
                      </p>
                    </DashboardKpiHelpWrap>
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
                titleAccessory={<DashboardHelpTrigger metricId="widget_active_signals" />}
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

          <div className="mb-1 mt-4 flex items-center gap-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-storm/60">Equipo y colaboración</p>
            <div className="h-px flex-1 bg-white/6" />
          </div>
          {isWidgetVisible("workspace_collaboration") ? (
            <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <SurfaceCard
                action={<StatusBadge status={`Workspace ${formatWorkspaceKindLabel(activeWorkspace.kind)}`} tone="info" />}
                description="Lectura del workspace activo y de la colaboración reciente para saber cuánto movimiento humano hubo en este entorno."
                title="Colaboración del workspace"
                titleAccessory={<DashboardHelpTrigger metricId="widget_workspace_collaboration" />}
              >
                <div className="grid gap-4">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="collab_role">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Tu rol</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatWorkspaceRoleLabel(activeWorkspace.role)}
                      </p>
                    </DashboardKpiHelpWrap>
                    <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="collab_personal_count">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Personales</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{personalWorkspaceCount}</p>
                    </DashboardKpiHelpWrap>
                    <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="collab_shared_count">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Compartidos</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{sharedWorkspaceCount}</p>
                    </DashboardKpiHelpWrap>
                    <DashboardKpiHelpWrap className="rounded-[22px] border border-pine/18 bg-pine/10 p-4" metricId="collab_activity_cut">
                      <p className="text-xs uppercase tracking-[0.18em] text-pine">Actividad del corte</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{collaborationActivity.length}</p>
                    </DashboardKpiHelpWrap>
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
                titleAccessory={<DashboardHelpTrigger metricId="widget_activity_actor" />}
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

          <div className="mb-1 mt-4 flex items-center gap-2">
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-storm/60">Salud financiera y actividad</p>
            <div className="h-px flex-1 bg-white/6" />
          </div>
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
                  titleAccessory={<DashboardHelpTrigger metricId="widget_health_center" />}
                >
                  <div className="grid gap-4">
                    <article className="rounded-[24px] border border-white/10 bg-white/[0.03] p-5">
                      <p className="text-sm leading-7 text-storm">{healthSnapshot.description}</p>
                    </article>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="health_real_liquidity">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Liquidez real</p>
                        <p className="mt-3 font-display text-2xl font-semibold text-ink">
                          {formatCurrency(healthSnapshot.realFreeMoney, displayCurrencyCode)}
                        </p>
                      </DashboardKpiHelpWrap>
                      <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="health_savings_capacity">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Capacidad de ahorro</p>
                        <p className="mt-3 font-display text-2xl font-semibold text-ink">
                          {formatPercentage(Math.max(0, savingsCapacity))}
                        </p>
                      </DashboardKpiHelpWrap>
                      <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="health_coverage_months">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Cobertura mensual</p>
                        <p className="mt-3 font-display text-2xl font-semibold text-ink">
                          {healthSnapshot.coverageMonths !== null ? `${healthSnapshot.coverageMonths.toFixed(1)} meses` : "Sin dato"}
                        </p>
                      </DashboardKpiHelpWrap>
                      <DashboardKpiHelpWrap className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4" metricId="health_debt_to_income">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Deuda / ingreso</p>
                        <p className="mt-3 font-display text-2xl font-semibold text-ink">
                          {healthSnapshot.debtToIncomeRatio !== null ? `${(healthSnapshot.debtToIncomeRatio * 100).toFixed(0)}%` : "Sin dato"}
                        </p>
                      </DashboardKpiHelpWrap>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <article className="relative rounded-[22px] border border-gold/18 bg-gold/10 p-4">
                        <div className="absolute right-3 top-3 z-[1]">
                          <DashboardHelpTrigger metricId="health_next_payable" />
                        </div>
                        <p className="pr-10 text-xs uppercase tracking-[0.18em] text-gold">Lo próximo a pagar</p>
                        <p className="mt-3 font-semibold text-ink">
                          {nextPayableDue ? nextPayableDue.title : "Sin deuda próxima"}
                        </p>
                        <p className="mt-1 text-sm text-storm">
                          {nextPayableDue
                            ? `${formatCurrency(nextPayableDue.pendingAmount, displayCurrencyCode)} · ${formatDate(nextPayableDue.dueDate as string)}`
                            : "No hay compromisos por pagar cercanos."}
                        </p>
                      </article>
                      <article className="relative rounded-[22px] border border-pine/18 bg-pine/10 p-4">
                        <div className="absolute right-3 top-3 z-[1]">
                          <DashboardHelpTrigger metricId="health_next_receivable" />
                        </div>
                        <p className="pr-10 text-xs uppercase tracking-[0.18em] text-pine">Lo próximo a cobrar</p>
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
                  titleAccessory={<DashboardHelpTrigger metricId="widget_activity_timeline" />}
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
    </DashboardHelpProvider>
  );
}
