import {
  Download,
  LoaderCircle,
  PiggyBank,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import type { FormEvent, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { InfoTip } from "../../../components/ui/info-tip";
import { Pagination } from "../../../components/ui/pagination";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, useSelection } from "../../../components/ui/bulk-action-bar";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  getQueryErrorMessage,
  type BudgetFormInput,
  useCreateBudgetMutation,
  useDeleteBudgetMutation,
  useToggleBudgetMutation,
  useUpdateBudgetMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import type { BudgetOverview, CategorySummary, ExchangeRateSummary, Workspace } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { BudgetAnalyticsModal } from "../components/budget-analytics-modal";
import { BudgetGrid } from "../components/budget-grid";
import { BudgetList } from "../components/budget-list";
import { BudgetTable } from "../components/budget-table";
import { useBudgetsFilters } from "../hooks/use-budgets-filters";
import type { BudgetScopeKind, ScopeFilter, StatusFilter } from "../lib/budgets-filters";
import {
  getBudgetCategoryColor,
  getBudgetCurrencyOption,
  getBudgetScopeDetails,
  isBudgetCurrent,
  normalizeCurrencyCode,
  scopeFilterPickerOptions,
  scopeOptions,
  statusFilterPickerOptions,
  type DisplayBudgetOverview,
} from "../lib/budgets-presenters";

const BUDGETS_PAGE_SIZE = 50;

type EditorMode = "create" | "edit";

type BudgetFormState = {
  name: string;
  scopeKind: BudgetScopeKind;
  periodStart: string;
  periodEnd: string;
  currencyCode: string;
  categoryId: number | null;
  accountId: number | null;
  limitAmount: string;
  alertPercent: string;
  rolloverEnabled: boolean;
  notes: string;
  isActive: boolean;
};

type FeedbackState = {
  tone: "success" | "error";
  title: string;
  description: string;
};

const inputClassName = "field-dark";
const textareaClassName = "field-dark min-h-[100px] resize-y py-3 leading-7";
const panelClassName = "glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] p-4 sm:p-6";
const labelClassName = "text-xs font-semibold uppercase tracking-[0.22em] text-storm/80";

function buildExchangeRateKey(fromCurrencyCode: string, toCurrencyCode: string) {
  return `${normalizeCurrencyCode(fromCurrencyCode)}:${normalizeCurrencyCode(toCurrencyCode)}`;
}

function buildExchangeRateMap(exchangeRates: ExchangeRateSummary[]) {
  const exchangeRateMap = new Map<string, number>();

  for (const exchangeRate of exchangeRates) {
    const key = buildExchangeRateKey(exchangeRate.fromCurrencyCode, exchangeRate.toCurrencyCode);

    if (exchangeRateMap.has(key) || exchangeRate.rate <= 0) {
      continue;
    }

    exchangeRateMap.set(key, exchangeRate.rate);
  }

  return exchangeRateMap;
}

function resolveExchangeRate(
  exchangeRateMap: Map<string, number>,
  fromCurrencyCode: string,
  toCurrencyCode: string,
) {
  const normalizedFromCurrencyCode = normalizeCurrencyCode(fromCurrencyCode);
  const normalizedToCurrencyCode = normalizeCurrencyCode(toCurrencyCode);

  if (normalizedFromCurrencyCode === normalizedToCurrencyCode) {
    return 1;
  }

  const directRate = exchangeRateMap.get(buildExchangeRateKey(normalizedFromCurrencyCode, normalizedToCurrencyCode));

  if (directRate && directRate > 0) {
    return directRate;
  }

  const inverseRate = exchangeRateMap.get(buildExchangeRateKey(normalizedToCurrencyCode, normalizedFromCurrencyCode));

  if (inverseRate && inverseRate > 0) {
    return 1 / inverseRate;
  }

  return null;
}

function convertBudgetAmount(
  amount: number,
  fromCurrencyCode: string,
  toCurrencyCode: string,
  baseCurrencyCode: string,
  exchangeRateMap: Map<string, number>,
) {
  const normalizedBaseCurrencyCode = normalizeCurrencyCode(baseCurrencyCode);
  const normalizedFromCurrencyCode = normalizeCurrencyCode(fromCurrencyCode);
  const normalizedToCurrencyCode = normalizeCurrencyCode(toCurrencyCode);
  const directRate = resolveExchangeRate(exchangeRateMap, normalizedFromCurrencyCode, normalizedToCurrencyCode);

  if (directRate !== null) {
    return amount * directRate;
  }

  const sourceToBaseRate = resolveExchangeRate(exchangeRateMap, normalizedFromCurrencyCode, normalizedBaseCurrencyCode);

  if (sourceToBaseRate !== null) {
    const amountInBaseCurrency = amount * sourceToBaseRate;

    if (normalizedToCurrencyCode === normalizedBaseCurrencyCode) {
      return amountInBaseCurrency;
    }

    const baseToTargetRate = resolveExchangeRate(exchangeRateMap, normalizedBaseCurrencyCode, normalizedToCurrencyCode);

    if (baseToTargetRate !== null) {
      return amountInBaseCurrency * baseToTargetRate;
    }
  }

  return amount;
}

function toNumericValue(value: string) {
  const sanitized = value.replace(/,/g, ".").trim();

  if (!sanitized) {
    return null;
  }

  const parsedValue = Number(sanitized);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function toDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildCurrentMonthRange() {
  const today = new Date();
  const periodStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const periodEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  return {
    periodStart: toDateValue(periodStart),
    periodEnd: toDateValue(periodEnd),
  };
}

function createDefaultFormState(workspace: Workspace | null): BudgetFormState {
  const range = buildCurrentMonthRange();

  return {
    name: "",
    scopeKind: "category",
    periodStart: range.periodStart,
    periodEnd: range.periodEnd,
    currencyCode: workspace?.baseCurrencyCode ?? "PEN",
    categoryId: null,
    accountId: null,
    limitAmount: "",
    alertPercent: "80",
    rolloverEnabled: false,
    notes: "",
    isActive: true,
  };
}

function buildFormStateFromBudget(budget: BudgetOverview): BudgetFormState {
  return {
    name: budget.name,
    scopeKind: budget.scopeKind,
    periodStart: budget.periodStart,
    periodEnd: budget.periodEnd,
    currencyCode: budget.currencyCode,
    categoryId: budget.categoryId ?? null,
    accountId: budget.accountId ?? null,
    limitAmount: String(budget.limitAmount),
    alertPercent: String(budget.alertPercent),
    rolloverEnabled: budget.rolloverEnabled,
    notes: budget.notes ?? "",
    isActive: budget.isActive,
  };
}

function Field({
  children,
  errorKey,
  hint,
  invalidFields,
  label,
}: {
  children: ReactNode;
  errorKey?: string;
  hint?: string;
  invalidFields?: Set<string>;
  label: string;
}) {
  const hasError = !!errorKey && !!invalidFields?.has(errorKey);
  return (
    <label className="block min-w-0">
      <span className={labelClassName}>{label}</span>
      <div className={`mt-1.5 sm:mt-3${hasError ? " field-error-ring" : ""}`} data-field={errorKey}>
        {children}
      </div>
      {hint ? (
        <p className="mt-1 break-words text-[0.65rem] leading-5 text-storm/75 sm:mt-2 sm:text-xs sm:leading-6">{hint}</p>
      ) : null}
    </label>
  );
}

function Input({ className = "", max, min, step, type, ...props }: InputHTMLAttributes<HTMLInputElement>) {
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
  return <textarea className={`${textareaClassName} ${className}`} {...props} />;
}

function ToggleRow({
  checked,
  description,
  label,
  onChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 rounded-[26px] border border-white/10 bg-white/[0.04] px-4 py-4 text-left transition duration-200 hover:border-white/16"
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-1 block text-sm leading-7 text-storm">{description}</span>
      </span>
      <span
        className={`relative inline-flex h-8 w-16 shrink-0 rounded-full border transition duration-200 ${checked ? "border-pine/30 bg-pine/20" : "border-white/10 bg-white/[0.05]"}`}
      >
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition duration-200 ${checked ? "left-9" : "left-1"}`} />
      </span>
    </button>
  );
}

function BudgetEditorDialog({
  accounts,
  categories,
  clearFieldError,
  closeEditor,
  feedback,
  formState,
  invalidFields,
  isCreateMode,
  isSaving,
  onSubmit,
  updateFormState,
  workspace,
}: {
  accounts: Array<{ id: number; name: string; currencyCode: string }>;
  categories: CategorySummary[];
  clearFieldError: (field: string) => void;
  closeEditor: () => void;
  feedback: FeedbackState | null;
  formState: BudgetFormState;
  invalidFields: Set<string>;
  isCreateMode: boolean;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateFormState: <Field extends keyof BudgetFormState>(field: Field, value: BudgetFormState[Field]) => void;
  workspace: Workspace | null;
}) {
  // Divulgación progresiva: al crear, lo avanzado (estado, rollover, notas)
  // arranca plegado; al editar se muestra todo para revisar de un vistazo.
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

  const title = formState.name.trim() || "Nuevo presupuesto";
  const scopeDetails = getBudgetScopeDetails(formState.scopeKind);
  const selectedCategory = categories.find((category) => category.id === formState.categoryId) ?? null;
  const selectedAccount = accounts.find((account) => account.id === formState.accountId) ?? null;
  const parsedLimitAmount = toNumericValue(formState.limitAmount) ?? 0;
  const currencyCodeForDisplay = formState.currencyCode || workspace?.baseCurrencyCode || "PEN";

  const currencyOptions = useMemo(
    () =>
      Array.from(new Set([workspace?.baseCurrencyCode ?? "PEN", "PEN", "USD", "EUR"])).map((currencyCode) =>
        getBudgetCurrencyOption(currencyCode, workspace?.baseCurrencyCode),
      ),
    [workspace?.baseCurrencyCode],
  );
  const categoryOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Sin categoría fija",
        description: "El presupuesto se aplicará sin amarrarse a una categoría puntual.",
        leadingLabel: "SC",
        leadingColor: "#6b7280",
        searchText: "sin categoría fija general",
      },
      ...categories
        .filter((category) => category.kind !== "income")
        .map((category) => ({
          value: String(category.id),
          label: category.name,
          description:
            category.kind === "both"
              ? "Disponible para movimientos mixtos o generales."
              : "Categoria de gasto disponible para este presupuesto.",
          leadingLabel: category.name.slice(0, 2).toUpperCase(),
          leadingColor: getBudgetCategoryColor(category.kind),
          searchText: `${category.name} ${category.kind}`,
        })),
    ],
    [categories],
  );
  const accountOptions = useMemo<PickerOption[]>(
    () => [
      {
        value: "",
        label: "Sin cuenta fija",
        description: "El presupuesto no se limitara a una sola cuenta por ahora.",
        leadingLabel: "SF",
        leadingColor: "#6b7280",
        searchText: "sin cuenta fija general",
      },
      ...accounts.map((account) => ({
        value: String(account.id),
        label: account.name,
        description: `Cuenta en ${account.currencyCode}.`,
        leadingLabel: account.currencyCode,
        leadingColor: account.currencyCode === "USD" ? "#4566d6" : "#1b6a58",
        searchText: `${account.name} ${account.currencyCode}`,
      })),
    ],
    [accounts],
  );

  return (
    <div
      className="fixed inset-0 z-[80] isolate overflow-y-auto bg-void/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now());
      }}
      onMouseUp={(e) => {
        const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0");
        delete (e.currentTarget as HTMLDivElement).dataset.pressStart;
        if (t0) closeEditor();
      }}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="animate-rise-in relative w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl [transform:translateZ(0)]"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <form className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden" noValidate onSubmit={onSubmit}>
            <div className="overflow-y-auto px-4 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/90">
                      {isCreateMode ? "Nuevo presupuesto" : "Editar presupuesto"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      {workspace?.baseCurrencyCode ? `Base ${workspace.baseCurrencyCode}` : "Sin base"}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.7rem]">
                    {isCreateMode ? "Crear presupuesto" : "Actualizar presupuesto"}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-9 text-storm">
                    Define un tope mensual, por categoría, por cuenta o por ambos. Luego el dashboard te mostrará
                    cuánto vas usando y cuáles están en riesgo.
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

              {feedback?.tone === "error" ? (
                <FormFeedbackBanner className="mt-6" description={feedback.description} title={feedback.title} />
              ) : null}

              <div className="glass-panel-soft mt-7 rounded-[24px] p-5 sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,#1b6a58,rgba(8,13,20,0.72))] text-white">
                        <PiggyBank className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Vista previa</p>
                        <h3 className="mt-2 break-words font-display text-4xl font-semibold text-ink">{title}</h3>
                        <p className="mt-3 text-base leading-8 text-storm">{scopeDetails.description}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">
                            {scopeDetails.label}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">
                            {currencyCodeForDisplay}
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">
                            {formState.isActive ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Limite</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(parsedLimitAmount, currencyCodeForDisplay)}
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Periodo</p>
                      <p className="mt-3 font-display text-lg font-semibold text-ink">
                        {formState.periodStart ? formatDate(formState.periodStart) : "Sin inicio"}
                      </p>
                      <p className="mt-1 text-sm text-storm">
                        hasta {formState.periodEnd ? formatDate(formState.periodEnd) : "sin cierre"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:mt-7 sm:gap-5 lg:grid-cols-2">
                <div className={`${panelClassName} lg:col-span-2`}>
                  <p className={labelClassName}>Identidad</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Base del presupuesto</h3>
                  <div className="mt-3 grid gap-3 sm:mt-6 sm:gap-5">
                    <Field errorKey="name" hint="Nombre visible para reconocerlo en la app." invalidFields={invalidFields} label="Nombre">
                      <Input
                        maxLength={120}
                        onChange={(event) => {
                          clearFieldError("name");
                          updateFormState("name", event.target.value);
                        }}
                        placeholder="Ej. Salud mensual"
                        value={formState.name}
                      />
                    </Field>
                    <div>
                      <span className={labelClassName}>Alcance</span>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {scopeOptions.map((option) => (
                          <button
                            className={`rounded-[22px] border p-4 text-left transition ${
                              formState.scopeKind === option.value
                                ? "border-pine/24 bg-pine/10"
                                : "border-white/10 bg-white/[0.03] hover:border-white/16 hover:bg-white/[0.05]"
                            }`}
                            key={option.value}
                            onClick={() => updateFormState("scopeKind", option.value)}
                            type="button"
                          >
                            <p className="font-semibold text-ink">{option.label}</p>
                            <p className="mt-2 text-sm leading-7 text-storm">{option.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Regla</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Monto y periodo</h3>
                  <div className="mt-3 grid gap-3 sm:mt-6 sm:gap-5 sm:grid-cols-2">
                    <Field hint="Moneda en la que controlas este tope." label="Moneda">
                      <SearchablePicker
                        emptyMessage="No hay monedas configuradas."
                        onChange={(value) => updateFormState("currencyCode", value)}
                        options={currencyOptions}
                        placeholderDescription="Elige en que moneda quieres controlar este tope."
                        placeholderLabel="Selecciona una moneda"
                        queryPlaceholder="Buscar PEN, USD, EUR..."
                        value={formState.currencyCode}
                      />
                    </Field>
                    <Field errorKey="limitAmount" hint="Tope máximo del periodo." invalidFields={invalidFields} label="Límite máximo">
                      <Input
                        inputMode="decimal"
                        onChange={(event) => {
                          clearFieldError("limitAmount");
                          updateFormState("limitAmount", event.target.value);
                        }}
                        placeholder="0.00"
                        value={formState.limitAmount}
                      />
                    </Field>
                    <Field hint="Porcentaje desde el que avisamos (0 a 100)." label="Alertar desde">
                      <Input
                        inputMode="decimal"
                        onChange={(event) => updateFormState("alertPercent", event.target.value)}
                        placeholder="80"
                        value={formState.alertPercent}
                      />
                    </Field>
                    <Field errorKey="periodStart" hint="Fecha de inicio del periodo." invalidFields={invalidFields} label="Inicio">
                      <DatePickerField
                        onChange={(value) => {
                          clearFieldError("periodStart");
                          updateFormState("periodStart", value);
                        }}
                        value={formState.periodStart}
                      />
                    </Field>
                    <Field errorKey="periodEnd" hint="Fecha de cierre del periodo." invalidFields={invalidFields} label="Fin">
                      <DatePickerField
                        onChange={(value) => {
                          clearFieldError("periodEnd");
                          updateFormState("periodEnd", value);
                        }}
                        value={formState.periodEnd}
                      />
                    </Field>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Destino</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Categoría y cuenta</h3>
                  <div className="mt-3 grid gap-3 sm:mt-6 sm:gap-5">
                    <Field errorKey="categoryId" hint="Categoría a la que se amarra el tope." invalidFields={invalidFields} label="Categoría">
                      <SearchablePicker
                        disabled={formState.scopeKind === "general" || formState.scopeKind === "account"}
                        emptyMessage="No encontramos categorías con ese nombre."
                        onChange={(value) => {
                          clearFieldError("categoryId");
                          updateFormState("categoryId", value ? Number(value) : null);
                        }}
                        options={categoryOptions}
                        placeholderDescription="Elige una categoría para seguir este tope de forma más precisa."
                        placeholderLabel="Selecciona una categoría"
                        queryPlaceholder="Buscar categoría..."
                        value={formState.categoryId ? String(formState.categoryId) : ""}
                      />
                    </Field>
                    <Field errorKey="accountId" hint="Cuenta a la que se amarra el tope." invalidFields={invalidFields} label="Cuenta">
                      <SearchablePicker
                        disabled={formState.scopeKind === "general" || formState.scopeKind === "category"}
                        emptyMessage="No encontramos cuentas con ese nombre."
                        onChange={(value) => {
                          clearFieldError("accountId");
                          updateFormState("accountId", value ? Number(value) : null);
                        }}
                        options={accountOptions}
                        placeholderDescription="Elige una cuenta si quieres controlar solo lo que sale de ahi."
                        placeholderLabel="Selecciona una cuenta"
                        queryPlaceholder="Buscar cuenta..."
                        value={formState.accountId ? String(formState.accountId) : ""}
                      />
                    </Field>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Seleccionado</p>
                      <p className="mt-2 text-sm font-semibold text-ink">{selectedCategory?.name ?? "Sin categoría fija"}</p>
                      <p className="mt-1 text-sm text-storm">{selectedAccount?.name ?? "Sin cuenta fija"}</p>
                    </div>
                  </div>
                </div>

                {!showAdvanced ? (
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-[24px] border border-dashed border-white/15 bg-white/[0.02] px-4 py-3.5 text-sm font-medium text-storm transition hover:border-white/25 hover:text-ink lg:col-span-2"
                    onClick={() => setShowAdvanced(true)}
                    type="button"
                  >
                    Más opciones (estado, rollover, notas)
                  </button>
                ) : null}

                <div className={`${panelClassName} lg:col-span-2 ${showAdvanced ? "" : "hidden"}`}>
                  <p className={labelClassName}>Ajustes</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Estado y notas</h3>
                  <div className="mt-3 grid gap-3 sm:mt-6 sm:gap-5">
                    <ToggleRow
                      checked={formState.isActive}
                      description="Si lo desactivas, deja de contar en el resumen principal."
                      label="Activo en dashboard"
                      onChange={(checked) => updateFormState("isActive", checked)}
                    />
                    <ToggleRow
                      checked={formState.rolloverEnabled}
                      description="Dejalo listo para una futura fase donde el saldo pase al siguiente periodo."
                      label="Rollover"
                      onChange={(checked) => updateFormState("rolloverEnabled", checked)}
                    />
                    <Field hint="Solo para contexto interno." label="Notas">
                      <Textarea
                        className="min-h-[120px]"
                        onChange={(event) => updateFormState("notes", event.target.value)}
                        placeholder="Ej. Mantener Salud bajo control durante este mes."
                        value={formState.notes}
                      />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-[60] border-t border-white/10 bg-shell/95 px-4 py-4 backdrop-blur-md sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  El dashboard te mostrará cuánto gastaste, cuanto te queda y que presupuestos estan por entrar en riesgo.
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button disabled={isSaving} onClick={closeEditor} type="button" variant="ghost">
                    Cancelar
                  </Button>
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : isCreateMode ? (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear presupuesto
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

function BudgetsLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[180px] rounded-[32px]" />
      <div className="shimmer-surface h-[520px] rounded-[32px]" />
    </>
  );
}

function BudgetSummaryChip({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "info" | "warning";
  value: string;
}) {
  const valueTone = {
    neutral: "text-ink",
    info: "text-ember",
    warning: "text-gold",
  } as const;

  return (
    <article className="glass-panel-soft min-w-0 rounded-[24px] p-4 transition duration-300 hover:border-white/15">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-storm/80">{label}</p>
      <p className={`mt-2 truncate font-display text-2xl font-semibold leading-tight ${valueTone[tone]}`}>{value}</p>
    </article>
  );
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
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
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBudgetsCSV(budgets: BudgetOverview[], filename: string) {
  const headers = ["Nombre", "Alcance", "Categoria", "Cuenta", "Moneda", "Periodo inicio", "Periodo fin", "Limite", "Gastado", "Restante", "% usado", "Activo", "Notas"];
  const rows = budgets.map((b) => [
    escapeCSV(b.name),
    escapeCSV(b.scopeLabel),
    escapeCSV(b.categoryName ?? ""),
    escapeCSV(b.accountName ?? ""),
    escapeCSV(b.currencyCode),
    escapeCSV(b.periodStart),
    escapeCSV(b.periodEnd),
    escapeCSV(b.limitAmount),
    escapeCSV(b.spentAmount),
    escapeCSV(b.remainingAmount),
    escapeCSV(b.usedPercent.toFixed(1)),
    escapeCSV(b.isActive ? "Si" : "No"),
    escapeCSV(b.notes ?? ""),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

export function BudgetsPage() {
  const { user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id);
  const createMutation = useCreateBudgetMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateBudgetMutation(activeWorkspace?.id, user?.id);
  const toggleMutation = useToggleBudgetMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteBudgetMutation(activeWorkspace?.id, user?.id);

  const [pageFeedback, setPageFeedback] = useState<FeedbackState | null>(null);
  const [editorFeedback, setEditorFeedback] = useState<FeedbackState | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  function clearFieldError(field: string) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }
  useSuccessToast(pageFeedback, {
    clear: () => setPageFeedback(null),
  });
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedBudgetId, setSelectedBudgetId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [analyticsBudgetId, setAnalyticsBudgetId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  const budgetColumns: ColumnDef[] = [
    { key: "alcance", label: "Alcance" },
    { key: "periodo", label: "Período" },
    { key: "limite", label: "Límite" },
    { key: "consumido", label: "Consumido" },
    { key: "restante", label: "Restante" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-budgets", budgetColumns);
  const [viewMode, setViewMode] = useViewMode("budgets", "table");
  const {
    filters: budgetFilters,
    currentPage,
    setCurrentPage,
    openTableFilter,
    updateFilter: updateBudgetFilter,
    clearFilters: clearBudgetFilters,
    toggleTableFilterMenu,
    closeTableFilterMenu,
    clearSingleTableFilter,
    applyFilterAndClose: applyBudgetFilterAndClose,
  } = useBudgetsFilters(viewMode);
  const [formState, setFormState] = useState<BudgetFormState>(() => createDefaultFormState(activeWorkspace));

  const snapshot = snapshotQuery.data;
  const budgets = snapshot?.budgets ?? [];
  const categories = snapshot?.catalogs.categories ?? [];
  const accounts = useMemo(
    () =>
      (snapshot?.accounts ?? [])
        .filter((account) => !account.isArchived)
        .map((account) => ({ id: account.id, name: account.name, currencyCode: account.currencyCode })),
    [snapshot?.accounts],
  );
  const exchangeRateMap = useMemo(() => buildExchangeRateMap(snapshot?.exchangeRates ?? []), [snapshot?.exchangeRates]);
  const baseCurrencyCode = activeWorkspace?.baseCurrencyCode ?? "PEN";
  const displayCurrencyCode = normalizeCurrencyCode(baseCurrencyCode);
  const isSavingEditor = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isToggling = toggleMutation.isPending;

  const displayBudgets = useMemo<DisplayBudgetOverview[]>(
    () =>
      budgets.map((budget) => ({
        ...budget,
        displayCurrencyCode,
        displayLimitAmount: convertBudgetAmount(budget.limitAmount, budget.currencyCode, displayCurrencyCode, baseCurrencyCode, exchangeRateMap),
        displaySpentAmount: convertBudgetAmount(budget.spentAmount, budget.currencyCode, displayCurrencyCode, baseCurrencyCode, exchangeRateMap),
        displayRemainingAmount: convertBudgetAmount(budget.remainingAmount, budget.currencyCode, displayCurrencyCode, baseCurrencyCode, exchangeRateMap),
        isConvertedDisplay: normalizeCurrencyCode(budget.currencyCode) !== normalizeCurrencyCode(displayCurrencyCode),
      })),
    [baseCurrencyCode, budgets, displayCurrencyCode, exchangeRateMap],
  );

  const selectedBudget = displayBudgets.find((budget) => budget.id === selectedBudgetId) ?? null;
  const deleteTarget = displayBudgets.find((budget) => budget.id === deleteTargetId) ?? null;

  const hasActiveFilters =
    budgetFilters.name.trim() !== "" ||
    budgetFilters.scope !== "all" ||
    budgetFilters.status !== "all" ||
    budgetFilters.currentOnly !== true ||
    budgetFilters.period.trim() !== "" ||
    budgetFilters.limit.trim() !== "" ||
    budgetFilters.spent.trim() !== "" ||
    budgetFilters.remaining.trim() !== "";

  const filteredBudgets = useMemo(() => {
    const normalizedSearch = budgetFilters.name.trim().toLowerCase();
    const normalizedPeriod = budgetFilters.period.trim().toLowerCase();
    const normalizedLimit = budgetFilters.limit.trim();
    const normalizedSpent = budgetFilters.spent.trim();
    const normalizedRemaining = budgetFilters.remaining.trim();

    return [...displayBudgets]
      .filter((budget) => {
        if (hiddenIds.has(budget.id)) {
          return false;
        }

        if (budgetFilters.scope !== "all" && budget.scopeKind !== budgetFilters.scope) {
          return false;
        }

        if (budgetFilters.status === "active" && !budget.isActive) {
          return false;
        }

        if (budgetFilters.status === "critical" && !(budget.isNearLimit || budget.isOverLimit)) {
          return false;
        }

        if (budgetFilters.status === "inactive" && budget.isActive) {
          return false;
        }

        if (budgetFilters.currentOnly && !isBudgetCurrent(budget)) {
          return false;
        }

        if (
          normalizedSearch &&
          !(
            budget.name.toLowerCase().includes(normalizedSearch) ||
            budget.scopeLabel.toLowerCase().includes(normalizedSearch) ||
            (budget.categoryName ?? "").toLowerCase().includes(normalizedSearch) ||
            (budget.accountName ?? "").toLowerCase().includes(normalizedSearch) ||
            (budget.notes ?? "").toLowerCase().includes(normalizedSearch)
          )
        ) {
          return false;
        }

        if (normalizedPeriod) {
          const formattedPeriod = `${formatDate(budget.periodStart)} ${formatDate(budget.periodEnd)}`.toLowerCase();
          const rawPeriod = `${budget.periodStart} ${budget.periodEnd}`.toLowerCase();

          if (!formattedPeriod.includes(normalizedPeriod) && !rawPeriod.includes(normalizedPeriod)) {
            return false;
          }
        }

        if (normalizedLimit && !String(budget.displayLimitAmount).includes(normalizedLimit)) {
          return false;
        }

        if (normalizedSpent && !String(budget.displaySpentAmount).includes(normalizedSpent)) {
          return false;
        }

        if (normalizedRemaining && !String(budget.displayRemainingAmount).includes(normalizedRemaining)) {
          return false;
        }

        return true;
      })
      .sort((left, right) => {
        const leftScore =
          (left.isActive ? 2 : 0) + (isBudgetCurrent(left) ? 2 : 0) + (left.isOverLimit ? 3 : left.isNearLimit ? 2 : 0);
        const rightScore =
          (right.isActive ? 2 : 0) + (isBudgetCurrent(right) ? 2 : 0) + (right.isOverLimit ? 3 : right.isNearLimit ? 2 : 0);

        return (
          rightScore - leftScore ||
          right.usedPercent - left.usedPercent ||
          new Date(left.periodEnd).getTime() - new Date(right.periodEnd).getTime()
        );
      });
  }, [budgetFilters, displayBudgets, hiddenIds]);

  const totalPages = Math.max(1, Math.ceil(filteredBudgets.length / BUDGETS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedBudgets = useMemo(
    () => filteredBudgets.slice((safePage - 1) * BUDGETS_PAGE_SIZE, safePage * BUDGETS_PAGE_SIZE),
    [filteredBudgets, safePage],
  );

  const {
    selectedIds,
    toggle: toggleSelect,
    selectAll,
    clearAll,
    selectedCount,
    allSelected,
    someSelected,
    selectedItems,
  } = useSelection(filteredBudgets);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  async function handleBulkDelete() {
    if (selectedCount === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  async function confirmBulkDelete() {
    setIsBulkDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await deleteMutation.mutateAsync({ budgetId: id as number, workspaceId: activeWorkspace!.id });
      }
      clearAll();
    } catch (err) {
      setPageFeedback({ tone: "error", title: "Error al eliminar", description: getQueryErrorMessage(err) });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  const currentActiveBudgets = useMemo(
    () => displayBudgets.filter((budget) => budget.isActive && isBudgetCurrent(budget)),
    [displayBudgets],
  );
  const totalLimitBase = currentActiveBudgets.reduce((total, budget) => total + budget.displayLimitAmount, 0);
  const totalSpentBase = currentActiveBudgets.reduce((total, budget) => total + budget.displaySpentAmount, 0);
  const totalRemainingBase = currentActiveBudgets.reduce((total, budget) => total + budget.displayRemainingAmount, 0);
  const criticalBudgets = currentActiveBudgets.filter((budget) => budget.isNearLimit || budget.isOverLimit);
  const totalTrackedMovements = currentActiveBudgets.reduce((total, budget) => total + budget.movementCount, 0);

  function updateFormState<Field extends keyof BudgetFormState>(field: Field, value: BudgetFormState[Field]) {
    setIsDirty(true);
    setFormState((currentValue) => {
      const nextValue = { ...currentValue, [field]: value };

      if (field === "scopeKind") {
        if (value === "general") {
          nextValue.categoryId = null;
          nextValue.accountId = null;
        }

        if (value === "category") {
          nextValue.accountId = null;
        }

        if (value === "account") {
          nextValue.categoryId = null;
        }
      }

      return nextValue;
    });
  }

  function closeEditor() {
    setIsEditorOpen(false);
    setSelectedBudgetId(null);
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }

  function openCreateEditor() {
    setPageFeedback(null);
    setEditorFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("create");
    setSelectedBudgetId(null);
    setFormState(createDefaultFormState(activeWorkspace));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(budget: BudgetOverview) {
    setPageFeedback(null);
    setEditorFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("edit");
    setSelectedBudgetId(budget.id);
    setFormState(buildFormStateFromBudget(budget));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  async function handleSubmitEditor(event: FormEvent<HTMLFormElement>) {
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

    const name = formState.name.trim();
    const currencyCode = normalizeCurrencyCode(formState.currencyCode || baseCurrencyCode);
    const limitAmount = toNumericValue(formState.limitAmount);
    const alertPercent = toNumericValue(formState.alertPercent);

    const budgetErrors: string[] = [];
    if (!name) budgetErrors.push("name");
    if (!formState.periodStart) budgetErrors.push("periodStart");
    if (!formState.periodEnd) budgetErrors.push("periodEnd");
    if (limitAmount === null || limitAmount <= 0) budgetErrors.push("limitAmount");
    if ((formState.scopeKind === "category" || formState.scopeKind === "category_account") && !formState.categoryId)
      budgetErrors.push("categoryId");
    if ((formState.scopeKind === "account" || formState.scopeKind === "category_account") && !formState.accountId)
      budgetErrors.push("accountId");
    if (budgetErrors.length > 0) {
      setInvalidFields(new Set(budgetErrors));
      setEditorFeedback({
        tone: "error",
        title: "Revisa los campos requeridos",
        description: "Completa los campos marcados en rojo antes de guardar.",
      });
      return;
    }

    if (formState.periodStart && formState.periodEnd && formState.periodEnd < formState.periodStart) {
      setEditorFeedback({
        tone: "error",
        title: "Revisa el rango",
        description: "La fecha final no puede quedar antes del inicio.",
      });
      return;
    }

    if (alertPercent === null || alertPercent < 0 || alertPercent > 100) {
      setEditorFeedback({
        tone: "error",
        title: "Alerta fuera de rango",
        description: "El porcentaje de alerta debe ir entre 0 y 100.",
      });
      return;
    }

    const payload: BudgetFormInput = {
      name,
      periodStart: formState.periodStart,
      periodEnd: formState.periodEnd,
      currencyCode,
      categoryId: formState.scopeKind === "general" || formState.scopeKind === "account" ? null : formState.categoryId,
      accountId: formState.scopeKind === "general" || formState.scopeKind === "category" ? null : formState.accountId,
      limitAmount: limitAmount!,
      rolloverEnabled: formState.rolloverEnabled,
      alertPercent,
      notes: formState.notes,
      isActive: formState.isActive,
    };

    try {
      if (editorMode === "create") {
        await createMutation.mutateAsync({ workspaceId: activeWorkspace.id, userId: user.id, ...payload });
        setPageFeedback({
          tone: "success",
          title: "Presupuesto creado",
          description: "Ya aparece en tu control financiero y empezara a medirse en el dashboard.",
        });
      } else if (selectedBudget) {
        await updateMutation.mutateAsync({
          budgetId: selectedBudget.id,
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        });
        setPageFeedback({
          tone: "success",
          title: "Presupuesto actualizado",
          description: "Los cambios ya se reflejan en el seguimiento del periodo.",
        });
      }

      closeEditor();
    } catch (error) {
      setEditorFeedback({
        tone: "error",
        title: "No pudimos guardar el presupuesto",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  async function handleToggleBudget(budget: BudgetOverview) {
    if (!activeWorkspace || !user?.id) {
      return;
    }

    try {
      await toggleMutation.mutateAsync({
        budgetId: budget.id,
        workspaceId: activeWorkspace.id,
        userId: user.id,
        isActive: !budget.isActive,
      });
      setPageFeedback({
        tone: "success",
        title: budget.isActive ? "Presupuesto desactivado" : "Presupuesto reactivado",
        description: budget.isActive
          ? "Se conserva el historial, pero deja de contar en el resumen principal."
          : "Volvio a entrar en el control activo del dashboard.",
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        title: "No pudimos cambiar el estado",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
  }

  function handleDeleteBudget() {
    if (!activeWorkspace || !deleteTarget) return;
    const targetId = deleteTarget.id;
    setDeleteTargetId(null);
    setHiddenIds((prev) => new Set([...prev, targetId]));
    schedule({
      label: "Presupuesto eliminado",
      onCommit: () => deleteMutation.mutateAsync({ budgetId: targetId, workspaceId: activeWorkspace.id }),
      onUndo: () => {
        setHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(targetId);
          return next;
        });
      },
    });
  }

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos preparando tu espacio para empezar a controlar límites y alertas."
          eyebrow="planificación"
          title="Presupuestos"
        />
        <DataState description="Cargando tu workspace..." title="Un momento" />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Necesitamos el workspace activo para mostrarte reglas, límites y consumo real."
          eyebrow="planificación"
          title="Presupuestos no disponibles"
        />
        <DataState
          description={getQueryErrorMessage(workspaceError, "No pudimos cargar tus workspaces.")}
          title="No fue posible abrir este módulo"
          tone="error"
        />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Cuando tengas un workspace activo, aquí podrás fijar topes por categoría, cuenta o ambos."
          eyebrow="planificación"
          title="Aún no hay un workspace activo"
        />
        <DataState
          description="Primero activa un workspace para empezar a construir tus reglas de gasto."
          title="Todavía no hay contexto financiero"
        />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Estamos reuniendo categorias, cuentas y movimientos para armar tus presupuestos."
          eyebrow="planificación"
          title={`${activeWorkspace.name}, bajo control`}
        />
        <BudgetsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader
          description="Intentamos leer cuentas, categorías y movimientos para medir tus límites."
          eyebrow="planificación"
          title={`${activeWorkspace.name}, con problemas de lectura`}
        />
        <DataState
          description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer los presupuestos del workspace.")}
          title="No fue posible cargar este panel"
          tone="error"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header compacto (estándar) */}
      <section className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/80">Presupuestos</p>
        <div className="mt-1 flex items-center gap-2.5">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Presupuestos por periodo</h2>
          <InfoTip ariaLabel="Sobre los presupuestos">
            Pon topes mensuales o por rango a tu gasto total, a una categoría, a una cuenta o al cruce de ambas. Los
            filtros de la barra superior aplican a todas las vistas.
          </InfoTip>
        </div>
        <p className="mt-1 text-xs text-storm">
          Topes del workspace, consolidados en {displayCurrencyCode} con el último tipo de cambio disponible.
        </p>
      </section>

      {/* Métricas compactas */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
        <BudgetSummaryChip label="vigentes" value={String(currentActiveBudgets.length)} />
        <BudgetSummaryChip label="techo" tone="info" value={formatCurrency(totalLimitBase, displayCurrencyCode)} />
        <BudgetSummaryChip label="consumido" tone="info" value={formatCurrency(totalSpentBase, displayCurrencyCode)} />
        <BudgetSummaryChip
          label="restante"
          tone={totalRemainingBase < 0 ? "warning" : "info"}
          value={formatCurrency(totalRemainingBase, displayCurrencyCode)}
        />
        <BudgetSummaryChip label="en alerta" tone="warning" value={String(criticalBudgets.length)} />
        <BudgetSummaryChip label="movimientos" tone="info" value={String(totalTrackedMovements)} />
      </div>

      {/* Toolbar sticky (estándar) */}
      <section className="sticky top-3 z-30 rounded-[24px] border border-white/10 bg-canvas/85 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
          {viewMode === "table" ? <ColumnPicker columns={budgetColumns} visible={colVis} onToggle={toggleCol} /> : null}
          <StatusBadge status={`${filteredBudgets.length} visibles`} tone="neutral" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
              disabled={snapshotQuery.isFetching}
              onClick={() => snapshotQuery.refetch()}
              title="Actualizar"
              type="button"
            >
              <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
            </button>
            {hasActiveFilters ? (
              <Button onClick={clearBudgetFilters} variant="ghost">
                <X className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            ) : null}
            <Button
              disabled={!filteredBudgets.length}
              onClick={() => downloadBudgetsCSV(filteredBudgets, `presupuestos-${new Date().toISOString().slice(0, 10)}.csv`)}
              variant="ghost"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button data-tour="create-budget" onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo presupuesto
            </Button>
          </div>
        </div>

        {/* Filtros principales: siempre visibles (aplican a todas las vistas) */}
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input
            className="field-dark"
            onChange={(event) => updateBudgetFilter("name", event.target.value)}
            placeholder="Buscar por nombre, categoria, cuenta o notas..."
            type="text"
            value={budgetFilters.name}
          />
          <SearchablePicker
            emptyMessage="No hay alcances para mostrar."
            onChange={(value) => updateBudgetFilter("scope", value as ScopeFilter)}
            options={scopeFilterPickerOptions}
            placeholderDescription="Filtra por alcance."
            placeholderLabel="Alcance"
            queryPlaceholder="Buscar alcance..."
            value={budgetFilters.scope}
          />
          <SearchablePicker
            emptyMessage="No hay estados para mostrar."
            onChange={(value) => updateBudgetFilter("status", value as StatusFilter)}
            options={statusFilterPickerOptions}
            placeholderDescription="Filtra por estado."
            placeholderLabel="Estado"
            queryPlaceholder="Buscar estado..."
            value={budgetFilters.status}
          />
          <button
            className={`flex min-h-[52px] items-center justify-center rounded-2xl border px-4 text-sm font-medium transition ${
              budgetFilters.currentOnly
                ? "border-pine/30 bg-pine/10 text-pine"
                : "border-white/10 bg-white/[0.03] text-storm hover:border-white/16 hover:text-ink"
            }`}
            onClick={() => updateBudgetFilter("currentOnly", !budgetFilters.currentOnly)}
            type="button"
          >
            {budgetFilters.currentOnly ? "Solo vigentes" : "Históricos"}
          </button>
        </div>
      </section>

      {pageFeedback && pageFeedback.tone !== "error" && !isEditorOpen ? (
        <DataState description={pageFeedback.description} title={pageFeedback.title} tone={pageFeedback.tone} />
      ) : null}

      {budgets.length === 0 ? (
        <DataState
          action={
            <Button onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primer presupuesto
            </Button>
          }
          description="Crea topes generales, por categoria, por cuenta o cruzando categoria y cuenta."
          title="Aun no has creado presupuestos"
        />
      ) : filteredBudgets.length === 0 ? (
        <DataState
          action={
            <Button onClick={clearBudgetFilters} variant="ghost">
              Limpiar filtros
            </Button>
          }
          description="Prueba cambiando los filtros activos o vuelve a la vista tabla para revisar cada columna."
          title="No encontramos coincidencias"
        />
      ) : viewMode === "list" ? (
        <BudgetList
          budgets={paginatedBudgets}
          onAnalytics={setAnalyticsBudgetId}
          onEdit={openEditEditor}
          onToggleSelect={toggleSelect}
          selectedIds={selectedIds}
        />
      ) : viewMode === "table" ? (
        <BudgetTable
          allSelected={allSelected}
          budgets={paginatedBudgets}
          cv={cv}
          filters={budgetFilters}
          isToggling={isToggling}
          onAnalytics={setAnalyticsBudgetId}
          onApplyFilterAndClose={applyBudgetFilterAndClose}
          onClearAll={clearAll}
          onClearSingleFilter={clearSingleTableFilter}
          onCloseFilterMenu={closeTableFilterMenu}
          onEdit={openEditEditor}
          onSelectAll={selectAll}
          onToggleBudget={(budget) => void handleToggleBudget(budget)}
          onToggleFilterMenu={toggleTableFilterMenu}
          onToggleSelect={toggleSelect}
          onUpdateFilter={updateBudgetFilter}
          openFilter={openTableFilter}
          selectedIds={selectedIds}
          someSelected={someSelected}
        />
      ) : (
        <BudgetGrid
          budgets={paginatedBudgets}
          isToggling={isToggling}
          onAnalytics={setAnalyticsBudgetId}
          onDelete={setDeleteTargetId}
          onEdit={openEditEditor}
          onToggleBudget={(budget) => void handleToggleBudget(budget)}
          onToggleSelect={toggleSelect}
          selectedCount={selectedCount}
          selectedIds={selectedIds}
        />
      )}

      {filteredBudgets.length > 0 ? (
        <Pagination
          onPageChange={setCurrentPage}
          page={safePage}
          pageSize={BUDGETS_PAGE_SIZE}
          totalItems={filteredBudgets.length}
        />
      ) : null}

      {analyticsBudgetId !== null
        ? (() => {
            const analyticsBudget = displayBudgets.find((b) => b.id === analyticsBudgetId);
            return analyticsBudget ? (
              <BudgetAnalyticsModal
                budget={analyticsBudget}
                displayCurrencyCode={displayCurrencyCode}
                movements={snapshot?.movements ?? []}
                onClose={() => setAnalyticsBudgetId(null)}
              />
            ) : null;
          })()
        : null}

      <BulkActionBar
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadBudgetsCSV(selectedItems, `presupuestos-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredBudgets.length}
      />
      {showBulkDeleteConfirm ? (
        <div
          className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-bulk-title"
        >
          <div className="glass-panel-strong w-full max-w-md rounded-[28px] p-6">
            <h2 className="font-display text-xl font-semibold text-ink" id="budget-bulk-title">
              Eliminar {selectedCount} presupuesto{selectedCount !== 1 ? "s" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Esta accion eliminara permanentemente los presupuestos seleccionados. No se puede deshacer.
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

      {isEditorOpen ? (
        <BudgetEditorDialog
          accounts={accounts}
          categories={categories}
          clearFieldError={clearFieldError}
          closeEditor={requestCloseEditor}
          feedback={editorFeedback}
          formState={formState}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSavingEditor}
          onSubmit={handleSubmitEditor}
          updateFormState={updateFormState}
          workspace={activeWorkspace}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => {
            setShowUnsavedDialog(false);
            closeEditor();
          }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          badge="Eliminar presupuesto"
          description="Se perdera el tope configurado, pero no tus movimientos reales. Si prefieres conservar el historial visual, puedes dejarlo inactivo."
          isDeleting={isDeleting}
          onCancel={() => setDeleteTargetId(null)}
          onConfirm={() => void handleDeleteBudget()}
        >
          <div>
            <p className="font-display text-2xl font-semibold text-ink">{deleteTarget.name}</p>
            <p className="mt-2 text-sm text-storm">{deleteTarget.scopeLabel}</p>
            <p className="mt-4 text-sm text-storm">
              {formatCurrency(deleteTarget.displaySpentAmount, deleteTarget.displayCurrencyCode)} usados de{" "}
              {formatCurrency(deleteTarget.displayLimitAmount, deleteTarget.displayCurrencyCode)}
            </p>
            {deleteTarget.isConvertedDisplay ? (
              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-storm/75">
                Vista actual en {deleteTarget.displayCurrencyCode}. Regla creada en {deleteTarget.currencyCode}.
              </p>
            ) : null}
          </div>
        </DeleteConfirmDialog>
      ) : null}
    </div>
  );
}
