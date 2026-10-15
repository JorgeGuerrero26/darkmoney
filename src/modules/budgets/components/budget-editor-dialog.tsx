import { Check, ChevronRight } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Button } from "../../../components/ui/button";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { FormField } from "../../../components/ui/form-field";
import { Modal, ModalFooter } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorDestination, ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { formatCurrency } from "../../../lib/formatting/money";
import type { BudgetOverview, CategorySummary } from "../../../types/domain";
import { firstBudgetPeriod, inferBudgetRecurrence, recurrenceLabel, recurrenceOptions, type BudgetRecurrence } from "../lib/budget-periods";

export type BudgetEditorValue = {
  name: string;
  scopeChosen: boolean;
  categoryId: number | null;
  accountId: number | null;
  spendTypeId: number | null;
  limitAmount: string;
  recurrence: BudgetRecurrence;
  periodStart: string;
  periodEnd: string;
  alertPercent: number;
  currencyCode: string;
  rolloverEnabled: boolean;
  notes: string;
  isActive: boolean;
};

export function initialBudgetEditorValue(today: string, baseCurrency: string, budget?: BudgetOverview): BudgetEditorValue {
  const period = firstBudgetPeriod(today, "monthly");
  return {
    name: budget?.name ?? "",
    scopeChosen: Boolean(budget),
    categoryId: budget?.categoryId ?? null,
    accountId: budget?.accountId ?? null,
    spendTypeId: budget?.spendTypeId ?? null,
    limitAmount: budget ? String(budget.limitAmount) : "",
    recurrence: budget ? (budget.recurrence && budget.recurrence !== "none" ? budget.recurrence : inferBudgetRecurrence(budget)) : "monthly",
    periodStart: budget?.periodStart ?? period.periodStart,
    periodEnd: budget?.periodEnd ?? period.periodEnd,
    alertPercent: budget?.alertPercent ?? 80,
    currencyCode: budget?.currencyCode ?? baseCurrency,
    rolloverEnabled: budget?.rolloverEnabled ?? false,
    notes: budget?.notes ?? "",
    isActive: budget?.isActive ?? true,
  };
}

type Option = { id: number; name: string };
type Props = {
  context?: ReactNode;
  value: BudgetEditorValue;
  onChange: (value: BudgetEditorValue) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  categories: CategorySummary[];
  accounts: Option[];
  spendTypes: Option[];
  currencies: string[];
  isCreate: boolean;
  isSaving: boolean;
  error: string | null;
};

const field = "h-12 w-full rounded-[10px] border border-white/10 bg-[#141311] px-4 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-storm/60 hover:border-white/20 focus:border-white/40 focus-visible:ring-2 focus-visible:ring-white/10";

function RowSelect({ label, value, onChange, options, allLabel }: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  options: Option[];
  allLabel: string;
}) {
  return (
    <label className="flex min-h-[54px] items-center justify-between gap-4 border-b border-white/10 px-4 text-sm last:border-0">
      <span className="font-medium text-ink">{label}</span>
      <select aria-label={label} className="max-w-[60%] cursor-pointer bg-transparent text-right text-sm text-storm outline-none focus-visible:text-ink" onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} value={value ?? ""}>
        <option className="bg-[#1a1917]" value="">{allLabel}</option>
        {options.map((option) => <option className="bg-[#1a1917]" key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

export function BudgetEditorDialog({ context, value, onChange, onClose, onSubmit, categories, accounts, spendTypes, currencies, isCreate, isSaving, error }: Props) {
  const [panel, setPanel] = useState<"main" | "scope" | "recurrence" | "alert" | "details">("main");
  useEffect(() => setPanel("main"), [isCreate]);
  function patch(update: Partial<BudgetEditorValue>) { onChange({ ...value, ...update }); }
  const scope = [
    categories.find((item) => item.id === value.categoryId)?.name,
    spendTypes.find((item) => item.id === value.spendTypeId)?.name,
    accounts.find((item) => item.id === value.accountId)?.name,
  ].filter(Boolean).join(" · ") || "Todo el gasto";
  const suggestedName = `${categories.find((item) => item.id === value.categoryId)?.name ?? spendTypes.find((item) => item.id === value.spendTypeId)?.name ?? "Presupuesto"} · ${recurrenceLabel(value.recurrence).toLowerCase()}`;

  return (
    <Modal className={resourceEditorSurfaceClassName} disableOutsideClose={isSaving} labelledBy="budget-editor-title" onClose={onClose}>
      <form className="flex min-h-0 flex-1 flex-col" noValidate onSubmit={onSubmit}>
        <ResourceEditorHeader disabled={isSaving} onBack={panel === "main" ? undefined : () => setPanel("main")} onClose={onClose} title={panel === "main" ? (isCreate ? "Nuevo presupuesto" : "Editar presupuesto") : panel === "scope" ? "Qué limitas" : panel === "recurrence" ? "Se renueva" : panel === "alert" ? "Avisarme al" : "Opcionales"} titleId="budget-editor-title" />
        <ModalBody className="!px-5 !py-5 sm:!px-6">
          {context ? <div className="mb-4 text-xs leading-5 text-storm">{context}</div> : null}
          {error ? <p className="mb-4 text-sm text-[#e6b7aa]" role="alert">{error}</p> : null}
          {panel === "main" ? (
            <div className="space-y-5">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
                <button className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 text-left text-sm transition-colors hover:bg-white/[0.04]" onClick={() => setPanel("scope")} type="button">
                  <span className="font-semibold text-ink">Qué limitas</span>
                  <span className="flex min-w-0 items-center gap-2 text-storm"><span className="truncate">{value.scopeChosen ? scope : "Elegir"}</span><ChevronRight className="h-4 w-4 shrink-0" /></span>
                </button>
              </div>
              <FormField label={`Cuánto por período (${value.currencyCode})`} required>
                <input autoFocus className={`${field} !h-16 font-display !text-[2rem] font-semibold`} inputMode="decimal" min="0" onChange={(event) => patch({ limitAmount: event.target.value })} placeholder="0.00" step="0.01" type="number" value={value.limitAmount} />
              </FormField>
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
                <button className="flex min-h-[54px] w-full items-center justify-between gap-3 border-b border-white/10 px-4 text-left text-sm transition-colors hover:bg-white/[0.04]" onClick={() => setPanel("recurrence")} type="button"><span className="font-semibold text-ink">Se renueva</span><span className="flex items-center gap-2 text-storm">{recurrenceLabel(value.recurrence)}<ChevronRight className="h-4 w-4" /></span></button>
                <button className="flex min-h-[54px] w-full items-center justify-between gap-3 px-4 text-left text-sm transition-colors hover:bg-white/[0.04]" onClick={() => setPanel("alert")} type="button"><span className="font-semibold text-ink">Avisarme al</span><span className="flex items-center gap-2 text-storm">{value.alertPercent}%<ChevronRight className="h-4 w-4" /></span></button>
              </div>
              {value.recurrence === "none" ? <div className="grid gap-4 sm:grid-cols-2"><FormField label="Desde"><DatePickerField appearance="compact" onChange={(date) => patch({ periodStart: date })} value={value.periodStart} /></FormField><FormField label="Hasta"><DatePickerField appearance="compact" onChange={(date) => patch({ periodEnd: date })} value={value.periodEnd} /></FormField></div> : <p className="text-xs leading-5 text-storm">{isCreate ? "El primer período empieza hoy. " : "El período actual conserva sus fechas. "}Los siguientes se abren al terminar cada período; los cerrados quedan en el historial.</p>}
              <ResourceEditorDestination label="Opcionales" onClick={() => setPanel("details")} summary="Nombre, moneda y notas" />
              <p className="text-xs leading-5 text-storm">{value.scopeChosen ? `Cuenta ${scope.toLowerCase()}.` : "Elige qué gasto vas a limitar, incluso si quieres limitar todo."} El límite es {value.limitAmount ? formatCurrency(Number(value.limitAmount) || 0, value.currencyCode) : "el monto que indiques"} por período.</p>
            </div>
          ) : panel === "scope" ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
                <RowSelect allLabel="Todas las categorías" label="Categoría" onChange={(categoryId) => patch({ categoryId })} options={categories.filter((item) => item.isActive && (item.kind === "expense" || item.kind === "both"))} value={value.categoryId} />
                <RowSelect allLabel="Cualquier tipo" label="Tipo de gasto" onChange={(spendTypeId) => patch({ spendTypeId })} options={spendTypes} value={value.spendTypeId} />
                <RowSelect allLabel="Todas las cuentas" label="Cuenta" onChange={(accountId) => patch({ accountId })} options={accounts} value={value.accountId} />
              </div>
              <p className="text-xs leading-5 text-storm">Categoría, tipo y cuenta se pueden combinar. Si dejas todo en “Todas”, contará todo el gasto.</p>
              <Button className="w-full" onClick={() => { patch({ scopeChosen: true }); setPanel("main"); }} type="button">Usar este alcance</Button>
            </div>
          ) : panel === "recurrence" ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">{recurrenceOptions.map((option) => <button className="flex min-h-[54px] w-full items-center justify-between border-b border-white/10 px-4 text-left text-sm last:border-0 hover:bg-white/[0.04]" key={option.value} onClick={() => { patch({ recurrence: option.value }); setPanel("main"); }} type="button"><span className={value.recurrence === option.value ? "font-semibold text-ink" : "text-storm"}>{option.label}</span>{value.recurrence === option.value ? <Check className="h-4 w-4 text-ink" /> : null}</button>)}</div>
          ) : panel === "alert" ? (
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">{[50, 70, 80, 90, 100].map((threshold) => <button className="flex min-h-[54px] w-full items-center justify-between border-b border-white/10 px-4 text-left text-sm last:border-0 hover:bg-white/[0.04]" key={threshold} onClick={() => { patch({ alertPercent: threshold }); setPanel("main"); }} type="button"><span className={value.alertPercent === threshold ? "font-semibold text-ink" : "text-storm"}>{threshold}%</span>{value.alertPercent === threshold ? <Check className="h-4 w-4 text-ink" /> : null}</button>)}</div>
          ) : (
            <div className="space-y-5">
              <FormField hint="Si lo dejas vacío, se genera con el alcance y la cadencia." label="Nombre"><input className={field} maxLength={120} onChange={(event) => patch({ name: event.target.value })} placeholder={suggestedName} value={value.name} /></FormField>
              <FormField label="Moneda"><select className={field} onChange={(event) => patch({ currencyCode: event.target.value })} value={value.currencyCode}>{currencies.map((currency) => <option className="bg-[#1a1917]" key={currency} value={currency}>{currency}</option>)}</select></FormField>
              <label className="flex min-h-[54px] cursor-pointer items-center justify-between border-y border-white/10 text-sm"><span><span className="block font-semibold text-ink">Guardar lo que sobre</span><span className="text-xs text-storm">Se guarda la preferencia; aún no modifica el próximo límite.</span></span><input checked={value.rolloverEnabled} className="h-4 w-4 accent-[#ede8df]" onChange={(event) => patch({ rolloverEnabled: event.target.checked })} type="checkbox" /></label>
              {!isCreate ? <label className="flex min-h-[54px] cursor-pointer items-center justify-between border-b border-white/10 text-sm"><span className="font-semibold text-ink">Presupuesto activo</span><input checked={value.isActive} className="h-4 w-4 accent-[#ede8df]" onChange={(event) => patch({ isActive: event.target.checked })} type="checkbox" /></label> : null}
              <FormField label="Notas"><textarea className={`${field} !min-h-[88px] resize-y py-3`} onChange={(event) => patch({ notes: event.target.value })} placeholder="Contexto para este presupuesto" value={value.notes} /></FormField>
            </div>
          )}
        </ModalBody>
        {panel !== "scope" && panel !== "recurrence" && panel !== "alert" ? <ModalFooter><Button className="w-full" disabled={isSaving} type="submit">{isSaving ? "Guardando..." : isCreate ? "Crear presupuesto" : "Guardar cambios"}</Button></ModalFooter> : null}
      </form>
    </Modal>
  );
}
