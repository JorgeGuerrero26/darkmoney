import { Trash2 } from "lucide-react";

import { usePageMeta } from "../../../hooks/use-page-meta";
import { PUBLIC_CONTACT, PUBLIC_CONTACT_LINKS } from "../../../lib/public-contact";
import { LegalPageLayout } from "../components/legal-page-layout";
import type { LegalSection } from "../components/legal-page-layout";

// Página pública (sin sesión) que pide Google Play: Contenido de la app → Seguridad de los datos → Eliminación de cuenta.
// Debe decir lo mismo que la Política de privacidad, los Términos y la Edge Function delete-account.
const deleteAccountSections: LegalSection[] = [
  {
    id: "desde-la-app",
    title: "Desde la app (Android o iPhone)",
    body: "Abre DarkMoney, entra a Configuración y toca «Eliminar mi cuenta», al final de la pantalla. Lee lo que se borra, escribe ELIMINAR y toca «Eliminar cuenta». La cuenta se borra al instante y la app vuelve a la pantalla de entrada.",
  },
  {
    id: "desde-la-web",
    title: "Desde la web",
    body: "Entra a darkmoney.company con tu cuenta, ve a Configuración → General y usa «Eliminar mi cuenta». Es el mismo proceso que en la app.",
  },
  {
    id: "que-se-borra",
    title: "Qué se borra",
    body: "Tu cuenta y todos tus datos: cuentas, movimientos, categorías, presupuestos, suscripciones, ingresos, deudas y contactos; tus comprobantes y tu foto de perfil; tus ajustes, notificaciones, preferencias del asistente y de la inteligencia artificial; los movimientos detectados, tu dirección de correo para detectar pagos y tus registros técnicos. En el teléfono o navegador desde el que la eliminas también se borra lo que DarkMoney guardaba ahí, incluida la copia del modo sin conexión.",
  },
  {
    id: "que-se-conserva",
    title: "Qué se conserva y por qué",
    body: "Si compartes un espacio con otras personas, el espacio no se borra: pasa al miembro más antiguo, y lo que registraste ahí se queda para ellos sin tu nombre. Si aceptaron un pago que pediste en una deuda de otra persona, ese pago sigue en su historial como «Cuenta eliminada». Los registros de tus pagos de DarkMoney Pro se conservan sin tu nombre ni tu correo; la factura la guarda Paddle, que procesó el pago, durante el tiempo que exige la ley.",
  },
  {
    id: "si-tienes-pro",
    title: "Si tienes DarkMoney Pro",
    body: "Si tu plan Pro todavía se cobra, primero cancélalo en la web (Configuración → Plan y pagos). Así no queda un cobro activo que ya nadie pueda ver ni cancelar. Después podrás eliminar la cuenta.",
  },
  {
    id: "si-no-puedes-entrar",
    title: "Si no puedes entrar a tu cuenta",
    body: (
      <>
        Escríbenos a{" "}
        <a className="underline underline-offset-4" href={PUBLIC_CONTACT_LINKS.email}>
          {PUBLIC_CONTACT.supportEmail}
        </a>{" "}
        desde el correo de tu cuenta, con el asunto «Eliminar mi cuenta». Comprobaremos que la cuenta es tuya y la
        eliminaremos con el mismo proceso en un plazo máximo de 30 días. Te avisaremos cuando esté hecho.
      </>
    ),
  },
];

export function DeleteAccountPage() {
  usePageMeta({
    title: "Eliminar tu cuenta",
    description: "Cómo eliminar tu cuenta de DarkMoney y todos tus datos, desde la app, la web o por correo.",
  });

  return (
    <LegalPageLayout
      badge="Tu cuenta"
      badgeTone="info"
      icon={Trash2}
      iconClassName="text-ember"
      intro="Puedes eliminar tu cuenta de DarkMoney y todos tus datos cuando quieras, desde la app o la web. Si no puedes entrar, escríbenos."
      sections={deleteAccountSections}
      title="Eliminar tu cuenta"
      updatedAt="2 de noviembre de 2026"
    />
  );
}
