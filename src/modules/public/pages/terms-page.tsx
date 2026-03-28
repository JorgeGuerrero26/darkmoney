import { FileText } from "lucide-react";

import { StatusBadge } from "../../../components/ui/status-badge";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";

const termsSections = [
  {
    title: "1. Servicio",
    body: "DarkMoney es una aplicacion web de software como servicio para gestion financiera personal y colaborativa. El servicio ayuda a registrar cuentas, movimientos, suscripciones, obligaciones y espacios compartidos.",
  },
  {
    title: "2. Cuenta y acceso",
    body: "Para usar DarkMoney debes proporcionar informacion veraz, mantener segura tu cuenta y no compartir acceso con terceros de manera indebida. Eres responsable de la actividad realizada desde tu cuenta.",
  },
  {
    title: "3. Planes y facturacion",
    body: "Algunas funciones estan disponibles solo para usuarios premium. Las suscripciones se cobran de forma recurrente segun las condiciones mostradas en el checkout. El usuario puede cancelar futuras renovaciones desde su cuenta, y el acceso premium permanece activo hasta el final del periodo ya pagado.",
  },
  {
    title: "4. Uso permitido",
    body: "No puedes usar DarkMoney para actividades ilegales, fraudulentas, abusivas, ni para intentar vulnerar la plataforma, acceder sin autorizacion a datos de terceros o interferir con el servicio.",
  },
  {
    title: "5. Datos y disponibilidad",
    body: "Hacemos esfuerzos razonables para mantener la plataforma disponible y proteger la informacion, pero no garantizamos continuidad absoluta, ausencia total de errores ni disponibilidad ininterrumpida.",
  },
  {
    title: "6. Propiedad intelectual",
    body: "El software, marca, diseno, interfaces, contenido propio y elementos distintivos de DarkMoney pertenecen a su titular y no pueden copiarse, revenderse ni explotarse sin autorizacion.",
  },
  {
    title: "7. Sin asesoramiento financiero",
    body: "DarkMoney es una herramienta de software y no constituye asesoramiento financiero, contable, legal o tributario. Cada usuario es responsable de sus decisiones y del uso que haga de la informacion mostrada.",
  },
  {
    title: "8. Terminacion",
    body: "Podemos suspender o limitar cuentas que incumplan estas condiciones, representen riesgo para la plataforma o intenten usar el servicio de forma abusiva o fraudulenta.",
  },
  {
    title: "9. Contacto",
    body: `Para consultas sobre estos terminos o sobre el servicio, puedes escribirnos a ${PUBLIC_CONTACT.supportEmail}, llamar al ${PUBLIC_CONTACT.supportPhoneDisplay} o ubicar al proveedor en ${PUBLIC_CONTACT.cityCountry}. ${PUBLIC_CONTACT.taxIdLabel} ${PUBLIC_CONTACT.taxIdValue}.`,
  },
];

export function TermsPage() {
  return (
    <div className="flex flex-col items-center gap-12 pb-10">
      {/* Hero */}
      <section className="flex max-w-2xl flex-col items-center gap-4 pt-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/[0.05]">
          <FileText className="h-6 w-6 text-storm" />
        </div>
        <StatusBadge status="Legal" tone="neutral" />
        <h1 className="text-balance font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
          Terminos de Servicio
        </h1>
        <p className="text-balance max-w-lg text-sm leading-8 text-storm">
          Estas condiciones regulan el acceso y uso de DarkMoney, incluyendo la creacion
          de cuenta y la contratacion de funciones premium.
        </p>
        <p className="text-xs tracking-wide text-storm/50">
          Ultima actualizacion: 26 de marzo de 2026
        </p>
      </section>

      {/* Content */}
      <div className="glass-panel w-full max-w-3xl rounded-[32px] p-8 sm:p-10">
        <div className="flex flex-col">
          {termsSections.map((section, index) => (
            <div
              className="py-8 first:pt-0 last:pb-0 [&+&]:border-t [&+&]:border-white/[0.06]"
              key={section.title}
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-xs font-semibold text-storm">
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
