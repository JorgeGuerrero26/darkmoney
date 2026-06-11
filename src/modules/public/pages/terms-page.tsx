import { FileText } from "lucide-react";

import { usePageMeta } from "../../../hooks/use-page-meta";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";
import { LegalPageLayout } from "../components/legal-page-layout";
import type { LegalSection } from "../components/legal-page-layout";

const termsSections: LegalSection[] = [
  {
    id: "servicio",
    title: "Servicio",
    body: "DarkMoney es una aplicacion web de software como servicio para gestion financiera personal y colaborativa. El servicio ayuda a registrar cuentas, movimientos, suscripciones, obligaciones y espacios compartidos.",
  },
  {
    id: "cuenta-y-acceso",
    title: "Cuenta y acceso",
    body: "Para usar DarkMoney debes proporcionar informacion veraz, mantener segura tu cuenta y no compartir acceso con terceros de manera indebida. Eres responsable de la actividad realizada desde tu cuenta.",
  },
  {
    id: "planes-y-facturacion",
    title: "Planes y facturacion",
    body: "Algunas funciones estan disponibles solo para usuarios premium. Las suscripciones se cobran de forma recurrente segun las condiciones mostradas en el checkout. El usuario puede cancelar futuras renovaciones desde su cuenta, y el acceso premium permanece activo hasta el final del periodo ya pagado.",
  },
  {
    id: "uso-permitido",
    title: "Uso permitido",
    body: "No puedes usar DarkMoney para actividades ilegales, fraudulentas, abusivas, ni para intentar vulnerar la plataforma, acceder sin autorizacion a datos de terceros o interferir con el servicio.",
  },
  {
    id: "datos-y-disponibilidad",
    title: "Datos y disponibilidad",
    body: "Hacemos esfuerzos razonables para mantener la plataforma disponible y proteger la informacion, pero no garantizamos continuidad absoluta, ausencia total de errores ni disponibilidad ininterrumpida.",
  },
  {
    id: "propiedad-intelectual",
    title: "Propiedad intelectual",
    body: "El software, marca, diseno, interfaces, contenido propio y elementos distintivos de DarkMoney pertenecen a su titular y no pueden copiarse, revenderse ni explotarse sin autorizacion.",
  },
  {
    id: "sin-asesoramiento-financiero",
    title: "Sin asesoramiento financiero",
    body: "DarkMoney es una herramienta de software y no constituye asesoramiento financiero, contable, legal o tributario. Cada usuario es responsable de sus decisiones y del uso que haga de la informacion mostrada.",
  },
  {
    id: "terminacion",
    title: "Terminacion",
    body: "Podemos suspender o limitar cuentas que incumplan estas condiciones, representen riesgo para la plataforma o intenten usar el servicio de forma abusiva o fraudulenta.",
  },
  {
    id: "contacto",
    title: "Contacto",
    body: `Para consultas sobre estos terminos o sobre el servicio, puedes escribirnos a ${PUBLIC_CONTACT.supportEmail}, llamar al ${PUBLIC_CONTACT.supportPhoneDisplay} o ubicar al proveedor en ${PUBLIC_CONTACT.cityCountry}. ${PUBLIC_CONTACT.taxIdLabel} ${PUBLIC_CONTACT.taxIdValue}.`,
  },
];

export function TermsPage() {
  usePageMeta({
    title: "Términos de Servicio",
    description:
      "Condiciones de acceso y uso de DarkMoney: cuenta, planes, facturación, uso permitido y contacto del proveedor.",
  });

  return (
    <LegalPageLayout
      badge="Legal"
      badgeTone="neutral"
      icon={FileText}
      iconClassName="text-storm"
      intro="Estas condiciones regulan el acceso y uso de DarkMoney, incluyendo la creacion de cuenta y la contratacion de funciones premium."
      sections={termsSections}
      title="Terminos de Servicio"
      updatedAt="26 de marzo de 2026"
    />
  );
}
