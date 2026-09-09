import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { usePageMeta } from "../../../hooks/use-page-meta";
import { FeaturesSection } from "../components/landing/features-section";
import { FinalCtaSection } from "../components/landing/final-cta-section";
import { HeroSection } from "../components/landing/hero-section";
import { PricingSummarySection } from "../components/landing/pricing-summary-section";

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
    <div>
      <HeroSection />
      <FeaturesSection />
      <PricingSummarySection />
      <FinalCtaSection />
    </div>
  );
}
