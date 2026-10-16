import { useMemo } from "react";

import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import type { AccountFilters, AccountStatusFilter } from "../lib/account-filters";
import { accountStatusOptions } from "../lib/account-filters";
import { buildCurrencyLabel, getTypePreset } from "../lib/account-options";
import { AccountMultiFilter } from "./account-multi-filter";

type AccountsToolbarProps = {
  availableCurrencyCodes: string[];
  availableTypes: string[];
  institutions: { value: string | null; label: string }[];
  filters: AccountFilters;
  onUpdateFilters: (filters: Partial<AccountFilters>, options?: { resetPage?: boolean }) => void;
};

export function AccountsToolbar({ availableCurrencyCodes, availableTypes, institutions, filters, onUpdateFilters }: AccountsToolbarProps) {
  const typeOptions = useMemo<PickerOption[]>(() => [
    ...availableTypes.map((type) => {
      const preset = getTypePreset(type);
      return { value: type, label: preset.label, description: preset.description, leadingLabel: preset.label.slice(0, 2).toUpperCase(), leadingColor: preset.color };
    }),
  ], [availableTypes]);
  const statusOptions = useMemo<PickerOption[]>(() => accountStatusOptions.map((option) => ({
    value: option.value, label: option.label, description: option.description, leadingLabel: option.leadingLabel,
  })), []);
  const currencyOptions = useMemo<PickerOption[]>(() => [
    { value: "all", label: "Todas las monedas", description: "No filtra por moneda.", leadingLabel: "TO" },
    ...availableCurrencyCodes.map((code) => {
      const currency = buildCurrencyLabel(code);
      return { value: code, label: code, description: currency ? `${currency.label} · ${currency.region}` : "Moneda registrada", leadingLabel: currency?.symbol ?? code.slice(0, 2) };
    }),
  ], [availableCurrencyCodes]);

  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,0.8fr))]">
      <input aria-label="Buscar cuenta" className="field-dark" onChange={(event) => onUpdateFilters({ q: event.target.value }, { resetPage: true })} placeholder="Buscar por nombre o moneda..." type="search" value={filters.q} />
      <AccountMultiFilter allLabel="Todos los tipos" onChange={types => onUpdateFilters({ type: types[0] ?? "", types }, { resetPage: true })} options={typeOptions} title="Tipos de cuenta" values={filters.types ?? (filters.type ? [filters.type] : [])} />
      <AccountMultiFilter allLabel="Todas las instituciones" onChange={values => onUpdateFilters({ institutions: values.map(value => value || null) }, { resetPage: true })} options={institutions.map(option => ({ value: option.value ?? "", label: option.label }))} title="Instituciones" values={(filters.institutions ?? []).map(value => value ?? "")} />
      <SearchablePicker appearance="toolbar" emptyMessage="No hay estados para mostrar." onChange={(value) => onUpdateFilters({ status: value as AccountStatusFilter }, { resetPage: true })} options={statusOptions} placeholderDescription="Filtra por estado de cuenta." placeholderLabel="Estado" queryPlaceholder="Buscar estado..." showSearch={false} value={filters.status} />
      <SearchablePicker appearance="toolbar" emptyMessage="No hay monedas para mostrar." onChange={(value) => onUpdateFilters({ currency: value === "all" ? "" : value }, { resetPage: true })} options={currencyOptions} placeholderDescription="Filtra por moneda." placeholderLabel="Moneda" queryPlaceholder="Buscar moneda..." showSearch={false} value={filters.currency || "all"} />
    </section>
  );
}
