import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { Modal } from "../../../components/ui/modal";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { ResourceEditorDestination, ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import type { AccountSummary, CategorySummary, CounterpartySummary, MovementRecord, SubscriptionFrequency, SubscriptionStatus } from "../../../types/domain";
import { suggestSubscriptionFields } from "../lib/subscription-patterns";
import { frequencyOptions } from "../lib/subscriptions-presenters";

export type SubscriptionFormState = {
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

export function SubscriptionEditorDialog({
  context,
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
  context?: ReactNode;
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
    <Modal className="resource-editor !max-w-[640px] !bg-[#1a1917]" disableOutsideClose={isSaving} labelledBy="subscription-editor-title" onClose={closeEditor}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
        <ResourceEditorHeader disabled={isSaving} onBack={panel === "optional" ? () => setPanel("main") : undefined} onClose={closeEditor} title={panel === "main" ? (isCreateMode ? "Nueva suscripción" : "Editar suscripción") : "Opcionales"} titleId="subscription-editor-title" />
        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
          {context ? <div className="mb-4 text-xs leading-5 text-storm">{context}</div> : null}
          {feedback?.tone === "error" ? <FormFeedbackBanner className="mb-5" description={feedback.description} title={feedback.title} tone="error" /> : null}
          {panel === "main" ? (
            <div className="space-y-5">
              <div data-field="amount">
                <Field errorKey="amount" invalidFields={invalidFields} label={"Monto (" + getCurrencyLabel(formState.currencyCode || baseCurrencyCode).symbol + ")"}>
                  <Input autoFocus className="h-16 font-display text-[2rem] font-semibold" data-modal-initial-focus inputMode="decimal" onChange={(event) => { clearFieldError("amount"); updateFormState("amount", event.target.value); }} placeholder="0.00" type="number" value={formState.amount} />
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
    </Modal>
  );
}
