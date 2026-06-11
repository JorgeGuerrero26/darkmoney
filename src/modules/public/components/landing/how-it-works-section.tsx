import { Reveal } from "../reveal";
import { SectionHeading } from "../section-heading";

const steps = [
  {
    title: "Crea tu cuenta gratis",
    description: "Solo necesitas un correo. Sin tarjeta, sin compromisos y listo en un minuto.",
  },
  {
    title: "Registra cuentas y movimientos",
    description:
      "Agrega tus bancos, billeteras y efectivo. Categoriza ingresos y gastos a tu manera.",
  },
  {
    title: "Comparte y automatiza",
    description:
      "Invita a tu pareja o equipo a espacios compartidos y deja que las alertas trabajen por ti.",
  },
];

export function HowItWorksSection() {
  return (
    <section>
      <Reveal>
        <SectionHeading
          description="De cero a finanzas ordenadas en tres pasos."
          eyebrow="Como funciona"
          title="Empieza en minutos"
        />
      </Reveal>

      <div className="relative mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
        <div
          aria-hidden="true"
          className="absolute left-[16%] right-[16%] top-7 hidden h-px bg-gradient-to-r from-transparent via-white/15 to-transparent md:block"
        />
        {steps.map((step, index) => (
          <Reveal
            delay={index * 90}
            key={step.title}
          >
            <div className="flex flex-col items-center text-center">
              <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border border-pine/30 bg-canvas font-display text-xl font-semibold text-pine">
                {index + 1}
              </div>
              <h3 className="mt-5 font-display text-lg font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 max-w-xs text-sm leading-7 text-storm">{step.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
