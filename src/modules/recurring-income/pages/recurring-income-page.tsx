import {
  CheckCircle2,
  Clock,
  Download,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { InfoTip } from "../../../components/ui/info-tip";
import { Pagination } from "../../../components/ui/pagination";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, useSelection } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  CategorySummary,
  CounterpartySummary,
  MovementRecord,
  RecurringIncomeFrequency,
  RecurringIncomeOccurrence,
  RecurringIncomeStatus,
  RecurringIncomeSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import {
  getQueryErrorMessage,
  type ConfirmArrivalInput,
  type RecurringIncomeFormInput,
  useConfirmRecurringIncomeArrivalMutation,
  useCreateRecurringIncomeMutation,
  useDeleteRecurringIncomeMutation,
  useRecurringIncomeOccurrencesQuery,
  useUpdateRecurringIncomeMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import { RecurringIncomeGrid } from "../components/recurring-income-grid";
import { RecurringIncomeList } from "../components/recurring-income-list";
import { RecurringIncomeTable } from "../components/recurring-income-table";
import { useRecurringIncomeFilters } from "../hooks/use-recurring-income-filters";
import {
  frequencyOptions,
  getFrequencyOption,
  getStatusOption,
  statusOptions,
} from "../lib/recurring-income-presenters";

const RECURRING_INCOME_PAGE_SIZE = 50;

const statusFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Todos los estados", description: "No filtra por estado.", leadingLabel: "TO", searchText: "todos estados" },
  ...statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
    leadingColor: option.leadingColor,
    searchText: `${option.value} ${option.label}`,
  })),
];

const frequencyFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Todas las frecuencias", description: "No filtra por frecuencia.", leadingLabel: "TO", searchText: "todas frecuencias" },
  ...frequencyOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
    leadingColor: option.leadingColor,
    searchText: `${option.value} ${option.label}`,
  })),
];

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

const inputClassName = "field-dark";
const textareaClassName = "field-dark min-h-[100px] resize-y py-3 leading-7";
const panelClassName =
  "glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] p-4 sm:p-6";
const labelClassName =
  "text-xs font-semibold uppercase tracking-[0.22em] text-storm/80";

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

function advanceNextExpectedDate(income: RecurringIncomeSummary): string {
  const parts = income.nextExpectedDate.split("-");
  const d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12));
  const { frequency, intervalCount } = income;
  switch (frequency) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + intervalCount);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7 * intervalCount);
      break;
    case "monthly": {
      d.setUTCMonth(d.getUTCMonth() + intervalCount);
      if (income.dayOfMonth) {
        const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
        d.setUTCDate(Math.min(income.dayOfMonth, maxDay));
      }
      break;
    }
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3 * intervalCount);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + intervalCount);
      break;
    default:
      d.setUTCDate(d.getUTCDate() + intervalCount);
  }
  return d.toISOString().slice(0, 10);
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
  // Divulgación progresiva: al crear, lo avanzado (estado, recordatorio, notas)
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
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-void/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }} onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) closeEditor(); }}>
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl [transform:translateZ(0)]" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <form className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden" noValidate onSubmit={onSubmit}>
            <div className="overflow-y-auto px-4 pt-5 sm:px-6 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/90">
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

              <div className="glass-panel-soft mt-7 rounded-[24px] p-5 sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 bg-[linear-gradient(160deg,#1b6a58,rgba(8,13,20,0.72))] text-white">
                        <TrendingUp className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Vista previa</p>
                        <h3 className="mt-2 break-words font-display text-4xl font-semibold text-ink">{title}</h3>
                        <p className="mt-3 text-base leading-8 text-storm">
                          {selectedPayer?.name ?? "Selecciona un pagador"}
                        </p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">{frequencyOption.label}</span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">{statusOption.label}</span>
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">{currencyLabel.code}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Monto esperado</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formatCurrency(amount, currencyLabel.code)}
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Proxima llegada</p>
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
                      <SearchablePicker disabled={counterpartyOptions.length === 0} emptyMessage="No tienes contrapartes disponibles aun." onChange={(value) => updateFormState("payerPartyId", value)} options={counterpartyOptions} placeholderDescription="Puedes dejarlo libre si aun no lo registras." placeholderLabel="Sin pagador fijo" queryPlaceholder="Buscar pagador..." value={formState.payerPartyId} />
                    </Field>
                    <Field hint="Categoria contable sugerida." label="Categoria">
                      <SearchablePicker disabled={categoryOptions.length === 0} emptyMessage="No tienes categorias de ingreso disponibles aun." onChange={(value) => updateFormState("categoryId", value)} options={categoryOptions} placeholderDescription="Puedes dejarla vacia por ahora." placeholderLabel="Sin categoria" queryPlaceholder="Buscar categoria..." value={formState.categoryId} />
                    </Field>
                    <Field hint="Cuenta donde recibes este ingreso." label="Cuenta sugerida">
                      <SearchablePicker disabled={accountOptions.length === 0} emptyMessage="No tienes cuentas disponibles aun." onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Puedes definirla mas adelante." placeholderLabel="Sin cuenta fija" queryPlaceholder="Buscar cuenta..." value={formState.accountId} />
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
                      <SearchablePicker emptyMessage="No hay monedas configuradas." onChange={(value) => updateFormState("currencyCode", value)} options={currencyPickerOptions} placeholderDescription="Selecciona la moneda principal." placeholderLabel="Selecciona una moneda" queryPlaceholder="Buscar PEN, USD, EUR..." value={formState.currencyCode} />
                    </Field>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Ritmo</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Frecuencia y calendario</h3>
                  <div className="mt-3 sm:mt-6 grid gap-3 sm:gap-5 sm:grid-cols-2">
                    <Field hint="Define cada cuanto esperas el ingreso." label="Frecuencia">
                      <SearchablePicker emptyMessage="No hay frecuencias disponibles." onChange={(value) => updateFormState("frequency", value as RecurringIncomeFrequency)} options={frequencyPickerOptions} placeholderDescription="Selecciona el ritmo principal." placeholderLabel="Selecciona una frecuencia" queryPlaceholder="Buscar frecuencia..." value={formState.frequency} />
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
                        <SearchablePicker emptyMessage="No hay dias disponibles." onChange={(value) => updateFormState("dayOfWeek", value)} options={weekdayOptions.map((option) => ({ value: option.value, label: option.label, description: option.description, leadingLabel: option.leadingLabel, leadingColor: "#4566d6" }))} placeholderDescription="Selecciona el dia mas comun." placeholderLabel="Sin dia fijo" queryPlaceholder="Buscar dia..." value={formState.dayOfWeek} />
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

                {!showAdvanced ? (
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-[24px] border border-dashed border-white/15 bg-white/[0.02] px-4 py-3.5 text-sm font-medium text-storm transition hover:border-white/25 hover:text-ink lg:col-span-2"
                    onClick={() => setShowAdvanced(true)}
                    type="button"
                  >
                    Más opciones (estado, recordatorio, notas)
                  </button>
                ) : null}

                <div className={`${panelClassName} ${showAdvanced ? "" : "hidden"}`}>
                  <p className={labelClassName}>Seguimiento</p>
                  <h3 className="mt-1 sm:mt-2 font-display text-lg sm:text-2xl font-semibold text-ink">Estado y recordatorios</h3>
                  <div className="mt-3 sm:mt-6 grid gap-3 sm:gap-5">
                    <Field hint="Controla si sigue activo, pausado o cerrado." label="Estado">
                      <SearchablePicker emptyMessage="No hay estados disponibles." onChange={(value) => updateFormState("status", value as RecurringIncomeStatus)} options={statusPickerOptions} placeholderDescription="Selecciona el estado actual." placeholderLabel="Selecciona un estado" queryPlaceholder="Buscar estado..." value={formState.status} />
                    </Field>
                    <Field hint="Cuantos dias antes quieres ver el aviso si no llega." label="Recordatorio">
                      <Input inputMode="numeric" min="0" onChange={(event) => updateFormState("remindDaysBefore", event.target.value)} placeholder="3" step="1" type="number" value={formState.remindDaysBefore} />
                    </Field>
                  </div>
                </div>

                <div className={`${panelClassName} lg:col-span-2 ${showAdvanced ? "" : "hidden"}`}>
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

            <div className="relative z-[60] border-t border-white/10 bg-shell/95 px-4 py-4 sm:px-6 backdrop-blur-md">
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

function ConfirmArrivalDialog({
  income,
  movements,
  onClose,
  onConfirm,
  isSaving,
}: {
  income: RecurringIncomeSummary;
  movements: MovementRecord[];
  onClose: () => void;
  onConfirm: (input: Omit<ConfirmArrivalInput, "workspaceId" | "userId">) => Promise<void>;
  isSaving: boolean;
}) {
  const today = toDateInputValue(new Date().toISOString());
  const [actualDate, setActualDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [movementId, setMovementId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const incomeMovements = useMemo(
    () =>
      movements
        .filter((m) => m.movementType === "income" && m.status !== "voided")
        .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
        .slice(0, 40),
    [movements],
  );
  const movementOptions = incomeMovements.map<PickerOption>((m) => ({
    value: String(m.id),
    label: m.description || `Movimiento #${m.id}`,
    description: `${formatDate(m.occurredAt)} Â· ${m.destinationCurrencyCode ?? m.sourceCurrencyCode ?? ""}`,
    leadingLabel: (m.destinationCurrencyCode ?? m.sourceCurrencyCode ?? "??").slice(0, 3),
    leadingColor: "#1b6a58",
    searchText: `${m.description} ${m.occurredAt}`,
  }));
  const nextExpectedDate = advanceNextExpectedDate(income);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!actualDate) {
      setError("Indica la fecha real de llegada.");
      return;
    }
    setError(null);
    await onConfirm({
      recurringIncomeId: income.id,
      expectedDate: income.nextExpectedDate,
      actualDate,
      amount: income.amount,
      currencyCode: income.currencyCode,
      movementId: movementId ? Number(movementId) : null,
      notes,
      nextExpectedDate,
    });
  }

  return (
    <div
      className="fixed inset-0 z-[90] isolate overflow-y-auto bg-void/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }}
      onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0 && !isSaving) onClose(); }}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="animate-rise-in relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <form className="flex flex-col gap-5 p-6" noValidate onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-full border border-pine/20 bg-pine/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-pine/80">
                  Confirmar llegada
                </span>
                <h2 className="mt-3 font-display text-2xl font-semibold text-ink">{income.name}</h2>
                <p className="mt-1 text-sm text-storm">
                  Esperado el {formatDate(income.nextExpectedDate)} Â· {formatCurrency(income.amount, income.currencyCode)}
                </p>
              </div>
              <button
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm hover:border-white/16 hover:text-ink"
                disabled={isSaving}
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {error ? (
              <p className="rounded-[18px] border border-[#ffb4bc]/20 bg-[#ffb4bc]/10 px-4 py-3 text-sm text-[#ffb4bc]">
                {error}
              </p>
            ) : null}

            <div className="rounded-[26px] border border-pine/15 bg-pine/8 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.18em] text-storm">Proxima llegada despues de confirmar</p>
              <p className="mt-1.5 font-medium text-ink">{formatDate(nextExpectedDate)}</p>
            </div>

            <Field label="Fecha real de llegada">
              <DatePickerField
                value={actualDate}
                onChange={(v) => setActualDate(v ?? "")}
              />
            </Field>

            <Field hint="Opcional. Vincula este ingreso a un movimiento ya registrado." label="Movimiento vinculado">
              <SearchablePicker
                emptyMessage="No hay movimientos de ingreso recientes."
                onChange={setMovementId}
                options={movementOptions}
                placeholderDescription="Sin vinculo a un movimiento especifico."
                placeholderLabel="Sin vinculo"
                queryPlaceholder="Buscar movimiento..."
                value={movementId}
              />
            </Field>

            <Field hint="Opcional. Puedes agregar contexto sobre esta llegada." label="Notas">
              <Textarea
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ej. Llego con demora por feriado..."
                value={notes}
              />
            </Field>

            <div className="flex flex-col-reverse gap-3 sm:flex-row">
              <Button disabled={isSaving} onClick={onClose} type="button" variant="ghost">
                Cancelar
              </Button>
              <Button disabled={isSaving} type="submit">
                {isSaving ? (
                  <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Confirmando...</>
                ) : (
                  <><CheckCircle2 className="mr-2 h-4 w-4" />Confirmar llegada</>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function getOccurrenceStatusLabel(status: RecurringIncomeOccurrence["status"]) {
  switch (status) {
    case "on_time": return "A tiempo";
    case "late": return "Con demora";
    case "missed": return "No llegÃ³";
  }
}

function getOccurrenceStatusColor(status: RecurringIncomeOccurrence["status"]) {
  switch (status) {
    case "on_time": return "text-pine";
    case "late": return "text-[#b48b34]";
    case "missed": return "text-[#ffb4bc]";
  }
}

function HistoryDialog({
  income,
  workspaceId,
  onClose,
}: {
  income: RecurringIncomeSummary;
  workspaceId: number;
  onClose: () => void;
}) {
  const occurrencesQuery = useRecurringIncomeOccurrencesQuery(workspaceId, income.id);
  const occurrences = occurrencesQuery.data ?? [];

  return (
    <div
      className="fixed inset-0 z-[90] isolate overflow-y-auto bg-void/70 p-4 backdrop-blur-sm"
      onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }}
      onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) onClose(); }}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="animate-rise-in relative w-full max-w-lg overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/90">
                  Historial de llegadas
                </span>
                <h2 className="mt-3 font-display text-2xl font-semibold text-ink">{income.name}</h2>
                <p className="mt-1 text-sm text-storm">{income.frequencyLabel} Â· {formatCurrency(income.amount, income.currencyCode)}</p>
              </div>
              <button
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm hover:border-white/16 hover:text-ink"
                onClick={onClose}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {occurrencesQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div className="shimmer-surface h-16 rounded-[20px]" key={i} />
                ))}
              </div>
            ) : occurrences.length === 0 ? (
              <div className="rounded-[24px] border border-white/10 bg-white/[0.02] px-5 py-8 text-center">
                <Clock className="mx-auto h-8 w-8 text-storm/50" />
                <p className="mt-3 font-medium text-ink">Sin historial todavia</p>
                <p className="mt-1 text-sm text-storm">Cuando confirmes la primera llegada, aparecera aqui.</p>
              </div>
            ) : (
              <div className="max-h-[440px] space-y-2 overflow-y-auto pr-1">
                {occurrences.map((occ) => (
                  <div
                    className="flex items-center justify-between gap-3 rounded-[20px] border border-white/10 bg-white/[0.03] px-4 py-3"
                    key={occ.id}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        Esperado: {formatDate(occ.expectedDate)}
                      </p>
                      {occ.actualDate ? (
                        <p className="mt-0.5 text-xs text-storm">
                          Recibido: {formatDate(occ.actualDate)}
                        </p>
                      ) : null}
                      {occ.notes ? (
                        <p className="mt-0.5 text-xs text-storm/70">{occ.notes}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-medium text-ink">{formatCurrency(occ.amount, occ.currencyCode)}</p>
                      <p className={`mt-0.5 text-xs font-semibold ${getOccurrenceStatusColor(occ.status)}`}>
                        {getOccurrenceStatusLabel(occ.status)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RecurringIncomeLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[248px] rounded-[32px]" />
      <div className="shimmer-surface h-[520px] rounded-[32px]" />
    </>
  );
}


function RecurringIncomeSummaryChip({
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
      <p className={`mt-2 truncate font-display text-2xl font-semibold leading-tight ${valueTone[tone]}`}>
        {value}
      </p>
    </article>
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
  const confirmMutation = useConfirmRecurringIncomeArrivalMutation(activeWorkspace?.id, user?.id);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  useSuccessToast(feedback, {
    clear: () => setFeedback(null),
  });
  const incomeColumns: ColumnDef[] = [
    { key: "pagador", label: "Pagador" },
    { key: "frecuencia", label: "Frecuencia" },
    { key: "categoria", label: "Categoria" },
    { key: "cuenta", label: "Cuenta" },
    { key: "proxima_llegada", label: "PrÃ³xima llegada" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-recurring-income", incomeColumns);
  const [viewMode, setViewMode] = useViewMode("recurring-income", "table");
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
  const [confirmIncomeId, setConfirmIncomeId] = useState<number | null>(null);
  const [historyIncomeId, setHistoryIncomeId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  const {
    filters: incomeFilters,
    currentPage,
    setCurrentPage,
    openTableFilter,
    updateFilter: updateIncomeFilter,
    clearFilters: clearIncomeFilters,
    toggleTableFilterMenu,
    closeTableFilterMenu,
    clearSingleTableFilter,
    applyFilterAndClose: applyIncomeFilterAndClose,
  } = useRecurringIncomeFilters(viewMode);
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
  const confirmIncome =
    confirmIncomeId === null
      ? null
      : recurringIncome.find((r) => r.id === confirmIncomeId) ?? null;
  const historyIncome =
    historyIncomeId === null
      ? null
      : recurringIncome.find((r) => r.id === historyIncomeId) ?? null;
  const movements = snapshot?.movements ?? [];

  const hasActiveFilters =
    incomeFilters.name.trim() !== "" ||
    incomeFilters.payer.trim() !== "" ||
    incomeFilters.category.trim() !== "" ||
    incomeFilters.account.trim() !== "" ||
    incomeFilters.amount.trim() !== "" ||
    incomeFilters.nextExpectedDateFrom !== "" ||
    incomeFilters.nextExpectedDateTo !== "" ||
    incomeFilters.frequency !== "all" ||
    incomeFilters.status !== "all";
  const filteredIncome = useMemo(() => {
    let result = recurringIncome.filter((r) => !hiddenIds.has(r.id));
    const normalizedName = incomeFilters.name.trim().toLowerCase();
    const normalizedPayer = incomeFilters.payer.trim().toLowerCase();
    const normalizedCategory = incomeFilters.category.trim().toLowerCase();
    const normalizedAccount = incomeFilters.account.trim().toLowerCase();
    const normalizedAmount = incomeFilters.amount.trim();
    if (normalizedName) {
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(normalizedName) ||
          (r.categoryName ?? "").toLowerCase().includes(normalizedName) ||
          (r.accountName ?? "").toLowerCase().includes(normalizedName),
      );
    }
    if (normalizedPayer) {
      result = result.filter((r) => (r.payer ?? "").toLowerCase().includes(normalizedPayer));
    }
    if (normalizedCategory) {
      result = result.filter((r) => (r.categoryName ?? "").toLowerCase().includes(normalizedCategory));
    }
    if (normalizedAccount) {
      result = result.filter((r) => (r.accountName ?? "").toLowerCase().includes(normalizedAccount));
    }
    if (incomeFilters.frequency !== "all") {
      result = result.filter((r) => r.frequency === incomeFilters.frequency);
    }
    if (incomeFilters.status !== "all") {
      result = result.filter((r) => r.status === incomeFilters.status);
    }
    if (normalizedAmount) {
      result = result.filter((r) => String(r.amount).includes(normalizedAmount));
    }
    if (incomeFilters.nextExpectedDateFrom) {
      result = result.filter((r) => r.nextExpectedDate >= incomeFilters.nextExpectedDateFrom);
    }
    if (incomeFilters.nextExpectedDateTo) {
      result = result.filter((r) => r.nextExpectedDate <= incomeFilters.nextExpectedDateTo);
    }
    return result;
  }, [hiddenIds, incomeFilters, recurringIncome]);
  const totalPages = Math.max(1, Math.ceil(filteredIncome.length / RECURRING_INCOME_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedIncome = useMemo(
    () => filteredIncome.slice((safePage - 1) * RECURRING_INCOME_PAGE_SIZE, safePage * RECURRING_INCOME_PAGE_SIZE),
    [filteredIncome, safePage],
  );
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
  const recurringIncomePayers = useMemo(
    () =>
      Array.from(
        new Set(
          recurringIncome
            .map((income) => income.payer?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [recurringIncome],
  );
  const recurringIncomeCategories = useMemo(
    () =>
      Array.from(
        new Set(
          recurringIncome
            .map((income) => income.categoryName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [recurringIncome],
  );
  const recurringIncomeAccounts = useMemo(
    () =>
      Array.from(
        new Set(
          recurringIncome
            .map((income) => income.accountName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [recurringIncome],
  );


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

  async function handleConfirmArrival(input: Omit<ConfirmArrivalInput, "workspaceId" | "userId">) {
    if (!activeWorkspace || !user?.id) return;
    try {
      await confirmMutation.mutateAsync({
        ...input,
        workspaceId: activeWorkspace.id,
        userId: user.id,
      });
      setConfirmIncomeId(null);
      setFeedback({
        tone: "success",
        title: "Llegada confirmada",
        description: `La proxima llegada se actualizo automaticamente a ${formatDate(input.nextExpectedDate)}.`,
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "No se pudo confirmar la llegada",
        description: getQueryErrorMessage(err, "Intenta nuevamente."),
      });
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
      {/* Header compacto (estÃ¡ndar de cuentas) */}
      <section className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/80">Ingresos fijos</p>
        <div className="mt-1 flex items-center gap-2.5">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">
            Ingresos recurrentes
          </h2>
          <InfoTip ariaLabel="Sobre los ingresos recurrentes">
            Registra tus ingresos fijos esperados (sueldo, rentas, cobros periÃ³dicos) para anticipar
            cuÃ¡ndo y cuÃ¡nto entra. Los filtros de la barra superior aplican a todas las vistas.
          </InfoTip>
        </div>
        <p className="mt-1 text-xs text-storm">Ingresos esperados periÃ³dicos del workspace.</p>
      </section>

      {/* MÃ©tricas compactas */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
        <RecurringIncomeSummaryChip label="registrados" value={String(recurringIncome.length)} />
        <RecurringIncomeSummaryChip label="llegan pronto" tone="warning" value={String(dueSoonCount)} />
        <RecurringIncomeSummaryChip
          label="activos"
          tone="info"
          value={String(recurringIncome.filter((r) => r.status === "active").length)}
        />
        <RecurringIncomeSummaryChip label="monto esperado" tone="info" value={totalAmountDisplay} />
        <RecurringIncomeSummaryChip label="siguiente" value={nextIncome ? formatDate(nextIncome.nextExpectedDate) : "â€”"} />
      </div>

      {/* Toolbar sticky (estÃ¡ndar de cuentas) */}
      <section className="sticky top-3 z-30 rounded-[24px] border border-white/10 bg-canvas/85 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
          {viewMode === "table" ? (
            <ColumnPicker columns={incomeColumns} visible={colVis} onToggle={toggleCol} />
          ) : null}
          <StatusBadge status={`${filteredIncome.length} visibles`} tone="neutral" />
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
              <Button onClick={clearIncomeFilters} variant="ghost">
                <X className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            ) : null}
            <Button
              disabled={!filteredIncome.length}
              onClick={() =>
                downloadRecurringIncomeCSV(
                  filteredIncome,
                  `ingresos-recurrentes-${new Date().toISOString().slice(0, 10)}.csv`,
                )
              }
              variant="ghost"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button data-tour="create-recurring-income" onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo ingreso
            </Button>
          </div>
        </div>

        {/* Filtros principales: siempre visibles (aplican a todas las vistas) */}
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <input
            className="field-dark"
            onChange={(e) => updateIncomeFilter("name", e.target.value)}
            placeholder="Buscar por nombre, categoria o cuenta..."
            type="text"
            value={incomeFilters.name}
          />
          <SearchablePicker
            emptyMessage="No hay estados para mostrar."
            onChange={(value) => updateIncomeFilter("status", value as "all" | RecurringIncomeStatus)}
            options={statusFilterPickerOptions}
            placeholderDescription="Filtra por estado."
            placeholderLabel="Estado"
            queryPlaceholder="Buscar estado..."
            value={incomeFilters.status}
          />
          <SearchablePicker
            emptyMessage="No hay frecuencias para mostrar."
            onChange={(value) => updateIncomeFilter("frequency", value as "all" | RecurringIncomeFrequency)}
            options={frequencyFilterPickerOptions}
            placeholderDescription="Filtra por frecuencia."
            placeholderLabel="Frecuencia"
            queryPlaceholder="Buscar frecuencia..."
            value={incomeFilters.frequency}
          />
        </div>
      </section>

      {feedback && feedback.tone !== "error" && !isEditorOpen ? <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

      {viewMode === "list" ? (
        recurringIncome.length === 0 ? (
          <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Registrar primer ingreso</Button>} description="Todavia no hay ingresos recurrentes registrados para este workspace." title="Sin ingresos recurrentes" />
        ) : filteredIncome.length === 0 ? (
          <DataState description="Prueba cambiando los filtros o el texto de busqueda." title="Sin resultados" />
        ) : (
          <RecurringIncomeList
            income={paginatedIncome}
            onConfirm={setConfirmIncomeId}
            onEdit={openEditEditor}
            onHistory={setHistoryIncomeId}
            onToggleSelect={toggleSelect}
            selectedIds={selectedIds}
          />
        )
      ) : viewMode === "table" ? (
        recurringIncome.length === 0 ? (
          <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Registrar primer ingreso</Button>} description="Todavia no hay ingresos recurrentes registrados para este workspace." title="Sin ingresos recurrentes" />
        ) : filteredIncome.length === 0 ? (
          <DataState description="Prueba cambiando los filtros activos de la tabla." title="Sin resultados" />
        ) : (
          <RecurringIncomeTable
            accounts={recurringIncomeAccounts}
            allSelected={allSelected}
            categories={recurringIncomeCategories}
            cv={cv}
            filters={incomeFilters}
            income={paginatedIncome}
            onApplyFilterAndClose={applyIncomeFilterAndClose}
            onClearAll={clearAll}
            onClearSingleFilter={clearSingleTableFilter}
            onCloseFilterMenu={closeTableFilterMenu}
            onConfirm={setConfirmIncomeId}
            onEdit={openEditEditor}
            onHistory={setHistoryIncomeId}
            onSelectAll={selectAll}
            onToggleFilterMenu={toggleTableFilterMenu}
            onToggleSelect={toggleSelect}
            onUpdateFilter={updateIncomeFilter}
            openFilter={openTableFilter}
            payers={recurringIncomePayers}
            someSelected={someSelected}
            selectedIds={selectedIds}
          />
        )
      ) : null}
      {viewMode === "grid" ? (
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SurfaceCard action={<StatusBadge status={`${filteredIncome.length} de ${recurringIncome.length} registrados`} tone="success" />} description="Cada tarjeta representa un ingreso recurrente real con sus datos principales y sus acciones." title="Ingresos recurrentes">
          {recurringIncome.length === 0 ? (
            <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Registrar primer ingreso</Button>} description="Todavia no hay ingresos recurrentes registrados para este workspace." title="Sin ingresos recurrentes" />
          ) : filteredIncome.length === 0 ? (
            <DataState description="Prueba cambiando los filtros o el texto de busqueda." title="Sin resultados" />
          ) : (
            <RecurringIncomeGrid
              income={paginatedIncome}
              onConfirm={setConfirmIncomeId}
              onDelete={setDeleteTargetId}
              onEdit={openEditEditor}
              onHistory={setHistoryIncomeId}
              onToggleSelect={toggleSelect}
              selectedCount={selectedCount}
              selectedIds={selectedIds}
            />
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
      ) : null}

      {filteredIncome.length > 0 ? (
        <Pagination
          onPageChange={setCurrentPage}
          page={safePage}
          pageSize={RECURRING_INCOME_PAGE_SIZE}
          totalItems={filteredIncome.length}
        />
      ) : null}

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
      {confirmIncome && activeWorkspace ? (
        <ConfirmArrivalDialog
          income={confirmIncome}
          isSaving={confirmMutation.isPending}
          movements={movements}
          onClose={() => setConfirmIncomeId(null)}
          onConfirm={handleConfirmArrival}
        />
      ) : null}

      {historyIncome && activeWorkspace ? (
        <HistoryDialog
          income={historyIncome}
          onClose={() => setHistoryIncomeId(null)}
          workspaceId={activeWorkspace.id}
        />
      ) : null}

      {showBulkDeleteConfirm ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="ri-bulk-title">
          <div className="glass-panel-strong w-full max-w-md rounded-[28px] p-6">
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
