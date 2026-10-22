export type AgreedPayment = { amount: number; dueDate?: string };
/**
 * Día del mes de cada cuota: 1 a 31 o "last" (fin de mes). Ausente = el día de la fecha de inicio,
 * como siempre. Un día que el mes no tiene cae en su último día. Mismo contrato que móvil.
 */
export type PayDay = number | "last";
export type PaymentPlan =
  | { mode: "equal"; count: number; firstDueDate?: string; payDay?: PayDay }
  | { mode: "custom"; agreed: AgreedPayment[]; tail: number | null; firstDueDate?: string; payDay?: PayDay };

export type ScheduledPayment = {
  seq: number;
  dueDate: string;
  amount: number;
  source: "agreed" | "calculated";
};

export type PlanCoverage = ScheduledPayment & {
  covered: number;
  remaining: number;
  status: "covered" | "partial" | "pending";
  coveredAt: string | null;
};

const cents = (amount: number) => Math.round(amount * 100);
const money = (amount: number) => amount / 100;
const validDate = (value: unknown): value is string =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));

export function addMonthsIso(isoDate: string, months: number): string {
  if (!validDate(isoDate)) return isoDate;
  const [year, month, day] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Lleva una fecha al día de cobro del plan dentro de su mismo mes. Sin día elegido no la toca. */
export function applyPayDay(isoDate: string, payDay: PayDay | null | undefined): string {
  if (payDay == null || !validDate(isoDate)) return isoDate;
  const [year, month] = isoDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = payDay === "last" ? lastDay : Math.min(Math.max(1, Math.floor(payDay)), lastDay);
  return `${isoDate.slice(0, 8)}${String(day).padStart(2, "0")}`;
}

/** Un día de cobro válido (1 a 31 o fin de mes), o nada. */
export function readPayDay(raw: unknown): PayDay | undefined {
  if (raw === "last") return "last";
  const day = Number(raw);
  return raw != null && raw !== "" && Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined;
}

export function defaultFirstDueDate(startDate: string, today = new Date()): string {
  if (!validDate(startDate)) return today.toISOString().slice(0, 10);
  const [year, month] = startDate.split("-").map(Number);
  const monthsAhead = (today.getFullYear() - year) * 12 + today.getMonth() + 1 - month;
  return addMonthsIso(startDate, Math.max(0, monthsAhead));
}

export function parsePaymentPlan(raw: unknown): PaymentPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const payDay = readPayDay(value.payDay);
  const firstDueDate = { ...(validDate(value.firstDueDate) ? { firstDueDate: value.firstDueDate } : {}), ...(payDay != null ? { payDay } : {}) };
  if (value.mode === "equal") {
    const count = Number(value.count);
    return Number.isFinite(count) && count > 0 ? { mode: "equal", count: Math.floor(count), ...firstDueDate } : null;
  }
  if (value.mode !== "custom") return null;
  const agreed = Array.isArray(value.agreed) ? value.agreed.flatMap((entry): AgreedPayment[] => {
    const item: Record<string, unknown> = entry && typeof entry === "object" ? entry as Record<string, unknown> : { amount: entry };
    const amount = Number(item.amount);
    if (!Number.isFinite(amount) || amount <= 0) return [];
    return [{ amount, ...(validDate(item.dueDate) ? { dueDate: item.dueDate } : {}) }];
  }) : [];
  const tail = Number(value.tail);
  const normalizedTail = Number.isFinite(tail) && tail > 0 ? tail : null;
  return agreed.length || normalizedTail !== null
    ? { mode: "custom", agreed, tail: normalizedTail, ...firstDueDate }
    : null;
}

export function normalizePaymentPlan(plan: PaymentPlan | null): PaymentPlan | null {
  return parsePaymentPlan(plan);
}

export function expandPaymentPlan(plan: PaymentPlan, principal: number, startDate: string): ScheduledPayment[] {
  const total = cents(principal);
  if (total <= 0) return [];
  const anchor = plan.firstDueDate ?? addMonthsIso(startDate, 1);
  if (plan.mode === "equal") {
    const count = Math.floor(plan.count);
    if (count < 1 || count > 600) return [];
    const share = Math.round(total / count);
    let assigned = 0;
    return Array.from({ length: count }, (_, index) => {
      const amount = index === count - 1 ? total - assigned : share;
      assigned += amount;
      return { seq: index + 1, dueDate: applyPayDay(addMonthsIso(anchor, index), plan.payDay), amount: money(amount), source: "calculated" as const };
    });
  }
  const result: ScheduledPayment[] = [];
  let remaining = total;
  let previous: string | null = null;
  for (const item of plan.agreed) {
    const amount = cents(item.amount);
    if (amount <= 0) continue;
    const proposed = item.dueDate ?? addMonthsIso(anchor, result.length);
    const dueDate: string = applyPayDay(previous && proposed.slice(0, 7) <= previous.slice(0, 7)
      ? addMonthsIso(previous, 1) : proposed, plan.payDay);
    result.push({ seq: result.length + 1, dueDate, amount: money(amount), source: "agreed" });
    previous = dueDate;
    remaining -= amount;
  }
  const tail = plan.tail ? cents(plan.tail) : 0;
  while (tail > 0 && remaining > 0 && result.length < 600) {
    const amount = Math.min(tail, remaining);
    const dueDate: string = applyPayDay(previous ? addMonthsIso(previous, 1) : addMonthsIso(anchor, result.length), plan.payDay);
    result.push({ seq: result.length + 1, dueDate, amount: money(amount), source: "calculated" });
    previous = dueDate;
    remaining -= amount;
  }
  return result;
}

export function planDifference(principal: number, rows: readonly ScheduledPayment[]): number {
  return money(cents(principal) - rows.reduce((sum, row) => sum + cents(row.amount), 0));
}

export function describePlan(
  plan: PaymentPlan | null,
  principal: number,
  startDate: string,
  formatAmount: (amount: number) => string,
): string | null {
  if (!plan) return null;
  const rows = expandPaymentPlan(plan, principal, startDate);
  if (!rows.length) return null;
  return plan.mode === "equal"
    ? `${rows.length} cuotas iguales de ${formatAmount(rows[0].amount)}`
    : `A medida · ${rows.length} ${rows.length === 1 ? "pago" : "pagos"}`;
}

/** Lo que se sabe de la deuda real al editar un plan (móvil: PlanDebtContext). */
export type PlanDebtContext = {
  /** El monto de apertura con el que se pactó el plan. */
  openingPrincipal: number;
  /** Lo que se debe hoy: apertura + aumentos − reducciones. */
  currentDebt: number;
  payments: readonly { amount: number; date: string }[];
};

/**
 * El calendario que rige hoy y la deuda que reparte: la misma cuenta que coverPlan, para que el
 * editor del plan diga lo mismo que el detalle y la proyección (móvil: effectivePlanSchedule).
 * `basis` = deuda de hoy − lo cobrado antes del mes del primer pago.
 */
export function effectivePlanSchedule(plan: PaymentPlan, context: PlanDebtContext, startDate: string): { payments: ScheduledPayment[]; basis: number } {
  const planMonth = (plan.firstDueDate ?? addMonthsIso(startDate, 1)).slice(0, 7);
  const paidBefore = context.payments.filter((payment) => payment.date.slice(0, 7) < planMonth).reduce((sum, payment) => sum + cents(payment.amount), 0);
  const basis = Math.max(0, money(cents(context.currentDebt) - paidBefore));
  const rows = coverPlan(plan, context.openingPrincipal, context.currentDebt, startDate, context.payments);
  return { basis, payments: rows.map(({ seq, dueDate, amount, source }) => ({ seq, dueDate, amount, source })) };
}

export function coverPlan(
  plan: PaymentPlan,
  openingPrincipal: number,
  currentDebt: number,
  startDate: string,
  payments: readonly { amount: number; date: string }[],
): PlanCoverage[] {
  // A plan agreed later only distributes the debt remaining when it starts.
  // Earlier months reduce the principal; they cannot prepay the new installments.
  const planMonth = (plan.firstDueDate ?? addMonthsIso(startDate, 1)).slice(0, 7);
  const sorted = [...payments].sort((a, b) => a.date.localeCompare(b.date));
  const before = sorted.filter(payment => payment.date.slice(0, 7) < planMonth);
  const ordered = sorted.filter(payment => payment.date.slice(0, 7) >= planMonth);
  const paidBefore = before.reduce((sum, payment) => sum + cents(payment.amount), 0);
  openingPrincipal = money(Math.max(0, cents(openingPrincipal) - paidBefore));
  currentDebt = money(Math.max(0, cents(currentDebt) - paidBefore));
  const paid = ordered.reduce((sum, payment) => sum + cents(payment.amount), 0);
  let scheduled = expandPaymentPlan(plan, plan.mode === "custom" ? currentDebt : openingPrincipal, startDate);
  if (plan.mode === "equal" && cents(currentDebt) !== cents(openingPrincipal)) {
    let remainingPaid = paid;
    let settled = 0;
    for (const row of scheduled) {
      if (remainingPaid < cents(row.amount)) break;
      remainingPaid -= cents(row.amount);
      settled += 1;
    }
    if (settled < scheduled.length) {
      const settledCost = scheduled.slice(0, settled).reduce((sum, row) => sum + cents(row.amount), 0);
      const openTotal = Math.max(0, cents(currentDebt) - settledCost);
      const share = Math.round(openTotal / (scheduled.length - settled));
      let assigned = 0;
      scheduled = scheduled.map((row, index) => {
        if (index < settled) return row;
        const amount = index === scheduled.length - 1 ? openTotal - assigned : share;
        assigned += amount;
        return { ...row, amount: money(Math.max(0, amount)) };
      });
    }
  }
  let budget = paid;
  let cursor = 0;
  let spentFromCursor = 0;
  return scheduled.map((row) => {
    const amount = cents(row.amount);
    const covered = Math.max(0, Math.min(amount, budget));
    budget -= covered;
    let coveredAt: string | null = null;
    if (covered >= amount && amount > 0) {
      let left = amount;
      while (left > 0 && cursor < ordered.length) {
        const available = cents(ordered[cursor].amount) - spentFromCursor;
        const taken = Math.min(available, left);
        left -= taken;
        spentFromCursor += taken;
        coveredAt = ordered[cursor].date;
        if (spentFromCursor >= cents(ordered[cursor].amount)) {
          cursor += 1;
          spentFromCursor = 0;
        }
      }
    }
    return {
      ...row,
      covered: money(covered),
      remaining: money(Math.max(0, amount - covered)),
      status: covered >= amount && amount > 0 ? "covered" as const : covered > 0 ? "partial" as const : "pending" as const,
      coveredAt,
    };
  });
}
