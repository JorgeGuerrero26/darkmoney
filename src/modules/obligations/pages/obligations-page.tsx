import { buildObligationEditorInput } from "../lib/obligation-editor-input";
import { ObligationEditorDialog as EditorDialog, Picker, Field, Input, Textarea, labelClassName } from "../components/obligation-editor-dialog";
import { statusOptions, getOriginTypeOptions, getOpeningImpact, applyObligationFormRules, getCurrencyLabel, type ObligationFormState, type ShareInviteFormState, type FeedbackState } from "../lib/obligation-editor-model";
import {
  Archive,
  ArrowDownCircle,
  ArrowUpCircle,
  CircleDollarSign,
  Check,
  ChevronDown,
  Download,
  LoaderCircle,
  Layers,
  MailPlus,
  MoreVertical,
  Minus,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import type {
  FormEvent,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useObligationNotificationOpening } from "../../notifications/hooks/use-obligation-notification-opening";

import { Button } from "../../../components/ui/button";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { DataState } from "../../../components/ui/data-state";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { Pagination } from "../../../components/ui/pagination";
import type { PickerOption } from "../../../components/ui/searchable-picker";
import { ResourceEditorDestination, ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { BulkActionBar, useSelection } from "../../../components/ui/bulk-action-bar";
import { useQueryClient } from "@tanstack/react-query";

import { getPublicAppUrl } from "../../../lib/app-url";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  AttachmentSummary,
  ObligationDirection,
  ObligationEventSummary,
  ObligationEventViewerLink,
  ObligationPaymentRequest,
  ObligationShareSummary,
  ObligationOriginType,
  ObligationStatus,
  ObligationSummary,
  SharedObligationSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { ObligationAnalyticsModal } from "../components/obligation-analytics-modal";
import { AttachmentGallery } from "../../attachments/components/attachment-gallery";
import { PendingReceiptField } from "../../attachments/components/pending-receipt-field";
import { CompactAttachmentField, CompactPendingAttachmentField } from "../../attachments/components/compact-attachment-field";
import {
  deleteStoredReceipt,
  prepareReceiptUpload,
  uploadPreparedReceipt,
} from "../../attachments/receipt-utils";
import { useReceiptFeatureAccess } from "../../attachments/use-receipt-feature-access";
import { useProFeatureAccess } from "../../shared/use-pro-feature-access";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  useCreateAttachmentRecordMutation,
  useCreateObligationShareInviteMutation,
  useDeleteAttachmentRecordMutation,
  getQueryErrorMessage,
  type ObligationShareInviteInput,
  type ObligationPrincipalAdjustmentFormInput,
  type ObligationPaymentFormInput,
  useAdjustObligationPrincipalMutation,
  useArchiveObligationMutation,
  useCreateObligationMutation,
  useDeleteObligationMutation,
  useEntityAttachmentsQuery,
  useObligationSharesQuery,
  mirrorObligationEventAttachmentsToMovement,
  useAcceptObligationEventDeleteRequestMutation,
  useAcceptObligationEventEditRequestMutation,
  useAcceptPaymentRequestMutation,
  useCreateObligationEventDeleteRequestMutation,
  useCreateObligationEventEditRequestMutation,
  useCreatePaymentRequestMutation,
  useDeleteObligationEventMutation,
  useDeleteViewerEventLinkMutation,
  useLinkEventToAccountMutation,
  useObligationEventRequestsQuery,
  useObligationEventViewerLinksQuery,
  usePendingPaymentRequestsQuery,
  useRejectObligationEventDeleteRequestMutation,
  useRejectObligationEventEditRequestMutation,
  useViewerObligationEventRequestsQuery,
  useViewerPaymentRequestsQuery,
  type ObligationEventDeleteRequest,
  type ObligationEventEditRequest,
  useRegisterObligationPaymentMutation,
  useRejectPaymentRequestMutation,
  useSharedObligationsQuery,
  useUnlinkObligationShareMutation,
  useUpdateObligationEventMutation,
  useUpdateObligationMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import { ObligationTable } from "../components/obligation-table";
import { ObligationDetailDialog } from "../components/obligation-detail-dialog";
import { coverPlan, expandPaymentPlan, normalizePaymentPlan, parsePaymentPlan, planDifference } from "../lib/payment-plan";
import { PendingEventRequestsSection } from "../components/pending-event-requests-section";
import { PendingPaymentRequestsSection } from "../components/pending-payment-requests-section";
import {
  SharedObligationDetailDialog,
  type EventEditProposal,
  type SharedObligationRequestFormState,
} from "../components/shared-obligation-detail-dialog";
import { SharedObligationsSection } from "../components/shared-obligations-section";
import { useObligationsFilters } from "../hooks/use-obligations-filters";

type EditorMode = "create" | "edit";

type PaymentFormState = {
  amount: string;
  eventDate: string;
  installmentNo: string;
  description: string;
  notes: string;
  registerAccountMovement: boolean;
  accountId: string;
};

type PrincipalAdjustmentMode = "increase" | "decrease";

type PrincipalAdjustmentFormState = {
  amount: string;
  eventDate: string;
  reason: string;
  notes: string;
  registerAccountMovement: boolean;
  accountId: string;
};

const OBLIGATIONS_PAGE_SIZE = 50;

const panelClassName =
  "glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] p-4 sm:p-6";

function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function parseOptionalInteger(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  return Number.isInteger(parsedValue) ? parsedValue : Number.NaN;
}

function parseOptionalNumber(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return null;
  }

  const parsedValue = Number(normalizedValue.replace(",", "."));
  return Number.isFinite(parsedValue) ? parsedValue : Number.NaN;
}

function createDefaultFormState(baseCurrencyCode: string): ObligationFormState {
  return {
    direction: "payable",
    originType: "cash_loan",
    manualOpeningImpact: "none",
    status: "active",
    title: "",
    counterpartyId: "",
    openingAccountId: "",
    settlementAccountId: "",
    currencyCode: baseCurrencyCode,
    principalAmount: "",
    startDate: toDateInputValue(new Date().toISOString()),
    dueDate: "",
    installmentAmount: "",
    installmentCount: "",
    paymentPlan: null,
    interestRate: "",
    description: "",
    notes: "",
  };
}

function createDefaultShareInviteFormState(): ShareInviteFormState {
  return {
    invitedEmail: "",
    message: "",
  };
}

function buildShareInviteFormState(share?: ObligationShareSummary | null): ShareInviteFormState {
  return {
    invitedEmail: share?.invitedEmail ?? "",
    message: share?.message ?? "",
  };
}

function shouldResendShareInvite(
  currentShare: ObligationShareSummary | null,
  formState: ShareInviteFormState,
) {
  const invitedEmail = formState.invitedEmail.trim().toLowerCase();
  const normalizedMessage = formState.message.trim();

  if (!invitedEmail) {
    return false;
  }

  if (!currentShare) {
    return true;
  }

  if (currentShare.invitedEmail !== invitedEmail) {
    return true;
  }

  return currentShare.status === "pending" && (currentShare.message ?? "").trim() !== normalizedMessage;
}

function describeShareInviteOutcome(
  inviteResult: {
    alreadyAccepted: boolean;
    emailSent: boolean;
    emailError?: string | null;
    invitedDisplayName?: string | null;
    invitedEmail: string;
  },
  context: "invite" | "create" | "reassign" = "invite",
) {
  const invitedLabel = inviteResult.invitedDisplayName ?? inviteResult.invitedEmail;

  if (inviteResult.alreadyAccepted) {
    return context === "reassign"
      ? `${invitedLabel} ya tenia aceptado este acceso compartido.`
      : `${invitedLabel} ya habia aceptado este registro compartido.`;
  }

  if (inviteResult.emailSent) {
    if (context === "create") {
      return `Tambien enviamos una invitacion por correo a ${invitedLabel}.`;
    }

    if (context === "reassign") {
      return `Tambien reasignamos el acceso compartido a ${invitedLabel} y le enviamos un nuevo correo.`;
    }

    return `Le enviamos un correo a ${invitedLabel} para que confirme el acceso.`;
  }

  const emailIssue = formatShareInviteEmailIssue(inviteResult.emailError);

  if (context === "create") {
    return `La invitacion para ${invitedLabel} quedo creada, pero el correo automatico fallo${emailIssue ? `: ${emailIssue}` : "."}`;
  }

  if (context === "reassign") {
    return `Reasignamos el acceso compartido a ${invitedLabel}, pero el correo automatico fallo${emailIssue ? `: ${emailIssue}` : "."}`;
  }

  return `La invitacion quedo creada para ${invitedLabel}, pero el correo automatico fallo${emailIssue ? `: ${emailIssue}` : "."}`;
}

function formatShareInviteEmailIssue(emailError?: string | null) {
  const rawIssue = emailError?.trim();

  if (!rawIssue) {
    return null;
  }

  let resolvedMessage = rawIssue;
  const jsonStart = rawIssue.indexOf("{");

  if (jsonStart >= 0) {
    const prefix = rawIssue.slice(0, jsonStart).trim().replace(/:$/, "");
    const serializedPayload = rawIssue.slice(jsonStart);

    try {
      const parsedPayload = JSON.parse(serializedPayload) as {
        message?: string;
      };

      if (typeof parsedPayload.message === "string" && parsedPayload.message.trim()) {
        resolvedMessage = prefix
          ? `${prefix}: ${parsedPayload.message.trim()}`
          : parsedPayload.message.trim();
      }
    } catch {
      resolvedMessage = rawIssue;
    }
  }

  if (/You can only send testing emails to your own email address/i.test(resolvedMessage)) {
    const ownerEmail =
      resolvedMessage.match(/your own email address \(([^)]+)\)/i)?.[1] ?? null;

    return `Resend esta en modo de prueba${
      ownerEmail ? ` y solo permite enviar al correo ${ownerEmail}` : ""
    }. Verifica un dominio en resend.com/domains y cambia RESEND_FROM_EMAIL a una direccion de ese dominio.`;
  }

  return resolvedMessage;
}

function buildFormStateFromObligation(obligation: ObligationSummary): ObligationFormState {
  return {
    direction: obligation.direction,
    originType: obligation.originType,
    manualOpeningImpact: "none",
    status: obligation.status,
    title: obligation.title,
    counterpartyId: obligation.counterpartyId ? String(obligation.counterpartyId) : "",
    openingAccountId: "",
    settlementAccountId: obligation.settlementAccountId ? String(obligation.settlementAccountId) : "",
    currencyCode: obligation.currencyCode,
    principalAmount: String(obligation.principalAmount),
    startDate: toDateInputValue(obligation.startDate),
    dueDate: obligation.dueDate ? toDateInputValue(obligation.dueDate) : "",
    installmentAmount:
      obligation.installmentAmount === null || obligation.installmentAmount === undefined
        ? ""
        : String(obligation.installmentAmount),
    installmentCount:
      obligation.installmentCount === null || obligation.installmentCount === undefined
        ? ""
        : String(obligation.installmentCount),
    paymentPlan: parsePaymentPlan(obligation.paymentPlan)
      ?? (obligation.installmentCount ? { mode: "equal", count: obligation.installmentCount } : null),
    interestRate:
      obligation.interestRate === null || obligation.interestRate === undefined
        ? ""
        : String(obligation.interestRate),
    description: obligation.description ?? "",
    notes: obligation.notes ?? "",
  };
}

function createDefaultSharedRequestFormState(): SharedObligationRequestFormState {
  return {
    amount: "",
    paymentDate: toDateInputValue(new Date().toISOString()),
    installmentNo: "",
    description: "",
    notes: "",
    linkToAccount: false,
    accountId: "",
  };
}

function createDefaultPaymentFormState(obligation: ObligationSummary): PaymentFormState {
  const suggestedAmount = obligation.installmentAmount
    ? Math.min(obligation.installmentAmount, obligation.pendingAmount)
    : obligation.pendingAmount;

  return {
    amount: suggestedAmount > 0 ? String(Number(suggestedAmount.toFixed(2))) : "",
    eventDate: toDateInputValue(new Date().toISOString()),
    installmentNo: "",
    description: "",
    notes: "",
    registerAccountMovement: true,
    accountId: obligation.settlementAccountId ? String(obligation.settlementAccountId) : "",
  };
}

function createDefaultPrincipalAdjustmentFormState(
  obligation: ObligationSummary,
  mode: PrincipalAdjustmentMode,
): PrincipalAdjustmentFormState {
  const maxReducibleAmount = Math.max(0, obligation.pendingAmount);
  const suggestedAmount =
    mode === "increase"
      ? obligation.installmentAmount ?? 0
      : obligation.installmentAmount
        ? Math.min(obligation.installmentAmount, maxReducibleAmount)
        : Math.min(obligation.pendingAmount, maxReducibleAmount);

  return {
    amount: suggestedAmount > 0 ? String(Number(suggestedAmount.toFixed(2))) : "",
    eventDate: toDateInputValue(new Date().toISOString()),
    reason: "",
    notes: "",
    registerAccountMovement: false,
    accountId: obligation.settlementAccountId ? String(obligation.settlementAccountId) : "",
  };
}

function getPrincipalAdjustmentEventType(mode: PrincipalAdjustmentMode) {
  return mode === "increase" ? "principal_increase" : "principal_decrease";
}

function getPrincipalAdjustmentMeta(mode: PrincipalAdjustmentMode, direction: ObligationDirection) {
  if (mode === "increase") {
    return direction === "receivable"
      ? {
          title: "Agregar monto",
          description: "Aumenta lo que te deben y deja el motivo registrado en el historial.",
          movementHint: "Si activas movimiento, saldra dinero de tu cuenta porque estas prestando mas.",
          movementLabel: "Registrar salida en una cuenta",
        }
      : {
          title: "Agregar monto",
          description: "Aumenta lo que debes y deja claro por que subio el compromiso.",
          movementHint: "Si activas movimiento, entrara dinero a tu cuenta porque recibes mas capital.",
          movementLabel: "Registrar ingreso en una cuenta",
        };
  }

  return direction === "receivable"
    ? {
        title: "Reducir monto",
        description: "Reduce el principal sin borrar el historial original del registro.",
        movementHint: "Si activas movimiento, entrara dinero a tu cuenta junto con esta reduccion.",
        movementLabel: "Registrar ingreso en una cuenta",
      }
    : {
        title: "Reducir monto",
        description: "Reduce el principal sin reescribir la apertura original del compromiso.",
        movementHint: "Si activas movimiento, saldra dinero de tu cuenta junto con esta reduccion.",
        movementLabel: "Registrar salida en una cuenta",
      };
}

function getOriginOption(originType: ObligationOriginType, direction: ObligationDirection) {
  const originTypeOptions = getOriginTypeOptions(direction);
  return originTypeOptions.find((option) => option.value === originType) ?? originTypeOptions[0];
}

function getStatusOption(status: ObligationStatus) {
  return statusOptions.find((option) => option.value === status) ?? statusOptions[0];
}

function getDirectionLabel(direction: ObligationDirection) {
  return direction === "receivable" ? "Me deben" : "Yo debo";
}

function getShareStatusLabel(status: ObligationShareSummary["status"]) {
  switch (status) {
    case "accepted":
      return "Compartida";
    case "pending":
      return "Por aceptar";
    case "declined":
      return "No aceptada";
    case "revoked":
      return "Revocada";
    default:
      return "Compartida";
  }
}

function getShareStatusTone(status: ObligationShareSummary["status"]) {
  switch (status) {
    case "accepted":
      return "success" as const;
    case "pending":
      return "warning" as const;
    case "declined":
      return "neutral" as const;
    case "revoked":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

function getDirectionVisual(direction: ObligationDirection) {
  return direction === "receivable"
    ? { icon: ArrowUpCircle, color: "#1b6a58" }
    : { icon: ArrowDownCircle, color: "#8f3e3e" };
}

function getEventIcon(eventType: string) {
  switch (eventType) {
    case "opening": return "🏦";
    case "payment": return "💳";
    case "principal_increase": return "📈";
    case "principal_decrease": return "📉";
    case "interest": return "📊";
    case "fee": return "🧾";
    case "discount": return "🏷️";
    case "adjustment": return "⚙️";
    case "writeoff": return "✂️";
    default: return "📌";
  }
}

function getObligationAmountDisplay(
  obligations: ObligationSummary[],
  amountKind: "principal" | "pending",
  baseCurrencyCode: string,
) {
  if (obligations.length === 0) {
    return formatCurrency(0, baseCurrencyCode);
  }

  const currencySet = new Set(obligations.map((obligation) => obligation.currencyCode));
  const sharedCurrency = currencySet.size === 1 ? obligations[0]?.currencyCode ?? baseCurrencyCode : null;

  if (sharedCurrency !== null) {
    const amount = obligations.reduce((total, obligation) => {
      if (amountKind === "principal") {
        return total + (obligation.currentPrincipalAmount ?? obligation.principalAmount);
      }

      return total + obligation.pendingAmount;
    }, 0);

    return formatCurrency(amount, sharedCurrency);
  }

  const allAmountsConvertible = obligations.every((obligation) =>
    amountKind === "principal"
      ? obligation.currentPrincipalAmountInBaseCurrency !== null &&
        obligation.currentPrincipalAmountInBaseCurrency !== undefined
      : obligation.pendingAmountInBaseCurrency !== null &&
        obligation.pendingAmountInBaseCurrency !== undefined,
  );

  if (!allAmountsConvertible) {
    return "Multimoneda";
  }

  const amountInBaseCurrency = obligations.reduce((total, obligation) => {
    if (amountKind === "principal") {
      return total + (obligation.currentPrincipalAmountInBaseCurrency ?? 0);
    }

    return total + (obligation.pendingAmountInBaseCurrency ?? 0);
  }, 0);

  return formatCurrency(amountInBaseCurrency, baseCurrencyCode);
}

function getPortfolioAmountDisplay(
  own: ObligationSummary[],
  shared: SharedObligationSummary[],
  direction: ObligationDirection,
  baseCurrencyCode: string,
) {
  const entries = [
    ...own.filter((obligation) => obligation.direction === direction),
    ...shared.filter((obligation) => obligation.direction !== direction),
  ];
  return getObligationAmountDisplay(entries, "pending", baseCurrencyCode);
}

function MultiSelectFilter({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function dismissWithEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      containerRef.current?.querySelector("button")?.focus();
    }
    document.addEventListener("pointerdown", dismissOutside, true);
    document.addEventListener("keydown", dismissWithEscape, true);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside, true);
      document.removeEventListener("keydown", dismissWithEscape, true);
    };
  }, [open]);
  const display = values.length === 0 ? label : values.length === 1 ? options.find((option) => option.value === values[0])?.label ?? label : `${values.length} seleccionados`;
  return <div className="relative" ref={containerRef}><button aria-expanded={open} className="flex h-full min-h-14 w-full items-center justify-between rounded-xl border border-white/[0.08] bg-[#1a1917] px-4 text-left text-sm font-medium text-ink transition-colors duration-150 hover:border-white/[0.14]" onClick={() => setOpen((value) => !value)} type="button"><span>{display}</span><ChevronDown className={`h-4 w-4 text-storm transition-transform duration-150 ${open ? "rotate-180" : ""}`} /></button>{open ? <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-[9px] border border-white/[0.12] bg-[#1b1a18] py-1">{options.map((option) => { const checked = values.includes(option.value); return <label className="flex min-h-11 cursor-pointer items-center gap-3 px-4 text-sm text-ink transition-colors duration-150 hover:bg-white/[0.04]" key={option.value}><input checked={checked} className="accent-[#d8d2c7]" onChange={() => onChange(checked ? values.filter((value) => value !== option.value) : [...values, option.value])} type="checkbox" /><span>{option.label}</span></label>; })}</div> : null}</div>;
}

function LegacyPaymentDialog({
  accessMessage,
  accounts,
  attachments,
  canManageReceipts,
  editEventAmount,
  feedback,
  formState,
  isEditMode,
  isSaving,
  isUploadingReceipt,
  obligation,
  onCancel,
  onDeleteReceipt,
  onSubmit,
  onUploadReceipt,
  pendingReceiptFile,
  updateFormState,
  updatePendingReceiptFile,
}: {
  accessMessage: string;
  accounts: AccountSummary[];
  attachments: AttachmentSummary[];
  canManageReceipts: boolean;
  editEventAmount: number | null;
  feedback: FeedbackState | null;
  formState: PaymentFormState;
  isEditMode: boolean;
  isSaving: boolean;
  isUploadingReceipt: boolean;
  obligation: ObligationSummary;
  onCancel: () => void;
  onDeleteReceipt: (attachment: AttachmentSummary) => Promise<void>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUploadReceipt: (file: File) => Promise<void>;
  pendingReceiptFile: File | null;
  updatePendingReceiptFile: (file: File | null) => void;
  updateFormState: <Field extends keyof PaymentFormState>(
    field: Field,
    value: PaymentFormState[Field],
  ) => void;
}) {
  const paymentAmount = parseOptionalNumber(formState.amount) ?? 0;
  // Al editar, el pendiente actual ya tiene descontado el monto viejo del abono.
  const pendingBeforePayment = obligation.pendingAmount + (editEventAmount ?? 0);
  const projectedPending = Math.max(0, pendingBeforePayment - paymentAmount);
  // receivable = te deben, el abono entra a la cuenta; payable = debes, el abono sale.
  const isReceivable = obligation.direction === "receivable";
  const accountOptions = accounts
    .filter(
      (account) =>
        (!account.isArchived || String(account.id) === formState.accountId) &&
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
  const selectedAccount =
    accounts.find((account) => String(account.id) === formState.accountId) ?? null;
  const accountDelta = isReceivable ? paymentAmount : paymentAmount * -1;
  const projectedAccountBalance =
    selectedAccount && formState.registerAccountMovement
      ? selectedAccount.currentBalance + accountDelta
      : null;

  return (
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-black/75 p-3 sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[640px] overflow-hidden rounded-[14px] border border-white/10 bg-shell [transform:translateZ(0)]">
          <form
            className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden"
            noValidate
            onSubmit={onSubmit}
          >
            <div className="overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <h2 className="font-display text-xl font-semibold text-ink">
                  {isEditMode ? "Editar abono" : "Registrar abono"}
                </h2>

                <button
                  className="grid h-9 w-9 place-items-center rounded-full text-storm transition hover:bg-white/[0.06] hover:text-ink"
                  onClick={onCancel}
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

              <div className="mt-5 grid gap-4">
                <div className="hidden">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                    Resumen
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                    {obligation.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-storm">{obligation.counterparty}</p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        {isEditMode ? "Pendiente sin este abono" : "Pendiente actual"}
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(pendingBeforePayment, obligation.currencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Quedaria en
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(projectedPending, obligation.currencyCode)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`${panelClassName} z-30`}>
                  <div className="grid gap-5">
                    <Field
                      hint="Puedes registrar un pago parcial o uno total."
                      label="Monto abonado"
                    >
                      <Input
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => updateFormState("amount", event.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={formState.amount}
                      />
                    </Field>
                    <Field
                      hint="Fecha efectiva del abono."
                      label="Fecha"
                    >
                      <DatePickerField
                        onChange={(nextValue) => updateFormState("eventDate", nextValue)}
                        value={formState.eventDate}
                      />
                    </Field>
                    <Field
                      hint="Opcional. Util si trabajas por cuotas."
                      label="Cuota"
                    >
                      <Input
                        inputMode="numeric"
                        min="1"
                        onChange={(event) => updateFormState("installmentNo", event.target.value)}
                        placeholder="Ej. 3"
                        step="1"
                        type="number"
                        value={formState.installmentNo}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <div className={`${panelClassName} z-30`}>
                  <div className="flex items-start justify-between gap-4 rounded-[24px] border border-white/10 bg-black/15 p-4">
                    <div className="min-w-0">
                      <p className={labelClassName}>Movimiento en cuenta</p>
                      <p className="mt-2 text-sm leading-7 text-storm">
                        {isReceivable
                          ? "Registra tambien el ingreso del cobro y suma el saldo a la cuenta."
                          : "Registra tambien el egreso del pago y descuenta el saldo de la cuenta."}
                      </p>
                    </div>
                    <button
                      aria-pressed={formState.registerAccountMovement}
                      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition ${
                        formState.registerAccountMovement
                          ? "border-pine/35 bg-pine/18"
                          : "border-white/12 bg-white/[0.05]"
                      }`}
                      onClick={() =>
                        updateFormState("registerAccountMovement", !formState.registerAccountMovement)
                      }
                      type="button"
                    >
                      <span
                        className={`absolute h-6 w-6 rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition ${
                          formState.registerAccountMovement ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  {formState.registerAccountMovement ? (
                    <div className="mt-5">
                      <Field
                        hint={`Solo veras cuentas en ${obligation.currencyCode}.`}
                        label={isReceivable ? "Cuenta de abono" : "Cuenta de debito"}
                      >
                        <Picker
                          disabled={accountOptions.length === 0}
                          emptyMessage={`No hay cuentas en ${obligation.currencyCode} disponibles.`}
                          onChange={(value) => updateFormState("accountId", value)}
                          options={accountOptions}
                          placeholderDescription="Selecciona la cuenta afectada por este abono."
                          placeholderLabel="Selecciona una cuenta"
                          queryPlaceholder="Buscar cuenta..."
                          value={formState.accountId}
                        />
                      </Field>

                      {selectedAccount && projectedAccountBalance !== null ? (
                        <div className="mt-4 rounded-[24px] border border-white/10 bg-black/15 p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Asi quedara {selectedAccount.name}
                          </p>
                          <div className="mt-3 grid gap-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-storm">Saldo actual</span>
                              <span className="font-semibold text-ink">
                                {formatCurrency(selectedAccount.currentBalance, selectedAccount.currencyCode)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-storm">Movimiento</span>
                              <span
                                className={`font-semibold ${accountDelta >= 0 ? "text-pine" : "text-rose-300"}`}
                              >
                                {accountDelta >= 0 ? "+" : "-"}
                                {formatCurrency(Math.abs(accountDelta), selectedAccount.currencyCode)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-storm">Quedara en</span>
                              <span className="font-display text-base font-semibold text-ink">
                                {formatCurrency(projectedAccountBalance, selectedAccount.currencyCode)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div className={`${panelClassName} z-30`}>
                  <Field
                    hint="Se usa como referencia corta dentro del historial."
                    label="Descripcion"
                  >
                    <Input
                      maxLength={120}
                      onChange={(event) => updateFormState("description", event.target.value)}
                      placeholder="Ej. Pago de cuota marzo"
                      type="text"
                      value={formState.description}
                    />
                  </Field>
                </div>

                <div className={`${panelClassName} z-30`}>
                  <Field
                    hint="Opcional. Anota comprobantes, canal o acuerdo."
                    label="Notas"
                  >
                    <Textarea
                      className="min-h-[132px]"
                      onChange={(event) => updateFormState("notes", event.target.value)}
                      placeholder="Ej. Transferencia recibida desde la cuenta principal."
                      value={formState.notes}
                    />
                  </Field>
                </div>
              </div>

              <div className="mt-5">
                <div className={`${panelClassName} z-30`}>
                  {isEditMode ? (
                    <AttachmentGallery
                      accessMessage={accessMessage}
                      attachments={attachments}
                      canManage={canManageReceipts}
                      entityLabel="abono"
                      isUploading={isUploadingReceipt}
                      onDelete={(attachment) => {
                        void onDeleteReceipt(attachment);
                      }}
                      onUpload={(file) => {
                        void onUploadReceipt(file);
                      }}
                    />
                  ) : (
                    <PendingReceiptField
                      canUpload={canManageReceipts}
                      description="Opcional. Adjunta la foto del voucher o la constancia de la transferencia."
                      file={pendingReceiptFile}
                      lockedMessage={accessMessage}
                      onChange={updatePendingReceiptFile}
                    />
                  )}
                  {formState.registerAccountMovement ? (
                    <p className="mt-3 text-xs leading-5 text-storm">
                      El comprobante se copiara tambien al movimiento que genere este abono.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-shell px-4 py-4 sm:px-6">
              <div className="flex justify-end">
                  <Button
                    disabled={isSaving}
                    type="submit"
                  >
                    {isSaving ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <CircleDollarSign className="mr-2 h-4 w-4" />
                        {isEditMode ? "Guardar abono" : "Registrar abono"}
                      </>
                    )}
                  </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function LegacyPrincipalAdjustmentDialog({
  accounts,
  feedback,
  formState,
  isSaving,
  mode,
  obligation,
  onCancel,
  onSubmit,
  updateFormState,
}: {
  accounts: AccountSummary[];
  feedback: FeedbackState | null;
  formState: PrincipalAdjustmentFormState;
  isSaving: boolean;
  mode: PrincipalAdjustmentMode;
  obligation: ObligationSummary;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateFormState: <Field extends keyof PrincipalAdjustmentFormState>(
    field: Field,
    value: PrincipalAdjustmentFormState[Field],
  ) => void;
}) {
  const adjustmentMeta = getPrincipalAdjustmentMeta(mode, obligation.direction);
  const adjustmentAmount = parseOptionalNumber(formState.amount) ?? 0;
  const delta = mode === "increase" ? adjustmentAmount : adjustmentAmount * -1;
  const projectedPrincipal = Math.max(
    0,
    (obligation.currentPrincipalAmount ?? obligation.principalAmount) + delta,
  );
  const projectedPending = Math.max(0, obligation.pendingAmount + delta);
  const accountOptions = accounts
    .filter(
      (account) =>
        (!account.isArchived || String(account.id) === formState.accountId) &&
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
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-void/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[980px] overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl [transform:translateZ(0)]">
          <form
            className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden"
            noValidate
            onSubmit={onSubmit}
          >
            <div className="overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                      {adjustmentMeta.title}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      {getDirectionLabel(obligation.direction)}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.5rem]">
                    Actualiza el principal con historial
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-9 text-storm">
                    {adjustmentMeta.description} La apertura original no se reescribe: se agrega un
                    evento nuevo con fecha, motivo y detalle.
                  </p>
                </div>

                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
                  onClick={onCancel}
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

              <div className="mt-6 grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
                <div className={`${panelClassName} bg-[linear-gradient(135deg,rgba(16,24,36,0.96),rgba(8,12,20,0.92))]`}>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                    Resumen
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                    {obligation.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-storm">{obligation.counterparty}</p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Principal actual
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(
                          obligation.currentPrincipalAmount ?? obligation.principalAmount,
                          obligation.currencyCode,
                        )}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Principal proyectado
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(projectedPrincipal, obligation.currencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Pendiente actual
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(obligation.pendingAmount, obligation.currencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Pendiente proyectado
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(projectedPending, obligation.currencyCode)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className={`${panelClassName} z-30`}>
                  <div className="grid gap-5">
                    <Field
                      hint={mode === "increase" ? "Monto que se sumara al principal actual." : "Monto que se restara del principal actual."}
                      label="Monto"
                    >
                      <Input
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => updateFormState("amount", event.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={formState.amount}
                      />
                    </Field>
                    <Field
                      hint="Fecha en la que se acordo este cambio."
                      label="Fecha"
                    >
                      <DatePickerField
                        onChange={(nextValue) => updateFormState("eventDate", nextValue)}
                        value={formState.eventDate}
                      />
                    </Field>
                    <Field
                      hint="Obligatorio. Esto explica por que cambiaste el principal."
                      label="Motivo"
                    >
                      <Textarea
                        className="min-h-[120px]"
                        onChange={(event) => updateFormState("reason", event.target.value)}
                        placeholder="Ej. Se agregaron productos al plan y el saldo subio."
                        value={formState.reason}
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div className={`${panelClassName} z-30`}>
                  <div className="flex items-start justify-between gap-4 rounded-[24px] border border-white/10 bg-black/15 p-4">
                    <div className="min-w-0">
                      <p className={labelClassName}>Movimiento en cuenta</p>
                      <p className="mt-2 text-sm leading-7 text-storm">
                        {adjustmentMeta.movementHint}
                      </p>
                    </div>
                    <button
                      aria-pressed={formState.registerAccountMovement}
                      className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition ${
                        formState.registerAccountMovement
                          ? "border-pine/35 bg-pine/18"
                          : "border-white/12 bg-white/[0.05]"
                      }`}
                      onClick={() =>
                        updateFormState("registerAccountMovement", !formState.registerAccountMovement)
                      }
                      type="button"
                    >
                      <span
                        className={`absolute h-6 w-6 rounded-full bg-white shadow-[0_8px_20px_rgba(0,0,0,0.28)] transition ${
                          formState.registerAccountMovement ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>

                  {formState.registerAccountMovement ? (
                    <div className="mt-5">
                      <Field
                        hint={`Solo veras cuentas en ${obligation.currencyCode}.`}
                        label={adjustmentMeta.movementLabel}
                      >
                        <Picker
                          disabled={accountOptions.length === 0}
                          emptyMessage={`No hay cuentas en ${obligation.currencyCode} disponibles.`}
                          onChange={(value) => updateFormState("accountId", value)}
                          options={accountOptions}
                          placeholderDescription="Selecciona la cuenta afectada por este ajuste."
                          placeholderLabel="Selecciona una cuenta"
                          queryPlaceholder="Buscar cuenta..."
                          value={formState.accountId}
                        />
                      </Field>
                    </div>
                  ) : null}
                </div>

                <div className={`${panelClassName} z-30`}>
                  <Field
                    hint="Opcional. Guarda contexto adicional o comprobantes."
                    label="Notas"
                  >
                    <Textarea
                      className="min-h-[180px]"
                      onChange={(event) => updateFormState("notes", event.target.value)}
                      placeholder="Ej. Ajuste aprobado por ambas partes el mismo dia."
                      value={formState.notes}
                    />
                  </Field>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  El cambio quedara registrado en el historial con fecha, motivo y usuario.
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button
                    disabled={isSaving}
                    onClick={onCancel}
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : mode === "increase" ? (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Agregar monto
                      </>
                    ) : (
                      <>
                        <Minus className="mr-2 h-4 w-4" />
                        Reducir monto
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function PaymentDialog(props: Parameters<typeof LegacyPaymentDialog>[0]) {
  const { accessMessage, accounts, attachments, canManageReceipts, editEventAmount, feedback, formState, isEditMode, isSaving, isUploadingReceipt, obligation, onCancel, onDeleteReceipt, onSubmit, onUploadReceipt, pendingReceiptFile, updateFormState, updatePendingReceiptFile } = props;
  const [panel, setPanel] = useState<"main" | "details">("main");
  const amount = parseOptionalNumber(formState.amount) ?? 0;
  const pendingBefore = obligation.pendingAmount + (editEventAmount ?? 0);
  const pendingAfter = Math.max(0, pendingBefore - amount);
  const isReceivable = obligation.direction === "receivable";
  const paymentNoun = isReceivable ? "cobro" : "pago";
  const accountOptions = accounts.filter((account) => (!account.isArchived || String(account.id) === formState.accountId) && account.currencyCode === obligation.currencyCode).map<PickerOption>((account) => ({ value: String(account.id), label: account.name, description: `${account.type} · ${account.currencyCode}`, leadingLabel: account.currencyCode, leadingColor: "#6b6459" }));
  const selectedAccount = accounts.find((account) => String(account.id) === formState.accountId) ?? null;
  const balanceAfter = selectedAccount ? selectedAccount.currentBalance + (isReceivable ? amount : -amount) : null;
  const plan = parsePaymentPlan(obligation.paymentPlan)
    ?? (obligation.installmentCount ? { mode: "equal" as const, count: obligation.installmentCount } : null);
  const coverage = plan ? coverPlan(
    plan,
    obligation.principalAmount,
    obligation.currentPrincipalAmount ?? obligation.principalAmount,
    obligation.startDate,
    obligation.events.filter((item) => item.eventType === "payment").map((item) => ({ amount: item.amount, date: item.eventDate })),
  ) : [];
  const nextInstallment = coverage.find((item) => item.status !== "covered");
  const remainingInInstallment = nextInstallment?.remaining ?? 0;
  const installmentEffect = nextInstallment && amount > 0
    ? amount < remainingInInstallment
      ? `Quedarán ${formatCurrency(remainingInInstallment - amount, obligation.currencyCode)} pendientes de esta cuota.`
      : amount === remainingInInstallment
        ? "Completa esta cuota exacta."
        : `Completa esta cuota y adelanta ${formatCurrency(amount - remainingInInstallment, obligation.currencyCode)} de la siguiente.`
    : null;

  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3"><form className="resource-editor flex max-h-[calc(100dvh-24px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#1a1917] shadow-none" noValidate onSubmit={onSubmit}>
    <ResourceEditorHeader disabled={isSaving} onBack={panel === "details" ? () => setPanel("main") : undefined} onClose={onCancel} title={panel === "main" ? (isEditMode ? `Editar ${paymentNoun}` : `Registrar ${paymentNoun}`) : `Detalles del ${paymentNoun}`} />
    <div className="overflow-y-auto px-5 py-5 sm:px-7">{feedback ? <FormFeedbackBanner className="mb-5" description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}{panel === "main" ? <div className="space-y-5">
      <Field label={`Monto del ${paymentNoun} (${getCurrencyLabel(obligation.currencyCode).symbol})`}><Input autoFocus className="h-16 font-display text-[2rem] font-semibold" id="payment-amount" inputMode="decimal" min="0" onChange={(event) => updateFormState("amount", event.target.value)} placeholder="0.00" step="0.01" type="number" value={formState.amount} /></Field>
      {!isEditMode && nextInstallment ? <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311] px-4 py-3 text-sm"><div className="flex items-center justify-between gap-4"><span className="text-storm">Cuota {nextInstallment.seq} de {coverage.length} · {formatDate(nextInstallment.dueDate)}</span><strong className="tabular-nums text-ink">{formatCurrency(remainingInInstallment, obligation.currencyCode)}</strong></div>{installmentEffect ? <p className="mt-2 text-xs text-storm">{installmentEffect}</p> : null}</div> : null}
      <div className="flex min-h-14 items-center justify-between border-y border-white/[0.09] text-sm"><span className="text-storm">Pendiente después</span><strong className="text-lg tabular-nums text-ink">{formatCurrency(pendingAfter, obligation.currencyCode)}</strong></div>
      <Field label="Cuándo"><DatePickerField appearance="compact" onChange={(value) => updateFormState("eventDate", value)} value={formState.eventDate} /></Field>
      <div className="flex min-h-14 items-center justify-between gap-4 border-y border-white/[0.09]"><div><p className="font-semibold text-ink">Movimiento en cuenta</p><p className="mt-1 text-xs text-storm">{isReceivable ? "Suma el cobro al saldo." : "Descuenta el pago del saldo."}</p></div><button aria-pressed={formState.registerAccountMovement} className={`relative h-7 w-12 rounded-full border transition ${formState.registerAccountMovement ? "border-[#d8d2c7]/60 bg-white/[0.12]" : "border-white/[0.12] bg-white/[0.03]"}`} onClick={() => updateFormState("registerAccountMovement", !formState.registerAccountMovement)} type="button"><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#e8e3da] transition ${formState.registerAccountMovement ? "left-[25px]" : "left-1"}`} /></button></div>
      {formState.registerAccountMovement ? <><Field label={isReceivable ? "Cuenta de abono" : "Cuenta de débito"}><Picker disabled={!accountOptions.length} emptyMessage={`No hay cuentas en ${obligation.currencyCode}.`} onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Cuenta afectada." placeholderLabel="Selecciona una cuenta" queryPlaceholder="Buscar cuenta..." value={formState.accountId} /></Field>{selectedAccount && balanceAfter !== null ? <div className="flex min-h-12 items-center justify-between border-b border-white/[0.09] text-sm"><span className="text-storm">Saldo después</span><strong className="tabular-nums text-ink">{formatCurrency(balanceAfter, selectedAccount.currencyCode)}</strong></div> : null}</> : null}
      <ResourceEditorDestination onClick={() => setPanel("details")} summary="Descripción, notas y comprobante" />
    </div> : <div className="space-y-5"><Field label="Descripción"><Input maxLength={120} onChange={(event) => updateFormState("description", event.target.value)} placeholder="Cuota del mes o referencia" value={formState.description} /></Field><Field label="Notas"><Textarea className="min-h-24" onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Número de operación u otra nota" value={formState.notes} /></Field>{isEditMode ? <CompactAttachmentField accessMessage={accessMessage} attachments={attachments} canManage={canManageReceipts} isUploading={isUploadingReceipt} onDelete={(attachment) => void onDeleteReceipt(attachment)} onUpload={(file) => void onUploadReceipt(file)} /> : <CompactPendingAttachmentField canUpload={canManageReceipts} file={pendingReceiptFile} lockedMessage={accessMessage} onChange={updatePendingReceiptFile} />}</div>}</div>
    <footer className="border-t border-white/[0.08] px-5 py-4 sm:px-7"><Button className="w-full" disabled={isSaving} type="submit">{isSaving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : isEditMode ? "Guardar cambios" : `Registrar ${paymentNoun}`}</Button></footer>
  </form></div>;
}

function PrincipalAdjustmentDialog(props: Parameters<typeof LegacyPrincipalAdjustmentDialog>[0] & { editEventAmount?: number; isEditMode?: boolean }) {
  const { accounts, editEventAmount = 0, feedback, formState, isEditMode = false, isSaving, mode, obligation, onCancel, onSubmit, updateFormState } = props;
  const amount = parseOptionalNumber(formState.amount) ?? 0;
  const delta = mode === "increase" ? amount : -amount;
  const oldDelta = isEditMode ? (mode === "increase" ? editEventAmount : -editEventAmount) : 0;
  const projectedPrincipal = Math.max(0, (obligation.currentPrincipalAmount ?? obligation.principalAmount) - oldDelta + delta);
  const projectedPending = Math.max(0, obligation.pendingAmount - oldDelta + delta);
  const baseMeta = getPrincipalAdjustmentMeta(mode, obligation.direction);
  const meta = isEditMode ? { ...baseMeta, title: "Editar ajuste" } : baseMeta;
  const accountOptions = accounts.filter((account) => (!account.isArchived || String(account.id) === formState.accountId) && account.currencyCode === obligation.currencyCode).map<PickerOption>((account) => ({ value: String(account.id), label: account.name, description: `${account.type} · ${account.currencyCode}`, leadingLabel: account.currencyCode, leadingColor: "#6b6459" }));
  return <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm"><form className="flex max-h-[calc(100dvh-24px)] w-full max-w-[620px] flex-col overflow-hidden rounded-[20px] border border-white/[0.12] bg-[#181715]" noValidate onSubmit={onSubmit}><header className="flex items-center gap-3 border-b border-white/[0.08] px-5 py-4 sm:px-7"><div className="min-w-0 flex-1"><p className="font-public-mono text-[10px] uppercase tracking-[0.18em] text-storm">{obligation.title}</p><h2 className="mt-1 font-display text-xl font-semibold text-ink">{meta.title}</h2></div><button aria-label="Cerrar" className="flex h-9 w-9 items-center justify-center rounded-full text-storm hover:bg-white/[0.05] hover:text-ink" onClick={onCancel} type="button"><X className="h-5 w-5" /></button></header><div className="overflow-y-auto px-5 py-5 sm:px-7">{feedback ? <FormFeedbackBanner className="mb-5" description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}<div className="space-y-5"><div><label className={labelClassName} htmlFor="adjustment-amount">Monto del ajuste</label><div className="mt-2 flex items-end gap-3 border-b border-white/[0.12] pb-3"><span className="pb-1 text-lg text-storm">{getCurrencyLabel(obligation.currencyCode).symbol}</span><input className="min-w-0 flex-1 bg-transparent font-display text-4xl font-semibold tracking-[-0.03em] text-ink outline-none placeholder:text-storm/35" id="adjustment-amount" inputMode="decimal" min="0" onChange={(event) => updateFormState("amount", event.target.value)} placeholder="0.00" step="0.01" type="number" value={formState.amount} /></div></div><div className="grid grid-cols-2 gap-4 border-y border-white/[0.09] py-3 text-sm"><div><p className="text-storm">Principal después</p><p className="mt-1 font-semibold tabular-nums text-ink">{formatCurrency(projectedPrincipal, obligation.currencyCode)}</p></div><div><p className="text-storm">Pendiente después</p><p className="mt-1 font-semibold tabular-nums text-ink">{formatCurrency(projectedPending, obligation.currencyCode)}</p></div></div><Field label="Fecha"><DatePickerField onChange={(value) => updateFormState("eventDate", value)} value={formState.eventDate} /></Field><Field label="Motivo"><Textarea className="min-h-24" onChange={(event) => updateFormState("reason", event.target.value)} placeholder="Explica por qué cambia el monto" value={formState.reason} /></Field><div className="flex min-h-14 items-center justify-between gap-4 border-y border-white/[0.09]"><div><p className="font-semibold text-ink">Movimiento en cuenta</p><p className="mt-1 text-xs text-storm">{meta.movementHint}</p></div><button aria-pressed={formState.registerAccountMovement} className={`relative h-7 w-12 shrink-0 rounded-full border transition ${formState.registerAccountMovement ? "border-[#d8d2c7]/60 bg-white/[0.12]" : "border-white/[0.12] bg-white/[0.03]"}`} onClick={() => updateFormState("registerAccountMovement", !formState.registerAccountMovement)} type="button"><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#e8e3da] transition ${formState.registerAccountMovement ? "left-[25px]" : "left-1"}`} /></button></div>{formState.registerAccountMovement ? <Field label={meta.movementLabel}><Picker disabled={!accountOptions.length} emptyMessage={`No hay cuentas en ${obligation.currencyCode}.`} onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Cuenta afectada." placeholderLabel="Selecciona una cuenta" queryPlaceholder="Buscar cuenta..." value={formState.accountId} /></Field> : null}<Field label="Notas"><Textarea className="min-h-20" onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Contexto opcional" value={formState.notes} /></Field></div></div><footer className="border-t border-white/[0.08] px-5 py-4 sm:px-7"><Button className="w-full" disabled={isSaving} type="submit">{isSaving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : mode === "increase" ? "Agregar monto" : "Reducir monto"}</Button></footer></form></div>;
}

function UnifiedPrincipalAdjustmentDialog(
  props: Parameters<typeof PrincipalAdjustmentDialog>[0] & {
    editEventAmount?: number;
    isEditMode?: boolean;
    onModeChange: (mode: PrincipalAdjustmentMode) => void;
  },
) {
  const {
    accounts,
    editEventAmount = 0,
    feedback,
    formState,
    isEditMode = false,
    isSaving,
    mode,
    obligation,
    onCancel,
    onModeChange,
    onSubmit,
    updateFormState,
  } = props;
  const amount = parseOptionalNumber(formState.amount) ?? 0;
  const delta = mode === "increase" ? amount : -amount;
  const oldDelta = isEditMode ? (mode === "increase" ? editEventAmount : -editEventAmount) : 0;
  const projectedPrincipal = Math.max(0, (obligation.currentPrincipalAmount ?? obligation.principalAmount) - oldDelta + delta);
  const projectedPending = Math.max(0, obligation.pendingAmount - oldDelta + delta);
  const meta = getPrincipalAdjustmentMeta(mode, obligation.direction);
  const isReceivable = obligation.direction === "receivable";
  const accountOptions = accounts
    .filter((account) => (!account.isArchived || String(account.id) === formState.accountId) && account.currencyCode === obligation.currencyCode)
    .map<PickerOption>((account) => ({ value: String(account.id), label: account.name, description: `${account.type} · ${account.currencyCode}`, leadingLabel: account.currencyCode, leadingColor: "#6b6459" }));

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3">
      <form className="resource-editor flex max-h-[calc(100dvh-24px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#1a1917] shadow-none" noValidate onSubmit={onSubmit}>
        <ResourceEditorHeader disabled={isSaving} onClose={onCancel} title={isEditMode ? "Editar ajuste" : "Ajustar monto"} />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {feedback ? <FormFeedbackBanner className="mb-5" description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}
          <div className="space-y-5">
            {!isEditMode ? (
              <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-[#141311] p-1">
                {(["increase", "decrease"] as const).map((option) => (
                  <button className={`min-h-12 rounded-lg px-3 text-sm font-semibold transition ${mode === option ? "bg-ink text-void" : "text-storm hover:text-ink"}`} key={option} onClick={() => onModeChange(option)} type="button">
                    {isReceivable ? (option === "increase" ? "Le debe más" : "Le debe menos") : option === "increase" ? "Le debo más" : "Le debo menos"}
                  </button>
                ))}
              </div>
            ) : null}

            <Field label="Por qué"><Input autoFocus maxLength={120} onChange={(event) => updateFormState("reason", event.target.value)} placeholder="Producto, préstamo o servicio" value={formState.reason} /></Field>
            <Field label={`Cuánto (${getCurrencyLabel(obligation.currencyCode).symbol})`}><Input className="h-16 font-display text-[2rem] font-semibold" inputMode="decimal" min="0" onChange={(event) => updateFormState("amount", event.target.value)} placeholder="0.00" step="0.01" type="number" value={formState.amount} /></Field>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311] text-sm">
              <div className="flex min-h-[54px] items-center justify-between gap-4 px-4"><span className="text-storm">Principal después</span><strong className="tabular-nums text-ink">{formatCurrency(projectedPrincipal, obligation.currencyCode)}</strong></div>
              <div className="flex min-h-[54px] items-center justify-between gap-4 border-t border-white/10 px-4"><span className="text-storm">Pendiente después</span><strong className="tabular-nums text-ink">{formatCurrency(projectedPending, obligation.currencyCode)}</strong></div>
            </div>

            <Field label="Cuándo"><DatePickerField appearance="compact" onChange={(value) => updateFormState("eventDate", value)} value={formState.eventDate} /></Field>
            <div className="flex min-h-[54px] items-center justify-between gap-4 border-y border-white/10 py-2">
              <div><p className="font-semibold text-ink">{mode === "increase" ? (isReceivable ? "Salió plata de tu cuenta" : "Entró plata a tu cuenta") : isReceivable ? "Entró plata a tu cuenta" : "Salió plata de tu cuenta"}</p><p className="mt-1 text-xs text-storm">{meta.movementHint}</p></div>
              <button aria-pressed={formState.registerAccountMovement} className={`relative h-7 w-12 shrink-0 rounded-full border transition ${formState.registerAccountMovement ? "border-[#d8d2c7]/60 bg-white/[0.12]" : "border-white/[0.12] bg-white/[0.03]"}`} onClick={() => updateFormState("registerAccountMovement", !formState.registerAccountMovement)} type="button"><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#e8e3da] transition ${formState.registerAccountMovement ? "left-[25px]" : "left-1"}`} /></button>
            </div>
            {formState.registerAccountMovement ? <Field label={mode === "increase" ? (isReceivable ? "Sale de" : "Entra a") : isReceivable ? "Entra a" : "Sale de"}><Picker disabled={!accountOptions.length} emptyMessage={`No hay cuentas en ${obligation.currencyCode}.`} onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Cuenta afectada." placeholderLabel="Elegir cuenta" queryPlaceholder="Buscar cuenta..." value={formState.accountId} /></Field> : null}
            <Field label="Notas"><Textarea className="min-h-20" onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Referencia opcional" value={formState.notes} /></Field>
          </div>
        </div>
        <footer className="border-t border-white/10 px-5 py-4 sm:px-6"><Button className="w-full" disabled={isSaving || !formState.reason.trim() || !formState.amount.trim()} type="submit">{isSaving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : "Guardar ajuste"}</Button></footer>
      </form>
    </div>
  );
}

function ShareInviteDialog({
  currentShare,
  feedback,
  formState,
  isSaving,
  isUnlinkingShare,
  obligation,
  onCancel,
  onSubmit,
  onUnlinkShare,
  updateFormState,
}: {
  currentShare?: ObligationShareSummary | null;
  feedback: FeedbackState | null;
  formState: ShareInviteFormState;
  isSaving: boolean;
  isUnlinkingShare?: boolean;
  obligation: ObligationSummary;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onUnlinkShare?: () => Promise<void>;
  updateFormState: <Field extends keyof ShareInviteFormState>(
    field: Field,
    value: ShareInviteFormState[Field],
  ) => void;
}) {
  const shareStateLabel = currentShare ? getShareStatusLabel(currentShare.status) : "Sin invitacion activa";
  const isSharePending = currentShare?.status === "pending";
  const primaryShareActionLabel = isSharePending ? "Reenviar invitacion" : "Enviar invitacion";
  const primaryShareActionLoadingLabel = isSharePending ? "Reenviando..." : "Enviando...";

  return (
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-void/70 p-3 backdrop-blur-sm sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[920px] overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl [transform:translateZ(0)]">
          <form
            className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden"
            noValidate
            onSubmit={onSubmit}
          >
            <div className="overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                      Compartir con otro usuario
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      Vista compartida y solo lectura
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.5rem]">
                    Asigna este registro a una cuenta DarkMoney
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-9 text-storm">
                    {isSharePending ? (
                      <>
                        La invitacion ya esta enviada y sigue <span className="text-ink">pendiente de aceptar</span>.
                        Puedes reenviar el correo con el mismo boton de abajo (por si no lo vio o expiro el enlace).
                        Tambien puedes cambiar el correo para invitar a otra persona.
                      </>
                    ) : (
                      <>
                        La persona recibira un correo para aceptar el acceso. Cuando confirme, vera
                        este credito o deuda dentro de su modulo, con historial, saldo pendiente y
                        progreso, pero sin poder editarlo. Solo una persona puede quedar asociada a la
                        vez.
                      </>
                    )}
                  </p>
                </div>

                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
                  onClick={onCancel}
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

              <div className="mt-6 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                <div className={`${panelClassName} bg-[linear-gradient(135deg,rgba(16,24,36,0.96),rgba(8,12,20,0.92))]`}>
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                    Registro
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                    {obligation.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-storm">{obligation.counterparty}</p>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Pendiente
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(obligation.pendingAmount, obligation.currencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Estado del acceso
                      </p>
                      <div className="mt-3">
                        <StatusBadge
                          status={shareStateLabel}
                          tone={currentShare ? getShareStatusTone(currentShare.status) : "neutral"}
                        />
                      </div>
                    </div>
                  </div>

                  {currentShare ? (
                    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-storm">
                      <p className="font-medium text-ink">
                        {currentShare.status === "accepted"
                          ? `${currentShare.invitedDisplayName ?? currentShare.invitedEmail} ya acepto este acceso.`
                          : `La invitacion activa apunta a ${currentShare.invitedDisplayName ?? currentShare.invitedEmail}.`}
                      </p>
                      <p className="mt-2">
                        Si cambias el correo y vuelves a enviar la invitacion, este registro se
                        reasignara a la nueva persona.
                      </p>
                      {onUnlinkShare ? (
                        <Button
                          className="mt-4"
                          disabled={isUnlinkingShare}
                          onClick={() => {
                            void onUnlinkShare();
                          }}
                          type="button"
                          variant="ghost"
                        >
                          {isUnlinkingShare ? (
                            <>
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                              Desvinculando...
                            </>
                          ) : (
                            "Quitar acceso"
                          )}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className={`${panelClassName} z-30`}>
                  <div className="grid gap-5">
                    <Field
                      hint="Debe ser una cuenta que ya exista dentro de DarkMoney."
                      label="Correo del usuario"
                    >
                      <Input
                        autoComplete="email"
                        onChange={(event) => updateFormState("invitedEmail", event.target.value)}
                        placeholder="persona@correo.com"
                        type="email"
                        value={formState.invitedEmail}
                      />
                    </Field>

                    <Field
                      hint="Opcional. Se incluira en el correo para dar contexto."
                      label="Mensaje"
                    >
                      <Textarea
                        className="min-h-[150px]"
                        onChange={(event) => updateFormState("message", event.target.value)}
                        placeholder="Ej. Te comparto este registro para que puedas darle seguimiento desde tu cuenta."
                        value={formState.message}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  {isSharePending ? (
                    <>
                      El invitado no necesita Modo Pro. Si ya acepto, el estado pasara a Compartida; si
                      sigue pendiente, el reenvio le manda otro correo con el mismo enlace de confirmacion.
                    </>
                  ) : (
                    <>
                      El usuario invitado no necesita Modo Pro para ver el registro compartido. Solo
                      necesita aceptar el acceso desde el correo.
                    </>
                  )}
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button
                    disabled={isSaving}
                    onClick={onCancel}
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <Button
                    disabled={isSaving}
                    type="submit"
                  >
                    {isSaving ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        {primaryShareActionLoadingLabel}
                      </>
                    ) : (
                      <>
                        <MailPlus className="mr-2 h-4 w-4" />
                        {primaryShareActionLabel}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ObligationsLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[280px] rounded-[32px]" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="shimmer-surface h-[220px] rounded-[30px]" key={i} />
        ))}
      </div>
    </>
  );
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function downloadObligationsCSV(obligations: ObligationSummary[], filename: string) {
  const headers = ["Titulo", "Direccion", "Tipo origen", "Contraparte", "Estado", "Moneda", "Principal", "Pendiente", "% avance", "Fecha inicio", "Fecha vencimiento", "Cuota", "Num cuotas", "Tasa interes", "Pagos realizados", "Descripcion", "Notas"];
  const rows = obligations.map((o) => [
    escapeCSV(o.title),
    escapeCSV(o.direction),
    escapeCSV(o.originType),
    escapeCSV(o.counterparty),
    escapeCSV(o.status),
    escapeCSV(o.currencyCode),
    escapeCSV(o.principalAmount),
    escapeCSV(o.pendingAmount),
    escapeCSV(o.progressPercent.toFixed(1)),
    escapeCSV(o.startDate),
    escapeCSV(o.dueDate ?? ""),
    escapeCSV(o.installmentAmount ?? ""),
    escapeCSV(o.installmentCount ?? ""),
    escapeCSV(o.interestRate ?? ""),
    escapeCSV(o.paymentCount),
    escapeCSV(o.description ?? ""),
    escapeCSV(o.notes ?? ""),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

function canDeleteObligation(obligation: ObligationSummary) {
  return obligation.events.every((event) => event.eventType === "opening");
}

export function ObligationsPage() {
  const [notificationParams, setNotificationParams] = useSearchParams();
  const [notificationEventId, setNotificationEventId] = useState<number | null>(null);
  const [notificationPaymentId, setNotificationPaymentId] = useState<number | null>(null);
  const [notificationEventRequest, setNotificationEventRequest] = useState<{ kind: "delete" | "edit"; eventId: number } | null>(null);
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const { accessMessage, canUploadReceipts } = useReceiptFeatureAccess();
  const { canAccessProFeatures, genericAccessMessage } = useProFeatureAccess();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const sharedObligationsQuery = useSharedObligationsQuery(user?.id);
  const obligationSharesQuery = useObligationSharesQuery(activeWorkspace?.id);
  const snapshot = snapshotQuery.data;
  const createMutation = useCreateObligationMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateObligationMutation(activeWorkspace?.id, user?.id);
  const archiveMutation = useArchiveObligationMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteObligationMutation(activeWorkspace?.id, user?.id);
  const paymentMutation = useRegisterObligationPaymentMutation(activeWorkspace?.id, user?.id);
  const eventUpdateMutation = useUpdateObligationEventMutation(activeWorkspace?.id, user?.id);
  const unlinkShareMutation = useUnlinkObligationShareMutation(activeWorkspace?.id, user?.id);
  const pendingPaymentRequestsQuery = usePendingPaymentRequestsQuery(activeWorkspace?.id);
  const [sharedDetailId, setSharedDetailId] = useState<number | null>(null);
  const [unlinkSharedTarget, setUnlinkSharedTarget] = useState<SharedObligationSummary | null>(null);
  const [sharedDetailFeedback, setSharedDetailFeedback] = useState<FeedbackState | null>(null);
  const [sharedRequestFormState, setSharedRequestFormState] =
    useState<SharedObligationRequestFormState>(createDefaultSharedRequestFormState());
  const createPaymentRequestMutation = useCreatePaymentRequestMutation(user?.id);
  const linkEventToAccountMutation = useLinkEventToAccountMutation(activeWorkspace?.id, user?.id);
  const deleteViewerEventLinkMutation = useDeleteViewerEventLinkMutation(
    activeWorkspace?.id,
    user?.id,
  );
  const eventRequestsQuery = useObligationEventRequestsQuery(user?.id);
  const createEventDeleteRequestMutation = useCreateObligationEventDeleteRequestMutation(user?.id);
  const createEventEditRequestMutation = useCreateObligationEventEditRequestMutation(user?.id);
  const acceptEventDeleteRequestMutation = useAcceptObligationEventDeleteRequestMutation(
    activeWorkspace?.id,
    user?.id,
  );
  const rejectEventDeleteRequestMutation = useRejectObligationEventDeleteRequestMutation(
    activeWorkspace?.id,
    user?.id,
  );
  const acceptEventEditRequestMutation = useAcceptObligationEventEditRequestMutation(
    activeWorkspace?.id,
    user?.id,
  );
  const rejectEventEditRequestMutation = useRejectObligationEventEditRequestMutation(
    activeWorkspace?.id,
    user?.id,
  );
  const acceptPaymentRequestMutation = useAcceptPaymentRequestMutation(
    activeWorkspace?.id,
    user?.id,
  );
  const rejectPaymentRequestMutation = useRejectPaymentRequestMutation(
    activeWorkspace?.id,
    user?.id,
  );
  const eventDeleteMutation = useDeleteObligationEventMutation(activeWorkspace?.id, user?.id);
  const principalAdjustmentMutation = useAdjustObligationPrincipalMutation(activeWorkspace?.id, user?.id);
  const shareInviteMutation = useCreateObligationShareInviteMutation(activeWorkspace?.id, user?.id);
  const createAttachmentRecordMutation = useCreateAttachmentRecordMutation(activeWorkspace?.id, user?.id);
  const deleteAttachmentRecordMutation = useDeleteAttachmentRecordMutation(activeWorkspace?.id, user?.id);
  const [pageFeedback, setPageFeedback] = useState<FeedbackState | null>(null);
  const [editorFeedback, setEditorFeedback] = useState<FeedbackState | null>(null);
  const [paymentFeedback, setPaymentFeedback] = useState<FeedbackState | null>(null);
  const [principalAdjustmentFeedback, setPrincipalAdjustmentFeedback] =
    useState<FeedbackState | null>(null);
  const [shareDialogFeedback, setShareDialogFeedback] = useState<FeedbackState | null>(null);
  const {
    filters: obligationFilters,
    currentPage,
    setCurrentPage,
    updateFilter: updateObligationFilter,
    clearFilters: clearBaseObligationFilters,
  } = useObligationsFilters("table");
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [detailObligationId, setDetailObligationId] = useState<number | null>(null);
  const [directionFilters, setDirectionFilters] = useState<ObligationDirection[]>([]);
  const [statusFilters, setStatusFilters] = useState<ObligationStatus[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [groupByDirection, setGroupByDirection] = useState(() => window.localStorage.getItem("obligations-group-by-direction") === "1");

  function clearObligationFilters() {
    clearBaseObligationFilters();
    setDirectionFilters([]);
    setStatusFilters([]);
    setShowArchived(false);
  }

  function toggleGroupByDirection() {
    setGroupByDirection((current) => {
      const next = !current;
      window.localStorage.setItem("obligations-group-by-direction", next ? "1" : "0");
      return next;
    });
  }
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedObligationId, setSelectedObligationId] = useState<number | null>(null);

  function clearFieldError(field: string) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }
  const [paymentTargetId, setPaymentTargetId] = useState<number | null>(null);
  const [paymentEditEventId, setPaymentEditEventId] = useState<number | null>(null);
  const [pendingPaymentReceiptFile, setPendingPaymentReceiptFile] = useState<File | null>(null);
  const [eventDeleteTarget, setEventDeleteTarget] = useState<{
    obligationId: number;
    event: ObligationEventSummary;
  } | null>(null);
  const [principalAdjustmentTargetId, setPrincipalAdjustmentTargetId] = useState<number | null>(null);
  const [principalAdjustmentEditEventId, setPrincipalAdjustmentEditEventId] = useState<number | null>(null);
  const [principalAdjustmentMode, setPrincipalAdjustmentMode] = useState<PrincipalAdjustmentMode>("increase");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [analyticsObligationId, setAnalyticsObligationId] = useState<number | null>(null);
  const [analyticsSharedObligationId, setAnalyticsSharedObligationId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  useSuccessToast(pageFeedback, {
    clear: () => setPageFeedback(null),
  });
  const [shareTargetId, setShareTargetId] = useState<number | null>(null);
  const [formState, setFormState] = useState<ObligationFormState>(
    createDefaultFormState(activeWorkspace?.baseCurrencyCode ?? "USD"),
  );
  const [createShareFormState, setCreateShareFormState] = useState<ShareInviteFormState>(
    createDefaultShareInviteFormState(),
  );
  const [shareDialogFormState, setShareDialogFormState] = useState<ShareInviteFormState>(
    createDefaultShareInviteFormState(),
  );
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [paymentFormState, setPaymentFormState] = useState<PaymentFormState>({
    amount: "",
    eventDate: toDateInputValue(new Date().toISOString()),
    installmentNo: "",
    description: "",
    notes: "",
    registerAccountMovement: true,
    accountId: "",
  });
  const [principalAdjustmentFormState, setPrincipalAdjustmentFormState] =
    useState<PrincipalAdjustmentFormState>({
      amount: "",
      eventDate: toDateInputValue(new Date().toISOString()),
      reason: "",
      notes: "",
      registerAccountMovement: false,
      accountId: "",
    });
  const obligations = snapshot?.obligations ?? [];
  const sharedObligations = sharedObligationsQuery.data ?? [];
  const obligationShares = obligationSharesQuery.data ?? [];
  const counterparties = snapshot?.catalogs.counterparties ?? [];
  const accounts = snapshot?.accounts ?? [];
  const movements = snapshot?.movements ?? [];
  const pendingPaymentRequests = pendingPaymentRequestsQuery.data ?? [];
  const sharedDetailObligation =
    sharedDetailId === null
      ? null
      : sharedObligations.find((obligation) => obligation.id === sharedDetailId) ?? null;
  const viewerPaymentRequestsQuery = useViewerPaymentRequestsQuery(sharedDetailId, user?.id);
  const viewerEventLinksQuery = useObligationEventViewerLinksQuery(
    sharedDetailId,
    sharedDetailObligation?.share.id ?? null,
  );
  const viewerEventRequestsQuery = useViewerObligationEventRequestsQuery(user?.id, sharedDetailId);
  const paymentEventAttachmentsQuery = useEntityAttachmentsQuery(
    activeWorkspace?.id,
    "obligation-event",
    paymentEditEventId,
  );
  const baseCurrencyCode = snapshot?.workspace.baseCurrencyCode ?? activeWorkspace?.baseCurrencyCode ?? "USD";
  const selectedObligation =
    selectedObligationId === null
      ? null
      : obligations.find((obligation) => obligation.id === selectedObligationId) ?? null;
  const detailObligation =
    detailObligationId === null
      ? null
      : obligations.find((obligation) => obligation.id === detailObligationId) ?? null;
  const noticeReadState = (query: { isLoading: boolean; isFetching: boolean; isPlaceholderData: boolean; isError: boolean }) =>
    query.isLoading || query.isFetching || query.isPlaceholderData ? "loading" as const : query.isError ? "error" as const : "ready" as const;
  useObligationNotificationOpening({params:notificationParams,workspaceId:activeWorkspace?.id,snapshotWorkspaceId:snapshot?.workspace.id,
    stale:snapshotQuery.isPlaceholderData||snapshotQuery.isFetching,
    data:{owned:obligations,shared:sharedObligations,payments:pendingPaymentRequests,deletes:eventRequestsQuery.data?.deleteRequests??[],edits:eventRequestsQuery.data?.editRequests??[]},
    reads:{shared:noticeReadState(sharedObligationsQuery),payments:noticeReadState(pendingPaymentRequestsQuery),events:noticeReadState(eventRequestsQuery)},
    onError:kind=>setPageFeedback(current=>kind==="read"?(current?.title==="No se pudo abrir el aviso"?current:{tone:"error",title:"No se pudo abrir el aviso",description:"No pudimos comprobar el registro o su solicitud. Reintenta la consulta; el enlace se conserva."}):{tone:"error",title:"Registro no disponible",description:"El registro de este aviso no está disponible en este espacio o ya fue eliminado."}),
    onTarget:target=>{
    if(target)setPageFeedback((current) => current?.title === "No se pudo abrir el aviso" ? null : current);
    setNotificationEventRequest(null);
    setNotificationPaymentId(null);
    setDetailObligationId(null);
    setSharedDetailId(null);
    setNotificationEventId(null);
    if (!target) return;
    else if (target.mode === "payment") setNotificationPaymentId(target.request);
    else if (target.mode === "edit" || target.mode === "delete") setNotificationEventRequest({ kind: target.mode, eventId: target.event });
    else {
      setNotificationEventId(target.event);
      if (target.mode === "shared") setSharedDetailId(target.id);
      else setDetailObligationId(target.id);
    }
    },onConsume:()=>setNotificationParams((current) => {
      const next = new URLSearchParams(current);
      for (const key of ["resource", "paymentRequest", "event", "notificationKind"]) next.delete(key);
      return next;
    }, { replace: true })});
  const attachmentsQuery = useEntityAttachmentsQuery(
    activeWorkspace?.id,
    "obligation",
    isEditorOpen && editorMode === "edit" && selectedObligation ? selectedObligation.id : null,
  );
  const selectedObligationAttachments = attachmentsQuery.data ?? [];
  const paymentTarget =
    paymentTargetId === null
      ? null
      : obligations.find((obligation) => obligation.id === paymentTargetId) ?? null;
  const principalAdjustmentTarget =
    principalAdjustmentTargetId === null
      ? null
      : obligations.find((obligation) => obligation.id === principalAdjustmentTargetId) ?? null;
  const isUploadingReceipt =
    createAttachmentRecordMutation.isPending || deleteAttachmentRecordMutation.isPending;
  const deleteTarget =
    deleteTargetId === null
      ? null
      : obligations.find((obligation) => obligation.id === deleteTargetId) ?? null;
  const shareTarget =
    shareTargetId === null
      ? null
      : obligations.find((obligation) => obligation.id === shareTargetId) ?? null;
  const shareByObligationId = useMemo(
    () => new Map<number, ObligationShareSummary>(obligationShares.map((share) => [share.obligationId, share])),
    [obligationShares],
  );

  useEffect(() => {
    if (!isEditorOpen) {
      setFormState(createDefaultFormState(baseCurrencyCode));
      setCreateShareFormState(createDefaultShareInviteFormState());
    }
  }, [baseCurrencyCode, isEditorOpen]);

  useEffect(() => {
    if (!formState.openingAccountId) {
      return;
    }

    const selectedOpeningAccount = accounts.find(
      (account) => String(account.id) === formState.openingAccountId,
    );
    const normalizedCurrencyCode = formState.currencyCode.trim().toUpperCase() || baseCurrencyCode;

    if (selectedOpeningAccount && selectedOpeningAccount.currencyCode !== normalizedCurrencyCode) {
      setFormState((currentValue) => ({ ...currentValue, openingAccountId: "" }));
    }
  }, [accounts, baseCurrencyCode, formState.currencyCode, formState.openingAccountId]);

  function updateFormState<Field extends keyof ObligationFormState>(
    field: Field,
    value: ObligationFormState[Field],
  ) {
    setIsDirty(true);
    setFormState((currentValue) =>
      applyObligationFormRules({ ...currentValue, [field]: value }),
    );
  }

  function closeEditorDialog() {
    if (isSavingEditor) return;
    setIsEditorOpen(false);
    setSelectedObligationId(null);
    setPendingReceiptFile(null);
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isSavingEditor) return;
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditorDialog();
    }
  }

  function updatePaymentFormState<Field extends keyof PaymentFormState>(
    field: Field,
    value: PaymentFormState[Field],
  ) {
    setPaymentFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function updatePrincipalAdjustmentFormState<Field extends keyof PrincipalAdjustmentFormState>(
    field: Field,
    value: PrincipalAdjustmentFormState[Field],
  ) {
    setPrincipalAdjustmentFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function updateCreateShareFormState<Field extends keyof ShareInviteFormState>(
    field: Field,
    value: ShareInviteFormState[Field],
  ) {
    setCreateShareFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function updateShareDialogFormState<Field extends keyof ShareInviteFormState>(
    field: Field,
    value: ShareInviteFormState[Field],
  ) {
    setShareDialogFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function openCreateEditor() {
    setPageFeedback(null);
    setEditorFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("create");
    setSelectedObligationId(null);
    setFormState(applyObligationFormRules(createDefaultFormState(baseCurrencyCode)));
    setCreateShareFormState(createDefaultShareInviteFormState());
    setPendingReceiptFile(null);
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(obligation: ObligationSummary) {
    const currentShare = shareByObligationId.get(obligation.id) ?? null;

    setPageFeedback(null);
    setEditorFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("edit");
    setSelectedObligationId(obligation.id);
    setFormState(applyObligationFormRules(buildFormStateFromObligation(obligation)));
    setCreateShareFormState(buildShareInviteFormState(currentShare));
    setPendingReceiptFile(null);
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openShareDialog(obligation: ObligationSummary) {
    const currentShare = shareByObligationId.get(obligation.id);

    setPageFeedback(null);
    setShareDialogFeedback(null);
    setShareTargetId(obligation.id);
    setShareDialogFormState(buildShareInviteFormState(currentShare));
  }

  async function uploadReceiptForObligation(obligationId: number, file: File) {
    if (!activeWorkspace || !user) {
      throw new Error("Necesitamos un usuario y workspace activos para subir comprobantes.");
    }

    const preparedReceipt = await prepareReceiptUpload({
      workspaceId: activeWorkspace.id,
      entityType: "obligation",
      entityId: obligationId,
      file,
    });

    await uploadPreparedReceipt(preparedReceipt);

    try {
      await createAttachmentRecordMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        entityType: "obligation",
        entityId: obligationId,
        bucketName: preparedReceipt.bucketName,
        filePath: preparedReceipt.filePath,
        fileName: preparedReceipt.fileName,
        mimeType: preparedReceipt.mimeType,
        sizeBytes: preparedReceipt.sizeBytes,
        width: preparedReceipt.width,
        height: preparedReceipt.height,
        uploadedByUserId: user.id,
      });
    } catch (error) {
      await deleteStoredReceipt(preparedReceipt.bucketName, preparedReceipt.filePath).catch(() => undefined);
      throw error;
    }
  }

  /** Sube el comprobante al evento y lo copia al movimiento vinculado, si lo hay. */
  async function uploadReceiptForEvent(eventId: number, movementId: number | null, file: File) {
    if (!activeWorkspace || !user) {
      throw new Error("Necesitamos un usuario y workspace activos para subir comprobantes.");
    }

    const preparedReceipt = await prepareReceiptUpload({
      workspaceId: activeWorkspace.id,
      entityType: "obligation-event",
      entityId: eventId,
      file,
    });

    await uploadPreparedReceipt(preparedReceipt);

    try {
      await createAttachmentRecordMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        entityType: "obligation-event",
        entityId: eventId,
        bucketName: preparedReceipt.bucketName,
        filePath: preparedReceipt.filePath,
        fileName: preparedReceipt.fileName,
        mimeType: preparedReceipt.mimeType,
        sizeBytes: preparedReceipt.sizeBytes,
        width: preparedReceipt.width,
        height: preparedReceipt.height,
        uploadedByUserId: user.id,
      });
    } catch (error) {
      await deleteStoredReceipt(preparedReceipt.bucketName, preparedReceipt.filePath).catch(
        () => undefined,
      );
      throw error;
    }

    if (movementId !== null) {
      await syncEventReceiptsToMovement(eventId, movementId);
    }
  }

  /** El espejado es secundario: si falla, el comprobante del abono ya quedo guardado. */
  async function syncEventReceiptsToMovement(eventId: number, movementId: number) {
    if (!activeWorkspace || !user) {
      return;
    }

    try {
      await mirrorObligationEventAttachmentsToMovement({
        workspaceId: activeWorkspace.id,
        eventId,
        movementId,
        userId: user.id,
      });
      await queryClient.invalidateQueries({
        queryKey: ["attachments", activeWorkspace.id],
        exact: false,
      });
    } catch (error) {
      console.warn("[syncEventReceiptsToMovement]", error);
    }
  }

  async function handleUploadPaymentReceipt(file: File) {
    if (paymentEditEventId === null || !paymentTarget) {
      return;
    }

    if (!canUploadReceipts) {
      setPaymentFeedback({
        tone: "error",
        title: "Comprobantes en Modo Pro",
        description: "Tu plan actual no tiene habilitada la subida de comprobantes.",
      });
      return;
    }

    setPaymentFeedback(null);

    const editingEvent =
      paymentTarget.events.find((event) => event.id === paymentEditEventId) ?? null;

    try {
      await uploadReceiptForEvent(paymentEditEventId, editingEvent?.movementId ?? null, file);
      setPaymentFeedback({
        tone: "success",
        title: "Comprobante guardado",
        description: editingEvent?.movementId
          ? "Tambien lo copiamos al movimiento vinculado."
          : "El adjunto quedo vinculado a este abono.",
      });
    } catch (error) {
      setPaymentFeedback({
        tone: "error",
        title: "No pudimos subir el comprobante",
        description: getQueryErrorMessage(error, "Intentalo otra vez en unos segundos."),
      });
    }
  }

  async function handleDeletePaymentReceipt(attachment: AttachmentSummary) {
    if (!activeWorkspace || paymentEditEventId === null || !paymentTarget) {
      return;
    }

    if (!canUploadReceipts) {
      setPaymentFeedback({
        tone: "error",
        title: "Comprobantes en Modo Pro",
        description: "Tu plan actual no tiene habilitada la gestion de comprobantes.",
      });
      return;
    }

    setPaymentFeedback(null);

    const editingEvent =
      paymentTarget.events.find((event) => event.id === paymentEditEventId) ?? null;

    try {
      await deleteAttachmentRecordMutation.mutateAsync({
        attachmentId: attachment.id,
        workspaceId: activeWorkspace.id,
      });
      await deleteStoredReceipt(attachment.bucketName, attachment.filePath).catch(() => undefined);

      if (editingEvent?.movementId) {
        await syncEventReceiptsToMovement(paymentEditEventId, editingEvent.movementId);
      }
    } catch (error) {
      setPaymentFeedback({
        tone: "error",
        title: "No pudimos eliminar el comprobante",
        description: getQueryErrorMessage(error, "Intentalo otra vez en unos segundos."),
      });
    }
  }

  async function handleUploadReceipt(file: File) {
    if (!selectedObligation) {
      setEditorFeedback({
        tone: "error",
        title: "Guarda primero el registro",
        description: "Necesitamos crear el credito o deuda antes de adjuntar un comprobante.",
      });
      return;
    }

    if (!canUploadReceipts) {
      setEditorFeedback({
        tone: "error",
        title: "Comprobantes en Modo Pro",
        description: "Tu plan actual no tiene habilitada la subida de comprobantes.",
      });
      return;
    }

    setEditorFeedback(null);

    try {
      await uploadReceiptForObligation(selectedObligation.id, file);
      setEditorFeedback({
        tone: "success",
        title: "Comprobante guardado",
        description: "El adjunto quedo vinculado correctamente a este credito o deuda.",
      });
    } catch (error) {
      setEditorFeedback({
        tone: "error",
        title: "No pudimos subir el comprobante",
        description: getQueryErrorMessage(error, "Intentalo otra vez en unos segundos."),
      });
    }
  }

  async function handleDeleteReceipt(attachment: AttachmentSummary) {
    if (!activeWorkspace) {
      return;
    }

    if (!canUploadReceipts) {
      setEditorFeedback({
        tone: "error",
        title: "Comprobantes en Modo Pro",
        description: "Tu plan actual no tiene habilitada la gestion de comprobantes.",
      });
      return;
    }

    setEditorFeedback(null);

    try {
      await deleteStoredReceipt(attachment.bucketName, attachment.filePath);
      await deleteAttachmentRecordMutation.mutateAsync({
        attachmentId: attachment.id,
        workspaceId: activeWorkspace.id,
      });
      setEditorFeedback({
        tone: "success",
        title: "Comprobante eliminado",
        description: "El adjunto ya no forma parte de este registro.",
      });
    } catch (error) {
      setEditorFeedback({
        tone: "error",
        title: "No pudimos eliminar el comprobante",
        description: getQueryErrorMessage(error, "Intentalo otra vez en unos segundos."),
      });
    }
  }

  function openPaymentDialog(obligation: ObligationSummary) {
    setPageFeedback(null);
    setPaymentFeedback(null);
    setPaymentEditEventId(null);
    setPendingPaymentReceiptFile(null);
    setPaymentTargetId(obligation.id);
    setPaymentFormState(createDefaultPaymentFormState(obligation));
  }

  /** La cuenta del abono se lee del movimiento vinculado, que es la fuente real. */
  function resolveEventAccountId(event: ObligationEventSummary): number | null {
    if (event.movementId == null) {
      return null;
    }

    const movement = movements.find((item) => item.id === event.movementId);

    return movement?.destinationAccountId ?? movement?.sourceAccountId ?? null;
  }

  function openPaymentEditDialog(obligation: ObligationSummary, event: ObligationEventSummary) {
    const accountId = resolveEventAccountId(event);
    setPageFeedback(null);
    setPaymentFeedback(null);
    setPaymentEditEventId(event.id);
    setPendingPaymentReceiptFile(null);
    setPaymentTargetId(obligation.id);
    setPaymentFormState({
      amount: String(event.amount),
      eventDate: event.eventDate,
      installmentNo: event.installmentNo != null ? String(event.installmentNo) : "",
      description: event.description ?? "",
      notes: event.notes ?? "",
      registerAccountMovement: event.movementId != null,
      accountId: accountId != null ? String(accountId) : "",
    });
  }

  function openSharedDetail(obligationId: number) {
    setSharedDetailId(obligationId);
    setSharedDetailFeedback(null);
    setSharedRequestFormState(createDefaultSharedRequestFormState());
  }

  function updateSharedRequestFormState<Field extends keyof SharedObligationRequestFormState>(
    field: Field,
    value: SharedObligationRequestFormState[Field],
  ) {
    setSharedRequestFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  async function handleSubmitSharedRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSharedDetailFeedback(null);

    if (!sharedDetailObligation || !user?.id) {
      return;
    }

    const amount = parseOptionalNumber(sharedRequestFormState.amount);
    const installmentNo = parseOptionalInteger(sharedRequestFormState.installmentNo);

    if (amount === null || Number.isNaN(amount) || amount <= 0) {
      setSharedDetailFeedback({
        tone: "error",
        title: "Monto invalido",
        description: "Ingresa un monto mayor que cero.",
      });
      return;
    }

    if (!sharedRequestFormState.paymentDate) {
      setSharedDetailFeedback({
        tone: "error",
        title: "Falta la fecha",
        description: "Selecciona la fecha del abono que quieres reportar.",
      });
      return;
    }

    if (installmentNo !== null && (Number.isNaN(installmentNo) || installmentNo <= 0)) {
      setSharedDetailFeedback({
        tone: "error",
        title: "Cuota invalida",
        description: "Si la completas, debe ser un numero entero mayor que cero.",
      });
      return;
    }

    const viewerAccountId = parseOptionalInteger(sharedRequestFormState.accountId);

    if (sharedRequestFormState.linkToAccount && !viewerAccountId) {
      setSharedDetailFeedback({
        tone: "error",
        title: "Falta la cuenta",
        description: "Selecciona la cuenta sugerida o desactiva esa opcion.",
      });
      return;
    }

    try {
      await createPaymentRequestMutation.mutateAsync({
        obligation: sharedDetailObligation,
        requestedByUserId: user.id,
        requestedByDisplayName: profile?.fullName ?? user.email ?? null,
        amount,
        paymentDate: sharedRequestFormState.paymentDate,
        installmentNo,
        description: sharedRequestFormState.description,
        notes: sharedRequestFormState.notes,
        viewerAccountId: sharedRequestFormState.linkToAccount ? viewerAccountId : null,
        viewerWorkspaceId: sharedRequestFormState.linkToAccount ? activeWorkspace?.id ?? null : null,
      });
      setSharedRequestFormState(createDefaultSharedRequestFormState());
      setSharedDetailFeedback({
        tone: "success",
        title: "Solicitud enviada",
        description: `Avisamos a ${
          sharedDetailObligation.share.ownerDisplayName ?? "el propietario"
        }. El saldo no cambia hasta que la acepte.`,
      });
    } catch (error) {
      setSharedDetailFeedback({
        tone: "error",
        title: "No pudimos enviar la solicitud",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleLinkSharedEvent(event: ObligationEventSummary, accountId: number) {
    setSharedDetailFeedback(null);

    if (!sharedDetailObligation || !user?.id || !activeWorkspace) {
      return;
    }

    try {
      await linkEventToAccountMutation.mutateAsync({
        obligation: sharedDetailObligation,
        event,
        accountId,
        linkedByUserId: user.id,
        viewerWorkspaceId: activeWorkspace.id,
      });
      setSharedDetailFeedback({
        tone: "success",
        title: "Evento reflejado",
        description: "Creamos el movimiento en tu cuenta. El registro del propietario no cambio.",
      });
    } catch (error) {
      setSharedDetailFeedback({
        tone: "error",
        title: "No pudimos reflejar el evento",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleUnlinkSharedEvent(link: ObligationEventViewerLink) {
    setSharedDetailFeedback(null);

    if (!sharedDetailObligation) {
      return;
    }

    try {
      await deleteViewerEventLinkMutation.mutateAsync({
        link,
        obligationId: sharedDetailObligation.id,
        shareId: sharedDetailObligation.share.id,
      });
      setSharedDetailFeedback({
        tone: "success",
        title: "Vinculo retirado",
        description: "Borramos el movimiento que habiamos creado en tu cuenta.",
      });
    } catch (error) {
      setSharedDetailFeedback({
        tone: "error",
        title: "No pudimos quitar el vinculo",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleRequestEventDelete(event: ObligationEventSummary) {
    setSharedDetailFeedback(null);

    if (!sharedDetailObligation || !user?.id) {
      return;
    }

    try {
      await createEventDeleteRequestMutation.mutateAsync({
        obligation: sharedDetailObligation,
        event,
        viewerUserId: user.id,
        viewerDisplayName: profile?.fullName ?? user.email ?? null,
      });
      setSharedDetailFeedback({
        tone: "success",
        title: "Solicitud enviada",
        description: `${
          sharedDetailObligation.share.ownerDisplayName ?? "El propietario"
        } decide si elimina el evento. Nada cambia mientras tanto.`,
      });
    } catch (error) {
      setSharedDetailFeedback({
        tone: "error",
        title: "No pudimos enviar la solicitud",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleRequestEventEdit(
    event: ObligationEventSummary,
    proposal: EventEditProposal,
  ) {
    setSharedDetailFeedback(null);

    if (!sharedDetailObligation || !user?.id) {
      return;
    }

    const proposedAmount = parseOptionalNumber(proposal.amount);
    const proposedInstallmentNo = parseOptionalInteger(proposal.installmentNo);

    if (proposedAmount === null || Number.isNaN(proposedAmount) || proposedAmount <= 0) {
      setSharedDetailFeedback({
        tone: "error",
        title: "Monto invalido",
        description: "Propone un monto mayor que cero.",
      });
      return;
    }

    if (!proposal.eventDate) {
      setSharedDetailFeedback({
        tone: "error",
        title: "Falta la fecha",
        description: "Selecciona la fecha que propones para el evento.",
      });
      return;
    }

    try {
      await createEventEditRequestMutation.mutateAsync({
        obligation: sharedDetailObligation,
        event,
        viewerUserId: user.id,
        viewerDisplayName: profile?.fullName ?? user.email ?? null,
        proposedAmount,
        proposedEventDate: proposal.eventDate,
        proposedInstallmentNo,
        proposedDescription: proposal.description,
        proposedNotes: proposal.notes,
      });
      setSharedDetailFeedback({
        tone: "success",
        title: "Propuesta enviada",
        description: `${
          sharedDetailObligation.share.ownerDisplayName ?? "El propietario"
        } vera los cambios propuestos y decide si los aplica.`,
      });
    } catch (error) {
      setSharedDetailFeedback({
        tone: "error",
        title: "No pudimos enviar la propuesta",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleAcceptEventDeleteRequest(request: ObligationEventDeleteRequest) {
    if (!activeWorkspace || !user?.id) {
      throw new Error("La sesión o el espacio ya no están disponibles. Actualiza antes de responder.");
    }
    if (!obligations.some(item => item.id === request.payload.obligationId && item.workspaceId === activeWorkspace.id)) throw new Error("La solicitud no pertenece al espacio actual.");

    const obligation = obligations.find((item) => item.id === request.payload.obligationId);
    const eventAmount =
      obligation?.events.find((item) => item.id === request.payload.eventId)?.amount ??
      request.payload.amount ??
      0;
    // Al borrarse, el monto vuelve al pendiente: puede dejar de estar liquidado.
    const nextStatus: ObligationStatus | undefined =
      obligation && obligation.status === "paid" && obligation.pendingAmount + eventAmount > 0
        ? "active"
        : undefined;

    try {
      await acceptEventDeleteRequestMutation.mutateAsync({
        payload: request.payload,
        workspaceId: activeWorkspace.id,
        userId: user.id,
        nextStatus,
      });
      setPageFeedback({
        tone: "success",
        title: "Evento eliminado",
        description: "Aplicamos la solicitud y avisamos a quien la envio.",
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        title: "No pudimos eliminar el evento",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
      throw error;
    }
  }

  async function handleRejectEventDeleteRequest(
    request: ObligationEventDeleteRequest,
    rejectionReason: string,
  ) {
    if (!activeWorkspace || !user?.id) {
      throw new Error("La sesión o el espacio ya no están disponibles. Actualiza antes de responder.");
    }
    if (!obligations.some(item => item.id === request.payload.obligationId && item.workspaceId === activeWorkspace.id)) throw new Error("La solicitud no pertenece al espacio actual.");

    try {
      await rejectEventDeleteRequestMutation.mutateAsync({
        payload: request.payload,
        userId: user.id,
        rejectionReason,
      });
      setPageFeedback({
        tone: "success",
        title: "Solicitud rechazada",
        description: "El evento sigue igual y avisamos a quien lo pidio.",
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        title: "No pudimos rechazar la solicitud",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
      throw error;
    }
  }

  async function handleAcceptEventEditRequest(request: ObligationEventEditRequest) {
    if (!activeWorkspace || !user?.id) {
      throw new Error("La sesión o el espacio ya no están disponibles. Actualiza antes de responder.");
    }
    if (!obligations.some(item => item.id === request.payload.obligationId && item.workspaceId === activeWorkspace.id)) throw new Error("La solicitud no pertenece al espacio actual.");

    const obligation = obligations.find((item) => item.id === request.payload.obligationId);
    const currentEvent =
      obligation?.events.find((item) => item.id === request.payload.eventId) ?? null;
    const currentMovementId = currentEvent?.movementId ?? null;
    const currentAccountId = currentEvent ? resolveEventAccountId(currentEvent) : null;
    const proposedAmount = request.payload.proposedAmount ?? currentEvent?.amount ?? 0;
    // El pendiente actual ya tiene descontado el monto viejo del abono.
    const pendingBefore = (obligation?.pendingAmount ?? 0) + (currentEvent?.amount ?? 0);
    const remaining = Math.max(0, pendingBefore - proposedAmount);
    const nextStatus: ObligationStatus | undefined = obligation
      ? remaining <= 0
        ? "paid"
        : obligation.status === "paid"
          ? "active"
          : undefined
      : undefined;

    try {
      await acceptEventEditRequestMutation.mutateAsync({
        payload: request.payload,
        workspaceId: activeWorkspace.id,
        userId: user.id,
        movementId: currentMovementId,
        accountId: currentAccountId,
        nextStatus,
      });
      setPageFeedback({
        tone: "success",
        title: "Cambios aplicados",
        description: "El evento y su movimiento vinculado quedaron con los datos propuestos.",
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        title: "No pudimos aplicar los cambios",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
      throw error;
    }
  }

  async function handleRejectEventEditRequest(
    request: ObligationEventEditRequest,
    rejectionReason: string,
  ) {
    if (!activeWorkspace || !user?.id) {
      throw new Error("La sesión o el espacio ya no están disponibles. Actualiza antes de responder.");
    }
    if (!obligations.some(item => item.id === request.payload.obligationId && item.workspaceId === activeWorkspace.id)) throw new Error("La solicitud no pertenece al espacio actual.");

    try {
      await rejectEventEditRequestMutation.mutateAsync({
        payload: request.payload,
        userId: user.id,
        rejectionReason,
      });
      setPageFeedback({
        tone: "success",
        title: "Propuesta rechazada",
        description: "El evento sigue igual y avisamos a quien la envio.",
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        title: "No pudimos rechazar la propuesta",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
      throw error;
    }
  }

  async function handleAcceptPaymentRequest(input: {
    request: ObligationPaymentRequest;
    obligation: ObligationSummary;
    registerAccountMovement: boolean;
    accountId: number | null;
  }) {
    if (!activeWorkspace || !user?.id) {
      throw new Error("La sesión o el espacio ya no están disponibles. Actualiza antes de responder.");
    }
    if (!obligations.some(item => item.id === input.obligation.id && item.workspaceId === activeWorkspace.id)) throw new Error("La solicitud no pertenece al espacio actual.");

    const remainingAfterPayment = Math.max(
      0,
      input.obligation.pendingAmount - input.request.amount,
    );
    const nextStatus: ObligationStatus =
      remainingAfterPayment <= 0
        ? "paid"
        : input.obligation.status === "draft"
          ? "active"
          : input.obligation.status;

    try {
      await acceptPaymentRequestMutation.mutateAsync({
        request: input.request,
        obligationId: input.obligation.id,
        workspaceId: activeWorkspace.id,
        userId: user.id,
        registerAccountMovement: input.registerAccountMovement,
        accountId: input.accountId,
        nextStatus,
      });
      setPageFeedback({
        tone: "success",
        title: "Solicitud aceptada",
        description: input.registerAccountMovement
          ? "Registramos el abono y su movimiento en la cuenta que elegiste."
          : "Registramos el abono. No creamos movimiento en cuenta.",
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        title: "No pudimos aceptar la solicitud",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
      throw error;
    }
  }

  async function handleRejectPaymentRequest(input: {
    request: ObligationPaymentRequest;
    obligation: ObligationSummary;
    rejectionReason: string;
  }) {
    if (!activeWorkspace || !user?.id) {
      throw new Error("La sesión o el espacio ya no están disponibles. Actualiza antes de responder.");
    }
    if (!obligations.some(item => item.id === input.obligation.id && item.workspaceId === activeWorkspace.id)) throw new Error("La solicitud no pertenece al espacio actual.");

    try {
      await rejectPaymentRequestMutation.mutateAsync({
        request: input.request,
        obligationId: input.obligation.id,
        workspaceId: activeWorkspace.id,
        userId: user.id,
        obligationTitle: input.obligation.title,
        rejectionReason: input.rejectionReason,
      });
      setPageFeedback({
        tone: "success",
        title: "Solicitud rechazada",
        description: "Avisamos a quien la envio. El saldo pendiente no cambio.",
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        title: "No pudimos rechazar la solicitud",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
      throw error;
    }
  }

  async function handleUnlinkShare(obligationId: number) {
    const share = shareByObligationId.get(obligationId) ?? null;
    setShareDialogFeedback(null);

    try {
      const result = await unlinkShareMutation.mutateAsync({
        shareId: share?.id ?? null,
        obligationId,
      });
      setShareTargetId(null);
      setPageFeedback({
        tone: "success",
        title: result.alreadyInactive ? "El acceso ya estaba cerrado" : "Acceso retirado",
        description:
          "La persona invitada ya no vera este registro. El credito y su historial quedan intactos.",
      });
    } catch (error) {
      setShareDialogFeedback({
        tone: "error",
        title: "No pudimos quitar el acceso",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleUnlinkSharedObligation() {
    if (!unlinkSharedTarget) return;
    const target = unlinkSharedTarget;
    try {
      await unlinkShareMutation.mutateAsync({ shareId: target.share.id, obligationId: target.id });
      setUnlinkSharedTarget(null);
      setPageFeedback({ tone: "success", title: "Registro retirado", description: "Ya no aparecerá entre los compartidos contigo." });
    } catch (error) {
      setPageFeedback({ tone: "error", title: "No pudimos quitar el registro", description: getQueryErrorMessage(error, "Intenta nuevamente.") });
    }
  }

  async function handleConfirmDeleteEvent() {
    if (!activeWorkspace || !user?.id || !eventDeleteTarget) {
      return;
    }

    const obligation = obligations.find((item) => item.id === eventDeleteTarget.obligationId);

    if (!obligation) {
      return;
    }

    const deletedEvent = eventDeleteTarget.event;
    const pendingDelta = deletedEvent.eventType === "principal_increase" ? -deletedEvent.amount : deletedEvent.amount;
    const pendingAfterDelete = Math.max(0, obligation.pendingAmount + pendingDelta);
    const nextStatus: ObligationStatus =
      pendingAfterDelete > 0 && obligation.status === "paid" ? "active" : obligation.status;

    try {
      await eventDeleteMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        userId: user.id,
        eventId: eventDeleteTarget.event.id,
        obligationId: eventDeleteTarget.obligationId,
        movementId: eventDeleteTarget.event.movementId ?? null,
        nextStatus,
      });
      setEventDeleteTarget(null);
      setPageFeedback({
        tone: "success",
        title: deletedEvent.eventType === "payment" ? "Abono eliminado" : "Ajuste eliminado",
        description: eventDeleteTarget.event.movementId
          ? "También borramos el movimiento que lo acompañaba."
          : "El principal y el saldo pendiente ya se actualizaron.",
      });
    } catch (error) {
      setEventDeleteTarget(null);
      setPageFeedback({
        tone: "error",
        title: "No pudimos eliminar el evento",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  function openPrincipalAdjustmentDialog(
    obligation: ObligationSummary,
    mode: PrincipalAdjustmentMode,
  ) {
    setPageFeedback(null);
    setPrincipalAdjustmentFeedback(null);
    setPrincipalAdjustmentMode(mode);
    setPrincipalAdjustmentTargetId(obligation.id);
    setPrincipalAdjustmentEditEventId(null);
    setPrincipalAdjustmentFormState(createDefaultPrincipalAdjustmentFormState(obligation, mode));
  }

  function openPrincipalAdjustmentEditDialog(obligation: ObligationSummary, event: ObligationEventSummary) {
    const accountId = resolveEventAccountId(event);
    setPageFeedback(null);
    setPrincipalAdjustmentFeedback(null);
    setPrincipalAdjustmentTargetId(obligation.id);
    setPrincipalAdjustmentEditEventId(event.id);
    setPrincipalAdjustmentMode(event.eventType === "principal_decrease" ? "decrease" : "increase");
    setPrincipalAdjustmentFormState({ amount: String(event.amount), eventDate: event.eventDate, reason: event.reason ?? "", notes: event.notes ?? "", registerAccountMovement: event.movementId != null, accountId: accountId != null ? String(accountId) : "" });
  }

  async function sendShareInvite(
    obligationId: number,
    formInput: ShareInviteFormState,
  ) {
    if (!activeWorkspace) {
      throw new Error("Necesitamos un workspace activo para compartir este registro.");
    }

    const invitedEmail = formInput.invitedEmail.trim().toLowerCase();

    if (!invitedEmail) {
      return null;
    }

    if (!canAccessProFeatures) {
      throw new Error(
        "Compartir creditos o deudas con otro usuario forma parte de DarkMoney Pro.",
      );
    }

    return await shareInviteMutation.mutateAsync({
      workspaceId: activeWorkspace.id,
      obligationId,
      invitedEmail,
      message: formInput.message.trim() || null,
      appUrl: getPublicAppUrl(),
    } satisfies ObligationShareInviteInput);
  }

  const isSavingEditor =
    createMutation.isPending ||
    updateMutation.isPending ||
    createAttachmentRecordMutation.isPending ||
    shareInviteMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isRegisteringPayment = paymentMutation.isPending || eventUpdateMutation.isPending;
  const isAdjustingPrincipal = principalAdjustmentMutation.isPending || (principalAdjustmentEditEventId !== null && eventUpdateMutation.isPending);
  const isSendingShareInvite = shareInviteMutation.isPending;
  const activeOwnObligations = obligations.filter((obligation) => obligation.status !== "cancelled");
  const activeSharedObligations = sharedObligations.filter((obligation) => obligation.status !== "cancelled");
  const receivablePendingDisplay = getPortfolioAmountDisplay(activeOwnObligations, activeSharedObligations, "receivable", baseCurrencyCode);
  const payablePendingDisplay = getPortfolioAmountDisplay(activeOwnObligations, activeSharedObligations, "payable", baseCurrencyCode);
  const filteredObligations = useMemo(() => {
    const normalizedSearch = obligationFilters.title.trim().toLowerCase();
    const normalizedCounterparty = obligationFilters.counterparty.trim().toLowerCase();
    const normalizedPrincipal = obligationFilters.principal.trim().toLowerCase();
    const normalizedPending = obligationFilters.pending.trim().toLowerCase();

    return obligations.filter((obligation) => {
      if (hiddenIds.has(obligation.id)) {
        return false;
      }

      if (!showArchived && obligation.status === "cancelled") {
        return false;
      }

      if (directionFilters.length > 0 && !directionFilters.includes(obligation.direction)) {
        return false;
      }

      if (statusFilters.length > 0 && !statusFilters.includes(obligation.status)) {
        return false;
      }

      if (normalizedSearch) {
        const searchableText = [
          obligation.title,
          obligation.counterparty,
          obligation.description ?? "",
          obligation.notes ?? "",
          obligation.currencyCode,
          obligation.settlementAccountName ?? "",
          getDirectionLabel(obligation.direction),
          getStatusOption(obligation.status).label,
          getOriginOption(obligation.originType, obligation.direction).label,
          obligation.installmentLabel,
        ]
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(normalizedSearch)) {
          return false;
        }
      }

      if (normalizedCounterparty && !obligation.counterparty.toLowerCase().includes(normalizedCounterparty)) {
        return false;
      }

      const principalText = [
        obligation.currentPrincipalAmount ?? obligation.principalAmount,
        formatCurrency(obligation.currentPrincipalAmount ?? obligation.principalAmount, obligation.currencyCode),
      ]
        .join(" ")
        .toLowerCase();
      if (normalizedPrincipal && !principalText.includes(normalizedPrincipal)) {
        return false;
      }

      const pendingText = [obligation.pendingAmount, formatCurrency(obligation.pendingAmount, obligation.currencyCode)]
        .join(" ")
        .toLowerCase();
      if (normalizedPending && !pendingText.includes(normalizedPending)) {
        return false;
      }

      return true;
    });
  }, [directionFilters, hiddenIds, obligationFilters, obligations, showArchived, statusFilters]);

  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredObligations);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const selectedDeletableCount = selectedItems.filter(canDeleteObligation).length;

  const filteredSharedObligations = useMemo(() => {
    const normalizedSearch = obligationFilters.title.trim().toLowerCase();

    return sharedObligations.filter((obligation) => {
      if (!showArchived && obligation.status === "cancelled") {
        return false;
      }

      if (directionFilters.length > 0 && !directionFilters.includes(obligation.direction)) {
        return false;
      }

      if (statusFilters.length > 0 && !statusFilters.includes(obligation.status)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        obligation.title,
        obligation.counterparty,
        obligation.description ?? "",
        obligation.notes ?? "",
        obligation.currencyCode,
        obligation.settlementAccountName ?? "",
        obligation.share.ownerDisplayName ?? "",
        obligation.share.invitedDisplayName ?? "",
        obligation.share.invitedEmail,
        getDirectionLabel(obligation.direction),
        getStatusOption(obligation.status).label,
        getOriginOption(obligation.originType, obligation.direction).label,
        obligation.installmentLabel,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [directionFilters, obligationFilters, sharedObligations, showArchived, statusFilters]);

  const filteredReceivableDisplay = getPortfolioAmountDisplay(filteredObligations, filteredSharedObligations, "receivable", baseCurrencyCode);
  const filteredPayableDisplay = getPortfolioAmountDisplay(filteredObligations, filteredSharedObligations, "payable", baseCurrencyCode);

  const hasActiveFilters =
    obligationFilters.title.trim() !== "" ||
    obligationFilters.counterparty.trim() !== "" ||
    directionFilters.length > 0 ||
    statusFilters.length > 0 ||
    showArchived ||
    obligationFilters.principal.trim() !== "" ||
    obligationFilters.pending.trim() !== "";

  const totalPages = Math.max(1, Math.ceil(filteredObligations.length / OBLIGATIONS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedObligations = useMemo(
    () => filteredObligations.slice((safePage - 1) * OBLIGATIONS_PAGE_SIZE, safePage * OBLIGATIONS_PAGE_SIZE),
    [filteredObligations, safePage],
  );

  async function handleSubmitShareInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShareDialogFeedback(null);

    if (!shareTarget) {
      setShareDialogFeedback({
        tone: "error",
        title: "No encontramos el registro",
        description: "Vuelve a abrir el dialogo para compartir este credito o deuda.",
      });
      return;
    }

    const invitedEmail = shareDialogFormState.invitedEmail.trim();

    if (!invitedEmail) {
      setShareDialogFeedback({
        tone: "error",
        title: "Falta el correo",
        description: "Ingresa el correo del usuario que recibira esta invitacion.",
      });
      return;
    }

    try {
      const inviteResult = await sendShareInvite(shareTarget.id, shareDialogFormState);

      if (!inviteResult) {
        throw new Error("Falta el correo del usuario que recibira esta invitacion.");
      }

      if (!inviteResult.alreadyAccepted && !inviteResult.emailSent) {
        setShareDialogFeedback({
          tone: "error",
          title: "Invitacion creada, correo pendiente",
          description: describeShareInviteOutcome(inviteResult),
        });
        return;
      }

      setShareTargetId(null);
      setShareDialogFormState(createDefaultShareInviteFormState());
      setPageFeedback({
        tone: "success",
        title: inviteResult.alreadyAccepted ? "Acceso ya confirmado" : "Invitacion enviada",
        description: describeShareInviteOutcome(inviteResult),
      });
    } catch (error) {
      setShareDialogFeedback({
        tone: "error",
        title: "No pudimos compartir el registro",
        description: getQueryErrorMessage(
          error,
          "Intentalo otra vez dentro de unos segundos.",
        ),
      });
    }
  }

  async function handleSubmitObligation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditorFeedback(null);

    if (!activeWorkspace || !user?.id) {
      setEditorFeedback({
        tone: "error",
        title: "No encontramos el workspace activo",
        description: "Recarga la pagina e intenta nuevamente.",
      });
      return;
    }

    const title = formState.title.trim();
    const counterpartyId = parseOptionalInteger(formState.counterpartyId);
    const openingAccountId = parseOptionalInteger(formState.openingAccountId);
    const settlementAccountId = parseOptionalInteger(formState.settlementAccountId);
    const principalAmount = parseOptionalNumber(formState.principalAmount);
    const paymentPlan = normalizePaymentPlan(formState.paymentPlan);
    const scheduledPayments = paymentPlan && principalAmount && principalAmount > 0
      ? expandPaymentPlan(paymentPlan, principalAmount, formState.startDate)
      : [];
    const interestRate = parseOptionalNumber(formState.interestRate);
    const openingImpact = getOpeningImpact(
      formState.direction,
      formState.originType,
      formState.manualOpeningImpact,
    );

    const oblErrors: string[] = [];
    if (!title) oblErrors.push("title");
    if (counterpartyId === null || !Number.isInteger(counterpartyId) || counterpartyId <= 0) oblErrors.push("counterpartyId");
    if (principalAmount === null || Number.isNaN(principalAmount) || principalAmount <= 0) oblErrors.push("principalAmount");
    if (!formState.startDate) oblErrors.push("startDate");
    if (oblErrors.length > 0) {
      setInvalidFields(new Set(oblErrors));
      setEditorFeedback({ tone: "error", title: "Revisa los campos requeridos", description: "Completa los campos marcados en rojo antes de guardar." });
      return;
    }

    if (formState.dueDate && formState.dueDate < formState.startDate) {
      setEditorFeedback({
        tone: "error",
        title: "La fecha objetivo no cuadra",
        description: "La fecha objetivo no puede ser anterior al inicio.",
      });
      return;
    }

    if (paymentPlan && (!scheduledPayments.length || planDifference(principalAmount ?? 0, scheduledPayments) !== 0)) {
      setEditorFeedback({
        tone: "error",
        title: "El plan no cubre el monto",
        description: "Revisa el plan de pagos: debe programar exactamente el monto del registro.",
      });
      return;
    }

    if (interestRate !== null && (Number.isNaN(interestRate) || interestRate < 0)) {
      setEditorFeedback({
        tone: "error",
        title: "Interes invalido",
        description: "El interes debe ser cero o un valor positivo.",
      });
      return;
    }

    if (settlementAccountId !== null && Number.isNaN(settlementAccountId)) {
      setEditorFeedback({
        tone: "error",
        title: "La cuenta seleccionada no es valida",
        description: "Vuelve a elegir la cuenta de liquidacion.",
      });
      return;
    }

    if (openingImpact !== "none") {
      if (openingAccountId === null || Number.isNaN(openingAccountId) || openingAccountId <= 0) {
        setEditorFeedback({
          tone: "error",
          title: "Falta la cuenta inicial",
          description: "Selecciona la cuenta que recibira o entregara el monto de apertura.",
        });
        return;
      }

      const selectedOpeningAccount = accounts.find((account) => account.id === openingAccountId);
      const normalizedCurrencyCode = formState.currencyCode.trim().toUpperCase() || baseCurrencyCode;

      if (!selectedOpeningAccount || selectedOpeningAccount.currencyCode !== normalizedCurrencyCode) {
        setEditorFeedback({
          tone: "error",
          title: "La cuenta inicial no coincide",
          description: `La cuenta inicial debe estar en ${normalizedCurrencyCode} para registrar la apertura sin conversion.`,
        });
        return;
      }
    }

    const currentEditorShare =
      editorMode === "edit" && selectedObligation
        ? (shareByObligationId.get(selectedObligation.id) ?? null)
        : null;
    const shouldUpdateSharedViewer = shouldResendShareInvite(currentEditorShare, createShareFormState);

    try {
      if (!snapshot) throw new Error("Espera la lectura del espacio actual.");
      const payload = buildObligationEditorInput(formState, snapshot, editorMode === "create");
      if (editorMode === "create") {
        const createdObligationId = await createMutation.mutateAsync({
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        });
        let receiptUploaded = false;
        let shareInviteResult: Awaited<ReturnType<typeof sendShareInvite>> = null;
        let shareInviteErrorMessage: string | null = null;

        if (pendingReceiptFile && canUploadReceipts) {
          try {
            await uploadReceiptForObligation(createdObligationId, pendingReceiptFile);
            receiptUploaded = true;
          } catch {
            receiptUploaded = false;
          }
        }

        if (createShareFormState.invitedEmail.trim()) {
          try {
            shareInviteResult = await sendShareInvite(createdObligationId, createShareFormState);
          } catch (shareError) {
            shareInviteErrorMessage = getQueryErrorMessage(
              shareError,
              "No pudimos enviar la invitacion compartida.",
            );
          }
        }

        const descriptionParts = [
          openingImpact === "none"
            ? "Ya aparece en tu cartera sin mover una cuenta al inicio."
            : "Ya aparece en tu cartera y la apertura inicial tambien quedo reflejada en la cuenta elegida.",
        ];

        if (pendingReceiptFile && canUploadReceipts) {
          descriptionParts.push(
            receiptUploaded
              ? "El comprobante tambien quedo guardado."
              : "El comprobante quedo pendiente por ahora.",
          );
        }

        if (shareInviteResult) {
          descriptionParts.push(describeShareInviteOutcome(shareInviteResult, "create"));
        }

        if (shareInviteErrorMessage) {
          descriptionParts.push(`El registro se creo bien, pero compartirlo quedo pendiente: ${shareInviteErrorMessage}`);
        }

        setPageFeedback({
          tone: "success",
          title: "Registro creado",
          description: descriptionParts.join(" "),
        });
      } else if (selectedObligation) {
        let shareInviteResult: Awaited<ReturnType<typeof sendShareInvite>> = null;
        let shareInviteErrorMessage: string | null = null;

        await updateMutation.mutateAsync({
          obligationId: selectedObligation.id,
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        });

        if (shouldUpdateSharedViewer) {
          try {
            shareInviteResult = await sendShareInvite(selectedObligation.id, createShareFormState);
          } catch (shareError) {
            shareInviteErrorMessage = getQueryErrorMessage(
              shareError,
              "No pudimos actualizar el acceso compartido.",
            );
          }
        }

        const descriptionParts = ["La informacion del registro se actualizo correctamente."];

        if (shareInviteResult) {
          descriptionParts.push(describeShareInviteOutcome(shareInviteResult, "reassign"));
        } else if (currentEditorShare) {
          descriptionParts.push("La persona asociada se mantuvo sin cambios.");
        }

        if (shareInviteErrorMessage) {
          descriptionParts.push(`El registro se actualizo, pero la reasignacion quedo pendiente: ${shareInviteErrorMessage}`);
        }

        setPageFeedback({
          tone: "success",
          title: "Cambios guardados",
          description: descriptionParts.join(" "),
        });
      }

      setPendingReceiptFile(null);
      setCreateShareFormState(createDefaultShareInviteFormState());
      setIsEditorOpen(false);
      setSelectedObligationId(null);
    } catch (error) {
      setEditorFeedback({
        tone: "error",
        title: "No pudimos guardar el registro",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleSubmitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentFeedback(null);

    if (!activeWorkspace || !user?.id || !paymentTarget) {
      setPaymentFeedback({
        tone: "error",
        title: "No encontramos el registro",
        description: "Recarga la pagina e intenta nuevamente.",
      });
      return;
    }

    const paymentNoun = paymentTarget.direction === "receivable" ? "cobro" : "pago";
    const paymentNounTitle = paymentTarget.direction === "receivable" ? "Cobro" : "Pago";

    const amount = parseOptionalNumber(paymentFormState.amount);
    const installmentNo = parseOptionalInteger(paymentFormState.installmentNo);

    if (amount === null || Number.isNaN(amount) || amount <= 0) {
      setPaymentFeedback({
        tone: "error",
        title: "Monto invalido",
        description: `Ingresa un ${paymentNoun} mayor que cero.`,
      });
      return;
    }

    if (!paymentFormState.eventDate) {
      setPaymentFeedback({
        tone: "error",
        title: "Falta la fecha",
        description: `Selecciona la fecha en la que se realizó el ${paymentNoun}.`,
      });
      return;
    }

    if (installmentNo !== null && (Number.isNaN(installmentNo) || installmentNo <= 0)) {
      setPaymentFeedback({
        tone: "error",
        title: "Cuota invalida",
        description: "Si la completas, debe ser un numero entero mayor que cero.",
      });
      return;
    }

    const accountId = parseOptionalInteger(paymentFormState.accountId);
    const hasSelectableAccount = accounts.some(
      (account) => !account.isArchived && account.currencyCode === paymentTarget.currencyCode,
    );
    // Sin cuentas en la moneda del registro el abono se guarda igual, solo sin movimiento.
    const shouldRegisterMovement = paymentFormState.registerAccountMovement && hasSelectableAccount;

    if (shouldRegisterMovement && !accountId) {
      setPaymentFeedback({
        tone: "error",
        title: "Falta la cuenta",
        description:
          "Selecciona la cuenta afectada o desactiva el registro del movimiento en cuenta.",
      });
      return;
    }

    const editingEvent =
      paymentEditEventId === null
        ? null
        : paymentTarget.events.find((event) => event.id === paymentEditEventId) ?? null;
    // Al editar hay que devolver el monto anterior antes de descontar el nuevo.
    const pendingBeforePayment = editingEvent
      ? paymentTarget.pendingAmount + editingEvent.amount
      : paymentTarget.pendingAmount;
    const remainingAfterPayment = Math.max(0, pendingBeforePayment - amount);
    const nextStatus: ObligationStatus =
      remainingAfterPayment <= 0
        ? "paid"
        : paymentTarget.status === "draft" || paymentTarget.status === "paid"
          ? "active"
          : paymentTarget.status;

    if (editingEvent) {
      try {
        await eventUpdateMutation.mutateAsync({
          workspaceId: activeWorkspace.id,
          userId: user.id,
          eventId: editingEvent.id,
          obligationId: paymentTarget.id,
          eventDate: paymentFormState.eventDate,
          amount,
          installmentNo,
          description: paymentFormState.description,
          notes: paymentFormState.notes,
          movementId: editingEvent.movementId ?? null,
          registerAccountMovement: shouldRegisterMovement,
          accountId: shouldRegisterMovement ? accountId : null,
          nextStatus,
        });
        setPageFeedback({
          tone: "success",
          title: `${paymentNounTitle} actualizado`,
          description:
            "El saldo pendiente y el movimiento vinculado quedaron alineados con los nuevos datos.",
        });
        setPaymentTargetId(null);
        setPaymentEditEventId(null);
      } catch (error) {
        setPaymentFeedback({
          tone: "error",
          title: `No pudimos actualizar el ${paymentNoun}`,
          description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
        });
      }

      return;
    }

    try {
      const created = await paymentMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        userId: user.id,
        obligationId: paymentTarget.id,
        eventDate: paymentFormState.eventDate,
        amount,
        installmentNo,
        description: paymentFormState.description,
        notes: paymentFormState.notes,
        registerAccountMovement: shouldRegisterMovement,
        accountId: shouldRegisterMovement ? accountId : null,
        nextStatus,
      } satisfies ObligationPaymentFormInput & { workspaceId: number; userId: string });

      // El comprobante va despues: el evento tiene que existir para colgarlo de el.
      let receiptFailed = false;

      if (pendingPaymentReceiptFile && canUploadReceipts && created.eventId !== null) {
        try {
          await uploadReceiptForEvent(
            created.eventId,
            created.movementId,
            pendingPaymentReceiptFile,
          );
        } catch {
          receiptFailed = true;
        }
      }

      setPendingPaymentReceiptFile(null);
      setPageFeedback({
        tone: "success",
        title: receiptFailed ? `${paymentNounTitle} registrado, sin comprobante` : `${paymentNounTitle} registrado`,
        description: `${
          remainingAfterPayment <= 0
            ? "El registro quedo liquidado y su saldo pendiente ya se actualizo."
            : "El avance y el saldo pendiente se actualizaron correctamente."
        }${
          shouldRegisterMovement ? " Tambien creamos el movimiento en la cuenta seleccionada." : ""
        }${
          receiptFailed ? " No pudimos adjuntar el comprobante, vuelve a subirlo al editarlo." : ""
        }`,
      });
      setPaymentTargetId(null);
    } catch (error) {
      setPaymentFeedback({
        tone: "error",
        title: `No pudimos registrar el ${paymentNoun}`,
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleSubmitPrincipalAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPrincipalAdjustmentFeedback(null);

    if (!activeWorkspace || !user?.id || !principalAdjustmentTarget) {
      setPrincipalAdjustmentFeedback({
        tone: "error",
        title: "No encontramos el registro",
        description: "Recarga la pagina e intenta nuevamente.",
      });
      return;
    }

    const amount = parseOptionalNumber(principalAdjustmentFormState.amount);
    const accountId = parseOptionalInteger(principalAdjustmentFormState.accountId);
    const eventType = getPrincipalAdjustmentEventType(principalAdjustmentMode);

    if (amount === null || Number.isNaN(amount) || amount <= 0) {
      setPrincipalAdjustmentFeedback({
        tone: "error",
        title: "Monto invalido",
        description: "Ingresa un monto mayor que cero para registrar el ajuste.",
      });
      return;
    }

    if (!principalAdjustmentFormState.eventDate) {
      setPrincipalAdjustmentFeedback({
        tone: "error",
        title: "Falta la fecha",
        description: "Selecciona cuando ocurrio este ajuste.",
      });
      return;
    }

    if (!principalAdjustmentFormState.reason.trim()) {
      setPrincipalAdjustmentFeedback({
        tone: "error",
        title: "Falta el motivo",
        description: "Necesitamos guardar por que cambiaste el principal.",
      });
      return;
    }

    if (principalAdjustmentMode === "decrease" && amount > principalAdjustmentTarget.pendingAmount) {
      setPrincipalAdjustmentFeedback({
        tone: "error",
        title: "La reduccion es demasiado grande",
        description: "No puedes reducir mas de lo que hoy queda pendiente en este registro.",
      });
      return;
    }

    if (principalAdjustmentFormState.registerAccountMovement) {
      if (accountId === null || Number.isNaN(accountId) || accountId <= 0) {
        setPrincipalAdjustmentFeedback({
          tone: "error",
          title: "Falta la cuenta",
          description: "Selecciona la cuenta que se vera afectada por este ajuste.",
        });
        return;
      }

      const selectedAccount = accounts.find((account) => account.id === accountId);

      if (!selectedAccount || selectedAccount.currencyCode !== principalAdjustmentTarget.currencyCode) {
        setPrincipalAdjustmentFeedback({
          tone: "error",
          title: "La cuenta no coincide",
          description: `La cuenta elegida debe estar en ${principalAdjustmentTarget.currencyCode}.`,
        });
        return;
      }
    }

    const nextPendingAmount = Math.max(
      0,
      principalAdjustmentTarget.pendingAmount +
        (principalAdjustmentMode === "increase" ? amount : amount * -1),
    );
    const nextStatus: ObligationStatus =
      nextPendingAmount <= 0
        ? "paid"
        : principalAdjustmentTarget.status === "paid" || principalAdjustmentTarget.status === "draft"
          ? "active"
          : principalAdjustmentTarget.status;

    const editingAdjustmentEvent = principalAdjustmentEditEventId === null ? null : principalAdjustmentTarget.events.find((event) => event.id === principalAdjustmentEditEventId) ?? null;

    if (editingAdjustmentEvent) {
      const oldDelta = editingAdjustmentEvent.eventType === "principal_increase" ? editingAdjustmentEvent.amount : -editingAdjustmentEvent.amount;
      const newDelta = principalAdjustmentMode === "increase" ? amount : -amount;
      const editedPending = Math.max(0, principalAdjustmentTarget.pendingAmount - oldDelta + newDelta);
      const editedStatus: ObligationStatus = editedPending <= 0 ? "paid" : principalAdjustmentTarget.status === "paid" || principalAdjustmentTarget.status === "draft" ? "active" : principalAdjustmentTarget.status;
      try {
        await eventUpdateMutation.mutateAsync({ workspaceId: activeWorkspace.id, userId: user.id, eventId: editingAdjustmentEvent.id, obligationId: principalAdjustmentTarget.id, eventType: principalAdjustmentMode === "increase" ? "principal_increase" : "principal_decrease", eventDate: principalAdjustmentFormState.eventDate, amount, reason: principalAdjustmentFormState.reason, description: principalAdjustmentMode === "increase" ? "Aumento de principal" : "Reducción de principal", notes: principalAdjustmentFormState.notes, movementId: editingAdjustmentEvent.movementId ?? null, registerAccountMovement: principalAdjustmentFormState.registerAccountMovement, accountId: principalAdjustmentFormState.registerAccountMovement ? accountId : null, nextStatus: editedStatus });
        setPageFeedback({ tone: "success", title: "Ajuste actualizado", description: "El principal, el pendiente y el movimiento vinculado quedaron sincronizados." });
        setPrincipalAdjustmentTargetId(null);
        setPrincipalAdjustmentEditEventId(null);
      } catch (error) {
        setPrincipalAdjustmentFeedback({ tone: "error", title: "No pudimos actualizar el ajuste", description: getQueryErrorMessage(error, "Intenta nuevamente.") });
      }
      return;
    }

    try {
      await principalAdjustmentMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        userId: user.id,
        obligationId: principalAdjustmentTarget.id,
        eventType,
        eventDate: principalAdjustmentFormState.eventDate,
        amount,
        reason: principalAdjustmentFormState.reason,
        notes: principalAdjustmentFormState.notes,
        registerAccountMovement: principalAdjustmentFormState.registerAccountMovement,
        accountId:
          principalAdjustmentFormState.registerAccountMovement && accountId !== null ? accountId : null,
        currentPrincipalAmount:
          principalAdjustmentTarget.currentPrincipalAmount ?? principalAdjustmentTarget.principalAmount,
        currentPendingAmount: principalAdjustmentTarget.pendingAmount,
        nextStatus,
      } satisfies ObligationPrincipalAdjustmentFormInput & { workspaceId: number; userId: string });

      setPageFeedback({
        tone: "success",
        title:
          principalAdjustmentMode === "increase" ? "Monto agregado" : "Monto reducido",
        description:
          principalAdjustmentMode === "increase"
            ? "El principal subio y el historial ya dejo registrado el motivo del cambio."
            : "El principal se redujo y el historial ya dejo registrado el motivo del cambio.",
      });
      setPrincipalAdjustmentTargetId(null);
      setPrincipalAdjustmentEditEventId(null);
    } catch (error) {
      setPrincipalAdjustmentFeedback({
        tone: "error",
        title: "No pudimos guardar el ajuste",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  function handleDelete() {
    if (!activeWorkspace || !deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTargetId(null);
    setHiddenIds((prev) => new Set([...prev, targetId]));
    schedule({
      label: "Crédito/Deuda eliminado",
      onCommit: () =>
        deleteMutation.mutateAsync({ obligationId: targetId, workspaceId: activeWorkspace.id }),
      onUndo: () => {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      },
    });
  }

  async function handleArchiveObligation(obligation: ObligationSummary, archived: boolean) {
    setDetailObligationId(null);
    try {
      await archiveMutation.mutateAsync({ obligationId: obligation.id, archived });
      setPageFeedback({ tone: "success", title: archived ? "Registro archivado" : "Registro restaurado", description: archived ? "Puedes volver a verlo activando Archivadas." : "El registro volvió a la cartera activa." });
    } catch (error) {
      setPageFeedback({ tone: "error", title: archived ? "No pudimos archivar" : "No pudimos restaurar", description: getQueryErrorMessage(error, "Intenta nuevamente.") });
    }
  }

  async function handleBulkArchive() {
    if (!selectedItems.length) return;
    const shouldArchive = !selectedItems.every((obligation) => obligation.status === "cancelled");
    setIsBulkArchiving(true);
    try {
      for (const obligation of selectedItems) {
        if ((obligation.status === "cancelled") === shouldArchive) continue;
        await archiveMutation.mutateAsync({ obligationId: obligation.id, archived: shouldArchive });
      }
      clearAll();
      setPageFeedback({ tone: "success", title: shouldArchive ? "Registros archivados" : "Registros restaurados", description: shouldArchive ? "Puedes verlos desde Archivadas." : "Volvieron a la cartera activa." });
    } catch (error) {
      setPageFeedback({ tone: "error", title: "No se completó la acción", description: getQueryErrorMessage(error, "Algunos registros no pudieron actualizarse.") });
    } finally {
      setIsBulkArchiving(false);
    }
  }

  async function confirmBulkDelete() {
    if (!activeWorkspace || selectedCount === 0) return;
    setIsBulkDeleting(true);
    try {
      const deletable = selectedItems.filter(canDeleteObligation);
      const skipped = selectedItems.length - deletable.length;
      for (const obligation of deletable) {
        await deleteMutation.mutateAsync({ obligationId: obligation.id, workspaceId: activeWorkspace.id });
      }
      clearAll();
      if (skipped > 0) setPageFeedback({ tone: "error", title: `${skipped} registro${skipped === 1 ? "" : "s"} no se eliminaron`, description: "Tienen eventos: archívalos o elimina antes sus movimientos." });
    } catch (err) {
      setPageFeedback({ tone: "error", title: "Error al eliminar", description: getQueryErrorMessage(err, "Algunos registros no pudieron eliminarse.") });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos preparando la cartera del workspace activo."
          eyebrow="cartera"
          title="Cargando creditos y deudas"
        />
        <ObligationsLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Necesitamos acceder correctamente al workspace activo."
          eyebrow="cartera"
          title="Creditos y deudas no disponibles"
        />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos abrir tu workspace actual.")}
          title="No hay acceso al workspace"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Cuando tengas un workspace activo, aqui veras tu cartera financiera."
          eyebrow="cartera"
          title="Aun no hay un workspace activo"
        />
        <DataState
          description="Activa o crea un workspace para comenzar a registrar creditos y deudas."
          title="Sin cartera para mostrar"
        />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos cargando el resumen de tu cartera y su historial reciente."
          eyebrow="cartera"
          title="Cargando creditos y deudas"
        />
        <ObligationsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Intentamos reconstruir el estado actual de tu cartera."
          eyebrow="cartera"
          title="No fue posible cargar la informacion"
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la cartera actual.")}
          title="Error al cargar creditos y deudas"
          tone="error"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="module-header">
        <div className="min-w-0 flex-1 basis-[15rem]">
          <h1 className="module-heading">Créditos y deudas</h1>
          <p className="mt-1.5 text-sm leading-6 text-storm">{activeOwnObligations.length + activeSharedObligations.length} registros activos · te deben <span className="font-medium text-ink">{receivablePendingDisplay}</span> · debes <span className="font-medium text-ink">{payablePendingDisplay}</span>.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
        <Button data-tour="create-obligation" onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Nuevo registro</Button>
        <div className="relative">
          <button aria-expanded={isActionsMenuOpen} aria-label="Más acciones" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-storm transition-colors duration-150 hover:bg-white/[0.04] hover:text-ink" onClick={() => setIsActionsMenuOpen((value) => !value)} type="button"><MoreVertical className="h-4 w-4" /></button>
          {isActionsMenuOpen ? <>
            <button aria-label="Cerrar acciones" className="fixed inset-0 z-30 cursor-default" onClick={() => setIsActionsMenuOpen(false)} type="button" />
            <div className="absolute right-0 top-12 z-40 min-w-56 overflow-hidden rounded-[9px] border border-white/[0.1] bg-[#1b1a18] py-1">
              <button aria-pressed={groupByDirection} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-white/[0.04]" onClick={() => { toggleGroupByDirection(); setIsActionsMenuOpen(false); }} type="button"><Layers className="h-4 w-4 text-storm" />Agrupar por tipo{groupByDirection ? <Check className="ml-auto h-4 w-4" /> : null}</button>
              <button aria-pressed={showArchived} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-white/[0.04]" onClick={() => { setShowArchived((value) => !value); setIsActionsMenuOpen(false); }} type="button"><Archive className="h-4 w-4 text-storm" />Mostrar archivadas{showArchived ? <Check className="ml-auto h-4 w-4" /> : null}</button>
              <button className="flex w-full items-center gap-3 border-t border-white/[0.08] px-4 py-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-white/[0.04]" disabled={snapshotQuery.isFetching} onClick={() => { setIsActionsMenuOpen(false); snapshotQuery.refetch(); }} type="button"><RefreshCw className={`h-4 w-4 text-storm${snapshotQuery.isFetching ? " animate-spin" : ""}`} />Actualizar</button>
              <button className="flex w-full items-center gap-3 border-t border-white/[0.08] px-4 py-3 text-left text-sm text-ink transition-colors duration-150 hover:bg-white/[0.04] disabled:opacity-40" disabled={!filteredObligations.length} onClick={() => { setIsActionsMenuOpen(false); downloadObligationsCSV(filteredObligations, `creditos-deudas-${new Date().toISOString().slice(0, 10)}.csv`); }} type="button"><Download className="h-4 w-4 text-storm" />Exportar los {filteredObligations.length}</button>
            </div>
          </> : null}
        </div>
        </div>
      </section>

      <section>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <input
            aria-label="Buscar créditos y deudas"
            className="field-dark"
            onChange={(event) => updateObligationFilter("title", event.target.value)}
            placeholder="Buscar por título, contraparte o cuenta..."
            type="text"
            value={obligationFilters.title}
          />
          <MultiSelectFilter label="Toda la cartera" onChange={(values) => setDirectionFilters(values as ObligationDirection[])} options={[{ value: "receivable", label: "Me deben" }, { value: "payable", label: "Debo" }]} values={directionFilters} />
          <MultiSelectFilter label="Todos los estados" onChange={(values) => setStatusFilters(values as ObligationStatus[])} options={[{ value: "active", label: "Activa" }, { value: "defaulted", label: "Incumplida" }, { value: "draft", label: "Borrador" }, { value: "paid", label: "Liquidada" }]} values={statusFilters} />
        </div>
        {(hasActiveFilters || groupByDirection) ? <div className="mt-2 flex flex-wrap items-center gap-2">{directionFilters.map((value) => <button className="rounded-full border border-white/[0.1] px-3 py-1 text-xs text-storm hover:text-ink" key={value} onClick={() => setDirectionFilters((current) => current.filter((item) => item !== value))} type="button">{value === "receivable" ? "Me deben" : "Debo"} ×</button>)}{statusFilters.map((value) => <button className="rounded-full border border-white/[0.1] px-3 py-1 text-xs text-storm hover:text-ink" key={value} onClick={() => setStatusFilters((current) => current.filter((item) => item !== value))} type="button">{getStatusOption(value).label} ×</button>)}{showArchived ? <button className="rounded-full border border-white/[0.1] px-3 py-1 text-xs text-storm hover:text-ink" onClick={() => setShowArchived(false)} type="button">Archivadas ×</button> : null}{groupByDirection ? <button className="rounded-full border border-white/[0.1] px-3 py-1 text-xs text-storm hover:text-ink" onClick={toggleGroupByDirection} type="button">Agrupado por tipo ×</button> : null}{hasActiveFilters ? <button className="text-xs text-storm underline-offset-4 hover:text-ink hover:underline" onClick={clearObligationFilters} type="button">Limpiar filtros</button> : null}</div> : null}
      </section>

      <section aria-label="Resumen de créditos y deudas filtrados" className="module-summary">
        <p className="mr-auto text-storm">Los <span className="font-semibold text-ink">{filteredObligations.length + filteredSharedObligations.length}</span> del filtro</p>
        <p className="text-storm">Por cobrar <span className="ml-1 font-semibold tabular-nums text-ink">{filteredReceivableDisplay}</span></p>
        <p className="text-storm">Por pagar <span className="ml-1 font-semibold tabular-nums text-ink">{filteredPayableDisplay}</span></p>
      </section>

      <PendingPaymentRequestsSection focusRequestId={notificationPaymentId} accounts={accounts} isResolving={acceptPaymentRequestMutation.isPending || rejectPaymentRequestMutation.isPending} obligations={obligations} onAccept={handleAcceptPaymentRequest} onReject={handleRejectPaymentRequest} requests={pendingPaymentRequests} />
      <PendingEventRequestsSection focusRequest={notificationEventRequest} deleteRequests={eventRequestsQuery.data?.deleteRequests ?? []} editRequests={eventRequestsQuery.data?.editRequests ?? []} isResolving={acceptEventDeleteRequestMutation.isPending || rejectEventDeleteRequestMutation.isPending || acceptEventEditRequestMutation.isPending || rejectEventEditRequestMutation.isPending} obligations={obligations} onAcceptDelete={handleAcceptEventDeleteRequest} onAcceptEdit={handleAcceptEventEditRequest} onRejectDelete={handleRejectEventDeleteRequest} onRejectEdit={handleRejectEventEditRequest} />

      {pageFeedback?.tone === "error" ? (
        <DataState
          description={pageFeedback.description}
          title={pageFeedback.title}
          tone={pageFeedback.tone}
          action={pageFeedback.title === "No se pudo abrir el aviso" ? <Button disabled={sharedObligationsQuery.isFetching || pendingPaymentRequestsQuery.isFetching || eventRequestsQuery.isFetching} onClick={() => {
            void Promise.allSettled([sharedObligationsQuery.refetch(), pendingPaymentRequestsQuery.refetch(), eventRequestsQuery.refetch()]);
          }}>Reintentar</Button> : undefined}
        />
      ) : null}

      {obligations.length === 0 ? (
        <DataState
          action={
            <Button onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primer registro
            </Button>
          }
          description="Aun no tienes creditos o deudas creadas en este workspace."
          title="Tu cartera esta vacia"
        />
      ) : filteredObligations.length === 0 ? (
        <DataState
          action={
            hasActiveFilters ? (
              <Button onClick={clearObligationFilters} variant="secondary">
                Quitar filtros
              </Button>
            ) : undefined
          }
          description="No hay registros que coincidan con los filtros activos."
          title="Sin resultados"
        />
      ) : (
        <div className="space-y-6">
          {(groupByDirection ? (["receivable", "payable"] as ObligationDirection[]) : [null]).map((direction) => {
            const sectionObligations = direction ? paginatedObligations.filter((obligation) => obligation.direction === direction) : paginatedObligations;
            if (!sectionObligations.length) return null;
            return <section key={direction ?? "all"}>{direction ? <h3 className="mb-2 font-public-mono text-[11px] uppercase tracking-[0.16em] text-storm">{direction === "receivable" ? "Me deben" : "Yo debo"}</h3> : null}<ObligationTable allSelected={allSelected} obligations={sectionObligations} onAnalytics={setAnalyticsObligationId} onClearAll={clearAll} onOpen={(obligation) => setDetailObligationId(obligation.id)} onSelectAll={selectAll} onToggleSelect={toggleSelect} selectedIds={selectedIds} someSelected={someSelected} /></section>;
          })}
        </div>
      )}

      {filteredObligations.length > 0 ? (
        <Pagination
          onPageChange={setCurrentPage}
          page={safePage}
          pageSize={OBLIGATIONS_PAGE_SIZE}
          totalItems={filteredObligations.length}
        />
      ) : null}

      {detailObligation ? (
        <ObligationDetailDialog
          focusEventId={notificationEventId}
          canShare={canAccessProFeatures}
          obligation={detailObligation}
          onArchive={(obligation, archived) => void handleArchiveObligation(obligation, archived)}
          onAdjust={(obligation, mode) => {
            setDetailObligationId(null);
            openPrincipalAdjustmentDialog(obligation, mode);
          }}
          onAnalytics={(id) => {
            setDetailObligationId(null);
            setAnalyticsObligationId(id);
          }}
          onClose={() => { setDetailObligationId(null); setNotificationEventId(null); }}
          onDelete={(id) => {
            setDetailObligationId(null);
            setDeleteTargetId(id);
          }}
          onDeleteEvent={(obligation, event) => {
            setDetailObligationId(null);
            setEventDeleteTarget({ obligationId: obligation.id, event });
          }}
          onEdit={(obligation) => {
            setDetailObligationId(null);
            openEditEditor(obligation);
          }}
          onEditEvent={(obligation, event) => {
            setDetailObligationId(null);
            if (event.eventType === "principal_increase" || event.eventType === "principal_decrease") openPrincipalAdjustmentEditDialog(obligation, event);
            else openPaymentEditDialog(obligation, event);
          }}
          onPayment={(obligation) => {
            setDetailObligationId(null);
            openPaymentDialog(obligation);
          }}
          onShare={(obligation) => {
            setDetailObligationId(null);
            openShareDialog(obligation);
          }}
        />
      ) : null}

      {analyticsObligationId !== null ? (() => {
        const analyticsObligation = obligations.find((o) => o.id === analyticsObligationId);
        return analyticsObligation ? (
          <ObligationAnalyticsModal
            baseCurrencyCode={baseCurrencyCode}
            obligation={analyticsObligation}
            onClose={() => setAnalyticsObligationId(null)}
            onDeleteEvent={(obligation, event) => {
              setAnalyticsObligationId(null);
              setEventDeleteTarget({ obligationId: obligation.id, event });
            }}
            onEditEvent={(obligation, event) => {
              setAnalyticsObligationId(null);
              if (event.eventType === "principal_increase" || event.eventType === "principal_decrease") openPrincipalAdjustmentEditDialog(obligation, event);
              else openPaymentEditDialog(obligation, event);
            }}
          />
        ) : null;
      })() : null}

      {analyticsSharedObligationId !== null ? (() => {
        const analyticsSharedObligation = sharedObligations.find((o) => o.id === analyticsSharedObligationId);
        return analyticsSharedObligation ? (
          <ObligationAnalyticsModal
            baseCurrencyCode={baseCurrencyCode}
            obligation={analyticsSharedObligation}
            onClose={() => setAnalyticsSharedObligationId(null)}
          />
        ) : null;
      })() : null}

      <BulkActionBar
        archiveLabel={selectedItems.length > 0 && selectedItems.every((obligation) => obligation.status === "cancelled") ? "Restaurar" : "Archivar"}
        isArchiving={isBulkArchiving}
        isDeleting={isBulkDeleting}
        onArchive={() => void handleBulkArchive()}
        onClearAll={clearAll}
        onDelete={() => setShowBulkDeleteConfirm(true)}
        onExport={() => downloadObligationsCSV(selectedItems, `creditos-deudas-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredObligations.length}
      />

      {sharedObligationsQuery.isLoading ? (
        <SurfaceCard
          description="Estamos revisando si otros usuarios te compartieron registros para seguimiento."
          title="Compartidos contigo"
        >
          <DataState
            description="Cargando creditos y deudas compartidos en modo solo lectura."
            title="Buscando accesos compartidos"
          />
        </SurfaceCard>
      ) : sharedObligationsQuery.error ? (
        <SurfaceCard
          description="Intentamos leer los accesos compartidos aceptados por tu cuenta."
          title="Compartidos contigo"
        >
          <DataState
            description={getQueryErrorMessage(
              sharedObligationsQuery.error,
              "No pudimos abrir los registros compartidos contigo.",
            )}
            title="No pudimos cargar lo compartido"
            tone="error"
            action={<Button onClick={() => { void sharedObligationsQuery.refetch(); }}>Reintentar</Button>}
          />
        </SurfaceCard>
      ) : filteredSharedObligations.length > 0 ? (
        <SharedObligationsSection
          obligations={filteredSharedObligations}
          onAnalytics={setAnalyticsSharedObligationId}
          onOpenDetail={openSharedDetail}
          onRemove={setUnlinkSharedTarget}
          viewMode="table"
        />
      ) : null}

      {sharedDetailObligation ? (
        <SharedObligationDetailDialog
          focusEventId={notificationEventId}
          accounts={accounts}
          eventRequests={viewerEventRequestsQuery.data ?? new Map()}
          feedback={sharedDetailFeedback}
          formState={sharedRequestFormState}
          isLinking={
            linkEventToAccountMutation.isPending || deleteViewerEventLinkMutation.isPending
          }
          isSendingEventRequest={
            createEventDeleteRequestMutation.isPending || createEventEditRequestMutation.isPending
          }
          isSendingRequest={createPaymentRequestMutation.isPending}
          obligation={sharedDetailObligation}
          onClose={() => { setSharedDetailId(null); setNotificationEventId(null); }}
          onLinkEvent={handleLinkSharedEvent}
          onRequestEventDelete={handleRequestEventDelete}
          onRequestEventEdit={handleRequestEventEdit}
          onSubmitRequest={handleSubmitSharedRequest}
          onUnlinkEvent={handleUnlinkSharedEvent}
          requests={viewerPaymentRequestsQuery.data ?? []}
          updateFormState={updateSharedRequestFormState}
          viewerLinks={viewerEventLinksQuery.data ?? []}
        />
      ) : null}

      {unlinkSharedTarget ? <DeleteConfirmDialog badge="Quitar de mi lista" description={`Dejarás de ver “${unlinkSharedTarget.title}”. El registro sigue perteneciendo a ${unlinkSharedTarget.share.ownerDisplayName ?? "la otra persona"}.`} isDeleting={unlinkShareMutation.isPending} onCancel={() => { if (!unlinkShareMutation.isPending) setUnlinkSharedTarget(null); }} onConfirm={() => void handleUnlinkSharedObligation()}><p className="font-semibold text-ink">Esta acción no elimina el crédito ni su historial.</p></DeleteConfirmDialog> : null}

      {isEditorOpen ? (
        <EditorDialog
          accounts={accounts}
          accessMessage={accessMessage}
          attachments={selectedObligationAttachments}
          baseCurrencyCode={baseCurrencyCode}
          canManageReceipts={canUploadReceipts}
          canShareObligations={canAccessProFeatures}
          clearFieldError={clearFieldError}
          closeEditor={requestCloseEditor}
          counterparties={counterparties}
          currentShare={selectedObligation ? shareByObligationId.get(selectedObligation.id) ?? null : null}
          feedback={editorFeedback}
          formState={formState}
          handleDeleteReceipt={handleDeleteReceipt}
          handleUploadReceipt={handleUploadReceipt}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSavingEditor}
          isUploadingReceipt={isUploadingReceipt}
          onDeleteEvent={(event) => {
            if (selectedObligation) {
              setEventDeleteTarget({ obligationId: selectedObligation.id, event });
            }
          }}
          onEditEvent={(event) => {
            if (selectedObligation) {
              closeEditorDialog();
              openPaymentEditDialog(selectedObligation, event);
            }
          }}
          onSubmit={handleSubmitObligation}
          pendingReceiptFile={pendingReceiptFile}
          shareAccessMessage={genericAccessMessage}
          shareFormState={createShareFormState}
          selectedObligation={selectedObligation}
          updatePendingReceiptFile={setPendingReceiptFile}
          updateShareFormState={updateCreateShareFormState}
          updateFormState={updateFormState}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditorDialog(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {paymentTarget ? (
        <PaymentDialog
          accessMessage={accessMessage}
          accounts={accounts}
          attachments={paymentEventAttachmentsQuery.data ?? []}
          canManageReceipts={canUploadReceipts}
          editEventAmount={
            paymentEditEventId === null
              ? null
              : paymentTarget.events.find((event) => event.id === paymentEditEventId)?.amount ?? null
          }
          feedback={paymentFeedback}
          formState={paymentFormState}
          isEditMode={paymentEditEventId !== null}
          isSaving={isRegisteringPayment}
          isUploadingReceipt={isUploadingReceipt}
          obligation={paymentTarget}
          onCancel={() => {
            if (!isRegisteringPayment) {
              setPaymentTargetId(null);
              setPaymentEditEventId(null);
              setPendingPaymentReceiptFile(null);
            }
          }}
          onDeleteReceipt={handleDeletePaymentReceipt}
          onSubmit={handleSubmitPayment}
          onUploadReceipt={handleUploadPaymentReceipt}
          pendingReceiptFile={pendingPaymentReceiptFile}
          updateFormState={updatePaymentFormState}
          updatePendingReceiptFile={setPendingPaymentReceiptFile}
        />
      ) : null}

      {principalAdjustmentTarget ? (
        <UnifiedPrincipalAdjustmentDialog
          accounts={accounts}
          feedback={principalAdjustmentFeedback}
          formState={principalAdjustmentFormState}
          editEventAmount={principalAdjustmentEditEventId === null ? 0 : principalAdjustmentTarget.events.find((event) => event.id === principalAdjustmentEditEventId)?.amount ?? 0}
          isEditMode={principalAdjustmentEditEventId !== null}
          isSaving={isAdjustingPrincipal}
          mode={principalAdjustmentMode}
          obligation={principalAdjustmentTarget}
          onCancel={() => {
            if (!isAdjustingPrincipal) {
              setPrincipalAdjustmentTargetId(null);
              setPrincipalAdjustmentEditEventId(null);
            }
          }}
          onModeChange={setPrincipalAdjustmentMode}
          onSubmit={handleSubmitPrincipalAdjustment}
          updateFormState={updatePrincipalAdjustmentFormState}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          badge="Eliminar registro"
          description="Esto elimina el credito o deuda junto con su historial de eventos. Si tiene movimientos financieros vinculados, primero tendras que resolverlos."
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteTargetId(null);
            }
          }}
          onConfirm={() => {
            void handleDelete();
          }}
        >
          {(() => {
            const visual = getDirectionVisual(deleteTarget.direction);
            const Icon = visual.icon;
            return (
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 text-white"
                  style={{ background: `linear-gradient(160deg, ${visual.color}, rgba(8,13,20,0.72))` }}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-ink">{deleteTarget.title}</p>
                  <p className="mt-1 text-sm text-storm">{deleteTarget.counterparty}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                      {getDirectionLabel(deleteTarget.direction)}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-storm">
                      {formatCurrency(deleteTarget.pendingAmount, deleteTarget.currencyCode)} pendientes
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-storm">
                      {deleteTarget.events.length} eventos
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </DeleteConfirmDialog>
      ) : null}

      {eventDeleteTarget ? (
        <DeleteConfirmDialog
          badge={eventDeleteTarget.event.eventType === "payment" ? "Eliminar abono" : "Eliminar ajuste"}
          description={
            eventDeleteTarget.event.movementId
              ? "Se recalculará el registro y también se borrará el movimiento asociado."
              : "Se recalcularán el principal y el saldo pendiente del registro."
          }
          isDeleting={eventDeleteMutation.isPending}
          onCancel={() => {
            if (!eventDeleteMutation.isPending) {
              setEventDeleteTarget(null);
            }
          }}
          onConfirm={() => {
            void handleConfirmDeleteEvent();
          }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.05] text-lg">
              {getEventIcon(eventDeleteTarget.event.eventType)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold text-ink">
                {formatCurrency(
                  eventDeleteTarget.event.amount,
                  obligations.find((item) => item.id === eventDeleteTarget.obligationId)
                    ?.currencyCode ?? baseCurrencyCode,
                )}
              </p>
              <p className="mt-1 text-sm text-storm">
                {formatDate(eventDeleteTarget.event.eventDate)}
                {eventDeleteTarget.event.installmentNo
                  ? ` · cuota #${eventDeleteTarget.event.installmentNo}`
                  : ""}
              </p>
              {eventDeleteTarget.event.description ? (
                <p className="mt-3 text-sm text-storm">{eventDeleteTarget.event.description}</p>
              ) : null}
            </div>
          </div>
        </DeleteConfirmDialog>
      ) : null}

      {shareTarget ? (
        <ShareInviteDialog
          currentShare={shareByObligationId.get(shareTarget.id) ?? null}
          feedback={shareDialogFeedback}
          formState={shareDialogFormState}
          isSaving={isSendingShareInvite}
          isUnlinkingShare={unlinkShareMutation.isPending}
          obligation={shareTarget}
          onCancel={() => {
            if (!isSendingShareInvite) {
              setShareTargetId(null);
            }
          }}
          onSubmit={handleSubmitShareInvite}
          onUnlinkShare={() => handleUnlinkShare(shareTarget.id)}
          updateFormState={updateShareDialogFormState}
        />
      ) : null}

      {showBulkDeleteConfirm ? (
        <div
          aria-labelledby="obl-bulk-title"
          aria-modal="true"
          className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d1520] p-6">
            <h2 className="font-display text-xl font-semibold text-ink" id="obl-bulk-title">
              Eliminar {selectedCount} registro{selectedCount !== 1 ? "s" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Se eliminarán {selectedDeletableCount} sin movimientos. {selectedCount - selectedDeletableCount > 0 ? `${selectedCount - selectedDeletableCount} con eventos se conservarán y puedes archivarlos.` : "Esta acción no se puede deshacer."}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={isBulkDeleting || selectedDeletableCount === 0} onClick={() => void confirmBulkDelete()}>
                {isBulkDeleting ? "Eliminando..." : `Eliminar ${selectedDeletableCount}`}
              </Button>
              <Button disabled={isBulkDeleting} onClick={() => setShowBulkDeleteConfirm(false)} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
