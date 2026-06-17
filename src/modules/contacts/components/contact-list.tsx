import { Button } from "../../../components/ui/button";
import { SelectionCheckbox } from "../../../components/ui/bulk-action-bar";
import { StatusBadge } from "../../../components/ui/status-badge";
import { formatCurrency } from "../../../lib/formatting/money";
import { getRoleDefinition, getTypeDefinition, type ContactWithExposure } from "../lib/contacts-presenters";

type ContactListProps = {
  contacts: ContactWithExposure[];
  baseCurrencyCode: string;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onEdit: (contact: ContactWithExposure) => void;
  onAnalytics: (id: number) => void;
};

export function ContactList({ contacts, baseCurrencyCode, selectedIds, onToggleSelect, onEdit, onAnalytics }: ContactListProps) {
  return (
    <div className="space-y-3">
      {contacts.map((contact) => {
        const typeDefinition = getTypeDefinition(contact.type);
        const TypeIcon = typeDefinition.icon;

        return (
          <article
            className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16"
            key={contact.id}
          >
            <SelectionCheckbox
              ariaLabel={`Seleccionar ${contact.name}`}
              checked={selectedIds.has(contact.id)}
              onChange={() => onToggleSelect(contact.id)}
            />
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white"
              style={{ background: `linear-gradient(160deg, ${typeDefinition.color}, rgba(8,13,20,0.72))` }}
            >
              <TypeIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">{contact.name}</p>
              <p className="text-xs text-storm">
                {typeDefinition.label}
                {contact.roles.length > 0 ? ` · ${contact.roles.map((role) => getRoleDefinition(role).label).join(", ")}` : ""}
              </p>
            </div>
            <div className="hidden shrink-0 flex-col text-right sm:flex">
              <p className="text-sm font-medium text-pine">{formatCurrency(contact.receivablePendingInBase, baseCurrencyCode)}</p>
              <p className="text-xs text-storm">por cobrar</p>
            </div>
            {contact.isArchived ? <StatusBadge status="Archivado" tone="warning" /> : null}
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onAnalytics(contact.id)} variant="ghost">
              Análisis
            </Button>
            <Button className="shrink-0 py-1.5 text-xs" onClick={() => onEdit(contact)} variant="ghost">
              Editar
            </Button>
          </article>
        );
      })}
    </div>
  );
}
