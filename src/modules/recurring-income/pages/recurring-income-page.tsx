import {
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  LoaderCircle,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import type {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useMemo, useState } from "react";

import { useOutsidePointerClose } from "../../../hooks/use-outside-pointer-close";
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
import { TruncatedDescription } from "../../../components/ui/truncated-description";
import { BulkActionBar, SelectionCheckbox, useSelection, createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  CategorySummary,
  CounterpartySummary,
  RecurringIncomeFrequency,
  RecurringIncomeStatus,
  RecurringIncomeSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  type RecurringIncomeFormInput,
  useCreateRecurringIncomeMutation,
  useDeleteRecurringIncomeMutation,
  useUpdateRecurringIncomeMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

type EditorMode = "create" | "edit";

type RecurringIncomeFormState = {
  name: string;
  payerPartyId: string;
  accountId: string;
  categoryId: string;
  currencyCode: string;
  amount: string;
  frequency: RecurringIncomeFrequency;
  intervalCount: string;
  dayOfMonth: string;
  dayOfWeek: string;
  startDate: string;
  nextExpectedDate: string;
  endDate: string;
  status: RecurringIncomeStatus;
  remindDaysBefore: string;
  description: string;
  notes: string;
};

type FeedbackState = {
  tone: "success" | "error";
  title: string;
  description: string;
};

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

const frequencyOptions = [
  { value: "daily" as const, label: "Diaria", description: "Se repite cada dia.", leadingLabel: "D", leadingColor: "#1b6a58" },
  { value: "weekly" as const, label: "Semanal", description: "Se repite por semanas.", leadingLabel: "S", leadingColor: "#4566d6" },
  { value: "monthly" as const, label: "Mensual", description: "Se repite cada mes.", leadingLabel: "M", leadingColor: "#8366f2" },
  { value: "quarterly" as const, label: "Trimestral", description: "Se repite cada trimestre.", leadingLabel: "T", leadingColor: "#b48b34" },
  { value: "yearly" as const, label: "Anual", description: "Se repite una vez por ano.", leadingLabel: "A", leadingColor: "#c46a31" },
  { value: "custom" as const, label: "Personalizada", description: "Tienes una frecuencia especial.", leadingLabel: "P", leadingColor: "#64748b" },
] as const;

const statusOptions = [
  { value: "active" as const, label: "Activo", description: "Sigue generando recordatorios y vencimientos.", leadingLabel: "AC", leadingColor: "#1b6a58" },
  { value: "paused" as const, label: "Pausado", description: "Se conserva, pero temporalmente detenido.", leadingLabel: "PA", leadingColor: "#b48b34" },
  { value: "cancelled" as const, label: "Cancelado", description: "Ya no forma parte de tu control activo.", leadingLabel: "CA", leadingColor: "#8f3e3e" },
] as const;

const currencyOptions = [
  { code: "PEN", label: "Sol peruano", region: "Peru", symbol: "S/" },
  { code: "USD", label: "Dolar estadounidense", region: "Estados Unidos", symbol: "$" },
  { code: "EUR", label: "Euro", region: "Union Europea", symbol: "EUR" },
  { code: "BRL", label: "Real brasileno", region: "Brasil", symbol: "R$" },
  { code: "MXN", label: "Peso mexicano", region: "Mexico", symbol: "MXN" },
  { code: "CLP", label: "Peso chileno", region: "Chile", symbol: "CLP" },
] as const;

const weekdayOptions = [
  { value: "0", label: "Domingo", description: "Inicio de semana clasica.", leadingLabel: "DO" },
  { value: "1", label: "Lunes", description: "Buen dia para ingresos fijos.", leadingLabel: "LU" },
  { value: "2", label: "Martes", description: "Repeticion semanal en martes.", leadingLabel: "MA" },
  { value: "3", label: "Miercoles", description: "Repeticion semanal en miercoles.", leadingLabel: "MI" },
  { value: "4", label: "Jueves", description: "Repeticion semanal en jueves.", leadingLabel: "JU" },
  { value: "5", label: "Viernes", description: "Repeticion semanal en viernes.", leadingLabel: "VI" },
  { value: "6", label: "Sabado", description: "Repeticion semanal en sabado.", leadingLabel: "SA" },
] as const;

const fieldClassName =
  "w-full rounded-[18px] sm:rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-3 sm:px-4 text-xs sm:text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";
const inputClassName = `${fieldClassName} h-10 sm:h-16`;
const textareaClassName = `${fieldClassName} min-h-[100px] sm:min-h-[140px] py-3 sm:py-4 leading-7`;
const panelClassName =
  "glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] sm:rounded-[32px] border border-white/10 bg-white/[0.04] p-3 sm:p-6";
const labelClassName =
  "text-[0.6rem] sm:text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80";

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

function getFrequencyOption(frequency: RecurringIncomeFrequency) {
  return frequencyOptions.find((option) => option.value === frequency) ?? frequencyOptions[0];
}

function getStatusOption(status: RecurringIncomeStatus) {
  return statusOptions.find((option) => option.value === status) ?? statusOptions[0];
}

function getStatusTone(status: RecurringIncomeStatus) {
  switch (status) {
    case "active":
      return "success" as const;
    case "paused":
      return "warning" as const;
    default:
      return "danger" as const;
  }
}

function createDefaultFormState(baseCurrencyCode: string): RecurringIncomeFormState {
  return {
    name: "",
    payerPartyId: "",
    accountId: "",
    categoryId: "",
    currencyCode: baseCurrencyCode,
    amount: "",
    frequency: "monthly",
    intervalCount: "1",
    dayOfMonth: "",
    dayOfWeek: "",
    startDate: toDateInputValue(new Date().toISOString()),
    nextExpectedDate: toDateInputValue(new Date().toISOString()),
    endDate: "",
    status: "active",
    remindDaysBefore: "3",
    description: "",
    notes: "",
  };
}

function buildFormStateFromRecurringIncome(income: RecurringIncomeSummary): RecurringIncomeFormState {
  return {
    name: income.name,
    payerPartyId: income.payerPartyId ? String(income.payerPartyId) : "",
    accountId: income.accountId ? String(income.accountId) : "",
    categoryId: income.categoryId ? String(income.categoryId) : "",
    currencyCode: income.currencyCode,
    amount: String(income.amount),
    frequency: income.frequency,
    intervalCount: String(income.intervalCount),
    dayOfMonth:
      income.dayOfMonth === null || income.dayOfMonth === undefined ? "" : String(income.dayOfMonth),
    dayOfWeek:
      income.dayOfWeek === null || income.dayOfWeek === undefined ? "" : String(income.dayOfWeek),
    startDate: toDateInputValue(income.startDate),
    nextExpectedDate: toDateInputValue(income.nextExpectedDate),
    endDate: income.endDate ? toDateInputValue(income.endDate) : "",
    status: income.status,
    remindDaysBefore: String(income.remindDaysBefore),
    description: income.description ?? "",
    notes: income.notes ?? "",
  };
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
  const containerRef = useOutsidePointerClose(isOpen, () => setIsOpen(false));
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
      className={`relative min-w-0 ${isOpen ? "z-50" : "z-10"}`}
      ref={containerRef}
    >
      <button
        className={`${fieldClassName} flex h-10 sm:h-16 items-center justify-between gap-2 sm:gap-3 text-left ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2 sm:gap-3">
          <span
            className="flex h-7 min-w-[2.25rem] sm:h-10 sm:min-w-[3rem] shrink-0 items-center justify-center rounded-[12px] sm:rounded-[18px] border border-white/10 bg-white/[0.04] px-2 sm:px-3 text-xs sm:text-sm font-semibold text-ink"
            style={{
              backgroundColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}22` : undefined,
              borderColor: selectedOption?.leadingColor ? `${selectedOption.leadingColor}55` : undefined,
              color: selectedOption?.leadingColor ? "#fff" : undefined,
            }}
          >
            {selectedOption?.leadingLabel ?? "?"}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xs sm:text-sm font-semibold text-ink">
              {selectedOption ? selectedOption.label : placeholderLabel}
            </span>
            <TruncatedDescription
              className="mt-0.5 sm:mt-1 text-[0.65rem] sm:text-xs text-storm"
              text={selectedOption ? selectedOption.description : placeholderDescription}
            />
          </span>
        </span>
        <ChevronDown className={`h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
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
                    className="flex w-full items-center justify-between gap-2 sm:gap-3 rounded-[18px] sm:rounded-[24px] border border-white/5 bg-[#0d1623] px-3 sm:px-4 py-2.5 sm:py-3.5 text-left transition duration-200 hover:border-white/12"
                    key={option.value}
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex h-8 min-w-[2.25rem] sm:h-11 sm:min-w-[3rem] shrink-0 items-center justify-center rounded-[12px] sm:rounded-[18px] border border-white/10 bg-white/[0.04] px-2 sm:px-3 text-xs sm:text-sm font-semibold text-ink"
                        style={{
                          backgroundColor: option.leadingColor ? `${option.leadingColor}22` : undefined,
                          borderColor: option.leadingColor ? `${option.leadingColor}55` : undefined,
                          color: option.leadingColor ? "#fff" : undefined,
                        }}
                      >
                        {option.leadingLabel}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{option.label}</span>
                        <TruncatedDescription
                          className="mt-1 text-xs text-storm"
                          text={option.description}
                        />
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
    <label className="block min-w-0">
      <span className={labelClassName}>{label}</span>
      <div
        className={`mt-1.5 sm:mt-3${hasError ? " field-error-ring" : ""}`}
        data-field={errorKey}
      >
        {children}
      </div>
      {hint ? <p className="mt-1 sm:mt-2 break-words text-[0.65rem] sm:text-xs leading-5 sm:leading-6 text-storm/75">{hint}</p> : null}
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
  return <textarea className={`${textareaClassName} ${className}`} {...props} />;
}

function EditorDialog({
  accounts,
  baseCurrencyCode,
  categories,
  clearFieldError,
  closeEditor,
  counterparties,
  feedback,
  formState,
  invalidFields,
  isCreateMode,
  isSaving,
  onSubmit,
  updateFormState,
}: {
  accounts: AccountSummary[];
  baseCurrencyCode: string;
  categories: CategorySummary[];
  clearFieldError: (field: string) => void;
  closeEditor: () => void;
  counterparties: CounterpartySummary[];
  feedback: FeedbackState | null;
  formState: RecurringIncomeFormState;
  invalidFields: Set<string>;
  isCreateMode: boolean;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateFormState: <Field extends keyof RecurringIncomeFormState>(
    field: Field,
    value: RecurringIncomeFormState[Field],
  ) => void;
}) {
  const title = formState.name.trim() || "Nuevo ingreso recurrente";

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

  const amount = parseOptionalNumber(formState.amount) ?? 0;
  const selectedPayer = counterparties.find(
    (counterparty) => String(counterparty.id) === formState.payerPartyId,
  );
  const selectedAccount = accounts.find((account) => String(account.id) === formState.accountId);
  const frequencyOption = getFrequencyOption(formState.frequency);
  const statusOption = getStatusOption(formState.status);
  const currencyLabel = getCurrencyLabel(formState.currencyCode || baseCurrencyCode);
  const counterpartyOptions = counterparties
    .filter((counterparty) => !counterparty.isArchived || String(counterparty.id) === formState.payerPartyId)
    .map<PickerOption>((counterparty) => ({
      value: String(counterparty.id),
      label: counterparty.name,
      description: counterparty.isArchived
        ? "Archivada, pero disponible para este ingreso."
        : `Tipo ${counterparty.type}.`,
      leadingLabel: counterparty.name.slice(0, 2).toUpperCase(),
      leadingColor:
        counterparty.type === "service"
          ? "#b48b34"
          : counterparty.type === "company"
            ? "#4566d6"
            : counterparty.type === "merchant"
              ? "#c46a31"
              : "#6b7280",
      searchText: `${counterparty.name} ${counterparty.type}`,
    }));
  const accountOptions = accounts
    .filter((account) => !account.isArchived || String(account.id) === formState.accountId)
    .map<PickerOption>((account) => ({
      value: String(account.id),
      label: account.name,
      description: `${account.type} - ${account.currencyCode}`,
      leadingLabel: account.currencyCode,
      leadingColor: account.color,
      searchText: `${account.name} ${account.type} ${account.currencyCode}`,
    }));
  const categoryOptions = categories
    .filter((category) => (category.isActive || String(category.id) === formState.categoryId) && (category.kind === "income" || category.kind === "both"))
    .map<PickerOption>((category) => ({
      value: String(category.id),
      label: category.name,
      description:
        category.kind === "both"
          ? "Disponible para varios tipos de movimientos."
          : "Categoria pensada para ingresos recurrentes.",
      leadingLabel: category.name.slice(0, 2).toUpperCase(),
      leadingColor: category.kind === "both" ? "#4566d6" : "#1b6a58",
      searchText: `${category.name} ${category.kind}`,
    }));
  const frequencyPickerOptions = frequencyOptions.map<PickerOption>((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
    leadingColor: option.leadingColor,
  }));
  const statusPickerOptions = statusOptions.map<PickerOption>((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
    leadingColor: option.leadingColor,
  }));
  const currencyPickerOptions = currencyOptions.map<PickerOption>((option) => ({
    value: option.code,
    label: option.code,
    description: `${option.label} - ${option.region}`,
    leadingLabel: option.symbol,
    leadingColor: "#4566d6",
    searchText: `${option.code} ${option.label} ${option.region}`,
  }));
  const needsDayOfWeek = formState.frequency === "weekly";
  const needsDayOfMonth =
    formState.frequency === "monthly" ||
    formState.frequency === "quarterly" ||
    formState.frequency === "yearly";

  return (
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-[#02060d]/82 p-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#02060d]/68 before:backdrop-blur-2xl before:content-[''] sm:p-6" onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }} onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) closeEditor(); }}>
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[1120px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <form className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden" noValidate onSubmit={onSubmit}>
            <div className="overflow-y-auto px-4 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                      {isCreateMode ? "Nuevo ingreso recurrente" : "Editar ingreso recurrente"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      {isCreateMode ? "Quedara listo para seguirlo" : "Ajusta monto, ritmo y recordatorios"}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.7rem]">
                    {isCreateMode ? "Registrar ingreso recurrente" : "Actualizar ingreso recurrente"}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-9 text-storm">
                    Configura el monto, la frecuencia, los recordatorios y la cuenta sugerida para
                    tener tus ingresos fijos bajo control.
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
                <FormFeedbackBanner
                  className="mt-6"
                  description={feedback.description}
                  title={feedback.title}
                />
              ) : null}

              <div className="mt-7 rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,24,36,0.96),rgba(8,12,20,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,#1b6a58,rgba(8,13,20,0.72))] text-white">
                        <TrendingUp className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Vista previa</p>
                        <h3 className="mt-2 break-words font-display text-4xl font-semibold text-ink">{title}</h3>
                        <p className="mt-3 text-base leading-8 text-storm">
                          {selectedPayer?.name ?? "Selecciona un pagador"}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">{frequencyOption.label}</span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">{statusOption.label}</span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">{currencyLabel.code}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Monto esperado</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(amount, currencyLabel.code)}
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Proxima llegada</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formState.nextExpectedDate ? formatDate(formState.nextExpectedDate) : "Sin fecha"}
                      </p>
                      <p className="mt-2 text-sm text-storm">{selectedAccount?.name ?? "Sin cuenta sugerida"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 sm:mt-7 grid gap-3 sm:gap-5 lg:grid-cols-2">
                <div className={panelClassName}>
                  <p className={labelClassName}>Identidad</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Base del ingreso recurrente</h3>
                  <div className="mt-3 sm:mt-6 grid gap-3 sm:gap-5 sm:grid-cols-2">
                    <Field errorKey="name" hint="Nombre visible para reconocerlo en la app." invalidFields={invalidFields} label="Nombre">
                      <Input maxLength={120} onChange={(event) => { clearFieldError("name"); updateFormState("name", event.target.value); }} placeholder="Ej. Sueldo mensual" type="text" value={formState.name} />
                    </Field>
                    <Field hint="Empresa o persona que te paga." label="Pagador">
                      <Picker disabled={counterpartyOptions.length === 0} emptyMessage="No tienes contrapartes disponibles aun." onChange={(value) => updateFormState("payerPartyId", value)} options={counterpartyOptions} placeholderDescription="Puedes dejarlo libre si aun no lo registras." placeholderLabel="Sin pagador fijo" queryPlaceholder="Buscar pagador..." value={formState.payerPartyId} />
                    </Field>
                    <Field hint="Categoria contable sugerida." label="Categoria">
                      <Picker disabled={categoryOptions.length === 0} emptyMessage="No tienes categorias de ingreso disponibles aun." onChange={(value) => updateFormState("categoryId", value)} options={categoryOptions} placeholderDescription="Puedes dejarla vacia por ahora." placeholderLabel="Sin categoria" queryPlaceholder="Buscar categoria..." value={formState.categoryId} />
                    </Field>
                    <Field hint="Cuenta donde recibes este ingreso." label="Cuenta sugerida">
                      <Picker disabled={accountOptions.length === 0} emptyMessage="No tienes cuentas disponibles aun." onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Puedes definirla mas adelante." placeholderLabel="Sin cuenta fija" queryPlaceholder="Buscar cuenta..." value={formState.accountId} />
                    </Field>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Monto</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Monto y moneda</h3>
                  <div className="mt-3 sm:mt-6 grid gap-3 sm:gap-5 sm:grid-cols-2">
                    <Field errorKey="amount" hint="Monto esperado en cada ingreso." invalidFields={invalidFields} label="Monto">
                      <Input inputMode="decimal" min="0" onChange={(event) => { clearFieldError("amount"); updateFormState("amount", event.target.value); }} placeholder="0.00" step="0.01" type="number" value={formState.amount} />
                    </Field>
                    <Field hint="Moneda principal del ingreso." label="Moneda">
                      <Picker emptyMessage="No hay monedas configuradas." onChange={(value) => updateFormState("currencyCode", value)} options={currencyPickerOptions} placeholderDescription="Selecciona la moneda principal." placeholderLabel="Selecciona una moneda" queryPlaceholder="Buscar PEN, USD, EUR..." value={formState.currencyCode} />
                    </Field>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Ritmo</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Frecuencia y calendario</h3>
                  <div className="mt-3 sm:mt-6 grid gap-3 sm:gap-5 sm:grid-cols-2">
                    <Field hint="Define cada cuanto esperas el ingreso." label="Frecuencia">
                      <Picker emptyMessage="No hay frecuencias disponibles." onChange={(value) => updateFormState("frequency", value as RecurringIncomeFrequency)} options={frequencyPickerOptions} placeholderDescription="Selecciona el ritmo principal." placeholderLabel="Selecciona una frecuencia" queryPlaceholder="Buscar frecuencia..." value={formState.frequency} />
                    </Field>
                    <Field hint="Usa 1 para la frecuencia normal, 2 para cada dos ciclos, etc." label="Intervalo">
                      <Input inputMode="numeric" min="1" onChange={(event) => updateFormState("intervalCount", event.target.value)} placeholder="1" step="1" type="number" value={formState.intervalCount} />
                    </Field>
                    <Field errorKey="startDate" hint="Fecha desde la que empieza a considerarse activo." invalidFields={invalidFields} label="Inicio">
                      <DatePickerField
                        onChange={(nextValue) => { clearFieldError("startDate"); updateFormState("startDate", nextValue); }}
                        value={formState.startDate}
                      />
                    </Field>
                    <Field errorKey="nextExpectedDate" hint="Siguiente fecha esperada de llegada." invalidFields={invalidFields} label="Proxima llegada">
                      <DatePickerField
                        onChange={(nextValue) => { clearFieldError("nextExpectedDate"); updateFormState("nextExpectedDate", nextValue); }}
                        value={formState.nextExpectedDate}
                      />
                    </Field>
                    {needsDayOfMonth ? (
                      <Field hint="Opcional. Dia del mes en el que suele llegar." label="Dia del mes">
                        <Input inputMode="numeric" max="31" min="1" onChange={(event) => updateFormState("dayOfMonth", event.target.value)} placeholder="Ej. 28" step="1" type="number" value={formState.dayOfMonth} />
                      </Field>
                    ) : null}
                    {needsDayOfWeek ? (
                      <Field hint="Opcional. Dia semanal habitual." label="Dia de la semana">
                        <Picker emptyMessage="No hay dias disponibles." onChange={(value) => updateFormState("dayOfWeek", value)} options={weekdayOptions.map((option) => ({ value: option.value, label: option.label, description: option.description, leadingLabel: option.leadingLabel, leadingColor: "#4566d6" }))} placeholderDescription="Selecciona el dia mas comun." placeholderLabel="Sin dia fijo" queryPlaceholder="Buscar dia..." value={formState.dayOfWeek} />
                      </Field>
                    ) : null}
                    <Field hint="Opcional. Si termina en una fecha puntual." label="Fin">
                      <DatePickerField
                        onChange={(nextValue) => updateFormState("endDate", nextValue)}
                        value={formState.endDate}
                      />
                    </Field>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Seguimiento</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Estado y recordatorios</h3>
                  <div className="mt-3 sm:mt-6 grid gap-3 sm:gap-5">
                    <Field hint="Controla si sigue activo, pausado o cerrado." label="Estado">
                      <Picker emptyMessage="No hay estados disponibles." onChange={(value) => updateFormState("status", value as RecurringIncomeStatus)} options={statusPickerOptions} placeholderDescription="Selecciona el estado actual." placeholderLabel="Selecciona un estado" queryPlaceholder="Buscar estado..." value={formState.status} />
                    </Field>
                    <Field hint="Cuantos dias antes quieres ver el aviso si no llega." label="Recordatorio">
                      <Input inputMode="numeric" min="0" onChange={(event) => updateFormState("remindDaysBefore", event.target.value)} placeholder="3" step="1" type="number" value={formState.remindDaysBefore} />
                    </Field>
                  </div>
                </div>

                <div className={`${panelClassName} lg:col-span-2`}>
                  <p className={labelClassName}>Contexto</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Descripcion y notas</h3>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <Field hint="Se usa como resumen dentro de la tarjeta." label="Descripcion">
                      <Textarea className="min-h-[120px]" onChange={(event) => updateFormState("description", event.target.value)} placeholder="Ej. Sueldo base mensual neto despues de impuestos." value={formState.description} />
                    </Field>
                    <Field hint="Solo para contexto interno." label="Notas">
                      <Textarea className="min-h-[120px]" onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Ej. Llega entre el 28 y el ultimo dia del mes." value={formState.notes} />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-[60] border-t border-white/10 bg-[#060b12]/95 px-4 py-4 sm:px-6 backdrop-blur-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  {isCreateMode
                    ? "El ingreso recurrente quedara listo para aparecer en tu radar de compromisos futuros."
                    : "Los cambios actualizaran el resumen y las tarjetas al instante."}
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
                        Registrar ingreso
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

function RecurringIncomeLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[200px] rounded-[32px]" />
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="shimmer-surface h-[260px] rounded-[30px]" key={i} />
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

function downloadRecurringIncomeCSV(items: RecurringIncomeSummary[], filename: string) {
  const headers = ["Nombre", "Pagador", "Estado", "Monto", "Moneda", "Frecuencia", "Categoria", "Cuenta", "Inicio", "Proxima llegada", "Fin", "Descripcion", "Notas"];
  const rows = items.map((r) => [
    escapeCSV(r.name),
    escapeCSV(r.payer),
    escapeCSV(r.status),
    escapeCSV(r.amount),
    escapeCSV(r.currencyCode),
    escapeCSV(r.frequencyLabel),
    escapeCSV(r.categoryName ?? ""),
    escapeCSV(r.accountName ?? ""),
    escapeCSV(r.startDate),
    escapeCSV(r.nextExpectedDate),
    escapeCSV(r.endDate ?? ""),
    escapeCSV(r.description ?? ""),
    escapeCSV(r.notes ?? ""),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

export function RecurringIncomePage() {
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;
  const createMutation = useCreateRecurringIncomeMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateRecurringIncomeMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteRecurringIncomeMutation(activeWorkspace?.id, user?.id);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  useSuccessToast(feedback, {
    clear: () => setFeedback(null),
  });
  const incomeColumns: ColumnDef[] = [
    { key: "pagador", label: "Pagador" },
    { key: "frecuencia", label: "Frecuencia" },
    { key: "proxima_llegada", label: "Próxima llegada" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-recurring-income", incomeColumns);
  const [viewMode, setViewMode] = useViewMode("recurring-income");
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
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedIncomeId, setSelectedIncomeId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  const [searchQuery, setSearchQuery] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formState, setFormState] = useState<RecurringIncomeFormState>(
    createDefaultFormState(activeWorkspace?.baseCurrencyCode ?? "USD"),
  );

  const recurringIncome = snapshot?.recurringIncome ?? [];
  const categories = snapshot?.catalogs.categories ?? [];
  const counterparties = snapshot?.catalogs.counterparties ?? [];
  const accounts = snapshot?.accounts ?? [];
  const baseCurrencyCode = snapshot?.workspace.baseCurrencyCode ?? activeWorkspace?.baseCurrencyCode ?? "USD";
  const selectedIncome =
    selectedIncomeId === null
      ? null
      : recurringIncome.find((r) => r.id === selectedIncomeId) ?? null;
  const deleteTarget =
    deleteTargetId === null
      ? null
      : recurringIncome.find((r) => r.id === deleteTargetId) ?? null;

  const hasActiveFilters = searchQuery.trim() !== "" || frequencyFilter !== "all" || statusFilter !== "all";
  const filteredIncome = useMemo(() => {
    let result = recurringIncome.filter((r) => !hiddenIds.has(r.id));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          (r.payer ?? "").toLowerCase().includes(q) ||
          (r.categoryName ?? "").toLowerCase().includes(q),
      );
    }
    if (frequencyFilter !== "all") {
      result = result.filter((r) => r.frequency === frequencyFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    return result;
  }, [recurringIncome, hiddenIds, searchQuery, frequencyFilter, statusFilter]);
  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredIncome);

  useEffect(() => {
    if (!isEditorOpen) {
      setFormState(createDefaultFormState(baseCurrencyCode));
    }
  }, [baseCurrencyCode, isEditorOpen]);

  function updateFormState<Field extends keyof RecurringIncomeFormState>(
    field: Field,
    value: RecurringIncomeFormState[Field],
  ) {
    setIsDirty(true);
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function closeEditor() {
    if (isSavingEditor) return;
    setIsEditorOpen(false);
    setSelectedIncomeId(null);
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isSavingEditor) return;
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }

  function openCreateEditor() {
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("create");
    setSelectedIncomeId(null);
    setFormState(createDefaultFormState(baseCurrencyCode));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(income: RecurringIncomeSummary) {
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("edit");
    setSelectedIncomeId(income.id);
    setFormState(buildFormStateFromRecurringIncome(income));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  const isSavingEditor = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const dueSoonCount = recurringIncome.filter((r) => {
    const differenceInMs =
      new Date(r.nextExpectedDate).getTime() - new Date().setHours(0, 0, 0, 0);
    const differenceInDays = differenceInMs / 86_400_000;
    return differenceInDays >= 0 && differenceInDays <= 7;
  }).length;
  const nextIncome = recurringIncome[0] ?? null;
  const allAmountsConvertible =
    recurringIncome.length > 0 &&
    recurringIncome.every(
      (r) => r.amountInBaseCurrency !== null && r.amountInBaseCurrency !== undefined,
    );
  const currencySet = new Set(recurringIncome.map((r) => r.currencyCode));
  const sharedCurrency = currencySet.size === 1 ? recurringIncome[0]?.currencyCode ?? baseCurrencyCode : null;
  const totalAmountDisplay =
    sharedCurrency !== null
      ? formatCurrency(
          recurringIncome.reduce((total, r) => total + r.amount, 0),
          sharedCurrency,
        )
      : allAmountsConvertible
        ? formatCurrency(
            recurringIncome.reduce(
              (total, r) => total + (r.amountInBaseCurrency ?? 0),
              0,
            ),
            baseCurrencyCode,
          )
        : "Multimoneda";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeWorkspace || !user?.id) {
      setFeedback({
        tone: "error",
        title: "No encontramos el workspace activo",
        description: "Recarga la pagina e intenta nuevamente.",
      });
      return;
    }

    const name = formState.name.trim();
    const payerPartyId = parseOptionalInteger(formState.payerPartyId);
    const accountId = parseOptionalInteger(formState.accountId);
    const categoryId = parseOptionalInteger(formState.categoryId);
    const amount = parseOptionalNumber(formState.amount);
    const intervalCount = parseOptionalInteger(formState.intervalCount);
    const dayOfMonth = parseOptionalInteger(formState.dayOfMonth);
    const dayOfWeek = parseOptionalInteger(formState.dayOfWeek);
    const remindDaysBefore = parseOptionalInteger(formState.remindDaysBefore);

    const subErrors: string[] = [];
    if (!name) subErrors.push("name");
    if (amount === null || Number.isNaN(amount) || amount <= 0) subErrors.push("amount");
    if (!formState.startDate) subErrors.push("startDate");
    if (!formState.nextExpectedDate) subErrors.push("nextExpectedDate");
    if (subErrors.length > 0) {
      setInvalidFields(new Set(subErrors));
      setFeedback({
        tone: "error",
        title: "Revisa los campos requeridos",
        description: "Completa los campos marcados en rojo antes de guardar.",
      });
      return;
    }

    if (intervalCount === null || Number.isNaN(intervalCount) || intervalCount <= 0) {
      setFeedback({
        tone: "error",
        title: "Intervalo invalido",
        description: "Indica un intervalo mayor que cero.",
      });
      return;
    }

    if (formState.nextExpectedDate < formState.startDate) {
      setFeedback({
        tone: "error",
        title: "La fecha no cuadra",
        description: "La proxima llegada no puede ser anterior al inicio.",
      });
      return;
    }

    if (formState.endDate && formState.endDate < formState.startDate) {
      setFeedback({
        tone: "error",
        title: "La fecha final no cuadra",
        description: "La fecha final no puede ser anterior al inicio.",
      });
      return;
    }

    if (dayOfMonth !== null && (Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) {
      setFeedback({
        tone: "error",
        title: "Dia del mes invalido",
        description: "Si lo completas, debe estar entre 1 y 31.",
      });
      return;
    }

    if (dayOfWeek !== null && (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
      setFeedback({
        tone: "error",
        title: "Dia de la semana invalido",
        description: "Si lo completas, debe estar entre 0 y 6.",
      });
      return;
    }

    if (remindDaysBefore === null || Number.isNaN(remindDaysBefore) || remindDaysBefore < 0) {
      setFeedback({
        tone: "error",
        title: "Recordatorio invalido",
        description: "Indica cero o un numero positivo de dias.",
      });
      return;
    }

    if (payerPartyId !== null && Number.isNaN(payerPartyId)) {
      setFeedback({
        tone: "error",
        title: "Pagador invalido",
        description: "Vuelve a seleccionar el pagador si deseas asociarlo.",
      });
      return;
    }

    if (accountId !== null && Number.isNaN(accountId)) {
      setFeedback({
        tone: "error",
        title: "Cuenta invalida",
        description: "Vuelve a seleccionar la cuenta sugerida.",
      });
      return;
    }

    if (categoryId !== null && Number.isNaN(categoryId)) {
      setFeedback({
        tone: "error",
        title: "Categoria invalida",
        description: "Vuelve a seleccionar la categoria contable.",
      });
      return;
    }

    const payload: RecurringIncomeFormInput = {
      name,
      payerPartyId: payerPartyId === null ? null : payerPartyId,
      accountId: accountId === null ? null : accountId,
      categoryId: categoryId === null ? null : categoryId,
      currencyCode: formState.currencyCode.trim().toUpperCase() || baseCurrencyCode,
      amount: amount!,
      frequency: formState.frequency,
      intervalCount: intervalCount!,
      dayOfMonth: dayOfMonth === null ? null : dayOfMonth,
      dayOfWeek: dayOfWeek === null ? null : dayOfWeek,
      startDate: formState.startDate,
      nextExpectedDate: formState.nextExpectedDate,
      endDate: formState.endDate || null,
      status: formState.status,
      remindDaysBefore: remindDaysBefore!,
      description: formState.description,
      notes: formState.notes,
    };

    try {
      if (editorMode === "create") {
        await createMutation.mutateAsync({
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        });
        setFeedback({
          tone: "success",
          title: "Ingreso recurrente registrado",
          description: "Ya aparece en tu radar de compromisos futuros y en la lista principal.",
        });
      } else if (selectedIncome) {
        await updateMutation.mutateAsync({
          recurringIncomeId: selectedIncome.id,
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        });
        setFeedback({
          tone: "success",
          title: "Cambios guardados",
          description: "El ingreso recurrente se actualizo correctamente.",
        });
      }

      setIsEditorOpen(false);
      setSelectedIncomeId(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No pudimos guardar el ingreso recurrente",
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
      label: "Ingreso recurrente eliminado",
      onCommit: () =>
        deleteMutation.mutateAsync({ recurringIncomeId: targetId, workspaceId: activeWorkspace.id }),
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
        await deleteMutation.mutateAsync({ recurringIncomeId: id, workspaceId: activeWorkspace!.id });
      }
      clearAll();
    } catch (err) {
      setFeedback({ tone: "error", title: "Error", description: getQueryErrorMessage(err) });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos preparando los ingresos recurrentes del workspace activo." eyebrow="ingresos recurrentes" title="Cargando ingresos recurrentes" />
        <RecurringIncomeLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Necesitamos acceder correctamente al workspace activo." eyebrow="ingresos recurrentes" title="Ingresos recurrentes no disponibles" />
        <DataState description={getQueryErrorMessage(workspaceError, "No pudimos abrir tu workspace actual.")} title="No hay acceso al workspace" tone="error" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Cuando tengas un workspace activo, aqui veras tus ingresos fijos." eyebrow="ingresos recurrentes" title="Aun no hay un workspace activo" />
        <DataState description="Activa o crea un workspace para comenzar a registrar ingresos recurrentes." title="Sin ingresos recurrentes para mostrar" />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos cargando tus ingresos recurrentes y sus proximas llegadas." eyebrow="ingresos recurrentes" title="Cargando ingresos recurrentes" />
        <RecurringIncomeLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Intentamos reconstruir el estado actual de tus ingresos recurrentes." eyebrow="ingresos recurrentes" title="No fue posible cargar la informacion" />
        <DataState description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer tus ingresos recurrentes actuales.")} title="Error al cargar ingresos recurrentes" tone="error" />
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
              <ColumnPicker columns={incomeColumns} visible={colVis} onToggle={toggleCol} />
            ) : null}
            <Button
              onClick={() =>
                downloadRecurringIncomeCSV(
                  filteredIncome,
                  `ingresos-recurrentes-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              variant="ghost"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo ingreso
            </Button>
          </>
        }
        description="Registra tus ingresos fijos como sueldos o alquileres cobrados, con monto, frecuencia, cuenta sugerida y recordatorios."
        eyebrow="ingresos recurrentes"
        title="Ingresos recurrentes"
      />

      {feedback && feedback.tone !== "error" && !isEditorOpen ? <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

      <SurfaceCard action={<CalendarClock className="h-5 w-5 text-pine" />} description="Resumen general de tus ingresos recurrentes configurados." title="Radar de ingresos fijos">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Registrados</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{recurringIncome.length}</p><p className="mt-2 text-sm text-storm">Ingresos recurrentes configurados en este workspace.</p></div>
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Llegan pronto</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{dueSoonCount}</p><p className="mt-2 text-sm text-storm">Con fecha dentro de los proximos 7 dias.</p></div>
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Activos</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{recurringIncome.filter((r) => r.status === "active").length}</p><p className="mt-2 text-sm text-storm">En estado activo actualmente.</p></div>
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Monto esperado</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{totalAmountDisplay}</p><p className="mt-2 text-sm text-storm">{sharedCurrency !== null ? `Total acumulado en ${sharedCurrency}.` : allAmountsConvertible ? `Convertido a ${baseCurrencyCode}.` : "Tienes importes en varias monedas."}</p></div>
        </div>
      </SurfaceCard>

      {recurringIncome.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
            disabled={snapshotQuery.isFetching}
            onClick={() => snapshotQuery.refetch()}
            title="Actualizar"
            type="button"
          >
            <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
          </button>
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <input
              className="w-full rounded-[18px] border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, pagador o categoria..."
              type="text"
              value={searchQuery}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {(["all", "active", "paused", "cancelled"] as const).map((s) => (
              <button
                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${statusFilter === s ? "border-pine/30 bg-pine/15 text-pine" : "border-white/10 bg-white/[0.04] text-storm hover:border-white/16 hover:text-ink"}`}
                key={s}
                onClick={() => setStatusFilter(s)}
                type="button"
              >
                {s === "all" ? "Todos" : s === "active" ? "Activo" : s === "paused" ? "Pausado" : "Cancelado"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {([{v:"all",l:"Frec."},{v:"daily",l:"Diaria"},{v:"weekly",l:"Semanal"},{v:"monthly",l:"Mensual"},{v:"quarterly",l:"Trimestral"},{v:"yearly",l:"Anual"},{v:"custom",l:"Custom"}] as const).map(({v, l}) => (
              <button
                className={`rounded-full border px-3 py-2 text-xs font-medium transition ${frequencyFilter === v ? "border-[#4566d6]/30 bg-[#4566d6]/15 text-[#8a9fff]" : "border-white/10 bg-white/[0.04] text-storm hover:border-white/16 hover:text-ink"}`}
                key={v}
                onClick={() => setFrequencyFilter(v)}
                type="button"
              >
                {l}
              </button>
            ))}
          </div>
          {hasActiveFilters ? (
            <button
              className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-storm transition hover:border-white/16 hover:text-ink"
              onClick={() => { setSearchQuery(""); setFrequencyFilter("all"); setStatusFilter("all"); }}
              type="button"
            >
              <X className="inline-block mr-1 h-3 w-3" />
              Limpiar
            </button>
          ) : null}
        </div>
      ) : null}

      {viewMode === "list" ? (
        <div className="space-y-3">
          {recurringIncome.length === 0 ? (
            <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Registrar primer ingreso</Button>} description="Todavia no hay ingresos recurrentes registrados para este workspace." title="Sin ingresos recurrentes" />
          ) : filteredIncome.length === 0 ? (
            <DataState description="Prueba cambiando los filtros o el texto de busqueda." title="Sin resultados" />
          ) : filteredIncome.map((income) => {
            const statusOption = getStatusOption(income.status);
            return (
              <article className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16" key={income.id}>
                <SelectionCheckbox
                  checked={selectedIds.has(income.id)}
                  onChange={() => toggleSelect(income.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{income.name}</p>
                  <p className="text-xs text-storm">{income.payer}{income.categoryName ? ` · ${income.categoryName}` : ""} · {income.frequencyLabel}</p>
                </div>
                <div className="hidden sm:flex flex-col text-right shrink-0">
                  <p className="text-sm font-semibold text-ink">{formatCurrency(income.amount, income.currencyCode)}</p>
                  <p className="text-xs text-storm">{formatDate(income.nextExpectedDate)}</p>
                </div>
                <StatusBadge status={statusOption.label} tone={getStatusTone(income.status)} />
                <Button className="py-1.5 text-xs shrink-0" onClick={() => openEditEditor(income)} variant="ghost">Editar</Button>
              </article>
            );
          })}
        </div>
      ) : viewMode === "table" ? (
        <div className="overflow-x-auto rounded-[24px] border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="w-10 px-4 py-3.5">
                  <SelectionCheckbox
                    ariaLabel="Seleccionar todos"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={() => (allSelected ? clearAll() : selectAll())}
                  />
                </th>
                <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Nombre</th>
                <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("pagador", "hidden sm:table-cell")}`}>Pagador</th>
                <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("frecuencia", "hidden md:table-cell")}`}>Frecuencia</th>
                <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Monto</th>
                <th className={`px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("proxima_llegada", "hidden md:table-cell")}`}>Próxima llegada</th>
                <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Estado</th>
                <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {recurringIncome.length === 0 ? (
                <tr><td className="px-5 py-6 text-sm text-storm" colSpan={8}><DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Registrar primer ingreso</Button>} description="Todavia no hay ingresos recurrentes registrados para este workspace." title="Sin ingresos recurrentes" /></td></tr>
              ) : filteredIncome.length === 0 ? (
                <tr><td className="px-5 py-6 text-sm text-storm" colSpan={8}><DataState description="Prueba cambiando los filtros o el texto de busqueda." title="Sin resultados" /></td></tr>
              ) : filteredIncome.map((income, index) => {
                const statusOption = getStatusOption(income.status);
                return (
                  <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === filteredIncome.length - 1 ? "border-b-0" : ""}`} key={income.id}>
                    <td className="w-10 px-4 py-4">
                      <SelectionCheckbox
                        ariaLabel={`Seleccionar ${income.name}`}
                        checked={selectedIds.has(income.id)}
                        onChange={() => toggleSelect(income.id)}
                      />
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink">{income.name}</td>
                    <td className={`px-5 py-3.5 text-storm ${cv("pagador", "hidden sm:table-cell")}`}>{income.payer}</td>
                    <td className={`px-5 py-3.5 text-storm ${cv("frecuencia", "hidden md:table-cell")}`}>{income.frequencyLabel}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-ink">{formatCurrency(income.amount, income.currencyCode)}</td>
                    <td className={`px-5 py-3.5 text-right text-storm ${cv("proxima_llegada", "hidden md:table-cell")}`}>{formatDate(income.nextExpectedDate)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={statusOption.label} tone={getStatusTone(income.status)} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button className="py-1.5 text-xs" onClick={() => openEditEditor(income)} variant="ghost">Editar</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard action={<StatusBadge status={`${filteredIncome.length} de ${recurringIncome.length} registrados`} tone="success" />} description="Cada tarjeta representa un ingreso recurrente real con sus datos principales y sus acciones." title="Ingresos recurrentes">
          {recurringIncome.length === 0 ? (
            <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Registrar primer ingreso</Button>} description="Todavia no hay ingresos recurrentes registrados para este workspace." title="Sin ingresos recurrentes" />
          ) : filteredIncome.length === 0 ? (
            <DataState description="Prueba cambiando los filtros o el texto de busqueda." title="Sin resultados" />
          ) : (
            <div className="space-y-4">
              {filteredIncome.map((income) => {
                const statusOption = getStatusOption(income.status);
                const isSelected = selectedIds.has(income.id);
                const longPressHandlers = createLongPressHandlers(() => toggleSelect(income.id));
                return (
                  <article
                    className={`relative glass-panel-soft rounded-[30px] p-5 transition duration-200 hover:border-white/16 ${isSelected ? "ring-2 ring-pine/30 border-pine/25" : ""}`}
                    key={income.id}
                    onClick={(e) => {
                      if (wasRecentLongPress()) return;
                      if (selectedCount === 0) return;
                      if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
                      toggleSelect(income.id);
                    }}
                    {...longPressHandlers}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">{income.frequencyLabel}</span>
                          <StatusBadge status={statusOption.label} tone={getStatusTone(income.status)} />
                        </div>
                        <p className="mt-4 font-display text-2xl font-semibold text-ink">{income.name}</p>
                        <p className="mt-2 text-sm text-storm">{income.payer}{income.accountName ? ` - ${income.accountName}` : ""}{income.categoryName ? ` - ${income.categoryName}` : ""}</p>
                        {income.description ? <p className="mt-3 text-sm leading-7 text-storm">{income.description}</p> : null}
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-black/15 px-4 py-4 text-right">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Monto</p>
                        <p className="mt-2 font-display text-2xl font-semibold text-ink">{formatCurrency(income.amount, income.currencyCode)}</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-xs uppercase tracking-[0.18em] text-storm">Proxima llegada</p><p className="mt-2 text-sm font-medium text-ink">{formatDate(income.nextExpectedDate)}</p></div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-xs uppercase tracking-[0.18em] text-storm">Recordatorio</p><p className="mt-2 text-sm font-medium text-ink">{income.remindDaysBefore} dias antes</p></div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                      <Button onClick={() => openEditEditor(income)} variant="secondary"><PencilLine className="mr-2 h-4 w-4" />Editar</Button>
                      <Button className="text-[#ffb4bc] hover:text-white" onClick={() => setDeleteTargetId(income.id)} variant="ghost"><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard action={<Sparkles className="h-5 w-5 text-pine" />} description="Orden cronologico con lo que llega mas pronto y una lectura rapida de la configuracion." title="Proximas llegadas">
          {recurringIncome.length === 0 ? (
            <DataState description="Cuando registres un ingreso recurrente, aqui veras el siguiente en orden cronologico." title="Sin calendario todavia" />
          ) : (
            <>
              <div className="space-y-3">
                {recurringIncome.map((income) => (
                  <div className="glass-panel-soft flex items-center justify-between gap-3 rounded-[26px] p-4" key={income.id}>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{income.name}</p>
                      <p className="mt-1 text-sm text-storm">{formatDate(income.nextExpectedDate)} - {income.frequencyLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-ink">{formatCurrency(income.amount, income.currencyCode)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-storm">{getStatusOption(income.status).label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[26px] border border-pine/15 bg-pine/10 p-5">
                <p className="font-medium text-ink">Resumen rapido</p>
                <p className="mt-2 text-sm leading-7 text-storm">
                  {dueSoonCount} llegan en los proximos 7 dias y el siguiente ingreso es{" "}
                  {nextIncome ? `${nextIncome.name} el ${formatDate(nextIncome.nextExpectedDate)}` : "sin fecha registrada"}.
                </p>
              </div>
            </>
          )}
        </SurfaceCard>
      </section>
      )}

      {isEditorOpen ? (
        <EditorDialog
          accounts={accounts}
          baseCurrencyCode={baseCurrencyCode}
          categories={categories}
          clearFieldError={clearFieldError}
          closeEditor={requestCloseEditor}
          counterparties={counterparties}
          feedback={feedback}
          formState={formState}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSavingEditor}
          onSubmit={handleSubmit}
          updateFormState={updateFormState}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          badge="Eliminar ingreso recurrente"
          description="Esto elimina el ingreso recurrente permanentemente. No se puede deshacer."
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
          <div>
            <p className="truncate text-lg font-semibold text-ink">{deleteTarget.name}</p>
            <p className="mt-1 text-sm text-storm">{deleteTarget.payer}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                {formatCurrency(deleteTarget.amount, deleteTarget.currencyCode)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-storm">
                {deleteTarget.frequencyLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-storm">
                {formatDate(deleteTarget.nextExpectedDate)}
              </span>
            </div>
          </div>
        </DeleteConfirmDialog>
      ) : null}

      <BulkActionBar
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadRecurringIncomeCSV(selectedItems, `ingresos-recurrentes-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredIncome.length}
      />
      {showBulkDeleteConfirm ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ri-bulk-title">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d1520] p-6">
            <h2 id="ri-bulk-title" className="font-display text-xl font-semibold text-ink">
              Eliminar {selectedCount} ingreso{selectedCount !== 1 ? "s" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Esta accion eliminara permanentemente los ingresos recurrentes seleccionados. No se puede deshacer.
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
