import {
  Download,
  LoaderCircle,
  MoreVertical,
  Plus,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import type {
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { Pagination } from "../../../components/ui/pagination";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { Modal, ModalHeader } from "../../../components/ui/modal";
import { PageHeader } from "../../../components/ui/page-header";
import { ResourceEditorDestination, ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { BulkActionBar, useSelection } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type {
  AccountSummary,
  CategorySummary,
  CounterpartySummary,
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
  useSetRecurringIncomeFlagsMutation,
  useUpdateRecurringIncomeMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import { RecurringIncomeList } from "../components/recurring-income-list";
import { useRecurringIncomeFilters } from "../hooks/use-recurring-income-filters";
import {
  frequencyOptions,
  getFrequencyOption,
  getStatusOption,
  statusOptions,
} from "../lib/recurring-income-presenters";
import { advanceNextExpectedDate, monthlyEquivalent, pendingArrivalDates } from "../lib/recurring-income-parity";

const RECURRING_INCOME_PAGE_SIZE = 50;

const statusFilterPickerOptions: PickerOption[] = [
  { value: "all", label: "Todos los estados", description: "No filtra por estado.", leadingLabel: "TO", searchText: "todos estados" },
  ...statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
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
  grossAmount: string;
  deductions: { key: string; name: string; amount: string }[];
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
  { code: "PEN", label: "Sol peruano", region: "Perú", symbol: "S/" },
  { code: "USD", label: "Dólar estadounidense", region: "Estados Unidos", symbol: "$" },
  { code: "EUR", label: "Euro", region: "Unión Europea", symbol: "EUR" },
  { code: "BRL", label: "Real brasileño", region: "Brasil", symbol: "R$" },
  { code: "MXN", label: "Peso mexicano", region: "México", symbol: "MXN" },
  { code: "CLP", label: "Peso chileno", region: "Chile", symbol: "CLP" },
] as const;

const weekdayOptions = [
  { value: "0", label: "Domingo", description: "Inicio de semana.", leadingLabel: "DO" },
  { value: "1", label: "Lunes", description: "Llega los lunes.", leadingLabel: "LU" },
  { value: "2", label: "Martes", description: "Llega los martes.", leadingLabel: "MA" },
  { value: "3", label: "Miércoles", description: "Llega los miércoles.", leadingLabel: "MI" },
  { value: "4", label: "Jueves", description: "Llega los jueves.", leadingLabel: "JU" },
  { value: "5", label: "Viernes", description: "Llega los viernes.", leadingLabel: "VI" },
  { value: "6", label: "Sábado", description: "Llega los sábados.", leadingLabel: "SA" },
] as const;

const inputClassName = "field-dark";
const textareaClassName = "field-dark min-h-[100px] resize-y py-3 leading-7";
const labelClassName = "text-[13px] font-medium text-storm";

function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function todayDateInputValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
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
    grossAmount: "",
    deductions: [],
    frequency: "monthly",
    intervalCount: "1",
    dayOfMonth: "",
    dayOfWeek: "",
    startDate: "",
    nextExpectedDate: "",
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
    grossAmount: income.grossAmount == null ? "" : String(income.grossAmount),
    deductions: (income.deductions ?? []).map((row, index) => ({ key: String(index), name: row.name, amount: String(row.amount) })),
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

function Field({ children, errorKey, hint, invalidFields, label }: { children: ReactNode; errorKey?: string; hint?: string; invalidFields?: Set<string>; label: string }) {
  const hasError = !!errorKey && !!invalidFields?.has(errorKey);
  return (
    <label className="block min-w-0">
      <span className={labelClassName}>{label}</span>
      <div
        className={`mt-1.5${hasError ? " field-error-ring" : ""}`}
        data-field={errorKey}
      >
        {children}
      </div>
      {hint ? <p className="mt-1 break-words text-xs leading-5 text-storm">{hint}</p> : null}
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
  const [panel, setPanel] = useState<"main" | "details" | "breakdown">("main");

  useEffect(() => {
    if (!invalidFields.size) return;
    const firstField = [...invalidFields][0];
    setPanel(firstField === "startDate" ? "details" : "main");
    const timer = window.setTimeout(() => {
      const field = document.querySelector<HTMLElement>('[data-field="' + firstField + '"]');
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.querySelector<HTMLElement>("input,button")?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [invalidFields]);

  const counterpartyOptions = counterparties
    .filter((item) => !item.isArchived || String(item.id) === formState.payerPartyId)
    .map<PickerOption>((item) => ({ value: String(item.id), label: item.name, description: "", leadingLabel: item.name.slice(0, 2).toUpperCase() }));
  const accountOptions = accounts
    .filter((item) => !item.isArchived || String(item.id) === formState.accountId)
    .map<PickerOption>((item) => ({ value: String(item.id), label: item.name, description: item.currencyCode, leadingLabel: item.currencyCode }));
  const categoryOptions = categories
    .filter((item) => (item.isActive || String(item.id) === formState.categoryId) && (item.kind === "income" || item.kind === "both"))
    .map<PickerOption>((item) => ({ value: String(item.id), label: item.name, description: "", leadingLabel: item.name.slice(0, 2).toUpperCase() }));
  const frequencyPickerOptions = [...frequencyOptions.map<PickerOption>((item) => ({ value: item.value, label: item.label, description: item.description, leadingLabel: item.leadingLabel })), { value: "monthly_last", label: "Cada mes, el último día", description: "Se ajusta al último día de cada mes.", leadingLabel: "ME" }];
  const statusPickerOptions = statusOptions.map<PickerOption>((item) => ({ value: item.value, label: item.label, description: item.description, leadingLabel: item.leadingLabel }));
  const currencyPickerOptions = currencyOptions.map<PickerOption>((item) => ({ value: item.code, label: item.code, description: item.label, leadingLabel: item.symbol }));
  const needsDayOfWeek = formState.frequency === "weekly";
  const needsDayOfMonth = ["monthly", "quarterly", "yearly"].includes(formState.frequency);

  return (
    <Modal className={resourceEditorSurfaceClassName} disableOutsideClose={isSaving} labelledBy="income-editor-title" onClose={closeEditor}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
        <ResourceEditorHeader disabled={isSaving} onBack={panel === "breakdown" ? () => setPanel("details") : panel === "details" ? () => setPanel("main") : undefined} onClose={closeEditor} title={panel === "main" ? (isCreateMode ? "Nuevo ingreso fijo" : "Editar ingreso fijo") : panel === "breakdown" ? "Desglose" : "Detalles"} titleId="income-editor-title" />
        <div className="min-h-0 overflow-y-auto px-5 py-3 sm:px-7">
          {feedback?.tone === "error" ? <FormFeedbackBanner className="mb-5" description={feedback.description} title={feedback.title} tone="error" /> : null}
          {panel === "main" ? (
            <div className="space-y-2">
              <Field errorKey="amount" invalidFields={invalidFields} label={"Monto (" + getCurrencyLabel(formState.currencyCode || baseCurrencyCode).symbol + ")"}>
                <Input autoFocus className="h-14 font-display text-[2rem] font-semibold" data-modal-initial-focus inputMode="decimal" onChange={(event) => { clearFieldError("amount"); updateFormState("amount", event.target.value); }} placeholder="0.00" type="number" value={formState.amount} />
              </Field>
              <Field errorKey="name" invalidFields={invalidFields} label="Nombre">
                <Input maxLength={120} onChange={(event) => { clearFieldError("name"); updateFormState("name", event.target.value); }} placeholder="Ej. Sueldo mensual" value={formState.name} />
              </Field>
              <Field errorKey="accountId" invalidFields={invalidFields} label="Cuenta donde llegará"><SearchablePicker appearance="compact" emptyMessage="No hay cuentas." onChange={(value) => { clearFieldError("accountId"); updateFormState("accountId", value); }} options={accountOptions} placeholderDescription="Cuenta cuyo saldo aumentará al confirmar." placeholderLabel="Elige una cuenta" queryPlaceholder="Buscar cuenta..." value={formState.accountId} /></Field>
              <Field label="Frecuencia">
                <SearchablePicker appearance="compact" emptyMessage="No hay frecuencias." onChange={(value) => { updateFormState("frequency", value === "monthly_last" ? "monthly" : value as RecurringIncomeFrequency); if (value === "monthly_last") updateFormState("dayOfMonth", "31"); }} options={frequencyPickerOptions} placeholderDescription="Cada cuánto llega." placeholderLabel="Selecciona frecuencia" queryPlaceholder="Buscar frecuencia..." value={formState.frequency === "monthly" && formState.dayOfMonth === "31" ? "monthly_last" : formState.frequency} />
              </Field>
              <Field errorKey="nextExpectedDate" invalidFields={invalidFields} label="Próxima llegada">
                <DatePickerField appearance="compact" onChange={(value) => { clearFieldError("nextExpectedDate"); updateFormState("nextExpectedDate", value); if (value) { const date = new Date(`${value}T12:00:00Z`); if (["monthly", "quarterly", "yearly"].includes(formState.frequency) && formState.dayOfMonth !== "31") updateFormState("dayOfMonth", String(date.getUTCDate())); if (formState.frequency === "weekly") updateFormState("dayOfWeek", String(date.getUTCDay())); } }} value={formState.nextExpectedDate} />
              </Field>
              <ResourceEditorDestination onClick={() => setPanel("details")} summary="Pagador, desglose y calendario" />
            </div>
          ) : panel === "details" ? (
            <div className="space-y-5">
              <Field label="Pagador"><SearchablePicker appearance="compact" emptyMessage="No hay pagadores." onChange={(value) => updateFormState("payerPartyId", value)} options={counterpartyOptions} placeholderDescription="Persona o empresa." placeholderLabel="Sin pagador fijo" queryPlaceholder="Buscar pagador..." value={formState.payerPartyId} /></Field>
              <Field label="Categoría"><SearchablePicker appearance="compact" emptyMessage="No hay categorías de ingreso." onChange={(value) => updateFormState("categoryId", value)} options={categoryOptions} placeholderDescription="Categoría de ingreso." placeholderLabel="Sin categoría" queryPlaceholder="Buscar categoría..." value={formState.categoryId} /></Field>
              <ResourceEditorDestination label="Desglose" onClick={() => setPanel("breakdown")} summary={formState.grossAmount ? `Bruto ${formatCurrency(Number(formState.grossAmount) || 0, formState.currencyCode)}` : "Bruto y descuentos, si tienes boleta"} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Moneda"><SearchablePicker appearance="compact" emptyMessage="No hay monedas." onChange={(value) => updateFormState("currencyCode", value)} options={currencyPickerOptions} placeholderDescription="Moneda del ingreso." placeholderLabel="Moneda" queryPlaceholder="Buscar moneda..." value={formState.currencyCode} /></Field>
                <Field label="Cada cuántos ciclos"><Input inputMode="numeric" min="1" onChange={(event) => updateFormState("intervalCount", event.target.value)} placeholder="1" type="number" value={formState.intervalCount} /></Field>
              </div>
              <Field label="Inicio (opcional)"><DatePickerField appearance="compact" onChange={(value) => updateFormState("startDate", value)} value={formState.startDate} /></Field>
              {needsDayOfMonth ? <Field label="Día del mes"><Input inputMode="numeric" max="31" min="1" onChange={(event) => updateFormState("dayOfMonth", event.target.value)} placeholder="Sin día fijo" type="number" value={formState.dayOfMonth} /></Field> : null}
              {needsDayOfWeek ? <Field label="Día de la semana"><SearchablePicker appearance="compact" emptyMessage="No hay días." onChange={(value) => updateFormState("dayOfWeek", value)} options={weekdayOptions.map((item) => ({ value: item.value, label: item.label, description: item.description, leadingLabel: item.leadingLabel }))} placeholderDescription="Día habitual." placeholderLabel="Sin día fijo" queryPlaceholder="Buscar día..." value={formState.dayOfWeek} /></Field> : null}
              <Field label="Fin"><DatePickerField appearance="compact" onChange={(value) => updateFormState("endDate", value)} value={formState.endDate} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Estado"><SearchablePicker appearance="compact" emptyMessage="No hay estados." onChange={(value) => updateFormState("status", value as RecurringIncomeStatus)} options={statusPickerOptions} placeholderDescription="Estado del ingreso." placeholderLabel="Selecciona estado" queryPlaceholder="Buscar estado..." value={formState.status} /></Field>
                <Field label="Avisarme antes (días)"><Input inputMode="numeric" min="0" onChange={(event) => updateFormState("remindDaysBefore", event.target.value)} placeholder="3" type="number" value={formState.remindDaysBefore} /></Field>
              </div>
              <Field label="Descripción"><Textarea onChange={(event) => updateFormState("description", event.target.value)} placeholder="Contexto visible" value={formState.description} /></Field>
              <Field label="Notas"><Textarea onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Solo para este espacio" value={formState.notes} /></Field>
            </div>
          ) : (
            <div className="space-y-5">
              <p className="text-sm leading-6 text-storm">El neto es lo que llegará a la cuenta. Copia el bruto y los descuentos de tu boleta si quieres conservar el detalle; una diferencia no impide guardar.</p>
              <Field label={`Bruto (${getCurrencyLabel(formState.currencyCode).symbol})`}><Input inputMode="decimal" onChange={(event) => updateFormState("grossAmount", event.target.value)} placeholder="Opcional" value={formState.grossAmount} /></Field>
              <div className="space-y-3">
                <p className={labelClassName}>Descuentos</p>
                {formState.deductions.map((row) => <div className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2" key={row.key}><Input aria-label="Concepto" onChange={(event) => updateFormState("deductions", formState.deductions.map((item) => item.key === row.key ? { ...item, name: event.target.value } : item))} placeholder="Concepto" value={row.name} /><Input aria-label="Monto del descuento" inputMode="decimal" onChange={(event) => updateFormState("deductions", formState.deductions.map((item) => item.key === row.key ? { ...item, amount: event.target.value } : item))} placeholder="0.00" value={row.amount} /><button aria-label="Quitar descuento" className="px-2 text-storm hover:text-ink" onClick={() => updateFormState("deductions", formState.deductions.filter((item) => item.key !== row.key))} type="button">Quitar</button></div>)}
                <button className="text-sm text-ink underline underline-offset-4" onClick={() => updateFormState("deductions", [...formState.deductions, { key: crypto.randomUUID(), name: "", amount: "" }])} type="button">Añadir descuento</button>
              </div>
              {formState.grossAmount ? <p className="border-t border-white/[0.08] pt-4 text-sm text-storm">Bruto menos descuentos: {formatCurrency((Number(formState.grossAmount) || 0) - formState.deductions.reduce((sum, row) => sum + (Number(row.amount) || 0), 0), formState.currencyCode)} · Neto declarado: {formatCurrency(Number(formState.amount) || 0, formState.currencyCode)}</p> : null}
            </div>
          )}
        </div>
        <footer className="shrink-0 border-t border-white/[0.08] px-5 py-4 sm:px-7">
          <Button className="w-full" disabled={isSaving} type="submit">{isSaving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : isCreateMode ? "Crear ingreso fijo" : "Guardar cambios"}</Button>
        </footer>
      </form>
    </Modal>
  );
}

function ConfirmArrivalDialog({
  income,
  accounts,
  initialDate,
  onClose,
  onConfirm,
  isSaving,
}: {
  income: RecurringIncomeSummary;
  accounts: AccountSummary[];
  initialDate?: string;
  onClose: () => void;
  onConfirm: (input: Omit<ConfirmArrivalInput, "workspaceId" | "userId">) => Promise<void>;
  isSaving: boolean;
}) {
  const [panel, setPanel] = useState<"main" | "details">("main");
  const [actualDate, setActualDate] = useState(initialDate ?? todayDateInputValue());
  const [actualAmount, setActualAmount] = useState(String(income.amount));
  const [notes, setNotes] = useState("");
  const [accountId, setAccountId] = useState(income.accountId ? String(income.accountId) : "");
  const [baseChangeMode, setBaseChangeMode] = useState<"once" | "forever">("once");
  const [error, setError] = useState<string | null>(null);
  const accountOptions = accounts.filter((item) => !item.isArchived || String(item.id) === accountId).map<PickerOption>((item) => ({
    value: String(item.id), label: item.name, description: item.currencyCode, leadingLabel: item.currencyCode,
  }));
  const nextExpectedDate = advanceNextExpectedDate(income);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!actualDate) {
      setPanel("main");
      setError("Indica la fecha real de llegada.");
      return;
    }
    const amount = parseOptionalNumber(actualAmount);
    if (amount === null || !Number.isFinite(amount) || amount <= 0) {
      setPanel("details");
      setError("Indica un monto recibido mayor que cero.");
      return;
    }
    if (!accountId) {
      setPanel("main");
      setError("Elige la cuenta donde llegó el dinero.");
      return;
    }
    setError(null);
    try {
      await onConfirm({
      recurringIncomeId: income.id,
      expectedDate: income.nextExpectedDate,
      actualDate,
      amount,
      currencyCode: income.currencyCode,
      accountId: Number(accountId),
      currentAccountId: income.accountId ?? null,
      categoryId: income.categoryId ?? null,
      payerPartyId: income.payerPartyId ?? null,
      recurringIncomeName: income.name,
      description: income.description ?? null,
      currentBaseAmount: income.amount,
      newBaseAmount: baseChangeMode === "forever" && Math.abs(amount - income.amount) > 0.000001 ? amount : null,
      notes,
      nextExpectedDate,
      });
    } catch (failure) {
      setError(getQueryErrorMessage(failure, "Intenta nuevamente."));
    }
  }

  return (
    <Modal className={resourceEditorSurfaceClassName} disableOutsideClose={isSaving} labelledBy="income-arrival-title" onClose={onClose}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={handleSubmit}>
        <ResourceEditorHeader disabled={isSaving} onBack={panel === "details" ? () => setPanel("main") : undefined} onClose={onClose} title={panel === "main" ? "Confirmar llegada" : "Llegó distinto"} titleId="income-arrival-title" />
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
          {error ? <FormFeedbackBanner className="mb-5" description={error} title="Revisa la fecha" tone="error" /> : null}
          {panel === "main" ? (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-ink">{income.name}</p>
                <p className="mt-1 text-sm text-storm">Esperado el {formatDate(income.nextExpectedDate)} · {formatCurrency(income.amount, income.currencyCode)}</p>
              </div>
              <Field label="Fecha real de llegada"><DatePickerField appearance="compact" onChange={setActualDate} value={actualDate} /></Field>
              <Field label="Cuenta donde llegó"><SearchablePicker appearance="compact" emptyMessage="No hay cuentas disponibles." onChange={setAccountId} options={accountOptions} placeholderDescription="El ingreso afectará el saldo de esta cuenta." placeholderLabel="Elige una cuenta" queryPlaceholder="Buscar cuenta..." value={accountId} /></Field>
              <p className="border-t border-white/[0.08] pt-4 text-sm text-storm">La siguiente llegada quedará para el <span className="text-ink">{formatDate(nextExpectedDate)}</span>.</p>
              <ResourceEditorDestination label="Llegó distinto" onClick={() => setPanel("details")} summary="Monto y notas" />
            </div>
          ) : (
            <div className="space-y-5">
              <Field label={"Monto recibido (" + getCurrencyLabel(income.currencyCode).symbol + ")"}><Input inputMode="decimal" onChange={(event) => { setError(null); setActualAmount(event.target.value); }} placeholder="0.00" type="number" value={actualAmount} /></Field>
              {parseOptionalNumber(actualAmount) !== income.amount ? <fieldset className="space-y-2"><legend className={labelClassName}>¿Qué cambia?</legend><label className="flex items-center gap-3 text-sm text-ink"><input checked={baseChangeMode === "once"} className="accent-[#e5e0d6]" name="baseChangeMode" onChange={() => setBaseChangeMode("once")} type="radio" />Solo esta llegada</label><label className="flex items-center gap-3 text-sm text-ink"><input checked={baseChangeMode === "forever"} className="accent-[#e5e0d6]" name="baseChangeMode" onChange={() => setBaseChangeMode("forever")} type="radio" />Desde ahora, esperar este monto</label></fieldset> : null}
              <Field label="Notas"><Textarea onChange={(event) => setNotes(event.target.value)} placeholder="Contexto de esta llegada" value={notes} /></Field>
            </div>
          )}
        </div>
        <footer className="shrink-0 border-t border-white/[0.08] px-5 py-4 sm:px-7"><Button className="w-full" disabled={isSaving} type="submit">{isSaving ? "Confirmando..." : "Confirmar llegada"}</Button></footer>
      </form>
    </Modal>
  );
}
function getOccurrenceStatusLabel(status: RecurringIncomeOccurrence["status"]) {
  switch (status) {
    case "on_time": return "A tiempo";
    case "late": return "Con demora";
    case "missed": return "No llegó";
  }
}

function HistoryDialog({
  income,
  workspaceId,
  onClose,
  onConfirm,
  onOpenMovement,
}: {
  income: RecurringIncomeSummary;
  workspaceId: number;
  onClose: () => void;
  onConfirm: (date: string) => void;
  onOpenMovement: (movementId: number) => void;
}) {
  const [view, setView] = useState<"history" | "analytics">("history");
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<"all" | "on_time" | "late">("all");
  const occurrencesQuery = useRecurringIncomeOccurrencesQuery(workspaceId, income.id);
  const occurrences = occurrencesQuery.data ?? [];
  const pending = pendingArrivalDates(income, todayDateInputValue());
  const received = occurrences.reduce((sum, row) => sum + row.amount, 0);
  const onTimeCount = occurrences.filter((row) => row.status === "on_time").length;
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() - 11 + index);
    const key = date.toISOString().slice(0, 7);
    return { key, label: new Intl.DateTimeFormat("es-PE", { month: "short" }).format(date), amount: occurrences.filter((row) => row.actualDate?.startsWith(key)).reduce((sum, row) => sum + row.amount, 0) };
  });
  const maxMonth = Math.max(1, ...months.map((month) => month.amount));
  const monthKey = selectedMonthKey ?? [...months].reverse().find((month) => month.amount > 0)?.key ?? months[11].key;
  const selectedMonth = months.find((month) => month.key === monthKey)!;
  const monthOccurrences = occurrences.filter((row) => row.actualDate?.startsWith(monthKey));
  const filteredTimeline = occurrences.filter((row) => timelineFilter === "all" || row.status === timelineFilter);
  const lateDays = occurrences.filter((row) => row.status === "late" && row.actualDate).map((row) => Math.max(0, Math.round((Date.parse(row.actualDate!) - Date.parse(row.expectedDate)) / 86_400_000)));
  const averageLateDays = lateDays.length ? lateDays.reduce((sum, days) => sum + days, 0) / lateDays.length : 0;

  return (
    <Modal className="!max-w-2xl !bg-[#1a1917]" labelledBy="income-history-title" onClose={onClose}>
      <ModalHeader description={getFrequencyOption(income.frequency).label} onClose={onClose} title={income.name} titleId="income-history-title" />
      <div className="min-h-0 space-y-5 overflow-y-auto px-6 py-5">
        <div><p className="text-2xl font-semibold tabular-nums text-ink">{formatCurrency(income.amount, income.currencyCode)}</p><p className="mt-1 text-sm text-storm">Próxima llegada: {formatDate(income.nextExpectedDate)}{income.accountName ? ` · ${income.accountName}` : ""}</p></div>
        {income.grossAmount != null ? <p className="border-t border-white/[0.08] pt-4 text-sm text-storm">Bruto {formatCurrency(income.grossAmount, income.currencyCode)}{income.deductions?.length ? ` · ${income.deductions.map((row) => `${row.name} ${formatCurrency(row.amount, income.currencyCode)}`).join(" · ")}` : ""}</p> : null}
        {income.description || income.notes ? <p className="text-sm leading-6 text-storm">{[income.description, income.notes].filter(Boolean).join(" · ")}</p> : null}
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-y border-white/[0.08] py-4 text-sm text-storm"><span>{occurrences.length} llegadas visibles</span><span>Recibido en este historial: <strong className="text-ink">{formatCurrency(received, income.currencyCode)}</strong></span>{occurrences.length ? <span>{onTimeCount} a tiempo</span> : null}</div>
        <div className="flex gap-5 border-b border-white/[0.08] text-sm"><button aria-current={view === "history" ? "page" : undefined} className={`pb-3 ${view === "history" ? "border-b border-ink text-ink" : "text-storm"}`} onClick={() => setView("history")} type="button">Llegadas</button><button aria-current={view === "analytics" ? "page" : undefined} className={`pb-3 ${view === "analytics" ? "border-b border-ink text-ink" : "text-storm"}`} onClick={() => setView("analytics")} type="button">Análisis</button></div>
        {view === "analytics" ? <div className="space-y-5">
          <p className="text-sm text-storm">Importes recibidos en los últimos 12 meses. Solo incluye llegadas confirmadas.</p>
          <div className="flex h-40 items-end gap-2 border-b border-white/[0.08] pb-2">{months.map((month) => <button aria-label={`${month.label}: ${formatCurrency(month.amount, income.currencyCode)}`} aria-pressed={monthKey === month.key} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2 focus-visible:outline focus-visible:outline-1 focus-visible:outline-white" key={month.key} onClick={() => setSelectedMonthKey(month.key)} type="button"><span className={`w-full max-w-8 rounded-t ${monthKey === month.key ? "bg-[#f9f7f3]" : "bg-[#b2aca1]"}`} style={{ height: `${month.amount ? Math.max(4, month.amount / maxMonth * 110) : 1}px`, opacity: month.amount ? 1 : 0.15 }} /><span className="truncate text-[10px] text-storm">{month.label}</span></button>)}</div>
          <p className="text-sm text-storm">{selectedMonth.label} · <strong className="text-ink">{formatCurrency(selectedMonth.amount, income.currencyCode)}</strong> en {monthOccurrences.length} {monthOccurrences.length === 1 ? "llegada" : "llegadas"}.</p>
          <div className="grid gap-3 border-y border-white/[0.08] py-4 text-sm text-storm sm:grid-cols-2"><p>Promedio recibido: <strong className="text-ink">{formatCurrency(occurrences.length ? received / occurrences.length : 0, income.currencyCode)}</strong></p><p>Llegada mayor: <strong className="text-ink">{formatCurrency(Math.max(0, ...occurrences.map((row) => row.amount)), income.currencyCode)}</strong></p><p>A tiempo: <strong className="text-ink">{occurrences.length ? Math.round(onTimeCount / occurrences.length * 100) : 0} %</strong></p><p>Demora media: <strong className="text-ink">{averageLateDays.toFixed(1)} días</strong></p></div>
          <div className="flex gap-2 text-xs">{(["all", "on_time", "late"] as const).map((filter) => <button aria-pressed={timelineFilter === filter} className={`rounded-lg border px-3 py-1.5 ${timelineFilter === filter ? "border-white/50 text-ink" : "border-white/[0.08] text-storm"}`} key={filter} onClick={() => setTimelineFilter(filter)} type="button">{filter === "all" ? "Todas" : filter === "on_time" ? "A tiempo" : "Con demora"}</button>)}</div>
          <div className="divide-y divide-white/[0.08]">{filteredTimeline.slice(0, 20).map((row) => <div className="flex justify-between gap-4 py-3 text-sm" key={row.id}><span className="text-storm">{formatDate(row.actualDate ?? row.expectedDate)} · {getOccurrenceStatusLabel(row.status)}</span><span className="tabular-nums text-ink">{formatCurrency(row.amount, row.currencyCode)}</span></div>)}{filteredTimeline.length === 0 ? <p className="py-3 text-sm text-storm">No hay llegadas en este grupo.</p> : null}</div>
        </div> : occurrencesQuery.isLoading ? <div className="space-y-2 py-4">{Array.from({ length: 3 }).map((_, index) => <div className="h-16 animate-pulse rounded-lg bg-white/[0.04]" key={index} />)}</div>
        : <>{pending.map((date, index) => <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] py-3" key={date}><div><p className="text-sm font-medium text-ink">{formatDate(date)}</p><p className="text-xs text-storm">{index === 0 ? "Sin confirmar · la más antigua" : `Sin confirmar · después del ${formatDate(pending[index - 1])}`}</p></div>{index === 0 ? <Button onClick={() => onConfirm(date)} variant="secondary">Anotar llegada</Button> : null}</div>)}{occurrences.length === 0 && pending.length === 0 ? <p className="py-6 text-sm text-storm">Aún no hay llegadas para mostrar.</p> : null}{occurrences.map((occurrence) => (
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] py-4 last:border-0" key={occurrence.id}>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{formatDate(occurrence.expectedDate)}</p>
              <p className="mt-1 text-xs text-storm">{occurrence.actualDate ? "Recibido el " + formatDate(occurrence.actualDate) : "Sin fecha de llegada"} · {getOccurrenceStatusLabel(occurrence.status)}</p>
              {occurrence.notes ? <p className="mt-1 truncate text-xs text-storm">{occurrence.notes}</p> : null}
              {occurrence.movementId ? <button className="mt-1 text-xs text-ink underline underline-offset-4" onClick={() => onOpenMovement(occurrence.movementId!)} type="button">Ver movimiento</button> : null}
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatCurrency(occurrence.amount, occurrence.currencyCode)}</p>
          </div>
        ))}</>}
      </div>
    </Modal>
  );
}
function RecurringIncomeLoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="shimmer-surface h-14 rounded-xl" />
      <div className="shimmer-surface h-12 rounded-xl" />
      {Array.from({ length: 5 }).map((_, index) => <div className="shimmer-surface h-[76px] rounded-lg" key={index} />)}
    </div>
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
  const headers = ["Nombre", "Pagador", "Estado", "Monto", "Moneda", "Frecuencia", "Categoría", "Cuenta", "Inicio", "Próxima llegada", "Fin", "Descripción", "Notas"];
  const rows = items.map((r) => [
    escapeCSV(r.name),
    escapeCSV(r.payer),
    escapeCSV(getStatusOption(r.status).label),
    escapeCSV(r.amount),
    escapeCSV(r.currencyCode),
    escapeCSV(getFrequencyOption(r.frequency).label),
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
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const snapshot = snapshotQuery.data;
  const createMutation = useCreateRecurringIncomeMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateRecurringIncomeMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteRecurringIncomeMutation(activeWorkspace?.id, user?.id);
  const confirmMutation = useConfirmRecurringIncomeArrivalMutation(activeWorkspace?.id, user?.id);
  const flagsMutation = useSetRecurringIncomeFlagsMutation(activeWorkspace?.id, user?.id);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  useSuccessToast(feedback, {
    clear: () => setFeedback(null),
  });
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
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
  const [confirmDate, setConfirmDate] = useState<string | undefined>(undefined);
  const [historyIncomeId, setHistoryIncomeId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  const {
    filters: incomeFilters,
    currentPage,
    setCurrentPage,
    updateFilter: updateIncomeFilter,
    updateFilters: updateIncomeFilters,
    clearFilters: clearIncomeFilters,
  } = useRecurringIncomeFilters();
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

  const hasActiveFilters =
    incomeFilters.name.trim() !== "" ||
    incomeFilters.payer.trim() !== "" ||
    incomeFilters.category.trim() !== "" ||
    incomeFilters.account.trim() !== "" ||
    incomeFilters.amount.trim() !== "" ||
    incomeFilters.nextExpectedDateFrom !== "" ||
    incomeFilters.nextExpectedDateTo !== "" ||
    incomeFilters.frequency !== "all" ||
    incomeFilters.status !== "all" ||
    incomeFilters.selectedStatuses.length > 0 ||
    incomeFilters.pinnedOnly ||
    incomeFilters.upcomingOnly;
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
          (r.payer ?? "").toLowerCase().includes(normalizedName) ||
          (r.categoryName ?? "").toLowerCase().includes(normalizedName) ||
          (r.accountName ?? "").toLowerCase().includes(normalizedName) ||
          (r.description ?? "").toLowerCase().includes(normalizedName) ||
          (r.notes ?? "").toLowerCase().includes(normalizedName),
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
    if (incomeFilters.selectedStatuses.length > 0) {
      result = result.filter((r) => incomeFilters.selectedStatuses.includes(r.status));
    } else if (incomeFilters.status !== "all") {
      result = result.filter((r) => r.status === incomeFilters.status);
    }
    if (incomeFilters.pinnedOnly) result = result.filter((r) => r.isPinned);
    if (incomeFilters.upcomingOnly) {
      const today = todayDateInputValue();
      const limit = new Date(`${today}T12:00:00Z`);
      limit.setUTCDate(limit.getUTCDate() + 30);
      const through = limit.toISOString().slice(0, 10);
      result = result.filter((r) => r.nextExpectedDate >= today && r.nextExpectedDate <= through);
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
    const today = todayDateInputValue();
    const rank = (item: RecurringIncomeSummary) => item.status === "active" ? (item.nextExpectedDate < today ? 0 : 1) : item.status === "paused" ? 2 : 3;
    return [...result].sort((a, b) => rank(a) - rank(b) || Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)) || a.nextExpectedDate.localeCompare(b.nextExpectedDate));
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
    const activeAccountIds = new Set(accounts.filter((item) => !item.isArchived).map((item) => item.id));
    const counts = new Map<number, number>();
    for (const movement of snapshot?.movements ?? []) {
      if (movement.movementType !== "income" || !movement.destinationAccountId || !activeAccountIds.has(movement.destinationAccountId)) continue;
      counts.set(movement.destinationAccountId, (counts.get(movement.destinationAccountId) ?? 0) + 1);
    }
    const topAccountId = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? (activeAccountIds.size === 1 ? [...activeAccountIds][0] : null);
    setFormState({ ...createDefaultFormState(baseCurrencyCode), accountId: topAccountId ? String(topAccountId) : "" });
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
  const [isBulkPausing, setIsBulkPausing] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const todayDate = todayDateInputValue();
  const overdueCount = recurringIncome.filter((item) => item.status === "active" && item.nextExpectedDate < todayDate).length;
  const dueSoonCount = recurringIncome.filter((r) => {
    if (r.status !== "active") return false;
    const differenceInDays = (Date.parse(r.nextExpectedDate) - Date.parse(todayDate)) / 86_400_000;
    return differenceInDays >= 0 && differenceInDays <= 7;
  }).length;
  const nextIncome = [...recurringIncome]
    .filter((item) => item.status === "active" && item.nextExpectedDate >= todayDate)
    .sort((left, right) => left.nextExpectedDate.localeCompare(right.nextExpectedDate))[0] ?? null;
  const activeInFilter = filteredIncome.filter((item) => item.status === "active").length;
  const monthlyTotal = filteredIncome.filter((item) => item.status === "active").reduce((sum, item) => sum + monthlyEquivalent(item), 0);
  const unconvertedCount = filteredIncome.filter((item) => item.status === "active" && item.amountInBaseCurrency == null).length;
  const missedArrivals = recurringIncome.reduce((sum, item) => sum + pendingArrivalDates(item, todayDate).length, 0);
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
        title: "No encontramos el espacio activo",
        description: "Recarga la página e intenta nuevamente.",
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
    const grossAmount = parseOptionalNumber(formState.grossAmount.replace(",", "."));

    const subErrors: string[] = [];
    if (!name) subErrors.push("name");
    if (amount === null || Number.isNaN(amount) || amount <= 0) subErrors.push("amount");
    if (!formState.accountId) subErrors.push("accountId");
    if (!formState.nextExpectedDate) subErrors.push("nextExpectedDate");
    if (subErrors.length > 0) {
      setInvalidFields(new Set(subErrors));
      setFeedback({
        tone: "error",
        title: "Revisa los campos requeridos",
        description: "Completa los campos indicados antes de guardar.",
      });
      return;
    }

    if (intervalCount === null || Number.isNaN(intervalCount) || intervalCount <= 0) {
      setFeedback({
        tone: "error",
        title: "Intervalo inválido",
        description: "Indica un intervalo mayor que cero.",
      });
      return;
    }

    if (formState.grossAmount.trim() && (grossAmount === null || !Number.isFinite(grossAmount) || grossAmount <= 0)) {
      setFeedback({ tone: "error", title: "Bruto inválido", description: "El monto bruto debe ser mayor que cero, o puedes dejarlo vacío." });
      return;
    }

    const effectiveStartDate = formState.startDate || formState.nextExpectedDate;
    if (formState.nextExpectedDate < effectiveStartDate) {
      setFeedback({
        tone: "error",
        title: "La fecha no cuadra",
        description: "La próxima llegada no puede ser anterior al inicio.",
      });
      return;
    }

    if (formState.endDate && formState.endDate < effectiveStartDate) {
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
        title: "Día del mes inválido",
        description: "Si lo completas, debe estar entre 1 y 31.",
      });
      return;
    }

    if (dayOfWeek !== null && (Number.isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6)) {
      setFeedback({
        tone: "error",
        title: "Día de la semana inválido",
        description: "Si lo completas, debe estar entre 0 y 6.",
      });
      return;
    }

    if (remindDaysBefore === null || Number.isNaN(remindDaysBefore) || remindDaysBefore < 0) {
      setFeedback({
        tone: "error",
        title: "Recordatorio inválido",
        description: "Indica cero o un número positivo de días.",
      });
      return;
    }

    if (payerPartyId !== null && Number.isNaN(payerPartyId)) {
      setFeedback({
        tone: "error",
        title: "Pagador inválido",
        description: "Vuelve a seleccionar el pagador si deseas asociarlo.",
      });
      return;
    }

    if (accountId === null || Number.isNaN(accountId)) {
      setFeedback({
        tone: "error",
        title: "Cuenta inválida",
        description: "Vuelve a seleccionar la cuenta sugerida.",
      });
      return;
    }

    if (categoryId !== null && Number.isNaN(categoryId)) {
      setFeedback({
        tone: "error",
        title: "Categoría inválida",
        description: "Vuelve a seleccionar la categoría contable.",
      });
      return;
    }

    const payload: RecurringIncomeFormInput = {
      name,
      payerPartyId: payerPartyId === null ? null : payerPartyId,
      accountId,
      categoryId: categoryId === null ? null : categoryId,
      currencyCode: formState.currencyCode.trim().toUpperCase() || baseCurrencyCode,
      amount: amount!,
      grossAmount,
      deductions: formState.deductions.filter((row) => row.name.trim() && Number(row.amount.replace(",", ".")) > 0).map((row) => ({ name: row.name.trim().slice(0, 60), amount: Number(Number(row.amount.replace(",", ".")).toFixed(2)) })),
      frequency: formState.frequency,
      intervalCount: intervalCount!,
      dayOfMonth: dayOfMonth === null ? null : dayOfMonth,
      dayOfWeek: dayOfWeek === null ? null : dayOfWeek,
      startDate: effectiveStartDate,
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
          title: "Ingreso fijo registrado",
          description: "Ya aparece en la lista de ingresos fijos.",
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
          description: "El ingreso fijo se actualizó correctamente.",
        });
      }

      setIsEditorOpen(false);
      setSelectedIncomeId(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No pudimos guardar el ingreso fijo",
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
      label: "Ingreso fijo eliminado",
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
        description: `La próxima llegada se actualizó automáticamente a ${formatDate(input.nextExpectedDate)}.`,
      });
    } catch (err) {
      setFeedback({
        tone: "error",
        title: "No se pudo confirmar la llegada",
        description: getQueryErrorMessage(err, "Intenta nuevamente."),
      });
      throw err;
    }
  }

  async function handleBulkPause() {
    const active = selectedItems.filter((item) => item.status === "active");
    if (!active.length) return;
    setIsBulkPausing(true);
    try {
      for (const item of active) await flagsMutation.mutateAsync({ recurringIncomeId: item.id, patch: { status: "paused" } });
      clearAll();
      setFeedback({ tone: "success", title: "Ingresos pausados", description: `${active.length} ${active.length === 1 ? "ingreso quedó" : "ingresos quedaron"} en pausa.` });
    } catch (error) {
      setFeedback({ tone: "error", title: "No se pudieron pausar todos", description: getQueryErrorMessage(error) });
    } finally {
      setIsBulkPausing(false);
    }
  }

  async function setIncomeFlag(income: RecurringIncomeSummary, patch: { is_pinned?: boolean; status?: RecurringIncomeStatus }) {
    try {
      await flagsMutation.mutateAsync({ recurringIncomeId: income.id, patch });
    } catch (error) {
      setFeedback({ tone: "error", title: "No se pudo actualizar el ingreso", description: getQueryErrorMessage(error) });
    }
  }

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos preparando los ingresos fijos del espacio activo." eyebrow="ingresos fijos" title="Cargando ingresos fijos" />
        <RecurringIncomeLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Necesitamos acceder al espacio activo." eyebrow="ingresos fijos" title="Ingresos fijos no disponibles" />
        <DataState description={getQueryErrorMessage(workspaceError, "No pudimos abrir tu espacio actual.")} title="No hay acceso al espacio" tone="error" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Cuando tengas un espacio activo, aquí verás tus ingresos fijos." eyebrow="ingresos fijos" title="Aún no hay un espacio activo" />
        <DataState description="Activa o crea un espacio para comenzar a registrar ingresos fijos." title="Sin ingresos fijos para mostrar" />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos cargando tus ingresos fijos y sus próximas llegadas." eyebrow="ingresos fijos" title="Cargando ingresos fijos" />
        <RecurringIncomeLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Intentamos recuperar el estado actual de tus ingresos fijos." eyebrow="ingresos fijos" title="No fue posible cargar la información" />
        <DataState description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer tus ingresos fijos actuales.")} title="Error al cargar ingresos fijos" tone="error" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="module-header">
        <div className="min-w-0 flex-1 basis-[15rem]">
          <h1 className="module-heading">Ingresos fijos</h1>
          <p className="mt-1.5 text-sm leading-6 text-storm">
            {recurringIncome.length} {recurringIncome.length === 1 ? "registrado" : "registrados"} · {missedArrivals > 0 ? `${missedArrivals} ${missedArrivals === 1 ? "llegada sin confirmar" : "llegadas sin confirmar"} en ${overdueCount} ${overdueCount === 1 ? "ingreso" : "ingresos"}` : dueSoonCount > 0 ? `${dueSoonCount} ${dueSoonCount === 1 ? "llega" : "llegan"} en los próximos 7 días` : nextIncome ? `siguiente llegada el ${formatDate(nextIncome.nextExpectedDate)}` : "sin llegadas próximas"}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button data-tour="create-recurring-income" onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" /><span className="sm:hidden">Nuevo</span><span className="hidden sm:inline">Nuevo ingreso</span></Button>
          <div className="relative">
            <button aria-expanded={isActionsMenuOpen} aria-label="Más acciones" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-storm transition hover:bg-white/[0.04] hover:text-ink" onClick={() => setIsActionsMenuOpen((value) => !value)} type="button"><MoreVertical className="h-4 w-4" /></button>
            {isActionsMenuOpen ? (
              <>
                <button aria-label="Cerrar acciones" className="fixed inset-0 z-30 cursor-default" onClick={() => setIsActionsMenuOpen(false)} type="button" />
                <div className="absolute right-0 top-12 z-40 min-w-52 overflow-hidden rounded-xl border border-white/[0.1] bg-[#1b1a18] py-1">
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={snapshotQuery.isFetching} onClick={() => { setIsActionsMenuOpen(false); snapshotQuery.refetch(); }} type="button"><RefreshCw className={snapshotQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Actualizar</button>
                  <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={!filteredIncome.length} onClick={() => { setIsActionsMenuOpen(false); downloadRecurringIncomeCSV(filteredIncome, "ingresos-fijos-" + new Date().toISOString().slice(0, 10) + ".csv"); }} type="button"><Download className="h-4 w-4" />Exportar los {filteredIncome.length}</button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </section>

      <section aria-label="Filtros de ingresos fijos">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto]">
          <input aria-label="Buscar ingresos fijos" className="field-dark !h-14" onChange={(event) => updateIncomeFilter("name", event.target.value)} placeholder="Buscar por nombre, pagador o categoría..." type="search" value={incomeFilters.name} />
          <SearchablePicker appearance="toolbar" emptyMessage="No hay estados." onChange={(value) => { if (value !== "multiple") updateIncomeFilters({ status: value as "all" | RecurringIncomeStatus, selectedStatuses: [] }); }} options={incomeFilters.selectedStatuses.length > 1 ? [{ value: "multiple", label: "Varios estados", description: "Filtra por los estados marcados abajo.", leadingLabel: "VA" }, ...statusFilterPickerOptions] : statusFilterPickerOptions} placeholderDescription="Estado" placeholderLabel="Todos los estados" queryPlaceholder="Buscar estado..." showSearch={false} value={incomeFilters.selectedStatuses.length > 1 ? "multiple" : incomeFilters.selectedStatuses[0] ?? incomeFilters.status} />
          <SearchablePicker appearance="toolbar" emptyMessage="No hay frecuencias." onChange={(value) => updateIncomeFilter("frequency", value as "all" | RecurringIncomeFrequency)} options={frequencyFilterPickerOptions} placeholderDescription="Frecuencia" placeholderLabel="Todas las frecuencias" queryPlaceholder="Buscar frecuencia..." showSearch={false} value={incomeFilters.frequency} />
          <button aria-expanded={showMoreFilters} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm text-storm transition hover:text-ink" onClick={() => setShowMoreFilters((value) => !value)} type="button"><SlidersHorizontal className="h-4 w-4" />Más filtros</button>
        </div>
        {showMoreFilters ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <fieldset className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.1] px-4 py-3 sm:col-span-2 xl:col-span-3"><legend className="px-1 text-xs text-storm">Estados combinados</legend>{statusOptions.map((option) => { const checked = incomeFilters.selectedStatuses.length ? incomeFilters.selectedStatuses.includes(option.value) : incomeFilters.status === option.value; return <label className="flex items-center gap-2 text-sm text-ink" key={option.value}><input checked={checked} className="accent-[#e5e0d6]" onChange={() => { const current = incomeFilters.selectedStatuses.length ? incomeFilters.selectedStatuses : incomeFilters.status === "all" ? [] : [incomeFilters.status]; const next = checked ? current.filter((value) => value !== option.value) : [...current, option.value]; updateIncomeFilters({ status: "all", selectedStatuses: next }); }} type="checkbox" />{option.label}</label>; })}</fieldset>
            <label className="flex h-14 items-center gap-3 rounded-xl border border-white/[0.1] px-4 text-sm text-ink"><input checked={incomeFilters.pinnedOnly} className="accent-[#e5e0d6]" onChange={(event) => updateIncomeFilter("pinnedOnly", event.target.checked)} type="checkbox" />Solo fijados</label>
            <label className="flex h-14 items-center gap-3 rounded-xl border border-white/[0.1] px-4 text-sm text-ink"><input checked={incomeFilters.upcomingOnly} className="accent-[#e5e0d6]" onChange={(event) => updateIncomeFilter("upcomingOnly", event.target.checked)} type="checkbox" />Próximos 30 días</label>
            <SearchablePicker appearance="toolbar" emptyMessage="No hay pagadores." onChange={(value) => updateIncomeFilter("payer", value)} options={[{ value: "", label: "Todos los pagadores", description: "", leadingLabel: "—" }, ...recurringIncomePayers.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Pagador" placeholderLabel="Todos los pagadores" queryPlaceholder="Buscar pagador..." value={incomeFilters.payer} />
            <SearchablePicker appearance="toolbar" emptyMessage="No hay categorías." onChange={(value) => updateIncomeFilter("category", value)} options={[{ value: "", label: "Todas las categorías", description: "", leadingLabel: "—" }, ...recurringIncomeCategories.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Categoría" placeholderLabel="Todas las categorías" queryPlaceholder="Buscar categoría..." value={incomeFilters.category} />
            <SearchablePicker appearance="toolbar" emptyMessage="No hay cuentas." onChange={(value) => updateIncomeFilter("account", value)} options={[{ value: "", label: "Todas las cuentas", description: "", leadingLabel: "—" }, ...recurringIncomeAccounts.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Cuenta" placeholderLabel="Todas las cuentas" queryPlaceholder="Buscar cuenta..." value={incomeFilters.account} />
            <input aria-label="Filtrar por monto" className="field-dark !h-14" onChange={(event) => updateIncomeFilter("amount", event.target.value)} placeholder="Monto" type="search" value={incomeFilters.amount} />
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
              <div><p className="mb-1.5 text-[13px] font-medium text-storm">Llegada desde</p><DatePickerField appearance="compact" onChange={(value) => updateIncomeFilter("nextExpectedDateFrom", value)} value={incomeFilters.nextExpectedDateFrom} /></div>
              <div><p className="mb-1.5 text-[13px] font-medium text-storm">Llegada hasta</p><DatePickerField appearance="compact" onChange={(value) => updateIncomeFilter("nextExpectedDateTo", value)} value={incomeFilters.nextExpectedDateTo} /></div>
            </div>
          </div>
        ) : null}
        {hasActiveFilters ? <button className="mt-2 text-xs text-storm underline-offset-4 hover:text-ink hover:underline" onClick={clearIncomeFilters} type="button">Limpiar filtros</button> : null}
      </section>

      <section aria-label="Resumen de ingresos filtrados" className="module-summary">
        <span><span className="font-semibold text-ink">{filteredIncome.length}</span> {filteredIncome.length === 1 ? "ingreso" : "ingresos"} en esta vista{activeInFilter !== filteredIncome.length ? ` · ${activeInFilter} activos` : ""}</span>
        <span>{unconvertedCount ? "Esperado al mes: conversión pendiente" : <>Esperado al mes <strong className="text-ink">{formatCurrency(monthlyTotal, baseCurrencyCode)}</strong></>}</span>
      </section>

      {feedback && feedback.tone !== "error" && !isEditorOpen ? <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

      {recurringIncome.length === 0 ? (
        <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Crear primer ingreso</Button>} description="Aún no hay ingresos fijos registrados en este espacio." title="Sin ingresos fijos" />
      ) : filteredIncome.length === 0 ? (
        <DataState action={hasActiveFilters ? <Button onClick={clearIncomeFilters} variant="secondary">Quitar filtros</Button> : undefined} description="No hay ingresos que coincidan con los filtros." title="Sin resultados" />
      ) : (
        <RecurringIncomeList allSelected={allSelected} income={paginatedIncome} onClearAll={clearAll} onConfirm={(id) => { setConfirmDate(undefined); setConfirmIncomeId(id); }} onDelete={setDeleteTargetId} onEdit={openEditEditor} onHistory={setHistoryIncomeId} onPause={(income) => void setIncomeFlag(income, { status: income.status === "active" ? "paused" : "active" })} onPin={(income) => void setIncomeFlag(income, { is_pinned: !income.isPinned })} onSelectAll={selectAll} onToggleSelect={toggleSelect} selectedIds={selectedIds} someSelected={someSelected} />
      )}
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
        <Modal className="!max-w-md !bg-[#1a1917]" disableOutsideClose={isDeleting} labelledBy="income-delete-title" onClose={() => { if (!isDeleting) setDeleteTargetId(null); }}>
          <ModalHeader description="Podrás deshacerlo durante unos segundos." onClose={() => setDeleteTargetId(null)} title="¿Eliminar ingreso fijo?" titleId="income-delete-title" />
          <div className="px-6 py-5"><p className="font-semibold text-ink">{deleteTarget.name}</p><p className="mt-1 text-sm text-storm">{formatCurrency(deleteTarget.amount, deleteTarget.currencyCode)} · {getFrequencyOption(deleteTarget.frequency).label}</p></div>
          <div className="flex justify-end gap-2 border-t border-white/[0.08] px-6 py-4"><Button disabled={isDeleting} onClick={() => setDeleteTargetId(null)} variant="ghost">Cancelar</Button><Button className="!bg-[#3a2423] !text-[#f0b0ab] hover:!bg-[#4a2d2b]" disabled={isDeleting} onClick={handleDelete}>Eliminar</Button></div>
        </Modal>
      ) : null}

      {!deleteTarget && !showBulkDeleteConfirm ? <BulkActionBar
        archiveLabel="Pausar activos"
        isArchiving={isBulkPausing}
        isDeleting={isBulkDeleting}
        onArchive={selectedItems.some((item) => item.status === "active") ? () => void handleBulkPause() : undefined}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadRecurringIncomeCSV(selectedItems, `ingresos-fijos-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredIncome.length}
      /> : null}
      {confirmIncome && activeWorkspace ? (
        <ConfirmArrivalDialog
          accounts={accounts}
          income={confirmIncome}
          initialDate={confirmDate}
          isSaving={confirmMutation.isPending}
          onClose={() => setConfirmIncomeId(null)}
          onConfirm={handleConfirmArrival}
        />
      ) : null}

      {historyIncome && activeWorkspace ? (
        <HistoryDialog
          income={historyIncome}
          onConfirm={(date) => { setHistoryIncomeId(null); setConfirmDate(date); setConfirmIncomeId(historyIncome.id); }}
          onOpenMovement={(movementId) => navigate(`/app/movements?period=all&movement=${movementId}`)}
          onClose={() => setHistoryIncomeId(null)}
          workspaceId={activeWorkspace.id}
        />
      ) : null}

      {showBulkDeleteConfirm ? (
        <Modal className="!max-w-md !bg-[#1a1917]" disableOutsideClose={isBulkDeleting} labelledBy="income-bulk-delete-title" onClose={() => { if (!isBulkDeleting) setShowBulkDeleteConfirm(false); }}>
          <ModalHeader description="Esta acción elimina los registros seleccionados de forma permanente." onClose={() => setShowBulkDeleteConfirm(false)} title={`¿Eliminar ${selectedCount} ingreso${selectedCount === 1 ? "" : "s"}?`} titleId="income-bulk-delete-title" />
          <div className="flex justify-end gap-2 border-t border-white/[0.08] px-6 py-4"><Button disabled={isBulkDeleting} onClick={() => setShowBulkDeleteConfirm(false)} variant="ghost">Cancelar</Button><Button className="!bg-[#3a2423] !text-[#f0b0ab] hover:!bg-[#4a2d2b]" disabled={isBulkDeleting} onClick={() => void confirmBulkDelete()}>{isBulkDeleting ? "Eliminando..." : `Eliminar ${selectedCount}`}</Button></div>
        </Modal>
      ) : null}
    </div>
  );
}
