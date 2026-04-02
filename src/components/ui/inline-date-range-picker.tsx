import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const weekdayLabels = ["DO", "LU", "MA", "MI", "JU", "VI", "SA"] as const;

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function parseDateValue(value: string) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function formatReadableDate(date: Date | null) {
  if (!date) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
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

function isSameDay(left: Date | null, right: Date | null) {
  if (!left || !right) {
    return false;
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isWithinRange(day: Date, start: Date | null, end: Date | null) {
  if (!start || !end) {
    return false;
  }

  return day.getTime() > start.getTime() && day.getTime() < end.getTime();
}

type InlineDateRangePickerProps = {
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
};

export function InlineDateRangePicker({
  endDate,
  onEndDateChange,
  onStartDateChange,
  startDate,
}: InlineDateRangePickerProps) {
  const parsedStartDate = useMemo(() => parseDateValue(startDate), [startDate]);
  const parsedEndDate = useMemo(() => parseDateValue(endDate), [endDate]);
  const today = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);
  }, []);
  const [selectionTarget, setSelectionTarget] = useState<"start" | "end">(
    startDate && !endDate ? "end" : "start",
  );
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const referenceDate = parseDateValue(endDate) ?? parseDateValue(startDate) ?? today;
    return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  });

  useEffect(() => {
    if (!startDate && !endDate) {
      setSelectionTarget("start");
      return;
    }

    if (startDate && !endDate) {
      setSelectionTarget("end");
    }
  }, [startDate, endDate]);

  const monthLabel = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(visibleMonth);
  const calendarDays = useMemo(() => buildCalendarDays(visibleMonth), [visibleMonth]);

  function applyRange(nextStart: Date | null, nextEnd: Date | null) {
    onStartDateChange(nextStart ? formatDateValue(nextStart) : "");
    onEndDateChange(nextEnd ? formatDateValue(nextEnd) : "");
  }

  function handlePickDay(day: Date) {
    if (selectionTarget === "start") {
      const normalizedEnd =
        parsedEndDate && day.getTime() > parsedEndDate.getTime() ? null : parsedEndDate;
      applyRange(day, normalizedEnd);
      setSelectionTarget(normalizedEnd ? "start" : "end");
      return;
    }

    if (!parsedStartDate) {
      applyRange(day, null);
      setSelectionTarget("end");
      return;
    }

    if (day.getTime() < parsedStartDate.getTime()) {
      applyRange(day, parsedStartDate);
    } else {
      applyRange(parsedStartDate, day);
    }
  }

  function handlePreset(days: number) {
    const from = new Date(today);
    from.setDate(today.getDate() - (days - 1));
    applyRange(from, today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function handleCurrentMonth() {
    const from = new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0, 0);
    applyRange(from, today);
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  function handleClear() {
    applyRange(null, null);
    setSelectionTarget("start");
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          className={`rounded-[18px] border px-3 py-2.5 text-left transition ${
            selectionTarget === "start"
              ? "border-pine/30 bg-pine/10"
              : "border-white/10 bg-white/[0.03]"
          }`}
          onClick={() => setSelectionTarget("start")}
          type="button"
        >
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-storm/75">
            Desde
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{formatReadableDate(parsedStartDate)}</p>
        </button>
        <button
          className={`rounded-[18px] border px-3 py-2.5 text-left transition ${
            selectionTarget === "end"
              ? "border-pine/30 bg-pine/10"
              : "border-white/10 bg-white/[0.03]"
          }`}
          onClick={() => setSelectionTarget("end")}
          type="button"
        >
          <p className="text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-storm/75">
            Hasta
          </p>
          <p className="mt-1 text-sm font-medium text-ink">{formatReadableDate(parsedEndDate)}</p>
        </button>
      </div>

      <div className="rounded-[22px] border border-white/10 bg-black/20 p-3">
        <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/8 bg-white/[0.03] px-3 py-2">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition hover:bg-white/[0.08] hover:text-ink"
            onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
            type="button"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <CalendarDays className="h-4 w-4 text-pine" />
            <p className="truncate text-sm font-semibold capitalize text-ink">{monthLabel}</p>
          </div>
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition hover:bg-white/[0.08] hover:text-ink"
            onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
            type="button"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {weekdayLabels.map((label) => (
            <div
              className="px-1 py-2 text-center text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-storm/78"
              key={label}
            >
              {label}
            </div>
          ))}

          {calendarDays.map((day) => {
            const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
            const isToday = isSameDay(day, today);
            const isStart = isSameDay(day, parsedStartDate);
            const isEnd = isSameDay(day, parsedEndDate);
            const isRange = isWithinRange(day, parsedStartDate, parsedEndDate);

            return (
              <button
                className={`relative h-10 rounded-[14px] text-sm font-medium transition ${
                  isStart || isEnd
                    ? "bg-[#9dc1ff] text-[#08111d] shadow-[0_10px_24px_rgba(111,168,255,0.35)]"
                    : isRange
                      ? "bg-white/[0.08] text-ink"
                      : isCurrentMonth
                        ? "text-ink hover:bg-white/[0.08]"
                        : "text-storm/40 hover:bg-white/[0.04]"
                } ${isToday && !isStart && !isEnd ? "border border-pine/25 bg-pine/10 text-pine" : ""}`}
                key={day.toISOString()}
                onClick={() => handlePickDay(day)}
                type="button"
              >
                {day.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-storm transition hover:border-white/16 hover:text-ink"
          onClick={() => handlePreset(7)}
          type="button"
        >
          Ultimos 7 dias
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-storm transition hover:border-white/16 hover:text-ink"
          onClick={() => handlePreset(30)}
          type="button"
        >
          Ultimos 30 dias
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-storm transition hover:border-white/16 hover:text-ink"
          onClick={handleCurrentMonth}
          type="button"
        >
          Este mes
        </button>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-storm transition hover:border-white/16 hover:text-ink"
          onClick={handleClear}
          type="button"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Borrar
        </button>
      </div>
    </div>
  );
}
