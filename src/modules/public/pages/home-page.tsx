import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { usePageMeta } from "../../../hooks/use-page-meta";
import { FaqList } from "../components/faq-list";
import { DashboardPreview } from "../components/landing/dashboard-preview";
import { FeaturesSection } from "../components/landing/features-section";
import { FinalCtaSection } from "../components/landing/final-cta-section";
import { HeroSection } from "../components/landing/hero-section";
import { HowItWorksSection } from "../components/landing/how-it-works-section";
import { PricingSummarySection } from "../components/landing/pricing-summary-section";
import { Reveal } from "../components/reveal";
import { SectionHeading } from "../components/section-heading";
import { productFaqs } from "../lib/plans-data";

export function HomePage() {
  usePageMeta({
    title: "DarkMoney — Finanzas personales y colaborativas",
    description:
      "Organiza cuentas, movimientos, suscripciones, deudas y espacios compartidos en un solo lugar. Empieza gratis, sin tarjeta.",
  });

  const location = useLocation();

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const target = document.getElementById(location.hash.slice(1));
    target?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  return (
    <div className="flex flex-col gap-24 sm:gap-32">
      <div className="flex flex-col gap-4">
        <HeroSection />
        <DashboardPreview />
      </div>

      <FeaturesSection />

      <HowItWorksSection />

      <PricingSummarySection />

      <section className="mx-auto w-full max-w-2xl">
        <Reveal>
          <SectionHeading
            eyebrow="FAQ"
            title="Preguntas frecuentes"
          />
        </Reveal>
        <Reveal className="mt-10">
          <FaqList items={productFaqs} />
        </Reveal>
      </section>

      <FinalCtaSection />
    </div>
  );
}
