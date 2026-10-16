import { ChevronRight, MoreHorizontal, Pin, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { Modal, ModalFooter } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { formatDate } from "../../../lib/formatting/dates";
import {
  getQueryErrorMessage, useBudgetSpendTypesQuery, useCategoriesOverviewQuery,
  useCreateCategoryMutation, useDeleteCategoryMutation, usePinCategoryMutation,
  useToggleCategoryMutation, useUpdateCategoryMutation, useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import type { CategoryOverview } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { canWriteWorkspaceCatalog, useCatalogWriteScope } from "../../shared/use-catalog-write-scope";
import { CategoryAnalyticsModal } from "../components/category-analytics-modal";
import { CategoryEditorDialog, type CategoryEditorValue } from "../components/category-editor-dialog";
import { getIconDefinition } from "../lib/categories-presenters";

type KindFilter = "all" | "pinned" | "expense" | "income" | "both";
const filters: { value: KindFilter; label: string }[] = [
  { value: "all", label: "Todas" }, { value: "pinned", label: "Fijadas" },
  { value: "expense", label: "Gastos" }, { value: "income", label: "Ingresos" }, { value: "both", label: "Mixtas" },
];
const kindLabels = { expense: "Gasto", income: "Ingreso", both: "Mixta" };

function categoryCanDelete(item: CategoryOverview, all: CategoryOverview[]) {
  return !item.isSystem && item.movementCount === 0 && item.subscriptionCount === 0 && !all.some((child) => child.parentId === item.id);
}

function buildCsv(rows: CategoryOverview[]) {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const headers = ["nombre", "tipo", "activa", "sistema", "padre", "movimientos", "suscripciones", "ultima_actividad", "orden", "color", "icono"];
  return `\ufeff${[headers.join(","), ...rows.map((item) => [escape(item.name), escape(item.kind), item.isActive ? "si" : "no", item.isSystem ? "si" : "no", escape(item.parentName), item.movementCount, item.subscriptionCount, escape(item.lastActivityAt), item.sortOrder, escape(item.color), escape(item.icon)].join(","))].join("\n")}`;
}

function downloadCsv(rows: CategoryOverview[]) {
  const url = URL.createObjectURL(new Blob([buildCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `categorias-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}

export function CategoriesPage() {
  const auth = useAuth(), workspace = useActiveWorkspace();
  return <ScopedCategoriesPage key={`${auth.user?.id}:${workspace.activeWorkspace?.id}`} auth={auth} workspace={workspace} />;
}

function ScopedCategoriesPage({ auth, workspace }: { auth: ReturnType<typeof useAuth>; workspace: ReturnType<typeof useActiveWorkspace> }) {
  const { user, profile } = auth;
  const { activeWorkspace, isLoading: workspaceLoading, error: workspaceError } = workspace;
  const overview = useCategoriesOverviewQuery(activeWorkspace?.id, user?.id);
  const snapshot = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const spendTypes = useBudgetSpendTypesQuery(activeWorkspace?.id);
  const create = useCreateCategoryMutation(activeWorkspace?.id, user?.id);
  const update = useUpdateCategoryMutation(activeWorkspace?.id, user?.id);
  const toggle = useToggleCategoryMutation(activeWorkspace?.id, user?.id);
  const pin = usePinCategoryMutation(activeWorkspace?.id, user?.id);
  const remove = useDeleteCategoryMutation(activeWorkspace?.id, user?.id);
  const { schedule, cancel } = useUndoQueue();
  const queued = useRef(new Set<string>());
  const deletions = useRef(new Set<number>());
  const locks = useRef(new Set<number | "new">());
  const [busy, setBusy] = useState(0);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [menu, setMenu] = useState<number | "page" | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<CategoryOverview | "new" | null>(null);
  const [detailSelection, setDetail] = useState<CategoryOverview | null>(null);
  const [analyticsSelection, setAnalytics] = useState<CategoryOverview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryOverview | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const all = useMemo(() => (overview.data ?? []).filter(item => item.workspaceId === activeWorkspace?.id), [overview.data, activeWorkspace?.id]);
  const rows = useRef(all); rows.current = all;
  const ready = Boolean(!workspaceLoading && !workspaceError && !workspace.isFetching && !workspace.isPlaceholderData && overview.isSuccess && !overview.isFetching && !overview.isPlaceholderData);
  const access = useCatalogWriteScope(activeWorkspace, user?.id, ready);
  const permitted = canWriteWorkspaceCatalog(activeWorkspace, user?.id, true);
  const canAct = access.writable && busy === 0;
  useEffect(() => { if (!permitted) { setEditing(null); setDeleteTarget(null); } }, [permitted]);
  useEffect(() => () => { queued.current.forEach(id => cancel(id)); queued.current.clear(); }, [cancel]);
  useEffect(() => { if (!access.writable) { queued.current.forEach(id => cancel(id)); queued.current.clear(); } }, [access.writable, cancel]);
  const detail = all.find((item) => item.id === detailSelection?.id) ?? null;
  const analytics = all.find((item) => item.id === analyticsSelection?.id) ?? null;
  const visible = useMemo(() => all.filter((item) => {
    if (hiddenIds.has(item.id) || (!showInactive && !item.isActive)) return false;
    if (kind === "pinned" && !item.isPinned) return false;
    if (kind !== "all" && kind !== "pinned" && item.kind !== kind) return false;
    const query = search.trim().toLocaleLowerCase("es-PE");
    return !query || `${item.name} ${item.parentName ?? ""}`.toLocaleLowerCase("es-PE").includes(query);
  }), [all, hiddenIds, showInactive, kind, search]);
  const sections = useMemo(() => {
    const usage = (a: CategoryOverview, b: CategoryOverview) => b.movementCount - a.movementCount || a.name.localeCompare(b.name, "es");
    return [
      { label: "Fijadas", rows: visible.filter((item) => item.isPinned).sort(usage) },
      { label: "Personalizadas", rows: visible.filter((item) => !item.isPinned && !item.isSystem && item.movementCount > 0).sort(usage) },
      { label: "Del sistema", rows: visible.filter((item) => !item.isPinned && item.isSystem && item.movementCount > 0).sort(usage) },
      { label: "Sin movimientos", rows: visible.filter((item) => !item.isPinned && item.movementCount === 0).sort((a, b) => a.name.localeCompare(b.name, "es")) },
    ].filter((group) => group.rows.length);
  }, [visible]);

  function select(id: number) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function clearSelection() { setSelectionMode(false); setSelected(new Set()); }
  function currentItem(item: CategoryOverview) {
    access.assertCurrent();
    const current = rows.current.find(row => row.id === item.id && row.workspaceId === activeWorkspace?.id);
    if (!current) throw new Error("La categoría ya no está disponible en este espacio.");
    return current;
  }
  async function run(id: number | "new", action: () => Promise<unknown>) {
    access.assertCurrent();
    if (locks.current.has(id)) throw new Error("Esta categoría ya tiene una operación pendiente.");
    locks.current.add(id); setBusy(locks.current.size);
    try { return await action(); } finally { locks.current.delete(id); setBusy(locks.current.size); }
  }
  async function save(value: CategoryEditorValue) {
    access.assertCurrent();
    if (!activeWorkspace || !user?.id || !editing) throw new Error("No hay un espacio activo.");
    if (editing !== "new" && currentItem(editing).isSystem) throw new Error("No se puede editar una categoría del sistema.");
    const payload = { ...value, parentId: value.parentId, defaultSpendTypeId: value.kind === "income" ? null : value.defaultSpendTypeId };
    if (editing === "new") await run("new", () => create.mutateAsync({ ...payload, workspaceId: activeWorkspace.id, userId: user.id }));
    else await run(editing.id, () => update.mutateAsync({ ...payload, categoryId: editing.id, workspaceId: activeWorkspace.id, userId: user.id }));
  }
  async function toggleActive(item: CategoryOverview) {
    try { const current = currentItem(item); if (!activeWorkspace || !user?.id || current.isSystem) return;
      await run(current.id, () => toggle.mutateAsync({ categoryId: current.id, workspaceId: activeWorkspace.id, userId: user.id, isActive: !current.isActive })); }
    catch (cause) { if (access.isCurrent()) setError(getQueryErrorMessage(cause)); }
  }
  async function togglePin(item: CategoryOverview) {
    try { const current = currentItem(item); await run(current.id, () => pin.mutateAsync({ categoryId: current.id, isPinned: !current.isPinned })); }
    catch (cause) { if (access.isCurrent()) setError(getQueryErrorMessage(cause)); }
  }
  function deleteWithUndo(item: CategoryOverview) {
    const current = rows.current.find(row => row.id === item.id && row.workspaceId === activeWorkspace?.id);
    if (!activeWorkspace || !access.isCurrent() || !current || !categoryCanDelete(current, rows.current) || deletions.current.has(item.id)) return;
    deletions.current.add(item.id);
    setHiddenIds((current) => new Set(current).add(item.id)); setDeleteTarget(null); setMenu(null);
    let resolved = false;
    const restore = () => { deletions.current.delete(item.id); setHiddenIds(current => { const next = new Set(current); next.delete(item.id); return next; }); };
    const id = schedule({ label: `${item.name} pendiente de eliminar`, onCommit: async () => {
      if (resolved) return;
      resolved = true;
      queued.current.delete(id);
      try { const current = currentItem(item); if (!categoryCanDelete(current, rows.current)) throw new Error("La categoría tiene relaciones nuevas. No se eliminó.");
        await run(current.id, () => remove.mutateAsync({ categoryId: current.id, workspaceId: activeWorkspace.id })); deletions.current.delete(item.id); }
      catch (cause) { restore(); if (access.isCurrent()) setError(getQueryErrorMessage(cause)); }
    }, onUndo: () => { if (resolved) return; resolved = true; queued.current.delete(id); restore(); } });
    queued.current.add(id);
  }

  if (workspaceLoading || overview.isLoading) return <DataState title="Categorías" description="Cargando categorías…" />;
  if (workspaceError || overview.error) return <DataState title="No se pudieron cargar las categorías" description={getQueryErrorMessage(workspaceError ?? overview.error)} tone="error" />;
  if (!activeWorkspace) return <DataState title="Sin espacio activo" description="Activa un espacio para gestionar tus categorías." />;

  return <div className="pb-10">
    <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-6">
      <div><h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-ink">Categorías</h1><p className="mt-1 text-sm text-storm">{all.length} registradas · {all.filter((item) => item.isActive).length} activas</p></div>
      <div className="flex items-center gap-2"><Button disabled={!canAct} onClick={() => { if (access.isCurrent()) setEditing("new"); }}><Plus className="h-4 w-4" /> Nueva categoría</Button>
        <div className="relative"><button aria-label="Más acciones" aria-expanded={menu === "page"} className="grid h-11 w-11 place-items-center rounded-[10px] border border-white/10 text-storm hover:text-ink" onClick={() => setMenu(menu === "page" ? null : "page")} type="button"><MoreHorizontal className="h-4 w-4" /></button>
          {menu === "page" ? <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-white/10 bg-[#211f1c] p-1"><button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-storm hover:bg-white/[0.05]" onClick={() => { downloadCsv(visible); setMenu(null); }} type="button">Exportar CSV</button><button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-storm hover:bg-white/[0.05]" onClick={() => { setSelectionMode(true); setMenu(null); }} type="button">Seleccionar varias</button></div> : null}
        </div>
      </div>
    </header>
    {!permitted ? <p className="mt-4 text-sm text-storm" role="status">{activeWorkspace.isArchived ? "Este espacio está archivado." : "Tu acceso es de solo lectura."} Puedes consultar, filtrar y exportar las categorías, pero no modificarlas.</p> : !ready ? <p className="mt-4 text-sm text-storm" role="status">Comprobando datos y permisos antes de permitir cambios…</p> : null}
    {error ? <p className="mt-4 text-sm text-[#e6b7aa]" role="alert">{error} <button className="underline" onClick={() => setError(null)} type="button">Cerrar</button></p> : null}
    <div className="mt-6 flex flex-wrap gap-2">{filters.map((option) => <button aria-pressed={kind === option.value} className={`h-10 rounded-[10px] border px-4 text-sm ${kind === option.value ? "border-white/30 bg-white/[0.08] text-ink" : "border-white/10 text-storm hover:text-ink"}`} key={option.value} onClick={() => setKind(option.value)} type="button">{option.label}</button>)}</div>
    <div className="mt-3 flex gap-2"><label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-white/10 bg-[#1a1917] px-4 text-storm"><Search className="h-4 w-4" /><input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-storm/70" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar categorías…" value={search} /></label><button aria-pressed={showInactive} className={`rounded-[10px] border px-4 text-sm ${showInactive ? "border-white/30 text-ink" : "border-white/10 text-storm"}`} onClick={() => setShowInactive(!showInactive)} type="button">Inactivas</button></div>
    <div className="mt-5 flex items-center justify-between border-y border-white/[0.08] py-3 text-sm text-storm"><span>{visible.length === all.length ? `${visible.length} categorías` : `${visible.length} de ${all.length} categorías`}</span><span>{visible.filter((item) => item.isSystem).length} del sistema</span></div>
    {selectionMode ? <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-white/10 pb-3 text-sm"><button className="text-storm hover:text-ink" onClick={clearSelection} type="button">Cancelar</button><span className="text-ink">{selected.size} seleccionadas</span><button className="text-storm hover:text-ink" onClick={() => setSelected(new Set(visible.map((item) => item.id)))} type="button">Seleccionar todas</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size} onClick={() => downloadCsv(visible.filter((item) => selected.has(item.id)))} type="button">CSV</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size || !canAct} onClick={() => { void Promise.all(visible.filter((item) => selected.has(item.id) && !item.isSystem).map(toggleActive)); clearSelection(); }} type="button">Activar / desactivar</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size || !canAct} onClick={() => { visible.filter((item) => selected.has(item.id) && categoryCanDelete(item, all)).forEach(deleteWithUndo); clearSelection(); }} type="button">Eliminar sin relaciones</button></div> : null}
    {sections.length ? sections.map(section => <section className="mt-7" key={section.label}>
      <h2 className="mb-2 font-public-mono text-xs uppercase tracking-[0.16em] text-storm">{section.label} · {section.rows.length}</h2>
      {section.rows.map(item => {
        const Icon = getIconDefinition(item.icon ?? "shapes").icon;
        const actions: [string, () => void][] = [["Ver actividad", () => setDetail(item)]];
        if (canAct) {
          actions.unshift([item.isPinned ? "Desfijar" : "Fijar", () => void togglePin(item)]);
          if (!item.isSystem) actions.push(["Editar", () => { if (access.isCurrent()) setEditing(item); }], [item.isActive ? "Desactivar" : "Activar", () => void toggleActive(item)]);
          if (categoryCanDelete(item, all)) actions.push(["Eliminar", () => { if (access.isCurrent()) setDeleteTarget(item); }]);
        }
        return <div className="relative flex min-h-[68px] items-center gap-3 border-b border-white/[0.08]" key={item.id}>
          {selectionMode ? <input aria-label={`Seleccionar ${item.name}`} checked={selected.has(item.id)} className="h-4 w-4 accent-[#e9e3d9]" onChange={() => select(item.id)} type="checkbox" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/10 text-storm"><Icon className="h-4 w-4" /></span>}
          <button className="min-w-0 flex-1 py-3 text-left" onClick={() => selectionMode ? select(item.id) : setDetail(item)} type="button"><span className="flex items-center gap-2 text-sm font-semibold text-ink">{item.name}{item.isPinned ? <Pin className="h-3 w-3 text-storm" /> : null}</span><span className="mt-0.5 block text-xs text-storm">{kindLabels[item.kind]}{item.parentName ? ` · ${item.parentName}` : ""}{!item.isActive ? " · Inactiva" : ""}</span></button>
          <span className="hidden shrink-0 text-xs text-storm sm:block">{item.movementCount} movimientos</span>
          {!selectionMode ? <div className="relative"><button aria-label={`Acciones de ${item.name}`} className="grid h-9 w-9 place-items-center text-storm hover:text-ink" onClick={() => setMenu(menu === item.id ? null : item.id)} type="button"><MoreHorizontal className="h-4 w-4" /></button>{menu === item.id ? <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-white/10 bg-[#211f1c] p-1">{actions.map(([label, action]) => <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-storm hover:bg-white/[0.05] hover:text-ink" key={label} onClick={() => { action(); setMenu(null); }} type="button">{label}</button>)}</div> : null}</div> : null}
        </div>;
      })}
    </section>) : <DataState action={<Button disabled={!all.length && !canAct} onClick={all.length ? () => { setKind("all"); setSearch(""); setShowInactive(false); } : () => { if (access.isCurrent()) setEditing("new"); }}>{all.length ? "Quitar filtros" : "Nueva categoría"}</Button>} description={all.length ? "Prueba con otro nombre o filtro." : "Crea una categoría para organizar tus movimientos."} title={all.length ? "Sin resultados" : "Aún no tienes categorías"} />}
    {editing && permitted ? <CategoryEditorDialog disabled={!canAct} categories={all} category={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={save} spendTypes={spendTypes.data ?? []} /> : null}
    {detail ? <Modal className={resourceEditorSurfaceClassName} labelledBy="category-detail-title" onClose={() => setDetail(null)}><ResourceEditorHeader onClose={() => setDetail(null)} title={detail.name} titleId="category-detail-title" /><ModalBody><p className="text-sm text-storm">{kindLabels[detail.kind]}{detail.parentName ? ` · Dentro de ${detail.parentName}` : ""}</p><div className="mt-6 divide-y divide-white/10 border-y border-white/10 text-sm">{[["Movimientos", detail.movementCount], ["Suscripciones", detail.subscriptionCount], ["Última actividad", detail.lastActivityAt ? formatDate(detail.lastActivityAt) : "Sin actividad"]].map(([label, value]) => <div className="flex min-h-[54px] items-center justify-between" key={label}><span className="text-storm">{label}</span><span className="text-ink">{value}</span></div>)}</div><button className="mt-5 flex w-full items-center justify-between text-sm text-storm hover:text-ink" onClick={() => { setAnalytics(detail); setDetail(null); }} type="button">Ver análisis completo <ChevronRight className="h-4 w-4" /></button></ModalBody><ModalFooter><Button className="w-full" onClick={() => { const target = detail; setDetail(null); if (canAct && access.isCurrent() && !target.isSystem) setEditing(target); }} variant="secondary">{detail.isSystem || !canAct ? "Cerrar" : "Editar categoría"}</Button></ModalFooter></Modal> : null}
    {analytics && snapshot.data?.workspace.id === activeWorkspace.id && !snapshot.isPlaceholderData && !snapshot.isFetching && !snapshot.isError ? <CategoryAnalyticsModal baseCurrencyCode={activeWorkspace.baseCurrencyCode} category={analytics} movements={snapshot.data.movements.filter(row => row.workspaceId === activeWorkspace.id)} onClose={() => setAnalytics(null)} /> : null}
    {deleteTarget && canAct ? <DeleteConfirmDialog badge="Eliminar categoría" description="Solo se eliminan categorías sin movimientos, suscripciones ni subcategorías. Puedes deshacerlo durante unos segundos." isDeleting={remove.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteWithUndo(deleteTarget)}><p className="text-lg font-semibold text-ink">{deleteTarget.name}</p></DeleteConfirmDialog> : null}
  </div>;
}
