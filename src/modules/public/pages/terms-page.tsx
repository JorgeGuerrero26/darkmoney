import { SurfaceCard } from "../../../components/ui/surface-card";

const termsSections = [
  {
    title: "1. Servicio",
    body:
      "DarkMoney es una aplicacion web de software como servicio para gestion financiera personal y colaborativa. El servicio ayuda a registrar cuentas, movimientos, suscripciones, obligaciones y espacios compartidos.",
  },
  {
    title: "2. Cuenta y acceso",
    body:
      "Para usar DarkMoney debes proporcionar informacion veraz, mantener segura tu cuenta y no compartir acceso con terceros de manera indebida. Eres responsable de la actividad realizada desde tu cuenta.",
  },
  {
    title: "3. Planes y facturacion",
    body:
      "Algunas funciones estan disponibles solo para usuarios premium. Las suscripciones se cobran de forma recurrente segun las condiciones mostradas en el checkout. El usuario puede cancelar futuras renovaciones desde su cuenta, y el acceso premium permanece activo hasta el final del periodo ya pagado.",
  },
  {
    title: "4. Uso permitido",
    body:
      "No puedes usar DarkMoney para actividades ilegales, fraudulentas, abusivas, ni para intentar vulnerar la plataforma, acceder sin autorizacion a datos de terceros o interferir con el servicio.",
  },
  {
    title: "5. Datos y disponibilidad",
    body:
      "Hacemos esfuerzos razonables para mantener la plataforma disponible y proteger la informacion, pero no garantizamos continuidad absoluta, ausencia total de errores ni disponibilidad ininterrumpida.",
  },
  {
    title: "6. Propiedad intelectual",
    body:
      "El software, marca, diseno, interfaces, contenido propio y elementos distintivos de DarkMoney pertenecen a su titular y no pueden copiarse, revenderse ni explotarse sin autorizacion.",
  },
  {
    title: "7. Sin asesoramiento financiero",
    body:
      "DarkMoney es una herramienta de software y no constituye asesoramiento financiero, contable, legal o tributario. Cada usuario es responsable de sus decisiones y del uso que haga de la informacion mostrada.",
  },
  {
    title: "8. Terminacion",
    body:
      "Podemos suspender o limitar cuentas que incumplan estas condiciones, representen riesgo para la plataforma o intenten usar el servicio de forma abusiva o fraudulenta.",
  },
  {
    title: "9. Contacto",
    body:
      "Para consultas sobre estos terminos o sobre el servicio, puedes escribirnos desde los canales oficiales publicados en DarkMoney.",
  },
];

export function TermsPage() {
  return (
    <div className="grid gap-6">
      <SurfaceCard
        description="Estos terminos explican las reglas generales para usar DarkMoney, crear una cuenta y contratar funciones premium."
        title="Terms of Service"
      >
        <p className="text-sm leading-7 text-storm">
          Ultima actualizacion: 26 de marzo de 2026.
        </p>
      </SurfaceCard>

      <div className="grid gap-4">
        {termsSections.map((section) => (
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
