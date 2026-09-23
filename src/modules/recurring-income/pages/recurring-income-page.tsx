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
import { RecurringIncomeList } from "../components/recurring-income-list";
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
    frequency: "monthly",
    intervalCount: "1",
    dayOfMonth: "",
    dayOfWeek: "",
    startDate: todayDateInputValue(),
    nextExpectedDate: todayDateInputValue(),
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

/**
 * Suma meses recortando al ultimo dia real del mes destino. `setUTCMonth` solo
 * desborda: 31 de enero + 1 mes cae en el 3 de marzo. La app usa addMonths de
 * date-fns, que recorta al 28 de febrero; esto replica ese comportamiento.
 */
function addMonthsClamped(date: Date, months: number) {
  const dayOfMonth = date.getUTCDate();
  const result = new Date(date.getTime());

  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfTargetMonth = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();

  result.setUTCDate(Math.min(dayOfMonth, lastDayOfTargetMonth));

  return result;
}

function advanceNextExpectedDate(income: RecurringIncomeSummary): string {
  const parts = income.nextExpectedDate.split("-");
  let d = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12));
  const { frequency, intervalCount } = income;
  switch (frequency) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + intervalCount);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7 * intervalCount);
      break;
    case "monthly": {
      d = addMonthsClamped(d, intervalCount);
      if (income.dayOfMonth) {
        const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
        d.setUTCDate(Math.min(income.dayOfMonth, maxDay));
      }
      break;
    }
    case "quarterly":
      d = addMonthsClamped(d, 3 * intervalCount);
      break;
    case "yearly":
      d = addMonthsClamped(d, 12 * intervalCount);
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
  const [panel, setPanel] = useState<"main" | "details">("main");

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
  const frequencyPickerOptions = frequencyOptions.map<PickerOption>((item) => ({ value: item.value, label: item.label, description: item.description, leadingLabel: item.leadingLabel }));
  const statusPickerOptions = statusOptions.map<PickerOption>((item) => ({ value: item.value, label: item.label, description: item.description, leadingLabel: item.leadingLabel }));
  const currencyPickerOptions = currencyOptions.map<PickerOption>((item) => ({ value: item.code, label: item.code, description: item.label, leadingLabel: item.symbol }));
  const needsDayOfWeek = formState.frequency === "weekly";
  const needsDayOfMonth = ["monthly", "quarterly", "yearly"].includes(formState.frequency);

  return (
    <Modal className={resourceEditorSurfaceClassName} disableOutsideClose={isSaving} labelledBy="income-editor-title" onClose={closeEditor}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
        <ResourceEditorHeader disabled={isSaving} onBack={panel === "details" ? () => setPanel("main") : undefined} onClose={closeEditor} title={panel === "main" ? (isCreateMode ? "Nuevo ingreso fijo" : "Editar ingreso fijo") : "Detalles"} titleId="income-editor-title" />
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
          {feedback?.tone === "error" ? <FormFeedbackBanner className="mb-5" description={feedback.description} title={feedback.title} tone="error" /> : null}
          {panel === "main" ? (
            <div className="space-y-5">
              <Field errorKey="amount" invalidFields={invalidFields} label={"Monto (" + getCurrencyLabel(formState.currencyCode || baseCurrencyCode).symbol + ")"}>
                <Input autoFocus className="h-16 font-display text-[2rem] font-semibold" data-modal-initial-focus inputMode="decimal" onChange={(event) => { clearFieldError("amount"); updateFormState("amount", event.target.value); }} placeholder="0.00" type="number" value={formState.amount} />
              </Field>
              <Field errorKey="name" invalidFields={invalidFields} label="Nombre">
                <Input maxLength={120} onChange={(event) => { clearFieldError("name"); updateFormState("name", event.target.value); }} placeholder="Ej. Sueldo mensual" value={formState.name} />
              </Field>
              <Field label="Frecuencia">
                <SearchablePicker appearance="compact" emptyMessage="No hay frecuencias." onChange={(value) => updateFormState("frequency", value as RecurringIncomeFrequency)} options={frequencyPickerOptions} placeholderDescription="Cada cuánto llega." placeholderLabel="Selecciona frecuencia" queryPlaceholder="Buscar frecuencia..." value={formState.frequency} />
              </Field>
              <Field errorKey="nextExpectedDate" invalidFields={invalidFields} label="Próxima llegada">
                <DatePickerField appearance="compact" onChange={(value) => { clearFieldError("nextExpectedDate"); updateFormState("nextExpectedDate", value); }} value={formState.nextExpectedDate} />
              </Field>
              <ResourceEditorDestination onClick={() => setPanel("details")} summary="Pagador, cuenta y calendario" />
            </div>
          ) : (
            <div className="space-y-5">
              <Field label="Pagador"><SearchablePicker appearance="compact" emptyMessage="No hay pagadores." onChange={(value) => updateFormState("payerPartyId", value)} options={counterpartyOptions} placeholderDescription="Persona o empresa." placeholderLabel="Sin pagador fijo" queryPlaceholder="Buscar pagador..." value={formState.payerPartyId} /></Field>
              <Field label="Cuenta sugerida"><SearchablePicker appearance="compact" emptyMessage="No hay cuentas." onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Cuenta donde llegará." placeholderLabel="Sin cuenta fija" queryPlaceholder="Buscar cuenta..." value={formState.accountId} /></Field>
              <Field label="Categoría"><SearchablePicker appearance="compact" emptyMessage="No hay categorías de ingreso." onChange={(value) => updateFormState("categoryId", value)} options={categoryOptions} placeholderDescription="Categoría de ingreso." placeholderLabel="Sin categoría" queryPlaceholder="Buscar categoría..." value={formState.categoryId} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Moneda"><SearchablePicker appearance="compact" emptyMessage="No hay monedas." onChange={(value) => updateFormState("currencyCode", value)} options={currencyPickerOptions} placeholderDescription="Moneda del ingreso." placeholderLabel="Moneda" queryPlaceholder="Buscar moneda..." value={formState.currencyCode} /></Field>
                <Field label="Cada cuántos ciclos"><Input inputMode="numeric" min="1" onChange={(event) => updateFormState("intervalCount", event.target.value)} placeholder="1" type="number" value={formState.intervalCount} /></Field>
              </div>
              <Field errorKey="startDate" invalidFields={invalidFields} label="Inicio"><DatePickerField appearance="compact" onChange={(value) => { clearFieldError("startDate"); updateFormState("startDate", value); }} value={formState.startDate} /></Field>
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
  const [panel, setPanel] = useState<"main" | "details">("main");
  const [actualDate, setActualDate] = useState(todayDateInputValue());
  const [actualAmount, setActualAmount] = useState(String(income.amount));
  const [notes, setNotes] = useState("");
  const [movementId, setMovementId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const incomeMovements = useMemo(
    () => movements.filter((item) => item.movementType === "income" && item.status !== "voided")
      .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)).slice(0, 40),
    [movements],
  );
  const movementOptions = incomeMovements.map<PickerOption>((item) => ({
    value: String(item.id),
    label: item.description || `Movimiento #${item.id}`,
    description: `${formatDate(item.occurredAt)} · ${item.destinationCurrencyCode ?? item.sourceCurrencyCode ?? ""}`,
    leadingLabel: (item.destinationCurrencyCode ?? item.sourceCurrencyCode ?? "??").slice(0, 3),
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
    setError(null);
    await onConfirm({
      recurringIncomeId: income.id,
      expectedDate: income.nextExpectedDate,
      actualDate,
      amount,
      currencyCode: income.currencyCode,
      movementId: movementId ? Number(movementId) : null,
      notes,
      nextExpectedDate,
    });
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
              <p className="border-t border-white/[0.08] pt-4 text-sm text-storm">La siguiente llegada quedará para el <span className="text-ink">{formatDate(nextExpectedDate)}</span>.</p>
              <ResourceEditorDestination label="Llegó distinto" onClick={() => setPanel("details")} summary="Monto, movimiento y notas" />
            </div>
          ) : (
            <div className="space-y-5">
              <Field label={"Monto recibido (" + getCurrencyLabel(income.currencyCode).symbol + ")"}><Input inputMode="decimal" onChange={(event) => { setError(null); setActualAmount(event.target.value); }} placeholder="0.00" type="number" value={actualAmount} /></Field>
              <Field label="Movimiento vinculado"><SearchablePicker appearance="compact" emptyMessage="No hay movimientos de ingreso recientes." onChange={setMovementId} options={movementOptions} placeholderDescription="Ingreso ya registrado." placeholderLabel="Sin vincular" queryPlaceholder="Buscar movimiento..." value={movementId} /></Field>
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
}: {
  income: RecurringIncomeSummary;
  workspaceId: number;
  onClose: () => void;
}) {
  const occurrencesQuery = useRecurringIncomeOccurrencesQuery(workspaceId, income.id);
  const occurrences = occurrencesQuery.data ?? [];

  return (
    <Modal className="!max-w-xl !bg-[#1a1917]" labelledBy="income-history-title" onClose={onClose}>
      <ModalHeader description={income.name + " · " + getFrequencyOption(income.frequency).label} onClose={onClose} title="Historial de llegadas" titleId="income-history-title" />
      <div className="min-h-0 overflow-y-auto px-6 py-3">
        {occurrencesQuery.isLoading ? <div className="space-y-2 py-4">{Array.from({ length: 3 }).map((_, index) => <div className="h-16 animate-pulse rounded-lg bg-white/[0.04]" key={index} />)}</div>
        : occurrences.length === 0 ? <p className="py-10 text-center text-sm text-storm">Aún no hay llegadas confirmadas.</p>
        : occurrences.map((occurrence) => (
          <div className="flex items-center justify-between gap-4 border-b border-white/[0.08] py-4 last:border-0" key={occurrence.id}>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{formatDate(occurrence.expectedDate)}</p>
              <p className="mt-1 text-xs text-storm">{occurrence.actualDate ? "Recibido el " + formatDate(occurrence.actualDate) : "Sin fecha de llegada"} · {getOccurrenceStatusLabel(occurrence.status)}</p>
              {occurrence.notes ? <p className="mt-1 truncate text-xs text-storm">{occurrence.notes}</p> : null}
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-ink">{formatCurrency(occurrence.amount, occurrence.currencyCode)}</p>
          </div>
        ))}
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
  const [historyIncomeId, setHistoryIncomeId] = useState<number | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  const {
    filters: incomeFilters,
    currentPage,
    setCurrentPage,
    updateFilter: updateIncomeFilter,
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
          (r.payer ?? "").toLowerCase().includes(normalizedName) ||
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

    if (formState.nextExpectedDate < formState.startDate) {
      setFeedback({
        tone: "error",
        title: "La fecha no cuadra",
        description: "La próxima llegada no puede ser anterior al inicio.",
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

    if (accountId !== null && Number.isNaN(accountId)) {
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
            {recurringIncome.length} {recurringIncome.length === 1 ? "registrado" : "registrados"} · {overdueCount > 0 ? `${overdueCount} ${overdueCount === 1 ? "pendiente" : "pendientes"} de llegada` : dueSoonCount > 0 ? `${dueSoonCount} ${dueSoonCount === 1 ? "llega" : "llegan"} en los próximos 7 días` : nextIncome ? `siguiente llegada el ${formatDate(nextIncome.nextExpectedDate)}` : "sin llegadas próximas"}.
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
          <SearchablePicker appearance="toolbar" emptyMessage="No hay estados." onChange={(value) => updateIncomeFilter("status", value as "all" | RecurringIncomeStatus)} options={statusFilterPickerOptions} placeholderDescription="Estado" placeholderLabel="Todos los estados" queryPlaceholder="Buscar estado..." showSearch={false} value={incomeFilters.status} />
          <SearchablePicker appearance="toolbar" emptyMessage="No hay frecuencias." onChange={(value) => updateIncomeFilter("frequency", value as "all" | RecurringIncomeFrequency)} options={frequencyFilterPickerOptions} placeholderDescription="Frecuencia" placeholderLabel="Todas las frecuencias" queryPlaceholder="Buscar frecuencia..." showSearch={false} value={incomeFilters.frequency} />
          <button aria-expanded={showMoreFilters} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm text-storm transition hover:text-ink" onClick={() => setShowMoreFilters((value) => !value)} type="button"><SlidersHorizontal className="h-4 w-4" />Más filtros</button>
        </div>
        {showMoreFilters ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
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
      </section>

      {feedback && feedback.tone !== "error" && !isEditorOpen ? <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

      {recurringIncome.length === 0 ? (
        <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Crear primer ingreso</Button>} description="Aún no hay ingresos fijos registrados en este espacio." title="Sin ingresos fijos" />
      ) : filteredIncome.length === 0 ? (
        <DataState action={hasActiveFilters ? <Button onClick={clearIncomeFilters} variant="secondary">Quitar filtros</Button> : undefined} description="No hay ingresos que coincidan con los filtros." title="Sin resultados" />
      ) : (
        <RecurringIncomeList allSelected={allSelected} income={paginatedIncome} onClearAll={clearAll} onConfirm={setConfirmIncomeId} onDelete={setDeleteTargetId} onEdit={openEditEditor} onHistory={setHistoryIncomeId} onSelectAll={selectAll} onToggleSelect={toggleSelect} selectedIds={selectedIds} someSelected={someSelected} />
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
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadRecurringIncomeCSV(selectedItems, `ingresos-fijos-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredIncome.length}
      /> : null}
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
        <Modal className="!max-w-md !bg-[#1a1917]" disableOutsideClose={isBulkDeleting} labelledBy="income-bulk-delete-title" onClose={() => { if (!isBulkDeleting) setShowBulkDeleteConfirm(false); }}>
          <ModalHeader description="Esta acción elimina los registros seleccionados de forma permanente." onClose={() => setShowBulkDeleteConfirm(false)} title={`¿Eliminar ${selectedCount} ingreso${selectedCount === 1 ? "" : "s"}?`} titleId="income-bulk-delete-title" />
          <div className="flex justify-end gap-2 border-t border-white/[0.08] px-6 py-4"><Button disabled={isBulkDeleting} onClick={() => setShowBulkDeleteConfirm(false)} variant="ghost">Cancelar</Button><Button className="!bg-[#3a2423] !text-[#f0b0ab] hover:!bg-[#4a2d2b]" disabled={isBulkDeleting} onClick={() => void confirmBulkDelete()}>{isBulkDeleting ? "Eliminando..." : `Eliminar ${selectedCount}`}</Button></div>
        </Modal>
      ) : null}
    </div>
  );
}
