import {
  Building2,
  Landmark,
  LoaderCircle,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  Users,
  X,
} from "lucide-react";
import type { FormEvent, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useState } from "react";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { UnsavedChangesDialog } from "../../../components/ui/unsaved-changes-dialog";
import type { CounterpartySummary } from "../../../types/domain";
import {
  getQueryErrorMessage,
  useCreateCounterpartyMutation,
} from "../../../services/queries/workspace-data";

type ContactQuickCreateDialogProps = {
  initialName?: string;
  onClose: () => void;
  onCreated: (contact: CounterpartySummary) => void;
  subtitle?: string;
  userId: string;
  workspaceId: number;
};

type ContactQuickCreateFormState = {
  email: string;
  name: string;
  notes: string;
  phone: string;
  type: CounterpartySummary["type"];
};

const fieldClassName =
  "w-full rounded-[24px] border border-white/10 bg-[#0d1420]/95 px-4 text-sm text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition duration-200 placeholder:text-storm/70 hover:border-white/14 hover:bg-[#101928] focus:border-pine/25 focus:bg-[#111b2a] focus:shadow-[0_0_0_4px_rgba(107,228,197,0.08)]";
const inputClassName = `${fieldClassName} h-14`;
const textareaClassName = `${fieldClassName} min-h-[130px] py-4 leading-7`;

const typeOptions = [
  {
    color: "#1b6a58",
    description: "Familiares, amigos o personas individuales.",
    icon: UserRound,
    label: "Persona",
    value: "person" as const,
  },
  {
    color: "#4566d6",
    description: "Clientes, empleadores o compañías.",
    icon: Building2,
    label: "Empresa",
    value: "company" as const,
  },
  {
    color: "#c46a31",
    description: "Tiendas, comercios o vendedores frecuentes.",
    icon: Building2,
    label: "Comercio",
    value: "merchant" as const,
  },
  {
    color: "#8366f2",
    description: "Servicios digitales o profesionales.",
    icon: ShieldCheck,
    label: "Servicio",
    value: "service" as const,
  },
  {
    color: "#0f766e",
    description: "Bancos, cajas o entidades financieras.",
    icon: Landmark,
    label: "Banco",
    value: "bank" as const,
  },
  {
    color: "#64748b",
    description: "Cualquier otro tipo de relación.",
    icon: Users,
    label: "Otro",
    value: "other" as const,
  },
] as const;

function createDefaultFormState(initialName?: string): ContactQuickCreateFormState {
  return {
    email: "",
    name: initialName?.trim() ?? "",
    notes: "",
    phone: "",
    type: "person",
  };
}

function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${inputClassName} ${className}`} {...props} />;
}

function Textarea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${textareaClassName} ${className}`} {...props} />;
}

export function ContactQuickCreateDialog({
  initialName,
  onClose,
  onCreated,
  subtitle,
  userId,
  workspaceId,
}: ContactQuickCreateDialogProps) {
  const [formState, setFormState] = useState<ContactQuickCreateFormState>(() =>
    createDefaultFormState(initialName),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const createCounterpartyMutation = useCreateCounterpartyMutation(workspaceId, userId);
  const isSaving = createCounterpartyMutation.isPending;
  const selectedType =
    typeOptions.find((option) => option.value === formState.type) ?? typeOptions[0];
  const SelectedTypeIcon = selectedType.icon;

  function updateFormState<Field extends keyof ContactQuickCreateFormState>(
    field: Field,
    value: ContactQuickCreateFormState[Field],
  ) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedName = formState.name.trim();

    if (!normalizedName) {
      setErrorMessage("Escribe un nombre para guardar el contacto.");
      return;
    }

    setErrorMessage("");

    try {
      const result = await createCounterpartyMutation.mutateAsync({
        documentNumber: null,
        email: formState.email,
        name: normalizedName,
        notes: formState.notes,
        phone: formState.phone,
        roles: [],
        type: formState.type,
        userId,
        workspaceId,
      });

      onCreated({
        id: result.id,
        isArchived: false,
        name: normalizedName,
        type: formState.type,
      });
    } catch (error) {
      setErrorMessage(
        getQueryErrorMessage(error, "No pudimos crear este contacto en este momento."),
      );
    }
  }

  const isDirty =
    formState.name.trim() !== (initialName?.trim() ?? "") ||
    formState.email !== "" ||
    formState.phone !== "" ||
    formState.notes !== "";

  function handleRequestClose() {
    if (isDirty) {
      setShowUnsavedWarning(true);
    } else {
      onClose();
    }
  }

  return (
    <div
      aria-labelledby="contact-create-title"
      aria-modal="true"
      className="fixed inset-0 z-[95] isolate overflow-y-auto bg-[#02060d]/84 p-3 backdrop-blur-xl before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-32 before:bg-[#02060d]/70 before:backdrop-blur-2xl before:content-[''] sm:p-6"
      onClick={handleRequestClose}
      role="dialog"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-rise-in relative w-full max-w-[860px] overflow-hidden rounded-[34px] [transform:translateZ(0)] border border-white/10 bg-[#060b12]/95 shadow-[0_40px_130px_rgba(0,0,0,0.62)]" onClick={(event) => event.stopPropagation()}>
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute -left-12 top-8 h-48 w-48 rounded-full blur-3xl"
              style={{ backgroundColor: `${selectedType.color}30` }}
            />
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-[#7a8cff]/10 blur-3xl" />
          </div>

          <form className="relative flex flex-col" noValidate onSubmit={(event) => void handleSubmit(event)}>
            <div className="px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/90">
                      nuevo contacto
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-storm">
                      {subtitle ?? "Crealo sin salir del formulario actual"}
                    </span>
                  </div>
                  <h2 className="mt-4 font-display text-3xl font-semibold text-ink sm:text-[2.5rem]" id="contact-create-title">
                    Agregar contraparte
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-7 text-storm">
                    Registra rápido a la persona, empresa o banco relacionado y déjalo
                    seleccionado para este movimiento.
                  </p>
                </div>
                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-storm transition duration-200 hover:border-white/16 hover:bg-white/[0.08] hover:text-ink"
                  disabled={isSaving}
                  onClick={handleRequestClose}
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {errorMessage ? (
                <FormFeedbackBanner
                  className="mt-6"
                  description={errorMessage}
                  title="Revisa este contacto antes de guardarlo"
                />
              ) : null}

              <div className="mt-7 grid gap-5 lg:grid-cols-[1.02fr_0.98fr]">
                <div className="rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(18,31,41,0.96),rgba(8,12,20,0.92))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.34)]">
                  <div className="flex items-start gap-4">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-white/10 text-white"
                      style={{
                        background: `linear-gradient(160deg, ${selectedType.color}, rgba(8,13,20,0.72))`,
                      }}
                    >
                      <SelectedTypeIcon className="h-7 w-7" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Vista previa
                      </p>
                      <h3 className="mt-2 break-words font-display text-3xl font-semibold text-ink">
                        {formState.name.trim() || "Nuevo contacto"}
                      </h3>
                      <p className="mt-3 text-sm leading-7 text-storm">{selectedType.description}</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-white/10 bg-black/15 px-4 py-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Tipo
                      </p>
                      <p className="mt-3 font-display text-2xl font-semibold text-ink">
                        {selectedType.label}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-white/10 bg-black/15 px-4 py-4">
                      <p className="text-[0.68rem] uppercase tracking-[0.24em] text-storm/75">
                        Uso
                      </p>
                      <p className="mt-3 text-sm leading-7 text-storm">
                        Te servirá en ingresos, gastos, créditos, deudas y suscripciones.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="glass-panel-soft rounded-[30px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <label className="block">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                      Nombre
                    </span>
                    <div className="mt-3">
                      <Input
                        autoFocus
                        maxLength={120}
                        onChange={(event) => updateFormState("name", event.target.value)}
                        placeholder="Ej. Sergio Rojas"
                        type="text"
                        value={formState.name}
                      />
                    </div>
                  </label>

                  <div className="mt-5">
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                      Tipo
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {typeOptions.map((option) => {
                        const isSelected = option.value === formState.type;
                        const OptionIcon = option.icon;

                        return (
                          <button
                            className={`rounded-[22px] border p-4 text-left transition duration-200 ${
                              isSelected
                                ? "border-white/20 bg-white/[0.07] shadow-[0_0_0_3px_rgba(107,228,197,0.08)]"
                                : "border-white/8 bg-[#0d1623] hover:border-white/12"
                            }`}
                            key={option.value}
                            onClick={() => updateFormState("type", option.value)}
                            type="button"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] border border-white/10 text-white"
                                style={{ backgroundColor: `${option.color}33` }}
                              >
                                <OptionIcon className="h-5 w-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-medium text-ink">{option.label}</p>
                                <p className="mt-1 text-xs leading-6 text-storm">
                                  {option.description}
                                </p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div className="glass-panel-soft rounded-[30px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <p className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                    Contacto
                  </p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Teléfono
                      </span>
                      <div className="relative mt-3">
                        <Phone className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
                        <Input
                          className="pl-11"
                          onChange={(event) => updateFormState("phone", event.target.value)}
                          placeholder="Opcional"
                          type="text"
                          value={formState.phone}
                        />
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                        Email
                      </span>
                      <div className="relative mt-3">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-storm" />
                        <Input
                          className="pl-11"
                          onChange={(event) => updateFormState("email", event.target.value)}
                          placeholder="Opcional"
                          type="email"
                          value={formState.email}
                        />
                      </div>
                    </label>
                  </div>
                </div>

                <div className="glass-panel-soft rounded-[30px] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
                  <label className="block">
                    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-storm/80">
                      Notas
                    </span>
                    <div className="mt-3">
                      <Textarea
                        onChange={(event) => updateFormState("notes", event.target.value)}
                        placeholder="Ej. Primo Sergio, suele transferir a esta cuenta."
                        value={formState.notes}
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 border-t border-white/8 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-sm text-storm">
                También lo verás después en el módulo de contactos para editarlo o archivarlo.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button disabled={isSaving} onClick={handleRequestClose} type="button" variant="ghost">
                  Cancelar
                </Button>
                <Button disabled={isSaving} type="submit">
                  {isSaving ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Crear contacto
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {showUnsavedWarning ? (
        <UnsavedChangesDialog
          onDiscard={onClose}
          onKeepEditing={() => setShowUnsavedWarning(false)}
        />
      ) : null}
    </div>
  );
}
