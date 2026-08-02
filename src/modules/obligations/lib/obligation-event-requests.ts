import type { JsonValue } from "../../../types/domain";

/**
 * Las solicitudes de edicion y borrado de eventos no tienen tabla propia: viven
 * en el payload de `notifications`. Este modulo es el contrato compartido con la
 * app movil (lib/obligation-event-payloads.ts) para leerlas y escribirlas igual.
 */

export type ObligationEventRequestResolution = "accepted" | "rejected";

export type EventDeleteRequestPayload = {
  obligationId: number;
  eventId: number;
  amount?: number | null;
  currencyCode?: string | null;
  eventType?: string | null;
  eventDate?: string | null;
  obligationTitle?: string | null;
  requestedByUserId?: string | null;
  requestedByDisplayName?: string | null;
  rejectionReason?: string | null;
  responseStatus?: ObligationEventRequestResolution | null;
};

export type EventEditRequestPayload = {
  obligationId: number;
  eventId: number;
  currencyCode?: string | null;
  eventType?: string | null;
  obligationTitle?: string | null;
  requestedByUserId?: string | null;
  requestedByDisplayName?: string | null;
  rejectionReason?: string | null;
  responseStatus?: ObligationEventRequestResolution | null;
  currentAmount?: number | null;
  currentEventDate?: string | null;
  currentInstallmentNo?: number | null;
  currentDescription?: string | null;
  currentNotes?: string | null;
  proposedAmount?: number | null;
  proposedEventDate?: string | null;
  proposedInstallmentNo?: number | null;
  proposedDescription?: string | null;
  proposedNotes?: string | null;
};

export const OBLIGATION_EVENT_REQUEST_KINDS = {
  deleteRequest: "obligation_event_delete_request",
  deletePending: "obligation_event_delete_pending",
  deleteAccepted: "obligation_event_delete_accepted",
  deleteRejected: "obligation_event_delete_rejected",
  editRequest: "obligation_event_edit_request",
  editPending: "obligation_event_edit_pending",
  editAccepted: "obligation_event_edit_accepted",
  editRejected: "obligation_event_edit_rejected",
} as const;

export const OBLIGATION_EVENT_RELATED_ENTITY_TYPE = "obligation_event";

function readNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function readText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readResolution(value: unknown): ObligationEventRequestResolution | null {
  return value === "accepted" || value === "rejected" ? value : null;
}

function readCurrencyCode(value: unknown): string | null {
  return typeof value === "string" ? value.trim().toUpperCase() || null : null;
}

function readRecord(value: JsonValue | null | undefined): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export function readEventDeletePayload(
  value: JsonValue | null | undefined,
): EventDeleteRequestPayload | null {
  const raw = readRecord(value);

  if (!raw) {
    return null;
  }

  const obligationId = readNumber(raw.obligationId);
  const eventId = readNumber(raw.eventId);

  if (!obligationId || !eventId) {
    return null;
  }

  return {
    obligationId,
    eventId,
    amount: readNumber(raw.amount),
    currencyCode: readCurrencyCode(raw.currencyCode),
    eventType: readText(raw.eventType),
    eventDate: readText(raw.eventDate),
    obligationTitle: readText(raw.obligationTitle),
    requestedByUserId: readText(raw.requestedByUserId),
    requestedByDisplayName: readText(raw.requestedByDisplayName),
    rejectionReason: readText(raw.rejectionReason),
    responseStatus: readResolution(raw.responseStatus),
  };
}

export function readEventEditPayload(
  value: JsonValue | null | undefined,
): EventEditRequestPayload | null {
  const raw = readRecord(value);

  if (!raw) {
    return null;
  }

  const obligationId = readNumber(raw.obligationId);
  const eventId = readNumber(raw.eventId);

  if (!obligationId || !eventId) {
    return null;
  }

  return {
    obligationId,
    eventId,
    currencyCode: readCurrencyCode(raw.currencyCode),
    eventType: readText(raw.eventType),
    obligationTitle: readText(raw.obligationTitle),
    requestedByUserId: readText(raw.requestedByUserId),
    requestedByDisplayName: readText(raw.requestedByDisplayName),
    rejectionReason: readText(raw.rejectionReason),
    responseStatus: readResolution(raw.responseStatus),
    currentAmount: readNumber(raw.currentAmount),
    currentEventDate: readText(raw.currentEventDate),
    currentInstallmentNo: readNumber(raw.currentInstallmentNo),
    currentDescription: readText(raw.currentDescription),
    currentNotes: readText(raw.currentNotes),
    proposedAmount: readNumber(raw.proposedAmount),
    proposedEventDate: readText(raw.proposedEventDate),
    proposedInstallmentNo: readNumber(raw.proposedInstallmentNo),
    proposedDescription: readText(raw.proposedDescription),
    proposedNotes: readText(raw.proposedNotes),
  };
}

/** La moneda se normaliza a mayusculas para que backend y clientes coincidan. */
export function buildEventDeletePayload(
  input: EventDeleteRequestPayload,
): EventDeleteRequestPayload {
  return {
    obligationId: input.obligationId,
    eventId: input.eventId,
    amount: input.amount ?? null,
    currencyCode: input.currencyCode?.trim().toUpperCase() || null,
    eventType: input.eventType ?? null,
    eventDate: input.eventDate ?? null,
    obligationTitle: input.obligationTitle ?? null,
    requestedByUserId: input.requestedByUserId ?? null,
    requestedByDisplayName: input.requestedByDisplayName ?? null,
    rejectionReason: input.rejectionReason ?? null,
    responseStatus: input.responseStatus ?? null,
  };
}

export function buildEventEditPayload(input: EventEditRequestPayload): EventEditRequestPayload {
  return {
    obligationId: input.obligationId,
    eventId: input.eventId,
    currencyCode: input.currencyCode?.trim().toUpperCase() || null,
    eventType: input.eventType ?? null,
    obligationTitle: input.obligationTitle ?? null,
    requestedByUserId: input.requestedByUserId ?? null,
    requestedByDisplayName: input.requestedByDisplayName ?? null,
    rejectionReason: input.rejectionReason ?? null,
    responseStatus: input.responseStatus ?? null,
    currentAmount: input.currentAmount ?? null,
    currentEventDate: input.currentEventDate ?? null,
    currentInstallmentNo: input.currentInstallmentNo ?? null,
    currentDescription: input.currentDescription ?? null,
    currentNotes: input.currentNotes ?? null,
    proposedAmount: input.proposedAmount ?? null,
    proposedEventDate: input.proposedEventDate ?? null,
    proposedInstallmentNo: input.proposedInstallmentNo ?? null,
    proposedDescription: input.proposedDescription ?? null,
    proposedNotes: input.proposedNotes ?? null,
  };
}

/** Que campos cambia realmente la propuesta, para mostrarle al propietario solo eso. */
export function describeEditRequestChanges(payload: EventEditRequestPayload): Array<{
  label: string;
  from: string;
  to: string;
}> {
  const changes: Array<{ label: string; from: string; to: string }> = [];
  const format = (value: unknown) =>
    value == null || value === "" ? "sin valor" : String(value);

  if (payload.proposedAmount != null && payload.proposedAmount !== payload.currentAmount) {
    changes.push({
      label: "Monto",
      from: format(payload.currentAmount),
      to: format(payload.proposedAmount),
    });
  }

  if (payload.proposedEventDate && payload.proposedEventDate !== payload.currentEventDate) {
    changes.push({
      label: "Fecha",
      from: format(payload.currentEventDate),
      to: format(payload.proposedEventDate),
    });
  }

  if (payload.proposedInstallmentNo !== payload.currentInstallmentNo) {
    changes.push({
      label: "Cuota",
      from: format(payload.currentInstallmentNo),
      to: format(payload.proposedInstallmentNo),
    });
  }

  if ((payload.proposedDescription ?? "") !== (payload.currentDescription ?? "")) {
    changes.push({
      label: "Descripcion",
      from: format(payload.currentDescription),
      to: format(payload.proposedDescription),
    });
  }

  if ((payload.proposedNotes ?? "") !== (payload.currentNotes ?? "")) {
    changes.push({
      label: "Notas",
      from: format(payload.currentNotes),
      to: format(payload.proposedNotes),
    });
  }

  return changes;
}
