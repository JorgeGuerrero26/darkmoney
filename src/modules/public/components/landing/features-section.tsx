const features = [
  {
    title: "Cuentas",
    description: "Bancos, billeteras y efectivo con saldos unificados y siempre al día.",
  },
  {
    title: "Movimientos",
    description: "Ingresos y gastos categorizados para saber exactamente a dónde va tu dinero.",
  },
  {
    title: "Suscripciones",
    description: "Controla tus cobros recurrentes y recibe alertas antes de cada renovación.",
  },
  {
    title: "Créditos y deudas",
    description: "Registra quién te debe y a quién le debes, con fechas y seguimiento claro.",
  },
  {
    title: "Espacios compartidos",
    description: "Finanzas en pareja, familia o equipo con visibilidad para todos los miembros.",
  },
  {
    title: "Presupuestos",
    description: "Define límites por categoría y detecta excesos antes de que pasen.",
  },
];

export function FeaturesSection() {
  return (
    <section
      className="scroll-mt-20 border-t border-[#f4f1ec]/[0.07]"
      id="producto"
    >
      <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-[34px] px-5 py-14 sm:px-8 lg:px-11 lg:py-[56px]">
        <div className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end sm:gap-10">
          <h2 className="font-public-display max-w-[16ch] text-[34px] font-semibold leading-[1.1] tracking-[-0.028em] text-[#f4f1ec]">
            Todo tu dinero en un solo lugar
          </h2>
          <p className="max-w-[38ch] text-[14.5px] leading-[1.55] text-[#a39c90]">
            Deja las hojas de cálculo. DarkMoney reúne lo que necesitas para entender y organizar
            tus finanzas.
          </p>
        </div>

        <div className="grid overflow-hidden rounded-xl border border-[#f4f1ec]/[0.08] bg-[#f4f1ec]/[0.08] sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              className="m-px flex flex-col gap-[9px] bg-[#1a1917] px-6 py-6 transition-colors hover:bg-[#1e1c1a]"
              key={feature.title}
            >
              <h3 className="font-public-display text-base font-semibold leading-[1.2] tracking-[-0.015em] text-[#f4f1ec]">
                {feature.title}
              </h3>
              <p className="text-[13.5px] leading-[1.55] text-[#a39c90]">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
