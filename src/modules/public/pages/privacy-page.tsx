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
    body: "Los pagos premium son procesados por proveedores externos especializados. DarkMoney no almacena directamente los datos completos de tarjetas de pago del usuario.",
  },
  {
    id: "conservacion",
    title: "Conservacion",
    body: "Conservamos la informacion mientras sea necesaria para operar la cuenta, cumplir obligaciones legales, resolver disputas, prevenir fraude y mantener registros razonables del servicio.",
  },
  {
    id: "seguridad",
    title: "Seguridad",
    body: "Aplicamos medidas razonables de seguridad tecnicas y organizativas para proteger la informacion, aunque ningun sistema conectado a internet puede garantizar seguridad absoluta.",
  },
  {
    id: "tus-derechos",
    title: "Tus derechos",
    body: "Puedes solicitar acceso, correccion o eliminacion de ciertos datos conforme a la normativa aplicable y segun lo permita la operacion legitima del servicio.",
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
      updatedAt="26 de marzo de 2026"
    />
  );
}
