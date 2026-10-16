import { ChevronRight, MoreHorizontal, Pin, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { Modal, ModalFooter } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { useUndoQueue } from "../../../components/ui/undo-queue";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  getQueryErrorMessage, useArchiveCounterpartyMutation, useCounterpartiesOverviewQuery,
  useCreateCounterpartyMutation, useDeleteCounterpartyMutation, usePinCounterpartyMutation,
  useUpdateCounterpartyMutation, useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";
import type { CounterpartyOverview } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { canWriteWorkspaceCatalog, useCatalogWriteScope } from "../../shared/use-catalog-write-scope";
import { ContactAnalyticsModal } from "../components/contact-analytics-modal";
import { ContactEditorDialog, type ContactEditorValue } from "../components/contact-editor-dialog";
import { buildInitials, getRoleDefinition, getTypeDefinition, typeOptions } from "../lib/contacts-presenters";
import { contactExposure, contactMatchesFilters, contactWhatsAppUrl, type ContactFilter } from "../lib/contact-parity";
import { currencyTotals, type CurrencyAmount } from "../../../lib/analytics-money";

type TypeFilter = "all" | ContactFilter;
function canDelete(contact: CounterpartyOverview, subscriptions: number, recurringIncome: number) {
  return [contact.movementCount, contact.receivableCount, contact.payableCount, subscriptions, recurringIncome].every(count => Number.isSafeInteger(count) && count === 0);
}
function downloadContactCsv(rows: CounterpartyOverview[], links: Map<number, { subscriptions: number; income: number }>, exposure: Map<number, ReturnType<typeof contactExposure>>, baseCurrency: string) {
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const amounts = (items: CurrencyAmount[] | undefined) => (items ?? [{ amount: 0, currencyCode: baseCurrency }]).map((item) => formatCurrency(item.amount, item.currencyCode)).join(" · ");
  const headers = ["Nombre", "Tipo", "Telefono", "Email", "Documento", "Fijado", "Archivado", "Movimientos", "Por cobrar", "Por pagar", "Suscripciones", "Ingresos fijos", "Notas"];
  const csv = `\ufeff${[headers.join(","), ...rows.map((item) => [item.name, getTypeDefinition(item.type).label, item.phone, item.email, item.documentNumber, item.isPinned ? "Si" : "No", item.isArchived ? "Si" : "No", item.movementCount, amounts(exposure.get(item.id)?.receivable), amounts(exposure.get(item.id)?.payable), links.get(item.id)?.subscriptions ?? 0, links.get(item.id)?.income ?? 0, item.notes].map(escape).join(","))].join("\n")}`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `contactos-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
}

export function ContactsPage() {
  const auth = useAuth(), workspace = useActiveWorkspace();
  return <ScopedContactsPage key={`${auth.user?.id}:${workspace.activeWorkspace?.id}`} auth={auth} workspace={workspace} />;
}

function ScopedContactsPage({ auth, workspace }: { auth: ReturnType<typeof useAuth>; workspace: ReturnType<typeof useActiveWorkspace> }) {
  const { user, profile } = auth;
  const { activeWorkspace, isLoading: workspaceLoading, error: workspaceError } = workspace;
  const overview = useCounterpartiesOverviewQuery(activeWorkspace?.id, user?.id);
  const snapshot = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const create = useCreateCounterpartyMutation(activeWorkspace?.id, user?.id);
  const update = useUpdateCounterpartyMutation(activeWorkspace?.id, user?.id);
  const archive = useArchiveCounterpartyMutation(activeWorkspace?.id, user?.id);
  const pin = usePinCounterpartyMutation(activeWorkspace?.id, user?.id);
  const remove = useDeleteCounterpartyMutation(activeWorkspace?.id, user?.id);
  const { schedule, cancel } = useUndoQueue();
  const queued = useRef(new Set<string>());
  const deletions = useRef(new Set<number>());
  const locks = useRef(new Set<number | "new">());
  const [busy, setBusy] = useState(0);
  const [search, setSearch] = useState("");
  const [types, setTypes] = useState<ContactFilter[]>([]);
  const typeSelected = (type: TypeFilter) => type === "all" ? !types.length : types.includes(type);
  const setType = (type: TypeFilter) => setTypes((current) => type === "all" ? [] : current.includes(type) ? current.filter((value) => value !== type) : [...current, type]);
  const [showArchived, setShowArchived] = useState(false);
  const [menu, setMenu] = useState<number | "page" | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<CounterpartyOverview | "new" | null>(null);
  const [detailSelection, setDetail] = useState<CounterpartyOverview | null>(null);
  const [analyticsSelection, setAnalytics] = useState<CounterpartyOverview | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CounterpartyOverview | null>(null);
  const [bulkDelete, setBulkDelete] = useState(false);
  const [bulkArchive, setBulkArchive] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const all = useMemo(() => (overview.data ?? []).filter(item => item.workspaceId === activeWorkspace?.id), [overview.data, activeWorkspace?.id]);
  const rows = useRef(all); rows.current = all;
  const ready = Boolean(!workspaceLoading && !workspaceError && !workspace.isFetching && !workspace.isPlaceholderData && overview.isSuccess && !overview.isFetching && !overview.isPlaceholderData);
  const financialReady = Boolean(snapshot.isSuccess && !snapshot.error && !snapshot.isFetching && !snapshot.isPlaceholderData && snapshot.data?.workspace.id === activeWorkspace?.id && snapshot.data?.recurringIncomeAvailable !== false);
  const financial = financialReady ? snapshot.data : null;
  const access = useCatalogWriteScope(activeWorkspace, user?.id, ready);
  const deletionAccess = useCatalogWriteScope(activeWorkspace, user?.id, ready && financialReady);
  const permitted = canWriteWorkspaceCatalog(activeWorkspace, user?.id, true);
  const canAct = access.writable && busy === 0;
  const canRemove = deletionAccess.writable && busy === 0;
  useEffect(() => { if (!permitted) { setEditing(null); setDeleteTarget(null); setBulkArchive(false); setBulkDelete(false); } }, [permitted]);
  useEffect(() => () => { queued.current.forEach(id => cancel(id)); queued.current.clear(); }, [cancel]);
  useEffect(() => { if (!deletionAccess.writable) { queued.current.forEach(id => cancel(id)); queued.current.clear(); } }, [deletionAccess.writable, cancel]);
  const detail = all.find((item) => item.id === detailSelection?.id) ?? null;
  const analytics = all.find((item) => item.id === analyticsSelection?.id) ?? null;
  const links = useMemo(() => {
    const map = new Map<number, { subscriptions: number; income: number }>();
    for (const subscription of financial?.subscriptions ?? []) if (subscription.workspaceId === activeWorkspace?.id && subscription.vendorPartyId) { const current = map.get(subscription.vendorPartyId) ?? { subscriptions: 0, income: 0 }; current.subscriptions++; map.set(subscription.vendorPartyId, current); }
    for (const income of financial?.recurringIncome ?? []) if (income.workspaceId === activeWorkspace?.id && income.payerPartyId) { const current = map.get(income.payerPartyId) ?? { subscriptions: 0, income: 0 }; current.income++; map.set(income.payerPartyId, current); }
    return map;
  }, [financial, activeWorkspace?.id]);
  const currentLinks = useRef(links); currentLinks.current = links;
  const references = useMemo(() => new Set([...(financial?.movements ?? []), ...(financial?.obligations ?? [])]
    .filter(item => item.workspaceId === activeWorkspace?.id && item.counterpartyId != null).map(item => item.counterpartyId)), [financial, activeWorkspace?.id]);
  const currentReferences = useRef(references); currentReferences.current = references;
  function deletable(item: CounterpartyOverview) {
    const relations = currentLinks.current.get(item.id) ?? { subscriptions: 0, income: 0 };
    return !currentReferences.current.has(item.id) && canDelete(item, relations.subscriptions, relations.income);
  }
  const exposure = useMemo(() => {
    const obligations = (financial?.obligations ?? []).filter(item => item.workspaceId === activeWorkspace?.id);
    const ids = new Set(obligations.map((item) => item.counterpartyId).filter((id): id is number => id != null));
    return new Map([...ids].map((id) => [id, contactExposure(obligations, id, activeWorkspace?.baseCurrencyCode ?? "PEN")]));
  }, [financial, activeWorkspace?.id, activeWorkspace?.baseCurrencyCode]);
  const money = (amounts: CurrencyAmount[] | undefined) => financialReady ? (amounts ?? [{ amount: 0, currencyCode: activeWorkspace?.baseCurrencyCode ?? "PEN" }]).map((item) => formatCurrency(item.amount, item.currencyCode)).join(" · ") : "Por comprobar";
  function downloadCsv(rows: CounterpartyOverview[], contactLinks: Map<number, { subscriptions: number; income: number }>) {
    if (!financialReady || !ready) {
      setError("Espera a que se carguen los saldos completos antes de exportar.");
      return;
    }
    downloadContactCsv(rows, contactLinks, exposure, activeWorkspace?.baseCurrencyCode ?? "PEN");
  }
  const scheduled = (id: number, income: boolean) => {
    const items = income ? (financial?.recurringIncome ?? []).filter((item) => item.payerPartyId === id) : (financial?.subscriptions ?? []).filter((item) => item.vendorPartyId === id);
    return money(currencyTotals(items.filter((item) => item.workspaceId === activeWorkspace?.id && item.status === "active"), activeWorkspace?.baseCurrencyCode ?? "PEN"));
  };
  const visible = useMemo(() => all.filter((item) => {
    if (hiddenIds.has(item.id) || (!showArchived && item.isArchived)) return false;
    return contactMatchesFilters(item, types, search);
  }), [all, hiddenIds, showArchived, types, search]);
  const sections = useMemo(() => [
    { label: "Fijados", rows: visible.filter((item) => item.isPinned && !item.isArchived) },
    { label: "Contactos", rows: visible.filter((item) => !item.isPinned && !item.isArchived) },
    { label: "Archivados", rows: visible.filter((item) => item.isArchived) },
  ].filter((group) => group.rows.length), [visible]);

  function select(id: number) { setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function clearSelection() { setSelectionMode(false); setSelected(new Set()); }
  function currentItem(item: CounterpartyOverview) {
    access.assertCurrent();
    const current = rows.current.find(row => row.id === item.id && row.workspaceId === activeWorkspace?.id);
    if (!current) throw new Error("El contacto ya no está disponible en este espacio.");
    return current;
  }
  async function run(id: number | "new", action: () => Promise<unknown>) {
    access.assertCurrent();
    if (locks.current.has(id)) throw new Error("Este contacto ya tiene una operación pendiente.");
    locks.current.add(id); setBusy(locks.current.size);
    try { return await action(); } finally { locks.current.delete(id); setBusy(locks.current.size); }
  }
  async function save(value: ContactEditorValue) {
    access.assertCurrent();
    if (!activeWorkspace || !user?.id || !editing) throw new Error("No hay un espacio activo.");
    if (editing === "new") await run("new", () => create.mutateAsync({ ...value, workspaceId: activeWorkspace.id, userId: user.id }));
    else { const current = currentItem(editing); await run(current.id, () => update.mutateAsync({ ...value, counterpartyId: current.id, workspaceId: activeWorkspace.id, userId: user.id })); }
  }
  async function setArchived(item: CounterpartyOverview, isArchived: boolean) {
    try { const current = currentItem(item); if (!activeWorkspace || !user?.id || current.isArchived === isArchived) return;
      await run(current.id, () => archive.mutateAsync({ counterpartyId: current.id, workspaceId: activeWorkspace.id, userId: user.id, isArchived })); }
    catch (cause) { if (access.isCurrent()) setError(getQueryErrorMessage(cause)); }
  }
  async function togglePin(item: CounterpartyOverview) {
    try { const current = currentItem(item); await run(current.id, () => pin.mutateAsync({ counterpartyId: current.id, isPinned: !current.isPinned })); }
    catch (cause) { if (access.isCurrent()) setError(getQueryErrorMessage(cause)); }
  }
  function deleteWithUndo(item: CounterpartyOverview) {
    const current = rows.current.find(row => row.id === item.id && row.workspaceId === activeWorkspace?.id);
    if (!activeWorkspace || !deletionAccess.isCurrent() || !current || !deletable(current) || deletions.current.has(item.id)) return;
    deletions.current.add(item.id);
    setHiddenIds((current) => new Set(current).add(item.id)); setDeleteTarget(null); setMenu(null);
    let resolved = false;
    const restore = () => { deletions.current.delete(item.id); setHiddenIds(current => { const next = new Set(current); next.delete(item.id); return next; }); };
    const id = schedule({ label: `${item.name} pendiente de eliminar`, onCommit: async () => {
      if (resolved) return; resolved = true; queued.current.delete(id);
      try { deletionAccess.assertCurrent(); const current = currentItem(item);
        if (!deletable(current)) throw new Error("El contacto tiene relaciones nuevas. No se eliminó.");
        await run(current.id, () => remove.mutateAsync({ counterpartyId: current.id, workspaceId: activeWorkspace.id })); deletions.current.delete(item.id); }
      catch (cause) { restore(); if (access.isCurrent()) setError(getQueryErrorMessage(cause)); }
    }, onUndo: () => { if (resolved) return; resolved = true; queued.current.delete(id); restore(); } });
    queued.current.add(id);
  }
  function linked(item: CounterpartyOverview) { return links.get(item.id) ?? { subscriptions: 0, income: 0 }; }

  if (workspaceLoading || overview.isLoading) return <DataState title="Contactos" description="Cargando contactos…" />;
  if (workspaceError || overview.error) return <DataState title="No se pudieron cargar los contactos" description={getQueryErrorMessage(workspaceError ?? overview.error)} tone="error" />;
  if (!activeWorkspace) return <DataState title="Sin espacio activo" description="Activa un espacio para gestionar tus contactos." />;

  return <div className="pb-10">
    <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-6">
      <div><h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-ink">Contactos</h1><p className="mt-1 text-sm text-storm">{all.length} registrados · {all.filter((item) => !item.isArchived).length} activos</p></div>
      <div className="flex items-center gap-2"><Button disabled={!canAct} onClick={() => { if (access.isCurrent()) setEditing("new"); }}><Plus className="h-4 w-4" /> Nuevo contacto</Button>
        <div className="relative"><button aria-label="Más acciones" aria-expanded={menu === "page"} className="grid h-11 w-11 place-items-center rounded-[10px] border border-white/10 text-storm hover:text-ink" onClick={() => setMenu(menu === "page" ? null : "page")} type="button"><MoreHorizontal className="h-4 w-4" /></button>
          {menu === "page" ? <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-white/10 bg-[#211f1c] p-1"><button disabled={!ready || !financialReady} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-storm hover:bg-white/[0.05] disabled:opacity-40" onClick={() => { downloadCsv(visible, links); setMenu(null); }} type="button">Exportar CSV</button><button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-storm hover:bg-white/[0.05]" onClick={() => { setSelectionMode(true); setMenu(null); }} type="button">Seleccionar varios</button></div> : null}
        </div>
      </div>
    </header>
    {!permitted ? <p className="mt-4 text-sm text-storm" role="status">{activeWorkspace.isArchived ? "Este espacio está archivado." : "Tu acceso es de solo lectura."} Puedes consultar, filtrar y exportar los contactos, pero no modificarlos.</p> : !ready ? <p className="mt-4 text-sm text-storm" role="status">Comprobando datos y permisos antes de permitir cambios…</p> : null}
    {!financialReady ? <p className="mt-3 text-sm text-storm" role="status">{snapshot.error || snapshot.data?.recurringIncomeAvailable === false ? "No pudimos comprobar todas las relaciones y saldos." : "Comprobando las relaciones y saldos del espacio…"} No se permite eliminar ni exportar importes incompletos.</p> : null}
    {error ? <p className="mt-4 text-sm text-[#e6b7aa]" role="alert">{error} <button className="underline" onClick={() => setError(null)} type="button">Cerrar</button></p> : null}
    <div className="mt-6 flex flex-wrap gap-2">{([{ value: "all", label: "Todos" }, { value: "pinned", label: "Fijados" }, ...typeOptions] as { value: TypeFilter; label: string }[]).map((option) => <button aria-pressed={typeSelected(option.value)} className={`h-10 rounded-[10px] border px-4 text-sm ${typeSelected(option.value) ? "border-white/30 bg-white/[0.08] text-ink" : "border-white/10 text-storm hover:text-ink"}`} key={option.value} onClick={() => setType(option.value)} type="button">{option.label}</button>)}</div>
    <div className="mt-3 flex gap-2"><label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-white/10 bg-[#1a1917] px-4 text-storm"><Search className="h-4 w-4" /><input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-storm/70" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contactos…" value={search} /></label><button aria-pressed={showArchived} className={`rounded-[10px] border px-4 text-sm ${showArchived ? "border-white/30 text-ink" : "border-white/10 text-storm"}`} onClick={() => setShowArchived(!showArchived)} type="button">Archivados</button></div>
    <div className="mt-5 flex items-center justify-between border-y border-white/[0.08] py-3 text-sm text-storm"><span>{visible.length === all.length ? `${visible.length} contactos` : `${visible.length} de ${all.length} contactos`}</span><span>{financialReady ? `${visible.filter((item) => item.movementCount || item.receivableCount || item.payableCount || linked(item).subscriptions || linked(item).income).length} con actividad o compromisos` : "Relaciones por comprobar"}</span></div>
    {selectionMode ? <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-white/10 pb-3 text-sm"><button className="text-storm hover:text-ink" onClick={clearSelection} type="button">Cancelar</button><span className="text-ink">{selected.size} seleccionados</span><button className="text-storm hover:text-ink" onClick={() => setSelected(new Set(visible.map((item) => item.id)))} type="button">Seleccionar todos</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size || !ready || !financialReady} onClick={() => downloadCsv(visible.filter((item) => selected.has(item.id)), links)} type="button">CSV</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size || !canAct} onClick={() => { if (access.isCurrent()) setBulkArchive(true); }} type="button">Archivar</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size || !canRemove} onClick={() => { if (deletionAccess.isCurrent()) setBulkDelete(true); }} type="button">Eliminar sin relaciones</button></div> : null}
    {sections.length ? sections.map(section => <section className="mt-7" key={section.label}>
      <h2 className="mb-2 font-public-mono text-xs uppercase tracking-[0.16em] text-storm">{section.label} · {section.rows.length}</h2>
      {section.rows.map(item => {
        const actions: [string, () => void][] = [["Ver detalle", () => setDetail(item)]];
        if (canAct) actions.unshift([item.isPinned ? "Desfijar" : "Fijar", () => void togglePin(item)]);
        if (canAct) actions.push(["Editar", () => { if (access.isCurrent()) setEditing(item); }], [item.isArchived ? "Restaurar" : "Archivar", () => void setArchived(item, !item.isArchived)]);
        if (canRemove && deletable(item)) actions.push(["Eliminar", () => { if (deletionAccess.isCurrent()) setDeleteTarget(item); }]);
        return <div className="relative flex min-h-[68px] items-center gap-3 border-b border-white/[0.08]" key={item.id}>
          {selectionMode ? <input aria-label={`Seleccionar ${item.name}`} checked={selected.has(item.id)} className="h-4 w-4 accent-[#e9e3d9]" onChange={() => select(item.id)} type="checkbox" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/10 text-xs font-semibold text-storm">{buildInitials(item.name)}</span>}
          <button className="min-w-0 flex-1 py-3 text-left" onClick={() => selectionMode ? select(item.id) : setDetail(item)} type="button"><span className="flex items-center gap-2 text-sm font-semibold text-ink">{item.name}{item.isPinned ? <Pin className="h-3 w-3 text-storm" /> : null}</span><span className="mt-0.5 block text-xs text-storm">{getTypeDefinition(item.type).label}{item.isArchived ? " · Archivado" : ""}{item.movementCount ? ` · ${item.movementCount} movimientos` : ""}</span></button>
          <span className="hidden shrink-0 text-xs text-storm sm:block">{item.receivableCount || item.payableCount ? `${item.receivableCount + item.payableCount} créditos/deudas` : ""}</span>
          {!selectionMode ? <div className="relative"><button aria-label={`Acciones de ${item.name}`} className="grid h-9 w-9 place-items-center text-storm hover:text-ink" onClick={() => setMenu(menu === item.id ? null : item.id)} type="button"><MoreHorizontal className="h-4 w-4" /></button>{menu === item.id ? <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-white/10 bg-[#211f1c] p-1">{actions.map(([label, action]) => <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-storm hover:bg-white/[0.05] hover:text-ink" key={label} onClick={() => { action(); setMenu(null); }} type="button">{label}</button>)}</div> : null}</div> : null}
        </div>;
      })}
    </section>) : <DataState action={<Button disabled={!all.length && !canAct} onClick={all.length ? () => { setType("all"); setSearch(""); setShowArchived(false); } : () => { if (access.isCurrent()) setEditing("new"); }}>{all.length ? "Quitar filtros" : "Nuevo contacto"}</Button>} description={all.length ? "Prueba con otro nombre o filtro." : "Agrega personas o empresas para usarlas en tus movimientos."} title={all.length ? "Sin resultados" : "Aún no tienes contactos"} />}
    {editing && permitted ? <ContactEditorDialog disabled={!canAct} contact={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={save} /> : null}
    {detail ? <Modal className={resourceEditorSurfaceClassName} labelledBy="contact-detail-title" onClose={() => setDetail(null)}>
      <ResourceEditorHeader onClose={() => setDetail(null)} title={detail.name} titleId="contact-detail-title" />
      <ModalBody><p className="text-sm text-storm">{getTypeDefinition(detail.type).label}{detail.roles.length ? ` · ${detail.roles.map((role) => getRoleDefinition(role).label).join(", ")}` : ""}</p>
        <div className="mt-6 divide-y divide-white/10 border-y border-white/10 text-sm">{[["Movimientos", detail.movementCount], ["Por cobrar", money(exposure.get(detail.id)?.receivable)], ["Por pagar", money(exposure.get(detail.id)?.payable)], ["Suscripciones", financialReady ? linked(detail).subscriptions : "Por comprobar"], ["Ingresos fijos", financialReady ? linked(detail).income : "Por comprobar"], ["Pagos programados activos", scheduled(detail.id, false)], ["Ingresos programados activos", scheduled(detail.id, true)]].map(([label, value]) => <div className="flex min-h-[54px] items-center justify-between" key={label}><span className="text-storm">{label}</span><span className="text-ink">{value}</span></div>)}</div>
        {detail.phone ? <a className="mt-5 block text-sm text-storm underline hover:text-ink" href={`tel:${detail.phone.replace(/[^+\d]/g, "")}`}>Llamar · {detail.phone}</a> : null}
        {detail.phone && contactWhatsAppUrl(detail.phone) ? <a className="mt-3 block text-sm text-storm underline hover:text-ink" href={contactWhatsAppUrl(detail.phone)!} rel="noopener noreferrer" target="_blank">WhatsApp</a> : null}
        {detail.email ? <a className="mt-3 block text-sm text-storm underline hover:text-ink" href={`mailto:${detail.email}`}>Escribir · {detail.email}</a> : null}
        {detail.notes ? <p className="mt-5 whitespace-pre-wrap text-sm text-storm">{detail.notes}</p> : null}
        <button disabled={!financialReady || !ready} className="mt-6 flex w-full items-center justify-between text-sm text-storm hover:text-ink disabled:opacity-40" onClick={() => { setAnalytics(detail); setDetail(null); }} type="button">Ver análisis completo <ChevronRight className="h-4 w-4" /></button>
      </ModalBody>
      <ModalFooter><Button className="w-full" onClick={() => { const target = detail; setDetail(null); if (canAct && access.isCurrent()) setEditing(target); }} variant="secondary">{canAct ? "Editar contacto" : "Cerrar"}</Button></ModalFooter>
    </Modal> : null}
    {analytics && financial ? <ContactAnalyticsModal baseCurrencyCode={activeWorkspace.baseCurrencyCode} contact={{ ...analytics, receivablePending: exposure.get(analytics.id)?.receivable ?? [{ amount: 0, currencyCode: activeWorkspace.baseCurrencyCode }], payablePending: exposure.get(analytics.id)?.payable ?? [{ amount: 0, currencyCode: activeWorkspace.baseCurrencyCode }] }} movements={financial.movements.filter(item => item.workspaceId === activeWorkspace.id)} onClose={() => setAnalytics(null)} /> : null}
    {deleteTarget && canRemove ? <DeleteConfirmDialog badge="Eliminar contacto" description="Solo se eliminan contactos sin movimientos ni compromisos. Puedes deshacerlo durante unos segundos." isDeleting={remove.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteWithUndo(deleteTarget)}><p className="text-lg font-semibold text-ink">{deleteTarget.name}</p></DeleteConfirmDialog> : null}
    {bulkArchive && canAct ? <DeleteConfirmDialog badge="Archivar contactos" description={`Se intentará archivar los contactos activos seleccionados; podrás restaurarlos después.`} isDeleting={archive.isPending} onCancel={() => setBulkArchive(false)} onConfirm={() => { if (!access.isCurrent()) return; void Promise.all(visible.filter((item) => selected.has(item.id) && !item.isArchived).map((item) => setArchived(item, true))); setBulkArchive(false); clearSelection(); }}><p className="text-lg font-semibold text-ink">{selected.size} seleccionados</p></DeleteConfirmDialog> : null}
    {bulkDelete && canRemove ? <DeleteConfirmDialog badge="Eliminar contactos" description="Solo se eliminarán los que no tengan movimientos, créditos, deudas, suscripciones ni ingresos fijos." isDeleting={remove.isPending} onCancel={() => setBulkDelete(false)} onConfirm={() => { if (!deletionAccess.isCurrent()) return; visible.filter((item) => selected.has(item.id) && deletable(item)).forEach(deleteWithUndo); setBulkDelete(false); clearSelection(); }}><p className="text-lg font-semibold text-ink">{selected.size} seleccionados</p></DeleteConfirmDialog> : null}
  </div>;
}
