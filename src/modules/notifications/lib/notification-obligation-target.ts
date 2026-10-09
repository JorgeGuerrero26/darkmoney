import { notificationId } from "./notification-navigation.ts";

export function resolveNotificationObligationTarget(params: URLSearchParams, data: {
  owned: { id: number }[];
  shared: { id: number }[];
  payments: { id: number; obligationId: number; status: string }[];
  deletes: { payload: { obligationId: number; eventId: number } }[];
  edits: { payload: { obligationId: number; eventId: number } }[];
}) {
  const id = notificationId(params.get("resource"));
  const event = notificationId(params.get("event"));
  const request = notificationId(params.get("paymentRequest"));
  const kind = params.get("notificationKind");
  if (!id) return null;
  if (!data.owned.some((row) => row.id === id)) return data.shared.some((row) => row.id === id) ? { mode: "shared" as const, id, event } : null;
  if (kind === "obligation_payment_request" && request && data.payments.some((row) => row.id === request && row.obligationId === id && row.status === "pending")) return { mode: "payment" as const, id, request };
  if (event && kind === "obligation_event_delete_request" && data.deletes.some((row) => row.payload.obligationId === id && row.payload.eventId === event)) return { mode: "delete" as const, id, event };
  if (event && kind === "obligation_event_edit_request" && data.edits.some((row) => row.payload.obligationId === id && row.payload.eventId === event)) return { mode: "edit" as const, id, event };
  return { mode: "owned" as const, id, event };
}
