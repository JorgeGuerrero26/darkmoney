import { LoaderCircle } from "lucide-react";
import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { Modal } from "../../../components/ui/modal";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { ResourceEditorDestination, ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, CategorySummary, CounterpartySummary, MovementRecord, RecurringIncomeFrequency, RecurringIncomeStatus } from "../../../types/domain";
import { frequencyOptions, statusOptions } from "../lib/recurring-income-presenters";

export type RecurringIncomeFormState = {
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

export type FeedbackState = {
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

export const labelClassName = "text-[13px] font-medium text-storm";

export function getCurrencyLabel(currencyCode: string) {
  return (
    currencyOptions.find((option) => option.code === currencyCode.toUpperCase()) ?? {
      code: currencyCode.toUpperCase(),
      label: "Moneda registrada",
      region: "Configurada en tu base",
      symbol: currencyCode.toUpperCase(),
    }
  );
}

export function Field({ children, errorKey, hint, invalidFields, label }: { children: ReactNode; errorKey?: string; hint?: string; invalidFields?: Set<string>; label: string }) {
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

export function Input({
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

export function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${textareaClassName} ${className}`} {...props} />;
}

export function RecurringIncomeEditorDialog({
  context,
  accounts,
  baseCurrencyCode,
  categories,
  clearFieldError,
  closeEditor,
  counterparties,
  movements,
  feedback,
  formState,
  invalidFields,
  isCreateMode,
  isSaving,
  onSubmit,
  updateFormState,
}: {
  context?: ReactNode;
  accounts: AccountSummary[];
  baseCurrencyCode: string;
  categories: CategorySummary[];
  clearFieldError: (field: string) => void;
  closeEditor: () => void;
  counterparties: CounterpartySummary[];
  movements: MovementRecord[];
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
  if (!currencyPickerOptions.some(item => item.value === formState.currencyCode)) {
    currencyPickerOptions.push({ value: formState.currencyCode, label: formState.currencyCode, description: "Moneda registrada.", leadingLabel: formState.currencyCode });
  }
  const needsDayOfWeek = formState.frequency === "weekly";
  const needsDayOfMonth = ["monthly", "quarterly", "yearly"].includes(formState.frequency);
  const matchingMovement = movements.find((item) => {
    if (item.movementType !== "income" || item.status !== "posted") return false;
    const query = formState.name.trim().toLowerCase();
    return (query.length >= 3 && item.description.toLowerCase().includes(query)) || (formState.payerPartyId && item.counterpartyId === Number(formState.payerPartyId));
  });
  const suggestedCategory = !formState.categoryId ? categoryOptions.find((item) => item.value === String(matchingMovement?.categoryId ?? "")) : null;
  const suggestedAccount = !formState.accountId ? accountOptions.find((item) => item.value === String(matchingMovement?.destinationAccountId ?? "")) : null;

  return (
    <Modal className={resourceEditorSurfaceClassName} disableOutsideClose={isSaving} labelledBy="income-editor-title" onClose={closeEditor}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
        <ResourceEditorHeader disabled={isSaving} onBack={panel === "breakdown" ? () => setPanel("details") : panel === "details" ? () => setPanel("main") : undefined} onClose={closeEditor} title={panel === "main" ? (isCreateMode ? "Nuevo ingreso fijo" : "Editar ingreso fijo") : panel === "breakdown" ? "Desglose" : "Detalles"} titleId="income-editor-title" />
        <div className="min-h-0 overflow-y-auto px-5 py-3 sm:px-7">
          {context ? <div className="mb-4 text-xs leading-5 text-storm">{context}</div> : null}
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
              {suggestedAccount ? <button className="text-left text-xs text-storm underline underline-offset-4 hover:text-ink" onClick={() => { clearFieldError("accountId"); updateFormState("accountId", suggestedAccount.value); }} type="button">Cuenta sugerida por tus ingresos anteriores: {suggestedAccount.label}</button> : null}
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
              {suggestedCategory ? <button className="text-left text-xs text-storm underline underline-offset-4 hover:text-ink" onClick={() => updateFormState("categoryId", suggestedCategory.value)} type="button">Categoría sugerida por tus movimientos: {suggestedCategory.label}</button> : null}
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
