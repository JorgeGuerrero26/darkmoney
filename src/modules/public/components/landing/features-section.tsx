import {
  ArrowLeftRight,
  CalendarClock,
  HandCoins,
  Target,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Reveal } from "../reveal";
import { SectionHeading } from "../section-heading";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  chipClassName: string;
  iconClassName: string;
};

const features: Feature[] = [
  {
    icon: Wallet,
    title: "Cuentas",
    description: "Bancos, billeteras y efectivo con saldos unificados y siempre al dia.",
    chipClassName: "bg-pine/10 border-pine/20",
    iconClassName: "text-pine",
  },
  {
    icon: ArrowLeftRight,
    title: "Movimientos",
    description: "Ingresos y gastos categorizados para saber exactamente a donde va tu dinero.",
    chipClassName: "bg-ember/10 border-ember/20",
    iconClassName: "text-ember",
  },
  {
    icon: CalendarClock,
    title: "Suscripciones",
    description: "Controla tus cobros recurrentes y recibe alertas antes de cada renovacion.",
    chipClassName: "bg-gold/10 border-gold/20",
    iconClassName: "text-gold",
  },
  {
    icon: HandCoins,
    title: "Creditos y deudas",
    description: "Registra quien te debe y a quien le debes, con fechas y seguimiento claro.",
    chipClassName: "bg-pine/10 border-pine/20",
    iconClassName: "text-pine",
  },
  {
    icon: Users,
    title: "Espacios compartidos",
    description: "Finanzas en pareja, familia o equipo con visibilidad para todos los miembros.",
    chipClassName: "bg-ember/10 border-ember/20",
    iconClassName: "text-ember",
  },
  {
    icon: Target,
    title: "Presupuestos",
    description: "Define limites por categoria y detecta excesos antes de que pasen.",
    chipClassName: "bg-gold/10 border-gold/20",
    iconClassName: "text-gold",
  },
];

export function FeaturesSection() {
  return (
    <section
      className="scroll-mt-24"
      id="producto"
    >
      <Reveal>
        <SectionHeading
          description="Deja las hojas de calculo. DarkMoney reune todo lo que necesitas para entender y organizar tus finanzas."
          eyebrow="Producto"
          title="Todo tu dinero en un solo lugar"
        />
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => (
          <Reveal
            delay={index * 70}
            key={feature.title}
          >
            <article className="glass-panel-soft h-full rounded-[24px] p-6 transition duration-300 hover:-translate-y-1 hover:border-white/15">
              <div
                className={`inline-flex rounded-[14px] border p-2.5 ${feature.chipClassName}`}
              >
                <feature.icon className={`h-5 w-5 ${feature.iconClassName}`} />
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold text-ink">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-storm">{feature.description}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
