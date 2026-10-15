import { useState } from "react";
import { Button } from "../../../components/ui/button";
import { searchChats, type StoredChat } from "../lib/chat-store";

export function AssistantChatsPanel({ chats, activeId, busy, onSelect, onRename, onRemove }: {
  chats: StoredChat[]; activeId: string; busy: boolean;
  onSelect: (id: string) => void; onRename: (id: string, title: string) => void; onRemove: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<string | null>(null), [title, setTitle] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  return <details className="border-b border-white/10 pb-4">
    <summary className="cursor-pointer text-sm font-medium text-ink">Conversaciones guardadas · {chats.length}</summary>
    <label className="mt-4 block text-xs text-storm">Buscar conversación<input aria-label="Buscar conversación" value={query} onChange={e => setQuery(e.target.value)} className="mt-2 h-11 w-full rounded-lg border border-white/10 bg-[#1a1917] px-3 text-sm text-ink" /></label>
    <ul className="mt-3 divide-y divide-white/10">{searchChats(chats, query).map(chat => <li className="py-3" key={chat.id}>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-current={chat.id === activeId ? "true" : undefined} disabled={busy} onClick={() => onSelect(chat.id)} className="min-w-0 flex-1 text-left text-sm text-ink underline-offset-4 hover:underline">{chat.title}{chat.id === activeId ? <span className="ml-2 text-xs text-storm">Actual</span> : null}</button>
        <button type="button" disabled={busy} aria-label={`Renombrar ${chat.title}`} onClick={() => { setEditing(chat.id); setTitle(chat.customTitle ?? chat.title); setDeleting(null); }} className="px-2 py-1 text-xs text-storm hover:text-ink">Renombrar</button>
        <button type="button" disabled={busy} aria-label={`Eliminar ${chat.title}`} onClick={() => { setDeleting(chat.id); setEditing(null); }} className="px-2 py-1 text-xs text-storm hover:text-ink">Eliminar</button>
      </div>
      {editing === chat.id ? <form className="mt-3 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); if (!busy) { onRename(chat.id, title); setEditing(null); } }}>
        <input aria-label="Nombre de conversación" value={title} maxLength={60} onChange={e => setTitle(e.target.value)} disabled={busy} className="h-11 min-w-0 flex-1 rounded-lg border border-white/10 bg-[#1a1917] px-3 text-sm text-ink" />
        <Button type="submit" disabled={busy}>Guardar nombre</Button><Button variant="ghost" disabled={busy} onClick={() => setEditing(null)}>Cancelar</Button>
      </form> : null}
      {deleting === chat.id ? <div className="mt-3 border-t border-white/10 pt-3" role="group" aria-label="Confirmar eliminación de conversación">
        <p className="mb-3 text-xs text-storm">Se eliminará este chat de este navegador. No se borran movimientos ni otros datos financieros.</p>
        <Button disabled={busy} onClick={() => { if (!busy) { onRemove(chat.id); setDeleting(null); } }}>Eliminar conversación</Button><Button disabled={busy} variant="ghost" onClick={() => setDeleting(null)}>Cancelar</Button>
      </div> : null}
    </li>)}</ul>
    {searchChats(chats, query).length === 0 ? <p className="mt-3 text-sm text-storm">{chats.length ? "No hay conversaciones que coincidan." : "Todavía no hay conversaciones guardadas en este espacio."}</p> : null}
    <p className="mt-3 text-xs text-storm">Hasta 20 conversaciones, solo texto. Permanecen en este navegador y se separan por usuario y espacio.</p>
  </details>;
}
