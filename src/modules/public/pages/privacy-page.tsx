import { Lock } from "lucide-react";

import { usePageMeta } from "../../../hooks/use-page-meta";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";
import { LegalPageLayout } from "../components/legal-page-layout";
import type { LegalSection } from "../components/legal-page-layout";

const privacySections: LegalSection[] = [
  {
    id: "informacion-que-recopilamos",
    title: "Informacion que recopilamos",
    body: "Podemos recopilar datos de cuenta, perfil, workspaces, movimientos, categorias, suscripciones, obligaciones, preferencias de notificacion, registros tecnicos y otra informacion necesaria para operar DarkMoney.",
  },
  {
    id: "como-usamos-la-informacion",
    title: "Como usamos la informacion",
    body: "Usamos los datos para autenticar usuarios, mantener la plataforma, mostrar reportes financieros, sincronizar workspaces compartidos, procesar suscripciones premium, mejorar funciones y responder solicitudes de soporte.",
  },
  {
    id: "procesadores-y-proveedores",
    title: "Procesadores y proveedores",
    body: "Podemos compartir informacion estrictamente necesaria con proveedores de infraestructura, autenticacion, almacenamiento, correo, analitica y pagos para prestar el servicio de forma segura y eficiente.",
  },
  {
    id: "pagos",
    title: "Pagos",
    body: "Los pagos premium los procesa Paddle, que actua como vendedor y guarda las facturas durante el tiempo que exige la ley. DarkMoney no almacena los datos de tarjetas de pago del usuario.",
  },
  {
    id: "conservacion",
    title: "Conservacion",
    body: "Conservamos la informacion mientras tengas tu cuenta. Al eliminarla borramos tus datos al instante. Solo se conserva, sin tu nombre ni tu correo, lo que forma parte de los datos de otras personas (lo que registraste en un espacio compartido, que pasa al miembro mas antiguo, o un pago tuyo aceptado en la deuda de otra persona) y el registro de tus pagos de Pro; la factura la guarda Paddle.",
  },
  {
    id: "seguridad",
    title: "Seguridad",
    body: "Aplicamos medidas razonables de seguridad tecnicas y organizativas para proteger la informacion, aunque ningun sistema conectado a internet puede garantizar seguridad absoluta.",
  },
  {
    id: "tus-derechos",
    title: "Tus derechos",
    body: "Puedes solicitar acceso o correccion de tus datos conforme a la normativa aplicable. Puedes eliminar tu cuenta y todos tus datos tu mismo desde la app o la web (Configuracion → Eliminar mi cuenta), o escribiendonos si no puedes entrar: los pasos estan en darkmoney.company/eliminar-cuenta.",
  },
  {
    id: "contacto",
    title: "Contacto",
    body: `Si tienes preguntas sobre privacidad o tratamiento de datos, puedes comunicarte a ${PUBLIC_CONTACT.supportEmail}, al telefono ${PUBLIC_CONTACT.supportPhoneDisplay} o por los canales publicos de DarkMoney. ${PUBLIC_CONTACT.taxIdLabel} ${PUBLIC_CONTACT.taxIdValue}.`,
  },
];

export function PrivacyPage() {
  usePageMeta({
    title: "Política de Privacidad",
    description:
      "Qué datos usa DarkMoney, por qué los usa y cómo protege la información relacionada con tu cuenta y actividad.",
  });

  return (
    <LegalPageLayout
      badge="Privacidad"
      badgeTone="info"
      icon={Lock}
      iconClassName="text-ember"
      intro="Te explicamos que datos usamos, por que los usamos y como protegemos la informacion relacionada con tu cuenta y actividad en DarkMoney."
      sections={privacySections}
      title="Politica de Privacidad"
      updatedAt="2 de noviembre de 2026"
    />
  );
}
