import { Check, Clock, Shield, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/status-badge";
import { PUBLIC_CONTACT } from "../../../lib/public-contact";

const freeFeatures = [
  "Cuentas, movimientos y categorias",
  "Presupuestos, contactos y suscripciones",
  "Creditos, deudas y workspaces compartidos",
  "Notificaciones dentro de la app",
];

const proFeatures = [
  "Todo lo incluido en Free",
  "Dashboard avanzado y widgets premium",
  "Aprendizaje inteligente y alertas automaticas",
  "Gestion de comprobantes e imagenes",
  "Sincronizacion de estados premium",
  "Mejoras y funciones futuras incluidas",
];

const faqs = [
  {
    q: "¿Puedo cancelar cuando quiera?",
    a: "Si. Podes cancelar tu suscripcion Pro desde tu cuenta en cualquier momento. Mantenes el acceso hasta el fin del periodo ya pagado.",
  },
  {
    q: "¿Hay cargos ocultos?",
    a: "No. El checkout muestra claramente el importe exacto, la moneda, los impuestos aplicables y la periodicidad antes de confirmar.",
  },
  {
    q: "¿Que pasa si paso de Pro a Free?",
    a: "Tu historial y datos se conservan. Perdes acceso a las funciones premium al vencer el periodo pagado, sin perdida de informacion.",
  },
];

export function PricingPage() {
  return (
    <div className="flex flex-col items-center gap-20 pb-10">
      {/* Hero */}
      <section className="flex max-w-2xl flex-col items-center gap-5 pt-4 text-center">
        <StatusBadge status="SaaS financiero" tone="info" />
        <h1 className="text-balance font-display text-5xl font-semibold leading-[1.1] tracking-[-0.04em] text-ink sm:text-6xl">
          Simple, transparente,
          <br />
          sin sorpresas
        </h1>
        <p className="text-balance max-w-lg text-base leading-8 text-storm">
          Empieza gratis y pasa a Pro cuando quieras mas visibilidad, automatizacion y
          herramientas avanzadas sobre tus finanzas.
        </p>
        <div className="flex flex-wrap justify-center gap-3 pt-1">
          <Link to="/auth/register">
            <Button>Crear cuenta gratis</Button>
          </Link>
          <Link to="/terms">
            <Button variant="ghost">Ver condiciones</Button>
          </Link>
        </div>
      </section>

      {/* Plan cards */}
      <section className="grid w-full max-w-3xl gap-5 md:grid-cols-2">
        {/* Free */}
        <article className="glass-panel-soft flex flex-col rounded-[32px] p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-storm">Plan</p>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Free</h2>
            <div className="mt-4 flex items-end gap-1.5">
              <span className="font-display text-5xl font-semibold leading-none text-ink">$0</span>
              <span className="mb-1 text-sm text-storm">/ para siempre</span>
            </div>
            <p className="mt-4 text-sm leading-7 text-storm">
              Para empezar a ordenar tus finanzas y construir historial desde el dia uno.
            </p>
          </div>

          <ul className="mt-8 flex flex-col gap-3.5">
            {freeFeatures.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-pine" />
                <span className="text-sm text-storm">{feature}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto pt-10">
            <Link className="block" to="/auth/register">
              <Button className="w-full" variant="secondary">
                Empezar gratis
              </Button>
            </Link>
          </div>
        </article>

        {/* Pro */}
        <article className="relative flex flex-col overflow-hidden rounded-[32px] border border-pine/25 bg-[radial-gradient(circle_at_top_left,rgba(107,228,197,0.13),transparent_45%),linear-gradient(160deg,rgba(255,255,255,0.07),rgba(5,9,16,0.88)_65%)] p-8">
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_45%)]" />
          <div className="relative flex flex-1 flex-col">
            <div>
              <div className="flex items-center gap-2.5">
                <p className="text-xs uppercase tracking-[0.22em] text-storm">Plan</p>
                <StatusBadge status="Popular" tone="success" />
              </div>
              <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Pro</h2>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-[0.2em] text-storm">Precio</p>
                <p className="mt-1.5 text-sm leading-6 text-storm">
                  El importe exacto, moneda e impuestos se muestran en el checkout antes de confirmar.
                </p>
              </div>
              <p className="mt-4 text-sm leading-7 text-storm">
                Para quienes quieren analisis profundo, automatizacion y herramientas avanzadas.
              </p>
            </div>

            <ul className="mt-8 flex flex-col gap-3.5">
              {proFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-3">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-pine" />
                  <span className="text-sm text-ink">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-10">
              <Link className="block" to="/auth/register">
                <Button className="w-full">Empezar con Pro</Button>
              </Link>
            </div>
          </div>
        </article>
      </section>

      {/* Trust signals */}
      <section className="w-full max-w-3xl">
        <h2 className="mb-6 text-center font-display text-sm font-semibold uppercase tracking-[0.2em] text-storm">
          Lo que garantizamos
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="glass-panel-soft flex items-start gap-4 rounded-[24px] p-5">
            <div className="rounded-[14px] bg-pine/10 p-2.5">
              <Shield className="h-5 w-5 text-pine" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Sin cargos ocultos</p>
              <p className="mt-1 text-xs leading-5 text-storm">
                El precio exacto se muestra antes de confirmar.
              </p>
            </div>
          </div>

          <div className="glass-panel-soft flex items-start gap-4 rounded-[24px] p-5">
            <div className="rounded-[14px] bg-ember/10 p-2.5">
              <Zap className="h-5 w-5 text-ember" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Cancelacion libre</p>
              <p className="mt-1 text-xs leading-5 text-storm">
                Cancela cuando quieras desde tu cuenta.
              </p>
            </div>
          </div>

          <div className="glass-panel-soft flex items-start gap-4 rounded-[24px] p-5">
            <div className="rounded-[14px] bg-gold/10 p-2.5">
              <Clock className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Acceso completo</p>
              <p className="mt-1 text-xs leading-5 text-storm">
                Mantenes Pro hasta el fin del periodo pagado.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="w-full max-w-2xl">
        <h2 className="text-balance text-center font-display text-3xl font-semibold tracking-[-0.03em] text-ink">
          Preguntas frecuentes
        </h2>
        <div className="mt-8 flex flex-col gap-4">
          {faqs.map((faq) => (
            <div className="glass-panel-soft rounded-[24px] p-6" key={faq.q}>
              <p className="text-sm font-semibold text-ink">{faq.q}</p>
              <p className="mt-2 text-sm leading-7 text-storm">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Policies */}
      <section className="glass-panel-soft w-full max-w-3xl rounded-[28px] px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-storm">Mas informacion en nuestras politicas publicas.</p>
          <div className="flex flex-wrap gap-2">
            <Link to="/terms">
              <Button variant="ghost">Terminos</Button>
            </Link>
            <Link to="/privacy">
              <Button variant="ghost">Privacidad</Button>
            </Link>
            <Link to="/refunds">
              <Button variant="ghost">Devoluciones</Button>
            </Link>
            <Link to={PUBLIC_CONTACT.claimsBookPath}>
              <Button variant="ghost">Libro de reclamaciones</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
