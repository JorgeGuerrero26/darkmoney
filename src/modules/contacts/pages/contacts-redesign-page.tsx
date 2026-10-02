import { ChevronRight, MoreHorizontal, Pin, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

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
import { ContactAnalyticsModal } from "../components/contact-analytics-modal";
import { ContactEditorDialog, type ContactEditorValue } from "../components/contact-editor-dialog";
import { buildInitials, getRoleDefinition, getTypeDefinition, typeOptions } from "../lib/contacts-presenters";
import { contactExposure, contactMatchesFilters, contactWhatsAppUrl, type ContactFilter } from "../lib/contact-parity";
import { currencyTotals, type CurrencyAmount } from "../../../lib/analytics-money";

type TypeFilter = "all" | ContactFilter;
function canDelete(contact: CounterpartyOverview, subscriptions: number, recurringIncome: number) {
  return !contact.movementCount && !contact.receivableCount && !contact.payableCount && !subscriptions && !recurringIncome;
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
  const { user, profile } = useAuth();
  const { activeWorkspace, isLoading: workspaceLoading, error: workspaceError } = useActiveWorkspace();
  const overview = useCounterpartiesOverviewQuery(activeWorkspace?.id);
  const snapshot = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const create = useCreateCounterpartyMutation(activeWorkspace?.id, user?.id);
  const update = useUpdateCounterpartyMutation(activeWorkspace?.id, user?.id);
  const archive = useArchiveCounterpartyMutation(activeWorkspace?.id, user?.id);
  const pin = usePinCounterpartyMutation(activeWorkspace?.id, user?.id);
  const remove = useDeleteCounterpartyMutation(activeWorkspace?.id, user?.id);
  const { schedule } = useUndoQueue();
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
  const all = overview.data ?? [];
  const detail = all.find((item) => item.id === detailSelection?.id) ?? null;
  const analytics = all.find((item) => item.id === analyticsSelection?.id) ?? null;
  const links = useMemo(() => {
    const map = new Map<number, { subscriptions: number; income: number }>();
    for (const subscription of snapshot.data?.subscriptions ?? []) if (subscription.vendorPartyId) { const current = map.get(subscription.vendorPartyId) ?? { subscriptions: 0, income: 0 }; current.subscriptions++; map.set(subscription.vendorPartyId, current); }
    for (const income of snapshot.data?.recurringIncome ?? []) if (income.payerPartyId) { const current = map.get(income.payerPartyId) ?? { subscriptions: 0, income: 0 }; current.income++; map.set(income.payerPartyId, current); }
    return map;
  }, [snapshot.data]);
  const exposure = useMemo(() => {
    const obligations = snapshot.data?.obligations ?? [];
    const ids = new Set(obligations.map((item) => item.counterpartyId).filter((id): id is number => id != null));
    return new Map([...ids].map((id) => [id, contactExposure(obligations, id, activeWorkspace?.baseCurrencyCode ?? "PEN")]));
  }, [snapshot.data, activeWorkspace?.baseCurrencyCode]);
  const money = (amounts: CurrencyAmount[] | undefined) => (amounts ?? [{ amount: 0, currencyCode: activeWorkspace?.baseCurrencyCode ?? "PEN" }]).map((item) => formatCurrency(item.amount, item.currencyCode)).join(" · ");
  function downloadCsv(rows: CounterpartyOverview[], contactLinks: Map<number, { subscriptions: number; income: number }>) {
    if (!snapshot.data || snapshot.error) {
      setError("Espera a que se carguen los saldos completos antes de exportar.");
      return;
    }
    downloadContactCsv(rows, contactLinks, exposure, activeWorkspace?.baseCurrencyCode ?? "PEN");
  }
  const scheduled = (id: number, income: boolean) => {
    const items = income ? (snapshot.data?.recurringIncome ?? []).filter((item) => item.payerPartyId === id) : (snapshot.data?.subscriptions ?? []).filter((item) => item.vendorPartyId === id);
    return money(currencyTotals(items.filter((item) => item.status === "active"), activeWorkspace?.baseCurrencyCode ?? "PEN"));
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
  async function save(value: ContactEditorValue) {
    if (!activeWorkspace || !user?.id) throw new Error("No hay un espacio activo.");
    if (editing === "new") await create.mutateAsync({ ...value, workspaceId: activeWorkspace.id, userId: user.id });
    else if (editing) await update.mutateAsync({ ...value, counterpartyId: editing.id, workspaceId: activeWorkspace.id, userId: user.id });
  }
  async function setArchived(item: CounterpartyOverview, isArchived: boolean) {
    if (!activeWorkspace || !user?.id) return;
    try { await archive.mutateAsync({ counterpartyId: item.id, workspaceId: activeWorkspace.id, userId: user.id, isArchived }); }
    catch (cause) { setError(getQueryErrorMessage(cause)); }
  }
  async function togglePin(item: CounterpartyOverview) {
    try { await pin.mutateAsync({ counterpartyId: item.id, isPinned: !item.isPinned }); }
    catch (cause) { setError(getQueryErrorMessage(cause)); }
  }
  function deleteWithUndo(item: CounterpartyOverview) {
    if (!activeWorkspace) return;
    setHiddenIds((current) => new Set(current).add(item.id)); setDeleteTarget(null); setMenu(null);
    schedule({ label: `${item.name} eliminado`, onCommit: () => remove.mutateAsync({ counterpartyId: item.id, workspaceId: activeWorkspace.id }).catch((cause: unknown) => setError(getQueryErrorMessage(cause))), onUndo: () => setHiddenIds((current) => { const next = new Set(current); next.delete(item.id); return next; }) });
  }
  function linked(item: CounterpartyOverview) { return links.get(item.id) ?? { subscriptions: 0, income: 0 }; }

  if (workspaceLoading || overview.isLoading) return <DataState title="Contactos" description="Cargando contactos…" />;
  if (workspaceError || overview.error) return <DataState title="No se pudieron cargar los contactos" description={getQueryErrorMessage(workspaceError ?? overview.error)} tone="error" />;
  if (!activeWorkspace) return <DataState title="Sin espacio activo" description="Activa un espacio para gestionar tus contactos." />;

  return <div className="pb-10">
    <header className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-6"><div><h1 className="font-display text-[1.75rem] font-semibold tracking-[-0.03em] text-ink">Contactos</h1><p className="mt-1 text-sm text-storm">{all.length} registrados · {all.filter((item) => !item.isArchived).length} activos</p></div><div className="flex items-center gap-2"><Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Nuevo contacto</Button><div className="relative"><button aria-label="Más acciones" aria-expanded={menu === "page"} className="grid h-11 w-11 place-items-center rounded-[10px] border border-white/10 text-storm hover:text-ink" onClick={() => setMenu(menu === "page" ? null : "page")} type="button"><MoreHorizontal className="h-4 w-4" /></button>{menu === "page" ? <div className="absolute right-0 top-12 z-20 w-48 rounded-xl border border-white/10 bg-[#211f1c] p-1"><button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-storm hover:bg-white/[0.05]" onClick={() => { downloadCsv(visible, links); setMenu(null); }} type="button">Exportar CSV</button><button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-storm hover:bg-white/[0.05]" onClick={() => { setSelectionMode(true); setMenu(null); }} type="button">Seleccionar varios</button></div> : null}</div></div></header>
    {error ? <p className="mt-4 text-sm text-[#e6b7aa]" role="alert">{error} <button className="underline" onClick={() => setError(null)} type="button">Cerrar</button></p> : null}
    <div className="mt-6 flex flex-wrap gap-2">{([{ value: "all", label: "Todos" }, { value: "pinned", label: "Fijados" }, ...typeOptions] as { value: TypeFilter; label: string }[]).map((option) => <button aria-pressed={typeSelected(option.value)} className={`h-10 rounded-[10px] border px-4 text-sm ${typeSelected(option.value) ? "border-white/30 bg-white/[0.08] text-ink" : "border-white/10 text-storm hover:text-ink"}`} key={option.value} onClick={() => setType(option.value)} type="button">{option.label}</button>)}</div>
    <div className="mt-3 flex gap-2"><label className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-[10px] border border-white/10 bg-[#1a1917] px-4 text-storm"><Search className="h-4 w-4" /><input className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-storm/70" onChange={(event) => setSearch(event.target.value)} placeholder="Buscar contactos…" value={search} /></label><button aria-pressed={showArchived} className={`rounded-[10px] border px-4 text-sm ${showArchived ? "border-white/30 text-ink" : "border-white/10 text-storm"}`} onClick={() => setShowArchived(!showArchived)} type="button">Archivados</button></div>
    <div className="mt-5 flex items-center justify-between border-y border-white/[0.08] py-3 text-sm text-storm"><span>{visible.length === all.length ? `${visible.length} contactos` : `${visible.length} de ${all.length} contactos`}</span><span>{visible.filter((item) => item.movementCount || item.receivableCount || item.payableCount || linked(item).subscriptions || linked(item).income).length} con actividad o compromisos</span></div>
    {selectionMode ? <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-white/10 pb-3 text-sm"><button className="text-storm hover:text-ink" onClick={clearSelection} type="button">Cancelar</button><span className="text-ink">{selected.size} seleccionados</span><button className="text-storm hover:text-ink" onClick={() => setSelected(new Set(visible.map((item) => item.id)))} type="button">Seleccionar todos</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size} onClick={() => downloadCsv(visible.filter((item) => selected.has(item.id)), links)} type="button">CSV</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size} onClick={() => setBulkArchive(true)} type="button">Archivar</button><button className="text-storm hover:text-ink disabled:opacity-40" disabled={!selected.size} onClick={() => setBulkDelete(true)} type="button">Eliminar sin relaciones</button></div> : null}
    {sections.length ? sections.map((section) => <section className="mt-7" key={section.label}><h2 className="mb-2 font-public-mono text-xs uppercase tracking-[0.16em] text-storm">{section.label} · {section.rows.length}</h2>{section.rows.map((item) => <div className="relative flex min-h-[68px] items-center gap-3 border-b border-white/[0.08]" key={item.id}>{selectionMode ? <input aria-label={`Seleccionar ${item.name}`} checked={selected.has(item.id)} className="h-4 w-4 accent-[#e9e3d9]" onChange={() => select(item.id)} type="checkbox" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-white/10 text-xs font-semibold text-storm">{buildInitials(item.name)}</span>}<button className="min-w-0 flex-1 py-3 text-left" onClick={() => selectionMode ? select(item.id) : setDetail(item)} type="button"><span className="flex items-center gap-2 text-sm font-semibold text-ink">{item.name}{item.isPinned ? <Pin className="h-3 w-3 text-storm" /> : null}</span><span className="mt-0.5 block text-xs text-storm">{getTypeDefinition(item.type).label}{item.isArchived ? " · Archivado" : ""}{item.movementCount ? ` · ${item.movementCount} movimientos` : ""}</span></button><span className="hidden shrink-0 text-xs text-storm sm:block">{item.receivableCount || item.payableCount ? `${item.receivableCount + item.payableCount} créditos/deudas` : ""}</span>{!selectionMode ? <div className="relative"><button aria-label={`Acciones de ${item.name}`} className="grid h-9 w-9 place-items-center text-storm hover:text-ink" onClick={() => setMenu(menu === item.id ? null : item.id)} type="button"><MoreHorizontal className="h-4 w-4" /></button>{menu === item.id ? <div className="absolute right-0 top-9 z-20 w-44 rounded-xl border border-white/10 bg-[#211f1c] p-1">{([[item.isPinned ? "Desfijar" : "Fijar", () => void togglePin(item)], ["Ver detalle", () => setDetail(item)], ["Editar", () => setEditing(item)], [item.isArchived ? "Restaurar" : "Archivar", () => void setArchived(item, !item.isArchived)], ...(canDelete(item, linked(item).subscriptions, linked(item).income) ? [["Eliminar", () => setDeleteTarget(item)]] : [])] as [string, () => void][]).map(([label, action]) => <button className="block w-full rounded-lg px-3 py-2 text-left text-sm text-storm hover:bg-white/[0.05] hover:text-ink" key={label} onClick={() => { action(); setMenu(null); }} type="button">{label}</button>)}</div> : null}</div> : null}</div>)}</section>) : <DataState action={<Button onClick={all.length ? () => { setType("all"); setSearch(""); setShowArchived(false); } : () => setEditing("new")}>{all.length ? "Quitar filtros" : "Nuevo contacto"}</Button>} description={all.length ? "Prueba con otro nombre o filtro." : "Agrega personas o empresas para usarlas en tus movimientos."} title={all.length ? "Sin resultados" : "Aún no tienes contactos"} />}
    {editing ? <ContactEditorDialog contact={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSave={save} /> : null}
    {detail ? <Modal className={resourceEditorSurfaceClassName} labelledBy="contact-detail-title" onClose={() => setDetail(null)}><ResourceEditorHeader onClose={() => setDetail(null)} title={detail.name} titleId="contact-detail-title" /><ModalBody><p className="text-sm text-storm">{getTypeDefinition(detail.type).label}{detail.roles.length ? ` · ${detail.roles.map((role) => getRoleDefinition(role).label).join(", ")}` : ""}</p><div className="mt-6 divide-y divide-white/10 border-y border-white/10 text-sm">{[["Movimientos", detail.movementCount], ["Por cobrar", money(exposure.get(detail.id)?.receivable)], ["Por pagar", money(exposure.get(detail.id)?.payable)], ["Suscripciones", linked(detail).subscriptions], ["Ingresos fijos", linked(detail).income], ["Pagos programados activos", scheduled(detail.id, false)], ["Ingresos programados activos", scheduled(detail.id, true)]].map(([label, value]) => <div className="flex min-h-[54px] items-center justify-between" key={label}><span className="text-storm">{label}</span><span className="text-ink">{value}</span></div>)}</div>{detail.phone ? <a className="mt-5 block text-sm text-storm underline hover:text-ink" href={`tel:${detail.phone.replace(/[^+\d]/g, "")}`}>Llamar · {detail.phone}</a> : null}{detail.phone && contactWhatsAppUrl(detail.phone) ? <a className="mt-3 block text-sm text-storm underline hover:text-ink" href={contactWhatsAppUrl(detail.phone)!} rel="noopener noreferrer" target="_blank">WhatsApp</a> : null}{detail.email ? <a className="mt-3 block text-sm text-storm underline hover:text-ink" href={`mailto:${detail.email}`}>Escribir · {detail.email}</a> : null}{detail.notes ? <p className="mt-5 whitespace-pre-wrap text-sm text-storm">{detail.notes}</p> : null}<button className="mt-6 flex w-full items-center justify-between text-sm text-storm hover:text-ink" onClick={() => { setAnalytics(detail); setDetail(null); }} type="button">Ver análisis completo <ChevronRight className="h-4 w-4" /></button></ModalBody><ModalFooter><Button className="w-full" onClick={() => { const target = detail; setDetail(null); setEditing(target); }} variant="secondary">Editar contacto</Button></ModalFooter></Modal> : null}
    {analytics && snapshot.data ? <ContactAnalyticsModal baseCurrencyCode={activeWorkspace.baseCurrencyCode} contact={{ ...analytics, receivablePending: exposure.get(analytics.id)?.receivable ?? [{ amount: 0, currencyCode: activeWorkspace.baseCurrencyCode }], payablePending: exposure.get(analytics.id)?.payable ?? [{ amount: 0, currencyCode: activeWorkspace.baseCurrencyCode }] }} movements={snapshot.data.movements} onClose={() => setAnalytics(null)} /> : null}
    {deleteTarget ? <DeleteConfirmDialog badge="Eliminar contacto" description="Solo se eliminan contactos sin movimientos ni compromisos. Puedes deshacerlo durante unos segundos." isDeleting={remove.isPending} onCancel={() => setDeleteTarget(null)} onConfirm={() => deleteWithUndo(deleteTarget)}><p className="text-lg font-semibold text-ink">{deleteTarget.name}</p></DeleteConfirmDialog> : null}
    {bulkArchive ? <DeleteConfirmDialog badge="Archivar contactos" description={`Se archivarán ${selected.size} contactos; podrás restaurarlos después.`} isDeleting={archive.isPending} onCancel={() => setBulkArchive(false)} onConfirm={() => { void Promise.all(visible.filter((item) => selected.has(item.id) && !item.isArchived).map((item) => setArchived(item, true))); setBulkArchive(false); clearSelection(); }}><p className="text-lg font-semibold text-ink">{selected.size} seleccionados</p></DeleteConfirmDialog> : null}
    {bulkDelete ? <DeleteConfirmDialog badge="Eliminar contactos" description="Solo se eliminarán los que no tengan movimientos, créditos, deudas, suscripciones ni ingresos fijos." isDeleting={remove.isPending} onCancel={() => setBulkDelete(false)} onConfirm={() => { visible.filter((item) => selected.has(item.id) && canDelete(item, linked(item).subscriptions, linked(item).income)).forEach(deleteWithUndo); setBulkDelete(false); clearSelection(); }}><p className="text-lg font-semibold text-ink">{selected.size} seleccionados</p></DeleteConfirmDialog> : null}
  </div>;
}
