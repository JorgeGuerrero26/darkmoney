import { RotateCcw } from "lucide-react";

import { usePageMeta } from "../../../hooks/use-page-meta";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";
import { LegalPageLayout } from "../components/legal-page-layout";
import type { LegalSection } from "../components/legal-page-layout";

const refundsSections: LegalSection[] = [
  {
    id: "naturaleza-del-servicio",
    title: "Naturaleza del servicio",
    body: "DarkMoney vende acceso digital a software y funciones premium. Al tratarse de un servicio digital, el acceso puede activarse inmediatamente despues de la compra o confirmacion del proveedor de pagos.",
  },
  {
    id: "cancelacion-de-suscripciones",
    title: "Cancelacion de suscripciones",
    body: "El usuario puede cancelar futuras renovaciones desde su cuenta. La cancelacion evita cobros posteriores, pero el acceso premium se mantiene hasta el final del periodo ya pagado.",
  },
  {
    id: "reembolsos",
    title: "Reembolsos",
    body: "Las compras digitales y suscripciones ya activadas normalmente no son reembolsables, salvo que exista un cobro duplicado, un error claro de procesamiento, un cargo no autorizado validado o un caso exigido por ley aplicable.",
  },
  {
    id: "renovaciones-ya-procesadas",
    title: "Renovaciones ya procesadas",
    body: "No ofrecemos reembolsos parciales por tiempo transcurrido de un periodo de suscripcion ya iniciado, excepto cuando corresponda por ley o por una incidencia comprobada de cobro.",
  },
  {
    id: "solicitudes",
    title: "Solicitudes",
    body: `Si crees que hubo un error de cobro, puedes solicitar revision escribiendo a ${PUBLIC_CONTACT.supportEmail} o registrando el caso en el Libro de Reclamaciones de DarkMoney, incluyendo correo de la cuenta, fecha del cargo y una descripcion breve del problema.`,
  },
  {
    id: "tiempos-de-revision",
    title: "Tiempos de revision",
    body: "Las solicitudes se revisan caso por caso. Si procede un reembolso, el plazo y forma de devolucion dependeran tambien del proveedor de pagos y de la entidad financiera utilizada por el usuario.",
  },
];

export function RefundsPage() {
  usePageMeta({
    title: "Política de Reembolsos",
    description:
      "Cómo maneja DarkMoney las cancelaciones, renovaciones y solicitudes de reembolso de accesos premium.",
  });

  return (
    <LegalPageLayout
      badge="Devoluciones"
      badgeTone="warning"
      icon={RotateCcw}
      iconClassName="text-gold"
      intro="Resumen de como manejamos cancelaciones, renovaciones y solicitudes de reembolso relacionadas con accesos premium en DarkMoney."
      sections={refundsSections}
      title="Politica de Reembolsos"
      updatedAt="26 de marzo de 2026"
    />
  );
}
