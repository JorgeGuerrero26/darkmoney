import { SurfaceCard } from "../../../components/ui/surface-card";

const refundsSections = [
  {
    title: "1. Naturaleza del servicio",
    body:
      "DarkMoney vende acceso digital a software y funciones premium. Al tratarse de un servicio digital, el acceso puede activarse inmediatamente despues de la compra o confirmacion del proveedor de pagos.",
  },
  {
    title: "2. Cancelacion de suscripciones",
    body:
      "El usuario puede cancelar futuras renovaciones desde su cuenta. La cancelacion evita cobros posteriores, pero el acceso premium se mantiene hasta el final del periodo ya pagado.",
  },
  {
    title: "3. Reembolsos",
    body:
      "Las compras digitales y suscripciones ya activadas normalmente no son reembolsables, salvo que exista un cobro duplicado, un error claro de procesamiento, un cargo no autorizado validado o un caso exigido por ley aplicable.",
  },
  {
    title: "4. Renovaciones ya procesadas",
    body:
      "No ofrecemos reembolsos parciales por tiempo transcurrido de un periodo de suscripcion ya iniciado, excepto cuando corresponda por ley o por una incidencia comprobada de cobro.",
  },
  {
    title: "5. Solicitudes",
    body:
      "Si crees que hubo un error de cobro, puedes solicitar revision a traves de los canales oficiales de DarkMoney incluyendo correo de la cuenta, fecha del cargo y una descripcion breve del problema.",
  },
  {
    title: "6. Tiempos de revision",
    body:
      "Las solicitudes se revisan caso por caso. Si procede un reembolso, el plazo y forma de devolucion dependeran tambien del proveedor de pagos y de la entidad financiera utilizada por el usuario.",
  },
];

export function RefundsPage() {
  return (
    <div className="grid gap-6">
      <SurfaceCard
        description="Esta politica resume como manejamos cancelaciones, renovaciones y solicitudes de reembolso relacionadas con accesos premium en DarkMoney."
        title="Refund Policy"
      >
        <p className="text-sm leading-7 text-storm">
          Ultima actualizacion: 26 de marzo de 2026.
        </p>
      </SurfaceCard>

      <div className="grid gap-4">
        {refundsSections.map((section) => (
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
