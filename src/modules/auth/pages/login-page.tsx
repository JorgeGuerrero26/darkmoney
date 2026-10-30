import { Eye, EyeOff, LoaderCircle } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router-dom";

import { Button } from "../../../components/ui/button";
import { FormFeedbackBanner } from "../../../components/ui/form-feedback-banner";
import { InlineFormError } from "../../../components/ui/inline-form-error";
import { translateAuthError } from "../auth-errors";
import { useAuth } from "../auth-context";
import { GoogleSignInButton } from "../components/google-sign-in-button";
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
  const registerSearchParams = new URLSearchParams();
  if (nextPath) {
    registerSearchParams.set("next", resolvedNextPath);
  }
  const registerQueryString = registerSearchParams.toString();
  const registerPath = registerQueryString ? `/auth/register?${registerQueryString}` : "/auth/register";

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
      setErrorMessage(translateAuthError(error, "No se pudo iniciar sesión. Inténtalo de nuevo."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="animate-rise-in space-y-7">
      <div className="space-y-3">
        <p className="font-public-mono text-[11px] font-medium uppercase tracking-[0.14em] text-[#a39c90]">Acceso</p>
        <h2 className="font-public-display text-[38px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#f4f1ec]">
          Hola de nuevo
        </h2>
        <p className="max-w-[42ch] text-sm leading-[1.6] text-[#a39c90]">
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
        className="public-form-card space-y-5"
        noValidate
        onSubmit={handleSubmit}
      >
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f4f1ec]">Correo</span>
          <input
            autoComplete="email"
            className="public-field"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="tu@correo.com"
            type="email"
            value={email}
          />
        </label>
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[#f4f1ec]">Contraseña</span>
          <div className="relative">
            <input
              autoComplete="current-password"
              className="public-field pr-12"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8e877c] transition hover:text-[#f4f1ec]"
              onClick={() => setShowPassword((v) => !v)}
              type="button"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative flex shrink-0 items-center justify-center">
            <input
              checked={rememberMe}
              className="peer sr-only"
              onChange={(event) => setRememberMe(event.target.checked)}
              type="checkbox"
            />
            <div className="h-5 w-5 rounded-[5px] border border-[#f4f1ec]/20 bg-[#1a1917] transition peer-checked:border-[#f4f1ec] peer-checked:bg-[#f4f1ec] peer-focus-visible:ring-2 peer-focus-visible:ring-[#f4f1ec]/30" />
            {rememberMe ? (
              <svg className="pointer-events-none absolute h-3 w-3 text-[#141312]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 12 12">
                <polyline points="1.5,6 4.5,9 10.5,3" />
              </svg>
            ) : null}
          </div>
          <span className="text-sm text-[#a39c90]">Recordar mi correo</span>
        </label>
        <NavLink
          className="text-sm text-[#a39c90] transition hover:text-[#f4f1ec]"
          to="/auth/recovery"
        >
          Olvidé mi contraseña
        </NavLink>
        </div>

        {errorMessage ? <InlineFormError message={errorMessage} /> : null}
        {!isConfigured ? (
          <div className="rounded-2xl border border-gold/20 bg-gold/10 px-4 py-3 text-sm text-gold">
            Falta configurar <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en <code>.env</code>.
          </div>
        ) : null}
        <Button
          className="public-auth-submit w-full"
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

      <GoogleSignInButton disabled={!isConfigured || isSubmitting} nextPath={nextPath ? resolvedNextPath : null} />

      <p className="text-sm text-[#a39c90]">
        ¿No tienes cuenta?{" "}
        <NavLink
          className="font-semibold text-[#f4f1ec] underline decoration-[#f4f1ec]/25 underline-offset-4 transition hover:decoration-[#f4f1ec]"
          to={registerPath}
        >
          Crear cuenta gratis
        </NavLink>
      </p>
    </section>
  );
}
