import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  Check,
  ChevronDown,
  LoaderCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { StatusBadge } from "../../../components/ui/status-badge";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { PendingReceiptField } from "../../attachments/components/pending-receipt-field";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  deleteStoredReceipt,
  prepareReceiptUpload,
  uploadPreparedReceipt,
} from "../../attachments/receipt-utils";
import { useReceiptFeatureAccess } from "../../attachments/use-receipt-feature-access";
import { ContactQuickCreateDialog } from "../../contacts/components/contact-quick-create-dialog";
import type { AccountSummary, CategorySummary, CounterpartySummary } from "../../../types/domain";
import {
  useCreateAttachmentRecordMutation,
  getQueryErrorMessage,
  type WorkspaceSnapshot,
  useCreateMovementMutation,
} from "../../../services/queries/workspace-data";

export type QuickMovementKind = "expense" | "income" | "transfer";

type QuickMovementDialogProps = {
  initialKind: QuickMovementKind;
  onClose: () => void;
  onCreated: (message: string) => void;
  snapshot: WorkspaceSnapshot;
  userId: string;
  workspaceId: number;
};

type QuickMovementFormState = {
  accountId: string;
  amount: string;
  categoryId: string;
  counterpartyId: string;
  description: string;
  destinationAccountId: string;
  destinationAmount: string;
  occurredAt: string;
  sourceAccountId: string;
};

type QuickFieldProps = {
  children: ReactNode;
  errorKey?: string;
  hint?: string;
  invalidFields?: Set<string>;
  label: string;
};

type PickerOption = {
  value: string;
  label: string;
  description: string;
  leadingLabel: string;
  leadingColor?: string;
  searchText?: string;
};

type QuickPickerProps = {
  actionDescription?: string;
  actionLabel?: string;
  actionLeadingColor?: string;
  actionLeadingLabel?: string;
  value: string;
  onChange: (value: string) => void;
  onAction?: () => void;
  options: PickerOption[];
  placeholderLabel: string;
  placeholderDescription: string;
  queryPlaceholder: string;
  emptyMessage: string;
};

const quickFieldClassName =
  "w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";
const quickInputClassName = `${quickFieldClassName} h-12 sm:h-16`;
const quickFieldLabelClassName =
  "text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80";
const quickFieldHintClassName = "mt-1.5 sm:mt-2 break-words text-xs leading-6 text-storm/75";
const quickPickerTriggerClassName = `${quickFieldClassName} flex h-12 sm:h-16 items-center justify-between gap-3 text-left`;
const quickPickerSearchInputClassName =
  "w-full rounded-[22px] border border-white/10 bg-[#101928] py-3.5 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const quickMovementModes: Array<{
  kind: QuickMovementKind;
  label: string;
  description: string;
  color: string;
  icon: typeof ArrowDownCircle;
  cta: string;
}> = [
  {
    kind: "expense",
    label: "Nuevo gasto",
    description: "Registra una salida de dinero desde una cuenta existente.",
    color: "#8f3e3e",
    icon: ArrowDownCircle,
    cta: "Guardar gasto",
  },
  {
    kind: "income",
    label: "Nuevo ingreso",
    description: "Registra una entrada de dinero a una cuenta del workspace.",
    color: "#1b6a58",
    icon: ArrowUpCircle,
    cta: "Guardar ingreso",
  },
  {
    kind: "transfer",
    label: "Transferencia",
    description: "Mueve saldo entre dos cuentas sin pasar por el formulario completo.",
    color: "#4566d6",
    icon: ArrowLeftRight,
    cta: "Guardar transferencia",
  },
];

function toDateTimeLocalValue(value: string) {
  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return "";
  }

  const timezoneOffsetInMs = parsedDate.getTimezoneOffset() * 60_000;
  return new Date(parsedDate.getTime() - timezoneOffsetInMs).toISOString().slice(0, 16);
}

function createDefaultQuickMovementFormState(): QuickMovementFormState {
  return {
    accountId: "",
    amount: "",
    categoryId: "",
    counterpartyId: "",
    description: "",
    destinationAccountId: "",
    destinationAmount: "",
    occurredAt: toDateTimeLocalValue(new Date().toISOString()),
    sourceAccountId: "",
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

function useQuickPickerPanel(isOpen: boolean, onClose: () => void) {
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

function getQuickMovementMode(kind: QuickMovementKind) {
  return quickMovementModes.find((mode) => mode.kind === kind) ?? quickMovementModes[0];
}

function getQuickPickerTriggerStyle(isOpen: boolean) {
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

function getQuickPickerOptionStyle(isSelected: boolean) {
  return {
    borderColor: isSelected ? "rgba(107, 228, 197, 0.18)" : "rgba(255, 255, 255, 0.04)",
    background: isSelected
      ? "linear-gradient(180deg, rgba(18, 31, 41, 0.98), rgba(12, 22, 33, 0.98))"
      : "linear-gradient(180deg, rgba(14, 21, 32, 0.96), rgba(11, 17, 26, 0.96))",
    boxShadow: isSelected ? "0 12px 30px rgba(0, 0, 0, 0.18)" : "none",
  };
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

function filterQuickCategories(
  categories: CategorySummary[],
  kind: QuickMovementKind,
  selectedCategoryId: number | null,
) {
  if (kind === "transfer") {
    return [];
  }

  return categories.filter((category) => {
    if (selectedCategoryId === category.id) {
      return true;
    }

    if (!category.isActive) {
      return false;
    }

    if (kind === "expense") {
      return category.kind === "expense" || category.kind === "both";
    }

    return category.kind === "income" || category.kind === "both";
  });
}

function buildQuickMovementDescription(
  kind: QuickMovementKind,
  account: AccountSummary | null,
  sourceAccount: AccountSummary | null,
  destinationAccount: AccountSummary | null,
  category: CategorySummary | null,
  counterparty: CounterpartySummary | null,
) {
  if (kind === "transfer") {
    if (sourceAccount && destinationAccount) {
      return `Transferencia ${sourceAccount.name} -> ${destinationAccount.name}`;
    }

    return "Transferencia interna";
  }

  if (category?.name && counterparty?.name) {
    return `${category.name} · ${counterparty.name}`;
  }

  if (category?.name) {
    return category.name;
  }

  if (counterparty?.name) {
    return `${kind === "expense" ? "Pago" : "Ingreso"} · ${counterparty.name}`;
  }

  if (account?.name) {
    return `${kind === "expense" ? "Gasto" : "Ingreso"} en ${account.name}`;
  }

  return kind === "expense" ? "Gasto rapido" : "Ingreso rapido";
}

function QuickField({ children, errorKey, hint, invalidFields, label }: QuickFieldProps) {
  const hasError = Boolean(errorKey && invalidFields?.has(errorKey));
  return (
    <label className="block min-w-0">
      <span className={quickFieldLabelClassName}>{label}</span>
      <div
        className={`mt-3 ${hasError ? "field-error-ring" : ""}`}
        data-field={errorKey}
      >
        {children}
      </div>
      {hint ? <p className={quickFieldHintClassName}>{hint}</p> : null}
    </label>
  );
}

function QuickInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`${quickInputClassName} ${className}`}
      {...props}
    />
  );
}

function QuickPicker({
  actionDescription,
  actionLabel,
  actionLeadingColor,
  actionLeadingLabel,
  emptyMessage,
  onChange,
  onAction,
  options,
  placeholderDescription,
  placeholderLabel,
  queryPlaceholder,
  value,
}: QuickPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useQuickPickerPanel(isOpen, () => setIsOpen(false));
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
        className={quickPickerTriggerClassName}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        style={getQuickPickerTriggerStyle(isOpen)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-10 min-w-[3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            style={{
              backgroundColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}22` : undefined,
              color: selectedOption?.leadingColor ? "#ffffff" : undefined,
              borderColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}55` : undefined,
            }}
          >
            {selectedOption?.leadingLabel ?? "?"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">
              {selectedOption ? selectedOption.label : placeholderLabel}
            </span>
            <span className="mt-1 block truncate text-xs text-storm">
              {selectedOption ? selectedOption.description : placeholderDescription}
            </span>
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <div className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,15,24,0.98),rgba(8,12,20,0.98))] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <input
              autoFocus
              className={quickPickerSearchInputClassName}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={queryPlaceholder}
              type="text"
              value={query}
            />
          </div>

          {onAction && actionLabel ? (
            <button
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-[24px] border border-dashed border-pine/25 bg-[linear-gradient(180deg,rgba(16,31,36,0.96),rgba(10,22,24,0.96))] px-4 py-3.5 text-left text-ink transition duration-200 hover:border-pine/35 hover:bg-[linear-gradient(180deg,rgba(18,35,40,0.98),rgba(12,25,28,0.98))]"
              onClick={() => {
                setIsOpen(false);
                onAction();
              }}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span
                  className="flex h-11 min-w-[3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
                  style={{
                    backgroundColor: actionLeadingColor ? `${actionLeadingColor}22` : undefined,
                    color: actionLeadingColor ? "#ffffff" : undefined,
                    borderColor: actionLeadingColor ? `${actionLeadingColor}55` : undefined,
                  }}
                >
                  {actionLeadingLabel ?? "+"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{actionLabel}</span>
                  <span className="mt-1 block truncate text-xs text-storm">
                    {actionDescription ?? "Agrega un nuevo registro sin salir de este flujo."}
                  </span>
                </span>
              </span>
              <Sparkles className="h-4 w-4 shrink-0 text-pine" />
            </button>
          ) : null}

          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredOptions.length ? (
              filteredOptions.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    className={`flex w-full items-center justify-between gap-3 rounded-[24px] border px-4 py-3.5 text-left transition duration-200 ${
                      isSelected ? "text-ink" : "text-storm hover:text-ink"
                    }`}
                    key={`${option.value}-${option.label}`}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    style={getQuickPickerOptionStyle(isSelected)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-11 min-w-[3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
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
              <div className="rounded-[22px] border border-white/8 bg-white/[0.03] px-4 py-5 text-sm text-storm">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function QuickMovementDialog({
  initialKind,
  onClose,
  onCreated,
  snapshot,
  userId,
  workspaceId,
}: QuickMovementDialogProps) {
  const { accessMessage, canUploadReceipts } = useReceiptFeatureAccess();
  const [kind, setKind] = useState<QuickMovementKind>(initialKind);
  const [formState, setFormState] = useState<QuickMovementFormState>(() =>
    createDefaultQuickMovementFormState(),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [inlineCounterparties, setInlineCounterparties] = useState<CounterpartySummary[]>([]);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const createMovementMutation = useCreateMovementMutation(workspaceId, userId);
  const createAttachmentRecordMutation = useCreateAttachmentRecordMutation(workspaceId, userId);
  const visibleAccounts = useMemo(
    () => snapshot.accounts.filter((account) => !account.isArchived),
    [snapshot.accounts],
  );
  const availableCounterparties = useMemo(() => {
    const counterpartyMap = new Map<number, CounterpartySummary>();

    for (const counterparty of snapshot.catalogs.counterparties) {
      counterpartyMap.set(counterparty.id, counterparty);
    }

    for (const counterparty of inlineCounterparties) {
      counterpartyMap.set(counterparty.id, counterparty);
    }

    return [...counterpartyMap.values()];
  }, [inlineCounterparties, snapshot.catalogs.counterparties]);
  const activeCounterparties = useMemo(
    () => availableCounterparties.filter((counterparty) => !counterparty.isArchived),
    [availableCounterparties],
  );
  const selectedCategoryId = parseOptionalInteger(formState.categoryId);
  const filteredCategories = useMemo(
    () =>
      filterQuickCategories(
        snapshot.catalogs.categories,
        kind,
        Number.isFinite(selectedCategoryId) ? selectedCategoryId : null,
      ),
    [kind, selectedCategoryId, snapshot.catalogs.categories],
  );
  const selectedAccount =
    visibleAccounts.find((account) => account.id === parseOptionalInteger(formState.accountId)) ?? null;
  const selectedSourceAccount =
    visibleAccounts.find((account) => account.id === parseOptionalInteger(formState.sourceAccountId)) ?? null;
  const selectedDestinationAccount =
    visibleAccounts.find((account) => account.id === parseOptionalInteger(formState.destinationAccountId)) ?? null;
  const selectedCategory =
    snapshot.catalogs.categories.find((category) => category.id === parseOptionalInteger(formState.categoryId)) ?? null;
  const selectedCounterparty =
    availableCounterparties.find(
      (counterparty) => counterparty.id === parseOptionalInteger(formState.counterpartyId),
    ) ?? null;
  const selectedMode = getQuickMovementMode(kind);
  const QuickModeIcon = selectedMode.icon;
  const isSaving = createMovementMutation.isPending || createAttachmentRecordMutation.isPending;
  const isTransfer = kind === "transfer";
  const hasTransferCurrencyMismatch =
    Boolean(selectedSourceAccount && selectedDestinationAccount) &&
    selectedSourceAccount?.currencyCode !== selectedDestinationAccount?.currencyCode;
  const minimumAccountsRequired = isTransfer ? 2 : 1;
  const computedAmount = parseOptionalNumber(formState.amount) ?? 0;
  const computedDestinationAmount = hasTransferCurrencyMismatch
    ? parseOptionalNumber(formState.destinationAmount) ?? 0
    : computedAmount;
  const previewCurrencyCode = isTransfer
    ? selectedSourceAccount?.currencyCode ??
      selectedDestinationAccount?.currencyCode ??
      snapshot.workspace.baseCurrencyCode
    : selectedAccount?.currencyCode ?? snapshot.workspace.baseCurrencyCode;
  const previewTitle =
    formState.description.trim() ||
    buildQuickMovementDescription(
      kind,
      selectedAccount,
      selectedSourceAccount,
      selectedDestinationAccount,
      selectedCategory,
      selectedCounterparty,
    );
  const previewFlowLabel = isTransfer
    ? selectedSourceAccount && selectedDestinationAccount
      ? `${selectedSourceAccount.name} -> ${selectedDestinationAccount.name}`
      : "Define las cuentas de origen y destino"
    : kind === "expense"
      ? selectedAccount
        ? `Sale desde ${selectedAccount.name}`
        : "Selecciona la cuenta desde donde sale"
      : selectedAccount
        ? `Entra a ${selectedAccount.name}`
        : "Selecciona la cuenta que recibe";
  const previewContextLabel = isTransfer
    ? hasTransferCurrencyMismatch
      ? "Transferencia con conversion"
      : "Transferencia interna directa"
    : selectedCounterparty?.name ?? selectedCategory?.name ?? "Sin contexto adicional";
  const previewDateLabel = formState.occurredAt
    ? formatDateTime(new Date(formState.occurredAt).toISOString())
    : "Sin fecha definida";
  const transferFxRate =
    hasTransferCurrencyMismatch && computedAmount > 0 && computedDestinationAmount > 0
      ? computedDestinationAmount / computedAmount
      : null;

  useEffect(() => {
    setKind(initialKind);
    setErrorMessage("");
    setInvalidFields(new Set());
    setPendingReceiptFile(null);
  }, [initialKind]);

  useEffect(() => {
    if (invalidFields.size === 0) return;
    const firstField = [...invalidFields][0];
    const el = document.querySelector<HTMLElement>(`[data-field="${firstField}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      const inner = el.querySelector<HTMLElement>("input,button,textarea,select");
      if (inner) inner.focus();
    }, 300);
    document.querySelectorAll<HTMLElement>(".field-error-shake").forEach((node) => {
      node.classList.remove("field-error-shake");
      void node.offsetWidth;
      node.classList.add("field-error-shake");
    });
    document.querySelectorAll<HTMLElement>(`[data-field]`).forEach((node) => {
      if (invalidFields.has(node.getAttribute("data-field") ?? "")) {
        node.classList.remove("field-error-shake");
        void node.offsetWidth;
        node.classList.add("field-error-shake");
      }
    });
  }, [invalidFields]);

  function clearFieldError(field: string) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }

  function updateFormState<Field extends keyof QuickMovementFormState>(
    field: Field,
    value: QuickMovementFormState[Field],
  ) {
    setIsDirty(true);
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function requestClose() {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  }

  async function uploadReceiptForMovement(movementId: number, file: File) {
    const preparedReceipt = await prepareReceiptUpload({
      workspaceId,
      entityType: "movement",
      entityId: movementId,
      file,
    });

    await uploadPreparedReceipt(preparedReceipt);

    try {
      await createAttachmentRecordMutation.mutateAsync({
        workspaceId,
        entityType: "movement",
        entityId: movementId,
        bucketName: preparedReceipt.bucketName,
        filePath: preparedReceipt.filePath,
        fileName: preparedReceipt.fileName,
        mimeType: preparedReceipt.mimeType,
        sizeBytes: preparedReceipt.sizeBytes,
        width: preparedReceipt.width,
        height: preparedReceipt.height,
        uploadedByUserId: userId,
      });
    } catch (error) {
      await deleteStoredReceipt(preparedReceipt.bucketName, preparedReceipt.filePath).catch(() => undefined);
      throw error;
    }
  }

  function openContactDialog() {
    setIsContactDialogOpen(true);
  }

  function handleContactCreated(contact: CounterpartySummary) {
    setInlineCounterparties((currentCounterparties) => {
      if (currentCounterparties.some((item) => item.id === contact.id)) {
        return currentCounterparties;
      }

      return [...currentCounterparties, contact];
    });
    updateFormState("counterpartyId", String(contact.id));
    setIsContactDialogOpen(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const occurredAt = new Date(formState.occurredAt);

    if (Number.isNaN(occurredAt.getTime())) {
      setInvalidFields(new Set(["occurredAt"]));
      setErrorMessage("La fecha del movimiento no es valida.");
      return;
    }

    try {
      if (kind === "expense" || kind === "income") {
        const accountId = parseOptionalInteger(formState.accountId);
        const amount = parseOptionalNumber(formState.amount);
        const categoryId = parseOptionalInteger(formState.categoryId);
        const counterpartyId = parseOptionalInteger(formState.counterpartyId);

        const qErrors: string[] = [];
        if (accountId === null || !Number.isFinite(accountId)) qErrors.push("accountId");
        if (amount === null || !Number.isFinite(amount) || amount <= 0) qErrors.push("amount");
        if (qErrors.length > 0) {
          setInvalidFields(new Set(qErrors));
          setErrorMessage("Completa los campos requeridos antes de guardar.");
          return;
        }

        const description =
          formState.description.trim() ||
          buildQuickMovementDescription(
            kind,
            selectedAccount,
            null,
            null,
            selectedCategory,
            selectedCounterparty,
          );

        const createdMovementId = await createMovementMutation.mutateAsync({
          categoryId: categoryId !== null && Number.isFinite(categoryId) ? categoryId : null,
          counterpartyId:
            counterpartyId !== null && Number.isFinite(counterpartyId) ? counterpartyId : null,
          description,
          destinationAccountId: kind === "income" ? accountId : null,
          destinationAmount: kind === "income" ? amount : null,
          fxRate: null,
          metadata: { channel: "quick-entry", entryKind: kind },
          movementType: kind,
          notes: null,
          obligationId: null,
          occurredAt: occurredAt.toISOString(),
          sourceAccountId: kind === "expense" ? accountId : null,
          sourceAmount: kind === "expense" ? amount : null,
          status: "posted",
          subscriptionId: null,
          userId,
          workspaceId,
        });

        if (pendingReceiptFile && canUploadReceipts) {
          try {
            await uploadReceiptForMovement(createdMovementId, pendingReceiptFile);
            onCreated(
              `${selectedMode.label} guardado con su comprobante por ${formatCurrency(amount, selectedAccount?.currencyCode ?? snapshot.workspace.baseCurrencyCode)}.`,
            );
          } catch {
            onCreated(
              `${selectedMode.label} guardado por ${formatCurrency(amount, selectedAccount?.currencyCode ?? snapshot.workspace.baseCurrencyCode)}, pero el comprobante quedo pendiente.`,
            );
          }
        } else {
          onCreated(
            `${selectedMode.label} guardado por ${formatCurrency(amount, selectedAccount?.currencyCode ?? snapshot.workspace.baseCurrencyCode)}.`,
          );
        }

        setPendingReceiptFile(null);
        onClose();
        return;
      }

      const sourceAccountId = parseOptionalInteger(formState.sourceAccountId);
      const destinationAccountId = parseOptionalInteger(formState.destinationAccountId);
      const sourceAmount = parseOptionalNumber(formState.amount);
      const destinationAmount = hasTransferCurrencyMismatch
        ? parseOptionalNumber(formState.destinationAmount)
        : sourceAmount;

      const tErrors: string[] = [];
      if (sourceAccountId === null || !Number.isFinite(sourceAccountId)) tErrors.push("sourceAccountId");
      if (destinationAccountId === null || !Number.isFinite(destinationAccountId)) tErrors.push("destinationAccountId");
      if (sourceAmount === null || !Number.isFinite(sourceAmount) || sourceAmount <= 0) tErrors.push("amount");
      if (hasTransferCurrencyMismatch && (destinationAmount === null || !Number.isFinite(destinationAmount) || destinationAmount <= 0)) tErrors.push("destinationAmount");

      if (tErrors.length === 0 && sourceAccountId === destinationAccountId) {
        setErrorMessage("La cuenta origen y destino deben ser distintas.");
        return;
      }

      if (tErrors.length > 0) {
        setInvalidFields(new Set(tErrors));
        setErrorMessage("Completa los campos requeridos antes de guardar.");
        return;
      }

      const description =
        formState.description.trim() ||
        buildQuickMovementDescription(
          kind,
          null,
          selectedSourceAccount,
          selectedDestinationAccount,
          null,
          null,
        );

      const createdMovementId = await createMovementMutation.mutateAsync({
        categoryId: null,
        counterpartyId: null,
        description,
        destinationAccountId,
        destinationAmount,
        fxRate: transferFxRate,
        metadata: {
          channel: "quick-entry",
          entryKind: kind,
          currenciesMatch: !hasTransferCurrencyMismatch,
        },
        movementType: "transfer",
        notes: null,
        obligationId: null,
        occurredAt: occurredAt.toISOString(),
        sourceAccountId,
        sourceAmount,
        status: "posted",
        subscriptionId: null,
        userId,
        workspaceId,
      });

      if (pendingReceiptFile && canUploadReceipts) {
        try {
          await uploadReceiptForMovement(createdMovementId, pendingReceiptFile);
          onCreated(
            `Transferencia guardada con su comprobante entre ${selectedSourceAccount?.name ?? "origen"} y ${selectedDestinationAccount?.name ?? "destino"}.`,
          );
        } catch {
          onCreated(
            `Transferencia guardada entre ${selectedSourceAccount?.name ?? "origen"} y ${selectedDestinationAccount?.name ?? "destino"}, pero el comprobante quedo pendiente.`,
          );
        }
      } else {
        onCreated(
          `Transferencia guardada entre ${selectedSourceAccount?.name ?? "origen"} y ${selectedDestinationAccount?.name ?? "destino"}.`,
        );
      }

      setPendingReceiptFile(null);
      onClose();
    } catch (error) {
      setErrorMessage(
        getQueryErrorMessage(error, "No pudimos registrar este movimiento rapido."),
      );
    }
  }

  const accountOptions = useMemo(
    () =>
      visibleAccounts.map((account) => ({
        value: String(account.id),
        label: account.name,
        description: `${account.currencyCode} · saldo ${formatCurrency(account.currentBalance, account.currencyCode)}`,
        leadingLabel: account.currencyCode,
        leadingColor: account.color,
        searchText: `${account.name} ${account.currencyCode} ${account.type}`,
      })),
    [visibleAccounts],
  );
  const categoryOptions = useMemo(
    () => [
      {
        value: "",
        label: "Sin categoria",
        description: "Puedes registrarlo rapido y categorizar despues.",
        leadingLabel: "?",
        leadingColor: "#6b7280",
        searchText: "sin categoria",
      },
      ...filteredCategories.map((category) => ({
        value: String(category.id),
        label: category.name,
        description:
          category.kind === "both"
            ? "Disponible para gasto e ingreso."
            : category.kind === "expense"
              ? "Categoria de salida."
              : "Categoria de entrada.",
        leadingLabel: category.name.slice(0, 2).toUpperCase(),
        leadingColor: getCategoryColor(category.kind),
        searchText: `${category.name} ${category.kind}`,
      })),
    ],
    [filteredCategories],
  );
  const counterpartyOptions = useMemo(
    () => [
      {
        value: "",
        label: "Sin contraparte",
        description: "Opcional. Puedes dejarlo vacio.",
        leadingLabel: "?",
        leadingColor: "#6b7280",
        searchText: "sin contraparte",
      },
      ...activeCounterparties.map((counterparty) => ({
        value: String(counterparty.id),
        label: counterparty.name,
        description: counterparty.type,
        leadingLabel: counterparty.name.slice(0, 2).toUpperCase(),
        leadingColor: getCounterpartyColor(counterparty.type),
        searchText: `${counterparty.name} ${counterparty.type}`,
      })),
    ],
    [activeCounterparties],
  );

  return (
    <div
      aria-modal="true"
      className="animate-fade-in fixed inset-0 z-50 isolate bg-black/68 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-black/52 before:backdrop-blur-2xl before:content-['']"
      onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }}
      onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) requestClose(); }}
      role="dialog"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div className="animate-rise-in relative max-h-[calc(100vh-1.5rem)] w-full max-w-[1040px] overflow-hidden rounded-[38px] border border-white/10 bg-[#050a12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -left-20 top-10 h-64 w-64 rounded-full blur-3xl"
              style={{ backgroundColor: `${selectedMode.color}22` }}
            />
            <div className="absolute right-0 top-0 h-44 w-44 rounded-full bg-[#6f86ff]/10 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_20%,transparent_80%,rgba(255,255,255,0.03))]" />
          </div>

          <div className="relative flex max-h-[calc(100vh-1.5rem)] flex-col overflow-y-auto px-4 pt-4 sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                    captura rapida
                  </span>
                  <StatusBadge
                    status="aplicado directo"
                    tone="success"
                  />
                </div>
                <div>
                  <h2 className="font-display text-3xl font-semibold text-ink sm:text-[2.7rem]">
                    {selectedMode.label}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-storm">
                    {selectedMode.description}
                  </p>
                </div>
              </div>
              <button
                aria-label="Cerrar captura rapida"
                className="rounded-full border border-white/10 bg-white/[0.04] p-3 text-storm transition hover:-translate-y-0.5 hover:bg-white/[0.08] hover:text-ink"
                disabled={isSaving}
                onClick={requestClose}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {quickMovementModes.map((mode) => {
                const ModeIcon = mode.icon;
                const isActive = mode.kind === kind;

                return (
                  <button
                    className={`rounded-[22px] border px-4 py-3 text-left transition duration-200 ${
                      isActive ? "text-ink shadow-[0_20px_60px_rgba(0,0,0,0.22)]" : "text-storm hover:text-ink"
                    }`}
                    key={mode.kind}
                    onClick={() => setKind(mode.kind)}
                    style={{
                      borderColor: isActive ? `${mode.color}66` : "rgba(255,255,255,0.08)",
                      background: isActive
                        ? `linear-gradient(160deg, ${mode.color}2f, rgba(9, 14, 22, 0.96))`
                        : "linear-gradient(180deg, rgba(11, 17, 27, 0.94), rgba(8, 12, 20, 0.94))",
                    }}
                    type="button"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 text-white"
                        style={{ backgroundColor: `${mode.color}33` }}
                      >
                        <ModeIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{mode.label}</p>
                        <p className="mt-1 text-xs text-storm/85">
                          {mode.kind === "transfer" ? "Entre cuentas" : "Formulario veloz"}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <form
              className="mt-8 flex flex-1 flex-col"
              noValidate
              onSubmit={(event) => void handleSubmit(event)}
            >
              {visibleAccounts.length < minimumAccountsRequired ? (
                <DataState
                  action={
                    <Button
                      disabled={isSaving}
                      onClick={requestClose}
                      variant="secondary"
                    >
                      Volver
                    </Button>
                  }
                  description={
                    isTransfer
                      ? "Necesitas al menos dos cuentas activas para mover saldo entre ellas."
                      : "Necesitas al menos una cuenta activa para registrar este movimiento rapido."
                  }
                  title="Faltan cuentas para continuar"
                  tone="error"
                />
              ) : (
                <>
                  {errorMessage ? (
                    <FormFeedbackBanner
                      description={errorMessage}
                      title="Revisa este movimiento rapido"
                    />
                  ) : null}

                  <div className="mt-6 grid gap-4 sm:gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                    <section className="glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] sm:rounded-[32px] border border-white/10 bg-white/[0.04] p-3 sm:p-6">
                      <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-gold" />
                        <div>
                          <p className="text-[0.6rem] sm:text-xs uppercase tracking-[0.22em] text-storm">Datos base</p>
                          <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-medium text-ink">
                            {isTransfer ? "Cuentas y montos" : "Cuenta, monto y contexto"}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
                        {isTransfer ? (
                          <>
                            <QuickField
                              errorKey="sourceAccountId"
                              hint="Cuenta desde donde sale el saldo."
                              invalidFields={invalidFields}
                              label="Cuenta origen"
                            >
                              <QuickPicker
                                emptyMessage="No encontramos una cuenta con ese termino."
                                onChange={(nextValue) => { clearFieldError("sourceAccountId"); updateFormState("sourceAccountId", nextValue); }}
                                options={accountOptions}
                                placeholderDescription="Selecciona la cuenta que envia."
                                placeholderLabel="Selecciona origen"
                                queryPlaceholder="Buscar cuenta origen..."
                                value={formState.sourceAccountId}
                              />
                            </QuickField>

                            <QuickField
                              errorKey="destinationAccountId"
                              hint="Cuenta que recibira el saldo."
                              invalidFields={invalidFields}
                              label="Cuenta destino"
                            >
                              <QuickPicker
                                emptyMessage="No encontramos una cuenta con ese termino."
                                onChange={(nextValue) => { clearFieldError("destinationAccountId"); updateFormState("destinationAccountId", nextValue); }}
                                options={accountOptions}
                                placeholderDescription="Selecciona la cuenta que recibe."
                                placeholderLabel="Selecciona destino"
                                queryPlaceholder="Buscar cuenta destino..."
                                value={formState.destinationAccountId}
                              />
                            </QuickField>

                            <QuickField
                              errorKey="amount"
                              hint={selectedSourceAccount ? `Moneda ${selectedSourceAccount.currencyCode}.` : "Monto que sale."}
                              invalidFields={invalidFields}
                              label="Monto origen"
                            >
                              <QuickInput
                                inputMode="decimal"
                                onChange={(event) => { clearFieldError("amount"); updateFormState("amount", event.target.value); }}
                                placeholder="0.00"
                                value={formState.amount}
                              />
                            </QuickField>

                            {hasTransferCurrencyMismatch ? (
                              <QuickField
                                errorKey="destinationAmount"
                                hint={selectedDestinationAccount ? `Moneda ${selectedDestinationAccount.currencyCode}.` : "Monto que entra."}
                                invalidFields={invalidFields}
                                label="Monto destino"
                              >
                                <QuickInput
                                  inputMode="decimal"
                                  onChange={(event) => { clearFieldError("destinationAmount"); updateFormState("destinationAmount", event.target.value); }}
                                  placeholder="0.00"
                                  value={formState.destinationAmount}
                                />
                              </QuickField>
                            ) : (
                              <QuickField
                                hint="La descripcion es opcional. Si la dejas vacia la generamos por ti."
                                label="Descripcion"
                              >
                                <QuickInput
                                  onChange={(event) => updateFormState("description", event.target.value)}
                                  placeholder="Ej. Transferencia a cuenta de ahorro"
                                  value={formState.description}
                                />
                              </QuickField>
                            )}
                          </>
                        ) : (
                          <>
                            <QuickField
                              errorKey="accountId"
                              hint={
                                kind === "expense"
                                  ? "Cuenta desde donde sale el dinero."
                                  : "Cuenta que recibe el dinero."
                              }
                              invalidFields={invalidFields}
                              label="Cuenta"
                            >
                              <QuickPicker
                                emptyMessage="No encontramos una cuenta con ese termino."
                                onChange={(nextValue) => { clearFieldError("accountId"); updateFormState("accountId", nextValue); }}
                                options={accountOptions}
                                placeholderDescription={
                                  kind === "expense"
                                    ? "Selecciona la cuenta desde donde sale."
                                    : "Selecciona la cuenta que recibe."
                                }
                                placeholderLabel="Selecciona una cuenta"
                                queryPlaceholder="Buscar cuenta..."
                                value={formState.accountId}
                              />
                            </QuickField>

                            <QuickField
                              errorKey="amount"
                              hint={selectedAccount ? `Moneda ${selectedAccount.currencyCode}.` : "Monto principal del movimiento."}
                              invalidFields={invalidFields}
                              label="Monto"
                            >
                              <QuickInput
                                inputMode="decimal"
                                onChange={(event) => { clearFieldError("amount"); updateFormState("amount", event.target.value); }}
                                placeholder="0.00"
                                value={formState.amount}
                              />
                            </QuickField>

                            <QuickField
                              hint="Opcional. Puedes dejarlo vacio y categorizar despues."
                              label="Categoria"
                            >
                              <QuickPicker
                                emptyMessage="No encontramos una categoria con ese termino."
                                onChange={(nextValue) => updateFormState("categoryId", nextValue)}
                                options={categoryOptions}
                                placeholderDescription="Categoria contable opcional."
                                placeholderLabel="Sin categoria"
                                queryPlaceholder="Buscar categoria..."
                                value={formState.categoryId}
                              />
                            </QuickField>

                            <QuickField
                              hint="Opcional. Persona, comercio, empresa o banco relacionado."
                              label="Contraparte"
                            >
                              <QuickPicker
                                actionDescription="Si aun no existe, registrala ahora y queda seleccionada."
                                actionLabel="Nuevo contacto"
                                actionLeadingColor="#1b6a58"
                                actionLeadingLabel="+"
                                emptyMessage="No encontramos una contraparte con ese termino."
                                onChange={(nextValue) => updateFormState("counterpartyId", nextValue)}
                                onAction={openContactDialog}
                                options={counterpartyOptions}
                                placeholderDescription="Contexto comercial o personal."
                                placeholderLabel="Sin contraparte"
                                queryPlaceholder="Buscar contraparte..."
                                value={formState.counterpartyId}
                              />
                            </QuickField>
                          </>
                        )}
                      </div>

                      <div className="mt-3 sm:mt-5 grid gap-3 sm:gap-4 md:grid-cols-2">
                        {isTransfer && hasTransferCurrencyMismatch ? (
                          <QuickField
                            hint="Opcional. Si la dejas vacia la descripcion se construye sola."
                            label="Descripcion"
                          >
                            <QuickInput
                              onChange={(event) => updateFormState("description", event.target.value)}
                              placeholder="Ej. Cambio interno USD -> PEN"
                              value={formState.description}
                            />
                          </QuickField>
                        ) : null}

                        <QuickField
                          errorKey="occurredAt"
                          hint="Se guardara con esta fecha y hora."
                          invalidFields={invalidFields}
                          label="Fecha operativa"
                        >
                          <DatePickerField
                            mode="datetime-local"
                            onChange={(nextValue) => { clearFieldError("occurredAt"); updateFormState("occurredAt", nextValue); }}
                            value={formState.occurredAt}
                          />
                        </QuickField>

                        {!isTransfer ? (
                          <QuickField
                            hint="Opcional. Si la dejas vacia la descripcion se genera automaticamente."
                            label="Descripcion"
                          >
                            <QuickInput
                              onChange={(event) => updateFormState("description", event.target.value)}
                              placeholder={
                                kind === "expense"
                                  ? "Ej. Cena con clientes"
                                  : "Ej. Pago de cliente"
                              }
                              value={formState.description}
                            />
                          </QuickField>
                        ) : null}
                      </div>
                    </section>

                    <section className="glass-panel-soft relative min-w-0 overflow-hidden rounded-[24px] sm:rounded-[32px] border border-white/10 bg-white/[0.04] p-3 sm:p-6">
                      <div
                        className="absolute -right-10 top-0 h-36 w-36 rounded-full blur-3xl"
                        style={{ backgroundColor: `${selectedMode.color}30` }}
                      />

                      <div className="relative">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
                            Vista previa
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-storm/80">
                            {previewContextLabel}
                          </span>
                        </div>

                        <div className="mt-4 sm:mt-6 flex items-start gap-3 sm:gap-5">
                          <div className="relative flex h-12 w-12 sm:h-20 sm:w-20 shrink-0 items-center justify-center">
                            <div
                              className="absolute inset-0 rounded-[16px] sm:rounded-[28px] opacity-80 blur-2xl"
                              style={{ backgroundColor: `${selectedMode.color}5f` }}
                            />
                            <div
                              className="relative flex h-full w-full items-center justify-center rounded-[16px] sm:rounded-[28px] border border-white/10 text-white shadow-[0_20px_45px_rgba(0,0,0,0.28)]"
                              style={{
                                background: `linear-gradient(160deg, ${selectedMode.color}, rgba(8, 13, 20, 0.72))`,
                              }}
                            >
                              <QuickModeIcon className="h-5 w-5 sm:h-8 sm:w-8" />
                            </div>
                          </div>

                          <div className="min-w-0">
                            <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                              Resumen
                            </p>
                            <h3 className="mt-1 sm:mt-2 break-words font-display text-2xl sm:text-4xl font-semibold text-ink">
                              {previewTitle}
                            </h3>
                            <p className="mt-2 sm:mt-3 break-words text-xs sm:text-sm leading-6 sm:leading-7 text-storm">{previewFlowLabel}</p>
                          </div>
                        </div>

                        <div className="mt-4 sm:mt-6 grid gap-2 sm:gap-3">
                          <div className="rounded-[16px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                            <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                              Impacto principal
                            </p>
                            <p className="mt-2 sm:mt-3 font-display text-xl sm:text-2xl font-semibold text-ink">
                              {formatCurrency(computedAmount > 0 ? computedAmount : 0, previewCurrencyCode)}
                            </p>
                            <p className="mt-1 sm:mt-2 text-xs leading-6 text-storm/75">{previewDateLabel}</p>
                          </div>

                          {isTransfer && hasTransferCurrencyMismatch ? (
                            <div className="rounded-[16px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                              <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                                Monto destino
                              </p>
                              <p className="mt-2 sm:mt-3 font-display text-xl sm:text-2xl font-semibold text-ink">
                                {formatCurrency(
                                  computedDestinationAmount > 0 ? computedDestinationAmount : 0,
                                  selectedDestinationAccount?.currencyCode ?? snapshot.workspace.baseCurrencyCode,
                                )}
                              </p>
                              <p className="mt-1 sm:mt-2 text-xs leading-6 text-storm/75">
                                {transferFxRate ? `FX ${transferFxRate.toFixed(6)}` : "Esperando montos para calcular FX"}
                              </p>
                            </div>
                          ) : null}

                          <div className="rounded-[16px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                            <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                              Lectura rapida
                            </p>
                            <div className="mt-2 sm:mt-3 flex flex-wrap gap-2">
                              <StatusBadge
                                status={selectedMode.label}
                                tone={kind === "expense" ? "danger" : kind === "income" ? "success" : "info"}
                              />
                              <StatusBadge
                                status="aplicado"
                                tone="success"
                              />
                              {!isTransfer && selectedCategory ? (
                                <StatusBadge
                                  status={selectedCategory.name}
                                  tone="neutral"
                                />
                              ) : null}
                            </div>
                            <p className="mt-2 sm:mt-3 text-xs leading-6 text-storm/75">
                              Se registrara usando el flujo rapido y quedara disponible de inmediato en tu historial.
                            </p>
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="mt-6">
                    <PendingReceiptField
                      canUpload={canUploadReceipts}
                      description="Opcional. Puedes guardar una foto del comprobante junto con este movimiento rapido."
                      file={pendingReceiptFile}
                      lockedMessage={accessMessage}
                      onChange={setPendingReceiptFile}
                    />
                  </div>

                  <div className="sticky bottom-0 z-[60] -mx-4 sm:-mx-6 mt-8 rounded-b-[38px] border-t border-white/10 bg-[#050a12]/95 px-4 py-5 sm:px-6 backdrop-blur-md">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <p className="max-w-xl text-sm leading-7 text-storm">
                        Este formulario resume lo esencial. Si necesitas notas, metadata, FX manual o vinculos avanzados, luego puedes abrir el modulo completo de movimientos.
                      </p>

                      <div className="flex flex-col-reverse gap-3 sm:flex-row">
                        <Button
                          className="min-w-[140px] justify-center"
                          disabled={isSaving}
                          onClick={requestClose}
                          type="button"
                          variant="ghost"
                        >
                          Cancelar
                        </Button>
                        <Button
                          className="min-w-[210px] justify-center shadow-[0_18px_50px_rgba(245,247,251,0.12)]"
                          disabled={isSaving}
                          type="submit"
                        >
                          {isSaving ? (
                            <>
                              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                              Guardando...
                            </>
                          ) : (
                            selectedMode.cta
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      </div>

      {isContactDialogOpen ? (
        <ContactQuickCreateDialog
          onClose={() => setIsContactDialogOpen(false)}
          onCreated={handleContactCreated}
          subtitle="Agregalo una sola vez y reutilizalo en ingresos, gastos o deudas."
          userId={userId}
          workspaceId={workspaceId}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); onClose(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}
    </div>
  );
}
