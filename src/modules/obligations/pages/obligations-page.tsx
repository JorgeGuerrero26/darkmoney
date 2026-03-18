import {
  ArrowDownCircle,
  ArrowUpCircle,
  Check,
  ChevronDown,
  CircleDollarSign,
  Download,
  Eye,
  Landmark,
  LoaderCircle,
  Lock,
  MailPlus,
  Minus,
  PencilLine,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { DataState } from "../../../components/ui/data-state";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { ProgressBar } from "../../../components/ui/progress-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, SelectionCheckbox, useSelection, createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { getPublicAppUrl } from "../../../lib/app-url";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  AttachmentSummary,
  CounterpartySummary,
  ObligationDirection,
  ObligationShareSummary,
  ObligationOriginType,
  ObligationStatus,
  ObligationSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { AttachmentGallery } from "../../attachments/components/attachment-gallery";
import { PendingReceiptField } from "../../attachments/components/pending-receipt-field";
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
  type ObligationFormInput,
  type ObligationShareInviteInput,
  type ObligationPrincipalAdjustmentFormInput,
  type ObligationPaymentFormInput,
  useAdjustObligationPrincipalMutation,
  useCreateObligationMutation,
  useDeleteObligationMutation,
  useEntityAttachmentsQuery,
  useObligationSharesQuery,
  useRegisterObligationPaymentMutation,
  useSharedObligationsQuery,
  useUpdateObligationMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

type EditorMode = "create" | "edit";
type OpeningImpact = "none" | "outflow" | "inflow";

type ObligationFormState = {
  direction: ObligationDirection;
  originType: ObligationOriginType;
  manualOpeningImpact: OpeningImpact;
  status: ObligationStatus;
  title: string;
  counterpartyId: string;
  openingAccountId: string;
  settlementAccountId: string;
  currencyCode: string;
  principalAmount: string;
  startDate: string;
  dueDate: string;
  installmentAmount: string;
  installmentCount: string;
  interestRate: string;
  description: string;
  notes: string;
};

type PaymentFormState = {
  amount: string;
  eventDate: string;
  installmentNo: string;
  description: string;
  notes: string;
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

type ShareInviteFormState = {
  invitedEmail: string;
  message: string;
};

type FeedbackState = {
  tone: "success" | "error";
  title: string;
  description: string;
};

type DirectionFilterValue = "all" | ObligationDirection;
type StatusFilterValue = "all" | ObligationStatus;

type PickerOption = {
  value: string;
  label: string;
  description: string;
  leadingLabel: string;
  leadingColor?: string;
  searchText?: string;
};

type PickerProps = {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholderLabel: string;
  placeholderDescription: string;
  queryPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
};

const directionOptions = [
  {
    value: "receivable" as const,
    label: "Credito",
    description: "Dinero que te deben.",
    leadingLabel: "CR",
    leadingColor: "#1b6a58",
  },
  {
    value: "payable" as const,
    label: "Deuda",
    description: "Dinero que debes pagar.",
    leadingLabel: "DE",
    leadingColor: "#8f3e3e",
  },
] as const;

const receivableOriginTypeOptions = [
  {
    value: "cash_loan" as const,
    label: "Preste dinero",
    description: "Tu entregaste dinero y nacio una cuenta por cobrar.",
    leadingLabel: "PD",
    leadingColor: "#4566d6",
  },
  {
    value: "sale_financed" as const,
    label: "Vendi a cuotas",
    description: "Te deben dinero, pero no salio efectivo de tu cuenta al inicio.",
    leadingLabel: "VF",
    leadingColor: "#1b6a58",
  },
  {
    value: "manual" as const,
    label: "Manual",
    description: "Define el caso manualmente si no encaja en los escenarios comunes.",
    leadingLabel: "MN",
    leadingColor: "#6b7280",
  },
] as const;

const payableOriginTypeOptions = [
  {
    value: "cash_loan" as const,
    label: "Me prestaron dinero",
    description: "Recibiste dinero y nacio una deuda a pagar.",
    leadingLabel: "MP",
    leadingColor: "#4566d6",
  },
  {
    value: "purchase_financed" as const,
    label: "Compre a cuotas",
    description: "La deuda nace sin entrada de efectivo a tu cuenta.",
    leadingLabel: "CQ",
    leadingColor: "#c46a31",
  },
  {
    value: "manual" as const,
    label: "Manual",
    description: "Define el caso manualmente si no encaja en los escenarios comunes.",
    leadingLabel: "MN",
    leadingColor: "#6b7280",
  },
] as const;

const manualOpeningImpactOptions = [
  {
    value: "none" as const,
    label: "Sin impacto inicial",
    description: "El saldo nace sin mover dinero de una cuenta al crear el registro.",
    leadingLabel: "SI",
    leadingColor: "#6b7280",
  },
  {
    value: "outflow" as const,
    label: "Sale dinero de mi cuenta",
    description: "Se registrara una salida inicial desde una cuenta tuya.",
    leadingLabel: "SA",
    leadingColor: "#8f3e3e",
  },
  {
    value: "inflow" as const,
    label: "Entra dinero a mi cuenta",
    description: "Se registrara un ingreso inicial hacia una cuenta tuya.",
    leadingLabel: "EN",
    leadingColor: "#1b6a58",
  },
] as const;

const statusOptions = [
  {
    value: "draft" as const,
    label: "Borrador",
    description: "Aun no esta en seguimiento activo.",
    leadingLabel: "BD",
    leadingColor: "#6b7280",
  },
  {
    value: "active" as const,
    label: "Activa",
    description: "Sigue pendiente de resolverse.",
    leadingLabel: "AC",
    leadingColor: "#4566d6",
  },
  {
    value: "paid" as const,
    label: "Liquidada",
    description: "Ya quedo saldada por completo.",
    leadingLabel: "LD",
    leadingColor: "#1b6a58",
  },
  {
    value: "cancelled" as const,
    label: "Cancelada",
    description: "Se cerro sin continuar.",
    leadingLabel: "CA",
    leadingColor: "#64748b",
  },
  {
    value: "defaulted" as const,
    label: "Atrasada",
    description: "Necesita atencion por mora o retraso.",
    leadingLabel: "AT",
    leadingColor: "#b48b34",
  },
] as const;

const currencyOptions = [
  { code: "PEN", label: "Sol peruano", region: "Peru", symbol: "S/" },
  { code: "USD", label: "Dolar estadounidense", region: "Estados Unidos", symbol: "$" },
  { code: "EUR", label: "Euro", region: "Union Europea", symbol: "EUR" },
  { code: "BRL", label: "Real brasileno", region: "Brasil", symbol: "R$" },
  { code: "MXN", label: "Peso mexicano", region: "Mexico", symbol: "MXN" },
  { code: "CLP", label: "Peso chileno", region: "Chile", symbol: "CLP" },
] as const;

const fieldClassName =
  "w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)] disabled:cursor-not-allowed disabled:opacity-60";
const inputClassName = `${fieldClassName} h-16`;
const textareaClassName = `${fieldClassName} min-h-[140px] py-4 leading-7`;
const panelClassName =
  "glass-panel-soft relative overflow-visible rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6";
const labelClassName =
  "text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80";

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

  const parsedValue = Number(normalizedValue);
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
    interestRate:
      obligation.interestRate === null || obligation.interestRate === undefined
        ? ""
        : String(obligation.interestRate),
    description: obligation.description ?? "",
    notes: obligation.notes ?? "",
  };
}

function createDefaultPaymentFormState(obligation: ObligationSummary): PaymentFormState {
  const suggestedAmount = obligation.installmentAmount
    ? Math.min(obligation.installmentAmount, obligation.pendingAmount)
    : obligation.pendingAmount;

  return {
    amount: suggestedAmount > 0 ? String(Number(suggestedAmount.toFixed(2))) : "",
    eventDate: toDateInputValue(new Date().toISOString()),
    installmentNo:
      obligation.installmentCount && obligation.installmentCount > 0
        ? String(Math.min(obligation.paymentCount + 1, obligation.installmentCount))
        : "",
    description: "",
    notes: "",
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

function getDirectionOption(direction: ObligationDirection) {
  return directionOptions.find((option) => option.value === direction) ?? directionOptions[0];
}

function getOriginTypeOptions(direction: ObligationDirection) {
  return direction === "receivable" ? receivableOriginTypeOptions : payableOriginTypeOptions;
}

function normalizeOriginTypeForDirection(
  direction: ObligationDirection,
  originType: ObligationOriginType,
): ObligationOriginType {
  if (direction === "receivable" && originType === "purchase_financed") {
    return "sale_financed";
  }

  if (direction === "payable" && originType === "sale_financed") {
    return "purchase_financed";
  }

  return originType;
}

function getOpeningImpact(
  direction: ObligationDirection,
  originType: ObligationOriginType,
  manualOpeningImpact: OpeningImpact,
): OpeningImpact {
  if (originType === "cash_loan") {
    return direction === "receivable" ? "outflow" : "inflow";
  }

  if (originType === "sale_financed" || originType === "purchase_financed") {
    return "none";
  }

  return manualOpeningImpact;
}

function getOpeningImpactMeta(
  direction: ObligationDirection,
  originType: ObligationOriginType,
  manualOpeningImpact: OpeningImpact,
) {
  const openingImpact = getOpeningImpact(direction, originType, manualOpeningImpact);

  if (originType === "cash_loan") {
    return direction === "receivable"
      ? {
          impact: openingImpact,
          label: "Sale dinero al crear",
          description: "Se registrara una salida inicial desde tu cuenta en la fecha de inicio.",
          requiresAccount: true,
        }
      : {
          impact: openingImpact,
          label: "Entra dinero al crear",
          description: "Se registrara un ingreso inicial hacia tu cuenta en la fecha de inicio.",
          requiresAccount: true,
        };
  }

  if (originType === "sale_financed") {
    return {
      impact: openingImpact,
      label: "Sin impacto inicial",
      description: "El dinero entrara recien cuando registres los abonos posteriores.",
      requiresAccount: false,
    };
  }

  if (originType === "purchase_financed") {
    return {
      impact: openingImpact,
      label: "Sin impacto inicial",
      description: "La deuda se crea sin mover saldo en una cuenta al inicio.",
      requiresAccount: false,
    };
  }

  const selectedOption =
    manualOpeningImpactOptions.find((option) => option.value === openingImpact) ??
    manualOpeningImpactOptions[0];

  return {
    impact: openingImpact,
    label: selectedOption.label,
    description: selectedOption.description,
    requiresAccount: openingImpact !== "none",
  };
}

function applyObligationFormRules(formState: ObligationFormState): ObligationFormState {
  const normalizedOriginType = normalizeOriginTypeForDirection(formState.direction, formState.originType);
  const openingImpact = getOpeningImpact(
    formState.direction,
    normalizedOriginType,
    formState.manualOpeningImpact,
  );

  return {
    ...formState,
    originType: normalizedOriginType,
    openingAccountId: openingImpact === "none" ? "" : formState.openingAccountId,
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

function getSharedDirectionLabel(direction: ObligationDirection) {
  return direction === "receivable" ? "Credito compartido" : "Deuda compartida";
}

function getSharedDirectionDescription(direction: ObligationDirection) {
  return direction === "receivable"
    ? "Al propietario de este registro aun le deben pagar."
    : "El propietario de este registro aun debe pagar.";
}

function getDirectionTone(direction: ObligationDirection) {
  return direction === "receivable" ? "success" : "danger";
}

function getStatusTone(status: ObligationStatus) {
  switch (status) {
    case "paid":
      return "success" as const;
    case "active":
      return "info" as const;
    case "defaulted":
      return "warning" as const;
    default:
      return "neutral" as const;
  }
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

function getCurrencyLabel(currencyCode: string) {
  return (
    currencyOptions.find((option) => option.code === currencyCode.toUpperCase()) ?? {
      code: currencyCode.toUpperCase(),
      label: "Moneda registrada",
      region: "Configurada en tu base",
      symbol: currencyCode.toUpperCase(),
    }
  );
}

function getEventLabel(eventType: ObligationSummary["events"][number]["eventType"]) {
  switch (eventType) {
    case "payment":
      return "Abono";
    case "opening":
      return "Apertura";
    case "principal_increase":
      return "Aumento de principal";
    case "principal_decrease":
      return "Reduccion de principal";
    case "interest":
      return "Interes";
    case "fee":
      return "Cargo";
    case "discount":
      return "Descuento";
    case "adjustment":
      return "Ajuste";
    case "writeoff":
      return "Condonacion";
    default:
      return "Evento";
  }
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

function usePickerPanel(isOpen: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isOpen, onClose]);

  return containerRef;
}

function Picker({
  disabled = false,
  emptyMessage,
  onChange,
  options,
  placeholderDescription,
  placeholderLabel,
  queryPlaceholder,
  value,
}: PickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = usePickerPanel(isOpen, () => setIsOpen(false));
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) =>
      (option.searchText ?? `${option.label} ${option.description} ${option.leadingLabel}`)
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [options, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  return (
    <div
      className={`relative ${isOpen ? "z-50" : "z-10"}`}
      ref={containerRef}
    >
      <button
        className={`${fieldClassName} flex min-h-[5.25rem] items-start justify-between gap-3 py-3.5 text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-10 min-w-[3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
            style={{
              backgroundColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}22` : undefined,
              borderColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}55` : undefined,
              color: selectedOption?.leadingColor ? "#fff" : undefined,
            }}
          >
            {selectedOption?.leadingLabel ?? "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block whitespace-normal text-sm font-semibold leading-6 text-ink">
              {selectedOption ? selectedOption.label : placeholderLabel}
            </span>
            <span className="mt-1 block whitespace-normal text-xs leading-5 text-storm">
              {selectedOption ? selectedOption.description : placeholderDescription}
            </span>
          </span>
        </span>
        <ChevronDown className={`mt-2 h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-[30px] border border-white/10 bg-[#09111c]/98 p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <input
              autoFocus
              className="w-full rounded-[22px] border border-white/10 bg-[#101928] py-3.5 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
              onChange={(event) => setQuery(event.target.value)}
              placeholder={queryPlaceholder}
              type="text"
              value={query}
            />
          </div>

          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    className="flex w-full items-start justify-between gap-3 rounded-[24px] border border-white/5 bg-[#0d1623] px-4 py-3.5 text-left transition duration-200 hover:border-white/12"
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span
                        className="mt-0.5 flex h-11 min-w-[3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
                        style={{
                          backgroundColor: option.leadingColor ? `${option.leadingColor}22` : undefined,
                          borderColor: option.leadingColor ? `${option.leadingColor}55` : undefined,
                          color: option.leadingColor ? "#fff" : undefined,
                        }}
                      >
                        {option.leadingLabel}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block whitespace-normal font-medium leading-6 text-ink">
                          {option.label}
                        </span>
                        <span className="mt-1 block whitespace-normal text-xs leading-5 text-storm">
                          {option.description}
                        </span>
                      </span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-pine" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-white/8 bg-[#0d1623] px-4 py-5 text-sm text-storm">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Field({ children, errorKey, hint, invalidFields, label }: { children: ReactNode; errorKey?: string; hint?: string; invalidFields?: Set<string>; label: string }) {
  const hasError = !!errorKey && !!invalidFields?.has(errorKey);
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <div
        className={`mt-3${hasError ? " field-error-ring" : ""}`}
        data-field={errorKey}
      >
        {children}
      </div>
      {hint ? <p className="mt-2 text-xs leading-6 text-storm/75">{hint}</p> : null}
    </label>
  );
}

function Input({
  className = "",
  max,
  min,
  step,
  type,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const resolvedType = type === "number" ? "text" : type;

  return (
    <input
      className={`${inputClassName} ${className}`}
      max={resolvedType === "text" ? undefined : max}
      min={resolvedType === "text" ? undefined : min}
      step={resolvedType === "text" ? undefined : step}
      type={resolvedType}
      {...props}
    />
  );
}

function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${textareaClassName} ${className}`}
      {...props}
    />
  );
}


function PaymentDialog({
  feedback,
  formState,
  isSaving,
  obligation,
  onCancel,
  onSubmit,
  updateFormState,
}: {
  feedback: FeedbackState | null;
  formState: PaymentFormState;
  isSaving: boolean;
  obligation: ObligationSummary;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateFormState: <Field extends keyof PaymentFormState>(
    field: Field,
    value: PaymentFormState[Field],
  ) => void;
}) {
  const projectedPending = Math.max(0, obligation.pendingAmount - (parseOptionalNumber(formState.amount) ?? 0));
  const directionOption = getDirectionOption(obligation.direction);

  return (
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-[#02060d]/82 p-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#02060d]/68 before:backdrop-blur-2xl before:content-[''] sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[880px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]">
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
                      Registrar abono
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      {directionOption.label}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.5rem]">
                    Actualiza el avance del registro
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-9 text-storm">
                    Registra un abono puntual para actualizar el saldo pendiente y el historial de
                    esta relacion financiera.
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

              <div className="mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
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
                        Pendiente actual
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(obligation.pendingAmount, obligation.currencyCode)}
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
            </div>

            <div className="border-t border-white/10 bg-black/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  El saldo pendiente y el porcentaje de avance se actualizan al instante.
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
                        Guardando...
                      </>
                    ) : (
                      <>
                        <CircleDollarSign className="mr-2 h-4 w-4" />
                        Registrar abono
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

function PrincipalAdjustmentDialog({
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
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-[#02060d]/82 p-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#02060d]/68 before:backdrop-blur-2xl before:content-[''] sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[980px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]">
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

function ShareInviteDialog({
  currentShare,
  feedback,
  formState,
  isSaving,
  obligation,
  onCancel,
  onSubmit,
  updateFormState,
}: {
  currentShare?: ObligationShareSummary | null;
  feedback: FeedbackState | null;
  formState: ShareInviteFormState;
  isSaving: boolean;
  obligation: ObligationSummary;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateFormState: <Field extends keyof ShareInviteFormState>(
    field: Field,
    value: ShareInviteFormState[Field],
  ) => void;
}) {
  const shareStateLabel = currentShare ? getShareStatusLabel(currentShare.status) : "Sin invitacion activa";

  return (
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-[#02060d]/82 p-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#02060d]/68 before:backdrop-blur-2xl before:content-[''] sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[920px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]">
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
                    La persona recibira un correo para aceptar el acceso. Cuando confirme, vera
                    este credito o deuda dentro de su modulo, con historial, saldo pendiente y
                    progreso, pero sin poder editarlo. Solo una persona puede quedar asociada a la
                    vez.
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
                  El usuario invitado no necesita Modo Pro para ver el registro compartido. Solo
                  necesita aceptar el acceso desde el correo.
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
                        Enviando...
                      </>
                    ) : (
                      <>
                        <MailPlus className="mr-2 h-4 w-4" />
                        Enviar invitacion
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

function EditorDialog({
  accounts,
  accessMessage,
  attachments,
  baseCurrencyCode,
  canManageReceipts,
  canShareObligations,
  clearFieldError,
  closeEditor,
  counterparties,
  currentShare,
  feedback,
  formState,
  handleDeleteReceipt,
  handleUploadReceipt,
  invalidFields,
  isCreateMode,
  isSaving,
  isUploadingReceipt,
  onSubmit,
  pendingReceiptFile,
  shareAccessMessage,
  shareFormState,
  selectedObligation,
  updatePendingReceiptFile,
  updateShareFormState,
  updateFormState,
}: {
  accounts: AccountSummary[];
  accessMessage: string;
  attachments: AttachmentSummary[];
  baseCurrencyCode: string;
  canManageReceipts: boolean;
  canShareObligations: boolean;
  closeEditor: () => void;
  counterparties: CounterpartySummary[];
  currentShare: ObligationShareSummary | null;
  feedback: FeedbackState | null;
  formState: ObligationFormState;
  handleDeleteReceipt: (attachment: AttachmentSummary) => Promise<void>;
  handleUploadReceipt: (file: File) => Promise<void>;
  isCreateMode: boolean;
  isSaving: boolean;
  isUploadingReceipt: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  invalidFields: Set<string>;
  clearFieldError: (field: string) => void;
  pendingReceiptFile: File | null;
  shareAccessMessage: string;
  shareFormState: ShareInviteFormState;
  selectedObligation: ObligationSummary | null;
  updatePendingReceiptFile: (file: File | null) => void;
  updateShareFormState: <Field extends keyof ShareInviteFormState>(
    field: Field,
    value: ShareInviteFormState[Field],
  ) => void;
  updateFormState: <Field extends keyof ObligationFormState>(
    field: Field,
    value: ObligationFormState[Field],
  ) => void;
}) {
  useEffect(() => {
    if (invalidFields.size === 0) return;
    const firstField = [...invalidFields][0];
    const firstEl = document.querySelector<HTMLElement>(`[data-field="${firstField}"]`);
    if (firstEl) {
      firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        firstEl.querySelector<HTMLElement>("input,button,[tabindex='0']")?.focus();
      }, 300);
    }
    invalidFields.forEach((field) => {
      const el = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
      if (!el) return;
      el.classList.remove("field-error-shake");
      void el.offsetWidth;
      el.classList.add("field-error-shake");
    });
  }, [invalidFields]);

  const title = formState.title.trim() || "Nuevo registro";
  const principalAmount = parseOptionalNumber(formState.principalAmount) ?? 0;
  const selectedCounterparty = counterparties.find(
    (counterparty) => String(counterparty.id) === formState.counterpartyId,
  );
  const selectedOpeningAccount = accounts.find((account) => String(account.id) === formState.openingAccountId);
  const directionOption = getDirectionOption(formState.direction);
  const originOption = getOriginOption(formState.originType, formState.direction);
  const originTypeOptions = getOriginTypeOptions(formState.direction);
  const directionVisual = getDirectionVisual(formState.direction);
  const DirectionIcon = directionVisual.icon;
  const currencyLabel = getCurrencyLabel(formState.currencyCode || baseCurrencyCode);
  const openingImpactMeta = getOpeningImpactMeta(
    formState.direction,
    formState.originType,
    formState.manualOpeningImpact,
  );
  const shareStateLabel = currentShare ? getShareStatusLabel(currentShare.status) : "Sin usuario asociado";
  const counterpartyOptions = counterparties
    .filter((counterparty) => !counterparty.isArchived || String(counterparty.id) === formState.counterpartyId)
    .map<PickerOption>((counterparty) => ({
      value: String(counterparty.id),
      label: counterparty.name,
      description: counterparty.isArchived
        ? "Archivada, pero disponible para este registro."
        : `Tipo ${counterparty.type}.`,
      leadingLabel: counterparty.name.slice(0, 2).toUpperCase(),
      leadingColor:
        counterparty.type === "bank"
          ? "#1b6a58"
          : counterparty.type === "company"
            ? "#4566d6"
            : counterparty.type === "merchant"
              ? "#c46a31"
              : "#6b7280",
      searchText: `${counterparty.name} ${counterparty.type}`,
    }));
  const settlementAccountOptions = accounts
    .filter((account) => !account.isArchived || String(account.id) === formState.settlementAccountId)
    .map<PickerOption>((account) => ({
      value: String(account.id),
      label: account.name,
      description: `${account.type} - ${account.currencyCode}`,
      leadingLabel: account.currencyCode,
      leadingColor: account.color,
      searchText: `${account.name} ${account.type} ${account.currencyCode}`,
    }));
  const openingAccountOptions = accounts
    .filter(
      (account) =>
        (!account.isArchived || String(account.id) === formState.openingAccountId) &&
        account.currencyCode === currencyLabel.code,
    )
    .map<PickerOption>((account) => ({
      value: String(account.id),
      label: account.name,
      description: `${account.type} - ${account.currencyCode}`,
      leadingLabel: account.currencyCode,
      leadingColor: account.color,
      searchText: `${account.name} ${account.type} ${account.currencyCode}`,
    }));
  const currencyPickerOptions = currencyOptions.map<PickerOption>((option) => ({
    value: option.code,
    label: option.code,
    description: `${option.label} - ${option.region}`,
    leadingLabel: option.symbol,
    leadingColor: "#4566d6",
    searchText: `${option.code} ${option.label} ${option.region}`,
  }));

  return (
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-[#02060d]/82 p-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#02060d]/68 before:backdrop-blur-2xl before:content-[''] sm:p-6" onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }} onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) closeEditor(); }}>
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[1120px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
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
                      {isCreateMode ? "Nuevo registro" : "Editar registro"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      {isCreateMode ? "Se reflejara en tu cartera" : "Ajusta datos y seguimiento"}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.7rem]">
                    {isCreateMode ? "Crear credito o deuda" : "Actualizar credito o deuda"}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-9 text-storm">
                    Define el origen, la apertura y el seguimiento para que la cartera refleje
                    correctamente lo que entra, sale o queda pendiente desde el primer momento.
                  </p>
                </div>

                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
                  onClick={closeEditor}
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

              <div className="mt-7 rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,24,36,0.96),rgba(8,12,20,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 text-white"
                        style={{
                          background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))`,
                        }}
                      >
                        <DirectionIcon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                          Vista previa
                        </p>
                        <h3 className="mt-2 break-words font-display text-4xl font-semibold text-ink">
                          {title}
                        </h3>
                        <p className="mt-3 text-base leading-8 text-storm">
                          {selectedCounterparty?.name ?? "Selecciona la contraparte principal"}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                            {directionOption.label}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                            {originOption.label}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                            {openingImpactMeta.label}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                            {currencyLabel.code}
                          </span>
                        </div>
                        <p className="mt-4 text-sm leading-7 text-storm">
                          {openingImpactMeta.description}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Monto base
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(principalAmount, currencyLabel.code)}
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Apertura
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {openingImpactMeta.label}
                      </p>
                      <p className="mt-2 text-sm text-storm">
                        {openingImpactMeta.requiresAccount
                          ? selectedOpeningAccount?.name ?? "Selecciona la cuenta inicial"
                          : "No movera una cuenta al crearlo"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <div className={`${panelClassName} z-30`}>
                  <p className={labelClassName}>Identidad</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                    Base del registro
                  </h3>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <Field
                      hint={
                        isCreateMode
                          ? "Selecciona si te deben o tu debes."
                          : "La apertura original se define al crear el registro."
                      }
                      label="Tipo"
                    >
                      <Picker
                        disabled={!isCreateMode}
                        emptyMessage="No hay tipos disponibles."
                        onChange={(value) => updateFormState("direction", value as ObligationDirection)}
                        options={directionOptions.map((option) => ({
                          value: option.value,
                          label: option.label,
                          description: option.description,
                          leadingLabel: option.leadingLabel,
                          leadingColor: option.leadingColor,
                        }))}
                        placeholderDescription="Selecciona el tipo de registro."
                        placeholderLabel="Selecciona un tipo"
                        queryPlaceholder="Buscar tipo..."
                        value={formState.direction}
                      />
                    </Field>
                    <Field
                      hint={
                        isCreateMode
                          ? "Cambia automaticamente segun si es credito o deuda."
                          : "El origen inicial ya quedo definido para este registro."
                      }
                      label="Origen"
                    >
                      <Picker
                        disabled={!isCreateMode}
                        emptyMessage="No hay origenes disponibles."
                        onChange={(value) => updateFormState("originType", value as ObligationOriginType)}
                        options={originTypeOptions.map((option) => ({
                          value: option.value,
                          label: option.label,
                          description: option.description,
                          leadingLabel: option.leadingLabel,
                          leadingColor: option.leadingColor,
                        }))}
                        placeholderDescription="Selecciona el origen del registro."
                        placeholderLabel="Selecciona un origen"
                        queryPlaceholder="Buscar origen..."
                        value={formState.originType}
                      />
                    </Field>
                    <Field
                      errorKey="title"
                      hint="Usa un nombre corto y facil de reconocer."
                      invalidFields={invalidFields}
                      label="Titulo"
                    >
                      <Input
                        maxLength={120}
                        onChange={(event) => { clearFieldError("title"); updateFormState("title", event.target.value); }}
                        placeholder="Ej. Prestamo familiar marzo"
                        type="text"
                        value={formState.title}
                      />
                    </Field>
                    <Field
                      errorKey="counterpartyId"
                      hint="Persona, empresa o banco relacionado."
                      invalidFields={invalidFields}
                      label="Contraparte"
                    >
                      <Picker
                        disabled={counterpartyOptions.length === 0}
                        emptyMessage="No tienes contrapartes disponibles aun."
                        onChange={(value) => { clearFieldError("counterpartyId"); updateFormState("counterpartyId", value); }}
                        options={counterpartyOptions}
                        placeholderDescription="Selecciona la persona o entidad principal."
                        placeholderLabel="Selecciona una contraparte"
                        queryPlaceholder="Buscar contraparte..."
                        value={formState.counterpartyId}
                      />
                    </Field>
                  </div>
                </div>

                <div className={`${panelClassName} z-30`}>
                  <p className={labelClassName}>Monto y moneda</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                    Datos principales
                  </h3>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <Field
                      errorKey="principalAmount"
                      hint={
                        isCreateMode
                          ? "Monto base con el que nace el registro."
                          : "El monto de apertura ya fue definido al crear este registro."
                      }
                      invalidFields={invalidFields}
                      label="Principal"
                    >
                      <Input
                        disabled={!isCreateMode}
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => { clearFieldError("principalAmount"); updateFormState("principalAmount", event.target.value); }}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={formState.principalAmount}
                      />
                    </Field>
                    <Field
                      hint={
                        isCreateMode
                          ? "Se usa para mostrar montos, apertura y resumen."
                          : "La moneda de apertura no cambia desde este formulario."
                      }
                      label="Moneda"
                    >
                      <Picker
                        disabled={!isCreateMode}
                        emptyMessage="No hay monedas configuradas."
                        onChange={(value) => updateFormState("currencyCode", value)}
                        options={currencyPickerOptions}
                        placeholderDescription="Selecciona la moneda principal."
                        placeholderLabel="Selecciona una moneda"
                        queryPlaceholder="Buscar PEN, USD, EUR..."
                        value={formState.currencyCode}
                      />
                    </Field>
                    <Field
                      errorKey="startDate"
                      hint={
                        isCreateMode
                          ? "Fecha en la que comenzo la relacion."
                          : "La fecha de apertura ya fue registrada."
                      }
                      invalidFields={invalidFields}
                      label="Inicio"
                    >
                      <DatePickerField
                        disabled={!isCreateMode}
                        onChange={(nextValue) => { clearFieldError("startDate"); updateFormState("startDate", nextValue); }}
                        value={formState.startDate}
                      />
                    </Field>
                    <Field
                      hint="Opcional. Fecha objetivo de cierre."
                      label="Fecha objetivo"
                    >
                      <DatePickerField
                        onChange={(nextValue) => updateFormState("dueDate", nextValue)}
                        value={formState.dueDate}
                      />
                    </Field>
                    {formState.originType === "manual" && isCreateMode ? (
                      <Field
                        hint="Solo aparece en modo manual para definir si al crear entra, sale o no se mueve dinero."
                        label="Impacto inicial"
                      >
                        <Picker
                          emptyMessage="No hay opciones disponibles."
                          onChange={(value) => updateFormState("manualOpeningImpact", value as OpeningImpact)}
                          options={manualOpeningImpactOptions.map((option) => ({
                            value: option.value,
                            label: option.label,
                            description: option.description,
                            leadingLabel: option.leadingLabel,
                            leadingColor: option.leadingColor,
                          }))}
                          placeholderDescription="Define que pasa con una cuenta al inicio."
                          placeholderLabel="Selecciona un impacto"
                          queryPlaceholder="Buscar impacto..."
                          value={formState.manualOpeningImpact}
                        />
                      </Field>
                    ) : null}
                    {isCreateMode && openingImpactMeta.requiresAccount ? (
                      <Field
                        hint={`Solo muestra cuentas en ${currencyLabel.code} para que la apertura quede consistente.`}
                        label="Cuenta inicial"
                      >
                        <Picker
                          disabled={openingAccountOptions.length === 0}
                          emptyMessage={`No hay cuentas en ${currencyLabel.code} disponibles.`}
                          onChange={(value) => updateFormState("openingAccountId", value)}
                          options={openingAccountOptions}
                          placeholderDescription="Cuenta que recibira o entregara el monto inicial."
                          placeholderLabel="Selecciona una cuenta inicial"
                          queryPlaceholder="Buscar cuenta inicial..."
                          value={formState.openingAccountId}
                        />
                      </Field>
                    ) : null}
                    <Field
                      hint="Cuenta sugerida para registrar cobros o pagos."
                      label="Cuenta de liquidacion"
                    >
                      <Picker
                        emptyMessage="No hay cuentas disponibles."
                        onChange={(value) => updateFormState("settlementAccountId", value)}
                        options={settlementAccountOptions}
                        placeholderDescription="Puedes dejarlo libre por ahora."
                        placeholderLabel="Sin cuenta fija"
                        queryPlaceholder="Buscar cuenta..."
                        value={formState.settlementAccountId}
                      />
                    </Field>
                    {!isCreateMode ? (
                      <div className="rounded-[24px] border border-white/10 bg-black/15 p-4 text-sm leading-7 text-storm lg:col-span-2">
                        La apertura original ya quedo registrada. Desde aqui puedes actualizar
                        seguimiento, fechas, cuenta de liquidacion y contexto, sin reescribir el
                        movimiento inicial.
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={`${panelClassName} z-10`}>
                  <p className={labelClassName}>Plan</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                    Seguimiento esperado
                  </h3>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <Field
                      hint="Controla si sigue activa, cerrada o en espera."
                      label="Estado"
                    >
                      <Picker
                        emptyMessage="No hay estados disponibles."
                        onChange={(value) => updateFormState("status", value as ObligationStatus)}
                        options={statusOptions.map((option) => ({
                          value: option.value,
                          label: option.label,
                          description: option.description,
                          leadingLabel: option.leadingLabel,
                          leadingColor: option.leadingColor,
                        }))}
                        placeholderDescription="Selecciona el estado del registro."
                        placeholderLabel="Selecciona un estado"
                        queryPlaceholder="Buscar estado..."
                        value={formState.status}
                      />
                    </Field>
                    <Field
                      hint="Opcional. Monto de referencia por cuota."
                      label="Monto por cuota"
                    >
                      <Input
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => updateFormState("installmentAmount", event.target.value)}
                        placeholder="0.00"
                        step="0.01"
                        type="number"
                        value={formState.installmentAmount}
                      />
                    </Field>
                    <Field
                      hint="Opcional. Cantidad planificada de cuotas."
                      label="Numero de cuotas"
                    >
                      <Input
                        inputMode="numeric"
                        min="0"
                        onChange={(event) => updateFormState("installmentCount", event.target.value)}
                        placeholder="Ej. 12"
                        step="1"
                        type="number"
                        value={formState.installmentCount}
                      />
                    </Field>
                    <Field
                      hint="Opcional. Ingresa el porcentaje acordado."
                      label="Interes"
                    >
                      <Input
                        inputMode="decimal"
                        min="0"
                        onChange={(event) => updateFormState("interestRate", event.target.value)}
                        placeholder="Ej. 8.5"
                        step="0.0001"
                        type="number"
                        value={formState.interestRate}
                      />
                    </Field>
                  </div>
                </div>

                <div className={`${panelClassName} z-10`}>
                  <p className={labelClassName}>Contexto</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">
                    Descripcion y notas
                  </h3>
                  <div className="mt-6 space-y-5">
                    <Field
                      hint="Se ve como resumen dentro del registro."
                      label="Descripcion"
                    >
                      <Textarea
                        className="min-h-[120px]"
                        onChange={(event) => updateFormState("description", event.target.value)}
                        placeholder="Ej. Prestamo para compra de equipo de trabajo."
                        value={formState.description}
                      />
                    </Field>
                    <Field
                      hint="Solo para contexto interno."
                      label="Notas"
                    >
                      <Textarea
                        className="min-h-[120px]"
                        onChange={(event) => updateFormState("notes", event.target.value)}
                        placeholder="Ej. Acordado pagar los primeros dias de cada mes."
                        value={formState.notes}
                      />
                    </Field>

                    {isCreateMode ? (
                      <PendingReceiptField
                        canUpload={canManageReceipts}
                        description="Opcional. Puedes guardar una foto del pagare, contrato o comprobante de este registro."
                        file={pendingReceiptFile}
                        lockedMessage={accessMessage}
                        onChange={updatePendingReceiptFile}
                      />
                    ) : selectedObligation ? (
                      <AttachmentGallery
                        accessMessage={accessMessage}
                        attachments={attachments}
                        canManage={canManageReceipts}
                        entityLabel="credito o deuda"
                        isUploading={isUploadingReceipt}
                        onDelete={(attachment) => {
                          void handleDeleteReceipt(attachment);
                        }}
                        onUpload={(file) => {
                          void handleUploadReceipt(file);
                        }}
                      />
                    ) : null}

                    {canShareObligations ? (
                      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className={labelClassName}>Asignar a otro usuario</p>
                            <p className="mt-2 max-w-3xl text-sm leading-7 text-storm">
                              Opcional. Solo una persona puede quedar asociada a este registro a la
                              vez. Si guardas con otro correo, DarkMoney reemplazara a la persona
                              anterior y le enviara una nueva invitacion para verlo en modo solo
                              lectura.
                            </p>
                          </div>
                          <StatusBadge
                            status={shareStateLabel}
                            tone={currentShare ? getShareStatusTone(currentShare.status) : "neutral"}
                          />
                        </div>

                        {currentShare ? (
                          <div className="mt-4 rounded-[20px] border border-white/10 bg-black/15 p-4 text-sm leading-7 text-storm">
                            <p className="font-medium text-ink">
                              Actualmente esta asociado a{" "}
                              {currentShare.invitedDisplayName ?? currentShare.invitedEmail}.
                            </p>
                            <p className="mt-2">
                              Si mantienes este mismo correo, el acceso queda igual. Si escribes
                              otro y guardas, el anterior se reemplazara. Dejarlo vacio no elimina
                              el acceso actual.
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 rounded-[20px] border border-white/10 bg-black/15 p-4 text-sm leading-7 text-storm">
                            Aun no hay otra persona asociada a este credito o deuda.
                          </div>
                        )}

                        <div className="mt-5 grid gap-5 lg:grid-cols-2">
                          <Field
                            hint={
                              currentShare
                                ? "Escribe otro correo para reemplazar al usuario actual. Debe existir ya en DarkMoney."
                                : "Debe ser una cuenta ya registrada en DarkMoney."
                            }
                            label="Correo del usuario"
                          >
                            <Input
                              autoComplete="email"
                              onChange={(event) =>
                                updateShareFormState("invitedEmail", event.target.value)
                              }
                              placeholder="persona@correo.com"
                              type="email"
                              value={shareFormState.invitedEmail}
                            />
                          </Field>
                          <Field
                            hint={
                              currentShare
                                ? "Opcional. Si cambias el correo, este mensaje acompañara la nueva invitacion."
                                : "Opcional. Se manda junto con la invitacion."
                            }
                            label="Mensaje"
                          >
                            <Textarea
                              className="min-h-[120px]"
                              onChange={(event) =>
                                updateShareFormState("message", event.target.value)
                              }
                              placeholder="Ej. Te lo comparto para que puedas ver su avance desde tu cuenta."
                              value={shareFormState.message}
                            />
                          </Field>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[24px] border border-gold/15 bg-gold/[0.06] p-4 text-sm leading-7 text-storm">
                        {shareAccessMessage}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Historial de cambios (solo en modo edición) ── */}
            {!isCreateMode && selectedObligation && selectedObligation.events.length > 0 ? (
              <div className="border-t border-white/8 px-4 py-6 sm:px-6">
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/75">
                  Historial de cambios
                </p>
                <ol aria-label="Historial de cambios" className="mt-4 space-y-0">
                  {selectedObligation.events.map((ev, idx) => (
                    <li className="relative flex gap-4" key={ev.id}>
                      {/* Connector line */}
                      {idx < selectedObligation.events.length - 1 ? (
                        <div aria-hidden="true" className="absolute left-[17px] top-9 h-full w-px bg-white/8" />
                      ) : null}
                      {/* Icon dot */}
                      <div
                        aria-hidden="true"
                        className="relative z-10 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#080d14] text-sm"
                      >
                        {getEventIcon(ev.eventType)}
                      </div>
                      {/* Content */}
                      <div className="mb-5 min-w-0 flex-1 rounded-[18px] border border-white/8 bg-white/[0.025] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">
                              {getEventLabel(ev.eventType)}
                              {ev.installmentNo ? (
                                <span className="ml-2 text-xs text-storm/70">#{ev.installmentNo}</span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-xs text-storm">{formatDate(ev.eventDate)}</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-ink">
                            {formatCurrency(ev.amount, selectedObligation.currencyCode)}
                          </span>
                        </div>
                        {ev.reason ?? ev.description ? (
                          <p className="mt-2 text-xs leading-5 text-storm">{ev.reason ?? ev.description}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            <div className="border-t border-white/10 bg-black/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  {isCreateMode
                    ? openingImpactMeta.requiresAccount
                      ? "Al guardar, se creara el registro, su apertura y el movimiento inicial en la cuenta elegida."
                      : "Al guardar, se creara el registro con su apertura lista, sin mover una cuenta al inicio."
                    : "Los cambios actualizaran el seguimiento visible de inmediato, sin reescribir la apertura original."}
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button
                    disabled={isSaving}
                    onClick={closeEditor}
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
                        Guardando...
                      </>
                    ) : isCreateMode ? (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear registro
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Guardar cambios
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

export function ObligationsPage() {
  const { profile, user } = useAuth();
  const { accessMessage, canUploadReceipts } = useReceiptFeatureAccess();
  const { canAccessProFeatures, genericAccessMessage } = useProFeatureAccess();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const sharedObligationsQuery = useSharedObligationsQuery(user?.id);
  const obligationSharesQuery = useObligationSharesQuery(activeWorkspace?.id);
  const snapshot = snapshotQuery.data;
  const createMutation = useCreateObligationMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateObligationMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteObligationMutation(activeWorkspace?.id, user?.id);
  const paymentMutation = useRegisterObligationPaymentMutation(activeWorkspace?.id, user?.id);
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
  const obligationColumns: ColumnDef[] = [
    { key: "contraparte", label: "Contraparte" },
    { key: "direccion", label: "Direccion" },
    { key: "principal", label: "Principal" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-obligations", obligationColumns);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useViewMode("obligations");
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
  const [principalAdjustmentTargetId, setPrincipalAdjustmentTargetId] = useState<number | null>(null);
  const [principalAdjustmentMode, setPrincipalAdjustmentMode] = useState<PrincipalAdjustmentMode>("increase");
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
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
  const [searchValue, setSearchValue] = useState("");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilterValue>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");

  const obligations = snapshot?.obligations ?? [];
  const sharedObligations = sharedObligationsQuery.data ?? [];
  const obligationShares = obligationSharesQuery.data ?? [];
  const counterparties = snapshot?.catalogs.counterparties ?? [];
  const accounts = snapshot?.accounts ?? [];
  const baseCurrencyCode = snapshot?.workspace.baseCurrencyCode ?? activeWorkspace?.baseCurrencyCode ?? "USD";
  const selectedObligation =
    selectedObligationId === null
      ? null
      : obligations.find((obligation) => obligation.id === selectedObligationId) ?? null;
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
    setPaymentTargetId(obligation.id);
    setPaymentFormState(createDefaultPaymentFormState(obligation));
  }

  function openPrincipalAdjustmentDialog(
    obligation: ObligationSummary,
    mode: PrincipalAdjustmentMode,
  ) {
    setPageFeedback(null);
    setPrincipalAdjustmentFeedback(null);
    setPrincipalAdjustmentMode(mode);
    setPrincipalAdjustmentTargetId(obligation.id);
    setPrincipalAdjustmentFormState(createDefaultPrincipalAdjustmentFormState(obligation, mode));
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
  const isRegisteringPayment = paymentMutation.isPending;
  const isAdjustingPrincipal = principalAdjustmentMutation.isPending;
  const isSendingShareInvite = shareInviteMutation.isPending;
  const receivableObligations = obligations.filter((obligation) => obligation.direction === "receivable");
  const payableObligations = obligations.filter((obligation) => obligation.direction === "payable");
  const receivables = obligations.filter((obligation) => obligation.direction === "receivable").length;
  const payables = obligations.filter((obligation) => obligation.direction === "payable").length;
  const activeCount = obligations.filter((obligation) =>
    obligation.status === "draft" || obligation.status === "active" || obligation.status === "defaulted",
  ).length;
  const settledCount = obligations.filter((obligation) => obligation.status === "paid").length;
  const totalPrincipalDisplay = getObligationAmountDisplay(
    obligations,
    "principal",
    baseCurrencyCode,
  );
  const totalPendingDisplay = getObligationAmountDisplay(
    obligations,
    "pending",
    baseCurrencyCode,
  );
  const receivablePendingDisplay = getObligationAmountDisplay(
    receivableObligations,
    "pending",
    baseCurrencyCode,
  );
  const receivablePrincipalDisplay = getObligationAmountDisplay(
    receivableObligations,
    "principal",
    baseCurrencyCode,
  );
  const payablePendingDisplay = getObligationAmountDisplay(
    payableObligations,
    "pending",
    baseCurrencyCode,
  );
  const payablePrincipalDisplay = getObligationAmountDisplay(
    payableObligations,
    "principal",
    baseCurrencyCode,
  );
  const sharedReceivableObligations = sharedObligations.filter(
    (obligation) => obligation.direction === "receivable",
  );
  const sharedPayableObligations = sharedObligations.filter(
    (obligation) => obligation.direction === "payable",
  );
  const sharedReceivables = sharedReceivableObligations.length;
  const sharedPayables = sharedPayableObligations.length;
  const sharedPrincipalDisplay = getObligationAmountDisplay(
    sharedObligations,
    "principal",
    baseCurrencyCode,
  );
  const sharedPendingDisplay = getObligationAmountDisplay(
    sharedObligations,
    "pending",
    baseCurrencyCode,
  );
  const sharedReceivablePendingDisplay = getObligationAmountDisplay(
    sharedReceivableObligations,
    "pending",
    baseCurrencyCode,
  );
  const sharedReceivablePrincipalDisplay = getObligationAmountDisplay(
    sharedReceivableObligations,
    "principal",
    baseCurrencyCode,
  );
  const sharedPayablePendingDisplay = getObligationAmountDisplay(
    sharedPayableObligations,
    "pending",
    baseCurrencyCode,
  );
  const sharedPayablePrincipalDisplay = getObligationAmountDisplay(
    sharedPayableObligations,
    "principal",
    baseCurrencyCode,
  );
  const filteredObligations = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return obligations.filter((obligation) => {
      if (hiddenIds.has(obligation.id)) {
        return false;
      }

      const matchesDirection =
        directionFilter === "all" || obligation.direction === directionFilter;
      const matchesStatus = statusFilter === "all" || obligation.status === statusFilter;

      if (!matchesDirection || !matchesStatus) {
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
        getDirectionLabel(obligation.direction),
        getStatusOption(obligation.status).label,
        getOriginOption(obligation.originType, obligation.direction).label,
        obligation.installmentLabel,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedSearch);
    });
  }, [directionFilter, hiddenIds, obligations, searchValue, statusFilter]);

  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredObligations);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const filteredSharedObligations = useMemo(() => {
    const normalizedSearch = searchValue.trim().toLowerCase();

    return sharedObligations.filter((obligation) => {
      const matchesDirection =
        directionFilter === "all" || obligation.direction === directionFilter;
      const matchesStatus = statusFilter === "all" || obligation.status === statusFilter;

      if (!matchesDirection || !matchesStatus) {
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
  }, [directionFilter, searchValue, sharedObligations, statusFilter]);
  const filteredReceivables = filteredObligations.filter(
    (obligation) => obligation.direction === "receivable",
  ).length;
  const filteredPayables = filteredObligations.filter(
    (obligation) => obligation.direction === "payable",
  ).length;
  const hasActiveFilters =
    Boolean(searchValue.trim()) || directionFilter !== "all" || statusFilter !== "all";

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
    const installmentAmount = parseOptionalNumber(formState.installmentAmount);
    const installmentCount = parseOptionalInteger(formState.installmentCount);
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

    if (installmentAmount !== null && (Number.isNaN(installmentAmount) || installmentAmount <= 0)) {
      setEditorFeedback({
        tone: "error",
        title: "Monto por cuota invalido",
        description: "Si lo completas, debe ser un valor mayor que cero.",
      });
      return;
    }

    if (installmentCount !== null && (Number.isNaN(installmentCount) || installmentCount <= 0)) {
      setEditorFeedback({
        tone: "error",
        title: "Numero de cuotas invalido",
        description: "Si defines cuotas, indica una cantidad mayor que cero.",
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

    const validatedCounterpartyId = counterpartyId as number;
    const normalizedSettlementAccountId = settlementAccountId === null ? null : settlementAccountId;
    const normalizedOpeningAccountId =
      openingImpact === "none" || openingAccountId === null ? null : openingAccountId;
    const currentEditorShare =
      editorMode === "edit" && selectedObligation
        ? (shareByObligationId.get(selectedObligation.id) ?? null)
        : null;
    const shouldUpdateSharedViewer = shouldResendShareInvite(currentEditorShare, createShareFormState);

    const payload: ObligationFormInput = {
      direction: formState.direction,
      originType: formState.originType,
      openingImpact,
      openingAccountId: normalizedOpeningAccountId,
      status: formState.status,
      title,
      counterpartyId: validatedCounterpartyId,
      settlementAccountId: normalizedSettlementAccountId,
      currencyCode: formState.currencyCode.trim().toUpperCase() || baseCurrencyCode,
      principalAmount: principalAmount!,
      startDate: formState.startDate,
      dueDate: formState.dueDate || null,
      installmentAmount,
      installmentCount,
      interestRate,
      description: formState.description,
      notes: formState.notes,
    };

    try {
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

    const amount = parseOptionalNumber(paymentFormState.amount);
    const installmentNo = parseOptionalInteger(paymentFormState.installmentNo);

    if (amount === null || Number.isNaN(amount) || amount <= 0) {
      setPaymentFeedback({
        tone: "error",
        title: "Monto invalido",
        description: "Ingresa un abono mayor que cero.",
      });
      return;
    }

    if (!paymentFormState.eventDate) {
      setPaymentFeedback({
        tone: "error",
        title: "Falta la fecha",
        description: "Selecciona la fecha en la que se realizo el abono.",
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

    const remainingAfterPayment = Math.max(0, paymentTarget.pendingAmount - amount);
    const nextStatus: ObligationStatus =
      remainingAfterPayment <= 0
        ? "paid"
        : paymentTarget.status === "draft"
          ? "active"
          : paymentTarget.status;

    try {
      await paymentMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        userId: user.id,
        obligationId: paymentTarget.id,
        eventDate: paymentFormState.eventDate,
        amount,
        installmentNo,
        description: paymentFormState.description,
        notes: paymentFormState.notes,
        nextStatus,
      } satisfies ObligationPaymentFormInput & { workspaceId: number; userId: string });
      setPageFeedback({
        tone: "success",
        title: "Abono registrado",
        description:
          remainingAfterPayment <= 0
            ? "El registro quedo liquidado y su saldo pendiente ya se actualizo."
            : "El avance y el saldo pendiente se actualizaron correctamente.",
      });
      setPaymentTargetId(null);
    } catch (error) {
      setPaymentFeedback({
        tone: "error",
        title: "No pudimos registrar el abono",
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

  async function confirmBulkDelete() {
    if (!activeWorkspace || selectedCount === 0) return;
    setIsBulkDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await deleteMutation.mutateAsync({ obligationId: id, workspaceId: activeWorkspace.id });
      }
      clearAll();
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
      <PageHeader
        actions={
          <>
            <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
            {viewMode === "table" ? (
              <ColumnPicker columns={obligationColumns} visible={colVis} onToggle={toggleCol} />
            ) : null}
            <Button
              onClick={() =>
                downloadObligationsCSV(
                  filteredObligations,
                  `creditos-deudas-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              variant="ghost"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo credito o deuda
            </Button>
          </>
        }
        description="Organiza todo lo que te deben y todo lo que debes, con saldo pendiente, avance y abonos en un solo lugar."
        eyebrow="cartera"
        title="Creditos y deudas"
      />

      {pageFeedback?.tone === "error" ? (
        <DataState
          description={pageFeedback.description}
          title={pageFeedback.title}
          tone={pageFeedback.tone}
        />
      ) : null}

      <SurfaceCard
        action={<Landmark className="h-5 w-5 text-gold" />}
        description="Resumen general de la cartera activa del workspace."
        title="Balance de cartera"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-sm leading-7 text-storm">
            Estos montos corresponden a tu workspace activo. Los registros compartidos contigo se
            muestran aparte para no mezclarlos con tu cartera propia.
          </p>
          <StatusBadge status="Workspace activo" tone="neutral" />
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Principal total</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">{totalPrincipalDisplay}</p>
          </div>
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendiente total</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">{totalPendingDisplay}</p>
          </div>
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Activas</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">{activeCount}</p>
          </div>
          <div className="glass-panel-soft rounded-[26px] p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-storm">Liquidada</p>
            <p className="mt-3 font-display text-3xl font-semibold text-ink">{settledCount}</p>
          </div>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-[26px] border border-pine/14 bg-pine/[0.06] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ArrowUpCircle className="h-4 w-4 text-pine" />
                  <p className="text-xs uppercase tracking-[0.18em] text-pine/90">Me deben</p>
                </div>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">
                  {receivablePendingDisplay}
                </p>
                <p className="mt-3 text-sm leading-7 text-storm">
                  {receivables} {receivables === 1 ? "registro por cobrar" : "registros por cobrar"}.
                </p>
                <p className="text-sm text-storm/80">
                  Principal actual: {receivablePrincipalDisplay}
                </p>
              </div>
              <StatusBadge status="Por cobrar" tone="success" />
            </div>
          </div>
          <div className="rounded-[26px] border border-rosewood/16 bg-rosewood/[0.06] p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-rosewood" />
                  <p className="text-xs uppercase tracking-[0.18em] text-rosewood/90">Debo</p>
                </div>
                <p className="mt-3 font-display text-3xl font-semibold text-ink">
                  {payablePendingDisplay}
                </p>
                <p className="mt-3 text-sm leading-7 text-storm">
                  {payables} {payables === 1 ? "registro por pagar" : "registros por pagar"}.
                </p>
                <p className="text-sm text-storm/80">
                  Principal actual: {payablePrincipalDisplay}
                </p>
              </div>
              <StatusBadge status="Por pagar" tone="danger" />
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[28px] border border-[#7aa2ff]/18 bg-[#7aa2ff]/[0.06] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-[#9fb9ff]" />
                <p className="text-xs uppercase tracking-[0.18em] text-[#c8d8ff]">
                  Compartidos contigo
                </p>
              </div>
              <p className="mt-2 text-sm leading-7 text-storm">
                Esta lectura es solo informativa y en modo solo lectura. No entra en los totales
                del workspace activo.
              </p>
            </div>
            <StatusBadge
              status={
                sharedObligationsQuery.isLoading
                  ? "Cargando..."
                  : sharedObligationsQuery.error
                    ? "Con incidencia"
                    : `${sharedObligations.length} compartidos`
              }
              tone="info"
            />
          </div>

          {sharedObligationsQuery.isLoading ? (
            <div className="mt-4 rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-sm font-medium text-ink">Buscando cartera compartida</p>
              <p className="mt-2 text-sm leading-7 text-storm">
                Estamos revisando los creditos y deudas que otros usuarios te compartieron.
              </p>
            </div>
          ) : sharedObligationsQuery.error ? (
            <div className="mt-4 rounded-[24px] border border-rosewood/18 bg-rosewood/[0.08] p-4">
              <p className="text-sm font-medium text-ink">No pudimos abrir los compartidos</p>
              <p className="mt-2 text-sm leading-7 text-storm">
                {getQueryErrorMessage(
                  sharedObligationsQuery.error,
                  "Intentalo otra vez en unos segundos.",
                )}
              </p>
            </div>
          ) : sharedObligations.length === 0 ? (
            <div className="mt-4 rounded-[24px] border border-white/10 bg-black/10 p-4">
              <p className="text-sm font-medium text-ink">Aun no tienes registros compartidos</p>
              <p className="mt-2 text-sm leading-7 text-storm">
                Cuando otra persona te comparta un credito o deuda aceptado, aqui veras el resumen
                total sin confundirlo con tu cartera propia.
              </p>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="glass-panel-soft rounded-[26px] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">
                    Principal compartido
                  </p>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink">
                    {sharedPrincipalDisplay}
                  </p>
                  <p className="mt-2 text-sm text-storm">
                    Base actual de {sharedObligations.length} registros en seguimiento.
                  </p>
                </div>
                <div className="glass-panel-soft rounded-[26px] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">
                    Pendiente compartido
                  </p>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink">
                    {sharedPendingDisplay}
                  </p>
                  <p className="mt-2 text-sm text-storm">
                    Saldo vivo de los accesos compartidos contigo.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-[26px] border border-pine/14 bg-pine/[0.06] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <ArrowUpCircle className="h-4 w-4 text-pine" />
                        <p className="text-xs uppercase tracking-[0.18em] text-pine/90">
                          Creditos compartidos
                        </p>
                      </div>
                      <p className="mt-3 font-display text-3xl font-semibold text-ink">
                        {sharedReceivablePendingDisplay}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-storm">
                        {sharedReceivables}{" "}
                        {sharedReceivables === 1
                          ? "credito compartido"
                          : "creditos compartidos"}
                        .
                      </p>
                      <p className="text-sm text-storm/80">
                        Al propietario aun le deben pagar este monto.
                      </p>
                      <p className="text-sm text-storm/80">
                        Principal actual: {sharedReceivablePrincipalDisplay}
                      </p>
                    </div>
                    <StatusBadge status="Solo lectura" tone="success" />
                  </div>
                </div>
                <div className="rounded-[26px] border border-rosewood/16 bg-rosewood/[0.06] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <ArrowDownCircle className="h-4 w-4 text-rosewood" />
                        <p className="text-xs uppercase tracking-[0.18em] text-rosewood/90">
                          Deudas compartidas
                        </p>
                      </div>
                      <p className="mt-3 font-display text-3xl font-semibold text-ink">
                        {sharedPayablePendingDisplay}
                      </p>
                      <p className="mt-3 text-sm leading-7 text-storm">
                        {sharedPayables}{" "}
                        {sharedPayables === 1
                          ? "deuda compartida"
                          : "deudas compartidas"}
                        .
                      </p>
                      <p className="text-sm text-storm/80">
                        El propietario aun debe pagar este monto.
                      </p>
                      <p className="text-sm text-storm/80">
                        Principal actual: {sharedPayablePrincipalDisplay}
                      </p>
                    </div>
                    <StatusBadge status="Solo lectura" tone="danger" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SurfaceCard>

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
      ) : (
        <>
          <SurfaceCard
            action={<StatusBadge status={`${filteredObligations.length} visibles`} tone="neutral" />}
            className="relative z-10"
            description="Busca por nombre, contraparte, cuenta sugerida o estado para llegar mas rapido al registro correcto."
            title="Explorar cartera"
          >
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
              <div className="space-y-4">
                <label className="block">
                  <span className={labelClassName}>Buscar registro</span>
                  <div className="relative mt-3">
                    <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-storm/75" />
                    <Input
                      className="pl-12"
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="Busca por titulo, contraparte o cuenta..."
                      value={searchValue}
                    />
                  </div>
                </label>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                      Tipo de cartera
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        onClick={() => setDirectionFilter("all")}
                        variant={directionFilter === "all" ? "primary" : "ghost"}
                      >
                        Todo
                      </Button>
                      <Button
                        onClick={() => setDirectionFilter("receivable")}
                        variant={directionFilter === "receivable" ? "primary" : "ghost"}
                      >
                        Me deben
                      </Button>
                      <Button
                        onClick={() => setDirectionFilter("payable")}
                        variant={directionFilter === "payable" ? "primary" : "ghost"}
                      >
                        Yo debo
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                      Estado
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        onClick={() => setStatusFilter("all")}
                        variant={statusFilter === "all" ? "primary" : "ghost"}
                      >
                        Todos
                      </Button>
                      {statusOptions.map((option) => (
                        <Button
                          key={option.value}
                          onClick={() => setStatusFilter(option.value)}
                          variant={statusFilter === option.value ? "primary" : "ghost"}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/80">
                  Vista actual
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-void/70 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-storm">Visibles</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{filteredObligations.length}</p>
                    <p className="mt-2 text-sm text-storm">Segun los filtros actuales.</p>
                  </div>
                  <div className="rounded-[22px] border border-pine/14 bg-pine/[0.08] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-pine/90">Me deben</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{filteredReceivables}</p>
                    <p className="mt-2 text-sm text-storm">Registros por cobrar visibles.</p>
                  </div>
                  <div className="rounded-[22px] border border-rosewood/16 bg-rosewood/[0.08] p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-rosewood/90">Yo debo</p>
                    <p className="mt-2 text-2xl font-semibold text-ink">{filteredPayables}</p>
                    <p className="mt-2 text-sm text-storm">Registros por pagar visibles.</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                  <p className="text-sm leading-7 text-storm">
                    {hasActiveFilters
                      ? "Puedes combinar texto, tipo y estado para llegar mas rapido al registro exacto."
                      : "Usa estos filtros para separar lo que te deben, lo que debes o estados puntuales."}
                  </p>
                  {hasActiveFilters ? (
                    <Button
                      onClick={() => {
                        setSearchValue("");
                        setDirectionFilter("all");
                        setStatusFilter("all");
                      }}
                      variant="ghost"
                    >
                      Limpiar filtros
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          </SurfaceCard>

          {filteredObligations.length === 0 ? (
            <DataState
              action={
                obligations.length === 0 ? (
                  <Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Registrar primero</Button>
                ) : hasActiveFilters ? (
                  <Button onClick={() => { setSearchValue(""); setDirectionFilter("all"); setStatusFilter("all"); }} variant="secondary">Quitar filtros</Button>
                ) : undefined
              }
              description={
                obligations.length === 0
                  ? "Todavia no hay creditos ni deudas registrados en este workspace."
                  : "No hay registros que coincidan con la busqueda o los filtros actuales."
              }
              title={obligations.length === 0 ? "Sin creditos ni deudas todavia" : "Sin resultados"}
            />
          ) : (
            viewMode === "list" ? (
              <div className="space-y-3">
                {filteredObligations.map((obligation) => {
                  const directionVisual = getDirectionVisual(obligation.direction);
                  const DirectionIcon = directionVisual.icon;
                  const statusOption = getStatusOption(obligation.status);
                  return (
                    <article className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16" key={obligation.id}>
                      <SelectionCheckbox ariaLabel={`Seleccionar ${obligation.title}`} checked={selectedIds.has(obligation.id)} onChange={() => toggleSelect(obligation.id)} />
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}>
                        <DirectionIcon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">{obligation.title}</p>
                        <p className="text-xs text-storm">{obligation.counterparty} · {getDirectionLabel(obligation.direction)}</p>
                      </div>
                      <div className="hidden sm:flex flex-col text-right shrink-0">
                        <p className="text-sm font-semibold text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</p>
                        <p className="text-xs text-storm">pendiente</p>
                      </div>
                      <StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} />
                      <Button className="py-1.5 text-xs shrink-0" onClick={() => openEditEditor(obligation)} variant="ghost">Ver</Button>
                    </article>
                  );
                })}
              </div>
            ) : viewMode === "table" ? (
              <div className="overflow-x-auto rounded-[24px] border border-white/10">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="px-3 py-3 w-10">
                        <SelectionCheckbox ariaLabel="Seleccionar todos" checked={allSelected} indeterminate={someSelected} onChange={allSelected ? clearAll : selectAll} />
                      </th>
                      <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Registro</th>
                      <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("contraparte", "hidden sm:table-cell")}`}>Contraparte</th>
                      <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("direccion", "hidden md:table-cell")}`}>Direccion</th>
                      <th className={`px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("principal", "hidden md:table-cell")}`}>Principal</th>
                      <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Pendiente</th>
                      <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Estado</th>
                      <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredObligations.map((obligation, index) => {
                      const directionVisual = getDirectionVisual(obligation.direction);
                      const DirectionIcon = directionVisual.icon;
                      const statusOption = getStatusOption(obligation.status);
                      return (
                        <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === filteredObligations.length - 1 ? "border-b-0" : ""}`} key={obligation.id}>
                          <td className="px-3 py-3.5 w-10">
                            <SelectionCheckbox ariaLabel={`Seleccionar ${obligation.title}`} checked={selectedIds.has(obligation.id)} onChange={() => toggleSelect(obligation.id)} />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}>
                                <DirectionIcon className="h-3.5 w-3.5" />
                              </div>
                              <p className="font-medium text-ink">{obligation.title}</p>
                            </div>
                          </td>
                          <td className={`px-5 py-3.5 text-storm ${cv("contraparte", "hidden sm:table-cell")}`}>{obligation.counterparty}</td>
                          <td className={`px-5 py-3.5 ${cv("direccion", "hidden md:table-cell")}`}><StatusBadge status={getDirectionLabel(obligation.direction)} tone={getDirectionTone(obligation.direction)} /></td>
                          <td className={`px-5 py-3.5 text-right text-storm ${cv("principal", "hidden md:table-cell")}`}>{formatCurrency(obligation.currentPrincipalAmount ?? obligation.principalAmount, obligation.currencyCode)}</td>
                          <td className="px-5 py-3.5 text-right font-medium text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</td>
                          <td className="px-5 py-3.5"><StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} /></td>
                          <td className="px-5 py-3.5 text-right">
                            <Button className="py-1.5 text-xs" onClick={() => openEditEditor(obligation)} variant="ghost">Ver</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
            <section className="grid gap-6 xl:grid-cols-2">
              {filteredObligations.map((obligation) => {
                const directionVisual = getDirectionVisual(obligation.direction);
                const DirectionIcon = directionVisual.icon;
                const statusOption = getStatusOption(obligation.status);
                const lastEvent = obligation.events[0] ?? null;
                const currentShare = shareByObligationId.get(obligation.id);
                const isSelected = selectedIds.has(obligation.id);
                const longPressHandlers = createLongPressHandlers(() => toggleSelect(obligation.id));

                return (
                  <div
                    className={`relative ${isSelected ? "ring-2 ring-pine/30 rounded-[32px]" : ""}`}
                    key={obligation.id}
                    onClick={(e) => {
                      if (wasRecentLongPress()) return;
                      if (selectedCount === 0) return;
                      if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
                      toggleSelect(obligation.id);
                    }}
                    {...longPressHandlers}
                  >
                  <SurfaceCard
                    action={
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge
                          status={getDirectionLabel(obligation.direction)}
                          tone={getDirectionTone(obligation.direction)}
                        />
                        <StatusBadge
                          status={statusOption.label}
                          tone={getStatusTone(obligation.status)}
                        />
                        {currentShare ? (
                          <StatusBadge
                            status={getShareStatusLabel(currentShare.status)}
                            tone={getShareStatusTone(currentShare.status)}
                          />
                        ) : null}
                      </div>
                    }
                    className="glass-panel animate-rise-in rounded-[32px] p-6 transition duration-300 hover:-translate-y-0.5 hover:border-white/20"
                    description={obligation.counterparty}
                    title={obligation.title}
                  >
                    <div className="space-y-5">
                      <div className="flex items-start gap-4">
                        <div
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 text-white"
                          style={{
                            background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))`,
                          }}
                        >
                          <DirectionIcon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                              {getOriginOption(obligation.originType, obligation.direction).label}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                              {obligation.currencyCode}
                            </span>
                          </div>
                          {obligation.description ? (
                            <p className="mt-3 text-sm leading-7 text-storm">{obligation.description}</p>
                          ) : null}

                          {currentShare ? (
                            <div className="mt-4 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm leading-7 text-storm">
                              <p className="font-medium text-ink">
                                {currentShare.status === "accepted"
                                  ? `Compartida con ${currentShare.invitedDisplayName ?? currentShare.invitedEmail}`
                                  : `Invitacion enviada a ${currentShare.invitedDisplayName ?? currentShare.invitedEmail}`}
                              </p>
                              <p className="mt-1 text-storm">
                                {currentShare.status === "accepted"
                                  ? "La otra persona ya puede verla en modo solo lectura desde su propia cuenta."
                                  : "Cuando la otra persona acepte el correo, la vera en su modulo de creditos y deudas."}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="glass-panel-soft rounded-[26px] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Principal</p>
                          <p className="mt-2 font-display text-3xl font-semibold text-ink">
                            {formatCurrency(
                              obligation.currentPrincipalAmount ?? obligation.principalAmount,
                              obligation.currencyCode,
                            )}
                          </p>
                        </div>
                        <div className="glass-panel-soft rounded-[26px] p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendiente</p>
                          <p className="mt-2 font-display text-3xl font-semibold text-ink">
                            {formatCurrency(obligation.pendingAmount, obligation.currencyCode)}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Fecha objetivo
                          </p>
                          <p className="mt-3 text-sm font-medium text-ink">
                            {obligation.dueDate ? formatDate(obligation.dueDate) : "Sin fecha"}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Abonos
                          </p>
                          <p className="mt-3 text-sm font-medium text-ink">
                            {obligation.paymentCount > 0 ? `${obligation.paymentCount} registrados` : "Sin abonos aun"}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Cuenta sugerida
                          </p>
                          <p className="mt-3 text-sm font-medium text-ink">
                            {obligation.settlementAccountName ?? "Sin cuenta fija"}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 text-sm text-storm">
                          <span>{obligation.installmentLabel}</span>
                          <span>{obligation.progressPercent}% completado</span>
                        </div>
                        <ProgressBar value={obligation.progressPercent} />
                      </div>

                      {lastEvent ? (
                        <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Ultima actividad
                          </p>
                          <p className="mt-2 text-sm font-medium text-ink">
                            {getEventLabel(lastEvent.eventType)} - {formatDate(lastEvent.eventDate)}
                          </p>
                          {lastEvent.reason ? (
                            <p className="mt-2 text-sm leading-7 text-storm">{lastEvent.reason}</p>
                          ) : null}
                        </div>
                      ) : null}

                      {obligation.events.length > 0 ? (
                        <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                              Historial de cambios
                            </p>
                            <button
                              className="text-xs text-pine hover:text-pine/80 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pine/50 rounded"
                              onClick={() => setExpandedHistoryId(expandedHistoryId === obligation.id ? null : obligation.id)}
                              type="button"
                            >
                              {expandedHistoryId === obligation.id
                                ? "Ver menos"
                                : `Ver todo (${obligation.events.length})`}
                            </button>
                          </div>
                          <div className="mt-3 space-y-2">
                            {(expandedHistoryId === obligation.id
                              ? obligation.events
                              : obligation.events.slice(0, 3)
                            ).map((eventItem, idx) => (
                              <div
                                className="flex items-start gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3"
                                key={eventItem.id}
                              >
                                <span className="text-base leading-none mt-0.5" aria-hidden="true">
                                  {getEventIcon(eventItem.eventType)}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium text-ink">
                                        {getEventLabel(eventItem.eventType)}
                                        {eventItem.installmentNo ? (
                                          <span className="ml-2 text-xs text-storm/70">#{eventItem.installmentNo}</span>
                                        ) : null}
                                      </p>
                                      <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-storm/75">
                                        {formatDate(eventItem.eventDate)}
                                      </p>
                                    </div>
                                    <span className="text-sm font-semibold text-ink shrink-0">
                                      {formatCurrency(eventItem.amount, obligation.currencyCode)}
                                    </span>
                                  </div>
                                  {eventItem.reason ? (
                                    <p className="mt-1.5 text-xs leading-5 text-storm">{eventItem.reason}</p>
                                  ) : eventItem.description ? (
                                    <p className="mt-1.5 text-xs leading-5 text-storm">{eventItem.description}</p>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
                        <Button
                          disabled={obligation.status === "cancelled" || obligation.pendingAmount <= 0}
                          onClick={() => openPaymentDialog(obligation)}
                        >
                          <CircleDollarSign className="mr-2 h-4 w-4" />
                          Registrar abono
                        </Button>
                        <Button
                          disabled={obligation.status === "cancelled"}
                          onClick={() => openPrincipalAdjustmentDialog(obligation, "increase")}
                          variant="secondary"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Agregar monto
                        </Button>
                        <Button
                          disabled={obligation.status === "cancelled" || obligation.pendingAmount <= 0}
                          onClick={() => openPrincipalAdjustmentDialog(obligation, "decrease")}
                          variant="secondary"
                        >
                          <Minus className="mr-2 h-4 w-4" />
                          Reducir monto
                        </Button>
                        {canAccessProFeatures ? (
                          <Button
                            onClick={() => openShareDialog(obligation)}
                            variant="secondary"
                          >
                            <MailPlus className="mr-2 h-4 w-4" />
                            {currentShare ? "Gestionar acceso" : "Compartir"}
                          </Button>
                        ) : null}
                        <Button
                          onClick={() => openEditEditor(obligation)}
                          variant="secondary"
                        >
                          <PencilLine className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
                        <Button
                          className="text-[#ffb4bc] hover:text-white"
                          onClick={() => setDeleteTargetId(obligation.id)}
                          variant="ghost"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </SurfaceCard>
                  </div>
                );
              })}
            </section>
            )
          )}
        </>
      )}

      <BulkActionBar
        isDeleting={isBulkDeleting}
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
          />
        </SurfaceCard>
      ) : filteredSharedObligations.length > 0 ? (
        <SurfaceCard
          action={<StatusBadge status={`${filteredSharedObligations.length} visibles`} tone="neutral" />}
          description="Estos registros fueron compartidos contigo por otros usuarios. Los veras siempre en modo solo lectura, pero con historial, avance y cambios de monto."
          title="Compartidos contigo"
        >
          {viewMode === "list" ? (
            <div className="space-y-3">
              {filteredSharedObligations.map((obligation) => {
                const directionVisual = getDirectionVisual(obligation.direction);
                const DirectionIcon = directionVisual.icon;
                const statusOption = getStatusOption(obligation.status);
                return (
                  <article className="flex items-center gap-4 rounded-[22px] border border-[#7aa2ff]/18 bg-white/[0.03] px-5 py-4 transition hover:border-[#7aa2ff]/26" key={`shared-list-${obligation.id}`}>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}>
                      <DirectionIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{obligation.title}</p>
                      <p className="text-xs text-storm">{obligation.share.ownerDisplayName ?? "Usuario DarkMoney"} · {getSharedDirectionLabel(obligation.direction)}</p>
                    </div>
                    <div className="hidden sm:flex flex-col text-right shrink-0">
                      <p className="text-sm font-semibold text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</p>
                      <p className="text-xs text-storm">pendiente</p>
                    </div>
                    <StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} />
                  </article>
                );
              })}
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto rounded-[24px] border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Registro</th>
                    <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 hidden sm:table-cell">Propietario</th>
                    <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 hidden md:table-cell">Direccion</th>
                    <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Pendiente</th>
                    <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSharedObligations.map((obligation, index) => {
                    const directionVisual = getDirectionVisual(obligation.direction);
                    const DirectionIcon = directionVisual.icon;
                    const statusOption = getStatusOption(obligation.status);
                    return (
                      <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === filteredSharedObligations.length - 1 ? "border-b-0" : ""}`} key={`shared-table-${obligation.id}`}>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))` }}>
                              <DirectionIcon className="h-3.5 w-3.5" />
                            </div>
                            <p className="font-medium text-ink">{obligation.title}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-storm hidden sm:table-cell">{obligation.share.ownerDisplayName ?? "Usuario DarkMoney"}</td>
                        <td className="px-5 py-3.5 hidden md:table-cell"><StatusBadge status={getSharedDirectionLabel(obligation.direction)} tone={getDirectionTone(obligation.direction)} /></td>
                        <td className="px-5 py-3.5 text-right font-medium text-ink">{formatCurrency(obligation.pendingAmount, obligation.currencyCode)}</td>
                        <td className="px-5 py-3.5"><StatusBadge status={statusOption.label} tone={getStatusTone(obligation.status)} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
          <section className="grid gap-6 xl:grid-cols-2">
            {filteredSharedObligations.map((obligation) => {
              const directionVisual = getDirectionVisual(obligation.direction);
              const DirectionIcon = directionVisual.icon;
              const statusOption = getStatusOption(obligation.status);
              const lastEvent = obligation.events[0] ?? null;

              return (
                <SurfaceCard
                  action={
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge
                        status="Compartida contigo"
                        tone="info"
                      />
                      <StatusBadge
                        status={getSharedDirectionLabel(obligation.direction)}
                        tone={getDirectionTone(obligation.direction)}
                      />
                      <StatusBadge
                        status={statusOption.label}
                        tone={getStatusTone(obligation.status)}
                      />
                    </div>
                  }
                  className="glass-panel animate-rise-in rounded-[32px] border border-[#7aa2ff]/18 p-6 transition duration-300 hover:-translate-y-0.5 hover:border-[#7aa2ff]/26"
                  description={obligation.share.ownerDisplayName ?? "Usuario DarkMoney"}
                  key={`shared-${obligation.id}`}
                  title={obligation.title}
                >
                  <div className="space-y-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 text-white"
                        style={{
                          background: `linear-gradient(160deg, ${directionVisual.color}, rgba(8,13,20,0.72))`,
                        }}
                      >
                        <DirectionIcon className="h-6 w-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                            {getOriginOption(obligation.originType, obligation.direction).label}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                            {obligation.currencyCode}
                          </span>
                          <span className="rounded-full border border-[#7aa2ff]/18 bg-[#7aa2ff]/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#c8d8ff]">
                            Solo lectura
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-storm">
                          Compartida por {obligation.share.ownerDisplayName ?? "otro usuario"}.
                        </p>
                        <p className="mt-2 text-sm leading-7 text-storm/85">
                          {getSharedDirectionDescription(obligation.direction)}
                        </p>
                        {obligation.description ? (
                          <p className="mt-3 text-sm leading-7 text-storm">{obligation.description}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="glass-panel-soft rounded-[26px] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Principal</p>
                        <p className="mt-2 font-display text-3xl font-semibold text-ink">
                          {formatCurrency(
                            obligation.currentPrincipalAmount ?? obligation.principalAmount,
                            obligation.currencyCode,
                          )}
                        </p>
                      </div>
                      <div className="glass-panel-soft rounded-[26px] p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-storm">Pendiente</p>
                        <p className="mt-2 font-display text-3xl font-semibold text-ink">
                          {formatCurrency(obligation.pendingAmount, obligation.currencyCode)}
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                          Fecha objetivo
                        </p>
                        <p className="mt-3 text-sm font-medium text-ink">
                          {obligation.dueDate ? formatDate(obligation.dueDate) : "Sin fecha"}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                          Abonos
                        </p>
                        <p className="mt-3 text-sm font-medium text-ink">
                          {obligation.paymentCount > 0 ? `${obligation.paymentCount} registrados` : "Sin abonos aun"}
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                          Cuenta sugerida
                        </p>
                        <p className="mt-3 text-sm font-medium text-ink">
                          {obligation.settlementAccountName ?? "Sin cuenta fija"}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 text-sm text-storm">
                        <span>{obligation.installmentLabel}</span>
                        <span>{obligation.progressPercent}% completado</span>
                      </div>
                      <ProgressBar value={obligation.progressPercent} />
                    </div>

                    {lastEvent ? (
                      <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                          Ultima actividad
                        </p>
                        <p className="mt-2 text-sm font-medium text-ink">
                          {getEventLabel(lastEvent.eventType)} - {formatDate(lastEvent.eventDate)}
                        </p>
                        {lastEvent.reason ? (
                          <p className="mt-2 text-sm leading-7 text-storm">{lastEvent.reason}</p>
                        ) : null}
                      </div>
                    ) : null}

                    {obligation.events.length > 0 ? (
                      <div className="rounded-[24px] border border-white/10 bg-black/10 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                            Historial de cambios
                          </p>
                          <button
                            className="text-xs text-pine hover:text-pine/80 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-pine/50 rounded"
                            onClick={() => setExpandedHistoryId(expandedHistoryId === obligation.id ? null : obligation.id)}
                            type="button"
                          >
                            {expandedHistoryId === obligation.id
                              ? "Ver menos"
                              : `Ver todo (${obligation.events.length})`}
                          </button>
                        </div>
                        <div className="mt-3 space-y-2">
                          {(expandedHistoryId === obligation.id
                            ? obligation.events
                            : obligation.events.slice(0, 3)
                          ).map((eventItem, idx) => (
                            <div
                              className="flex items-start gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-3"
                              key={eventItem.id}
                            >
                              <span className="text-base leading-none mt-0.5" aria-hidden="true">
                                {getEventIcon(eventItem.eventType)}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-ink">
                                      {getEventLabel(eventItem.eventType)}
                                      {eventItem.installmentNo ? (
                                        <span className="ml-2 text-xs text-storm/70">#{eventItem.installmentNo}</span>
                                      ) : null}
                                    </p>
                                    <p className="mt-0.5 text-xs uppercase tracking-[0.18em] text-storm/75">
                                      {formatDate(eventItem.eventDate)}
                                    </p>
                                  </div>
                                  <span className="text-sm font-semibold text-ink shrink-0">
                                    {formatCurrency(eventItem.amount, obligation.currencyCode)}
                                  </span>
                                </div>
                                {eventItem.reason ? (
                                  <p className="mt-1.5 text-xs leading-5 text-storm">{eventItem.reason}</p>
                                ) : eventItem.description ? (
                                  <p className="mt-1.5 text-xs leading-5 text-storm">{eventItem.description}</p>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
                      <Button
                        disabled
                        variant="secondary"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Solo seguimiento
                      </Button>
                      <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-storm">
                        <Lock className="mr-2 h-4 w-4" />
                        Solo lectura para ti
                      </div>
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </section>
          )}
        </SurfaceCard>
      ) : null}

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
          feedback={paymentFeedback}
          formState={paymentFormState}
          isSaving={isRegisteringPayment}
          obligation={paymentTarget}
          onCancel={() => {
            if (!isRegisteringPayment) {
              setPaymentTargetId(null);
            }
          }}
          onSubmit={handleSubmitPayment}
          updateFormState={updatePaymentFormState}
        />
      ) : null}

      {principalAdjustmentTarget ? (
        <PrincipalAdjustmentDialog
          accounts={accounts}
          feedback={principalAdjustmentFeedback}
          formState={principalAdjustmentFormState}
          isSaving={isAdjustingPrincipal}
          mode={principalAdjustmentMode}
          obligation={principalAdjustmentTarget}
          onCancel={() => {
            if (!isAdjustingPrincipal) {
              setPrincipalAdjustmentTargetId(null);
            }
          }}
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

      {shareTarget ? (
        <ShareInviteDialog
          currentShare={shareByObligationId.get(shareTarget.id) ?? null}
          feedback={shareDialogFeedback}
          formState={shareDialogFormState}
          isSaving={isSendingShareInvite}
          obligation={shareTarget}
          onCancel={() => {
            if (!isSendingShareInvite) {
              setShareTargetId(null);
            }
          }}
          onSubmit={handleSubmitShareInvite}
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
              Esta accion eliminara permanentemente los registros seleccionados. No se puede deshacer.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={isBulkDeleting} onClick={() => void confirmBulkDelete()}>
                {isBulkDeleting ? "Eliminando..." : `Eliminar ${selectedCount}`}
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
