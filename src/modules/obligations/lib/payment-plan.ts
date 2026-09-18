export type AgreedPayment = { amount: number; dueDate?: string };
export type PaymentPlan =
  | { mode: "equal"; count: number; firstDueDate?: string }
  | { mode: "custom"; agreed: AgreedPayment[]; tail: number | null; firstDueDate?: string };

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

export function defaultFirstDueDate(startDate: string, today = new Date()): string {
  if (!validDate(startDate)) return today.toISOString().slice(0, 10);
  const [year, month] = startDate.split("-").map(Number);
  const monthsAhead = (today.getFullYear() - year) * 12 + today.getMonth() + 1 - month;
  return addMonthsIso(startDate, Math.max(0, monthsAhead));
}

export function parsePaymentPlan(raw: unknown): PaymentPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const firstDueDate = validDate(value.firstDueDate) ? { firstDueDate: value.firstDueDate } : {};
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
      return { seq: index + 1, dueDate: addMonthsIso(anchor, index), amount: money(amount), source: "calculated" as const };
    });
  }
  const result: ScheduledPayment[] = [];
  let remaining = total;
  let previous: string | null = null;
  for (const item of plan.agreed) {
    const amount = cents(item.amount);
    if (amount <= 0) continue;
    const proposed = item.dueDate ?? addMonthsIso(anchor, result.length);
    const dueDate: string = previous && proposed.slice(0, 7) <= previous.slice(0, 7)
      ? addMonthsIso(previous, 1) : proposed;
    result.push({ seq: result.length + 1, dueDate, amount: money(amount), source: "agreed" });
    previous = dueDate;
    remaining -= amount;
  }
  const tail = plan.tail ? cents(plan.tail) : 0;
  while (tail > 0 && remaining > 0 && result.length < 600) {
    const amount = Math.min(tail, remaining);
    const dueDate: string = previous ? addMonthsIso(previous, 1) : addMonthsIso(anchor, result.length);
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

export function coverPlan(
  plan: PaymentPlan,
  openingPrincipal: number,
  currentDebt: number,
  startDate: string,
  payments: readonly { amount: number; date: string }[],
): PlanCoverage[] {
  const paid = payments.reduce((sum, payment) => sum + cents(payment.amount), 0);
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
  return scheduled.map((row) => {
    const amount = cents(row.amount);
    const covered = Math.max(0, Math.min(amount, budget));
    budget -= covered;
    return {
      ...row,
      covered: money(covered),
      remaining: money(Math.max(0, amount - covered)),
      status: covered >= amount && amount > 0 ? "covered" as const : covered > 0 ? "partial" as const : "pending" as const,
    };
  });
}
