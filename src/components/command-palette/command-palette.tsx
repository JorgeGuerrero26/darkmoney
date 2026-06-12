import { Search } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { fuzzyScore } from "../../lib/fuzzy-match";
import { Modal } from "../ui/modal";

export type CommandAction = {
  id: string;
  label: string;
  keywords?: string;
  group: string;
  icon: LucideIcon;
  disabled?: boolean;
  run: () => void;
};

type CommandPaletteProps = {
  actions: CommandAction[];
  onClose: () => void;
};

export function CommandPalette({ actions, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  const visibleActions = useMemo(() => {
    const enabled = actions.filter((action) => !action.disabled);

    if (!query.trim()) {
      return enabled;
    }

    return enabled
      .map((action) => ({
        action,
        score: fuzzyScore(query, `${action.label} ${action.keywords ?? ""}`),
      }))
      .filter((entry): entry is { action: CommandAction; score: number } => entry.score !== null)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.action);
  }, [actions, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  useEffect(() => {
    const highlighted = listRef.current?.querySelector('[data-highlighted="true"]');
    highlighted?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex]);

  function runAction(action: CommandAction) {
    onClose();
    action.run();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, visibleActions.length - 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const action = visibleActions[highlightedIndex];
      if (action) {
        runAction(action);
      }
    }
  }

  let lastGroup = "";

  return (
    <Modal
      align="top"
      ariaLabel="Paleta de comandos"
      onClose={onClose}
      size="md"
    >
      <div className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        <Search className="h-4 w-4 shrink-0 text-storm" />
        <input
          autoFocus
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-storm/60"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Buscar acción o sección..."
          type="text"
          value={query}
        />
        <kbd className="hidden rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-storm sm:inline">
          esc
        </kbd>
      </div>

      <div className="max-h-[50vh] overflow-y-auto p-2" ref={listRef}>
        {visibleActions.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-storm">
            No encontramos acciones para «{query}».
          </p>
        ) : (
          visibleActions.map((action, index) => {
            const Icon = action.icon;
            const isHighlighted = index === highlightedIndex;
            const showGroup = !query.trim() && action.group !== lastGroup;
            lastGroup = action.group;

            return (
              <div key={action.id}>
                {showGroup ? (
                  <p className="px-3 pb-1 pt-3 text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-storm/50">
                    {action.group}
                  </p>
                ) : null}
                <button
                  className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition duration-150 ${
                    isHighlighted ? "bg-white/[0.08] text-ink" : "text-storm hover:text-ink"
                  }`}
                  data-highlighted={isHighlighted}
                  onClick={() => runAction(action)}
                  onPointerEnter={() => setHighlightedIndex(index)}
                  type="button"
                >
                  <span
                    className={`absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full ${
                      isHighlighted ? "bg-pine" : "bg-transparent"
                    }`}
                  />
                  <Icon className="h-4 w-4 shrink-0" />
                  {action.label}
                </button>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-white/[0.06] px-5 py-2.5 text-[10px] text-storm/60">
        <span>
          <kbd className="rounded border border-white/10 px-1">↑↓</kbd> navegar
        </span>
        <span>
          <kbd className="rounded border border-white/10 px-1">↵</kbd> abrir
        </span>
        <span>
          <kbd className="rounded border border-white/10 px-1">esc</kbd> cerrar
        </span>
      </div>
    </Modal>
  );
}
