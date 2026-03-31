import { RotateCcw } from "lucide-react";

import { StatusBadge } from "../../../components/ui/status-badge";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";

const refundsSections = [
  {
    title: "1. Naturaleza del servicio",
    body: "DarkMoney vende acceso digital a software y funciones premium. Al tratarse de un servicio digital, el acceso puede activarse inmediatamente despues de la compra o confirmacion del proveedor de pagos.",
  },
  {
    title: "2. Cancelacion de suscripciones",
    body: "El usuario puede cancelar futuras renovaciones desde su cuenta. La cancelacion evita cobros posteriores, pero el acceso premium se mantiene hasta el final del periodo ya pagado.",
  },
  {
    title: "3. Reembolsos",
    body: "Las compras digitales y suscripciones ya activadas normalmente no son reembolsables, salvo que exista un cobro duplicado, un error claro de procesamiento, un cargo no autorizado validado o un caso exigido por ley aplicable.",
  },
  {
    title: "4. Renovaciones ya procesadas",
    body: "No ofrecemos reembolsos parciales por tiempo transcurrido de un periodo de suscripcion ya iniciado, excepto cuando corresponda por ley o por una incidencia comprobada de cobro.",
  },
  {
    title: "5. Solicitudes",
    body: `Si crees que hubo un error de cobro, puedes solicitar revision escribiendo a ${PUBLIC_CONTACT.supportEmail} o registrando el caso en el Libro de Reclamaciones de DarkMoney, incluyendo correo de la cuenta, fecha del cargo y una descripcion breve del problema.`,
  },
  {
    title: "6. Tiempos de revision",
    body: "Las solicitudes se revisan caso por caso. Si procede un reembolso, el plazo y forma de devolucion dependeran tambien del proveedor de pagos y de la entidad financiera utilizada por el usuario.",
  },
];

export function RefundsPage() {
  return (
    <div className="flex w-full flex-col gap-10 pb-10">
      {/* Hero */}
      <section className="flex w-full flex-col gap-5 border-b border-white/[0.06] pb-10 pt-4 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] border border-gold/20 bg-gold/10">
          <RotateCcw className="h-6 w-6 text-gold" />
        </div>
        <div className="min-w-0 flex-1">
          <StatusBadge status="Devoluciones" tone="warning" />
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
            Politica de Reembolsos
          </h1>
          <p className="mt-3 text-sm leading-8 text-storm sm:max-w-3xl">
            Resumen de como manejamos cancelaciones, renovaciones y solicitudes de
            reembolso relacionadas con accesos premium en DarkMoney.
          </p>
          <p className="mt-4 text-xs tracking-wide text-storm/50">
            Ultima actualizacion: 26 de marzo de 2026
          </p>
        </div>
      </section>

      {/* Content */}
      <div className="glass-panel w-full rounded-[32px] p-8 sm:p-10">
        <div className="flex flex-col">
          {refundsSections.map((section, index) => (
            <div
              className="py-8 first:pt-0 last:pb-0 [&+&]:border-t [&+&]:border-white/[0.06]"
              key={section.title}
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/20 bg-gold/10 text-xs font-semibold text-gold">
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {section.title.replace(/^\d+\.\s/, "")}
                  </h2>
                  <p className="mt-3 text-sm leading-8 text-storm">{section.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
