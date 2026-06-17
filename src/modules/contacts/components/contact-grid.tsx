import { BarChart3, Fingerprint, Mail, PencilLine, Phone, Trash2 } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { createLongPressHandlers, wasRecentLongPress } from "../../../components/ui/bulk-action-bar";
import { formatCurrency } from "../../../lib/formatting/money";
import {
  getLastActivityLabel,
  getRoleDefinition,
  getTypeDefinition,
  type ContactWithExposure,
} from "../lib/contacts-presenters";

type ContactGridProps = {
  contacts: ContactWithExposure[];
  baseCurrencyCode: string;
  selectedIds: Set<number>;
  selectedCount: number;
  isArchiving: boolean;
  onToggleSelect: (id: number) => void;
  onEdit: (contact: ContactWithExposure) => void;
  onAnalytics: (id: number) => void;
  onArchive: (contact: ContactWithExposure, nextArchived: boolean) => void;
  onDelete: (id: number) => void;
};

export function ContactGrid({
  contacts,
  baseCurrencyCode,
  selectedIds,
  selectedCount,
  isArchiving,
  onToggleSelect,
  onEdit,
  onAnalytics,
  onArchive,
  onDelete,
}: ContactGridProps) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {contacts.map((contact) => {
        const typeDefinition = getTypeDefinition(contact.type);
        const TypeIcon = typeDefinition.icon;
        const hasNetPositive = contact.receivablePendingInBase >= contact.payablePendingInBase;
        const isSelected = selectedIds.has(contact.id);
        const longPressHandlers = createLongPressHandlers(() => onToggleSelect(contact.id));

        return (
          <article
            className={`glass-panel-soft relative rounded-[24px] p-5 transition duration-200 hover:border-white/16 ${isSelected ? "border-pine/25 ring-2 ring-pine/30" : ""}`}
            key={contact.id}
            onClick={(e) => {
              if (wasRecentLongPress()) return;
              if (selectedCount === 0) return;
              if (e.target instanceof HTMLElement && e.target.closest('button, a, input, label, [role="button"]')) return;
              onToggleSelect(contact.id);
            }}
            {...longPressHandlers}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 text-white"
                  style={{ background: `linear-gradient(160deg, ${typeDefinition.color}, rgba(8,13,20,0.72))` }}
                >
                  <TypeIcon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-semibold text-ink">{contact.name}</h3>
                  <p className="mt-1 text-sm text-storm">
                    {contact.roles.length > 0 ? contact.roles.map((role) => getRoleDefinition(role).label).join(" · ") : "Sin roles definidos aun"}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <StatusBadge status={typeDefinition.label} tone="neutral" />
                {contact.isArchived ? <StatusBadge status="Archivado" tone="warning" /> : null}
              </div>
            </div>

            {contact.phone || contact.email || contact.documentNumber ? (
              <div className="mt-4 grid gap-2 text-sm text-storm">
                {contact.phone ? (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    <span>{contact.phone}</span>
                  </div>
                ) : null}
                {contact.email ? (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{contact.email}</span>
                  </div>
                ) : null}
                {contact.documentNumber ? (
                  <div className="flex items-center gap-2">
                    <Fingerprint className="h-4 w-4" />
                    <span>{contact.documentNumber}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Por cobrar</p>
                <p className="mt-2 font-display text-3xl font-semibold text-ink">{formatCurrency(contact.receivablePendingInBase, baseCurrencyCode)}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-storm">Por pagar</p>
                <p className="mt-2 font-display text-3xl font-semibold text-ink">{formatCurrency(contact.payablePendingInBase, baseCurrencyCode)}</p>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Balance neto</p>
                <p className="mt-3 text-sm font-medium text-ink">{hasNetPositive ? "Mas a tu favor" : "Mas a tu cargo"}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Registros</p>
                <p className="mt-3 text-sm font-medium text-ink">{contact.receivableCount + contact.payableCount} creditos/deudas</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Ultima actividad</p>
                <p className="mt-3 text-sm font-medium text-ink">{getLastActivityLabel(contact.lastActivityAt)}</p>
              </div>
            </div>

            {contact.notes ? (
              <div className="mt-3 rounded-[20px] border border-white/10 bg-black/15 p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.18em] text-storm/75">Notas</p>
                <p className="mt-2 text-sm leading-7 text-storm">{contact.notes}</p>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
              <Button onClick={() => onAnalytics(contact.id)} variant="ghost">
                <BarChart3 className="mr-2 h-4 w-4" />
                Ver análisis
              </Button>
              <Button onClick={() => onEdit(contact)} variant="secondary">
                <PencilLine className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button disabled={isArchiving} onClick={() => onArchive(contact, !contact.isArchived)} variant="ghost">
                {contact.isArchived ? "Reactivar" : "Archivar"}
              </Button>
              <Button className="text-[#ffb4bc] hover:text-white" onClick={() => onDelete(contact.id)} variant="ghost">
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
