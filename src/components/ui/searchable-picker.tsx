import { Check, ChevronDown, Search, Sparkles } from "lucide-react";
import { createPortal } from "react-dom";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
      ? "linear-gradient(180deg, rgb(15, 22, 34), rgb(10, 16, 27))"
      : "linear-gradient(180deg, rgb(12, 18, 28), rgb(9, 14, 22))",
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
      ? "linear-gradient(180deg, rgb(18, 31, 41), rgb(12, 22, 33))"
      : isHighlighted
        ? "linear-gradient(180deg, rgb(18, 26, 39), rgb(13, 20, 31))"
        : "linear-gradient(180deg, rgb(14, 21, 32), rgb(11, 17, 26))",
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
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

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

  const updateDropdownPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const viewportPadding = 12;
    const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
    const left = Math.min(
      Math.max(viewportPadding, rect.left),
      window.innerWidth - width - viewportPadding,
    );
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding;
    const spaceAbove = rect.top - viewportPadding;
    const nextStyle: CSSProperties = {
      left,
      position: "fixed",
      width,
      zIndex: 9999,
    };

    if (spaceBelow >= 320 || spaceBelow >= spaceAbove) {
      nextStyle.top = rect.bottom + 10;
    } else {
      nextStyle.bottom = window.innerHeight - rect.top + 10;
    }

    setDropdownStyle(nextStyle);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateDropdownPosition();

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (
        target &&
        (containerRef.current?.contains(target) || dropdownRef.current?.contains(target))
      ) {
        return;
      }
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", updateDropdownPosition, true);
    window.addEventListener("resize", updateDropdownPosition);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", updateDropdownPosition, true);
      window.removeEventListener("resize", updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

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
        onClick={() => {
          if (!isOpen) {
            updateDropdownPosition();
          }
          setIsOpen((currentValue) => !currentValue);
        }}
        ref={triggerRef}
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

      {isOpen ? createPortal(
        <div
          className="animate-rise-in rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgb(10,15,24),rgb(8,12,20))] p-3 shadow-[0_30px_80px_rgba(0,0,0,0.58)]"
          ref={dropdownRef}
          style={dropdownStyle}
        >
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
              className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-dashed border-pine/25 bg-[linear-gradient(180deg,rgb(16,31,36),rgb(10,22,24))] px-4 py-3 text-left text-ink transition duration-200 hover:border-pine/35 hover:bg-[linear-gradient(180deg,rgb(18,35,40),rgb(12,25,28))]"
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
              <div className="rounded-2xl border border-white/[0.08] bg-[linear-gradient(180deg,rgb(14,21,32),rgb(11,17,26))] px-4 py-5 text-sm text-storm">
                {emptyMessage}
              </div>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
