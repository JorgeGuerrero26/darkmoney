import { Download, Plus, RefreshCw, RotateCcw, Search } from "lucide-react";
import { useMemo } from "react";

import { Button } from "../../../components/ui/button";
import {
  ColumnPicker,
  type ColumnDef,
} from "../../../components/ui/column-picker";
import { Input } from "../../../components/ui/fields";
import { SearchablePicker, type PickerOption } from "../../../components/ui/searchable-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { ViewSelector, type ViewMode } from "../../../components/ui/view-selector";
import type { AccountFilters, AccountStatusFilter } from "../lib/account-filters";
import { accountStatusOptions } from "../lib/account-filters";
import {
  buildCurrencyLabel,
  getTypePreset,
} from "../lib/account-options";

type AccountsToolbarProps = {
  availableCurrencyCodes: string[];
  availableTypes: string[];
  canExport: boolean;
  columns: ColumnDef[];
  filters: AccountFilters;
  filteredCount: number;
  isFetching: boolean;
  onCreate: () => void;
  onExport: () => void;
  onRefresh: () => void;
  onResetFilters: () => void;
  onUpdateFilters: (filters: Partial<AccountFilters>, options?: { resetPage?: boolean }) => void;
  onToggleColumn: (key: string) => void;
  totalCount: number;
  visibleColumns: Record<string, boolean>;
};

function buildTypeFilterOptions(types: string[]): PickerOption[] {
  return [
    {
      value: "all",
      label: "Todos los tipos",
      description: "No filtra por tipo de cuenta.",
      leadingLabel: "TO",
      searchText: "todos tipos cuentas",
    },
    ...types.map((type) => {
      const preset = getTypePreset(type);

      return {
        value: type,
        label: preset.label,
        description: preset.description,
        leadingLabel: preset.label.slice(0, 2).toUpperCase(),
        leadingColor: preset.color,
        searchText: `${type} ${preset.label} ${preset.description}`,
      };
    }),
  ];
}

function buildCurrencyFilterOptions(currencyCodes: string[]): PickerOption[] {
  return [
    {
      value: "all",
      label: "Todas las monedas",
      description: "No filtra por moneda.",
      leadingLabel: "TO",
      searchText: "todas monedas",
    },
    ...currencyCodes.map((currencyCode) => {
      const currency = buildCurrencyLabel(currencyCode);

      return {
        value: currencyCode,
        label: currency?.code ?? currencyCode,
        description: currency ? `${currency.label} - ${currency.region}` : "Moneda registrada",
        leadingLabel: currency?.symbol ?? currencyCode.slice(0, 2),
        searchText: `${currencyCode} ${currency?.label ?? ""} ${currency?.region ?? ""}`,
      };
    }),
  ];
}

function buildStatusFilterOptions(): PickerOption[] {
  return accountStatusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    description: option.description,
    leadingLabel: option.leadingLabel,
    searchText: `${option.value} ${option.label} ${option.description}`,
  }));
}

export function AccountsToolbar({
  availableCurrencyCodes,
  availableTypes,
  canExport,
  columns,
  filteredCount,
  filters,
  isFetching,
  onCreate,
  onExport,
  onRefresh,
  onResetFilters,
  onToggleColumn,
  onUpdateFilters,
  totalCount,
  visibleColumns,
}: AccountsToolbarProps) {
  const typeOptions = useMemo(() => buildTypeFilterOptions(availableTypes), [availableTypes]);
  const currencyOptions = useMemo(
    () => buildCurrencyFilterOptions(availableCurrencyCodes),
    [availableCurrencyCodes],
  );
  const statusOptions = useMemo(() => buildStatusFilterOptions(), []);

  const hasFilters =
    filters.q.trim() !== "" ||
    filters.type.trim() !== "" ||
    filters.status !== "active" ||
    filters.currency.trim() !== "";

  return (
    <section className="sticky top-3 z-30 rounded-[28px] border border-white/10 bg-[#080d14]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.32)] backdrop-blur-xl">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={`${filteredCount} visibles`} tone="neutral" />
            <StatusBadge status={`${totalCount} totales`} tone="info" />
            {isFetching ? <StatusBadge status="Actualizando" tone="neutral" /> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              aria-label="Actualizar cuentas"
              disabled={isFetching}
              onClick={onRefresh}
              variant="ghost"
            >
              <RefreshCw className={`h-4 w-4${isFetching ? " animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button
              disabled={!canExport}
              onClick={onExport}
              variant="ghost"
            >
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button data-tour="create-account" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              Nueva cuenta
            </Button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1.4fr)_repeat(3,minmax(180px,1fr))_auto] lg:items-center">
          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <Input
              aria-label="Buscar cuenta"
              className="pl-11"
              onChange={(event) =>
                onUpdateFilters({ q: event.target.value }, { resetPage: true })
              }
              placeholder="Buscar cuenta, tipo o moneda..."
              type="search"
              value={filters.q}
            />
          </div>

          <SearchablePicker
            emptyMessage="No hay tipos para mostrar."
            onChange={(value) =>
              onUpdateFilters({ type: value === "all" ? "" : value }, { resetPage: true })
            }
            options={typeOptions}
            placeholderDescription="Elige un tipo de cuenta."
            placeholderLabel="Tipo"
            queryPlaceholder="Buscar tipo..."
            value={filters.type || "all"}
          />

          <SearchablePicker
            emptyMessage="No hay estados para mostrar."
            onChange={(value) =>
              onUpdateFilters({ status: value as AccountStatusFilter }, { resetPage: true })
            }
            options={statusOptions}
            placeholderDescription="Elige un estado."
            placeholderLabel="Estado"
            queryPlaceholder="Buscar estado..."
            value={filters.status}
          />

          <SearchablePicker
            emptyMessage="No hay monedas para mostrar."
            onChange={(value) =>
              onUpdateFilters({ currency: value === "all" ? "" : value }, { resetPage: true })
            }
            options={currencyOptions}
            placeholderDescription="Elige una moneda."
            placeholderLabel="Moneda"
            queryPlaceholder="Buscar moneda..."
            value={filters.currency || "all"}
          />

          <div className="flex flex-wrap items-center gap-2">
            <ViewSelector
              available={["table", "list", "grid"]}
              onChange={(view) =>
                onUpdateFilters({ view: view as ViewMode }, { resetPage: true })
              }
              value={filters.view}
            />
            {filters.view === "table" ? (
              <ColumnPicker columns={columns} onToggle={onToggleColumn} visible={visibleColumns} />
            ) : null}
            {hasFilters ? (
              <Button
                aria-label="Limpiar filtros"
                onClick={onResetFilters}
                variant="ghost"
              >
                <RotateCcw className="h-4 w-4" />
                Limpiar
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
