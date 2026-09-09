import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import type { MovementRecord } from "../../../types/domain";
import { getMovementDisplayInfo } from "../lib/movement-form";
import type { MovementTableFilterField, MovementTableFilters } from "../lib/movement-form";

type ColumnVisibilityFn = (key: string, hiddenClassName: string) => string;

type MovementsTableProps = {
  movements: MovementRecord[];
  baseCurrencyCode: string;
  categories: string[];
  counterparties: string[];
  sourceAccounts: string[];
  selectedIds: Set<number>;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelect: (id: number) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onOpen: (movement: MovementRecord) => void;
  cv: ColumnVisibilityFn;
  filters: MovementTableFilters;
  openFilter: MovementTableFilterField | null;
  onUpdateFilter: <Field extends keyof MovementTableFilters>(field: Field, value: MovementTableFilters[Field]) => void;
  onClearSingleFilter: (field: MovementTableFilterField) => void;
  onToggleFilterMenu: (field: MovementTableFilterField) => void;
  onCloseFilterMenu: () => void;
  onApplyFilterAndClose: <Field extends MovementTableFilterField>(field: Field, value: MovementTableFilters[Field]) => void;
};

const incomingTypes = new Set<MovementRecord["movementType"]>(["income", "refund"]);

function getDayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getDayLabel(value: string) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (getDayKey(value) === getDayKey(today.toISOString())) return "Hoy";
  if (getDayKey(value) === getDayKey(yesterday.toISOString())) return "Ayer";
  return formatDate(value);
}

function getSignedAmount(movement: MovementRecord, baseCurrencyCode: string) {
  const display = getMovementDisplayInfo(movement, baseCurrencyCode);
  if (display.amount === null || movement.movementType === "transfer") return 0;
  return incomingTypes.has(movement.movementType) ? display.amount : -display.amount;
}

export function MovementsTable({
  movements,
  baseCurrencyCode,
  selectedIds,
  allSelected,
  someSelected,
  onToggleSelect,
  onSelectAll,
  onClearAll,
  onOpen,
}: MovementsTableProps) {
  const groups = movements.reduce<Array<{ key: string; label: string; subtotal: number; items: MovementRecord[] }>>(
    (result, movement) => {
      const key = getDayKey(movement.occurredAt);
      const current = result[result.length - 1];
      if (!current || current.key !== key) {
        result.push({ key, label: getDayLabel(movement.occurredAt), subtotal: getSignedAmount(movement, baseCurrencyCode), items: [movement] });
      } else {
        current.items.push(movement);
        current.subtotal += getSignedAmount(movement, baseCurrencyCode);
      }
      return result;
    },
    [],
  );

  return (
    <div className="overflow-hidden rounded-[9px] border border-white/[0.08] bg-[#1a1917]">
      <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-2.5 text-xs text-storm">
        <label className="flex items-center gap-2">
          <SelectionCheckbox ariaLabel="Seleccionar todos" checked={allSelected} indeterminate={someSelected} onChange={() => (allSelected ? onClearAll() : onSelectAll())} />
          Seleccionar todos
        </label>
        <span>{movements.length} movimientos</span>
      </div>
      {groups.map((group) => (
        <section aria-label={group.label} key={group.key}>
          <div className="flex h-8 items-center justify-between border-b border-white/[0.07] bg-[#171614] px-4 font-public-mono text-[10px] uppercase tracking-[0.14em] text-storm">
            <span>{group.label}</span>
            <span>{formatCurrency(group.subtotal, baseCurrencyCode)}</span>
          </div>
          {group.items.map((movement) => {
            const display = getMovementDisplayInfo(movement, baseCurrencyCode);
            const isIncoming = incomingTypes.has(movement.movementType);
            const isTransfer = movement.movementType === "transfer";
            return (
              <div
                className="grid min-h-[54px] cursor-pointer grid-cols-[auto_minmax(0,1fr)_minmax(120px,0.45fr)_auto] items-center gap-3 border-b border-white/[0.06] px-4 py-2 transition last:border-b-0 hover:bg-white/[0.025] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-[-2px] focus-visible:outline-white/30"
                key={movement.id}
                onClick={() => onOpen(movement)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen(movement);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span onClick={(event) => event.stopPropagation()}>
                  <SelectionCheckbox ariaLabel={`Seleccionar ${movement.description}`} checked={selectedIds.has(movement.id)} onChange={() => onToggleSelect(movement.id)} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{movement.description}</p>
                  <p className="mt-0.5 truncate text-xs text-storm">{movement.category} · {new Date(movement.occurredAt).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                <p className="hidden truncate text-xs text-storm sm:block">{display.accountLabel}</p>
                <p className={`text-right text-sm font-semibold ${isIncoming ? "text-pine" : isTransfer ? "text-storm" : "text-ink"}`}>
                  {isIncoming ? "+ " : isTransfer ? "" : "− "}
                  {display.amount === null ? "—" : formatCurrency(display.amount, display.currencyCode)}
                </p>
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
