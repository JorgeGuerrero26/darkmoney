import { useState } from "react";
import { LoaderCircle, PencilLine, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/fields";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type { ObligationSummary } from "../../../types/domain";
import type {
  ObligationEventDeleteRequest,
  ObligationEventEditRequest,
} from "../../../services/queries/workspace-data";
import { describeEditRequestChanges } from "../lib/obligation-event-requests";

type ActiveRequest = { kind: "delete" | "edit"; eventId: number } | null;

export type PendingEventRequestsSectionProps = {
  deleteRequests: ObligationEventDeleteRequest[];
  editRequests: ObligationEventEditRequest[];
  isResolving: boolean;
  obligations: ObligationSummary[];
  onAcceptDelete: (request: ObligationEventDeleteRequest) => Promise<void>;
  onAcceptEdit: (request: ObligationEventEditRequest) => Promise<void>;
  onRejectDelete: (request: ObligationEventDeleteRequest, reason: string) => Promise<void>;
  onRejectEdit: (request: ObligationEventEditRequest, reason: string) => Promise<void>;
};

/**
 * El invitado no puede tocar los eventos del registro ajeno, solo proponer.
 * Aqui el propietario aplica o descarta esas propuestas.
 */
export function PendingEventRequestsSection({
  deleteRequests,
  editRequests,
  isResolving,
  obligations,
  onAcceptDelete,
  onAcceptEdit,
  onRejectDelete,
  onRejectEdit,
}: PendingEventRequestsSectionProps) {
  const [activeRequest, setActiveRequest] = useState<ActiveRequest>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const total = deleteRequests.length + editRequests.length;

  if (total === 0) {
    return null;
  }

  function openRejection(kind: "delete" | "edit", eventId: number) {
    setActiveRequest({ kind, eventId });
    setRejectionReason("");
  }

  function isRejecting(kind: "delete" | "edit", eventId: number) {
    return activeRequest?.kind === kind && activeRequest.eventId === eventId;
  }

  function resolveCurrency(obligationId: number, fallback?: string | null) {
    return (
      obligations.find((obligation) => obligation.id === obligationId)?.currencyCode ??
      fallback ??
      "PEN"
    );
  }

  return (
    <section className="rounded-[28px] border border-sky-300/20 bg-sky-300/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-sky-200/80">
            Cambios propuestos
          </p>
          <p className="mt-2 text-sm leading-7 text-storm">
            Alguien con acceso compartido pidió corregir o eliminar eventos de tu historial. Nada se
            aplica hasta que respondas.
          </p>
        </div>
        <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-3 py-1 text-sm text-sky-100">
          {total}
        </span>
      </div>

      <ul className="mt-5 grid gap-4">
        {editRequests.map((request) => {
          const changes = describeEditRequestChanges(request.payload);
          const rejecting = isRejecting("edit", request.payload.eventId);

          return (
            <li
              className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
              key={`edit-${request.notificationId}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="inline-flex items-center text-sm font-semibold text-ink">
                    <PencilLine className="mr-2 h-4 w-4 text-sky-200" />
                    Editar evento
                  </p>
                  <p className="mt-1 text-xs text-storm">
                    {request.payload.requestedByDisplayName ?? "Usuario invitado"} ·{" "}
                    {request.payload.obligationTitle ?? "Registro compartido"}
                  </p>
                </div>
              </div>

              {changes.length > 0 ? (
                <ul className="mt-3 grid gap-2">
                  {changes.map((change) => (
                    <li
                      className="flex flex-wrap items-baseline gap-2 rounded-[16px] border border-white/8 bg-black/20 px-3 py-2 text-xs"
                      key={change.label}
                    >
                      <span className="uppercase tracking-[0.18em] text-storm/70">
                        {change.label}
                      </span>
                      <span className="text-storm line-through">{change.from}</span>
                      <span className="text-storm/50">→</span>
                      <span className="font-semibold text-ink">{change.to}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs leading-5 text-storm">
                  La propuesta no cambia ningun campo.
                </p>
              )}

              {rejecting ? (
                <div className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-ink">Motivo del rechazo</p>
                  <Input
                    className="mt-3"
                    maxLength={160}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Opcional. Se le muestra a quien lo pidio."
                    type="text"
                    value={rejectionReason}
                  />
                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <Button
                      disabled={isResolving}
                      onClick={() => setActiveRequest(null)}
                      type="button"
                      variant="ghost"
                    >
                      Cancelar
                    </Button>
                    <Button
                      disabled={isResolving}
                      onClick={() => {
                        void onRejectEdit(request, rejectionReason).then(() =>
                          setActiveRequest(null),
                        );
                      }}
                      type="button"
                    >
                      {isResolving ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Confirmar rechazo"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    disabled={isResolving || changes.length === 0}
                    onClick={() => {
                      void onAcceptEdit(request);
                    }}
                    type="button"
                  >
                    Aplicar cambios
                  </Button>
                  <Button
                    disabled={isResolving}
                    onClick={() => openRejection("edit", request.payload.eventId)}
                    type="button"
                    variant="ghost"
                  >
                    Rechazar
                  </Button>
                </div>
              )}
            </li>
          );
        })}

        {deleteRequests.map((request) => {
          const currencyCode = resolveCurrency(
            request.payload.obligationId,
            request.payload.currencyCode,
          );
          const rejecting = isRejecting("delete", request.payload.eventId);

          return (
            <li
              className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
              key={`delete-${request.notificationId}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="inline-flex items-center text-sm font-semibold text-ink">
                    <Trash2 className="mr-2 h-4 w-4 text-rose-300" />
                    Eliminar evento
                  </p>
                  <p className="mt-1 text-xs text-storm">
                    {request.payload.requestedByDisplayName ?? "Usuario invitado"} ·{" "}
                    {request.payload.obligationTitle ?? "Registro compartido"}
                  </p>
                  {request.payload.eventDate ? (
                    <p className="mt-1 text-xs text-storm">
                      {formatDate(request.payload.eventDate)}
                    </p>
                  ) : null}
                </div>
                {request.payload.amount != null ? (
                  <p className="shrink-0 font-display text-xl font-semibold text-ink">
                    {formatCurrency(request.payload.amount, currencyCode)}
                  </p>
                ) : null}
              </div>

              <p className="mt-3 text-xs leading-5 text-storm">
                Al aplicarlo el monto vuelve al saldo pendiente y tambien se borra el movimiento
                vinculado, si lo hay.
              </p>

              {rejecting ? (
                <div className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-medium text-ink">Motivo del rechazo</p>
                  <Input
                    className="mt-3"
                    maxLength={160}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Opcional. Se le muestra a quien lo pidio."
                    type="text"
                    value={rejectionReason}
                  />
                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <Button
                      disabled={isResolving}
                      onClick={() => setActiveRequest(null)}
                      type="button"
                      variant="ghost"
                    >
                      Cancelar
                    </Button>
                    <Button
                      disabled={isResolving}
                      onClick={() => {
                        void onRejectDelete(request, rejectionReason).then(() =>
                          setActiveRequest(null),
                        );
                      }}
                      type="button"
                    >
                      {isResolving ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        "Confirmar rechazo"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button
                    disabled={isResolving}
                    onClick={() => {
                      void onAcceptDelete(request);
                    }}
                    type="button"
                  >
                    Eliminar evento
                  </Button>
                  <Button
                    disabled={isResolving}
                    onClick={() => openRejection("delete", request.payload.eventId)}
                    type="button"
                    variant="ghost"
                  >
                    Rechazar
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
