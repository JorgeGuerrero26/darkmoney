import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { SurfaceCard } from "../../../components/ui/surface-card";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";

const freeFeatures = [
  "Cuentas, movimientos y categorias",
  "Presupuestos, contactos y suscripciones",
  "Creditos, deudas y workspaces compartidos",
  "Notificaciones dentro de la app",
];

const proFeatures = [
  "Dashboard avanzado y widgets premium",
  "Aprendiendo de ti y alertas inteligentes",
  "Gestion de comprobantes e imagenes",
  "Sincronizacion de estados premium y mejoras futuras",
];

export function PricingPage() {
  return (
    <div className="grid gap-6">
      <SurfaceCard
        action={<StatusBadge status="SaaS financiero" tone="info" />}
        description="DarkMoney ofrece una experiencia Free para empezar y un nivel Pro recurrente para quienes quieren mas visibilidad, automatizacion y profundidad."
        title="Pricing"
      >
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.22em] text-storm">Como cobramos</p>
            <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink">
              Suscripcion premium recurrente
            </h2>
            <p className="mt-4 text-sm leading-8 text-storm">
              El precio final, la moneda aplicable, los impuestos y la periodicidad se
              muestran claramente en el checkout antes de confirmar cualquier compra.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <StatusBadge status="Sin cargos ocultos" tone="success" />
              <StatusBadge status="Cancelacion desde tu cuenta" tone="info" />
              <StatusBadge status="Renovacion automatica" tone="warning" />
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/auth/register">
                <Button>Crear cuenta</Button>
              </Link>
              <Link to="/terms">
                <Button variant="ghost">Ver condiciones</Button>
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="glass-panel-soft rounded-[28px] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-display text-2xl font-semibold text-ink">Free</p>
                <StatusBadge status="USD 0" tone="neutral" />
              </div>
              <p className="mt-3 text-sm leading-7 text-storm">
                Para usuarios que quieren ordenar su dinero y empezar a construir
                historial financiero.
              </p>
              <div className="mt-5 grid gap-3">
                {freeFeatures.map((feature) => (
                  <div
                    className="rounded-[18px] border border-white/10 bg-black/15 px-4 py-3 text-sm text-ink"
                    key={feature}
                  >
                    {feature}
                  </div>
                ))}
              </div>
            </article>

            <article className="relative overflow-hidden rounded-[28px] border border-pine/20 bg-[radial-gradient(circle_at_top_left,rgba(76,109,255,0.18),transparent_32%),linear-gradient(160deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02)_38%,rgba(5,9,16,0.82)_100%)] p-5">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_40%)]" />
              <div className="relative">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-2xl font-semibold text-ink">DarkMoney Pro</p>
                  <StatusBadge status="Recurrente" tone="success" />
                </div>
                <p className="mt-3 text-sm leading-7 text-storm">
                  Para usuarios que quieren mas analisis, contexto y herramientas premium
                  sobre sus finanzas personales o compartidas.
                </p>
                <div className="mt-5 grid gap-3">
                  {proFeatures.map((feature) => (
                    <div
                      className="rounded-[18px] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm text-ink"
                      key={feature}
                    >
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>
      </SurfaceCard>

      <section className="grid gap-6 xl:grid-cols-3">
        <SurfaceCard
          description="Las compras premium crean una suscripcion recurrente. Antes de confirmar se muestra el detalle exacto de cobro."
          title="Cobros"
        >
          <p className="text-sm leading-7 text-storm">
            El checkout muestra claramente importe, moneda, impuestos, periodicidad y
            condiciones de renovacion antes de que el usuario autorice el pago.
          </p>
        </SurfaceCard>

        <SurfaceCard
          description="El usuario puede cancelar su suscripcion premium desde su cuenta y mantener acceso hasta el final del periodo ya pagado."
          title="Cancelacion"
        >
          <p className="text-sm leading-7 text-storm">
            La cancelacion detiene futuras renovaciones automaticas, pero no elimina
            retroactivamente el periodo ya pagado.
          </p>
        </SurfaceCard>

        <SurfaceCard
          description="Para informacion completa revisa nuestras politicas publicas."
          title="Politicas"
        >
          <div className="flex flex-wrap gap-3">
            <Link to="/terms">
              <Button variant="ghost">Terms</Button>
            </Link>
            <Link to="/privacy">
              <Button variant="ghost">Privacy</Button>
            </Link>
            <Link to="/refunds">
              <Button variant="ghost">Refunds</Button>
            </Link>
            <Link to={PUBLIC_CONTACT.claimsBookPath}>
              <Button variant="ghost">Libro de reclamaciones</Button>
            </Link>
          </div>
        </SurfaceCard>
      </section>
    </div>
  );
}
