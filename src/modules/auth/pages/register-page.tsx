import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { useSuccessToast } from "../../../components/ui/toast-provider";
import { useAuth } from "../auth-context";

export function RegisterPage() {
  const navigate = useNavigate();
  const { isConfigured, signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  useSuccessToast(successMessage, {
    clear: () => setSuccessMessage(""),
    title: "Cuenta creada",
  });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const result = await signUp({
        email,
        password,
        fullName,
      });

      if (result.needsEmailConfirmation) {
        setSuccessMessage(
          "Tu cuenta fue creada. Revisa tu correo para confirmar la cuenta antes de iniciar sesion.",
        );
        return;
      }

      navigate("/app", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear la cuenta.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-storm">registro</p>
        <h2 className="font-display text-4xl font-semibold text-ink">Crea tu workspace financiero.</h2>
        <p className="text-sm leading-7 text-storm">
          Crea tu cuenta para organizar tus finanzas personales y abrir espacios compartidos cuando lo necesites.
        </p>
      </div>

      <form
        className="glass-panel space-y-4 rounded-[28px] p-6"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Nombre completo</span>
          <input
            className="field-dark"
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Lucia Ramirez"
            type="text"
            value={fullName}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Correo</span>
          <input
            className="field-dark"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            type="email"
            value={email}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Contrasena</span>
          <input
            className="field-dark"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="********"
            type="password"
            value={password}
          />
        </label>
        {errorMessage ? (
          <FormFeedbackBanner
            description={errorMessage}
            title="No pudimos crear tu cuenta"
          />
        ) : null}
        {!isConfigured ? (
          <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
            Falta configurar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `.env`.
          </div>
        ) : null}
        <Button
          className="w-full"
          disabled={!isConfigured || isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <div className="text-sm text-storm">
        <span>Ya tienes cuenta. </span>
        <NavLink
          className="underline decoration-white/20 underline-offset-4 transition hover:text-ink"
          to="/auth/login"
        >
          Volver al login
        </NavLink>
      </div>
    </section>
  );
}
