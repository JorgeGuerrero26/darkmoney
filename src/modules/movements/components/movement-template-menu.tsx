import { useState } from "react";

import type { MovementTemplate } from "../../../services/queries/movement-templates";

type Props = {
  templates: MovementTemplate[];
  isLoading: boolean;
  isBusy: boolean;
  onStart: (type: MovementTemplate["movementType"]) => void;
  onUse: (template: MovementTemplate) => void;
  onRename: (id: number, name: string) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
};

export function MovementTemplateMenu({ templates, isLoading, isBusy, onStart, onUse, onRename, onDelete }: Props) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);

  return (
    <div className="border-t border-white/[0.08] py-2">
      <p className="px-4 pb-1 pt-2 font-public-mono text-[10px] uppercase tracking-[0.16em] text-storm">Registrar</p>
      {([ ["expense", "Gasto"], ["income", "Ingreso"], ["transfer", "Transferencia"] ] as const).map(([type, label]) => (
        <button
          className="flex h-9 w-full items-center px-4 text-left text-sm text-ink transition hover:bg-white/[0.05]"
          key={type}
          onClick={() => onStart(type)}
          type="button"
        >
          {label}
        </button>
      ))}
      <p className="px-4 pb-1 pt-4 font-public-mono text-[10px] uppercase tracking-[0.16em] text-storm">Atajos guardados</p>
      {isLoading ? <p className="px-4 py-2 text-xs text-storm">Cargando atajos…</p> : null}
      {!isLoading && templates.length === 0 ? <p className="px-4 py-2 text-xs text-storm">Aún no hay atajos guardados.</p> : null}
      {templates.map((template) => (
        <div className="border-t border-white/[0.05] px-2 py-1" key={template.id}>
          {editingId === template.id ? (
            <form
              className="flex gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                const name = draftName.trim();
                if (!name || isBusy) return;
                void onRename(template.id, name).then((saved) => { if (saved) setEditingId(null); });
              }}
            >
              <input
                aria-label={`Nuevo nombre de ${template.name}`}
                autoFocus
                className="field-dark h-8 min-w-0 flex-1 px-2 text-sm"
                maxLength={80}
                onChange={(event) => setDraftName(event.target.value)}
                value={draftName}
              />
              <button className="px-2 text-xs text-ink disabled:opacity-40" disabled={!draftName.trim() || isBusy} type="submit">Listo</button>
              <button className="px-1 text-xs text-storm" onClick={() => setEditingId(null)} type="button">×</button>
            </form>
          ) : deletingId === template.id ? (
            <div className="flex items-center gap-2 px-2 py-1 text-xs">
              <span className="min-w-0 flex-1 truncate text-storm">¿Eliminar {template.name}?</span>
              <button className="text-ink disabled:opacity-40" disabled={isBusy} onClick={() => void onDelete(template.id).then((removed) => { if (removed) setDeletingId(null); })} type="button">Eliminar</button>
              <button className="text-storm" onClick={() => setDeletingId(null)} type="button">Cancelar</button>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                className="min-w-0 flex-1 truncate rounded-[5px] px-2 py-2 text-left text-sm text-ink transition hover:bg-white/[0.05]"
                onClick={() => onUse(template)}
                title={`Usar atajo ${template.name}`}
                type="button"
              >
                {template.name}
              </button>
              <button
                aria-label={`Renombrar ${template.name}`}
                className="px-1 text-xs text-storm hover:text-ink"
                onClick={() => { setEditingId(template.id); setDraftName(template.name); setDeletingId(null); }}
                type="button"
              >
                Editar
              </button>
              <button
                aria-label={`Eliminar ${template.name}`}
                className="px-1 text-xs text-storm hover:text-ink"
                onClick={() => { setDeletingId(template.id); setEditingId(null); }}
                type="button"
              >
                ×
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
