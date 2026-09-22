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
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { ResourceEditorDestination, ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { PageHeader } from "../../../components/ui/page-header";
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
  SubscriptionFrequency,
  SubscriptionStatus,
  SubscriptionSummary,
} from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { SubscriptionAnalyticsModal } from "../components/subscription-analytics-modal";
import { SubscriptionDetailDialog } from "../components/subscription-detail-dialog";
import { assignSubscriptionField, changeSubscriptionStatus, markSubscriptionPaid, setSubscriptionPinned, todayPeru } from "../lib/subscription-actions";
import {
  getQueryErrorMessage,
  type SubscriptionFormInput,
  useCreateSubscriptionMutation,
  useDeleteSubscriptionMutation,
  useUpdateSubscriptionMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import { Pagination } from "../../../components/ui/pagination";
import { SubscriptionTable } from "../components/subscription-table";
import { suggestSubscriptionFields } from "../lib/subscription-patterns";
import { useSubscriptionsFilters } from "../hooks/use-subscriptions-filters";
import {
  frequencyOptions,
  getFrequencyOption,
  getStatusOption,
  statusOptions,
} from "../lib/subscriptions-presenters";

const SUBSCRIPTIONS_PAGE_SIZE = 50;

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


const currencyOptions = [
  { code: "PEN", label: "Sol peruano", region: "Perú", symbol: "S/" },
  { code: "USD", label: "Dólar estadounidense", region: "Estados Unidos", symbol: "$" },
  { code: "EUR", label: "Euro", region: "Unión Europea", symbol: "EUR" },
  { code: "BRL", label: "Real brasileño", region: "Brasil", symbol: "R$" },
  { code: "MXN", label: "Peso mexicano", region: "Mexico", symbol: "MXN" },
  { code: "CLP", label: "Peso chileno", region: "Chile", symbol: "CLP" },
] as const;

const weekdayOptions = [
  { value: "0", label: "Domingo", description: "Inicio de semana clásica.", leadingLabel: "DO" },
  { value: "1", label: "Lunes", description: "Buen día para cargos fijos.", leadingLabel: "LU" },
  { value: "2", label: "Martes", description: "Repetición semanal en martes.", leadingLabel: "MA" },
  { value: "3", label: "Miércoles", description: "Repetición semanal en miércoles.", leadingLabel: "MI" },
  { value: "4", label: "Jueves", description: "Repetición semanal en jueves.", leadingLabel: "JU" },
  { value: "5", label: "Viernes", description: "Repetición semanal en viernes.", leadingLabel: "VI" },
  { value: "6", label: "Sábado", description: "Repetición semanal en sábado.", leadingLabel: "SA" },
] as const;

const inputClassName = "field-dark";
const textareaClassName = "field-dark min-h-[100px] resize-y py-3 leading-7";
const labelClassName =
  "text-[0.8125rem] font-medium tracking-[0.01em] text-storm";

function toDateInputValue(value: string) {
  return value ? value.slice(0, 10) : "";
}

function localDateKey(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

function parseOptionalInteger(value: string) {
  const normalizedValue = value.trim();
  if (!normalizedValue) {
    return null;
  }
  const parsedValue = Number(normalizedValue);
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
    startDate: localDateKey(new Date()),
    nextDueDate: localDateKey(new Date()),
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
    <button aria-pressed={checked} className="flex min-h-[54px] w-full items-center justify-between gap-4 border-y border-white/[0.09] py-3 text-left" onClick={() => onChange(!checked)} type="button">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-storm">{description}</span>
      </span>
      <span className={"relative h-7 w-12 shrink-0 rounded-full border transition " + (checked ? "border-white/40 bg-white/[0.1]" : "border-white/15 bg-white/[0.03]")}>
        <span className={"absolute top-0.5 h-5 w-5 rounded-full bg-[#e8e3da] transition " + (checked ? "left-[25px]" : "left-1")} />
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
  movements,
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
  movements: MovementRecord[];
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateFormState: <Field extends keyof SubscriptionFormState>(
    field: Field,
    value: SubscriptionFormState[Field],
  ) => void;
}) {
  const [panel, setPanel] = useState<"main" | "optional">("main");
  const counterpartyOptions: PickerOption[] = [
    { value: "", label: "Sin proveedor", description: "No asociado.", leadingLabel: "—" },
    ...counterparties.filter((item) => !item.isArchived || String(item.id) === formState.vendorPartyId)
      .map((item) => ({ value: String(item.id), label: item.name, description: item.type, leadingLabel: item.name.slice(0, 2).toUpperCase() })),
  ];
  const categoryOptions: PickerOption[] = [
    { value: "", label: "Sin categoría", description: "No asignada.", leadingLabel: "—" },
    ...categories.filter((item) => (item.isActive || String(item.id) === formState.categoryId) && (item.kind === "expense" || item.kind === "both"))
      .map((item) => ({ value: String(item.id), label: item.name, description: "Categoría de gasto.", leadingLabel: item.name.slice(0, 2).toUpperCase() })),
  ];
  const accountOptions: PickerOption[] = [
    { value: "", label: "Sin cuenta fija", description: "Se elige al registrar el pago.", leadingLabel: "—" },
    ...accounts.filter((item) => !item.isArchived || String(item.id) === formState.accountId)
      .map((item) => ({ value: String(item.id), label: item.name, description: item.currencyCode, leadingLabel: item.currencyCode })),
  ];
  const currencyPickerOptions: PickerOption[] = currencyOptions.map((item) => ({
    value: item.code, label: item.code, description: item.label, leadingLabel: item.symbol,
  }));
  if (!currencyPickerOptions.some((item) => item.value === formState.currencyCode)) {
    currencyPickerOptions.push({ value: formState.currencyCode, label: formState.currencyCode, description: "Moneda registrada.", leadingLabel: formState.currencyCode });
  }
  const frequencyPickerOptions: PickerOption[] = frequencyOptions.map((item) => ({
    value: item.value, label: item.label, description: item.description, leadingLabel: item.leadingLabel,
  }));
  const needsDayOfWeek = formState.frequency === "weekly";
  const needsDayOfMonth = ["monthly", "quarterly", "yearly"].includes(formState.frequency);
  const suggestedFields = useMemo(
    () => suggestSubscriptionFields(formState.name, formState.vendorPartyId ? Number(formState.vendorPartyId) : null, movements),
    [formState.name, formState.vendorPartyId, movements],
  );
  const suggestedCategory = categories.find((item) => item.id === suggestedFields.categoryId && item.isActive && (item.kind === "expense" || item.kind === "both"));
  const suggestedAccount = accounts.find((item) => item.id === suggestedFields.accountId && !item.isArchived);

  useEffect(() => {
    if (!invalidFields.size) return;
    setPanel("main");
    const firstField = [...invalidFields][0];
    const timer = window.setTimeout(() => {
      const field = document.querySelector<HTMLElement>('[data-field="' + firstField + '"]');
      field?.scrollIntoView({ behavior: "smooth", block: "center" });
      field?.querySelector<HTMLElement>("input,button")?.focus();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [invalidFields]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-3" onMouseDown={(event) => { if (event.target === event.currentTarget) closeEditor(); }} role="presentation">
      <form className="resource-editor flex max-h-[calc(100dvh-24px)] w-full max-w-[640px] flex-col overflow-hidden rounded-[14px] border border-white/10 bg-[#1a1917] shadow-none" noValidate onSubmit={onSubmit}>
        <ResourceEditorHeader disabled={isSaving} onBack={panel === "optional" ? () => setPanel("main") : undefined} onClose={closeEditor} title={panel === "main" ? (isCreateMode ? "Nueva suscripción" : "Editar suscripción") : "Opcionales"} />
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
          {feedback?.tone === "error" ? <FormFeedbackBanner className="mb-5" description={feedback.description} title={feedback.title} tone="error" /> : null}
          {panel === "main" ? (
            <div className="space-y-5">
              <div data-field="amount">
                <Field errorKey="amount" invalidFields={invalidFields} label={"Monto (" + getCurrencyLabel(formState.currencyCode || baseCurrencyCode).symbol + ")"}>
                  <Input autoFocus className="h-16 font-display text-[2rem] font-semibold" inputMode="decimal" onChange={(event) => { clearFieldError("amount"); updateFormState("amount", event.target.value); }} placeholder="0.00" type="number" value={formState.amount} />
                </Field>
              </div>
              <div data-field="name">
                <Field errorKey="name" invalidFields={invalidFields} label="Nombre">
                  <Input maxLength={120} onChange={(event) => { clearFieldError("name"); updateFormState("name", event.target.value); }} placeholder="Ej. Internet de casa" value={formState.name} />
                </Field>
              </div>
              <Field label="Frecuencia">
                <SearchablePicker appearance="compact" emptyMessage="No hay frecuencias disponibles." onChange={(value) => updateFormState("frequency", value as SubscriptionFrequency)} options={frequencyPickerOptions} placeholderDescription="Cada cuánto se cobra." placeholderLabel="Selecciona frecuencia" queryPlaceholder="Buscar frecuencia..." value={formState.frequency} />
              </Field>
              <div data-field="nextDueDate">
                <Field errorKey="nextDueDate" invalidFields={invalidFields} label="Próximo cobro">
                  <DatePickerField appearance="compact" onChange={(value) => { clearFieldError("nextDueDate"); updateFormState("nextDueDate", value); }} value={formState.nextDueDate} />
                </Field>
              </div>
              <Field label="Avisarme antes"><Input inputMode="numeric" min="0" onChange={(event) => updateFormState("remindDaysBefore", event.target.value)} placeholder="3" type="number" value={formState.remindDaysBefore} /></Field>
              <ToggleRow checked={formState.autoCreateMovement} description="Cada cobro entra como gasto, sin que lo registres." label="Anotar el gasto solo" onChange={(checked) => updateFormState("autoCreateMovement", checked)} />
              {formState.autoCreateMovement ? <div><Field label="Se paga con"><SearchablePicker appearance="compact" emptyMessage="No hay cuentas." onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Cuenta donde se anotará el gasto." placeholderLabel="Elegir cuenta" queryPlaceholder="Buscar cuenta..." value={formState.accountId} /></Field>{!formState.accountId && suggestedAccount ? <button className="mt-2 text-xs text-storm underline underline-offset-4 hover:text-ink" onClick={() => updateFormState("accountId", String(suggestedAccount.id))} type="button">Sugerencia por pagos anteriores: {suggestedAccount.name}</button> : null}</div> : null}
              <ResourceEditorDestination label="Opcionales" onClick={() => setPanel("optional")} summary="Proveedor, cuenta y calendario" />
            </div>
          ) : (
            <div className="space-y-5">
              <Field label="Proveedor">
                <SearchablePicker appearance="compact" emptyMessage="No hay proveedores." onChange={(value) => updateFormState("vendorPartyId", value)} options={counterpartyOptions} placeholderDescription="Proveedor asociado." placeholderLabel="Sin proveedor" queryPlaceholder="Buscar proveedor..." value={formState.vendorPartyId} />
              </Field>
              <div><Field label="Categoría">
                <SearchablePicker appearance="compact" emptyMessage="No hay categorías." onChange={(value) => updateFormState("categoryId", value)} options={categoryOptions} placeholderDescription="Categoría de gasto." placeholderLabel="Sin categoría" queryPlaceholder="Buscar categoría..." value={formState.categoryId} />
              </Field>{!formState.categoryId && suggestedCategory ? <button className="mt-2 text-xs text-storm underline underline-offset-4 hover:text-ink" onClick={() => updateFormState("categoryId", String(suggestedCategory.id))} type="button">Sugerencia por pagos anteriores: {suggestedCategory.name}</button> : null}</div>
              {!formState.autoCreateMovement ? <div><Field label="Cuenta sugerida">
                <SearchablePicker appearance="compact" emptyMessage="No hay cuentas." onChange={(value) => updateFormState("accountId", value)} options={accountOptions} placeholderDescription="Cuenta recomendada para el pago." placeholderLabel="Sin cuenta fija" queryPlaceholder="Buscar cuenta..." value={formState.accountId} />
              </Field>{!formState.accountId && suggestedAccount ? <button className="mt-2 text-xs text-storm underline underline-offset-4 hover:text-ink" onClick={() => updateFormState("accountId", String(suggestedAccount.id))} type="button">Sugerencia por pagos anteriores: {suggestedAccount.name}</button> : null}</div> : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Moneda"><SearchablePicker appearance="compact" emptyMessage="No hay monedas." onChange={(value) => updateFormState("currencyCode", value)} options={currencyPickerOptions} placeholderDescription="Moneda del cobro." placeholderLabel="Moneda" queryPlaceholder="Buscar moneda..." value={formState.currencyCode} /></Field>
                <Field label="Cada cuántos ciclos"><Input inputMode="numeric" min="1" onChange={(event) => updateFormState("intervalCount", event.target.value)} placeholder="1" type="number" value={formState.intervalCount} /></Field>
              </div>
              <div data-field="startDate">
                <Field errorKey="startDate" invalidFields={invalidFields} label="Inicio"><DatePickerField appearance="compact" onChange={(value) => { clearFieldError("startDate"); updateFormState("startDate", value); }} value={formState.startDate} /></Field>
              </div>
              {needsDayOfMonth ? <Field label="Día del mes"><Input inputMode="numeric" max="31" min="1" onChange={(event) => updateFormState("dayOfMonth", event.target.value)} placeholder="Sin día fijo" type="number" value={formState.dayOfMonth} /></Field> : null}
              {needsDayOfWeek ? <Field label="Día de la semana"><SearchablePicker appearance="compact" emptyMessage="No hay días." onChange={(value) => updateFormState("dayOfWeek", value)} options={weekdayOptions.map((item) => ({ value: item.value, label: item.label, description: item.description, leadingLabel: item.leadingLabel }))} placeholderDescription="Día habitual." placeholderLabel="Sin día fijo" queryPlaceholder="Buscar día..." value={formState.dayOfWeek} /></Field> : null}
              <Field label="Fin"><DatePickerField appearance="compact" onChange={(value) => updateFormState("endDate", value)} value={formState.endDate} /></Field>
              <Field label="Descripción"><Textarea onChange={(event) => updateFormState("description", event.target.value)} placeholder="Contexto visible" value={formState.description} /></Field>
              <Field label="Notas"><Textarea onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Solo para este espacio" value={formState.notes} /></Field>
            </div>
          )}
        </div>
        <footer className="shrink-0 border-t border-white/[0.08] px-5 py-4 sm:px-7">
          <Button className="w-full" disabled={isSaving} type="submit">
            {isSaving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : isCreateMode ? "Crear suscripción" : "Guardar cambios"}
          </Button>
        </footer>
      </form>
    </div>
  );
}

function SubscriptionsLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[248px] rounded-[32px]" />
      <div className="shimmer-surface h-[520px] rounded-[32px]" />
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
  const headers = ["Nombre", "Proveedor", "Estado", "Monto", "Moneda", "Monto moneda base", "Frecuencia", "Etiqueta frecuencia", "Categoría", "Cuenta", "Inicio", "Próximo vencimiento", "Fin", "Auto movimiento", "Descripción", "Notas"];
  const rows = subscriptions.map((s) => [
    escapeCSV(s.name),
    escapeCSV(s.vendor),
    escapeCSV(getStatusOption(s.status).label),
    escapeCSV(s.amount),
    escapeCSV(s.currencyCode),
    escapeCSV(s.amountInBaseCurrency ?? ""),
    escapeCSV(s.frequency),
    escapeCSV(getFrequencyOption(s.frequency).label),
    escapeCSV(s.categoryName ?? ""),
    escapeCSV(s.accountName ?? ""),
    escapeCSV(s.startDate),
    escapeCSV(s.nextDueDate),
    escapeCSV(s.endDate ?? ""),
    escapeCSV(s.autoCreateMovement ? "Sí" : "No"),
    escapeCSV(s.description ?? ""),
    escapeCSV(s.notes ?? ""),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

export function SubscriptionsPage() {
  const navigate = useNavigate();
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
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
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
  const [detailSubscriptionId, setDetailSubscriptionId] = useState<number | null>(null);
  const [detailInitialPanel, setDetailInitialPanel] = useState<"detail" | "pay">("detail");
  const [cancelSubscriptionId, setCancelSubscriptionId] = useState<number | null>(null);
  const [isActionPending, setIsActionPending] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const { schedule } = useUndoQueue();
  const {
    filters: subscriptionFilters,
    setFilters: setSubscriptionFilters,
    currentPage,
    setCurrentPage,
    updateFilter: updateSubscriptionFilter,
    clearFilters: clearSubscriptionFilters,
  } = useSubscriptionsFilters("table");
  const [formState, setFormState] = useState<SubscriptionFormState>(
    createDefaultFormState(activeWorkspace?.baseCurrencyCode ?? "USD"),
  );

  const subscriptions = useMemo(
    () => [...(snapshot?.subscriptions ?? [])].sort((left, right) => {
      const rank = (item: SubscriptionSummary) => item.status === "active" ? (item.nextDueDate < todayPeru() ? 0 : 1) : item.status === "paused" ? 2 : 3;
      return rank(left) - rank(right) || Number(right.isPinned) - Number(left.isPinned) || left.nextDueDate.localeCompare(right.nextDueDate);
    }),
    [snapshot?.subscriptions],
  );
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
  const detailSubscription = detailSubscriptionId === null ? null : subscriptions.find((subscription) => subscription.id === detailSubscriptionId) ?? null;
  const cancelSubscription = cancelSubscriptionId === null ? null : subscriptions.find((subscription) => subscription.id === cancelSubscriptionId) ?? null;

  const hasActiveFilters =
    subscriptionFilters.name.trim() !== "" ||
    subscriptionFilters.pinned ||
    subscriptionFilters.vendor.trim() !== "" ||
    subscriptionFilters.category.trim() !== "" ||
    subscriptionFilters.account.trim() !== "" ||
    subscriptionFilters.amount.trim() !== "" ||
    subscriptionFilters.nextDueDateFrom !== "" ||
    subscriptionFilters.nextDueDateTo !== "" ||
    subscriptionFilters.frequency !== "all" ||
    subscriptionFilters.status !== "all";
  const filteredSubscriptions = useMemo(() => {
    let result = subscriptions.filter((s) => !hiddenIds.has(s.id));
    if (subscriptionFilters.pinned) result = result.filter((subscription) => subscription.isPinned);
    const normalizedName = subscriptionFilters.name.trim().toLowerCase();
    const normalizedVendor = subscriptionFilters.vendor.trim().toLowerCase();
    const normalizedCategory = subscriptionFilters.category.trim().toLowerCase();
    const normalizedAccount = subscriptionFilters.account.trim().toLowerCase();
    const normalizedAmount = subscriptionFilters.amount.trim();
    if (normalizedName) {
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(normalizedName) ||
          (s.vendor ?? "").toLowerCase().includes(normalizedName) ||
          (s.categoryName ?? "").toLowerCase().includes(normalizedName) ||
          (s.accountName ?? "").toLowerCase().includes(normalizedName),
      );
    }
    if (normalizedVendor) {
      result = result.filter((s) => (s.vendor ?? "").toLowerCase().includes(normalizedVendor));
    }
    if (normalizedCategory) {
      result = result.filter((s) => (s.categoryName ?? "").toLowerCase().includes(normalizedCategory));
    }
    if (normalizedAccount) {
      result = result.filter((s) => (s.accountName ?? "").toLowerCase().includes(normalizedAccount));
    }
    if (subscriptionFilters.frequency !== "all") {
      result = result.filter((s) => s.frequency === subscriptionFilters.frequency);
    }
    if (subscriptionFilters.status !== "all") {
      result = result.filter((s) => s.status === subscriptionFilters.status);
    }
    if (normalizedAmount) {
      result = result.filter((s) => String(s.amount).includes(normalizedAmount));
    }
    if (subscriptionFilters.nextDueDateFrom) {
      result = result.filter((s) => s.nextDueDate >= subscriptionFilters.nextDueDateFrom);
    }
    if (subscriptionFilters.nextDueDateTo) {
      result = result.filter((s) => s.nextDueDate <= subscriptionFilters.nextDueDateTo);
    }
    return result;
  }, [hiddenIds, subscriptionFilters, subscriptions]);
  const totalPages = Math.max(1, Math.ceil(filteredSubscriptions.length / SUBSCRIPTIONS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSubscriptions = useMemo(
    () => filteredSubscriptions.slice((safePage - 1) * SUBSCRIPTIONS_PAGE_SIZE, safePage * SUBSCRIPTIONS_PAGE_SIZE),
    [filteredSubscriptions, safePage],
  );
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
  const today = new Date();
  const todayKey = localDateKey(today);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(today.getDate() + 7);
  const inSevenDaysKey = localDateKey(inSevenDays);
  const dueSoonCount = subscriptions.filter((subscription) => subscription.status === "active" && subscription.nextDueDate >= todayKey && subscription.nextDueDate <= inSevenDaysKey).length;
  const overdueCount = subscriptions.filter((subscription) => subscription.status === "active" && subscription.nextDueDate < todayKey).length;
  const nextUpcoming = subscriptions.find((subscription) => subscription.status === "active" && subscription.nextDueDate >= todayKey);
  const activeInFilter = filteredSubscriptions.filter((subscription) => subscription.status === "active");
  const pausedInFilter = filteredSubscriptions.filter((subscription) => subscription.status === "paused").length;
  const monthlyTotal = activeInFilter.reduce((total, subscription) => {
    const amount = subscription.amountInBaseCurrency ?? subscription.amount;
    switch (subscription.frequency) {
      case "daily": return total + amount * 30;
      case "weekly": return total + amount * 52 / 12;
      case "quarterly": return total + amount / 3;
      case "yearly": return total + amount / 12;
      case "monthly": return total + amount;
      case "custom": return total + amount;
    }
  }, 0);
  const subscriptionVendors = useMemo(
    () =>
      Array.from(
        new Set(
          subscriptions
            .map((subscription) => subscription.vendor?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [subscriptions],
  );
  const subscriptionCategories = useMemo(
    () =>
      Array.from(
        new Set(
          subscriptions
            .map((subscription) => subscription.categoryName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [subscriptions],
  );
  const subscriptionAccounts = useMemo(
    () =>
      Array.from(
        new Set(
          subscriptions
            .map((subscription) => subscription.accountName?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [subscriptions],
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

    if (intervalCount === null || !Number.isInteger(intervalCount) || intervalCount <= 0) {
      setFeedback({
        tone: "error",
        title: "Intervalo inválido",
        description: "Indica un intervalo mayor que cero.",
      });
      return;
    }

    if (!formState.startDate || !formState.nextDueDate) {
      setFeedback({
        tone: "error",
        title: "Faltan fechas clave",
        description: "Completa la fecha de inicio y el próximo cobro.",
      });
      return;
    }

    if (formState.nextDueDate < formState.startDate) {
      setFeedback({
        tone: "error",
        title: "La fecha no cuadra",
        description: "El próximo cobro no puede ser anterior al inicio.",
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

    if (vendorPartyId !== null && Number.isNaN(vendorPartyId)) {
      setFeedback({
        tone: "error",
        title: "Proveedor inválido",
        description: "Vuelve a seleccionar el proveedor si deseas asociarlo.",
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

    if (formState.autoCreateMovement && accountId === null) {
      setFeedback({
        tone: "error",
        title: "Falta la cuenta",
        description: "Elige la cuenta con la que se paga: el cobro automático se anotará en ella.",
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

    const resolvedDayOfMonth = ["monthly", "quarterly", "yearly"].includes(formState.frequency)
      ? dayOfMonth ?? Number(formState.nextDueDate.slice(8, 10))
      : null;

    const payload: SubscriptionFormInput = {
      name,
      vendorPartyId: vendorPartyId === null ? null : vendorPartyId,
      accountId: accountId === null ? null : accountId,
      categoryId: categoryId === null ? null : categoryId,
      currencyCode: formState.currencyCode.trim().toUpperCase() || baseCurrencyCode,
      amount: amount!,
      frequency: formState.frequency,
      intervalCount,
      dayOfMonth: resolvedDayOfMonth,
      dayOfWeek: formState.frequency === "weekly" ? dayOfWeek : null,
      startDate: formState.startDate,
      nextDueDate: formState.nextDueDate,
      endDate: formState.endDate || null,
      status: editorMode === "create" ? "active" : selectedSubscription?.status ?? "active",
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
          description: "La suscripción se actualizó correctamente.",
        });
      }

      setIsEditorOpen(false);
      setSelectedSubscriptionId(null);
    } catch (error) {
      setFeedback({
        tone: "error",
        title: "No pudimos guardar la suscripción",
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
      label: "SuscripciÃ³n eliminada",
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

  async function runStatusChange(subscription: SubscriptionSummary, status: SubscriptionStatus) {
    setIsActionPending(true);
    try {
      const nextDueDate = await changeSubscriptionStatus(subscription, status);
      await snapshotQuery.refetch();
      setFeedback({ tone: "success", title: status === "active" ? "Suscripción reactivada" : status === "paused" ? "Suscripción pausada" : "Suscripción cancelada", description: status === "active" ? `Próximo pago: ${formatDate(nextDueDate)}.` : "El historial de pagos se conserva." });
    } catch (error) {
      setFeedback({ tone: "error", title: "No se pudo cambiar el estado", description: getQueryErrorMessage(error) });
    } finally {
      setIsActionPending(false);
      setCancelSubscriptionId(null);
    }
  }

  async function handleTogglePin(subscription: SubscriptionSummary) {
    setIsActionPending(true);
    try {
      await setSubscriptionPinned(subscription, !subscription.isPinned);
      await snapshotQuery.refetch();
    } catch (error) {
      setFeedback({ tone: "error", title: "No se pudo cambiar la posición", description: getQueryErrorMessage(error) });
    } finally {
      setIsActionPending(false);
    }
  }

  async function handleAssignField(subscription: SubscriptionSummary, field: "account_id" | "category_id", value: number | null) {
    setIsActionPending(true);
    try {
      await assignSubscriptionField(subscription, field, value);
      await snapshotQuery.refetch();
    } catch (error) {
      setFeedback({ tone: "error", title: "No se pudo actualizar la suscripción", description: getQueryErrorMessage(error) });
    } finally {
      setIsActionPending(false);
    }
  }

  async function handleMarkPaid(subscription: SubscriptionSummary, input: { paidDate: string; amount: number; accountId: number }) {
    setIsActionPending(true);
    try {
      const nextDueDate = await markSubscriptionPaid(subscription, input);
      await snapshotQuery.refetch();
      setFeedback({ tone: "success", title: "Pago registrado", description: `Próximo cobro: ${formatDate(nextDueDate)}.` });
    } catch (error) {
      await snapshotQuery.refetch();
      throw error;
    } finally {
      setIsActionPending(false);
    }
  }

  function applyDuePreset(preset: "all" | "overdue" | "today" | "next7" | "month") {
    const today = todayPeru();
    const day = new Date(`${today}T12:00:00Z`);
    const addDays = (count: number) => {
      const result = new Date(day);
      result.setUTCDate(result.getUTCDate() + count);
      return result.toISOString().slice(0, 10);
    };
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 0, 12)).toISOString().slice(0, 10);
    const [from, to] = preset === "overdue" ? ["", addDays(-1)]
      : preset === "today" ? [today, today]
      : preset === "next7" ? [today, addDays(7)]
      : preset === "month" ? [monthStart, monthEnd]
      : ["", ""];
    setSubscriptionFilters((current) => ({ ...current, nextDueDateFrom: from, nextDueDateTo: to }));
  }

  async function handleBulkDelete() {
    if (selectedCount === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  async function handleBulkPause() {
    const active = selectedItems.filter((subscription) => subscription.status === "active");
    if (!active.length) return;
    setIsActionPending(true);
    let completed = 0;
    try {
      for (const subscription of active) {
        await changeSubscriptionStatus(subscription, "paused");
        completed += 1;
      }
      clearAll();
      setFeedback({ tone: "success", title: `${completed} suscripción${completed === 1 ? "" : "es"} pausada${completed === 1 ? "" : "s"}`, description: "Puedes reactivarlas desde su detalle." });
    } catch (error) {
      setFeedback({ tone: "error", title: `${completed} de ${active.length} pausadas`, description: getQueryErrorMessage(error) });
    } finally {
      await snapshotQuery.refetch();
      setIsActionPending(false);
    }
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
        <PageHeader description="Estamos preparando los pagos recurrentes del espacio activo." eyebrow="suscripciones" title="Cargando suscripciones" />
        <SubscriptionsLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Necesitamos acceder correctamente al espacio activo." eyebrow="suscripciones" title="Suscripciones no disponibles" />
        <DataState description={getQueryErrorMessage(workspaceError, "No pudimos abrir tu espacio actual.")} title="No hay acceso al espacio" tone="error" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Cuando tengas un espacio activo, aquí verás tus pagos recurrentes." eyebrow="suscripciones" title="Aún no hay un espacio activo" />
        <DataState description="Activa o crea un espacio para comenzar a registrar suscripciones." title="Sin suscripciones para mostrar" />
      </div>
    );
  }

  if (snapshotQuery.isLoading || !snapshot) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos cargando tus pagos recurrentes y sus próximos vencimientos." eyebrow="suscripciones" title="Cargando suscripciones" />
        <SubscriptionsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Intentamos reconstruir el estado actual de tus suscripciones." eyebrow="suscripciones" title="No fue posible cargar la información" />
        <DataState description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer tus suscripciones actuales.")} title="Error al cargar suscripciones" tone="error" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <section className="relative z-40 flex min-w-0 items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Suscripciones</h2>
          <p className="mt-1 text-sm text-storm">
            {subscriptions.length} registradas · {overdueCount > 0 ? `${overdueCount} con cobro vencido` : dueSoonCount > 0 ? `${dueSoonCount} vencen en los próximos 7 días` : nextUpcoming ? `siguiente cobro el ${formatDate(nextUpcoming.nextDueDate)}` : "sin cobros próximos"}.
          </p>
        </div>
        <Button data-tour="create-subscription" onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" /><span className="sm:hidden">Nueva</span><span className="hidden sm:inline">Nueva suscripción</span></Button>
        <div className="relative">
          <button aria-expanded={isActionsMenuOpen} aria-label="Más acciones" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] text-storm transition hover:bg-white/[0.04] hover:text-ink" onClick={() => setIsActionsMenuOpen((value) => !value)} type="button"><MoreVertical className="h-4 w-4" /></button>
          {isActionsMenuOpen ? (
            <>
              <button aria-label="Cerrar acciones" className="fixed inset-0 z-30 cursor-default" onClick={() => setIsActionsMenuOpen(false)} type="button" />
              <div className="absolute right-0 top-12 z-40 min-w-52 overflow-hidden rounded-xl border border-white/[0.1] bg-[#1b1a18] py-1">
                <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={snapshotQuery.isFetching} onClick={() => { setIsActionsMenuOpen(false); snapshotQuery.refetch(); }} type="button"><RefreshCw className={snapshotQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />Actualizar</button>
                <button className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-white/[0.04] disabled:opacity-40" disabled={!filteredSubscriptions.length} onClick={() => { setIsActionsMenuOpen(false); downloadSubscriptionsCSV(filteredSubscriptions, "suscripciones-" + new Date().toISOString().slice(0, 10) + ".csv"); }} type="button"><Download className="h-4 w-4" />Exportar las {filteredSubscriptions.length}</button>
              </div>
            </>
          ) : null}
        </div>
      </section>

      <section>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto]">
          <input className="field-dark !h-14" onChange={(event) => updateSubscriptionFilter("name", event.target.value)} placeholder="Buscar por nombre, proveedor o categoría..." type="search" value={subscriptionFilters.name} />
          <SearchablePicker appearance="toolbar" emptyMessage="No hay estados." onChange={(value) => updateSubscriptionFilter("status", value as "all" | SubscriptionStatus)} options={statusFilterPickerOptions} placeholderDescription="Estado" placeholderLabel="Todos los estados" queryPlaceholder="Buscar estado..." value={subscriptionFilters.status} />
          <SearchablePicker appearance="toolbar" emptyMessage="No hay frecuencias." onChange={(value) => updateSubscriptionFilter("frequency", value as "all" | SubscriptionFrequency)} options={frequencyFilterPickerOptions} placeholderDescription="Frecuencia" placeholderLabel="Todas las frecuencias" queryPlaceholder="Buscar frecuencia..." value={subscriptionFilters.frequency} />
          <button aria-expanded={showMoreFilters} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm text-storm transition hover:text-ink" onClick={() => setShowMoreFilters((value) => !value)} type="button"><SlidersHorizontal className="h-4 w-4" />Más filtros</button>
        </div>
        {showMoreFilters ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            <label className="flex h-14 items-center gap-3 rounded-xl border border-white/[0.1] px-4 text-sm text-ink"><input checked={subscriptionFilters.pinned} onChange={(event) => updateSubscriptionFilter("pinned", event.target.checked)} type="checkbox" />Solo fijadas</label>
            <SearchablePicker appearance="toolbar" emptyMessage="No hay proveedores." onChange={(value) => updateSubscriptionFilter("vendor", value)} options={[{ value: "", label: "Todos los proveedores", description: "", leadingLabel: "—" }, ...subscriptionVendors.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Proveedor" placeholderLabel="Todos los proveedores" queryPlaceholder="Buscar proveedor..." value={subscriptionFilters.vendor} />
            <SearchablePicker appearance="toolbar" emptyMessage="No hay categorías." onChange={(value) => updateSubscriptionFilter("category", value)} options={[{ value: "", label: "Todas las categorías", description: "", leadingLabel: "—" }, ...subscriptionCategories.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Categoría" placeholderLabel="Todas las categorías" queryPlaceholder="Buscar categoría..." value={subscriptionFilters.category} />
            <SearchablePicker appearance="toolbar" emptyMessage="No hay cuentas." onChange={(value) => updateSubscriptionFilter("account", value)} options={[{ value: "", label: "Todas las cuentas", description: "", leadingLabel: "—" }, ...subscriptionAccounts.map((value) => ({ value, label: value, description: "", leadingLabel: value.slice(0, 2).toUpperCase() }))]} placeholderDescription="Cuenta" placeholderLabel="Todas las cuentas" queryPlaceholder="Buscar cuenta..." value={subscriptionFilters.account} />
            <input aria-label="Filtrar por monto" className="field-dark !h-14" onChange={(event) => updateSubscriptionFilter("amount", event.target.value)} placeholder="Monto" type="search" value={subscriptionFilters.amount} />
            <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
              <div><p className="mb-1 text-[10px] uppercase tracking-[0.15em] text-storm">Cobro desde</p><DatePickerField appearance="compact" onChange={(value) => updateSubscriptionFilter("nextDueDateFrom", value)} value={subscriptionFilters.nextDueDateFrom} /></div>
              <div><p className="mb-1 text-[10px] uppercase tracking-[0.15em] text-storm">Cobro hasta</p><DatePickerField appearance="compact" onChange={(value) => updateSubscriptionFilter("nextDueDateTo", value)} value={subscriptionFilters.nextDueDateTo} /></div>
            </div>
            <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-3">{([ ["all", "Todo"], ["overdue", "Vencidas"], ["today", "Hoy"], ["next7", "Próx. 7 días"], ["month", "Este mes"] ] as const).map(([value, label]) => <button className="rounded-lg border border-white/[0.1] px-3 py-2 text-sm text-storm hover:text-ink" key={value} onClick={() => applyDuePreset(value)} type="button">{label}</button>)}</div>
          </div>
        ) : null}
        {hasActiveFilters ? <button className="mt-2 text-xs text-storm underline-offset-4 hover:text-ink hover:underline" onClick={clearSubscriptionFilters} type="button">Limpiar filtros</button> : null}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-2 border-y border-white/[0.08] px-1 py-3 text-sm text-storm">
        <span>Los <span className="font-semibold text-ink">{filteredSubscriptions.length}</span> del filtro · {activeInFilter.length} activas{pausedInFilter ? ` · ${pausedInFilter} pausadas, no suman` : ""}</span>
        <span>Al mes <strong className="font-semibold text-ink">{formatCurrency(monthlyTotal, baseCurrencyCode)}</strong></span>
      </section>

      {feedback && feedback.tone !== "error" && !isEditorOpen ? (
        <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} />
      ) : null}

      {subscriptions.length === 0 ? (
        <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Crear primera suscripción</Button>} description="Todavía no hay pagos recurrentes registrados en este espacio." title="Sin suscripciones" />
      ) : filteredSubscriptions.length === 0 ? (
        <DataState action={hasActiveFilters ? <Button onClick={clearSubscriptionFilters} variant="secondary">Quitar filtros</Button> : undefined} description="No hay suscripciones que coincidan con los filtros." title="Sin resultados" />
      ) : (
        <SubscriptionTable
          allSelected={allSelected}
          onAnalytics={setAnalyticsSubscriptionId}
          onClearAll={clearAll}
          onDelete={setDeleteTargetId}
          onEdit={openEditEditor}
          onOpen={(subscription) => { setDetailInitialPanel("detail"); setDetailSubscriptionId(subscription.id); }}
          onPay={(subscription) => { setDetailInitialPanel("pay"); setDetailSubscriptionId(subscription.id); }}
          onReactivate={(subscription) => void runStatusChange(subscription, "active")}
          onSelectAll={selectAll}
          onToggleSelect={toggleSelect}
          selectedIds={selectedIds}
          someSelected={someSelected}
          subscriptions={paginatedSubscriptions}
        />
      )}

      {filteredSubscriptions.length > 0 ? (
        <Pagination
          onPageChange={setCurrentPage}
          page={safePage}
          pageSize={SUBSCRIPTIONS_PAGE_SIZE}
          totalItems={filteredSubscriptions.length}
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
          movements={snapshot?.movements ?? []}
          onSubmit={handleSubmit}
          updateFormState={updateFormState}
        />
      ) : null}

      {detailSubscription && !isEditorOpen ? <SubscriptionDetailDialog
        accounts={accounts}
        initialPanel={detailInitialPanel}
        categories={categories}
        isPending={isActionPending}
        movements={snapshot?.movements ?? []}
        onAnalytics={() => setAnalyticsSubscriptionId(detailSubscription.id)}
        onClose={() => setDetailSubscriptionId(null)}
        onDelete={() => { setDetailSubscriptionId(null); setDeleteTargetId(detailSubscription.id); }}
        onEdit={() => openEditEditor(detailSubscription)}
        onPay={(input) => handleMarkPaid(detailSubscription, input)}
        onOpenMovement={(movementId) => navigate(`/app/movements?period=all&movement=${movementId}`)}
        onAssignAccount={(value) => void handleAssignField(detailSubscription, "account_id", value)}
        onAssignCategory={(value) => void handleAssignField(detailSubscription, "category_id", value)}
        onPin={() => void handleTogglePin(detailSubscription)}
        onStatus={(status) => status === "cancelled" ? setCancelSubscriptionId(detailSubscription.id) : void runStatusChange(detailSubscription, status)}
        subscription={detailSubscription}
      /> : null}

      {cancelSubscription ? <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/75 p-3" role="presentation">
        <div aria-labelledby="cancel-subscription-title" aria-modal="true" className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#1a1917] p-6" role="dialog">
          <h2 className="font-display text-xl font-semibold text-ink" id="cancel-subscription-title">¿Cancelar suscripción?</h2>
          <p className="mt-3 text-sm leading-6 text-storm">«{cancelSubscription.name}» dejará de generar cobros. Su historial de pagos se conserva y podrás reactivarla cuando quieras.</p>
          <div className="mt-6 flex gap-3"><Button disabled={isActionPending} onClick={() => void runStatusChange(cancelSubscription, "cancelled")}>Sí, cancelar</Button><Button disabled={isActionPending} onClick={() => setCancelSubscriptionId(null)} variant="ghost">Volver</Button></div>
        </div>
      </div> : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          badge="Eliminar suscripciÃ³n"
          description="Esto elimina la suscripción y su calendario asociado. Si ya tiene movimientos vinculados, primero tendrás que resolverlos."
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
                {getFrequencyOption(deleteTarget.frequency).label}
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
        archiveLabel="Pausar"
        isArchiving={isActionPending}
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadSubscriptionsCSV(selectedItems, `suscripciones-seleccionadas-${new Date().toISOString().slice(0, 10)}.csv`)}
        onArchive={selectedItems.some((subscription) => subscription.status === "active") ? () => void handleBulkPause() : undefined}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredSubscriptions.length}
      />
      {showBulkDeleteConfirm ? (
        <div className="fixed inset-0 z-[310] flex items-center justify-center bg-black/75 p-3" role="dialog" aria-modal="true" aria-labelledby="sub-bulk-title">
          <div className="w-full max-w-md rounded-[14px] border border-white/10 bg-[#1a1917] p-6 shadow-none">
            <h2 id="sub-bulk-title" className="font-display text-xl font-semibold text-ink">
              Eliminar {selectedCount} suscripción{selectedCount !== 1 ? "es" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Esta acción eliminará permanentemente las suscripciones seleccionadas. No se puede deshacer.
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
