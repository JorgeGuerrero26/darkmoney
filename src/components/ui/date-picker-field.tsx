import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  RotateCcw,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import type { CSSProperties } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

type DatePickerFieldMode = "date" | "datetime-local";

type DatePickerFieldProps = {
  value: string;
  onChange: (value: string) => void;
  mode?: DatePickerFieldMode;
  disabled?: boolean;
  placeholder?: string;
  appearance?: "default" | "compact" | "inline";
};

const weekdayLabels = ["DO", "LU", "MA", "MI", "JU", "VI", "SA"] as const;
const minuteOptions = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

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
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
  const cellCount = Math.max(35, Math.ceil((firstWeekday + daysInMonth) / 7) * 7);

  return Array.from({ length: cellCount }, (_, index) => {
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
  appearance = "default",
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
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState<Date>(() => {
    const referenceDate = selectedDate ?? new Date();
    return new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
  });
  const [draftDate, setDraftDate] = useState<Date | null>(selectedDate);
  const [draftHour, setDraftHour] = useState(selectedDate ? padNumber(selectedDate.getHours()) : "12");
  const [draftMinute, setDraftMinute] = useState(
    selectedDate ? padNumber(selectedDate.getMinutes()) : "00",
  );

  const monthLabel = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
  }).format(visibleMonth).replace(/^\p{L}/u, (letter) => letter.toUpperCase());
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
        ? padNumber(selectedDate.getMinutes())
        : padNumber(new Date().getMinutes()),
    );
  }, [isOpen, selectedDate]);

  function calcPosition() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const viewportPadding = 12;
    const gap = 10;
    const expectedPanelHeight = mode === "datetime-local"
      ? calendarDays.length === 42 ? 466 : 430
      : calendarDays.length === 42 ? 380 : 345;
    const width = Math.min(320, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding,
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const openBelow = spaceBelow >= expectedPanelHeight;
    const openAbove = !openBelow && spaceAbove >= expectedPanelHeight;
    const canFloatOverContent = !openBelow && !openAbove && window.innerHeight - viewportPadding * 2 >= expectedPanelHeight;
    const availableSpace = Math.max(openBelow ? spaceBelow : spaceAbove, 120);
    const style: CSSProperties = {
      left,
      maxHeight: canFloatOverContent
        ? expectedPanelHeight
        : Math.max(120, Math.min(expectedPanelHeight, availableSpace - gap)),
      overscrollBehavior: "contain",
      position: "fixed",
      width,
      zIndex: 9999,
    };

    if (openBelow) {
      style.top = rect.bottom + gap;
    } else if (openAbove) {
      style.bottom = window.innerHeight - rect.top + gap;
    } else if (canFloatOverContent) {
      style.top = Math.min(
        Math.max(viewportPadding, rect.top - expectedPanelHeight / 2),
        window.innerHeight - expectedPanelHeight - viewportPadding,
      );
    } else if (spaceBelow >= spaceAbove) {
      style.top = rect.bottom + gap;
    } else {
      style.bottom = window.innerHeight - rect.top + gap;
    }
    setDropdownStyle(style);
  }

  useLayoutEffect(() => {
    if (isOpen) calcPosition();
  }, [isOpen, calendarDays.length]); // Reposicionar al pasar de cinco a seis semanas.

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || panelRef.current?.contains(target))) {
        return;
      }
      setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("keydown", handleEscape);
    window.addEventListener("scroll", calcPosition, true);
    window.addEventListener("resize", calcPosition);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleEscape);
      window.removeEventListener("scroll", calcPosition, true);
      window.removeEventListener("resize", calcPosition);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  function handlePickDay(nextDate: Date) {
    if (mode === "date") {
      onChange(formatDateValue(nextDate));
      setIsOpen(false);
      triggerRef.current?.focus();
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
    setDraftMinute(padNumber(today.getMinutes()));
  }

  function handleClear() {
    onChange("");
    setDraftDate(null);
    setIsOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <button
        ref={triggerRef}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className={`flex w-full items-center justify-between gap-3 border text-left text-sm text-ink outline-none transition-colors duration-150 motion-reduce:transition-none ${appearance === "inline" ? "h-10 rounded-[7px] border-transparent bg-transparent px-1.5" : appearance === "compact" ? "h-11 rounded-[7px] border-white/[0.12] bg-[#141311] px-3" : "h-12 rounded-[8px] border-white/[0.12] bg-[#1a1917] px-3.5"} hover:border-white/[0.24] focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/10 ${
          disabled ? "cursor-not-allowed opacity-60" : ""
        }`}
        disabled={disabled}
        onClick={() => { calcPosition(); setIsOpen((v) => !v); }}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className={`truncate ${selectedDate ? "text-ink" : "text-storm/72"}`}>
            {formatTriggerLabel(selectedDate, mode, resolvedPlaceholder)}
          </span>
        </span>
        {mode === "datetime-local" ? <Clock3 className="h-4 w-4 shrink-0 text-storm" /> : <CalendarDays className="h-4 w-4 shrink-0 text-storm" />}
      </button>

      {isOpen ? createPortal(
        <div
          ref={panelRef}
          aria-label={mode === "datetime-local" ? "Elegir fecha y hora" : "Elegir fecha"}
          className="overflow-y-auto rounded-[12px] border border-white/[0.16] bg-[#1d1c19] p-2.5 text-ink"
          role="dialog"
          style={dropdownStyle}
        >
          <div className="flex h-10 items-center justify-between gap-2 px-0.5">
            <button
              aria-label="Mes anterior"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-storm transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.1] motion-reduce:transition-none"
              onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
              type="button"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-semibold tracking-[-0.01em] text-ink">{monthLabel}</p>
            <button
              aria-label="Mes siguiente"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-storm transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink active:bg-white/[0.1] motion-reduce:transition-none"
              onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
              type="button"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-1.5 grid grid-cols-7 gap-0.5">
            {weekdayLabels.map((label) => (
              <div className="py-1.5 text-center text-[0.68rem] font-medium tracking-[0.04em] text-storm" key={label}>
                {label}
              </div>
            ))}

            {calendarDays.map((day) => {
              const isCurrentMonth = day.getMonth() === visibleMonth.getMonth();
              const isToday = sameDay(day, today);
              const isSelected = sameDay(day, mode === "date" ? selectedDate : draftDate);

              return (
                <button
                  aria-current={isToday ? "date" : undefined}
                  aria-label={new Intl.DateTimeFormat("es-PE", { dateStyle: "full" }).format(day)}
                  aria-pressed={isSelected}
                  className={`h-9 rounded-[8px] text-sm tabular-nums transition-colors duration-150 motion-reduce:transition-none ${
                    isSelected
                      ? "bg-[#e8e3da] font-semibold text-[#171613]"
                      : isCurrentMonth
                        ? "text-ink hover:bg-white/[0.07] active:bg-white/[0.12]"
                        : "text-storm/40 hover:bg-white/[0.05]"
                  } ${isToday && !isSelected ? "ring-1 ring-inset ring-white/40" : ""}`}
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
            <div className="mt-2 border-t border-white/[0.09] pt-3">
              <p className="text-xs font-medium text-storm">Hora</p>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <select
                  aria-label="Hora"
                  className="h-9 w-full rounded-[7px] border border-white/[0.12] bg-[#141311] px-2 text-sm text-ink outline-none focus-visible:border-white/40"
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
                  aria-label="Minutos"
                  className="h-9 w-full rounded-[7px] border border-white/[0.12] bg-[#141311] px-2 text-sm text-ink outline-none focus-visible:border-white/40"
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

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.09] pt-2">
            <div className="flex gap-1">
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2 text-xs text-storm transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink motion-reduce:transition-none"
                onClick={handleClear}
                type="button"
              >
                <X className="h-3.5 w-3.5" />
                Borrar
              </button>
              <button
                className="inline-flex h-8 items-center gap-1.5 rounded-[7px] px-2 text-xs text-storm transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink motion-reduce:transition-none"
                onClick={handleQuickNow}
                type="button"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {mode === "datetime-local" ? "Ahora" : "Hoy"}
              </button>
            </div>

            {mode === "datetime-local" ? <button
              className="inline-flex h-8 items-center rounded-[7px] bg-[#e8e3da] px-3 text-xs font-semibold text-[#171613] transition-colors duration-150 hover:bg-white motion-reduce:transition-none"
              onClick={handleApply}
              type="button"
            >Aplicar</button> : null}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
