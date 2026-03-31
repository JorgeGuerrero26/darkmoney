import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RotateCcw,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type DatePickerFieldMode = "date" | "datetime-local";

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  mode?: DatePickerFieldMode;
  disabled?: boolean;
  placeholder?: string;
};

const weekdayLabels = ["DO", "LU", "MA", "MI", "JU", "VI", "SA"] as const;
const minuteOptions = Array.from({ length: 12 }, (_, index) => String(index * 5).padStart(2, "0"));

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function parsePickerValue(value: string, mode: DatePickerFieldMode) {
  if (!value) {
    return null;
  }

  if (mode === "date") {
    const [year, month, day] = value.split("-").map(Number);

    if (!year || !month || !day) {
      return null;
    }

    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }

  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function formatDateTimeValue(date: Date) {
  return `${formatDateValue(date)}T${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function formatTriggerLabel(date: Date | null, mode: DatePickerFieldMode, placeholder: string) {
  if (!date) {
    return placeholder;
  }

  if (mode === "date") {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function buildCalendarDays(visibleMonth: Date) {
  const firstDayOfMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
  const firstWeekday = firstDayOfMonth.getDay();
  const calendarStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1 - firstWeekday);

  return Array.from({ length: 42 }, (_, index) => {
    const nextDate = new Date(calendarStart);
    nextDate.setDate(calendarStart.getDate() + index);
    return nextDate;
  });
}

function sameDay(left: Date | null, right: Date | null) {
  if (!left || !right) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function DatePickerField({
  disabled = false,
  mode = "date",
  onChange,
  placeholder,
  value,
}: DatePickerFieldProps) {
  const resolvedPlaceholder =
    placeholder ?? (mode === "datetime-local" ? "Selecciona fecha y hora" : "Selecciona una fecha");
  const selectedDate = useMemo(() => parsePickerValue(value, mode), [mode, value]);
  const [isOpen, setIsOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const referenceDate = selectedDate ?? new Date();
    return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  });
  const [draftDate, setDraftDate] = useState<Date | null>(selectedDate);
  const [draftHour, setDraftHour] = useState(selectedDate ? padNumber(selectedDate.getHours()) : "12");
  const [draftMinute, setDraftMinute] = useState(
    selectedDate ? padNumber(Math.floor(selectedDate.getMinutes() / 5) * 5) : "00",
  );
  const [panelId] = useState(() => `date-picker-${Math.random().toString(36).slice(2, 10)}`);

  const monthLabel = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(visibleMonth);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), 0, 0);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const referenceDate = selectedDate ?? new Date();
    setVisibleMonth(new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1));
    setDraftDate(selectedDate);
    setDraftHour(selectedDate ? padNumber(selectedDate.getHours()) : padNumber(new Date().getHours()));
    setDraftMinute(
      selectedDate
        ? padNumber(Math.floor(selectedDate.getMinutes() / 5) * 5)
        : padNumber(Math.floor(new Date().getMinutes() / 5) * 5),
    );
  }, [isOpen, selectedDate]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;

      if (!target?.closest(`[data-picker-id="${panelId}"]`)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [isOpen, panelId]);

  function handlePickDay(nextDate: Date) {
    if (mode === "date") {
      onChange(formatDateValue(nextDate));
      setIsOpen(false);
      return;
    }

    setDraftDate(new Date(nextDate.getFullYear(), nextDate.getMonth(), nextDate.getDate(), 12, 0, 0, 0));
  }

  function handleApply() {
    if (mode === "date") {
      if (draftDate) {
        onChange(formatDateValue(draftDate));
      }
      setIsOpen(false);
      return;
    }

    const baseDate = draftDate ?? new Date();
    const nextDate = new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      Number(draftHour),
      Number(draftMinute),
      0,
      0,
    );

    onChange(formatDateTimeValue(nextDate));
    setIsOpen(false);
  }

  function handleQuickNow() {
    if (mode === "date") {
      onChange(formatDateValue(today));
      setIsOpen(false);
      return;
    }

    setDraftDate(today);
    setDraftHour(padNumber(today.getHours()));
    setDraftMinute(padNumber(Math.floor(today.getMinutes() / 5) * 5));
  }

  function handleClear() {
    onChange("");
    setDraftDate(null);
    setIsOpen(false);
  }

  return (
    <div className={`relative min-w-0 ${isOpen ? "z-50" : "z-10"}`} data-picker-id={panelId}>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className={`flex h-14 w-full items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-left text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 hover:border-white/14 hover:bg-[#101928] focus-visible:border-pine/25 focus-visible:bg-[#111b2a] focus-visible:shadow-[0_0_0_4px_rgba(107,228,197,0.08)] ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        }`}
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-white/10 bg-white/[0.04] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            {mode === "datetime-local" ? <Clock3 className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
          </span>
          <span className={`truncate ${selectedDate ? "text-ink" : "text-storm/72"}`}>
            {formatTriggerLabel(selectedDate, mode, resolvedPlaceholder)}
          </span>
        </span>
        <CalendarDays className="h-4 w-4 shrink-0 text-storm" />
      </button>

      {isOpen ? (
        <div
          className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,15,24,0.98),rgba(8,12,20,0.98))] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]"
          id={panelId}
        >
          <div className="flex items-center justify-between gap-3 rounded-[22px] border border-white/8 bg-white/[0.03] px-3 py-2">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition hover:bg-white/[0.08] hover:text-ink"
              onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold capitalize text-ink">{monthLabel}</p>
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition hover:bg-white/[0.08] hover:text-ink"
              onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {weekdayLabels.map((label) => (
              <div className="px-1 py-2 text-center text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-storm/78" key={label}>
                {label}
              </div>
            ))}

            {calendarDays.map((day) => {
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isToday = sameDay(day, today);
              const isSelected = sameDay(day, mode === "date" ? selectedDate : draftDate);

              return (
                <button
                  className={`h-10 rounded-[16px] text-sm font-medium transition ${
                    isSelected
                      ? "bg-[#8eb6ff] text-[#08111d]"
                      : isCurrentMonth
                        ? "text-ink hover:bg-white/[0.08]"
                        : "text-storm/40 hover:bg-white/[0.05]"
                  } ${isToday && !isSelected ? "border border-pine/25 bg-pine/10 text-pine" : ""}`}
                  key={day.toISOString()}
                  onClick={() => handlePickDay(day)}
                  type="button"
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {mode === "datetime-local" ? (
            <div className="mt-3 rounded-[24px] border border-white/8 bg-white/[0.03] p-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Hora</p>
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <select
                  className="field-dark h-12 w-full"
                  onChange={(event) => setDraftHour(event.target.value)}
                  value={draftHour}
                >
                  {Array.from({ length: 24 }, (_, index) => padNumber(index)).map((hourValue) => (
                    <option className="bg-shell text-ink" key={hourValue} value={hourValue}>
                      {hourValue}
                    </option>
                  ))}
                </select>
                <span className="text-sm font-semibold text-storm">:</span>
                <select
                  className="field-dark h-12 w-full"
                  onChange={(event) => setDraftMinute(event.target.value)}
                  value={draftMinute}
                >
                  {minuteOptions.map((minuteValue) => (
                    <option className="bg-shell text-ink" key={minuteValue} value={minuteValue}>
                      {minuteValue}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
            <div className="flex flex-wrap gap-2">
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-storm transition hover:bg-white/[0.08] hover:text-ink"
                onClick={handleClear}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
                Borrar
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-storm transition hover:bg-white/[0.08] hover:text-ink"
                onClick={handleQuickNow}
                type="button"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {mode === "datetime-local" ? "Ahora" : "Hoy"}
              </button>
            </div>

            <button
              className="inline-flex items-center rounded-2xl bg-ink px-4 py-2 text-sm font-semibold text-void transition hover:-translate-y-0.5 hover:brightness-105"
              onClick={handleApply}
              type="button"
            >
              Aplicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
