import { useState } from "react";
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
  isResolving,
  obligations,
  onAccept,
  onReject,
  requests,
}: PendingPaymentRequestsSectionProps) {
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const [registerAccountMovement, setRegisterAccountMovement] = useState(true);
  const [accountId, setAccountId] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [mode, setMode] = useState<"accept" | "reject">("accept");

  const resolvableRequests = requests.filter((request) =>
    obligations.some((obligation) => obligation.id === request.obligationId),
  );

  if (resolvableRequests.length === 0) {
    return null;
  }

  function openRequest(request: ObligationPaymentRequest, nextMode: "accept" | "reject") {
    const obligation = obligations.find((item) => item.id === request.obligationId) ?? null;
    setActiveRequestId(request.id);
    setMode(nextMode);
    setRegisterAccountMovement(true);
    setRejectionReason("");
    setAccountId(
      obligation?.settlementAccountId ? String(obligation.settlementAccountId) : "",
    );
  }

  return (
    <section className="rounded-[28px] border border-amber-300/20 bg-amber-300/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-amber-200/80">
            Solicitudes por responder
          </p>
          <p className="mt-2 text-sm leading-7 text-storm">
            Las personas con acceso compartido pidieron registrar estos abonos. Nada cambia hasta
            que respondas.
          </p>
        </div>
        <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-sm text-amber-100">
          {resolvableRequests.length}
        </span>
      </div>

      <ul className="mt-5 grid gap-4">
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
              className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"
              key={request.id}
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
                <div className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4">
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
                          className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition ${
                            registerAccountMovement
                              ? "border-pine/35 bg-pine/18"
                              : "border-white/12 bg-white/[0.05]"
                          }`}
                          onClick={() => setRegisterAccountMovement((current) => !current)}
                          type="button"
                        >
                          <span
                            className={`absolute h-6 w-6 rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition ${
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
                          void onAccept({
                            request,
                            obligation,
                            registerAccountMovement:
                              registerAccountMovement && accountOptions.length > 0,
                            accountId: accountId ? Number(accountId) : null,
                          }).then(() => setActiveRequestId(null));

                          return;
                        }

                        void onReject({ request, obligation, rejectionReason }).then(() =>
                          setActiveRequestId(null),
                        );
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
                  <Button onClick={() => openRequest(request, "accept")} type="button">
                    Aceptar
                  </Button>
                  <Button
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
