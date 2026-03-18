import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  BriefcaseBusiness,
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  Filter,
  LoaderCircle,
  PencilLine,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  Wallet,
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
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, SelectionCheckbox, useSelection, createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatMovementStatusLabel, formatWorkspaceKindLabel } from "../../../lib/formatting/labels";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  AttachmentSummary,
  CategorySummary,
  CounterpartySummary,
  JsonValue,
  MovementRecord,
  MovementStatus,
  MovementType,
  ObligationSummary,
  SubscriptionSummary,
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
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  useCreateAttachmentRecordMutation,
  getQueryErrorMessage,
  type MovementFormInput,
  useCreateMovementMutation,
  useDeleteAttachmentRecordMutation,
  useDeleteMovementMutation,
  useEntityAttachmentsQuery,
  useUpdateMovementMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

type MovementEditorMode = "create" | "edit";

type MovementFormState = {
  movementType: MovementType;
  status: MovementStatus;
  occurredAt: string;
  description: string;
  notes: string;
  sourceAccountId: string;
  sourceAmount: string;
  destinationAccountId: string;
  destinationAmount: string;
  fxRate: string;
  categoryId: string;
  counterpartyId: string;
  obligationId: string;
  subscriptionId: string;
  metadata: string;
};

type MovementFieldProps = {
  label: string;
  hint?: string;
  errorKey?: string;
  invalidFields?: Set<string>;
  children: ReactNode;
};

type PickerOption = {
  value: string;
  label: string;
  description: string;
  leadingLabel: string;
  leadingColor?: string;
  searchText?: string;
};

type SearchablePickerProps = {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholderLabel: string;
  placeholderDescription: string;
  queryPlaceholder: string;
  emptyMessage: string;
};

const movementTypeOptions = [
  {
    value: "expense" as const,
    label: "Gasto",
    description: "Saca saldo de una cuenta por una compra o consumo.",
  },
  {
    value: "income" as const,
    label: "Ingreso",
    description: "Agrega saldo a una cuenta por cobro o deposito.",
  },
  {
    value: "transfer" as const,
    label: "Transferencia",
    description: "Mueve dinero entre dos cuentas del mismo workspace.",
  },
  {
    value: "subscription_payment" as const,
    label: "Pago de suscripcion",
    description: "Registra un cobro recurrente ligado a una suscripcion.",
  },
  {
    value: "obligation_opening" as const,
    label: "Apertura de obligacion",
    description: "Crea el movimiento inicial ligado a un credito o deuda.",
  },
  {
    value: "obligation_payment" as const,
    label: "Pago de obligacion",
    description: "Asocia un pago real a un credito o deuda existente.",
  },
  {
    value: "refund" as const,
    label: "Reembolso",
    description: "Recupera dinero en una cuenta destino.",
  },
  {
    value: "adjustment" as const,
    label: "Ajuste manual",
    description: "Corrige un saldo con una entrada o salida puntual.",
  },
] as const;

const movementStatusOptions = [
  { value: "planned" as const, label: "Planeado", description: "Aun no impacta balances." },
  { value: "pending" as const, label: "Pendiente", description: "Esperando confirmacion." },
  { value: "posted" as const, label: "Aplicado", description: "Ya impacta cuentas y reportes." },
  { value: "voided" as const, label: "Anulado", description: "Se conserva para trazabilidad." },
] as const;

const expenseLikeMovementTypes = new Set<MovementType>([
  "expense",
  "subscription_payment",
  "obligation_payment",
]);
const incomeLikeMovementTypes = new Set<MovementType>(["income", "refund"]);

const movementFieldClassName =
  "w-full rounded-[18px] sm:rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-3 sm:px-4 text-xs sm:text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";
const movementTextInputClassName = `${movementFieldClassName} h-10 sm:h-16`;
const movementTextareaClassName = `${movementFieldClassName} min-h-[120px] sm:min-h-[160px] py-3 sm:py-4 leading-7`;
const movementEditorPanelClassName =
  "glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] sm:rounded-[32px] border border-white/10 bg-white/[0.04] p-3 sm:p-6";
const movementFieldLabelClassName =
  "text-[0.6rem] sm:text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80";
const movementFieldHintClassName = "mt-1 sm:mt-2 break-words text-[0.65rem] sm:text-xs leading-5 sm:leading-6 text-storm/75";
const movementPickerTriggerClassName = `${movementFieldClassName} flex h-10 sm:h-16 items-center justify-between gap-2 sm:gap-3 text-left`;
const movementPickerSearchInputClassName =
  "w-full rounded-[22px] border border-white/10 bg-[#101928] py-3.5 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

function useMovementPickerPanel(isOpen: boolean, onClose: () => void) {
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

function getMovementPickerTriggerStyle(isOpen: boolean) {
  return {
    borderColor: isOpen ? "rgba(107, 228, 197, 0.18)" : "rgba(255, 255, 255, 0.08)",
    background: isOpen
      ? "linear-gradient(180deg, rgba(15, 22, 34, 0.98), rgba(10, 16, 27, 0.98))"
      : "linear-gradient(180deg, rgba(12, 18, 28, 0.96), rgba(9, 14, 22, 0.96))",
    boxShadow: isOpen
      ? "0 0 0 4px rgba(107, 228, 197, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  };
}

const movementPickerPanelStyle = {
  borderColor: "rgba(255, 255, 255, 0.1)",
  background:
    "linear-gradient(180deg, rgba(10, 15, 24, 0.98) 0%, rgba(8, 12, 20, 0.98) 100%)",
};

const movementPickerSearchInputStyle = {
  borderColor: "rgba(255, 255, 255, 0.08)",
  background:
    "linear-gradient(180deg, rgba(17, 25, 39, 0.95), rgba(13, 20, 31, 0.95))",
};

function getMovementPickerOptionStyle(isSelected: boolean) {
  return {
    borderColor: isSelected ? "rgba(107, 228, 197, 0.18)" : "rgba(255, 255, 255, 0.04)",
    background: isSelected
      ? "linear-gradient(180deg, rgba(18, 31, 41, 0.98), rgba(12, 22, 33, 0.98))"
      : "linear-gradient(180deg, rgba(14, 21, 32, 0.96), rgba(11, 17, 26, 0.96))",
    boxShadow: isSelected ? "0 12px 30px rgba(0, 0, 0, 0.18)" : "none",
  };
}

const movementPickerEmptyStateStyle = {
  borderColor: "rgba(255, 255, 255, 0.08)",
  background:
    "linear-gradient(180deg, rgba(14, 21, 32, 0.96), rgba(11, 17, 26, 0.96))",
};

function getMovementTypeOption(movementType: MovementType) {
  return movementTypeOptions.find((option) => option.value === movementType) ?? movementTypeOptions[0];
}

function getMovementStatusOption(status: MovementStatus) {
  return movementStatusOptions.find((option) => option.value === status) ?? movementStatusOptions[0];
}

function getMovementTypeTone(movementType: MovementType) {
  if (expenseLikeMovementTypes.has(movementType)) {
    return "danger" as const;
  }

  if (incomeLikeMovementTypes.has(movementType)) {
    return "success" as const;
  }

  if (movementType === "transfer") {
    return "info" as const;
  }

  return "warning" as const;
}

function getMovementStatusTone(status: MovementStatus) {
  if (status === "posted") {
    return "success" as const;
  }

  if (status === "voided") {
    return "danger" as const;
  }

  if (status === "pending") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function getMovementStatusColor(status: MovementStatus) {
  switch (status) {
    case "posted":
      return "#1b6a58";
    case "pending":
      return "#b48b34";
    case "voided":
      return "#8f3e3e";
    default:
      return "#6b7280";
  }
}

function getCategoryColor(kind: CategorySummary["kind"]) {
  switch (kind) {
    case "expense":
      return "#8f3e3e";
    case "income":
      return "#1b6a58";
    default:
      return "#4566d6";
  }
}

function getCounterpartyColor(type: CounterpartySummary["type"]) {
  switch (type) {
    case "person":
      return "#4566d6";
    case "company":
      return "#8366f2";
    case "merchant":
      return "#c46a31";
    case "service":
      return "#b48b34";
    case "bank":
      return "#1b6a58";
    default:
      return "#6b7280";
  }
}

function getMovementVisualPreset(movementType: MovementType) {
  switch (movementType) {
    case "expense":
      return { color: "#8f3e3e", icon: ArrowDownCircle };
    case "income":
    case "refund":
      return { color: "#1b6a58", icon: ArrowUpCircle };
    case "transfer":
      return { color: "#4566d6", icon: ArrowLeftRight };
    case "subscription_payment":
      return { color: "#b48b34", icon: CalendarClock };
    case "obligation_opening":
    case "obligation_payment":
      return { color: "#c46a31", icon: BriefcaseBusiness };
    default:
      return { color: "#8366f2", icon: ReceiptText };
  }
}

function toDateTimeLocalValue(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const timezoneOffsetInMs = parsedDate.getTimezoneOffset() * 60_000;
  return new Date(parsedDate.getTime() - timezoneOffsetInMs).toISOString().slice(0, 16);
}

function createDefaultMovementFormState() {
  return {
    movementType: "expense" as MovementType,
    status: "posted" as MovementStatus,
    occurredAt: toDateTimeLocalValue(new Date().toISOString()),
    description: "",
    notes: "",
    sourceAccountId: "",
    sourceAmount: "",
    destinationAccountId: "",
    destinationAmount: "",
    fxRate: "",
    categoryId: "",
    counterpartyId: "",
    obligationId: "",
    subscriptionId: "",
    metadata: "",
  };
}

function stringifyMetadata(metadata?: JsonValue | null) {
  if (metadata === null || metadata === undefined) {
    return "";
  }

  if (typeof metadata === "object" && !Array.isArray(metadata) && Object.keys(metadata).length === 0) {
    return "";
  }

  return JSON.stringify(metadata, null, 2);
}

function buildFormStateFromMovement(movement: MovementRecord): MovementFormState {
  return {
    movementType: movement.movementType,
    status: movement.status,
    occurredAt: toDateTimeLocalValue(movement.occurredAt),
    description: movement.description,
    notes: movement.notes ?? "",
    sourceAccountId: movement.sourceAccountId ? String(movement.sourceAccountId) : "",
    sourceAmount: movement.sourceAmount === null ? "" : String(movement.sourceAmount),
    destinationAccountId: movement.destinationAccountId ? String(movement.destinationAccountId) : "",
    destinationAmount: movement.destinationAmount === null ? "" : String(movement.destinationAmount),
    fxRate: movement.fxRate === null || movement.fxRate === undefined ? "" : String(movement.fxRate),
    categoryId: movement.categoryId ? String(movement.categoryId) : "",
    counterpartyId: movement.counterpartyId ? String(movement.counterpartyId) : "",
    obligationId: movement.obligationId ? String(movement.obligationId) : "",
    subscriptionId: movement.subscriptionId ? String(movement.subscriptionId) : "",
    metadata: stringifyMetadata(movement.metadata),
  };
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

function parseMetadataValue(value: string) {
  const normalizedValue = value.trim();

  if (!normalizedValue) {
    return {} as JsonValue;
  }

  return JSON.parse(normalizedValue) as JsonValue;
}

function filterCategoriesForMovementType(
  categories: CategorySummary[],
  movementType: MovementType,
  selectedCategoryId: number | null,
) {
  return categories.filter((category) => {
    if (selectedCategoryId === category.id) {
      return true;
    }

    if (!category.isActive) {
      return false;
    }

    if (expenseLikeMovementTypes.has(movementType)) {
      return category.kind === "expense" || category.kind === "both";
    }

    if (incomeLikeMovementTypes.has(movementType)) {
      return category.kind === "income" || category.kind === "both";
    }

    return true;
  });
}

function MovementField({ children, errorKey, hint, invalidFields, label }: MovementFieldProps) {
  const hasError = !!errorKey && !!invalidFields?.has(errorKey);
  return (
    <label className="block min-w-0">
      <span className={movementFieldLabelClassName}>{label}</span>
      <div
        className={`mt-1.5 sm:mt-3${hasError ? " field-error-ring" : ""}`}
        data-field={errorKey}
      >
        {children}
      </div>
      {hint ? <p className={movementFieldHintClassName}>{hint}</p> : null}
    </label>
  );
}

function EditorInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`${movementTextInputClassName} ${className}`}
      {...props}
    />
  );
}

function EditorTextarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${movementTextareaClassName} ${className}`}
      {...props}
    />
  );
}

function SearchablePicker({
  emptyMessage,
  onChange,
  options,
  placeholderDescription,
  placeholderLabel,
  queryPlaceholder,
  value,
}: SearchablePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useMovementPickerPanel(isOpen, () => setIsOpen(false));
  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );
  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const searchableValue = (
        option.searchText ?? `${option.label} ${option.description} ${option.leadingLabel}`
      ).toLowerCase();
      return searchableValue.includes(normalizedQuery);
    });
  }, [options, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
    }
  }, [isOpen]);

  return (
    <div
      className={`relative min-w-0 ${isOpen ? "z-50" : "z-10"}`}
      ref={containerRef}
    >
      <button
        className={movementPickerTriggerClassName}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        style={getMovementPickerTriggerStyle(isOpen)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span
            className="flex h-7 min-w-[2.25rem] sm:h-10 sm:min-w-[3rem] shrink-0 items-center justify-center rounded-[12px] sm:rounded-[18px] border border-white/10 bg-white/[0.04] px-2 sm:px-3 text-xs sm:text-sm font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            style={{
              backgroundColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}22` : undefined,
              color: selectedOption?.leadingColor ? "#ffffff" : undefined,
              borderColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}55` : undefined,
            }}
          >
            {selectedOption?.leadingLabel ?? "?"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs sm:text-sm font-semibold text-ink">
              {selectedOption ? selectedOption.label : placeholderLabel}
            </span>
            <span className="mt-0.5 sm:mt-1 block truncate text-[0.65rem] sm:text-xs text-storm">
              {selectedOption ? selectedOption.description : placeholderDescription}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div
          className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-[30px] border p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]"
          style={movementPickerPanelStyle}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <input
              autoFocus
              className={movementPickerSearchInputClassName}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={queryPlaceholder}
              style={movementPickerSearchInputStyle}
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
                    className={`flex w-full items-center justify-between gap-2 sm:gap-3 rounded-[18px] sm:rounded-[24px] border px-3 sm:px-4 py-2.5 sm:py-3.5 text-left transition duration-200 ${
                      isSelected ? "text-ink" : "text-storm hover:text-ink"
                    }`}
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    style={getMovementPickerOptionStyle(isSelected)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                      <span
                        className="flex h-8 min-w-[2.25rem] sm:h-11 sm:min-w-[3rem] shrink-0 items-center justify-center rounded-[12px] sm:rounded-[18px] border border-white/10 bg-white/[0.04] px-2 sm:px-3 text-xs sm:text-sm font-semibold text-ink"
                        style={{
                          backgroundColor: option.leadingColor ? `${option.leadingColor}22` : undefined,
                          color: option.leadingColor ? "#ffffff" : undefined,
                          borderColor: option.leadingColor ? `${option.leadingColor}55` : undefined,
                        }}
                      >
                        {option.leadingLabel}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{option.label}</span>
                        <span className="mt-1 block truncate text-xs text-storm">
                          {option.description}
                        </span>
                      </span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-pine" /> : null}
                  </button>
                );
              })
            ) : (
              <div
                className="rounded-[22px] border px-4 py-5 text-sm text-storm"
                style={movementPickerEmptyStateStyle}
              >
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

type MovementEditorDialogProps = {
  accounts: AccountSummary[];
  accessMessage: string;
  attachments: AttachmentSummary[];
  baseCurrencyCode: string;
  canManageReceipts: boolean;
  categories: CategorySummary[];
  clearFieldError: (field: string) => void;
  closeEditor: () => void;
  counterparties: CounterpartySummary[];
  errorMessage: string;
  formState: MovementFormState;
  invalidFields: Set<string>;
  handleDeleteMovement: () => void;
  handleDeleteReceipt: (attachment: AttachmentSummary) => Promise<void>;
  handleUploadReceipt: (file: File) => Promise<void>;
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  isCreateMode: boolean;
  isSaving: boolean;
  isUploadingReceipt: boolean;
  obligations: ObligationSummary[];
  pendingReceiptFile: File | null;
  selectedMovement: MovementRecord | null;
  subscriptions: SubscriptionSummary[];
  updatePendingReceiptFile: (file: File | null) => void;
  updateFormState: <Field extends keyof MovementFormState>(
    field: Field,
    value: MovementFormState[Field],
  ) => void;
};


function MovementEditorDialog({
  accounts,
  accessMessage,
  attachments,
  baseCurrencyCode,
  canManageReceipts,
  categories,
  clearFieldError,
  closeEditor,
  counterparties,
  errorMessage,
  formState,
  handleDeleteMovement,
  handleDeleteReceipt,
  handleUploadReceipt,
  handleSubmit,
  invalidFields,
  isCreateMode,
  isSaving,
  isUploadingReceipt,
  obligations,
  pendingReceiptFile,
  selectedMovement,
  subscriptions,
  updatePendingReceiptFile,
  updateFormState,
}: MovementEditorDialogProps) {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

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

  const selectedCategoryId = parseOptionalInteger(formState.categoryId);
  const filteredCategories = filterCategoriesForMovementType(
    categories,
    formState.movementType,
    Number.isFinite(selectedCategoryId) ? selectedCategoryId : null,
  );
  const selectedSourceAccount =
    accounts.find((account) => account.id === parseOptionalInteger(formState.sourceAccountId)) ?? null;
  const selectedDestinationAccount =
    accounts.find((account) => account.id === parseOptionalInteger(formState.destinationAccountId)) ?? null;
  const selectedCounterparty =
    counterparties.find((counterparty) => counterparty.id === parseOptionalInteger(formState.counterpartyId)) ?? null;
  const selectedObligation =
    obligations.find((obligation) => obligation.id === parseOptionalInteger(formState.obligationId)) ?? null;
  const selectedSubscription =
    subscriptions.find((subscription) => subscription.id === parseOptionalInteger(formState.subscriptionId)) ?? null;
  const sourceAmount = parseOptionalNumber(formState.sourceAmount);
  const destinationAmount = parseOptionalNumber(formState.destinationAmount);
  const manualFxRate = parseOptionalNumber(formState.fxRate);
  const inferredFxRate =
    selectedSourceAccount &&
    selectedDestinationAccount &&
    selectedSourceAccount.currencyCode !== selectedDestinationAccount.currencyCode &&
    sourceAmount !== null &&
    destinationAmount !== null &&
    Number.isFinite(sourceAmount) &&
    Number.isFinite(destinationAmount) &&
    sourceAmount > 0
      ? destinationAmount / sourceAmount
      : null;
  const displayAmount =
    destinationAmount !== null && Number.isFinite(destinationAmount)
      ? destinationAmount
      : sourceAmount !== null && Number.isFinite(sourceAmount)
        ? sourceAmount
        : 0;
  const displayCurrencyCode =
    selectedDestinationAccount?.currencyCode ??
    selectedSourceAccount?.currencyCode ??
    baseCurrencyCode;

  const balanceImpacts = useMemo(() => {
    const impacts: Array<{
      account: AccountSummary;
      delta: number;
      projectedBalance: number;
    }> = [];
    const srcAmt = sourceAmount ?? 0;
    const dstAmt = destinationAmount ?? 0;

    if (expenseLikeMovementTypes.has(formState.movementType)) {
      if (selectedSourceAccount && srcAmt > 0) {
        impacts.push({
          account: selectedSourceAccount,
          delta: -srcAmt,
          projectedBalance: selectedSourceAccount.currentBalance - srcAmt,
        });
      }
    } else if (incomeLikeMovementTypes.has(formState.movementType)) {
      if (selectedDestinationAccount && dstAmt > 0) {
        impacts.push({
          account: selectedDestinationAccount,
          delta: dstAmt,
          projectedBalance: selectedDestinationAccount.currentBalance + dstAmt,
        });
      }
    } else if (formState.movementType === "transfer") {
      if (selectedSourceAccount && srcAmt > 0) {
        impacts.push({
          account: selectedSourceAccount,
          delta: -srcAmt,
          projectedBalance: selectedSourceAccount.currentBalance - srcAmt,
        });
      }
      if (selectedDestinationAccount && dstAmt > 0 && selectedDestinationAccount.id !== selectedSourceAccount?.id) {
        impacts.push({
          account: selectedDestinationAccount,
          delta: dstAmt,
          projectedBalance: selectedDestinationAccount.currentBalance + dstAmt,
        });
      }
    }

    return impacts;
  }, [formState.movementType, selectedSourceAccount, selectedDestinationAccount, sourceAmount, destinationAmount]);

  const movementTypeOption = getMovementTypeOption(formState.movementType);
  const movementStatusOption = getMovementStatusOption(formState.status);
  const selectedCategory =
    categories.find((category) => category.id === parseOptionalInteger(formState.categoryId)) ?? null;
  const movementVisual = getMovementVisualPreset(formState.movementType);
  const PreviewMovementIcon = movementVisual.icon;
  const previewTitle = formState.description.trim() || "Movimiento sin descripcion";
  const previewFlowLabel =
    selectedSourceAccount && selectedDestinationAccount
      ? `${selectedSourceAccount.name} -> ${selectedDestinationAccount.name}`
      : selectedSourceAccount
        ? `Salida desde ${selectedSourceAccount.name}`
        : selectedDestinationAccount
          ? `Entrada a ${selectedDestinationAccount.name}`
          : "Sin cuentas definidas aun";
  const previewContextLabel = selectedCounterparty
    ? selectedCounterparty.name
    : selectedSubscription
      ? selectedSubscription.name
      : selectedObligation
        ? selectedObligation.title
        : "Sin relacion adicional";
  const conversionLabel =
    manualFxRate !== null && Number.isFinite(manualFxRate)
      ? manualFxRate.toFixed(6)
      : inferredFxRate !== null && Number.isFinite(inferredFxRate)
        ? inferredFxRate.toFixed(6)
        : "Sin conversion";

  useEffect(() => {
    setIsDeleteConfirmOpen(false);
  }, [isCreateMode, selectedMovement?.id]);

  const movementTypePickerOptions = useMemo(
    () =>
      movementTypeOptions.map((option) => {
        const visual = getMovementVisualPreset(option.value);

        return {
          value: option.value,
          label: option.label,
          description: option.description,
          leadingLabel: option.label.slice(0, 2).toUpperCase(),
          leadingColor: visual.color,
          searchText: `${option.label} ${option.description} ${option.value}`,
        };
      }),
    [],
  );
  const movementStatusPickerOptions = useMemo(
    () =>
      movementStatusOptions.map((option) => ({
        value: option.value,
        label: option.label,
        description: option.description,
        leadingLabel: option.label.slice(0, 2).toUpperCase(),
        leadingColor: getMovementStatusColor(option.value),
        searchText: `${option.label} ${option.description} ${option.value}`,
      })),
    [],
  );
  const accountPickerOptions = useMemo(
    () =>
      accounts.map((account) => ({
        value: String(account.id),
        label: account.name,
        description: `${account.currencyCode} · ${account.type}${account.isArchived ? " · archivada" : ""}`,
        leadingLabel: account.currencyCode,
        leadingColor: account.color,
        searchText: `${account.name} ${account.currencyCode} ${account.type}`,
      })),
    [accounts],
  );
  const categoryPickerOptions = useMemo(
    () =>
      filteredCategories.map((category) => ({
        value: String(category.id),
        label: category.name,
        description: `${category.kind}${category.isActive ? "" : " · inactiva"}`,
        leadingLabel: category.name.slice(0, 2).toUpperCase(),
        leadingColor: getCategoryColor(category.kind),
        searchText: `${category.name} ${category.kind}`,
      })),
    [filteredCategories],
  );
  const counterpartyPickerOptions = useMemo(
    () =>
      counterparties.map((counterparty) => ({
        value: String(counterparty.id),
        label: counterparty.name,
        description: `${counterparty.type}${counterparty.isArchived ? " · archivada" : ""}`,
        leadingLabel: counterparty.name.slice(0, 2).toUpperCase(),
        leadingColor: getCounterpartyColor(counterparty.type),
        searchText: `${counterparty.name} ${counterparty.type}`,
      })),
    [counterparties],
  );
  const obligationPickerOptions = useMemo(
    () =>
      obligations.map((obligation) => ({
        value: String(obligation.id),
        label: obligation.title,
        description: `${obligation.currencyCode} · ${obligation.counterparty}`,
        leadingLabel: obligation.currencyCode,
        leadingColor: obligation.direction === "receivable" ? "#1b6a58" : "#c46a31",
        searchText: `${obligation.title} ${obligation.currencyCode} ${obligation.counterparty} ${obligation.direction}`,
      })),
    [obligations],
  );
  const subscriptionPickerOptions = useMemo(
    () =>
      subscriptions.map((subscription) => ({
        value: String(subscription.id),
        label: subscription.name,
        description: `${subscription.currencyCode} · ${subscription.vendor}`,
        leadingLabel: subscription.currencyCode,
        leadingColor: "#b48b34",
        searchText: `${subscription.name} ${subscription.currencyCode} ${subscription.vendor} ${subscription.frequency}`,
      })),
    [subscriptions],
  );

  return (
    <div
      aria-modal="true"
      className="animate-fade-in fixed inset-0 z-40 isolate bg-black/62 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-black/48 before:backdrop-blur-2xl before:content-['']"
      onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }}
      onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) closeEditor(); }}
      role="dialog"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div
          className="animate-rise-in relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[1120px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -left-20 top-12 h-64 w-64 rounded-full blur-3xl animate-soft-pulse"
              style={{ backgroundColor: `${movementVisual.color}2b` }}
            />
            <div
              className="absolute right-0 top-0 h-48 w-48 rounded-full blur-3xl animate-soft-pulse [animation-delay:240ms]"
              style={{ backgroundColor: "rgba(142, 165, 255, 0.14)" }}
            />
            <div
              className="absolute bottom-0 left-1/2 h-40 w-56 -translate-x-1/2 blur-3xl animate-soft-pulse [animation-delay:420ms]"
              style={{ backgroundColor: "rgba(215, 190, 123, 0.12)" }}
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%,transparent_78%,rgba(255,255,255,0.03))]" />
          </div>

          <div className="relative flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-y-auto px-4 pt-4 sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                    {isCreateMode ? "nuevo movimiento" : "editar movimiento"}
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-storm/75">
                    Se refleja al guardar
                  </span>
                </div>
                <div>
                  <h2 className="font-display text-3xl font-semibold text-ink sm:text-[2.7rem]">
                    {isCreateMode ? "Registrar movimiento" : previewTitle}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-storm">
                    Registra un movimiento real con el mismo lenguaje visual del modulo de
                    cuentas: primero la vista previa y luego la configuracion operativa.
                  </p>
                </div>
              </div>
              <button
                aria-label="Cerrar editor de movimiento"
                className="rounded-full border border-white/10 bg-white/[0.04] p-3 text-storm transition hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-ink"
                onClick={closeEditor}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              className="mt-6 flex flex-1 flex-col"
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
            >
              {errorMessage ? (
                <FormFeedbackBanner
                  className="mb-6"
                  description={errorMessage}
                  title="Revisa este movimiento antes de guardarlo"
                />
              ) : null}

              <section className="relative min-w-0 overflow-hidden rounded-[24px] sm:rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-3 sm:p-6 lg:p-7">
              <div
                className="absolute -right-10 top-0 h-32 w-32 rounded-full blur-3xl animate-soft-pulse"
                style={{ backgroundColor: `${movementVisual.color}3d` }}
              />
              <div className="relative">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                    Live preview
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-storm/80">
                    {previewContextLabel}
                  </span>
                </div>

                <div className="mt-4 sm:mt-6 grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)] lg:items-end">
                  <div className="flex items-start gap-3 sm:gap-5">
                    <div className="relative flex h-12 w-12 sm:h-24 sm:w-24 shrink-0 items-center justify-center">
                      <div
                        className="absolute inset-0 rounded-[16px] sm:rounded-[30px] opacity-80 blur-2xl"
                        style={{ backgroundColor: `${movementVisual.color}5f` }}
                      />
                      <div
                        className="relative flex h-full w-full items-center justify-center rounded-[16px] sm:rounded-[30px] border border-white/10 text-white shadow-[0_20px_45px_rgba(0,0,0,0.28)]"
                        style={{
                          background: `linear-gradient(160deg, ${movementVisual.color}, rgba(8, 13, 20, 0.72))`,
                        }}
                      >
                        <PreviewMovementIcon className="h-5 w-5 sm:h-9 sm:w-9" />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Vista previa
                      </p>
                      <h3 className="mt-1 sm:mt-2 break-words font-display text-2xl sm:text-4xl font-semibold text-ink">
                        {previewTitle}
                      </h3>
                      <p className="mt-2 sm:mt-3 break-words max-w-2xl text-xs sm:text-sm leading-6 sm:leading-7 text-storm">
                        {movementTypeOption.description}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                          {movementTypeOption.label}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                          {movementStatusOption.label}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                          {selectedCategory?.name ?? "Sin categoria"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-[16px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Impacto
                      </p>
                      <p className="mt-2 sm:mt-3 font-display text-xl sm:text-2xl font-semibold text-ink">
                        {formatCurrency(displayAmount, displayCurrencyCode)}
                      </p>
                    </div>

                    <div className="rounded-[16px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Flujo
                      </p>
                      <p className="mt-2 sm:mt-3 break-words text-xs sm:text-sm font-medium text-ink">{previewFlowLabel}</p>
                      <p className="mt-1 sm:mt-2 break-words text-xs leading-6 text-storm/75">{previewContextLabel}</p>
                    </div>

                    <div className="rounded-[16px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Conversion
                      </p>
                      <p className="mt-2 sm:mt-3 break-words text-xs sm:text-sm font-medium text-ink">{conversionLabel}</p>
                      <p className="mt-1 sm:mt-2 text-xs leading-6 text-storm/75">
                        {formState.occurredAt
                          ? formatDateTime(new Date(formState.occurredAt).toISOString())
                          : "Sin fecha definida"}
                      </p>
                    </div>
                  </div>

                  {balanceImpacts.length > 0 ? (
                    <div className="mt-4 sm:mt-5 rounded-[16px] sm:rounded-[20px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                          Impacto en cuentas
                        </p>
                        {formState.status !== "posted" ? (
                          <span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.18em] text-amber-400/80">
                            {formState.status === "planned"
                              ? "planeado"
                              : formState.status === "pending"
                                ? "pendiente"
                                : "anulado"}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 space-y-2 sm:space-y-3">
                        {balanceImpacts.map(({ account, delta, projectedBalance }) => (
                          <div key={account.id}>
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: account.color }}
                              />
                              <span className="min-w-0 flex-1 truncate text-xs sm:text-sm text-storm">
                                {account.name}
                              </span>
                              <div className="flex shrink-0 items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                                <span className="text-storm/70">
                                  {formatCurrency(account.currentBalance, account.currencyCode)}
                                </span>
                                <span className="text-storm/40">→</span>
                                <span className={delta >= 0 ? "font-medium text-pine" : "font-medium text-ember"}>
                                  {formatCurrency(projectedBalance, account.currencyCode)}
                                </span>
                                <span
                                  className={`rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium ${delta >= 0 ? "bg-pine/15 text-pine" : "bg-ember/15 text-ember"}`}
                                >
                                  {delta >= 0 ? "+" : ""}
                                  {formatCurrency(delta, account.currencyCode)}
                                </span>
                              </div>
                            </div>
                            {projectedBalance < 0 && formState.status === "posted" ? (
                              <p className="mt-1 pl-5 text-[0.65rem] font-medium text-ember">
                                Esta cuenta quedaria en negativo al aplicar este movimiento.
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                      {formState.status !== "posted" ? (
                        <p className="mt-3 text-[0.65rem] sm:text-xs leading-5 text-storm/55">
                          Este movimiento aun no esta aplicado. El saldo real solo cambia cuando el estado es
                          &ldquo;Aplicado&rdquo;.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
              </section>

              <div className="mt-8 flex items-center gap-4 px-1">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/5" />
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/70">
                Configuracion del movimiento
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-white/5 via-white/10 to-transparent" />
              </div>

              <div className="mt-4 sm:mt-8 grid gap-4 sm:gap-6 xl:gap-7 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-4 sm:space-y-6">
                <section className={`${movementEditorPanelClassName} z-30`}>
                  <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                    <ReceiptText className="h-4 w-4 sm:h-5 sm:w-5 text-gold" />
                    <div>
                      <p className="text-[0.6rem] sm:text-xs uppercase tracking-[0.22em] text-storm">Operacion</p>
                      <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-medium text-ink">Base del registro</p>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
                    <MovementField
                      hint="Selecciona la semantica real del registro segun el diccionario."
                      label="Tipo de movimiento"
                    >
                      <SearchablePicker
                        emptyMessage="No encontramos un tipo de movimiento con ese termino."
                        onChange={(nextValue) =>
                          updateFormState("movementType", nextValue as MovementType)
                        }
                        options={movementTypePickerOptions}
                        placeholderDescription="Selecciona el comportamiento del movimiento."
                        placeholderLabel="Selecciona un tipo"
                        queryPlaceholder="Buscar tipo de movimiento..."
                        value={formState.movementType}
                      />
                    </MovementField>

                    <MovementField
                      hint="Define si ya impacta balances, si esta pendiente o si quedo anulado."
                      label="Estado"
                    >
                      <SearchablePicker
                        emptyMessage="No encontramos un estado con ese termino."
                        onChange={(nextValue) => updateFormState("status", nextValue as MovementStatus)}
                        options={movementStatusPickerOptions}
                        placeholderDescription="Selecciona el estado del registro."
                        placeholderLabel="Selecciona un estado"
                        queryPlaceholder="Buscar estado..."
                        value={formState.status}
                      />
                    </MovementField>

                    <MovementField
                      errorKey="description"
                      hint="Aparece en listados, dashboards y trazabilidad."
                      invalidFields={invalidFields}
                      label="Descripcion"
                    >
                      <EditorInput
                        onChange={(event) => { clearFieldError("description"); updateFormState("description", event.target.value); }}
                        placeholder="Ej. Pago de internet de la oficina"
                        value={formState.description}
                      />
                    </MovementField>

                    <MovementField
                      errorKey="occurredAt"
                      hint="Fecha y hora efectiva del movimiento."
                      invalidFields={invalidFields}
                      label="Fecha operativa"
                    >
                      <DatePickerField
                        mode="datetime-local"
                        onChange={(nextValue) => { clearFieldError("occurredAt"); updateFormState("occurredAt", nextValue); }}
                        value={formState.occurredAt}
                      />
                    </MovementField>
                  </div>
                </section>

                <section className={`${movementEditorPanelClassName} z-20`}>
                  <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                    <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-pine" />
                    <div>
                      <p className="text-[0.6rem] sm:text-xs uppercase tracking-[0.22em] text-storm">Flujo</p>
                      <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-medium text-ink">Cuentas y montos</p>
                    </div>
                  </div>

                  <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 md:grid-cols-2">
                    <MovementField
                      errorKey="sourceAccountId"
                      hint="Cuenta desde donde sale saldo. Es clave para gastos y transferencias."
                      invalidFields={invalidFields}
                      label="Cuenta origen"
                    >
                      <SearchablePicker
                        emptyMessage="No encontramos una cuenta origen con ese termino."
                        onChange={(nextValue) => { clearFieldError("sourceAccountId"); updateFormState("sourceAccountId", nextValue); }}
                        options={accountPickerOptions}
                        placeholderDescription="Cuenta desde donde sale saldo."
                        placeholderLabel="Sin origen"
                        queryPlaceholder="Buscar cuenta origen..."
                        value={formState.sourceAccountId}
                      />
                    </MovementField>

                    <MovementField
                      errorKey="sourceAmount"
                      hint={selectedSourceAccount ? `Moneda ${selectedSourceAccount.currencyCode}.` : "Monto que sale."}
                      invalidFields={invalidFields}
                      label="Monto origen"
                    >
                      <EditorInput
                        inputMode="decimal"
                        onChange={(event) => { clearFieldError("sourceAmount"); updateFormState("sourceAmount", event.target.value); }}
                        placeholder="0.00"
                        value={formState.sourceAmount}
                      />
                    </MovementField>

                    <MovementField
                      errorKey="destinationAccountId"
                      hint="Cuenta que recibe saldo. Es clave para ingresos y transferencias."
                      invalidFields={invalidFields}
                      label="Cuenta destino"
                    >
                      <SearchablePicker
                        emptyMessage="No encontramos una cuenta destino con ese termino."
                        onChange={(nextValue) => { clearFieldError("destinationAccountId"); updateFormState("destinationAccountId", nextValue); }}
                        options={accountPickerOptions}
                        placeholderDescription="Cuenta que recibe saldo."
                        placeholderLabel="Sin destino"
                        queryPlaceholder="Buscar cuenta destino..."
                        value={formState.destinationAccountId}
                      />
                    </MovementField>

                    <MovementField
                      errorKey="destinationAmount"
                      hint={
                        selectedDestinationAccount
                          ? `Moneda ${selectedDestinationAccount.currencyCode}.`
                          : "Monto que entra."
                      }
                      invalidFields={invalidFields}
                      label="Monto destino"
                    >
                      <EditorInput
                        inputMode="decimal"
                        onChange={(event) => { clearFieldError("destinationAmount"); updateFormState("destinationAmount", event.target.value); }}
                        placeholder="0.00"
                        value={formState.destinationAmount}
                      />
                    </MovementField>
                  </div>

                  <div className="mt-3 sm:mt-5 grid gap-3 sm:gap-4 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
                    <MovementField
                      hint="Opcional. Si hay dos monedas, puedes guardarla manualmente."
                      label="FX rate"
                    >
                      <EditorInput
                        inputMode="decimal"
                        onChange={(event) => updateFormState("fxRate", event.target.value)}
                        placeholder={inferredFxRate ? inferredFxRate.toFixed(6) : "Ej. 3.450000"}
                        value={formState.fxRate}
                      />
                    </MovementField>

                    <div className="rounded-[18px] sm:rounded-[28px] border border-white/8 bg-[#0c1320]/80 p-3 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Preview financiero
                      </p>
                      <p className="mt-2 sm:mt-4 font-display text-xl sm:text-3xl font-semibold text-ink">
                        {formatCurrency(displayAmount, displayCurrencyCode)}
                      </p>
                      <p className="mt-1 sm:mt-2 break-words text-xs sm:text-sm text-storm">{previewFlowLabel}</p>
                      <div className="mt-4 h-px bg-white/8" />
                      <p className="mt-4 text-xs leading-6 text-storm/75">
                        Las transferencias usan origen y destino. Los gastos salen de una cuenta y
                        los ingresos entran a una cuenta. Los movimientos aplicados actualizan tus
                        balances.
                      </p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <section className={`${movementEditorPanelClassName} z-20`}>
                  <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                    <BriefcaseBusiness className="h-4 w-4 sm:h-5 sm:w-5 text-ember" />
                    <div>
                      <p className="text-[0.6rem] sm:text-xs uppercase tracking-[0.22em] text-storm">Vinculos</p>
                      <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-medium text-ink">Contexto contable</p>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-6 space-y-3 sm:space-y-5">
                    <MovementField
                      hint="La lista se adapta segun si el movimiento es de ingreso o gasto."
                      label="Categoria"
                    >
                      <SearchablePicker
                        emptyMessage="No encontramos una categoria con ese termino."
                        onChange={(nextValue) => updateFormState("categoryId", nextValue)}
                        options={categoryPickerOptions}
                        placeholderDescription="Asocia este movimiento a una categoria."
                        placeholderLabel="Sin categoria"
                        queryPlaceholder="Buscar categoria..."
                        value={formState.categoryId}
                      />
                    </MovementField>

                    <MovementField
                      hint="Persona, comercio, empresa o banco asociado."
                      label="Contraparte"
                    >
                      <SearchablePicker
                        emptyMessage="No encontramos una contraparte con ese termino."
                        onChange={(nextValue) => updateFormState("counterpartyId", nextValue)}
                        options={counterpartyPickerOptions}
                        placeholderDescription="Persona o entidad vinculada."
                        placeholderLabel="Sin contraparte"
                        queryPlaceholder="Buscar contraparte..."
                        value={formState.counterpartyId}
                      />
                    </MovementField>

                    <MovementField
                      hint="Opcional. Sirve para enlazar pagos y aperturas de deuda o credito."
                      label="Obligacion"
                    >
                      <SearchablePicker
                        emptyMessage="No encontramos una obligacion con ese termino."
                        onChange={(nextValue) => updateFormState("obligationId", nextValue)}
                        options={obligationPickerOptions}
                        placeholderDescription="Relaciona el movimiento con una obligacion."
                        placeholderLabel="Sin obligacion"
                        queryPlaceholder="Buscar obligacion..."
                        value={formState.obligationId}
                      />
                    </MovementField>

                    <MovementField
                      hint="Opcional. Relaciona el cobro con una suscripcion real."
                      label="Suscripcion"
                    >
                      <SearchablePicker
                        emptyMessage="No encontramos una suscripcion con ese termino."
                        onChange={(nextValue) => updateFormState("subscriptionId", nextValue)}
                        options={subscriptionPickerOptions}
                        placeholderDescription="Relaciona el movimiento con una suscripcion."
                        placeholderLabel="Sin suscripcion"
                        queryPlaceholder="Buscar suscripcion..."
                        value={formState.subscriptionId}
                      />
                    </MovementField>
                  </div>
                </section>

                <section className={`${movementEditorPanelClassName} z-10`}>
                  <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                    <CalendarClock className="h-4 w-4 sm:h-5 sm:w-5 text-gold" />
                    <div>
                      <p className="text-[0.6rem] sm:text-xs uppercase tracking-[0.22em] text-storm">Contexto</p>
                      <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-medium text-ink">Notas y metadata</p>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-6 space-y-3 sm:space-y-5">
                    <MovementField
                      hint="Observaciones legibles para auditoria humana."
                      label="Notas"
                    >
                      <EditorTextarea
                        onChange={(event) => updateFormState("notes", event.target.value)}
                        placeholder="Ej. Compra aprobada por el equipo y pagada desde la cuenta operativa."
                        value={formState.notes}
                      />
                    </MovementField>

                    <MovementField
                      hint="JSON opcional para guardar detalles tecnicos, etiquetas o integraciones."
                      label="Metadata JSON"
                    >
                      <EditorTextarea
                        className="min-h-[180px] font-mono text-[13px]"
                        onChange={(event) => updateFormState("metadata", event.target.value)}
                        placeholder='{"channel":"manual","reference":"INV-001"}'
                        value={formState.metadata}
                      />
                    </MovementField>

                    {isCreateMode ? (
                      <PendingReceiptField
                        canUpload={canManageReceipts}
                        file={pendingReceiptFile}
                        lockedMessage={accessMessage}
                        onChange={updatePendingReceiptFile}
                      />
                    ) : selectedMovement ? (
                      <AttachmentGallery
                        accessMessage={accessMessage}
                        attachments={attachments}
                        canManage={canManageReceipts}
                        entityLabel="movimiento"
                        isUploading={isUploadingReceipt}
                        onDelete={(attachment) => {
                          void handleDeleteReceipt(attachment);
                        }}
                        onUpload={(file) => {
                          void handleUploadReceipt(file);
                        }}
                      />
                    ) : null}
                  </div>
                </section>
              </div>
              </div>

              <div className="sticky bottom-0 z-[60] -mx-4 sm:-mx-6 mt-8 rounded-b-[38px] border-t border-white/10 bg-[#060b12]/95 px-4 py-5 sm:px-6 backdrop-blur-md">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <p className="max-w-xl text-sm leading-7 text-storm">
                  {isCreateMode
                    ? "El movimiento se guardara en este espacio y se reflejara en tu historial enseguida."
                    : "Los cambios se aplicaran de inmediato y actualizaran la informacion del movimiento."}
                </p>

                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  {!isCreateMode && selectedMovement ? (
                    <Button
                      className="min-w-[150px] justify-center"
                      disabled={isSaving}
                      onClick={() => setIsDeleteConfirmOpen(true)}
                      type="button"
                      variant="ghost"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar
                    </Button>
                  ) : null}
                  <Button
                    className="min-w-[140px] justify-center"
                    disabled={isSaving}
                    onClick={closeEditor}
                    type="button"
                    variant="ghost"
                  >
                    Cancelar
                  </Button>
                  <Button
                    className="min-w-[190px] justify-center shadow-[0_18px_50px_rgba(245,247,251,0.12)]"
                    disabled={isSaving}
                    type="submit"
                  >
                    {isSaving ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : isCreateMode ? (
                      "Crear movimiento"
                    ) : (
                      "Guardar cambios"
                    )}
                  </Button>
                </div>
              </div>
              </div>
          </form>

          {isDeleteConfirmOpen && selectedMovement ? (
            <DeleteConfirmDialog
              badge="Eliminar movimiento"
              description="Esta accion elimina el movimiento de tu historial y no se puede deshacer. Si esta relacionado con una obligacion o suscripcion, conviene revisar primero esas dependencias."
              isDeleting={isSaving}
              onCancel={() => {
                if (!isSaving) {
                  setIsDeleteConfirmOpen(false);
                }
              }}
              onConfirm={() => {
                setIsDeleteConfirmOpen(false);
                void handleDeleteMovement();
              }}
            >
              <div className="flex items-start gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] border border-white/10 text-white shadow-[0_15px_40px_rgba(0,0,0,0.22)]"
                  style={{ background: `linear-gradient(160deg, ${getMovementVisualPreset(selectedMovement.movementType).color}, rgba(8, 13, 20, 0.72))` }}
                >
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-semibold text-ink">{selectedMovement.description}</p>
                  <p className="mt-1 text-sm text-storm">{formatDateTime(selectedMovement.occurredAt)}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                      {getMovementTypeOption(selectedMovement.movementType).label}
                    </span>
                    <span
                      className="rounded-full border px-3 py-1 text-xs"
                      style={{
                        borderColor: `${getMovementStatusColor(selectedMovement.status)}55`,
                        backgroundColor: `${getMovementStatusColor(selectedMovement.status)}18`,
                        color: "#f5f7fb",
                      }}
                    >
                      {getMovementStatusOption(selectedMovement.status).label}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-storm">
                      {selectedMovement.category}
                    </span>
                  </div>
                </div>
              </div>
            </DeleteConfirmDialog>
          ) : null}
        </div>
      </div>
    </div>
    </div>
  );
}

function MovementsLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[300px] rounded-[32px]" />
      <div className="space-y-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div className="shimmer-surface h-[72px] rounded-[22px]" key={i} />
        ))}
      </div>
    </>
  );
}

function downloadMovementsCSV(movements: MovementRecord[], filename: string) {
  const headers = [
    "Fecha",
    "Tipo",
    "Estado",
    "Descripcion",
    "Categoria",
    "Contraparte",
    "Cuenta origen",
    "Monto origen",
    "Moneda origen",
    "Cuenta destino",
    "Monto destino",
    "Moneda destino",
    "Notas",
  ];
  const escape = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const rows = movements.map((m) => [
    escape(m.occurredAt),
    escape(m.movementType),
    escape(m.status),
    escape(m.description),
    escape(m.category ?? ""),
    escape(m.counterparty ?? ""),
    escape(m.sourceAccountName ?? ""),
    escape(m.sourceAmount ?? ""),
    escape(m.sourceCurrencyCode ?? ""),
    escape(m.destinationAccountName ?? ""),
    escape(m.destinationAmount ?? ""),
    escape(m.destinationCurrencyCode ?? ""),
    escape(m.notes ?? ""),
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function MovementsPage() {
  const { profile, user } = useAuth();
  const { accessMessage, canUploadReceipts } = useReceiptFeatureAccess();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;
  const movementColumns: ColumnDef[] = [
    { key: "tipo", label: "Tipo" },
    { key: "estado", label: "Estado" },
    { key: "cuenta_origen", label: "Cuenta origen" },
    { key: "fecha", label: "Fecha" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-movements", movementColumns);
  const [viewMode, setViewMode] = useViewMode("movements");
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [editorMode, setEditorMode] = useState<MovementEditorMode>("create");

  function clearFieldError(field: string) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }
  const [selectedMovementId, setSelectedMovementId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  const [formState, setFormState] = useState<MovementFormState>(() => createDefaultMovementFormState());
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [statusFilter, setStatusFilter] = useState<MovementStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<MovementType | "all">("all");
  const createMovementMutation = useCreateMovementMutation(activeWorkspace?.id, user?.id);
  const updateMovementMutation = useUpdateMovementMutation(activeWorkspace?.id, user?.id);
  const deleteMovementMutation = useDeleteMovementMutation(activeWorkspace?.id, user?.id);
  const createAttachmentRecordMutation = useCreateAttachmentRecordMutation(activeWorkspace?.id, user?.id);
  const deleteAttachmentRecordMutation = useDeleteAttachmentRecordMutation(activeWorkspace?.id, user?.id);
  useSuccessToast(feedbackMessage, {
    clear: () => setFeedbackMessage(""),
    title: "Cambios aplicados",
  });

  const selectedMovement =
    selectedMovementId !== null
      ? snapshot?.movements.find((movement) => movement.id === selectedMovementId) ?? null
      : null;
  const attachmentsQuery = useEntityAttachmentsQuery(
    activeWorkspace?.id,
    "movement",
    isEditorOpen && editorMode === "edit" && selectedMovement ? selectedMovement.id : null,
  );
  const selectedMovementAttachments = attachmentsQuery.data ?? [];
  const isSaving =
    createMovementMutation.isPending ||
    updateMovementMutation.isPending ||
    deleteMovementMutation.isPending ||
    createAttachmentRecordMutation.isPending;
  const isUploadingReceipt =
    createAttachmentRecordMutation.isPending || deleteAttachmentRecordMutation.isPending;

  const filteredMovements = useMemo(() => {
    if (!snapshot) {
      return [];
    }

    const normalizedSearch = searchValue.trim().toLowerCase();

    return snapshot.movements.filter((movement) => {
      if (hiddenIds.has(movement.id)) {
        return false;
      }

      const matchesSearch =
        !normalizedSearch ||
        movement.description.toLowerCase().includes(normalizedSearch) ||
        movement.category.toLowerCase().includes(normalizedSearch) ||
        movement.counterparty.toLowerCase().includes(normalizedSearch) ||
        movement.sourceAccountName?.toLowerCase().includes(normalizedSearch) ||
        movement.destinationAccountName?.toLowerCase().includes(normalizedSearch) ||
        movement.notes?.toLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === "all" || movement.status === statusFilter;
      const matchesType = typeFilter === "all" || movement.movementType === typeFilter;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [hiddenIds, searchValue, snapshot, statusFilter, typeFilter]);
  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredMovements);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const statusFilterPickerOptions = [
    {
      value: "all",
      label: "Todos los estados",
      description: "Muestra cualquier estado.",
      leadingLabel: "TT",
      leadingColor: "#6b7280",
      searchText: "todos estados all",
    },
    ...movementStatusOptions.map((option) => ({
      value: option.value,
      label: option.label,
      description: option.description,
      leadingLabel: option.label.slice(0, 2).toUpperCase(),
      leadingColor: getMovementStatusColor(option.value),
      searchText: `${option.label} ${option.description} ${option.value}`,
    })),
  ];
  const typeFilterPickerOptions = [
    {
      value: "all",
      label: "Todos los tipos",
      description: "Incluye gastos, ingresos y movimientos especiales.",
      leadingLabel: "TT",
      leadingColor: "#6b7280",
      searchText: "todos tipos movimientos all",
    },
    ...movementTypeOptions.map((option) => {
      const visual = getMovementVisualPreset(option.value);

      return {
        value: option.value,
        label: option.label,
        description: option.description,
        leadingLabel: option.label.slice(0, 2).toUpperCase(),
        leadingColor: visual.color,
        searchText: `${option.label} ${option.description} ${option.value}`,
      };
    }),
  ];

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos preparando tu historial de movimientos."
          eyebrow="movimientos"
          title="Cargando movimientos"
        />
        <MovementsLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Necesitamos acceso al espacio que tienes seleccionado para mostrar tus movimientos."
          eyebrow="movimientos"
          title="Movimientos no disponibles"
        />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos cargar tus espacios.")}
          title="No hay acceso al espacio"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Para mostrar movimientos necesitamos un espacio activo."
          eyebrow="movimientos"
          title="Aun no hay un workspace activo"
        />
        <DataState
          description="Cuando tengas un espacio con actividad, aqui veras tus movimientos y su historial."
          title="Sin movimientos para mostrar"
        />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos cargando tu actividad reciente."
          eyebrow="movimientos"
          title="Cargando movimientos"
        />
        <MovementsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Intentamos reunir tus cuentas, categorias, contrapartes y movimientos."
          eyebrow="movimientos"
          title="No fue posible cargar los movimientos"
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer la informacion de movimientos.")}
          title="Error al cargar movimientos"
          tone="error"
        />
      </div>
    );
  }

  const transferCount = snapshot.movements.filter((movement) => movement.movementType === "transfer").length;
  const queuedCount = snapshot.movements.filter(
    (movement) => movement.status === "planned" || movement.status === "pending",
  ).length;
  const latestMovement = snapshot.movements[0] ?? null;
  const hasActiveFilters = Boolean(searchValue.trim()) || statusFilter !== "all" || typeFilter !== "all";

  function openCreateEditor() {
    setFeedbackMessage("");
    setErrorMessage("");
    setEditorMode("create");
    setSelectedMovementId(null);
    setFormState(createDefaultMovementFormState());
    setPendingReceiptFile(null);
    setIsDirty(false);
    setInvalidFields(new Set());
    setIsEditorOpen(true);
  }

  function openEditEditor(movement: MovementRecord) {
    setFeedbackMessage("");
    setErrorMessage("");
    setEditorMode("edit");
    setSelectedMovementId(movement.id);
    setFormState(buildFormStateFromMovement(movement));
    setPendingReceiptFile(null);
    setIsDirty(false);
    setInvalidFields(new Set());
    setIsEditorOpen(true);
  }

  function closeEditor() {
    if (isSaving) {
      return;
    }

    setIsEditorOpen(false);
    setSelectedMovementId(null);
    setPendingReceiptFile(null);
    setErrorMessage("");
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isSaving) return;
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }

  function updateFormState<Field extends keyof MovementFormState>(
    field: Field,
    value: MovementFormState[Field],
  ) {
    setIsDirty(true);
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  async function uploadReceiptForMovement(movementId: number, file: File) {
    if (!activeWorkspace || !user) {
      throw new Error("Necesitamos un usuario y workspace activos para subir comprobantes.");
    }

    const preparedReceipt = await prepareReceiptUpload({
      workspaceId: activeWorkspace.id,
      entityType: "movement",
      entityId: movementId,
      file,
    });

    await uploadPreparedReceipt(preparedReceipt);

    try {
      await createAttachmentRecordMutation.mutateAsync({
        workspaceId: activeWorkspace.id,
        entityType: "movement",
        entityId: movementId,
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
    if (!selectedMovement) {
      setErrorMessage("Guarda primero el movimiento para poder adjuntar comprobantes.");
      return;
    }

    if (!canUploadReceipts) {
      setErrorMessage("Tu plan actual no tiene habilitada la subida de comprobantes.");
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    try {
      await uploadReceiptForMovement(selectedMovement.id, file);
      setFeedbackMessage("Comprobante guardado correctamente.");
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos subir el comprobante."));
    }
  }

  async function handleDeleteReceipt(attachment: AttachmentSummary) {
    if (!activeWorkspace) {
      return;
    }

    if (!canUploadReceipts) {
      setErrorMessage("Tu plan actual no tiene habilitada la gestion de comprobantes.");
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    try {
      await deleteStoredReceipt(attachment.bucketName, attachment.filePath);
      await deleteAttachmentRecordMutation.mutateAsync({
        attachmentId: attachment.id,
        workspaceId: activeWorkspace.id,
      });
      setFeedbackMessage("Comprobante eliminado correctamente.");
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos eliminar el comprobante."));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeWorkspace || !user || !snapshot) {
      return;
    }

    setFeedbackMessage("");
    setErrorMessage("");

    const movErrors: string[] = [];
    const occurredAt = new Date(formState.occurredAt);

    if (!formState.description.trim()) movErrors.push("description");
    if (!formState.occurredAt || Number.isNaN(occurredAt.getTime())) movErrors.push("occurredAt");

    const sourceAccountId = parseOptionalInteger(formState.sourceAccountId);
    const destinationAccountId = parseOptionalInteger(formState.destinationAccountId);
    const categoryId = parseOptionalInteger(formState.categoryId);
    const counterpartyId = parseOptionalInteger(formState.counterpartyId);
    const obligationId = parseOptionalInteger(formState.obligationId);
    const subscriptionId = parseOptionalInteger(formState.subscriptionId);
    const sourceAmount = parseOptionalNumber(formState.sourceAmount);
    const destinationAmount = parseOptionalNumber(formState.destinationAmount);
    const manualFxRate = parseOptionalNumber(formState.fxRate);

    const numericFieldError =
      [sourceAccountId, destinationAccountId, categoryId, counterpartyId, obligationId, subscriptionId].some(
        (value) => value !== null && !Number.isFinite(value),
      ) ||
      [sourceAmount, destinationAmount, manualFxRate].some(
        (value) => value !== null && !Number.isFinite(value),
      );

    if (numericFieldError) {
      setErrorMessage("Revisa los montos y relaciones numericas antes de guardar.");
      return;
    }

    if (sourceAmount !== null && sourceAmount <= 0) movErrors.push("sourceAmount");
    if (destinationAmount !== null && destinationAmount <= 0) movErrors.push("destinationAmount");

    if (manualFxRate !== null && manualFxRate <= 0) {
      setErrorMessage("La tasa de cambio debe ser mayor a cero.");
      return;
    }

    if (sourceAccountId !== null && sourceAmount === null) movErrors.push("sourceAmount");
    if (destinationAccountId !== null && destinationAmount === null) movErrors.push("destinationAmount");

    const hasSourceSide = sourceAccountId !== null && sourceAmount !== null;
    const hasDestinationSide = destinationAccountId !== null && destinationAmount !== null;

    if (formState.movementType === "transfer") {
      if (!hasSourceSide) { movErrors.push("sourceAccountId"); movErrors.push("sourceAmount"); }
      if (!hasDestinationSide) { movErrors.push("destinationAccountId"); movErrors.push("destinationAmount"); }
      if (hasSourceSide && hasDestinationSide && sourceAccountId === destinationAccountId) {
        setErrorMessage("La cuenta origen y destino deben ser distintas en una transferencia.");
        return;
      }
    } else if (expenseLikeMovementTypes.has(formState.movementType)) {
      if (!hasSourceSide) { movErrors.push("sourceAccountId"); movErrors.push("sourceAmount"); }
    } else if (incomeLikeMovementTypes.has(formState.movementType)) {
      if (!hasDestinationSide) { movErrors.push("destinationAccountId"); movErrors.push("destinationAmount"); }
    } else if (!hasSourceSide && !hasDestinationSide) {
      movErrors.push("sourceAccountId"); movErrors.push("sourceAmount");
    }

    if (movErrors.length > 0) {
      setInvalidFields(new Set(movErrors));
      setErrorMessage("Completa los campos requeridos antes de guardar.");
      return;
    }

    let metadata: JsonValue;

    try {
      metadata = parseMetadataValue(formState.metadata);
    } catch {
      setErrorMessage("Metadata JSON no es valido. Revisa comillas, llaves y formato.");
      return;
    }

    const sourceAccount =
      sourceAccountId !== null
        ? snapshot.accounts.find((account) => account.id === sourceAccountId) ?? null
        : null;
    const destinationAccount =
      destinationAccountId !== null
        ? snapshot.accounts.find((account) => account.id === destinationAccountId) ?? null
        : null;
    const inferredFxRate =
      sourceAccount &&
      destinationAccount &&
      sourceAccount.currencyCode !== destinationAccount.currencyCode &&
      sourceAmount !== null &&
      destinationAmount !== null &&
      sourceAmount > 0
        ? destinationAmount / sourceAmount
        : null;

    const payload: MovementFormInput = {
      movementType: formState.movementType,
      status: formState.status,
      occurredAt: occurredAt.toISOString(),
      description: formState.description,
      notes: formState.notes,
      sourceAccountId,
      sourceAmount,
      destinationAccountId,
      destinationAmount,
      fxRate: manualFxRate ?? inferredFxRate,
      categoryId,
      counterpartyId,
      obligationId,
      subscriptionId,
      metadata,
    };

    try {
      if (editorMode === "create") {
        const createdMovementId = await createMovementMutation.mutateAsync({
          ...payload,
          userId: user.id,
          workspaceId: activeWorkspace.id,
        });

        if (pendingReceiptFile && canUploadReceipts) {
          try {
            await uploadReceiptForMovement(createdMovementId, pendingReceiptFile);
            setFeedbackMessage("Movimiento creado y comprobante guardado correctamente.");
          } catch (attachmentError) {
            setFeedbackMessage("Movimiento creado correctamente.");
            setErrorMessage(
              `${getQueryErrorMessage(
                attachmentError,
                "No pudimos subir el comprobante del movimiento.",
              )} El movimiento si quedo guardado.`,
            );
          }
        } else {
          setFeedbackMessage("Movimiento creado correctamente.");
        }

        setPendingReceiptFile(null);
        setIsEditorOpen(false);
        return;
      }

      if (!selectedMovement) {
        setErrorMessage("No encontramos el movimiento que quieres editar.");
        return;
      }

      await updateMovementMutation.mutateAsync({
        ...payload,
        movementId: selectedMovement.id,
        userId: user.id,
        workspaceId: activeWorkspace.id,
      });

      setFeedbackMessage("Movimiento actualizado correctamente.");
      setPendingReceiptFile(null);
      setIsEditorOpen(false);
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos guardar el movimiento."));
    }
  }

  function handleDeleteMovement() {
    if (!activeWorkspace || !selectedMovement) return;
    const targetId = selectedMovement.id;
    setIsEditorOpen(false);
    setSelectedMovementId(null);
    setHiddenIds((prev) => new Set([...prev, targetId]));
    schedule({
      label: "Movimiento eliminado",
      onCommit: () =>
        deleteMovementMutation.mutateAsync({ movementId: targetId, workspaceId: activeWorkspace.id }),
      onUndo: () => {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      },
    });
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  async function confirmBulkDelete() {
    setIsBulkDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await deleteMovementMutation.mutateAsync({ movementId: id, workspaceId: activeWorkspace!.id });
      }
      clearAll();
    } catch (err) {
      setErrorMessage(getQueryErrorMessage(err));
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          actions={
            <>
              <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
              {viewMode === "table" ? (
                <ColumnPicker columns={movementColumns} visible={colVis} onToggle={toggleCol} />
              ) : null}
              <Button
                onClick={() =>
                  downloadMovementsCSV(
                    filteredMovements,
                    `movimientos-${new Date().toISOString().slice(0, 10)}.csv`,
                  )
                }
                variant="ghost"
              >
                <Download className="mr-2 h-4 w-4" />
                Exportar CSV
              </Button>
              <Button onClick={openCreateEditor}>
                <Plus className="mr-2 h-4 w-4" />
                Nuevo movimiento
              </Button>
            </>
          }
          description="Registra y organiza tus movimientos con cuentas, estados, categorias y relaciones en un solo lugar."
          eyebrow="movimientos"
          title="Libro de movimientos"
        >
          <div className="flex flex-wrap gap-3 text-sm text-storm">
            <StatusBadge status={`${snapshot.movements.length} movimientos`} tone="neutral" />
            <StatusBadge status={`${snapshot.metrics.postedCount} aplicados`} tone="success" />
            <StatusBadge status={`${queuedCount} por revisar`} tone="warning" />
            <StatusBadge status={formatWorkspaceKindLabel(snapshot.workspace.kind)} tone="info" />
            {snapshotQuery.isFetching ? (
              <StatusBadge
                className="animate-soft-pulse"
                status="Actualizando"
                tone="neutral"
              />
            ) : null}
          </div>
        </PageHeader>

        {errorMessage && !isEditorOpen ? (
          <DataState
            description={errorMessage}
            title="No pudimos completar la accion"
            tone="error"
          />
        ) : null}
        <SurfaceCard
          action={<Filter className="h-5 w-5 text-gold" />}
          className="relative z-20 overflow-visible"
          description="Busca por descripcion, cuenta, contraparte o categoria y filtra por estado o tipo."
          title="Explorar movimientos"
        >
          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.75fr_0.9fr_auto]">
            <div className="flex items-center gap-2">
              <button
                className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
                disabled={snapshotQuery.isFetching}
                onClick={() => snapshotQuery.refetch()}
                title="Actualizar"
                type="button"
              >
                <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
              </button>
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
                <EditorInput
                  className="pl-11 sm:pl-11"
                  onChange={(event) => setSearchValue(event.target.value)}
                  placeholder="Buscar por descripcion, categoria, cuenta o contraparte..."
                  value={searchValue}
                />
              </div>
            </div>

            <SearchablePicker
              emptyMessage="No encontramos un estado con ese termino."
              onChange={(nextValue) => setStatusFilter(nextValue as MovementStatus | "all")}
              options={statusFilterPickerOptions}
              placeholderDescription="Filtra por estado del movimiento."
              placeholderLabel="Todos los estados"
              queryPlaceholder="Buscar estado..."
              value={statusFilter}
            />

            <SearchablePicker
              emptyMessage="No encontramos un tipo con ese termino."
              onChange={(nextValue) => setTypeFilter(nextValue as MovementType | "all")}
              options={typeFilterPickerOptions}
              placeholderDescription="Filtra por tipo operativo."
              placeholderLabel="Todos los tipos"
              queryPlaceholder="Buscar tipo..."
              value={typeFilter}
            />

            <Button
              disabled={!hasActiveFilters}
              onClick={() => {
                setSearchValue("");
                setStatusFilter("all");
                setTypeFilter("all");
              }}
              variant="ghost"
            >
              Limpiar filtros
            </Button>
          </div>
        </SurfaceCard>

        <SurfaceCard
          action={<StatusBadge status={`${filteredMovements.length} visibles`} tone="neutral" />}
          className="relative z-10"
          description="Revisa tus movimientos, abre cualquiera para editarlo o eliminalo si ya no lo necesitas."
          title="Actividad financiera"
        >
          {filteredMovements.length === 0 ? (
            <DataState
              action={
                hasActiveFilters ? (
                  <Button
                    onClick={() => {
                      setSearchValue("");
                      setStatusFilter("all");
                      setTypeFilter("all");
                    }}
                    variant="secondary"
                  >
                    Quitar filtros
                  </Button>
                ) : (
                  <Button onClick={openCreateEditor}>Crear primer movimiento</Button>
                )
              }
              description={
                hasActiveFilters
                  ? "No hay movimientos que coincidan con los filtros actuales."
                  : "Todavia no hay movimientos registrados en este espacio."
              }
              title={hasActiveFilters ? "Sin resultados" : "Sin movimientos"}
            />
          ) : viewMode === "list" ? (
            <div className="space-y-2">
              {filteredMovements.map((movement) => {
                const movementTypeOption = getMovementTypeOption(movement.movementType);
                const sourceCurrencyCode = movement.sourceCurrencyCode ?? snapshot.workspace.baseCurrencyCode;
                return (
                  <article className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-3.5 transition hover:border-white/16" key={movement.id}>
                    <SelectionCheckbox
                      checked={selectedIds.has(movement.id)}
                      onChange={() => toggleSelect(movement.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-ink">{movement.description}</p>
                      <p className="text-xs text-storm">{movement.category} · {movement.counterparty} · {formatDateTime(movement.occurredAt)}</p>
                    </div>
                    <div className="hidden sm:flex gap-2">
                      <StatusBadge status={movementTypeOption.label} tone={getMovementTypeTone(movement.movementType)} />
                      <StatusBadge status={formatMovementStatusLabel(movement.status)} tone={getMovementStatusTone(movement.status)} />
                    </div>
                    {movement.sourceAmount !== null ? <p className="text-sm font-semibold text-ink shrink-0">{formatCurrency(movement.sourceAmount, sourceCurrencyCode)}</p> : null}
                    <Button className="py-1.5 text-xs shrink-0" onClick={() => openEditEditor(movement)} variant="ghost">Ver</Button>
                  </article>
                );
              })}
            </div>
          ) : viewMode === "table" ? (
            <div className="overflow-x-auto rounded-[24px] border border-white/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02]">
                    <th className="w-10 px-4 py-3">
                      <SelectionCheckbox
                        ariaLabel="Seleccionar todos"
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={() => (allSelected ? clearAll() : selectAll())}
                      />
                    </th>
                    <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Descripcion</th>
                    <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("tipo", "hidden sm:table-cell")}`}>Tipo</th>
                    <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("estado", "hidden sm:table-cell")}`}>Estado</th>
                    <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("cuenta_origen", "hidden md:table-cell")}`}>Cuenta origen</th>
                    <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Monto</th>
                    <th className={`px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("fecha", "hidden md:table-cell")}`}>Fecha</th>
                    <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((movement, index) => {
                    const movementTypeOption = getMovementTypeOption(movement.movementType);
                    const sourceCurrencyCode = movement.sourceCurrencyCode ?? snapshot.workspace.baseCurrencyCode;
                    return (
                      <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === filteredMovements.length - 1 ? "border-b-0" : ""}`} key={movement.id}>
                        <td className="w-10 px-4 py-3.5">
                          <SelectionCheckbox
                            ariaLabel={`Seleccionar ${movement.description}`}
                            checked={selectedIds.has(movement.id)}
                            onChange={() => toggleSelect(movement.id)}
                          />
                        </td>
                        <td className="px-5 py-3.5 font-medium text-ink">{movement.description}</td>
                        <td className={`px-5 py-3.5 ${cv("tipo", "hidden sm:table-cell")}`}><StatusBadge status={movementTypeOption.label} tone={getMovementTypeTone(movement.movementType)} /></td>
                        <td className={`px-5 py-3.5 ${cv("estado", "hidden sm:table-cell")}`}><StatusBadge status={formatMovementStatusLabel(movement.status)} tone={getMovementStatusTone(movement.status)} /></td>
                        <td className={`px-5 py-3.5 text-storm ${cv("cuenta_origen", "hidden md:table-cell")}`}>{movement.sourceAccountName ?? "-"}</td>
                        <td className="px-5 py-3.5 text-right font-medium text-ink">{movement.sourceAmount !== null ? formatCurrency(movement.sourceAmount, sourceCurrencyCode) : "-"}</td>
                        <td className={`px-5 py-3.5 text-right text-storm ${cv("fecha", "hidden md:table-cell")}`}>{formatDateTime(movement.occurredAt)}</td>
                        <td className="px-5 py-3.5 text-right">
                          <Button className="py-1.5 text-xs" onClick={() => openEditEditor(movement)} variant="ghost">Ver</Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredMovements.map((movement) => {
                const movementTypeOption = getMovementTypeOption(movement.movementType);
                const sourceCurrencyCode = movement.sourceCurrencyCode ?? snapshot.workspace.baseCurrencyCode;
                const destinationCurrencyCode =
                  movement.destinationCurrencyCode ?? snapshot.workspace.baseCurrencyCode;
                const isSelected = selectedIds.has(movement.id);
                const longPressHandlers = createLongPressHandlers(() => toggleSelect(movement.id));

                return (
                  <article
                    className={`glass-panel-soft relative rounded-[28px] p-5 transition duration-200 hover:border-white/16 ${isSelected ? "ring-2 ring-pine/30 border-pine/25" : ""}`}
                    key={movement.id}
                    onClick={(e) => {
                      if (wasRecentLongPress()) return;
                      if (selectedCount === 0) return;
                      if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
                      toggleSelect(movement.id);
                    }}
                    {...longPressHandlers}
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-3">
                            <p className="font-medium text-ink">{movement.description}</p>
                            <StatusBadge
                              status={movementTypeOption.label}
                              tone={getMovementTypeTone(movement.movementType)}
                            />
                            <StatusBadge
                              status={formatMovementStatusLabel(movement.status)}
                              tone={getMovementStatusTone(movement.status)}
                            />
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-sm text-storm">
                            <span>{movement.category}</span>
                            <span className="text-white/20">/</span>
                            <span>{movement.counterparty}</span>
                            <span className="text-white/20">/</span>
                            <span>{formatDateTime(movement.occurredAt)}</span>
                          </div>

                          {movement.notes ? (
                            <p className="max-w-4xl text-sm leading-7 text-storm">{movement.notes}</p>
                          ) : null}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button
                            onClick={() => openEditEditor(movement)}
                            variant="secondary"
                          >
                            <PencilLine className="mr-2 h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            onClick={() => {
                              openEditEditor(movement);
                            }}
                            variant="ghost"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Revisar o eliminar
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_0.8fr]">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Origen</p>
                          <p className="mt-2 text-sm font-medium text-ink">
                            {movement.sourceAccountName ?? "Sin salida"}
                          </p>
                          <p className="mt-1 text-sm text-storm">
                            {movement.sourceAmount !== null
                              ? formatCurrency(movement.sourceAmount, sourceCurrencyCode)
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Destino</p>
                          <p className="mt-2 text-sm font-medium text-ink">
                            {movement.destinationAccountName ?? "Sin destino"}
                          </p>
                          <p className="mt-1 text-sm text-storm">
                            {movement.destinationAmount !== null
                              ? formatCurrency(movement.destinationAmount, destinationCurrencyCode)
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                          <p className="text-xs uppercase tracking-[0.18em] text-storm">Relacion</p>
                          <p className="mt-2 text-sm font-medium text-ink">
                            {movement.subscriptionId
                              ? "Ligado a suscripcion"
                              : movement.obligationId
                                ? "Ligado a obligacion"
                                : "Libre"}
                          </p>
                          <p className="mt-1 text-sm text-storm">
                            {movement.fxRate
                              ? `FX ${movement.fxRate.toFixed(6)}`
                              : movement.metadata &&
                                  typeof movement.metadata === "object" &&
                                  !Array.isArray(movement.metadata) &&
                                  Object.keys(movement.metadata).length > 0
                                ? "Con detalles adicionales"
                                : "Sin extras"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard
          action={<Sparkles className="h-5 w-5 text-gold" />}
          description="Una vista rapida de tu actividad, tus estados y tus movimientos recientes."
          title="Resumen de movimientos"
        >
          <div className="grid gap-4 md:grid-cols-4">
            <div className="glass-panel-soft rounded-[26px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Movimientos aplicados</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">
                {snapshot.metrics.postedCount}
              </p>
              <p className="mt-2 text-sm text-storm">Ya forman parte de tus balances y reportes.</p>
            </div>

            <div className="glass-panel-soft rounded-[26px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">En cola</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{queuedCount}</p>
              <p className="mt-2 text-sm text-storm">Movimientos pendientes o planeados por completar.</p>
            </div>

            <div className="glass-panel-soft rounded-[26px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Transferencias</p>
              <p className="mt-3 font-display text-3xl font-semibold text-ink">{transferCount}</p>
              <p className="mt-2 text-sm text-storm">Movimientos internos entre cuentas.</p>
            </div>

            <div className="glass-panel-soft rounded-[26px] p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Ultimo registro</p>
              <p className="mt-3 text-lg font-medium text-ink">
                {latestMovement ? formatDateTime(latestMovement.occurredAt) : "Sin actividad"}
              </p>
              <p className="mt-2 text-sm text-storm">
                {latestMovement ? latestMovement.description : "Aun no hay movimientos registrados."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-start gap-3">
                <ArrowLeftRight className="mt-1 h-5 w-5 text-ember" />
                <div>
                  <p className="font-medium text-ink">Todo en un solo lugar</p>
                  <p className="mt-2 text-sm leading-7 text-storm">
                    Desde aqui puedes registrar, editar y organizar tus movimientos con cuentas,
                    notas, conversiones y relaciones con suscripciones u obligaciones.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-void/70 p-4">
                  <ArrowDownCircle className="h-5 w-5 text-rosewood" />
                  <p className="mt-3 text-sm font-medium text-ink">Salidas</p>
                  <p className="mt-1 text-sm text-storm">
                    {snapshot.movements.filter((movement) => expenseLikeMovementTypes.has(movement.movementType)).length}{" "}
                    registradas
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-void/70 p-4">
                  <ArrowUpCircle className="h-5 w-5 text-pine" />
                  <p className="mt-3 text-sm font-medium text-ink">Entradas</p>
                  <p className="mt-1 text-sm text-storm">
                    {snapshot.movements.filter((movement) => incomeLikeMovementTypes.has(movement.movementType)).length}{" "}
                    registradas
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-void/70 p-4">
                  <CalendarClock className="h-5 w-5 text-gold" />
                  <p className="mt-3 text-sm font-medium text-ink">Organizacion</p>
                  <p className="mt-1 text-sm text-storm">
                    {snapshot.catalogs.categoriesCount} categorias y {snapshot.catalogs.counterpartiesCount} contrapartes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>

      {isEditorOpen ? (
        <MovementEditorDialog
          accounts={snapshot.accounts}
          accessMessage={accessMessage}
          attachments={selectedMovementAttachments}
          baseCurrencyCode={snapshot.workspace.baseCurrencyCode}
          canManageReceipts={canUploadReceipts}
          categories={snapshot.catalogs.categories}
          closeEditor={requestCloseEditor}
          counterparties={snapshot.catalogs.counterparties}
          errorMessage={errorMessage}
          formState={formState}
          handleDeleteMovement={handleDeleteMovement}
          handleDeleteReceipt={handleDeleteReceipt}
          handleUploadReceipt={handleUploadReceipt}
          handleSubmit={handleSubmit}
          clearFieldError={clearFieldError}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSaving}
          isUploadingReceipt={isUploadingReceipt}
          obligations={snapshot.obligations}
          pendingReceiptFile={pendingReceiptFile}
          selectedMovement={selectedMovement}
          subscriptions={snapshot.subscriptions}
          updatePendingReceiptFile={setPendingReceiptFile}
          updateFormState={updateFormState}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}
      <BulkActionBar
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadMovementsCSV(selectedItems, `movimientos-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredMovements.length}
      />
      {showBulkDeleteConfirm ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d1520] p-6">
            <h2 className="font-display text-xl font-semibold text-ink">
              Eliminar {selectedCount} movimiento{selectedCount !== 1 ? "s" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Esta accion eliminara permanentemente los elementos seleccionados y no se puede deshacer.
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
    </>
  );
}
