import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
  Copy,
  LoaderCircle,
  ReceiptText,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import type {
  FormEvent,
  InputHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import { ResourceEditorDestination } from "../../../components/ui/resource-editor";
import { useFocusTrap } from "../../../components/ui/use-focus-trap";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  AttachmentSummary,
  BudgetOverview,
  CategorySummary,
  CounterpartySummary,
  ExchangeRateSummary,
  MovementRecord,
  MovementStatus,
  MovementType,
  ObligationSummary,
  RecurringIncomeSummary,
  SubscriptionSummary,
} from "../../../types/domain";
import { AttachmentGallery } from "../../attachments/components/attachment-gallery";
import { CompactAttachmentField } from "../../attachments/components/compact-attachment-field";
import { PendingReceiptField } from "../../attachments/components/pending-receipt-field";
import {
  expenseLikeMovementTypes,
  filterCategoriesForMovementType,
  getCategoryColor,
  getCounterpartyColor,
  getMovementStatusColor,
  getMovementStatusOption,
  getMovementTypeOption,
  getMovementVisualPreset,
  incomeLikeMovementTypes,
  movementStatusOptions,
  movementTypeOptions,
  parseOptionalInteger,
  parseOptionalNumber,
} from "../lib/movement-form";
import type {
  MovementFieldProps,
  MovementFormState,
} from "../lib/movement-form";
import {
  MovementDetailOptionsPanel,
  MovementInsightRow,
  MovementDetailsNavigationRow,
  MovementDetailsPanel,
  MovementDetailsReceiptRow,
  MovementSuggestionRow,
  PendingMovementReceiptControl,
} from "./movement-details-panel";
import { useMovementSuggestions } from "../hooks/use-movement-suggestions";
import { useMovementInsights } from "../hooks/use-movement-insights";
import { recurringFrequencyFields, recurringFrequencyLabel } from "../lib/movement-insights";
import { movementSpendTypeLabel } from "../lib/movement-spend-type";
import { MovementSplitPanel } from "./movement-split-panel";
import {
  canSplitMovement,
  createMovementSplitLines,
  type MovementSplitLine,
} from "../lib/split-movement";
import type { BudgetInsight, RiskInsight } from "../../../services/queries/movement-ai";
import {
  getQueryErrorMessage,
  useCreateCategoryMutation,
  useCreateCounterpartyMutation,
  useCreateRecurringIncomeMutation,
  useCreateSubscriptionMutation,
  useBudgetSpendTypesQuery,
} from "../../../services/queries/workspace-data";

const movementTextInputClassName = "field-dark";
const movementTextareaClassName = "field-dark min-h-[120px] resize-y py-3 leading-7";
const movementEditorPanelClassName =
  "relative min-w-0 overflow-visible rounded-xl border border-white/10 bg-[#141311] p-4";
const movementFieldLabelClassName =
  "text-[0.8125rem] font-medium tracking-[0.01em] text-storm";
function MovementField({ children, errorKey, hint, invalidFields, label }: MovementFieldProps) {
  const hasError = !!errorKey && !!invalidFields?.has(errorKey);
  return (
    <label className="block min-w-0">
      <span className={movementFieldLabelClassName}>{label}</span>
      <div
        className={`mt-1.5${hasError ? " field-error-ring" : ""}`}
        data-field={errorKey}
      >
        {children}
      </div>
      {hint ? <p className="sr-only">{hint}</p> : null}
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


export type MovementEditorDialogProps = {
  accounts: AccountSummary[];
  accessMessage: string;
  attachments: AttachmentSummary[];
  baseCurrencyCode: string;
  budgets: BudgetOverview[];
  canManageReceipts: boolean;
  categories: CategorySummary[];
  clearFieldError: (field: string) => void;
  closeEditor: () => void;
  counterparties: CounterpartySummary[];
  errorMessage: string;
  exchangeRates: ExchangeRateSummary[];
  formState: MovementFormState;
  invalidFields: Set<string>;
  handleDeleteMovement: () => void;
  handleDuplicateMovement: () => void;
  handleSaveTemplate: () => void;
  isSavingTemplate: boolean;
  handleDeleteReceipt: (attachment: AttachmentSummary) => Promise<void>;
  handleUploadReceipt: (file: File) => Promise<void>;
  handleSubmit: (event: FormEvent<HTMLFormElement>, splitLines: MovementSplitLine[] | null, linkedRecurringIncomeId: number | null) => Promise<void>;
  isCreateMode: boolean;
  isSaving: boolean;
  isUploadingReceipt: boolean;
  obligations: ObligationSummary[];
  onErrorMessage: (message: string) => void;
  onDirty: () => void;
  onCategoryFeedback: (intent: MovementCategoryFeedbackIntent | null) => void;
  onIntelligenceChange: (value: { budget: BudgetInsight | null; risk: RiskInsight | null }) => void;
  pendingReceiptFile: File | null;
  proAccessEnabled?: boolean;
  recurringIncome: RecurringIncomeSummary[];
  movementHistory: MovementRecord[];
  selectedMovement: MovementRecord | null;
  subscriptions: SubscriptionSummary[];
  updatePendingReceiptFile: (file: File | null) => void;
  updateFormState: <Field extends keyof MovementFormState>(
    field: Field,
    value: MovementFormState[Field],
  ) => void;
  workspaceId: number;
  userId: string;
};

export type MovementCategoryFeedbackIntent = {
  confidence: number | null;
  kind: "accepted_category_suggestion" | "manual_category_change";
  source: string;
};

type MovementEditorPanel =
  | "main"
  | "details"
  | "type"
  | "destinationAccount"
  | "category"
  | "spendType"
  | "counterparty"
  | "split";


export function MovementEditorDialog({
  accounts,
  accessMessage,
  attachments,
  baseCurrencyCode,
  budgets,
  canManageReceipts,
  categories,
  clearFieldError,
  closeEditor,
  counterparties,
  errorMessage,
  exchangeRates,
  formState,
  handleDeleteMovement,
  handleDuplicateMovement,
  handleSaveTemplate,
  handleDeleteReceipt,
  handleUploadReceipt,
  handleSubmit,
  invalidFields,
  isCreateMode,
  isSaving,
  isSavingTemplate,
  isUploadingReceipt,
  obligations,
  onErrorMessage,
  onDirty,
  onCategoryFeedback,
  onIntelligenceChange,
  pendingReceiptFile,
  proAccessEnabled,
  recurringIncome,
  movementHistory,
  selectedMovement,
  subscriptions,
  updatePendingReceiptFile,
  updateFormState,
  workspaceId,
  userId,
}: MovementEditorDialogProps) {
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(typeof document === "undefined" ? null : document.activeElement as HTMLElement | null);
  useFocusTrap(editorRef, !isDeleteConfirmOpen);
  const [activePanel, setActivePanel] = useState<MovementEditorPanel>("main");
  const [splitLines, setSplitLines] = useState<MovementSplitLine[] | null>(null);
  const splitEnabled = canSplitMovement(formState.movementType, isCreateMode ? undefined : selectedMovement?.metadata);
  const [linkedSubscriptionId, setLinkedSubscriptionId] = useState<number | null>(null);
  const [linkedRecurringIncomeId, setLinkedRecurringIncomeId] = useState<number | null>(null);
  const createCategoryMutation = useCreateCategoryMutation(workspaceId, userId);
  const createCounterpartyMutation = useCreateCounterpartyMutation(workspaceId, userId);
  const createSubscriptionMutation = useCreateSubscriptionMutation(workspaceId, userId);
  const createRecurringIncomeMutation = useCreateRecurringIncomeMutation(workspaceId, userId);
  const spendTypes = useBudgetSpendTypesQuery(workspaceId).data ?? [];
  const isCreatingRecurrence = createSubscriptionMutation.isPending || createRecurringIncomeMutation.isPending;
  const isBusy = isSaving || isCreatingRecurrence;

  useEffect(() => () => openerRef.current?.focus(), []);
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || isDeleteConfirmOpen || isBusy) return;
      closeEditor();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [closeEditor, isBusy, isDeleteConfirmOpen]);

  useEffect(() => {
    if (invalidFields.size === 0) return;
    const firstField = [...invalidFields][0];
    if (["description", "occurredAt"].includes(firstField)) {
      setActivePanel("details");
    }
    setTimeout(() => {
      const firstEl = document.querySelector<HTMLElement>(`[data-field="${firstField}"]`);
      if (firstEl) {
        firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
        firstEl.querySelector<HTMLElement>("input,button,[tabindex='0']")?.focus();
      }
    }, 0);
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
    } else {
      // obligation_payment, obligation_opening y adjustment van en cualquier sentido.
      if (selectedSourceAccount && srcAmt > 0) {
        impacts.push({
          account: selectedSourceAccount,
          delta: -srcAmt,
          projectedBalance: selectedSourceAccount.currentBalance - srcAmt,
        });
      }
      if (selectedDestinationAccount && dstAmt > 0) {
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
  const primaryUsesDestination =
    incomeLikeMovementTypes.has(formState.movementType) ||
    (!formState.sourceAmount.trim() && Boolean(formState.destinationAmount.trim()));
  const primaryAccount = primaryUsesDestination ? selectedDestinationAccount : selectedSourceAccount;
  const primaryAmount = primaryUsesDestination ? formState.destinationAmount : formState.sourceAmount;
  const primaryAmountField = primaryUsesDestination ? "destinationAmount" : "sourceAmount";
  const primaryAccountField = primaryUsesDestination ? "destinationAccountId" : "sourceAccountId";
  const primaryProjectedBalance = primaryAccount
    ? balanceImpacts.find((impact) => impact.account.id === primaryAccount.id)?.projectedBalance ??
      primaryAccount.currentBalance
    : null;

  const suggestions = useMovementSuggestions({
    accountId: primaryAccount?.id ?? null,
    accounts,
    actsAsIncome: primaryUsesDestination,
    enabled: activePanel === "details",
    workspaceId,
    proAccessEnabled,
    movementType: formState.movementType,
    amount: Number.isFinite(displayAmount) && displayAmount > 0 ? displayAmount : null,
    currencyCode: displayCurrencyCode,
    description: formState.description,
    occurredAt: formState.occurredAt,
    categoryId: Number.isFinite(selectedCategoryId) ? selectedCategoryId : null,
    counterpartyId: selectedCounterparty?.id ?? null,
    categories: filteredCategories,
    counterparties,
    movements: movementHistory,
    editingMovementId: selectedMovement?.id,
  });
  const insights = useMovementInsights({
    account: primaryAccount,
    actsAsIncome: primaryUsesDestination,
    amount: displayAmount,
    baseCurrencyCode,
    budgets,
    category: selectedCategory,
    counterparty: selectedCounterparty,
    currencyCode: displayCurrencyCode,
    description: formState.description,
    editingMovementId: selectedMovement?.id,
    enabled: activePanel === "details",
    exchangeRates,
    movementType: formState.movementType,
    movements: movementHistory,
    occurredAt: formState.occurredAt,
    proAccessEnabled,
    recurringIncome,
    subscriptions,
    workspaceId,
  });

  useEffect(() => {
    onIntelligenceChange({ budget: insights.budget, risk: insights.risk });
  }, [insights.budget, insights.risk, onIntelligenceChange]);

  async function applyCategorySuggestion() {
    const suggestion = suggestions.category;
    if (!suggestion) return;
    if (suggestion.categoryId !== null) {
      onCategoryFeedback({
        confidence: suggestion.confidence,
        kind: "accepted_category_suggestion",
        source: suggestion.source === "deepseek" ? "movement-form-ai" : "movement-form",
      });
      updateFormState("categoryId", String(suggestion.categoryId));
      return;
    }
    const name = suggestion.newCategoryName?.trim();
    if (!name || formState.movementType === "transfer") return;
    onErrorMessage("");
    try {
      const result = await createCategoryMutation.mutateAsync({
        workspaceId,
        userId,
        name,
        kind: incomeLikeMovementTypes.has(formState.movementType) ? "income" : "expense",
        parentId: null,
        color: incomeLikeMovementTypes.has(formState.movementType) ? "#58D6B3" : "#D4A574",
        icon: null,
        sortOrder: 0,
        isActive: true,
      });
      onCategoryFeedback({
        confidence: suggestion.confidence,
        kind: "accepted_category_suggestion",
        source: suggestion.source === "deepseek" ? "movement-form-ai" : "movement-form",
      });
      updateFormState("categoryId", String(result.id));
    } catch (error) {
      onErrorMessage(getQueryErrorMessage(error, "No pudimos crear la categoría sugerida."));
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
    onErrorMessage("");
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
      updateFormState("counterpartyId", String(result.id));
    } catch (error) {
      onErrorMessage(getQueryErrorMessage(error, "No pudimos crear la contraparte sugerida."));
    }
  }

  async function applyRecurringSuggestion() {
    const suggestion = insights.recurring;
    if (
      !isCreateMode || !suggestion || displayAmount <= 0 ||
      linkedSubscriptionId || linkedRecurringIncomeId ||
      createSubscriptionMutation.isPending || createRecurringIncomeMutation.isPending
    ) return;
    const { frequency, intervalCount } = recurringFrequencyFields(suggestion.frequency);
    const startDate = formState.occurredAt.slice(0, 10);
    const parsedDate = new Date(`${startDate}T12:00:00`);
    const dayOfMonth = Math.max(1, Math.min(31, Number(startDate.slice(8, 10)) || 1));
    const dayOfWeek = Number.isNaN(parsedDate.getTime()) ? null : parsedDate.getDay();
    onErrorMessage("");

    try {
      if (suggestion.type === "subscription") {
        const result = await createSubscriptionMutation.mutateAsync({
          workspaceId,
          userId,
          name: suggestion.name,
          vendorPartyId: selectedCounterparty?.id ?? null,
          accountId: selectedSourceAccount?.id ?? null,
          categoryId: selectedCategory?.id ?? null,
          currencyCode: displayCurrencyCode,
          amount: displayAmount,
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
        updateFormState("subscriptionId", String(result.id));
      } else {
        const result = await createRecurringIncomeMutation.mutateAsync({
          workspaceId,
          userId,
          name: suggestion.name,
          payerPartyId: selectedCounterparty?.id ?? null,
          accountId: selectedDestinationAccount?.id ?? null,
          categoryId: selectedCategory?.id ?? null,
          currencyCode: displayCurrencyCode,
          amount: displayAmount,
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
        onDirty();
      }
    } catch (error) {
      onErrorMessage(getQueryErrorMessage(error, "No pudimos crear la recurrencia."));
    }
  }

  useEffect(() => {
    setIsDeleteConfirmOpen(false);
    setActivePanel("main");
    setSplitLines(null);
    setLinkedSubscriptionId(null);
    setLinkedRecurringIncomeId(null);
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
  const obligationPickerOptions = useMemo(() => {
    // Un movimiento que entra solo puede abonar algo que te deben, y al reves.
    // Espeja compatibleObligations de la app movil.
    const entersMoney = incomeLikeMovementTypes.has(formState.movementType)
      ? true
      : expenseLikeMovementTypes.has(formState.movementType)
        ? false
        : (parseOptionalNumber(formState.destinationAmount) ?? 0) >
          (parseOptionalNumber(formState.sourceAmount) ?? 0);
    const compatibleDirection = entersMoney ? "receivable" : "payable";

    return obligations
      .filter(
        (obligation) =>
          String(obligation.id) === formState.obligationId ||
          (obligation.direction === compatibleDirection &&
            (obligation.status === "active" || obligation.status === "draft")),
      )
      .map((obligation) => ({
        value: String(obligation.id),
        label: obligation.title,
        description: `${obligation.currencyCode} · ${obligation.counterparty}`,
        leadingLabel: obligation.currencyCode,
        leadingColor: obligation.direction === "receivable" ? "#1b6a58" : "#c46a31",
        searchText: `${obligation.title} ${obligation.currencyCode} ${obligation.counterparty} ${obligation.direction}`,
      }));
  }, [
    obligations,
    formState.movementType,
    formState.obligationId,
    formState.sourceAmount,
    formState.destinationAmount,
  ]);
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
      aria-label={activePanel === "main" ? (isCreateMode ? "Nuevo movimiento" : "Editar movimiento") : "Detalles del movimiento"}
      aria-modal="true"
      className="animate-fade-in fixed inset-0 z-[80] isolate bg-black/75"
      onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }}
      onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0 && !isBusy) closeEditor(); }}
      role="dialog"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div
          className="resource-editor animate-rise-in relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[640px] overflow-hidden rounded-[14px] border border-white/10 bg-[#1a1917] shadow-none [transform:translateZ(0)]"
          ref={editorRef}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-y-auto px-4 pt-4 sm:px-6 sm:pt-6">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
              {activePanel !== "main" ? (
                <button
                  className="flex min-w-0 items-center gap-3 text-left text-ink transition hover:text-white"
                  onClick={() =>
                    setActivePanel(
                      activePanel === "details" ? "main" : "details",
                    )
                  }
                  type="button"
                >
                  <ArrowLeft className="h-4 w-4 shrink-0" />
                  <span className="truncate font-display text-xl font-semibold">
                    {activePanel === "details"
                      ? "Detalles"
                      : activePanel === "type"
                        ? "Tipo de movimiento"
                        : activePanel === "destinationAccount"
                          ? "Cuenta de destino"
                        : activePanel === "category"
                          ? "Categoría"
                          : activePanel === "spendType"
                            ? "Tipo de gasto"
                          : activePanel === "counterparty"
                            ? "Contraparte"
                            : "Dividir en categorías"}
                  </span>
                </button>
              ) : (
                <h2 className="font-display text-xl font-semibold text-ink">
                  {isCreateMode ? "Nuevo movimiento" : "Editar movimiento"}
                </h2>
              )}
              <button
                aria-label="Cerrar editor de movimiento"
                className="grid h-9 w-9 place-items-center rounded-full text-storm transition hover:bg-white/[0.06] hover:text-ink"
                disabled={isBusy}
                onClick={closeEditor}
                type="button"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              className="mt-6 flex flex-1 flex-col"
              noValidate
              onSubmit={(event) => {
                if (isBusy) { event.preventDefault(); return; }
                void handleSubmit(event, splitLines, linkedRecurringIncomeId);
              }}
            >
              {errorMessage ? (
                <FormFeedbackBanner
                  className="mb-6"
                  description={errorMessage}
                  title="Revisa este movimiento antes de guardarlo"
                />
              ) : null}

              <div className="space-y-5">
                {activePanel === "main" ? (
                  <>
                    <MovementField
                      errorKey={primaryAmountField}
                      invalidFields={invalidFields}
                      label="Monto"
                    >
                      <EditorInput
                        autoFocus
                        data-modal-initial-focus
                        className="h-16 font-display text-[2rem] font-semibold"
                        inputMode="decimal"
                        onChange={(event) => {
                          clearFieldError(primaryAmountField);
                          updateFormState(primaryAmountField, event.target.value);
                        }}
                        placeholder="0.00"
                        value={primaryAmount}
                      />
                    </MovementField>

                    <div className="rounded-xl border border-white/10 bg-[#141311]">
                      <div className="p-3" data-field={primaryAccountField}>
                        <SearchablePicker
                          appearance="compact"
                          emptyMessage="No encontramos una cuenta con ese término."
                          onChange={(nextValue) => {
                            clearFieldError(primaryAccountField);
                            updateFormState(primaryAccountField, nextValue);
                          }}
                          options={accountPickerOptions}
                          placeholderDescription="Cuenta principal del movimiento."
                          placeholderLabel="Selecciona una cuenta"
                          queryPlaceholder="Buscar cuenta..."
                          value={primaryUsesDestination ? formState.destinationAccountId : formState.sourceAccountId}
                        />
                      </div>
                      {primaryAccount && primaryProjectedBalance !== null ? (
                        <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm">
                          <span className="text-storm">Saldo después</span>
                          <span className="font-semibold text-ink">
                            {formatCurrency(primaryProjectedBalance, primaryAccount.currencyCode)}
                          </span>
                        </div>
                      ) : null}
                    </div>

                    <div>
                      <p className={movementFieldLabelClassName}>Estado</p>
                      <div className="mt-2 grid grid-cols-4 rounded-xl border border-white/10 bg-[#141311] p-1">
                        {([
                          { value: "posted", label: "Confirmado" },
                          { value: "pending", label: "Pendiente" },
                          { value: "planned", label: "Planificado" },
                          { value: "voided", label: "Anulado" },
                        ] as const).map((option) => (
                          <button
                            className={`rounded-lg px-1 py-2.5 text-xs font-semibold transition ${
                              formState.status === option.value
                                ? "bg-ink text-void"
                                : "text-storm hover:text-ink"
                            }`}
                            key={option.value}
                            onClick={() => updateFormState("status", option.value)}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ResourceEditorDestination onClick={() => setActivePanel("details")} summary="Categoría, contraparte, fecha y comprobante" />
                  </>
                ) : null}

                {activePanel === "details" ? (
                  <MovementDetailsPanel
                    categoryLabel={splitLines ? undefined : selectedCategory?.name ?? "Sin categoría"}
                    counterpartyLabel={selectedCounterparty?.name ?? "Sin asignar"}
                    description={formState.description}
                    destinationAmount={formState.destinationAmount}
                    destinationCurrencyCode={selectedDestinationAccount?.currencyCode}
                    helperText="Si dejas la descripción vacía, se genera con la categoría, la contraparte y la cuenta."
                    invalidFields={invalidFields}
                    isTransfer={formState.movementType === "transfer"}
                    navigationRows={
                      formState.movementType === "transfer" ? (
                        <MovementDetailsNavigationRow
                          label="Cuenta de destino"
                          onClick={() => setActivePanel("destinationAccount")}
                          value={selectedDestinationAccount?.name ?? "Selecciona destino"}
                        />
                      ) : splitEnabled ? (
                        <MovementDetailsNavigationRow
                          label="Dividir en categorías"
                          onClick={() => {
                            setSplitLines((current) => current ?? createMovementSplitLines(formState.categoryId));
                            setActivePanel("split");
                            onDirty();
                          }}
                          value={splitLines ? `${splitLines.length} partes` : "No dividido"}
                        />
                      ) : null
                    }
                    occurredAt={formState.occurredAt}
                    onDescriptionChange={(value) => {
                      clearFieldError("description");
                      updateFormState("description", value);
                    }}
                    onDestinationAmountChange={(value) => updateFormState("destinationAmount", value)}
                    onOccurredAtChange={(value) => {
                      clearFieldError("occurredAt");
                      updateFormState("occurredAt", value);
                    }}
                    onOpenCategory={splitLines ? undefined : () => setActivePanel("category")}
                    onOpenSpendType={formState.movementType === "expense" && !splitLines ? () => setActivePanel("spendType") : undefined}
                    spendTypeLabel={formState.movementType === "expense" && !splitLines ? movementSpendTypeLabel(spendTypes, parseOptionalInteger(formState.spendTypeId), selectedCategory?.defaultSpendTypeId) : undefined}
                    onOpenCounterparty={() => setActivePanel("counterparty")}
                    onOpenType={() => setActivePanel("type")}
                    receiptRows={
                      isCreateMode ? (
                        <MovementDetailsReceiptRow>
                          <PendingMovementReceiptControl
                            canUpload={canManageReceipts}
                            file={pendingReceiptFile}
                            lockedMessage={accessMessage}
                            onChange={updatePendingReceiptFile}
                          />
                        </MovementDetailsReceiptRow>
                      ) : selectedMovement ? (
                        <CompactAttachmentField
                          accessMessage={accessMessage}
                          attachments={attachments}
                          canManage={canManageReceipts}
                          embedded
                          isUploading={isUploadingReceipt}
                          onDelete={(attachment) => void handleDeleteReceipt(attachment)}
                          onUpload={(file) => void handleUploadReceipt(file)}
                        />
                      ) : null
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
                            onAccept={() =>
                              updateFormState(
                                primaryUsesDestination ? "destinationAccountId" : "sourceAccountId",
                                String(suggestions.account!.accountId),
                              )
                            }
                            reason={suggestions.account.reasons[0]}
                            value={suggestions.account.accountName}
                          />
                        ) : null}
                        {isCreateMode && insights.recurring && !linkedSubscriptionId && !linkedRecurringIncomeId ? (
                          <MovementInsightRow
                            actionDisabled={isBusy}
                            actionLabel={isCreatingRecurrence ? "Creando…" : "Crear"}
                            description={insights.recurring.reasons[0] ?? "Coincide con un patrón que ya aparece en tus movimientos."}
                            kind="recurring"
                            label="Posible recurrencia"
                            onAction={() => void applyRecurringSuggestion()}
                            title={`${insights.recurring.name} · ${recurringFrequencyLabel(insights.recurring.frequency)}`}
                          />
                        ) : null}
                        {linkedSubscriptionId || linkedRecurringIncomeId ? (
                          <MovementInsightRow
                            description="La recurrencia ya está guardada. Se asociará a este movimiento al guardarlo."
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
                        {suggestions.learningUnavailable ? (
                          <p role="status" className="border-t border-white/10 px-4 py-3 text-xs text-storm">
                            No pudimos consultar tus correcciones anteriores. Las sugerencias del historial siguen disponibles.
                          </p>
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
                    showDestinationAmount={
                      formState.movementType === "transfer" &&
                      Boolean(selectedSourceAccount && selectedDestinationAccount) &&
                      selectedSourceAccount?.currencyCode !== selectedDestinationAccount?.currencyCode
                    }
                    typeLabel={movementTypeOption.label}
                  />
                ) : null}

                {activePanel === "type" ? (
                  <MovementDetailOptionsPanel
                    onChange={(value) => {
                      updateFormState("movementType", value as MovementType);
                      if (value !== "expense" && value !== "income") setSplitLines(null);
                      setActivePanel("details");
                    }}
                    options={movementTypePickerOptions}
                    value={formState.movementType}
                  />
                ) : null}

                {activePanel === "spendType" ? (
                  <MovementDetailOptionsPanel
                    onChange={(value) => {
                      updateFormState("spendTypeId", value);
                      setActivePanel("details");
                    }}
                    options={[
                      { value: "", label: selectedCategory?.defaultSpendTypeId ? "Usar tipo de la categoría" : "Sin tipo" },
                      ...spendTypes.map((type) => ({ value: String(type.id), label: type.name })),
                    ]}
                    value={formState.spendTypeId}
                  />
                ) : null}

                {activePanel === "destinationAccount" ? (
                  <MovementDetailOptionsPanel
                    onChange={(value) => {
                      updateFormState("destinationAccountId", value);
                      setActivePanel("details");
                    }}
                    options={accountPickerOptions}
                    value={formState.destinationAccountId}
                  />
                ) : null}

                {activePanel === "category" ? (
                  <MovementDetailOptionsPanel
                    onChange={(value) => {
                      updateFormState("categoryId", value);
                      onCategoryFeedback(
                        value
                          ? { confidence: null, kind: "manual_category_change", source: "movement-form" }
                          : null,
                      );
                      setActivePanel("details");
                    }}
                    options={[
                      { value: "", label: "Sin categoría" },
                      ...categoryPickerOptions,
                    ]}
                    value={formState.categoryId}
                  />
                ) : null}

                {activePanel === "counterparty" ? (
                  <MovementDetailOptionsPanel
                    onChange={(value) => {
                      updateFormState("counterpartyId", value);
                      setActivePanel("details");
                    }}
                    options={[
                      { value: "", label: "Sin asignar" },
                      ...counterpartyPickerOptions,
                    ]}
                    value={formState.counterpartyId}
                  />
                ) : null}

                {activePanel === "split" && splitEnabled && splitLines ? (
                  <MovementSplitPanel
                    categories={filteredCategories}
                    spendTypes={spendTypes}
                    movementType={formState.movementType}
                    currencyCode={displayCurrencyCode}
                    lines={splitLines}
                    onChange={(lines) => {
                      setSplitLines(lines);
                      onDirty();
                      onErrorMessage("");
                    }}
                    onDone={() => {
                      onErrorMessage("");
                      setActivePanel("details");
                    }}
                    onRemove={() => {
                      setSplitLines(null);
                      setActivePanel("details");
                      onDirty();
                    }}
                    totalAmount={displayAmount}
                  />
                ) : null}
              </div>

              <section className="hidden">
              <div
                className="absolute -right-10 top-0 h-32 w-32 rounded-full blur-3xl animate-soft-pulse"
                style={{ backgroundColor: `${movementVisual.color}3d` }}
              />
              <div className="relative">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">
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
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">
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
                          {selectedCategory?.name ?? "Sin categoría"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-2 sm:gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-[16px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">
                        Impacto
                      </p>
                      <p className="mt-2 sm:mt-3 font-display text-xl sm:text-2xl font-semibold text-ink">
                        {formatCurrency(displayAmount, displayCurrencyCode)}
                      </p>
                    </div>

                    <div className="rounded-[16px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">
                        Flujo
                      </p>
                      <p className="mt-2 sm:mt-3 break-words text-xs sm:text-sm font-medium text-ink">{previewFlowLabel}</p>
                      <p className="mt-1 sm:mt-2 break-words text-xs leading-6 text-storm/75">{previewContextLabel}</p>
                    </div>

                    <div className="rounded-[16px] sm:rounded-[24px] border border-white/10 bg-black/15 px-3 py-3 sm:px-4 sm:py-4 backdrop-blur">
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">
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
                        <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">
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

              <div className="hidden">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/5" />
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
                Configuracion del movimiento
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-white/5 via-white/10 to-transparent" />
              </div>

              <div className="hidden">
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
                        appearance="compact"
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
                        appearance="compact"
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
                        appearance="compact"
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
                        appearance="compact"
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

                    {balanceImpacts.length > 0 ? (
                      <div className="rounded-xl border border-white/10 bg-black/10">
                        {balanceImpacts.map(({ account, projectedBalance }) => (
                          <div
                            className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 text-sm last:border-b-0"
                            key={account.id}
                          >
                            <span className="min-w-0 truncate text-storm">
                              Saldo después · {account.name}
                            </span>
                            <span className="shrink-0 font-semibold text-ink">
                              {formatCurrency(projectedBalance, account.currencyCode)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>

              <div className="space-y-4 sm:space-y-6">
                <section className={`${movementEditorPanelClassName} z-20`}>
                  <div className="mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                    <BriefcaseBusiness className="h-4 w-4 sm:h-5 sm:w-5 text-ember" />
                    <div>
                      <p className="text-[0.6rem] sm:text-xs uppercase tracking-[0.22em] text-storm">Clasificación</p>
                      <p className="mt-0.5 sm:mt-1 text-sm sm:text-lg font-medium text-ink">Categoría del movimiento</p>
                    </div>
                  </div>

                  <div className="mt-3 sm:mt-6 space-y-3 sm:space-y-5">
                    <MovementField
                      hint="La lista se adapta segun si el movimiento es de ingreso o gasto."
                      label="Categoria"
                    >
                      <SearchablePicker
                        appearance="compact"
                        emptyMessage="No encontramos una categoria con ese termino."
                        onChange={(nextValue) => updateFormState("categoryId", nextValue)}
                        options={categoryPickerOptions}
                        placeholderDescription="Asocia este movimiento a una categoria."
                        placeholderLabel="Sin categoría"
                        queryPlaceholder="Buscar categoria..."
                        value={formState.categoryId}
                      />
                    </MovementField>
                  </div>
                </section>

                <button
                  aria-expanded={activePanel === "details"}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition duration-200 ${
                    activePanel === "details"
                      ? "border-pine/25 bg-pine/[0.06] text-ink"
                      : "border-white/10 bg-white/[0.03] text-storm hover:border-white/16 hover:text-ink"
                  }`}
                  onClick={() =>
                    setActivePanel((panel) => (panel === "details" ? "main" : "details"))
                  }
                  type="button"
                >
                  <span className="text-sm font-semibold">
                    Detalles
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition ${activePanel === "details" ? "rotate-180" : ""}`}
                  />
                </button>

                {activePanel === "details" ? (
                <>
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
                      hint="Persona, comercio, empresa o banco asociado."
                      label="Contraparte"
                    >
                      <SearchablePicker
                        appearance="compact"
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
                        appearance="compact"
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
                        appearance="compact"
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
                </>
                ) : null}
              </div>
              </div>

              {activePanel === "main" || activePanel === "details" ? (
              <div className="sticky bottom-0 z-[60] -mx-4 mt-6 border-t border-white/10 bg-[#1a1917] px-4 py-4 sm:-mx-6 sm:px-6">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!isCreateMode && selectedMovement && ["expense", "income", "transfer"].includes(selectedMovement.movementType) ? (
                    <Button
                      disabled={isSaving || isSavingTemplate}
                      onClick={handleSaveTemplate}
                      type="button"
                      variant="ghost"
                    >
                      {isSavingTemplate ? "Guardando atajo…" : "Guardar como atajo"}
                    </Button>
                  ) : null}
                  {!isCreateMode && selectedMovement ? (
                    <Button
                      className="min-w-[100px] justify-center"
                      disabled={isSaving}
                      onClick={handleDuplicateMovement}
                      type="button"
                      variant="ghost"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicar
                    </Button>
                  ) : null}
                  {!isCreateMode && selectedMovement ? (
                    <Button
                      className="min-w-[100px] justify-center"
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
                    className={isCreateMode ? "w-full justify-center" : "min-w-[155px] justify-center"}
                    disabled={isBusy}
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
              ) : null}
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
