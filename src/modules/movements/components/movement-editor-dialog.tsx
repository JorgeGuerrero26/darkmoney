import {
  BriefcaseBusiness,
  CalendarClock,
  ChevronDown,
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
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import { formatDateTime } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  AttachmentSummary,
  CategorySummary,
  CounterpartySummary,
  MovementRecord,
  MovementStatus,
  MovementType,
  ObligationSummary,
  SubscriptionSummary,
} from "../../../types/domain";
import { AttachmentGallery } from "../../attachments/components/attachment-gallery";
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

const movementTextInputClassName = "field-dark";
const movementTextareaClassName = "field-dark min-h-[120px] resize-y py-3 leading-7";
const movementEditorPanelClassName =
  "glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] p-4 sm:p-6";
const movementFieldLabelClassName =
  "text-xs font-semibold uppercase tracking-[0.22em] text-storm/80";
const movementFieldHintClassName = "mt-1.5 break-words text-xs leading-6 text-storm/70";
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


export type MovementEditorDialogProps = {
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


export function MovementEditorDialog({
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
  // Divulgación progresiva: en creación lo avanzado arranca plegado; en edición abierto.
  const [showAdvanced, setShowAdvanced] = useState(!isCreateMode);

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
      className="animate-fade-in fixed inset-0 z-40 isolate bg-void/70 backdrop-blur-sm"
      onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }}
      onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) closeEditor(); }}
      role="dialog"
    >
      <div className="flex min-h-full items-center justify-center p-3 sm:p-6">
        <div
          className="animate-rise-in relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl [transform:translateZ(0)]"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="relative flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-y-auto px-4 pt-4 sm:px-6 sm:pt-6">
            <div className="flex items-start justify-between gap-4">
              <div className="max-w-2xl space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/90">
                    {isCreateMode ? "nuevo movimiento" : "editar movimiento"}
                  </span>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-storm/75">
                    Se refleja al guardar
                  </span>
                </div>
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">
                    {isCreateMode ? "Registrar movimiento" : previewTitle}
                  </h2>
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

              <section className="glass-panel-soft relative hidden min-w-0 overflow-hidden rounded-[24px] p-4 sm:p-6 lg:block lg:p-7">
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
                          {selectedCategory?.name ?? "Sin categoria"}
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

              <div className="mt-8 flex items-center gap-4 px-1">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-white/5" />
              <span className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/70">
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

                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                      <p className="text-[0.6rem] sm:text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">
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
                        emptyMessage="No encontramos una categoria con ese termino."
                        onChange={(nextValue) => updateFormState("categoryId", nextValue)}
                        options={categoryPickerOptions}
                        placeholderDescription="Asocia este movimiento a una categoria."
                        placeholderLabel="Sin categoria"
                        queryPlaceholder="Buscar categoria..."
                        value={formState.categoryId}
                      />
                    </MovementField>
                  </div>
                </section>

                <button
                  aria-expanded={showAdvanced}
                  className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 text-left transition duration-200 ${
                    showAdvanced
                      ? "border-pine/25 bg-pine/[0.06] text-ink"
                      : "border-white/10 bg-white/[0.03] text-storm hover:border-white/16 hover:text-ink"
                  }`}
                  onClick={() => setShowAdvanced((open) => !open)}
                  type="button"
                >
                  <span className="text-sm font-semibold">
                    Más opciones
                    <span className="ml-2 text-xs font-normal text-storm/70">
                      contraparte, obligación, suscripción, notas, metadata y adjuntos
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 shrink-0 transition ${showAdvanced ? "rotate-180" : ""}`}
                  />
                </button>

                {showAdvanced ? (
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
                </>
                ) : null}
              </div>
              </div>

              <div className="sticky bottom-0 z-[60] -mx-4 sm:-mx-6 mt-8 rounded-b-[28px] border-t border-white/10 bg-shell/95 px-4 py-5 sm:px-6 backdrop-blur-md">
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
