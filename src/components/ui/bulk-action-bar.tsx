import { useEffect, useRef, useState } from "react";

// Module-level timestamp — survives React re-renders caused by state changes
let _lastLongPressAt = 0;
const LONG_PRESS_CLICK_SUPPRESS_MS = 600;

/** Returns true if a long-press just fired (within the suppress window). */
export function wasRecentLongPress(): boolean {
  return Date.now() - _lastLongPressAt < LONG_PRESS_CLICK_SUPPRESS_MS;
}

/** Plain factory (not a hook) — safe to call inside .map() */
export function createLongPressHandlers(onLongPress: () => void, duration = 500) {
  let timer: number | null = null;

  function clear() {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  }

  function start() {
    clear();
    timer = window.setTimeout(() => {
      timer = null;
      _lastLongPressAt = Date.now();
      onLongPress();
    }, duration);
  }

  return {
    onMouseDown: start,
    onMouseUp: clear,
    onMouseLeave: clear,
    onTouchStart: start,
    onTouchEnd: clear,
    onTouchCancel: clear,
  };
}

export function useSelection<T extends { id: number }>(items: T[]) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Remove IDs that no longer exist in the current items list
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(items.map((i) => i.id));
      const filtered = new Set([...prev].filter((id) => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [items]);

  function toggle(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectAll = () => setSelectedIds(new Set(items.map((i) => i.id)));
  const clearAll = () => setSelectedIds(new Set());

  return {
    selectedIds,
    toggle,
    selectAll,
    clearAll,
    selectedCount: selectedIds.size,
    allSelected: items.length > 0 && selectedIds.size === items.length,
    someSelected: selectedIds.size > 0 && selectedIds.size < items.length,
    selectedItems: items.filter((i) => selectedIds.has(i.id)),
  };
}

export function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      aria-label={ariaLabel ?? "Seleccionar"}
      checked={checked}
      className="h-4 w-4 cursor-pointer rounded accent-pine"
      onChange={onChange}
      ref={ref}
      type="checkbox"
    />
  );
}

export function BulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearAll,
  onExport,
  onDelete,
  deleteLabel = "Eliminar",
  deletingLabel = "Eliminando...",
  isDeleting = false,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearAll: () => void;
  onExport?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  deletingLabel?: string;
  isDeleting?: boolean;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-[300] -translate-x-1/2 px-4">
      <div className="flex items-center gap-3 rounded-[24px] border border-white/15 bg-[#080d14]/95 px-5 py-3 shadow-[0_8px_40px_rgba(0,0,0,0.7)] backdrop-blur-xl">
        <span className="whitespace-nowrap text-sm font-semibold text-ink">
          {selectedCount} seleccionado{selectedCount !== 1 ? "s" : ""}
        </span>
        <div className="h-4 w-px bg-white/15" />
        {selectedCount < totalCount ? (
          <button
            className="whitespace-nowrap text-sm text-storm transition hover:text-ink"
            onClick={onSelectAll}
            type="button"
          >
            Todos ({totalCount})
          </button>
        ) : null}
        {onExport ? (
          <button
            className="whitespace-nowrap text-sm text-storm transition hover:text-ink"
            onClick={onExport}
            type="button"
          >
            Exportar CSV
          </button>
        ) : null}
        {onDelete ? (
          <>
            <div className="h-4 w-px bg-white/15" />
            <button
              className="whitespace-nowrap text-sm text-red-400 transition hover:text-red-300 disabled:opacity-50"
              disabled={isDeleting}
              onClick={onDelete}
              type="button"
            >
              {isDeleting ? deletingLabel : deleteLabel}
            </button>
          </>
        ) : null}
        <div className="h-4 w-px bg-white/15" />
        <button
          aria-label="Quitar seleccion"
          className="text-sm text-storm transition hover:text-ink"
          onClick={onClearAll}
          type="button"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
