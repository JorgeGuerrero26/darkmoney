import { Check, ChevronDown, Search, Sparkles } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useState } from "react";

import { useOutsidePointerClose } from "../../hooks/use-outside-pointer-close";
import { TruncatedDescription } from "./truncated-description";

export type PickerOption = {
  value: string;
  label: string;
  description: string;
  leadingLabel: string;
  leadingColor?: string;
  searchText?: string;
};

export type SearchablePickerProps = {
  value: string;
  onChange: (value: string) => void;
  options: PickerOption[];
  placeholderLabel: string;
  placeholderDescription: string;
  queryPlaceholder: string;
  emptyMessage: string;
  /** Acción opcional al pie del buscador (ej. "+ Nuevo contacto"). */
  onAction?: () => void;
  actionLabel?: string;
  actionDescription?: string;
  actionLeadingLabel?: string;
  actionLeadingColor?: string;
  disabled?: boolean;
};

const triggerClassName =
  "flex h-12 sm:h-14 w-full items-center justify-between gap-2 sm:gap-3 rounded-2xl border px-3 sm:px-4 text-left text-sm text-ink outline-none transition duration-200 disabled:cursor-not-allowed disabled:opacity-60";

function getTriggerStyle(isOpen: boolean) {
  return {
    borderColor: isOpen ? "rgba(107, 228, 197, 0.18)" : "rgba(255, 255, 255, 0.08)",
    background: isOpen
      ? "linear-gradient(180deg, rgba(15, 22, 34, 0.98), rgba(10, 16, 27, 0.98))"
      : "linear-gradient(180deg, rgba(12, 18, 28, 0.96), rgba(9, 14, 22, 0.96))",
    boxShadow: isOpen
      ? "0 0 0 4px rgba(107, 228, 197, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.04)"
      : "inset 0 1px 0 rgba(255, 255, 255, 0.04)",
  };
}

function getOptionStyle(isSelected: boolean, isHighlighted: boolean) {
  return {
    borderColor: isSelected
      ? "rgba(107, 228, 197, 0.18)"
      : isHighlighted
        ? "rgba(255, 255, 255, 0.14)"
        : "rgba(255, 255, 255, 0.04)",
    background: isSelected
      ? "linear-gradient(180deg, rgba(18, 31, 41, 0.98), rgba(12, 22, 33, 0.98))"
      : isHighlighted
        ? "linear-gradient(180deg, rgba(18, 26, 39, 0.98), rgba(13, 20, 31, 0.98))"
        : "linear-gradient(180deg, rgba(14, 21, 32, 0.96), rgba(11, 17, 26, 0.96))",
    boxShadow: isSelected ? "0 12px 30px rgba(0, 0, 0, 0.18)" : "none",
  };
}

function LeadingChip({ label, color }: { label: string; color?: string }) {
  return (
    <span
      className="flex h-9 min-w-[2.75rem] shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-white/[0.04] px-2.5 text-xs font-semibold text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
      style={{
        backgroundColor: color ? `${color}22` : undefined,
        color: color ? "#ffffff" : undefined,
        borderColor: color ? `${color}55` : undefined,
      }}
    >
      {label}
    </span>
  );
}

export function SearchablePicker({
  value,
  onChange,
  options,
  placeholderLabel,
  placeholderDescription,
  queryPlaceholder,
  emptyMessage,
  onAction,
  actionLabel,
  actionDescription,
  actionLeadingLabel,
  actionLeadingColor,
  disabled = false,
}: SearchablePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useOutsidePointerClose(isOpen, () => setIsOpen(false));

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => {
      const searchableValue = (
        option.searchText ?? `${option.label} ${option.description} ${option.leadingLabel}`
      ).toLowerCase();
      return searchableValue.includes(normalizedQuery);
    });
  }, [options, query]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  function selectOption(option: PickerOption) {
    onChange(option.value);
    setIsOpen(false);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, filteredOptions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const option = filteredOptions[highlightedIndex];
      if (option) {
        selectOption(option);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setIsOpen(false);
    }
  }

  return (
    <div
      className={`relative min-w-0 ${isOpen ? "z-50" : "z-10"}`}
      ref={containerRef}
    >
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        className={triggerClassName}
        disabled={disabled}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        style={getTriggerStyle(isOpen)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <LeadingChip
            color={selectedOption?.leadingColor}
            label={selectedOption?.leadingLabel ?? "?"}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">
              {selectedOption ? selectedOption.label : placeholderLabel}
            </span>
            <TruncatedDescription
              className="mt-0.5 text-xs text-storm"
              text={selectedOption ? selectedOption.description : placeholderDescription}
            />
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-storm transition ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen ? (
        <div className="animate-rise-in absolute left-0 right-0 top-[calc(100%+0.65rem)] z-50 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,15,24,0.98),rgba(8,12,20,0.98))] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
            <input
              autoFocus
              className="w-full rounded-2xl border border-white/10 bg-[#101928] py-3 pl-11 pr-4 text-sm text-ink outline-none transition placeholder:text-storm/70 focus:border-pine/25 focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={queryPlaceholder}
              type="text"
              value={query}
            />
          </div>

          {onAction && actionLabel ? (
            <button
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-pine/25 bg-[linear-gradient(180deg,rgba(16,31,36,0.96),rgba(10,22,24,0.96))] px-4 py-3 text-left text-ink transition duration-200 hover:border-pine/35 hover:bg-[linear-gradient(180deg,rgba(18,35,40,0.98),rgba(12,25,28,0.98))]"
              onClick={() => {
                setIsOpen(false);
                onAction();
              }}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-3">
                <LeadingChip
                  color={actionLeadingColor}
                  label={actionLeadingLabel ?? "+"}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">
                    {actionLabel}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-storm">
                    {actionDescription ?? "Agrega un nuevo registro sin salir de este flujo."}
                  </span>
                </span>
              </span>
              <Sparkles className="h-4 w-4 shrink-0 text-pine" />
            </button>
          ) : null}

          <div
            className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1"
            role="listbox"
          >
            {filteredOptions.length ? (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <button
                    aria-selected={isSelected}
                    className={`flex w-full items-center justify-between gap-2.5 rounded-2xl border px-3.5 py-3 text-left transition duration-200 ${
                      isSelected ? "text-ink" : "text-storm hover:text-ink"
                    }`}
                    key={option.value}
                    onClick={() => selectOption(option)}
                    onPointerEnter={() => setHighlightedIndex(index)}
                    role="option"
                    style={getOptionStyle(isSelected, isHighlighted)}
                    type="button"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <LeadingChip
                        color={option.leadingColor}
                        label={option.leadingLabel}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">
                          {option.label}
                        </span>
                        <TruncatedDescription
                          className="mt-0.5 text-xs text-storm"
                          text={option.description}
                        />
                      </span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 shrink-0 text-pine" /> : null}
                  </button>
                );
              })
            ) : (
              <div className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,21,32,0.96),rgba(11,17,26,0.96))] px-4 py-5 text-sm text-storm">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
