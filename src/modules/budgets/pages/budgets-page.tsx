import {
  Check,
  ChevronDown,
  LoaderCircle,
  PencilLine,
  PiggyBank,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import type { FormEvent, InputHTMLAttributes, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
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

type EditorMode = "create" | "edit";
type ScopeFilter = "all" | BudgetOverview["scopeKind"];
type StatusFilter = "all" | "active" | "critical" | "inactive";
type BudgetScopeKind = BudgetOverview["scopeKind"];

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

type BudgetPickerOption = {
  value: string;
  label: string;
  description: string;
  leadingLabel: string;
  leadingColor?: string;
  searchText?: string;
};

type DisplayBudgetOverview = BudgetOverview & {
  displayCurrencyCode: string;
  displayLimitAmount: number;
  displaySpentAmount: number;
  displayRemainingAmount: number;
  isConvertedDisplay: boolean;
};

const fieldClassName =
  "w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)] disabled:cursor-not-allowed disabled:opacity-60";
const inputClassName = `${fieldClassName} h-14`;
const textareaClassName = `${fieldClassName} min-h-[120px] py-4`;

const scopeOptions: Array<{
  value: BudgetScopeKind;
  label: string;
  description: string;
}> = [
  {
    value: "general",
    label: "General",
    description: "Controla el gasto total del periodo sin amarrarlo a una categoría o cuenta concreta.",
  },
  {
    value: "category",
    label: "Por categoría",
    description: "Ideal para poner un tope a Salud, Comida, Transporte u otra familia de gasto.",
  },
  {
    value: "account",
    label: "Por cuenta",
    description: "Sirve para limitar cuánto sale de una cuenta específica durante el período.",
  },
  {
    value: "category_account",
    label: "Categoría en cuenta",
    description: "Cruza categoría y cuenta para presupuestos más estrictos y granulares.",
  },
];

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Todo" },
  { value: "active", label: "Activos" },
  { value: "critical", label: "Críticos" },
  { value: "inactive", label: "Inactivos" },
];

const scopeFilterOptions: Array<{ value: ScopeFilter; label: string }> = [
  { value: "all", label: "Todo alcance" },
  { value: "general", label: "General" },
  { value: "category", label: "Categoría" },
  { value: "account", label: "Cuenta" },
  { value: "category_account", label: "Categoría + cuenta" },
];

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

function useBudgetPickerPanel(isOpen: boolean, onClose: () => void) {
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

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  return containerRef;
}

function BudgetPicker({
  disabled = false,
  emptyMessage,
  onChange,
  options,
  placeholderDescription,
  placeholderLabel,
  queryPlaceholder,
  value,
}: {
  disabled?: boolean;
  emptyMessage?: string;
  onChange: (value: string) => void;
  options: BudgetPickerOption[];
  placeholderDescription: string;
  placeholderLabel: string;
  queryPlaceholder?: string;
  value: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useBudgetPickerPanel(isOpen, () => setIsOpen(false));
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
    <div className={`relative ${isOpen ? "z-50" : "z-10"}`} ref={containerRef}>
      <button
        className={`${fieldClassName} flex min-h-[5.25rem] items-start justify-between gap-3 py-3.5 text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex h-10 min-w-[3.3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
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
          {queryPlaceholder ? (
            <div className="relative mb-3">
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
          ) : null}

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredOptions.length ? filteredOptions.map((option) => {
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
                      className="mt-0.5 flex h-11 min-w-[3.3rem] shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] px-3 text-sm font-semibold text-ink"
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
            }) : (
              <div className="rounded-[22px] border border-white/8 bg-[#0d1623] px-4 py-5 text-sm text-storm">
                {emptyMessage ?? "No encontramos resultados con ese filtro."}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getBudgetCurrencyOption(currencyCode: string, workspaceBaseCurrencyCode?: string | null): BudgetPickerOption {
  const normalizedCurrencyCode = normalizeCurrencyCode(currencyCode);

  switch (normalizedCurrencyCode) {
    case "PEN":
      return {
        value: "PEN",
        label: "PEN",
        description:
          workspaceBaseCurrencyCode === "PEN"
            ? "Sol peruano. Moneda base recomendada para este workspace."
            : "Sol peruano para topes y seguimiento local.",
        leadingLabel: "S/",
        leadingColor: "#1b6a58",
      };
    case "USD":
      return {
        value: "USD",
        label: "USD",
        description: "Dolar estadounidense para cuentas o gastos en dolares.",
        leadingLabel: "US$",
        leadingColor: "#4566d6",
      };
    case "EUR":
      return {
        value: "EUR",
        label: "EUR",
        description: "Euro para presupuestos y gastos en moneda europea.",
        leadingLabel: "EUR",
        leadingColor: "#b48b34",
      };
    default:
      return {
        value: normalizedCurrencyCode,
        label: normalizedCurrencyCode,
        description: "Moneda disponible en este workspace.",
        leadingLabel: normalizedCurrencyCode,
        leadingColor: "#6b7280",
      };
  }
}

function getBudgetCategoryColor(kind: CategorySummary["kind"]) {
  switch (kind) {
    case "expense":
      return "#8f3e3e";
    case "income":
      return "#1b6a58";
    default:
      return "#4566d6";
  }
}

function normalizeCurrencyCode(currencyCode: string) {
  return currencyCode.trim().toUpperCase();
}

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
  const directRate = resolveExchangeRate(
    exchangeRateMap,
    normalizedFromCurrencyCode,
    normalizedToCurrencyCode,
  );

  if (directRate !== null) {
    return amount * directRate;
  }

  const sourceToBaseRate = resolveExchangeRate(
    exchangeRateMap,
    normalizedFromCurrencyCode,
    normalizedBaseCurrencyCode,
  );

  if (sourceToBaseRate !== null) {
    const amountInBaseCurrency = amount * sourceToBaseRate;

    if (normalizedToCurrencyCode === normalizedBaseCurrencyCode) {
      return amountInBaseCurrency;
    }

    const baseToTargetRate = resolveExchangeRate(
      exchangeRateMap,
      normalizedBaseCurrencyCode,
      normalizedToCurrencyCode,
    );

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

function getBudgetTone(budget: BudgetOverview) {
  if (budget.isOverLimit) {
    return "danger" as const;
  }

  if (budget.isNearLimit) {
    return "warning" as const;
  }

  return "success" as const;
}

function getBudgetStatusLabel(budget: BudgetOverview) {
  if (!budget.isActive) {
    return "Inactivo";
  }

  if (budget.isOverLimit) {
    return "Excedido";
  }

  if (budget.isNearLimit) {
    return "En alerta";
  }

  return "Saludable";
}

function isBudgetCurrent(budget: BudgetOverview) {
  const todayKey = toDateValue(new Date());
  return budget.periodStart <= todayKey && budget.periodEnd >= todayKey;
}

function getBudgetScopeDetails(scopeKind: BudgetScopeKind) {
  return scopeOptions.find((option) => option.value === scopeKind) ?? scopeOptions[0];
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
  updateFormState: <Field extends keyof BudgetFormState>(
    field: Field,
    value: BudgetFormState[Field],
  ) => void;
  workspace: Workspace | null;
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

  const scopeDetails = getBudgetScopeDetails(formState.scopeKind);
  const selectedCategory = categories.find((category) => category.id === formState.categoryId) ?? null;
  const selectedAccount = accounts.find((account) => account.id === formState.accountId) ?? null;
  const parsedLimitAmount = toNumericValue(formState.limitAmount) ?? 0;
  const currencyOptions = useMemo(
    () =>
      Array.from(new Set([workspace?.baseCurrencyCode ?? "PEN", "PEN", "USD", "EUR"])).map((currencyCode) =>
        getBudgetCurrencyOption(currencyCode, workspace?.baseCurrencyCode),
      ),
    [workspace?.baseCurrencyCode],
  );
  const categoryOptions = useMemo<BudgetPickerOption[]>(
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
  const accountOptions = useMemo<BudgetPickerOption[]>(
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
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgba(4,8,16,0.72)] backdrop-blur-[18px]" />
      <div className="absolute inset-0 overflow-y-auto" onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }} onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) closeEditor(); }}>
        <div className="flex min-h-full items-start justify-center px-4 py-10 sm:px-6">
          <div className="relative w-full max-w-6xl rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,20,0.98),rgba(9,14,24,0.96))] px-6 pt-6 shadow-[0_35px_120px_rgba(0,0,0,0.55)] sm:px-8 sm:pt-8" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
        <button
          className="absolute right-5 top-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-storm transition hover:border-white/18 hover:text-ink"
          onClick={closeEditor}
          type="button"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={isCreateMode ? "Nuevo presupuesto" : "Editar presupuesto"} tone="info" />
          <StatusBadge status={workspace?.baseCurrencyCode ? `Base ${workspace.baseCurrencyCode}` : "Sin base"} tone="neutral" />
        </div>

        <h2 className="mt-4 font-display text-4xl font-semibold text-ink">
          {isCreateMode ? "Crear presupuesto" : "Actualizar presupuesto"}
        </h2>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-storm">
          Define un tope mensual, por categoría, por cuenta o por ambos. Luego el dashboard te mostrará cuánto vas usando y cuáles están en riesgo.
        </p>

        <div className="mt-8 space-y-6">
          <div className="grid gap-5 rounded-[30px] border border-white/10 bg-white/[0.04] p-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div>
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-pine/35 to-[#0d1420] text-pine ring-1 ring-white/10">
                    <PiggyBank className="h-7 w-7" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.22em] text-storm">Vista previa</p>
                    <h3 className="mt-2 font-display text-3xl font-semibold text-ink">
                      {formState.name.trim() || "Nuevo presupuesto"}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm leading-7 text-storm">{scopeDetails.description}</p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <StatusBadge status={scopeDetails.label} tone="info" />
                  <StatusBadge
                    status={formState.currencyCode || workspace?.baseCurrencyCode || "PEN"}
                    tone="neutral"
                  />
                  <StatusBadge status={formState.isActive ? "Activo" : "Inactivo"} tone="success" />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Limite</p>
                  <p className="mt-3 font-display text-3xl font-semibold text-ink">
                    {formatCurrency(parsedLimitAmount, formState.currencyCode || workspace?.baseCurrencyCode || "PEN")}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Periodo</p>
                  <p className="mt-3 text-sm font-semibold text-ink">
                    {formState.periodStart ? formatDate(formState.periodStart) : "Sin inicio"}
                  </p>
                  <p className="mt-1 text-sm text-storm">
                    hasta {formState.periodEnd ? formatDate(formState.periodEnd) : "sin cierre"}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Categoría</p>
                  <p className="mt-3 text-sm font-semibold text-ink">
                    {selectedCategory?.name ?? "Sin categoría fija"}
                  </p>
                </div>
                <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-storm">Cuenta</p>
                  <p className="mt-3 text-sm font-semibold text-ink">
                    {selectedAccount?.name ?? "Sin cuenta fija"}
                  </p>
                </div>
              </div>
            </div>

          <form className="grid gap-6" noValidate onSubmit={onSubmit}>
            {feedback ? (
              <FormFeedbackBanner
                description={feedback.description}
                tone={feedback.tone}
                title={feedback.title}
              />
            ) : null}

            <section className="rounded-[30px] border border-white/10 bg-[#0b111c]/92 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-storm">Identidad</p>
              <h3 className="mt-4 font-display text-3xl font-semibold text-ink">Base del presupuesto</h3>

              <div className="mt-6 space-y-5">
                <label className="block">
                  <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Nombre</span>
                  <div className={invalidFields.has("name") ? "field-error-ring" : ""} data-field="name">
                    <Input
                      onChange={(event) => { clearFieldError("name"); updateFormState("name", event.target.value); }}
                      placeholder="Ej. Salud mensual"
                      value={formState.name}
                    />
                  </div>
                </label>

                <div>
                  <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Alcance</span>
                  <div className="grid gap-3">
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
            </section>

            <section className="rounded-[30px] border border-white/10 bg-[#0b111c]/92 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-storm">Regla</p>
              <h3 className="mt-4 font-display text-3xl font-semibold text-ink">Monto y periodo</h3>

              <div className="mt-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-storm">Monto</p>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Moneda</span>
                      <BudgetPicker
                        onChange={(value) => updateFormState("currencyCode", value)}
                        options={currencyOptions}
                        placeholderDescription="Elige en que moneda quieres controlar este tope."
                        placeholderLabel="Selecciona una moneda"
                        value={formState.currencyCode}
                      />
                    </label>

                    <label className="block">
                      <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Limite maximo</span>
                      <div className={invalidFields.has("limitAmount") ? "field-error-ring" : ""} data-field="limitAmount">
                        <Input
                          inputMode="decimal"
                          onChange={(event) => { clearFieldError("limitAmount"); updateFormState("limitAmount", event.target.value); }}
                          placeholder="0.00"
                          value={formState.limitAmount}
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Alertar desde</span>
                      <Input
                        inputMode="decimal"
                        onChange={(event) => updateFormState("alertPercent", event.target.value)}
                        placeholder="80"
                        value={formState.alertPercent}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/8 bg-white/[0.03] p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-storm">Periodo</p>
                  <div className="mt-4 grid gap-5 sm:grid-cols-2">
                    <label className="block min-w-0">
                      <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Inicio</span>
                      <div className={invalidFields.has("periodStart") ? "field-error-ring" : ""} data-field="periodStart">
                        <DatePickerField
                          onChange={(value) => { clearFieldError("periodStart"); updateFormState("periodStart", value); }}
                          value={formState.periodStart}
                        />
                      </div>
                    </label>
                    <label className="block min-w-0">
                      <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Fin</span>
                      <div className={invalidFields.has("periodEnd") ? "field-error-ring" : ""} data-field="periodEnd">
                        <DatePickerField
                          onChange={(value) => { clearFieldError("periodEnd"); updateFormState("periodEnd", value); }}
                          value={formState.periodEnd}
                        />
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-[30px] border border-white/10 bg-[#0b111c]/92 p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-storm">Destino</p>
                <h3 className="mt-4 font-display text-3xl font-semibold text-ink">Categoria y cuenta</h3>

                <div className="mt-6 grid gap-5">
                  <label className="block">
                    <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Categoría</span>
                    <div className={invalidFields.has("categoryId") ? "field-error-ring" : ""} data-field="categoryId">
                      <BudgetPicker
                        disabled={formState.scopeKind === "general" || formState.scopeKind === "account"}
                        emptyMessage="No encontramos categorías con ese nombre."
                        onChange={(value) => { clearFieldError("categoryId"); updateFormState("categoryId", value ? Number(value) : null); }}
                        options={categoryOptions}
                        placeholderDescription="Elige una categoría para seguir este tope de forma más precisa."
                        placeholderLabel="Selecciona una categoría"
                        queryPlaceholder="Buscar categoría..."
                        value={formState.categoryId ? String(formState.categoryId) : ""}
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Cuenta</span>
                    <div className={invalidFields.has("accountId") ? "field-error-ring" : ""} data-field="accountId">
                      <BudgetPicker
                        disabled={formState.scopeKind === "general" || formState.scopeKind === "category"}
                        emptyMessage="No encontramos cuentas con ese nombre."
                        onChange={(value) => { clearFieldError("accountId"); updateFormState("accountId", value ? Number(value) : null); }}
                        options={accountOptions}
                        placeholderDescription="Elige una cuenta si quieres controlar solo lo que sale de ahi."
                        placeholderLabel="Selecciona una cuenta"
                        queryPlaceholder="Buscar cuenta..."
                        value={formState.accountId ? String(formState.accountId) : ""}
                      />
                    </div>
                  </label>
                </div>
              </section>

              <section className="rounded-[30px] border border-white/10 bg-[#0b111c]/92 p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-storm">Ajustes</p>
                <h3 className="mt-4 font-display text-3xl font-semibold text-ink">Alertas y notas</h3>

                <div className="mt-6 grid gap-5">
                  <label className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div>
                      <p className="font-semibold text-ink">Activo en dashboard</p>
                      <p className="mt-1 text-sm text-storm">Si lo desactivas, deja de contar en el resumen principal.</p>
                    </div>
                    <input
                      checked={formState.isActive}
                      className="h-5 w-5 rounded border-white/10 bg-transparent text-pine"
                      onChange={(event) => updateFormState("isActive", event.target.checked)}
                      type="checkbox"
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-[22px] border border-white/10 bg-white/[0.03] p-4">
                    <div>
                      <p className="font-semibold text-ink">Rollover</p>
                      <p className="mt-1 text-sm text-storm">Dejalo listo para una futura fase donde el saldo pase al siguiente periodo.</p>
                    </div>
                    <input
                      checked={formState.rolloverEnabled}
                      className="h-5 w-5 rounded border-white/10 bg-transparent text-pine"
                      onChange={(event) => updateFormState("rolloverEnabled", event.target.checked)}
                      type="checkbox"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Notas</span>
                    <textarea
                      className={textareaClassName}
                      onChange={(event) => updateFormState("notes", event.target.value)}
                      placeholder="Ej. Mantener Salud bajo control durante este mes."
                      value={formState.notes}
                    />
                  </label>
                </div>
              </section>
            </div>

            <div className="sticky bottom-0 z-[60] -mx-6 sm:-mx-8 mt-8 rounded-b-[34px] border-t border-white/10 bg-[#060b12]/95 px-6 py-5 sm:px-8 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-sm leading-7 text-storm">
                  El dashboard te mostrará cuánto gastaste, cuanto te queda y que presupuestos estan por entrar en riesgo.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Button onClick={closeEditor} type="button" variant="ghost">
                    Cancelar
                  </Button>
                  <Button disabled={isSaving} type="submit" variant="primary">
                    {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {isCreateMode ? "Crear presupuesto" : "Guardar cambios"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}

function DeleteBudgetDialog({
  budget,
  isDeleting,
  onClose,
  onConfirm,
}: {
  budget: DisplayBudgetOverview;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-[rgba(4,8,16,0.72)] backdrop-blur-[18px]" />
      <div className="absolute inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-4 py-10">
          <div className="relative w-full max-w-2xl rounded-[34px] border border-white/10 bg-[linear-gradient(180deg,rgba(8,12,20,0.98),rgba(9,14,24,0.96))] p-6 shadow-[0_35px_120px_rgba(0,0,0,0.55)] sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-ember/20 bg-ember/12 text-ember">
            <Trash2 className="h-7 w-7" />
          </div>
          <div>
            <StatusBadge status="Eliminar presupuesto" tone="warning" />
            <h2 className="mt-4 font-display text-4xl font-semibold text-ink">Confirma antes de borrarlo</h2>
            <p className="mt-4 text-sm leading-8 text-storm">
              Se perdera el tope configurado, pero no tus movimientos reales. Si prefieres conservar el historial visual, puedes dejarlo inactivo.
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
          <p className="font-display text-2xl font-semibold text-ink">{budget.name}</p>
          <p className="mt-2 text-sm text-storm">{budget.scopeLabel}</p>
          <p className="mt-4 text-sm text-storm">
            {formatCurrency(budget.displaySpentAmount, budget.displayCurrencyCode)} usados de{" "}
            {formatCurrency(budget.displayLimitAmount, budget.displayCurrencyCode)}
          </p>
          {budget.isConvertedDisplay ? (
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-storm/75">
              Vista actual en {budget.displayCurrencyCode}. Regla creada en {budget.currencyCode}.
            </p>
          ) : null}
        </div>

        <div className="mt-8 flex flex-wrap justify-end gap-3">
          <Button onClick={onClose} type="button" variant="ghost">
            Cancelar
          </Button>
          <Button disabled={isDeleting} onClick={() => void onConfirm()} type="button" variant="primary">
            {isDeleting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Eliminar definitivamente
          </Button>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
}

function StatCard({
  description,
  title,
  value,
}: {
  description: string;
  title: string;
  value: ReactNode;
}) {
  return (
    <div className="glass-panel-soft rounded-[26px] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-storm">{title}</p>
      <p className="mt-3 font-display text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm leading-7 text-storm">{description}</p>
    </div>
  );
}

export function BudgetsPage() {
  const { user } = useAuth();
  const {
    activeWorkspace,
    error: workspaceError,
    isLoading: isWorkspacesLoading,
  } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id);
  const createMutation = useCreateBudgetMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateBudgetMutation(activeWorkspace?.id, user?.id);
  const toggleMutation = useToggleBudgetMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteBudgetMutation(activeWorkspace?.id, user?.id);

  const [pageFeedback, setPageFeedback] = useState<FeedbackState | null>(null);
  const [editorFeedback, setEditorFeedback] = useState<FeedbackState | null>(null);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCurrentOnly, setShowCurrentOnly] = useState(true);
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
  const [viewMode, setViewMode] = useViewMode("budgets");
  const [formState, setFormState] = useState<BudgetFormState>(() =>
    createDefaultFormState(activeWorkspace),
  );

  const snapshot = snapshotQuery.data;
  const budgets = snapshot?.budgets ?? [];
  const categories = snapshot?.catalogs.categories ?? [];
  const accounts = useMemo(
    () =>
      (snapshot?.accounts ?? [])
        .filter((account) => !account.isArchived)
        .map((account) => ({
          id: account.id,
          name: account.name,
          currencyCode: account.currencyCode,
        })),
    [snapshot?.accounts],
  );
  const exchangeRateMap = useMemo(
    () => buildExchangeRateMap(snapshot?.exchangeRates ?? []),
    [snapshot?.exchangeRates],
  );
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
        displayLimitAmount: convertBudgetAmount(
          budget.limitAmount,
          budget.currencyCode,
          displayCurrencyCode,
          baseCurrencyCode,
          exchangeRateMap,
        ),
        displaySpentAmount: convertBudgetAmount(
          budget.spentAmount,
          budget.currencyCode,
          displayCurrencyCode,
          baseCurrencyCode,
          exchangeRateMap,
        ),
        displayRemainingAmount: convertBudgetAmount(
          budget.remainingAmount,
          budget.currencyCode,
          displayCurrencyCode,
          baseCurrencyCode,
          exchangeRateMap,
        ),
        isConvertedDisplay:
          normalizeCurrencyCode(budget.currencyCode) !== normalizeCurrencyCode(displayCurrencyCode),
      })),
    [baseCurrencyCode, budgets, displayCurrencyCode, exchangeRateMap],
  );
  const selectedBudget = displayBudgets.find((budget) => budget.id === selectedBudgetId) ?? null;
  const deleteTarget = displayBudgets.find((budget) => budget.id === deleteTargetId) ?? null;

  const filteredBudgets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...displayBudgets]
      .filter((budget) => {
        if (scopeFilter !== "all" && budget.scopeKind !== scopeFilter) {
          return false;
        }

        if (statusFilter === "active" && !budget.isActive) {
          return false;
        }

        if (statusFilter === "critical" && !(budget.isNearLimit || budget.isOverLimit)) {
          return false;
        }

        if (statusFilter === "inactive" && budget.isActive) {
          return false;
        }

        if (showCurrentOnly && !isBudgetCurrent(budget)) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return (
          budget.name.toLowerCase().includes(normalizedSearch) ||
          budget.scopeLabel.toLowerCase().includes(normalizedSearch) ||
          (budget.categoryName ?? "").toLowerCase().includes(normalizedSearch) ||
          (budget.accountName ?? "").toLowerCase().includes(normalizedSearch) ||
          (budget.notes ?? "").toLowerCase().includes(normalizedSearch)
        );
      })
      .sort((left, right) => {
        const leftScore =
          (left.isActive ? 2 : 0) +
          (isBudgetCurrent(left) ? 2 : 0) +
          (left.isOverLimit ? 3 : left.isNearLimit ? 2 : 0);
        const rightScore =
          (right.isActive ? 2 : 0) +
          (isBudgetCurrent(right) ? 2 : 0) +
          (right.isOverLimit ? 3 : right.isNearLimit ? 2 : 0);

        return (
          rightScore - leftScore ||
          right.usedPercent - left.usedPercent ||
          new Date(left.periodEnd).getTime() - new Date(right.periodEnd).getTime()
        );
      });
  }, [displayBudgets, scopeFilter, statusFilter, showCurrentOnly, search]);

  const currentActiveBudgets = useMemo(
    () => displayBudgets.filter((budget) => budget.isActive && isBudgetCurrent(budget)),
    [displayBudgets],
  );
  const totalLimitBase = currentActiveBudgets.reduce(
    (total, budget) => total + budget.displayLimitAmount,
    0,
  );
  const totalSpentBase = currentActiveBudgets.reduce(
    (total, budget) => total + budget.displaySpentAmount,
    0,
  );
  const totalRemainingBase = currentActiveBudgets.reduce(
    (total, budget) => total + budget.displayRemainingAmount,
    0,
  );
  const criticalBudgets = currentActiveBudgets.filter(
    (budget) => budget.isNearLimit || budget.isOverLimit,
  );
  const overLimitBudgets = currentActiveBudgets.filter((budget) => budget.isOverLimit);
  const topRiskBudgets = [...currentActiveBudgets]
    .sort((left, right) => right.usedPercent - left.usedPercent)
    .slice(0, 3);
  const totalTrackedMovements = currentActiveBudgets.reduce(
    (total, budget) => total + budget.movementCount,
    0,
  );

  function updateFormState<Field extends keyof BudgetFormState>(
    field: Field,
    value: BudgetFormState[Field],
  ) {
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
    if ((formState.scopeKind === "category" || formState.scopeKind === "category_account") && !formState.categoryId) budgetErrors.push("categoryId");
    if ((formState.scopeKind === "account" || formState.scopeKind === "category_account") && !formState.accountId) budgetErrors.push("accountId");
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
      categoryId:
        formState.scopeKind === "general" || formState.scopeKind === "account"
          ? null
          : formState.categoryId,
      accountId:
        formState.scopeKind === "general" || formState.scopeKind === "category"
          ? null
          : formState.accountId,
      limitAmount,
      rolloverEnabled: formState.rolloverEnabled,
      alertPercent,
      notes: formState.notes,
      isActive: formState.isActive,
    };

    try {
      if (editorMode === "create") {
        await createMutation.mutateAsync({
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        });
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

  async function handleDeleteBudget() {
    if (!activeWorkspace || !user?.id || !deleteTarget) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({
        budgetId: deleteTarget.id,
        workspaceId: activeWorkspace.id,
      });
      setDeleteTargetId(null);
      setPageFeedback({
        tone: "success",
        title: "Presupuesto eliminado",
        description: "Los movimientos se conservaron intactos; solo retiramos la regla de control.",
      });
    } catch (error) {
      setPageFeedback({
        tone: "error",
        title: "No pudimos eliminar el presupuesto",
        description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos."),
      });
    }
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
        <DataState description="Cargando reglas y consumo del workspace..." title="Preparando presupuestos" />
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
      <PageHeader
        actions={
          <>
            <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
            <Button onClick={openCreateEditor}>
              <Plus className="h-4 w-4" />
              Nuevo presupuesto
            </Button>
          </>
        }
        description="Pon topes mensuales o por rango a tu gasto total, a una categoría, a una cuenta o al cruce de ambas."
        eyebrow="planificación"
        title="Presupuestos"
      >
        <div className="flex flex-wrap gap-3">
          <StatusBadge status={`Base del workspace ${displayCurrencyCode}`} tone="success" />
          <StatusBadge status={`${currentActiveBudgets.length} vigentes`} tone="info" />
        </div>
        <p className="mt-4 text-sm leading-7 text-storm">
          Esta vista sigue la configuracion base de tu workspace. Todos los montos se resumen en {displayCurrencyCode} con el ultimo tipo de cambio disponible.
        </p>
      </PageHeader>

      {pageFeedback?.tone === "error" ? (
        <FormFeedbackBanner
          description={pageFeedback.description}
          tone={pageFeedback.tone}
          title={pageFeedback.title}
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          description={`${currentActiveBudgets.length} activos en el período actual.`}
          title="Techo total"
          value={formatCurrency(totalLimitBase, displayCurrencyCode)}
        />
        <StatCard
          description={`${totalTrackedMovements} movimientos ya cuentan para estos límites.`}
          title="Consumido"
          value={formatCurrency(totalSpentBase, displayCurrencyCode)}
        />
        <StatCard
          description={
            totalRemainingBase >= 0
              ? "Espacio que aún tienes disponible antes de tocar tus topes."
              : "Ya sobrepasaste parte del techo planeado para este periodo."
          }
          title="Restante"
          value={formatCurrency(totalRemainingBase, displayCurrencyCode)}
        />
        <StatCard
          description={`${overLimitBudgets.length} excedidos y ${criticalBudgets.length - overLimitBudgets.length} en alerta.`}
          title="En riesgo"
          value={criticalBudgets.length}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SurfaceCard
          action={<ReceiptText className="h-5 w-5 text-pine" />}
          description="Filtra por alcance, estado o escribe una pista rapida para encontrar un presupuesto especifico."
          title="Explorar presupuestos"
        >
          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_auto]">
            <label className="block">
              <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Buscar</span>
              <Input
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Ej. Salud, tarjeta principal, tope pareja..."
                value={search}
              />
            </label>

            <label className="block">
              <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Alcance</span>
              <select
                className={`${inputClassName} appearance-none`}
                onChange={(event) => setScopeFilter(event.target.value as ScopeFilter)}
                value={scopeFilter}
              >
                {scopeFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-3 block text-xs uppercase tracking-[0.22em] text-storm">Estado</span>
              <select
                className={`${inputClassName} appearance-none`}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                value={statusFilter}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              className={`mt-8 rounded-[22px] border px-4 py-3 text-sm font-medium transition ${
                showCurrentOnly
                  ? "border-pine/30 bg-pine/10 text-pine"
                  : "border-white/10 bg-white/[0.03] text-storm hover:border-white/16 hover:text-ink"
              }`}
              onClick={() => setShowCurrentOnly((currentValue) => !currentValue)}
              type="button"
            >
              {showCurrentOnly ? "Solo vigentes" : "Ver historicos"}
            </button>
          </div>
        </SurfaceCard>

        <SurfaceCard
          action={<PiggyBank className="h-5 w-5 text-gold" />}
          description="Lo más delicado del momento para no abrir cada presupuesto uno por uno."
          title="Presión actual"
        >
          {topRiskBudgets.length === 0 ? (
            <DataState
              description="Cuando empieces a usar presupuestos vigentes, aquí verás cuáles se acercan primero al límite."
              title="Todo despejado por ahora"
              tone="success"
            />
          ) : (
            <div className="grid gap-3">
              {topRiskBudgets.map((budget) => (
                <article
                  className={`rounded-[24px] border p-4 ${
                    budget.isOverLimit
                      ? "border-ember/24 bg-ember/10"
                      : budget.isNearLimit
                        ? "border-gold/24 bg-gold/10"
                        : "border-white/10 bg-white/[0.03]"
                  }`}
                  key={budget.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{budget.name}</p>
                      <p className="mt-1 text-sm text-storm">{budget.scopeLabel}</p>
                    </div>
                    <StatusBadge status={getBudgetStatusLabel(budget)} tone={getBudgetTone(budget)} />
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-white/[0.08]">
                    <div
                      className={`h-full rounded-full ${
                        budget.isOverLimit
                          ? "bg-gradient-to-r from-ember to-[#ff9e6a]"
                          : budget.isNearLimit
                            ? "bg-gradient-to-r from-gold to-[#ffd18b]"
                            : "bg-gradient-to-r from-pine to-emerald-300"
                      }`}
                      style={{ width: `${Math.min(Math.max(budget.usedPercent, 4), 100)}%` }}
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm text-storm">
                    <span>{formatCurrency(budget.displaySpentAmount, budget.displayCurrencyCode)} usados</span>
                    <span>{Math.round(budget.usedPercent)}%</span>
                  </div>
                  {budget.isConvertedDisplay ? (
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-storm/75">
                      Vista {budget.displayCurrencyCode} desde {budget.currencyCode}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </SurfaceCard>
      </section>

      <SurfaceCard
        action={<StatusBadge status={`${filteredBudgets.length} visibles`} tone="info" />}
        description="Cada tarjeta te muestra el límite, lo consumido, el saldo restante y la presión del período."
        title="Mantenedor de presupuestos"
      >
        {filteredBudgets.length === 0 ? (
          <DataState
            action={
              budgets.length === 0 ? (
                <Button onClick={openCreateEditor}>Crear primer presupuesto</Button>
              ) : (
                <Button
                  onClick={() => {
                    setSearch("");
                    setScopeFilter("all");
                    setStatusFilter("all");
                    setShowCurrentOnly(false);
                  }}
                  variant="ghost"
                >
                  Limpiar filtros
                </Button>
              )
            }
            description={
              budgets.length === 0
                ? "Puedes crear reglas generales, por categoría, por cuenta o por categoría dentro de una cuenta."
                : "Prueba cambiando los filtros o buscando por nombre, categoría o cuenta."
            }
            title={budgets.length === 0 ? "Aún no has creado presupuestos" : "No encontramos coincidencias"}
          />
        ) : viewMode === "list" ? (
          <div className="space-y-3">
            {filteredBudgets.map((budget) => (
              <article className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16" key={budget.id}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-pine">
                  {budget.scopeKind === "account" || budget.scopeKind === "category_account" ? <Wallet className="h-4 w-4" /> : <PiggyBank className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{budget.name}</p>
                  <p className="text-xs text-storm">{budget.scopeLabel} · {formatDate(budget.periodStart)} – {formatDate(budget.periodEnd)}</p>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <div className="h-2 w-24 rounded-full bg-white/[0.08]">
                    <div className={`h-full rounded-full ${budget.isOverLimit ? "bg-ember" : budget.isNearLimit ? "bg-gold" : "bg-pine"}`} style={{ width: `${Math.min(budget.usedPercent, 100)}%` }} />
                  </div>
                  <span className="text-xs text-storm w-8 text-right">{Math.round(budget.usedPercent)}%</span>
                </div>
                <div className="text-right shrink-0">
                  <p className={`font-display text-xl font-semibold ${budget.displayRemainingAmount < 0 ? "text-ember" : "text-pine"}`}>{formatCurrency(budget.displayRemainingAmount, budget.displayCurrencyCode)}</p>
                  <p className="text-xs text-storm">de {formatCurrency(budget.displayLimitAmount, budget.displayCurrencyCode)}</p>
                </div>
                <StatusBadge status={getBudgetStatusLabel(budget)} tone={getBudgetTone(budget)} />
                <div className="flex shrink-0 gap-2">
                  <Button className="py-1.5 text-xs" onClick={() => openEditEditor(budget)} variant="ghost">Editar</Button>
                </div>
              </article>
            ))}
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Presupuesto</th>
                  <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 hidden sm:table-cell">Período</th>
                  <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Límite</th>
                  <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Consumido</th>
                  <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Restante</th>
                  <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Estado</th>
                  <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredBudgets.map((budget, index) => (
                  <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === filteredBudgets.length - 1 ? "border-b-0" : ""}`} key={budget.id}>
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-ink">{budget.name}</p>
                      <p className="text-xs text-storm">{budget.scopeLabel}</p>
                    </td>
                    <td className="px-5 py-3.5 text-storm hidden sm:table-cell">{formatDate(budget.periodStart)} – {formatDate(budget.periodEnd)}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-ink">{formatCurrency(budget.displayLimitAmount, budget.displayCurrencyCode)}</td>
                    <td className="px-5 py-3.5 text-right text-ink">{formatCurrency(budget.displaySpentAmount, budget.displayCurrencyCode)}</td>
                    <td className={`px-5 py-3.5 text-right font-semibold ${budget.displayRemainingAmount < 0 ? "text-ember" : "text-pine"}`}>{formatCurrency(budget.displayRemainingAmount, budget.displayCurrencyCode)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={getBudgetStatusLabel(budget)} tone={getBudgetTone(budget)} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button className="py-1.5 text-xs" onClick={() => openEditEditor(budget)} variant="ghost">Editar</Button>
                        <Button className="py-1.5 text-xs" disabled={isToggling} onClick={() => void handleToggleBudget(budget)} variant="ghost">{budget.isActive ? "Desactivar" : "Activar"}</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredBudgets.map((budget) => {
              const progressWidth = Math.min(Math.max(budget.usedPercent, 2), 100);
              const remainingTone = budget.displayRemainingAmount < 0 ? "text-ember" : "text-pine";

              return (
                <article
                  className="rounded-[30px] border border-white/10 bg-white/[0.03] p-5"
                  key={budget.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={budget.scopeLabel} tone="info" />
                        <StatusBadge status={`Vista ${budget.displayCurrencyCode}`} tone="success" />
                        {budget.isConvertedDisplay ? (
                          <StatusBadge status={`Regla ${budget.currencyCode}`} tone="neutral" />
                        ) : null}
                        <StatusBadge
                          status={getBudgetStatusLabel(budget)}
                          tone={getBudgetTone(budget)}
                        />
                        {!budget.isActive ? <StatusBadge status="Inactivo" tone="neutral" /> : null}
                      </div>
                      <h3 className="mt-4 font-display text-3xl font-semibold text-ink">
                        {budget.name}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-storm">
                        {formatDate(budget.periodStart)} al {formatDate(budget.periodEnd)}
                      </p>
                    </div>

                    <div className="flex h-14 w-14 items-center justify-center rounded-[22px] border border-white/10 bg-white/[0.03] text-pine">
                      {budget.scopeKind === "account" || budget.scopeKind === "category_account" ? (
                        <Wallet className="h-6 w-6" />
                      ) : (
                        <PiggyBank className="h-6 w-6" />
                      )}
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Limite</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(budget.displayLimitAmount, budget.displayCurrencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Consumido</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(budget.displaySpentAmount, budget.displayCurrencyCode)}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Restante</p>
                      <p className={`mt-3 font-display text-2xl font-semibold ${remainingTone}`}>
                        {formatCurrency(budget.displayRemainingAmount, budget.displayCurrencyCode)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5">
                    {budget.isConvertedDisplay ? (
                      <p className="mb-3 text-xs uppercase tracking-[0.18em] text-storm/75">
                        Regla configurada en {budget.currencyCode}. Esta lectura se muestra en {budget.displayCurrencyCode}.
                      </p>
                    ) : null}
                    <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.18em] text-storm">
                      <span>Uso del presupuesto</span>
                      <span>{Math.round(budget.usedPercent)}%</span>
                    </div>
                    <div className="mt-3 h-3 rounded-full bg-white/[0.08]">
                      <div
                        className={`h-full rounded-full ${
                          budget.isOverLimit
                            ? "bg-gradient-to-r from-ember to-[#ff9e6a]"
                            : budget.isNearLimit
                              ? "bg-gradient-to-r from-gold to-[#ffd18b]"
                              : "bg-gradient-to-r from-pine to-emerald-300"
                        }`}
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                    <p className="mt-3 text-sm leading-7 text-storm">
                      {budget.isOverLimit
                        ? `Ya sobrepasaste este techo por ${formatCurrency(
                            Math.abs(budget.displayRemainingAmount),
                            budget.displayCurrencyCode,
                          )}.`
                        : budget.isNearLimit
                          ? `Estas entrando en zona de alerta desde el ${Math.round(
                              budget.alertPercent,
                            )}% configurado.`
                          : "Todavía tienes aire para seguir dentro del plan."}
                    </p>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Categoría</p>
                      <p className="mt-3 text-sm font-semibold text-ink">
                        {budget.categoryName ?? "Sin categoría fija"}
                      </p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-storm">Cuenta</p>
                      <p className="mt-3 text-sm font-semibold text-ink">
                        {budget.accountName ?? "Sin cuenta fija"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm text-storm">
                    <span>{budget.movementCount} movimientos dentro del periodo.</span>
                    <span>Actualizado {formatDate(budget.updatedAt)}</span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-5">
                    <Button onClick={() => openEditEditor(budget)} variant="ghost">
                      <PencilLine className="h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      disabled={isToggling}
                      onClick={() => void handleToggleBudget(budget)}
                      variant="ghost"
                    >
                      {budget.isActive ? "Desactivar" : "Reactivar"}
                    </Button>
                    <Button
                      className="border-white/10 text-[#ffb4bc] hover:border-[#ffb4bc]/30 hover:bg-[#ff9ca6]/10 hover:text-[#ffd3d8]"
                      onClick={() => setDeleteTargetId(budget.id)}
                      variant="ghost"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SurfaceCard>

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
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteBudgetDialog
          budget={deleteTarget}
          isDeleting={isDeleting}
          onClose={() => setDeleteTargetId(null)}
          onConfirm={handleDeleteBudget}
        />
      ) : null}
    </div>
  );
}
