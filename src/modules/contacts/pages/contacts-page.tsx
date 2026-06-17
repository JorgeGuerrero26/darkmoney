import { Download, LoaderCircle, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import type { FormEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { DeleteConfirmDialog } from "../../../components/ui/delete-confirm-dialog";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { InfoTip } from "../../../components/ui/info-tip";
import { PageHeader } from "../../../components/ui/page-header";
import { Pagination } from "../../../components/ui/pagination";
import { SearchablePicker } from "../../../components/ui/searchable-picker";
import { StatusBadge } from "../../../components/ui/status-badge";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { ColumnPicker, type ColumnDef, useColumnVisibility } from "../../../components/ui/column-picker";
import { BulkActionBar, useSelection } from "../../../components/ui/bulk-action-bar";
import { formatCurrency } from "../../../lib/formatting/money";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import type { CounterpartyOverview, CounterpartyRoleType } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
import { ContactAnalyticsModal } from "../components/contact-analytics-modal";
import { ContactGrid } from "../components/contact-grid";
import { ContactList } from "../components/contact-list";
import { ContactTable } from "../components/contact-table";
import { useContactsFilters } from "../hooks/use-contacts-filters";
import type { ContactStatusFilter, RoleFilter } from "../lib/contacts-filters";
import {
  buildInitials,
  getRoleDefinition,
  getTypeDefinition,
  roleFilterPickerOptions,
  roleOptions,
  statusFilterPickerOptions,
  typeOptions,
  type ContactWithExposure,
} from "../lib/contacts-presenters";
import {
  getQueryErrorMessage,
  type CounterpartyFormInput,
  useArchiveCounterpartyMutation,
  useCounterpartiesOverviewQuery,
  useCreateCounterpartyMutation,
  useDeleteCounterpartyMutation,
  useUpdateCounterpartyMutation,
  useWorkspaceSnapshotQuery,
} from "../../../services/queries/workspace-data";

const CONTACTS_PAGE_SIZE = 50;

type EditorMode = "create" | "edit";

type ContactFormState = {
  name: string;
  type: CounterpartyOverview["type"];
  phone: string;
  email: string;
  documentNumber: string;
  notes: string;
  roles: CounterpartyRoleType[];
};

type FeedbackState = {
  tone: "success" | "error";
  title: string;
  description: string;
};

const inputClassName = "field-dark";
const textareaClassName = "field-dark min-h-[120px] resize-y py-3 leading-7";
const panelClassName = "glass-panel-soft relative min-w-0 overflow-visible rounded-[24px] p-4 sm:p-6";
const labelClassName = "text-xs font-semibold uppercase tracking-[0.22em] text-storm/80";

function createDefaultFormState(): ContactFormState {
  return { name: "", type: "person", phone: "", email: "", documentNumber: "", notes: "", roles: [] };
}

function buildFormStateFromContact(contact: CounterpartyOverview): ContactFormState {
  return {
    name: contact.name,
    type: contact.type,
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    documentNumber: contact.documentNumber ?? "",
    notes: contact.notes ?? "",
    roles: [...contact.roles],
  };
}

function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClassName} ${className}`} {...props} />;
}

function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${textareaClassName} ${className}`} {...props} />;
}

function getModuleErrorMessage(error: unknown) {
  const message = getQueryErrorMessage(error, "No pudimos cargar los contactos del workspace.");
  const loweredMessage = message.toLowerCase();

  if (loweredMessage.includes("counterparty_roles") || loweredMessage.includes("v_counterparty_summary")) {
    return `${message} Ejecuta primero sql/create_counterparty_roles_and_summary.sql en la base.`;
  }

  return message;
}

function ContactEditorDialog({
  clearFieldError,
  closeEditor,
  feedback,
  formState,
  invalidFields,
  isSaving,
  isCreateMode,
  onSubmit,
  updateFormState,
}: {
  clearFieldError: (field: string) => void;
  closeEditor: () => void;
  feedback: FeedbackState | null;
  formState: ContactFormState;
  invalidFields: Set<string>;
  isSaving: boolean;
  isCreateMode: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  updateFormState: <Field extends keyof ContactFormState>(field: Field, value: ContactFormState[Field]) => void;
}) {
  const title = formState.name.trim() || "Nuevo contacto";
  const selectedType = getTypeDefinition(formState.type);
  const TypeIcon = selectedType.icon;
  // Divulgación progresiva: al crear, datos de contacto y notas arrancan plegados;
  // al editar se muestran todos para revisar de un vistazo.
  const [showAdvanced, setShowAdvanced] = useState(!isCreateMode);

  useEffect(() => {
    if (invalidFields.size === 0) return;
    const firstField = [...invalidFields][0];
    const firstEl = document.querySelector<HTMLElement>(`[data-field="${firstField}"]`);
    if (firstEl) {
      firstEl.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        firstEl.querySelector<HTMLElement>("input,button,[tabindex='0']")?.focus();
      }, 300);
    }
    invalidFields.forEach((field) => {
      const el = document.querySelector<HTMLElement>(`[data-field="${field}"]`);
      if (!el) return;
      el.classList.remove("field-error-shake");
      void el.offsetWidth;
      el.classList.add("field-error-shake");
    });
  }, [invalidFields]);

  function toggleRole(role: CounterpartyRoleType) {
    const hasRole = formState.roles.includes(role);
    updateFormState("roles", hasRole ? formState.roles.filter((item) => item !== role) : [...formState.roles, role]);
  }

  return (
    <div
      className="fixed inset-0 z-[80] isolate overflow-y-auto bg-void/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(e) => {
        (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now());
      }}
      onMouseUp={(e) => {
        const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0");
        delete (e.currentTarget as HTMLDivElement).dataset.pressStart;
        if (t0) closeEditor();
      }}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="animate-rise-in relative w-full max-w-[1100px] overflow-hidden rounded-[28px] border border-white/10 bg-shell/95 shadow-haze backdrop-blur-2xl [transform:translateZ(0)]"
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <form className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden" noValidate onSubmit={onSubmit}>
            <div className="overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/90">
                      {isCreateMode ? "Nuevo contacto" : "Editar contacto"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      Clientes, bancos, proveedores y personas clave
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.7rem]">
                    {isCreateMode ? "Crear contacto" : "Actualizar contacto"}
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-9 text-storm">
                    Mantiene ordenado quien te debe, a quien le debes y con quien se conectan tus movimientos,
                    creditos y suscripciones.
                  </p>
                </div>
                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
                  onClick={closeEditor}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {feedback?.tone === "error" ? (
                <FormFeedbackBanner className="mt-6" description={feedback.description} title={feedback.title} />
              ) : null}

              <div className="glass-panel-soft mt-7 rounded-[24px] p-5 sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 text-white"
                        style={{ background: `linear-gradient(160deg, ${selectedType.color}, rgba(8,13,20,0.72))` }}
                      >
                        <TypeIcon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Vista previa</p>
                        <h3 className="mt-2 break-words font-display text-4xl font-semibold text-ink">{title}</h3>
                        <p className="mt-3 text-base leading-8 text-storm">{selectedType.description}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-storm/85">
                            {selectedType.label}
                          </span>
                          {formState.roles.length > 0 ? (
                            formState.roles.map((role) => (
                              <StatusBadge key={role} status={getRoleDefinition(role).label} tone={getRoleDefinition(role).tone} />
                            ))
                          ) : (
                            <StatusBadge status="Sin roles" tone="neutral" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Roles</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formState.roles.length > 0 ? `${formState.roles.length} activos` : "Pendientes"}
                      </p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.22em] text-storm/75">Identidad</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{buildInitials(title)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:mt-7 sm:gap-5 lg:grid-cols-2">
                <div className={panelClassName}>
                  <p className={labelClassName}>Identidad</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Datos principales</h3>
                  <div className="mt-3 space-y-5 sm:mt-6">
                    <label className="block">
                      <span className={labelClassName}>Nombre</span>
                      <div className={`mt-3${invalidFields.has("name") ? " field-error-ring" : ""}`} data-field="name">
                        <Input
                          maxLength={120}
                          onChange={(event) => {
                            clearFieldError("name");
                            updateFormState("name", event.target.value);
                          }}
                          placeholder="Ej. Cliente Premium SAC"
                          type="text"
                          value={formState.name}
                        />
                      </div>
                    </label>
                    <div>
                      <p className={labelClassName}>Tipo</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {typeOptions.map((option) => {
                          const isSelected = formState.type === option.value;
                          const Icon = option.icon;

                          return (
                            <button
                              className={`rounded-[24px] border p-4 text-left transition duration-200 ${isSelected ? "border-white/20 bg-white/[0.07] shadow-[0_0_0_3px_rgba(107,228,197,0.08)]" : "border-white/8 bg-white/[0.03] hover:border-white/12"}`}
                              key={option.value}
                              onClick={() => updateFormState("type", option.value)}
                              type="button"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 text-white"
                                  style={{ backgroundColor: `${option.color}24`, borderColor: `${option.color}55` }}
                                >
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="font-medium text-ink">{option.label}</p>
                                  <p className="mt-1 text-xs leading-5 text-storm">{option.description}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={panelClassName}>
                  <p className={labelClassName}>Roles</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Relacion contigo</h3>
                  <div className="mt-3 grid gap-3 sm:mt-6">
                    {roleOptions.map((option) => {
                      const isSelected = formState.roles.includes(option.value);

                      return (
                        <button
                          className={`rounded-[24px] border p-4 text-left transition duration-200 ${isSelected ? "border-white/20 bg-white/[0.07]" : "border-white/8 bg-white/[0.03] hover:border-white/12"}`}
                          key={option.value}
                          onClick={() => toggleRole(option.value)}
                          type="button"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-medium text-ink">{option.label}</p>
                              <p className="mt-1 text-xs leading-5 text-storm">{option.description}</p>
                            </div>
                            {isSelected ? <StatusBadge status="Activo" tone={option.tone} /> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!showAdvanced ? (
                  <button
                    className="flex w-full items-center justify-center gap-2 rounded-[24px] border border-dashed border-white/15 bg-white/[0.02] px-4 py-3.5 text-sm font-medium text-storm transition hover:border-white/25 hover:text-ink lg:col-span-2"
                    onClick={() => setShowAdvanced(true)}
                    type="button"
                  >
                    Más opciones (telefono, email, documento, notas)
                  </button>
                ) : null}

                <div className={`${panelClassName} ${showAdvanced ? "" : "hidden"}`}>
                  <p className={labelClassName}>Contacto</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Datos opcionales</h3>
                  <div className="mt-3 grid gap-5 sm:mt-6 lg:grid-cols-2">
                    <label className="block">
                      <span className={labelClassName}>Telefono</span>
                      <div className="mt-3">
                        <Input onChange={(event) => updateFormState("phone", event.target.value)} placeholder="Ej. +51 999 111 222" type="text" value={formState.phone} />
                      </div>
                    </label>
                    <label className="block">
                      <span className={labelClassName}>Email</span>
                      <div className="mt-3">
                        <Input onChange={(event) => updateFormState("email", event.target.value)} placeholder="contacto@empresa.com" type="email" value={formState.email} />
                      </div>
                    </label>
                    <label className="block lg:col-span-2">
                      <span className={labelClassName}>Documento o referencia</span>
                      <div className="mt-3">
                        <Input onChange={(event) => updateFormState("documentNumber", event.target.value)} placeholder="Ej. RUC, DNI o codigo interno" type="text" value={formState.documentNumber} />
                      </div>
                    </label>
                  </div>
                </div>

                <div className={`${panelClassName} ${showAdvanced ? "" : "hidden"}`}>
                  <p className={labelClassName}>Contexto</p>
                  <h3 className="mt-1 font-display text-lg font-semibold text-ink sm:mt-2 sm:text-2xl">Notas internas</h3>
                  <div className="mt-3 sm:mt-6">
                    <Textarea
                      onChange={(event) => updateFormState("notes", event.target.value)}
                      placeholder="Ej. Cliente corporativo, suele pagar los primeros dias del mes."
                      value={formState.notes}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-[60] border-t border-white/10 bg-shell/95 px-4 py-4 backdrop-blur-md sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  {isCreateMode
                    ? "Este contacto quedara disponible para movimientos, creditos, deudas y dashboards."
                    : "Los cambios se reflejaran de inmediato en los modulos donde este contacto ya se usa."}
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button disabled={isSaving} onClick={closeEditor} type="button" variant="ghost">
                    Cancelar
                  </Button>
                  <Button disabled={isSaving} type="submit">
                    {isSaving ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Guardando...
                      </>
                    ) : isCreateMode ? (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Crear contacto
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Guardar cambios
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ContactsLoadingSkeleton() {
  return (
    <>
      <div className="shimmer-surface h-[180px] rounded-[32px]" />
      <div className="shimmer-surface h-[520px] rounded-[32px]" />
    </>
  );
}

function ContactsSummaryChip({
  label,
  tone = "neutral",
  value,
}: {
  label: string;
  tone?: "neutral" | "info" | "warning";
  value: string;
}) {
  const valueTone = {
    neutral: "text-ink",
    info: "text-ember",
    warning: "text-gold",
  } as const;

  return (
    <article className="glass-panel-soft min-w-0 rounded-[24px] p-4 transition duration-300 hover:border-white/15">
      <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-storm/80">{label}</p>
      <p className={`mt-2 truncate font-display text-2xl font-semibold leading-tight ${valueTone[tone]}`}>{value}</p>
    </article>
  );
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadContactsCSV(contacts: CounterpartyOverview[], filename: string) {
  const headers = ["Nombre", "Tipo", "Roles", "Telefono", "Email", "Documento", "Por cobrar", "Por pagar", "Neto pendiente", "Movimientos", "Archivado", "Notas"];
  const rows = contacts.map((c) => [
    escapeCSV(c.name),
    escapeCSV(c.type),
    escapeCSV(c.roles.join("; ")),
    escapeCSV(c.phone ?? ""),
    escapeCSV(c.email ?? ""),
    escapeCSV(c.documentNumber ?? ""),
    escapeCSV(c.receivablePendingTotal),
    escapeCSV(c.payablePendingTotal),
    escapeCSV(c.netPendingAmount),
    escapeCSV(c.movementCount),
    escapeCSV(c.isArchived ? "Si" : "No"),
    escapeCSV(c.notes ?? ""),
  ]);
  downloadCSV([headers.join(","), ...rows.map((r) => r.join(","))].join("\n"), filename);
}

export function ContactsPage() {
  const { profile, user } = useAuth();
  const { activeWorkspace, error: workspaceError, isLoading: isWorkspacesLoading } = useActiveWorkspace();
  const snapshotQuery = useWorkspaceSnapshotQuery(activeWorkspace, user?.id, profile);
  const contactsQuery = useCounterpartiesOverviewQuery(activeWorkspace?.id);
  const createMutation = useCreateCounterpartyMutation(activeWorkspace?.id, user?.id);
  const updateMutation = useUpdateCounterpartyMutation(activeWorkspace?.id, user?.id);
  const archiveMutation = useArchiveCounterpartyMutation(activeWorkspace?.id, user?.id);
  const deleteMutation = useDeleteCounterpartyMutation(activeWorkspace?.id, user?.id);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  useSuccessToast(feedback, {
    clear: () => setFeedback(null),
  });
  const contactColumns: ColumnDef[] = [
    { key: "tipo", label: "Tipo" },
    { key: "roles", label: "Roles" },
    { key: "por_cobrar", label: "Por cobrar" },
    { key: "por_pagar", label: "Por pagar" },
  ];
  const { visible: colVis, toggle: toggleCol, cv } = useColumnVisibility("columns-contacts", contactColumns);
  const [viewMode, setViewMode] = useViewMode("contacts", "table");
  const {
    filters: contactFilters,
    currentPage,
    setCurrentPage,
    openTableFilter,
    updateFilter: updateContactFilter,
    clearFilters: clearContactFilters,
    toggleTableFilterMenu,
    closeTableFilterMenu,
    clearSingleTableFilter,
    applyFilterAndClose: applyContactFilterAndClose,
  } = useContactsFilters(viewMode);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());

  function clearFieldError(field: string) {
    setInvalidFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  }
  const [editorMode, setEditorMode] = useState<EditorMode>("create");
  const [selectedContactId, setSelectedContactId] = useState<number | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [analyticsContactId, setAnalyticsContactId] = useState<number | null>(null);
  const [formState, setFormState] = useState<ContactFormState>(createDefaultFormState());

  const contacts = contactsQuery.data ?? [];
  const snapshot = snapshotQuery.data;
  const obligations = snapshot?.obligations ?? [];
  const baseCurrencyCode = snapshot?.workspace.baseCurrencyCode ?? activeWorkspace?.baseCurrencyCode ?? "USD";
  const selectedContact = selectedContactId === null ? null : contacts.find((item) => item.id === selectedContactId) ?? null;
  const deleteTarget = deleteTargetId === null ? null : contacts.find((item) => item.id === deleteTargetId) ?? null;
  const isSavingEditor = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;
  const isArchiving = archiveMutation.isPending;

  const contactsWithExposure = useMemo<ContactWithExposure[]>(() => {
    const summaryMap = new Map<number, { receivablePending: number; payablePending: number }>();

    for (const obligation of obligations) {
      if (!obligation.counterpartyId) {
        continue;
      }

      const currentValue = summaryMap.get(obligation.counterpartyId) ?? { receivablePending: 0, payablePending: 0 };
      const amount = obligation.pendingAmountInBaseCurrency ?? obligation.pendingAmount;

      if (obligation.direction === "receivable") {
        currentValue.receivablePending += amount;
      } else {
        currentValue.payablePending += amount;
      }

      summaryMap.set(obligation.counterpartyId, currentValue);
    }

    return contacts.map((contact) => {
      const exposure = summaryMap.get(contact.id) ?? { receivablePending: 0, payablePending: 0 };
      return { ...contact, receivablePendingInBase: exposure.receivablePending, payablePendingInBase: exposure.payablePending };
    });
  }, [contacts, obligations]);

  const hasActiveFilters =
    contactFilters.name.trim() !== "" ||
    contactFilters.type !== "all" ||
    contactFilters.role !== "all" ||
    contactFilters.status !== "active" ||
    contactFilters.receivable.trim() !== "" ||
    contactFilters.payable.trim() !== "";

  const filteredContacts = useMemo(() => {
    const normalizedSearch = contactFilters.name.trim().toLowerCase();
    const normalizedReceivable = contactFilters.receivable.trim();
    const normalizedPayable = contactFilters.payable.trim();

    return contactsWithExposure.filter((contact) => {
      if (contactFilters.status === "active" && contact.isArchived) {
        return false;
      }

      if (contactFilters.status === "archived" && !contact.isArchived) {
        return false;
      }

      if (contactFilters.role !== "all" && !contact.roles.includes(contactFilters.role)) {
        return false;
      }

      if (contactFilters.type !== "all" && contact.type !== contactFilters.type) {
        return false;
      }

      if (
        normalizedSearch &&
        !(
          contact.name.toLowerCase().includes(normalizedSearch) ||
          contact.type.toLowerCase().includes(normalizedSearch) ||
          contact.roles.some((role) => getRoleDefinition(role).label.toLowerCase().includes(normalizedSearch)) ||
          contact.email?.toLowerCase().includes(normalizedSearch) ||
          contact.phone?.toLowerCase().includes(normalizedSearch) ||
          contact.documentNumber?.toLowerCase().includes(normalizedSearch)
        )
      ) {
        return false;
      }

      if (normalizedReceivable && !String(contact.receivablePendingInBase).includes(normalizedReceivable)) {
        return false;
      }

      if (normalizedPayable && !String(contact.payablePendingInBase).includes(normalizedPayable)) {
        return false;
      }

      return true;
    });
  }, [contactFilters, contactsWithExposure]);

  const totalPages = Math.max(1, Math.ceil(filteredContacts.length / CONTACTS_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedContacts = useMemo(
    () => filteredContacts.slice((safePage - 1) * CONTACTS_PAGE_SIZE, safePage * CONTACTS_PAGE_SIZE),
    [filteredContacts, safePage],
  );

  const {
    selectedIds,
    toggle: toggleSelect,
    selectAll,
    clearAll,
    selectedCount,
    allSelected,
    someSelected,
    selectedItems,
  } = useSelection(filteredContacts);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  async function handleBulkDelete() {
    if (selectedCount === 0) return;
    setShowBulkDeleteConfirm(true);
  }

  async function confirmBulkDelete() {
    setIsBulkDeleting(true);
    try {
      for (const id of Array.from(selectedIds)) {
        await archiveMutation.mutateAsync({ counterpartyId: id, workspaceId: activeWorkspace!.id, userId: user!.id, isArchived: true });
      }
      clearAll();
    } catch (err) {
      setFeedback({ tone: "error", title: "Error al archivar", description: getQueryErrorMessage(err) });
    } finally {
      setIsBulkDeleting(false);
      setShowBulkDeleteConfirm(false);
    }
  }

  const totalActiveContacts = contacts.filter((contact) => !contact.isArchived).length;
  const totalArchivedContacts = contacts.filter((contact) => contact.isArchived).length;
  const totalClients = contacts.filter((contact) => contact.roles.includes("client")).length;
  const totalReceivable = contactsWithExposure.reduce((total, contact) => total + contact.receivablePendingInBase, 0);
  const totalPayable = contactsWithExposure.reduce((total, contact) => total + contact.payablePendingInBase, 0);

  function updateFormState<Field extends keyof ContactFormState>(field: Field, value: ContactFormState[Field]) {
    setIsDirty(true);
    setFormState((currentValue) => ({ ...currentValue, [field]: value }));
  }

  function closeEditor() {
    if (isSavingEditor) return;
    setIsEditorOpen(false);
    setSelectedContactId(null);
    setIsDirty(false);
  }

  function requestCloseEditor() {
    if (isSavingEditor) return;
    if (isDirty) {
      setShowUnsavedDialog(true);
    } else {
      closeEditor();
    }
  }

  function openCreateEditor() {
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("create");
    setSelectedContactId(null);
    setFormState(createDefaultFormState());
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  function openEditEditor(contact: CounterpartyOverview) {
    setFeedback(null);
    setInvalidFields(new Set());
    setEditorMode("edit");
    setSelectedContactId(contact.id);
    setFormState(buildFormStateFromContact(contact));
    setIsDirty(false);
    setIsEditorOpen(true);
  }

  async function handleSubmitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeWorkspace || !user?.id) {
      setFeedback({ tone: "error", title: "No encontramos el workspace activo", description: "Recarga la pagina e intenta nuevamente." });
      return;
    }

    const name = formState.name.trim();

    if (!name) {
      setInvalidFields(new Set(["name"]));
      setFeedback({ tone: "error", title: "Falta el nombre", description: "Dale un nombre claro a este contacto." });
      return;
    }

    const payload: CounterpartyFormInput = {
      name,
      type: formState.type,
      phone: formState.phone,
      email: formState.email,
      documentNumber: formState.documentNumber,
      notes: formState.notes,
      roles: formState.roles,
    };

    try {
      if (editorMode === "create") {
        await createMutation.mutateAsync({ workspaceId: activeWorkspace.id, userId: user.id, ...payload });
        setFeedback({ tone: "success", title: "Contacto creado", description: "Ya esta disponible para movimientos, creditos, deudas y dashboards." });
      } else if (selectedContact) {
        await updateMutation.mutateAsync({ counterpartyId: selectedContact.id, workspaceId: activeWorkspace.id, userId: user.id, ...payload });
        setFeedback({ tone: "success", title: "Contacto actualizado", description: "Los cambios ya se reflejan en el resto de la app." });
      }

      setIsEditorOpen(false);
      setSelectedContactId(null);
    } catch (error) {
      setFeedback({ tone: "error", title: "No pudimos guardar el contacto", description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos.") });
    }
  }

  async function handleArchive(contact: CounterpartyOverview, nextArchived: boolean) {
    if (!activeWorkspace || !user?.id) {
      return;
    }

    try {
      await archiveMutation.mutateAsync({ counterpartyId: contact.id, workspaceId: activeWorkspace.id, userId: user.id, isArchived: nextArchived });
      setFeedback({
        tone: "success",
        title: nextArchived ? "Contacto archivado" : "Contacto reactivado",
        description: nextArchived ? "Seguira disponible en el historial, pero ya no aparecera como activo." : "Volvio a estar disponible para nuevos registros.",
      });
    } catch (error) {
      setFeedback({ tone: "error", title: "No pudimos cambiar el estado", description: getQueryErrorMessage(error, "Intenta nuevamente en unos segundos.") });
    }
  }

  async function handleDelete() {
    if (!activeWorkspace || !deleteTarget) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ counterpartyId: deleteTarget.id, workspaceId: activeWorkspace.id });
      setFeedback({ tone: "success", title: "Contacto eliminado", description: "Ya no aparece en el workspace activo." });
      setDeleteTargetId(null);
    } catch (error) {
      setFeedback({ tone: "error", title: "No pudimos eliminar el contacto", description: getQueryErrorMessage(error, "Archivarlo suele ser la mejor opcion si ya tiene historial.") });
    }
  }

  if (!activeWorkspace && (isWorkspacesLoading || snapshotQuery.isLoading)) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos preparando los contactos del workspace activo." eyebrow="contactos" title="Cargando contactos" />
        <ContactsLoadingSkeleton />
      </div>
    );
  }

  if (workspaceError) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Necesitamos acceder correctamente al workspace activo." eyebrow="contactos" title="Contactos no disponibles" />
        <DataState description={getQueryErrorMessage(workspaceError, "No pudimos abrir tu workspace actual.")} title="No hay acceso al workspace" tone="error" />
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Cuando tengas un workspace activo, aqui veras tus clientes, bancos y proveedores." eyebrow="contactos" title="Aun no hay un workspace activo" />
        <DataState description="Activa o crea un workspace para comenzar a registrar contactos." title="Sin contactos para mostrar" />
      </div>
    );
  }

  if (snapshotQuery.isLoading || contactsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Estamos cargando las relaciones clave del workspace y su actividad reciente." eyebrow="contactos" title="Cargando contactos" />
        <ContactsLoadingSkeleton />
      </div>
    );
  }

  if (snapshotQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Intentamos reconstruir la actividad del workspace para tus dashboards." eyebrow="contactos" title="No fue posible cargar la informacion" />
        <DataState description={getQueryErrorMessage(snapshotQuery.error, "No pudimos leer el resumen actual del workspace.")} title="Error al cargar actividad" tone="error" />
      </div>
    );
  }

  if (contactsQuery.error) {
    return (
      <div className="flex flex-col gap-6 pb-8">
        <PageHeader description="Intentamos abrir el mantenedor y resumen de contactos del workspace." eyebrow="contactos" title="No fue posible cargar los contactos" />
        <DataState description={getModuleErrorMessage(contactsQuery.error)} title="Falta preparar la base o revisar permisos" tone="error" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      {/* Header compacto (estándar) */}
      <section className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-pine/80">Contactos</p>
        <div className="mt-1 flex items-center gap-2.5">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.02em] text-ink">Relaciones del workspace</h2>
          <InfoTip ariaLabel="Sobre los contactos">
            Clientes, proveedores, bancos y personas clave para entender quien te debe y a quien le debes. Los filtros
            de la barra superior aplican a todas las vistas.
          </InfoTip>
        </div>
        <p className="mt-1 text-xs text-storm">Personas, empresas y bancos conectados a tus movimientos y obligaciones.</p>
      </section>

      {/* Métricas compactas */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr))]">
        <ContactsSummaryChip label="activos" value={String(totalActiveContacts)} />
        <ContactsSummaryChip label="clientes" tone="info" value={String(totalClients)} />
        <ContactsSummaryChip label="te deben" tone="info" value={formatCurrency(totalReceivable, baseCurrencyCode)} />
        <ContactsSummaryChip label="debes" tone="warning" value={formatCurrency(totalPayable, baseCurrencyCode)} />
        <ContactsSummaryChip label="archivados" value={String(totalArchivedContacts)} />
      </div>

      {/* Toolbar sticky (estándar) */}
      <section className="sticky top-3 z-30 rounded-[24px] border border-white/10 bg-canvas/85 p-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-2">
          <ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} />
          {viewMode === "table" ? <ColumnPicker columns={contactColumns} visible={colVis} onToggle={toggleCol} /> : null}
          <StatusBadge status={`${filteredContacts.length} visibles`} tone="neutral" />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-storm transition hover:border-white/16 hover:text-ink disabled:opacity-50"
              disabled={snapshotQuery.isFetching}
              onClick={() => snapshotQuery.refetch()}
              title="Actualizar"
              type="button"
            >
              <RefreshCw className={`h-4 w-4${snapshotQuery.isFetching ? " animate-spin" : ""}`} />
            </button>
            {hasActiveFilters ? (
              <Button onClick={clearContactFilters} variant="ghost">
                <X className="mr-2 h-4 w-4" />
                Limpiar
              </Button>
            ) : null}
            <Button
              disabled={!filteredContacts.length}
              onClick={() => downloadContactsCSV(filteredContacts, `contactos-${new Date().toISOString().slice(0, 10)}.csv`)}
              variant="ghost"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
            <Button data-tour="create-contact" onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo contacto
            </Button>
          </div>
        </div>

        {/* Filtros principales: siempre visibles (aplican a todas las vistas) */}
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <input
            className="field-dark"
            onChange={(event) => updateContactFilter("name", event.target.value)}
            placeholder="Buscar por nombre, email, rol o documento..."
            type="text"
            value={contactFilters.name}
          />
          <SearchablePicker
            emptyMessage="No hay roles para mostrar."
            onChange={(value) => updateContactFilter("role", value as RoleFilter)}
            options={roleFilterPickerOptions}
            placeholderDescription="Filtra por rol."
            placeholderLabel="Rol"
            queryPlaceholder="Buscar rol..."
            value={contactFilters.role}
          />
          <SearchablePicker
            emptyMessage="No hay estados para mostrar."
            onChange={(value) => updateContactFilter("status", value as ContactStatusFilter)}
            options={statusFilterPickerOptions}
            placeholderDescription="Filtra por estado."
            placeholderLabel="Estado"
            queryPlaceholder="Buscar estado..."
            value={contactFilters.status}
          />
        </div>
      </section>

      {feedback && feedback.tone !== "error" && !isEditorOpen ? (
        <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} />
      ) : null}

      {contacts.length === 0 ? (
        <DataState
          action={
            <Button onClick={openCreateEditor}>
              <Plus className="mr-2 h-4 w-4" />
              Crear primer contacto
            </Button>
          }
          description="Registra clientes, proveedores, bancos o personas clave para conectar mejor tus movimientos y obligaciones."
          title="Aun no has creado contactos"
        />
      ) : filteredContacts.length === 0 ? (
        <DataState
          action={
            <Button onClick={clearContactFilters} variant="ghost">
              Limpiar filtros
            </Button>
          }
          description="Prueba cambiando los filtros activos o vuelve a la vista tabla para revisar cada columna."
          title="Sin resultados"
        />
      ) : viewMode === "list" ? (
        <ContactList
          baseCurrencyCode={baseCurrencyCode}
          contacts={paginatedContacts}
          onAnalytics={setAnalyticsContactId}
          onEdit={openEditEditor}
          onToggleSelect={toggleSelect}
          selectedIds={selectedIds}
        />
      ) : viewMode === "table" ? (
        <ContactTable
          allSelected={allSelected}
          baseCurrencyCode={baseCurrencyCode}
          contacts={paginatedContacts}
          cv={cv}
          filters={contactFilters}
          isArchiving={isArchiving}
          onAnalytics={setAnalyticsContactId}
          onApplyFilterAndClose={applyContactFilterAndClose}
          onArchive={(contact, nextArchived) => void handleArchive(contact, nextArchived)}
          onClearAll={clearAll}
          onClearSingleFilter={clearSingleTableFilter}
          onCloseFilterMenu={closeTableFilterMenu}
          onEdit={openEditEditor}
          onSelectAll={selectAll}
          onToggleFilterMenu={toggleTableFilterMenu}
          onToggleSelect={toggleSelect}
          onUpdateFilter={updateContactFilter}
          openFilter={openTableFilter}
          selectedIds={selectedIds}
          someSelected={someSelected}
        />
      ) : (
        <ContactGrid
          baseCurrencyCode={baseCurrencyCode}
          contacts={paginatedContacts}
          isArchiving={isArchiving}
          onAnalytics={setAnalyticsContactId}
          onArchive={(contact, nextArchived) => void handleArchive(contact, nextArchived)}
          onDelete={setDeleteTargetId}
          onEdit={openEditEditor}
          onToggleSelect={toggleSelect}
          selectedCount={selectedCount}
          selectedIds={selectedIds}
        />
      )}

      {filteredContacts.length > 0 ? (
        <Pagination onPageChange={setCurrentPage} page={safePage} pageSize={CONTACTS_PAGE_SIZE} totalItems={filteredContacts.length} />
      ) : null}

      {analyticsContactId !== null
        ? (() => {
            const analyticsContact = contactsWithExposure.find((c) => c.id === analyticsContactId);
            return analyticsContact ? (
              <ContactAnalyticsModal
                baseCurrencyCode={baseCurrencyCode}
                contact={analyticsContact}
                movements={snapshot?.movements ?? []}
                onClose={() => setAnalyticsContactId(null)}
              />
            ) : null;
          })()
        : null}

      <BulkActionBar
        deleteLabel="Archivar"
        deletingLabel="Archivando..."
        isDeleting={isBulkDeleting}
        onClearAll={clearAll}
        onDelete={handleBulkDelete}
        onExport={() => downloadContactsCSV(selectedItems, `contactos-seleccionados-${new Date().toISOString().slice(0, 10)}.csv`)}
        onSelectAll={selectAll}
        selectedCount={selectedCount}
        totalCount={filteredContacts.length}
      />
      {showBulkDeleteConfirm ? (
        <div role="dialog" aria-modal="true" aria-labelledby="contact-bulk-title" className="fixed inset-0 z-[310] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-panel-strong w-full max-w-md rounded-[28px] p-6">
            <h2 id="contact-bulk-title" className="font-display text-xl font-semibold text-ink">
              Archivar {selectedCount} contacto{selectedCount !== 1 ? "s" : ""}?
            </h2>
            <p className="mt-3 text-sm leading-7 text-storm">
              Los contactos seleccionados seran archivados y dejaran de aparecer en el flujo principal. Podras reactivarlos despues.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button disabled={isBulkDeleting} onClick={() => void confirmBulkDelete()}>
                {isBulkDeleting ? "Archivando..." : `Archivar ${selectedCount}`}
              </Button>
              <Button disabled={isBulkDeleting} onClick={() => setShowBulkDeleteConfirm(false)} variant="ghost">
                Cancelar
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {isEditorOpen ? (
        <ContactEditorDialog
          clearFieldError={clearFieldError}
          closeEditor={requestCloseEditor}
          feedback={feedback}
          formState={formState}
          invalidFields={invalidFields}
          isCreateMode={editorMode === "create"}
          isSaving={isSavingEditor}
          onSubmit={handleSubmitEditor}
          updateFormState={updateFormState}
        />
      ) : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => {
            setShowUnsavedDialog(false);
            closeEditor();
          }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}

      {deleteTarget ? (
        <DeleteConfirmDialog
          badge="Eliminar contacto"
          description="Si este contacto ya se usa en movimientos, creditos, deudas o suscripciones, lo mas sano suele ser archivarlo."
          isDeleting={isDeleting}
          onCancel={() => {
            if (!isDeleting) {
              setDeleteTargetId(null);
            }
          }}
          onConfirm={() => {
            void handleDelete();
          }}
        >
          <div>
            <p className="text-lg font-semibold text-ink">{deleteTarget.name}</p>
            <p className="mt-2 text-sm text-storm">{getTypeDefinition(deleteTarget.type).label}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {deleteTarget.roles.length > 0 ? (
                deleteTarget.roles.map((role) => <StatusBadge key={role} status={getRoleDefinition(role).label} tone={getRoleDefinition(role).tone} />)
              ) : (
                <StatusBadge status="Sin roles" tone="neutral" />
              )}
            </div>
          </div>
        </DeleteConfirmDialog>
      ) : null}
    </div>
  );
}
