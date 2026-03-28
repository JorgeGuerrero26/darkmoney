import { SurfaceCard } from "../../../components/ui/surface-card";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";

const privacySections = [
  {
    title: "1. Informacion que recopilamos",
    body:
      "Podemos recopilar datos de cuenta, perfil, workspaces, movimientos, categorias, suscripciones, obligaciones, preferencias de notificacion, registros tecnicos y otra informacion necesaria para operar DarkMoney.",
  },
  {
    title: "2. Como usamos la informacion",
    body:
      "Usamos los datos para autenticar usuarios, mantener la plataforma, mostrar reportes financieros, sincronizar workspaces compartidos, procesar suscripciones premium, mejorar funciones y responder solicitudes de soporte.",
  },
  {
    title: "3. Procesadores y proveedores",
    body:
      "Podemos compartir informacion estrictamente necesaria con proveedores de infraestructura, autenticacion, almacenamiento, correo, analitica y pagos para prestar el servicio de forma segura y eficiente.",
  },
  {
    title: "4. Pagos",
    body:
      "Los pagos premium son procesados por proveedores externos especializados. DarkMoney no almacena directamente los datos completos de tarjetas de pago del usuario.",
  },
  {
    title: "5. Conservacion",
    body:
      "Conservamos la informacion mientras sea necesaria para operar la cuenta, cumplir obligaciones legales, resolver disputas, prevenir fraude y mantener registros razonables del servicio.",
  },
  {
    title: "6. Seguridad",
    body:
      "Aplicamos medidas razonables de seguridad tecnicas y organizativas para proteger la informacion, aunque ningun sistema conectado a internet puede garantizar seguridad absoluta.",
  },
  {
    title: "7. Tus derechos",
    body:
      "Puedes solicitar acceso, correccion o eliminacion de ciertos datos conforme a la normativa aplicable y segun lo permita la operacion legitima del servicio.",
  },
  {
    title: "8. Contacto",
    body:
      `Si tienes preguntas sobre privacidad o tratamiento de datos, puedes comunicarte a ${PUBLIC_CONTACT.supportEmail}, al telefono ${PUBLIC_CONTACT.supportPhoneDisplay} o por los canales publicos de DarkMoney. ${PUBLIC_CONTACT.taxIdLabel} ${PUBLIC_CONTACT.taxIdValue}.`,
  },
];

export function PrivacyPage() {
  return (
    <div className="grid gap-6">
      <SurfaceCard
        description="Esta politica explica que datos usamos, por que los usamos y como protegemos la informacion relacionada con tu cuenta y tu actividad en DarkMoney."
        title="Privacy Policy"
      >
        <p className="text-sm leading-7 text-storm">
          Ultima actualizacion: 26 de marzo de 2026.
        </p>
      </SurfaceCard>

      <div className="grid gap-4">
        {privacySections.map((section) => (
          <SurfaceCard
            description={section.body}
            key={section.title}
            title={section.title}
          />
        ))}
      </div>
    </div>
  );
}
