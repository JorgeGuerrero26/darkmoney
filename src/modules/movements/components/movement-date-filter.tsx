import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DatePickerField } from "../../../components/ui/date-picker-field";

import {
  buildMovementDatePresets,
  getMovementDateRangeLabel,
} from "../lib/movement-date-range";

type MovementDateFilterProps = {
  dateFrom: string;
  dateTo: string;
  onChange: (dateFrom: string, dateTo: string) => void;
};

export function MovementDateFilter({ dateFrom, dateTo, onChange }: MovementDateFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(dateFrom);
  const [customTo, setCustomTo] = useState(dateTo);
  const presets = useMemo(() => buildMovementDatePresets(), []);
  const activeLabel = getMovementDateRangeLabel(dateFrom, dateTo, presets);

  useEffect(() => {
    if (!isOpen) return;
    setCustomFrom(dateFrom);
    setCustomTo(dateTo);
  }, [dateFrom, dateTo, isOpen]);

  return (
    <div className="relative min-w-0">
      <button
        aria-expanded={isOpen}
        className="flex h-full min-h-[56px] w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#141311] px-4 text-left text-sm text-ink transition hover:border-white/20"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <CalendarDays className="h-4 w-4 shrink-0 text-storm" />
          <span className="truncate font-semibold">{activeLabel}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen ? (
        <>
          <button
            aria-label="Cerrar filtro de período"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-[#1a1917]">
            <p className="px-4 pb-2 pt-4 font-public-mono text-[10px] uppercase tracking-[0.16em] text-storm">
              Período
            </p>
            <button
              className="flex h-11 w-full items-center justify-between px-4 text-left text-sm text-storm transition hover:bg-white/[0.04] hover:text-ink"
              onClick={() => {
                onChange("", "");
                setIsOpen(false);
              }}
              type="button"
            >
              Todo
              {!dateFrom && !dateTo ? <Check className="h-4 w-4 text-ink" /> : null}
            </button>
            {presets.map((preset) => {
              const isActive = preset.from === dateFrom && preset.to === dateTo;
              return (
                <button
                  className="flex h-11 w-full items-center justify-between border-t border-white/[0.07] px-4 text-left text-sm text-storm transition hover:bg-white/[0.04] hover:text-ink"
                  key={preset.key}
                  onClick={() => {
                    onChange(preset.from, preset.to);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  {preset.label}
                  {isActive ? <Check className="h-4 w-4 text-ink" /> : null}
                </button>
              );
            })}

            <div className="border-t border-white/10 p-4">
              <p className="mb-3 text-xs font-medium text-ink">Rango personalizado</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="min-w-0">
                  <span className="mb-1.5 block text-[0.8125rem] font-medium text-storm">Desde</span>
                  <DatePickerField appearance="compact" onChange={setCustomFrom} value={customFrom} />
                </div>
                <div className="min-w-0">
                  <span className="mb-1.5 block text-[0.8125rem] font-medium text-storm">Hasta</span>
                  <DatePickerField appearance="compact" onChange={setCustomTo} value={customTo} />
                </div>
              </div>
              <button
                className="mt-3 h-10 w-full rounded-lg bg-ink text-sm font-semibold text-void transition hover:bg-white disabled:cursor-not-allowed disabled:bg-[#252320] disabled:text-[#6b6459]"
                disabled={!customFrom || !customTo || customFrom > customTo}
                onClick={() => {
                  onChange(customFrom, customTo);
                  setIsOpen(false);
                }}
                type="button"
              >
                Aplicar rango
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
