import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { useAuth } from "../auth-context";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isConfigured, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = searchParams.get("next");
  const resolvedNextPath =
    nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/app";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      await signIn(email, password);
      navigate(resolvedNextPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo iniciar sesion.";
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <p className="text-xs uppercase tracking-[0.24em] text-storm">acceso</p>
        <h2 className="font-display text-4xl font-semibold text-ink">Entra a tu dinero compartido.</h2>
        <p className="text-sm leading-7 text-storm">
          Inicia sesion con tu correo y password. Si Supabase esta bien configurado, entraras a tu
          espacio real.
        </p>
      </div>

      <form
        className="glass-panel space-y-4 rounded-[28px] p-6"
        noValidate
        onSubmit={handleSubmit}
      >
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
            title="No pudimos iniciar sesion"
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
          {isSubmitting ? "Entrando..." : "Entrar a DarkMoney"}
        </Button>
      </form>

      <div className="flex flex-wrap justify-between gap-3 text-sm text-storm">
        <NavLink
          className="underline decoration-white/20 underline-offset-4 transition hover:text-ink"
          to="/auth/recovery"
        >
          Olvide mi contrasena
        </NavLink>
        <NavLink
          className="underline decoration-white/20 underline-offset-4 transition hover:text-ink"
          to="/auth/register"
        >
          Crear cuenta
        </NavLink>
      </div>
    </section>
  );
}
