import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { DatePickerField } from "../../../components/ui/date-picker-field";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import type { RecurringIncomeSummary } from "../../../types/domain";
import { defaultRecurringIncomeTableFilters, incomeReferenceOptions, isRecurringIncomeTableFilterActive, type RecurringIncomeTableFilters } from "../lib/recurring-income-filters";
import { frequencyOptions, statusOptions } from "../lib/recurring-income-presenters";

export function IncomeFiltersToolbar({ items, filters, onChange, onClear }: {
  items: RecurringIncomeSummary[]; filters: RecurringIncomeTableFilters;
  onChange: (patch: Partial<RecurringIncomeTableFilters>) => void; onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statuses = filters.selectedStatuses.length ? filters.selectedStatuses : filters.status === "all" ? [] : [filters.status];
  const frequencies = filters.selectedFrequencies.length ? filters.selectedFrequencies : filters.frequency === "all" ? [] : [filters.frequency];
  const pickerOptions = (options: typeof statusOptions | typeof frequencyOptions, all: string, multiple: string, count: number) => [
    ...(count > 1 ? [{ value: "multiple", label: `${multiple} (${count})`, description: "Combina las opciones en Más filtros.", leadingLabel: "" }] : []),
    { value: "all", label: all, description: "", leadingLabel: "" }, ...options,
  ];
  const hasFilters = Object.keys(defaultRecurringIncomeTableFilters()).some(field => isRecurringIncomeTableFilterActive(filters, field as keyof RecurringIncomeTableFilters));
  return <section aria-label="Filtros de ingresos fijos">
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_auto]">
      <input aria-label="Buscar ingresos fijos" className="field-dark !h-14" onChange={event => onChange({ name: event.target.value })} placeholder="Buscar por nombre, pagador o categoría..." type="search" value={filters.name} />
      <SearchablePicker appearance="toolbar" emptyMessage="No hay estados." onChange={value => { if (value !== "multiple") onChange({ status: value as RecurringIncomeTableFilters["status"], selectedStatuses: [] }); }} options={pickerOptions(statusOptions, "Todos los estados", "Varios estados", statuses.length)} placeholderDescription="Estado" placeholderLabel="Todos los estados" queryPlaceholder="Buscar estado..." showSearch={false} value={statuses.length > 1 ? "multiple" : statuses[0] ?? "all"} />
      <SearchablePicker appearance="toolbar" emptyMessage="No hay frecuencias." onChange={value => { if (value !== "multiple") onChange({ frequency: value as RecurringIncomeTableFilters["frequency"], selectedFrequencies: [] }); }} options={pickerOptions(frequencyOptions, "Todas las frecuencias", "Varias frecuencias", frequencies.length)} placeholderDescription="Frecuencia" placeholderLabel="Todas las frecuencias" queryPlaceholder="Buscar frecuencia..." showSearch={false} value={frequencies.length > 1 ? "multiple" : frequencies[0] ?? "all"} />
      <button aria-expanded={expanded} className="flex h-14 items-center justify-center gap-2 rounded-xl border border-white/[0.1] px-4 text-sm text-storm transition hover:text-ink" onClick={() => setExpanded(value => !value)} type="button"><SlidersHorizontal className="h-4 w-4" />Más filtros</button>
    </div>
    {expanded ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <fieldset className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.1] px-4 py-3 sm:col-span-2 xl:col-span-3"><legend className="px-1 text-xs text-storm">Estados combinados</legend>{statusOptions.map(option => <label className="flex min-h-9 items-center gap-2 text-sm text-ink" key={option.value}><input checked={statuses.includes(option.value)} className="accent-[#e5e0d6]" onChange={() => onChange({ status: "all", selectedStatuses: statuses.includes(option.value) ? statuses.filter(value => value !== option.value) : [...statuses, option.value] })} type="checkbox" />{option.label}</label>)}</fieldset>
      <fieldset className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.1] px-4 py-3 sm:col-span-2 xl:col-span-3"><legend className="px-1 text-xs text-storm">Frecuencias combinadas</legend>{frequencyOptions.map(option => <label className="flex min-h-9 items-center gap-2 text-sm text-ink" key={option.value}><input checked={frequencies.includes(option.value)} className="accent-[#e5e0d6]" onChange={() => onChange({ frequency: "all", selectedFrequencies: frequencies.includes(option.value) ? frequencies.filter(value => value !== option.value) : [...frequencies, option.value] })} type="checkbox" />{option.label}</label>)}</fieldset>
      <label className="flex h-14 items-center gap-3 rounded-xl border border-white/[0.1] px-4 text-sm text-ink"><input checked={filters.pinnedOnly} className="accent-[#e5e0d6]" onChange={event => onChange({ pinnedOnly: event.target.checked })} type="checkbox" />Solo fijados</label>
      <label className="flex h-14 items-center gap-3 rounded-xl border border-white/[0.1] px-4 text-sm text-ink"><input checked={filters.upcomingOnly} className="accent-[#e5e0d6]" onChange={event => onChange({ upcomingOnly: event.target.checked })} type="checkbox" />Próximos 30 días</label>
      {(["payer", "category", "account"] as const).map(field => {
        const config = field === "payer" ? { key: "payerId" as const, all: "Todos los pagadores", name: "Pagador" } : field === "category" ? { key: "categoryId" as const, all: "Todas las categorías", name: "Categoría" } : { key: "accountId" as const, all: "Todas las cuentas", name: "Cuenta" };
        return <SearchablePicker appearance="toolbar" emptyMessage="No hay referencias en estos ingresos." key={field} onChange={value => onChange({ [config.key]: value ? Number(value) : null, [field]: "" })} options={[{ value: "", label: config.all, description: "", leadingLabel: "" }, ...incomeReferenceOptions(items, field, filters[config.key])]} placeholderDescription={config.name} placeholderLabel={config.all} queryPlaceholder={`Buscar ${config.name.toLowerCase()}...`} value={filters[config.key] === null ? "" : String(filters[config.key])} />;
      })}
      <input aria-label="Filtrar por monto" className="field-dark !h-14" onChange={event => onChange({ amount: event.target.value })} placeholder="Monto" type="search" value={filters.amount} />
      <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
        <div><p className="mb-1.5 text-[13px] font-medium text-storm">Llegada desde</p><DatePickerField appearance="compact" onChange={value => onChange({ nextExpectedDateFrom: value })} value={filters.nextExpectedDateFrom} /></div>
        <div><p className="mb-1.5 text-[13px] font-medium text-storm">Llegada hasta</p><DatePickerField appearance="compact" onChange={value => onChange({ nextExpectedDateTo: value })} value={filters.nextExpectedDateTo} /></div>
      </div>
    </div> : null}
    {(["payer", "category", "account"] as const).filter(field => filters[field].trim()).map(field => <p className="mt-2 text-xs text-storm" key={field}>Filtro anterior por texto de {field === "payer" ? "pagador" : field === "category" ? "categoría" : "cuenta"}: «{filters[field]}». <button className="text-ink underline underline-offset-4" onClick={() => onChange({ [field]: "" })} type="button">Quitar filtro de texto</button></p>)}
    {hasFilters ? <button className="mt-2 text-xs text-storm underline-offset-4 hover:text-ink hover:underline" onClick={onClear} type="button">Limpiar filtros</button> : null}
  </section>;
}
