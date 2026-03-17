import {
  ArrowDownCircle,
  ArrowUpCircle,
  Building2,
  Fingerprint,
  Landmark,
  LoaderCircle,
  Mail,
  PencilLine,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { FormEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../../../components/ui/button";
import { DataState } from "../../../components/ui/data-state";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { PageHeader } from "../../../components/ui/page-header";
import { StatusBadge } from "../../../components/ui/status-badge";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { useViewMode, ViewSelector } from "../../../components/ui/view-selector";
import { formatDate } from "../../../lib/formatting/dates";
import { formatCurrency } from "../../../lib/formatting/money";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import type { CounterpartyOverview, CounterpartyRoleType, CounterpartySummary } from "../../../types/domain";
import { useAuth } from "../../auth/auth-context";
import { useActiveWorkspace } from "../../workspaces/use-active-workspace";
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

type EditorMode = "create" | "edit";
type RoleFilter = "all" | CounterpartyRoleType;

type ContactFormState = {
  name: string;
  type: CounterpartySummary["type"];
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

const fieldClassName =
  "w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)] disabled:cursor-not-allowed disabled:opacity-60";
const inputClassName = `${fieldClassName} h-14`;
const textareaClassName = `${fieldClassName} min-h-[140px] py-4 leading-7`;

const typeOptions = [
  { value: "person" as const, label: "Persona", description: "Amigos, familiares o personas individuales.", icon: UserRound, color: "#1b6a58" },
  { value: "company" as const, label: "Empresa", description: "Clientes, empleadores o companias formales.", icon: Building2, color: "#4566d6" },
  { value: "merchant" as const, label: "Comercio", description: "Tiendas o vendedores frecuentes.", icon: Building2, color: "#c46a31" },
  { value: "service" as const, label: "Servicio", description: "Servicios digitales, recurrentes o profesionales.", icon: ShieldCheck, color: "#8366f2" },
  { value: "bank" as const, label: "Banco", description: "Bancos, financieras o cajas.", icon: Landmark, color: "#0f766e" },
  { value: "other" as const, label: "Otro", description: "Cualquier caso que no encaje en las categorias anteriores.", icon: Users, color: "#64748b" },
] as const;

const roleOptions = [
  { value: "client" as const, label: "Cliente", description: "Te compra, te paga o le facturas.", tone: "success" as const },
  { value: "supplier" as const, label: "Proveedor", description: "Le compras o te abastece.", tone: "info" as const },
  { value: "lender" as const, label: "Prestamista", description: "Te presta dinero o financia una deuda.", tone: "warning" as const },
  { value: "borrower" as const, label: "Deudor", description: "Te debe dinero o le financiaste algo.", tone: "danger" as const },
  { value: "bank" as const, label: "Banco", description: "Entidad financiera o cuenta institucional.", tone: "info" as const },
  { value: "service_provider" as const, label: "Servicio", description: "Proveedor recurrente o empresa de suscripcion.", tone: "neutral" as const },
  { value: "other" as const, label: "Otro", description: "Rol adicional o libre.", tone: "neutral" as const },
] as const;

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

function getTypeDefinition(type: CounterpartySummary["type"]) {
  return typeOptions.find((option) => option.value === type) ?? typeOptions[typeOptions.length - 1];
}

function getRoleDefinition(role: CounterpartyRoleType) {
  return roleOptions.find((option) => option.value === role) ?? roleOptions[roleOptions.length - 1];
}

function buildInitials(name: string) {
  const value = name.trim().split(/\s+/).slice(0, 2).map((chunk) => chunk.slice(0, 1).toUpperCase()).join("");
  return value || "CT";
}

function getLastActivityLabel(value?: string | null) {
  return value ? formatDate(value) : "Sin actividad aun";
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
    <div className="fixed inset-0 z-[80] isolate overflow-y-auto bg-[#02060d]/82 p-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#02060d]/68 before:backdrop-blur-2xl before:content-[''] sm:p-6" onMouseDown={(e) => { (e.currentTarget as HTMLDivElement).dataset.pressStart = String(Date.now()); }} onMouseUp={(e) => { const t0 = Number((e.currentTarget as HTMLDivElement).dataset.pressStart || "0"); delete (e.currentTarget as HTMLDivElement).dataset.pressStart; if (t0) closeEditor(); }}>
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[1100px] overflow-hidden rounded-[38px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]" onMouseDown={(e) => e.stopPropagation()} onMouseUp={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <form className="flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden" noValidate onSubmit={onSubmit}>
            <div className="overflow-y-auto px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
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
                <FormFeedbackBanner
                  className="mt-6"
                  description={feedback.description}
                  title={feedback.title}
                />
              ) : null}

              <div className="mt-7 rounded-[34px] border border-white/10 bg-[linear-gradient(135deg,rgba(16,24,36,0.96),rgba(8,12,20,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)] sm:p-6">
                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 text-white"
                        style={{ background: `linear-gradient(160deg, ${selectedType.color}, rgba(8,13,20,0.72))` }}
                      >
                        <TypeIcon className="h-7 w-7" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Vista previa</p>
                        <h3 className="mt-2 break-words font-display text-4xl font-semibold text-ink">{title}</h3>
                        <p className="mt-3 text-base leading-8 text-storm">{selectedType.description}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <span className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/85">
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
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Roles</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {formState.roles.length > 0 ? `${formState.roles.length} activos` : "Pendientes"}
                      </p>
                      <p className="mt-2 text-sm text-storm">Puedes marcar cliente, proveedor, prestamista, deudor y mas.</p>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-black/15 p-5">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Identidad</p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">{buildInitials(title)}</p>
                      <p className="mt-2 text-sm text-storm">Ideal para dashboards, filtros y cruces con otros modulos.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-7 grid gap-5 lg:grid-cols-2">
                <div className="glass-panel-soft rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Identidad</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">Datos principales</h3>
                  <div className="mt-6 space-y-5">
                    <label className="block">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Nombre</span>
                      <div
                        className={`mt-3${invalidFields.has("name") ? " field-error-ring" : ""}`}
                        data-field="name"
                      >
                        <Input maxLength={120} onChange={(event) => { clearFieldError("name"); updateFormState("name", event.target.value); }} placeholder="Ej. Cliente Premium SAC" type="text" value={formState.name} />
                      </div>
                    </label>
                    <div>
                      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Tipo</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {typeOptions.map((option) => {
                          const isSelected = formState.type === option.value;
                          const Icon = option.icon;

                          return (
                            <button
                              className={`rounded-[24px] border p-4 text-left transition duration-200 ${isSelected ? "border-white/20 bg-white/[0.07] shadow-[0_0_0_3px_rgba(107,228,197,0.08)]" : "border-white/8 bg-[#0d1623] hover:border-white/12"}`}
                              key={option.value}
                              onClick={() => updateFormState("type", option.value)}
                              type="button"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-[18px] border border-white/10 text-white" style={{ backgroundColor: `${option.color}24`, borderColor: `${option.color}55` }}>
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

                <div className="glass-panel-soft rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Roles</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">Relacion contigo</h3>
                  <div className="mt-6 grid gap-3">
                    {roleOptions.map((option) => {
                      const isSelected = formState.roles.includes(option.value);

                      return (
                        <button
                          className={`rounded-[24px] border p-4 text-left transition duration-200 ${isSelected ? "border-white/20 bg-white/[0.07]" : "border-white/8 bg-[#0d1623] hover:border-white/12"}`}
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

                <div className="glass-panel-soft rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Contacto</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">Datos opcionales</h3>
                  <div className="mt-6 grid gap-5 lg:grid-cols-2">
                    <label className="block">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Telefono</span>
                      <div className="mt-3">
                        <Input onChange={(event) => updateFormState("phone", event.target.value)} placeholder="Ej. +51 999 111 222" type="text" value={formState.phone} />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Email</span>
                      <div className="mt-3">
                        <Input onChange={(event) => updateFormState("email", event.target.value)} placeholder="contacto@empresa.com" type="email" value={formState.email} />
                      </div>
                    </label>
                    <label className="block lg:col-span-2">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Documento o referencia</span>
                      <div className="mt-3">
                        <Input onChange={(event) => updateFormState("documentNumber", event.target.value)} placeholder="Ej. RUC, DNI o codigo interno" type="text" value={formState.documentNumber} />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="glass-panel-soft rounded-[32px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">Contexto</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold text-ink">Notas internas</h3>
                  <div className="mt-6">
                    <Textarea onChange={(event) => updateFormState("notes", event.target.value)} placeholder="Ej. Cliente corporativo, suele pagar los primeros dias del mes." value={formState.notes} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/10 px-4 py-4 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm leading-7 text-storm">
                  {isCreateMode ? "Este contacto quedara disponible para movimientos, creditos, deudas y dashboards." : "Los cambios se reflejaran de inmediato en los modulos donde este contacto ya se usa."}
                </p>
                <div className="flex flex-col-reverse gap-3 sm:flex-row">
                  <Button disabled={isSaving} onClick={closeEditor} type="button" variant="ghost">Cancelar</Button>
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

function DeleteDialog({
  contact,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  contact: CounterpartyOverview;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] isolate flex items-center justify-center bg-[#01050b]/84 p-4 backdrop-blur-lg before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#01050b]/70 before:backdrop-blur-2xl before:content-[''] sm:p-6">
      <div className="relative w-full max-w-[34rem] overflow-hidden rounded-[34px] [transform:translateZ(0)] border border-[#f27a86]/22 bg-[linear-gradient(160deg,rgba(11,17,26,0.995),rgba(8,12,19,0.985))] p-6 shadow-[0_35px_120px_rgba(0,0,0,0.68)] sm:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(242,122,134,0.12),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(69,102,214,0.10),transparent_22%)]" />
        <div className="absolute -left-8 top-6 h-28 w-28 rounded-full bg-[#f27a86]/16 blur-3xl" />
        <div className="absolute right-0 top-0 h-24 w-24 rounded-full bg-[#4566d6]/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-[#f27a86]/24 bg-[#3a1820]/88 text-[#ffb4bc] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center rounded-full border border-[#f27a86]/22 bg-[#34161d]/82 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-[#ffb4bc]">
                Eliminar contacto
              </div>
              <h3 className="mt-4 font-display text-[2rem] font-semibold leading-tight text-ink">Confirma antes de borrarlo</h3>
              <p className="mt-3 text-sm leading-7 text-storm">
                Si este contacto ya se usa en movimientos, creditos, deudas o suscripciones, lo mas sano suele ser archivarlo.
              </p>
            </div>
          </div>
          <div className="mt-7 rounded-[28px] border border-white/10 bg-[#0d151f]/92 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
            <p className="text-lg font-semibold text-ink">{contact.name}</p>
            <p className="mt-2 text-sm text-storm">{getTypeDefinition(contact.type).label}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {contact.roles.length > 0 ? (
                contact.roles.map((role) => <StatusBadge key={role} status={getRoleDefinition(role).label} tone={getRoleDefinition(role).tone} />)
              ) : (
                <StatusBadge status="Sin roles" tone="neutral" />
              )}
            </div>
          </div>
          <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button disabled={isDeleting} onClick={onCancel} type="button" variant="ghost">Cancelar</Button>
            <Button className="bg-[#f27a86] text-white hover:bg-[#ff8e98] focus-visible:outline-[#f27a86]" disabled={isDeleting} onClick={onConfirm} type="button">
              {isDeleting ? (
                <>
                  <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar definitivamente
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
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
  const [viewMode, setViewMode] = useViewMode("contacts");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [showArchived, setShowArchived] = useState(false);
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

  const contactsWithExposure = useMemo(() => {
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

  const filteredContacts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return contactsWithExposure.filter((contact) => {
      if (!showArchived && contact.isArchived) {
        return false;
      }

      if (roleFilter !== "all" && !contact.roles.includes(roleFilter)) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      return (
        contact.name.toLowerCase().includes(normalizedSearch) ||
        contact.type.toLowerCase().includes(normalizedSearch) ||
        contact.roles.some((role) => getRoleDefinition(role).label.toLowerCase().includes(normalizedSearch)) ||
        contact.email?.toLowerCase().includes(normalizedSearch) ||
        contact.phone?.toLowerCase().includes(normalizedSearch) ||
        contact.documentNumber?.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [contactsWithExposure, roleFilter, search, showArchived]);

  const totalActiveContacts = contacts.filter((contact) => !contact.isArchived).length;
  const totalArchivedContacts = contacts.filter((contact) => contact.isArchived).length;
  const totalClients = contacts.filter((contact) => contact.roles.includes("client")).length;
  const totalReceivable = contactsWithExposure.reduce((total, contact) => total + contact.receivablePendingInBase, 0);
  const totalPayable = contactsWithExposure.reduce((total, contact) => total + contact.payablePendingInBase, 0);
  const topDebtors = [...contactsWithExposure].filter((contact) => contact.receivablePendingInBase > 0).sort((a, b) => b.receivablePendingInBase - a.receivablePendingInBase).slice(0, 3);
  const topCreditors = [...contactsWithExposure].filter((contact) => contact.payablePendingInBase > 0).sort((a, b) => b.payablePendingInBase - a.payablePendingInBase).slice(0, 3);

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
        <DataState description="Buscando tu espacio actual y sus relaciones principales." title="Sincronizando contactos" />
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
        <DataState description="Consultando roles, exposicion y ultima actividad." title="Preparando el modulo" />
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
      <PageHeader
        actions={<><ViewSelector available={["grid", "list", "table"]} onChange={setViewMode} value={viewMode} /><Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Nuevo contacto</Button></>}
        description="Gestiona clientes, proveedores, bancos y relaciones clave del workspace para entender mejor quien te debe, a quien le debes y con quien se mueve tu dinero."
        eyebrow="contactos"
        title="Contactos"
      />
      {feedback && feedback.tone !== "error" && !isEditorOpen ? <DataState description={feedback.description} title={feedback.title} tone={feedback.tone} /> : null}

      <SurfaceCard action={<Users className="h-5 w-5 text-gold" />} description="Vista general de tu red financiera dentro del workspace." title="Red de contactos">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Activos</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{totalActiveContacts}</p></div>
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Clientes</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{totalClients}</p></div>
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Te deben</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{formatCurrency(totalReceivable, baseCurrencyCode)}</p></div>
          <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Debes</p><p className="mt-3 font-display text-3xl font-semibold text-ink">{formatCurrency(totalPayable, baseCurrencyCode)}</p></div>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink"><ArrowUpCircle className="h-4 w-4 text-pine" />Quienes mas te deben</div>
            <div className="mt-4 space-y-3">
              {topDebtors.length > 0 ? topDebtors.map((contact) => <div className="flex items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-black/15 px-4 py-3" key={contact.id}><div className="min-w-0"><p className="truncate font-medium text-ink">{contact.name}</p><p className="mt-1 text-xs text-storm">{getTypeDefinition(contact.type).label}</p></div><p className="text-sm font-semibold text-ink">{formatCurrency(contact.receivablePendingInBase, baseCurrencyCode)}</p></div>) : <p className="text-sm text-storm">Aun no tienes saldos por cobrar asociados a contactos.</p>}
            </div>
          </div>
          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink"><ArrowDownCircle className="h-4 w-4 text-rosewood" />A quienes mas debes</div>
            <div className="mt-4 space-y-3">
              {topCreditors.length > 0 ? topCreditors.map((contact) => <div className="flex items-center justify-between gap-3 rounded-[20px] border border-white/8 bg-black/15 px-4 py-3" key={contact.id}><div className="min-w-0"><p className="truncate font-medium text-ink">{contact.name}</p><p className="mt-1 text-xs text-storm">{getTypeDefinition(contact.type).label}</p></div><p className="text-sm font-semibold text-ink">{formatCurrency(contact.payablePendingInBase, baseCurrencyCode)}</p></div>) : <p className="text-sm text-storm">Aun no tienes saldos por pagar asociados a contactos.</p>}
            </div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard description="Filtra por nombre, rol o estado para encontrar rapido a cada contacto." title="Explorar contactos">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr_0.6fr]">
          <Input onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, email, rol o documento..." type="text" value={search} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setRoleFilter("all")} variant={roleFilter === "all" ? "primary" : "ghost"}>Todos</Button>
            {roleOptions.map((option) => <Button key={option.value} onClick={() => setRoleFilter(option.value)} variant={roleFilter === option.value ? "primary" : "ghost"}>{option.label}</Button>)}
          </div>
          <Button onClick={() => setShowArchived((currentValue) => !currentValue)} variant={showArchived ? "secondary" : "ghost"}>
            {showArchived ? `Ocultar archivados (${totalArchivedContacts})` : `Ver archivados (${totalArchivedContacts})`}
          </Button>
        </div>
      </SurfaceCard>

      {filteredContacts.length === 0 ? (
        <DataState action={<Button onClick={openCreateEditor}><Plus className="mr-2 h-4 w-4" />Crear primer contacto</Button>} description="Aun no tienes contactos que coincidan con ese filtro dentro del workspace." title="Sin resultados para mostrar" />
      ) : (
        viewMode === "list" ? (
          <div className="space-y-3">
            {filteredContacts.map((contact) => {
              const typeDefinition = getTypeDefinition(contact.type);
              const TypeIcon = typeDefinition.icon;
              return (
                <article className="flex items-center gap-4 rounded-[22px] border border-white/10 bg-white/[0.03] px-5 py-4 transition hover:border-white/16" key={contact.id}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${typeDefinition.color}, rgba(8,13,20,0.72))` }}>
                    <TypeIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{contact.name}</p>
                    <p className="text-xs text-storm">{typeDefinition.label}{contact.roles.length > 0 ? ` · ${contact.roles.map((role) => getRoleDefinition(role).label).join(", ")}` : ""}</p>
                  </div>
                  <div className="hidden sm:flex flex-col text-right shrink-0">
                    <p className="text-sm font-medium text-pine">{formatCurrency(contact.receivablePendingInBase, baseCurrencyCode)}</p>
                    <p className="text-xs text-storm">por cobrar</p>
                  </div>
                  {contact.isArchived ? <StatusBadge status="Archivado" tone="warning" /> : null}
                  <Button className="py-1.5 text-xs shrink-0" onClick={() => openEditEditor(contact)} variant="ghost">Editar</Button>
                </article>
              );
            })}
          </div>
        ) : viewMode === "table" ? (
          <div className="overflow-x-auto rounded-[24px] border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02]">
                  <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Contacto</th>
                  <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 hidden sm:table-cell">Tipo</th>
                  <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 hidden md:table-cell">Por cobrar</th>
                  <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80 hidden md:table-cell">Por pagar</th>
                  <th className="px-5 py-3 text-left text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Estado</th>
                  <th className="px-5 py-3 text-right text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-storm/80">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact, index) => {
                  const typeDefinition = getTypeDefinition(contact.type);
                  const TypeIcon = typeDefinition.icon;
                  return (
                    <tr className={`border-b border-white/[0.05] transition hover:bg-white/[0.02] ${index === filteredContacts.length - 1 ? "border-b-0" : ""}`} key={contact.id}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${typeDefinition.color}, rgba(8,13,20,0.72))` }}>
                            <TypeIcon className="h-3.5 w-3.5" />
                          </div>
                          <p className="font-medium text-ink">{contact.name}</p>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 hidden sm:table-cell"><StatusBadge status={typeDefinition.label} tone="neutral" /></td>
                      <td className="px-5 py-3.5 text-right text-storm hidden md:table-cell">{formatCurrency(contact.receivablePendingInBase, baseCurrencyCode)}</td>
                      <td className="px-5 py-3.5 text-right text-storm hidden md:table-cell">{formatCurrency(contact.payablePendingInBase, baseCurrencyCode)}</td>
                      <td className="px-5 py-3.5">{contact.isArchived ? <StatusBadge status="Archivado" tone="warning" /> : <StatusBadge status="Activo" tone="success" />}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          <Button className="py-1.5 text-xs" onClick={() => openEditEditor(contact)} variant="ghost">Editar</Button>
                          <Button className="py-1.5 text-xs" disabled={isArchiving} onClick={() => { void handleArchive(contact, !contact.isArchived); }} variant="ghost">{contact.isArchived ? "Reactivar" : "Archivar"}</Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
        <section className="grid gap-6 xl:grid-cols-2">
          {filteredContacts.map((contact) => {
            const typeDefinition = getTypeDefinition(contact.type);
            const TypeIcon = typeDefinition.icon;
            const hasNetPositive = contact.receivablePendingInBase >= contact.payablePendingInBase;

            return (
              <SurfaceCard action={<div className="flex flex-wrap gap-2"><StatusBadge status={typeDefinition.label} tone="neutral" />{contact.isArchived ? <StatusBadge status="Archivado" tone="warning" /> : null}</div>} className="glass-panel animate-rise-in rounded-[32px] p-6 transition duration-300 hover:-translate-y-0.5 hover:border-white/20" description={contact.roles.length > 0 ? contact.roles.map((role) => getRoleDefinition(role).label).join(" · ") : "Sin roles definidos aun"} key={contact.id} title={contact.name}>
                <div className="space-y-5">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] border border-white/10 text-white" style={{ background: `linear-gradient(160deg, ${typeDefinition.color}, rgba(8,13,20,0.72))` }}><TypeIcon className="h-6 w-6" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-2">{contact.roles.length > 0 ? contact.roles.map((role) => <StatusBadge key={role} status={getRoleDefinition(role).label} tone={getRoleDefinition(role).tone} />) : <StatusBadge status="Sin roles" tone="neutral" />}</div>
                      <div className="mt-4 grid gap-2 text-sm text-storm">
                        {contact.phone ? <div className="flex items-center gap-2"><Phone className="h-4 w-4" /><span>{contact.phone}</span></div> : null}
                        {contact.email ? <div className="flex items-center gap-2"><Mail className="h-4 w-4" /><span className="truncate">{contact.email}</span></div> : null}
                        {contact.documentNumber ? <div className="flex items-center gap-2"><Fingerprint className="h-4 w-4" /><span>{contact.documentNumber}</span></div> : null}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Por cobrar</p><p className="mt-2 font-display text-3xl font-semibold text-ink">{formatCurrency(contact.receivablePendingInBase, baseCurrencyCode)}</p></div>
                    <div className="glass-panel-soft rounded-[26px] p-4"><p className="text-xs uppercase tracking-[0.18em] text-storm">Por pagar</p><p className="mt-2 font-display text-3xl font-semibold text-ink">{formatCurrency(contact.payablePendingInBase, baseCurrencyCode)}</p></div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"><p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Balance neto</p><p className="mt-3 text-sm font-medium text-ink">{hasNetPositive ? "Mas a tu favor" : "Mas a tu cargo"}</p></div>
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"><p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Registros</p><p className="mt-3 text-sm font-medium text-ink">{contact.receivableCount + contact.payableCount} creditos/deudas</p></div>
                    <div className="rounded-[22px] border border-white/10 bg-white/[0.03] p-4"><p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Ultima actividad</p><p className="mt-3 text-sm font-medium text-ink">{getLastActivityLabel(contact.lastActivityAt)}</p></div>
                  </div>

                  {contact.notes ? <div className="rounded-[24px] border border-white/10 bg-black/15 p-4"><p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">Notas</p><p className="mt-2 text-sm leading-7 text-storm">{contact.notes}</p></div> : null}
                  <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
                    <Button onClick={() => openEditEditor(contact)} variant="secondary"><PencilLine className="mr-2 h-4 w-4" />Editar</Button>
                    <Button disabled={isArchiving} onClick={() => { void handleArchive(contact, !contact.isArchived); }} variant="ghost">{contact.isArchived ? "Reactivar" : "Archivar"}</Button>
                    <Button className="text-[#ffb4bc] hover:text-white" onClick={() => setDeleteTargetId(contact.id)} variant="ghost"><Trash2 className="mr-2 h-4 w-4" />Eliminar</Button>
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </section>
        )
      )}

      {isEditorOpen ? <ContactEditorDialog clearFieldError={clearFieldError} closeEditor={requestCloseEditor} feedback={feedback} formState={formState} invalidFields={invalidFields} isCreateMode={editorMode === "create"} isSaving={isSavingEditor} onSubmit={handleSubmitEditor} updateFormState={updateFormState} /> : null}

      {showUnsavedDialog ? (
        <UnsavedChangesDialog
          onDiscard={() => { setShowUnsavedDialog(false); closeEditor(); }}
          onKeepEditing={() => setShowUnsavedDialog(false)}
        />
      ) : null}
      {deleteTarget ? <DeleteDialog contact={deleteTarget} isDeleting={isDeleting} onCancel={() => { if (!isDeleting) { setDeleteTargetId(null); } }} onConfirm={() => { void handleDelete(); }} /> : null}
    </div>
  );
}
