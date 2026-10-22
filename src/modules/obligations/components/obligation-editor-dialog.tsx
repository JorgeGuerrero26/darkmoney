import { LoaderCircle } from "lucide-react";
import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { Modal } from "../../../components/ui/modal";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { ResourceEditorDestination, ResourceEditorHeader } from "../../../components/ui/resource-editor";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { formatCurrency } from "../../../lib/formatting/money";
import type { AccountSummary, AttachmentSummary, CounterpartySummary, ObligationEventSummary, ObligationShareSummary, ObligationSummary, ObligationStatus } from "../../../types/domain";
import { CompactAttachmentField, CompactPendingAttachmentField } from "../../attachments/components/compact-attachment-field";
import { PaymentPlanEditor } from "./payment-plan-editor";
import { describePlan, expandPaymentPlan, type PaymentPlan } from "../lib/payment-plan";
import { currencyOptions, statusOptions, getOriginTypeOptions, getOpeningImpactMeta, getCurrencyLabel, isCreatableOrigin, type ObligationFormState, type FeedbackState, type ShareInviteFormState } from "../lib/obligation-editor-model";
import { obligationCreateInterest, obligationPlanBasis, obligationPlanDebtContext } from "../lib/obligation-editor-input";
import { getOriginOption } from "../lib/obligations-presenters";

export type PickerProps = {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholderLabel: string;
  placeholderDescription: string;
  queryPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
};

export const inputClassName = "field-dark";

export const textareaClassName = "field-dark min-h-[140px] resize-y py-4 leading-7";

export const labelClassName =
  "text-[0.8125rem] font-medium tracking-[0.01em] text-storm";

export function Picker({
  disabled = false,
  emptyMessage,
  onChange,
  options,
  placeholderDescription,
  placeholderLabel,
  queryPlaceholder,
  value,
}: PickerProps) {
  return (
    <SearchablePicker
      disabled={disabled}
      emptyMessage={emptyMessage}
      onChange={onChange}
      options={options}
      placeholderDescription={placeholderDescription}
      placeholderLabel={placeholderLabel}
      queryPlaceholder={queryPlaceholder}
      value={value}
    />
  );
}

export function Field({ children, errorKey, hint, invalidFields, label }: { children: ReactNode; errorKey?: string; hint?: string; invalidFields?: Set<string>; label: string }) {
  const hasError = !!errorKey && !!invalidFields?.has(errorKey);
  return (
    <label className="block">
      <span className={labelClassName}>{label}</span>
      <div
        className={`mt-1.5${hasError ? " field-error-ring" : ""}`}
        data-field={errorKey}
      >
        {children}
      </div>
      {hint ? <p className="mt-2 text-xs leading-6 text-storm/75">{hint}</p> : null}
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
  return (
    <textarea
      className={`${textareaClassName} ${className}`}
      {...props}
    />
  );
}

export type ObligationEditorProps = {
  context?: ReactNode;
  saveBlocked?: boolean;
  accounts: AccountSummary[];
  accessMessage: string;
  attachments: AttachmentSummary[];
  baseCurrencyCode: string;
  canManageReceipts: boolean;
  canShareObligations: boolean;
  closeEditor: () => void;
  counterparties: CounterpartySummary[];
  currentShare: ObligationShareSummary | null;
  feedback: FeedbackState | null;
  formState: ObligationFormState;
  handleDeleteReceipt: (attachment: AttachmentSummary) => Promise<void>;
  handleUploadReceipt: (file: File) => Promise<void>;
  isCreateMode: boolean;
  isSaving: boolean;
  isUploadingReceipt: boolean;
  onDeleteEvent: (event: ObligationEventSummary) => void;
  onEditEvent: (event: ObligationEventSummary) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  invalidFields: Set<string>;
  clearFieldError: (field: string) => void;
  pendingReceiptFile: File | null;
  shareAccessMessage: string;
  shareFormState: ShareInviteFormState;
  selectedObligation: ObligationSummary | null;
  updatePendingReceiptFile: (file: File | null) => void;
  updateShareFormState: <Field extends keyof ShareInviteFormState>(
    field: Field,
    value: ShareInviteFormState[Field],
  ) => void;
  updateFormState: <Field extends keyof ObligationFormState>(
    field: Field,
    value: ObligationFormState[Field],
  ) => void;
};

export function ObligationEditorDialog(props: ObligationEditorProps) {
  const {
    context,
    accounts,
    accessMessage,
    attachments,
    baseCurrencyCode,
    canManageReceipts,
    canShareObligations,
    clearFieldError,
    closeEditor,
    counterparties,
    currentShare,
    feedback,
    formState,
    handleDeleteReceipt,
    handleUploadReceipt,
    invalidFields,
    isCreateMode,
    isSaving,
    saveBlocked = false,
    isUploadingReceipt,
    onSubmit,
    pendingReceiptFile,
    shareAccessMessage,
    shareFormState,
    selectedObligation,
    updatePendingReceiptFile,
    updateShareFormState,
    updateFormState,
  } = props;
  const [panel, setPanel] = useState<"main" | "details" | "plan">("main");
  const currencyCode = formState.currencyCode || baseCurrencyCode;
  // Al crear con interés pactado, el plan reparte el total a devolver (móvil); al editar, el monto.
  const createInterest = isCreateMode ? obligationCreateInterest(formState) : null;
  // Al editar, el plan se muestra y valida sobre la deuda de hoy, igual que el detalle y la proyección (móvil).
  const planDebtContext = !isCreateMode && selectedObligation ? obligationPlanDebtContext(selectedObligation, Number(formState.principalAmount) || 0) : null;
  const principalForPlan = (createInterest ? createInterest.planBasis : obligationPlanBasis(formState.paymentPlan, Number(formState.principalAmount) || 0, formState.startDate, planDebtContext)) || 0;
  const returnTotalText = formState.returnTotal.trim() ? formState.returnTotal : formState.principalAmount;
  const planLabel = describePlan(formState.paymentPlan, principalForPlan, formState.startDate, (amount) => formatCurrency(amount, currencyCode));
  const savePlan = (plan: PaymentPlan | null) => {
    updateFormState("paymentPlan", plan);
    const rows = plan ? expandPaymentPlan(plan, principalForPlan, formState.startDate) : [];
    updateFormState("installmentCount", rows.length ? String(rows.length) : "");
    updateFormState("installmentAmount", rows.length ? String(rows[0].amount) : "");
    setPanel("details");
  };
  const openingImpact = getOpeningImpactMeta(formState.direction, formState.originType, formState.manualOpeningImpact);
  const neutralize = (options: ReadonlyArray<{ value: string; label: string; description: string; leadingLabel: string }>): PickerOption[] => options.map((item) => ({ ...item, leadingColor: "#6b6459" }));
  // Al crear se ofrecen los orígenes de móvil; uno guardado o prellenado que ya no se ofrece se muestra igual.
  const originOptions: PickerOption[] = neutralize(getOriginTypeOptions(formState.direction));
  if (formState.originType && !originOptions.some((item) => item.value === formState.originType)) {
    const current = getOriginOption(formState.originType, formState.direction);
    originOptions.push({ value: formState.originType, label: current.label, description: current.description, leadingLabel: current.leadingLabel, leadingColor: "#6b6459" });
  }
  const changeDirection = (direction: "receivable" | "payable") => {
    updateFormState("direction", direction);
    // Un origen que no corresponde a la nueva dirección se vacía y se vuelve a pedir (móvil).
    if (formState.originType && formState.originType !== "manual" && !isCreatableOrigin(direction, formState.originType)) updateFormState("originType", "");
  };
  const counterpartyOptions = counterparties.filter((item) => !item.isArchived || String(item.id) === formState.counterpartyId).map<PickerOption>((item) => ({ value: String(item.id), label: item.name, description: item.type, leadingLabel: item.name.slice(0, 2).toUpperCase(), leadingColor: "#6b6459" }));
  const accountOptions = accounts.filter((item) => !item.isArchived || String(item.id) === formState.settlementAccountId).map<PickerOption>((item) => ({ value: String(item.id), label: item.name, description: `${item.type} · ${item.currencyCode}`, leadingLabel: item.currencyCode, leadingColor: "#6b6459" }));
  const openingAccountOptions = accounts.filter((item) => (!item.isArchived || String(item.id) === formState.openingAccountId) && item.currencyCode === currencyCode).map<PickerOption>((item) => ({ value: String(item.id), label: item.name, description: `${item.type} · ${item.currencyCode}`, leadingLabel: item.currencyCode, leadingColor: "#6b6459" }));
  const currencyPickerOptions: PickerOption[] = currencyOptions.map(item => ({ value: item.code, label: item.code, description: item.label, leadingLabel: item.symbol, leadingColor: "#6b6459" }));
  if (!currencyPickerOptions.some(item => item.value === currencyCode)) currencyPickerOptions.push({ value: currencyCode, label: currencyCode, description: "Moneda registrada.", leadingLabel: currencyCode });

  useEffect(() => {
    if (!invalidFields.size) return;
    const detailFields = ["startDate", "openingAccountId"];
    if ([...invalidFields].some((field) => detailFields.includes(field))) setPanel("details");
  }, [invalidFields]);

  return (
    <Modal className="resource-editor !max-w-[640px] !bg-[#1a1917]" disableOutsideClose={isSaving} labelledBy="obligation-editor-title" onClose={closeEditor}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={(event) => { if (panel === "plan") { event.preventDefault(); return; } onSubmit(event); }}>
        <ResourceEditorHeader disabled={isSaving} onBack={panel === "plan" ? () => setPanel("details") : panel === "details" ? () => setPanel("main") : undefined} onClose={closeEditor} title={panel === "main" ? (isCreateMode ? "Nuevo crédito o deuda" : "Editar crédito o deuda") : panel === "plan" ? "Plan de pagos" : "Detalles"} titleId="obligation-editor-title" />

        <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-7">
          {context ? <div className="mb-4 text-xs leading-5 text-storm">{context}</div> : null}
          {feedback ? <FormFeedbackBanner className="mb-5" description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

          {panel === "plan" ? <PaymentPlanEditor currencyCode={currencyCode} debtContext={planDebtContext ?? undefined} onSave={savePlan} plan={formState.paymentPlan} principal={createInterest ? principalForPlan : Number(formState.principalAmount) || 0} startDate={formState.startDate} /> : panel === "main" ? <div className="space-y-5">
            <div data-field="principalAmount">
              <Field errorKey="principalAmount" invalidFields={invalidFields} label={`Monto (${getCurrencyLabel(currencyCode).symbol})`}><Input autoFocus className="h-16 font-display text-[2rem] font-semibold" data-modal-initial-focus={isCreateMode ? "" : undefined} disabled={!isCreateMode} id="obligation-principal" inputMode="decimal" min="0" onChange={(event) => { clearFieldError("principalAmount"); updateFormState("principalAmount", event.target.value); }} placeholder="0.00" step="0.01" type="number" value={formState.principalAmount} /></Field>
              {invalidFields.has("principalAmount") ? <p className="mt-2 text-xs text-rose-300">Ingresa un monto válido.</p> : null}
            </div>

            {isCreateMode && createInterest ? <div data-field="returnTotal">
              {/* Sigue al monto hasta que se cambia; la diferencia es el interés pactado (móvil). */}
              <Field errorKey="returnTotal" invalidFields={invalidFields} label={formState.direction === "receivable" ? "Total que te devolverán" : "Total que devolverás"}><Input id="obligation-return-total" inputMode="decimal" min="0" onChange={(event) => { clearFieldError("returnTotal"); updateFormState("returnTotal", event.target.value.trim() ? event.target.value : ""); }} placeholder="0.00" step="0.01" type="number" value={returnTotalText} /></Field>
              <p className={`mt-2 text-xs ${createInterest.belowPrincipal ? "text-rose-300" : "text-storm"}`}>{createInterest.belowPrincipal ? "No puede ser menor que el monto." : createInterest.interestAmount > 0 ? `Incluye ${formatCurrency(createInterest.interestAmount, currencyCode)} de interés (${createInterest.interestPercent}%). Se suma al monto de la deuda sin mover tus cuentas.` : "Se llena solo con el monto. Cámbialo si te van a devolver más."}</p>
            </div> : null}

            <div data-field="title"><Field errorKey="title" invalidFields={invalidFields} label="Título"><Input maxLength={120} onChange={(event) => { clearFieldError("title"); updateFormState("title", event.target.value); }} placeholder="Préstamo familiar" value={formState.title} /></Field></div>

            <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-[#141311] p-1">
              <button className={`min-h-14 rounded-lg px-4 text-left transition ${formState.direction === "receivable" ? "bg-ink text-void" : "text-storm hover:text-ink"}`} disabled={!isCreateMode} onClick={() => changeDirection("receivable")} type="button"><span className="block text-sm font-semibold">Crédito</span><span className="text-xs opacity-75">Me deben</span></button>
              <button className={`min-h-14 rounded-lg px-4 text-left transition ${formState.direction === "payable" ? "bg-ink text-void" : "text-storm hover:text-ink"}`} disabled={!isCreateMode} onClick={() => changeDirection("payable")} type="button"><span className="block text-sm font-semibold">Deuda</span><span className="text-xs opacity-75">Yo debo</span></button>
            </div>

            <div data-field="counterpartyId"><Field errorKey="counterpartyId" invalidFields={invalidFields} label="Contraparte"><Picker disabled={!counterpartyOptions.length} emptyMessage="No tienes contrapartes disponibles." onChange={(value) => { clearFieldError("counterpartyId"); updateFormState("counterpartyId", value); }} options={counterpartyOptions} placeholderDescription="Persona o entidad relacionada." placeholderLabel="Selecciona una contraparte" queryPlaceholder="Buscar contraparte..." value={formState.counterpartyId} /></Field></div>

            <div data-field="originType"><Field errorKey="originType" invalidFields={invalidFields} label="Cómo nació"><Picker disabled={!isCreateMode} emptyMessage="No hay orígenes." onChange={(value) => { clearFieldError("originType"); updateFormState("originType", value as ObligationFormState["originType"]); }} options={originOptions} placeholderDescription="El origen decide si se mueve una cuenta al crearla." placeholderLabel="Elegir cómo nació" queryPlaceholder="Buscar origen..." value={formState.originType} /></Field>{invalidFields.has("originType") ? <p className="mt-2 text-xs text-rose-300">Elige cómo nació: presté dinero, vendí a cuotas…</p> : null}</div>

            <ResourceEditorDestination onClick={() => setPanel("details")} summary="Plan, cuentas, notas y comprobante" />
            <p className="text-xs leading-5 text-storm">Con monto, título, tipo, contraparte y cómo nació ya puedes guardar. El resto es opcional salvo que el origen mueva una cuenta.</p>
          </div> : <div className="space-y-5">
            <Field label="Moneda"><Picker disabled={!isCreateMode} emptyMessage="No hay monedas." onChange={(value) => updateFormState("currencyCode", value)} options={currencyPickerOptions} placeholderDescription="Moneda principal." placeholderLabel="Selecciona moneda" queryPlaceholder="Buscar moneda..." value={currencyCode} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><div data-field="startDate"><Field errorKey="startDate" invalidFields={invalidFields} label="Inicio"><DatePickerField appearance="compact" disabled={!isCreateMode} onChange={(value) => { clearFieldError("startDate"); updateFormState("startDate", value); }} value={formState.startDate} /></Field></div><Field label="Vencimiento"><DatePickerField appearance="compact" onChange={(value) => updateFormState("dueDate", value)} value={formState.dueDate} /></Field></div>
            {isCreateMode && openingImpact.requiresAccount ? <div data-field="openingAccountId"><Field errorKey="openingAccountId" invalidFields={invalidFields} label="Cuenta de apertura"><Picker emptyMessage="No hay cuentas compatibles." onChange={(value) => { clearFieldError("openingAccountId"); updateFormState("openingAccountId", value); }} options={openingAccountOptions} placeholderDescription={openingImpact.description} placeholderLabel="Selecciona una cuenta" queryPlaceholder="Buscar cuenta..." value={formState.openingAccountId} /></Field></div> : null}
            <div><Field label="Cuenta habitual"><Picker emptyMessage="No hay cuentas." onChange={(value) => updateFormState("settlementAccountId", value)} options={accountOptions} placeholderDescription="Opcional." placeholderLabel="Sin asignar" queryPlaceholder="Buscar cuenta..." value={formState.settlementAccountId} /></Field><p className="mt-2 text-xs leading-5 text-storm">La cuenta habitual es la que aparece elegida al registrar un cobro o un pago de esta deuda. Es opcional y se puede cambiar cada vez.</p></div>
            {!isCreateMode ? <Field label="Estado"><Picker emptyMessage="No hay estados." onChange={(value) => updateFormState("status", value as ObligationStatus)} options={neutralize(statusOptions)} placeholderDescription="Estado del registro." placeholderLabel="Selecciona estado" queryPlaceholder="Buscar estado..." value={formState.status} /></Field> : null}

            <section><p className={labelClassName}>Cómo se paga</p><button className="mt-3 flex min-h-14 w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#141311] px-4 text-left text-sm" onClick={() => setPanel("plan")} type="button"><span className="font-medium text-ink">Plan de pagos</span><span className="text-right text-storm">{planLabel ?? "Sin plan"} ›</span></button>{formState.paymentPlan?.mode === "equal" && planLabel ? <p className="mt-2 text-xs text-storm">La cuota se calcula a partir del monto y se recalcula si cambia.</p> : null}</section>
            <Field label="Descripción"><Textarea className="min-h-20" onChange={(event) => updateFormState("description", event.target.value)} placeholder="Contexto visible del registro" value={formState.description} /></Field>
            <Field label="Notas"><Textarea className="min-h-20" onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Notas internas" value={formState.notes} /></Field>

            {isCreateMode ? <CompactPendingAttachmentField canUpload={canManageReceipts} file={pendingReceiptFile} lockedMessage={accessMessage} onChange={updatePendingReceiptFile} /> : selectedObligation ? <CompactAttachmentField accessMessage={accessMessage} attachments={attachments} canManage={canManageReceipts} isUploading={isUploadingReceipt} onDelete={(attachment) => void handleDeleteReceipt(attachment)} onUpload={(file) => void handleUploadReceipt(file)} /> : null}

            <section className="border-t border-white/[0.09] pt-5"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-ink">Compartir</p><p className="mt-1 text-xs text-storm">{currentShare ? `Asociado a ${currentShare.invitedDisplayName ?? currentShare.invitedEmail}` : "Asocia a otra persona en modo lectura."}</p></div></div>{canShareObligations ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Correo"><Input autoComplete="email" onChange={(event) => updateShareFormState("invitedEmail", event.target.value)} placeholder="persona@correo.com" type="email" value={shareFormState.invitedEmail} /></Field><Field label="Mensaje"><Input onChange={(event) => updateShareFormState("message", event.target.value)} placeholder="Mensaje opcional" value={shareFormState.message} /></Field></div> : <p className="mt-3 text-sm text-storm">{shareAccessMessage}</p>}</section>
          </div>}
        </div>

        {panel !== "plan" ? <footer className="border-t border-white/[0.08] px-5 py-4 sm:px-7"><Button className="w-full" disabled={isSaving || saveBlocked} type="submit">{saveBlocked ? "Comprueba el registro en la cartera" : isSaving ? <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" />Guardando...</> : isCreateMode ? "Crear crédito o deuda" : "Guardar cambios"}</Button></footer> : null}
      </form>
    </Modal>
  );
}
