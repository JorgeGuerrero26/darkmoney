import {
  ArrowDownCircle,
  ArrowLeftRight,
  ArrowUpCircle,
  ArrowLeft,
  ChevronRight,
  LoaderCircle,
  X,
} from "lucide-react";
import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { SearchablePicker as QuickPicker } from "../../../components/ui/searchable-picker";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  deleteStoredReceipt,
  prepareReceiptUpload,
  uploadPreparedReceipt,
} from "../../attachments/receipt-utils";
import { useReceiptFeatureAccess } from "../../attachments/use-receipt-feature-access";
import { ContactQuickCreateDialog } from "../../contacts/components/contact-quick-create-dialog";
import {
  MovementDetailOptionsPanel,
  MovementInsightRow,
  MovementDetailsNavigationRow,
  MovementDetailsPanel,
  MovementDetailsReceiptRow,
  MovementSuggestionRow,
  PendingMovementReceiptControl,
} from "./movement-details-panel";
import { MovementSplitPanel } from "./movement-split-panel";
import { useMovementSuggestions } from "../hooks/use-movement-suggestions";
import { useMovementInsights } from "../hooks/use-movement-insights";
import { normalizeInsightText, recurringFrequencyFields, recurringFrequencyLabel } from "../lib/movement-insights";
import {
  buildSplitDescription,
  buildSplitMetadata,
  createMovementSplitLines,
  validateMovementSplit,
  type MovementSplitLine,
} from "../lib/split-movement";
import type {
  AccountSummary,
  CategorySummary,
  CounterpartySummary,
  MovementStatus,
} from "../../../types/domain";
import {
  useCreateAttachmentRecordMutation,
  useCreateCategoryMutation,
  useCreateCounterpartyMutation,
  useCreateRecurringIncomeMutation,
  useCreateSubscriptionMutation,
  usePersistLearningFeedbackMutation,
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
  proAccessEnabled?: boolean;
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
  status: Exclude<MovementStatus, "voided">;
};

type QuickMovementPanel = "main" | "details" | "category" | "counterparty" | "split";

type CategoryFeedbackIntent = {
  confidence: number | null;
  kind: "accepted_category_suggestion" | "manual_category_change";
  source: string;
};

type QuickFieldProps = {
  children: ReactNode;
  errorKey?: string;
  hint?: string;
  invalidFields?: Set<string>;
  label: string;
};

const quickFieldClassName =
  "w-full rounded-xl border border-white/10 bg-[#141311] px-4 text-sm text-ink outline-none transition placeholder:text-storm/55 hover:border-white/20 focus:border-ink/55 focus:ring-2 focus:ring-ink/10";
const quickInputClassName = `${quickFieldClassName} h-12`;
const quickFieldLabelClassName =
  "text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80";
const quickFieldHintClassName = "mt-1.5 sm:mt-2 break-words text-xs leading-6 text-storm/75";

const quickMovementModes: Array<{
  kind: QuickMovementKind;
  label: string;
  description: string;
  color: string;
  icon: typeof ArrowDownCircle;
}> = [
  {
    kind: "expense",
    label: "Gasto",
    description: "Registra una salida de dinero desde una cuenta existente.",
    color: "#8f3e3e",
    icon: ArrowDownCircle,
  },
  {
    kind: "income",
    label: "Ingreso",
    description: "Registra una entrada de dinero a una cuenta del espacio.",
    color: "#1b6a58",
    icon: ArrowUpCircle,
  },
  {
    kind: "transfer",
    label: "Transferir",
    description: "Mueve saldo entre dos cuentas del mismo espacio.",
    color: "#4566d6",
    icon: ArrowLeftRight,
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
    status: "posted",
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

function getQuickMovementMode(kind: QuickMovementKind) {
  return quickMovementModes.find((mode) => mode.kind === kind) ?? quickMovementModes[0];
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

  return categories
    .filter((category) => {
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
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
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


export function QuickMovementDialog({
  initialKind,
  onClose,
  onCreated,
  snapshot,
  userId,
  workspaceId,
  proAccessEnabled,
}: QuickMovementDialogProps) {
  const { accessMessage, canUploadReceipts } = useReceiptFeatureAccess();
  const [kind, setKind] = useState<QuickMovementKind>(initialKind);
  const [formState, setFormState] = useState<QuickMovementFormState>(() =>
    createDefaultQuickMovementFormState(),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [activePanel, setActivePanel] = useState<QuickMovementPanel>("main");
  const [pendingReceiptFile, setPendingReceiptFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [inlineCounterparties, setInlineCounterparties] = useState<CounterpartySummary[]>([]);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [linkedSubscriptionId, setLinkedSubscriptionId] = useState<number | null>(null);
  const [linkedRecurringIncomeId, setLinkedRecurringIncomeId] = useState<number | null>(null);
  const [categoryFeedbackIntent, setCategoryFeedbackIntent] = useState<CategoryFeedbackIntent | null>(null);
  const [splitLines, setSplitLines] = useState<MovementSplitLine[] | null>(null);
  const createMovementMutation = useCreateMovementMutation(workspaceId, userId);
  const createAttachmentRecordMutation = useCreateAttachmentRecordMutation(workspaceId, userId);
  const createCategoryMutation = useCreateCategoryMutation(workspaceId, userId);
  const createCounterpartyMutation = useCreateCounterpartyMutation(workspaceId, userId);
  const createSubscriptionMutation = useCreateSubscriptionMutation(workspaceId, userId);
  const createRecurringIncomeMutation = useCreateRecurringIncomeMutation(workspaceId, userId);
  const persistLearningFeedbackMutation = usePersistLearningFeedbackMutation(workspaceId, userId);
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
  const isSaving =
    createMovementMutation.isPending ||
    createAttachmentRecordMutation.isPending ||
    createCategoryMutation.isPending ||
    createCounterpartyMutation.isPending ||
    createSubscriptionMutation.isPending ||
    createRecurringIncomeMutation.isPending;
  const isTransfer = kind === "transfer";
  const hasTransferCurrencyMismatch =
    Boolean(selectedSourceAccount && selectedDestinationAccount) &&
    selectedSourceAccount?.currencyCode !== selectedDestinationAccount?.currencyCode;
  const minimumAccountsRequired = isTransfer ? 2 : 1;
  const computedAmount = parseOptionalNumber(formState.amount) ?? 0;
  const computedDestinationAmount = hasTransferCurrencyMismatch
    ? parseOptionalNumber(formState.destinationAmount) ?? 0
    : computedAmount;
  const transferFxRate =
    hasTransferCurrencyMismatch && computedAmount > 0 && computedDestinationAmount > 0
      ? computedDestinationAmount / computedAmount
      : null;
  const suggestionCurrencyCode =
    selectedAccount?.currencyCode ??
    selectedSourceAccount?.currencyCode ??
    selectedDestinationAccount?.currencyCode ??
    snapshot.workspace.baseCurrencyCode;
  const suggestions = useMovementSuggestions({
    accountId: selectedAccount?.id ?? null,
    accounts: visibleAccounts,
    actsAsIncome: kind === "income",
    enabled: activePanel === "details",
    workspaceId,
    proAccessEnabled,
    movementType: kind,
    amount: computedAmount > 0 ? computedAmount : null,
    currencyCode: suggestionCurrencyCode,
    description: formState.description,
    occurredAt: formState.occurredAt,
    categoryId: Number.isFinite(selectedCategoryId) ? selectedCategoryId : null,
    counterpartyId: selectedCounterparty?.id ?? null,
    categories: filteredCategories,
    counterparties: availableCounterparties,
    movements: snapshot.movements,
  });
  const insights = useMovementInsights({
    account: selectedAccount,
    actsAsIncome: kind === "income",
    amount: computedAmount,
    baseCurrencyCode: snapshot.workspace.baseCurrencyCode,
    budgets: snapshot.budgets,
    category: selectedCategory,
    counterparty: selectedCounterparty,
    currencyCode: suggestionCurrencyCode,
    description: formState.description,
    enabled: activePanel === "details",
    exchangeRates: snapshot.exchangeRates,
    movementType: kind,
    movements: snapshot.movements,
    occurredAt: formState.occurredAt,
    proAccessEnabled,
    recurringIncome: snapshot.recurringIncome,
    subscriptions: snapshot.subscriptions,
    workspaceId,
  });

  useEffect(() => {
    setKind(initialKind);
    setActivePanel("main");
    setErrorMessage("");
    setInvalidFields(new Set());
    setPendingReceiptFile(null);
    setLinkedSubscriptionId(null);
    setLinkedRecurringIncomeId(null);
    setCategoryFeedbackIntent(null);
    setSplitLines(null);
  }, [initialKind]);

  async function applyRecurringSuggestion() {
    const suggestion = insights.recurring;
    if (!suggestion || computedAmount <= 0) return;
    const { frequency, intervalCount } = recurringFrequencyFields(suggestion.frequency);
    const startDate = formState.occurredAt.slice(0, 10);
    const parsedDate = new Date(`${startDate}T12:00:00`);
    const dayOfMonth = Math.max(1, Math.min(31, Number(startDate.slice(8, 10)) || 1));
    const dayOfWeek = Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getDay();
    setErrorMessage("");
    try {
      if (suggestion.type === "subscription") {
        const result = await createSubscriptionMutation.mutateAsync({
          workspaceId,
          userId,
          name: suggestion.name,
          vendorPartyId: selectedCounterparty?.id ?? null,
          accountId: selectedAccount?.id ?? null,
          categoryId: selectedCategory?.id ?? null,
          currencyCode: suggestionCurrencyCode,
          amount: computedAmount,
          frequency,
          intervalCount,
          dayOfMonth: ["monthly", "quarterly", "yearly"].includes(frequency) ? dayOfMonth : null,
          dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
          startDate,
          nextDueDate: startDate,
          endDate: null,
          status: "active",
          autoCreateMovement: false,
          remindDaysBefore: 3,
          description: formState.description.trim() || null,
          notes: `Creada desde sugerencia recurrente (${Math.round(suggestion.confidence * 100)}%).`,
        });
        setLinkedSubscriptionId(result.id);
      } else {
        const result = await createRecurringIncomeMutation.mutateAsync({
          workspaceId,
          userId,
          name: suggestion.name,
          payerPartyId: selectedCounterparty?.id ?? null,
          accountId: selectedAccount?.id ?? null,
          categoryId: selectedCategory?.id ?? null,
          currencyCode: suggestionCurrencyCode,
          amount: computedAmount,
          frequency,
          intervalCount,
          dayOfMonth: ["monthly", "quarterly", "yearly"].includes(frequency) ? dayOfMonth : null,
          dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
          startDate,
          nextExpectedDate: startDate,
          endDate: null,
          status: "active",
          remindDaysBefore: 3,
          description: formState.description.trim() || null,
          notes: `Creado desde sugerencia recurrente (${Math.round(suggestion.confidence * 100)}%).`,
        });
        setLinkedRecurringIncomeId(result.id);
      }
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos crear el recurrente."));
    }
  }

  async function applyCategorySuggestion() {
    const suggestion = suggestions.category;
    if (!suggestion) return;
    if (suggestion.categoryId !== null) {
      setCategoryFeedbackIntent({
        confidence: suggestion.confidence,
        kind: "accepted_category_suggestion",
        source: suggestion.source === "deepseek" ? "movement-form-ai" : "movement-form",
      });
      updateFormState("categoryId", String(suggestion.categoryId));
      return;
    }
    const name = suggestion.newCategoryName?.trim();
    if (!name || kind === "transfer") return;
    setErrorMessage("");
    try {
      const result = await createCategoryMutation.mutateAsync({
        workspaceId,
        userId,
        name,
        kind,
        parentId: null,
        color: kind === "income" ? "#58D6B3" : "#D4A574",
        icon: null,
        sortOrder: 0,
        isActive: true,
      });
      setCategoryFeedbackIntent({
        confidence: suggestion.confidence,
        kind: "accepted_category_suggestion",
        source: suggestion.source === "deepseek" ? "movement-form-ai" : "movement-form",
      });
      updateFormState("categoryId", String(result.id));
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos crear la categoría sugerida."));
    }
  }

  async function applyCounterpartySuggestion() {
    const suggestion = suggestions.counterparty;
    if (!suggestion) return;
    if (suggestion.counterpartyId !== null) {
      updateFormState("counterpartyId", String(suggestion.counterpartyId));
      return;
    }
    const name = suggestion.newCounterpartyName?.trim();
    if (!name) return;
    setErrorMessage("");
    try {
      const result = await createCounterpartyMutation.mutateAsync({
        workspaceId,
        userId,
        name,
        type: suggestion.counterpartyType,
        phone: null,
        email: null,
        documentNumber: null,
        notes: "Creada desde una sugerencia de movimiento.",
        roles: [],
      });
      handleContactCreated({
        id: result.id,
        isArchived: false,
        name,
        type: suggestion.counterpartyType,
      });
    } catch (error) {
      setErrorMessage(getQueryErrorMessage(error, "No pudimos crear la contraparte sugerida."));
    }
  }

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
  }, [activePanel, invalidFields]);

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
      setActivePanel("details");
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

        if (splitLines && kind === "expense") {
          const splitError = validateMovementSplit(splitLines, amount ?? 0);
          if (splitError) {
            setActivePanel("split");
            setErrorMessage(splitError);
            return;
          }

          const splitGroupId = crypto.randomUUID();
          let firstMovementId: number | null = null;
          for (const [index, line] of splitLines.entries()) {
            const lineAmount = Number(line.amount);
            const lineCategoryId = Number(line.categoryId);
            const movementId = await createMovementMutation.mutateAsync({
              categoryId: lineCategoryId,
              counterpartyId:
                counterpartyId !== null && Number.isFinite(counterpartyId) ? counterpartyId : null,
              description: buildSplitDescription(description, index, splitLines.length),
              destinationAccountId: null,
              destinationAmount: null,
              fxRate: null,
              metadata: buildSplitMetadata({
                channel: "quick-entry",
                entryKind: kind,
                recurring_income_id: index === 0 ? linkedRecurringIncomeId : null,
                riskAi: insights.risk?.source === "deepseek" ? insights.risk : null,
                budgetAi: insights.budget?.source === "deepseek" ? insights.budget : null,
              }, splitGroupId, index, splitLines.length),
              movementType: kind,
              notes: null,
              obligationId: null,
              occurredAt: occurredAt.toISOString(),
              sourceAccountId: kind === "expense" ? accountId : null,
              sourceAmount: kind === "expense" ? lineAmount : null,
              status: formState.status,
              subscriptionId: index === 0 ? linkedSubscriptionId : null,
              userId,
              workspaceId,
            });
            firstMovementId ??= movementId;
          }

          let receiptPending = false;
          if (pendingReceiptFile && canUploadReceipts && firstMovementId !== null) {
            try {
              await uploadReceiptForMovement(firstMovementId, pendingReceiptFile);
            } catch {
              receiptPending = true;
            }
          }
          onCreated(
            selectedMode.label +
              " dividido en " +
              splitLines.length +
              " movimientos" +
              (receiptPending ? "; el comprobante quedó pendiente." : "."),
          );
          setPendingReceiptFile(null);
          onClose();
          return;
        }

        const createdMovementId = await createMovementMutation.mutateAsync({
          categoryId: categoryId !== null && Number.isFinite(categoryId) ? categoryId : null,
          counterpartyId:
            counterpartyId !== null && Number.isFinite(counterpartyId) ? counterpartyId : null,
          description,
          destinationAccountId: kind === "income" ? accountId : null,
          destinationAmount: kind === "income" ? amount : null,
          fxRate: null,
          metadata: {
            channel: "quick-entry",
            entryKind: kind,
            recurring_income_id: linkedRecurringIncomeId,
            riskAi: insights.risk?.source === "deepseek" ? insights.risk : null,
            budgetAi: insights.budget?.source === "deepseek" ? insights.budget : null,
          },
          movementType: kind,
          notes: null,
          obligationId: null,
          occurredAt: occurredAt.toISOString(),
          sourceAccountId: kind === "expense" ? accountId : null,
          sourceAmount: kind === "expense" ? amount : null,
          status: formState.status,
          subscriptionId: linkedSubscriptionId,
          userId,
          workspaceId,
        });

        if (categoryId !== null && Number.isFinite(categoryId)) {
          void persistLearningFeedbackMutation.mutateAsync({
            movementId: createdMovementId,
            feedbackKind: categoryFeedbackIntent?.kind ?? "manual_category_change",
            normalizedDescription: normalizeInsightText(description) || null,
            previousCategoryId: null,
            acceptedCategoryId: categoryId,
            confidence: categoryFeedbackIntent?.confidence ?? null,
            source: categoryFeedbackIntent?.source ?? "movement-form",
            metadata: {
              movementType: kind,
              counterpartyId: counterpartyId ?? null,
              accountId,
              amount,
            },
          }).catch(() => undefined);
        }

        if (pendingReceiptFile && canUploadReceipts) {
          try {
            await uploadReceiptForMovement(createdMovementId, pendingReceiptFile);
            onCreated(
              `${selectedMode.label} guardado con su comprobante por ${formatCurrency(amount ?? 0, selectedAccount?.currencyCode ?? snapshot.workspace.baseCurrencyCode)}.`,
            );
          } catch {
            onCreated(
              `${selectedMode.label} guardado por ${formatCurrency(amount ?? 0, selectedAccount?.currencyCode ?? snapshot.workspace.baseCurrencyCode)}, pero el comprobante quedo pendiente.`,
            );
          }
        } else {
          onCreated(
            `${selectedMode.label} guardado por ${formatCurrency(amount ?? 0, selectedAccount?.currencyCode ?? snapshot.workspace.baseCurrencyCode)}.`,
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
        if (tErrors.includes("destinationAmount")) {
          setActivePanel("details");
        }
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
        status: formState.status,
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
        label: "Sin categoría",
        description: "Puedes registrarlo rápido y categorizar después.",
        leadingLabel: "?",
        leadingColor: "#6b7280",
        searchText: "sin categoría",
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
      className="animate-fade-in fixed inset-0 z-[80] bg-black/75"
      onMouseDown={(event) => {
        (event.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now());
      }}
      onMouseUp={(event) => {
        const startedAt = Number((event.currentTarget as HTMLDivElement).dataset.pressStart || "0");
        delete (event.currentTarget as HTMLDivElement).dataset.pressStart;
        if (startedAt) requestClose();
      }}
      role="dialog"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div
          className="animate-rise-in flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#1a1917]"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onMouseUp={(event) => event.stopPropagation()}
        >
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 px-5 sm:px-6">
            {activePanel === "main" ? (
              <h2 className="font-display text-xl font-semibold text-ink">Nuevo movimiento</h2>
            ) : (
              <button
                className="flex min-w-0 items-center gap-3 text-left text-ink transition hover:text-white"
                onClick={() =>
                  setActivePanel(
                    activePanel === "category" || activePanel === "counterparty" || activePanel === "split"
                      ? "details"
                      : "main",
                  )
                }
                type="button"
              >
                <ArrowLeft className="h-4 w-4 shrink-0" />
                <span className="truncate font-display text-xl font-semibold">
                  {activePanel === "details"
                    ? "Detalles"
                    : activePanel === "category"
                      ? "Categoría"
                      : activePanel === "counterparty"
                        ? "Contraparte"
                        : "Dividir en categorías"}
                </span>
              </button>
            )}
            <button
              aria-label="Cerrar formulario"
              className="grid h-9 w-9 place-items-center rounded-full text-storm transition hover:bg-white/[0.06] hover:text-ink"
              disabled={isSaving}
              onClick={requestClose}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <form
            className="flex min-h-0 flex-1 flex-col"
            noValidate
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              <div className={activePanel === "main" ? "" : "hidden"}>
                <div className="grid grid-cols-3 gap-2">
                {quickMovementModes.map((mode) => {
                  const ModeIcon = mode.icon;
                  const isActive = mode.kind === kind;

                  return (
                    <button
                      className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition ${
                        isActive
                          ? "border-ink/80 bg-ink/[0.06] text-ink"
                          : "border-white/10 text-storm hover:border-white/20 hover:text-ink"
                      }`}
                      key={mode.kind}
                      onClick={() => {
                        setKind(mode.kind);
                        setLinkedSubscriptionId(null);
                        setLinkedRecurringIncomeId(null);
                        setCategoryFeedbackIntent(null);
                        if (mode.kind !== "expense") setSplitLines(null);
                        setIsDirty(true);
                      }}
                      type="button"
                    >
                      <ModeIcon className="h-4 w-4" />
                      <span className="truncate text-xs font-semibold sm:text-sm">{mode.label}</span>
                    </button>
                  );
                })}
                </div>

              {visibleAccounts.length < minimumAccountsRequired ? (
                <div className="mt-5">
                  <DataState
                    action={
                      <Button disabled={isSaving} onClick={requestClose} variant="secondary">
                        Volver
                      </Button>
                    }
                    description={
                      isTransfer
                        ? "Necesitas al menos dos cuentas activas para transferir saldo."
                        : "Necesitas al menos una cuenta activa para registrar el movimiento."
                    }
                    title="Faltan cuentas para continuar"
                    tone="error"
                  />
                </div>
              ) : (
                <>
                  {errorMessage ? (
                    <div className="mt-4">
                      <FormFeedbackBanner description={errorMessage} title="Revisa el movimiento" />
                    </div>
                  ) : null}

                  <div className="mt-5">
                    <QuickField errorKey="amount" invalidFields={invalidFields} label="Monto">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-semibold text-storm">
                          {isTransfer
                            ? selectedSourceAccount?.currencyCode === "USD"
                              ? "$"
                              : "S/"
                            : selectedAccount?.currencyCode === "USD"
                              ? "$"
                              : "S/"}
                        </span>
                        <QuickInput
                          autoFocus
                          className="h-16 pl-12 font-display text-[2rem] font-semibold"
                          inputMode="decimal"
                          onChange={(event) => {
                            clearFieldError("amount");
                            updateFormState("amount", event.target.value);
                          }}
                          placeholder="0.00"
                          value={formState.amount}
                        />
                      </div>
                    </QuickField>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-[#141311]">
                    {isTransfer ? (
                      <>
                        <div className="p-3" data-field="sourceAccountId">
                          <QuickPicker
                            appearance="compact"
                            emptyMessage="No encontramos una cuenta con ese término."
                            onChange={(nextValue) => {
                              clearFieldError("sourceAccountId");
                              updateFormState("sourceAccountId", nextValue);
                            }}
                            options={accountOptions}
                            placeholderDescription="Cuenta desde donde sale el dinero."
                            placeholderLabel="Cuenta de origen"
                            queryPlaceholder="Buscar cuenta..."
                            value={formState.sourceAccountId}
                          />
                        </div>
                        {selectedSourceAccount ? (
                          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
                            <span className="text-storm">Saldo después</span>
                            <span className="font-semibold text-ink">
                              {formatCurrency(
                                selectedSourceAccount.currentBalance - computedAmount,
                                selectedSourceAccount.currencyCode,
                              )}
                            </span>
                          </div>
                        ) : null}
                        <div className="border-t border-white/10 p-3" data-field="destinationAccountId">
                          <QuickPicker
                            appearance="compact"
                            emptyMessage="No encontramos una cuenta con ese término."
                            onChange={(nextValue) => {
                              clearFieldError("destinationAccountId");
                              updateFormState("destinationAccountId", nextValue);
                            }}
                            options={accountOptions}
                            placeholderDescription="Cuenta que recibe el dinero."
                            placeholderLabel="Cuenta de destino"
                            queryPlaceholder="Buscar cuenta..."
                            value={formState.destinationAccountId}
                          />
                        </div>
                        {selectedDestinationAccount ? (
                          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
                            <span className="text-storm">Saldo después</span>
                            <span className="font-semibold text-ink">
                              {formatCurrency(
                                selectedDestinationAccount.currentBalance + computedDestinationAmount,
                                selectedDestinationAccount.currencyCode,
                              )}
                            </span>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="p-3" data-field="accountId">
                          <QuickPicker
                            appearance="compact"
                            emptyMessage="No encontramos una cuenta con ese término."
                            onChange={(nextValue) => {
                              clearFieldError("accountId");
                              updateFormState("accountId", nextValue);
                            }}
                            options={accountOptions}
                            placeholderDescription="Elige la cuenta del movimiento."
                            placeholderLabel="Selecciona una cuenta"
                            queryPlaceholder="Buscar cuenta..."
                            value={formState.accountId}
                          />
                        </div>
                        {selectedAccount ? (
                          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
                            <span className="text-storm">Saldo después</span>
                            <span className="font-semibold text-ink">
                              {formatCurrency(
                                selectedAccount.currentBalance +
                                  (kind === "expense" ? -computedAmount : computedAmount),
                                selectedAccount.currencyCode,
                              )}
                            </span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="mt-5">
                    <p className={quickFieldLabelClassName}>Estado</p>
                    <div className="mt-3 grid grid-cols-3 rounded-xl border border-white/10 bg-[#141311] p-1">
                      {([
                        ["posted", "Confirmado"],
                        ["pending", "Pendiente"],
                        ["planned", "Planificado"],
                      ] as const).map(([status, label]) => (
                        <button
                          className={`rounded-lg px-2 py-2.5 text-xs font-semibold transition sm:text-sm ${
                            formState.status === status
                              ? "bg-ink text-[#11100f]"
                              : "text-storm hover:text-ink"
                          }`}
                          key={status}
                          onClick={() => updateFormState("status", status)}
                          type="button"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-5 rounded-xl border border-white/10 bg-[#141311]">
                    <button
                      className="flex h-[54px] w-full items-center justify-between px-4 text-left text-sm font-semibold text-ink transition hover:bg-white/[0.03]"
                      onClick={() => setActivePanel("details")}
                      type="button"
                    >
                      Detalles
                      <ChevronRight className="h-4 w-4 text-storm" />
                    </button>
                  </div>

                  <p className="mt-4 text-xs leading-5 text-storm/70">
                    Con el monto y la cuenta ya puedes guardar. Si dejas la descripción vacía, se genera con la categoría y la fecha.
                  </p>
                </>
              )}
              </div>

              {activePanel === "details" ? (
                <div>
                  {errorMessage ? (
                    <div className="mb-4">
                      <FormFeedbackBanner description={errorMessage} title="Revisa el movimiento" />
                    </div>
                  ) : null}
                  <MovementDetailsPanel
                    categoryLabel={splitLines ? undefined : selectedCategory?.name ?? "Sin categoría"}
                    counterpartyLabel={selectedCounterparty?.name ?? "Sin asignar"}
                    description={formState.description}
                    destinationAmount={formState.destinationAmount}
                    destinationCurrencyCode={selectedDestinationAccount?.currencyCode}
                    helperText="Si dejas la descripción vacía, se genera automáticamente con la categoría y la fecha."
                    invalidFields={invalidFields}
                    isTransfer={isTransfer}
                    navigationRows={kind === "expense" ? (
                      <MovementDetailsNavigationRow
                        label="Dividir en categorías"
                        onClick={() => {
                          setSplitLines((current) => current ?? createMovementSplitLines(formState.categoryId));
                          setActivePanel("split");
                          setIsDirty(true);
                        }}
                        value={splitLines ? `${splitLines.length} partes` : "No dividido"}
                      />
                    ) : null}
                    occurredAt={formState.occurredAt}
                    onDescriptionChange={(value) => updateFormState("description", value)}
                    onDestinationAmountChange={(value) => {
                      clearFieldError("destinationAmount");
                      updateFormState("destinationAmount", value);
                    }}
                    onOccurredAtChange={(value) => {
                      clearFieldError("occurredAt");
                      updateFormState("occurredAt", value);
                    }}
                    onOpenCategory={splitLines ? undefined : () => setActivePanel("category")}
                    onOpenCounterparty={() => setActivePanel("counterparty")}
                    receiptRows={
                      <MovementDetailsReceiptRow>
                        <PendingMovementReceiptControl
                          canUpload={canUploadReceipts}
                          file={pendingReceiptFile}
                          lockedMessage={accessMessage}
                          onChange={(file) => {
                            setPendingReceiptFile(file);
                            setIsDirty(true);
                          }}
                        />
                      </MovementDetailsReceiptRow>
                    }
                    suggestionRows={
                      <>
                        {suggestions.description ? (
                          <MovementSuggestionRow
                            label="Descripción sugerida"
                            onAccept={() => updateFormState("description", suggestions.description!.cleanedDescription)}
                            reason={suggestions.description.reasons[0]}
                            value={suggestions.description.cleanedDescription}
                          />
                        ) : null}
                        {suggestions.category ? (
                          <MovementSuggestionRow
                            label={suggestions.category.type === "new_category" ? "Categoría nueva" : "Categoría sugerida"}
                            onAccept={() => void applyCategorySuggestion()}
                            reason={suggestions.category.reasons[0]}
                            value={suggestions.category.categoryName}
                          />
                        ) : null}
                        {suggestions.counterparty ? (
                          <MovementSuggestionRow
                            label={suggestions.counterparty.type === "new_counterparty" ? "Contraparte nueva" : "Contraparte sugerida"}
                            onAccept={() => void applyCounterpartySuggestion()}
                            reason={suggestions.counterparty.reasons[0]}
                            value={suggestions.counterparty.counterpartyName}
                          />
                        ) : null}
                        {suggestions.account ? (
                          <MovementSuggestionRow
                            label="Cuenta sugerida"
                            onAccept={() => updateFormState("accountId", String(suggestions.account!.accountId))}
                            reason={suggestions.account.reasons[0]}
                            value={suggestions.account.accountName}
                          />
                        ) : null}
                        {insights.recurring && !linkedSubscriptionId && !linkedRecurringIncomeId ? (
                          <MovementInsightRow
                            actionLabel="Crear"
                            description={insights.recurring.reasons[0] ?? "Coincide con un patrón que ya aparece en tus movimientos."}
                            kind="recurring"
                            label="Posible recurrencia"
                            onAction={() => void applyRecurringSuggestion()}
                            title={`${insights.recurring.name} · ${recurringFrequencyLabel(insights.recurring.frequency)}`}
                          />
                        ) : null}
                        {linkedSubscriptionId || linkedRecurringIncomeId ? (
                          <MovementInsightRow
                            description="Se asociará cuando guardes este movimiento."
                            kind="recurring"
                            label="Recurrencia creada"
                            title={linkedSubscriptionId ? "Suscripción vinculada" : "Ingreso fijo vinculado"}
                          />
                        ) : null}
                        {insights.risk ? (
                          <MovementInsightRow
                            description={insights.risk.explanation}
                            kind="risk"
                            label="Revisión"
                            title={insights.risk.title}
                          />
                        ) : null}
                        {insights.budget ? (
                          <MovementInsightRow
                            description={insights.budget.recommendation}
                            kind="budget"
                            label="Presupuesto"
                            title={insights.budget.title}
                          />
                        ) : null}
                        {suggestions.aiUnavailable || insights.aiUnavailable ? (
                          <div className="flex min-h-[54px] items-center gap-3 border-t border-white/10 px-4 py-2">
                            <LoaderCircle className="h-4 w-4 shrink-0 text-storm" />
                            <div>
                              <p className="text-sm font-medium text-ink">Sugerencias locales activas</p>
                              <p className="text-xs text-storm/70">DeepSeek no respondió o alcanzó su límite.</p>
                            </div>
                          </div>
                        ) : null}
                        {(suggestions.isLoading || insights.isLoading) &&
                        !suggestions.description &&
                        !suggestions.category &&
                        !suggestions.counterparty &&
                        !suggestions.account &&
                        !insights.recurring &&
                        !insights.risk &&
                        !insights.budget ? (
                          <div className="flex h-[54px] items-center gap-3 border-t border-white/10 px-4 text-sm text-storm">
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                            Buscando sugerencias…
                          </div>
                        ) : null}
                      </>
                    }
                    showDestinationAmount={isTransfer && hasTransferCurrencyMismatch}
                  />
                </div>
              ) : null}

              {activePanel === "category" ? (
                <MovementDetailOptionsPanel
                  onChange={(value) => {
                    updateFormState("categoryId", value);
                    setCategoryFeedbackIntent(
                      value
                        ? { confidence: null, kind: "manual_category_change", source: "movement-form" }
                        : null,
                    );
                    setActivePanel("details");
                  }}
                  options={categoryOptions}
                  value={formState.categoryId}
                />
              ) : null}

              {activePanel === "counterparty" ? (
                <MovementDetailOptionsPanel
                  actionLabel="Nuevo contacto"
                  onAction={openContactDialog}
                  onChange={(value) => {
                    updateFormState("counterpartyId", value);
                    setActivePanel("details");
                  }}
                  options={counterpartyOptions}
                  value={formState.counterpartyId}
                />
              ) : null}

              {activePanel === "split" && splitLines ? (
                <div>
                  {errorMessage ? (
                    <div className="mb-4">
                      <FormFeedbackBanner description={errorMessage} title="Revisa la división" />
                    </div>
                  ) : null}
                  <MovementSplitPanel
                    categories={filteredCategories}
                    currencyCode={suggestionCurrencyCode}
                    lines={splitLines}
                    onChange={(lines) => {
                      setSplitLines(lines);
                      setIsDirty(true);
                      setErrorMessage("");
                    }}
                    onRemove={() => {
                      setSplitLines(null);
                      setActivePanel("details");
                      setIsDirty(true);
                    }}
                    totalAmount={computedAmount}
                  />
                </div>
              ) : null}
            </div>

            {visibleAccounts.length >= minimumAccountsRequired &&
            (activePanel === "main" || activePanel === "details" || activePanel === "split") ? (
              <footer className="shrink-0 border-t border-white/10 px-5 py-4 sm:px-6">
                <Button className="w-full justify-center" disabled={isSaving} type="submit">
                  {isSaving ? (
                    <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : "Guardar"}
                </Button>
              </footer>
            ) : null}
          </form>
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
