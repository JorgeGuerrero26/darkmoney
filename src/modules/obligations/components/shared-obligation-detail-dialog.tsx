import { useState, type FormEvent } from "react";
import { CircleDollarSign, LoaderCircle, Link2, Link2Off, X } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { Input, Textarea } from "../../../components/ui/fields";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { ProgressBar } from "../../../components/ui/progress-bar";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  ObligationEventSummary,
  ObligationEventViewerLink,
  ObligationPaymentRequest,
  SharedObligationSummary,
} from "../../../types/domain";
import {
  getEventIcon,
  getEventLabel,
  getSharedDirectionDescription,
  getSharedDirectionLabel,
  getStatusOption,
  getStatusTone,
} from "../lib/obligations-presenters";

/**
 * Desde la perspectiva del invitado la direccion se invierte: si el propietario
 * registro un credito por cobrar, el invitado es quien debe.
 */
export function viewerActsAsCollector(direction: SharedObligationSummary["direction"]) {
  return direction === "payable";
}

export type SharedObligationRequestFormState = {
  amount: string;
  paymentDate: string;
  installmentNo: string;
  description: string;
  notes: string;
  linkToAccount: boolean;
  accountId: string;
};

type SharedObligationDetailDialogProps = {
  accounts: AccountSummary[];
  feedback: { tone: "success" | "error" | "info"; title: string; description: string } | null;
  formState: SharedObligationRequestFormState;
  isLinking: boolean;
  isSendingRequest: boolean;
  obligation: SharedObligationSummary;
  onClose: () => void;
  onLinkEvent: (event: ObligationEventSummary, accountId: number) => Promise<void>;
  onSubmitRequest: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUnlinkEvent: (link: ObligationEventViewerLink) => Promise<void>;
  requests: ObligationPaymentRequest[];
  updateFormState: <Field extends keyof SharedObligationRequestFormState>(
    field: Field,
    value: SharedObligationRequestFormState[Field],
  ) => void;
  viewerLinks: ObligationEventViewerLink[];
};

const panelClassName =
  "rounded-[26px] border border-white/10 bg-white/[0.02] p-5 backdrop-blur-xl";

export function SharedObligationDetailDialog({
  accounts,
  feedback,
  formState,
  isLinking,
  isSendingRequest,
  obligation,
  onClose,
  onLinkEvent,
  onSubmitRequest,
  onUnlinkEvent,
  requests,
  updateFormState,
  viewerLinks,
}: SharedObligationDetailDialogProps) {
  const [activeTab, setActiveTab] = useState<"history" | "requests">("requests");
  const [linkingEventId, setLinkingEventId] = useState<number | null>(null);
  const [linkAccountId, setLinkAccountId] = useState("");

  const collectsMoney = viewerActsAsCollector(obligation.direction);
  const statusOption = getStatusOption(obligation.status);
  const ownerName = obligation.share.ownerDisplayName ?? "el propietario";
  const linkByEventId = new Map(viewerLinks.map((link) => [link.eventId, link]));
  const accountOptions = accounts
    .filter((account) => !account.isArchived && account.currencyCode === obligation.currencyCode)
    .map<PickerOption>((account) => ({
      value: String(account.id),
      label: account.name,
      description: `${account.type} - ${account.currencyCode}`,
      leadingLabel: account.currencyCode,
      leadingColor: account.color,
      searchText: `${account.name} ${account.type} ${account.currencyCode}`,
    }));
  const pendingRequests = requests.filter((request) => request.status === "pending");

  return (
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-void/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[980px] overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl [transform:translateZ(0)]">
          <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden">
            <div className="overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <StatusBadge status="Compartida contigo" tone="info" />
                    <StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} />
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.5rem]">
                    {obligation.title}
                  </h2>
                  <p className="mt-3 text-sm leading-7 text-storm">
                    {getSharedDirectionLabel(obligation.direction)} de {ownerName}.{" "}
                    {getSharedDirectionDescription(obligation.direction)}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-storm/85">
                    {collectsMoney
                      ? "Desde tu lado, cada abono registrado es dinero que recibes."
                      : "Desde tu lado, cada abono registrado es dinero que pagas."}
                  </p>
                </div>

                <button
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
                  onClick={onClose}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {feedback ? (
                <FormFeedbackBanner
                  className="mt-6"
                  description={feedback.description}
                  title={feedback.title}
                  tone={feedback.tone}
                />
              ) : null}

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Principal</p>
                  <p className="mt-3 font-display text-2xl font-semibold text-ink">
                    {formatCurrency(
                      obligation.currentPrincipalAmount ?? obligation.principalAmount,
                      obligation.currencyCode,
                    )}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Pendiente</p>
                  <p className="mt-3 font-display text-2xl font-semibold text-ink">
                    {formatCurrency(obligation.pendingAmount, obligation.currencyCode)}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Avance</p>
                  <p className="mt-3 font-display text-2xl font-semibold text-ink">
                    {obligation.progressPercent}%
                  </p>
                  <div className="mt-3">
                    <ProgressBar value={obligation.progressPercent} />
                  </div>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-black/15 p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">
                    Fecha objetivo
                  </p>
                  <p className="mt-3 text-sm font-medium text-ink">
                    {obligation.dueDate ? formatDate(obligation.dueDate) : "Sin fecha"}
                  </p>
                  <p className="mt-2 text-xs text-storm">{obligation.installmentLabel}</p>
                </div>
              </div>

              <div className="mt-6 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1">
                <button
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    activeTab === "requests" ? "bg-white/[0.08] text-ink" : "text-storm"
                  }`}
                  onClick={() => setActiveTab("requests")}
                  type="button"
                >
                  Solicitar abono
                  {pendingRequests.length > 0 ? (
                    <span className="ml-2 rounded-full bg-amber-300/15 px-2 py-0.5 text-[0.68rem] text-amber-100">
                      {pendingRequests.length}
                    </span>
                  ) : null}
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    activeTab === "history" ? "bg-white/[0.08] text-ink" : "text-storm"
                  }`}
                  onClick={() => setActiveTab("history")}
                  type="button"
                >
                  Historial
                </button>
              </div>

              {activeTab === "requests" ? (
                <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_0.9fr]">
                  <form className={panelClassName} noValidate onSubmit={onSubmitRequest}>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                      Nueva solicitud
                    </p>
                    <p className="mt-2 text-sm leading-7 text-storm">
                      No puedes modificar el saldo directamente. {ownerName} recibe la solicitud y
                      decide si la registra.
                    </p>

                    <div className="mt-5 grid gap-4">
                      <label className="block">
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/80">
                          Monto
                        </span>
                        <Input
                          className="mt-2"
                          inputMode="decimal"
                          min="0"
                          onChange={(event) => updateFormState("amount", event.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          type="number"
                          value={formState.amount}
                        />
                      </label>

                      <label className="block">
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/80">
                          Fecha
                        </span>
                        <div className="mt-2">
                          <DatePickerField
                            onChange={(nextValue) => updateFormState("paymentDate", nextValue)}
                            value={formState.paymentDate}
                          />
                        </div>
                      </label>

                      <label className="block">
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/80">
                          Cuota (opcional)
                        </span>
                        <Input
                          className="mt-2"
                          inputMode="numeric"
                          min="1"
                          onChange={(event) => updateFormState("installmentNo", event.target.value)}
                          placeholder="Ej. 3"
                          step="1"
                          type="number"
                          value={formState.installmentNo}
                        />
                      </label>

                      <label className="block">
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/80">
                          Descripcion
                        </span>
                        <Input
                          className="mt-2"
                          maxLength={120}
                          onChange={(event) => updateFormState("description", event.target.value)}
                          placeholder="Ej. Transferencia del 12 de marzo"
                          type="text"
                          value={formState.description}
                        />
                      </label>

                      <label className="block">
                        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/80">
                          Notas
                        </span>
                        <Textarea
                          className="mt-2 min-h-[96px]"
                          onChange={(event) => updateFormState("notes", event.target.value)}
                          placeholder="Numero de operacion, banco, acuerdo..."
                          value={formState.notes}
                        />
                      </label>

                      <div className="rounded-[20px] border border-white/10 bg-black/15 p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">Sugerir mi cuenta</p>
                            <p className="mt-1 text-xs leading-5 text-storm">
                              Se guarda con la solicitud para que sepas donde reflejarlo cuando la
                              acepten.
                            </p>
                          </div>
                          <button
                            aria-pressed={formState.linkToAccount}
                            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition ${
                              formState.linkToAccount
                                ? "border-pine/35 bg-pine/18"
                                : "border-white/12 bg-white/[0.05]"
                            }`}
                            onClick={() => updateFormState("linkToAccount", !formState.linkToAccount)}
                            type="button"
                          >
                            <span
                              className={`absolute h-6 w-6 rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition ${
                                formState.linkToAccount ? "left-7" : "left-1"
                              }`}
                            />
                          </button>
                        </div>

                        {formState.linkToAccount ? (
                          <div className="mt-4">
                            <SearchablePicker
                              disabled={accountOptions.length === 0}
                              emptyMessage={`No tienes cuentas en ${obligation.currencyCode}.`}
                              onChange={(value) => updateFormState("accountId", value)}
                              options={accountOptions}
                              placeholderDescription="Tu cuenta, en tu propio workspace."
                              placeholderLabel="Selecciona una cuenta"
                              queryPlaceholder="Buscar cuenta..."
                              value={formState.accountId}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <Button className="mt-5 w-full" disabled={isSendingRequest} type="submit">
                      {isSendingRequest ? (
                        <>
                          <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <CircleDollarSign className="mr-2 h-4 w-4" />
                          Enviar solicitud
                        </>
                      )}
                    </Button>
                  </form>

                  <div className={panelClassName}>
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                      Mis solicitudes
                    </p>
                    {requests.length === 0 ? (
                      <p className="mt-4 text-sm leading-7 text-storm">
                        Todavia no enviaste ninguna solicitud sobre este registro.
                      </p>
                    ) : (
                      <ul className="mt-4 grid gap-3">
                        {requests.map((request) => (
                          <li
                            className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4"
                            key={request.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-ink">
                                  {formatCurrency(request.amount, obligation.currencyCode)}
                                </p>
                                <p className="mt-1 text-xs text-storm">
                                  {formatDate(request.paymentDate)}
                                  {request.installmentNo ? ` · cuota #${request.installmentNo}` : ""}
                                </p>
                              </div>
                              <StatusBadge
                                status={getRequestStatusLabel(request.status)}
                                tone={getRequestStatusTone(request.status)}
                              />
                            </div>
                            {request.description ? (
                              <p className="mt-2 text-xs leading-5 text-storm">
                                {request.description}
                              </p>
                            ) : null}
                            {request.status === "rejected" && request.rejectionReason ? (
                              <p className="mt-2 text-xs leading-5 text-rose-200/80">
                                Motivo: {request.rejectionReason}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : (
                <div className={`${panelClassName} mt-5`}>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                    Historial del registro
                  </p>
                  <p className="mt-2 text-sm leading-7 text-storm">
                    Puedes reflejar cada evento en una de tus cuentas. El movimiento se crea en tu
                    workspace, no en el de {ownerName}.
                  </p>

                  {obligation.events.length === 0 ? (
                    <p className="mt-4 text-sm leading-7 text-storm">Aun no hay eventos.</p>
                  ) : (
                    <ul className="mt-4 grid gap-3">
                      {obligation.events.map((event) => {
                        const link = linkByEventId.get(event.id) ?? null;
                        const isLinkingThis = linkingEventId === event.id;

                        return (
                          <li
                            className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4"
                            key={event.id}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 gap-3">
                                <span aria-hidden="true" className="mt-0.5 text-base leading-none">
                                  {getEventIcon(event.eventType)}
                                </span>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-ink">
                                    {getEventLabel(event.eventType)}
                                    {event.installmentNo ? (
                                      <span className="ml-2 text-xs text-storm/70">
                                        #{event.installmentNo}
                                      </span>
                                    ) : null}
                                  </p>
                                  <p className="mt-0.5 text-xs text-storm">
                                    {formatDate(event.eventDate)}
                                  </p>
                                  {event.reason ?? event.description ? (
                                    <p className="mt-2 text-xs leading-5 text-storm">
                                      {event.reason ?? event.description}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <span className="shrink-0 text-sm font-semibold text-ink">
                                {formatCurrency(event.amount, obligation.currencyCode)}
                              </span>
                            </div>

                            {link ? (
                              <div className="mt-3 flex flex-wrap items-center gap-3">
                                <span className="inline-flex items-center rounded-full border border-pine/25 bg-pine/10 px-3 py-1 text-xs text-pine">
                                  <Link2 className="mr-2 h-3.5 w-3.5" />
                                  Reflejado en tu cuenta
                                </span>
                                <button
                                  className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-storm transition hover:border-rose-400/40 hover:text-rose-200"
                                  disabled={isLinking}
                                  onClick={() => {
                                    void onUnlinkEvent(link);
                                  }}
                                  type="button"
                                >
                                  <Link2Off className="mr-2 h-3.5 w-3.5" />
                                  Quitar vinculo
                                </button>
                              </div>
                            ) : isLinkingThis ? (
                              <div className="mt-3 rounded-[18px] border border-white/10 bg-black/20 p-4">
                                <SearchablePicker
                                  disabled={accountOptions.length === 0}
                                  emptyMessage={`No tienes cuentas en ${obligation.currencyCode}.`}
                                  onChange={setLinkAccountId}
                                  options={accountOptions}
                                  placeholderDescription="Cuenta donde se reflejara este evento."
                                  placeholderLabel="Selecciona una cuenta"
                                  queryPlaceholder="Buscar cuenta..."
                                  value={linkAccountId}
                                />
                                <div className="mt-4 flex flex-wrap justify-end gap-3">
                                  <Button
                                    disabled={isLinking}
                                    onClick={() => setLinkingEventId(null)}
                                    type="button"
                                    variant="ghost"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    disabled={isLinking || !linkAccountId}
                                    onClick={() => {
                                      void onLinkEvent(event, Number(linkAccountId)).then(() =>
                                        setLinkingEventId(null),
                                      );
                                    }}
                                    type="button"
                                  >
                                    {isLinking ? (
                                      <>
                                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                                        Vinculando...
                                      </>
                                    ) : (
                                      "Confirmar"
                                    )}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                className="mt-3 inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-storm transition hover:border-white/20 hover:text-ink"
                                onClick={() => {
                                  setLinkingEventId(event.id);
                                  setLinkAccountId("");
                                }}
                                type="button"
                              >
                                <Link2 className="mr-2 h-3.5 w-3.5" />
                                Reflejar en mi cuenta
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-black/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  Este registro pertenece a {ownerName}. Tu solo puedes seguirlo y proponer cambios.
                </p>
                <Button onClick={onClose} type="button" variant="ghost">
                  Cerrar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRequestStatusLabel(status: ObligationPaymentRequest["status"]) {
  switch (status) {
    case "accepted":
      return "Aceptada";
    case "rejected":
      return "Rechazada";
    case "cancelled":
      return "Cancelada";
    default:
      return "Pendiente";
  }
}

function getRequestStatusTone(status: ObligationPaymentRequest["status"]) {
  switch (status) {
    case "accepted":
      return "success" as const;
    case "rejected":
      return "danger" as const;
    case "cancelled":
      return "neutral" as const;
    default:
      return "warning" as const;
  }
}
