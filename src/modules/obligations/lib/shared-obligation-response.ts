import type { JsonValue, ObligationEventSummary, ObligationShareSummary, SharedObligationSummary } from "../../../types/domain";
import { parsePaymentPlan } from "./payment-plan";

type Row = Record<string, unknown>;
const invalid = () => new Error("La respuesta de obligaciones compartidas está incompleta o no es válida.");
function record(value: unknown): Row {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid();
  return value as Row;
}
function field(row: Row, snake: string, camel: string, alternate?: string) {
  return row[snake] !== undefined ? row[snake] : row[camel] !== undefined ? row[camel] : alternate ? row[alternate] : undefined;
}
function number(value: unknown, nullable = false): number | null {
  if (value == null && nullable) return null;
  if ((typeof value !== "number" && typeof value !== "string") || value === "" || (typeof value === "string" && !value.trim())) throw invalid();
  if (typeof value === "string" && !/^[+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(value.trim())) throw invalid();
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw invalid();
  return parsed;
}
function id(value: unknown, nullable = false): number | null {
  const parsed = number(value, nullable);
  if (parsed !== null && (!Number.isSafeInteger(parsed) || parsed <= 0)) throw invalid();
  return parsed;
}
function text(value: unknown, fallback = ""): string {
  if (value == null) return fallback;
  if (typeof value !== "string") throw invalid();
  return value;
}
function date(value: unknown, nullable = false): string | null {
  if (value == null && nullable) return null;
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(result) || !Number.isFinite(Date.parse(result))) throw invalid();
  const calendar = result.slice(0, 10);
  if (new Date(`${calendar}T12:00:00Z`).toISOString().slice(0, 10) !== calendar) throw invalid();
  return result;
}
function choice<T extends string>(value: unknown, options: readonly T[]): T {
  if (!options.includes(value as T)) throw invalid();
  return value as T;
}
function mapItem(item: unknown, viewer: { userId: string; email?: string | null }): SharedObligationSummary | null {
  const raw = record(item);
  const obligation = raw.obligation == null ? raw : record(raw.obligation);
  const grant = record(raw.share ?? raw.obligation_share);
  if (choice(grant.status, ["pending", "accepted", "declined", "revoked"]) !== "accepted") return null;
  const share: ObligationShareSummary = {
    id: id(grant.id)!, workspaceId: id(field(grant, "workspace_id", "workspaceId"))!,
    obligationId: id(field(grant, "obligation_id", "obligationId"))!,
    ownerUserId: text(field(grant, "owner_user_id", "ownerUserId")),
    invitedByUserId: text(field(grant, "invited_by_user_id", "invitedByUserId")),
    invitedUserId: text(field(grant, "invited_user_id", "invitedUserId")),
    invitedEmail: text(field(grant, "invited_email", "invitedEmail")), status: "accepted",
    token: text(grant.token), message: text(grant.message) || null,
    ownerDisplayName: text(field(grant, "owner_display_name", "ownerDisplayName")) || null,
    invitedDisplayName: text(field(grant, "invited_display_name", "invitedDisplayName")) || null,
    acceptedAt: date(field(grant, "accepted_at", "acceptedAt"), true),
    respondedAt: date(field(grant, "responded_at", "respondedAt"), true),
    lastSentAt: date(field(grant, "last_sent_at", "lastSentAt"), true),
    createdAt: date(field(grant, "created_at", "createdAt"))!, updatedAt: date(field(grant, "updated_at", "updatedAt"))!,
  };
  const sameEmail = Boolean(viewer.email?.trim() && share.invitedEmail.trim().toLowerCase() === viewer.email.trim().toLowerCase());
  if (share.invitedUserId !== viewer.userId && !sameEmail) throw new Error("La respuesta incluye un acceso compartido de otro usuario.");
  const obligationId = id(obligation.id)!;
  const workspaceId = id(field(obligation, "workspace_id", "workspaceId"))!;
  if (share.obligationId !== obligationId || share.workspaceId !== workspaceId) throw invalid();
  const source = raw.events ?? obligation.events;
  if (!Array.isArray(source)) throw invalid();
  const seenEvents = new Set<number>();
  const events = source.map((item): ObligationEventSummary => {
    const event = record(item);
    const eventId = id(event.id)!;
    if (seenEvents.has(eventId)) throw invalid();
    seenEvents.add(eventId);
    const parentId = field(event, "obligation_id", "obligationId");
    if (parentId != null && id(parentId) !== obligationId) throw invalid();
    return {
      id: eventId, eventType: choice(field(event, "event_type", "eventType"), ["opening", "principal_increase", "principal_decrease", "payment", "interest", "fee", "discount", "adjustment", "writeoff"]),
      eventDate: date(field(event, "event_date", "eventDate"))!, amount: number(event.amount)!,
      createdAt: date(field(event, "created_at", "createdAt"), true),
      installmentNo: number(field(event, "installment_no", "installmentNo"), true),
      movementId: id(field(event, "movement_id", "movementId"), true),
      createdByUserId: text(field(event, "created_by_user_id", "createdByUserId")) || null,
      reason: text(event.reason) || null, description: text(event.description) || null, notes: text(event.notes) || null,
      metadata: (event.metadata ?? null) as JsonValue,
    };
  }).sort((a, b) => b.eventDate.localeCompare(a.eventDate) || b.id - a.id);
  const currencyCode = text(field(obligation, "currency_code", "currencyCode")).trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currencyCode)) throw invalid();
  const rawPlan = field(obligation, "payment_plan", "paymentPlan");
  if (rawPlan != null) {
    const plan = record(rawPlan);
    const planDate = (value: unknown) => {
      if (value == null) return;
      if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw invalid();
      date(value);
    };
    planDate(plan.firstDueDate);
    if (Array.isArray(plan.agreed)) for (const entry of plan.agreed) {
      if (entry && typeof entry === "object") planDate(record(entry).dueDate);
    }
  }
  const paymentPlan = parsePaymentPlan(rawPlan);
  if (rawPlan != null && !paymentPlan) throw invalid();
  const paymentCount = number(field(obligation, "payment_count", "paymentCount"))!;
  const installmentCount = number(field(obligation, "installment_count", "installmentCount"), true);
  if (!Number.isSafeInteger(paymentCount) || paymentCount < 0 || (installmentCount !== null && (!Number.isSafeInteger(installmentCount) || installmentCount < 0))) throw invalid();
  const maxPaid = events.reduce((max, event) => event.eventType === "payment" ? Math.max(max, event.installmentNo ?? 0) : max, 0);
  return {
    id: obligationId, workspaceId, title: text(obligation.title),
    direction: choice(obligation.direction, ["receivable", "payable"]),
    originType: choice(field(obligation, "origin_type", "originType") ?? "manual", ["cash_loan", "sale_financed", "purchase_financed", "paid_for_other", "manual"]),
    status: choice(obligation.status, ["draft", "active", "paid", "cancelled", "defaulted"]), currencyCode,
    counterparty: text(obligation.counterparty ?? obligation.counterparty_name ?? obligation.counterpartyName, "Sin contraparte"),
    counterpartyId: id(field(obligation, "counterparty_id", "counterpartyId"), true),
    settlementAccountId: id(field(obligation, "settlement_account_id", "settlementAccountId"), true),
    settlementAccountName: text(field(obligation, "settlement_account_name", "settlementAccountName")) || null,
    principalAmount: number(field(obligation, "principal_initial_amount", "principalInitialAmount", "principalAmount"))!,
    currentPrincipalAmount: number(field(obligation, "principal_current_amount", "principalCurrentAmount", "currentPrincipalAmount"))!,
    pendingAmount: number(field(obligation, "pending_amount", "pendingAmount"))!,
    // A shared owner's native currency is not the viewer's base currency.
    principalAmountInBaseCurrency: null, currentPrincipalAmountInBaseCurrency: null, pendingAmountInBaseCurrency: null,
    progressPercent: number(field(obligation, "progress_percent", "progressPercent"))!,
    startDate: date(field(obligation, "start_date", "startDate"))!, dueDate: date(field(obligation, "due_date", "dueDate"), true),
    installmentAmount: number(field(obligation, "installment_amount", "installmentAmount"), true), installmentCount, paymentPlan,
    interestRate: number(field(obligation, "interest_rate", "interestRate"), true),
    description: text(obligation.description) || null, notes: text(obligation.notes) || null,
    paymentCount, lastPaymentDate: date(field(obligation, "last_payment_date", "lastPaymentDate"), true),
    installmentLabel: installmentCount && installmentCount > 0 ? `${Math.min(maxPaid || paymentCount, installmentCount)} de ${installmentCount} cuotas` : paymentCount > 0 ? `${paymentCount} pagos registrados` : "Sin pagos registrados",
    events, viewerMode: "shared_viewer", share,
  };
}

/** RPC array + both historic edge envelopes. A malformed response is never an empty success. */
export function parseSharedObligationResponse(response: unknown, viewer: { userId: string; email?: string | null }): SharedObligationSummary[] {
  if (!viewer.userId) throw new Error("Se necesita una sesión para consultar accesos compartidos.");
  let source: unknown = response;
  if (!Array.isArray(response)) {
    const envelope = record(response);
    if (envelope.ok !== true) throw new Error(typeof envelope.error === "string" ? envelope.error : "No se pudo cargar lo compartido.");
    if (envelope.items !== undefined && envelope.obligations !== undefined) throw invalid();
    source = envelope.items ?? envelope.obligations;
  }
  if (!Array.isArray(source)) throw invalid();
  const result: SharedObligationSummary[] = [];
  const ids = new Set<number>();
  for (const item of source) {
    const mapped = mapItem(item, viewer);
    if (!mapped) continue;
    if (ids.has(mapped.id)) throw invalid(); // Schema permits only one pending/accepted share per obligation.
    ids.add(mapped.id); result.push(mapped);
  }
  return result.sort((a, b) => Date.parse(b.share.updatedAt) - Date.parse(a.share.updatedAt) || b.share.id - a.share.id);
}
