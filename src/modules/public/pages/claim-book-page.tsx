import {
  BookText,
  FileBadge2,
  Landmark,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";

import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import {
  PUBLIC_CONTACT,
  PUBLIC_CONTACT_LINKS,
} from "../../../lib/public-contact";
import {
  createClaimCode,
  useSubmitClaimBookEntryMutation,
} from "../../../services/queries/public-data";

type ClaimBookFormState = {
  consumerName: string;
  documentType: string;
  documentNumber: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  assetType: "producto" | "servicio";
  complaintType: "reclamo" | "queja";
  orderReference: string;
  amountClaimed: string;
  currencyCode: string;
  description: string;
  requestedResolution: string;
  truthConfirmation: boolean;
  dataProcessingConfirmation: boolean;
};

const documentTypeOptions = ["DNI", "CE", "Pasaporte", "RUC", "Otro"];

function createDefaultFormState(): ClaimBookFormState {
  return {
    consumerName: "",
    documentType: "DNI",
    documentNumber: "",
    email: "",
    phone: "",
    address: "",
    city: "Chiclayo",
    assetType: "servicio",
    complaintType: "reclamo",
    orderReference: "",
    amountClaimed: "",
    currencyCode: "PEN",
    description: "",
    requestedResolution: "",
    truthConfirmation: false,
    dataProcessingConfirmation: false,
  };
}

function Field({
  children,
  hint,
  label,
}: {
  children: ReactNode;
  hint?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint ? <span className="text-xs leading-6 text-storm">{hint}</span> : null}
    </label>
  );
}

export function ClaimBookPage() {
  const submitClaimBookEntryMutation = useSubmitClaimBookEntryMutation();
  const [formState, setFormState] = useState<ClaimBookFormState>(() =>
    createDefaultFormState(),
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [successState, setSuccessState] = useState<{
    claimCode: string;
    submittedAt: string;
  } | null>(null);

  const responseDeadlineText = useMemo(() => {
    const baseDate = successState?.submittedAt
      ? new Date(successState.submittedAt)
      : new Date();
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + 15);

    return dueDate.toLocaleDateString("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [successState?.submittedAt]);

  function updateField<FieldKey extends keyof ClaimBookFormState>(
    field: FieldKey,
    value: ClaimBookFormState[FieldKey],
  ) {
    setFormState((currentState) => ({
      ...currentState,
      [field]: value,
    }));
  }

  function resetForm() {
    setFormState(createDefaultFormState());
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessState(null);

    if (
      !formState.consumerName.trim() ||
      !formState.documentNumber.trim() ||
      !formState.email.trim() ||
      !formState.phone.trim() ||
      !formState.address.trim() ||
      !formState.city.trim() ||
      !formState.description.trim() ||
      !formState.requestedResolution.trim()
    ) {
      setErrorMessage(
        "Completa tus datos y describe claramente el reclamo o la queja antes de enviarlo.",
      );
      return;
    }

    if (!formState.truthConfirmation || !formState.dataProcessingConfirmation) {
      setErrorMessage(
        "Necesitamos tu confirmacion sobre la veracidad de la informacion y el tratamiento de datos para registrar el reclamo.",
      );
      return;
    }

    const amountValue = formState.amountClaimed.trim()
      ? Number(formState.amountClaimed)
      : null;

    if (
      formState.amountClaimed.trim() &&
      (amountValue === null || Number.isNaN(amountValue) || amountValue < 0)
    ) {
      setErrorMessage("El monto reclamado debe ser un numero valido.");
      return;
    }

    try {
      const result = await submitClaimBookEntryMutation.mutateAsync({
        claimCode: createClaimCode(),
        consumerName: formState.consumerName,
        documentType: formState.documentType,
        documentNumber: formState.documentNumber,
        email: formState.email,
        phone: formState.phone,
        address: formState.address,
        city: formState.city,
        assetType: formState.assetType,
        complaintType: formState.complaintType,
        orderReference: formState.orderReference,
        amountClaimed: amountValue,
        currencyCode: amountValue === null ? null : formState.currencyCode,
        description: formState.description,
        requestedResolution: formState.requestedResolution,
        truthConfirmation: formState.truthConfirmation,
        dataProcessingConfirmation: formState.dataProcessingConfirmation,
      });

      setSuccessState(result);
      resetForm();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No pudimos registrar tu reclamo en este momento.",
      );
    }
  }

  return (
    <div className="grid gap-6">
      <SurfaceCard
        action={<StatusBadge status="INDECOPI visible" tone="warning" />}
        description="Este libro de reclamaciones esta integrado dentro de DarkMoney y permite registrar reclamos o quejas sin depender de formularios externos."
        title="Libro de Reclamaciones"
      >
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="glass-panel-soft rounded-[28px] p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.05] text-ink">
                <BookText className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-storm">
                  Canal formal
                </p>
                <h2 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-ink">
                  Registra tu caso y recibe un codigo de seguimiento
                </h2>
              </div>
            </div>

            <p className="mt-5 text-sm leading-8 text-storm">
              Usa este formulario para reportar un reclamo o una queja sobre el
              servicio. DarkMoney registrara tu envio con un codigo unico para
              seguimiento y respondera por los canales indicados.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge status="Reclamos y quejas" tone="info" />
              <StatusBadge status="Sin Google Forms" tone="success" />
              <StatusBadge status="Seguimiento interno" tone="warning" />
            </div>
          </div>

          <div className="grid gap-4">
            <div className="glass-panel-soft rounded-[28px] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-storm">
                Contacto del proveedor
              </p>
              <div className="mt-4 grid gap-3 text-sm text-storm">
                <a
                  className="flex items-center gap-3 transition hover:text-ink"
                  href={PUBLIC_CONTACT_LINKS.email}
                >
                  <Mail className="h-4 w-4 text-pine" />
                  {PUBLIC_CONTACT.supportEmail}
                </a>
                <a
                  className="flex items-center gap-3 transition hover:text-ink"
                  href={PUBLIC_CONTACT_LINKS.phone}
                >
                  <Phone className="h-4 w-4 text-pine" />
                  {PUBLIC_CONTACT.supportPhoneDisplay}
                </a>
                <div className="flex items-center gap-3">
                  <Landmark className="h-4 w-4 text-pine" />
                  {PUBLIC_CONTACT.cityCountry}
                </div>
                <div className="flex items-center gap-3">
                  <FileBadge2 className="h-4 w-4 text-pine" />
                  {PUBLIC_CONTACT.taxIdLabel} {PUBLIC_CONTACT.taxIdValue}
                </div>
              </div>
            </div>

            <div className="glass-panel-soft rounded-[28px] p-5">
              <p className="text-xs uppercase tracking-[0.22em] text-storm">
                Nota legal
              </p>
              <p className="mt-4 text-sm leading-7 text-storm">
                Reclamo: disconformidad relacionada con el servicio o su resultado.
                Queja: malestar por atencion, demora o trato recibido que no
                necesariamente implica devolucion economica.
              </p>
              <div className="mt-4 flex items-start gap-3 rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
                <p className="text-sm leading-7 text-storm">
                  Conserva el codigo del libro. Te ayudara a dar seguimiento al
                  caso por correo o telefono.
                </p>
              </div>
            </div>
          </div>
        </div>
      </SurfaceCard>

      {errorMessage ? (
        <FormFeedbackBanner
          description={errorMessage}
          title="No pudimos registrar tu reclamo"
          tone="error"
        />
      ) : null}

      {successState ? (
        <FormFeedbackBanner
          description={`Tu registro fue guardado con el codigo ${successState.claimCode}. Te responderemos por los canales indicados. Fecha referencial de revision: ${responseDeadlineText}.`}
          title="Libro de reclamaciones registrado"
          tone="success"
        />
      ) : null}

      <SurfaceCard
        description="Completa la informacion minima para dejar constancia formal del caso."
        title="Formulario integrado"
      >
        <form className="grid gap-6" onSubmit={(event) => void handleSubmit(event)}>
          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Nombre completo">
              <input
                className="field-dark"
                onChange={(event) => updateField("consumerName", event.target.value)}
                placeholder="Ej. Maria Perez Torres"
                type="text"
                value={formState.consumerName}
              />
            </Field>

            <Field label="Correo electronico">
              <input
                className="field-dark"
                onChange={(event) => updateField("email", event.target.value)}
                placeholder="correo@ejemplo.com"
                type="email"
                value={formState.email}
              />
            </Field>

            <Field label="Tipo de documento">
              <select
                className="field-dark"
                onChange={(event) => updateField("documentType", event.target.value)}
                value={formState.documentType}
              >
                {documentTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Numero de documento">
              <input
                className="field-dark"
                onChange={(event) => updateField("documentNumber", event.target.value)}
                placeholder="Ej. 12345678"
                type="text"
                value={formState.documentNumber}
              />
            </Field>

            <Field label="Telefono de contacto">
              <input
                className="field-dark"
                onChange={(event) => updateField("phone", event.target.value)}
                placeholder="Ej. 999 111 222"
                type="text"
                value={formState.phone}
              />
            </Field>

            <Field label="Ciudad">
              <input
                className="field-dark"
                onChange={(event) => updateField("city", event.target.value)}
                placeholder="Ej. Chiclayo"
                type="text"
                value={formState.city}
              />
            </Field>
          </div>

          <Field label="Direccion del consumidor">
            <input
              className="field-dark"
              onChange={(event) => updateField("address", event.target.value)}
              placeholder="Ej. Calle y referencia"
              type="text"
              value={formState.address}
            />
          </Field>

          <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Bien contratado">
              <select
                className="field-dark"
                onChange={(event) =>
                  updateField(
                    "assetType",
                    event.target.value as ClaimBookFormState["assetType"],
                  )
                }
                value={formState.assetType}
              >
                <option value="servicio">Servicio</option>
                <option value="producto">Producto</option>
              </select>
            </Field>

            <Field label="Tipo de registro">
              <select
                className="field-dark"
                onChange={(event) =>
                  updateField(
                    "complaintType",
                    event.target.value as ClaimBookFormState["complaintType"],
                  )
                }
                value={formState.complaintType}
              >
                <option value="reclamo">Reclamo</option>
                <option value="queja">Queja</option>
              </select>
            </Field>

            <Field
              hint="Opcional. Puedes colocar un numero de pedido, cobro o referencia interna."
              label="Referencia"
            >
              <input
                className="field-dark"
                onChange={(event) => updateField("orderReference", event.target.value)}
                placeholder="Ej. DM-PRO-2026-001"
                type="text"
                value={formState.orderReference}
              />
            </Field>

            <Field label="Monto reclamado">
              <div className="grid gap-3 sm:grid-cols-[0.7fr_0.3fr]">
                <input
                  className="field-dark"
                  onChange={(event) => updateField("amountClaimed", event.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  type="number"
                  value={formState.amountClaimed}
                />
                <input
                  className="field-dark"
                  maxLength={3}
                  onChange={(event) => updateField("currencyCode", event.target.value)}
                  placeholder="PEN"
                  type="text"
                  value={formState.currencyCode}
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-5">
            <Field label="Detalle del reclamo o queja">
              <textarea
                className="field-dark min-h-[150px] resize-y"
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Describe lo ocurrido con la mayor claridad posible."
                value={formState.description}
              />
            </Field>

            <Field label="Pedido del consumidor">
              <textarea
                className="field-dark min-h-[130px] resize-y"
                onChange={(event) =>
                  updateField("requestedResolution", event.target.value)
                }
                placeholder="Indica que solucion esperas recibir."
                value={formState.requestedResolution}
              />
            </Field>
          </div>

          <div className="grid gap-3 rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
            <label className="flex items-start gap-3 text-sm leading-7 text-storm">
              <input
                checked={formState.truthConfirmation}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                onChange={(event) =>
                  updateField("truthConfirmation", event.target.checked)
                }
                type="checkbox"
              />
              Confirmo que los datos consignados son reales y corresponden al caso
              reportado.
            </label>

            <label className="flex items-start gap-3 text-sm leading-7 text-storm">
              <input
                checked={formState.dataProcessingConfirmation}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                onChange={(event) =>
                  updateField("dataProcessingConfirmation", event.target.checked)
                }
                type="checkbox"
              />
              Autorizo el tratamiento de mis datos para atender este reclamo o
              queja y dar seguimiento por correo o telefono.
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={submitClaimBookEntryMutation.isPending} type="submit">
              {submitClaimBookEntryMutation.isPending
                ? "Registrando..."
                : "Registrar en el libro"}
            </Button>
            <a href={PUBLIC_CONTACT_LINKS.whatsapp} rel="noreferrer" target="_blank">
              <Button variant="ghost">Contactar soporte</Button>
            </a>
          </div>
        </form>
      </SurfaceCard>
    </div>
  );
}
