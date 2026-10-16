import { Check, ChevronRight } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "../../../components/ui/button";
import { Modal, ModalFooter } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import type { CategoryKind, CategoryOverview } from "../../../types/domain";
import { colorOptions, iconOptions } from "../lib/categories-presenters";
import { categoryParentCandidates } from "../lib/category-parent";

export type CategoryEditorValue = {
  name: string; kind: CategoryKind; parentId: number | null; defaultSpendTypeId: number | null;
  color: string; icon: string; sortOrder: number; isActive: boolean;
};

export function initialCategoryValue(categories: CategoryOverview[], category?: CategoryOverview): CategoryEditorValue {
  return {
    name: category?.name ?? "", kind: category?.kind ?? "expense", parentId: category?.parentId ?? null,
    defaultSpendTypeId: category?.defaultSpendTypeId ?? null, color: category?.color ?? "#6B6459",
    icon: category?.icon ?? "shapes", sortOrder: category?.sortOrder ?? Math.max(0, ...categories.map((item) => item.sortOrder)) + 10,
    isActive: category?.isActive ?? true,
  };
}

const field = "h-12 w-full rounded-[10px] border border-white/10 bg-[#141311] px-4 text-sm text-ink outline-none placeholder:text-storm/60 focus:border-white/40";
const row = "flex min-h-[54px] w-full items-center justify-between gap-4 border-b border-white/10 px-4 text-left text-sm last:border-0 hover:bg-white/[0.03]";

export function CategoryEditorDialog({ category, categories, spendTypes, onClose, onSave, disabled = false }: {
  category: CategoryOverview | null; categories: CategoryOverview[]; spendTypes: { id: number; name: string }[];
  disabled?: boolean;
  onClose: () => void; onSave: (value: CategoryEditorValue) => Promise<void>;
}) {
  const [value, setValue] = useState(() => initialCategoryValue(categories, category ?? undefined));
  const [panel, setPanel] = useState<"main" | "details" | "parent" | "spend" | "appearance">("main");
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const patch = (next: Partial<CategoryEditorValue>) => { setValue((current) => ({ ...current, ...next })); setDirty(true); setError(null); };
  const requestClose = () => dirty ? setDiscardOpen(true) : onClose();
  const parentCandidates = categoryParentCandidates(categories, value.kind, category?.id);
  const parentName = parentCandidates.find((item) => item.id === value.parentId)?.name ?? "Ninguna";
  const spendName = spendTypes.find((item) => item.id === value.defaultSpendTypeId)?.name ?? "Sin tipo";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || disabled) return;
    if (!value.name.trim()) { setError("Escribe el nombre de la categoría."); return; }
    if (value.parentId != null && !parentCandidates.some((item) => item.id === value.parentId)) { setError("Selecciona una categoría padre compatible o Ninguna."); setPanel("parent"); return; }
    savingRef.current = true;
    setSaving(true);
    try { await onSave({ ...value, name: value.name.trim() }); setDirty(false); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la categoría."); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <>
    <Modal className={resourceEditorSurfaceClassName} disableOutsideClose={saving} labelledBy="category-editor-title" onClose={requestClose}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
        <ResourceEditorHeader disabled={saving} onBack={panel === "main" ? undefined : () => setPanel(panel === "appearance" || panel === "parent" || panel === "spend" ? "details" : "main")} onClose={requestClose} title={panel === "main" ? category ? "Editar categoría" : "Nueva categoría" : panel === "details" ? "Detalles" : panel === "parent" ? "Dentro de" : panel === "spend" ? "Tipo por defecto" : "Apariencia"} titleId="category-editor-title" />
        <ModalBody className="!px-5 !py-5 sm:!px-6">
          {error ? <p className="mb-4 text-sm text-[#e6b7aa]" role="alert">{error}</p> : null}
          {panel === "main" ? <div className="space-y-5">
            <label className="block"><span className="mb-2 block text-xs uppercase tracking-[0.12em] text-storm">Nombre</span><input autoFocus className={field} maxLength={80} onChange={(event) => patch({ name: event.target.value })} placeholder="Ej. Alimentación" value={value.name} /></label>
            <div><p className="mb-2 text-xs uppercase tracking-[0.12em] text-storm">Se usa para</p><div className="grid grid-cols-3 gap-2">{([{ kind: "expense", label: "Gasto" }, { kind: "income", label: "Ingreso" }, { kind: "both", label: "Ambos" }] as const).map((option) => <button aria-pressed={value.kind === option.kind} className={`h-11 rounded-[10px] border text-sm ${value.kind === option.kind ? "border-[#e9e3d9] bg-[#e9e3d9] font-semibold text-[#141311]" : "border-white/10 text-storm hover:border-white/25"}`} key={option.kind} onClick={() => patch({ kind: option.kind, defaultSpendTypeId: option.kind === "income" ? null : value.defaultSpendTypeId })} type="button">{option.label}</button>)}</div></div>
            <button className="flex h-[54px] w-full items-center justify-between rounded-xl border border-white/10 bg-[#141311] px-4 text-left text-sm font-semibold text-ink hover:bg-white/[0.03]" onClick={() => setPanel("details")} type="button"><span>Detalles</span><span className="flex items-center gap-2 font-normal text-storm">{parentName} <ChevronRight className="h-4 w-4" /></span></button>
            <p className="text-xs leading-5 text-storm">{value.kind === "income" ? "Aparecerá al registrar ingresos." : value.kind === "expense" ? "Aparecerá al registrar gastos." : "Podrás usarla tanto para ingresos como para gastos."}</p>
          </div> : panel === "details" ? <div className="space-y-5">
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">
              <button className={row} onClick={() => setPanel("appearance")} type="button"><span className="font-medium text-ink">Apariencia</span><span className="flex items-center gap-2 text-storm">Ícono y color <ChevronRight className="h-4 w-4" /></span></button>
              <button className={row} onClick={() => setPanel("parent")} type="button"><span className="font-medium text-ink">Dentro de</span><span className="flex items-center gap-2 text-storm">{parentName} <ChevronRight className="h-4 w-4" /></span></button>
              {value.kind !== "income" && spendTypes.length ? <button className={row} onClick={() => setPanel("spend")} type="button"><span className="font-medium text-ink">Tipo de gasto por defecto</span><span className="flex items-center gap-2 text-storm">{spendName} <ChevronRight className="h-4 w-4" /></span></button> : null}
            </div>
            <label className="flex min-h-[54px] items-center justify-between border-y border-white/10 text-sm"><span className="text-ink">Categoría activa</span><input checked={value.isActive} className="h-4 w-4 accent-[#e9e3d9]" onChange={(event) => patch({ isActive: event.target.checked })} type="checkbox" /></label>
            <label className="block text-sm text-storm">Orden<input className={`${field} mt-2`} min="0" onChange={(event) => patch({ sortOrder: Number(event.target.value) || 0 })} type="number" value={value.sortOrder} /></label>
          </div> : panel === "parent" || panel === "spend" ? <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">{(panel === "parent" ? [{ id: null, name: "Ninguna" }, ...parentCandidates] : [{ id: null, name: "Sin tipo" }, ...spendTypes]).map((option) => <button className={row} key={option.id ?? "none"} onClick={() => { patch(panel === "parent" ? { parentId: option.id } : { defaultSpendTypeId: option.id }); setPanel("details"); }} type="button"><span className="text-ink">{option.name}</span>{(panel === "parent" ? value.parentId : value.defaultSpendTypeId) === option.id ? <Check className="h-4 w-4 text-ink" /> : null}</button>)}</div> : <div className="space-y-6">
            <div><p className="mb-3 text-xs uppercase tracking-[0.12em] text-storm">Ícono</p><div className="grid grid-cols-6 gap-2">{iconOptions.map((option) => <button aria-label={option.label} aria-pressed={value.icon === option.value} className={`grid h-11 place-items-center rounded-[10px] border ${value.icon === option.value ? "border-white/50 bg-white/10 text-ink" : "border-white/10 text-storm hover:text-ink"}`} key={option.value} onClick={() => patch({ icon: option.value })} type="button"><option.icon className="h-4 w-4" /></button>)}</div></div>
            <div><p className="mb-3 text-xs uppercase tracking-[0.12em] text-storm">Color</p><div className="flex flex-wrap gap-3">{colorOptions.map((color) => <button aria-label={`Color ${color}`} aria-pressed={value.color === color} className={`h-8 w-8 rounded-full border-2 ${value.color === color ? "border-white" : "border-transparent"}`} key={color} onClick={() => patch({ color })} style={{ backgroundColor: color }} type="button" />)}</div></div>
          </div>}
        </ModalBody>
        {(panel === "main" || panel === "details") ? <ModalFooter><Button className="w-full" disabled={saving || disabled} type="submit">{saving ? "Guardando…" : category ? "Guardar cambios" : "Crear categoría"}</Button></ModalFooter> : null}
      </form>
    </Modal>
    {discardOpen ? <UnsavedChangesDialog onDiscard={() => { setDiscardOpen(false); onClose(); }} onKeepEditing={() => setDiscardOpen(false)} /> : null}
  </>;
}
