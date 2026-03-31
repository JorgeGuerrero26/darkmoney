import {
  BarChart3,
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
  X,
} from "lucide-react";
import type {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";

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
  SubscriptionFrequency,
  SubscriptionStatus,
  SubscriptionSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { SubscriptionAnalyticsModal } from "../components/subscription-analytics-modal";
import {
  getQueryErrorMessage,
  type SubscriptionFormInput,
  useCreateSubscriptionMutation,
  useDeleteSubscriptionMutation,
  useUpdateSubscriptionMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

type EditorMode = "create" | "edit";

type SubscriptionFormState = {
  name: string;
  vendorPartyId: string;
  accountId: string;
  categoryId: string;
  currencyCode: string;
  amount: string;
  frequency: SubscriptionFrequency;
  intervalCount: string;
  dayOfMonth: string;
  dayOfWeek: string;
  startDate: string;
  nextDueDate: string;
  endDate: string;
  status: SubscriptionStatus;
  autoCreateMovement: boolean;
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
  { value: "active" as const, label: "Activa", description: "Sigue generando recordatorios y vencimientos.", leadingLabel: "AC", leadingColor: "#1b6a58" },
  { value: "paused" as const, label: "Pausada", description: "Se conserva, pero temporalmente detenida.", leadingLabel: "PA", leadingColor: "#b48b34" },
  { value: "cancelled" as const, label: "Cancelada", description: "Ya no forma parte de tu control activo.", leadingLabel: "CA", leadingColor: "#8f3e3e" },
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
  { value: "1", label: "Lunes", description: "Buen dia para cargos fijos.", leadingLabel: "LU" },
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

function getFrequencyOption(frequency: SubscriptionFrequency) {
  return frequencyOptions.find((option) => option.value === frequency) ?? frequencyOptions[0];
}

function getStatusOption(status: SubscriptionStatus) {
  return statusOptions.find((option) => option.value === status) ?? statusOptions[0];
}

function getStatusTone(status: SubscriptionStatus) {
  switch (status) {
    case "active":
      return "success" as const;
    case "paused":
      return "warning" as const;
    default:
      return "danger" as const;
  }
}

function createDefaultFormState(baseCurrencyCode: string): SubscriptionFormState {
  return {
    name: "",
    vendorPartyId: "",
    accountId: "",
    categoryId: "",
    currencyCode: baseCurrencyCode,
    amount: "",
    frequency: "monthly",
    intervalCount: "1",
    dayOfMonth: "",
    dayOfWeek: "",
    startDate: toDateInputValue(new Date().toISOString()),
    nextDueDate: toDateInputValue(new Date().toISOString()),
    endDate: "",
    status: "active",
    autoCreateMovement: false,
    remindDaysBefore: "3",
    description: "",
    notes: "",
  };
}

function buildFormStateFromSubscription(subscription: SubscriptionSummary): SubscriptionFormState {
  return {
    name: subscription.name,
    vendorPartyId: subscription.vendorPartyId ? String(subscription.vendorPartyId) : "",
    accountId: subscription.accountId ? String(subscription.accountId) : "",
    categoryId: subscription.categoryId ? String(subscription.categoryId) : "",
    currencyCode: subscription.currencyCode,
    amount: String(subscription.amount),
    frequency: subscription.frequency,
    intervalCount: String(subscription.intervalCount),
    dayOfMonth:
      subscription.dayOfMonth === null || subscription.dayOfMonth === undefined
        ? ""
        : String(subscription.dayOfMonth),
    dayOfWeek:
      subscription.dayOfWeek === null || subscription.dayOfWeek === undefined
        ? ""
        : String(subscription.dayOfWeek),
    startDate: toDateInputValue(subscription.startDate),
    nextDueDate: toDateInputValue(subscription.nextDueDate),
    endDate: subscription.endDate ? toDateInputValue(subscription.endDate) : "",
    status: subscription.status,
    autoCreateMovement: subscription.autoCreateMovement,
    remindDaysBefore: String(subscription.remindDaysBefore),
    description: subscription.description ?? "",
    notes: subscription.notes ?? "",
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
      <span className={`relative inline-flex h-8 w-16 shrink-0 rounded-full border transition duration-200 ${checked ? "border-pine/30 bg-pine/20" : "border-white/10 bg-white/[0.05]"}`}>
        <span className={`absolute top-1 h-6 w-6 rounded-full bg-white transition duration-200 ${checked ? "left-9" : "left-1"}`} />
      </span>
    </button>
  );
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
  formState: SubscriptionFormState;
  invalidFields: Set<string>;
  isCreateMode: boolean;
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateFormState: <Field extends keyof SubscriptionFormState>(
    field: Field,
    value: SubscriptionFormState[Field],
  ) => void;
}) {
  const title = formState.name.trim() || "Nueva suscripcion";

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
  const selectedVendor = counterparties.find(
    (counterparty) => String(counterparty.id) === formState.vendorPartyId,
  );
  const selectedAccount = accounts.find((account) => String(account.id) === formState.accountId);
  const frequencyOption = getFrequencyOption(formState.frequency);
  const statusOption = getStatusOption(formState.status);
  const currencyLabel = getCurrencyLabel(formState.currencyCode || baseCurrencyCode);
  const counterpartyOptions = counterparties
    .filter((counterparty) => !counterparty.isArchived || String(counterparty.id) === formState.vendorPartyId)
    .map<PickerOption>((counterparty) => ({
      value: String(counterparty.id),
      label: counterparty.name,
      description: counterparty.isArchived
        ? "Archivada, pero disponible para esta suscripcion."
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
    .filter((category) => (category.isActive || String(category.id) === formState.categoryId) && (category.kind === "expense" || category.kind === "both"))
    .map<PickerOption>((category) => ({
      value: String(category.id),
      label: category.name,
      description:
        category.kind === "both"
          ? "Disponible para varios tipos de movimientos."
          : "Categoria pensada para gastos recurrentes.",
      leadingLabel: category.name.slice(0, 2).toUpperCase(),
      leadingColor: category.kind === "both" ? "#4566d6" : "#8f3e3e",
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
                      {isCreateMode ? "Nueva suscripcion" : "Editar suscripcion"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      {isCreateMode ? "Quedara lista para seguirla" : "Ajusta monto, ritmo y recordatorios"}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.7rem]">
                    {isCreateMode ? "Crear suscripcion" : "Actualizar suscripcion"}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-9 text-storm">
                    Configura el monto, la frecuencia, los recordatorios y la cuenta sugerida para
                    tener tus pagos recurrentes bajo control.
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
                      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,#4566d6,rgba(8,13,20,0.72))] text-white">
                        <Sparkles className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Vista previa</p>
                        <h3 className="mt-2 break-words font-display text-4xl font-semibold text-ink">{title}</h3>
                        <p className="mt-3 text-base leading-8 text-storm">
                          {selectedVendor?.name ?? "Selecciona un proveedor o servicio"}
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
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Monto configurado</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(amount, currencyLabel.code)}
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Siguiente cobro</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formState.nextDueDate ? formatDate(formState.nextDueDate) : "Sin fecha"}
                      </p>
                      <p className="mt-2 text-sm text-storm">{selectedAccount?.name ?? "Sin cuenta sugerida"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 sm:mt-7 grid gap-3 sm:gap-5 lg:grid-cols-2">
                <div className={panelClassName}>
                  <p className={labelClassName}>Identidad</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Base de la suscripcion</h3>
                  <div className="mt-3 sm:mt-6 grid gap-3 sm:gap-5 sm:grid-cols-2">
                    <Field errorKey="name" hint="Nombre visible para reconocerla en la app." invalidFields={invalidFields} label="Nombre">
                      <Input maxLength={120} onChange={(event) => { clearFieldError("name"); updateFormState("name", event.target.value); }} placeholder="Ej. Netflix familiar" type="text" value={formState.name} />
                    </Field>
                    <Field hint="Proveedor o servicio relacionado." label="Proveedor">
                      <Picker disabled={counterpartyOptions.length === 0} emptyMessage="No tienes contrapartes disponibles aun." onChange={(value) => updateFormState("vendorPartyId", value)} options={counterpartyOptions} placeholderDescription="Puedes dejarlo libre si aun no lo registras." placeholderLabel="Sin proveedor fijo" queryPlaceholder="Buscar proveedor..." value={formState.vendorPartyId} />
                    </Field>
                    <Field hint="Categoria contable sugerida." label="Categoria">
                      <Picker disabled={categoryOptions.length === 0} emptyMessage="No tienes categorias disponibles aun." onChange={(value) => updateFormState("categoryId", value)} options={categoryOptions} placeholderDescription="Puedes dejarla vacia por ahora." placeholderLabel="Sin categoria" queryPlaceholder="Buscar categoria..." value={formState.categoryId} />
                    </Field>
                    <Field hint="Cuenta recomendada para registrar el pago." label="Cuenta sugerida">
                      <Picker disabled={accountOptions.length === 0} emptyMessage="No tienes cuentas disponibles aun." onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Puedes definirla mas adelante." placeholderLabel="Sin cuenta fija" queryPlaceholder="Buscar cuenta..." value={formState.accountId} />
                    </Field>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Monto</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Monto y moneda</h3>
                  <div className="mt-3 sm:mt-6 grid gap-3 sm:gap-5 sm:grid-cols-2">
                    <Field errorKey="amount" hint="Monto esperado en cada cobro." invalidFields={invalidFields} label="Monto">
                      <Input inputMode="decimal" min="0" onChange={(event) => { clearFieldError("amount"); updateFormState("amount", event.target.value); }} placeholder="0.00" step="0.01" type="number" value={formState.amount} />
                    </Field>
                    <Field hint="Moneda principal de la suscripcion." label="Moneda">
                      <Picker emptyMessage="No hay monedas configuradas." onChange={(value) => updateFormState("currencyCode", value)} options={currencyPickerOptions} placeholderDescription="Selecciona la moneda principal." placeholderLabel="Selecciona una moneda" queryPlaceholder="Buscar PEN, USD, EUR..." value={formState.currencyCode} />
                    </Field>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Ritmo</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Frecuencia y calendario</h3>
                  <div className="mt-3 sm:mt-6 grid gap-3 sm:gap-5 sm:grid-cols-2">
                    <Field hint="Define cada cuanto esperas el cobro." label="Frecuencia">
                      <Picker emptyMessage="No hay frecuencias disponibles." onChange={(value) => updateFormState("frequency", value as SubscriptionFrequency)} options={frequencyPickerOptions} placeholderDescription="Selecciona el ritmo principal." placeholderLabel="Selecciona una frecuencia" queryPlaceholder="Buscar frecuencia..." value={formState.frequency} />
                    </Field>
                    <Field hint="Usa 1 para la frecuencia normal, 2 para cada dos ciclos, etc." label="Intervalo">
                      <Input inputMode="numeric" min="1" onChange={(event) => updateFormState("intervalCount", event.target.value)} placeholder="1" step="1" type="number" value={formState.intervalCount} />
                    </Field>
                    <Field errorKey="startDate" hint="Fecha desde la que empieza a considerarse activa." invalidFields={invalidFields} label="Inicio">
                      <DatePickerField
                        onChange={(nextValue) => { clearFieldError("startDate"); updateFormState("startDate", nextValue); }}
                        value={formState.startDate}
                      />
                    </Field>
                    <Field errorKey="nextDueDate" hint="Siguiente fecha esperada de cobro." invalidFields={invalidFields} label="Proximo cobro">
                      <DatePickerField
                        onChange={(nextValue) => { clearFieldError("nextDueDate"); updateFormState("nextDueDate", nextValue); }}
                        value={formState.nextDueDate}
                      />
                    </Field>
                    {needsDayOfMonth ? (
                      <Field hint="Opcional. Dia del mes en el que suele cobrar." label="Dia del mes">
                        <Input inputMode="numeric" max="31" min="1" onChange={(event) => updateFormState("dayOfMonth", event.target.value)} placeholder="Ej. 15" step="1" type="number" value={formState.dayOfMonth} />
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
                    <Field hint="Controla si sigue activa, pausada o cerrada." label="Estado">
                      <Picker emptyMessage="No hay estados disponibles." onChange={(value) => updateFormState("status", value as SubscriptionStatus)} options={statusPickerOptions} placeholderDescription="Selecciona el estado actual." placeholderLabel="Selecciona un estado" queryPlaceholder="Buscar estado..." value={formState.status} />
                    </Field>
                    <Field hint="Cuantos dias antes quieres ver el aviso." label="Recordatorio">
                      <Input inputMode="numeric" min="0" onChange={(event) => updateFormState("remindDaysBefore", event.target.value)} placeholder="3" step="1" type="number" value={formState.remindDaysBefore} />
                    </Field>
                    <ToggleRow checked={formState.autoCreateMovement} description="Cuando este activo, el sistema podra apoyarse en esta configuracion para automatizar el movimiento correspondiente." label="Crear movimiento automaticamente" onChange={(checked) => updateFormState("autoCreateMovement", checked)} />
                  </div>
                </div>

                <div className={`${panelClassName} lg:col-span-2`}>
                  <p className={labelClassName}>Contexto</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Descripcion y notas</h3>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <Field hint="Se usa como resumen dentro de la tarjeta." label="Descripcion">
                      <Textarea className="min-h-[120px]" onChange={(event) => updateFormState("description", event.target.value)} placeholder="Ej. Plan familiar de streaming compartido en casa." value={formState.description} />
                    </Field>
                    <Field hint="Solo para contexto interno." label="Notas">
                      <Textarea className="min-h-[120px]" onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Ej. Se cobra desde la tarjeta de viajes." value={formState.notes} />
                    </Field>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-[60] border-t border-white/10 bg-[#060b12]/95 px-4 py-4 sm:px-6 backdrop-blur-md">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  {isCreateMode
                    ? "La suscripcion quedara lista para aparecer en tu radar de vencimientos."
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
                        Crear suscripcion
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

function SubscriptionsLoadingSkeleton() {
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

function downloadSubscriptionsCSV(subscriptions: SubscriptionSummary[], filename: string) {
  const headers = ["Nombre", "Proveedor", "Estado", "Monto", "Moneda", "Frecuencia", "Categoria", "Cuenta", "Inicio", "Proximo vencimiento", "Fin", "Auto movimiento", "Descripcion", "Notas"];
  const rows = subscriptions.map((s) => [
    escapeCSV(s.name),
    escapeCSV(s.vendor),
    escapeCSV(s.status),
    escapeCSV(s.amount),
    escapeCSV(s.currencyCode),
    escapeCSV(s.frequencyLabel),
    escapeCSV(s.categoryName ?? ""),
    escapeCSV(s.accountName ?? ""),
    escapeCSV(s.startDate),
    escapeCSV(s.nextDueDate),
    escapeCSV(s.endDate ?? ""),
    escapeCSV(s.autoCreateMovement ? "Si" : "No"),
    escapeCSV(s.description ?? ""),
    escapeCSV(s.notes ?? ""),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

export function SubscriptionsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;
  const createMutation = useCreateSubscriptionMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateSubscriptionMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteSubscriptionMutation(activeWorkspace?.id, user?.id);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  useSuccessToast(feedback, {
    clear: () => setFeedback(null),
  });
  const subscriptionColumns: ColumnDef[] = [
    { key: "proveedor", label: "Proveedor" },
    { key: "frecuencia", label: "Frecuencia" },
    { key: "proximo_cobro", label: "Próximo cobro" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-subscriptions", subscriptionColumns);
  const [viewMode, setViewMode] = useViewMode("subscriptions");
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
  const [selectedSubscriptionId, setSelectedSubscriptionId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [analyticsSubscriptionId, setAnalyticsSubscriptionId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  const [searchQuery, setSearchQuery] = useState("");
  const [frequencyFilter, setFrequencyFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formState, setFormState] = useState<SubscriptionFormState>(
    createDefaultFormState(activeWorkspace?.baseCurrencyCode ?? "USD"),
  );

  const subscriptions = snapshot?.subscriptions ?? [];
  const categories = snapshot?.catalogs.categories ?? [];
  const counterparties = snapshot?.catalogs.counterparties ?? [];
  const accounts = snapshot?.accounts ?? [];
  const baseCurrencyCode = snapshot?.workspace.baseCurrencyCode ?? activeWorkspace?.baseCurrencyCode ?? "USD";
  const selectedSubscription =
    selectedSubscriptionId === null
      ? null
      : subscriptions.find((subscription) => subscription.id === selectedSubscriptionId) ?? null;
  const deleteTarget =
    deleteTargetId === null
      ? null
      : subscriptions.find((subscription) => subscription.id === deleteTargetId) ?? null;

  const hasActiveFilters = searchQuery.trim() !== "" || frequencyFilter !== "all" || statusFilter !== "all";
  const filteredSubscriptions = useMemo(() => {
    let result = subscriptions.filter((s) => !hiddenIds.has(s.id));
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          (s.vendor ?? "").toLowerCase().includes(q) ||
          (s.categoryName ?? "").toLowerCase().includes(q),
      );
    }
    if (frequencyFilter !== "all") {
      result = result.filter((s) => s.frequency === frequencyFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((s) => s.status === statusFilter);
    }
    return result;
  }, [subscriptions, hiddenIds, searchQuery, frequencyFilter, statusFilter]);
  const { selectedIds, toggle: toggleSelect, selectAll, clearAll, selectedCount, allSelected, someSelected, selectedItems } = useSelection(filteredSubscriptions);

  useEffect(() => {
    if (!isEditorOpen) {
      setFormState(createDefaultFormState(baseCurrencyCode));
    }
  }, [baseCurrencyCode, isEditorOpen]);

  function updateFormState<Field extends keyof SubscriptionFormState>(
    field: Field,
    value: SubscriptionFormState[Field],
  ) {
    setIsDirty(true);
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function closeEditor() {
    if (isSavingEditor) return;
    setIsEditorOpen(false);
    setSelectedSubscriptionId(null);
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
    setSelectedSubscriptionId(null);
    setFormState(createDefaultFormState(baseCurrencyCode));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(subscription: SubscriptionSummary) {
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("edit");
    setSelectedSubscriptionId(subscription.id);
    setFormState(buildFormStateFromSubscription(subscription));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  const isSavingEditor = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const dueSoonCount = subscriptions.filter((subscription) => {
    const differenceInMs =
      new Date(subscription.nextDueDate).getTime() - new Date().setHours(0, 0, 0, 0);
    const differenceInDays = differenceInMs / 86_400_000;
    return differenceInDays >= 0 && differenceInDays <= 7;
  }).length;
  const autoCreatedCount = subscriptions.filter((subscription) => subscription.autoCreateMovement).length;
  const nextSubscription = subscriptions[0] ?? null;
  const allAmountsConvertible =
    subscriptions.length > 0 &&
    subscriptions.every(
      (subscription) =>
        subscription.amountInBaseCurrency !== null && subscription.amountInBaseCurrency !== undefined,
    );
  const currencySet = new Set(subscriptions.map((subscription) => subscription.currencyCode));
  const sharedCurrency = currencySet.size === 1 ? subscriptions[0]?.currencyCode ?? baseCurrencyCode : null;
  const totalAmountDisplay =
    sharedCurrency !== null
      ? formatCurrency(
          subscriptions.reduce((total, subscription) => total + subscription.amount, 0),
          sharedCurrency,
        )
      : allAmountsConvertible
        ? formatCurrency(
            subscriptions.reduce(
              (total, subscription) => total + (subscription.amountInBaseCurrency ?? 0),
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
    const vendorPartyId = parseOptionalInteger(formState.vendorPartyId);
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
    if (!formState.nextDueDate) subErrors.push("nextDueDate");
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

    if (!formState.startDate || !formState.nextDueDate) {
      setFeedback({
        tone: "error",
        title: "Faltan fechas clave",
        description: "Completa la fecha de inicio y el proximo cobro.",
      });
      return;
    }

    if (formState.nextDueDate < formState.startDate) {
      setFeedback({
        tone: "error",
        title: "La fecha no cuadra",
        description: "El proximo cobro no puede ser anterior al inicio.",
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

    if (vendorPartyId !== null && Number.isNaN(vendorPartyId)) {
      setFeedback({
        tone: "error",
        title: "Proveedor invalido",
        description: "Vuelve a seleccionar el proveedor si deseas asociarlo.",
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

    const payload: SubscriptionFormInput = {
      name,
      vendorPartyId: vendorPartyId === null ? null : vendorPartyId,
      accountId: accountId === null ? null : accountId,
      categoryId: categoryId === null ? null : categoryId,
      currencyCode: formState.currencyCode.trim().toUpperCase() || baseCurrencyCode,
      amount: amount!,
      frequency: formState.frequency,
      intervalCount,
      dayOfMonth: dayOfMonth === null ? null : dayOfMonth,
      dayOfWeek: dayOfWeek === null ? null : dayOfWeek,
      startDate: formState.startDate,
      nextDueDate: formState.nextDueDate,
      endDate: formState.endDate || null,
      status: formState.status,
      autoCreateMovement: formState.autoCreateMovement,
      remindDaysBefore,
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
          title: "Suscripcion creada",
          description: "Ya aparece en tu radar de vencimientos y en la lista principal.",
        });
      } else if (selectedSubscription) {
        await updateMutation.mutateAsync({
          subscriptionId: selectedSubscription.id,
          workspaceId: activeWorkspace.id,
          userId: user.id,
          ...payload,
        });
        setFeedback({
          tone: "success",
          title: "Cambios guardados",
          description: "La suscripcion se actualizo correctamente.",
        });
      }

      setIsEditorOpen(false);
      setSelectedSubscriptionId(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No pudimos guardar la suscripcion",
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
      label: "Suscripción eliminada",
      onCommit: () =>
        deleteMutation.mutateAsync({ subscriptionId: targetId, workspaceId: activeWorkspace.id }),
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
        await deleteMutation.mutateAsync({ subscriptionId: id, workspaceId: activeWorkspace!.id });
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
        <PageHeader description="Estamos preparando los pagos recurrentes del workspace activo." eyebrow="suscripciones" title="Cargando suscripciones" />
        <SubscriptionsLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Necesitamos acceder correctamente al workspace activo." eyebrow="suscripciones" title="Suscripciones no disponibles" />
        <DataState description={getQueryErrorMessage(workspaceError, "No pudimos abrir tu workspace actual.")} title="No hay acceso al workspace" tone="error" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Cuando tengas un workspace activo, aqui veras tus pagos recurrentes." eyebrow="suscripciones" title="Aun no hay un workspace activo" />
        <DataState description="Activa o crea un workspace para comenzar a registrar suscripciones." title="Sin suscripciones para mostrar" />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos cargando tus pagos recurrentes y sus proximos vencimientos." eyebrow="suscripciones" title="Cargando suscripciones" />
        <SubscriptionsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Intentamos reconstruir el estado actual de tus suscripciones." eyebrow="suscripciones" title="No fue posible cargar la informacion" />
        <DataState description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer tus suscripciones actuales.")} title="Error al cargar suscripciones" tone="error" />
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
              <ColumnPicker columns={subscriptionColumns} visible={colVis} onToggle={toggleCol} />
            ) : null}
            <Button
              onClick={() =>
                downloadSubscriptionsCSV(
                  filteredSubscriptions,
                  `suscripciones-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              variant="ghost"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva suscripcion
            </Button>
          </>
        }
        description="Organiza tus pagos recurrentes con monto, frecuencia, cuenta sugerida y recordatorios en un solo lugar."
        eyebrow="suscripciones"
        title="Suscripciones"
      />

      {feedback && feedback.tone !== "error" && !isEditorOpen ? <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

      <SurfaceCard action={<CalendarClock className="h-5 w-5 text-gold" />} description="Resumen general de tus pagos recurrentes configurados." title="Radar de suscripciones">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Registradas</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{subscriptions.length}</p><p className="mt-2 text-sm text-storm">Suscripciones configuradas en este workspace.</p></div>
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Vencen pronto</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{dueSoonCount}</p><p className="mt-2 text-sm text-storm">Con fecha dentro de los proximos 7 dias.</p></div>
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Auto movimiento</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{autoCreatedCount}</p><p className="mt-2 text-sm text-storm">Con automatizacion habilitada.</p></div>
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Monto configurado</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{totalAmountDisplay}</p><p className="mt-2 text-sm text-storm">{sharedCurrency !== null ? `Total acumulado en ${sharedCurrency}.` : allAmountsConvertible ? `Convertido a ${baseCurrencyCode}.` : "Tienes importes en varias monedas."}</p></div>
        </div>
      </SurfaceCard>

      {subscriptions.length > 0 ? (
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
              placeholder="Buscar por nombre, proveedor o categoria..."
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
                {s === "all" ? "Todos" : s === "active" ? "Activa" : s === "paused" ? "Pausada" : "Cancelada"}
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
          {subscriptions.length === 0 ? (
            <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Crear primera suscripcion</Button>} description="Todavia no hay pagos recurrentes registrados para este workspace." title="Sin suscripciones" />
          ) : filteredSubscriptions.length === 0 ? (
            <DataState description="Prueba cambiando los filtros o el texto de busqueda." title="Sin resultados" />
          ) : filteredSubscriptions.map((subscription) => {
            const statusOption = getStatusOption(subscription.status);
            return (
              <article className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16" key={subscription.id}>
                <SelectionCheckbox
                  checked={selectedIds.has(subscription.id)}
                  onChange={() => toggleSelect(subscription.id)}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{subscription.name}</p>
                  <p className="text-xs text-storm">{subscription.vendor}{subscription.categoryName ? ` · ${subscription.categoryName}` : ""} · {subscription.frequencyLabel}</p>
                </div>
                <div className="hidden sm:flex flex-col text-right shrink-0">
                  <p className="text-sm font-semibold text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</p>
                  <p className="text-xs text-storm">{formatDate(subscription.nextDueDate)}</p>
                </div>
                <StatusBadge status={statusOption.label} tone={getStatusTone(subscription.status)} />
                <Button className="py-1.5 text-xs shrink-0" onClick={() => setAnalyticsSubscriptionId(subscription.id)} variant="ghost">Análisis</Button>
                <Button className="py-1.5 text-xs shrink-0" onClick={() => openEditEditor(subscription)} variant="ghost">Editar</Button>
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
                    ariaLabel="Seleccionar todas"
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={() => (allSelected ? clearAll() : selectAll())}
                  />
                </th>
                <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Nombre</th>
                <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("proveedor", "hidden sm:table-cell")}`}>Proveedor</th>
                <th className={`px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("frecuencia", "hidden md:table-cell")}`}>Frecuencia</th>
                <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Monto</th>
                <th className={`px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 ${cv("proximo_cobro", "hidden md:table-cell")}`}>Próximo cobro</th>
                <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Estado</th>
                <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr><td className="px-5 py-6 text-sm text-storm" colSpan={8}><DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Crear primera suscripcion</Button>} description="Todavia no hay pagos recurrentes registrados para este workspace." title="Sin suscripciones" /></td></tr>
              ) : filteredSubscriptions.length === 0 ? (
                <tr><td className="px-5 py-6 text-sm text-storm" colSpan={8}><DataState description="Prueba cambiando los filtros o el texto de busqueda." title="Sin resultados" /></td></tr>
              ) : filteredSubscriptions.map((subscription, index) => {
                const statusOption = getStatusOption(subscription.status);
                return (
                  <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === filteredSubscriptions.length - 1 ? "border-b-0" : ""}`} key={subscription.id}>
                    <td className="w-10 px-4 py-4">
                      <SelectionCheckbox
                        ariaLabel={`Seleccionar ${subscription.name}`}
                        checked={selectedIds.has(subscription.id)}
                        onChange={() => toggleSelect(subscription.id)}
                      />
                    </td>
                    <td className="px-5 py-3.5 font-medium text-ink">{subscription.name}</td>
                    <td className={`px-5 py-3.5 text-storm ${cv("proveedor", "hidden sm:table-cell")}`}>{subscription.vendor}</td>
                    <td className={`px-5 py-3.5 text-storm ${cv("frecuencia", "hidden md:table-cell")}`}>{subscription.frequencyLabel}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</td>
                    <td className={`px-5 py-3.5 text-right text-storm ${cv("proximo_cobro", "hidden md:table-cell")}`}>{formatDate(subscription.nextDueDate)}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={statusOption.label} tone={getStatusTone(subscription.status)} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex justify-end gap-2">
                        <Button className="py-1.5 text-xs" onClick={() => setAnalyticsSubscriptionId(subscription.id)} variant="ghost">Análisis</Button>
                        <Button className="py-1.5 text-xs" onClick={() => openEditEditor(subscription)} variant="ghost">Editar</Button>
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
        <SurfaceCard action={<StatusBadge status={`${filteredSubscriptions.length} de ${subscriptions.length} registradas`} tone="success" />} description="Cada tarjeta representa una suscripcion real con sus datos principales y sus acciones." title="Pagos recurrentes">
          {subscriptions.length === 0 ? (
            <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Crear primera suscripcion</Button>} description="Todavia no hay pagos recurrentes registrados para este workspace." title="Sin suscripciones" />
          ) : filteredSubscriptions.length === 0 ? (
            <DataState description="Prueba cambiando los filtros o el texto de busqueda." title="Sin resultados" />
          ) : (
            <div className="space-y-4">
              {filteredSubscriptions.map((subscription) => {
                const statusOption = getStatusOption(subscription.status);
                const isSelected = selectedIds.has(subscription.id);
                const longPressHandlers = createLongPressHandlers(() => toggleSelect(subscription.id));
                return (
                  <article
                    className={`relative glass-panel-soft rounded-[30px] p-5 transition duration-200 hover:border-white/16 ${isSelected ? "ring-2 ring-pine/30 border-pine/25" : ""}`}
                    key={subscription.id}
                    onClick={(e) => {
                      if (wasRecentLongPress()) return;
                      if (selectedCount === 0) return;
                      if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
                      toggleSelect(subscription.id);
                    }}
                    {...longPressHandlers}
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">{subscription.frequencyLabel}</span>
                          <StatusBadge status={statusOption.label} tone={getStatusTone(subscription.status)} />
                        </div>
                        <p className="mt-4 font-display text-2xl font-semibold text-ink">{subscription.name}</p>
                        <p className="mt-2 text-sm text-storm">{subscription.vendor}{subscription.accountName ? ` - ${subscription.accountName}` : ""}{subscription.categoryName ? ` - ${subscription.categoryName}` : ""}</p>
                        {subscription.description ? <p className="mt-3 text-sm leading-7 text-storm">{subscription.description}</p> : null}
                      </div>
                      <div className="rounded-[24px] border border-white/10 bg-black/15 px-4 py-4 text-right">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Monto</p>
                        <p className="mt-2 font-display text-2xl font-semibold text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</p>
                      </div>
                    </div>
                    <div className="mt-5 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-xs uppercase tracking-[0.18em] text-storm">Proximo cobro</p><p className="mt-2 text-sm font-medium text-ink">{formatDate(subscription.nextDueDate)}</p></div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-xs uppercase tracking-[0.18em] text-storm">Recordatorio</p><p className="mt-2 text-sm font-medium text-ink">{subscription.remindDaysBefore} dias antes</p></div>
                      <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3"><p className="text-xs uppercase tracking-[0.18em] text-storm">Auto movimiento</p><p className="mt-2 text-sm font-medium text-ink">{subscription.autoCreateMovement ? "Activo" : "Desactivado"}</p></div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                      <Button onClick={() => setAnalyticsSubscriptionId(subscription.id)} variant="ghost"><BarChart3 className="mr-2 h-4 w-4" />Ver análisis</Button>
                      <Button onClick={() => openEditEditor(subscription)} variant="secondary"><PencilLine className="mr-2 h-4 w-4" />Editar</Button>
                      <Button className="text-[#ffb4bc] hover:text-white" onClick={() => setDeleteTargetId(subscription.id)} variant="ghost"><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard action={<Sparkles className="h-5 w-5 text-gold" />} description="Orden cronologico con lo que viene mas pronto y una lectura rapida de la configuracion." title="Proximos vencimientos">
          {subscriptions.length === 0 ? (
            <DataState description="Cuando registres una suscripcion, aqui veras el siguiente cobro en orden cronologico." title="Sin calendario todavia" />
          ) : (
            <>
              <div className="space-y-3">
                {subscriptions.map((subscription) => (
                  <div className="glass-panel-soft flex items-center justify-between gap-3 rounded-[26px] p-4" key={subscription.id}>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{subscription.name}</p>
                      <p className="mt-1 text-sm text-storm">{formatDate(subscription.nextDueDate)} - {subscription.frequencyLabel}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-ink">{formatCurrency(subscription.amount, subscription.currencyCode)}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-storm">{getStatusOption(subscription.status).label}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[26px] border border-pine/15 bg-pine/10 p-5">
                <p className="font-medium text-ink">Resumen rapido</p>
                <p className="mt-2 text-sm leading-7 text-storm">
                  {dueSoonCount} vencen en los proximos 7 dias, {autoCreatedCount} tienen auto-creacion habilitada y el siguiente cargo es{" "}
                  {nextSubscription ? `${nextSubscription.name} el ${formatDate(nextSubscription.nextDueDate)}` : "sin fecha registrada"}.
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
          badge="Eliminar suscripción"
          description="Esto elimina la suscripcion y su calendario asociado. Si ya tiene movimientos vinculados, primero tendras que resolverlos."
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
            <p className="mt-1 text-sm text-storm">{deleteTarget.vendor}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-ink">
                {formatCurrency(deleteTarget.amount, deleteTarget.currencyCode)}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-storm">
                {deleteTarget.frequencyLabel}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-xs text-storm">
                {formatDate(deleteTarget.nextDueDate)}
              </span>
            </div>
          </div>
        </DeleteConfirmDialog>
      ) : null}

      {analyticsSubscriptionId !== null ? (() => {
        const analyticsSub = subscriptions.find((s) => s.id === analyticsSubscriptionId);
        return analyticsSub ? (
          <SubscriptionAnalyticsModal
            baseCurrencyCode={baseCurrencyCode}
            movements={snapshot?.movements ?? []}
            subscription={analyticsSub}
            onClose={() => setAnalyticsSubscriptionId(null)}
          />
        ) : null;
      })() : null}

      <BulkActionBar
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadSubscriptionsCSV(selectedItems, `suscripciones-seleccionadas-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredSubscriptions.length}
      />
      {showBulkDeleteConfirm ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="sub-bulk-title">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[#0d1520] p-6">
            <h2 id="sub-bulk-title" className="font-display text-xl font-semibold text-ink">
              Eliminar {selectedCount} suscripcion{selectedCount !== 1 ? "es" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Esta accion eliminara permanentemente las suscripciones seleccionadas. No se puede deshacer.
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
