import { Plus, Trash2 } from "lucide-react";

import { formatCurrency } from "../../../lib/formatting/money";
import type { CategorySummary } from "../../../types/domain";
import {
  createMovementSplitLine,
  getMovementSplitTotal,
  type MovementSplitLine,
} from "../lib/split-movement";

type MovementSplitPanelProps = {
  categories: CategorySummary[];
  currencyCode: string;
  lines: MovementSplitLine[];
  onChange: (lines: MovementSplitLine[]) => void;
  onRemove: () => void;
  totalAmount: number;
};

export function MovementSplitPanel({
  categories,
  currencyCode,
  lines,
  onChange,
  onRemove,
  totalAmount,
}: MovementSplitPanelProps) {
  const assigned = getMovementSplitTotal(lines);
  const remaining = totalAmount - assigned;
  const currencySymbol = new Intl.NumberFormat("es-PE", {
    currency: currencyCode,
    style: "currency",
  }).formatToParts(0).find((part) => part.type === "currency")?.value ?? currencyCode;

  function updateLine(id: string, changes: Partial<MovementSplitLine>) {
    onChange(lines.map((line) => (line.id === id ? { ...line, ...changes } : line)));
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
        {lines.map((line, index) => (
          <div
            className="grid min-h-[62px] grid-cols-[minmax(0,1fr)_7rem_auto] items-center gap-3 border-t border-white/10 px-4 first:border-t-0"
            key={line.id}
          >
            <label className="min-w-0">
              <span className="sr-only">Categoría de la parte {index + 1}</span>
              <select
                className="w-full appearance-none truncate bg-transparent text-sm text-ink outline-none"
                onChange={(event) => updateLine(line.id, { categoryId: event.target.value })}
                value={line.categoryId}
              >
                <option value="">Elegir categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1 text-sm text-storm">
              <span>{currencySymbol}</span>
              <input
                aria-label={`Monto de la parte ${index + 1}`}
                className="min-w-0 w-full bg-transparent text-right font-semibold text-ink outline-none placeholder:text-storm/45"
                inputMode="decimal"
                onChange={(event) => updateLine(line.id, { amount: event.target.value })}
                placeholder="0.00"
                value={line.amount}
              />
            </label>
            <button
              aria-label={`Quitar parte ${index + 1}`}
              className="grid h-8 w-8 place-items-center text-storm transition hover:text-ink disabled:opacity-30"
              disabled={lines.length <= 2}
              onClick={() => onChange(lines.filter((item) => item.id !== line.id))}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          className="flex h-[54px] w-full items-center gap-2 border-t border-white/10 px-4 text-sm font-semibold text-ink hover:bg-white/[0.03]"
          onClick={() => onChange([...lines, createMovementSplitLine()])}
          type="button"
        >
          <Plus className="h-4 w-4" />
          Agregar parte
        </button>
        <button
          className="flex h-[54px] w-full items-center border-t border-white/10 px-4 text-sm text-storm hover:bg-white/[0.03] hover:text-ink"
          onClick={onRemove}
          type="button"
        >
          No dividir este movimiento
        </button>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-storm">Asignado {formatCurrency(assigned, currencyCode)}</span>
        <span className={Math.abs(remaining) <= 0.009 ? "text-pine" : "text-ink"}>
          {totalAmount <= 0
            ? "Define el monto"
            : Math.abs(remaining) <= 0.009
            ? "Monto completo"
            : `${remaining > 0 ? "Falta" : "Excede"} ${formatCurrency(Math.abs(remaining), currencyCode)}`}
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-storm/70">
        Se guardará un movimiento por categoría y quedarán vinculados como una sola división.
      </p>
    </div>
  );
}
