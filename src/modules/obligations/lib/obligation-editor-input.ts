import type { WorkspaceSnapshot, ObligationFormInput } from "../../../services/queries/workspace-data";
import type { ObligationSummary } from "../../../types/domain";
import { validBudgetDay } from "../../budgets/lib/budget-date";
import { agreedInterest } from "./agreed-interest";
import { applyObligationFormRules, getOpeningImpact, isCreatableOrigin, type ObligationFormState } from "./obligation-editor-model";
import { effectivePlanSchedule, expandPaymentPlan, parsePaymentPlan, planDifference, type PaymentPlan, type PlanDebtContext, type ScheduledPayment, readPayDay } from "./payment-plan";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
function money(value: unknown) {
  const n = typeof value === "number" || typeof value === "string" && value.trim() ? Number(typeof value === "string" ? value.replace(",", ".") : value) : NaN;
  if (!Number.isFinite(n) || n <= 0 || !Number.isSafeInteger(Math.round(n * 100)) || Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw new Error("Los montos deben ser positivos y tener como máximo dos decimales.");
  return n;
}
function optionalId(value: string) {
  if (!value.trim()) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Vuelve a seleccionar la cuenta o contraparte.");
  return id;
}

/** Never discard malformed rows/coerce booleans. Keep the mobile monthly ordering contract. */
export function validateObligationPlan(raw: unknown, principal: number, startDate: string): { plan: PaymentPlan | null; rows: ScheduledPayment[] } {
  if (raw == null) return { plan: null, rows: [] };
  const value = record(raw);
  if (!validBudgetDay(startDate)) throw new Error("Revisa la fecha de inicio antes de programar cuotas.");
  const first = value.firstDueDate == null ? {} : validBudgetDay(value.firstDueDate) && value.firstDueDate >= startDate ? { firstDueDate: value.firstDueDate } : null;
  if (!first) throw new Error("El primer pago debe tener una fecha válida y no ser anterior al inicio.");
  // El día de cobro elegido en móvil o web se conserva; uno inválido se rechaza en vez de perderse.
  const payDay = readPayDay(value.payDay);
  if (value.payDay != null && payDay === undefined) throw new Error("Revisa el día de cobro del plan.");
  if (payDay !== undefined) Object.assign(first, { payDay });
  let plan: PaymentPlan;
  if (value.mode === "equal") {
    const count = typeof value.count === "number" || typeof value.count === "string" ? Number(value.count) : NaN;
    if (!Number.isSafeInteger(count) || count < 1 || count > 600) throw new Error("El plan debe tener entre 1 y 600 cuotas enteras.");
    plan = { mode: "equal", count, ...first };
  } else if (value.mode === "custom") {
    if (!Array.isArray(value.agreed) || value.agreed.length > 600) throw new Error("Revisa los pagos acordados del plan.");
    const agreed = value.agreed.map(entry => {
      const row = record(entry), amount = money(row.amount);
      if (row.dueDate != null && (!validBudgetDay(row.dueDate) || row.dueDate < startDate || first.firstDueDate && row.dueDate < first.firstDueDate)) throw new Error("Las fechas acordadas deben ser válidas y respetar el inicio y primer pago.");
      return { amount, ...(row.dueDate != null ? { dueDate: row.dueDate as string } : {}) };
    });
    const tail = value.tail == null ? null : money(value.tail);
    if (!agreed.length && tail === null) throw new Error("Indica pagos acordados o un monto que se repita.");
    plan = { mode: "custom", agreed, tail, ...first };
  } else throw new Error("Revisa la modalidad del plan de pagos.");
  const rows = expandPaymentPlan(plan, money(principal), startDate);
  if (!rows.length || rows.length > 600 || rows.some(row => row.amount <= 0 || !validBudgetDay(row.dueDate) || row.dueDate < startDate) || planDifference(principal, rows) !== 0) throw new Error("El plan debe cubrir exactamente el monto, con cuotas positivas y fechas válidas.");
  return { plan, rows };
}

/**
 * Interés pactado al crear, desde "Total a devolver" (móvil). Vacío = igual al monto: sin interés.
 * `planBasis` = sobre qué monto se arma el plan: con interés, el total a devolver.
 */
export function obligationCreateInterest(input: Pick<ObligationFormState, "principalAmount" | "returnTotal">) {
  const principal = Number(input.principalAmount.replace(",", "."));
  const returnTotal = input.returnTotal.trim() ? Number(input.returnTotal.replace(",", ".")) : principal;
  const result = agreedInterest({ principal: Number.isFinite(principal) ? principal : 0, returnTotal: Number.isFinite(returnTotal) ? returnTotal : 0 });
  return { ...result, returnTotal, planBasis: result.interestAmount > 0 ? returnTotal : principal };
}

/**
 * Al editar una deuda que ya creció, el plan se arma sobre la deuda de hoy (móvil). Si el monto de
 * apertura cambia aquí, la deuda de hoy se corre lo mismo.
 */
export function obligationPlanDebtContext(obligation: Pick<ObligationSummary, "principalAmount" | "currentPrincipalAmount" | "events">, openingPrincipal: number): PlanDebtContext {
  const current = obligation.currentPrincipalAmount && obligation.currentPrincipalAmount > 0 ? obligation.currentPrincipalAmount : obligation.principalAmount;
  return {
    openingPrincipal,
    currentDebt: Math.max(0, current + (openingPrincipal - obligation.principalAmount)),
    payments: obligation.events.filter((event) => event.eventType === "payment").map((event) => ({ amount: event.amount, date: event.eventDate })),
  };
}

/** Sobre qué monto se valida el plan: con deuda real (editar), el calendario que rige hoy. */
export function obligationPlanBasis(rawPlan: unknown, principal: number, startDate: string, context?: PlanDebtContext | null) {
  const plan = context ? parsePaymentPlan(rawPlan) : null;
  return plan && context ? effectivePlanSchedule(plan, context, startDate).basis : principal;
}

export function buildObligationEditorInput(input: ObligationFormState, snapshot: WorkspaceSnapshot, isCreate = true, planContext?: PlanDebtContext | null): ObligationFormInput {
  const value = applyObligationFormRules(input);
  const title = value.title.trim(), principalAmount = money(value.principalAmount);
  if (!title || title.length > 120) throw new Error("Indica un título de hasta 120 caracteres.");
  if (value.originType === "") throw new Error("Elige cómo nació: presté dinero, vendí a cuotas…");
  // Al crear solo se ofrecen los orígenes de móvil; "manual" llega únicamente prellenado (asistente, igual que móvil).
  if (isCreate && !isCreatableOrigin(value.direction, value.originType) && value.originType !== "manual") throw new Error("Ese origen no corresponde a este tipo de registro.");
  const interest = isCreate ? obligationCreateInterest(value) : null;
  if (interest && value.returnTotal.trim()) money(value.returnTotal);
  if (interest?.belowPrincipal) throw new Error("El total a devolver no puede ser menor que el monto.");
  const originType = value.originType;
  if (!["receivable", "payable"].includes(value.direction) || !["cash_loan", "sale_financed", "purchase_financed", "paid_for_other", "manual"].includes(originType) || !["none", "inflow", "outflow"].includes(value.manualOpeningImpact) || !["draft", "active", "paid", "cancelled", "defaulted"].includes(value.status)) throw new Error("Revisa el tipo, origen y estado del registro.");
  const currencyCode = value.currencyCode.trim().toUpperCase() || snapshot.workspace.baseCurrencyCode;
  if (![snapshot.workspace.baseCurrencyCode, "PEN", "USD", "EUR", "BRL", "MXN", "CLP", ...snapshot.accounts.map(a => a.currencyCode)].includes(currencyCode)) throw new Error("Selecciona una moneda disponible.");
  if (!validBudgetDay(value.startDate) || value.dueDate && (!validBudgetDay(value.dueDate) || value.dueDate < value.startDate)) throw new Error("Revisa el inicio y vencimiento: deben ser fechas válidas y estar en orden.");
  const counterpartyId = optionalId(value.counterpartyId);
  if (counterpartyId === null || !snapshot.catalogs.counterparties.some(p => p.id === counterpartyId && (!isCreate || !p.isArchived))) throw new Error("Elige una contraparte disponible en este espacio.");
  const settlementAccountId = optionalId(value.settlementAccountId);
  const availableAccount = (id: number | null) => snapshot.accounts.find(a => a.id === id && a.workspaceId === snapshot.workspace.id && (!isCreate || !a.isArchived));
  if (settlementAccountId !== null && !availableAccount(settlementAccountId)) throw new Error("La cuenta habitual ya no está disponible en este espacio.");
  const openingImpact = getOpeningImpact(value.direction, originType, value.manualOpeningImpact);
  const openingAccountId = openingImpact === "none" ? null : optionalId(value.openingAccountId);
  if (openingImpact !== "none" && (!availableAccount(openingAccountId) || availableAccount(openingAccountId)?.currencyCode !== currencyCode)) throw new Error("Elige una cuenta de apertura activa y en la misma moneda del registro.");
  // Con interés pactado, el plan reparte el total a devolver (monto + interés), como móvil.
  const planBasis = interest ? interest.planBasis : obligationPlanBasis(value.paymentPlan, principalAmount, value.startDate, isCreate ? null : planContext);
  const { plan: paymentPlan, rows } = validateObligationPlan(value.paymentPlan, planBasis, value.startDate);
  // Al crear, la tasa no se escribe: sale del total a devolver (informativa). Al editar se conserva la guardada.
  const interestRate = interest ? interest.interestPercent : value.interestRate.trim() ? Number(value.interestRate.replace(",", ".")) : null;
  if (interestRate !== null && (!Number.isFinite(interestRate) || interestRate < 0)) throw new Error("El interés debe ser cero o un número positivo.");
  return { direction: value.direction, originType: originType as Exclude<typeof originType, "">, openingImpact, openingAccountId, status: value.status, title,
    counterpartyId, settlementAccountId, currencyCode, principalAmount, startDate: value.startDate, dueDate: value.dueDate || null,
    installmentAmount: rows[0]?.amount ?? null, installmentCount: rows.length || null, paymentPlan, interestRate, description: value.description, notes: value.notes };
}
