import { useEffect, useRef, useState } from "react";
import { useNotificationFocus } from "../../../hooks/use-notification-focus";
import { useRequestResolution } from "../hooks/use-request-resolution";
import { CircleDollarSign, LoaderCircle } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/fields";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { formatCurrency } from "../../../lib/formatting/money";
import { formatDate } from "../../../lib/formatting/dates";
import type {
  AccountSummary,
  ObligationPaymentRequest,
  ObligationSummary,
} from "../../../types/domain";

export type PendingPaymentRequestsSectionProps = {
  focusRequestId?: number | null;
  accounts: AccountSummary[];
  isResolving: boolean;
  obligations: ObligationSummary[];
  onAccept: (input: {
    request: ObligationPaymentRequest;
    obligation: ObligationSummary;
    registerAccountMovement: boolean;
    accountId: number | null;
  }) => Promise<void>;
  onReject: (input: {
    request: ObligationPaymentRequest;
    obligation: ObligationSummary;
    rejectionReason: string;
  }) => Promise<void>;
  requests: ObligationPaymentRequest[];
};

/**
 * Bandeja del propietario: el invitado no puede tocar el saldo, solo pedir que se
 * registre un abono. Aqui se acepta (creando el abono real) o se rechaza.
 */
export function PendingPaymentRequestsSection({
  accounts,
  isResolving:externalResolving,
  obligations,
  onAccept,
  onReject,
  requests,
  focusRequestId,
}: PendingPaymentRequestsSectionProps) {
  const resolution=useRequestResolution(externalResolving);
  const isResolving=resolution.busy;
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [registerAccountMovement, setRegisterAccountMovement] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [mode, setMode] = useState<"accept" | "reject">("accept");

  const resolvableRequests = requests.filter((request) =>
    request.status==="pending"&&obligations.some((obligation) => obligation.id === request.obligationId&&obligation.workspaceId===request.workspaceId),
  );

  const focusedRow = useNotificationFocus<HTMLLIElement>(focusRequestId, resolvableRequests.some((row) => row.id === focusRequestId));
  const consumedFocus = useRef<number | null>(null);
  useEffect(() => {
    if (!focusRequestId) { consumedFocus.current = null; return; }
    if(isResolving)return;
    const request = resolvableRequests.find((row) => row.id === focusRequestId);
    if (!request || consumedFocus.current === focusRequestId) return;
    consumedFocus.current = focusRequestId;
    openRequest(request, "accept");
  }, [focusRequestId, requests, obligations,isResolving]);

  if (resolvableRequests.length === 0) {
    return null;
  }

  function openRequest(request: ObligationPaymentRequest, nextMode: "accept" | "reject") {
    const obligation = obligations.find((item) => item.id === request.obligationId) ?? null;
    setActiveRequestId(request.id);
    setMode(nextMode);
    setRegisterAccountMovement(true);
    setRejectionReason("");
    resolution.setError("");
    setAccountId(
      obligation?.settlementAccountId ? String(obligation.settlementAccountId) : "",
    );
  }

  return (
    <section className="border-t border-white/10 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">
            Solicitudes por responder
          </p>
          <p className="mt-2 text-sm leading-7 text-storm">
            Las personas con acceso compartido pidieron registrar estos abonos. Nada cambia hasta
            que respondas.
          </p>
        </div>
        <span className="text-sm text-storm">
          {resolvableRequests.length}
        </span>
      </div>

      {resolution.error?<p role="alert" className="mt-3 text-sm text-ink">{resolution.error}</p>:null}
      <ul className="mt-5 divide-y divide-white/10">
        {resolvableRequests.map((request) => {
          const obligation = obligations.find((item) => item.id === request.obligationId);

          if (!obligation) {
            return null;
          }

          const isActive = activeRequestId === request.id;
          const accountOptions = accounts
            .filter(
              (account) =>
                (!account.isArchived || String(account.id) === accountId) &&
                account.currencyCode === obligation.currencyCode,
            )
            .map<PickerOption>((account) => ({
              value: String(account.id),
              label: account.name,
              description: `${account.type} - ${account.currencyCode}`,
              leadingLabel: account.currencyCode,
              leadingColor: account.color,
              searchText: `${account.name} ${account.type} ${account.currencyCode}`,
            }));

          return (
            <li
              className="py-4"
              key={request.id}
              ref={request.id === focusRequestId ? focusedRow : undefined}
              tabIndex={request.id === focusRequestId ? -1 : undefined}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{obligation.title}</p>
                  <p className="mt-1 text-xs text-storm">
                    {request.requestedByDisplayName ?? "Usuario invitado"} · {formatDate(request.paymentDate)}
                    {request.installmentNo ? ` · cuota #${request.installmentNo}` : ""}
                  </p>
                  {request.description ? (
                    <p className="mt-2 text-xs leading-5 text-storm">{request.description}</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-display text-xl font-semibold text-ink">
                  {formatCurrency(request.amount, obligation.currencyCode)}
                </p>
              </div>

              {isActive ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  {mode === "accept" ? (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink">Movimiento en cuenta</p>
                          <p className="mt-1 text-xs leading-5 text-storm">
                            Al aceptar creamos el abono. Si activas esto, tambien el movimiento en
                            tu cuenta.
                          </p>
                        </div>
                        <button
                          aria-pressed={registerAccountMovement}
                          aria-label="Registrar movimiento en cuenta"
                          disabled={isResolving}
                          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition ${
                            registerAccountMovement
                              ? "border-white/20 bg-white/10"
                              : "border-white/12 bg-white/[0.05]"
                          }`}
                          onClick={() => setRegisterAccountMovement((current) => !current)}
                          type="button"
                        >
                          <span
                            className={`absolute h-6 w-6 rounded-full bg-white transition ${
                              registerAccountMovement ? "left-7" : "left-1"
                            }`}
                          />
                        </button>
                      </div>

                      {registerAccountMovement ? (
                        <div className="mt-4">
                          <SearchablePicker
                            disabled={accountOptions.length === 0}
                            emptyMessage={`No hay cuentas en ${obligation.currencyCode} disponibles.`}
                            onChange={setAccountId}
                            options={accountOptions}
                            placeholderDescription="Cuenta afectada por este abono."
                            placeholderLabel="Selecciona una cuenta"
                            queryPlaceholder="Buscar cuenta..."
                            value={accountId}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-ink">Motivo del rechazo</p>
                      <p className="mt-1 text-xs leading-5 text-storm">
                        Opcional. Se le muestra a quien envio la solicitud.
                      </p>
                      <Input
                        className="mt-3"
                        maxLength={160}
                        onChange={(event) => setRejectionReason(event.target.value)}
                        placeholder="Ej. Todavia no me llega la transferencia."
                        type="text"
                        value={rejectionReason}
                      />
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    <Button
                      disabled={isResolving}
                      onClick={() => setActiveRequestId(null)}
                      type="button"
                      variant="ghost"
                    >
                      Cancelar
                    </Button>
                    <Button
                      disabled={isResolving}
                      onClick={() => {
                        if (mode === "accept") {
                          if(registerAccountMovement&&!accounts.some(account=>String(account.id)===accountId&&!account.isArchived&&account.workspaceId===obligation.workspaceId&&account.currencyCode===obligation.currencyCode)){
                            resolution.setError("Elige una cuenta activa de este espacio y moneda, o desactiva el movimiento en cuenta.");return;
                          }
                          void resolution.run(()=>onAccept({
                            request,
                            obligation,
                            registerAccountMovement,
                            accountId: accountId ? Number(accountId) : null,
                          }),()=>setActiveRequestId(null));

                          return;
                        }

                        void resolution.run(()=>onReject({ request, obligation, rejectionReason }),()=>setActiveRequestId(null));
                      }}
                      type="button"
                    >
                      {isResolving ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Guardando...
                        </>
                      ) : mode === "accept" ? (
                        <>
                          <CircleDollarSign className="mr-2 h-4 w-4" />
                          Confirmar abono
                        </>
                      ) : (
                        "Confirmar rechazo"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button disabled={isResolving} onClick={() => openRequest(request, "accept")} type="button">
                    Aceptar
                  </Button>
                  <Button
                    disabled={isResolving}
                    onClick={() => openRequest(request, "reject")}
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
