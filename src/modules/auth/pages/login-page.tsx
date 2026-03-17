import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { useAuth } from "../auth-context";
import { isInvitePath, resolvePostAuthPath } from "../invite-resume";

const REMEMBER_EMAIL_KEY = "dm_remembered_email";

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isConfigured, signIn } = useAuth();
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBER_EMAIL_KEY) ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem(REMEMBER_EMAIL_KEY));
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextPath = searchParams.get("next");
  const resolvedNextPath = resolvePostAuthPath(nextPath);
  const isInviteLogin = isInvitePath(nextPath);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    if (rememberMe) {
      localStorage.setItem(REMEMBER_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBER_EMAIL_KEY);
    }

    try {
      await signIn(email, password);
      navigate(resolvedNextPath, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo iniciar sesión.";
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
          Inicia sesión con tu correo y contraseña para entrar a tu espacio personal o compartido.
        </p>
      </div>

      {isInviteLogin ? (
        <FormFeedbackBanner
          description="Después de iniciar sesión te devolveremos a esta invitación para que puedas revisarla y aceptarla."
          title="Tienes una invitación pendiente"
          tone="info"
        />
      ) : null}

      <form
        className="glass-panel space-y-4 rounded-[28px] p-6"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Correo</span>
          <input
            autoComplete="email"
            className="field-dark"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            type="email"
            value={email}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-ink">Contraseña</span>
          <div className="relative">
            <input
              autoComplete="current-password"
              className="field-dark pr-12"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-storm transition hover:text-ink"
              onClick={() => setShowPassword((v) => !v)}
              type="button"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative flex shrink-0 items-center justify-center">
            <input
              checked={rememberMe}
              className="peer sr-only"
              onChange={(event) => setRememberMe(event.target.checked)}
              type="checkbox"
            />
            <div className="h-5 w-5 rounded-[6px] border border-white/20 bg-white/[0.05] transition peer-checked:border-pine/40 peer-checked:bg-pine/20 peer-focus-visible:ring-2 peer-focus-visible:ring-pine/40" />
            {rememberMe ? (
              <svg className="pointer-events-none absolute h-3 w-3 text-pine" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                <polyline points="1.5,6 4.5,9 10.5,3" />
              </svg>
            ) : null}
          </div>
          <span className="text-sm text-storm">Recordar mi correo</span>
        </label>

        {errorMessage ? (
          <FormFeedbackBanner
            description={errorMessage}
            title="No pudimos iniciar sesión"
          />
        ) : null}
        {!isConfigured ? (
          <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
            Falta configurar <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en <code>.env</code>.
          </div>
        ) : null}
        <Button
          className="w-full"
          disabled={!isConfigured || isSubmitting}
          type="submit"
        >
          {isSubmitting ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar a DarkMoney"
          )}
        </Button>
      </form>

      <div className="flex flex-wrap justify-between gap-3 text-sm text-storm">
        <NavLink
          className="underline decoration-white/20 underline-offset-4 transition hover:text-ink"
          to="/auth/recovery"
        >
          Olvidé mi contraseña
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
