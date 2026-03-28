import { Lock } from "lucide-react";

import { StatusBadge } from "../../../components/ui/status-badge";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";

const privacySections = [
  {
    title: "1. Informacion que recopilamos",
    body: "Podemos recopilar datos de cuenta, perfil, workspaces, movimientos, categorias, suscripciones, obligaciones, preferencias de notificacion, registros tecnicos y otra informacion necesaria para operar DarkMoney.",
  },
  {
    title: "2. Como usamos la informacion",
    body: "Usamos los datos para autenticar usuarios, mantener la plataforma, mostrar reportes financieros, sincronizar workspaces compartidos, procesar suscripciones premium, mejorar funciones y responder solicitudes de soporte.",
  },
  {
    title: "3. Procesadores y proveedores",
    body: "Podemos compartir informacion estrictamente necesaria con proveedores de infraestructura, autenticacion, almacenamiento, correo, analitica y pagos para prestar el servicio de forma segura y eficiente.",
  },
  {
    title: "4. Pagos",
    body: "Los pagos premium son procesados por proveedores externos especializados. DarkMoney no almacena directamente los datos completos de tarjetas de pago del usuario.",
  },
  {
    title: "5. Conservacion",
    body: "Conservamos la informacion mientras sea necesaria para operar la cuenta, cumplir obligaciones legales, resolver disputas, prevenir fraude y mantener registros razonables del servicio.",
  },
  {
    title: "6. Seguridad",
    body: "Aplicamos medidas razonables de seguridad tecnicas y organizativas para proteger la informacion, aunque ningun sistema conectado a internet puede garantizar seguridad absoluta.",
  },
  {
    title: "7. Tus derechos",
    body: "Puedes solicitar acceso, correccion o eliminacion de ciertos datos conforme a la normativa aplicable y segun lo permita la operacion legitima del servicio.",
  },
  {
    title: "8. Contacto",
    body: `Si tienes preguntas sobre privacidad o tratamiento de datos, puedes comunicarte a ${PUBLIC_CONTACT.supportEmail}, al telefono ${PUBLIC_CONTACT.supportPhoneDisplay} o por los canales publicos de DarkMoney. ${PUBLIC_CONTACT.taxIdLabel} ${PUBLIC_CONTACT.taxIdValue}.`,
  },
];

export function PrivacyPage() {
  return (
    <div className="flex flex-col items-center gap-12 pb-10">
      {/* Hero */}
      <section className="flex max-w-2xl flex-col items-center gap-4 pt-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-ember/20 bg-ember/10">
          <Lock className="h-6 w-6 text-ember" />
        </div>
        <StatusBadge status="Privacidad" tone="info" />
        <h1 className="text-balance font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
          Politica de Privacidad
        </h1>
        <p className="text-balance max-w-lg text-sm leading-8 text-storm">
          Te explicamos que datos usamos, por que los usamos y como protegemos la
          informacion relacionada con tu cuenta y actividad en DarkMoney.
        </p>
        <p className="text-xs tracking-wide text-storm/50">
          Ultima actualizacion: 26 de marzo de 2026
        </p>
      </section>

      {/* Content */}
      <div className="glass-panel w-full max-w-3xl rounded-[32px] p-8 sm:p-10">
        <div className="flex flex-col">
          {privacySections.map((section, index) => (
            <div
              className="py-8 first:pt-0 last:pb-0 [&+&]:border-t [&+&]:border-white/[0.06]"
              key={section.title}
            >
              <div className="flex items-start gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-ember/20 bg-ember/10 text-xs font-semibold text-ember">
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
