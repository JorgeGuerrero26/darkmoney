import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { formatCurrency } from "../../../lib/formatting/money";
import type { CategorySummary, MovementType } from "../../../types/domain";
import { movementSpendTypeLabel, type MovementSpendType } from "../lib/movement-spend-type";
import {
  createMovementSplitLine,
  getMovementSplitTotal,
  validateMovementSplit,
  type MovementSplitLine,
} from "../lib/split-movement";

type MovementSplitPanelProps = {
  categories: CategorySummary[];
  spendTypes: MovementSpendType[];
  movementType: MovementType;
  currencyCode: string;
  lines: MovementSplitLine[];
  onChange: (lines: MovementSplitLine[]) => void;
  onDone: () => void;
  onRemove: () => void;
  totalAmount: number;
};

export function MovementSplitPanel({
  categories,
  spendTypes,
  movementType,
  currencyCode,
  lines,
  onChange,
  onDone,
  onRemove,
  totalAmount,
}: MovementSplitPanelProps) {
  const [triedToSave, setTriedToSave] = useState(false);
  const assigned = getMovementSplitTotal(lines);
  const remaining = totalAmount - assigned;
  const emptyAmountIndexes = lines
    .map((line, index) => (line.amount.trim() ? -1 : index))
    .filter((index) => index >= 0);
  const proposalIndex = emptyAmountIndexes.length > 0 && remaining > 0
    ? emptyAmountIndexes[0]
    : -1;
  const blockingError = validateMovementSplit(lines, totalAmount);
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
            {proposalIndex === index ? (
              <button
                aria-label={`Usar ${formatCurrency(remaining, currencyCode)} en la parte ${index + 1}`}
                className="text-right text-sm font-semibold text-storm/60 hover:text-ink"
                onClick={() => updateLine(line.id, { amount: remaining.toFixed(2) })}
                type="button"
              >
                {formatCurrency(remaining, currencyCode)}
              </button>
            ) : (
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
            )}
            <button
              aria-label={`Quitar parte ${index + 1}`}
              className="grid h-8 w-8 place-items-center text-storm transition hover:text-ink disabled:opacity-30"
              disabled={lines.length <= 2}
              onClick={() => onChange(lines.filter((item) => item.id !== line.id))}
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            {movementType === "expense" ? (
              <label className="col-span-3 flex items-center justify-between gap-4 border-t border-white/10 py-2 text-xs text-storm">
                <span>Tipo de gasto</span>
                <select
                  aria-label={`Tipo de gasto de la parte ${index + 1}`}
                  className="min-w-0 max-w-[65%] appearance-none bg-transparent text-right text-sm text-ink outline-none"
                  onChange={(event) => updateLine(line.id, { spendTypeId: event.target.value })}
                  value={line.spendTypeId ?? ""}
                >
                  <option value="">
                    {movementSpendTypeLabel(spendTypes, null, categories.find((category) => String(category.id) === line.categoryId)?.defaultSpendTypeId)}
                  </option>
                  {spendTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        ))}
        <button
          className="flex h-[54px] w-full items-center gap-2 border-t border-white/10 px-4 text-sm font-semibold text-ink hover:bg-white/[0.03] disabled:opacity-40"
          disabled={lines.length >= 100}
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
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-ink transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, totalAmount > 0 ? assigned / totalAmount * 100 : 0))}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-5 text-storm/70">
        El total impacta una sola vez en la cuenta; las partes separan las categorías para presupuestos e informes.
      </p>
      {triedToSave && blockingError ? (
        <p className="mt-3 text-center text-xs font-medium text-ember">{blockingError}</p>
      ) : null}
      <Button
        className="mt-4 w-full justify-center"
        onClick={() => {
          if (blockingError) {
            setTriedToSave(true);
            return;
          }
          onDone();
        }}
        type="button"
      >
        Guardar división
      </Button>
    </div>
  );
}
