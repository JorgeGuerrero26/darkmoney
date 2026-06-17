import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { TableColumnFilterMenu, TableFilterOptionButton } from "../../../components/ui/table-column-filter-menu";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  isContactTableFilterActive,
  type ContactTableFilterField,
  type ContactTableFilters,
} from "../lib/contacts-filters";
import {
  getRoleDefinition,
  getTypeDefinition,
  roleOptions,
  typeOptions,
  type ContactWithExposure,
} from "../lib/contacts-presenters";

const filterInputClassName =
  "w-full rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";

const headerCellClassName =
  "relative px-5 py-3 text-left text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-storm/55";

const statusFilterValues = [
  { value: "active" as const, label: "Activos" },
  { value: "all" as const, label: "Todos" },
  { value: "archived" as const, label: "Archivados" },
];

type ColumnVisibilityFn = (key: string, hiddenClassName?: string) => string;

type ContactTableProps = {
  contacts: ContactWithExposure[];
  baseCurrencyCode: string;
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  isArchiving: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onEdit: (contact: ContactWithExposure) => void;
  onAnalytics: (id: number) => void;
  onArchive: (contact: ContactWithExposure, nextArchived: boolean) => void;
  cv: ColumnVisibilityFn;
  filters: ContactTableFilters;
  openFilter: ContactTableFilterField | null;
  onUpdateFilter: <Field extends keyof ContactTableFilters>(field: Field, value: ContactTableFilters[Field]) => void;
  onClearSingleFilter: (field: ContactTableFilterField) => void;
  onToggleFilterMenu: (field: ContactTableFilterField) => void;
  onCloseFilterMenu: () => void;
  onApplyFilterAndClose: <Field extends ContactTableFilterField>(field: Field, value: ContactTableFilters[Field]) => void;
};

export function ContactTable({
  contacts,
  baseCurrencyCode,
  selectedIds,
  allSelected,
  someSelected,
  isArchiving,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onEdit,
  onAnalytics,
  onArchive,
  cv,
  filters,
  openFilter,
  onUpdateFilter,
  onClearSingleFilter,
  onToggleFilterMenu,
  onCloseFilterMenu,
  onApplyFilterAndClose,
}: ContactTableProps) {
  return (
    <div className="overflow-x-auto rounded-[24px] border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02]">
            <th className="w-10 px-4 py-3.5">
              <SelectionCheckbox
                ariaLabel="Seleccionar todos"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={() => (allSelected ? onClearAll() : onSelectAll())}
              />
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isContactTableFilterActive(filters, "name")}
                isOpen={openFilter === "name"}
                label="Contacto"
                onClear={() => onClearSingleFilter("name")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("name")}
              >
                <div className="space-y-3">
                  <input
                    className={filterInputClassName}
                    onChange={(event) => onUpdateFilter("name", event.target.value)}
                    placeholder="Filtrar contacto"
                    type="text"
                    value={filters.name}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("tipo", "hidden sm:table-cell")}`}>
              <TableColumnFilterMenu
                active={isContactTableFilterActive(filters, "type")}
                isOpen={openFilter === "type"}
                label="Tipo"
                onClear={() => onClearSingleFilter("type")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("type")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("type", "all")} selected={filters.type === "all"}>
                    Todos
                  </TableFilterOptionButton>
                  {typeOptions.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("type", option.value)} selected={filters.type === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} ${cv("roles", "hidden lg:table-cell")}`}>
              <TableColumnFilterMenu
                active={isContactTableFilterActive(filters, "role")}
                isOpen={openFilter === "role"}
                label="Roles"
                onClear={() => onClearSingleFilter("role")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("role")}
              >
                <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
                  <TableFilterOptionButton onClick={() => onApplyFilterAndClose("role", "all")} selected={filters.role === "all"}>
                    Todos
                  </TableFilterOptionButton>
                  {roleOptions.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("role", option.value)} selected={filters.role === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("por_cobrar", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isContactTableFilterActive(filters, "receivable")}
                align="right"
                isOpen={openFilter === "receivable"}
                label="Por cobrar"
                onClear={() => onClearSingleFilter("receivable")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("receivable")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("receivable", event.target.value)}
                    placeholder="Por cobrar"
                    type="text"
                    value={filters.receivable}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right ${cv("por_pagar", "hidden md:table-cell")}`}>
              <TableColumnFilterMenu
                active={isContactTableFilterActive(filters, "payable")}
                align="right"
                isOpen={openFilter === "payable"}
                label="Por pagar"
                onClear={() => onClearSingleFilter("payable")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("payable")}
                triggerClassName="justify-end text-right"
              >
                <div className="space-y-3">
                  <input
                    className={`${filterInputClassName} text-right`}
                    onChange={(event) => onUpdateFilter("payable", event.target.value)}
                    placeholder="Por pagar"
                    type="text"
                    value={filters.payable}
                  />
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={headerCellClassName}>
              <TableColumnFilterMenu
                active={isContactTableFilterActive(filters, "status")}
                isOpen={openFilter === "status"}
                label="Estado"
                onClear={() => onClearSingleFilter("status")}
                onClose={onCloseFilterMenu}
                onToggle={() => onToggleFilterMenu("status")}
              >
                <div className="space-y-1">
                  {statusFilterValues.map((option) => (
                    <TableFilterOptionButton key={option.value} onClick={() => onApplyFilterAndClose("status", option.value)} selected={filters.status === option.value}>
                      {option.label}
                    </TableFilterOptionButton>
                  ))}
                </div>
              </TableColumnFilterMenu>
            </th>
            <th className={`${headerCellClassName} text-right`}>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact, index) => {
            const typeDefinition = getTypeDefinition(contact.type);
            const TypeIcon = typeDefinition.icon;

            return (
              <tr
                className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === contacts.length - 1 ? "border-b-0" : ""}`}
                key={contact.id}
              >
                <td className="w-10 px-4 py-3.5">
                  <SelectionCheckbox
                    ariaLabel={`Seleccionar ${contact.name}`}
                    checked={selectedIds.has(contact.id)}
                    onChange={() => onToggleSelect(contact.id)}
                  />
                </td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-white"
                      style={{ background: `linear-gradient(160deg, ${typeDefinition.color}, rgba(8,13,20,0.72))` }}
                    >
                      <TypeIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{contact.name}</p>
                      <p className="truncate text-xs text-storm">
                        {contact.email ?? contact.phone ?? contact.documentNumber ?? "Sin contacto rapido"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className={`px-5 py-3.5 ${cv("tipo", "hidden sm:table-cell")}`}>
                  <StatusBadge status={typeDefinition.label} tone="neutral" />
                </td>
                <td className={`px-5 py-3.5 ${cv("roles", "hidden lg:table-cell")}`}>
                  <p className="text-xs text-storm">
                    {contact.roles.length > 0 ? contact.roles.map((role) => getRoleDefinition(role).label).join(", ") : "Sin roles"}
                  </p>
                </td>
                <td className={`px-5 py-3.5 text-right text-storm ${cv("por_cobrar", "hidden md:table-cell")}`}>
                  {formatCurrency(contact.receivablePendingInBase, baseCurrencyCode)}
                </td>
                <td className={`px-5 py-3.5 text-right text-storm ${cv("por_pagar", "hidden md:table-cell")}`}>
                  {formatCurrency(contact.payablePendingInBase, baseCurrencyCode)}
                </td>
                <td className="px-5 py-3.5">
                  {contact.isArchived ? <StatusBadge status="Archivado" tone="warning" /> : <StatusBadge status="Activo" tone="success" />}
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex justify-end gap-2">
                    <Button className="py-1.5 text-xs" onClick={() => onAnalytics(contact.id)} variant="ghost">
                      Análisis
                    </Button>
                    <Button className="py-1.5 text-xs" onClick={() => onEdit(contact)} variant="ghost">
                      Editar
                    </Button>
                    <Button className="py-1.5 text-xs" disabled={isArchiving} onClick={() => onArchive(contact, !contact.isArchived)} variant="ghost">
                      {contact.isArchived ? "Reactivar" : "Archivar"}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
