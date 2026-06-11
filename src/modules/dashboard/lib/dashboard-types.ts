import type { AccountSummary, SubscriptionSummary } from "../../../types/domain";

export type ComparisonPreset = "today" | "week" | "month" | "last30";

export type ComparisonWindow = {
  start: Date;
  end: Date;
  label: string;
  detail: string;
};

export type ComparisonDefinition = {
  preset: ComparisonPreset;
  current: ComparisonWindow;
  previous: ComparisonWindow;
  caption: string;
};

export type DailySavingsPoint = {
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

export type DailyFlowPoint = {
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

export type ChronologicalTrendTab = "savings" | "expense" | "income" | "transfer";

export type CategoryComparisonItem = {
  key: string;
  name: string;
  current: number;
  previous: number;
  delta: number;
  currentCount: number;
  previousCount: number;
  share: number;
};

export type AccountBreakdownItem = {
  account: AccountSummary;
  amount: number;
  share: number;
  periodMovementCount: number;
};

export type ExposureItem = {
  key: string;
  counterpartyId: number | null;
  counterparty: string;
  amount: number;
  obligationCount: number;
  latestDate: string | null;
  titles: string[];
};

export type MonthPulseItem = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  movementCount: number;
  startDate: Date;
};

export type WeekdayItem = {
  key: string;
  label: string;
  income: number;
  expense: number;
  net: number;
  movementCount: number;
};

export type PeriodTotals = {
  income: number;
  expense: number;
  net: number;
  movementCount: number;
};

export type DashboardMode = "simple" | "advanced";

export type DashboardWidgetId =
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

export type DashboardWidgetDefinition = {
  id: DashboardWidgetId;
  label: string;
  helper: string;
  modes: DashboardMode[];
};

export type SubscriptionHighlightItem = {
  id: number;
  name: string;
  vendor: string;
  amount: number;
  monthlyAmount: number;
  nextDueDate: string;
  status: SubscriptionSummary["status"];
  categoryName?: string | null;
};

export type TransferRouteItem = {
  key: string;
  label: string;
  source: string;
  destination: string;
  amount: number;
  count: number;
};

export type CurrencyExposureItem = {
  currencyCode: string;
  amount: number;
  share: number;
  accountCount: number;
};

export type FinancialHealthSnapshot = {
  tone: "success" | "warning" | "danger";
  title: string;
  description: string;
  realFreeMoney: number;
  savingsRate: number | null;
  coverageMonths: number | null;
  debtToIncomeRatio: number | null;
  overdueAmount: number;
};

export type LearningInsightTone = "neutral" | "success" | "warning" | "danger" | "info";

export type LearningPhaseDefinition = {
  step: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  minMovements: number;
  minHistoryDays: number;
  minCategorizedRate: number;
  minDistinctMonths: number;
  minDistinctCategories: number;
};

export type LearningPhaseStatus = {
  step: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  unlocked: boolean;
  progress: number;
  remainingRequirements: string[];
};

export type LearningInsight = {
  title: string;
  description: string;
  tone: LearningInsightTone;
};

export type LearningSnapshot = {
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

export type AggregateAmountDisplayItem = {
  currencyCode: string;
  amount: number;
  amountInBaseCurrency?: number | null;
};

export const comparisonOptions: Array<{
  value: ComparisonPreset;
  label: string;
  helper: string;
}> = [
  { value: "today", label: "Hoy vs ayer", helper: "corte diario" },
  { value: "week", label: "Semana vs anterior", helper: "hasta hoy" },
  { value: "month", label: "Mes vs anterior", helper: "mismo tramo" },
  { value: "last30", label: "30 dias vs 30 previos", helper: "ventana movil" },
];

export const topOptions = [5, 8, 12];
/** Lunes–domingo; índice = (date.getDay() + 6) % 7 (lunes = 0). */
export const weekdayLabelsFull = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
/** Abreviaturas para ejes de gráficos con pocos puntos. */
export const weekdayLabelsShort = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];
export const DASHBOARD_CURRENCY_STORAGE_KEY = "darkmoney.dashboard.displayCurrency";
export const DASHBOARD_MODE_STORAGE_KEY = "darkmoney.dashboard.mode";
export const DASHBOARD_HIDDEN_WIDGETS_STORAGE_KEY = "darkmoney.dashboard.hiddenWidgets";
/** Ancla para scroll desde el resumen (meta vacía / editar meta) al widget Meta y disciplina. */
export const DASHBOARD_META_DISCIPLINA_ANCHOR_ID = "dashboard-widget-meta-disciplina";

export const dashboardModeOptions: Array<{ value: DashboardMode; label: string; helper: string }> = [
  { value: "simple", label: "Vista simple", helper: "solo lo esencial" },
  { value: "advanced", label: "Vista avanzada", helper: "más análisis" },
];

export const dashboardWidgetDefinitions: DashboardWidgetDefinition[] = [
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
export const learningPhaseDefinitions: LearningPhaseDefinition[] = [
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
