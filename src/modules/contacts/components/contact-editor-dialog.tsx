import { Check, ChevronRight } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "../../../components/ui/button";
import { Modal, ModalFooter } from "../../../components/ui/modal";
import { ModalBody } from "../../../components/ui/modal-body";
import { ResourceEditorHeader, resourceEditorSurfaceClassName } from "../../../components/ui/resource-editor";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import type { CounterpartyOverview, CounterpartyRoleType } from "../../../types/domain";
import { roleOptions, typeOptions } from "../lib/contacts-presenters";

export type ContactEditorValue = {
  name: string; type: CounterpartyOverview["type"]; phone: string; email: string;
  documentNumber: string; notes: string; roles: CounterpartyRoleType[];
};

export function initialContactValue(contact?: CounterpartyOverview): ContactEditorValue {
  return { name: contact?.name ?? "", type: contact?.type ?? "person", phone: contact?.phone ?? "", email: contact?.email ?? "", documentNumber: contact?.documentNumber ?? "", notes: contact?.notes ?? "", roles: [...(contact?.roles ?? [])] };
}

const field = "mt-2 h-12 w-full rounded-[10px] border border-white/10 bg-[#141311] px-4 text-sm text-ink outline-none placeholder:text-storm/60 focus:border-white/40";

export function ContactEditorDialog({ contact, onClose, onSave, disabled = false }: {
  contact: CounterpartyOverview | null; onClose: () => void; onSave: (value: ContactEditorValue) => Promise<void>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(() => initialContactValue(contact ?? undefined));
  const [panel, setPanel] = useState<"main" | "type" | "details" | "roles">("main");
  const [dirty, setDirty] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const patch = (next: Partial<ContactEditorValue>) => { setValue((current) => ({ ...current, ...next })); setDirty(true); setError(null); };
  const requestClose = () => dirty ? setDiscardOpen(true) : onClose();
  const typeLabel = typeOptions.find((option) => option.value === value.type)?.label ?? "Otro";
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current || disabled) return;
    if (!value.name.trim()) { setError("Escribe el nombre del contacto."); return; }
    savingRef.current = true; setSaving(true);
    try { await onSave({ ...value, name: value.name.trim() }); setDirty(false); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar el contacto."); }
    finally { savingRef.current = false; setSaving(false); }
  }
  const optionRow = "flex min-h-[54px] w-full items-center justify-between gap-3 border-b border-white/10 px-4 text-left text-sm last:border-0 hover:bg-white/[0.03]";
  return <>
    <Modal className={resourceEditorSurfaceClassName} disableOutsideClose={saving} labelledBy="contact-editor-title" onClose={requestClose}>
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(event) => void submit(event)}>
        <ResourceEditorHeader disabled={saving} onBack={panel === "main" ? undefined : () => setPanel("main")} onClose={requestClose} title={panel === "main" ? contact ? "Editar contacto" : "Nuevo contacto" : panel === "type" ? "Tipo de contacto" : panel === "roles" ? "Roles" : "Datos opcionales"} titleId="contact-editor-title" />
        <ModalBody className="!px-5 !py-5 sm:!px-6">
          {error ? <p className="mb-4 text-sm text-[#e6b7aa]" role="alert">{error}</p> : null}
          {panel === "main" ? <div className="space-y-5">
            <label className="block text-xs uppercase tracking-[0.12em] text-storm">Nombre<input autoFocus className={field} maxLength={120} onChange={(event) => patch({ name: event.target.value })} placeholder="Nombre completo o razón social" value={value.name} /></label>
            <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]"><button className={optionRow} onClick={() => setPanel("type")} type="button"><span className="font-medium text-ink">Tipo</span><span className="flex items-center gap-2 text-storm">{typeLabel} <ChevronRight className="h-4 w-4" /></span></button><button className={optionRow} onClick={() => setPanel("details")} type="button"><span className="font-medium text-ink">Datos opcionales</span><span className="flex items-center gap-2 text-storm">Teléfono, email y notas <ChevronRight className="h-4 w-4" /></span></button><button className={optionRow} onClick={() => setPanel("roles")} type="button"><span className="font-medium text-ink">Roles</span><span className="flex items-center gap-2 text-storm">{value.roles.length || "Ninguno"} <ChevronRight className="h-4 w-4" /></span></button></div>
            <p className="text-xs leading-5 text-storm">Los contactos aparecen al registrar movimientos, créditos, deudas y servicios. Puedes completar sus datos más tarde.</p>
          </div> : panel === "type" ? <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">{typeOptions.map((option) => <button className={optionRow} key={option.value} onClick={() => { patch({ type: option.value }); setPanel("main"); }} type="button"><span className="text-ink">{option.label}</span>{value.type === option.value ? <Check className="h-4 w-4 text-ink" /> : null}</button>)}</div> : panel === "roles" ? <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141311]">{roleOptions.map((option) => <label className={optionRow} key={option.value}><span className="text-ink">{option.label}</span><input checked={value.roles.includes(option.value)} className="h-4 w-4 accent-[#e9e3d9]" onChange={(event) => patch({ roles: event.target.checked ? [...value.roles, option.value] : value.roles.filter((role) => role !== option.value) })} type="checkbox" /></label>)}</div> : <div className="space-y-5">
            <label className="block text-xs uppercase tracking-[0.12em] text-storm">Teléfono<input className={field} onChange={(event) => patch({ phone: event.target.value })} placeholder="+51 999 999 999" type="tel" value={value.phone} /></label>
            <label className="block text-xs uppercase tracking-[0.12em] text-storm">Correo<input className={field} onChange={(event) => patch({ email: event.target.value })} placeholder="correo@ejemplo.com" type="email" value={value.email} /></label>
            <label className="block text-xs uppercase tracking-[0.12em] text-storm">DNI / RUC<input className={field} onChange={(event) => patch({ documentNumber: event.target.value })} placeholder="Número de documento" value={value.documentNumber} /></label>
            <label className="block text-xs uppercase tracking-[0.12em] text-storm">Notas<textarea className={`${field} min-h-24 resize-y py-3`} onChange={(event) => patch({ notes: event.target.value })} placeholder="Información adicional" value={value.notes} /></label>
          </div>}
        </ModalBody>
        {(panel === "main" || panel === "details" || panel === "roles") ? <ModalFooter><Button className="w-full" disabled={saving || disabled} type="submit">{saving ? "Guardando…" : contact ? "Guardar cambios" : "Crear contacto"}</Button></ModalFooter> : null}
      </form>
    </Modal>
    {discardOpen ? <UnsavedChangesDialog onDiscard={() => { setDiscardOpen(false); onClose(); }} onKeepEditing={() => setDiscardOpen(false)} /> : null}
  </>;
}
