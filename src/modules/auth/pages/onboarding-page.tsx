import { ArrowRight, Globe, WalletCards } from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { useAuth } from "../auth-context";

export function OnboardingPage() {
  const navigate = useNavigate();
  const { profile, saveProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName ?? "");
  const [baseCurrencyCode, setBaseCurrencyCode] = useState(profile?.baseCurrencyCode ?? "PEN");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "America/Lima");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setFullName(profile.fullName);
    setBaseCurrencyCode(profile.baseCurrencyCode);
    setTimezone(profile.timezone);
  }, [profile]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      await saveProfile({
        fullName,
        baseCurrencyCode,
        timezone,
      });

      setSuccessMessage("Perfil guardado correctamente.");
      navigate("/app", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el perfil.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-glow px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[32px] border border-white/10 bg-gradient-to-br from-shell via-void to-shell p-8 text-ink shadow-haze">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-storm">
            <WalletCards className="h-4 w-4" />
            Onboarding inicial
          </span>
          <div className="mt-6 space-y-4">
            <h1 className="font-display text-5xl font-semibold leading-tight">
              Dejemos listo tu contexto financiero desde el primer minuto.
            </h1>
            <p className="max-w-xl text-base leading-8 text-storm">
              Esta pantalla ya modela el flujo de perfil, moneda base y zona horaria. Luego se
              conectara con `profiles` y la deteccion del workspace por defecto.
            </p>
          </div>
          <div className="mt-10 space-y-4">
            {[
              "Crear o confirmar workspace personal",
              "Guardar moneda base y timezone del usuario",
              "Definir workspace por defecto",
            ].map((item) => (
              <div
                className="rounded-3xl border border-white/10 bg-white/[0.05] px-5 py-4 text-sm text-storm"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="glass-panel-strong rounded-[32px] p-8">
          <form
            className="space-y-6"
            noValidate
            onSubmit={handleSubmit}
          >
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.24em] text-storm">configuracion inicial</p>
              <h2 className="font-display text-4xl font-semibold text-ink">
                Perfil financiero basico
              </h2>
            </div>

            <div className="grid gap-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-ink">Nombre visible</span>
                <input
                  className="field-dark"
                  onChange={(event) => setFullName(event.target.value)}
                  type="text"
                  value={fullName}
                />
              </label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink">Moneda base</span>
                  <select
                    className="field-dark"
                    onChange={(event) => setBaseCurrencyCode(event.target.value)}
                    value={baseCurrencyCode}
                  >
                    <option value="USD">USD</option>
                    <option value="PEN">PEN</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-ink">Zona horaria</span>
                  <select
                    className="field-dark"
                    onChange={(event) => setTimezone(event.target.value)}
                    value={timezone}
                  >
                    <option value="America/Lima">America/Lima</option>
                    <option value="America/Bogota">America/Bogota</option>
                    <option value="America/Santiago">America/Santiago</option>
                    <option value="America/Argentina/Buenos_Aires">America/Argentina/Buenos_Aires</option>
                    <option value="America/Mexico_City">America/Mexico_City</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="Europe/Madrid">Europe/Madrid</option>
                    <option value="UTC">UTC</option>
                  </select>
                </label>
              </div>

              <div className="rounded-[28px] border border-gold/15 bg-gold/10 p-5">
                <div className="flex items-start gap-3">
                  <Globe className="mt-1 h-5 w-5 text-gold" />
                  <div>
                    <p className="font-medium text-ink">Workspace personal automatico</p>
                    <p className="mt-2 text-sm leading-7 text-storm">
                      El BBP y la base de datos ya contemplan el bootstrap del workspace personal.
                      Esta pantalla queda lista para confirmar ese contexto y continuar.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {errorMessage ? (
                <FormFeedbackBanner
                  className="w-full"
                  description={errorMessage}
                  title="No pudimos guardar tu perfil"
                />
              ) : null}
              {successMessage ? (
                <FormFeedbackBanner
                  className="w-full"
                  description={successMessage}
                  title="Perfil listo"
                  tone="success"
                />
              ) : null}
              <Button
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? "Guardando..." : "Guardar configuracion"}
              </Button>
              <Link to="/app">
                <Button variant="ghost">
                  Ir al dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
