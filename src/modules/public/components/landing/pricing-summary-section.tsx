import { PlanCards } from "../plan-cards";

export function PricingSummarySection() {
  return (
    <section className="border-t border-[#f4f1ec]/[0.07]">
      <div className="mx-auto flex w-full max-w-[1240px] flex-col items-start gap-[30px] px-5 py-14 sm:px-8 lg:px-11 lg:py-[56px]">
        <h2 className="font-public-display text-[34px] font-semibold leading-[1.1] tracking-[-0.028em] text-[#f4f1ec]">
          Empieza gratis, crece a Pro
        </h2>
        <PlanCards compact />
        <p className="text-[13px] leading-[1.5] text-[#8e877c]">
          Se cancela cuando quieras. Sin cargos ocultos.
        </p>
      </div>
    </section>
  );
}
