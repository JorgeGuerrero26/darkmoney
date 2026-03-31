import type { MovementRecord, ObligationSummary, SubscriptionSummary } from "../../../types/domain";

export type SuggestedProAction = {
  key: string;
  title: string;
  detail: string;
  href: string;
  priority: number;
};

export type FlowWindowSummary = {
  days: number;
  expectedInflow: number;
  expectedOutflow: number;
  estimatedBalance: number;
};

export type MonthEndEstimate = {
  incomeMonthToDate: number;
  expenseMonthToDate: number;
  daysElapsedInMonth: number;
  daysRemainingInMonth: number;
  estimatedLiquidAtMonthEnd: number;
};

export type UnusualLine = {
  key: string;
  label: string;
  detail: string;
};

export type PrimaryRecommendation = {
  text: string;
  tone: "success" | "warning" | "danger" | "info";
};

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toDayKey(iso: string) {
  return iso.slice(0, 10);
}

type Classify = (
  movement: MovementRecord,
) => { kind: "income" | "expense"; amount: number } | null;
type IncomeAmt = (movement: MovementRecord) => number;
type ExpenseAmt = (movement: MovementRecord) => number;

export function buildMonthEndEstimate(
  now: Date,
  liquidMoneyTotal: number,
  postedMovements: MovementRecord[],
  classifyMovement: Classify,
  getIncomeAmount: IncomeAmt,
  getExpenseAmount: ExpenseAmt,
): MonthEndEstimate {
  const monthStart = startOfMonth(now);
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemainingInMonth = Math.max(0, lastDay - dayOfMonth);
  const daysElapsedInMonth = Math.max(1, dayOfMonth);

  let incomeMonthToDate = 0;
  let expenseMonthToDate = 0;

  for (const movement of postedMovements) {
    if (movement.status !== "posted" || movement.movementType === "transfer") {
      continue;
    }
    const t = new Date(movement.occurredAt).getTime();
    if (t < monthStart.getTime() || t > now.getTime()) {
      continue;
    }
    const c = classifyMovement(movement);
    if (!c) {
      continue;
    }
    if (c.kind === "income") {
      incomeMonthToDate += getIncomeAmount(movement);
    } else {
      expenseMonthToDate += getExpenseAmount(movement);
    }
  }

  const netMonthToDate = incomeMonthToDate - expenseMonthToDate;
  const avgDailyNet = netMonthToDate / daysElapsedInMonth;
  const estimatedLiquidAtMonthEnd = liquidMoneyTotal + avgDailyNet * daysRemainingInMonth;

  return {
    incomeMonthToDate,
    expenseMonthToDate,
    daysElapsedInMonth,
    daysRemainingInMonth,
    estimatedLiquidAtMonthEnd,
  };
}

export function buildSuggestedProActions(input: {
  overdueAmount: number;
  receivableTotal: number;
  payableTotal: number;
  uncategorizedCount: number;
  pendingMovementsCount: number;
  criticalBudgetCount: number;
  duplicateMovementGroups: number;
  idleSubscriptionName: string | null;
}): SuggestedProAction[] {
  const actions: SuggestedProAction[] = [];

  if (input.overdueAmount > 0) {
    actions.push({
      key: "pay-urgent",
      title: "Pagar o cobrar lo más urgente",
      detail: "Hay montos vencidos: conviene cerrarlos o reprogramarlos antes de que crezcan.",
      href: "/app/obligations",
      priority: 1,
    });
  }

  if (input.receivableTotal > 0) {
    actions.push({
      key: "collect",
      title: "Reclamar cobros pendientes",
      detail: "Tienes cuentas por cobrar activas. Un recordatorio suele acelerar el ingreso.",
      href: "/app/obligations",
      priority: 2,
    });
  }

  if (input.payableTotal > 0 && input.overdueAmount <= 0) {
    actions.push({
      key: "schedule-pay",
      title: "Revisar próximos pagos",
      detail: "Anticipa lo que debes para no sorprenderte con la caja.",
      href: "/app/obligations",
      priority: 5,
    });
  }

  if (input.uncategorizedCount > 0) {
    actions.push({
      key: "categorize",
      title: "Categorizar movimientos sin clasificar",
      detail: `${input.uncategorizedCount} movimiento${input.uncategorizedCount === 1 ? "" : "s"} sin categoría afectan comparativos e insights.`,
      href: "/app/movements",
      priority: 3,
    });
  }

  if (input.pendingMovementsCount > 0) {
    actions.push({
      key: "confirm-pending",
      title: "Confirmar movimientos pendientes",
      detail: `${input.pendingMovementsCount} aún no aplican al saldo real.`,
      href: "/app/movements",
      priority: 4,
    });
  }

  if (input.criticalBudgetCount > 0) {
    actions.push({
      key: "budgets",
      title: "Ajustar presupuesto en riesgo",
      detail: `${input.criticalBudgetCount} presupuesto${input.criticalBudgetCount === 1 ? "" : "s"} en alerta o excedido${input.criticalBudgetCount === 1 ? "" : "s"}.`,
      href: "/app/budgets",
      priority: 3,
    });
  }

  if (input.duplicateMovementGroups > 0) {
    actions.push({
      key: "duplicates",
      title: "Revisar posibles duplicados",
      detail: `Detectamos ${input.duplicateMovementGroups} grupo${input.duplicateMovementGroups === 1 ? "" : "s"} con mismo día, monto y contraparte.`,
      href: "/app/movements",
      priority: 4,
    });
  }

  if (input.idleSubscriptionName) {
    actions.push({
      key: "idle-sub",
      title: "Revisar suscripción poco usada",
      detail: `${input.idleSubscriptionName} no tuvo pagos registrados este mes.`,
      href: "/app/subscriptions",
      priority: 6,
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 8);
}

/** Heurística: metadata explícita de revisión o confianza numérica baja (p. ej. importaciones asistidas). */
export function movementNeedsReviewMetadata(movement: MovementRecord): boolean {
  const meta = movement.metadata;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return false;
  }

  const o = meta as Record<string, unknown>;
  if (o.needs_review === true || o.review_suggested === true) {
    return true;
  }

  if (o.confidence === "low") {
    return true;
  }

  const n = typeof o.confidence === "number" ? o.confidence : null;
  return n !== null && n < 0.65;
}

const STALE_OBLIGATION_MS = 50 * 86400000;

/** Obligaciones activas con saldo y sin pago ni evento reciente (50 días). */
export function countObligationsWithoutRecentActivity(
  obligations: ObligationSummary[],
  nowMs: number = Date.now(),
): number {
  let count = 0;

  for (const o of obligations) {
    if (o.status !== "active" || o.pendingAmount <= 0) {
      continue;
    }

    const lastPay = o.lastPaymentDate ? new Date(o.lastPaymentDate).getTime() : 0;
    let lastEvt = 0;

    for (const e of o.events ?? []) {
      const t = new Date(e.eventDate).getTime();
      if (t > lastEvt) {
        lastEvt = t;
      }
    }

    const last = Math.max(lastPay, lastEvt);
    if (last === 0 || nowMs - last > STALE_OBLIGATION_MS) {
      count += 1;
    }
  }

  return count;
}

/** Suscripciones activas sin cuenta ligada o con próximo vencimiento ya pasado (día calendario). */
export function countSubscriptionsNeedingAttention(subs: SubscriptionSummary[], now = new Date()): number {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  return subs.filter((s) => {
    if (s.status !== "active") {
      return false;
    }

    if (!s.accountId) {
      return true;
    }

    if (s.nextDueDate && new Date(s.nextDueDate).getTime() < start) {
      return true;
    }

    return false;
  }).length;
}

export function countDuplicateMovementGroups(
  postedMovements: MovementRecord[],
  classifyMovement: Classify,
): number {
  const groups = new Map<string, number>();

  for (const movement of postedMovements) {
    if (movement.status !== "posted" || movement.movementType === "transfer") {
      continue;
    }
    const c = classifyMovement(movement);
    if (!c || c.kind !== "expense") {
      continue;
    }
    const day = toDayKey(movement.occurredAt);
    const key = `${day}::${Math.round(c.amount * 100)}::${movement.counterparty?.toLowerCase() ?? ""}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return [...groups.values()].filter((n) => n >= 2).length;
}

export function findIdleSubscriptionName(
  now: Date,
  postedMovements: MovementRecord[],
  activeSubscriptions: SubscriptionSummary[],
): string | null {
  const monthStart = startOfMonth(now);
  const paidIds = new Set<number>();

  for (const movement of postedMovements) {
    if (movement.status !== "posted" || !movement.subscriptionId) {
      continue;
    }
    if (new Date(movement.occurredAt).getTime() < monthStart.getTime()) {
      continue;
    }
    if (movement.movementType === "subscription_payment" || movement.subscriptionId) {
      paidIds.add(movement.subscriptionId);
    }
  }

  const idle = activeSubscriptions.find((sub) => !paidIds.has(sub.id) && sub.amount > 0);
  return idle?.name ?? null;
}

export function buildUnusualSpendingLines(
  currentPeriodMovements: MovementRecord[],
  previousPeriodMovements: MovementRecord[],
  classifyMovement: Classify,
  getExpenseAmount: ExpenseAmt,
  topCategoryName: string | null,
  topCategoryDelta: number,
  currencyCode: string,
  formatCurrency: (amount: number, code: string) => string,
): UnusualLine[] {
  const lines: UnusualLine[] = [];

  if (topCategoryName && topCategoryDelta > 0) {
    lines.push({
      key: "category-spike",
      label: topCategoryName,
      detail: `Subió ${formatCurrency(topCategoryDelta, currencyCode)} frente al período de referencia.`,
    });
  }

  const prevExpenseByCat = new Map<string, number>();
  for (const movement of previousPeriodMovements) {
    const c = classifyMovement(movement);
    if (!c || c.kind !== "expense") {
      continue;
    }
    const name = movement.category || "Sin categoría";
    prevExpenseByCat.set(name, (prevExpenseByCat.get(name) ?? 0) + getExpenseAmount(movement));
  }

  const currentExpenseByCat = new Map<string, number>();
  for (const movement of currentPeriodMovements) {
    const c = classifyMovement(movement);
    if (!c || c.kind !== "expense") {
      continue;
    }
    const name = movement.category || "Sin categoría";
    currentExpenseByCat.set(name, (currentExpenseByCat.get(name) ?? 0) + getExpenseAmount(movement));
  }

  for (const [name, cur] of currentExpenseByCat) {
    const prev = prevExpenseByCat.get(name) ?? 0;
    if (prev <= 0 || cur < prev * 1.45) {
      continue;
    }
    if (lines.some((l) => l.label === name)) {
      continue;
    }
    lines.push({
      key: `spike-${name}`,
      label: name,
      detail: `Gastaste ${formatCurrency(cur, currencyCode)} vs ${formatCurrency(prev, currencyCode)} antes (~${Math.round((cur / prev - 1) * 100)}% más).`,
    });
  }

  const expenseMoves = currentPeriodMovements.filter((m) => {
    const c = classifyMovement(m);
    return c?.kind === "expense";
  });
  const totalExp = expenseMoves.reduce((s, m) => s + getExpenseAmount(m), 0);
  const avg = totalExp / Math.max(1, expenseMoves.length);
  const big = expenseMoves
    .map((m) => ({ m, amt: getExpenseAmount(m) }))
    .filter(({ amt }) => amt >= Math.max(avg * 3, 120))
    .sort((a, b) => b.amt - a.amt)[0];

  if (big && !lines.some((l) => l.key === `big-${big.m.id}`)) {
    lines.push({
      key: `big-${big.m.id}`,
      label: big.m.description || big.m.category || "Gasto destacado",
      detail: `${formatCurrency(big.amt, currencyCode)} en este período, por encima de tu gasto medio por movimiento.`,
    });
  }

  return lines.slice(0, 4);
}

export function buildPrimaryRecommendation(input: {
  monthlySavingsTarget: number | null;
  currentMonthNet: number;
  opportunityCategoryName: string | null;
  uncategorizedCount: number;
  overdueAmount: number;
  lowBalanceAccountName: string | null;
  savingsAccountBalance: number;
  averageWeeklySpend: number;
  learningInsightLine: string | null;
  formatCurrency: (amount: number, currencyCode: string) => string;
  currencyCode: string;
}): PrimaryRecommendation {
  if (input.overdueAmount > 0) {
    return {
      text: "Prioriza cerrar o renegociar lo vencido: es lo que más presión mete a tu caja y a tus alertas.",
      tone: "danger",
    };
  }

  if (input.uncategorizedCount >= 3) {
    return {
      text: "Antes de afinar metas, categoriza los movimientos sueltos: sin eso el dashboard interpreta mal el gasto.",
      tone: "warning",
    };
  }

  if (
    input.monthlySavingsTarget &&
    input.currentMonthNet < input.monthlySavingsTarget * 0.85 &&
    input.opportunityCategoryName
  ) {
    const gap = Math.max(0, input.monthlySavingsTarget - input.currentMonthNet);
    return {
      text: `Te faltan ${input.formatCurrency(gap, input.currencyCode)} para tu meta de ahorro del mes. La categoría con más margen de ajuste ahora es “${input.opportunityCategoryName}”.`,
      tone: "warning",
    };
  }

  if (
    input.lowBalanceAccountName &&
    input.savingsAccountBalance > input.averageWeeklySpend * 2
  ) {
    return {
      text: `Tu cuenta operativa (${input.lowBalanceAccountName}) está justa y tienes colchón en ahorros: conviene mover solo lo necesario para la semana.`,
      tone: "info",
    };
  }

  if (input.learningInsightLine) {
    return { text: input.learningInsightLine, tone: "info" };
  }

  return {
    text: "Mantén el ritmo: registrar a tiempo y revisar una vez por semana el tablero suele bastar para no perder el control.",
    tone: "success",
  };
}

export function countDistinctPostingDaysThisMonth(now: Date, postedMovements: MovementRecord[]): number {
  const monthStart = startOfMonth(now);
  const days = new Set<string>();
  for (const movement of postedMovements) {
    if (movement.status !== "posted") {
      continue;
    }
    const t = new Date(movement.occurredAt);
    if (t.getTime() < monthStart.getTime()) {
      continue;
    }
    days.add(toDayKey(movement.occurredAt));
  }
  return days.size;
}
